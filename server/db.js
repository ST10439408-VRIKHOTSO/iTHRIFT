'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { upgradePaymentTable } = require('./payments/schema');
const { labelSampleContent } = require('./sample-content');

const DB_PATH = path.join(__dirname, '..', 'data', 'ithrift.db');

let db = null;

/**
 * Returns a singleton synchronous SQLite connection.
 * Node's built-in node:sqlite module (stable as of Node 22.5+) is used so the
 * prototype has zero external database dependencies: just `npm install` and go.
 *
 * A database made by an older version is brought up to date the first time
 * it is opened, keeping its data, so nobody has to re-seed to upgrade.
 */
function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // Wait rather than fail if DB Browser or another tool is writing at the same moment.
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA foreign_keys = ON;');
    if (upgradePaymentTable(db)) console.log('[db] upgraded the Payment table for online payments');
    if (labelSampleContent(db)) console.log('[db] labelled the seeded sample reviews and questions');
  }
  return db;
}

module.exports = { getDb, DB_PATH };
