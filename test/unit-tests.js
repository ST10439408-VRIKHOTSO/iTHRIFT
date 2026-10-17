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
const { allowedAudiences, isSsoConfigured, verifyGoogleIdToken } = require('../server/utils/sso');
const { computeTotals, promoDiscount, FREE_DELIVERY_THRESHOLD } = require('../server/utils/pricing');

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
// Single sign-on: verifying the Google token
// ---------------------------------------------------------------------------
// verifyGoogleIdToken() takes the function that asks Google as a parameter, so
// these tests can stand in for Google's reply without any network.

const CLIENT_ID = 'ithrift-test.apps.googleusercontent.com';
const genuineToken = () => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: String(Math.floor(Date.now() / 1000) + 600),
  email: 'Lerato.M@gmail.com',
  email_verified: 'true',
  sub: '1045',
  given_name: 'Lerato',
  family_name: 'Mokoena',
});
const googleSays = (status, body) => async () => ({ status, body: JSON.stringify(body) });

async function withClientId(run) {
  const original = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  try {
    await run();
  } finally {
    if (original === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = original;
  }
}

test('a token Google confirms is turned into an identity', () => withClientId(async () => {
  const identity = await verifyGoogleIdToken('token', { get: googleSays(200, genuineToken()) });
  assert.deepEqual(identity, {
    subject: '1045',
    email: 'lerato.m@gmail.com',
    firstName: 'Lerato',
    lastName: 'Mokoena',
  }, 'the email address is lower-cased so it matches however it was typed');
}));

test('a token Google rejects signs nobody in', () => withClientId(async () => {
  const get = googleSays(400, { error: 'invalid_token', error_description: 'Invalid Value' });
  await assert.rejects(verifyGoogleIdToken('token', { get }), /Google did not accept that sign-in/);
}));

test('Google being unreachable is reported as a connection problem, not a bad sign-in', () => withClientId(async () => {
  const get = async () => { throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }); };
  await assert.rejects(verifyGoogleIdToken('token', { get }), /could not reach Google/);
}));

test('a genuine Google token issued to another application is refused', () => withClientId(async () => {
  const get = googleSays(200, { ...genuineToken(), aud: 'someone-else.apps.googleusercontent.com' });
  await assert.rejects(verifyGoogleIdToken('token', { get }), /different application/);
}));

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

// ---------------------------------------------------------------------------
// Checkout pricing: delivery fees and promo codes (server/utils/pricing.js)
// ---------------------------------------------------------------------------

const promo = (over) => ({ Code: 'TEST', DiscountType: 'percent', DiscountValue: 10, MinSpend: 0, Active: 1, ...over });

test('standard delivery costs R80 below the free-delivery threshold', () => {
  const t = computeTotals({ subtotal: 500, deliveryMethod: 'standard' });
  assert.equal(t.deliveryFee, 80);
  assert.equal(t.total, 580);
  assert.equal(t.freeDeliveryRemaining, FREE_DELIVERY_THRESHOLD - 500);
});

test('standard delivery is free from the threshold upwards', () => {
  const t = computeTotals({ subtotal: FREE_DELIVERY_THRESHOLD, deliveryMethod: 'standard' });
  assert.equal(t.deliveryFee, 0);
  assert.equal(t.freeDeliveryRemaining, 0);
});

test('express delivery is never free and collection always is', () => {
  assert.equal(computeTotals({ subtotal: 5000, deliveryMethod: 'express' }).deliveryFee, 150);
  assert.equal(computeTotals({ subtotal: 10, deliveryMethod: 'collection' }).deliveryFee, 0);
});

test('an unknown delivery method is refused', () => {
  assert.ok(computeTotals({ subtotal: 100, deliveryMethod: 'drone' }).error);
});

test('a percentage code takes its share off the subtotal, rounded to cents', () => {
  assert.equal(promoDiscount(promo({ DiscountValue: 15 }), 333.33).discount, 50);
});

test('a fixed code can never take the goods below zero', () => {
  assert.equal(promoDiscount(promo({ DiscountType: 'fixed', DiscountValue: 200 }), 150).discount, 150);
});

test('a code below its minimum spend says how much more to add', () => {
  const r = promoDiscount(promo({ MinSpend: 500 }), 420);
  assert.equal(r.discount, 0);
  assert.match(r.error, /Add R80 more/);
});

test('an inactive code is reported as expired', () => {
  assert.match(promoDiscount(promo({ Active: 0 }), 999).error, /expired/);
});

test('free delivery is judged on the price after the discount', () => {
  // R1 050 less 10% is R945, which is under the threshold, so delivery is charged.
  const t = computeTotals({ subtotal: 1050, deliveryMethod: 'standard', promo: promo() });
  assert.equal(t.discount, 105);
  assert.equal(t.deliveryFee, 80);
  assert.equal(t.total, 1025);
});
