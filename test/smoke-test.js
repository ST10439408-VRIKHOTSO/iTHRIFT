'use strict';

/**
 * End-to-end smoke test for the iTHRIFT Clothes API.
 * Run with: npm test   (the server must already be running on PORT, default 3000)
 *
 * Exercises registration and login, catalogue browsing and filtering,
 * cart and checkout, server-side stock locking and totals, payments,
 * order status updates, reviews, reports, role-based access, and the
 * cross-client path described in the Prototype Documentation (Section 8):
 * a product added through the API is immediately visible to a second
 * client, and an order placed through the API updates stock and reports.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition) {
  if (condition) {
    pass++;
    console.log(`  \x1b[32m\u2713\x1b[0m ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  \x1b[31m\u2717\x1b[0m ${label}`);
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (_) { /* empty */ }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nRunning iTHRIFT Clothes smoke test against ${BASE}\n`);

  // 1. API is up
  { const r = await call('/api'); check('API root responds with status ok', r.status === 200 && r.data.status === 'ok'); }

  // --- Registration ---
  const newEmail = `test.${Date.now()}@example.com`;
  let newCustomerToken;
  {
    const weak = await call('/api/auth/register', { method: 'POST', body: { firstName: 'Test', lastName: 'User', email: newEmail, password: 'weak' } });
    check('Registration rejects a weak password', weak.status === 400);

    const r = await call('/api/auth/register', { method: 'POST', body: { firstName: 'Test', lastName: 'User', email: newEmail, password: 'Password9' } });
    check('Registration succeeds with a valid password', r.status === 201 && r.data.token);
    newCustomerToken = r.data.token;

    const dup = await call('/api/auth/register', { method: 'POST', body: { firstName: 'Test', lastName: 'User', email: newEmail, password: 'Password9' } });
    check('Registration rejects a duplicate email', dup.status === 409);
  }

  // --- Login ---
  let customerToken, adminToken, staffToken;
  {
    const bad = await call('/api/auth/login', { method: 'POST', body: { identifier: 'lerato.m@gmail.com', password: 'WrongPass1' } });
    check('Login rejects an incorrect password', bad.status === 401);

    const cust = await call('/api/auth/login', { method: 'POST', body: { identifier: 'lerato.m@gmail.com', password: 'Password1' } });
    check('Seeded customer (Lerato) can log in', cust.status === 200 && cust.data.user.type === 'customer');
    customerToken = cust.data.token;

    const admin = await call('/api/auth/login', { method: 'POST', body: { identifier: 'admin', password: 'Admin@123' } });
    check('Administrator can log in', admin.status === 200 && admin.data.user.type === 'admin');
    adminToken = admin.data.token;

    const staff = await call('/api/auth/login', { method: 'POST', body: { identifier: 'staff01', password: 'Staff@123' } });
    check('Staff member can log in', staff.status === 200 && staff.data.user.type === 'staff');
    staffToken = staff.data.token;

    const me = await call('/api/auth/me', { token: customerToken });
    check('GET /auth/me reflects the signed-in customer', me.status === 200 && me.data.user.name.includes('Lerato'));
  }

  // --- Catalogue: browse, search, filter ---
  {
    const all = await call('/api/products');
    check('Catalogue lists all 63 seeded products', all.data.products.length === 63);

    const nike = await call('/api/products?brand=Nike');
    check('Filtering by brand (Nike) returns only Nike products', nike.data.products.length > 0 && nike.data.products.every(p => p.brand === 'Nike'));

    const jeans = await call('/api/products?category=Jeans');
    check('Filtering by category (Jeans) returns only Jeans products', jeans.data.products.length > 0 && jeans.data.products.every(p => p.category === 'Jeans'));

    const search = await call('/api/products?q=Jeans');
    check('Keyword search finds matching products', search.data.products.some(p => p.name.includes('Jeans')));

    const brands = await call('/api/products/brands');
    check('Brand list has the 15 seeded brands', brands.data.brands.length === 15);

    const categories = await call('/api/products/categories');
    check('Category list has the 8 seeded categories', categories.data.categories.length === 8);

    const single = await call('/api/products/1');
    check('Single product detail is reachable with a friendly ref', single.status === 200 && single.data.product.ref === 'PRD001');
  }

  // --- Cart (requires auth) ---
  let productForCart;
  {
    const noAuth = await call('/api/cart');
    check('Cart endpoint requires authentication (401 without token)', noAuth.status === 401);

    const products = (await call('/api/products?inStock=true')).data.products;
    productForCart = products.find(p => p.stock >= 2);

    const add = await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 1 }, token: newCustomerToken });
    check('A signed-in customer can add an item to their cart', add.status === 201);

    const cart1 = await call('/api/cart', { token: newCustomerToken });
    check('Cart reflects the added item and quantity', cart1.data.items.length === 1 && cart1.data.items[0].quantity === 1);

    const update = await call(`/api/cart/items/${cart1.data.items[0].id}`, { method: 'PUT', body: { quantity: 2 }, token: newCustomerToken });
    check('Cart line quantity can be updated', update.status === 200 && update.data.items[0].quantity === 2);

    const overStock = await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 999 }, token: newCustomerToken });
    check('Cart rejects a quantity beyond available stock', overStock.status === 409);

    const remove = await call(`/api/cart/items/${cart1.data.items[0].id}`, { method: 'DELETE', token: newCustomerToken });
    check('A cart line can be removed', remove.status === 200 && remove.data.items.length === 0);

    await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 1 }, token: newCustomerToken });
  }

  // --- Checkout: server-side stock lock + total, payment record ---
  let placedOrderId, stockBeforeCheckout;
  {
    stockBeforeCheckout = (await call(`/api/products/${productForCart.id}`)).data.product.stock;

    const badMethod = await call('/api/orders', { method: 'POST', body: { method: 'bitcoin' }, token: newCustomerToken });
    check('Checkout rejects an unsupported payment method', badMethod.status === 400);

    const checkout = await call('/api/orders', { method: 'POST', body: { method: 'eft' }, token: newCustomerToken });
    check('Checkout succeeds and creates an order', checkout.status === 201 && checkout.data.order.ref.startsWith('ORD-'));
    placedOrderId = checkout.data.order.id;

    check('Order total is computed server-side from the product price', checkout.data.order.total === productForCart.price);
    check('EFT payment is recorded as pending', checkout.data.order.payment.method === 'eft' && checkout.data.order.payment.status === 'pending');

    const cartAfter = await call('/api/cart', { token: newCustomerToken });
    check('Cart is emptied after checkout', cartAfter.data.items.length === 0);

    const stockAfter = (await call(`/api/products/${productForCart.id}`)).data.product.stock;
    check('Stock is decremented server-side after checkout', stockAfter === stockBeforeCheckout - 1);
  }

  // --- Order access and tracking ---
  {
    const mine = await call('/api/orders', { token: newCustomerToken });
    check('Customer order history includes the new order', mine.data.orders.some(o => o.id === placedOrderId));

    const detail = await call(`/api/orders/${placedOrderId}`, { token: newCustomerToken });
    check('Order owner can view order detail', detail.status === 200);

    const forbidden = await call(`/api/orders/${placedOrderId}`, { token: customerToken });
    check('A different customer cannot view someone else\'s order (403)', forbidden.status === 403);

    const staffView = await call('/api/orders', { token: staffToken });
    check('Staff can see all orders, not just their own', staffView.data.orders.length >= 4);

    const customerDenied = await call(`/api/orders/${placedOrderId}/status`, { method: 'PUT', body: { status: 'Shipped' }, token: newCustomerToken });
    check('A customer cannot change an order\'s status (403)', customerDenied.status === 403);

    const statusUpdate = await call(`/api/orders/${placedOrderId}/status`, { method: 'PUT', body: { status: 'Shipped', courierRef: 'CR-9001' }, token: staffToken });
    check('Staff can update order status and add a courier reference', statusUpdate.status === 200 && statusUpdate.data.order.status === 'Shipped' && statusUpdate.data.order.courierRef === 'CR-9001');

    const tracked = await call(`/api/orders/${placedOrderId}`, { token: newCustomerToken });
    check('The customer sees the updated status when tracking the order', tracked.data.order.status === 'Shipped');
  }

  // --- Listings (staff/admin only) ---
  let newProductId;
  {
    const denied = await call('/api/products', { method: 'POST', body: { name: 'Test Item', description: 'x', brandId: 1, categoryId: 1, size: 'M', condition: 'Good', price: 100, stock: 5 }, token: newCustomerToken });
    check('A customer cannot create a product listing (403)', denied.status === 403);

    const created = await call('/api/products', { method: 'POST', body: { name: 'Cross-Client Test Hoodie', description: 'Added via the API to demonstrate the shared database.', brandId: 1, categoryId: 3, size: 'L', condition: 'Excellent', price: 450, stock: 3 }, token: staffToken });
    check('Staff can add a new product listing', created.status === 201 && created.data.product.name === 'Cross-Client Test Hoodie');
    newProductId = created.data.product.id;

    // Cross-client demonstration: a second, independent request (simulating
    // the mobile app) immediately sees the listing the "admin console" just created.
    const secondClientView = await call(`/api/products?q=Cross-Client`);
    check('A product added via the API is immediately visible to a second client (shared database)', secondClientView.data.products.some(p => p.id === newProductId));

    const updated = await call(`/api/products/${newProductId}`, { method: 'PUT', body: { price: 399 }, token: staffToken });
    check('Staff can edit an existing listing', updated.status === 200 && updated.data.product.price === 399);
  }

  // --- Reviews ---
  {
    const review = await call(`/api/products/${productForCart.id}/reviews`, { method: 'POST', body: { rating: 5, comment: 'Smoke-test review.' }, token: newCustomerToken });
    check('A customer can submit a product review', review.status === 201);

    const reviews = await call(`/api/products/${productForCart.id}/reviews`);
    check('The submitted review appears in the product\'s review list', reviews.data.reviews.some(r => r.comment === 'Smoke-test review.'));
  }

  // --- Reports and user management (role-based access) ---
  {
    const salesDenied = await call('/api/admin/reports/sales', { token: newCustomerToken });
    check('A customer cannot view the sales report (403)', salesDenied.status === 403);

    const sales = await call('/api/admin/reports/sales', { token: staffToken });
    check('Staff can view the sales report', sales.status === 200 && sales.data.totals.orderCount >= 4);

    const inventory = await call('/api/admin/reports/inventory', { token: adminToken });
    check('Inventory report flags the seeded out-of-stock product', inventory.data.outOfStock.some(p => p.name === 'Silver Diamond Halo Ring'));

    const usersAsStaff = await call('/api/admin/users', { token: staffToken });
    check('User management is reserved for the administrator (staff gets 403)', usersAsStaff.status === 403);

    const users = await call('/api/admin/users', { token: adminToken });
    check('Administrator can list customer accounts', users.status === 200 && users.data.users.length >= 4);

    const target = users.data.users.find(u => u.email === newEmail);
    const suspend = await call(`/api/admin/users/${target.id}/status`, { method: 'PUT', body: { status: 'suspended' }, token: adminToken });
    check('Administrator can suspend a customer account', suspend.status === 200);

    const blockedLogin = await call('/api/auth/login', { method: 'POST', body: { identifier: newEmail, password: 'Password9' } });
    check('A suspended customer cannot log in', blockedLogin.status === 403);

    const reactivate = await call(`/api/admin/users/${target.id}/status`, { method: 'PUT', body: { status: 'active' }, token: adminToken });
    check('Administrator can reactivate a suspended account', reactivate.status === 200);
  }

  // --- Session ---
  {
    const logout = await call('/api/auth/logout', { method: 'POST', token: newCustomerToken });
    check('Logout succeeds', logout.status === 200);

    const afterLogout = await call('/api/cart', { token: newCustomerToken });
    check('The token no longer works after logout', afterLogout.status === 401);
  }

  console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total checks.\n`);
  if (fail > 0) {
    console.log('Failed checks:');
    failures.forEach(f => console.log('  - ' + f));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exitCode = 1;
});
