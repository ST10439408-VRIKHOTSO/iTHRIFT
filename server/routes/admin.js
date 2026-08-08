'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// UC11: Manage users - the administrator suspends or reactivates customer
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

// UC12: View reports - sales dashboard, revenue by brand and by category.
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

// UC12: Inventory snapshot - flags low stock and out of stock items.
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

module.exports = router;
