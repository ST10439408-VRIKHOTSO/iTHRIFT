'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');
const { productRef } = require('../utils/refs');

const router = express.Router();

function toPublicProduct(row) {
  return {
    id: row.ProductID,
    ref: productRef(row.ProductID),
    name: row.Name,
    description: row.Description,
    brand: row.BrandName,
    brandId: row.BrandID,
    category: row.CategoryName,
    categoryId: row.CategoryID,
    size: row.Size,
    condition: row.ConditionGrade,
    price: row.Price,
    stock: row.StockQty,
    inStock: row.StockQty > 0,
    image: row.ImageFile,
    createdAt: row.CreatedAt,
  };
}

const BASE_SELECT = `
  SELECT p.*, b.Name AS BrandName, c.Name AS CategoryName
  FROM Product p
  JOIN Brand b ON b.BrandID = p.BrandID
  JOIN Category c ON c.CategoryID = p.CategoryID
`;

// UC3 / UC4: Browse the catalogue, search and filter by keyword, brand,
// category, size, condition and price.
router.get('/', (req, res) => {
  const db = getDb();
  const { q, brand, category, size, condition, minPrice, maxPrice, inStock, sort } = req.query;

  const clauses = [];
  const params = [];

  if (q) {
    clauses.push('(p.Name LIKE ? OR p.Description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (brand) {
    clauses.push('b.Name = ?');
    params.push(brand);
  }
  if (category) {
    clauses.push('c.Name = ?');
    params.push(category);
  }
  if (size) {
    clauses.push('p.Size = ?');
    params.push(size);
  }
  if (condition) {
    clauses.push('p.ConditionGrade = ?');
    params.push(condition);
  }
  if (minPrice) {
    clauses.push('p.Price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    clauses.push('p.Price <= ?');
    params.push(Number(maxPrice));
  }
  if (inStock === 'true') {
    clauses.push('p.StockQty > 0');
  }

  let sql = BASE_SELECT;
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');

  const sortMap = {
    price_asc: 'p.Price ASC',
    price_desc: 'p.Price DESC',
    newest: 'p.CreatedAt DESC',
  };
  sql += ' ORDER BY ' + (sortMap[sort] || 'p.ProductID ASC');

  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows.map(toPublicProduct) });
});

router.get('/brands', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT BrandID AS id, Name AS name FROM Brand ORDER BY Name').all();
  res.json({ brands: rows });
});

router.get('/categories', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT CategoryID AS id, Name AS name FROM Category ORDER BY Name').all();
  res.json({ categories: rows });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(BASE_SELECT + ' WHERE p.ProductID = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: toPublicProduct(row) });
});

// UC13: Leave reviews / read reviews for a product.
router.get('/:id/reviews', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.ReviewID AS id, r.Rating AS rating, r.Comment AS comment, r.CreatedAt AS createdAt,
           c.FirstName AS firstName, c.LastName AS lastName
    FROM Review r JOIN Customer c ON c.CustomerID = r.CustomerID
    WHERE r.ProductID = ?
    ORDER BY r.CreatedAt DESC
  `).all(req.params.id);
  res.json({ reviews: rows.map(r => ({ ...r, author: `${r.firstName} ${r.lastName[0]}.` })) });
});

router.post('/:id/reviews', requireRole('customer'), (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT ProductID FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const { rating, comment } = req.body || {};
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }

  db.prepare('INSERT INTO Review (ProductID, CustomerID, Rating, Comment) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, ratingNum, (comment || '').trim() || null);

  res.status(201).json({ ok: true });
});

// UC9: Manage listings - staff/admin add, edit and remove products.
router.post('/', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const { name, description, brandId, categoryId, size, condition, price, stock } = req.body || {};

  if (!name || !description || !brandId || !categoryId || !size || !condition || price == null || stock == null) {
    return res.status(400).json({ error: 'All product fields are required.' });
  }
  const validConditions = ['Excellent', 'Very Good', 'Good', 'Fair'];
  if (!validConditions.includes(condition)) {
    return res.status(400).json({ error: 'Condition must be one of: ' + validConditions.join(', ') + '.' });
  }
  if (Number(price) < 0 || Number(stock) < 0) {
    return res.status(400).json({ error: 'Price and stock cannot be negative.' });
  }

  const info = db.prepare(`
    INSERT INTO Product (Name, Description, BrandID, CategoryID, Size, ConditionGrade, Price, StockQty, ImageFile)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(name.trim(), description.trim(), brandId, categoryId, size.trim(), condition, Number(price), Number(stock));

  const id = Number(info.lastInsertRowid);

  // Generate a placeholder image for the new listing.
  const brand = db.prepare('SELECT Name FROM Brand WHERE BrandID = ?').get(brandId);
  const category = db.prepare('SELECT Name FROM Category WHERE CategoryID = ?').get(categoryId);
  const { generateProductImage } = require('../utils/images');
  const imagePath = generateProductImage({ id, name: name.trim(), brand: brand ? brand.Name : 'Brand', condition, category: category ? category.Name : '' });
  db.prepare('UPDATE Product SET ImageFile = ? WHERE ProductID = ?').run(imagePath, id);

  const row = db.prepare(BASE_SELECT + ' WHERE p.ProductID = ?').get(id);
  res.status(201).json({ product: toPublicProduct(row) });
});

router.put('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const { name, description, brandId, categoryId, size, condition, price, stock } = req.body || {};

  db.prepare(`
    UPDATE Product SET
      Name = COALESCE(?, Name),
      Description = COALESCE(?, Description),
      BrandID = COALESCE(?, BrandID),
      CategoryID = COALESCE(?, CategoryID),
      Size = COALESCE(?, Size),
      ConditionGrade = COALESCE(?, ConditionGrade),
      Price = COALESCE(?, Price),
      StockQty = COALESCE(?, StockQty)
    WHERE ProductID = ?
  `).run(
    name ?? null, description ?? null, brandId ?? null, categoryId ?? null,
    size ?? null, condition ?? null, price != null ? Number(price) : null,
    stock != null ? Number(stock) : null, req.params.id
  );

  const row = db.prepare(BASE_SELECT + ' WHERE p.ProductID = ?').get(req.params.id);
  res.json({ product: toPublicProduct(row) });
});

router.delete('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT ProductID FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const inOrders = db.prepare('SELECT COUNT(*) AS n FROM OrderItem WHERE ProductID = ?').get(req.params.id);
  if (inOrders.n > 0) {
    // Preserve order history integrity: stop selling it instead of deleting.
    db.prepare('UPDATE Product SET StockQty = 0 WHERE ProductID = ?').run(req.params.id);
    return res.json({ ok: true, note: 'Product appears in past orders, so it was delisted (stock set to 0) rather than deleted, to keep order history intact.' });
  }

  db.prepare('DELETE FROM CartItem WHERE ProductID = ?').run(req.params.id);
  db.prepare('DELETE FROM Review WHERE ProductID = ?').run(req.params.id);
  db.prepare('DELETE FROM Product WHERE ProductID = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
