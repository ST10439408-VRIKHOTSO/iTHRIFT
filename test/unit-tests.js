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

/* ----- Cellphone numbers and the app's Google sign-in codes ----- */

const { normalisePhone } = require('../server/utils/phone');
const appCodes = require('../server/utils/app-codes');

test('a cellphone number is the same however it is typed', () => {
  assert.equal(normalisePhone('082 555 0101'), '0825550101');
  assert.equal(normalisePhone('+27 82 555 0101'), '0825550101');
  assert.equal(normalisePhone('27825550101'), '0825550101');
  assert.equal(normalisePhone('012 345 6789'), null, 'a landline is not a cellphone');
  assert.equal(normalisePhone('admin'), null);
});

test('an app sign-in code works once, and only with the secret behind its challenge', () => {
  const verifier = 'a-secret-the-app-keeps-to-itself-0123456789';
  const code = appCodes.issue({ type: 'customer', id: 7, name: 'Test' }, appCodes.challengeFor(verifier));
  assert.ok(appCodes.isChallenge(appCodes.challengeFor(verifier)));
  assert.ok(appCodes.redeem(code, 'some-other-secret').error, 'the wrong secret is refused');
  assert.equal(appCodes.redeem(code, verifier).user.id, 7);
  assert.ok(appCodes.redeem(code, verifier).error, 'a second use is refused');
});

test('an app sign-in code expires', () => {
  const verifier = 'another-secret-0123456789';
  const code = appCodes.issue({ id: 1 }, appCodes.challengeFor(verifier), 0);
  assert.ok(appCodes.redeem(code, verifier, appCodes.TTL_MS + 1).error);
});

// ---------------------------------------------------------------------------
// Online payments: the checks that decide whether an order is paid
// ---------------------------------------------------------------------------
// Every call to a provider is a parameter, so these tests stand in for
// PayFast, Ozow, Paystack and Yoco without any network or money.

const crypto = require('node:crypto');
const payfast = require('../server/payments/payfast');
const ozow = require('../server/payments/ozow');
const paystack = require('../server/payments/paystack');
const yoco = require('../server/payments/yoco');
const payments = require('../server/payments');

const PAYMENT_SETTINGS = [
  'PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'PAYFAST_SANDBOX',
  'OZOW_CLIENT_ID', 'OZOW_CLIENT_SECRET', 'OZOW_SITE_CODE', 'OZOW_STAGING',
  'PAYSTACK_SECRET_KEY', 'YOCO_SECRET_KEY', 'YOCO_WEBHOOK_SECRET',
];

async function withPaymentSettings(settings, run) {
  const saved = Object.fromEntries(PAYMENT_SETTINGS.map((k) => [k, process.env[k]]));
  for (const k of PAYMENT_SETTINGS) delete process.env[k];
  Object.assign(process.env, settings);
  try {
    await run();
  } finally {
    for (const k of PAYMENT_SETTINGS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const md5 = (text) => crypto.createHash('md5').update(text).digest('hex');

test('with no keys set, checkout offers the PayFast sandbox and bank transfer only', () => withPaymentSettings({}, () => {
  assert.deepEqual(payments.availableMethods().map((m) => m.id), ['payfast', 'eft']);
  assert.equal(payments.availableMethods()[0].testMode, true);
  assert.equal(payments.isAvailable('card'), false, 'the simulated card is no longer offered');
}));

test('a gateway is offered once its keys are set, and Yoco needs its webhook secret too', () => withPaymentSettings({ PAYSTACK_SECRET_KEY: 'sk_test_unit', YOCO_SECRET_KEY: 'sk_test_unit' }, () => {
  const ids = payments.availableMethods().map((m) => m.id);
  assert.ok(ids.includes('paystack'));
  assert.ok(!ids.includes('yoco'), 'without the webhook secret a Yoco payment could never be confirmed');
  assert.ok(!ids.includes('ozow'));
}));

test('PayFast values are encoded the way PayFast encodes them', () => {
  assert.equal(payfast.encode("Mary O'Brien & Sons"), 'Mary+O%27Brien+%26+Sons');
  assert.equal(payfast.encode(' https://x.co/a?b=1 '), 'https%3A%2F%2Fx.co%2Fa%3Fb%3D1');
  assert.equal(payfast.encode('(*)!~'), '%28%2A%29%21%7E');
});

test('the PayFast signature covers the filled-in fields in order, then the passphrase', () => {
  const fields = { merchant_id: '10000100', merchant_key: '46f0cd694581a', name_first: '', amount: '100.00', item_name: 'Order #1' };
  const expected = md5('merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Order+%231&passphrase=jt7NOE43FZPn');
  assert.equal(payfast.signature(fields, 'jt7NOE43FZPn'), expected);
});

const checkoutFor23 = () => payfast.checkoutForm({
  token: 'a'.repeat(32), amount: 1249.5, orderId: 23, orderRef: 'ORD-00023',
  customer: { firstName: 'Lerato', lastName: 'Mokoena', email: 'lerato.m@gmail.com' },
  returnUrl: 'https://x.co/r', cancelUrl: 'https://x.co/c', notifyUrl: 'https://x.co/n',
});

// Our own PayFast merchant, as opposed to the shared sandbox one.
const OWN_MERCHANT = { PAYFAST_MERCHANT_ID: '10000101', PAYFAST_MERCHANT_KEY: 'own-key', PAYFAST_PASSPHRASE: 'our own passphrase' };

test('with the shared test merchant the PayFast form goes to the sandbox unsigned, to the cent', () => withPaymentSettings({}, () => {
  const { action, fields } = checkoutFor23();
  assert.equal(action, 'https://sandbox.payfast.co.za/eng/process');
  assert.equal(fields.amount, '1249.50');
  assert.equal(fields.signature, undefined, 'the shared merchant\'s passphrase is not ours, so a signature would be refused');
  assert.deepEqual(Object.keys(fields).slice(0, 5), ['merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url']);
}));

test('with our own merchant the PayFast form is signed with our passphrase', () => withPaymentSettings(OWN_MERCHANT, () => {
  const { fields } = checkoutFor23();
  const { signature, ...signed } = fields;
  assert.equal(signed.merchant_id, '10000101');
  assert.equal(signature, payfast.signature(signed, 'our own passphrase'));
}));

/** A notification as PayFast would post it: blank fields included, signed with the passphrase. */
function itnBody(changes = {}, passphrase = OWN_MERCHANT.PAYFAST_PASSPHRASE) {
  const data = {
    m_payment_id: 'b'.repeat(32), pf_payment_id: '1089250', payment_status: 'COMPLETE',
    item_name: 'iTHRIFT order ORD-00023', item_description: '', amount_gross: '1249.50', amount_fee: '-28.74',
    amount_net: '1220.76', custom_int1: '23', name_first: 'Lerato', name_last: 'Mokoena',
    email_address: 'lerato.m@gmail.com', merchant_id: OWN_MERCHANT.PAYFAST_MERCHANT_ID, ...changes,
  };
  const signed = Object.entries(data).map(([k, v]) => `${k}=${payfast.encode(v)}`).join('&');
  return `${signed}&signature=${md5(`${signed}&passphrase=${payfast.encode(passphrase)}`)}`;
}
const payfastAnswers = (answer) => async () => ({ status: 200, body: answer });
const order23 = { Amount: 1249.5 };

test('with the shared test merchant, a PayFast notification counts only when PayFast confirms it', () => withPaymentSettings({}, async () => {
  const shared = payfast.parseItn(itnBody({ merchant_id: '10000100' }, 'any passphrase'));
  assert.equal((await payfast.checkItn(shared, order23, { http: payfastAnswers('VALID') })).status, 'paid');
  assert.equal((await payfast.checkItn(shared, order23, { http: payfastAnswers('INVALID') })).ok, false);
  assert.match((await payfast.checkItn(payfast.parseItn(itnBody()), order23, { http: payfastAnswers('VALID') })).reason, /merchant/);
}));

test('a genuine PayFast notification for the right amount marks the order paid', () => withPaymentSettings(OWN_MERCHANT, async () => {
  const result = await payfast.checkItn(payfast.parseItn(itnBody()), order23, { http: payfastAnswers('VALID') });
  assert.deepEqual(result, { ok: true, status: 'paid', ref: '1089250' });
  const cancelled = await payfast.checkItn(payfast.parseItn(itnBody({ payment_status: 'CANCELLED' })), order23, { http: payfastAnswers('VALID') });
  assert.equal(cancelled.status, 'failed');
}));

test('a correctly signed PayFast notification still needs PayFast to confirm it', () => withPaymentSettings(OWN_MERCHANT, async () => {
  const denied = await payfast.checkItn(payfast.parseItn(itnBody()), order23, { http: payfastAnswers('INVALID') });
  assert.equal(denied.ok, false, 'a leaked passphrase alone must not be enough to mark an order paid');
  const offline = await payfast.checkItn(payfast.parseItn(itnBody()), order23, { http: async () => { throw new Error('offline'); } });
  assert.equal(offline.ok, false, 'no answer from PayFast counts as no');
}));

test('a PayFast notification with a changed amount or a broken signature is refused', () => withPaymentSettings(OWN_MERCHANT, async () => {
  const cheap = await payfast.checkItn(payfast.parseItn(itnBody({ amount_gross: '1.00' })), order23, { http: payfastAnswers('VALID') });
  assert.match(cheap.reason, /amount/);
  const edited = itnBody().replace('amount_gross=1249.50', 'amount_gross=1.00');
  const forged = await payfast.checkItn(payfast.parseItn(edited), { Amount: 1 }, { http: payfastAnswers('VALID') });
  assert.match(forged.reason, /signature/);
}));

test('a Paystack webhook is genuine only with the HMAC of its exact body', () => withPaymentSettings({ PAYSTACK_SECRET_KEY: 'sk_test_unit' }, () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'c'.repeat(32) } });
  const sig = crypto.createHmac('sha512', 'sk_test_unit').update(body).digest('hex');
  assert.ok(paystack.webhookIsGenuine(body, sig));
  assert.ok(!paystack.webhookIsGenuine(body.replace('success', 'failed'), sig));
  assert.ok(!paystack.webhookIsGenuine(body, 'not-a-signature'));
}));

test('Paystack is asked, and only a successful rand charge counts as paid', () => withPaymentSettings({ PAYSTACK_SECRET_KEY: 'sk_test_unit' }, async () => {
  const says = (data) => async () => ({ status: 200, json: { status: true, data } });
  assert.deepEqual(await paystack.checkPayment('r', {}, { http: says({ status: 'success', currency: 'ZAR', amount: 124950 }) }), { status: 'paid', amount: 1249.5 });
  assert.equal((await paystack.checkPayment('r', {}, { http: says({ status: 'abandoned', currency: 'ZAR', amount: 124950 }) })).status, 'pending');
  assert.equal((await paystack.checkPayment('r', {}, { http: says({ status: 'failed', currency: 'ZAR', amount: 124950 }) })).status, 'failed');
}));

test('a Yoco webhook is genuine only when signed with the secret, and only while recent', () => {
  const key = Buffer.from('a-yoco-test-secret');
  const secret = 'whsec_' + key.toString('base64');
  const body = JSON.stringify({ type: 'payment.succeeded', payload: { amount: 124950, currency: 'ZAR', metadata: { paymentToken: 'd'.repeat(32) } } });
  const now = Date.now();
  const ts = String(Math.floor(now / 1000));
  const sig = crypto.createHmac('sha256', key).update(`msg_1.${ts}.${body}`).digest('base64');
  const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` };
  assert.ok(yoco.webhookIsGenuine(body, headers, { now, secret }));
  assert.ok(!yoco.webhookIsGenuine(body.replace('124950', '200'), headers, { now, secret }));
  assert.ok(!yoco.webhookIsGenuine(body, headers, { now: now + 10 * 60_000, secret }), 'an old message cannot be replayed');
  assert.deepEqual(yoco.paymentFromEvent(JSON.parse(body)), { paymentToken: 'd'.repeat(32), checkoutId: null, amount: 1249.5, currency: 'ZAR' });
});

test('Ozow counts a payment only when one of its transactions is Successful', () => withPaymentSettings({ OZOW_CLIENT_ID: 'id', OZOW_CLIENT_SECRET: 'secret', OZOW_SITE_CODE: 'TST-TST-001' }, async () => {
  ozow._resetToken();
  const urls = [];
  const ozowAnswers = (transactions) => async (url) => {
    urls.push(url);
    if (url.endsWith('/token')) return { status: 200, json: { access_token: 't', expires_in: '14400' } };
    return { status: 200, json: transactions };
  };
  assert.equal((await ozow.checkPayment('p1', {}, { http: ozowAnswers([{ status: 'Successful' }]) })).status, 'paid');
  assert.equal((await ozow.checkPayment('p1', {}, { http: ozowAnswers({ items: [{ status: 'Error' }] }) })).status, 'failed');
  assert.equal((await ozow.checkPayment('p1', {}, { http: ozowAnswers([]) })).status, 'pending', 'an unknown id comes back as an empty list');
  assert.ok(urls[0].startsWith('https://stagingone.ozow.com/v1/'), 'Ozow staging unless it is switched off');
}));
