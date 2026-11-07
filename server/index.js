'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');

const { attachUser } = require('./middleware/auth');
const { securityHeaders } = require('./middleware/security');
const { limitsFor } = require('./middleware/rate-limit');
const { DB_PATH } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(DB_PATH)) {
  console.error('No database found. Please run "npm run init-db" first, then "npm start".');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// On Render the request passes through exactly one proxy, so its
// X-Forwarded-For and X-Forwarded-Proto are believed for one hop: req.ip is
// the real caller (the rate limits key on it) and req.protocol reads https
// (payment links back to this server are built from it). Anywhere else
// nothing is trusted, so a caller cannot claim another address.
app.set('trust proxy', process.env.RENDER ? 1 : false);
app.use(securityHeaders({ indexHtml: path.join(PUBLIC_DIR, 'index.html') }));
// The raw body is kept as well, because Paystack and Yoco sign the exact
// bytes they send and re-serialising the parsed JSON would not match.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use(attachUser);

/**
 * Request logging for the API.
 *
 * One line per API call, written when the response finishes so the status
 * code and the duration are known. This is what turns "the app said it
 * failed" into something we can actually diagnose: the line records who was
 * signed in, what they asked for, what they got back and how long it took.
 *
 * Static files are skipped, because every page load pulls in dozens of them and
 * they would bury the calls that matter. Nothing from the request body is
 * logged, because that is where passwords and ID tokens travel.
 */
app.use('/api', (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const who = req.user ? `${req.user.type}#${req.user.id}` : 'anonymous';
    // A payment link's token opens that payment, so it stays out of the log.
    const url = req.originalUrl.replace(/\/payments\/(go|return)\/[0-9a-f]{32}/, '/payments/$1/[token]');
    const line = `[api] ${req.method} ${url} -> ${res.statusCode} (${ms.toFixed(1)}ms) [${who}]`;
    // 4xx and 5xx go to stderr so a CI run or a log viewer can filter for
    // the failures without reading every successful request.
    if (res.statusCode >= 400) console.error(line);
    else console.log(line);
  });

  next();
});

// API answers carry personal data, so no browser or proxy keeps a copy.
app.use('/api', limitsFor.api, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---- REST API (the shared "link" between the website and the mobile app) ----
const apiRouter = express.Router();
apiRouter.use('/auth', require('./routes/auth'));
apiRouter.use('/products', require('./routes/products'));
apiRouter.use('/cart', require('./routes/cart'));
apiRouter.use('/orders', require('./routes/orders'));
apiRouter.use('/admin', require('./routes/admin'));
apiRouter.use('/wishlist', require('./routes/wishlist'));
apiRouter.use('/addresses', require('./routes/addresses'));
apiRouter.use('/returns', require('./routes/returns'));
apiRouter.use('/account', require('./routes/account'));
apiRouter.use('/notifications', require('./routes/notifications'));
apiRouter.use('/sell', require('./routes/sell'));
apiRouter.use('/support', require('./routes/support'));
apiRouter.use('/payments', require('./routes/payments'));
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'iTHRIFT Clothes API',
    status: 'ok',
    version: require('../package.json').version,
    endpoints: [
      'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me',
      'POST /api/auth/sso', 'GET /api/auth/sso/status',
      'GET /api/auth/profile', 'PUT /api/auth/profile', 'POST /api/auth/change-password', 'POST /api/auth/delete-account',
      'GET /api/products', 'GET /api/products/:id', 'GET /api/products/brands', 'GET /api/products/categories',
      'GET /api/products/:id/reviews', 'POST /api/products/:id/reviews',
      'POST /api/products', 'PUT /api/products/:id', 'DELETE /api/products/:id',
      'GET /api/cart', 'POST /api/cart/items', 'PUT /api/cart/items/:id', 'DELETE /api/cart/items/:id',
      'POST /api/orders', 'GET /api/orders', 'GET /api/orders/:id', 'PUT /api/orders/:id/status',
      'GET /api/orders/options', 'POST /api/orders/quote', 'PUT /api/orders/:id/cancel', 'POST /api/orders/:id/returns',
      'GET /api/wishlist', 'POST /api/wishlist', 'DELETE /api/wishlist/:productId',
      'GET /api/addresses', 'POST /api/addresses', 'PUT /api/addresses/:id', 'PUT /api/addresses/:id/default', 'DELETE /api/addresses/:id',
      'GET /api/returns', 'PUT /api/returns/:id',
      'GET /api/admin/users', 'PUT /api/admin/users/:id/status', 'GET /api/admin/reports/sales', 'GET /api/admin/reports/inventory',
      // Release 1.3.0
      'GET /api/products/suggest', 'GET /api/products/sizes', 'GET /api/products/by-ids', 'GET /api/products/:id/similar',
      'GET /api/products/:id/questions', 'POST /api/products/:id/questions', 'POST /api/products/:id/alerts', 'POST /api/products/bulk-price',
      'GET /api/account/overview', 'PUT /api/account/preferences', 'PUT /api/account/style', 'GET /api/account/for-you',
      'GET /api/account/points', 'GET /api/account/impact',
      'GET /api/account/saved-searches', 'POST /api/account/saved-searches', 'DELETE /api/account/saved-searches/:id',
      'GET /api/account/alerts', 'DELETE /api/account/alerts/:id',
      'GET /api/notifications', 'GET /api/notifications/unread-count', 'PUT /api/notifications/:id/read', 'PUT /api/notifications/read-all', 'DELETE /api/notifications/:id',
      'GET /api/sell', 'POST /api/sell', 'PUT /api/sell/:id/respond', 'PUT /api/sell/:id',
      'GET /api/support', 'POST /api/support', 'GET /api/support/:id', 'POST /api/support/:id/messages', 'PUT /api/support/:id/status',
      'GET /api/admin/reports/analytics', 'GET /api/admin/reports/orders.csv', 'GET /api/admin/promos', 'POST /api/admin/promos', 'PUT /api/admin/promos/:id',
      'GET /api/admin/questions', 'PUT /api/admin/questions/:id', 'GET /api/admin/collections',
      // Release 1.4.0: online payments
      'POST /api/payments/:orderId/start', 'GET /api/payments/go/:token', 'GET /api/payments/return/:token',
      'POST /api/payments/payfast/notify', 'POST /api/payments/paystack/webhook', 'POST /api/payments/yoco/webhook',
      'PUT /api/orders/:id/payment',
    ],
  });
});
app.use('/api', apiRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'There is no such API address.' }));

// ---- Static front ends ----
// /mobile used to serve a separate installable web app. The website itself is
// now the installable app on phones (see public/manifest.webmanifest), so the
// old address sends people there instead of to an out-of-date copy.
app.get(['/mobile', '/mobile/*'], (_req, res) => res.redirect(301, '/'));

// / -> desktop website (customer storefront + staff/admin console)
// no-cache means "check with the server before using a saved copy". The
// check is a cheap ETag round trip, and it stops a phone browser from
// running yesterday's scripts for hours after a new version goes live.
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, file) => {
    if (/\.(html|js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---- Error handling ----
// The details go to the server log only; the caller gets a plain message,
// never a stack trace or a file path.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  iTHRIFT Clothes prototype is running');
  console.log('  --------------------------------------');
  console.log(`  Website (desktop):  http://localhost:${PORT}/`);
  console.log(`  REST API (the link): http://localhost:${PORT}/api`);
  console.log('');
});
