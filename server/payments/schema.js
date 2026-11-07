'use strict';

/**
 * The Payment table, shared by init-db.js (a fresh database) and db.js (an
 * existing database, upgraded the first time the server opens it).
 *
 * One row per order. Method is how the customer chose to pay. Status moves
 * from pending to paid once a gateway (or staff, for a bank transfer)
 * confirms the money, and to refunded if a paid order is cancelled. Card is
 * kept for orders placed before the gateways existed, when card payments
 * were simulated; checkout no longer offers it.
 *
 * The gateway columns describe the latest attempt to pay. PayToken is the
 * random value in the payment links, so the browser tab needs no sign-in.
 * GatewayRef is the provider's own id for that attempt. ReturnTo says
 * whether to send the customer back to the app or the website, and PaidAt
 * records when the money was confirmed.
 */

const STORED_METHODS = ['payfast', 'ozow', 'paystack', 'yoco', 'eft', 'card'];

function paymentTableSql(name = 'Payment') {
  return `CREATE TABLE ${name} (
  PaymentID  INTEGER PRIMARY KEY AUTOINCREMENT,
  OrderID    INTEGER NOT NULL UNIQUE REFERENCES Orders(OrderID),
  Method     TEXT NOT NULL CHECK (Method IN (${STORED_METHODS.map((m) => `'${m}'`).join(',')})),
  Status     TEXT NOT NULL CHECK (Status IN ('pending','paid','refunded')),
  Amount     NUMERIC NOT NULL CHECK (Amount >= 0),
  GatewayRef TEXT,
  PayToken   TEXT UNIQUE,
  ReturnTo   TEXT CHECK (ReturnTo IS NULL OR ReturnTo IN ('app','web')),
  PaidAt     TEXT,
  CreatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);`;
}

/**
 * Brings a Payment table from before the gateways up to date, keeping every
 * row. SQLite cannot change a CHECK rule in place, so the table is rebuilt
 * under a new name, filled, and swapped in, all in one transaction. Returns
 * true when it changed something, false when the table was already current.
 */
function upgradePaymentTable(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Payment'").get();
  if (!row || row.sql.includes("'ozow'")) return false;

  // Foreign keys have to be off while the old table is dropped, and SQLite
  // only lets that setting change outside a transaction.
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(paymentTableSql('Payment_upgraded'));
    db.exec(`
      INSERT INTO Payment_upgraded (PaymentID, OrderID, Method, Status, Amount, CreatedAt)
      SELECT PaymentID, OrderID, Method, Status, Amount, CreatedAt FROM Payment
    `);
    db.exec('DROP TABLE Payment');
    db.exec('ALTER TABLE Payment_upgraded RENAME TO Payment');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  return true;
}

module.exports = { paymentTableSql, upgradePaymentTable, STORED_METHODS };
