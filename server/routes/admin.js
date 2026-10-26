'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// UC11: Manage users. The administrator suspends or reactivates customer
// accounts. Reserved for the administrator role only (role-based access).
router.get('/users', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT CustomerID AS id, FirstName AS firstName, LastName AS lastName, Email AS email,
           City AS city, Status AS status, CreatedAt AS createdAt
    FROM Customer ORDER BY CreatedAt DESC
  `).all();
  res.json({ users: rows });
});

router.put('/users/:id/status', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'active' or 'suspended'." });
  }
  const existing = db.prepare('SELECT CustomerID FROM Customer WHERE CustomerID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found.' });

  db.prepare('UPDATE Customer SET Status = ? WHERE CustomerID = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// UC12: View reports. Sales dashboard, revenue by brand and by category.
router.get('/reports/sales', requireRole('admin', 'staff'), (_req, res) => {
  const db = getDb();

  const totals = db.prepare(`
    SELECT COUNT(*) AS orderCount, COALESCE(SUM(TotalAmount), 0) AS revenue
    FROM Orders WHERE Status != 'Cancelled'
  `).get();

  const byBrand = db.prepare(`
    SELECT b.Name AS brand, COALESCE(SUM(oi.Quantity * oi.UnitPrice), 0) AS revenue, COALESCE(SUM(oi.Quantity), 0) AS unitsSold
    FROM OrderItem oi
    JOIN Product p ON p.ProductID = oi.ProductID
    JOIN Brand b ON b.BrandID = p.BrandID
    JOIN Orders o ON o.OrderID = oi.OrderID AND o.Status != 'Cancelled'
    GROUP BY b.Name ORDER BY revenue DESC
  `).all();

  const byCategory = db.prepare(`
    SELECT c.Name AS category, COALESCE(SUM(oi.Quantity * oi.UnitPrice), 0) AS revenue, COALESCE(SUM(oi.Quantity), 0) AS unitsSold
    FROM OrderItem oi
    JOIN Product p ON p.ProductID = oi.ProductID
    JOIN Category c ON c.CategoryID = p.CategoryID
    JOIN Orders o ON o.OrderID = oi.OrderID AND o.Status != 'Cancelled'
    GROUP BY c.Name ORDER BY revenue DESC
  `).all();

  const byStatus = db.prepare(`
    SELECT Status AS status, COUNT(*) AS count FROM Orders GROUP BY Status
  `).all();

  res.json({ totals, byBrand, byCategory, byStatus });
});

// UC12: Inventory snapshot. Flags low stock and out of stock items.
router.get('/reports/inventory', requireRole('admin', 'staff'), (_req, res) => {
  const db = getDb();
  const LOW_STOCK_THRESHOLD = 3;

  const rows = db.prepare(`
    SELECT p.ProductID AS id, p.Name AS name, p.StockQty AS stock, b.Name AS brand, c.Name AS category
    FROM Product p JOIN Brand b ON b.BrandID = p.BrandID JOIN Category c ON c.CategoryID = p.CategoryID
    ORDER BY p.StockQty ASC
  `).all();

  const outOfStock = rows.filter(r => r.stock === 0);
  const lowStock = rows.filter(r => r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD);

  res.json({ threshold: LOW_STOCK_THRESHOLD, outOfStock, lowStock, all: rows });
});

/* ---------------------------------------------------------------------------
   Release 1.3.0: analytics, CSV export, promo codes, questions, collections
   --------------------------------------------------------------------------- */

const { orderRef } = require('../utils/refs');
const notifyUtil = require('../utils/notify');

// Sales analytics for the dashboard: the last 30 days by day, average order
// value, return rate, best brands and categories, and what needs attention.
router.get('/reports/analytics', requireRole('admin', 'staff'), (_req, res) => {
  const db = getDb();
  const days = db.prepare(`
    WITH RECURSIVE d(day) AS (SELECT date('now', '-29 days') UNION ALL SELECT date(day, '+1 day') FROM d WHERE day < date('now'))
    SELECT d.day AS day,
           COALESCE((SELECT SUM(TotalAmount) FROM Orders o WHERE date(o.CreatedAt) = d.day AND o.Status != 'Cancelled'), 0) AS revenue,
           (SELECT COUNT(*) FROM Orders o WHERE date(o.CreatedAt) = d.day AND o.Status != 'Cancelled') AS orders
    FROM d ORDER BY d.day
  `).all();
  const last30 = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(TotalAmount), 0) AS revenue FROM Orders WHERE Status != 'Cancelled' AND CreatedAt >= datetime('now', '-30 days')`).get();
  const prev30 = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(TotalAmount), 0) AS revenue FROM Orders WHERE Status != 'Cancelled' AND CreatedAt >= datetime('now', '-60 days') AND CreatedAt < datetime('now', '-30 days')`).get();
  const all = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(TotalAmount), 0) AS revenue FROM Orders WHERE Status != 'Cancelled'`).get();
  const itemsSold = db.prepare(`SELECT COALESCE(SUM(oi.Quantity), 0) AS n FROM OrderItem oi JOIN Orders o ON o.OrderID = oi.OrderID WHERE o.Status != 'Cancelled'`).get().n;
  const returned = db.prepare(`SELECT COUNT(*) AS n FROM ReturnRequest WHERE Status IN ('Approved','Refunded')`).get().n;
  const topBrands = db.prepare(`
    SELECT b.Name AS name, SUM(oi.Quantity * oi.UnitPrice) AS revenue, SUM(oi.Quantity) AS units
    FROM OrderItem oi JOIN Orders o ON o.OrderID = oi.OrderID AND o.Status != 'Cancelled'
    JOIN Product p ON p.ProductID = oi.ProductID JOIN Brand b ON b.BrandID = p.BrandID
    GROUP BY b.Name ORDER BY revenue DESC LIMIT 6
  `).all();
  const categories = db.prepare(`
    SELECT c.Name AS name, SUM(oi.Quantity * oi.UnitPrice) AS revenue, SUM(oi.Quantity) AS units
    FROM OrderItem oi JOIN Orders o ON o.OrderID = oi.OrderID AND o.Status != 'Cancelled'
    JOIN Product p ON p.ProductID = oi.ProductID JOIN Category c ON c.CategoryID = p.CategoryID
    GROUP BY c.Name ORDER BY revenue DESC
  `).all();
  const payments = db.prepare(`SELECT Method AS method, COUNT(*) AS count FROM Payment GROUP BY Method ORDER BY count DESC`).all();
  const delivery = db.prepare(`SELECT DeliveryMethod AS method, COUNT(*) AS count FROM Orders WHERE Status != 'Cancelled' GROUP BY DeliveryMethod ORDER BY count DESC`).all();
  const attention = {
    processing: db.prepare(`SELECT COUNT(*) AS n FROM Orders WHERE Status = 'Processing'`).get().n,
    returnsWaiting: db.prepare(`SELECT COUNT(*) AS n FROM ReturnRequest WHERE Status = 'Requested'`).get().n,
    questionsWaiting: db.prepare('SELECT COUNT(*) AS n FROM ProductQuestion WHERE Answer IS NULL').get().n,
    ticketsOpen: db.prepare(`SELECT COUNT(*) AS n FROM SupportTicket WHERE Status = 'Open'`).get().n,
    sellWaiting: db.prepare(`SELECT COUNT(*) AS n FROM SellSubmission WHERE Status IN ('Submitted','Accepted','Received')`).get().n,
    outOfStock: db.prepare('SELECT COUNT(*) AS n FROM Product WHERE StockQty = 0').get().n,
    lastOne: db.prepare('SELECT COUNT(*) AS n FROM Product WHERE StockQty = 1').get().n,
    collectionsToday: db.prepare(`SELECT COUNT(*) AS n FROM Orders WHERE CollectionDate = date('now', '+2 hours') AND Status = 'Processing'`).get().n,
  };
  res.json({
    days,
    last30, prev30, all,
    averageOrderValue: all.orders ? Math.round((all.revenue / all.orders) * 100) / 100 : 0,
    itemsSold,
    returnRate: itemsSold ? Math.round((returned / itemsSold) * 1000) / 10 : 0,
    customers: db.prepare('SELECT COUNT(*) AS n FROM Customer').get().n,
    newCustomers30: db.prepare(`SELECT COUNT(*) AS n FROM Customer WHERE CreatedAt >= datetime('now', '-30 days')`).get().n,
    topBrands, categories, payments, delivery, attention,
  });
});

/** RFC 4180 CSV cell. A leading =, +, - or @ is defused so a spreadsheet cannot run it as a formula. */
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Orders as a CSV file for the bookkeeper.
router.get('/reports/orders.csv', requireRole('admin', 'staff'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.OrderID, o.CreatedAt, o.Status, c.FirstName || ' ' || c.LastName AS Customer, c.Email,
           (SELECT SUM(Quantity) FROM OrderItem oi WHERE oi.OrderID = o.OrderID) AS Items,
           o.Subtotal, o.DiscountAmount, o.PointsDiscount, o.DeliveryFee, o.TotalAmount,
           o.DeliveryMethod, o.PromoCode, p.Method AS PaymentMethod, p.Status AS PaymentStatus, o.CourierRef
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID LEFT JOIN Payment p ON p.OrderID = o.OrderID
    ORDER BY o.OrderID
  `).all();
  const header = ['Order', 'Placed', 'Status', 'Customer', 'Email', 'Items', 'Subtotal', 'Promo discount', 'Points discount',
    'Delivery fee', 'Total', 'Delivery', 'Promo code', 'Payment method', 'Payment status', 'Courier ref'];
  const lines = [header.join(',')].concat(rows.map((r) => [
    orderRef(r.OrderID), r.CreatedAt, r.Status, r.Customer, r.Email, r.Items, r.Subtotal, r.DiscountAmount, r.PointsDiscount,
    r.DeliveryFee, r.TotalAmount, r.DeliveryMethod, r.PromoCode, r.PaymentMethod, r.PaymentStatus, r.CourierRef,
  ].map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ithrift-orders.csv"');
  res.send('﻿' + lines.join('\r\n') + '\r\n');
});

/* ---------- Promo codes ---------- */

function promoList(db) {
  return db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM Orders o WHERE o.PromoCode = p.Code COLLATE NOCASE AND o.Status != 'Cancelled') AS UsedCount,
           (SELECT COALESCE(SUM(o.DiscountAmount), 0) FROM Orders o WHERE o.PromoCode = p.Code COLLATE NOCASE AND o.Status != 'Cancelled') AS GivenAway
    FROM PromoCode p ORDER BY p.Active DESC, p.Code
  `).all().map((p) => ({
    id: p.PromoCodeID, code: p.Code, description: p.Description, discountType: p.DiscountType, discountValue: p.DiscountValue,
    minSpend: p.MinSpend, active: p.Active === 1, expiresAt: p.ExpiresAt, usageLimit: p.UsageLimit, usedCount: p.UsedCount, givenAway: p.GivenAway,
  }));
}

function cleanPromo(b) {
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return { error: 'A code is 3 to 20 letters and numbers, with no spaces.' };
  const type = b.discountType;
  if (!['percent', 'fixed'].includes(type)) return { error: 'Choose a percentage or a fixed rand discount.' };
  const value = Number(b.discountValue);
  if (!Number.isFinite(value) || value <= 0) return { error: 'The discount must be more than zero.' };
  if (type === 'percent' && value > 90) return { error: 'A percentage discount cannot be more than 90.' };
  const minSpend = b.minSpend === '' || b.minSpend == null ? 0 : Number(b.minSpend);
  if (!Number.isFinite(minSpend) || minSpend < 0) return { error: 'Minimum spend cannot be negative.' };
  const expiresAt = b.expiresAt ? String(b.expiresAt) : null;
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return { error: 'Use a date for the end date.' };
  const usageLimit = b.usageLimit === '' || b.usageLimit == null ? null : Number(b.usageLimit);
  if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) return { error: 'The usage limit must be a whole number of 1 or more.' };
  const description = String(b.description || '').trim()
    || (type === 'percent' ? `${value}% off` : `R${value} off`) + (minSpend ? ` orders of R${minSpend} or more` : ' your order');
  return { value: { code, type, value, minSpend, expiresAt, usageLimit, description: description.slice(0, 80), active: b.active === false ? 0 : 1 } };
}

router.get('/promos', requireRole('admin', 'staff'), (_req, res) => {
  res.json({ promos: promoList(getDb()) });
});

router.post('/promos', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { value, error } = cleanPromo(req.body || {});
  if (error) return res.status(400).json({ error });
  if (db.prepare('SELECT 1 FROM PromoCode WHERE Code = ? COLLATE NOCASE').get(value.code)) {
    return res.status(409).json({ error: `${value.code} already exists.` });
  }
  db.prepare(`INSERT INTO PromoCode (Code, Description, DiscountType, DiscountValue, MinSpend, Active, ExpiresAt, UsageLimit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(value.code, value.description, value.type, value.value, value.minSpend, value.active, value.expiresAt, value.usageLimit);
  res.status(201).json({ promos: promoList(db) });
});

router.put('/promos/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM PromoCode WHERE PromoCodeID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Promo code not found.' });
  const body = req.body || {};
  // Switching a code on or off on its own.
  if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
    db.prepare('UPDATE PromoCode SET Active = ? WHERE PromoCodeID = ?').run(body.active ? 1 : 0, existing.PromoCodeID);
    return res.json({ promos: promoList(db) });
  }
  const { value, error } = cleanPromo({ ...body, code: existing.Code });
  if (error) return res.status(400).json({ error });
  db.prepare(`UPDATE PromoCode SET Description = ?, DiscountType = ?, DiscountValue = ?, MinSpend = ?, Active = ?, ExpiresAt = ?, UsageLimit = ? WHERE PromoCodeID = ?`)
    .run(value.description, value.type, value.value, value.minSpend, value.active, value.expiresAt, value.usageLimit, existing.PromoCodeID);
  res.json({ promos: promoList(db) });
});

/* ---------- Product questions ---------- */

function questionList(db, status) {
  const where = status === 'open' ? 'WHERE q.Answer IS NULL' : status === 'answered' ? 'WHERE q.Answer IS NOT NULL' : '';
  return db.prepare(`
    SELECT q.QuestionID AS id, q.Question AS question, q.Answer AS answer, q.CreatedAt AS createdAt, q.AnsweredAt AS answeredAt,
           p.ProductID AS productId, p.Name AS productName, p.ImageFile AS image,
           c.FirstName || ' ' || c.LastName AS customer, a.FullName AS answeredBy
    FROM ProductQuestion q JOIN Product p ON p.ProductID = q.ProductID JOIN Customer c ON c.CustomerID = q.CustomerID
    LEFT JOIN Admin a ON a.AdminID = q.AnsweredBy
    ${where} ORDER BY (q.Answer IS NULL) DESC, q.CreatedAt DESC
  `).all();
}

router.get('/questions', requireRole('admin', 'staff'), (req, res) => {
  res.json({ questions: questionList(getDb(), req.query.status) });
});

router.put('/questions/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const q = db.prepare('SELECT * FROM ProductQuestion WHERE QuestionID = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Question not found.' });
  const answer = String((req.body || {}).answer || '').trim();
  if (answer.length < 2) return res.status(400).json({ error: 'Write an answer first.' });
  db.prepare(`UPDATE ProductQuestion SET Answer = ?, AnsweredBy = ?, AnsweredAt = datetime('now') WHERE QuestionID = ?`)
    .run(answer.slice(0, 600), req.user.id, q.QuestionID);
  const name = db.prepare('SELECT Name FROM Product WHERE ProductID = ?').get(q.ProductID).Name;
  notifyUtil.notify(db, q.CustomerID, {
    type: 'question', title: 'Your question was answered', body: `${name}: ${answer.slice(0, 100)}`, link: `/product/${q.ProductID}`,
  });
  res.json({ questions: questionList(db, req.query.status) });
});

/* ---------- Store collections ---------- */

router.get('/collections', requireRole('admin', 'staff'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.OrderID, o.Status, o.CollectionDate, o.CollectionSlot, o.TotalAmount, c.FirstName || ' ' || c.LastName AS customer, c.Phone,
           (SELECT SUM(Quantity) FROM OrderItem oi WHERE oi.OrderID = o.OrderID) AS items
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
    WHERE o.DeliveryMethod = 'collection' AND o.Status = 'Processing'
    ORDER BY o.CollectionDate IS NULL, o.CollectionDate, o.CollectionSlot
  `).all();
  res.json({
    collections: rows.map((r) => ({
      id: r.OrderID, ref: orderRef(r.OrderID), status: r.Status, date: r.CollectionDate, slot: r.CollectionSlot,
      total: r.TotalAmount, customer: r.customer, phone: r.Phone, items: r.items,
    })),
  });
});

module.exports = router;
