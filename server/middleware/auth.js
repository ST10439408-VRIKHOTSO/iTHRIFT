'use strict';

const crypto = require('node:crypto');

/**
 * Minimal in-memory session store. On login, the server issues a random
 * opaque token mapped to the signed-in user; the client sends it back as
 * `Authorization: Bearer <token>`. This keeps the prototype dependency-free
 * (no JWT library, no external session store) while still demonstrating
 * the role-based access rule end to end. Sessions reset if the server
 * restarts, which is an accepted prototype limitation.
 */
const sessions = new Map(); // token -> { type: 'customer'|'admin'|'staff', id, name }

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, user);
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function getSessionUser(token) {
  return sessions.get(token) || null;
}

/** Reads the bearer token, if any, and attaches req.user. Does not block. */
function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.token = token;
  req.user = token ? getSessionUser(token) : null;
  next();
}

/** Blocks the request unless a valid session is present. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in is required for this action.' });
  next();
}

/** Blocks the request unless the session user's type is in `types`. */
function requireRole(...types) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in is required for this action.' });
    if (!types.includes(req.user.type)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

module.exports = { createSession, destroySession, getSessionUser, attachUser, requireAuth, requireRole };
