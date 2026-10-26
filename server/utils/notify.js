'use strict';

const catalogue = require('./catalogue');

/**
 * In-app notifications. Every event that a customer would want to hear about
 * goes through notify(), which honours the customer's two preference
 * switches: updates about their own orders and requests, and shopping alerts
 * (price drops, restocks, saved-search matches).
 */

const ALERT_TYPES = new Set(['price_drop', 'back_in_stock', 'saved_search']);

function notify(db, customerId, { type, title, body, link = null }) {
  const prefs = db.prepare('SELECT NotifyOrders, NotifyAlerts FROM Customer WHERE CustomerID = ?').get(customerId);
  if (!prefs) return false;
  const wanted = ALERT_TYPES.has(type) ? prefs.NotifyAlerts : prefs.NotifyOrders;
  if (!wanted) return false;
  db.prepare('INSERT INTO Notification (CustomerID, Type, Title, Body, Link) VALUES (?, ?, ?, ?, ?)')
    .run(customerId, type, title, body, link);
  return true;
}

function rand(n) {
  return 'R' + Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 }).replace(/ /g, ',');
}

/** A piece got cheaper: tell everyone who saved it at a higher price. */
function priceDropped(db, productId, newPrice) {
  const product = db.prepare('SELECT Name FROM Product WHERE ProductID = ?').get(productId);
  if (!product) return 0;
  const savers = db.prepare('SELECT CustomerID, PriceWhenSaved FROM WishlistItem WHERE ProductID = ? AND PriceWhenSaved > ?')
    .all(productId, newPrice);
  let sent = 0;
  for (const s of savers) {
    if (notify(db, s.CustomerID, {
      type: 'price_drop',
      title: 'Price drop on a saved piece',
      body: `${product.Name} dropped from ${rand(s.PriceWhenSaved)} to ${rand(newPrice)}.`,
      link: `/product/${productId}`,
    })) sent++;
  }
  return sent;
}

/**
 * Stock may have come back (a cancelled order, a refunded return, a staff
 * edit). Any open alert for the piece, or for a size that now has stock, is
 * sent and closed.
 */
function stockChanged(db, productId) {
  const product = db.prepare('SELECT Name, StockQty FROM Product WHERE ProductID = ?').get(productId);
  if (!product || product.StockQty < 1) return 0;
  const alerts = db.prepare('SELECT * FROM StockAlert WHERE ProductID = ? AND FulfilledAt IS NULL').all(productId);
  const sizeStock = new Map(db.prepare('SELECT Size, StockQty FROM ProductSize WHERE ProductID = ?').all(productId)
    .map((r) => [r.Size, r.StockQty]));
  let sent = 0;
  for (const a of alerts) {
    if (a.Size && !(sizeStock.get(a.Size) > 0)) continue;
    notify(db, a.CustomerID, {
      type: 'back_in_stock',
      title: 'Back in stock',
      body: a.Size ? `${product.Name} is back in size ${a.Size}. Pieces are one of a kind, so do not wait long.` : `${product.Name} is back in stock.`,
      link: `/product/${productId}`,
    });
    db.prepare(`UPDATE StockAlert SET FulfilledAt = datetime('now') WHERE StockAlertID = ?`).run(a.StockAlertID);
    sent++;
  }
  return sent;
}

/** A new piece was listed: tell every customer whose saved search it matches. */
function newListing(db, productId) {
  const product = db.prepare('SELECT Name FROM Product WHERE ProductID = ?').get(productId);
  if (!product) return 0;
  const searches = db.prepare('SELECT * FROM SavedSearch').all();
  let sent = 0;
  for (const s of searches) {
    let criteria;
    try { criteria = catalogue.normalise(JSON.parse(s.Criteria)); } catch (_) { continue; }
    const { clauses, params } = catalogue.whereFor(criteria);
    const sql = `SELECT 1 FROM Product p JOIN Brand b ON b.BrandID = p.BrandID JOIN Category c ON c.CategoryID = p.CategoryID
      WHERE p.ProductID = ?${clauses.length ? ' AND ' + clauses.join(' AND ') : ''}`;
    if (db.prepare(sql).get(productId, ...params)) {
      if (notify(db, s.CustomerID, {
        type: 'saved_search',
        title: `New in: ${s.Name}`,
        body: `${product.Name} matches your saved search.`,
        link: `/product/${productId}`,
      })) sent++;
    }
  }
  return sent;
}

module.exports = { notify, priceDropped, stockChanged, newListing, ALERT_TYPES };
