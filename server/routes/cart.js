'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('customer'));

function getOrCreateCartId(db, customerId) {
  let cart = db.prepare('SELECT CartID FROM Cart WHERE CustomerID = ?').get(customerId);
  if (!cart) {
    const info = db.prepare('INSERT INTO Cart (CustomerID) VALUES (?)').run(customerId);
    return Number(info.lastInsertRowid);
  }
  return cart.CartID;
}

function loadCart(db, customerId) {
  const cartId = getOrCreateCartId(db, customerId);
  const items = db.prepare(`
    SELECT ci.CartItemID AS id, ci.Quantity AS quantity, ci.Size AS size, p.ProductID AS productId,
           p.Name AS name, p.Price AS price, p.ImageFile AS image,
           CASE WHEN ci.Size IS NULL THEN p.StockQty ELSE COALESCE(ps.StockQty, 0) END AS stock
    FROM CartItem ci
    JOIN Product p ON p.ProductID = ci.ProductID
    LEFT JOIN ProductSize ps ON ps.ProductID = ci.ProductID AND ps.Size = ci.Size
    WHERE ci.CartID = ?
    ORDER BY ci.CartItemID
  `).all(cartId);
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  return { cartId, items, subtotal, itemCount: items.reduce((n, it) => n + it.quantity, 0) };
}

/**
 * Works out which size a cart line is for, and how many of that size are in
 * stock. A listing with several sizes in stock needs the customer to choose
 * one; with exactly one left, that one is used.
 */
function resolveSize(db, product, requestedSize) {
  const sizes = db.prepare('SELECT Size, StockQty FROM ProductSize WHERE ProductID = ? ORDER BY ProductSizeID')
    .all(product.ProductID);
  if (sizes.length === 0) return { size: null, stock: product.StockQty };
  if (requestedSize) {
    const match = sizes.find((s) => s.Size === String(requestedSize).trim());
    if (!match) return { error: 'That size is not available for this item.' };
    return { size: match.Size, stock: match.StockQty };
  }
  const inStock = sizes.filter((s) => s.StockQty > 0);
  if (inStock.length === 1) return { size: inStock[0].Size, stock: inStock[0].StockQty };
  if (inStock.length === 0) return { size: null, stock: 0 };
  return { error: 'Choose a size first.' };
}

// UC5: Manage cart. View current cart.
router.get('/', (req, res) => {
  const db = getDb();
  res.json(loadCart(db, req.user.id));
});

// UC5: add an item.
router.post('/items', (req, res) => {
  const db = getDb();
  const { productId, quantity, size } = req.body || {};
  const qty = Number(quantity) || 1;

  if (!productId || qty < 1) {
    return res.status(400).json({ error: 'A product and a quantity of at least 1 are required.' });
  }

  const product = db.prepare('SELECT * FROM Product WHERE ProductID = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.StockQty < 1) return res.status(409).json({ error: 'That product is currently out of stock.' });

  const chosen = resolveSize(db, product, size);
  if (chosen.error) return res.status(400).json({ error: chosen.error });
  if (chosen.stock < 1) {
    return res.status(409).json({ error: chosen.size ? `Size ${chosen.size} is sold out.` : 'That product is currently out of stock.' });
  }

  const cartId = getOrCreateCartId(db, req.user.id);
  const existing = db.prepare('SELECT * FROM CartItem WHERE CartID = ? AND ProductID = ? AND Size IS ?')
    .get(cartId, productId, chosen.size);

  const desiredQty = (existing ? existing.Quantity : 0) + qty;
  if (desiredQty > chosen.stock) {
    const what = chosen.size ? `size ${chosen.size}` : 'this item';
    return res.status(409).json({ error: `Only ${chosen.stock} of ${what} is in stock.` });
  }

  if (existing) {
    db.prepare('UPDATE CartItem SET Quantity = ? WHERE CartItemID = ?').run(desiredQty, existing.CartItemID);
  } else {
    db.prepare('INSERT INTO CartItem (CartID, ProductID, Size, Quantity) VALUES (?, ?, ?, ?)')
      .run(cartId, productId, chosen.size, qty);
  }

  res.status(201).json(loadCart(db, req.user.id));
});

// UC5: update line quantity.
router.put('/items/:id', (req, res) => {
  const db = getDb();
  const { quantity } = req.body || {};
  const qty = Number(quantity);

  const cartId = getOrCreateCartId(db, req.user.id);
  const item = db.prepare('SELECT * FROM CartItem WHERE CartItemID = ? AND CartID = ?').get(req.params.id, cartId);
  if (!item) return res.status(404).json({ error: 'Cart item not found.' });

  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'Quantity must be a whole number of at least 1.' });
  }

  const product = db.prepare('SELECT StockQty FROM Product WHERE ProductID = ?').get(item.ProductID);
  const sizeRow = item.Size
    ? db.prepare('SELECT StockQty FROM ProductSize WHERE ProductID = ? AND Size = ?').get(item.ProductID, item.Size)
    : null;
  const available = item.Size ? (sizeRow ? sizeRow.StockQty : 0) : product.StockQty;
  if (qty > available) {
    const what = item.Size ? `size ${item.Size}` : 'this item';
    return res.status(409).json({ error: `Only ${available} of ${what} is in stock.` });
  }

  db.prepare('UPDATE CartItem SET Quantity = ? WHERE CartItemID = ?').run(qty, req.params.id);
  res.json(loadCart(db, req.user.id));
});

// UC5: remove an item.
router.delete('/items/:id', (req, res) => {
  const db = getDb();
  const cartId = getOrCreateCartId(db, req.user.id);
  db.prepare('DELETE FROM CartItem WHERE CartItemID = ? AND CartID = ?').run(req.params.id, cartId);
  res.json(loadCart(db, req.user.id));
});

module.exports = router;
