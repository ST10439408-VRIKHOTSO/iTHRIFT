'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRef, productRef } = require('../utils/refs');
const { DELIVERY_METHODS, FREE_DELIVERY_THRESHOLD, POINTS_BLOCK, RAND_PER_POINTS_BLOCK, computeTotals, findPromo } = require('../utils/pricing');
const points = require('../utils/points');
const notifyUtil = require('../utils/notify');
const calendar = require('../../public/js/calendar');

const RETURN_WINDOW_DAYS = 30;
const RETURN_REASONS = ["Doesn't fit", 'Not as described', 'Damaged or faulty', 'Changed my mind', 'Wrong item received'];
const VAT_RATE = 0.15;
const STORE = {
  name: 'iTHRIFT Clothes',
  address: 'Hatfield Plaza, Burnett Street, Hatfield, Pretoria, 0083',
  email: 'support@ithrift.co.za',
  phone: '012 345 6789',
};

const router = express.Router();

const PAYMENT_METHODS = ['payfast', 'card', 'eft'];
const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

/**
 * Which status an order may move to next. A collected order can go straight
 * from Processing to Delivered; nothing moves once delivered or cancelled.
 * Saving the current status again is allowed (to add a courier reference).
 */
const NEXT_STATUS = {
  Processing: ['Shipped', 'Delivered', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const STATUS_MESSAGES = {
  Shipped: (ref) => ({ title: 'Your order is on its way', body: `${ref} is with the courier.` }),
  Delivered: (ref) => ({ title: 'Your order has been delivered', body: `${ref} was delivered. You have ${RETURN_WINDOW_DAYS} days to return anything that is not right.` }),
  Cancelled: (ref) => ({ title: 'Your order was cancelled', body: `${ref} was cancelled. Any payment has been refunded and points returned.` }),
};

function addHistory(db, orderId, status, note = null) {
  db.prepare('INSERT INTO OrderStatusHistory (OrderID, Status, Note) VALUES (?, ?, ?)').run(orderId, status, note);
}

function loadOrderDetail(db, orderId) {
  const order = db.prepare(`
    SELECT o.*, c.FirstName, c.LastName, c.Email
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID
    WHERE o.OrderID = ?
  `).get(orderId);
  if (!order) return null;

  const items = db.prepare(`
    SELECT oi.OrderItemID AS orderItemId, oi.Quantity AS quantity, oi.UnitPrice AS unitPrice, oi.Size AS size,
           p.ProductID AS productId, p.Name AS name, p.ImageFile AS image, b.Name AS brand, c.Name AS category,
           r.Status AS returnStatus, r.Reason AS returnReason
    FROM OrderItem oi
    JOIN Product p ON p.ProductID = oi.ProductID
    JOIN Brand b ON b.BrandID = p.BrandID
    JOIN Category c ON c.CategoryID = p.CategoryID
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
  const history = db.prepare(`
    SELECT Status AS status, Note AS note, CreatedAt AS at FROM OrderStatusHistory WHERE OrderID = ? ORDER BY CreatedAt, HistoryID
  `).all(orderId);
  const earned = db.prepare(`SELECT COALESCE(SUM(Points), 0) AS n FROM PointsLedger WHERE OrderID = ? AND Points > 0 AND Reason LIKE 'Earned%'`).get(orderId).n;

  // What to expect next, with a date where one can be worked out.
  const placedOn = String(order.CreatedAt).slice(0, 10);
  let nextStep = null;
  if (order.Status === 'Processing') {
    nextStep = order.DeliveryMethod === 'collection' && order.CollectionDate
      ? { status: 'Ready to collect', date: order.CollectionDate, slot: order.CollectionSlot }
      : { status: 'Shipped', date: calendar.addWorkingDays(placedOn, 1) };
  } else if (order.Status === 'Shipped') {
    const w = calendar.deliveryWindow(order.DeliveryMethod, placedOn);
    nextStep = { status: 'Delivered', date: w.to, from: w.from };
  }

  return {
    id: order.OrderID,
    ref: orderRef(order.OrderID),
    status: order.Status,
    total: order.TotalAmount,
    subtotal: order.Subtotal,
    discount: order.DiscountAmount,
    promoCode: order.PromoCode,
    pointsRedeemed: order.PointsRedeemed,
    pointsDiscount: order.PointsDiscount,
    pointsEarned: earned,
    deliveryMethod: order.DeliveryMethod,
    deliveryLabel: method.label,
    deliveryFee: order.DeliveryFee,
    deliveryAddress: order.DeliveryAddress,
    deliveryInstructions: order.DeliveryInstructions,
    collectionDate: order.CollectionDate,
    collectionSlot: order.CollectionSlot,
    isGift: order.IsGift === 1,
    giftMessage: order.GiftMessage,
    courierRef: order.CourierRef,
    createdAt: order.CreatedAt,
    updatedAt: order.UpdatedAt,
    customer: { id: order.CustomerID, name: `${order.FirstName} ${order.LastName}`, email: order.Email },
    items,
    payment,
    history,
    nextStep,
    nextStatuses: NEXT_STATUS[order.Status],
    // Prices include VAT; this is the VAT portion of what was paid.
    vatIncluded: Math.round((order.TotalAmount - order.TotalAmount / (1 + VAT_RATE)) * 100) / 100,
    store: STORE,
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

/** Prices the current cart with a delivery method, an optional promo code and optional points. */
function quoteFor(db, customerId, { deliveryMethod, promoCode, pointsToRedeem }) {
  const { cart, items } = cartLines(db, customerId);
  const subtotal = items.reduce((sum, it) => sum + it.Price * it.Quantity, 0);
  const promo = findPromo(db, promoCode);
  if (promoCode && !promo) return { cart, items, error: `${String(promoCode).trim().toUpperCase()} is not a valid promo code.` };
  const balance = points.balance(db, customerId);
  const totals = computeTotals({
    subtotal,
    deliveryMethod: deliveryMethod || 'standard',
    promo,
    pointsToRedeem: Number(pointsToRedeem) || 0,
    pointsBalance: balance,
    today: calendar.todayInSouthAfrica(),
  });
  if (totals.error) return { cart, items, error: totals.error };
  if (totals.promoError) return { cart, items, error: totals.promoError };
  return {
    cart, items, totals, pointsBalance: balance,
    promo: promo ? { code: promo.Code, description: promo.Description } : null,
  };
}

// Delivery methods, the free-delivery threshold, return reasons, collection slots and points rules.
router.get('/options', (_req, res) => {
  const today = calendar.todayInSouthAfrica();
  res.json({
    deliveryMethods: Object.values(DELIVERY_METHODS).map((m) => {
      const w = calendar.deliveryWindow(m.id, today);
      return { ...m, arrives: { from: w.from, to: w.to, label: calendar.rangeLabel(w) } };
    }),
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    returnReasons: RETURN_REASONS,
    returnWindowDays: RETURN_WINDOW_DAYS,
    collection: { dates: calendar.collectionDates(today), slots: calendar.COLLECTION_SLOTS, address: STORE.address },
    points: { block: POINTS_BLOCK, randPerBlock: RAND_PER_POINTS_BLOCK, earnPerRand: 0.1 },
  });
});

// The order summary before paying: subtotal, discount, points, delivery and total.
router.post('/quote', requireRole('customer'), (req, res) => {
  const db = getDb();
  const { deliveryMethod, promoCode, pointsToRedeem } = req.body || {};
  const q = quoteFor(db, req.user.id, { deliveryMethod, promoCode, pointsToRedeem });
  if (q.error) return res.status(400).json({ error: q.error });
  res.json({ ...q.totals, promo: q.promo, pointsBalance: q.pointsBalance, itemCount: q.items.reduce((n, it) => n + it.Quantity, 0) });
});

// UC6 / UC7: Place order and pay. The server, not the client, locks
// stock and recalculates the total, then records the payment.
router.post('/', requireRole('customer'), (req, res) => {
  const db = getDb();
  const {
    method, deliveryMethod = 'standard', addressId, promoCode, instructions,
    collectionDate, collectionSlot, isGift, giftMessage, pointsToRedeem,
  } = req.body || {};

  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Payment method must be one of: ' + PAYMENT_METHODS.join(', ') + '.' });
  }

  const q = quoteFor(db, req.user.id, { deliveryMethod, promoCode, pointsToRedeem });
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

  // A collection needs a booked slot, re-checked here against the same calendar the website shows.
  let slot = { date: null, time: null };
  if (deliveryMethod === 'collection' && (collectionDate || collectionSlot)) {
    if (!calendar.isValidCollection(String(collectionDate), String(collectionSlot), calendar.todayInSouthAfrica())) {
      return res.status(400).json({ error: 'Choose a collection day 2 to 10 working days from today, and one of the time slots.' });
    }
    slot = { date: String(collectionDate), time: String(collectionSlot) };
  }

  const gift = isGift === true || isGift === 'true';
  const giftNote = gift && giftMessage ? String(giftMessage).trim().slice(0, 200) : null;

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

  const { subtotal, discount, deliveryFee, total, pointsRedeemed, pointsDiscount } = q.totals;

  db.exec('BEGIN');
  try {
    const orderInfo = db.prepare(`
      INSERT INTO Orders (CustomerID, Status, Subtotal, DiscountAmount, DeliveryFee, DeliveryMethod, PromoCode,
                          DeliveryAddress, DeliveryInstructions, CollectionDate, CollectionSlot, IsGift, GiftMessage,
                          PointsRedeemed, PointsDiscount, TotalAmount)
      VALUES (?, 'Processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, subtotal, discount, deliveryFee, q.totals.deliveryMethod, q.promo ? q.promo.code : null,
      addressText, note || null, slot.date, slot.time, gift ? 1 : 0, giftNote, pointsRedeemed, pointsDiscount, total);
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
    if (pointsRedeemed > 0) points.add(db, req.user.id, -pointsRedeemed, `Spent on ${orderRef(orderId)}`, orderId);
    addHistory(db, orderId, 'Processing', 'Order placed');

    db.prepare('DELETE FROM CartItem WHERE CartID = ?').run(cart.CartID);

    notifyUtil.notify(db, req.user.id, {
      type: 'order',
      title: slot.date ? 'Your collection is booked' : 'We have your order',
      body: slot.date
        ? `${orderRef(orderId)} will be ready on ${calendar.label(slot.date)}, ${slot.time}. Bring your order number.`
        : `${orderRef(orderId)} is being picked and packed.`,
      link: `/orders/${orderId}`,
    });

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
  const select = `
    SELECT o.*, c.FirstName, c.LastName, c.Email,
           (SELECT COUNT(*) FROM OrderItem oi WHERE oi.OrderID = o.OrderID) AS ItemCount,
           (SELECT p.ImageFile FROM OrderItem oi JOIN Product p ON p.ProductID = oi.ProductID
              WHERE oi.OrderID = o.OrderID ORDER BY oi.OrderItemID LIMIT 1) AS FirstImage
    FROM Orders o JOIN Customer c ON c.CustomerID = o.CustomerID`;
  if (req.user.type === 'customer') {
    rows = db.prepare(`${select} WHERE o.CustomerID = ? ORDER BY o.CreatedAt DESC, o.OrderID DESC`).all(req.user.id);
  } else {
    const { status, method } = req.query;
    const clauses = [];
    const params = [];
    if (status) { clauses.push('o.Status = ?'); params.push(status); }
    if (method) { clauses.push('o.DeliveryMethod = ?'); params.push(method); }
    rows = db.prepare(`${select}${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''} ORDER BY o.CreatedAt DESC, o.OrderID DESC`).all(...params);
  }

  const orders = rows.map(o => ({
    id: o.OrderID,
    ref: orderRef(o.OrderID),
    status: o.Status,
    total: o.TotalAmount,
    courierRef: o.CourierRef,
    createdAt: o.CreatedAt,
    customer: `${o.FirstName} ${o.LastName}`,
    itemCount: o.ItemCount,
    image: o.FirstImage,
    deliveryMethod: o.DeliveryMethod,
    collectionDate: o.CollectionDate,
    collectionSlot: o.CollectionSlot,
    isGift: o.IsGift === 1,
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

/** Puts an order's stock back, refunds a paid payment and returns spent points. */
function unwindOrder(db, order) {
  const lines = db.prepare('SELECT ProductID, Size, Quantity FROM OrderItem WHERE OrderID = ?').all(order.OrderID);
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
  points.refundRedeemed(db, order);
  return [...new Set(lines.map((l) => l.ProductID))];
}

// The customer cancels an order that has not been dispatched. Stock goes back on sale.
router.put('/:id/cancel', requireRole('customer'), (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM Orders WHERE OrderID = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.CustomerID !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own orders.' });
  if (order.Status !== 'Processing') {
    return res.status(409).json({ error: `This order is ${order.Status.toLowerCase()}, so it can no longer be cancelled.` });
  }
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE Orders SET Status = 'Cancelled', UpdatedAt = datetime('now') WHERE OrderID = ?`).run(order.OrderID);
    const productIds = unwindOrder(db, order);
    addHistory(db, order.OrderID, 'Cancelled', 'Cancelled by the customer');
    for (const pid of productIds) notifyUtil.stockChanged(db, pid);
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
  const { status, courierRef, note } = req.body || {};

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: ' + ORDER_STATUSES.join(', ') + '.' });
  }

  const existing = db.prepare('SELECT * FROM Orders WHERE OrderID = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  const changing = status !== existing.Status;
  if (changing && !NEXT_STATUS[existing.Status].includes(status)) {
    return res.status(409).json({ error: `An order that is ${existing.Status.toLowerCase()} cannot be marked ${status.toLowerCase()}.` });
  }
  const ref = courierRef ? String(courierRef).trim().slice(0, 40) : null;

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE Orders SET Status = ?, CourierRef = COALESCE(?, CourierRef), UpdatedAt = datetime('now')
      WHERE OrderID = ?
    `).run(status, ref, req.params.id);

    if (changing) {
      const histNote = (note && String(note).trim().slice(0, 200))
        || (status === 'Shipped' && ref ? `Courier reference ${ref}` : null)
        || (status === 'Cancelled' ? 'Cancelled by iTHRIFT' : null);
      addHistory(db, existing.OrderID, status, histNote);
      let productIds = [];
      if (status === 'Cancelled') productIds = unwindOrder(db, existing);
      if (status === 'Delivered') {
        const earned = points.earnForOrder(db, existing);
        if (earned > 0) {
          notifyUtil.notify(db, existing.CustomerID, {
            type: 'points', title: `You earned ${earned} Thrift Points`,
            body: `Points for ${orderRef(existing.OrderID)} are in your balance.`, link: '/account/points',
          });
        }
      }
      const msg = STATUS_MESSAGES[status];
      if (msg) {
        const m = msg(orderRef(existing.OrderID));
        notifyUtil.notify(db, existing.CustomerID, { type: 'order', title: m.title, body: m.body, link: `/orders/${existing.OrderID}` });
      }
      for (const pid of productIds) notifyUtil.stockChanged(db, pid);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({ order: loadOrderDetail(db, req.params.id) });
});

module.exports = router;
module.exports.loadOrderDetail = loadOrderDetail;
