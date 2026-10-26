'use strict';

const express = require('express');
const { getDb } = require('../db');
const { hashPassword, verifyPassword, isPasswordStrong } = require('../utils/password');
const { verifyGoogleIdToken, isSsoConfigured, webClientId } = require('../utils/sso');
const { createSession, destroySession, requireAuth, requireRole } = require('../middleware/auth');
const appCodes = require('../utils/app-codes');
const { normalisePhone, formatPhone, looksLikePhone, findCustomerByPhone, PHONE_HINT } = require('../utils/phone');

const router = express.Router();

// UC1: Register. A visitor creates a customer account.
router.post('/register', (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, phone, address, city, postalCode } = req.body || {};

  if (!firstName || !lastName || !email || !password || !phone) {
    return res.status(400).json({ error: 'First name, last name, email, cellphone number and password are all required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const national = normalisePhone(phone);
  if (!national) {
    return res.status(400).json({ error: PHONE_HINT, field: 'phone' });
  }
  if (!isPasswordStrong(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter and a number.' });
  }
  // Older clients do not send the confirmation, so only check it when given.
  if (confirmPassword !== undefined && confirmPassword !== password) {
    return res.status(400).json({ error: 'The two passwords do not match.', field: 'confirmPassword' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT CustomerID FROM Customer WHERE Email = ?').get(email.toLowerCase())
    || db.prepare('SELECT AdminID FROM Admin WHERE Email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.', field: 'email' });
  }
  if (findCustomerByPhone(db, national)) {
    return res.status(409).json({ error: 'An account with that cellphone number already exists.', field: 'phone' });
  }

  const { hash, salt } = hashPassword(password);
  const info = db.prepare(`
    INSERT INTO Customer (FirstName, LastName, Email, PasswordHash, PasswordSalt, Phone, AddressLine, City, PostalCode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(firstName.trim(), lastName.trim(), email.toLowerCase(), hash, salt, formatPhone(national), address || null, city || null, postalCode || null);

  const customerId = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO Cart (CustomerID) VALUES (?)').run(customerId);

  const user = { type: 'customer', id: customerId, name: `${firstName} ${lastName}` };
  const token = createSession(user);
  res.status(201).json({ token, user });
});

// UC2: Log in. A customer, staff member or administrator signs in with an
// email address, or a customer with their cellphone number.
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const identifier = String((req.body || {}).identifier || '').trim();
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter your email or cellphone number and your password.' });
  }

  const db = getDb();
  const byPhone = !identifier.includes('@') && looksLikePhone(identifier);
  if (!byPhone && !identifier.includes('@')) {
    return res.status(400).json({ error: 'Sign in with your email address or cellphone number.' });
  }

  const customer = byPhone
    ? findCustomerByPhone(db, identifier)
    : db.prepare('SELECT * FROM Customer WHERE Email = ?').get(identifier.toLowerCase());
  if (customer) {
    // An account created through single sign-on has no password on this
    // system, so there is nothing here to check it against. Say so plainly
    // instead of returning "incorrect password", which would send the
    // customer off resetting a password that never existed.
    if (customer.AuthProvider !== 'password') {
      return res.status(409).json({ error: 'This account signs in with Google. Use the "Continue with Google" button instead.' });
    }
    if (!verifyPassword(password, customer.PasswordSalt, customer.PasswordHash)) {
      return res.status(401).json({ error: 'Incorrect sign-in details or password.' });
    }
    if (customer.Status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended. Please contact iTHRIFT support.' });
    }
    const user = { type: 'customer', id: customer.CustomerID, name: `${customer.FirstName} ${customer.LastName}` };
    const token = createSession(user);
    return res.json({ token, user });
  }

  const admin = byPhone ? null : db.prepare('SELECT * FROM Admin WHERE Email = ?').get(identifier.toLowerCase());
  if (admin) {
    if (!verifyPassword(password, admin.PasswordSalt, admin.PasswordHash)) {
      return res.status(401).json({ error: 'Incorrect sign-in details or password.' });
    }
    const user = { type: admin.Role, id: admin.AdminID, name: admin.FullName };
    const token = createSession(user);
    return res.json({ token, user });
  }

  res.status(401).json({ error: 'Incorrect sign-in details or password.' });
});

// UC2b: Single sign-on. The client proves who the customer is with a Google
// ID token instead of a password, and we swap that for one of our own session
// tokens. Everything downstream (cart, checkout, orders) then works exactly as
// it does for a password account, because the session looks the same.
router.post('/sso', async (req, res) => {
  const { idToken, challenge } = req.body || {};
  if (challenge !== undefined && !appCodes.isChallenge(challenge)) {
    return res.status(400).json({ error: 'This sign-in link from the app is not valid. Go back to the app and try again.' });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch (err) {
    // verifyGoogleIdToken only throws messages that are safe to show a user.
    console.warn('[auth] single sign-on rejected:', err.message);
    return res.status(401).json({ error: err.message });
  }

  const db = getDb();

  // Match on the provider's subject first. It never changes, whereas a
  // person can change the email address on their Google account.
  let customer = db.prepare('SELECT * FROM Customer WHERE ProviderSubject = ?').get(identity.subject);

  if (!customer) {
    const byEmail = db.prepare('SELECT * FROM Customer WHERE Email = ?').get(identity.email);
    if (byEmail) {
      // The address already belongs to a password account. Linking the two
      // automatically would let anyone who can create a Google account on
      // that address walk into the existing one, so we refuse and explain.
      if (byEmail.AuthProvider === 'password') {
        return res.status(409).json({
          error: 'An account with that email already exists. Sign in with your email and password instead.',
        });
      }
      customer = byEmail;
    }
  }

  if (!customer) {
    const info = db.prepare(`
      INSERT INTO Customer (FirstName, LastName, Email, AuthProvider, ProviderSubject)
      VALUES (?, ?, ?, 'google', ?)
    `).run(identity.firstName, identity.lastName, identity.email, identity.subject);

    const newId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO Cart (CustomerID) VALUES (?)').run(newId);
    customer = db.prepare('SELECT * FROM Customer WHERE CustomerID = ?').get(newId);
    console.log(`[auth] created customer ${newId} through Google single sign-on`);
  }

  if (customer.Status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Please contact iTHRIFT support.' });
  }

  const user = { type: 'customer', id: customer.CustomerID, name: `${customer.FirstName} ${customer.LastName}` };
  // From the app's browser tab: a single-use code for the app, not a session
  // (see server/utils/app-codes.js).
  if (challenge) return res.json({ code: appCodes.issue(user, challenge) });
  const token = createSession(user);
  res.json({ token, user });
});

// The app swaps the single-use code for a session, proving with the secret
// behind the challenge that it is the app that started the sign-in.
router.post('/sso/exchange', (req, res) => {
  const { code, verifier } = req.body || {};
  const result = appCodes.redeem(code, verifier);
  if (result.error) return res.status(400).json({ error: result.error });
  const token = createSession(result.user);
  res.json({ token, user: result.user });
});

// Lets a client hide the single sign-on button when the server it is pointed
// at has no provider configured, rather than offering a button that fails.
router.get('/sso/status', (_req, res) => {
  // The website needs the OAuth web client id to draw Google's sign-in
  // button. A client id is public by design (Google shows it in every
  // sign-in page), so returning it here is safe; it stays out of the
  // repository because it is read from the environment at run time.
  const enabled = isSsoConfigured();
  res.json({ enabled, provider: 'google', clientId: enabled ? webClientId() : null });
});

router.post('/logout', (req, res) => {
  if (req.token) destroySession(req.token);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// Account settings
// ---------------------------------------------------------------------------
// The settings screen in the app reads and writes through these two routes.
// Only the signed-in customer's own row is ever touched: the CustomerID comes
// from the session, never from the request body, so a customer cannot edit
// somebody else's details by changing an id on the phone.

// The customer's own profile, for populating the settings screen.
router.get('/profile', requireAuth, requireRole('customer'), (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT CustomerID, FirstName, LastName, Email, Phone, AddressLine, City, PostalCode, AuthProvider, CreatedAt
    FROM Customer WHERE CustomerID = ?
  `).get(req.user.id);

  if (!row) return res.status(404).json({ error: 'That account no longer exists.' });

  res.json({
    profile: {
      id: row.CustomerID,
      firstName: row.FirstName,
      lastName: row.LastName,
      email: row.Email,
      phone: row.Phone,
      address: row.AddressLine,
      city: row.City,
      postalCode: row.PostalCode,
      authProvider: row.AuthProvider,
      // An SSO customer has no password here, so the app hides the
      // "change password" section rather than offering a dead end.
      canChangePassword: row.AuthProvider === 'password',
      createdAt: row.CreatedAt,
    },
  });
});

// Update the profile fields a customer is allowed to change. Email, role and
// status are deliberately not in this list, because changing an email address is an
// identity change, and status is a staff decision.
router.put('/profile', requireAuth, requireRole('customer'), (req, res) => {
  const { firstName, lastName, phone, address, city, postalCode } = req.body || {};

  if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
    return res.status(400).json({ error: 'First name and last name are both required.' });
  }
  if (postalCode && !/^\d{4}$/.test(String(postalCode).trim())) {
    return res.status(400).json({ error: 'A South African postal code is four digits.' });
  }
  const national = normalisePhone(phone);
  if (!national) {
    return res.status(400).json({ error: PHONE_HINT, field: 'phone' });
  }

  const db = getDb();
  if (findCustomerByPhone(db, national, req.user.id)) {
    return res.status(409).json({ error: 'Another account already uses that cellphone number.', field: 'phone' });
  }
  db.prepare(`
    UPDATE Customer
    SET FirstName = ?, LastName = ?, Phone = ?, AddressLine = ?, City = ?, PostalCode = ?
    WHERE CustomerID = ?
  `).run(
    firstName.trim(),
    lastName.trim(),
    formatPhone(national),
    address ? String(address).trim() : null,
    city ? String(city).trim() : null,
    postalCode ? String(postalCode).trim() : null,
    req.user.id
  );

  // The display name is cached in the session, so refresh it or the header
  // keeps showing the old name until the customer signs out and back in.
  req.user.name = `${firstName.trim()} ${lastName.trim()}`;
  console.log(`[auth] customer ${req.user.id} updated their profile`);

  res.json({ ok: true, user: req.user });
});

// Change password. The current password is required even though the caller is
// already signed in, so that a borrowed unlocked phone cannot be used to lock
// the real owner out of their account.
router.post('/change-password', requireAuth, requireRole('customer'), (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Enter your current password and your new password.' });
  }

  const db = getDb();
  const customer = db.prepare('SELECT * FROM Customer WHERE CustomerID = ?').get(req.user.id);
  if (!customer) return res.status(404).json({ error: 'That account no longer exists.' });

  if (customer.AuthProvider !== 'password') {
    return res.status(409).json({ error: 'This account signs in with Google, so it has no password to change.' });
  }
  if (!verifyPassword(currentPassword, customer.PasswordSalt, customer.PasswordHash)) {
    return res.status(401).json({ error: 'Your current password is not correct.' });
  }
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter and a number.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Your new password must be different from your current one.' });
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE Customer SET PasswordHash = ?, PasswordSalt = ? WHERE CustomerID = ?')
    .run(hash, salt, req.user.id);

  console.log(`[auth] customer ${req.user.id} changed their password`);
  res.json({ ok: true });
});

module.exports = router;
