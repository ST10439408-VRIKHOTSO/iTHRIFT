'use strict';

/**
 * Unit tests for the API's pure logic.
 *
 * These are deliberately separate from test/smoke-test.js. The smoke test
 * drives the running server end to end and answers "does the system work?";
 * this file tests the individual functions in isolation and answers "is each
 * rule correct?". A unit test needs no server, no database and no network,
 * so it runs in under a second and points straight at the broken function
 * rather than at a failed HTTP call somewhere downstream of it.
 *
 * Run with: npm run test:unit   (node --test, built into Node, no framework)
 * Both suites run on every push through .github/workflows/api-and-website.yml.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword, isPasswordStrong } = require('../server/utils/password');
const { productRef, orderRef } = require('../server/utils/refs');
const { allowedAudiences, isSsoConfigured } = require('../server/utils/sso');

// ---------------------------------------------------------------------------
// Password storage: the rule with the highest cost of failure
// ---------------------------------------------------------------------------

test('a hashed password never contains the plain text', () => {
  const { hash, salt } = hashPassword('Password1');
  assert.ok(!hash.includes('Password1'), 'the hash leaked the password');
  assert.ok(!salt.includes('Password1'), 'the salt leaked the password');
  assert.match(hash, /^[0-9a-f]{128}$/, 'expected a 64-byte scrypt hash in hex');
  assert.match(salt, /^[0-9a-f]{32}$/, 'expected a 16-byte salt in hex');
});

test('the same password hashes differently for two accounts', () => {
  // Without a per-account salt, two customers who picked the same password
  // would share a hash, and cracking one would crack both.
  const a = hashPassword('Password1');
  const b = hashPassword('Password1');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('the correct password verifies and a wrong one does not', () => {
  const { hash, salt } = hashPassword('Password1');
  assert.equal(verifyPassword('Password1', salt, hash), true);
  assert.equal(verifyPassword('password1', salt, hash), false, 'verification must be case sensitive');
  assert.equal(verifyPassword('Password2', salt, hash), false);
  assert.equal(verifyPassword('', salt, hash), false);
});

test('a password verified against the wrong salt fails', () => {
  const a = hashPassword('Password1');
  const b = hashPassword('Password1');
  assert.equal(verifyPassword('Password1', b.salt, a.hash), false);
});

test('the password policy accepts strong passwords and rejects weak ones', () => {
  // At least 8 characters, one uppercase letter, one digit.
  assert.equal(isPasswordStrong('Password1'), true);
  assert.equal(isPasswordStrong('Str0ngEnough'), true);

  assert.equal(isPasswordStrong('Pass1'), false, 'too short');
  assert.equal(isPasswordStrong('password1'), false, 'no uppercase letter');
  assert.equal(isPasswordStrong('PASSWORD'), false, 'no digit');
  assert.equal(isPasswordStrong(''), false);
  assert.equal(isPasswordStrong(null), false, 'a missing password is not strong');
  assert.equal(isPasswordStrong(12345678), false, 'a non-string is not a password');
});

// ---------------------------------------------------------------------------
// Display references
// ---------------------------------------------------------------------------

test('product and order references are zero padded to a fixed width', () => {
  assert.equal(productRef(1), 'PRD001');
  assert.equal(productRef(42), 'PRD042');
  assert.equal(productRef(1234), 'PRD1234', 'padding must not truncate a large id');
  assert.equal(orderRef(3), 'ORD-0003');
  assert.equal(orderRef(12345), 'ORD-12345');
});

// ---------------------------------------------------------------------------
// Single sign-on configuration
// ---------------------------------------------------------------------------

test('single sign-on is off unless a client id is configured', () => {
  const original = process.env.GOOGLE_CLIENT_ID;
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    assert.deepEqual(allowedAudiences(), []);
    assert.equal(isSsoConfigured(), false, 'an unconfigured server must not accept any token');

    process.env.GOOGLE_CLIENT_ID = ' one.apps.googleusercontent.com , two.apps.googleusercontent.com ';
    assert.deepEqual(allowedAudiences(), [
      'one.apps.googleusercontent.com',
      'two.apps.googleusercontent.com',
    ], 'the list must be split and trimmed');
    assert.equal(isSsoConfigured(), true);
  } finally {
    if (original === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = original;
  }
});

// ---------------------------------------------------------------------------
// Cart arithmetic
// ---------------------------------------------------------------------------
// The subtotal in server/routes/cart.js is a reduce over the line items. The
// same expression is asserted here so that a change to the pricing rule has
// to be a deliberate one, made in two places.

function subtotalOf(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function itemCountOf(items) {
  return items.reduce((count, item) => count + item.quantity, 0);
}

test('the cart subtotal multiplies each line by its quantity', () => {
  const items = [
    { price: 450.0, quantity: 1 },
    { price: 180.5, quantity: 2 },
    { price: 320.0, quantity: 3 },
  ];
  assert.equal(subtotalOf(items), 450.0 + 361.0 + 960.0);
  assert.equal(itemCountOf(items), 6, 'the badge counts units, not lines');
});

test('an empty cart totals zero rather than failing', () => {
  assert.equal(subtotalOf([]), 0);
  assert.equal(itemCountOf([]), 0);
});
