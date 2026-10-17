'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('customer'));

function loadWishlist(db, customerId) {
  const items = db.prepare(`
    SELECT w.ProductID AS productId, p.Name AS name, b.Name AS brand, p.Price AS price,
           p.OriginalPrice AS originalPrice, p.StockQty AS stock, p.ImageFile AS image,
           p.ConditionGrade AS condition, w.CreatedAt AS savedAt,
           (SELECT COUNT(*) FROM ProductSize ps WHERE ps.ProductID = p.ProductID AND ps.StockQty > 0) AS sizeCount,
           (SELECT ps.Size FROM ProductSize ps WHERE ps.ProductID = p.ProductID AND ps.StockQty > 0
              ORDER BY ps.ProductSizeID LIMIT 1) AS firstSize
    FROM WishlistItem w
    JOIN Product p ON p.ProductID = w.ProductID
    JOIN Brand b ON b.BrandID = p.BrandID
    WHERE w.CustomerID = ?
    ORDER BY w.CreatedAt DESC, w.WishlistItemID DESC
  `).all(customerId);
  return {
    items: items.map((it) => ({
      ...it,
      inStock: it.stock > 0,
      onSale: it.originalPrice != null && it.originalPrice > it.price,
      // With exactly one size left, "Move to cart" can add it straight away.
      onlySize: it.sizeCount === 1 ? it.firstSize : null,
    })),
  };
}

// Saved items, newest first.
router.get('/', (req, res) => {
  res.json(loadWishlist(getDb(), req.user.id));
});

// Save an item. Saving it twice is harmless.
router.post('/', (req, res) => {
  const db = getDb();
  const productId = Number((req.body || {}).productId);
  if (!productId) return res.status(400).json({ error: 'A product is required.' });
  const product = db.prepare('SELECT ProductID FROM Product WHERE ProductID = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('INSERT OR IGNORE INTO WishlistItem (CustomerID, ProductID) VALUES (?, ?)').run(req.user.id, productId);
  res.status(201).json(loadWishlist(db, req.user.id));
});

router.delete('/:productId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM WishlistItem WHERE CustomerID = ? AND ProductID = ?').run(req.user.id, req.params.productId);
  res.json(loadWishlist(db, req.user.id));
});

module.exports = router;
