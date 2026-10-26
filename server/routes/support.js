'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRef } = require('../utils/refs');
const notifyUtil = require('../utils/notify');

/**
 * Help conversations between a customer and the shop. A customer opens a
 * ticket from Help, both sides reply in a thread, and staff close it once
 * it is sorted. Customers only ever see their own tickets.
 */
const router = express.Router();

const TOPICS = ['Order', 'Return', 'Selling', 'Account', 'Other'];

function summary(t) {
  return {
    id: t.TicketID,
    ref: `HELP-${String(t.TicketID).padStart(4, '0')}`,
    topic: t.Topic,
    subject: t.Subject,
    orderId: t.OrderID,
    orderRef: t.OrderID ? orderRef(t.OrderID) : null,
    status: t.Status,
    createdAt: t.CreatedAt,
    updatedAt: t.UpdatedAt,
    customer: t.FirstName ? `${t.FirstName} ${t.LastName}` : undefined,
    lastMessage: t.LastMessage,
    messageCount: t.MessageCount,
  };
}

const LIST_SELECT = `
  SELECT t.*, c.FirstName, c.LastName,
         (SELECT Body FROM SupportMessage m WHERE m.TicketID = t.TicketID ORDER BY m.MessageID DESC LIMIT 1) AS LastMessage,
         (SELECT COUNT(*) FROM SupportMessage m WHERE m.TicketID = t.TicketID) AS MessageCount
  FROM SupportTicket t JOIN Customer c ON c.CustomerID = t.CustomerID`;

function loadTicket(db, id, user) {
  const t = db.prepare(LIST_SELECT + ' WHERE t.TicketID = ?').get(id);
  if (!t) return { status: 404, error: 'Conversation not found.' };
  if (user.type === 'customer' && t.CustomerID !== user.id) return { status: 404, error: 'Conversation not found.' };
  const messages = db.prepare(`SELECT MessageID AS id, Sender AS sender, AuthorName AS author, Body AS body, CreatedAt AS createdAt
    FROM SupportMessage WHERE TicketID = ? ORDER BY MessageID`).all(t.TicketID);
  return { ticket: { ...summary(t), messages, customerId: t.CustomerID } };
}

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const rows = req.user.type === 'customer'
    ? db.prepare(LIST_SELECT + ' WHERE t.CustomerID = ? ORDER BY t.UpdatedAt DESC, t.TicketID DESC').all(req.user.id)
    : (req.query.status
      ? db.prepare(LIST_SELECT + ' WHERE t.Status = ? ORDER BY t.UpdatedAt DESC, t.TicketID DESC').all(req.query.status)
      : db.prepare(LIST_SELECT + ` ORDER BY CASE t.Status WHEN 'Open' THEN 0 WHEN 'Answered' THEN 1 ELSE 2 END, t.UpdatedAt DESC`).all());
  res.json({ tickets: rows.map(summary), topics: TOPICS });
});

router.post('/', requireRole('customer'), (req, res) => {
  const db = getDb();
  const { topic, subject, message, orderId } = req.body || {};
  if (!TOPICS.includes(topic)) return res.status(400).json({ error: 'Choose what your message is about.' });
  const subj = String(subject || '').trim();
  const body = String(message || '').trim();
  if (subj.length < 4) return res.status(400).json({ error: 'Add a short subject.' });
  if (body.length < 10) return res.status(400).json({ error: 'Tell us a little more (at least 10 characters).' });
  let order = null;
  if (orderId) {
    order = db.prepare('SELECT OrderID FROM Orders WHERE OrderID = ? AND CustomerID = ?').get(orderId, req.user.id);
    if (!order) return res.status(400).json({ error: 'That order was not found on your account.' });
  }
  const open = db.prepare(`SELECT COUNT(*) AS n FROM SupportTicket WHERE CustomerID = ? AND Status = 'Open'`).get(req.user.id).n;
  if (open >= 5) return res.status(429).json({ error: 'You have five open conversations. We will reply to those first.' });
  db.exec('BEGIN');
  try {
    const info = db.prepare('INSERT INTO SupportTicket (CustomerID, Topic, Subject, OrderID) VALUES (?, ?, ?, ?)')
      .run(req.user.id, topic, subj.slice(0, 80), order ? order.OrderID : null);
    const id = Number(info.lastInsertRowid);
    db.prepare(`INSERT INTO SupportMessage (TicketID, Sender, AuthorName, Body) VALUES (?, 'customer', ?, ?)`).run(id, req.user.name, body.slice(0, 1000));
    db.exec('COMMIT');
    res.status(201).json(loadTicket(db, id, req.user));
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

router.get('/:id', requireAuth, (req, res) => {
  const result = loadTicket(getDb(), req.params.id, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// Either side replies. A staff reply marks the conversation answered and tells the customer.
router.post('/:id/messages', requireAuth, (req, res) => {
  const db = getDb();
  const found = loadTicket(db, req.params.id, req.user);
  if (found.error) return res.status(found.status).json({ error: found.error });
  const body = String((req.body || {}).message || '').trim();
  if (body.length < 2) return res.status(400).json({ error: 'Write a message first.' });
  const isStaff = req.user.type !== 'customer';
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO SupportMessage (TicketID, Sender, AuthorName, Body) VALUES (?, ?, ?, ?)')
      .run(found.ticket.id, isStaff ? 'staff' : 'customer', isStaff ? 'iTHRIFT Support' : req.user.name, body.slice(0, 1000));
    db.prepare(`UPDATE SupportTicket SET Status = ?, UpdatedAt = datetime('now') WHERE TicketID = ?`)
      .run(isStaff ? 'Answered' : 'Open', found.ticket.id);
    if (isStaff) {
      notifyUtil.notify(db, found.ticket.customerId, {
        type: 'support', title: 'We replied to your message', body: `"${found.ticket.subject}": ${body.slice(0, 90)}${body.length > 90 ? '...' : ''}`,
        link: `/help/messages/${found.ticket.id}`,
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.status(201).json(loadTicket(db, found.ticket.id, req.user));
});

router.put('/:id/status', requireAuth, (req, res) => {
  const db = getDb();
  const found = loadTicket(db, req.params.id, req.user);
  if (found.error) return res.status(found.status).json({ error: found.error });
  const { status } = req.body || {};
  // Customers can close their own conversation; staff can also reopen one.
  const allowed = req.user.type === 'customer' ? ['Closed'] : ['Open', 'Closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'That status cannot be set here.' });
  db.prepare(`UPDATE SupportTicket SET Status = ?, UpdatedAt = datetime('now') WHERE TicketID = ?`).run(status, found.ticket.id);
  res.json(loadTicket(db, found.ticket.id, req.user));
});

module.exports = router;
