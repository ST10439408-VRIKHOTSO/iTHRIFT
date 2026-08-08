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
    SELECT ci.CartItemID AS id, ci.Quantity AS quantity, p.ProductID AS productId, p.Name AS name,
           p.Price AS price, p.StockQty AS stock, p.ImageFile AS image
    FROM CartItem ci JOIN Product p ON p.ProductID = ci.ProductID
    WHERE ci.CartID = ?
    ORDER BY ci.CartItemID
  `).all(cartId);
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  return { cartId, items, subtotal, itemCount: items.reduce((n, it) => n + it.quantity, 0) };
}

// UC5: Manage cart - view current cart.
router.get('/', (req, res) => {
  const db = getDb();
  res.json(loadCart(db, req.user.id));
});

// UC5: add an item.
router.post('/items', (req, res) => {
  const db = getDb();
  const { productId, quantity } = req.body || {};
  const qty = Number(quantity) || 1;

  if (!productId || qty < 1) {
    return res.status(400).json({ error: 'A product and a quantity of at least 1 are required.' });
  }

  const product = db.prepare('SELECT * FROM Product WHERE ProductID = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.StockQty < 1) return res.status(409).json({ error: 'That product is currently out of stock.' });

  const cartId = getOrCreateCartId(db, req.user.id);
  const existing = db.prepare('SELECT * FROM CartItem WHERE CartID = ? AND ProductID = ?').get(cartId, productId);

  const desiredQty = (existing ? existing.Quantity : 0) + qty;
  if (desiredQty > product.StockQty) {
    return res.status(409).json({ error: `Only ${product.StockQty} of this item is in stock.` });
  }

  if (existing) {
    db.prepare('UPDATE CartItem SET Quantity = ? WHERE CartItemID = ?').run(desiredQty, existing.CartItemID);
  } else {
    db.prepare('INSERT INTO CartItem (CartID, ProductID, Quantity) VALUES (?, ?, ?)').run(cartId, productId, qty);
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
  if (qty > product.StockQty) {
    return res.status(409).json({ error: `Only ${product.StockQty} of this item is in stock.` });
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
