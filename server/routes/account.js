'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');
const points = require('../utils/points');
const catalogue = require('../utils/catalogue');
const { SIZE_RANGES } = require('../utils/sizes');

/**
 * The customer's own account extras: the overview on the Account screen,
 * notification preferences, the style profile from onboarding, Thrift
 * Points, the sustainability estimate, saved searches and stock alerts.
 * Every route works on the signed-in customer only; ids come from the
 * session, never from the request.
 */
const router = express.Router();
router.use(requireRole('customer'));

/**
 * Rough, published-average estimates of what making one new garment of each
 * kind uses. They are shown as estimates, to give a sense of scale; they are
 * not a measurement of any particular piece.
 */
const IMPACT_PER_ITEM = {
  Footwear: { water: 8000, co2: 14 },
  Jeans: { water: 7500, co2: 33 },
  Trousers: { water: 5000, co2: 20 },
  Tees: { water: 2700, co2: 7 },
  Polos: { water: 2700, co2: 7 },
  Shirts: { water: 2700, co2: 8 },
  Knitwear: { water: 5000, co2: 15 },
  Hoodies: { water: 4500, co2: 12 },
  Jackets: { water: 8000, co2: 30 },
  Outerwear: { water: 8000, co2: 30 },
  Dresses: { water: 6000, co2: 20 },
  Accessories: { water: 500, co2: 2 },
};

function impactFor(db, customerId) {
  const rows = db.prepare(`
    SELECT c.Name AS category, SUM(oi.Quantity) AS items
    FROM OrderItem oi
    JOIN Orders o ON o.OrderID = oi.OrderID
    JOIN Product p ON p.ProductID = oi.ProductID
    JOIN Category c ON c.CategoryID = p.CategoryID
    LEFT JOIN ReturnRequest r ON r.OrderItemID = oi.OrderItemID AND r.Status = 'Refunded'
    WHERE o.CustomerID = ? AND o.Status = 'Delivered' AND r.ReturnID IS NULL
    GROUP BY c.Name
  `).all(customerId);
  let water = 0;
  let co2 = 0;
  let items = 0;
  for (const r of rows) {
    const k = IMPACT_PER_ITEM[r.category] || { water: 2000, co2: 6 };
    water += k.water * r.items;
    co2 += k.co2 * r.items;
    items += r.items;
  }
  return { items, waterLitres: water, co2Kg: co2, byCategory: rows, basis: 'Estimated from published averages for making one new garment of each kind.' };
}

function parseList(text) {
  try { const v = JSON.parse(text || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; }
}

router.get('/overview', (req, res) => {
  const db = getDb();
  const c = db.prepare(`SELECT FirstName, LastName, Email, CreatedAt, PreferredSizes, FavouriteBrands, OnboardedAt, NotifyOrders, NotifyAlerts, AuthProvider
    FROM Customer WHERE CustomerID = ?`).get(req.user.id);
  if (!c) return res.status(404).json({ error: 'That account no longer exists.' });
  const count = (sql) => db.prepare(sql).get(req.user.id).n;
  res.json({
    customer: {
      firstName: c.FirstName, lastName: c.LastName, email: c.Email, memberSince: c.CreatedAt,
      authProvider: c.AuthProvider,
    },
    style: { sizes: parseList(c.PreferredSizes), brands: parseList(c.FavouriteBrands), onboarded: Boolean(c.OnboardedAt) },
    preferences: { notifyOrders: c.NotifyOrders === 1, notifyAlerts: c.NotifyAlerts === 1 },
    points: points.summary(db, req.user.id),
    impact: impactFor(db, req.user.id),
    counts: {
      orders: count('SELECT COUNT(*) AS n FROM Orders WHERE CustomerID = ?'),
      activeOrders: count(`SELECT COUNT(*) AS n FROM Orders WHERE CustomerID = ? AND Status IN ('Processing','Shipped')`),
      wishlist: count('SELECT COUNT(*) AS n FROM WishlistItem WHERE CustomerID = ?'),
      unread: count('SELECT COUNT(*) AS n FROM Notification WHERE CustomerID = ? AND IsRead = 0'),
      savedSearches: count('SELECT COUNT(*) AS n FROM SavedSearch WHERE CustomerID = ?'),
      alerts: count('SELECT COUNT(*) AS n FROM StockAlert WHERE CustomerID = ? AND FulfilledAt IS NULL'),
      openTickets: count(`SELECT COUNT(*) AS n FROM SupportTicket WHERE CustomerID = ? AND Status != 'Closed'`),
      sellSubmissions: count('SELECT COUNT(*) AS n FROM SellSubmission WHERE CustomerID = ?'),
      returns: count('SELECT COUNT(*) AS n FROM ReturnRequest WHERE CustomerID = ?'),
    },
  });
});

router.put('/preferences', (req, res) => {
  const db = getDb();
  const { notifyOrders, notifyAlerts } = req.body || {};
  if (typeof notifyOrders !== 'boolean' || typeof notifyAlerts !== 'boolean') {
    return res.status(400).json({ error: 'Send both notification settings as true or false.' });
  }
  db.prepare('UPDATE Customer SET NotifyOrders = ?, NotifyAlerts = ? WHERE CustomerID = ?')
    .run(notifyOrders ? 1 : 0, notifyAlerts ? 1 : 0, req.user.id);
  res.json({ ok: true, preferences: { notifyOrders, notifyAlerts } });
});

// The style profile: usual sizes and favourite brands. Saving it completes onboarding.
router.put('/style', (req, res) => {
  const db = getDb();
  const { sizes = [], brands = [], skip } = req.body || {};
  const allSizes = new Set(Object.values(SIZE_RANGES).flat());
  const brandNames = new Set(db.prepare('SELECT Name FROM Brand').all().map((b) => b.Name));
  const cleanSizes = [...new Set((Array.isArray(sizes) ? sizes : []).map(String))].filter((s) => allSizes.has(s)).slice(0, 12);
  const cleanBrands = [...new Set((Array.isArray(brands) ? brands : []).map(String))].filter((b) => brandNames.has(b)).slice(0, 10);
  if (skip) {
    db.prepare(`UPDATE Customer SET OnboardedAt = COALESCE(OnboardedAt, datetime('now')) WHERE CustomerID = ?`).run(req.user.id);
  } else {
    db.prepare(`UPDATE Customer SET PreferredSizes = ?, FavouriteBrands = ?, OnboardedAt = COALESCE(OnboardedAt, datetime('now')) WHERE CustomerID = ?`)
      .run(JSON.stringify(cleanSizes), JSON.stringify(cleanBrands), req.user.id);
  }
  res.json({ ok: true, style: { sizes: cleanSizes, brands: cleanBrands, onboarded: true } });
});

// Pieces picked for the customer: in stock, in their sizes, favourite brands first.
router.get('/for-you', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT PreferredSizes, FavouriteBrands FROM Customer WHERE CustomerID = ?').get(req.user.id);
  const sizes = parseList(c && c.PreferredSizes);
  const brands = parseList(c && c.FavouriteBrands);
  if (!sizes.length && !brands.length) return res.json({ productIds: [] });
  const sizeClause = sizes.length
    ? `EXISTS (SELECT 1 FROM ProductSize ps WHERE ps.ProductID = p.ProductID AND ps.StockQty > 0 AND ps.Size IN (${sizes.map(() => '?').join(',')}))`
    : '0';
  const brandClause = brands.length ? `b.Name IN (${brands.map(() => '?').join(',')})` : '0';
  const rows = db.prepare(`
    SELECT p.ProductID AS id, (${sizeClause}) AS sizeMatch, (${brandClause}) AS brandMatch
    FROM Product p JOIN Brand b ON b.BrandID = p.BrandID
    WHERE p.StockQty > 0 AND ((${sizeClause}) OR (${brandClause}))
    ORDER BY ((${sizeClause}) + (${brandClause})) DESC, p.CreatedAt DESC, p.ProductID DESC
    LIMIT 12
  `).all(...sizes, ...brands, ...sizes, ...brands, ...sizes, ...brands);
  res.json({ productIds: rows.map((r) => r.id) });
});

router.get('/points', (req, res) => {
  res.json(points.summary(getDb(), req.user.id));
});

router.get('/impact', (req, res) => {
  res.json(impactFor(getDb(), req.user.id));
});

/* ---------- Saved searches ---------- */

function savedList(db, customerId) {
  return db.prepare('SELECT * FROM SavedSearch WHERE CustomerID = ? ORDER BY CreatedAt DESC, SavedSearchID DESC').all(customerId).map((s) => {
    const criteria = catalogue.normalise(JSON.parse(s.Criteria));
    const { clauses, params } = catalogue.whereFor({ ...criteria, inStock: true });
    const n = db.prepare(`SELECT COUNT(*) AS n FROM Product p JOIN Brand b ON b.BrandID = p.BrandID JOIN Category c ON c.CategoryID = p.CategoryID
      ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}`).get(...params).n;
    return { id: s.SavedSearchID, name: s.Name, criteria, summary: catalogue.describe(criteria), matches: n, createdAt: s.CreatedAt };
  });
}

router.get('/saved-searches', (req, res) => {
  res.json({ savedSearches: savedList(getDb(), req.user.id) });
});

router.post('/saved-searches', (req, res) => {
  const db = getDb();
  const { name, criteria } = req.body || {};
  const clean = catalogue.normalise(criteria || {});
  delete clean.inStock;
  if (!Object.keys(clean).length) return res.status(400).json({ error: 'Search or filter for something first, then save it.' });
  const label = String(name || '').trim().slice(0, 40) || catalogue.describe(clean).slice(0, 40);
  const count = db.prepare('SELECT COUNT(*) AS n FROM SavedSearch WHERE CustomerID = ?').get(req.user.id).n;
  if (count >= 20) return res.status(400).json({ error: 'You can keep up to 20 saved searches. Delete one first.' });
  const clash = db.prepare('SELECT 1 FROM SavedSearch WHERE CustomerID = ? AND Name = ?').get(req.user.id, label);
  if (clash) return res.status(409).json({ error: `You already have a saved search called "${label}".` });
  db.prepare('INSERT INTO SavedSearch (CustomerID, Name, Criteria) VALUES (?, ?, ?)').run(req.user.id, label, JSON.stringify(clean));
  res.status(201).json({ savedSearches: savedList(db, req.user.id) });
});

router.delete('/saved-searches/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM SavedSearch WHERE SavedSearchID = ? AND CustomerID = ?').run(req.params.id, req.user.id);
  if (Number(result.changes) === 0) return res.status(404).json({ error: 'Saved search not found.' });
  res.json({ savedSearches: savedList(db, req.user.id) });
});

/* ---------- Back-in-stock alerts ---------- */

router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = db.prepare(`
    SELECT a.StockAlertID AS id, a.ProductID AS productId, a.Size AS size, a.CreatedAt AS createdAt, a.FulfilledAt AS fulfilledAt,
           p.Name AS name, p.ImageFile AS image, p.Price AS price, b.Name AS brand
    FROM StockAlert a JOIN Product p ON p.ProductID = a.ProductID JOIN Brand b ON b.BrandID = p.BrandID
    WHERE a.CustomerID = ? ORDER BY (a.FulfilledAt IS NULL) DESC, a.CreatedAt DESC
  `).all(req.user.id);
  res.json({ alerts });
});

router.delete('/alerts/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM StockAlert WHERE StockAlertID = ? AND CustomerID = ?').run(req.params.id, req.user.id);
  if (Number(result.changes) === 0) return res.status(404).json({ error: 'Alert not found.' });
  res.json({ ok: true });
});

module.exports = router;
module.exports.IMPACT_PER_ITEM = IMPACT_PER_ITEM;
