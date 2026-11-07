'use strict';

/**
 * Ozow: instant EFT straight from the customer's own bank, through Ozow's
 * Hosted Checkout on its One API.
 *
 * The server asks Ozow for a payment request and sends the customer to the
 * page Ozow returns. When the customer comes back, the server asks Ozow for
 * the payment's transactions and only counts the order as paid when one of
 * them is Successful. That check is a call this server makes, not one it
 * receives, so it works on a laptop as well as on the hosted server.
 *
 * Ozow only issues credentials to registered merchants, so the method stays
 * hidden until OZOW_CLIENT_ID, OZOW_CLIENT_SECRET and OZOW_SITE_CODE are set
 * (One API > Clients in the Ozow portal, with the "payments" scope). Ozow's
 * staging host is used unless OZOW_STAGING=false.
 *
 * References:
 *  - Ozow Hub. Hosted Checkout (One API).
 *    https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/
 *  - Ozow Hub. Transaction and settlement statuses.
 *    https://hub.ozow.com/integration-methods/statuses/
 */

const { request } = require('./http');

function config() {
  const staging = (process.env.OZOW_STAGING || 'true').trim().toLowerCase() !== 'false';
  return {
    staging,
    clientId: (process.env.OZOW_CLIENT_ID || '').trim(),
    clientSecret: (process.env.OZOW_CLIENT_SECRET || '').trim(),
    siteCode: (process.env.OZOW_SITE_CODE || '').trim(),
    base: staging ? 'https://stagingone.ozow.com/v1' : 'https://one.ozow.com/v1',
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.clientId && c.clientSecret && c.siteCode);
}

function isTestMode() {
  return config().staging;
}

// Tokens last hours, so one is reused until shortly before it expires.
let cachedToken = null;

async function accessToken({ http = request } = {}) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const c = config();
  const reply = await http(`${c.base}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: 'payments', grant_type: 'client_credentials' }).toString(),
  });
  if (reply.status !== 200 || !reply.json || !reply.json.access_token) {
    throw new Error(`Ozow refused the sign-in (HTTP ${reply.status}). Check the Ozow client id and secret.`);
  }
  cachedToken = { value: reply.json.access_token, expiresAt: Date.now() + Number(reply.json.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

/** Creates a payment request. Resolves to { ref, url }: Ozow's id and the page to send the customer to. */
async function createPayment({ token, amount, orderId, orderRef, returnUrl }, { http = request } = {}) {
  const c = config();
  const bearer = await accessToken({ http });
  const reply = await http(`${c.base}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteCode: c.siteCode,
      amount: { currency: 'ZAR', value: Number(Number(amount).toFixed(2)) },
      merchantReference: `${orderRef}-${token.slice(0, 6)}`,
      // Shown on the customer's bank statement; Ozow allows letters and numbers only.
      beneficiaryReference: `ITHRIFT${orderId}`,
      expireAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      returnUrl,
    }),
  });
  if (reply.status >= 300 || !reply.json || !reply.json.redirectUrl) {
    throw new Error(`Ozow did not create the payment (HTTP ${reply.status}).`);
  }
  return { ref: reply.json.id, url: reply.json.redirectUrl };
}

/**
 * Asks Ozow how a payment request went. Resolves to { status } with 'paid',
 * 'failed' or 'pending'. Ozow answers an unknown id with an empty list,
 * which stays pending.
 */
async function checkPayment(ref, { createdAt } = {}, { http = request } = {}) {
  const c = config();
  const bearer = await accessToken({ http });
  const from = new Date((createdAt ? Date.parse(String(createdAt).replace(' ', 'T') + 'Z') : Date.now()) - 86_400_000).toISOString();
  const to = new Date(Date.now() + 86_400_000).toISOString();
  const reply = await http(`${c.base}/payments/${encodeURIComponent(ref)}/transactions?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (reply.status !== 200 || !reply.json) return { status: 'pending' };
  const body = reply.json;
  const list = Array.isArray(body) ? body : (body.items || body.data || body.transactions || body.results || []);
  const statuses = list.map((t) => String(t.status || t.Status || '').toLowerCase());
  if (statuses.includes('successful')) return { status: 'paid' };
  if (statuses.length && statuses.every((s) => s === 'error')) return { status: 'failed' };
  return { status: 'pending' };
}

module.exports = { isConfigured, isTestMode, config, accessToken, createPayment, checkPayment, _resetToken: () => { cachedToken = null; } };
