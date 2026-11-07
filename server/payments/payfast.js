'use strict';

/**
 * PayFast: card, instant EFT, SnapScan, Zapper and more, on PayFast's page.
 *
 * The customer's browser is sent to PayFast with a form. PayFast then
 * reports the outcome to this server in an Instant Transaction Notification
 * (ITN), a form POST to notify_url. Nothing the browser brings back is
 * trusted: an order counts as paid only when an ITN is for our merchant,
 * carries the order's exact amount, and PayFast's own server confirms it
 * sent it. An ITN comes from PayFast's servers, so it can only reach a
 * server with a public address (the hosted one), not a laptop on a home or
 * campus network.
 *
 * With no settings the sandbox is used with PayFast's shared test merchant,
 * so no real money can move. That merchant is shared by every developer and
 * its passphrase is not ours to know (the one in PayFast's SDK examples is
 * refused), so its forms go unsigned and its ITNs rest on the checks above.
 * With our own merchant (a free sandbox account, or a live one) forms are
 * signed and every ITN's signature is checked as well. Set
 * PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE, and
 * PAYFAST_SANDBOX=false for live payments.
 *
 * References:
 *  - PayFast. Developer documentation: custom integration, signature and ITN.
 *    https://developers.payfast.co.za/docs
 *  - PayFast. payfast-php-sdk, for the sandbox test merchant.
 *    https://github.com/Payfast/payfast-php-sdk
 */

const crypto = require('node:crypto');
const { request } = require('./http');

// PayFast's shared sandbox merchant, as published in its own SDK. Test values
// that anyone can use, not secrets.
const SANDBOX_MERCHANT = { merchantId: '10000100', merchantKey: '46f0cd694581a' };

function config() {
  const sandbox = (process.env.PAYFAST_SANDBOX || 'true').trim().toLowerCase() !== 'false';
  const own = Boolean(process.env.PAYFAST_MERCHANT_ID);
  return {
    sandbox,
    merchantId: own ? process.env.PAYFAST_MERCHANT_ID.trim() : SANDBOX_MERCHANT.merchantId,
    merchantKey: own ? (process.env.PAYFAST_MERCHANT_KEY || '').trim() : SANDBOX_MERCHANT.merchantKey,
    // Only our own merchant's forms are signed; see the note at the top.
    signs: own,
    passphrase: own ? (process.env.PAYFAST_PASSPHRASE || '').trim() : '',
    host: sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za',
  };
}

/** Live payments need a real merchant; the sandbox always works. */
function isConfigured() {
  const c = config();
  return c.sandbox || Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);
}

function isTestMode() {
  return config().sandbox;
}

/**
 * URL-encodes a value the way PayFast's servers do (PHP's urlencode):
 * spaces become +, and !'()*~ are encoded too, which encodeURIComponent
 * leaves alone. A customer called O'Brien would otherwise fail the signature.
 */
function encode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

/** The fields in the order PayFast lists them, skipping blanks, as key=value pairs. */
function paramString(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join('&');
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function signature(fields, passphrase) {
  const base = paramString(fields);
  return md5(passphrase ? `${base}&passphrase=${encode(passphrase)}` : base);
}

/**
 * The form the customer's browser posts to PayFast. Field order matters for
 * the signature, so the object is built in PayFast's documented order:
 * merchant, customer, transaction.
 */
function checkoutForm({ token, amount, orderId, orderRef, customer, returnUrl, cancelUrl, notifyUrl }) {
  const c = config();
  const fields = {
    merchant_id: c.merchantId,
    merchant_key: c.merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: customer.firstName,
    name_last: customer.lastName,
    email_address: customer.email,
    m_payment_id: token,
    amount: Number(amount).toFixed(2),
    item_name: `iTHRIFT order ${orderRef}`,
    // The order, in case the customer pays in an older tab after starting again.
    custom_int1: orderId,
  };
  const signed = c.signs ? { ...fields, signature: signature(fields, c.passphrase) } : fields;
  return { action: `https://${c.host}/eng/process`, fields: signed };
}

/**
 * Splits an ITN body into its fields. The signature is checked against the
 * body exactly as PayFast sent it (every field except the signature, blanks
 * included, in the order received), so no value is decoded and re-encoded
 * on the way.
 */
function parseItn(rawBody) {
  const pairs = String(rawBody || '').split('&').filter(Boolean).map((part) => {
    const at = part.indexOf('=');
    return at < 0 ? [part, ''] : [part.slice(0, at), part.slice(at + 1)];
  });
  const decode = (v) => decodeURIComponent(v.replace(/\+/g, ' '));
  const data = Object.fromEntries(pairs.map(([k, v]) => [decode(k), decode(v)]));
  const signed = pairs.filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${v}`).join('&');
  return { data, signed, signature: data.signature || '' };
}

function signatureMatches(signed, received, passphrase = config().passphrase) {
  const expected = md5(passphrase ? `${signed}&passphrase=${encode(passphrase)}` : signed);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(received).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Asks PayFast whether it really sent this ITN. Anything but VALID, or no answer, is a no. */
async function confirmedByPayFast(signed, { http = request } = {}) {
  try {
    const reply = await http(`https://${config().host}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: signed,
    });
    return reply.status === 200 && reply.body.trim() === 'VALID';
  } catch (err) {
    console.warn('[payfast] could not reach PayFast to confirm an ITN:', err.code || err.message);
    return false;
  }
}

/**
 * Checks an ITN against the payment it names. Resolves to
 * { ok: true, status } where status is 'paid', 'failed' or 'pending', or
 * { ok: false, reason } when the ITN must be ignored.
 */
async function checkItn(itn, payment, { http = request } = {}) {
  const { data, signed, signature: received } = itn;
  const c = config();
  if (c.signs && !signatureMatches(signed, received, c.passphrase)) return { ok: false, reason: 'signature does not match' };
  if (data.merchant_id !== c.merchantId) return { ok: false, reason: 'not for this merchant' };
  if (Math.abs(Number(data.amount_gross) - Number(payment.Amount)) > 0.01) return { ok: false, reason: 'amount does not match the order' };
  if (!(await confirmedByPayFast(signed, { http }))) return { ok: false, reason: 'PayFast did not confirm it' };
  const status = { COMPLETE: 'paid', FAILED: 'failed', CANCELLED: 'failed' }[String(data.payment_status).toUpperCase()] || 'pending';
  return { ok: true, status, ref: data.pf_payment_id || null };
}

module.exports = {
  isConfigured, isTestMode, config, encode, paramString, signature, checkoutForm,
  parseItn, signatureMatches, confirmedByPayFast, checkItn, SANDBOX_MERCHANT,
};
