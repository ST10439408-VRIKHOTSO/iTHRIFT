'use strict';

const express = require('express');
const { getDb } = require('../db');
const { hashPassword, verifyPassword, isPasswordStrong } = require('../utils/password');
const { createSession, destroySession } = require('../middleware/auth');

const router = express.Router();

// UC1: Register - a visitor creates a customer account.
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password, phone, address, city, postalCode } = req.body || {};

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email and password are all required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!isPasswordStrong(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter and a number.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT CustomerID FROM Customer WHERE Email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const { hash, salt } = hashPassword(password);
  const info = db.prepare(`
    INSERT INTO Customer (FirstName, LastName, Email, PasswordHash, PasswordSalt, Phone, AddressLine, City, PostalCode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(firstName.trim(), lastName.trim(), email.toLowerCase(), hash, salt, phone || null, address || null, city || null, postalCode || null);

  const customerId = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO Cart (CustomerID) VALUES (?)').run(customerId);

  const user = { type: 'customer', id: customerId, name: `${firstName} ${lastName}` };
  const token = createSession(user);
  res.status(201).json({ token, user });
});

// UC2: Log in - a customer, staff member or administrator signs in.
// `identifier` is an email for customers, or a username for staff/admin.
router.post('/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter your email/username and password.' });
  }

  const db = getDb();

  const customer = db.prepare('SELECT * FROM Customer WHERE Email = ?').get(identifier.toLowerCase());
  if (customer) {
    if (!verifyPassword(password, customer.PasswordSalt, customer.PasswordHash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (customer.Status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Please contact iTHRIFT support.' });
    }
    const user = { type: 'customer', id: customer.CustomerID, name: `${customer.FirstName} ${customer.LastName}` };
    const token = createSession(user);
    return res.json({ token, user });
  }

  const admin = db.prepare('SELECT * FROM Admin WHERE Username = ?').get(identifier);
  if (admin) {
    if (!verifyPassword(password, admin.PasswordSalt, admin.PasswordHash)) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    const user = { type: admin.Role, id: admin.AdminID, name: admin.FullName };
    const token = createSession(user);
    return res.json({ token, user });
  }

  res.status(401).json({ error: 'Incorrect email/username or password.' });
});

router.post('/logout', (req, res) => {
  if (req.token) destroySession(req.token);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: req.user });
});

module.exports = router;
