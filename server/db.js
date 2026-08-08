'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'ithrift.db');

let db = null;

/**
 * Returns a singleton synchronous SQLite connection.
 * Node's built-in node:sqlite module (stable as of Node 22.5+) is used so the
 * prototype has zero external database dependencies - just `npm install` and go.
 */
function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
  }
  return db;
}

module.exports = { getDb, DB_PATH };
