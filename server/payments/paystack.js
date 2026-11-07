'use strict';

/**
 * Paystack: card payments on Paystack's checkout page.
 *
 * The server starts a transaction and sends the customer to the page
 * Paystack returns. Whether it was paid is decided by asking Paystack to
 * verify the transaction, never by the customer arriving back on the site.
 * That works on a laptop as well as the hosted server. Paystack's webhook
 * (charge.success), signed with the secret key, makes the hosted server
 * notice a payment even if the customer closes the tab before coming back.
 *
 * Hidden until PAYSTACK_SECRET_KEY is set. A key starting sk_test_ takes
 * test payments only. Paystack sign-up and test keys are free.
 *
 * References:
 *  - Paystack. Accept Payments. https://paystack.com/docs/payments/accept-payments/
 *  - Paystack. Transaction API. https://paystack.com/docs/api/transaction/
 *  - Paystack. Webhooks. https://paystack.com/docs/payments/webhooks/
 */

const crypto = require('node:crypto');
const { request } = require('./http');

const API = 'https://api.paystack.co';

function secretKey() {
  return (process.env.PAYSTACK_SECRET_KEY || '').trim();
}

function isConfigured() {
  return Boolean(secretKey());
}

function isTestMode() {
  return secretKey().startsWith('sk_test_');
}

/** Starts a transaction. Resolves to { ref, url }; the reference is our payment token. */
async function createPayment({ token, amount, email, orderId, orderRef, returnUrl }, { http = request } = {}) {
  const reply = await http(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amount) * 100), // Paystack counts in cents
      currency: 'ZAR',
      reference: token,
      callback_url: returnUrl,
      metadata: { orderId, orderRef },
    }),
  });
  const data = reply.json && reply.json.data;
  if (reply.status !== 200 || !reply.json.status || !data || !data.authorization_url) {
    throw new Error(`Paystack did not start the payment (HTTP ${reply.status}).`);
  }
  return { ref: token, url: data.authorization_url };
}

/** Resolves to { status: 'paid' | 'failed' | 'pending', amount } from Paystack's own record. */
async function checkPayment(ref, _payment, { http = request } = {}) {
  const reply = await http(`${API}/transaction/verify/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data = reply.json && reply.json.data;
  if (reply.status !== 200 || !data) return { status: 'pending' };
  if (data.status === 'success' && data.currency === 'ZAR') return { status: 'paid', amount: Number(data.amount) / 100 };
  if (data.status === 'failed' || data.status === 'reversed') return { status: 'failed' };
  return { status: 'pending' };
}

/** A webhook is genuine when its x-paystack-signature is the HMAC-SHA512 of the raw body. */
function webhookIsGenuine(rawBody, signatureHeader) {
  if (!isConfigured() || !rawBody || !signatureHeader) return false;
  const expected = crypto.createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isConfigured, isTestMode, createPayment, checkPayment, webhookIsGenuine };
