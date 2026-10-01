'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRef, productRef } = require('../utils/refs');
const { DELIVERY_METHODS, FREE_DELIVERY_THRESHOLD, computeTotals, findPromo } = require('../utils/pricing');

const RETURN_WINDOW_DAYS = 30;
const RETURN_REASONS = ["Doesn't fit", 'Not as described', 'Damaged or faulty', 'Changed my mind', 'Wrong item received'];

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
    SELECT oi.OrderItemID AS orderItemId, oi.Quantity AS quantity, oi.UnitPrice AS unitPrice, oi.Size AS size,
           p.ProductID AS productId, p.Name AS name, p.ImageFile AS image,
           r.Status AS returnStatus, r.Reason AS returnReason
    FROM OrderItem oi
    JOIN Product p ON p.ProductID = oi.ProductID
    LEFT JOIN ReturnRequest r ON r.OrderItemID = oi.OrderItemID
    WHERE oi.OrderID = ?
    ORDER BY oi.OrderItemID
  `).all(orderId).map(it => ({ ...it, productRef: productRef(it.productId), lineTotal: it.quantity * it.unitPrice }));

  // Returns are accepted for 30 days after an order is marked delivered.
  const deliveredDaysAgo = order.Status === 'Delivered'
    ? db.prepare(`SELECT CAST(julianday('now') - julianday(?) AS INTEGER) AS d`).get(order.UpdatedAt).d
    : null;
  const returnWindowOpen = deliveredDaysAgo != null && deliveredDaysAgo <= RETURN_WINDOW_DAYS;
  for (const it of items) it.canReturn = returnWindowOpen && !it.returnStatus;
  const method = DELIVERY_METHODS[order.DeliveryMethod] || DELIVERY_METHODS.standard;

  const payment = db.prepare('SELECT Method AS method, Status AS status, Amount AS amount, CreatedAt AS createdAt FROM Payment WHERE OrderID = ?').get(orderId);

  return {
    id: order.OrderID,
    ref: orderRef(order.OrderID),
    status: order.Status,
    total: order.TotalAmount,
    subtotal: order.Subtotal,
    discount: order.DiscountAmount,
    promoCode: order.PromoCode,
    deliveryMethod: order.DeliveryMethod,
    deliveryLabel: method.label,
    deliveryFee: order.DeliveryFee,
    deliveryAddress: order.DeliveryAddress,
    deliveryInstructions: order.DeliveryInstructions,
    courierRef: order.CourierRef,
    createdAt: order.CreatedAt,
    updatedAt: order.UpdatedAt,
    customer: { id: order.CustomerID, name: `${order.FirstName} ${order.LastName}`, email: order.Email },
    items,
    payment,
    canCancel: order.Status === 'Processing',
    returnWindowOpen,
    returnDaysLeft: returnWindowOpen ? RETURN_WINDOW_DAYS - deliveredDaysAgo : 0,
  };
}

/** The customer's cart lines with the stock of the size each line is for. */
function cartLines(db, customerId) {
  const cart = db.prepare('SELECT CartID FROM Cart WHERE CustomerID = ?').get(customerId);
  if (!cart) return { cart: null, items: [] };
  const items = db.prepare(`
    SELECT ci.CartItemID, ci.ProductID, ci.Size, ci.Quantity, p.Price, p.Name,
           CASE WHEN ci.Size IS NULL THEN p.StockQty ELSE COALESCE(ps.StockQty, 0) END AS StockQty
    FROM CartItem ci
    JOIN Product p ON p.ProductID = ci.ProductID
    LEFT JOIN ProductSize ps ON ps.ProductID = ci.ProductID AND ps.Size = ci.Size
    WHERE ci.CartID = ?
  `).all(cart.CartID);
  return { cart, items };
}

/** Prices the current cart with a delivery method and an optional promo code. */
function quoteFor(db, customerId, { deliveryMethod, promoCode }) {
  const { cart, items } = cartLines(db, customerId);
  const subtotal = items.reduce((sum, it) => sum + it.Price * it.Quantity, 0);
  const promo = findPromo(db, promoCode);
  if (promoCode && !promo) return { cart, items, error: `${String(promoCode).trim().toUpperCase()} is not a valid promo code.` };
  const totals = computeTotals({ subtotal, deliveryMethod: deliveryMethod || 'standard', promo });
  if (totals.error) return { cart, items, error: totals.error };
  if (totals.promoError) return { cart, items, error: totals.promoError };
  return {
    cart, items, totals,
    promo: promo ? { code: promo.Code, description: promo.Description } : null,
  };
}

// Delivery methods, the free-delivery threshold and the return reasons, for both clients.
router.get('/options', (_req, res) => {
  res.json({
    deliveryMethods: Object.values(DELIVERY_METHODS),
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    returnReasons: RETURN_REASONS,
    returnWindowDays: RETURN_WINDOW_DAYS,
  });
});

// The order summary before paying: subtotal, discount, delivery and total.
router.post('/quote', requireRole('customer'), (req, res) => {
  const db = getDb();
  const { deliveryMethod, promoCode } = req.body || {};
  const q = quoteFor(db, req.user.id, { deliveryMethod, promoCode });
  if (q.error) return res.status(400).json({ error: q.error });
  res.json({ ...q.totals, promo: q.promo, itemCount: q.items.reduce((n, it) => n + it.Quantity, 0) });
});

// UC6 / UC7: Place order and pay. The server, not the client, locks
// stock and recalculates the total, then records the payment.
router.post('/', requireRole('customer'), (req, res) => {
  const db = getDb();
  const { method, deliveryMethod = 'standard', addressId, promoCode, instructions } = req.body || {};

  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Payment method must be one of: ' + PAYMENT_METHODS.join(', ') + '.' });
  }

  const q = quoteFor(db, req.user.id, { deliveryMethod, promoCode });
  const { cart, items } = q;

  if (items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Server-side stock lock: re-check current stock for every line before committing.
  for (const it of items) {
    if (it.Quantity > it.StockQty) {
      const what = it.Size ? `${it.Name} (size ${it.Size})` : it.Name;
      return res.status(409).json({ error: `${what} only has ${it.StockQty} left in stock. Please update your cart.` });
    }
  }

  if (q.error) return res.status(400).json({ error: q.error });

  // Where it goes: the chosen saved address, else the default one. Collection needs none.
  let addressText = null;
  if (deliveryMethod === 'collection') {
    addressText = 'Collect from: iTHRIFT Clothes, Hatfield Plaza, Pretoria';
  } else {
    const address = addressId
      ? db.prepare('SELECT * FROM Address WHERE AddressID = ? AND CustomerID = ?').get(addressId, req.user.id)
      : db.prepare('SELECT * FROM Address WHERE CustomerID = ? ORDER BY IsDefault DESC, AddressID LIMIT 1').get(req.user.id);
    if (addressId && !address) return res.status(400).json({ error: 'That delivery address was not found.' });
    if (address) {
      addressText = [address.Recipient, address.Line1, address.Suburb, address.City, address.PostalCode].filter(Boolean).join(', ');
    } else {
      // No saved addresses yet: fall back to the address on the customer's profile.
      const c = db.prepare('SELECT FirstName, LastName, AddressLine, City, PostalCode FROM Customer WHERE CustomerID = ?').get(req.user.id);
      if (!c || !c.AddressLine || !c.City) {
        return res.status(400).json({ error: 'Add a delivery address before checking out, or choose collection.' });
      }
      addressText = [`${c.FirstName} ${c.LastName}`, c.AddressLine, c.City, c.PostalCode].filter(Boolean).join(', ');
    }
  }
  const note = instructions ? String(instructions).trim().slice(0, 200) : null;

  const { subtotal, discount, deliveryFee, total } = q.totals;

  db.exec('BEGIN');
  try {
    const orderInfo = db.prepare(`
      INSERT INTO Orders (CustomerID, Status, Subtotal, DiscountAmount, DeliveryFee, DeliveryMethod, PromoCode,
                          DeliveryAddress, DeliveryInstructions, TotalAmount)
      VALUES (?, 'Processing', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, subtotal, discount, deliveryFee, q.totals.deliveryMethod, q.promo ? q.promo.code : null,
      addressText, note || null, total);
    const orderId = Number(orderInfo.lastInsertRowid);

    const insertItem = db.prepare('INSERT INTO OrderItem (OrderID, ProductID, Size, Quantity, UnitPrice) VALUES (?, ?, ?, ?, ?)');
    const decrementStock = db.prepare('UPDATE Product SET StockQty = StockQty - ? WHERE ProductID = ? AND StockQty >= ?');
    const decrementSize = db.prepare('UPDATE ProductSize SET StockQty = StockQty - ? WHERE ProductID = ? AND Size = ? AND StockQty >= ?');

    for (const it of items) {
      insertItem.run(orderId, it.ProductID, it.Size, it.Quantity, it.Price);
      const result = decrementStock.run(it.Quantity, it.ProductID, it.Quantity);
      // The size and the product total move together, inside one transaction.
      const sizeResult = it.Size ? decrementSize.run(it.Quantity, it.ProductID, it.Size, it.Quantity) : { changes: 1 };
      if (Number(result.changes) !== 1 || Number(sizeResult.changes) !== 1) {
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

// The customer cancels an order that has not been dispatched. Stock goes back on sale.
router.put('/:id/cancel', requireRole('customer'), (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM Orders WHERE OrderID = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.CustomerID !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own orders.' });
  if (order.Status !== 'Processing') {
    return res.status(409).json({ error: `This order is ${order.Status.toLowerCase()}, so it can no longer be cancelled.` });
  }
  const lines = db.prepare('SELECT ProductID, Size, Quantity FROM OrderItem WHERE OrderID = ?').all(order.OrderID);
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE Orders SET Status = 'Cancelled', UpdatedAt = datetime('now') WHERE OrderID = ?`).run(order.OrderID);
    for (const l of lines) {
      db.prepare('UPDATE Product SET StockQty = StockQty + ? WHERE ProductID = ?').run(l.Quantity, l.ProductID);
      if (l.Size) {
        db.prepare(`
          INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)
          ON CONFLICT (ProductID, Size) DO UPDATE SET StockQty = StockQty + excluded.StockQty
        `).run(l.ProductID, l.Size, l.Quantity);
      }
    }
    // A paid order is refunded; an unpaid EFT simply lapses.
    db.prepare(`UPDATE Payment SET Status = CASE WHEN Status = 'paid' THEN 'refunded' ELSE Status END WHERE OrderID = ?`)
      .run(order.OrderID);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ order: loadOrderDetail(db, order.OrderID) });
});

// The customer asks to return one line of a delivered order.
router.post('/:id/returns', requireRole('customer'), (req, res) => {
  const db = getDb();
  const detail = loadOrderDetail(db, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Order not found.' });
  if (detail.customer.id !== req.user.id) return res.status(403).json({ error: 'You can only return items from your own orders.' });
  const { orderItemId, reason, comment } = req.body || {};
  const line = detail.items.find((it) => it.orderItemId === Number(orderItemId));
  if (!line) return res.status(400).json({ error: 'Choose an item from this order to return.' });
  if (detail.status !== 'Delivered') return res.status(409).json({ error: 'Items can be returned once the order has been delivered.' });
  if (!detail.returnWindowOpen) {
    return res.status(409).json({ error: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery, and this order is past that.` });
  }
  if (line.returnStatus) return res.status(409).json({ error: 'A return has already been requested for this item.' });
  if (!RETURN_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Choose a reason for the return.' });
  }
  db.prepare('INSERT INTO ReturnRequest (OrderItemID, CustomerID, Reason, Comment) VALUES (?, ?, ?, ?)')
    .run(line.orderItemId, req.user.id, reason, comment ? String(comment).trim().slice(0, 300) : null);
  res.status(201).json({ order: loadOrderDetail(db, detail.id) });
});

// UC10: Process orders. Staff and admin update status and add a courier reference.
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
