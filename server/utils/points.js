'use strict';

const { pointsEarnedFor } = require('./pricing');
const { orderRef } = require('./refs');

/**
 * Thrift Points live in a ledger (PointsLedger) rather than a balance column,
 * so every point can be traced to the order or bonus it came from and the
 * balance can never drift from its history.
 */

const TIERS = [
  { name: 'Gold', from: 1500 },
  { name: 'Silver', from: 500 },
  { name: 'Bronze', from: 0 },
];

function balance(db, customerId) {
  return db.prepare('SELECT COALESCE(SUM(Points), 0) AS n FROM PointsLedger WHERE CustomerID = ?').get(customerId).n;
}

/** Points ever earned (spending does not lower a tier). */
function lifetimeEarned(db, customerId) {
  return db.prepare('SELECT COALESCE(SUM(Points), 0) AS n FROM PointsLedger WHERE CustomerID = ? AND Points > 0').get(customerId).n;
}

function tierFor(lifetime) {
  const tier = TIERS.find((t) => lifetime >= t.from);
  const higher = TIERS.filter((t) => t.from > lifetime).sort((a, b) => a.from - b.from)[0] || null;
  return { name: tier.name, next: higher ? { name: higher.name, pointsToGo: higher.from - lifetime } : null };
}

function summary(db, customerId) {
  const lifetime = lifetimeEarned(db, customerId);
  const history = db.prepare(`
    SELECT EntryID AS id, Points AS points, Reason AS reason, OrderID AS orderId, CreatedAt AS createdAt
    FROM PointsLedger WHERE CustomerID = ? ORDER BY CreatedAt DESC, EntryID DESC LIMIT 50
  `).all(customerId);
  return { balance: balance(db, customerId), lifetime, tier: tierFor(lifetime), history };
}

function add(db, customerId, points, reason, orderId = null) {
  if (!points) return;
  db.prepare('INSERT INTO PointsLedger (CustomerID, Points, Reason, OrderID) VALUES (?, ?, ?, ?)')
    .run(customerId, points, reason, orderId);
}

/** Credits the points for a delivered order, once. Returns the points credited. */
function earnForOrder(db, order) {
  const already = db.prepare(`SELECT 1 FROM PointsLedger WHERE OrderID = ? AND Points > 0 AND Reason LIKE 'Earned%'`).get(order.OrderID);
  if (already) return 0;
  const pts = pointsEarnedFor(order.TotalAmount);
  if (pts > 0) add(db, order.CustomerID, pts, `Earned on ${orderRef(order.OrderID)}`, order.OrderID);
  return pts;
}

/** Gives back points spent on an order that was cancelled. */
function refundRedeemed(db, order) {
  if (order.PointsRedeemed > 0) {
    add(db, order.CustomerID, order.PointsRedeemed, `Returned from cancelled ${orderRef(order.OrderID)}`, order.OrderID);
  }
}

module.exports = { balance, lifetimeEarned, tierFor, summary, add, earnForOrder, refundRedeemed, TIERS };
