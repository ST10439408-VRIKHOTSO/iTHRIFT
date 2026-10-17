'use strict';

/* =========================================================================
   iTHRIFT Clothes: desktop website
   Single-file vanilla JS front end. Talks only to the shared REST API at
   /api, the same API the mobile PWA in /mobile uses. No build step,
   no framework: HTML5, CSS3 and JavaScript, as specified in the System
   Design document's technology stack.
   ========================================================================= */

const state = {
  token: localStorage.getItem('ithrift_token') || null,
  user: JSON.parse(localStorage.getItem('ithrift_user') || 'null'),
  cartCount: 0,
  wishlist: new Set(),
  brands: [],
  categories: [],
};

function setSession(token, user) {
  state.token = token;
  state.user = user;
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
  try { data = await res.json(); } catch (_) { /* empty body */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  return 'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** The price, with the old price struck through when the piece is on sale. */
function priceHtml(p, cls = 'price') {
  return `<span class="${cls}">${money(p.price)}</span>${p.onSale ? `<span class="price-was"><span class="visually-hidden">Was </span>${money(p.originalPrice)}</span>` : ''}`;
}

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

/** A Save button for the wishlist. Wired up by bindWishButtons(). */
function wishButton(productId, compact = false) {
  const saved = state.wishlist.has(Number(productId));
  return `<button type="button" class="wish-btn" data-wish="${productId}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from wishlist' : 'Save to wishlist'}">${HEART_SVG}${compact ? '' : `<span>${saved ? 'Saved' : 'Save'}</span>`}</button>`;
}

function bindWishButtons(root, onChange) {
  root.querySelectorAll('[data-wish]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!requireLogin(location.hash.replace(/^#/, '') || '/shop')) return;
    if (state.user.type !== 'customer') return toast('Only customer accounts have a wishlist.', 'error');
    const id = Number(btn.dataset.wish);
    const saved = state.wishlist.has(id);
    btn.disabled = true;
    try {
      const data = saved
        ? await api(`/wishlist/${id}`, { method: 'DELETE' })
        : await api('/wishlist', { method: 'POST', body: { productId: id } });
      state.wishlist = new Set(data.items.map(i => i.productId));
      const now = state.wishlist.has(id);
      root.querySelectorAll(`[data-wish="${id}"]`).forEach(b => {
        b.setAttribute('aria-pressed', String(now));
        b.setAttribute('aria-label', now ? 'Remove from wishlist' : 'Save to wishlist');
        const label = b.querySelector('span');
        if (label) label.textContent = now ? 'Saved' : 'Save';
      });
      toast(now ? 'Saved to your wishlist.' : 'Removed from your wishlist.', 'success');
      renderNav();
      if (onChange) onChange();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }));
}

function conditionClass(condition) {
  return String(condition).toLowerCase().replace(/\s+/g, '-');
}

function statusClass(status) {
  return 'status-' + String(status).toLowerCase();
}

function timeAgo(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

let toastTimer = null;
function toast(message, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

function requireLogin(redirectTo) {
  if (!state.user) {
    location.hash = '#/login?next=' + encodeURIComponent(redirectTo);
    return false;
  }
  return true;
}

function parseHashQuery() {
  const idx = location.hash.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(location.hash.slice(idx + 1));
  return Object.fromEntries(params.entries());
}

function buildHash(route, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString();
  return '#/' + route + (qs ? '?' + qs : '');
}

async function refreshCartCount() {
  if (!state.user || state.user.type !== 'customer') { state.cartCount = 0; state.wishlist = new Set(); return; }
  try {
    const [cart, wish] = await Promise.all([api('/cart'), api('/wishlist')]);
    state.cartCount = cart.itemCount;
    state.wishlist = new Set(wish.items.map(i => i.productId));
  } catch (_) {
    state.cartCount = 0;
  }
}

/* ---------------------------- Navigation ---------------------------- */

function renderNav() {
  const nav = document.getElementById('topnav-inner');
  const isStaff = state.user && (state.user.type === 'admin' || state.user.type === 'staff');

  const links = `
    <a href="${buildHash('shop')}" data-route="shop">Shop</a>
    <a href="${buildHash('shop', { onSale: 'true' })}" data-route="sale">Sale</a>
    <a href="#/about" data-route="about">About Us</a>
    ${isStaff ? `<a href="#/admin" data-route="admin">Admin</a>` : ''}
  `;

  const actions = state.user
    ? `
      ${state.user.type === 'customer' ? `
        <a class="pill-btn" href="#/wishlist">Wishlist${state.wishlist.size ? `<span class="cart-badge">${state.wishlist.size}</span>` : ''}</a>
        <a class="pill-btn" href="#/orders">My Orders</a>
        <a class="pill-btn dark" href="#/cart">Cart${state.cartCount ? `<span class="cart-badge">${state.cartCount}</span>` : ''}</a>
      ` : `<span class="small">Signed in as <strong>${escapeHtml(state.user.name)}</strong> &middot; <span class="badge role-${state.user.type}">${state.user.type}</span></span>`}
      <a class="pill-btn" href="#/account">Account</a>
    `
    : `
      <a class="pill-btn" href="#/login">&#8594; Login</a>
      <a class="pill-btn dark" href="#/register">&#43; Register</a>
    `;

  nav.innerHTML = `
    <a class="logo" href="#/shop"><span class="badge-mark">i</span><span>iTHRIFT</span></a>
    <div class="nav-links">${links}</div>
    <div class="nav-actions">${actions}</div>
  `;

  let currentRoute = (location.hash.replace(/^#\/?/, '').split(/[?/]/)[0]) || 'shop';
  if (currentRoute === 'shop' && parseHashQuery().onSale === 'true') currentRoute = 'sale';
  nav.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === currentRoute) a.classList.add('active');
  });
}

/* ------------------------------ Router ------------------------------ */

async function loadLookups() {
  if (state.brands.length && state.categories.length) return;
  const [b, c] = await Promise.all([api('/products/brands'), api('/products/categories')]);
  state.brands = b.brands;
  state.categories = c.categories;
}

async function router() {
  const view = document.getElementById('view');
  const hashPath = location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = hashPath.split('/').filter(Boolean);
  const query = parseHashQuery();

  view.innerHTML = '<div class="container section center small">Loading&hellip;</div>';

  try {
    await loadLookups();
    await refreshCartCount();

    if (parts.length === 0 || parts[0] === 'shop') await renderShop(view, query);
    else if (parts[0] === 'product') await renderProductDetail(view, parts[1]);
    else if (parts[0] === 'cart') await renderCartView(view);
    else if (parts[0] === 'checkout') await renderCheckout(view);
    else if (parts[0] === 'order-confirmation') await renderOrderConfirmation(view, parts[1]);
    else if (parts[0] === 'orders' && parts[1]) await renderOrderDetail(view, parts[1]);
    else if (parts[0] === 'orders') await renderOrdersList(view);
    else if (parts[0] === 'login') renderLogin(view, query.next);
    else if (parts[0] === 'register') renderRegister(view, query.next);
    else if (parts[0] === 'account') renderAccount(view);
    else if (parts[0] === 'wishlist') await renderWishlist(view);
    else if (parts[0] === 'addresses') await renderAddresses(view);
    else if (parts[0] === 'returns') await renderMyReturns(view);
    else if (parts[0] === 'about') renderAbout(view);
    else if (parts[0] === 'admin') await renderAdmin(view, parts[1], query);
    else view.innerHTML = `<div class="container section center"><h2>Page not found</h2><a class="pill-btn dark" href="#/shop">Back to shop</a></div>`;
  } catch (err) {
    view.innerHTML = `<div class="container section"><div class="form-error">${escapeHtml(err.message)}</div></div>`;
  }

  renderNav();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
