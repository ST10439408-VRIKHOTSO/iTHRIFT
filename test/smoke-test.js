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

  // --- Single sign-on ---
  // The happy path cannot be tested here: it needs a real ID token from
  // Google, which only a person tapping the button on a handset can produce.
  // What is testable, and what actually protects the system, is that a token
  // we did not verify is refused, so that is what is asserted.
  {
    const status = await call('/api/auth/sso/status');
    check('SSO status endpoint reports whether the server is configured',
      status.status === 200 && typeof status.data.enabled === 'boolean');

    const forged = await call('/api/auth/sso', { method: 'POST', body: { idToken: 'not.a.real.token' } });
    check('SSO refuses a token it has not verified with Google', forged.status === 401);

    const empty = await call('/api/auth/sso', { method: 'POST', body: {} });
    check('SSO refuses a request with no token at all', empty.status === 401);
  }

  // --- Account settings (the app's Settings screen) ---
  {
    const anon = await call('/api/auth/profile');
    check('Profile requires authentication (401 without a token)', anon.status === 401);

    const asStaff = await call('/api/auth/profile', { token: staffToken });
    check('Profile is a customer route; staff are refused (403)', asStaff.status === 403);

    const profile = await call('/api/auth/profile', { token: customerToken });
    check('Customer can read their own profile',
      profile.status === 200 && profile.data.profile.email === 'lerato.m@gmail.com');
    check('Profile says whether the account has a password to change',
      profile.data.profile.canChangePassword === true);
    check('Profile never returns the password hash',
      !JSON.stringify(profile.data).toLowerCase().includes('passwordhash'));

    const badPostal = await call('/api/auth/profile', {
      method: 'PUT', token: customerToken,
      body: { firstName: 'Lerato', lastName: 'Mokoena', postalCode: '12' },
    });
    check('Profile update rejects a postal code that is not four digits', badPostal.status === 400);

    const noName = await call('/api/auth/profile', {
      method: 'PUT', token: customerToken, body: { firstName: '', lastName: 'Mokoena' },
    });
    check('Profile update rejects a blank first name', noName.status === 400);

    const updated = await call('/api/auth/profile', {
      method: 'PUT', token: customerToken,
      body: { firstName: 'Lerato', lastName: 'Mokoena', phone: '082 555 0199', address: '14 Jacaranda Street', city: 'Pretoria', postalCode: '0181' },
    });
    check('Customer can update their own profile', updated.status === 200);

    const reread = await call('/api/auth/profile', { token: customerToken });
    check('The updated phone number was actually persisted',
      reread.data.profile.phone === '082 555 0199');
  }

  // --- Changing a password ---
  // These get an account of their own rather than reusing the one registered
  // above. Changing that account's password would leave a later check, the
  // one that suspends it and confirms it can no longer sign in, failing for
  // the wrong reason, and a test that fails for the wrong reason is worse
  // than no test.
  {
    const pwEmail = `pwtest.${Date.now()}@example.com`;
    const created = await call('/api/auth/register', {
      method: 'POST',
      body: { firstName: 'Password', lastName: 'Tester', email: pwEmail, password: 'Password9' },
    });
    check('A second throwaway account is registered for the password tests', created.status === 201);
    const pwToken = created.data.token;

    const wrongCurrent = await call('/api/auth/change-password', {
      method: 'POST', token: pwToken,
      body: { currentPassword: 'NotMyPassword1', newPassword: 'Password10' },
    });
    check('Password change rejects an incorrect current password', wrongCurrent.status === 401);

    const weak = await call('/api/auth/change-password', {
      method: 'POST', token: pwToken,
      body: { currentPassword: 'Password9', newPassword: 'weak' },
    });
    check('Password change enforces the password policy', weak.status === 400);

    const same = await call('/api/auth/change-password', {
      method: 'POST', token: pwToken,
      body: { currentPassword: 'Password9', newPassword: 'Password9' },
    });
    check('Password change refuses to reuse the current password', same.status === 400);

    const ok = await call('/api/auth/change-password', {
      method: 'POST', token: pwToken,
      body: { currentPassword: 'Password9', newPassword: 'Password10' },
    });
    check('Password change succeeds with the correct current password', ok.status === 200);

    const oldPassword = await call('/api/auth/login', { method: 'POST', body: { identifier: pwEmail, password: 'Password9' } });
    check('The old password no longer works', oldPassword.status === 401);

    const newPassword = await call('/api/auth/login', { method: 'POST', body: { identifier: pwEmail, password: 'Password10' } });
    check('The new password works', newPassword.status === 200);
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

    // Asserted as "at least ten" rather than an exact count: the module
    // requires ten rows per table, and pinning the exact number means every
    // new brand or category added to the catalogue breaks the test for no
    // reason. server/init-db.js enforces the minimum at seed time as well.
    const brands = await call('/api/products/brands');
    check('Brand list holds at least ten seeded brands', brands.data.brands.length >= 10);

    const categories = await call('/api/products/categories');
    check('Category list holds at least ten seeded categories', categories.data.categories.length >= 10);

    const single = await call('/api/products/1');
    check('Single product detail is reachable with a friendly ref', single.status === 200 && single.data.product.ref === 'PRD001');
  }

  // --- Sizes: each product's sizes add up to its stock ---
  {
    const all = (await call('/api/products')).data.products;
    check('Every product reports its sizes', all.every(p => Array.isArray(p.sizes)));
    check('A product\'s sizes always add up to its stock', all.every(p => p.sizes.reduce((n, s) => n + s.stock, 0) === p.stock));
    check('No product offers more sizes than it has pieces in stock', all.every(p => p.sizes.length <= p.stock));

    const shoes = all.filter(p => p.category === 'Footwear').flatMap(p => p.sizes.map(s => s.size));
    check('Shoe sizes are within UK 3 to UK 10', shoes.length > 0 && shoes.every(s => /^UK ([3-9]|10)$/.test(s)));
    const waists = all.filter(p => p.category === 'Trousers' || p.category === 'Jeans').flatMap(p => p.sizes.map(s => Number(s.size)));
    check('Trouser and jean waists are within 28 to 44', waists.length > 0 && waists.every(n => n >= 28 && n <= 44));
    const letters = all.filter(p => ['Tees', 'Shirts', 'Dresses'].includes(p.category)).flatMap(p => p.sizes.map(s => s.size));
    check('Shirt, tee and dress sizes are within XS to XXL', letters.length > 0 && letters.every(s => ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(s)));

    const sized = await call('/api/products?size=UK%208');
    check('The catalogue can be filtered by an in-stock size', sized.status === 200 && sized.data.products.length > 0 && sized.data.products.every(p => p.sizes.some(s => s.size === 'UK 8')));
  }

  // --- Cart (requires auth) ---
  let productForCart, cartSize;
  {
    const noAuth = await call('/api/cart');
    check('Cart endpoint requires authentication (401 without token)', noAuth.status === 401);

    const products = (await call('/api/products?inStock=true')).data.products;
    // A size with at least two pieces, so the quantity can be raised to 2.
    productForCart = products.find(p => p.sizes.some(s => s.stock >= 2));
    cartSize = productForCart.sizes.find(s => s.stock >= 2).size;

    const multiSize = products.find(p => p.sizes.length > 1);
    const noSize = await call('/api/cart/items', { method: 'POST', body: { productId: multiSize.id, quantity: 1 }, token: newCustomerToken });
    check('Adding a multi-size item without choosing a size is refused (400)', noSize.status === 400);

    const badSize = await call('/api/cart/items', { method: 'POST', body: { productId: multiSize.id, quantity: 1, size: 'XXXL' }, token: newCustomerToken });
    check('Adding a size the item is not stocked in is refused (400)', badSize.status === 400);

    const add = await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 1, size: cartSize }, token: newCustomerToken });
    check('A signed-in customer can add an item to their cart', add.status === 201);

    const cart1 = await call('/api/cart', { token: newCustomerToken });
    check('Cart reflects the added item and quantity', cart1.data.items.length === 1 && cart1.data.items[0].quantity === 1);
    check('Cart line remembers the chosen size', cart1.data.items[0].size === cartSize);

    const update = await call(`/api/cart/items/${cart1.data.items[0].id}`, { method: 'PUT', body: { quantity: 2 }, token: newCustomerToken });
    check('Cart line quantity can be updated', update.status === 200 && update.data.items[0].quantity === 2);

    const overStock = await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 999, size: cartSize }, token: newCustomerToken });
    check('Cart rejects a quantity beyond available stock', overStock.status === 409);

    const remove = await call(`/api/cart/items/${cart1.data.items[0].id}`, { method: 'DELETE', token: newCustomerToken });
    check('A cart line can be removed', remove.status === 200 && remove.data.items.length === 0);

    await call('/api/cart/items', { method: 'POST', body: { productId: productForCart.id, quantity: 1, size: cartSize }, token: newCustomerToken });
  }

  // --- Address book ---
  let newAddressId;
  {
    const none = await call('/api/addresses', { token: newCustomerToken });
    check('A new customer starts with an empty address book', none.status === 200 && none.data.addresses.length === 0);

    const noAddress = await call('/api/orders', { method: 'POST', body: { method: 'eft' }, token: newCustomerToken });
    check('Checkout asks for a delivery address when the customer has none', noAddress.status === 400 && /address/.test(noAddress.data.error));

    const badPostal = await call('/api/addresses', { method: 'POST', body: { recipient: 'Test Person', line1: '12 Jacaranda Street', city: 'Pretoria', postalCode: '12' }, token: newCustomerToken });
    check('An address with a postal code that is not four digits is refused', badPostal.status === 400);

    const badPhone = await call('/api/addresses', { method: 'POST', body: { recipient: 'Test Person', line1: '12 Jacaranda Street', city: 'Pretoria', postalCode: '0083', phone: '123' }, token: newCustomerToken });
    check('An address with an invalid phone number is refused', badPhone.status === 400);

    const first = await call('/api/addresses', { method: 'POST', body: { label: 'Home', recipient: 'Test Person', phone: '082 123 4567', line1: '12 Jacaranda Street', suburb: 'Hatfield', city: 'Pretoria', postalCode: '0083' }, token: newCustomerToken });
    check('A customer can save a delivery address', first.status === 201 && first.data.addresses.length === 1);
    check('The first saved address becomes the default', first.data.addresses[0].isDefault === true);

    const second = await call('/api/addresses', { method: 'POST', body: { label: 'Work', recipient: 'Test Person', line1: '1 Church Square', city: 'Pretoria', postalCode: '0002' }, token: newCustomerToken });
    const work = second.data.addresses.find(a => a.label === 'Work');
    check('A second address is saved without replacing the default', second.status === 201 && work && work.isDefault === false);

    const makeDefault = await call(`/api/addresses/${work.id}/default`, { method: 'PUT', token: newCustomerToken });
    check('Any saved address can be made the default', makeDefault.status === 200 && makeDefault.data.addresses.filter(a => a.isDefault).length === 1 && makeDefault.data.addresses[0].id === work.id);

    const edit = await call(`/api/addresses/${work.id}`, { method: 'PUT', body: { label: 'Office', recipient: 'Test Person', line1: '1 Church Square', city: 'Pretoria', postalCode: '0002' }, token: newCustomerToken });
    check('A saved address can be edited', edit.status === 200 && edit.data.addresses.some(a => a.label === 'Office'));

    const del = await call(`/api/addresses/${work.id}`, { method: 'DELETE', token: newCustomerToken });
    check('Deleting the default address promotes the remaining one', del.status === 200 && del.data.addresses.length === 1 && del.data.addresses[0].isDefault === true);
    newAddressId = del.data.addresses[0].id;

    const otherCustomer = await call(`/api/addresses/${newAddressId}`, { method: 'DELETE', token: customerToken });
    check('A customer cannot delete someone else\'s address (404)', otherCustomer.status === 404);
  }

  // --- Delivery options and promo codes ---
  {
    const options = await call('/api/orders/options');
    check('Delivery options list standard, express and collection', options.status === 200 && ['standard', 'express', 'collection'].every(id => options.data.deliveryMethods.some(m => m.id === id)));
    check('Return reasons are published for both clients', Array.isArray(options.data.returnReasons) && options.data.returnReasons.length >= 5);

    const subtotal = productForCart.price;
    const standard = await call('/api/orders/quote', { method: 'POST', body: { deliveryMethod: 'standard' }, token: newCustomerToken });
    const expectedFee = subtotal >= options.data.freeDeliveryThreshold ? 0 : 80;
    check('A quote adds the standard delivery fee below the free-delivery threshold', standard.status === 200 && standard.data.deliveryFee === expectedFee && standard.data.total === subtotal + expectedFee);

    const collection = await call('/api/orders/quote', { method: 'POST', body: { deliveryMethod: 'collection' }, token: newCustomerToken });
    check('Collection from the store costs nothing', collection.data.deliveryFee === 0 && collection.data.total === subtotal);

    const express = await call('/api/orders/quote', { method: 'POST', body: { deliveryMethod: 'express' }, token: newCustomerToken });
    check('Express delivery costs R150', express.data.deliveryFee === 150);

    const unknown = await call('/api/orders/quote', { method: 'POST', body: { promoCode: 'NOTREAL' }, token: newCustomerToken });
    check('An unknown promo code is refused with a message', unknown.status === 400 && /not a valid/.test(unknown.data.error));

    const expired = await call('/api/orders/quote', { method: 'POST', body: { promoCode: 'SUMMER30' }, token: newCustomerToken });
    check('An expired promo code is refused', expired.status === 400 && /expired/.test(expired.data.error));

    const tooSmall = await call('/api/orders/quote', { method: 'POST', body: { promoCode: 'BIGSPEND200' }, token: newCustomerToken });
    check('A promo code below its minimum spend says how much more to add', tooSmall.status === 400 && /Add R/.test(tooSmall.data.error));

    const welcome = await call('/api/orders/quote', { method: 'POST', body: { promoCode: 'welcome10', deliveryMethod: 'collection' }, token: newCustomerToken });
    const expectedDiscount = Math.round(subtotal * 0.10 * 100) / 100;
    check('A valid promo code (any letter case) takes its discount off the subtotal', welcome.status === 200 && welcome.data.discount === expectedDiscount && welcome.data.total === Math.round((subtotal - expectedDiscount) * 100) / 100);
  }

  // --- Checkout: server-side stock lock + total, payment record ---
  let placedOrderId, stockBeforeCheckout, sizeStockBefore;
  {
    const before = (await call(`/api/products/${productForCart.id}`)).data.product;
    stockBeforeCheckout = before.stock;
    sizeStockBefore = before.sizes.find(s => s.size === cartSize).stock;

    const badMethod = await call('/api/orders', { method: 'POST', body: { method: 'bitcoin' }, token: newCustomerToken });
    check('Checkout rejects an unsupported payment method', badMethod.status === 400);

    const checkout = await call('/api/orders', { method: 'POST', body: { method: 'eft' }, token: newCustomerToken });
    check('Checkout succeeds and creates an order', checkout.status === 201 && checkout.data.order.ref.startsWith('ORD-'));
    placedOrderId = checkout.data.order.id;

    const fee = productForCart.price >= 1000 ? 0 : 80;
    check('Order total is computed server-side from the product price plus delivery', checkout.data.order.total === productForCart.price + fee && checkout.data.order.subtotal === productForCart.price);
    check('Checkout defaults to standard delivery to the default address', checkout.data.order.deliveryMethod === 'standard' && /Jacaranda/.test(checkout.data.order.deliveryAddress));
    check('EFT payment is recorded as pending', checkout.data.order.payment.method === 'eft' && checkout.data.order.payment.status === 'pending');

    const cartAfter = await call('/api/cart', { token: newCustomerToken });
    check('Cart is emptied after checkout', cartAfter.data.items.length === 0);

    const stockAfter = (await call(`/api/products/${productForCart.id}`)).data.product.stock;
    check('Stock is decremented server-side after checkout', stockAfter === stockBeforeCheckout - 1);

    const after = (await call(`/api/products/${productForCart.id}`)).data.product;
    const sizeAfter = (after.sizes.find(s => s.size === cartSize) || { stock: 0 }).stock;
    check('Checkout takes stock from the size that was bought', sizeAfter === sizeStockBefore - 1);
    check('The order line records the size', checkout.data.order.items[0].size === cartSize);
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

  // --- Cancelling an order that has not been dispatched ---
  {
    const products = (await call('/api/products?inStock=true')).data.products;
    const item = products.find(p => p.id !== productForCart.id && p.sizes.length >= 1);
    const size = item.sizes[0].size;
    await call('/api/cart/items', { method: 'POST', body: { productId: item.id, quantity: 1, size }, token: newCustomerToken });
    const placed = await call('/api/orders', { method: 'POST', body: { method: 'card', deliveryMethod: 'express', addressId: newAddressId, instructions: 'Leave with the guard at the gate.' }, token: newCustomerToken });
    check('Checkout accepts a chosen address, express delivery and instructions', placed.status === 201 && placed.data.order.deliveryMethod === 'express' && placed.data.order.deliveryFee === 150 && placed.data.order.deliveryInstructions === 'Leave with the guard at the gate.');
    check('A new order can be cancelled while it is processing', placed.data.order.canCancel === true);

    const stockMid = (await call(`/api/products/${item.id}`)).data.product;
    const sizeMid = (stockMid.sizes.find(s => s.size === size) || { stock: 0 }).stock;

    const otherCancel = await call(`/api/orders/${placed.data.order.id}/cancel`, { method: 'PUT', token: customerToken });
    check('A customer cannot cancel someone else\'s order (403)', otherCancel.status === 403);

    const cancelled = await call(`/api/orders/${placed.data.order.id}/cancel`, { method: 'PUT', token: newCustomerToken });
    check('The customer can cancel a processing order', cancelled.status === 200 && cancelled.data.order.status === 'Cancelled');
    check('A paid order that is cancelled is marked refunded', cancelled.data.order.payment.status === 'refunded');

    const stockBack = (await call(`/api/products/${item.id}`)).data.product;
    check('Cancelling puts the piece back in stock in its size', stockBack.stock === stockMid.stock + 1 && stockBack.sizes.find(s => s.size === size).stock === sizeMid + 1);

    const again = await call(`/api/orders/${placed.data.order.id}/cancel`, { method: 'PUT', token: newCustomerToken });
    check('A cancelled order cannot be cancelled twice (409)', again.status === 409);

    const shipped = await call(`/api/orders/${placedOrderId}/cancel`, { method: 'PUT', token: newCustomerToken });
    check('A shipped order can no longer be cancelled (409)', shipped.status === 409);
  }

  // --- Returns ---
  {
    const early = await call(`/api/orders/${placedOrderId}`, { token: newCustomerToken });
    const line = early.data.order.items[0];
    const notYet = await call(`/api/orders/${placedOrderId}/returns`, { method: 'POST', body: { orderItemId: line.orderItemId, reason: "Doesn't fit" }, token: newCustomerToken });
    check('Items cannot be returned before the order is delivered (409)', notYet.status === 409);

    await call(`/api/orders/${placedOrderId}/status`, { method: 'PUT', body: { status: 'Delivered' }, token: staffToken });
    const delivered = await call(`/api/orders/${placedOrderId}`, { token: newCustomerToken });
    check('A delivered order opens a 30-day return window', delivered.data.order.returnWindowOpen === true && delivered.data.order.items[0].canReturn === true);

    const noReason = await call(`/api/orders/${placedOrderId}/returns`, { method: 'POST', body: { orderItemId: line.orderItemId, reason: 'Because' }, token: newCustomerToken });
    check('A return needs one of the listed reasons (400)', noReason.status === 400);

    const requested = await call(`/api/orders/${placedOrderId}/returns`, { method: 'POST', body: { orderItemId: line.orderItemId, reason: "Doesn't fit", comment: 'Runs small.' }, token: newCustomerToken });
    check('The customer can request a return for a delivered item', requested.status === 201 && requested.data.order.items[0].returnStatus === 'Requested');

    const twice = await call(`/api/orders/${placedOrderId}/returns`, { method: 'POST', body: { orderItemId: line.orderItemId, reason: "Doesn't fit" }, token: newCustomerToken });
    check('An item can only be returned once (409)', twice.status === 409);

    const mineReturns = await call('/api/returns', { token: newCustomerToken });
    check('The customer sees their own return and its status', mineReturns.status === 200 && mineReturns.data.returns.length === 1 && mineReturns.data.returns[0].status === 'Requested');

    const allReturns = await call('/api/returns', { token: staffToken });
    check('Staff see every return, including the seeded ones', allReturns.data.returns.length >= 11);
    const ret = allReturns.data.returns.find(r => r.orderItemId === line.orderItemId);

    const custApprove = await call(`/api/returns/${ret.id}`, { method: 'PUT', body: { status: 'Approved' }, token: newCustomerToken });
    check('A customer cannot approve their own return (403)', custApprove.status === 403);

    const skip = await call(`/api/returns/${ret.id}`, { method: 'PUT', body: { status: 'Refunded' }, token: staffToken });
    check('A return must be approved before it is refunded (409)', skip.status === 409);

    const approve = await call(`/api/returns/${ret.id}`, { method: 'PUT', body: { status: 'Approved' }, token: staffToken });
    check('Staff can approve a return', approve.status === 200);

    const before = (await call(`/api/products/${productForCart.id}`)).data.product.stock;
    const refund = await call(`/api/returns/${ret.id}`, { method: 'PUT', body: { status: 'Refunded' }, token: staffToken });
    const refunded = refund.data.returns.find(r => r.id === ret.id);
    check('Staff can refund an approved return for the price paid', refund.status === 200 && refunded.status === 'Refunded' && refunded.refundAmount === line.unitPrice * line.quantity);
    const after = (await call(`/api/products/${productForCart.id}`)).data.product.stock;
    check('A refunded return goes back on sale', after === before + line.quantity);
  }

  // --- Wishlist and sale prices ---
  {
    const sale = await call('/api/products?onSale=true');
    check('The On Sale filter returns only discounted items', sale.status === 200 && sale.data.products.length >= 10 && sale.data.products.every(p => p.onSale && p.originalPrice > p.price && p.percentOff > 0));

    const anon = await call('/api/wishlist');
    check('The wishlist requires signing in (401)', anon.status === 401);

    const saleItem = sale.data.products[0];
    const saved = await call('/api/wishlist', { method: 'POST', body: { productId: saleItem.id }, token: newCustomerToken });
    check('A customer can save an item to their wishlist', saved.status === 201 && saved.data.items.some(i => i.productId === saleItem.id));
    check('A saved sale item keeps its original price', saved.data.items.find(i => i.productId === saleItem.id).onSale === true);

    const twice = await call('/api/wishlist', { method: 'POST', body: { productId: saleItem.id }, token: newCustomerToken });
    check('Saving the same item twice keeps one entry', twice.data.items.filter(i => i.productId === saleItem.id).length === 1);

    const missing = await call('/api/wishlist', { method: 'POST', body: { productId: 99999 }, token: newCustomerToken });
    check('Saving an item that does not exist is refused (404)', missing.status === 404);

    const removed = await call(`/api/wishlist/${saleItem.id}`, { method: 'DELETE', token: newCustomerToken });
    check('An item can be removed from the wishlist', removed.status === 200 && !removed.data.items.some(i => i.productId === saleItem.id));

    const seeded = await call('/api/wishlist', { token: customerToken });
    check('Seeded customers already have wishlist items', seeded.data.items.length > 0);
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
