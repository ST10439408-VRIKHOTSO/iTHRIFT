'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('customer'));

function toPublic(row) {
  return {
    id: row.AddressID,
    label: row.Label,
    recipient: row.Recipient,
    phone: row.Phone,
    line1: row.Line1,
    suburb: row.Suburb,
    city: row.City,
    postalCode: row.PostalCode,
    isDefault: row.IsDefault === 1,
  };
}

function list(db, customerId) {
  return db.prepare('SELECT * FROM Address WHERE CustomerID = ? ORDER BY IsDefault DESC, AddressID')
    .all(customerId).map(toPublic);
}

/** Checks a submitted address. Returns the cleaned values, or an error message. */
function validate(body) {
  const v = {
    label: String(body.label || '').trim() || 'Home',
    recipient: String(body.recipient || '').trim(),
    phone: String(body.phone || '').trim() || null,
    line1: String(body.line1 || '').trim(),
    suburb: String(body.suburb || '').trim() || null,
    city: String(body.city || '').trim(),
    postalCode: String(body.postalCode || '').trim(),
  };
  if (!v.recipient) return { error: "Enter the name of the person receiving the parcel." };
  if (v.line1.length < 5) return { error: 'Enter the street address, including the house or building number.' };
  if (!v.city) return { error: 'Enter the city or town.' };
  if (!/^\d{4}$/.test(v.postalCode)) return { error: 'A South African postal code has four digits.' };
  if (v.phone && !/^(\+27|0)\d{9}$/.test(v.phone.replace(/\s/g, ''))) {
    return { error: 'Enter a South African phone number, for example 082 123 4567.' };
  }
  if (v.label.length > 30) return { error: 'Keep the label to 30 characters or fewer.' };
  return { value: v };
}

router.get('/', (req, res) => {
  res.json({ addresses: list(getDb(), req.user.id) });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { value, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  const count = db.prepare('SELECT COUNT(*) AS n FROM Address WHERE CustomerID = ?').get(req.user.id).n;
  if (count >= 10) return res.status(400).json({ error: 'You can save up to ten addresses.' });
  const makeDefault = count === 0 || req.body.isDefault === true;
  db.exec('BEGIN');
  try {
    if (makeDefault) db.prepare('UPDATE Address SET IsDefault = 0 WHERE CustomerID = ?').run(req.user.id);
    db.prepare(`
      INSERT INTO Address (CustomerID, Label, Recipient, Phone, Line1, Suburb, City, PostalCode, IsDefault)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, value.label, value.recipient, value.phone, value.line1, value.suburb, value.city, value.postalCode, makeDefault ? 1 : 0);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.status(201).json({ addresses: list(db, req.user.id) });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM Address WHERE AddressID = ? AND CustomerID = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found.' });
  const { value, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  db.prepare(`
    UPDATE Address SET Label = ?, Recipient = ?, Phone = ?, Line1 = ?, Suburb = ?, City = ?, PostalCode = ?
    WHERE AddressID = ?
  `).run(value.label, value.recipient, value.phone, value.line1, value.suburb, value.city, value.postalCode, existing.AddressID);
  res.json({ addresses: list(db, req.user.id) });
});

// Make one address the default; the previous default stops being one.
router.put('/:id/default', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT AddressID FROM Address WHERE AddressID = ? AND CustomerID = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found.' });
  db.exec('BEGIN');
  db.prepare('UPDATE Address SET IsDefault = 0 WHERE CustomerID = ?').run(req.user.id);
  db.prepare('UPDATE Address SET IsDefault = 1 WHERE AddressID = ?').run(existing.AddressID);
  db.exec('COMMIT');
  res.json({ addresses: list(db, req.user.id) });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM Address WHERE AddressID = ? AND CustomerID = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Address not found.' });
  db.prepare('DELETE FROM Address WHERE AddressID = ?').run(existing.AddressID);
  // Deleting the default promotes the oldest remaining address.
  if (existing.IsDefault === 1) {
    const next = db.prepare('SELECT AddressID FROM Address WHERE CustomerID = ? ORDER BY AddressID LIMIT 1').get(req.user.id);
    if (next) db.prepare('UPDATE Address SET IsDefault = 1 WHERE AddressID = ?').run(next.AddressID);
  }
  res.json({ addresses: list(db, req.user.id) });
});

module.exports = router;
module.exports.validateAddress = validate;
module.exports.addressToPublic = toPublic;
