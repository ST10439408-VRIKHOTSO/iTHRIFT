'use strict';

/* =========================================================================
   Staff console: dashboard and analytics, listings (with the size table
   and bulk markdowns), inventory, orders, store collections, returns,
   product questions, buy-back offers, the support inbox, promo codes and
   customers. Every action is also checked by the server; hiding a link
   here is a convenience, not the control.
   ========================================================================= */

const CONSOLE_SECTIONS = [
  { group: 'Overview' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart-column' },
  { group: 'Stock' },
  { key: 'listings', label: 'Listings', icon: 'tags' },
  { key: 'inventory', label: 'Inventory', icon: 'box' },
  { key: 'promos', label: 'Promo codes', icon: 'percent' },
  { group: 'Orders' },
  { key: 'orders', label: 'Orders', icon: 'package', count: 'processing' },
  { key: 'collections', label: 'Collections', icon: 'store', count: 'collectionsToday' },
  { key: 'returns', label: 'Returns', icon: 'rotate-ccw', count: 'returnsWaiting' },
  { group: 'Customers' },
  { key: 'support', label: 'Support inbox', icon: 'inbox', count: 'ticketsOpen' },
  { key: 'questions', label: 'Questions', icon: 'message-circle', count: 'questionsWaiting' },
  { key: 'sell', label: 'Buy-back offers', icon: 'hand-coins', count: 'sellWaiting' },
  { key: 'customers', label: 'Customers', icon: 'users', adminOnly: true },
];

async function consoleShell(view, section) {
  if (!requireLogin('/admin' + (section ? '/' + section : ''))) return null;
  if (!isStaff()) {
    view.innerHTML = `<div class="container">${emptyState({ icon: 'lock', title: 'Staff only', text: 'Sign in with a staff or administrator account to use the console.', actions: '<a class="btn btn-primary" href="#/login?next=%2Fadmin">Sign in</a>' })}</div>`;
    return null;
  }
  let attention = {};
  try { attention = (await api('/admin/reports/analytics')).attention; } catch (_) { /* counts are a nicety */ }
  view.innerHTML = `
    <div class="container">
      <div class="console">
        <nav class="console-nav" aria-label="Console">
          ${CONSOLE_SECTIONS.filter((s) => !s.adminOnly || isAdmin()).map((s) => s.group
            ? `<div class="nav-label">${esc(s.group)}</div>`
            : `<a href="#/admin/${s.key}"${s.key === section ? ' aria-current="page"' : ''}>${icon(s.icon, { size: 18 })}${esc(s.label)}${s.count && attention[s.count] ? `<span class="count">${attention[s.count]}</span>` : ''}</a>`).join('')}
        </nav>
        <div id="console-main" style="min-width:0"></div>
      </div>
    </div>`;
  return document.getElementById('console-main');
}

function consoleHead(title, sub = '', actions = '') {
  return `<div class="page-head"><div><h1 style="font-size:1.75rem">${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="row wrap">${actions}</div>` : ''}</div>`;
}

route(/^\/admin$/, async () => go('#/admin/dashboard'));

/* ----------------------------- Dashboard ----------------------------- */

function revenueChart(days) {
  // Daily revenue as columns: a day with no sales reads as an empty slot,
  // not as a line diving to zero.
  const w = 640; const h = 200; const pad = { l: 44, r: 4, t: 12, b: 26 };
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const step = max > 2000 ? 1000 : 500;
  const top = Math.ceil(max / step) * step;
  const slot = (w - pad.l - pad.r) / days.length;
  const y = (v) => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  const ticks = [0, top / 2, top];
  const best = days.reduce((m, d) => (d.revenue > m.revenue ? d : m), days[0]);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Revenue per day for the last 30 days. Best day ${dateLabel(best.day, { year: false })} with ${money(best.revenue)}.">
    ${ticks.map((t) => `<line class="grid-line" x1="${pad.l}" x2="${w - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-text" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? 'R' + (t / 1000) + 'k' : 'R' + t}</text>`).join('')}
    ${days.map((d, i) => (d.revenue ? `<rect class="col${d === best ? ' best' : ''}" x="${(pad.l + i * slot + slot * 0.18).toFixed(1)}" y="${y(d.revenue).toFixed(1)}" width="${(slot * 0.64).toFixed(1)}" height="${(y(0) - y(d.revenue)).toFixed(1)}" rx="3"><title>${dateLabel(d.day, { weekday: true, year: false })}: ${money(d.revenue)} from ${plural(d.orders, 'order')}</title></rect>` : '')).join('')}
    ${[0, 10, 20, 29].map((i) => `<text class="axis-text" x="${pad.l + i * slot + slot / 2}" y="${h - 6}" text-anchor="middle">${dateLabel(days[i].day, { year: false })}</text>`).join('')}
  </svg>`;
}

function barList(rows, valueFn, labelFn) {
  const max = Math.max(1, ...rows.map(valueFn));
  return `<div class="bars">${rows.map((r) => `<div class="bar-row"><span>${esc(r.name)}</span><span class="track"><i style="width:${Math.round((valueFn(r) / max) * 100)}%"></i></span><span class="v">${labelFn(r)}</span></div>`).join('')}</div>`;
}

route(/^\/admin\/dashboard$/, async (view) => {
  setTitle('Dashboard');
  const main = await consoleShell(view, 'dashboard');
  if (!main) return;
  const a = await api('/admin/reports/analytics');
  const delta = (now, before) => {
    if (!before) return now ? '<span class="up">New this month</span>' : '<span class="muted">No sales yet</span>';
    const pct = Math.round(((now - before) / before) * 100);
    return `<span class="${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on the 30 days before</span>`;
  };
  const att = a.attention;
  const item = (href, label, n, hot) => `<a href="${href}" class="${hot && n ? 'hot' : ''}"><span>${label}</span><strong>${n}</strong></a>`;
  main.innerHTML = `
    ${consoleHead('Dashboard', `Signed in as ${esc(state.user.name)}.`, `<button type="button" class="btn btn-secondary btn-sm" id="csv">${icon('download', { size: 16 })}Export orders (CSV)</button>`)}
    <h2 class="group-label" style="margin-top:0">Needs attention</h2>
    <div class="attention" style="margin-bottom:24px">
      ${item('#/admin/orders?status=Processing', 'Orders to pack', att.processing, true)}
      ${item('#/admin/collections', 'Collections today', att.collectionsToday, true)}
      ${item('#/admin/returns?status=Requested', 'Returns to decide', att.returnsWaiting, true)}
      ${item('#/admin/support', 'Open messages', att.ticketsOpen, true)}
      ${item('#/admin/questions', 'Unanswered questions', att.questionsWaiting, true)}
      ${item('#/admin/sell', 'Buy-back offers to action', att.sellWaiting, true)}
      ${item('#/admin/inventory', 'Sold out listings', att.outOfStock, false)}
      ${item('#/admin/inventory', 'Down to the last piece', att.lastOne, false)}
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Revenue, last 30 days</div><div class="stat-value">${money(a.last30.revenue)}</div><div class="stat-delta">${delta(a.last30.revenue, a.prev30.revenue)}</div></div>
      <div class="stat"><div class="stat-label">Orders, last 30 days</div><div class="stat-value">${a.last30.orders}</div><div class="stat-delta">${delta(a.last30.orders, a.prev30.orders)}</div></div>
      <div class="stat"><div class="stat-label">Average order</div><div class="stat-value">${money(a.averageOrderValue)}</div><div class="stat-delta muted">${plural(a.all.orders, 'order')} in total</div></div>
      <div class="stat"><div class="stat-label">Returned</div><div class="stat-value">${a.returnRate}%</div><div class="stat-delta muted">of ${plural(a.itemsSold, 'piece')} sold</div></div>
    </div>
    <section class="panel" aria-labelledby="rev-h"><div class="panel-title"><h2 id="rev-h" style="font-size:1.125rem">Revenue per day</h2><span class="small muted">Last 30 days, cancelled orders left out</span></div>${revenueChart(a.days)}</section>
    <div class="two-col even" style="margin-top:16px">
      <section class="panel" aria-labelledby="cat-h"><h2 id="cat-h" style="font-size:1.125rem;margin-bottom:16px">Sales by category</h2>${a.categories.length ? barList(a.categories, (r) => r.revenue, (r) => money(r.revenue)) : '<p class="muted">No sales yet.</p>'}</section>
      <section class="panel" aria-labelledby="brand-h"><h2 id="brand-h" style="font-size:1.125rem;margin-bottom:16px">Top brands</h2>${a.topBrands.length ? barList(a.topBrands, (r) => r.revenue, (r) => `${money(r.revenue)}`) : '<p class="muted">No sales yet.</p>'}</section>
    </div>
    <div class="two-col even" style="margin-top:16px">
      <section class="panel" aria-labelledby="pay-h"><h2 id="pay-h" style="font-size:1.125rem;margin-bottom:16px">How customers pay</h2>${barList(a.payments.map((p) => ({ ...p, name: { card: 'Card', payfast: 'PayFast', eft: 'EFT' }[p.method] })), (r) => r.count, (r) => plural(r.count, 'order'))}</section>
      <section class="panel" aria-labelledby="del-h"><h2 id="del-h" style="font-size:1.125rem;margin-bottom:16px">How orders reach customers</h2>${barList(a.delivery.map((d) => ({ ...d, name: { standard: 'Standard', express: 'Express', collection: 'Collection' }[d.method] })), (r) => r.count, (r) => plural(r.count, 'order'))}</section>
    </div>
    <p class="small muted" style="margin-top:16px">${a.customers} customers, ${a.newCustomers30} new in the last 30 days.</p>`;
  document.getElementById('csv').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try {
      const res = await fetch('/api/admin/reports/orders.csv', { headers: { Authorization: 'Bearer ' + state.token } });
      if (!res.ok) throw new Error('The export did not download. Try again.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ithrift-orders-${ithriftCalendar.todayInSouthAfrica()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Orders exported.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }, 'Exporting'));
});

/* ----------------------------- Listings ----------------------------- */

route(/^\/admin\/listings$/, async (view, _p, query) => {
  setTitle('Listings');
  const main = await consoleShell(view, 'listings');
  if (!main) return;
  const { products } = await api('/products');
  const selected = new Set();
  const q = (query.q || '').toLowerCase();
  const shown = products.filter((p) => !q || `${p.name} ${p.brand} ${p.category} ${p.ref}`.toLowerCase().includes(q));

  main.innerHTML = `
    ${consoleHead('Listings', `${products.length} listings. Select several to start or end a sale.`, `<button type="button" class="btn btn-primary btn-sm" id="add">${icon('plus', { size: 16 })}Add a piece</button>`)}
    <div class="toolbar"><div class="search-field">${icon('search', { size: 18 })}<input class="search-input" id="filter" type="search" placeholder="Filter by name, brand or reference" value="${esc(query.q || '')}" aria-label="Filter listings"></div></div>
    <div id="bulk"></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th><input type="checkbox" id="all" aria-label="Select all shown"></th><th>Piece</th><th>Category</th><th>Condition</th><th class="num">Price</th><th class="num">Stock</th><th></th></tr></thead>
        <tbody>${shown.map((p) => `
          <tr>
            <td><input type="checkbox" data-sel="${p.id}" aria-label="Select ${esc(p.name)}"></td>
            <td class="piece-cell"><div class="row"><img class="thumb" src="${esc(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><br><span class="small muted">${esc(p.brand)}, ${esc(p.ref)}</span></div></div></td>
            <td>${esc(p.category)}</td>
            <td>${conditionMeter(p.condition)}</td>
            <td class="num">${priceHtml(p)}</td>
            <td class="num">${p.stock === 0 ? '<span class="pill bad">Sold out</span>' : p.stock}</td>
            <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
    ${shown.length ? '' : '<p class="muted" style="margin-top:16px">No listings match that filter.</p>'}`;

  const bulk = document.getElementById('bulk');
  const drawBulk = () => {
    if (!selected.size) { bulk.innerHTML = ''; return; }
    bulk.innerHTML = `<div class="bulk-bar" role="region" aria-label="Bulk actions"><strong>${selected.size} selected</strong>
      <label class="visually-hidden" for="pct">Markdown</label>
      <select class="select" id="pct">${[10, 15, 20, 25, 30, 40, 50].map((n) => `<option value="${n}">${n}% off</option>`).join('')}</select>
      <button type="button" class="btn btn-secondary btn-sm" id="mark">Mark down</button>
      <button type="button" class="btn btn-secondary btn-sm" id="end">End sale</button>
      <button type="button" class="link" style="color:inherit;margin-left:auto" id="clear-sel">Clear</button></div>`;
    const run = (body, msg) => async (e) => busy(e.currentTarget, async () => {
      try {
        const r = await api('/products/bulk-price', { method: 'POST', body: { productIds: [...selected], ...body } });
        toast(`${msg(r)}`, 'success');
        router();
      } catch (err) { toast(err.message, 'error'); }
    });
    document.getElementById('mark').addEventListener('click', (e) => run({ percentOff: Number(document.getElementById('pct').value) }, (r) => `${plural(r.changed, 'piece')} marked down. ${r.alerted ? `${plural(r.alerted, 'customer')} told about the price drop.` : ''}`)(e));
    document.getElementById('end').addEventListener('click', (e) => run({ endSale: true }, (r) => `Sale ended on ${plural(r.changed, 'piece')}.`)(e));
    document.getElementById('clear-sel').addEventListener('click', () => { selected.clear(); main.querySelectorAll('[data-sel], #all').forEach((c) => { c.checked = false; }); drawBulk(); });
  };
  main.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => { if (c.checked) selected.add(Number(c.dataset.sel)); else selected.delete(Number(c.dataset.sel)); drawBulk(); }));
  document.getElementById('all').addEventListener('change', (e) => {
    main.querySelectorAll('[data-sel]').forEach((c) => { c.checked = e.target.checked; if (c.checked) selected.add(Number(c.dataset.sel)); else selected.delete(Number(c.dataset.sel)); });
    drawBulk();
  });
  let t;
  document.getElementById('filter').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => go(hashFor('admin/listings', { q: e.target.value })), 300); });
  document.getElementById('add').addEventListener('click', () => listingEditor(null));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => listingEditor(products.find((p) => p.id === Number(b.dataset.edit)))));
});

const STAFF_SIZE_RANGES = {
  Footwear: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
  Trousers: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
  Jeans: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
  Accessories: ['One Size'],
};
const sizeRangeFor = (cat) => STAFF_SIZE_RANGES[cat] || ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function listingEditor(p) {
  const editing = Boolean(p);
  let sizes = editing ? p.allSizes.map((s) => ({ ...s })) : [];
  const s = openSheet({
    title: editing ? `Edit ${p.name}` : 'Add a piece',
    variant: 'wide',
    body: `<form id="listing" novalidate>
      <div data-form-error></div>
      <div class="field"><label for="l-name">Name</label><input class="input" id="l-name" name="name" value="${esc(editing ? p.name : '')}"></div>
      <div class="field"><label for="l-desc">Description</label><textarea class="textarea" id="l-desc" name="description" placeholder="Colour, fit, and any wear a buyer should know about">${esc(editing ? p.description : '')}</textarea></div>
      <div class="form-grid">
        <div class="field"><label for="l-brand">Brand</label><select class="select" id="l-brand" name="brandId">${state.brands.map((b) => `<option value="${b.id}" ${editing && p.brandId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="l-cat">Category</label><select class="select" id="l-cat" name="categoryId">${state.categories.map((c) => `<option value="${c.id}" data-name="${esc(c.name)}" ${editing && p.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="label">Condition</legend>
        <div class="segmented" role="radiogroup" style="flex-wrap:wrap">${Object.keys(CONDITIONS).map((c) => `<button type="button" data-cond="${c}" aria-pressed="${editing ? p.condition === c : c === 'Very Good'}">${conditionMeter(c, { label: false })}${c}</button>`).join('')}</div>
      </fieldset>
      <div class="form-grid">
        <div class="field"><label for="l-price">Selling price (R)</label><input class="input" id="l-price" name="price" type="number" min="0" step="1" value="${editing ? p.price : ''}"></div>
        <div class="field"><label for="l-orig">Price before the sale (R, optional)</label><input class="input" id="l-orig" name="originalPrice" type="number" min="0" step="1" value="${editing && p.originalPrice ? p.originalPrice : ''}"><div class="hint">Fill in to show the piece as on sale. Lowering the price tells anyone who saved it.</div></div>
      </div>
      <div class="label-row"><span class="label">Stock per size</span><button type="button" class="link small" id="add-size">Add a size</button></div>
      <div class="size-table" id="sizes"></div>
      <p class="hint">A size at 0 stays listed as sold out, so customers can ask to be told when it is back.</p>
    </form>`,
    foot: `${editing ? `<button type="button" class="btn btn-danger" id="delist">Delist</button>` : ''}<button type="button" class="btn btn-secondary" data-x>Cancel</button><button type="submit" form="listing" class="btn btn-primary">${editing ? 'Save changes' : 'Add piece'}</button>`,
  });
  const f = s.el.querySelector('#listing');
  let condition = editing ? p.condition : 'Very Good';
  const catName = () => f.categoryId.selectedOptions[0].dataset.name;
  const drawSizes = () => {
    const range = sizeRangeFor(catName());
    const box = s.el.querySelector('#sizes');
    box.innerHTML = sizes.map((row, i) => `<div class="size-row">
      <select class="select" data-size-i="${i}" aria-label="Size">${[...new Set([...range, row.size])].filter(Boolean).map((v) => `<option ${v === row.size ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <input class="input" type="number" min="0" step="1" data-stock-i="${i}" value="${row.stock}" aria-label="Stock in size ${esc(row.size)}">
      <button type="button" class="icon-btn" data-rm-i="${i}" aria-label="Remove size ${esc(row.size)}">${icon('trash-2', { size: 16 })}</button></div>`).join('') || '<p class="small muted">No sizes yet. Add one.</p>';
    box.querySelectorAll('[data-size-i]').forEach((el) => el.addEventListener('change', () => { sizes[el.dataset.sizeI].size = el.value; }));
    box.querySelectorAll('[data-stock-i]').forEach((el) => el.addEventListener('input', () => { sizes[el.dataset.stockI].stock = el.value === '' ? '' : Number(el.value); }));
    box.querySelectorAll('[data-rm-i]').forEach((el) => el.addEventListener('click', () => { sizes.splice(Number(el.dataset.rmI), 1); drawSizes(); }));
  };
  if (!editing) sizes = [{ size: sizeRangeFor(catName())[2] || sizeRangeFor(catName())[0], stock: 1 }];
  drawSizes();
  f.categoryId.addEventListener('change', () => {
    const range = sizeRangeFor(catName());
    sizes = sizes.filter((x) => range.includes(x.size));
    if (!sizes.length) sizes = [{ size: range[Math.min(2, range.length - 1)], stock: 1 }];
    drawSizes();
  });
  s.el.querySelector('#add-size').addEventListener('click', () => {
    const range = sizeRangeFor(catName());
    const free = range.find((r) => !sizes.some((x) => x.size === r));
    if (!free) return toast('Every size in this category is already listed.', 'error');
    sizes.push({ size: free, stock: 1 });
    drawSizes();
  });
  s.el.querySelectorAll('[data-cond]').forEach((b) => b.addEventListener('click', () => {
    condition = b.dataset.cond;
    s.el.querySelectorAll('[data-cond]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  s.el.querySelector('[data-x]').addEventListener('click', s.close);
  s.el.querySelector('#delist')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Delist ${p.name}?`, body: 'A piece that has been ordered before is kept for order history and set to sold out. Otherwise it is removed.', confirmLabel: 'Delist', danger: true }))) return;
    try { const r = await api(`/products/${p.id}`, { method: 'DELETE' }); s.close(); toast(r.note ? 'Set to sold out, kept for order history.' : 'Listing removed.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(f);
    let bad = false;
    if (!f.name.value.trim()) { fieldError(f, 'name', 'Give the piece a name.'); bad = true; }
    if (f.description.value.trim().length < 10) { fieldError(f, 'description', 'Describe the piece, including any wear.'); bad = true; }
    if (f.price.value === '' || Number(f.price.value) < 0) { fieldError(f, 'price', 'Enter a price in rand.'); bad = true; }
    if (f.originalPrice.value && Number(f.originalPrice.value) <= Number(f.price.value)) { fieldError(f, 'originalPrice', 'The price before the sale must be higher than the selling price.'); bad = true; }
    if (sizes.some((x) => x.stock === '' || x.stock < 0 || !Number.isInteger(Number(x.stock)))) { formError(f, 'Every size needs a stock count of 0 or more.'); bad = true; }
    if (bad) return;
    const body = {
      name: f.name.value.trim(), description: f.description.value.trim(), brandId: Number(f.brandId.value), categoryId: Number(f.categoryId.value),
      condition, price: Number(f.price.value), originalPrice: f.originalPrice.value ? Number(f.originalPrice.value) : null,
      sizes: sizes.map((x) => ({ size: x.size, stock: Number(x.stock) })),
    };
    const btn = s.el.querySelector('button[type="submit"]');
    busy(btn, async () => {
      try {
        const r = editing ? await api(`/products/${p.id}`, { method: 'PUT', body }) : await api('/products', { method: 'POST', body });
        s.close();
        toast(editing ? 'Listing saved.' : `Piece added.${r.savedSearchAlerts ? ` ${plural(r.savedSearchAlerts, 'customer')} told it matches their saved search.` : ''}`, 'success');
        router();
      } catch (err) { formError(f, err.message); }
    }, 'Saving');
  });
}

/* ----------------------------- Inventory ----------------------------- */

route(/^\/admin\/inventory$/, async (view) => {
  setTitle('Inventory');
  const main = await consoleShell(view, 'inventory');
  if (!main) return;
  const [inv, { products }] = await Promise.all([api('/admin/reports/inventory'), api('/products')]);
  const value = products.reduce((n, p) => n + p.price * p.stock, 0);
  const units = products.reduce((n, p) => n + p.stock, 0);
  const rows = (list, empty) => (list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Piece</th><th>Brand</th><th>Category</th><th class="num">Stock</th><th></th></tr></thead><tbody>${list.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.brand)}</td><td>${esc(p.category)}</td><td class="num">${p.stock}</td><td class="actions"><a class="btn btn-ghost btn-sm" href="${hashFor('admin/listings', { q: p.name })}">Open</a></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${empty}</p>`);
  main.innerHTML = `
    ${consoleHead('Inventory')}
    <div class="stats">
      <div class="stat"><div class="stat-label">Pieces in stock</div><div class="stat-value">${units}</div></div>
      <div class="stat"><div class="stat-label">Stock value at selling price</div><div class="stat-value">${money(value)}</div></div>
      <div class="stat"><div class="stat-label">Sold out</div><div class="stat-value">${inv.outOfStock.length}</div></div>
      <div class="stat"><div class="stat-label">Low (${inv.threshold} or fewer)</div><div class="stat-value">${inv.lowStock.length}</div></div>
    </div>
    <h2 class="group-label">Sold out</h2>${rows(inv.outOfStock, 'Nothing is sold out.')}
    <h2 class="group-label">Low stock</h2>${rows(inv.lowStock, 'Stock levels look healthy.')}`;
});

/* ----------------------------- Orders ----------------------------- */

route(/^\/admin\/orders$/, async (view, _p, query) => {
  setTitle('Orders');
  const main = await consoleShell(view, 'orders');
  if (!main) return;
  const { orders } = await api('/orders?' + new URLSearchParams(Object.entries({ status: query.status || '', method: query.method || '' }).filter(([, v]) => v)).toString());
  const statuses = ['', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  main.innerHTML = `
    ${consoleHead('Orders', `${plural(orders.length, 'order')}${query.status ? `, ${esc(query.status.toLowerCase())}` : ''}.`)}
    <div class="toolbar">
      <div class="chip-row">${statuses.map((st) => `<a class="chip" href="${hashFor('admin/orders', { status: st, method: query.method })}" aria-pressed="${(query.status || '') === st}">${st || 'All'}</a>`).join('')}</div>
      <select class="select" id="method" aria-label="Delivery method" style="width:auto;min-height:36px;padding-top:4px;padding-bottom:4px">
        ${[['', 'Any delivery'], ['standard', 'Standard'], ['express', 'Express'], ['collection', 'Collection']].map(([v, l]) => `<option value="${v}" ${(query.method || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    ${orders.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Delivery</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${orders.map((o) => `<tr>
        <td><strong>${esc(o.ref)}</strong>${o.isGift ? ` <span class="pill" title="Gift order">${icon('gift', { size: 12 })}Gift</span>` : ''}</td>
        <td>${esc(o.customer)}</td><td>${timeAgo(o.createdAt)}</td>
        <td>${o.deliveryMethod === 'collection' ? `Collect${o.collectionDate ? ` ${esc(ithriftCalendar.label(o.collectionDate))}` : ''}` : o.deliveryMethod === 'express' ? 'Express' : 'Standard'}</td>
        <td><span class="pill ${statusClass(o.status)}">${esc(o.status)}</span></td>
        <td class="num">${money(o.total)}</td>
        <td class="actions"><a class="btn btn-ghost btn-sm" href="#/orders/${o.id}">Open</a></td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ icon: 'package', title: 'No orders here', text: 'Nothing matches this filter.' })}`;
  document.getElementById('method').addEventListener('change', (e) => go(hashFor('admin/orders', { status: query.status, method: e.target.value })));
});

/* ----------------------------- Collections ----------------------------- */

route(/^\/admin\/collections$/, async (view) => {
  setTitle('Collections');
  const main = await consoleShell(view, 'collections');
  if (!main) return;
  const { collections } = await api('/admin/collections');
  const byDay = new Map();
  for (const c of collections) {
    const k = c.date || 'unbooked';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }
  const today = ithriftCalendar.todayInSouthAfrica();
  main.innerHTML = `
    ${consoleHead('Store collections', 'Orders waiting to be collected from Hatfield, by booked day and slot.')}
    ${collections.length ? [...byDay.entries()].map(([day, list]) => `
      <h2 class="group-label">${day === 'unbooked' ? 'No slot booked (placed from the app)' : `${esc(ithriftCalendar.label(day))}${day === today ? ', today' : ''}`}</h2>
      <div class="list">${list.map((c) => `
        <div class="list-item">
          <span class="list-icon pine">${icon('store', { size: 18 })}</span>
          <span class="grow"><strong>${esc(c.slot || 'Any time')}</strong>, ${esc(c.ref)}<br><span class="small muted">${esc(c.customer)}${c.phone ? `, ${esc(c.phone)}` : ''}. ${plural(c.items, 'piece')}, ${money(c.total)}</span></span>
          <a class="btn btn-ghost btn-sm" href="#/orders/${c.id}">Open</a>
          <button type="button" class="btn btn-secondary btn-sm" data-collected="${c.id}">Collected</button>
        </div>`).join('')}</div>`).join('')
      : emptyState({ icon: 'store', title: 'No collections waiting', text: 'Orders placed for collection appear here by day.' })}`;
  main.querySelectorAll('[data-collected]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    try { await api(`/orders/${b.dataset.collected}/status`, { method: 'PUT', body: { status: 'Delivered', note: 'Collected from the Hatfield store' } }); toast('Marked as collected.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }, 'Saving')));
});

/* ----------------------------- Returns ----------------------------- */

route(/^\/admin\/returns$/, async (view, _p, query) => {
  setTitle('Returns');
  const main = await consoleShell(view, 'returns');
  if (!main) return;
  const { returns } = await api('/returns');
  const shown = query.status ? returns.filter((r) => r.status === query.status) : returns;
  const label = { Approved: 'Approve', Rejected: 'Reject', Refunded: 'Refund' };
  main.innerHTML = `
    ${consoleHead('Returns', 'Approve when the parcel is on its way back. Refund once it arrives and passes inspection; the piece goes back on sale in its size.')}
    <div class="toolbar"><div class="chip-row">${['', 'Requested', 'Approved', 'Rejected', 'Refunded'].map((st) => `<a class="chip" href="${hashFor('admin/returns', { status: st })}" aria-pressed="${(query.status || '') === st}">${st || 'All'}</a>`).join('')}</div></div>
    ${shown.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th>Piece</th><th>Reason</th><th>Status</th><th class="num">Refund</th><th></th></tr></thead>
      <tbody>${shown.map((r) => `<tr>
        <td><a class="link" href="#/orders/${r.orderId}">${esc(r.orderRef)}</a></td>
        <td>${esc(r.customer)}</td>
        <td>${esc(r.productName)}${r.size ? `, ${esc(r.size)}` : ''}</td>
        <td>${esc(r.reason)}${r.comment ? `<br><span class="small muted">${esc(r.comment)}</span>` : ''}</td>
        <td><span class="pill ${statusClass(r.status)}">${esc(r.status)}</span></td>
        <td class="num">${r.refundAmount ? money(r.refundAmount) : ''}</td>
        <td class="actions">${r.nextStatuses.map((n) => `<button type="button" class="btn ${n === 'Rejected' ? 'btn-danger' : n === 'Refunded' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-ret="${r.id}" data-next="${n}">${label[n]}</button>`).join(' ') || '<span class="small muted">Done</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ icon: 'rotate-ccw', title: 'No returns here', text: 'Nothing matches this filter.' })}`;
  main.querySelectorAll('[data-ret]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.next === 'Rejected' && !(await confirmDialog({ title: 'Reject this return?', body: 'The customer is told it does not meet the returns policy. You can approve it later.', confirmLabel: 'Reject return', danger: true }))) return;
    busy(b, async () => {
      try { await api(`/returns/${b.dataset.ret}`, { method: 'PUT', body: { status: b.dataset.next } }); toast(`Return ${b.dataset.next.toLowerCase()}. The customer has been told.`, 'success'); router(); } catch (err) { toast(err.message, 'error'); }
    }, 'Saving');
  }));
});

/* ----------------------------- Questions ----------------------------- */

route(/^\/admin\/questions$/, async (view, _p, query) => {
  setTitle('Questions');
  const main = await consoleShell(view, 'questions');
  if (!main) return;
  const status = query.status || 'open';
  const { questions } = await api('/admin/questions?status=' + status);
  main.innerHTML = `
    ${consoleHead('Product questions', 'Answers appear on the product page for everyone, and the customer who asked is notified.')}
    <div class="toolbar"><div class="segmented">${[['open', 'Waiting'], ['answered', 'Answered'], ['all', 'All']].map(([v, l]) => `<button type="button" aria-pressed="${status === v}" onclick="go('${hashFor('admin/questions', { status: v })}')">${l}</button>`).join('')}</div></div>
    ${questions.length ? questions.map((q) => `
      <div class="panel">
        <div class="row" style="align-items:flex-start">
          <img src="${esc(q.image)}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover">
          <div class="grow">
            <a class="small muted" href="#/product/${q.productId}">${esc(q.productName)}</a>
            <p style="margin:4px 0 0"><strong>${esc(q.question)}</strong></p>
            <p class="tiny muted" style="margin:4px 0 0">${esc(q.customer)}, ${timeAgo(q.createdAt)}</p>
            ${q.answer ? `<div class="callout good" style="margin-top:12px"><p>${esc(q.answer)}<br><span class="tiny">${esc(q.answeredBy || 'Staff')}, ${timeAgo(q.answeredAt)}</span></p></div>` : `
            <form class="row" data-answer="${q.id}" style="margin-top:12px;align-items:flex-start">
              <label class="visually-hidden" for="ans-${q.id}">Answer</label>
              <textarea class="textarea grow" id="ans-${q.id}" name="answer" rows="2" style="min-height:44px" placeholder="Write an answer customers will see"></textarea>
              <button class="btn btn-primary" type="submit">Answer</button>
            </form>`}
          </div>
        </div>
      </div>`).join('') : emptyState({ icon: 'message-circle', title: status === 'open' ? 'All questions answered' : 'No questions here', text: 'New questions from the product pages appear here.' })}`;
  main.querySelectorAll('[data-answer]').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (f.answer.value.trim().length < 2) { f.answer.focus(); return; }
    busy(f.querySelector('button'), async () => {
      try { await api(`/admin/questions/${f.dataset.answer}`, { method: 'PUT', body: { answer: f.answer.value } }); toast('Answer published.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
    }, 'Publishing');
  }));
});

/* ----------------------------- Buy-back offers ----------------------------- */

route(/^\/admin\/sell$/, async (view, _p, query) => {
  setTitle('Buy-back offers');
  const main = await consoleShell(view, 'sell');
  if (!main) return;
  const { submissions } = await api('/sell' + (query.status ? '?status=' + encodeURIComponent(query.status) : ''));
  main.innerHTML = `
    ${consoleHead('Buy-back offers', 'Pieces customers want to sell to the shop. Make an offer, then mark it received and paid.')}
    <div class="toolbar"><div class="chip-row">${['', 'Submitted', 'Offer made', 'Accepted', 'Received', 'Paid', 'Declined'].map((st) => `<a class="chip" href="${hashFor('admin/sell', { status: st })}" aria-pressed="${(query.status || '') === st}">${st || 'All'}</a>`).join('')}</div></div>
    ${submissions.length ? `<div class="list">${submissions.map((s) => `
      <div class="list-item" style="align-items:flex-start;flex-wrap:wrap">
        <span class="list-icon">${icon(categoryIcon(s.category), { size: 18 })}</span>
        <div class="grow" style="min-width:220px">
          <div class="row wrap"><strong>${esc(s.brand)} ${esc(s.category.toLowerCase())}, ${esc(s.size)}</strong><span class="pill ${statusClass(s.status)}">${esc(s.status)}</span></div>
          <div class="small muted">${esc(s.ref)} from ${esc(s.customer)}, ${timeAgo(s.createdAt)}. ${esc(s.condition)}.${s.askingPrice ? ` Hopes for ${money(s.askingPrice)}.` : ''}${s.offerAmount ? ` Offer ${money(s.offerAmount)}.` : ''}${s.payoutMethod ? ` Paid by ${s.payoutMethod === 'points' ? 'points' : 'EFT'}.` : ''}</div>
          <p class="small" style="margin:6px 0 0">${esc(s.description)}</p>
          ${s.staffNote ? `<p class="small muted" style="margin:4px 0 0">Note: ${esc(s.staffNote)}</p>` : ''}
        </div>
        <div class="row wrap">
          ${s.nextStatuses.includes('Offer made') ? `<button type="button" class="btn btn-primary btn-sm" data-offer="${s.id}" data-ask="${s.askingPrice || ''}">Make an offer</button>` : ''}
          ${s.nextStatuses.includes('Received') ? `<button type="button" class="btn btn-primary btn-sm" data-step="${s.id}" data-to="Received">Mark received</button>` : ''}
          ${s.nextStatuses.includes('Paid') ? `<button type="button" class="btn btn-primary btn-sm" data-step="${s.id}" data-to="Paid">Mark paid</button>` : ''}
          ${s.nextStatuses.includes('Declined') ? `<button type="button" class="btn btn-danger btn-sm" data-decline="${s.id}">Decline</button>` : ''}
        </div>
      </div>`).join('')}</div>`
      : emptyState({ icon: 'hand-coins', title: 'Nothing here', text: 'Offers from customers appear here.' })}`;

  main.querySelectorAll('[data-offer]').forEach((b) => b.addEventListener('click', () => {
    const s = openSheet({
      title: 'Make an offer', variant: 'center',
      body: `<form id="offer" novalidate><div data-form-error></div>
        <div class="field"><label for="o-amt">Offer in rand</label><input class="input" id="o-amt" name="offerAmount" type="number" min="1" value="${esc(b.dataset.ask)}"><div class="hint">The customer can take it by EFT, or as Thrift Points worth 20 percent more.</div></div>
        <div class="field"><label for="o-note">Note to the customer (optional)</label><input class="input" id="o-note" name="staffNote" maxlength="300" placeholder="Bring it to Hatfield any weekday"></div></form>`,
      foot: `<button type="button" class="btn btn-secondary" data-x>Cancel</button><button type="submit" form="offer" class="btn btn-primary">Send offer</button>`,
    });
    s.el.querySelector('[data-x]').addEventListener('click', s.close);
    s.el.querySelector('#offer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      clearErrors(f);
      if (!(Number(f.offerAmount.value) > 0)) return fieldError(f, 'offerAmount', 'Enter an offer in rand.');
      try { await api(`/sell/${b.dataset.offer}`, { method: 'PUT', body: { status: 'Offer made', offerAmount: Number(f.offerAmount.value), staffNote: f.staffNote.value || undefined } }); s.close(); toast('Offer sent.', 'success'); router(); }
      catch (err) { formError(f, err.message); }
    });
  }));
  main.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    try { await api(`/sell/${b.dataset.step}`, { method: 'PUT', body: { status: b.dataset.to } }); toast(`Marked ${b.dataset.to.toLowerCase()}. The customer has been told.`, 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }, 'Saving')));
  main.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Decline this piece?', body: 'The customer is told you cannot take it this time.', confirmLabel: 'Decline', danger: true }))) return;
    try { await api(`/sell/${b.dataset.decline}`, { method: 'PUT', body: { status: 'Declined' } }); toast('Declined.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Support inbox ----------------------------- */

route(/^\/admin\/support$/, async (view, _p, query) => {
  setTitle('Support inbox');
  const main = await consoleShell(view, 'support');
  if (!main) return;
  const { tickets } = await api('/support' + (query.status ? '?status=' + query.status : ''));
  main.innerHTML = `
    ${consoleHead('Support inbox', 'Messages from customers. Replying marks a conversation answered and notifies the customer.')}
    <div class="toolbar"><div class="chip-row">${['', 'Open', 'Answered', 'Closed'].map((st) => `<a class="chip" href="${hashFor('admin/support', { status: st })}" aria-pressed="${(query.status || '') === st}">${st || 'All'}</a>`).join('')}</div></div>
    ${tickets.length ? `<div class="list">${tickets.map((t) => `
      <a class="list-item" href="#/admin/support/${t.id}">
        <span class="list-icon ${t.status === 'Open' ? 'sale' : ''}">${icon('message-square', { size: 18 })}</span>
        <span class="grow"><strong>${esc(t.subject)}</strong><br><span class="small muted">${esc(t.customer)}, ${esc(t.topic)}${t.orderRef ? `, ${esc(t.orderRef)}` : ''}. ${esc((t.lastMessage || '').slice(0, 80))}</span></span>
        <span class="list-meta"><span class="pill ${statusClass(t.status)}">${esc(t.status)}</span><br><span class="tiny">${timeAgo(t.updatedAt)}</span></span>
      </a>`).join('')}</div>` : emptyState({ icon: 'inbox', title: 'Inbox clear', text: 'New messages from customers appear here.' })}`;
});

route(/^\/admin\/support\/(\d+)$/, async (view, [id]) => {
  if (!requireLogin()) return;
  if (!isStaff()) { go('#/help/messages/' + id); return; }
  const { ticket } = await api(`/support/${id}`);
  setTitle(ticket.subject);
  renderThread(view, ticket, true);
});

/* ----------------------------- Promo codes ----------------------------- */

route(/^\/admin\/promos$/, async (view) => {
  setTitle('Promo codes');
  const main = await consoleShell(view, 'promos');
  if (!main) return;
  const { promos } = await api('/admin/promos');
  const today = ithriftCalendar.todayInSouthAfrica();
  const state_ = (p) => (!p.active ? ['Off', 'bad'] : p.expiresAt && p.expiresAt < today ? ['Ended', 'bad'] : p.usageLimit && p.usedCount >= p.usageLimit ? ['Used up', 'warn'] : ['Live', 'good']);
  main.innerHTML = `
    ${consoleHead('Promo codes', isAdmin() ? 'Codes customers type at checkout. Usage counts orders that were not cancelled.' : 'Only the administrator can create or change codes.', isAdmin() ? `<button type="button" class="btn btn-primary btn-sm" id="new">${icon('plus', { size: 16 })}New code</button>` : '')}
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Ends</th><th class="num">Used</th><th class="num">Given away</th><th>Status</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
      <tbody>${promos.map((p) => { const [label, tone] = state_(p); return `<tr>
        <td><strong>${esc(p.code)}</strong><br><span class="small muted">${esc(p.description)}</span></td>
        <td>${p.discountType === 'percent' ? `${p.discountValue}%` : money(p.discountValue)}</td>
        <td>${p.minSpend ? money(p.minSpend) : 'None'}</td>
        <td>${p.expiresAt ? dateLabel(p.expiresAt) : 'No end date'}</td>
        <td class="num">${p.usedCount}${p.usageLimit ? ` of ${p.usageLimit}` : ''}</td>
        <td class="num">${money(p.givenAway)}</td>
        <td><span class="pill ${tone}">${label}</span></td>
        ${isAdmin() ? `<td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-toggle="${p.id}" data-on="${p.active}">${p.active ? 'Switch off' : 'Switch on'}</button></td>` : ''}
      </tr>`; }).join('')}</tbody></table></div>`;
  if (!isAdmin()) return;

  const editor = (p) => {
    const s = openSheet({
      title: p ? `Edit ${p.code}` : 'New promo code',
      body: `<form id="promo-f" novalidate><div data-form-error></div>
        <div class="field"><label for="p-code">Code</label><input class="input" id="p-code" name="code" maxlength="20" style="text-transform:uppercase" value="${esc(p ? p.code : '')}" ${p ? 'disabled' : ''}><div class="hint">Letters and numbers only. Customers type it at checkout.</div></div>
        <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="label">Discount type</legend>
          <label class="option"><input type="radio" name="discountType" value="percent" ${!p || p.discountType === 'percent' ? 'checked' : ''}><span>Percentage off the goods</span></label>
          <label class="option"><input type="radio" name="discountType" value="fixed" ${p && p.discountType === 'fixed' ? 'checked' : ''}><span>Fixed rand amount off</span></label></fieldset>
        <div class="form-grid">
          <div class="field"><label for="p-val">Amount</label><input class="input" id="p-val" name="discountValue" type="number" min="1" value="${p ? p.discountValue : ''}"></div>
          <div class="field"><label for="p-min">Minimum spend (R)</label><input class="input" id="p-min" name="minSpend" type="number" min="0" value="${p ? p.minSpend : ''}" placeholder="None"></div>
          <div class="field"><label for="p-end">Last day (optional)</label><input class="input" id="p-end" name="expiresAt" type="date" value="${p && p.expiresAt ? p.expiresAt : ''}"></div>
          <div class="field"><label for="p-lim">Uses allowed (optional)</label><input class="input" id="p-lim" name="usageLimit" type="number" min="1" value="${p && p.usageLimit ? p.usageLimit : ''}" placeholder="Unlimited"></div>
        </div>
        <div class="field"><label for="p-desc">Description (optional)</label><input class="input" id="p-desc" name="description" maxlength="80" value="${esc(p ? p.description : '')}" placeholder="Written for you if left empty"></div>
      </form>`,
      foot: `<button type="button" class="btn btn-secondary" data-x>Cancel</button><button type="submit" form="promo-f" class="btn btn-primary">${p ? 'Save code' : 'Create code'}</button>`,
    });
    s.el.querySelector('[data-x]').addEventListener('click', s.close);
    s.el.querySelector('#promo-f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      clearErrors(f);
      const body = Object.fromEntries(new FormData(f).entries());
      if (!p && !/^[A-Za-z0-9]{3,20}$/.test(body.code || '')) return fieldError(f, 'code', 'Use 3 to 20 letters and numbers, with no spaces.');
      if (!(Number(body.discountValue) > 0)) return fieldError(f, 'discountValue', 'Enter an amount above zero.');
      if (body.discountType === 'percent' && Number(body.discountValue) > 90) return fieldError(f, 'discountValue', 'A percentage cannot be more than 90.');
      try {
        if (p) await api(`/admin/promos/${p.id}`, { method: 'PUT', body: { ...body, active: p.active } });
        else await api('/admin/promos', { method: 'POST', body });
        s.close();
        toast(p ? 'Code saved.' : 'Code created.', 'success');
        router();
      } catch (err) { formError(f, err.message); }
    });
  };
  document.getElementById('new').addEventListener('click', () => editor(null));
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editor(promos.find((x) => x.id === Number(b.dataset.edit)))));
  main.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    try { await api(`/admin/promos/${b.dataset.toggle}`, { method: 'PUT', body: { active: b.dataset.on !== 'true' } }); toast(b.dataset.on === 'true' ? 'Code switched off.' : 'Code switched on.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }, 'Saving')));
});

/* ----------------------------- Customers (administrator only) ----------------------------- */

route(/^\/admin\/customers$/, async (view, _p, query) => {
  setTitle('Customers');
  const main = await consoleShell(view, 'customers');
  if (!main) return;
  if (!isAdmin()) { main.innerHTML = emptyState({ icon: 'lock', title: 'Administrator only', text: 'Only the administrator can see and suspend customer accounts.' }); return; }
  const { users } = await api('/admin/users');
  const q = (query.q || '').toLowerCase();
  const shown = users.filter((u) => !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q));
  main.innerHTML = `
    ${consoleHead('Customers', `${users.length} accounts. A suspended customer cannot sign in.`)}
    <div class="toolbar"><div class="search-field">${icon('search', { size: 18 })}<input class="search-input" id="filter" type="search" placeholder="Filter by name or email" value="${esc(query.q || '')}" aria-label="Filter customers"></div></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Email</th><th>City</th><th>Joined</th><th>Status</th><th></th></tr></thead>
      <tbody>${shown.map((u) => `<tr>
        <td><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.city || '')}</td><td>${dateLabel(u.createdAt)}</td>
        <td><span class="pill ${u.status === 'active' ? 'good' : 'bad'}">${u.status === 'active' ? 'Active' : 'Suspended'}</span></td>
        <td class="actions"><button type="button" class="btn ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm" data-toggle="${u.id}" data-status="${u.status}" data-name="${esc(u.firstName)} ${esc(u.lastName)}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button></td></tr>`).join('')}</tbody></table></div>`;
  let t;
  document.getElementById('filter').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => go(hashFor('admin/customers', { q: e.target.value })), 300); });
  main.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    const suspending = b.dataset.status === 'active';
    if (suspending && !(await confirmDialog({ title: `Suspend ${b.dataset.name}?`, body: 'They will not be able to sign in until you reactivate the account.', confirmLabel: 'Suspend account', danger: true }))) return;
    try { await api(`/admin/users/${b.dataset.toggle}/status`, { method: 'PUT', body: { status: suspending ? 'suspended' : 'active' } }); toast(suspending ? 'Account suspended.' : 'Account reactivated.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});
