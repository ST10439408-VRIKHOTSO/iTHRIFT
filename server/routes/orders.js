'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRef, productRef } = require('../utils/refs');

const router = express.Router();

const PAYMENT_METHODS = ['payfast', 'card', 'eft'];
const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

function loadOrderDetail(db, orderId) {
  const order = db.prepare(`
    SELECT o.*, c.FirstName, c.LastName, c.Email
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
    WHERE o.OrderID = ?
  `).get(orderId);
  if (!order) return null;

  const items = db.prepare(`
    SELECT oi.Quantity AS quantity, oi.UnitPrice AS unitPrice, p.ProductID AS productId, p.Name AS name, p.ImageFile AS image
    FROM OrderItem oi JOIN Product p ON p.ProductID = oi.ProductID
    WHERE oi.OrderID = ?
  `).all(orderId).map(it => ({ ...it, productRef: productRef(it.productId), lineTotal: it.quantity * it.unitPrice }));

  const payment = db.prepare('SELECT Method AS method, Status AS status, Amount AS amount, CreatedAt AS createdAt FROM Payment WHERE OrderID = ?').get(orderId);

  return {
    id: order.OrderID,
    ref: orderRef(order.OrderID),
    status: order.Status,
    total: order.TotalAmount,
    courierRef: order.CourierRef,
    createdAt: order.CreatedAt,
    updatedAt: order.UpdatedAt,
    customer: { id: order.CustomerID, name: `${order.FirstName} ${order.LastName}`, email: order.Email },
    items,
    payment,
  };
}

// UC6 / UC7: Place order and pay. The server - not the client - locks
// stock and recalculates the total, then records the payment.
router.post('/', requireRole('customer'), (req, res) => {
  const db = getDb();
  const { method } = req.body || {};

  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Payment method must be one of: ' + PAYMENT_METHODS.join(', ') + '.' });
  }

  const cart = db.prepare('SELECT CartID FROM Cart WHERE CustomerID = ?').get(req.user.id);
  const items = cart
    ? db.prepare(`
        SELECT ci.CartItemID, ci.ProductID, ci.Quantity, p.Price, p.StockQty, p.Name
        FROM CartItem ci JOIN Product p ON p.ProductID = ci.ProductID
        WHERE ci.CartID = ?
      `).all(cart.CartID)
    : [];

  if (items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Server-side stock lock: re-check current stock for every line before committing.
  for (const it of items) {
    if (it.Quantity > it.StockQty) {
      return res.status(409).json({ error: `${it.Name} only has ${it.StockQty} left in stock. Please update your cart.` });
    }
  }

  const total = items.reduce((sum, it) => sum + it.Price * it.Quantity, 0);

  db.exec('BEGIN');
  try {
    const orderInfo = db.prepare(`
      INSERT INTO Orders (CustomerID, Status, TotalAmount) VALUES (?, 'Processing', ?)
    `).run(req.user.id, total);
    const orderId = Number(orderInfo.lastInsertRowid);

    const insertItem = db.prepare('INSERT INTO OrderItem (OrderID, ProductID, Quantity, UnitPrice) VALUES (?, ?, ?, ?)');
    const decrementStock = db.prepare('UPDATE Product SET StockQty = StockQty - ? WHERE ProductID = ? AND StockQty >= ?');

    for (const it of items) {
      insertItem.run(orderId, it.ProductID, it.Quantity, it.Price);
      const result = decrementStock.run(it.Quantity, it.ProductID, it.Quantity);
      if (Number(result.changes) !== 1) {
        throw new Error(`Stock for ${it.Name} changed before checkout could complete.`);
      }
    }

    const paymentStatus = method === 'eft' ? 'pending' : 'paid';
    db.prepare('INSERT INTO Payment (OrderID, Method, Status, Amount) VALUES (?, ?, ?, ?)').run(orderId, method, paymentStatus, total);

    db.prepare('DELETE FROM CartItem WHERE CartID = ?').run(cart.CartID);

    db.exec('COMMIT');
    res.status(201).json({ order: loadOrderDetail(db, orderId) });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(409).json({ error: 'Checkout could not be completed: ' + err.message });
  }
});

// UC14 (customer): order history. UC10 (staff/admin): all orders for processing.
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  let rows;
  if (req.user.type === 'customer') {
    rows = db.prepare(`
      SELECT o.*, c.FirstName, c.LastName, c.Email
      FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
      WHERE o.CustomerID = ? ORDER BY o.CreatedAt DESC
    `).all(req.user.id);
  } else {
    const { status } = req.query;
    rows = status
      ? db.prepare(`
          SELECT o.*, c.FirstName, c.LastName, c.Email
          FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
          WHERE o.Status = ? ORDER BY o.CreatedAt DESC
        `).all(status)
      : db.prepare(`
          SELECT o.*, c.FirstName, c.LastName, c.Email
          FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
          ORDER BY o.CreatedAt DESC
        `).all();
  }

  const orders = rows.map(o => ({
    id: o.OrderID,
    ref: orderRef(o.OrderID),
    status: o.Status,
    total: o.TotalAmount,
    courierRef: o.CourierRef,
    createdAt: o.CreatedAt,
    customer: `${o.FirstName} ${o.LastName}`,
  }));
  res.json({ orders });
});

// UC8 / UC14: order detail / tracking.
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const detail = loadOrderDetail(db, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Order not found.' });
  if (req.user.type === 'customer' && detail.customer.id !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own orders.' });
  }
  res.json({ order: detail });
});

// UC10: Process orders - staff/admin update status and add a courier reference.
router.put('/:id/status', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const { status, courierRef } = req.body || {};

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: ' + ORDER_STATUSES.join(', ') + '.' });
  }

  const existing = db.prepare('SELECT OrderID FROM Orders WHERE OrderID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });

  db.prepare(`
    UPDATE Orders SET Status = ?, CourierRef = COALESCE(?, CourierRef), UpdatedAt = datetime('now')
    WHERE OrderID = ?
  `).run(status, courierRef || null, req.params.id);

  res.json({ order: loadOrderDetail(db, req.params.id) });
});

module.exports = router;
