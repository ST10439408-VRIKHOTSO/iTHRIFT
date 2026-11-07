'use strict';

/**
 * Yoco: card payments on Yoco's checkout page.
 *
 * The server creates a checkout and sends the customer to the page Yoco
 * returns. Yoco has no call for asking how a checkout went, so the only
 * proof of payment is Yoco's payment.succeeded webhook, signed with the
 * webhook secret. A webhook can only reach a server with a public address,
 * so Yoco payments are confirmed on the hosted server, not on a laptop.
 *
 * Hidden until both YOCO_SECRET_KEY and YOCO_WEBHOOK_SECRET are set.
 * Without the webhook secret a payment could never be confirmed. Run
 * "npm run yoco:webhook -- <public address>" once to register the webhook
 * and print its secret. Test keys are free in the Yoco app.
 *
 * References:
 *  - Yoco. Checkout API: create checkout and register webhook.
 *    https://developer.yoco.com/api-reference/checkout-api
 *  - Yoco. Verifying webhook events.
 *    https://developer.yoco.com/guides/online-payments/webhooks/verifying-the-events
 */

const crypto = require('node:crypto');
const { request } = require('./http');

const API = 'https://payments.yoco.com/api';
const TOLERANCE_SECONDS = 180; // Yoco recommends up to 3 minutes

function secretKey() {
  return (process.env.YOCO_SECRET_KEY || '').trim();
}

function webhookSecret() {
  return (process.env.YOCO_WEBHOOK_SECRET || '').trim();
}

function isConfigured() {
  return Boolean(secretKey() && webhookSecret());
}

function isTestMode() {
  return secretKey().startsWith('sk_test_');
}

/** Creates a checkout. Resolves to { ref, url }: Yoco's checkout id and its payment page. */
async function createPayment({ token, amount, orderId, orderRef, returnUrl, cancelUrl, failureUrl }, { http = request } = {}) {
  const reply = await http(`${API}/checkouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json', 'Idempotency-Key': token },
    body: JSON.stringify({
      amount: Math.round(Number(amount) * 100), // Yoco counts in cents, minimum R2
      currency: 'ZAR',
      successUrl: returnUrl,
      cancelUrl,
      failureUrl,
      externalId: orderRef,
      metadata: { paymentToken: token, orderId: String(orderId), orderRef },
    }),
  });
  if (reply.status >= 300 || !reply.json || !reply.json.redirectUrl) {
    throw new Error(`Yoco did not create the checkout (HTTP ${reply.status}).`);
  }
  return { ref: reply.json.id, url: reply.json.redirectUrl };
}

/**
 * A webhook is genuine when one of the signatures in webhook-signature is the
 * HMAC-SHA256 of "id.timestamp.body", keyed with the decoded secret, and the
 * timestamp is recent (so an old message cannot be replayed).
 */
function webhookIsGenuine(rawBody, headers, { now = Date.now(), secret = webhookSecret() } = {}) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatures = String(headers['webhook-signature'] || '').split(' ').filter(Boolean);
  if (!secret || !rawBody || !id || !timestamp || !signatures.length) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = Buffer.from(crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64'));
  return signatures.some((entry) => {
    const given = Buffer.from(entry.includes(',') ? entry.slice(entry.indexOf(',') + 1) : entry);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

/** Pulls what we need out of a verified event, or null when it is not a successful payment. */
function paymentFromEvent(event) {
  if (!event || event.type !== 'payment.succeeded' || !event.payload) return null;
  const meta = event.payload.metadata || {};
  return {
    paymentToken: meta.paymentToken || null,
    checkoutId: meta.checkoutId || null,
    amount: Number(event.payload.amount) / 100,
    currency: event.payload.currency,
  };
}

/** Registers this server's webhook with Yoco. Used by scripts/yoco-webhook.js, once per server. */
async function registerWebhook(publicBase, { http = request } = {}) {
  const reply = await http(`${API}/webhooks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ithrift-payments', url: `${publicBase.replace(/\/$/, '')}/api/payments/yoco/webhook` }),
  });
  if (reply.status >= 300 || !reply.json || !reply.json.secret) {
    throw new Error(`Yoco did not register the webhook (HTTP ${reply.status}): ${reply.body.slice(0, 200)}`);
  }
  return reply.json;
}

module.exports = { isConfigured, isTestMode, createPayment, webhookIsGenuine, paymentFromEvent, registerWebhook };
