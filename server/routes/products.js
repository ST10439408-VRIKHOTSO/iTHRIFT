'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');
const { productRef } = require('../utils/refs');
const catalogue = require('../utils/catalogue');
const notifyUtil = require('../utils/notify');

const router = express.Router();

/** Sizes per product, in range order, for a list of product ids. */
function loadSizes(db, productIds) {
  const map = new Map(productIds.map((id) => [id, []]));
  if (productIds.length === 0) return map;
  const rows = db.prepare(`
    SELECT ProductID, Size, StockQty FROM ProductSize
    WHERE ProductID IN (${productIds.map(() => '?').join(',')})
    ORDER BY ProductSizeID
  `).all(...productIds);
  for (const r of rows) map.get(r.ProductID).push({ size: r.Size, stock: r.StockQty });
  return map;
}

function toPublicProduct(row, sizes = []) {
  const available = sizes.filter((s) => s.stock > 0);
  return {
    id: row.ProductID,
    ref: productRef(row.ProductID),
    name: row.Name,
    description: row.Description,
    brand: row.BrandName,
    brandId: row.BrandID,
    category: row.CategoryName,
    categoryId: row.CategoryID,
    // A readable summary of what can be bought ("UK 8, UK 9"); the listing's
    // original size when nothing is left.
    size: available.length ? available.map((s) => s.size).join(', ') : row.Size,
    sizes: available,
    // Every size row, including sold-out ones (for back-in-stock alerts and the staff editor).
    allSizes: sizes,
    condition: row.ConditionGrade,
    price: row.Price,
    originalPrice: row.OriginalPrice || null,
    onSale: row.OriginalPrice != null && row.OriginalPrice > row.Price,
    percentOff: row.OriginalPrice > row.Price ? Math.round((1 - row.Price / row.OriginalPrice) * 100) : 0,
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

function loadProduct(db, id) {
  const row = db.prepare(BASE_SELECT + ' WHERE p.ProductID = ?').get(id);
  return row ? toPublicProduct(row, loadSizes(db, [row.ProductID]).get(row.ProductID)) : null;
}

const SORTS = {
  price_asc: 'p.Price ASC',
  price_desc: 'p.Price DESC',
  newest: 'p.CreatedAt DESC, p.ProductID DESC',
  discount: 'CASE WHEN p.OriginalPrice > p.Price THEN (p.OriginalPrice - p.Price) * 1.0 / p.OriginalPrice ELSE 0 END DESC, p.ProductID ASC',
};

// UC3 / UC4: Browse the catalogue, search and filter by keyword, brand,
// category, size, condition and price. Brand, category, condition and size
// accept several values separated by commas.
router.get('/', (req, res) => {
  const db = getDb();
  const criteria = catalogue.normalise(req.query);
  const { clauses, params } = catalogue.whereFor(criteria);

  let sql = BASE_SELECT;
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY ' + (SORTS[req.query.sort] || 'p.ProductID ASC');

  const rows = db.prepare(sql).all(...params);
  const sizes = loadSizes(db, rows.map((r) => r.ProductID));
  const priceRange = db.prepare('SELECT MIN(Price) AS min, MAX(Price) AS max FROM Product').get();
  res.json({
    products: rows.map((r) => toPublicProduct(r, sizes.get(r.ProductID))),
    criteria,
    summary: catalogue.describe(criteria),
    priceRange,
  });
});

router.get('/brands', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT BrandID AS id, Name AS name FROM Brand ORDER BY Name').all();
  res.json({ brands: rows });
});

router.get('/categories', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.CategoryID AS id, c.Name AS name,
           (SELECT COUNT(*) FROM Product p WHERE p.CategoryID = c.CategoryID AND p.StockQty > 0) AS inStock
    FROM Category c ORDER BY c.Name
  `).all();
  res.json({ categories: rows });
});

// Every size that has stock somewhere, in a sensible order, for the size filter.
router.get('/sizes', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT Size FROM ProductSize WHERE StockQty > 0').all().map((r) => r.Size);
  const rank = (s) => {
    const letters = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    if (letters.includes(s)) return 100 + letters.indexOf(s);
    if (/^UK \d+/.test(s)) return 200 + parseInt(s.slice(3), 10);
    if (/^\d+$/.test(s)) return 300 + Number(s);
    return 900;
  };
  res.json({ sizes: rows.sort((a, b) => rank(a) - rank(b)) });
});

// Instant search: a few products, brands and categories matching what has been typed.
router.get('/suggest', (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json({ products: [], brands: [], categories: [] });
  const like = `%${q}%`;
  const products = db.prepare(BASE_SELECT + `
    WHERE p.Name LIKE ? OR b.Name LIKE ?
    ORDER BY (p.StockQty > 0) DESC, CASE WHEN p.Name LIKE ? THEN 0 ELSE 1 END, p.Name
    LIMIT 6
  `).all(like, like, `${q}%`).map((r) => {
    const p = toPublicProduct(r, []);
    return { id: p.id, name: p.name, brand: p.brand, price: p.price, image: p.image, inStock: p.inStock };
  });
  const brands = db.prepare('SELECT Name AS name FROM Brand WHERE Name LIKE ? ORDER BY Name LIMIT 4').all(like).map((r) => r.name);
  const categories = db.prepare('SELECT Name AS name FROM Category WHERE Name LIKE ? ORDER BY Name LIMIT 4').all(like).map((r) => r.name);
  res.json({ products, brands, categories });
});

// Several products by id, in the order asked for (recently viewed, compare).
router.get('/by-ids', (req, res) => {
  const db = getDb();
  const ids = catalogue.toList(req.query.ids).map(Number).filter(Number.isInteger).slice(0, 24);
  if (!ids.length) return res.json({ products: [] });
  const rows = db.prepare(BASE_SELECT + ` WHERE p.ProductID IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const sizes = loadSizes(db, rows.map((r) => r.ProductID));
  const byId = new Map(rows.map((r) => [r.ProductID, toPublicProduct(r, sizes.get(r.ProductID))]));
  res.json({ products: ids.map((id) => byId.get(id)).filter(Boolean) });
});

// Staff only: change the price of several listings at once (start or end a sale).
router.post('/bulk-price', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const { productIds, percentOff, endSale } = req.body || {};
  const ids = (Array.isArray(productIds) ? productIds : []).map(Number).filter(Number.isInteger);
  if (!ids.length) return res.status(400).json({ error: 'Choose at least one listing.' });
  const pct = Number(percentOff);
  if (!endSale && (!Number.isFinite(pct) || pct < 5 || pct > 80)) {
    return res.status(400).json({ error: 'A markdown must be between 5 and 80 percent.' });
  }
  let changed = 0;
  let alerted = 0;
  db.exec('BEGIN');
  try {
    for (const id of ids) {
      const p = db.prepare('SELECT ProductID, Price, OriginalPrice FROM Product WHERE ProductID = ?').get(id);
      if (!p) continue;
      if (endSale) {
        if (p.OriginalPrice == null) continue;
        db.prepare('UPDATE Product SET Price = OriginalPrice, OriginalPrice = NULL WHERE ProductID = ?').run(id);
      } else {
        // A markdown is always taken from the full price, so repeating it does not compound.
        const full = p.OriginalPrice != null && p.OriginalPrice > p.Price ? p.OriginalPrice : p.Price;
        const newPrice = Math.max(1, Math.round(full * (1 - pct / 100)));
        if (newPrice >= full) continue;
        db.prepare('UPDATE Product SET Price = ?, OriginalPrice = ? WHERE ProductID = ?').run(newPrice, full, id);
        if (newPrice < p.Price) alerted += notifyUtil.priceDropped(db, id, newPrice);
      }
      changed++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true, changed, alerted });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const product = loadProduct(db, req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product });
});

// Similar pieces: same category first, then same brand, close in price, in stock first.
router.get('/:id/similar', (req, res) => {
  const db = getDb();
  const base = db.prepare('SELECT * FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!base) return res.status(404).json({ error: 'Product not found.' });
  const rows = db.prepare(BASE_SELECT + `
    WHERE p.ProductID != ? AND (p.CategoryID = ? OR p.BrandID = ?)
    ORDER BY (p.StockQty > 0) DESC,
             (p.CategoryID = ?) DESC,
             (p.BrandID = ?) DESC,
             ABS(p.Price - ?) ASC
    LIMIT 8
  `).all(base.ProductID, base.CategoryID, base.BrandID, base.CategoryID, base.BrandID, base.Price);
  const sizes = loadSizes(db, rows.map((r) => r.ProductID));
  res.json({ products: rows.map((r) => toPublicProduct(r, sizes.get(r.ProductID))) });
});

// UC13: Leave reviews / read reviews for a product. A review from someone who
// bought the piece and had it delivered is marked as a verified purchase.
router.get('/:id/reviews', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.ReviewID AS id, r.Rating AS rating, r.Comment AS comment, r.CreatedAt AS createdAt,
           c.FirstName AS firstName, c.LastName AS lastName,
           EXISTS (SELECT 1 FROM OrderItem oi JOIN Orders o ON o.OrderID = oi.OrderID
                   WHERE oi.ProductID = r.ProductID AND o.CustomerID = r.CustomerID AND o.Status = 'Delivered') AS verified
    FROM Review r JOIN Customer c ON c.CustomerID = r.CustomerID
    WHERE r.ProductID = ?
    ORDER BY r.CreatedAt DESC, r.ReviewID DESC
  `).all(req.params.id);
  const histogram = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of rows) histogram[r.rating]++;
  const average = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null;
  res.json({
    reviews: rows.map((r) => ({ ...r, verified: r.verified === 1, author: `${r.firstName} ${r.lastName[0]}.` })),
    summary: { count: rows.length, average, histogram },
  });
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
    .run(req.params.id, req.user.id, ratingNum, (String(comment || '').trim().slice(0, 600)) || null);

  res.status(201).json({ ok: true });
});

// Product questions: answered ones are public; the asker also sees their own pending ones.
router.get('/:id/questions', (req, res) => {
  const db = getDb();
  const mine = req.user && req.user.type === 'customer' ? req.user.id : -1;
  const rows = db.prepare(`
    SELECT q.QuestionID AS id, q.Question AS question, q.Answer AS answer, q.CreatedAt AS createdAt,
           q.AnsweredAt AS answeredAt, c.FirstName AS askedBy, (q.CustomerID = ?) AS mine
    FROM ProductQuestion q JOIN Customer c ON c.CustomerID = q.CustomerID
    WHERE q.ProductID = ? AND (q.Answer IS NOT NULL OR q.CustomerID = ?)
    ORDER BY q.CreatedAt DESC
  `).all(mine, req.params.id, mine);
  res.json({ questions: rows.map((q) => ({ ...q, mine: q.mine === 1 })) });
});

router.post('/:id/questions', requireRole('customer'), (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT ProductID FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const question = String((req.body || {}).question || '').trim();
  if (question.length < 8) return res.status(400).json({ error: 'Write your question in a little more detail.' });
  if (question.length > 300) return res.status(400).json({ error: 'Keep your question to 300 characters or fewer.' });
  const open = db.prepare('SELECT COUNT(*) AS n FROM ProductQuestion WHERE CustomerID = ? AND Answer IS NULL').get(req.user.id).n;
  if (open >= 5) return res.status(429).json({ error: 'You have five unanswered questions already. We will answer those first.' });
  db.prepare('INSERT INTO ProductQuestion (ProductID, CustomerID, Question) VALUES (?, ?, ?)').run(product.ProductID, req.user.id, question);
  res.status(201).json({ ok: true });
});

// Back-in-stock alert for a sold-out piece or a sold-out size.
router.post('/:id/alerts', requireRole('customer'), (req, res) => {
  const db = getDb();
  const product = loadProduct(db, req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const size = (req.body || {}).size ? String(req.body.size).trim() : null;
  if (size) {
    const row = product.allSizes.find((s) => s.size === size);
    const validSizes = require('../utils/sizes').sizesForCategory(product.category);
    if (!validSizes.includes(size)) return res.status(400).json({ error: 'That size is not sold in this category.' });
    if (row && row.stock > 0) return res.status(409).json({ error: `Size ${size} is in stock now, so you can buy it straight away.` });
  } else if (product.inStock) {
    return res.status(409).json({ error: 'This piece is in stock now.' });
  }
  const existing = db.prepare('SELECT StockAlertID FROM StockAlert WHERE CustomerID = ? AND ProductID = ? AND Size IS ? AND FulfilledAt IS NULL')
    .get(req.user.id, product.id, size);
  if (!existing) db.prepare('INSERT INTO StockAlert (CustomerID, ProductID, Size) VALUES (?, ?, ?)').run(req.user.id, product.id, size);
  res.status(201).json({ ok: true, message: size ? `We will let you know if size ${size} comes back.` : 'We will let you know if it comes back.' });
});

/** Validates a staff size table: [{size, stock}], unique sizes, whole non-negative stock. */
function cleanSizes(sizes) {
  if (!Array.isArray(sizes)) return { error: 'Sizes must be a list.' };
  const seen = new Set();
  const out = [];
  for (const s of sizes) {
    const size = String((s && s.size) || '').trim();
    const stock = Number(s && s.stock);
    if (!size) return { error: 'Every size needs a name, for example M or UK 8.' };
    if (seen.has(size)) return { error: `Size ${size} is listed twice.` };
    if (!Number.isInteger(stock) || stock < 0) return { error: `Stock for size ${size} must be a whole number of 0 or more.` };
    seen.add(size);
    out.push({ size, stock });
  }
  if (!out.length) return { error: 'Add at least one size.' };
  return { value: out };
}

function validSale(price, originalPrice) {
  if (originalPrice == null || originalPrice === '') return { value: null };
  const o = Number(originalPrice);
  if (!Number.isFinite(o) || o <= Number(price)) return { error: 'The pre-sale price must be higher than the selling price.' };
  return { value: o };
}

// UC9: Manage listings. Staff and admin add, edit and remove products.
router.post('/', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const { name, description, brandId, categoryId, size, condition, price, stock, sizes, originalPrice } = req.body || {};

  // Either one size and a stock figure (the original form), or a size table.
  let sizeRows;
  if (sizes != null) {
    const cleaned = cleanSizes(sizes);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    sizeRows = cleaned.value;
  } else if (size && stock != null) {
    sizeRows = [{ size: String(size).trim(), stock: Number(stock) }];
  }

  if (!name || !description || !brandId || !categoryId || !sizeRows || !condition || price == null) {
    return res.status(400).json({ error: 'All product fields are required.' });
  }
  const validConditions = ['Excellent', 'Very Good', 'Good', 'Fair'];
  if (!validConditions.includes(condition)) {
    return res.status(400).json({ error: 'Condition must be one of: ' + validConditions.join(', ') + '.' });
  }
  if (Number(price) < 0 || sizeRows.some((s) => s.stock < 0)) {
    return res.status(400).json({ error: 'Price and stock cannot be negative.' });
  }
  const sale = validSale(price, originalPrice);
  if (sale.error) return res.status(400).json({ error: sale.error });

  const total = sizeRows.reduce((n, s) => n + s.stock, 0);
  const info = db.prepare(`
    INSERT INTO Product (Name, Description, BrandID, CategoryID, Size, ConditionGrade, Price, OriginalPrice, StockQty, ImageFile)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(name.trim(), description.trim(), brandId, categoryId, sizeRows[0].size, condition, Number(price), sale.value, total);

  const id = Number(info.lastInsertRowid);
  const insertSize = db.prepare('INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)');
  for (const s of sizeRows) insertSize.run(id, s.size, s.stock);

  // Generate a placeholder image for the new listing.
  const brand = db.prepare('SELECT Name FROM Brand WHERE BrandID = ?').get(brandId);
  const category = db.prepare('SELECT Name FROM Category WHERE CategoryID = ?').get(categoryId);
  const { generateProductImage } = require('../utils/images');
  const imagePath = generateProductImage({ id, name: name.trim(), brand: brand ? brand.Name : 'Brand', condition, category: category ? category.Name : '' });
  db.prepare('UPDATE Product SET ImageFile = ? WHERE ProductID = ?').run(imagePath, id);

  const matched = total > 0 ? notifyUtil.newListing(db, id) : 0;
  res.status(201).json({ product: loadProduct(db, id), savedSearchAlerts: matched });
});

router.put('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const { name, description, brandId, categoryId, size, condition, price, stock, sizes } = req.body || {};
  const hasOriginal = Object.prototype.hasOwnProperty.call(req.body || {}, 'originalPrice');

  if (price != null && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ error: 'Price cannot be negative.' });
  }
  const newPrice = price != null ? Number(price) : existing.Price;
  let newOriginal = existing.OriginalPrice;
  if (hasOriginal) {
    const sale = validSale(newPrice, req.body.originalPrice);
    if (sale.error) return res.status(400).json({ error: sale.error });
    newOriginal = sale.value;
  } else if (newOriginal != null && newOriginal <= newPrice) {
    // Raising the price above the old pre-sale price ends the sale.
    newOriginal = null;
  }

  db.exec('BEGIN');
  try {
    if (sizes != null) {
      // The full size table from the staff editor replaces the old one.
      const cleaned = cleanSizes(sizes);
      if (cleaned.error) { db.exec('ROLLBACK'); return res.status(400).json({ error: cleaned.error }); }
      const keep = new Set(cleaned.value.map((s) => s.size));
      for (const row of db.prepare('SELECT Size FROM ProductSize WHERE ProductID = ?').all(existing.ProductID)) {
        if (!keep.has(row.Size)) db.prepare('DELETE FROM ProductSize WHERE ProductID = ? AND Size = ?').run(existing.ProductID, row.Size);
      }
      const upsert = db.prepare(`
        INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)
        ON CONFLICT (ProductID, Size) DO UPDATE SET StockQty = excluded.StockQty
      `);
      for (const s of cleaned.value) upsert.run(existing.ProductID, s.size, s.stock);
      const total = cleaned.value.reduce((n, s) => n + s.stock, 0);
      db.prepare('UPDATE Product SET StockQty = ? WHERE ProductID = ?').run(total, existing.ProductID);
    } else if (stock != null) {
      // Stock lives per size. A single-size listing can still be edited with one
      // stock figure; a listing spread over several sizes cannot, because the
      // server would have to guess which size changed.
      const sizeRows = db.prepare('SELECT ProductSizeID FROM ProductSize WHERE ProductID = ?').all(req.params.id);
      if (Number(stock) < 0) { db.exec('ROLLBACK'); return res.status(400).json({ error: 'Stock cannot be negative.' }); }
      if (sizeRows.length > 1) {
        db.exec('ROLLBACK');
        return res.status(400).json({ error: 'This listing is stocked in several sizes, so its stock is changed per size.' });
      }
      if (sizeRows.length === 1) {
        db.prepare('UPDATE ProductSize SET StockQty = ?, Size = COALESCE(?, Size) WHERE ProductSizeID = ?')
          .run(Number(stock), size ?? null, sizeRows[0].ProductSizeID);
      } else {
        db.prepare('INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)')
          .run(req.params.id, size ?? existing.Size, Number(stock));
      }
      db.prepare('UPDATE Product SET StockQty = ? WHERE ProductID = ?').run(Number(stock), existing.ProductID);
    }

    db.prepare(`
      UPDATE Product SET
        Name = COALESCE(?, Name),
        Description = COALESCE(?, Description),
        BrandID = COALESCE(?, BrandID),
        CategoryID = COALESCE(?, CategoryID),
        Size = COALESCE(?, Size),
        ConditionGrade = COALESCE(?, ConditionGrade),
        Price = ?,
        OriginalPrice = ?
      WHERE ProductID = ?
    `).run(
      name ?? null, description ?? null, brandId ?? null, categoryId ?? null,
      size ?? null, condition ?? null, newPrice, newOriginal, req.params.id
    );

    if (newPrice < existing.Price) notifyUtil.priceDropped(db, existing.ProductID, newPrice);
    notifyUtil.stockChanged(db, existing.ProductID);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  }

  res.json({ product: loadProduct(db, req.params.id) });
});

router.delete('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT ProductID FROM Product WHERE ProductID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const inOrders = db.prepare('SELECT COUNT(*) AS n FROM OrderItem WHERE ProductID = ?').get(req.params.id);
  if (inOrders.n > 0) {
    // Preserve order history integrity: stop selling it instead of deleting.
    db.prepare('UPDATE Product SET StockQty = 0 WHERE ProductID = ?').run(req.params.id);
    db.prepare('UPDATE ProductSize SET StockQty = 0 WHERE ProductID = ?').run(req.params.id);
    return res.json({ ok: true, note: 'Product appears in past orders, so it was delisted (stock set to 0) rather than deleted, to keep order history intact.' });
  }

  for (const table of ['CartItem', 'Review', 'WishlistItem', 'StockAlert', 'ProductQuestion', 'ProductSize']) {
    db.prepare(`DELETE FROM ${table} WHERE ProductID = ?`).run(req.params.id);
  }
  db.prepare('DELETE FROM Product WHERE ProductID = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.loadProduct = loadProduct;
