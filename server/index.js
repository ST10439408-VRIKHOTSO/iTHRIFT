'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');

const { attachUser } = require('./middleware/auth');
const { DB_PATH } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(DB_PATH)) {
  console.error('No database found. Please run "npm run init-db" first, then "npm start".');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(attachUser);

// ---- REST API (the shared "link" between the website and the mobile app) ----
const apiRouter = express.Router();
apiRouter.use('/auth', require('./routes/auth'));
apiRouter.use('/products', require('./routes/products'));
apiRouter.use('/cart', require('./routes/cart'));
apiRouter.use('/orders', require('./routes/orders'));
apiRouter.use('/admin', require('./routes/admin'));
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'iTHRIFT Clothes API',
    status: 'ok',
    endpoints: [
      'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me',
      'GET /api/products', 'GET /api/products/:id', 'GET /api/products/brands', 'GET /api/products/categories',
      'GET /api/products/:id/reviews', 'POST /api/products/:id/reviews',
      'POST /api/products', 'PUT /api/products/:id', 'DELETE /api/products/:id',
      'GET /api/cart', 'POST /api/cart/items', 'PUT /api/cart/items/:id', 'DELETE /api/cart/items/:id',
      'POST /api/orders', 'GET /api/orders', 'GET /api/orders/:id', 'PUT /api/orders/:id/status',
      'GET /api/admin/users', 'PUT /api/admin/users/:id/status', 'GET /api/admin/reports/sales', 'GET /api/admin/reports/inventory',
    ],
  });
});
app.use('/api', apiRouter);

// ---- Static front ends ----
// /mobile -> installable PWA (customer-only, phone-native layout)
app.use('/mobile', express.static(path.join(PUBLIC_DIR, 'mobile')));
app.get('/mobile/*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'mobile', 'index.html'));
});

// / -> desktop website (customer storefront + staff/admin console)
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  iTHRIFT Clothes prototype is running');
  console.log('  --------------------------------------');
  console.log(`  Website (desktop):  http://localhost:${PORT}/`);
  console.log(`  Mobile application: http://localhost:${PORT}/mobile`);
  console.log(`  REST API (the link): http://localhost:${PORT}/api`);
  console.log('');
});
