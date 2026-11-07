'use strict';

/**
 * Rate limiting: how many times one caller may do something in a period.
 *
 * Each limit counts requests per key (the caller's address, an account
 * identifier or the signed-in user) in a fixed window, and answers 429 with
 * a Retry-After header once the count is used up. It guards sign-in against
 * password guessing, registration against bulk accounts, and the write
 * routes against flooding.
 *
 * The counts live in memory, like the sessions, so they reset when the
 * server restarts and are per server; a larger deployment would keep them
 * in a shared store such as Redis. No dependency is needed for one server.
 *
 * Reference: OWASP. Blocking Brute Force Attacks.
 * https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks
 */

const limits = [];

// Expired windows are dropped once a minute so the maps do not grow without end.
setInterval(() => {
  const now = Date.now();
  for (const hits of limits) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }
}, 60_000).unref();

const byAddress = (req) => req.ip || 'unknown';
const byUser = (req) => (req.user ? `${req.user.type}#${req.user.id}` : byAddress(req));

/**
 * Returns middleware allowing `max` requests per key every `windowMs`.
 * `key(req)` returning null skips the limit for that request.
 */
function rateLimit({ name, windowMs, max, key = byAddress, message }) {
  const hits = new Map();
  limits.push(hits);
  return (req, res, next) => {
    const k = key(req);
    if (k == null) return next();
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count <= max) return next();

    const seconds = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(seconds));
    // Only the first refusal in a window is logged, and never the key itself
    // when it is an email address or phone number.
    if (entry.count === max + 1) console.warn(`[limit] ${name}: limit of ${max} reached`);
    const minutes = Math.max(1, Math.round(seconds / 60));
    res.status(429).json({ error: message || `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.` });
  };
}

const MINUTE = 60_000;

/** The limits the API uses, in one place so they can be read together. */
const limitsFor = {
  // Every API call: a ceiling far above what browsing needs, to stop floods.
  api: rateLimit({ name: 'api', windowMs: 5 * MINUTE, max: 1500, message: 'Too many requests. Please slow down and try again shortly.' }),
  // Sign-in, per address and per account, so guessing one password from many addresses is caught too.
  // The per-address limit is the looser one because a campus or office shares one public address.
  loginByAddress: rateLimit({ name: 'login per address', windowMs: 15 * MINUTE, max: 100 }),
  loginByAccount: rateLimit({
    name: 'login per account',
    windowMs: 15 * MINUTE,
    max: 10,
    key: (req) => {
      const id = String((req.body || {}).identifier || '').trim().toLowerCase().replace(/[\s()-]/g, '');
      return id ? `account:${id}` : null;
    },
  }),
  register: rateLimit({ name: 'register', windowMs: 60 * MINUTE, max: 30 }),
  singleSignOn: rateLimit({ name: 'single sign-on', windowMs: 15 * MINUTE, max: 30 }),
  // Password changes and account deletion check the current password, so they can be guessed at too.
  accountSecurity: rateLimit({ name: 'account security', windowMs: 15 * MINUTE, max: 10, key: byUser }),
  checkout: rateLimit({ name: 'checkout and payments', windowMs: 15 * MINUTE, max: 30, key: byUser }),
  // Reviews, questions, support messages and offers to sell.
  contributions: rateLimit({ name: 'contributions', windowMs: 60 * MINUTE, max: 30, key: byUser }),
};

module.exports = { rateLimit, limitsFor };
