'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

/** The customer's in-app notification centre. */
const router = express.Router();
router.use(requireRole('customer'));

function list(db, customerId) {
  const rows = db.prepare(`
    SELECT NotificationID AS id, Type AS type, Title AS title, Body AS body, Link AS link, IsRead AS isRead, CreatedAt AS createdAt
    FROM Notification WHERE CustomerID = ? ORDER BY CreatedAt DESC, NotificationID DESC LIMIT 100
  `).all(customerId).map((n) => ({ ...n, isRead: n.isRead === 1 }));
  return { notifications: rows, unread: rows.filter((n) => !n.isRead).length };
}

router.get('/', (req, res) => {
  res.json(list(getDb(), req.user.id));
});

router.get('/unread-count', (req, res) => {
  const n = getDb().prepare('SELECT COUNT(*) AS n FROM Notification WHERE CustomerID = ? AND IsRead = 0').get(req.user.id).n;
  res.json({ unread: n });
});

router.put('/read-all', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE Notification SET IsRead = 1 WHERE CustomerID = ?').run(req.user.id);
  res.json(list(db, req.user.id));
});

router.put('/:id/read', (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE Notification SET IsRead = 1 WHERE NotificationID = ? AND CustomerID = ?').run(req.params.id, req.user.id);
  if (Number(result.changes) === 0) return res.status(404).json({ error: 'Notification not found.' });
  res.json(list(db, req.user.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM Notification WHERE NotificationID = ? AND CustomerID = ?').run(req.params.id, req.user.id);
  if (Number(result.changes) === 0) return res.status(404).json({ error: 'Notification not found.' });
  res.json(list(db, req.user.id));
});

module.exports = router;
