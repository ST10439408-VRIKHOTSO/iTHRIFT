'use strict';

/**
 * Paying for an order online, and the providers' messages back to us.
 * The rules themselves live in server/payments; these routes only carry
 * requests in and pages out.
 */

const crypto = require('node:crypto');
const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');
const { orderRef } = require('../utils/refs');
const payments = require('../payments');
const { limitsFor } = require('../middleware/rate-limit');

const router = express.Router();

// Express 4 does not catch a rejected promise, so async routes pass errors on themselves.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * The address providers and browsers should use to reach this server: the
 * PUBLIC_BASE_URL setting if there is one, otherwise the address the request
 * came in on (a phone on the same Wi-Fi reaches a laptop this way).
 */
function baseUrlFor(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

/** True for addresses no payment provider on the internet can call back to. */
function isPrivateHost(req) {
  const host = String(req.hostname || '');
  return host === 'localhost' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local');
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAYFAST_HOSTS = 'https://sandbox.payfast.co.za https://www.payfast.co.za';

/**
 * Sends a small stand-alone page for the browser tab between the shop and
 * the provider. Its policy is narrower than the website's: nothing loads
 * from anywhere, the one script runs only with this response's nonce, and
 * a form may only be sent on to PayFast.
 */
function sendPage(res, status, title, inner, script = '') {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.status(status).set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action ${PAYFAST_HOSTS}; base-uri 'none'; frame-ancestors 'none'`,
  }).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | iTHRIFT</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f5f7f6; color: #15201b; }
  main { max-width: 440px; margin: 12vh auto 0; padding: 32px 24px; background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); text-align: center; }
  .mark { width: 44px; height: 44px; margin: 0 auto 16px; border-radius: 12px; background: #1e5a43; color: #fff; font: 700 24px/44px system-ui, sans-serif; }
  h1 { font-size: 1.375rem; margin: 0 0 8px; }
  p { color: #5c6661; line-height: 1.5; margin: 0 0 12px; }
  .btn { display: block; margin-top: 20px; padding: 14px 20px; border: 0; border-radius: 12px; background: #1e5a43; color: #fff; font: 600 1rem system-ui, sans-serif; text-decoration: none; cursor: pointer; width: 100%; box-sizing: border-box; }
</style></head>
<body><main><div class="mark" aria-hidden="true">i</div>${inner}</main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`);
}

// Starts paying for one of the customer's own orders, or tries again.
router.post('/:orderId/start', requireRole('customer'), limitsFor.checkout, wrap(async (req, res) => {
  try {
    const { url } = await payments.startPayment(getDb(), {
      orderId: Number(req.params.orderId),
      customerId: req.user.id,
      returnTo: req.body && req.body.returnTo,
      baseUrl: baseUrlFor(req),
    });
    res.json({ url });
  } catch (err) {
    if (!(err instanceof payments.PaymentError)) throw err;
    res.status(err.status).json({ error: err.message });
  }
}));

// PayFast's page is reached by posting a signed form, which this page does at once.
router.get('/go/:token', (req, res) => {
  const db = getDb();
  const payment = payments.paymentByToken(db, req.params.token);
  if (!payment || payment.Method !== 'payfast') return sendPage(res, 404, 'Link expired', '<h1>This payment link has expired</h1><p>Open your order and choose Pay now again.</p>');
  if (payment.Status !== 'pending') return res.redirect(303, `/api/payments/return/${payment.PayToken}`);
  const { action, fields } = payments.payfastForm(db, payment, baseUrlFor(req));
  sendPage(res, 200, 'Going to PayFast', `
    <h1>Taking you to PayFast</h1>
    <p>You will pay for ${esc(orderRef(payment.OrderID))} on PayFast's secure page.</p>
    <form id="pay" method="post" action="${esc(action)}">
      ${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('\n      ')}
      <button class="btn" type="submit">Continue to PayFast</button>
    </form>`, "document.getElementById('pay').submit();");
});

/**
 * Where the provider sends the customer back. The payment is checked here
 * (for providers that can be asked), never assumed from the return itself.
 * The website goes straight back to the order; the app gets a page with a
 * button, because a browser tab may only open the app after a tap.
 */
router.get('/return/:token', wrap(async (req, res) => {
  const db = getDb();
  let payment = payments.paymentByToken(db, req.params.token);
  if (!payment) return sendPage(res, 404, 'Link expired', '<h1>This payment link has expired</h1><p>Open your order to see whether it is paid.</p>');
  payment = await payments.refresh(db, payment, { force: true });

  const outcome = ['cancelled', 'failed'].includes(req.query.outcome) ? req.query.outcome : null;
  const state = payment.Status === 'paid' ? 'paid' : (outcome || 'pending');
  const ref = orderRef(payment.OrderID);

  if (payment.ReturnTo !== 'app') {
    return res.redirect(303, `/#/orders/${payment.OrderID}?payment=${state}`);
  }

  const label = payments.LABELS[payment.Method];
  const text = {
    paid: ['Payment received', `${ref} is paid. We are picking and packing it.`],
    cancelled: ['Payment cancelled', `Nothing was taken. ${ref} is saved: pay for it from the order in the app, or cancel it there.`],
    failed: ['The payment did not go through', `Nothing was taken. ${ref} is saved: try again from the order in the app.`],
    pending: ['Confirming your payment', `${label} is confirming the payment with us. The order in the app updates as soon as it does.`],
  }[state];
  // PayFast and Yoco confirm by calling this server, which they cannot do on a home or campus network.
  const unreachable = state === 'pending' && ['payfast', 'yoco'].includes(payment.Method) && isPrivateHost(req)
    ? `<p>This server is on a private network, so ${esc(label)} cannot send its confirmation here. Pay on the hosted site to see the order marked paid.</p>` : '';
  const appLink = `ithrift://payment?order=${payment.OrderID}&status=${state}`;
  sendPage(res, 200, text[0], `
    <h1>${esc(text[0])}</h1>
    <p>${esc(text[1])}</p>${unreachable}
    <a class="btn" href="${esc(appLink)}">Back to the iTHRIFT app</a>`, `window.location.href = ${JSON.stringify(appLink)};`);
}));

// PayFast's Instant Transaction Notification. Read raw, because its signature covers the body exactly as sent.
router.post('/payfast/notify', express.raw({ type: () => true, limit: '64kb' }), wrap(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const result = await payments.handlePayFastItn(getDb(), raw);
  if (!result.ok) {
    console.warn('[payfast] ITN ignored:', result.reason);
    return res.status(400).type('text').send('Rejected');
  }
  res.type('text').send('OK');
}));

router.post('/paystack/webhook', wrap(async (req, res) => {
  const result = await payments.handlePaystackWebhook(getDb(), req.rawBody || '', req.get('x-paystack-signature'));
  if (!result.ok) {
    console.warn('[paystack] webhook ignored:', result.reason);
    return res.status(400).json({ error: 'Rejected' });
  }
  res.json({ ok: true });
}));

router.post('/yoco/webhook', (req, res) => {
  const result = payments.handleYocoWebhook(getDb(), req.rawBody || '', {
    'webhook-id': req.get('webhook-id'),
    'webhook-timestamp': req.get('webhook-timestamp'),
    'webhook-signature': req.get('webhook-signature'),
  });
  if (!result.ok) {
    console.warn('[yoco] webhook ignored:', result.reason);
    return res.status(400).json({ error: 'Rejected' });
  }
  res.json({ ok: true });
});

module.exports = router;
module.exports.baseUrlFor = baseUrlFor;
