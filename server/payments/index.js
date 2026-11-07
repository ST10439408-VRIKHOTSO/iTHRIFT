'use strict';

/**
 * Payments: which methods checkout offers, and the steps every gateway shares.
 *
 * An order is always placed first, with its payment pending, so the stock is
 * held while the customer pays. A gateway payment then goes like this:
 *  1. start: the server asks the provider for a payment page and records the
 *     attempt (PayFast needs no call, because its page is a signed form);
 *  2. the customer pays on the provider's page, in a browser tab;
 *  3. the provider confirms it to this server (PayFast's ITN, Paystack's and
 *     Yoco's webhooks), or this server asks the provider (Ozow, Paystack).
 *     Only then is the payment marked paid. The customer arriving back on
 *     the site proves nothing on its own.
 * A bank transfer (EFT) is marked paid by staff once the money is in the
 * account. Refunds are not sent to the providers: a cancelled paid order is
 * marked refunded, and staff pay it back from the provider's dashboard.
 */

const crypto = require('node:crypto');
const { orderRef } = require('../utils/refs');
const notifyUtil = require('../utils/notify');
const payfast = require('./payfast');
const ozow = require('./ozow');
const paystack = require('./paystack');
const yoco = require('./yoco');

const GATEWAYS = { payfast, ozow, paystack, yoco };

// In the order checkout lists them.
const METHODS = [
  { id: 'payfast', label: 'PayFast', description: 'Card, instant EFT, SnapScan, Zapper and more, on PayFast\'s secure page' },
  { id: 'ozow', label: 'Ozow', description: 'Instant EFT, approved in your own banking app' },
  { id: 'paystack', label: 'Paystack', description: 'Card payment on Paystack\'s secure page' },
  { id: 'yoco', label: 'Yoco', description: 'Card payment on Yoco\'s secure page' },
  { id: 'eft', label: 'Bank transfer (EFT)', description: 'Pay into our account with your order number. We pack once it clears' },
];

// Names for every method an order can have, including the retired simulated card.
const LABELS = { payfast: 'PayFast', ozow: 'Ozow', paystack: 'Paystack', yoco: 'Yoco', eft: 'EFT', card: 'Card' };

class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isGateway(method) {
  return Object.hasOwn(GATEWAYS, method);
}

/** EFT is always offered; a gateway only once its settings are in place. */
function isAvailable(method) {
  return method === 'eft' || (isGateway(method) && GATEWAYS[method].isConfigured());
}

function availableMethods() {
  return METHODS
    .filter((m) => isAvailable(m.id))
    .map((m) => ({ ...m, testMode: isGateway(m.id) && GATEWAYS[m.id].isTestMode() }));
}

function paymentForOrder(db, orderId) {
  return db.prepare('SELECT * FROM Payment WHERE OrderID = ?').get(orderId);
}

function paymentByToken(db, token) {
  if (!/^[0-9a-f]{32}$/.test(String(token || ''))) return null;
  return db.prepare('SELECT * FROM Payment WHERE PayToken = ?').get(token) || null;
}

/** Whether the customer can pay this order online now. */
function canPay(orderStatus, payment) {
  return Boolean(payment) && payment.Status === 'pending' && isGateway(payment.Method)
    && GATEWAYS[payment.Method].isConfigured() && orderStatus === 'Processing';
}

/** What an order's detail shows about its payment. */
function describe(orderStatus, payment) {
  if (!payment) return null;
  return {
    method: payment.Method,
    label: LABELS[payment.Method] || payment.Method,
    status: payment.Status,
    amount: payment.Amount,
    createdAt: payment.CreatedAt,
    paidAt: payment.PaidAt || null,
    canPay: canPay(orderStatus, payment),
  };
}

function orderWithCustomer(db, orderId) {
  return db.prepare(`
    SELECT o.OrderID, o.CustomerID, o.Status, c.FirstName, c.LastName, c.Email
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID WHERE o.OrderID = ?
  `).get(orderId);
}

function returnUrls(baseUrl, token) {
  const returnUrl = `${baseUrl}/api/payments/return/${token}`;
  return { returnUrl, cancelUrl: `${returnUrl}?outcome=cancelled`, failureUrl: `${returnUrl}?outcome=failed` };
}

/**
 * Marks a payment paid, once. Returns true when this call changed it, so a
 * provider repeating its notification does nothing the second time.
 */
function markPaid(db, payment, via) {
  const result = db.prepare(`UPDATE Payment SET Status = 'paid', PaidAt = datetime('now') WHERE PaymentID = ? AND Status = 'pending'`)
    .run(payment.PaymentID);
  if (Number(result.changes) !== 1) return false;

  const order = db.prepare('SELECT CustomerID, Status FROM Orders WHERE OrderID = ?').get(payment.OrderID);
  const ref = orderRef(payment.OrderID);
  const label = LABELS[payment.Method] || payment.Method;
  console.log(`[payments] ${ref}: paid through ${label} (${via})`);
  if (order.Status === 'Cancelled') {
    // Rare: the customer paid in a tab left open after cancelling.
    console.warn(`[payments] ${ref} was paid after it was cancelled. Refund it from the ${label} dashboard.`);
  }
  notifyUtil.notify(db, order.CustomerID, {
    type: 'order',
    title: 'Payment received',
    body: order.Status === 'Cancelled'
      ? `We received a payment for ${ref} after it was cancelled. We will refund it.`
      : `${ref} is paid. We are picking and packing it.`,
    link: `/orders/${payment.OrderID}`,
  });
  return true;
}

/**
 * Starts (or restarts) paying for an order online. Resolves to { url }, the
 * page to open in the customer's browser. The order stays as it is if the
 * provider cannot be reached, so the customer can try again from the order.
 */
async function startPayment(db, { orderId, customerId, returnTo, baseUrl }) {
  const order = orderWithCustomer(db, orderId);
  if (!order) throw new PaymentError(404, 'Order not found.');
  if (order.CustomerID !== customerId) throw new PaymentError(403, 'You can only pay for your own orders.');
  let payment = paymentForOrder(db, orderId);
  if (!payment || !isGateway(payment.Method)) {
    throw new PaymentError(409, 'This order is paid by bank transfer. Use the order number as the payment reference.');
  }
  // An earlier attempt may have gone through already.
  payment = await refresh(db, payment, { force: true });
  if (payment.Status !== 'pending') throw new PaymentError(409, 'This order has already been paid.');
  if (order.Status !== 'Processing') throw new PaymentError(409, `This order is ${order.Status.toLowerCase()}, so it can no longer be paid.`);
  const gateway = GATEWAYS[payment.Method];
  const label = LABELS[payment.Method];
  if (!gateway.isConfigured()) throw new PaymentError(409, `${label} is not available at the moment. Cancel the order and place it again with another method.`);

  const token = crypto.randomBytes(16).toString('hex');
  const ref = orderRef(orderId);
  let gatewayRef = token;
  let url = `${baseUrl}/api/payments/go/${token}`;
  if (payment.Method !== 'payfast') {
    try {
      ({ ref: gatewayRef, url } = await gateway.createPayment({
        token, amount: payment.Amount, orderId, orderRef: ref, email: order.Email, ...returnUrls(baseUrl, token),
      }));
    } catch (err) {
      console.warn(`[payments] ${ref}: could not start a ${label} payment:`, err.message);
      throw new PaymentError(502, `${label} could not be reached. Your order is saved, so try paying again in a minute.`);
    }
  }
  db.prepare('UPDATE Payment SET PayToken = ?, GatewayRef = ?, ReturnTo = ? WHERE PaymentID = ?')
    .run(token, gatewayRef, returnTo === 'app' ? 'app' : 'web', payment.PaymentID);
  console.log(`[payments] ${ref}: ${label} payment started from the ${returnTo === 'app' ? 'app' : 'website'}`);
  return { url };
}

/** The signed PayFast form for a payment link, built when the link is opened. */
function payfastForm(db, payment, baseUrl) {
  const order = orderWithCustomer(db, payment.OrderID);
  const { returnUrl, cancelUrl } = returnUrls(baseUrl, payment.PayToken);
  return payfast.checkoutForm({
    token: payment.PayToken,
    amount: payment.Amount,
    orderId: payment.OrderID,
    orderRef: orderRef(payment.OrderID),
    customer: { firstName: order.FirstName, lastName: order.LastName, email: order.Email },
    returnUrl,
    cancelUrl,
    notifyUrl: `${baseUrl}/api/payments/payfast/notify`,
  });
}

/**
 * Asks the provider about a pending payment and records it if it was paid.
 * Only Ozow and Paystack can be asked; PayFast and Yoco tell us instead.
 * Checks are spaced at least ten seconds apart unless forced. Resolves to the
 * payment as it now stands.
 */
const lastChecked = new Map();
async function refresh(db, payment, { force = false, ref = null } = {}) {
  const gateway = payment && GATEWAYS[payment.Method];
  const askRef = ref || (payment && payment.GatewayRef);
  if (!gateway || !gateway.checkPayment || payment.Status !== 'pending' || !askRef || !gateway.isConfigured()) return payment;
  if (!force && Date.now() - (lastChecked.get(payment.PaymentID) || 0) < 10_000) return payment;
  lastChecked.set(payment.PaymentID, Date.now());
  try {
    const result = await gateway.checkPayment(askRef, { createdAt: payment.CreatedAt });
    if (result.status === 'paid') {
      if (result.amount != null && Math.abs(result.amount - Number(payment.Amount)) > 0.01) {
        console.warn(`[payments] ${orderRef(payment.OrderID)}: ${LABELS[payment.Method]} reports a different amount; not marked paid.`);
      } else {
        markPaid(db, payment, 'checked with the provider');
      }
    }
  } catch (err) {
    console.warn(`[payments] could not check the ${LABELS[payment.Method]} payment for ${orderRef(payment.OrderID)}:`, err.message);
  }
  return paymentForOrder(db, payment.OrderID);
}

/** PayFast's ITN. Resolves to { ok, reason?, status? }. */
async function handlePayFastItn(db, rawBody, { http } = {}) {
  const itn = payfast.parseItn(rawBody);
  const orderId = Number(itn.data.custom_int1);
  const payment = paymentByToken(db, itn.data.m_payment_id)
    || (Number.isInteger(orderId) && orderId > 0 ? paymentForOrder(db, orderId) : null);
  if (!payment || payment.Method !== 'payfast') return { ok: false, reason: 'no matching payment' };
  const result = await payfast.checkItn(itn, payment, http ? { http } : undefined);
  if (!result.ok) return result;
  if (result.status === 'paid') markPaid(db, payment, 'PayFast ITN');
  return { ok: true, status: result.status };
}

/** Paystack's webhook. The event only prompts a check with Paystack's own record. */
async function handlePaystackWebhook(db, rawBody, signature) {
  if (!paystack.webhookIsGenuine(rawBody, signature)) return { ok: false, reason: 'signature does not match' };
  let event;
  try { event = JSON.parse(rawBody); } catch { return { ok: false, reason: 'not JSON' }; }
  if (event.event !== 'charge.success' || !event.data) return { ok: true, status: 'ignored' };
  const orderId = Number(event.data.metadata && event.data.metadata.orderId);
  const payment = paymentByToken(db, event.data.reference) || (orderId > 0 ? paymentForOrder(db, orderId) : null);
  if (!payment || payment.Method !== 'paystack') return { ok: true, status: 'ignored' };
  await refresh(db, payment, { force: true, ref: event.data.reference });
  return { ok: true };
}

/** Yoco's webhook: the signature and the amount are the proof. */
function handleYocoWebhook(db, rawBody, headers) {
  if (!yoco.webhookIsGenuine(rawBody, headers)) return { ok: false, reason: 'signature does not match' };
  let event;
  try { event = JSON.parse(rawBody); } catch { return { ok: false, reason: 'not JSON' }; }
  const paid = yoco.paymentFromEvent(event);
  if (!paid) return { ok: true, status: 'ignored' };
  const payment = paymentByToken(db, paid.paymentToken)
    || (paid.checkoutId && db.prepare(`SELECT * FROM Payment WHERE GatewayRef = ? AND Method = 'yoco'`).get(paid.checkoutId));
  if (!payment) return { ok: true, status: 'ignored' };
  if (paid.currency !== 'ZAR' || Math.abs(paid.amount - Number(payment.Amount)) > 0.01) {
    return { ok: false, reason: 'amount does not match the order' };
  }
  markPaid(db, payment, 'Yoco webhook');
  return { ok: true };
}

module.exports = {
  METHODS, LABELS, PaymentError,
  isGateway, isAvailable, availableMethods, describe, canPay,
  paymentForOrder, paymentByToken, startPayment, payfastForm, refresh, markPaid,
  handlePayFastItn, handlePaystackWebhook, handleYocoWebhook,
};
