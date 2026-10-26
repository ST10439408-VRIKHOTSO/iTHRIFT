'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const notifyUtil = require('../utils/notify');
const points = require('../utils/points');

/**
 * Sell to iTHRIFT: customers offer pre-loved pieces to the shop, staff make
 * an offer, the customer accepts or declines, the piece is dropped off and
 * then paid for by EFT or as Thrift Points (with a 20 percent bonus).
 *
 *   Submitted -> Offer made -> Accepted -> Received -> Paid
 *                           -> Declined
 */
const router = express.Router();

const CONDITIONS = ['Excellent', 'Very Good', 'Good', 'Fair'];
const POINTS_BONUS = 1.2;
const POINTS_PER_RAND = 10; // 100 points = R10

const STAFF_NEXT = {
  Submitted: ['Offer made', 'Declined'],
  'Offer made': ['Declined'],
  Accepted: ['Received'],
  Received: ['Paid'],
  Declined: [],
  Paid: [],
};

function toPublic(r) {
  return {
    id: r.SubmissionID,
    ref: `SELL-${String(r.SubmissionID).padStart(4, '0')}`,
    brand: r.Brand,
    category: r.Category,
    size: r.ItemSize,
    condition: r.ConditionGrade,
    description: r.Description,
    askingPrice: r.AskingPrice,
    offerAmount: r.OfferAmount,
    pointsOffer: r.OfferAmount ? Math.round(r.OfferAmount * POINTS_PER_RAND * POINTS_BONUS) : null,
    payoutMethod: r.PayoutMethod,
    staffNote: r.StaffNote,
    status: r.Status,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
    customer: r.FirstName ? `${r.FirstName} ${r.LastName}` : undefined,
    nextStatuses: STAFF_NEXT[r.Status] || [],
  };
}

function load(db, where, params) {
  return db.prepare(`
    SELECT s.*, c.FirstName, c.LastName FROM SellSubmission s JOIN Customer c ON c.CustomerID = s.CustomerID
    ${where} ORDER BY s.UpdatedAt DESC, s.SubmissionID DESC
  `).all(...params).map(toPublic);
}

// Customers see their own submissions; staff see every submission.
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user.type === 'customer') return res.json({ submissions: load(db, 'WHERE s.CustomerID = ?', [req.user.id]) });
  const { status } = req.query;
  res.json({ submissions: status ? load(db, 'WHERE s.Status = ?', [status]) : load(db, '', []) });
});

router.post('/', requireRole('customer'), (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const brand = String(b.brand || '').trim();
  const category = String(b.category || '').trim();
  const size = String(b.size || '').trim();
  const description = String(b.description || '').trim();
  const asking = b.askingPrice === '' || b.askingPrice == null ? null : Number(b.askingPrice);
  if (!brand) return res.status(400).json({ error: 'Tell us the brand.' });
  if (!db.prepare('SELECT 1 FROM Category WHERE Name = ?').get(category)) return res.status(400).json({ error: 'Choose a category.' });
  if (!size) return res.status(400).json({ error: 'Tell us the size.' });
  if (!CONDITIONS.includes(b.condition)) return res.status(400).json({ error: 'Choose a condition grade.' });
  if (description.length < 15) return res.status(400).json({ error: 'Describe the piece in a little more detail (at least 15 characters), including any wear.' });
  if (asking != null && (!Number.isFinite(asking) || asking < 0 || asking > 20000)) return res.status(400).json({ error: 'Enter an asking price in rand, or leave it empty.' });
  const open = db.prepare(`SELECT COUNT(*) AS n FROM SellSubmission WHERE CustomerID = ? AND Status IN ('Submitted','Offer made')`).get(req.user.id).n;
  if (open >= 10) return res.status(429).json({ error: 'You have ten pieces waiting for an offer already. We will get through those first.' });
  db.prepare(`INSERT INTO SellSubmission (CustomerID, Brand, Category, ItemSize, ConditionGrade, Description, AskingPrice) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, brand.slice(0, 40), category, size.slice(0, 20), b.condition, description.slice(0, 500), asking);
  res.status(201).json({ submissions: load(db, 'WHERE s.CustomerID = ?', [req.user.id]) });
});

// The customer accepts (choosing a payout) or declines an offer.
router.put('/:id/respond', requireRole('customer'), (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT * FROM SellSubmission WHERE SubmissionID = ? AND CustomerID = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Submission not found.' });
  if (s.Status !== 'Offer made') return res.status(409).json({ error: 'There is no offer waiting on this piece.' });
  const { accept, payoutMethod } = req.body || {};
  if (accept === true) {
    if (!['eft', 'points'].includes(payoutMethod)) return res.status(400).json({ error: 'Choose to be paid by EFT or in Thrift Points.' });
    db.prepare(`UPDATE SellSubmission SET Status = 'Accepted', PayoutMethod = ?, UpdatedAt = datetime('now') WHERE SubmissionID = ?`).run(payoutMethod, s.SubmissionID);
  } else if (accept === false) {
    db.prepare(`UPDATE SellSubmission SET Status = 'Declined', UpdatedAt = datetime('now') WHERE SubmissionID = ?`).run(s.SubmissionID);
  } else {
    return res.status(400).json({ error: 'Say whether you accept the offer.' });
  }
  res.json({ submissions: load(db, 'WHERE s.CustomerID = ?', [req.user.id]) });
});

// Staff move a submission along: make an offer, decline, mark received, mark paid.
router.put('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT * FROM SellSubmission WHERE SubmissionID = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Submission not found.' });
  const { status, offerAmount, staffNote } = req.body || {};
  if (!STAFF_NEXT[s.Status].includes(status)) {
    return res.status(409).json({ error: `A submission that is ${s.Status.toLowerCase()} cannot be marked ${String(status).toLowerCase()}.` });
  }
  const note = staffNote ? String(staffNote).trim().slice(0, 300) : s.StaffNote;
  let offer = s.OfferAmount;
  if (status === 'Offer made') {
    offer = Number(offerAmount);
    if (!Number.isFinite(offer) || offer <= 0 || offer > 20000) return res.status(400).json({ error: 'Enter an offer in rand.' });
  }
  const ref = `SELL-${String(s.SubmissionID).padStart(4, '0')}`;
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE SellSubmission SET Status = ?, OfferAmount = ?, StaffNote = ?, UpdatedAt = datetime('now') WHERE SubmissionID = ?`)
      .run(status, offer, note, s.SubmissionID);
    if (status === 'Paid' && s.PayoutMethod === 'points') {
      points.add(db, s.CustomerID, Math.round(offer * POINTS_PER_RAND * POINTS_BONUS), `Paid for ${ref} (${s.Brand} ${s.Category})`);
    }
    const words = {
      'Offer made': ['We have made you an offer', `We can offer R${offer} for your ${s.Brand} ${s.Category.toLowerCase()}. Accept or decline it under Sell to us.`],
      Declined: ['About the piece you offered us', `We cannot take your ${s.Brand} ${s.Category.toLowerCase()} this time.${note ? ' ' + note : ''}`],
      Received: ['We received your piece', `Your ${s.Brand} ${s.Category.toLowerCase()} arrived. Payment follows within 2 working days.`],
      Paid: ['You have been paid', s.PayoutMethod === 'points' ? `Thrift Points for ${ref} are in your balance.` : `R${offer} for ${ref} has been paid by EFT.`],
    }[status];
    if (words) notifyUtil.notify(db, s.CustomerID, { type: 'sell', title: words[0], body: words[1], link: '/sell' });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ submissions: load(db, '', []) });
});

module.exports = router;
