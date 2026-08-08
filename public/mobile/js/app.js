'use strict';

/* =========================================================================
   iTHRIFT Clothes - mobile PWA (installable, customer-facing)
   Talks to the same /api as the desktop website. Five tabs: Shop, Search,
   Cart, Orders, Account - matching the Prototype Documentation.
   ========================================================================= */

const state = {
  token: localStorage.getItem('ithrift_token') || null,
  user: JSON.parse(localStorage.getItem('ithrift_user') || 'null'),
  cartCount: 0,
  brands: [],
  categories: [],
};

function setSession(token, user) {
  state.token = token; state.user = user;
  if (token) {
    localStorage.setItem('ithrift_token', token);
    localStorage.setItem('ithrift_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('ithrift_token');
    localStorage.removeItem('ithrift_user');
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return 'R' + Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 }); }
function conditionClass(c) { return String(c).toLowerCase().replace(/\s+/g, '-'); }
function statusClass(s) { return 'status-' + String(s).toLowerCase(); }
function timeAgo(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

let toastTimer = null;
function toast(msg, type = '') {
  let el = document.getElementById('m-toast');
  if (!el) { el = document.createElement('div'); el.id = 'm-toast'; document.querySelector('.phone-shell').appendChild(el); }
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

function requireLogin(redirectTo) {
  if (!state.user) { location.hash = '#/account?next=' + encodeURIComponent(redirectTo); return false; }
  return true;
}

function parseHashQuery() {
  const idx = location.hash.indexOf('?');
  if (idx === -1) return {};
  return Object.fromEntries(new URLSearchParams(location.hash.slice(idx + 1)).entries());
}
function buildHash(route, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  return '#/' + route + (qs ? '?' + qs : '');
}

async function refreshCartCount() {
  if (!state.user || state.user.type !== 'customer') { state.cartCount = 0; return; }
  try { state.cartCount = (await api('/cart')).itemCount; } catch (_) { state.cartCount = 0; }
}

function updateChrome(routeKey, title) {
  document.getElementById('app-bar-title').textContent = title || 'iTHRIFT';
  const actions = document.getElementById('app-bar-actions');
  actions.innerHTML = state.user ? `<a href="#/account">${escapeHtml(state.user.name.split(' ')[0])}</a>` : `<a href="#/account">Sign in</a>`;

  document.querySelectorAll('#tab-bar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === routeKey);
  });
  const cartLabel = document.getElementById('tab-cart-label');
  cartLabel.innerHTML = 'Cart' + (state.cartCount ? ` <span class="tab-cart-dot">${state.cartCount}</span>` : '');
}

async function loadLookups() {
  if (state.brands.length && state.categories.length) return;
  const [b, c] = await Promise.all([api('/products/brands'), api('/products/categories')]);
  state.brands = b.brands; state.categories = c.categories;
}

/* ------------------------------ Router ------------------------------ */

async function router() {
  const view = document.getElementById('view');
  const hashPath = location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = hashPath.split('/').filter(Boolean);
  const query = parseHashQuery();
  const root = parts[0] || 'shop';

  view.innerHTML = '<div class="empty small">Loading&hellip;</div>';

  try {
    await loadLookups();
    await refreshCartCount();

    if (root === 'shop') { await renderShop(view, query); updateChrome('shop', 'iTHRIFT'); }
    else if (root === 'search') { await renderSearch(view, query); updateChrome('search', 'Search'); }
    else if (root === 'product') { await renderProduct(view, parts[1]); updateChrome('shop', 'Product'); }
    else if (root === 'cart') { await renderCart(view); updateChrome('cart', 'Cart'); }
    else if (root === 'checkout') { await renderCheckout(view); updateChrome('cart', 'Checkout'); }
    else if (root === 'order-confirmation') { await renderOrderConfirmation(view, parts[1]); updateChrome('orders', 'Order placed'); }
    else if (root === 'orders' && parts[1]) { await renderOrderDetail(view, parts[1]); updateChrome('orders', 'Order'); }
    else if (root === 'orders') { await renderOrders(view); updateChrome('orders', 'My orders'); }
    else if (root === 'account') { await renderAccount(view, query.next); updateChrome('account', 'Account'); }
    else { view.innerHTML = '<div class="empty">Not found</div>'; updateChrome('', 'iTHRIFT'); }
  } catch (err) {
    view.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  }
  view.scrollTop = 0;
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

/* ------------------------------ Shop / Search ------------------------------ */

function productCardSmall(p) {
  return `
    <a class="m-card" href="#/product/${p.id}">
      <div class="thumb">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
        <span class="badge ${p.inStock ? conditionClass(p.condition) : 'out'}">${p.inStock ? p.condition : 'Out of stock'}</span>
      </div>
      <div class="body">
        <div class="brand">${escapeHtml(p.brand)}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${money(p.price)}</div>
      </div>
    </a>
  `;
}

async function renderShop(view, query) {
  const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
  const { products } = await api('/products?' + params.toString());

  view.innerHTML = `
    <div class="eyebrow">The catalogue</div>
    <h1>Pre-loved pieces, ready to be re-worn</h1>
    <div class="chip-row" id="chip-row">
      <span class="chip ${!query.category ? 'active' : ''}" data-cat="">All</span>
      ${state.categories.map(c => `<span class="chip ${query.category === c.name ? 'active' : ''}" data-cat="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>`).join('')}
    </div>
    ${products.length === 0 ? '<div class="empty">No products match.</div>' : `<div class="m-grid">${products.map(productCardSmall).join('')}</div>`}
  `;

  view.querySelectorAll('[data-cat]').forEach((chip) => {
    chip.addEventListener('click', () => { location.hash = buildHash('shop', { category: chip.dataset.cat || undefined }); });
  });
}

async function renderSearch(view, query) {
  view.innerHTML = `
    <div class="search-bar"><span>&#128269;</span><input id="search-input" type="text" placeholder="Search brand, item..." value="${escapeHtml(query.q || '')}"></div>
    <div class="chip-row">
      ${state.brands.map(b => `<span class="chip ${query.brand === b.name ? 'active' : ''}" data-brand="${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>`).join('')}
    </div>
    <div id="search-results"><div class="empty small">Type to search, or pick a brand above.</div></div>
  `;

  const resultsEl = document.getElementById('search-results');

  async function runSearch() {
    const q = document.getElementById('search-input').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (query.brand) params.set('brand', query.brand);
    if (!q && !query.brand) { resultsEl.innerHTML = '<div class="empty small">Type to search, or pick a brand above.</div>'; return; }
    const { products } = await api('/products?' + params.toString());
    resultsEl.innerHTML = products.length
      ? `<div class="m-grid">${products.map(productCardSmall).join('')}</div>`
      : '<div class="empty small">No matches.</div>';
  }

  document.getElementById('search-input').addEventListener('input', debounce(runSearch, 300));
  view.querySelectorAll('[data-brand]').forEach((chip) => {
    chip.addEventListener('click', () => { location.hash = buildHash('search', { q: query.q, brand: query.brand === chip.dataset.brand ? undefined : chip.dataset.brand }); });
  });
  if (query.brand) runSearch();
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function renderProduct(view, id) {
  const [{ product }, { reviews }] = await Promise.all([api(`/products/${id}`), api(`/products/${id}/reviews`)]);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  view.innerHTML = `
    <a href="#/shop" class="small">&larr; Back</a>
    <div class="thumb" style="border-radius:14px;overflow:hidden;margin:10px 0;aspect-ratio:1/1;background:#ddd"><img src="${product.image}" alt="${escapeHtml(product.name)}"></div>
    <div class="eyebrow">${escapeHtml(product.brand)} &middot; ${product.ref}</div>
    <h1>${escapeHtml(product.name)}</h1>
    <div class="row-between" style="margin-bottom:8px">
      <span class="badge ${product.inStock ? conditionClass(product.condition) : 'out'}">${product.inStock ? product.condition : 'Out of stock'}</span>
      <span class="small">Size ${escapeHtml(product.size)}${avg ? ` &middot; <span class="stars">&starf;</span> ${avg} (${reviews.length})` : ''}</span>
    </div>
    <p>${escapeHtml(product.description)}</p>
    <h2>${money(product.price)}</h2>
    ${product.inStock ? `
      <div class="row-between" style="margin:14px 0">
        <div class="qty-stepper"><button type="button" id="qm">&minus;</button><span id="qv">1</span><button type="button" id="qp">+</button></div>
        <span class="small">${product.stock} left</span>
      </div>
      <button class="btn accent" id="add-btn">Add to cart</button>
    ` : `<div class="form-error">Out of stock</div>`}

    <div class="card-panel" style="margin-top:18px">
      <h3>Reviews</h3>
      ${reviews.length === 0 ? '<p class="small">No reviews yet.</p>' : reviews.map(r => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div class="row-between"><strong style="font-size:13px">${escapeHtml(r.author)}</strong><span class="stars" style="font-size:12px">${'&starf;'.repeat(r.rating)}</span></div>
          ${r.comment ? `<p style="margin:4px 0 0">${escapeHtml(r.comment)}</p>` : ''}
        </div>
      `).join('')}
      ${state.user && state.user.type === 'customer' ? `
        <form id="review-form" style="margin-top:10px">
          <div class="field"><label>Rating</label>
            <select name="rating">${[5,4,3,2,1].map(n => `<option value="${n}">${n} star${n>1?'s':''}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Comment</label><textarea name="comment" rows="2"></textarea></div>
          <button class="btn sm" type="submit">Submit review</button>
        </form>
      ` : `<p class="small"><a href="#/account?next=${encodeURIComponent('/product/' + id)}">Sign in</a> to review.</p>`}
    </div>
  `;

  let qty = 1;
  document.getElementById('qm')?.addEventListener('click', () => { qty = Math.max(1, qty - 1); document.getElementById('qv').textContent = qty; });
  document.getElementById('qp')?.addEventListener('click', () => { qty = Math.min(product.stock, qty + 1); document.getElementById('qv').textContent = qty; });
  document.getElementById('add-btn')?.addEventListener('click', async () => {
    if (!requireLogin('/product/' + id)) return;
    try {
      await api('/cart/items', { method: 'POST', body: { productId: product.id, quantity: qty } });
      toast('Added to cart', 'success');
      await refreshCartCount();
      updateChrome('shop', 'Product');
    } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/products/${id}/reviews`, { method: 'POST', body: { rating: Number(fd.get('rating')), comment: fd.get('comment') } });
      toast('Review submitted', 'success');
      renderProduct(view, id);
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ------------------------------ Cart / Checkout ------------------------------ */

async function renderCart(view) {
  if (!requireLogin('/cart')) return;
  const cart = await api('/cart');
  if (cart.items.length === 0) { view.innerHTML = '<div class="empty"><h3>Your cart is empty</h3><a class="btn accent" href="#/shop" style="margin-top:10px">Start shopping</a></div>'; return; }

  view.innerHTML = `
    <h1>Cart</h1>
    <div class="card-panel">
      ${cart.items.map(i => `
        <div class="line">
          <div class="thumb-sm"><img src="${i.image}" alt=""></div>
          <div style="flex:1">
            <strong style="font-size:13.5px">${escapeHtml(i.name)}</strong>
            <div class="small">${money(i.price)} each</div>
          </div>
          <div class="qty-stepper"><button data-m="${i.id}">&minus;</button><span>${i.quantity}</span><button data-p="${i.id}">+</button></div>
        </div>
      `).join('')}
    </div>
    <div class="card-panel">
      <div class="row-between"><span class="small">Subtotal</span><strong>${money(cart.subtotal)}</strong></div>
      <a class="btn accent" href="#/checkout" style="margin-top:10px">Checkout</a>
    </div>
  `;
  view.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => stepCart(b.dataset.m, -1, view)));
  view.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => stepCart(b.dataset.p, 1, view)));
}

async function stepCart(itemId, delta, view) {
  const cart = await api('/cart');
  const item = cart.items.find(i => String(i.id) === String(itemId));
  if (!item) return;
  const newQty = item.quantity + delta;
  try {
    if (newQty < 1) await api(`/cart/items/${itemId}`, { method: 'DELETE' });
    else await api(`/cart/items/${itemId}`, { method: 'PUT', body: { quantity: newQty } });
    await refreshCartCount();
    updateChrome('cart', 'Cart');
    renderCart(view);
  } catch (err) { toast(err.message, 'error'); }
}

async function renderCheckout(view) {
  if (!requireLogin('/checkout')) return;
  const cart = await api('/cart');
  if (cart.items.length === 0) { view.innerHTML = '<div class="empty">Your cart is empty.</div>'; return; }

  view.innerHTML = `
    <h1>Checkout</h1>
    <div class="card-panel">
      <h3>Payment method</h3>
      <form id="checkout-form">
        <label class="pay-option selected" data-pay><input type="radio" name="method" value="card" checked> Credit / debit card</label>
        <label class="pay-option" data-pay><input type="radio" name="method" value="payfast"> PayFast</label>
        <label class="pay-option" data-pay><input type="radio" name="method" value="eft"> EFT (pending)</label>
        <div class="row-between" style="margin:10px 0"><span class="small">Total</span><strong>${money(cart.subtotal)}</strong></div>
        <button class="btn accent" type="submit">Place order</button>
      </form>
    </div>
  `;
  view.querySelectorAll('[data-pay]').forEach(l => l.addEventListener('click', () => {
    view.querySelectorAll('[data-pay]').forEach(x => x.classList.remove('selected'));
    l.classList.add('selected');
  }));
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const method = new FormData(e.target).get('method');
    try {
      const { order } = await api('/orders', { method: 'POST', body: { method } });
      await refreshCartCount();
      location.hash = '#/order-confirmation/' + order.id;
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function renderOrderConfirmation(view, id) {
  const { order } = await api(`/orders/${id}`);
  view.innerHTML = `
    <div class="empty">
      <div class="eyebrow">Order placed</div>
      <h1>Thanks, ${escapeHtml(order.customer.name.split(' ')[0])}!</h1>
      <p>Order <strong>${order.ref}</strong> &middot; ${money(order.total)}</p>
      <a class="btn accent" href="#/orders">Track my orders</a>
    </div>
  `;
}

/* ------------------------------ Orders ------------------------------ */

async function renderOrders(view) {
  if (!requireLogin('/orders')) return;
  const { orders } = await api('/orders');
  view.innerHTML = orders.length === 0
    ? '<div class="empty"><h3>No orders yet</h3><a class="btn accent" href="#/shop" style="margin-top:10px">Start shopping</a></div>'
    : `<h1>My orders</h1>${orders.map(o => `
        <a href="#/orders/${o.id}" class="card-panel" style="display:block">
          <div class="row-between"><strong>${o.ref}</strong><span class="badge ${statusClass(o.status)}">${o.status}</span></div>
          <div class="row-between small" style="margin-top:4px"><span>${timeAgo(o.createdAt)}</span><span>${money(o.total)}</span></div>
        </a>`).join('')}`;
}

const STATUS_FLOW = ['Processing', 'Shipped', 'Delivered'];

async function renderOrderDetail(view, id) {
  if (!requireLogin('/orders/' + id)) return;
  const { order } = await api(`/orders/${id}`);
  const step = STATUS_FLOW.indexOf(order.status);
  view.innerHTML = `
    <a href="#/orders" class="small">&larr; My orders</a>
    <div class="row-between" style="margin-top:6px"><h1 style="margin:0">${order.ref}</h1><span class="badge ${statusClass(order.status)}">${order.status}</span></div>
    <p class="small">Placed ${timeAgo(order.createdAt)}</p>
    ${order.status !== 'Cancelled' ? `
    <div class="card-panel">
      <div class="row-between">${STATUS_FLOW.map((s, i) => `<span class="small" style="font-weight:${i<=step?700:400};color:${i<=step?'var(--accent)':'var(--muted2)'}">${s}</span>`).join('')}</div>
      ${order.courierRef ? `<p class="small" style="margin-top:8px">Courier ref: <strong>${escapeHtml(order.courierRef)}</strong></p>` : ''}
    </div>` : ''}
    <div class="card-panel">
      <h3>Items</h3>
      ${order.items.map(i => `<div class="order-row"><span>${i.quantity} &times; ${escapeHtml(i.name)}</span><span>${money(i.lineTotal)}</span></div>`).join('')}
      <div class="order-row" style="font-weight:800;border-bottom:none"><span>Total</span><span>${money(order.total)}</span></div>
      <div class="order-row" style="border-bottom:none"><span>Payment</span><span>${order.payment.method.toUpperCase()} &middot; ${order.payment.status}</span></div>
    </div>
  `;
}

/* ------------------------------ Account ------------------------------ */

async function renderAccount(view, next) {
  if (state.user) {
    view.innerHTML = `
      <h1>My account</h1>
      <div class="card-panel">
        <strong>${escapeHtml(state.user.name)}</strong>
        <p class="small" style="margin-top:4px">Customer account</p>
        <a class="btn outline" href="#/orders" style="margin-bottom:8px">My orders</a>
        <button class="btn" id="logout-btn">Sign out</button>
      </div>
      <p class="small">For the staff and administrator console, use the desktop website at <strong>/</strong>.</p>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
      setSession(null, null);
      toast('Signed out');
      location.hash = '#/shop';
    });
    return;
  }

  view.innerHTML = `
    <h1>Sign in</h1>
    <div id="auth-error"></div>
    <form id="login-form" class="card-panel">
      <div class="field"><label>Email</label><input type="email" name="identifier" required></div>
      <div class="field"><label>Password</label><input type="password" name="password" required></div>
      <button class="btn accent" type="submit">Sign in</button>
    </form>
    <p class="small">New here? <a href="#/register-mobile">Create an account below</a></p>
    <form id="register-form" class="card-panel">
      <h3>Create account</h3>
      <div class="field"><label>First name</label><input type="text" name="firstName" required></div>
      <div class="field"><label>Last name</label><input type="text" name="lastName" required></div>
      <div class="field"><label>Email</label><input type="email" name="email" required></div>
      <div class="field"><label>Password</label><input type="password" name="password" required></div>
      <p class="small" style="margin-top:-6px">At least 8 characters, one uppercase letter, one number.</p>
      <button class="btn" type="submit">Create account</button>
    </form>
    <p class="small"><strong>Demo customer:</strong> lerato.m@gmail.com / Password1</p>
  `;

  const errBox = document.getElementById('auth-error');
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.innerHTML = '';
    const fd = new FormData(e.target);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier: fd.get('identifier'), password: fd.get('password') } });
      if (user.type !== 'customer') throw new Error('The mobile app is for customer accounts. Staff should use the desktop website.');
      setSession(token, user);
      await refreshCartCount();
      location.hash = next ? '#' + next : '#/shop';
    } catch (err) { errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`; }
  });
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.innerHTML = '';
    const fd = new FormData(e.target);
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: Object.fromEntries(fd.entries()) });
      setSession(token, user);
      await refreshCartCount();
      toast('Welcome, ' + user.name.split(' ')[0] + '!', 'success');
      location.hash = next ? '#' + next : '#/shop';
    } catch (err) { errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`; }
  });
}
