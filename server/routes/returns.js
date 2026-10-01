'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRef } = require('../utils/refs');

const router = express.Router();

const RETURN_STATUSES = ['Requested', 'Approved', 'Rejected', 'Refunded'];

/** What each status may move to. A refund is final; a rejection can be reconsidered. */
const NEXT_STATUS = {
  Requested: ['Approved', 'Rejected'],
  Approved: ['Refunded', 'Rejected'],
  Rejected: ['Approved'],
  Refunded: [],
};

function listReturns(db, customerId) {
  const where = customerId ? 'WHERE r.CustomerID = ?' : '';
  const rows = db.prepare(`
    SELECT r.ReturnID AS id, r.Reason AS reason, r.Comment AS comment, r.Status AS status,
           r.RefundAmount AS refundAmount, r.CreatedAt AS createdAt, r.UpdatedAt AS updatedAt,
           oi.OrderItemID AS orderItemId, oi.OrderID AS orderId, oi.Size AS size, oi.Quantity AS quantity,
           oi.UnitPrice AS unitPrice, p.Name AS productName, p.ImageFile AS image,
           c.FirstName || ' ' || c.LastName AS customer
    FROM ReturnRequest r
    JOIN OrderItem oi ON oi.OrderItemID = r.OrderItemID
    JOIN Product p ON p.ProductID = oi.ProductID
    JOIN Customer c ON c.CustomerID = r.CustomerID
    ${where}
    ORDER BY r.CreatedAt DESC, r.ReturnID DESC
  `).all(...(customerId ? [customerId] : []));
  return rows.map((r) => ({ ...r, orderRef: orderRef(r.orderId), nextStatuses: NEXT_STATUS[r.status] }));
}

// Customers see their own returns; staff and the administrator see every return.
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  res.json({ returns: listReturns(db, req.user.type === 'customer' ? req.user.id : null) });
});

// Staff move a return through its states. A refund puts the piece back on sale in its size.
router.put('/:id', requireRole('admin', 'staff'), (req, res) => {
  const db = getDb();
  const { status } = req.body || {};
  if (!RETURN_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: ' + RETURN_STATUSES.join(', ') + '.' });
  }
  const ret = db.prepare(`
    SELECT r.*, oi.ProductID, oi.Size, oi.Quantity, oi.UnitPrice
    FROM ReturnRequest r JOIN OrderItem oi ON oi.OrderItemID = r.OrderItemID
    WHERE r.ReturnID = ?
  `).get(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Return not found.' });
  if (!NEXT_STATUS[ret.Status].includes(status)) {
    return res.status(409).json({ error: `A return that is ${ret.Status.toLowerCase()} cannot be marked ${status.toLowerCase()}.` });
  }

  const refund = status === 'Approved' || status === 'Refunded' ? ret.UnitPrice * ret.Quantity : 0;
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ReturnRequest SET Status = ?, RefundAmount = ?, UpdatedAt = datetime('now') WHERE ReturnID = ?`)
      .run(status, refund, ret.ReturnID);
    if (status === 'Refunded') {
      db.prepare('UPDATE Product SET StockQty = StockQty + ? WHERE ProductID = ?').run(ret.Quantity, ret.ProductID);
      if (ret.Size) {
        db.prepare(`
          INSERT INTO ProductSize (ProductID, Size, StockQty) VALUES (?, ?, ?)
          ON CONFLICT (ProductID, Size) DO UPDATE SET StockQty = StockQty + excluded.StockQty
        `).run(ret.ProductID, ret.Size, ret.Quantity);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ returns: listReturns(db, null) });
});

module.exports = router;
module.exports.listReturns = listReturns;
