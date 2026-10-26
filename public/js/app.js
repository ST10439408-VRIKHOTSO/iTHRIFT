'use strict';

/* =========================================================================
   iTHRIFT Clothes website, release 1.3.0
   Vanilla JavaScript, no build step, as in the original system design. The
   site talks only to the shared REST API at /api, the same API the Android
   application and the installable web app use.

   This file holds what every screen shares: session state, the API helper,
   formatting, the shared UI pieces (toasts, sheets, dialogs, product cards,
   the condition meter), the theme, the header with instant search, and the
   router. The screens themselves live in views-*.js.
   ========================================================================= */

/* ----------------------------- Storage ----------------------------- */

// Browser storage can be missing or blocked (private windows, strict
// settings), so every read and write is guarded and the site still works.
const store = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch (_) { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* storage unavailable */ } },
  remove(k) { try { localStorage.removeItem(k); } catch (_) { /* storage unavailable */ } },
  json(k, fallback) { try { return JSON.parse(this.get(k)) ?? fallback; } catch (_) { return fallback; } },
  setJson(k, v) { this.set(k, JSON.stringify(v)); },
};

/* ----------------------------- State ----------------------------- */

const state = {
  token: store.get('ithrift_token'),
  user: store.json('ithrift_user', null),
  cartCount: 0,
  wishlist: new Set(),
  unread: 0,
  brands: [],
  categories: [],
  sizes: [],
  options: null,
};

const isCustomer = () => Boolean(state.user && state.user.type === 'customer');
const isStaff = () => Boolean(state.user && (state.user.type === 'staff' || state.user.type === 'admin'));
const isAdmin = () => Boolean(state.user && state.user.type === 'admin');

function setSession(token, user) {
  state.token = token;
  state.user = user;
  if (token) {
    store.set('ithrift_token', token);
    store.setJson('ithrift_user', user);
  } else {
    store.remove('ithrift_token');
    store.remove('ithrift_user');
    state.cartCount = 0;
    state.unread = 0;
    state.wishlist = new Set();
  }
}

/* ----------------------------- API ----------------------------- */

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (_) {
    throw new ApiError('Could not reach iTHRIFT. Check your connection and try again.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch (_) { /* empty body */ }
  if (res.status === 401 && state.token) {
    // The server no longer knows this session (for example after a restart).
    setSession(null, null);
    renderChrome();
    toast('Your session ended. Sign in again to carry on.', 'error', { label: 'Sign in', href: '#/login?next=' + encodeURIComponent(currentPath()) });
  }
  if (!res.ok) throw new ApiError(data.error || `Something went wrong (${res.status}).`, res.status);
  return data;
}

/* ----------------------------- Formatting ----------------------------- */

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Rand amounts formatted by hand (R1,647 and R239.61) so every browser shows the same thing. */
function groupThousands(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function money(n, { cents = false } = {}) {
  const v = Number(n) || 0;
  const neg = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const showCents = cents || !Number.isInteger(Math.round(abs * 100) / 100);
  const [whole, frac] = abs.toFixed(showCents ? 2 : 0).split('.');
  return neg + 'R' + groupThousands(whole) + (frac ? '.' + frac : '');
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; }

function parseDate(iso) {
  if (!iso) return null;
  const s = String(iso);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
}

function dateLabel(iso, opts = {}) {
  const d = parseDate(iso);
  if (!d) return '';
  // Built by hand so every browser shows the same "Tue 7 Oct 2026" shape.
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${opts.weekday ? W[d.getDay()] + ' ' : ''}${d.getDate()} ${M[d.getMonth()]}${opts.year === false ? '' : ' ' + d.getFullYear()}`;
}

function timeLabel(iso) {
  const d = parseDate(iso);
  return d ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';
}

function timeAgo(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return dateLabel(iso, { year: d.getFullYear() !== new Date().getFullYear() ? undefined : false });
}

function statusClass(status) { return 'status-' + String(status).toLowerCase().replace(/\s+/g, '-'); }

/* ----------------------------- Routing helpers ----------------------------- */

function currentPath() { return location.hash.replace(/^#/, '') || '/'; }

function parseQuery() {
  const idx = location.hash.indexOf('?');
  if (idx === -1) return {};
  return Object.fromEntries(new URLSearchParams(location.hash.slice(idx + 1)).entries());
}

function hashFor(route, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  return '#/' + route.replace(/^\//, '') + (qs ? '?' + qs : '');
}

function go(hash) { if (location.hash === hash) router(); else location.hash = hash; }

/** Sends a signed-out visitor to sign in, returning here after. */
function requireLogin(path = currentPath()) {
  if (state.user) return true;
  location.hash = '#/login?next=' + encodeURIComponent(path);
  return false;
}

function requireCustomer(view) {
  if (!requireLogin()) return false;
  if (!isCustomer()) {
    view.innerHTML = emptyState({ icon: 'lock', title: 'Customer accounts only', text: 'Staff and administrator accounts do not shop. Sign in with a customer account to see this.', actions: `<a class="btn btn-primary" href="#/admin">Go to the staff console</a>` });
    return false;
  }
  return true;
}

/* ----------------------------- UI: toasts ----------------------------- */

function toast(message, type = '', action = null) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const ic = type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'info';
  el.innerHTML = `${icon(ic, { size: 18 })}<span>${esc(message)}</span>${action ? (action.href ? `<a href="${action.href}">${esc(action.label)}</a>` : `<button type="button">${esc(action.label)}</button>`) : ''}`;
  if (action && action.onClick) el.querySelector('button').addEventListener('click', () => { action.onClick(); dismiss(); });
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  let gone = false;
  function dismiss() {
    if (gone) return;
    gone = true;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }
  setTimeout(dismiss, action ? 6000 : 3600);
  return dismiss;
}

/* ----------------------------- UI: sheets and dialogs ----------------------------- */

let openSheets = [];

/**
 * Opens a sheet: a side panel on desktop (or a centred dialog), a bottom
 * sheet on phones. Focus moves into it, Escape and the scrim close it, and
 * focus returns to whatever opened it.
 */
function openSheet({ title, body, foot = '', variant = 'side', label, onClose } = {}) {
  const opener = document.activeElement;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet' + (variant === 'side' ? '' : ' center') + (variant === 'wide' ? ' wide' : '');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const titleId = 'sheet-title-' + Math.random().toString(36).slice(2, 8);
  sheet.setAttribute('aria-labelledby', titleId);
  sheet.innerHTML = `
    <div class="sheet-head"><h2 id="${titleId}" style="font-size:1.125rem">${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close${label ? ' ' + esc(label) : ''}">${icon('x')}</button></div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  document.body.append(scrim, sheet);
  document.body.style.overflow = 'hidden';

  const api = {
    el: sheet,
    close() {
      scrim.remove();
      sheet.remove();
      openSheets = openSheets.filter((s) => s !== api);
      if (!openSheets.length) document.body.style.overflow = '';
      if (opener && opener.focus && document.contains(opener)) opener.focus();
      if (onClose) onClose();
    },
  };
  openSheets.push(api);
  scrim.addEventListener('click', api.close);
  sheet.querySelector('[data-close]').addEventListener('click', api.close);
  sheet.addEventListener('keydown', (e) => trapFocus(e, sheet));
  const first = sheet.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button, .sheet-body a') || sheet.querySelector('[data-close]');
  setTimeout(() => first && first.focus(), 30);
  return api;
}

function trapFocus(e, el) {
  if (e.key !== 'Tab') return;
  const items = [...el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/** A yes or no question. Resolves true when confirmed. */
function confirmDialog({ title, body = '', confirmLabel = 'Confirm', cancelLabel = 'Keep it', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet({
      title, variant: 'center',
      body: `<p class="muted" style="margin:0">${body}</p>`,
      foot: `<button type="button" class="btn btn-secondary" data-no>${esc(cancelLabel)}</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmLabel)}</button>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    s.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; resolve(false); s.close(); });
    s.el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; resolve(true); s.close(); });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openSheets.length) openSheets[openSheets.length - 1].close();
});

/** Shows a spinner on a button while an action runs, and puts the label back after. */
async function busy(btn, fn, busyLabel) {
  if (!btn || btn.disabled) return;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `${icon('loader-circle', { cls: 'spin', size: 16 })}<span>${esc(busyLabel || 'Working')}</span>`;
  try { return await fn(); } finally {
    if (document.contains(btn)) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = label; }
  }
}

/** Puts an error under a form field and marks the field invalid. */
function fieldError(form, name, message) {
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) return;
  input.setAttribute('aria-invalid', 'true');
  const id = `${name}-err`;
  let el = form.querySelector('#' + id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'field-error';
    el.id = id;
    (input.closest('.field') || input.parentElement).appendChild(el);
  }
  el.innerHTML = `${icon('circle-alert', { size: 14 })}<span>${esc(message)}</span>`;
  input.setAttribute('aria-describedby', id);
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((e) => e.remove());
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const box = form.querySelector('[data-form-error]');
  if (box) box.innerHTML = '';
}

function formError(form, message) {
  const box = form.querySelector('[data-form-error]');
  if (box) box.innerHTML = `<div class="callout bad" role="alert" style="margin-bottom:16px">${icon('circle-alert', { size: 18 })}<p>${esc(message)}</p></div>`;
  else toast(message, 'error');
}

/* ----------------------------- UI: shared pieces ----------------------------- */

const CONDITIONS = {
  Excellent: { level: 4, meaning: 'As new. No visible wear.' },
  'Very Good': { level: 3, meaning: 'Lightly worn. No marks.' },
  Good: { level: 2, meaning: 'Worn. Small marks or fading, noted in the description.' },
  Fair: { level: 1, meaning: 'Visible wear, priced to match.' },
};

/** The four-step condition meter. */
function conditionMeter(condition, { large = false, label = true } = {}) {
  const c = CONDITIONS[condition] || { level: 0 };
  return `<span class="meter${large ? ' lg' : ''}" data-level="${c.level}" title="${esc(condition)}: ${esc(c.meaning || '')}">
    <span class="meter-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${label ? `<span>${esc(condition)}</span>` : `<span class="visually-hidden">${esc(condition)}</span>`}</span>`;
}

function priceHtml(p, { large = false } = {}) {
  if (p.onSale) {
    return `<span class="price sale">${money(p.price)}</span><span class="price-was"><span class="visually-hidden">was </span>${money(p.originalPrice)}</span>`;
  }
  return `<span class="price">${money(p.price)}</span>`;
}

function stars(rating, size = 14) {
  let out = '';
  for (let i = 1; i <= 5; i++) out += icon('star', { size, cls: i <= Math.round(rating) ? '' : 'empty' });
  return `<span class="stars" role="img" aria-label="${rating} out of 5">${out}</span>`;
}

function productCard(p) {
  const saved = state.wishlist.has(p.id);
  const comparing = compare.has(p.id);
  const sizes = p.inStock ? (p.sizes.length > 3 ? `${p.sizes.length} sizes` : p.sizes.map((s) => s.size).join(', ')) : '';
  return `
    <article class="card" data-product="${p.id}">
      <div class="card-media">
        <img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0">
        ${p.inStock ? '' : '<div class="sold-veil"><span>Sold out</span></div>'}
        ${p.onSale && p.inStock ? `<div class="card-tag"><span class="pill sale">${p.percentOff}% off</span></div>` : ''}
      </div>
      <div class="card-actions">
        ${!isStaff() ? `<button type="button" class="round-btn" data-wish="${p.id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(p.name)} ${saved ? 'from' : 'to'} your wishlist">${icon('heart', { size: 18 })}</button>` : ''}
        <button type="button" class="round-btn compare-on" data-compare="${p.id}" aria-pressed="${comparing}" aria-label="${comparing ? 'Remove' : 'Add'} ${esc(p.name)} ${comparing ? 'from' : 'to'} compare">${icon('columns-3', { size: 18 })}</button>
      </div>
      <div class="card-body">
        <span class="card-brand">${esc(p.brand)}</span>
        <h3 class="card-name" style="font-size:inherit;font-weight:500;letter-spacing:0"><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
        <div class="card-foot"><span>${priceHtml(p)}</span>${conditionMeter(p.condition, { label: false })}</div>
        ${sizes ? `<span class="card-sizes">${p.sizes.length === 1 ? 'Size ' : ''}${esc(sizes)}</span>` : ''}
      </div>
    </article>`;
}

function skeletonGrid(n = 8) {
  return `<div class="grid" aria-hidden="true">${Array.from({ length: n }, () => '<div class="skel-card"><div class="skel"></div><div class="skel skel-line w40"></div><div class="skel skel-line w80"></div><div class="skel skel-line w60"></div></div>').join('')}</div>`;
}

function skeletonPage() {
  return `<div class="container page" aria-busy="true" aria-label="Loading"><div class="skel" style="height:32px;width:240px;margin-bottom:24px"></div><div class="skel skel-block"></div><div class="skel skel-block" style="margin-top:16px"></div></div>`;
}

function emptyState({ icon: ic = 'inbox', title, text = '', actions = '' }) {
  return `<div class="empty"><div class="empty-icon">${icon(ic, { size: 28 })}</div><h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}${actions ? `<div class="row wrap">${actions}</div>` : ''}</div>`;
}

function errorState(err, retry = true) {
  const offline = err && err.status === 0;
  return emptyState({
    icon: offline ? 'refresh-cw' : 'circle-alert',
    title: offline ? 'You seem to be offline' : 'This page did not load',
    text: esc(err && err.message ? err.message : 'Something went wrong.'),
    actions: retry ? `<button type="button" class="btn btn-primary" onclick="router()">Try again</button><a class="btn btn-secondary" href="#/">Go to the shop</a>` : '',
  });
}

function setTitle(t) { document.title = t ? `${t} | iTHRIFT Clothes` : 'iTHRIFT Clothes: pre-loved branded fashion, Pretoria'; }

/* ----------------------------- Wishlist and compare buttons ----------------------------- */

async function toggleWish(id, btn) {
  if (!requireLogin()) return;
  if (!isCustomer()) return toast('Only customer accounts have a wishlist.', 'error');
  const saved = state.wishlist.has(id);
  try {
    const data = saved ? await api(`/wishlist/${id}`, { method: 'DELETE' }) : await api('/wishlist', { method: 'POST', body: { productId: id } });
    state.wishlist = new Set(data.items.map((i) => i.productId));
    const now = state.wishlist.has(id);
    document.querySelectorAll(`[data-wish="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(now));
      const lbl = b.querySelector('[data-wish-label]');
      if (lbl) lbl.textContent = now ? 'Saved' : 'Save';
      b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^(Save|Remove)/, now ? 'Remove' : 'Save').replace(/ (to|from) your wishlist/, now ? ' from your wishlist' : ' to your wishlist'));
    });
    toast(now ? 'Saved to your wishlist. We will tell you if the price drops.' : 'Removed from your wishlist.', 'success', now ? { label: 'View', href: '#/wishlist' } : null);
    renderChrome();
  } catch (err) { toast(err.message, 'error'); }
}

/** Compare holds up to three pieces, per browser. */
const compare = {
  ids() { return store.json('ithrift_compare', []).filter(Number.isInteger).slice(0, 3); },
  has(id) { return this.ids().includes(id); },
  toggle(id) {
    let ids = this.ids();
    if (ids.includes(id)) ids = ids.filter((x) => x !== id);
    else {
      if (ids.length >= 3) { toast('You can compare three pieces at a time. Remove one first.', 'error'); return false; }
      ids.push(id);
    }
    store.setJson('ithrift_compare', ids);
    document.querySelectorAll(`[data-compare="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(ids.includes(id))));
    renderCompareTray();
    return true;
  },
  clear() { store.setJson('ithrift_compare', []); document.querySelectorAll('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', 'false')); renderCompareTray(); },
};

let compareCache = new Map();
async function renderCompareTray() {
  let tray = document.getElementById('compare-tray');
  const ids = compare.ids();
  if (!ids.length || currentPath().startsWith('/compare') || currentPath().startsWith('/admin') || currentPath().startsWith('/checkout')) { if (tray) tray.remove(); return; }
  const missing = ids.filter((id) => !compareCache.has(id));
  if (missing.length) {
    try { (await api('/products/by-ids?ids=' + missing.join(','))).products.forEach((p) => compareCache.set(p.id, p)); } catch (_) { /* tray still works without thumbnails */ }
  }
  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'compare-tray';
    tray.className = 'compare-tray';
    tray.setAttribute('role', 'region');
    tray.setAttribute('aria-label', 'Compare');
    document.body.appendChild(tray);
  }
  tray.innerHTML = `<div class="thumbs">${ids.map((id) => compareCache.get(id) ? `<img src="${esc(compareCache.get(id).image)}" alt="${esc(compareCache.get(id).name)}">` : '').join('')}</div>
    <span class="small">${ids.length} of 3</span>
    <a class="btn btn-sm" href="#/compare">Compare</a>
    <button type="button" class="icon-btn" aria-label="Clear compare">${icon('x', { size: 18 })}</button>`;
  tray.querySelector('button').addEventListener('click', () => compare.clear());
}

// One listener handles every wishlist and compare button on any screen.
document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-wish]');
  if (w) { e.preventDefault(); toggleWish(Number(w.dataset.wish), w); return; }
  const c = e.target.closest('[data-compare]');
  if (c) {
    e.preventDefault();
    const id = Number(c.dataset.compare);
    const adding = !compare.has(id);
    if (compare.toggle(id) && adding && compare.ids().length >= 2) toast('Added to compare.', 'success', { label: 'Compare now', href: '#/compare' });
  }
});

/* ----------------------------- Recently viewed ----------------------------- */

const recent = {
  ids() { return store.json('ithrift_recent', []).filter(Number.isInteger); },
  add(id) { store.setJson('ithrift_recent', [id, ...this.ids().filter((x) => x !== id)].slice(0, 12)); },
  clear() { store.setJson('ithrift_recent', []); },
};

/* ----------------------------- Theme and accessibility ----------------------------- */

const prefs = {
  theme() { return store.get('ithrift_theme', 'system'); },
  setTheme(v) { store.set('ithrift_theme', v); applyTheme(); },
  textLarge() { return store.get('ithrift_text') === 'large'; },
  setTextLarge(on) { if (on) store.set('ithrift_text', 'large'); else store.remove('ithrift_text'); document.documentElement.classList.toggle('text-large', on); },
  reduceMotion() { return store.get('ithrift_motion') === 'reduce'; },
  setReduceMotion(on) { if (on) store.set('ithrift_motion', 'reduce'); else store.remove('ithrift_motion'); document.documentElement.classList.toggle('reduce-motion', on); },
};

const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = prefs.theme();
  const dark = t === 'dark' || (t === 'system' && darkQuery && darkQuery.matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme);

/* ----------------------------- Instant search ----------------------------- */

const recentSearches = {
  list() { return store.json('ithrift_searches', []).slice(0, 8); },
  add(q) { if (q) store.setJson('ithrift_searches', [q, ...this.list().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)); },
  clear() { store.setJson('ithrift_searches', []); },
};

/**
 * Turns a text input into a search box with live suggestions: products,
 * brands and categories as you type, recent searches when empty. Arrow keys
 * move through the list, Enter opens the highlighted row or searches,
 * Escape closes it.
 */
function attachSearch(input, { inline = false } = {}) {
  const wrap = input.closest('.search-field');
  const listId = 'suggest-' + Math.random().toString(36).slice(2, 8);
  let box = null;
  let items = [];
  let active = -1;
  let timer = null;
  let seq = 0;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);

  const close = () => { if (box) { box.remove(); box = null; } input.setAttribute('aria-expanded', 'false'); active = -1; };
  const submit = (q) => {
    q = (q || '').trim();
    close();
    recentSearches.add(q);
    input.blur();
    go(hashFor('shop', q ? { q } : {}));
  };

  function draw(html) {
    if (!box) {
      box = document.createElement('div');
      box.className = 'suggest';
      box.id = listId;
      box.setAttribute('role', 'listbox');
      wrap.appendChild(box);
      input.setAttribute('aria-expanded', 'true');
    }
    box.innerHTML = html;
    items = [...box.querySelectorAll('.suggest-item')];
    items.forEach((el, i) => {
      el.id = `${listId}-${i}`;
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', () => activate(el));
    });
    const clr = box.querySelector('[data-clear-recent]');
    if (clr) clr.addEventListener('mousedown', (e) => { e.preventDefault(); recentSearches.clear(); showRecent(); });
    active = -1;
  }

  function activate(el) {
    if (el.dataset.href) { close(); input.blur(); go(el.dataset.href); }
    else submit(el.dataset.q);
  }

  function showRecent() {
    const list = recentSearches.list();
    if (!list.length) { close(); return; }
    draw(`<div class="suggest-group"><div class="suggest-title"><span>Recent searches</span><button type="button" data-clear-recent>Clear</button></div>
      ${list.map((q) => `<button type="button" class="suggest-item" role="option" data-q="${esc(q)}">${icon('clock', { size: 16 })}<span>${esc(q)}</span></button>`).join('')}</div>`);
  }

  async function lookup(q) {
    const mine = ++seq;
    let data;
    try { data = await api('/products/suggest?q=' + encodeURIComponent(q)); } catch (_) { return; }
    if (mine !== seq || document.activeElement !== input) return;
    const groups = [];
    if (data.products.length) {
      groups.push(`<div class="suggest-group"><div class="suggest-title"><span>Pieces</span></div>${data.products.map((p) => `
        <button type="button" class="suggest-item" role="option" data-href="#/product/${p.id}"><img src="${esc(p.image)}" alt=""><span><span class="faint tiny">${esc(p.brand)}</span><br>${esc(p.name)}</span><span class="price">${p.inStock ? money(p.price) : 'Sold out'}</span></button>`).join('')}</div>`);
    }
    const quick = [...data.brands.map((b) => ['Brand', b, hashFor('shop', { brand: b })]), ...data.categories.map((c) => ['Category', c, hashFor('shop', { category: c })])];
    if (quick.length) {
      groups.push(`<div class="suggest-group"><div class="suggest-title"><span>Brands and categories</span></div>${quick.map(([kind, name, href]) => `
        <button type="button" class="suggest-item" role="option" data-href="${href}">${icon(kind === 'Brand' ? 'tag' : 'layers', { size: 16 })}<span>${esc(name)}</span><span class="price small">${kind}</span></button>`).join('')}</div>`);
    }
    groups.push(`<div class="suggest-group"><button type="button" class="suggest-item" role="option" data-q="${esc(q)}">${icon('search', { size: 16 })}<span>Search for &ldquo;${esc(q)}&rdquo;</span></button></div>`);
    draw(groups.join(''));
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { showRecent(); return; }
    timer = setTimeout(() => lookup(q), 160);
  });
  input.addEventListener('focus', () => { if (!input.value.trim()) showRecent(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && items[active]) activate(items[active]);
      else submit(input.value);
    } else if (e.key === 'Escape') {
      if (box) { e.stopPropagation(); close(); } else input.blur();
    }
  });
  return { close };
}

// Press "/" anywhere to jump to search.
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const input = document.querySelector('.site-header .search-input');
  if (input && input.offsetParent !== null) { e.preventDefault(); input.focus(); }
  else if (!openSheets.length) { e.preventDefault(); go('#/search'); }
});

/* ----------------------------- Header and tab bar ----------------------------- */

function routeKey() {
  const p = currentPath().split('?')[0];
  const q = parseQuery();
  if (p === '/' ) return 'home';
  if (p.startsWith('/shop')) return q.onSale === 'true' ? 'sale' : 'shop';
  return p.split('/')[1] || 'home';
}

function renderChrome() {
  const header = document.getElementById('header');
  const key = routeKey();
  const cur = (k) => (key === k ? ' aria-current="page"' : '');
  const badge = (n, alert) => (n ? `<span class="count-badge${alert ? ' alert' : ''}">${n > 99 ? '99+' : n}</span>` : '');
  const customer = isCustomer();
  const staff = isStaff();

  // Keep the search box (and what is typed in it) across re-renders.
  const existing = header.querySelector('.search-input');
  const keepValue = existing ? existing.value : '';
  const hadFocus = existing && document.activeElement === existing;

  header.innerHTML = `
    <a class="logo" href="#/" aria-label="iTHRIFT home"><span class="logo-mark" aria-hidden="true">i</span><span>iTHRIFT</span></a>
    <nav class="main-nav" aria-label="Sections">
      <a href="#/shop"${cur('shop')}>Shop</a>
      <a href="#/shop?onSale=true"${cur('sale')}>Sale</a>
      <a href="#/sell"${cur('sell')}>Sell to us</a>
      <a href="#/help"${cur('help')}>Help</a>
      ${staff ? `<a href="#/admin"${cur('admin')}>Console</a>` : ''}
    </nav>
    <div class="header-search only-desktop">
      <div class="search-field">${icon('search', { size: 18 })}
        <input class="search-input" type="search" placeholder="Search brands and pieces" aria-label="Search the shop" autocomplete="off" value="${esc(keepValue)}">
        <kbd class="search-key" aria-hidden="true">/</kbd>
      </div>
    </div>
    <div class="header-actions">
      <a class="icon-btn only-mobile" href="#/search" aria-label="Search"${cur('search')}>${icon('search')}</a>
      ${!staff ? `<a class="icon-btn only-desktop" href="#/wishlist" aria-label="Wishlist${state.wishlist.size ? `, ${state.wishlist.size} saved` : ''}"${cur('wishlist')}>${icon('heart')}${badge(state.wishlist.size)}</a>` : ''}
      ${customer ? `<a class="icon-btn" href="#/notifications" aria-label="Notifications${state.unread ? `, ${state.unread} unread` : ''}"${cur('notifications')}>${icon('bell')}${badge(state.unread, true)}</a>` : ''}
      ${!staff ? `<a class="icon-btn only-desktop" href="#/cart" aria-label="Bag${state.cartCount ? `, ${state.cartCount} items` : ''}"${cur('cart')}>${icon('shopping-bag')}${badge(state.cartCount)}</a>` : ''}
      ${state.user
        ? `<a class="icon-btn only-desktop" href="${staff ? '#/admin' : '#/account'}" aria-label="${staff ? 'Staff console' : 'Your account'}"${cur(staff ? 'admin' : 'account')}>${icon(staff ? 'clipboard-list' : 'user')}</a>`
        : `<a class="btn btn-secondary btn-sm header-signin only-desktop" href="#/login">Sign in</a><a class="icon-btn only-mobile" href="#/login" aria-label="Sign in">${icon('user')}</a>`}
    </div>`;
  const input = header.querySelector('.search-input');
  attachSearch(input);
  if (hadFocus) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }

  const tab = (href, k, ic, label, count) => `<a href="${href}"${cur(k)}>${icon(ic, { size: 22 })}<span>${label}</span>${badge(count)}</a>`;
  document.getElementById('tabbar').innerHTML = staff
    ? tab('#/', 'home', 'house', 'Shop') + tab('#/search', 'search', 'search', 'Search') + tab('#/admin', 'admin', 'clipboard-list', 'Console') + tab('#/admin/orders', 'orders-staff', 'package', 'Orders') + tab('#/account', 'account', 'user', 'Account')
    : tab('#/', 'home', 'house', 'Shop') + tab('#/search', 'search', 'search', 'Search') + tab('#/cart', 'cart', 'shopping-bag', 'Bag', state.cartCount) + tab('#/orders', 'orders', 'package', 'Orders') + tab(state.user ? '#/account' : '#/login', state.user ? 'account' : 'login', 'user', state.user ? 'Account' : 'Sign in');
}

/* ----------------------------- Shared data ----------------------------- */

async function loadLookups() {
  if (state.brands.length && state.categories.length && state.sizes.length) return;
  const [b, c, s] = await Promise.all([api('/products/brands'), api('/products/categories'), api('/products/sizes')]);
  state.brands = b.brands;
  state.categories = c.categories;
  state.sizes = s.sizes;
}

async function loadOptions() {
  if (!state.options) state.options = await api('/orders/options');
  return state.options;
}

/** Cart count, wishlist and unread notifications for the header. */
async function refreshCounts() {
  if (!isCustomer()) { state.cartCount = 0; state.unread = 0; return; }
  try {
    const [cart, wish, unread] = await Promise.all([api('/cart'), api('/wishlist'), api('/notifications/unread-count')]);
    state.cartCount = cart.itemCount;
    state.wishlist = new Set(wish.items.map((i) => i.productId));
    state.unread = unread.unread;
  } catch (_) { /* the header just shows no counts */ }
}

// Keep the bell fresh while the tab is open.
setInterval(async () => {
  if (!isCustomer() || document.hidden) return;
  try {
    const { unread } = await api('/notifications/unread-count');
    if (unread !== state.unread) { state.unread = unread; renderChrome(); }
  } catch (_) { /* ignore */ }
}, 60000);

/* ----------------------------- Router ----------------------------- */

const routes = [];
function route(pattern, handler) { routes.push({ pattern, handler }); }

let lastPath = null;
async function router() {
  const view = document.getElementById('view');
  const [rawPath, anchor] = currentPath().split('?')[0].split('#');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const query = parseQuery();
  const samePage = lastPath === path;
  lastPath = path;

  if (openSheets.length) [...openSheets].forEach((s) => s.close());
  renderChrome();
  if (!samePage) view.innerHTML = skeletonPage();

  try {
    await Promise.all([loadLookups(), refreshCounts()]);
    const match = routes.map((r) => ({ r, m: path.match(r.pattern) })).find((x) => x.m);
    if (match) await match.r.handler(view, match.m.slice(1).map(decodeURIComponent), query);
    else {
      setTitle('Page not found');
      view.innerHTML = `<div class="container">${emptyState({ icon: 'search', title: 'That page does not exist', text: 'The link may be old, or the piece may have been removed.', actions: '<a class="btn btn-primary" href="#/">Go to the shop</a>' })}</div>`;
    }
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="container">${errorState(err)}</div>`;
  }

  renderChrome();
  renderCompareTray();
  if (!samePage) {
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    view.addEventListener('animationend', () => view.classList.remove('view-enter'), { once: true });
    window.scrollTo(0, 0);
    // Move keyboard and screen-reader focus to the new page.
    const h1 = view.querySelector('h1');
    if (h1 && document.activeElement && !document.activeElement.closest('.site-header')) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) { target.scrollIntoView({ block: 'start' }); if (target.tagName === 'DETAILS') target.open = true; }
  }
}

// Links to a section of the current page (href="#questions") scroll there
// instead of being treated as a route by the hash router.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').startsWith('#/') || a.getAttribute('href') === '#') return;
  const target = document.getElementById(a.getAttribute('href').slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ block: 'start', behavior: prefs.reduceMotion() ? 'auto' : 'smooth' });
  const field = target.querySelector('input, textarea');
  if (field) setTimeout(() => field.focus({ preventScroll: true }), 300);
});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  // A link to a section of the help page (#/help#returns) keeps working.
  router();
});
