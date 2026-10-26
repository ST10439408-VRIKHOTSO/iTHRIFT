'use strict';

/* =========================================================================
   Shopping screens: home, shop and filters, search, product, compare,
   cart, checkout, order placed and wishlist. Also the size guide, the
   condition guide and the photo viewer, which other screens reuse.
   ========================================================================= */

const LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function categoryIcon(name) {
  if (name === 'Footwear') return 'footprints';
  if (name === 'Accessories') return 'gem';
  if (name === 'Dresses') return 'sparkles';
  return 'shirt';
}

function rail(products) {
  return `<div class="rail">${products.map(productCard).join('')}</div>`;
}

/* ----------------------------- Home ----------------------------- */

route(/^\/$/, async (view) => {
  setTitle('');
  const [all, sale, forYouIds, overview] = await Promise.all([
    api('/products?inStock=true&sort=newest'),
    api('/products?onSale=true&inStock=true&sort=discount'),
    isCustomer() ? api('/account/for-you').catch(() => ({ productIds: [] })) : Promise.resolve({ productIds: [] }),
    isCustomer() ? api('/account/overview').catch(() => null) : Promise.resolve(null),
  ]);
  // A customer who has never set up their style profile is offered it once.
  if (overview && !overview.style.onboarded && !store.get('ithrift_onboard_later')) { go('#/welcome'); return; }

  const inStock = all.products;
  const byId = new Map(inStock.map((p) => [p.id, p]));
  const forYou = forYouIds.productIds.map((id) => byId.get(id)).filter(Boolean);
  // Five pieces for the rack: one from each of the busiest categories.
  const rackCats = ['Footwear', 'Dresses', 'Knitwear', 'Tees', 'Jackets', 'Jeans'];
  const rack = rackCats.map((c) => inStock.find((p) => p.category === c)).filter(Boolean).slice(0, 5);
  const minPrice = Math.min(...inStock.map((p) => p.price));
  const recentIds = recent.ids();
  const recents = recentIds.length ? (await api('/products/by-ids?ids=' + recentIds.join(','))).products : [];

  view.innerHTML = `
    <div class="container">
      <section class="hero">
        <div>
          <h1>Branded pieces, second time round.</h1>
          <p class="lead">Every piece is checked, graded and sized by hand at our Pretoria store. When it is gone, it is gone.</p>
          <div class="row wrap">
            <a class="btn btn-primary btn-lg" href="#/shop">Shop everything</a>
            <a class="btn btn-secondary btn-lg" href="#/sell">Sell your clothes</a>
          </div>
          <div class="hero-facts">
            <div><strong>${inStock.length}</strong>pieces in stock</div>
            <div><strong>${sale.products.length}</strong>on sale now</div>
            <div><strong>${money(minPrice)}</strong>is where prices start</div>
          </div>
        </div>
        <div class="hero-rack" aria-label="A few pieces in the shop now">
          ${rack.map((p) => `<a href="#/product/${p.id}" aria-label="${esc(p.brand)} ${esc(p.name)}"><img src="${esc(p.image)}" alt="" loading="eager"><span class="rack-label">${esc(p.category)}</span></a>`).join('')}
        </div>
      </section>

      ${forYou.length ? `
      <section class="section" aria-labelledby="for-you">
        <div class="section-head"><h2 id="for-you">Picked for your sizes</h2><a href="#/account/style">Edit sizes</a></div>
        ${rail(forYou)}
      </section>` : `
      <section class="section" aria-labelledby="just-in">
        <div class="section-head"><h2 id="just-in">Just in</h2><a href="#/shop?sort=newest">See everything</a></div>
        ${rail(inStock.slice(0, 10))}
      </section>`}

      <section class="section" aria-labelledby="cats">
        <div class="section-head"><h2 id="cats">Shop by category</h2></div>
        <div class="category-tiles">
          ${state.categories.filter((c) => c.inStock > 0).map((c) => `
            <a class="category-tile" href="${hashFor('shop', { category: c.name })}">
              <span class="list-icon">${icon(categoryIcon(c.name))}</span>
              <span>${esc(c.name)}<br><small>${plural(c.inStock, 'piece')}</small></span>
            </a>`).join('')}
        </div>
      </section>

      ${sale.products.length ? `
      <section class="section" aria-labelledby="sale">
        <div class="section-head"><h2 id="sale">Biggest markdowns</h2><a href="#/shop?onSale=true&sort=discount">All sale pieces</a></div>
        ${rail(sale.products.slice(0, 10))}
      </section>` : ''}

      ${recents.length ? `
      <section class="section" aria-labelledby="recent">
        <div class="section-head"><h2 id="recent">You looked at</h2><button type="button" class="link quiet" id="clear-recent">Clear</button></div>
        ${rail(recents)}
      </section>` : ''}

      <section class="band" aria-labelledby="sell-band">
        <div>
          <h2 id="sell-band">Clear your wardrobe, get paid for it.</h2>
          <p>We buy branded pieces in good condition. Take the offer as cash by EFT, or as Thrift Points with 20 percent extra to spend in store.</p>
          <a class="btn btn-secondary" href="#/sell" style="margin-top:16px">Offer us a piece</a>
        </div>
        <ol class="band-steps">
          <li>Tell us the brand, size and condition.</li>
          <li>We send you an offer within two working days.</li>
          <li>Drop it at the Hatfield store and get paid.</li>
        </ol>
      </section>
    </div>`;

  document.getElementById('clear-recent')?.addEventListener('click', () => { recent.clear(); router(); });
});

/* ----------------------------- Shop, filters and saved searches ----------------------------- */

const LIST_FILTERS = ['category', 'brand', 'size', 'condition'];
const listOf = (v) => (v ? String(v).split(',').filter(Boolean) : []);

function shopQueryWith(query, changes) {
  const next = { ...query, ...changes };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null || (Array.isArray(next[k]) && !next[k].length)) delete next[k];
  for (const k of LIST_FILTERS) if (Array.isArray(next[k])) next[k] = next[k].join(',');
  return next;
}

function shopTitle(query) {
  const cats = listOf(query.category);
  const brands = listOf(query.brand);
  if (query.q) return `Results for “${query.q}”`;
  if (query.onSale === 'true' && !cats.length && !brands.length) return 'Sale';
  if (brands.length === 1 && !cats.length) return brands[0];
  if (cats.length === 1 && !brands.length) return cats[0];
  if (brands.length === 1 && cats.length === 1) return `${brands[0]} ${cats[0].toLowerCase()}`;
  return 'Shop';
}

route(/^\/shop$/, async (view, _p, query) => {
  const title = shopTitle(query);
  setTitle(title);
  let mySizes = [];
  if (isCustomer()) {
    try { mySizes = (await api('/account/overview')).style.sizes; } catch (_) { /* toggle hidden */ }
  }
  const usingMySizes = query.mine === '1' && mySizes.length;
  const apiQuery = { ...query };
  delete apiQuery.mine;
  if (usingMySizes) apiQuery.size = mySizes.join(',');

  view.innerHTML = `<div class="container page"><div class="page-head"><div><h1>${esc(title)}</h1></div></div>${skeletonGrid(8)}</div>`;
  const data = await api('/products?' + new URLSearchParams(apiQuery).toString());
  const products = data.products;

  const activeCount = LIST_FILTERS.reduce((n, k) => n + listOf(query[k]).length, 0) + (query.minPrice ? 1 : 0) + (query.maxPrice ? 1 : 0) + (query.onSale === 'true' ? 1 : 0) + (query.inStock === 'true' ? 1 : 0);
  const chips = [];
  for (const k of LIST_FILTERS) for (const v of listOf(query[k])) chips.push({ label: k === 'size' ? `Size ${v}` : v, next: shopQueryWith(query, { [k]: listOf(query[k]).filter((x) => x !== v) }) });
  if (query.minPrice) chips.push({ label: `From ${money(query.minPrice)}`, next: shopQueryWith(query, { minPrice: '' }) });
  if (query.maxPrice) chips.push({ label: `Up to ${money(query.maxPrice)}`, next: shopQueryWith(query, { maxPrice: '' }) });
  if (query.onSale === 'true') chips.push({ label: 'On sale', next: shopQueryWith(query, { onSale: '' }) });
  if (query.inStock === 'true') chips.push({ label: 'In stock', next: shopQueryWith(query, { inStock: '' }) });
  if (query.q) chips.push({ label: `“${query.q}”`, next: shopQueryWith(query, { q: '' }) });

  const cats = listOf(query.category);
  const sorts = [['', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price, low to high'], ['price_desc', 'Price, high to low'], ['discount', 'Biggest discount']];
  const canSave = isCustomer() && (chips.length || query.q);

  view.innerHTML = `
    <div class="container page">
      <div class="page-head" style="margin-bottom:8px">
        <div><h1>${esc(title)}</h1></div>
      </div>
      <div class="shop-bar" id="shop-bar">
        <div class="shop-tools">
          <button type="button" class="chip" id="open-filters" aria-haspopup="dialog">${icon('sliders-horizontal', { size: 16 })}Filters${activeCount ? ` (${activeCount})` : ''}</button>
          ${mySizes.length ? `<button type="button" class="chip" id="my-sizes" aria-pressed="${Boolean(usingMySizes)}">${icon('ruler', { size: 16 })}My sizes</button>` : ''}
          <div class="chip-row" role="group" aria-label="Categories">
            <a class="chip" href="${hashFor('shop', shopQueryWith(query, { category: '' }))}" aria-pressed="${!cats.length}">All</a>
            ${state.categories.filter((c) => c.inStock > 0).map((c) => `<a class="chip" href="${hashFor('shop', shopQueryWith(query, { category: cats.length === 1 && cats[0] === c.name ? '' : c.name }))}" aria-pressed="${cats.includes(c.name)}">${esc(c.name)}</a>`).join('')}
          </div>
        </div>
        ${chips.length ? `<div class="active-filters">${chips.map((c) => `<a class="chip on" href="${hashFor('shop', c.next)}" aria-label="Remove filter ${esc(c.label)}">${esc(c.label)}${icon('x', { size: 14, cls: 'x' })}</a>`).join('')}<a class="link quiet small" href="#/shop">Clear all</a></div>` : ''}
      </div>
      <div class="result-line">
        <span aria-live="polite">${plural(products.length, 'piece')}${usingMySizes ? ` in ${esc(mySizes.join(', '))}` : ''}</span>
        <span class="row">
          ${canSave ? `<button type="button" class="btn btn-ghost btn-sm" id="save-search">${icon('bookmark-plus', { size: 16 })}Save search</button>` : ''}
          <label class="visually-hidden" for="sort">Sort</label>
          <select class="select" id="sort" style="width:auto;min-height:36px;padding-top:4px;padding-bottom:4px;font-size:0.875rem">
            ${sorts.map(([v, l]) => `<option value="${v}" ${(query.sort || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </span>
      </div>
      ${products.length ? `<div class="grid">${products.map(productCard).join('')}</div>` : emptyState({
        icon: 'search', title: 'Nothing matches yet',
        text: canSave ? 'Pieces come in every week. Save this search and we will tell you when something matching arrives.' : 'Try fewer filters, or a different word.',
        actions: `${canSave ? `<button type="button" class="btn btn-primary" id="save-search-empty">${icon('bookmark-plus', { size: 18 })}Save this search</button>` : ''}<a class="btn btn-secondary" href="#/shop">Clear filters</a>`,
      })}
    </div>`;

  const bar = document.getElementById('shop-bar');
  const onScroll = () => bar && bar.classList.toggle('stuck', window.scrollY > 120);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', () => window.removeEventListener('scroll', onScroll), { once: true });

  document.getElementById('sort').addEventListener('change', (e) => go(hashFor('shop', shopQueryWith(query, { sort: e.target.value }))));
  document.getElementById('open-filters').addEventListener('click', () => openFilters(query, data.priceRange));
  document.getElementById('my-sizes')?.addEventListener('click', () => go(hashFor('shop', shopQueryWith(query, { mine: usingMySizes ? '' : '1' }))));
  const saveBtns = [document.getElementById('save-search'), document.getElementById('save-search-empty')].filter(Boolean);
  saveBtns.forEach((b) => b.addEventListener('click', () => saveSearch(query, data.summary)));
});

function sizeGroups(sizes) {
  return [
    ['Tops and dresses', sizes.filter((s) => LETTERS.includes(s))],
    ['Shoes', sizes.filter((s) => /^UK /.test(s))],
    ['Waist', sizes.filter((s) => /^\d+$/.test(s))],
    ['Accessories', sizes.filter((s) => s === 'One Size')],
  ].filter(([, list]) => list.length);
}

function openFilters(query, priceRange) {
  const sel = Object.fromEntries(LIST_FILTERS.map((k) => [k, new Set(listOf(query[k]))]));
  const opt = (k, v, label) => `<button type="button" class="chip" data-k="${k}" data-v="${esc(v)}" aria-pressed="${sel[k].has(v)}">${label || esc(v)}</button>`;
  const s = openSheet({
    title: 'Filters',
    label: 'filters',
    body: `
      <div class="filter-group"><h3>Category</h3><div class="filter-options">${state.categories.filter((c) => c.inStock > 0).map((c) => opt('category', c.name)).join('')}</div></div>
      <div class="filter-group"><h3>Size</h3>${sizeGroups(state.sizes).map(([label, list]) => `<p class="small muted" style="margin:8px 0 6px">${label}</p><div class="filter-options">${list.map((v) => opt('size', v)).join('')}</div>`).join('')}</div>
      <div class="filter-group"><h3>Condition</h3><div class="filter-options">${Object.keys(CONDITIONS).map((c) => opt('condition', c, `${conditionMeter(c, { label: false })}<span>${esc(c)}</span>`)).join('')}</div>
        <button type="button" class="link small" style="margin-top:8px" id="what-grades">What the grades mean</button></div>
      <div class="filter-group"><h3>Brand</h3><div class="filter-options">${state.brands.map((b) => opt('brand', b.name)).join('')}</div></div>
      <div class="filter-group"><h3>Price</h3>
        <div class="price-inputs">
          <label class="visually-hidden" for="f-min">Minimum price in rand</label><input class="input" id="f-min" type="number" inputmode="numeric" min="0" placeholder="R${Math.floor(priceRange.min)}" value="${esc(query.minPrice || '')}">
          <span class="muted">to</span>
          <label class="visually-hidden" for="f-max">Maximum price in rand</label><input class="input" id="f-max" type="number" inputmode="numeric" min="0" placeholder="R${Math.ceil(priceRange.max)}" value="${esc(query.maxPrice || '')}">
        </div>
        <div class="field-error" id="price-err" hidden></div>
      </div>
      <div class="filter-group">
        <div class="switch-row"><label for="f-sale">On sale only</label><span class="switch"><input type="checkbox" id="f-sale" ${query.onSale === 'true' ? 'checked' : ''}><span></span></span></div>
        <div class="switch-row"><label for="f-stock">Hide sold-out pieces</label><span class="switch"><input type="checkbox" id="f-stock" ${query.inStock === 'true' ? 'checked' : ''}><span></span></span></div>
      </div>`,
    foot: `<button type="button" class="btn btn-secondary" data-clear>Clear all</button><button type="button" class="btn btn-primary" data-apply>Show results</button>`,
  });
  const el = s.el;
  el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const set = sel[b.dataset.k];
    if (set.has(b.dataset.v)) set.delete(b.dataset.v); else set.add(b.dataset.v);
    b.setAttribute('aria-pressed', String(set.has(b.dataset.v)));
  }));
  el.querySelector('#what-grades').addEventListener('click', () => openConditionGuide());
  el.querySelector('[data-clear]').addEventListener('click', () => { s.close(); go(hashFor('shop', query.q ? { q: query.q } : {})); });
  el.querySelector('[data-apply]').addEventListener('click', () => {
    const min = el.querySelector('#f-min').value;
    const max = el.querySelector('#f-max').value;
    const err = el.querySelector('#price-err');
    if (min && max && Number(min) > Number(max)) {
      err.hidden = false;
      err.innerHTML = `${icon('circle-alert', { size: 14 })}<span>The lowest price is higher than the highest price.</span>`;
      return;
    }
    s.close();
    go(hashFor('shop', shopQueryWith(query, {
      ...Object.fromEntries(LIST_FILTERS.map((k) => [k, [...sel[k]]])),
      minPrice: min, maxPrice: max,
      onSale: el.querySelector('#f-sale').checked ? 'true' : '',
      inStock: el.querySelector('#f-stock').checked ? 'true' : '',
    })));
  });
}

function saveSearch(query, summary) {
  const criteria = { ...query };
  delete criteria.sort;
  delete criteria.mine;
  const s = openSheet({
    title: 'Save this search', variant: 'center',
    body: `<p class="muted">We will add a notification when a new piece matches: ${esc(summary)}.</p>
      <form id="save-form"><div data-form-error></div><div class="field"><label for="ss-name">Name</label><input class="input" id="ss-name" name="name" maxlength="40" value="${esc(summary.slice(0, 40))}" required></div></form>`,
    foot: `<button type="button" class="btn btn-secondary" data-close-btn>Cancel</button><button type="submit" form="save-form" class="btn btn-primary">Save search</button>`,
  });
  s.el.querySelector('[data-close-btn]').addEventListener('click', s.close);
  s.el.querySelector('#save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    try {
      await api('/account/saved-searches', { method: 'POST', body: { name: form.name.value, criteria } });
      s.close();
      toast('Search saved. We will tell you about new matches.', 'success', { label: 'View', href: '#/account/saved' });
    } catch (err) { formError(form, err.message); }
  });
}

/* ----------------------------- Search (phones) ----------------------------- */

route(/^\/search$/, async (view) => {
  setTitle('Search');
  const popular = ['Nike', 'Adidas', 'Zara', 'Tommy Hilfiger', 'Puma', 'Guess'];
  view.innerHTML = `
    <div class="container page">
      <h1 style="margin-bottom:16px">Search</h1>
      <div class="search-field">${icon('search', { size: 18 })}<input class="search-input" id="big-search" type="search" placeholder="Brands, pieces, categories" aria-label="Search the shop" autocomplete="off" style="height:48px;background:var(--surface);border-color:var(--hairline-strong)"></div>
      <div class="section" style="margin-top:32px">
        <h2 style="font-size:1.0625rem;margin-bottom:12px">Popular brands</h2>
        <div class="row wrap">${popular.map((b) => `<a class="chip" href="${hashFor('shop', { brand: b })}">${esc(b)}</a>`).join('')}</div>
      </div>
      <div class="section" style="margin-top:32px">
        <h2 style="font-size:1.0625rem;margin-bottom:12px">Categories</h2>
        <div class="list">${state.categories.filter((c) => c.inStock).map((c) => `<a class="list-item" href="${hashFor('shop', { category: c.name })}"><span class="list-icon">${icon(categoryIcon(c.name), { size: 18 })}</span><span>${esc(c.name)}</span><span class="list-meta">${c.inStock}</span>${icon('chevron-right', { size: 18, cls: 'chev' })}</a>`).join('')}</div>
      </div>
    </div>`;
  const input = document.getElementById('big-search');
  attachSearch(input);
  setTimeout(() => input.focus(), 50);
});

/* ----------------------------- Product page ----------------------------- */

route(/^\/product\/(\d+)$/, async (view, [id]) => {
  const pid = Number(id);
  const [{ product: p }, reviewData, qData, similar, options] = await Promise.all([
    api(`/products/${pid}`),
    api(`/products/${pid}/reviews`),
    api(`/products/${pid}/questions`),
    api(`/products/${pid}/similar`),
    loadOptions(),
  ]);
  setTitle(`${p.brand} ${p.name}`);
  const recentIds = recent.ids().filter((x) => x !== pid);
  recent.add(pid);
  const recents = recentIds.length ? (await api('/products/by-ids?ids=' + recentIds.slice(0, 8).join(','))).products : [];

  const saved = state.wishlist.has(pid);
  const cond = CONDITIONS[p.condition] || {};
  const sizes = p.allSizes.length ? p.allSizes : [{ size: p.size, stock: p.stock }];
  const inStockSizes = sizes.filter((s) => s.stock > 0);
  let chosen = inStockSizes.length === 1 ? inStockSizes[0] : null;
  let qty = 1;
  const { summary, reviews } = reviewData;
  const deliveries = options.deliveryMethods;

  view.innerHTML = `
    <div class="container has-buy-bar">
      <div style="padding-top:16px"><a class="back-link" href="#/shop">${icon('chevron-left', { size: 18 })}Shop</a></div>
      <div class="pdp">
        <div class="pdp-media">
          <button type="button" class="pdp-photo" id="open-photo" aria-label="Open the photo of ${esc(p.name)} full screen">
            <img src="${esc(p.image)}" alt="${esc(p.brand)} ${esc(p.name)}">
            <span class="round-btn zoom-hint" aria-hidden="true">${icon('zoom-in', { size: 18 })}</span>
          </button>
        </div>
        <div class="pdp-info">
          <a class="pdp-brand" href="${hashFor('shop', { brand: p.brand })}">${esc(p.brand)}</a>
          <h1>${esc(p.name)}</h1>
          <div class="pdp-price">${priceHtml(p)}${p.onSale ? `<span class="pill sale">Save ${money(p.originalPrice - p.price)}</span>` : ''}</div>
          ${summary.count ? `<a href="#reviews" class="row small" style="margin:-8px 0 16px;gap:8px">${stars(summary.average)}<span class="muted">${summary.average} from ${plural(summary.count, 'review')}</span></a>` : ''}

          <div class="pdp-block">
            <div class="label-row"><span class="label">Condition</span><button type="button" class="link small" id="grade-help">How we grade</button></div>
            ${conditionMeter(p.condition, { large: true })}
            <p class="small muted" style="margin:8px 0 0">${esc(cond.meaning || '')}</p>
          </div>

          <div class="pdp-block">
            <div class="label-row"><span class="label" id="size-label">${p.inStock ? (chosen ? `Size ${esc(chosen.size)}` : 'Choose a size') : 'Sizes'}</span><button type="button" class="link small" id="size-guide">Size guide</button></div>
            <div class="size-grid" role="radiogroup" aria-labelledby="size-label">
              ${sizes.map((s) => `<button type="button" class="size-btn${s.stock > 0 ? '' : ' out'}" role="radio" data-size="${esc(s.size)}" data-stock="${s.stock}" aria-checked="${chosen && chosen.size === s.size}" ${s.stock > 0 ? '' : `aria-label="${esc(s.size)}, sold out. Get an alert when it is back"`}>${esc(s.size)}</button>`).join('')}
            </div>
            <p class="small muted" id="size-note" style="margin:8px 0 0">${p.inStock ? (chosen ? (chosen.stock === 1 ? 'Last one in this size.' : `${chosen.stock} in this size.`) : 'Crossed-out sizes are sold out. Tap one to get an alert.') : ''}</p>
          </div>

          ${p.inStock ? `
          <div class="buy-row buy-bar">
            <div class="qty only-desktop" aria-label="Quantity">
              <button type="button" id="qty-minus" aria-label="One fewer" disabled>${icon('minus', { size: 16 })}</button>
              <span id="qty" aria-live="polite">1</span>
              <button type="button" id="qty-plus" aria-label="One more">${icon('plus', { size: 16 })}</button>
            </div>
            ${isStaff() ? '' : `<button type="button" class="btn btn-primary btn-lg" id="add-btn">${icon('shopping-bag', { size: 18 })}<span>Add to bag</span></button>`}
            ${isStaff() ? '' : `<button type="button" class="btn btn-secondary btn-lg" data-wish="${pid}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(p.name)} ${saved ? 'from' : 'to'} your wishlist">${icon('heart', { size: 18 })}</button>`}
          </div>` : `
          <div class="callout warn" style="margin:16px 0">${icon('circle-alert', { size: 18 })}<p>This piece has sold. Get an alert if it comes back, or see similar pieces below.</p></div>
          <div class="buy-row">
            <button type="button" class="btn btn-primary btn-lg" id="notify-all">${icon('bell', { size: 18 })}Tell me if it comes back</button>
            ${isStaff() ? '' : `<button type="button" class="btn btn-secondary btn-lg" data-wish="${pid}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(p.name)} ${saved ? 'from' : 'to'} your wishlist">${icon('heart', { size: 18 })}</button>`}
          </div>`}

          <div class="pdp-block" style="margin-top:16px">
            ${deliveries.map((d) => `<div class="eta">${icon(d.id === 'collection' ? 'store' : 'truck', { size: 18 })}<div><strong>${esc(d.label)}</strong>, ${d.fee ? money(d.fee) : 'free'}${d.freeOverThreshold ? ` (free from ${money(options.freeDeliveryThreshold)})` : ''}<br><span class="muted small">${d.id === 'collection' ? 'Ready from' : 'Arrives'} ${esc(d.arrives.label)}</span></div></div>`).join('')}
          </div>

          <div class="pdp-tools pdp-block">
            <button type="button" class="btn btn-quiet btn-sm" id="share">${icon('share-2', { size: 16 })}Share</button>
            <button type="button" class="btn btn-quiet btn-sm" data-compare="${pid}" aria-pressed="${compare.has(pid)}">${icon('columns-3', { size: 16 })}Compare</button>
            <a class="btn btn-quiet btn-sm" href="#questions">${icon('message-circle', { size: 16 })}Ask a question</a>
          </div>

          <details class="disclosure" open>
            <summary>Description ${icon('chevron-down', { size: 18 })}</summary>
            <div class="disclosure-body"><p>${esc(p.description)}</p>
              <dl class="facts">
                <dt>Brand</dt><dd>${esc(p.brand)}</dd>
                <dt>Category</dt><dd><a class="link" href="${hashFor('shop', { category: p.category })}">${esc(p.category)}</a></dd>
                <dt>Reference</dt><dd>${esc(p.ref)}</dd>
                <dt>Condition</dt><dd>${esc(p.condition)}</dd>
              </dl>
            </div>
          </details>
          <details class="disclosure">
            <summary>Returns ${icon('chevron-down', { size: 18 })}</summary>
            <div class="disclosure-body"><p class="muted">Return anything within ${options.returnWindowDays} days of delivery. Open the order, choose the piece and tell us why. We refund once it is back with us.</p></div>
          </details>
        </div>
      </div>

      <section class="section" id="reviews" aria-labelledby="reviews-h">
        <div class="section-head"><h2 id="reviews-h">Reviews</h2>${reviews.length > 1 ? `<select class="select" id="review-sort" aria-label="Sort reviews" style="width:auto;min-height:36px;padding-top:4px;padding-bottom:4px;font-size:0.875rem"><option value="new">Newest</option><option value="high">Highest rated</option><option value="low">Lowest rated</option></select>` : ''}</div>
        ${summary.count ? `
        <div class="rating-summary">
          <div><div class="rating-big">${summary.average}</div>${stars(summary.average, 16)}<div class="small muted">${plural(summary.count, 'review')}</div></div>
          <div class="histo">${[5, 4, 3, 2, 1].map((n) => `<div class="histo-row"><span>${n}</span><div class="histo-bar"><i style="width:${summary.count ? Math.round((summary.histogram[n] / summary.count) * 100) : 0}%"></i></div><span>${summary.histogram[n]}</span></div>`).join('')}</div>
        </div>
        <div id="review-list"></div>` : '<p class="muted">No reviews yet for this piece.</p>'}
        ${isCustomer() ? `
        <details class="disclosure" style="margin-top:8px">
          <summary>Write a review ${icon('chevron-down', { size: 18 })}</summary>
          <div class="disclosure-body">
            <form id="review-form" style="max-width:520px">
              <div data-form-error></div>
              <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="label">Your rating</legend>
                <div class="segmented" role="radiogroup">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-pressed="false" data-rate="${n}" aria-label="${n} out of 5">${n}</button>`).join('')}</div>
              </fieldset>
              <div class="field"><label for="r-comment">What did you think? (optional)</label><textarea class="textarea" id="r-comment" name="comment" maxlength="600" placeholder="How was the fit? Was the condition as described?"></textarea></div>
              <button class="btn btn-primary" type="submit">Post review</button>
            </form>
          </div>
        </details>` : (!state.user ? `<p class="small" style="margin-top:12px"><a class="link" href="#/login?next=${encodeURIComponent('/product/' + pid)}">Sign in</a> to write a review.</p>` : '')}
      </section>

      <section class="section" id="questions" aria-labelledby="qa-h">
        <div class="section-head"><h2 id="qa-h">Questions</h2></div>
        ${qData.questions.length ? qData.questions.map((q) => `
          <div class="qa"><div class="q">${esc(q.question)}</div>
            ${q.answer ? `<div class="a">${esc(q.answer)}</div><div class="tiny faint" style="margin-top:4px">iTHRIFT answered ${timeAgo(q.answeredAt)}</div>` : `<div class="tiny faint" style="margin-top:4px">${icon('clock', { size: 12, cls: 'inline' })} Waiting for an answer. Only you can see this until we reply.</div>`}
          </div>`).join('') : '<p class="muted">No questions yet. Ask about fit, fabric or wear and the store team will answer here.</p>'}
        ${isCustomer() ? `
          <form id="ask-form" class="row" style="margin-top:16px;align-items:flex-start;max-width:640px">
            <div class="grow"><label class="visually-hidden" for="ask">Your question</label><input class="input" id="ask" name="question" maxlength="300" placeholder="Ask about fit, fabric or wear"></div>
            <button class="btn btn-primary" type="submit">${icon('send', { size: 16 })}Ask</button>
          </form>` : (!state.user ? `<p class="small" style="margin-top:12px"><a class="link" href="#/login?next=${encodeURIComponent('/product/' + pid)}">Sign in</a> to ask a question.</p>` : '')}
      </section>

      ${similar.products.length ? `<section class="section" aria-labelledby="sim-h"><div class="section-head"><h2 id="sim-h">Similar pieces</h2></div>${rail(similar.products)}</section>` : ''}
      ${recents.length ? `<section class="section" aria-labelledby="rv-h"><div class="section-head"><h2 id="rv-h">You looked at</h2></div>${rail(recents)}</section>` : ''}
    </div>`;

  // Reviews, sortable
  const renderReviews = (order = 'new') => {
    const list = document.getElementById('review-list');
    if (!list) return;
    const sorted = [...reviews].sort((a, b) => (order === 'high' ? b.rating - a.rating : order === 'low' ? a.rating - b.rating : 0));
    list.innerHTML = sorted.map((r) => `
      <div class="review">
        <div class="row between"><div class="row">${stars(r.rating)}<strong>${esc(r.author)}</strong>${r.verified ? `<span class="pill good">${icon('check', { size: 12 })}Bought this piece</span>` : ''}</div><span class="tiny muted">${timeAgo(r.createdAt)}</span></div>
        ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
      </div>`).join('');
  };
  renderReviews();
  document.getElementById('review-sort')?.addEventListener('change', (e) => renderReviews(e.target.value));

  // Sizes and quantity
  const note = document.getElementById('size-note');
  const label = document.getElementById('size-label');
  const qtyEl = document.getElementById('qty');
  const minus = document.getElementById('qty-minus');
  const plus = document.getElementById('qty-plus');
  const syncQty = () => {
    if (!qtyEl) return;
    qtyEl.textContent = qty;
    minus.disabled = qty <= 1;
    plus.disabled = !chosen || qty >= chosen.stock;
  };
  syncQty();
  view.querySelectorAll('.size-btn').forEach((b) => b.addEventListener('click', () => {
    const stock = Number(b.dataset.stock);
    if (stock < 1) { stockAlert(pid, b.dataset.size); return; }
    chosen = { size: b.dataset.size, stock };
    qty = 1;
    view.querySelectorAll('.size-btn').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    label.textContent = `Size ${chosen.size}`;
    note.textContent = chosen.stock === 1 ? 'Last one in this size.' : `${chosen.stock} in this size.`;
    syncQty();
  }));
  minus?.addEventListener('click', () => { qty = Math.max(1, qty - 1); syncQty(); });
  plus?.addEventListener('click', () => { if (chosen) qty = Math.min(chosen.stock, qty + 1); syncQty(); });

  document.getElementById('add-btn')?.addEventListener('click', (e) => {
    if (!chosen) {
      note.textContent = 'Choose a size first.';
      note.style.color = 'var(--bad)';
      view.querySelector('.size-btn:not(.out)')?.focus();
      return;
    }
    if (!requireLogin()) return;
    busy(e.currentTarget, async () => {
      try {
        await api('/cart/items', { method: 'POST', body: { productId: pid, quantity: qty, size: chosen.size } });
        await refreshCounts();
        renderChrome();
        toast(`Added to your bag, size ${chosen.size}.`, 'success', { label: 'View bag', href: '#/cart' });
      } catch (err) { toast(err.message, 'error'); }
    }, 'Adding');
  });
  document.getElementById('notify-all')?.addEventListener('click', () => stockAlert(pid, null));
  document.getElementById('open-photo').addEventListener('click', () => openLightbox(p.image, `${p.brand} ${p.name}`));
  document.getElementById('size-guide').addEventListener('click', () => openSizeGuide(p.category, chosen ? chosen.size : null));
  document.getElementById('grade-help').addEventListener('click', () => openConditionGuide(p.condition));
  document.getElementById('share').addEventListener('click', () => sharePiece(p));

  // Review form
  const rf = document.getElementById('review-form');
  if (rf) {
    let rating = 0;
    rf.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => {
      rating = Number(b.dataset.rate);
      rf.querySelectorAll('[data-rate]').forEach((x) => { const on = Number(x.dataset.rate) === rating; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-checked', String(on)); });
    }));
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(rf);
      if (!rating) return formError(rf, 'Choose a rating from 1 to 5.');
      try {
        await api(`/products/${pid}/reviews`, { method: 'POST', body: { rating, comment: rf.comment.value } });
        toast('Review posted. Thank you.', 'success');
        router();
      } catch (err) { formError(rf, err.message); }
    });
  }

  // Ask a question
  const af = document.getElementById('ask-form');
  af?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(af);
    try {
      await api(`/products/${pid}/questions`, { method: 'POST', body: { question: af.question.value } });
      toast('Question sent. We will notify you when the store replies.', 'success');
      router();
    } catch (err) { fieldError(af, 'question', err.message); }
  });
});

async function stockAlert(productId, size) {
  if (!requireLogin()) return;
  if (!isCustomer()) return toast('Alerts are for customer accounts.', 'error');
  try {
    const r = await api(`/products/${productId}/alerts`, { method: 'POST', body: { size } });
    toast(r.message, 'success', { label: 'My alerts', href: '#/account/alerts' });
  } catch (err) { toast(err.message, 'error'); }
}

async function sharePiece(p) {
  const url = `${location.origin}/#/product/${p.id}`;
  const text = `${p.brand} ${p.name}, ${money(p.price)} at iTHRIFT`;
  if (navigator.share) {
    try { await navigator.share({ title: text, text, url }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const s = openSheet({
    title: 'Share this piece', variant: 'center',
    body: `<div class="list">
      <button type="button" class="list-item" id="copy-link"><span class="list-icon">${icon('copy', { size: 18 })}</span><span>Copy link</span></button>
      <a class="list-item" href="https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}" target="_blank" rel="noopener"><span class="list-icon">${icon('message-circle', { size: 18 })}</span><span>Send on WhatsApp</span>${icon('external-link', { size: 16, cls: 'chev' })}</a>
      <a class="list-item" href="mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}"><span class="list-icon">${icon('mail', { size: 18 })}</span><span>Email it</span></a>
    </div>`,
  });
  s.el.querySelector('#copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied.', 'success'); s.close(); }
    catch (_) { toast('Could not copy. Select the address bar to copy the link.', 'error'); }
  });
}

/* ----------------------------- Photo viewer ----------------------------- */

function openLightbox(src, alt) {
  const opener = document.activeElement;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo of ' + alt);
  box.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><button type="button" class="icon-btn" aria-label="Close photo">${icon('x')}</button><p class="lb-hint">Tap the photo to zoom. Drag to look around.</p>`;
  document.body.appendChild(box);
  document.body.style.overflow = 'hidden';
  const img = box.querySelector('img');
  let scale = 1; let tx = 0; let ty = 0; let dragging = null; let pinch = null;
  const apply = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; box.classList.toggle('zoomed', scale > 1); };
  const close = () => { box.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === '+' || e.key === '=') { scale = Math.min(4, scale + 0.5); apply(); }
    if (e.key === '-') { scale = Math.max(1, scale - 0.5); if (scale === 1) { tx = 0; ty = 0; } apply(); }
  };
  document.addEventListener('keydown', onKey);
  box.querySelector('button').addEventListener('click', close);
  box.querySelector('button').focus();
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  img.addEventListener('click', (e) => {
    if (dragging && dragging.moved) return;
    if (scale > 1) { scale = 1; tx = 0; ty = 0; } else {
      const r = img.getBoundingClientRect();
      scale = 2.5;
      tx = (r.left + r.width / 2 - e.clientX) * 1.5;
      ty = (r.top + r.height / 2 - e.clientY) * 1.5;
    }
    apply();
  });
  img.addEventListener('pointerdown', (e) => { if (scale > 1) { dragging = { x: e.clientX - tx, y: e.clientY - ty, moved: false }; img.setPointerCapture(e.pointerId); } });
  img.addEventListener('pointermove', (e) => { if (dragging) { tx = e.clientX - dragging.x; ty = e.clientY - dragging.y; dragging.moved = true; apply(); } });
  img.addEventListener('pointerup', () => { setTimeout(() => { dragging = null; }, 0); });
  box.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: scale }; }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scale = Math.min(4, Math.max(1, pinch.s * (d / pinch.d)));
      apply();
    }
  }, { passive: true });
  box.addEventListener('touchend', () => { pinch = null; });
}

/* ----------------------------- Size and condition guides ----------------------------- */

const SIZE_GUIDE = {
  apparel: { title: 'Tops, knitwear, jackets and dresses', head: ['Size', 'Chest (cm)', 'Waist (cm)', 'Hips (cm)'], rows: [
    ['XS', '82 to 86', '66 to 70', '88 to 92'], ['S', '87 to 92', '71 to 76', '93 to 98'], ['M', '93 to 100', '77 to 84', '99 to 106'],
    ['L', '101 to 108', '85 to 92', '107 to 114'], ['XL', '109 to 116', '93 to 100', '115 to 122'], ['XXL', '117 to 124', '101 to 108', '123 to 130']] },
  footwear: { title: 'Shoes', head: ['UK', 'EU', 'Foot length (cm)'], rows: [
    ['UK 3', '36', '22.0'], ['UK 4', '37', '22.9'], ['UK 5', '38', '23.7'], ['UK 6', '39', '24.6'],
    ['UK 7', '40.5', '25.4'], ['UK 8', '42', '26.2'], ['UK 9', '43', '27.1'], ['UK 10', '44.5', '27.9']] },
  waist: { title: 'Trousers and jeans', head: ['Waist size', 'Waist (cm)', 'Waist (inches)'], rows: [
    ['28', '71', '28'], ['30', '76', '30'], ['32', '81', '32'], ['34', '86', '34'], ['36', '91', '36'],
    ['38', '97', '38'], ['40', '102', '40'], ['42', '107', '42'], ['44', '112', '44']] },
};

function guideKeyFor(category) {
  if (category === 'Footwear') return 'footwear';
  if (category === 'Trousers' || category === 'Jeans') return 'waist';
  return 'apparel';
}

function sizeGuideHtml(activeKey, mine) {
  return `
    <div class="segmented" role="group" aria-label="Size chart" style="margin-bottom:16px">
      ${Object.entries(SIZE_GUIDE).map(([k, g]) => `<button type="button" data-guide="${k}" aria-pressed="${k === activeKey}">${k === 'apparel' ? 'Tops' : k === 'footwear' ? 'Shoes' : 'Waist'}</button>`).join('')}
    </div>
    ${Object.entries(SIZE_GUIDE).map(([k, g]) => `
      <div data-guide-table="${k}" ${k === activeKey ? '' : 'hidden'}>
        <h3 style="margin-bottom:8px">${esc(g.title)}</h3>
        <table class="size-guide-table"><thead><tr>${g.head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${g.rows.map((r) => `<tr class="${mine && r[0] === mine ? 'mine' : ''}">${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table>
      </div>`).join('')}
    <p class="small muted" style="margin-top:16px">Measure your body, not a garment. Second-hand pieces can have shrunk or stretched a little, so the description notes anything that fits differently from its label.</p>`;
}

function bindSizeGuide(root) {
  root.querySelectorAll('[data-guide]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-guide]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.querySelectorAll('[data-guide-table]').forEach((t) => { t.hidden = t.dataset.guideTable !== b.dataset.guide; });
  }));
}

function openSizeGuide(category, mine) {
  const s = openSheet({ title: 'Size guide', body: sizeGuideHtml(guideKeyFor(category), mine), label: 'size guide' });
  bindSizeGuide(s.el);
}

function conditionGuideHtml(current) {
  return `<p class="muted">Every piece is checked by hand before it is listed. The grade tells you how much wear to expect; any specific mark is written in the description.</p>
    <div class="list" style="margin-top:16px">${Object.entries(CONDITIONS).map(([name, c]) => `
      <div class="list-item" ${current === name ? 'style="background:var(--pine-soft)"' : ''}>${conditionMeter(name, { label: false })}<div><strong>${esc(name)}</strong><div class="small muted">${esc(c.meaning)}</div></div></div>`).join('')}</div>`;
}

function openConditionGuide(current) {
  openSheet({ title: 'How we grade condition', body: conditionGuideHtml(current), variant: 'center', label: 'condition guide' });
}

/* ----------------------------- Compare ----------------------------- */

route(/^\/compare$/, async (view) => {
  setTitle('Compare');
  const ids = compare.ids();
  if (!ids.length) {
    view.innerHTML = `<div class="container">${emptyState({ icon: 'columns-3', title: 'Nothing to compare yet', text: 'Tap the compare button on up to three pieces, then come back here to see them side by side.', actions: '<a class="btn btn-primary" href="#/shop">Browse the shop</a>' })}</div>`;
    return;
  }
  const { products } = await api('/products/by-ids?ids=' + ids.join(','));
  const cheapest = Math.min(...products.map((p) => p.price));
  const bestGrade = Math.max(...products.map((p) => (CONDITIONS[p.condition] || {}).level || 0));
  const row = (label, fn) => `<tr><th scope="row">${label}</th>${products.map((p) => `<td>${fn(p)}</td>`).join('')}</tr>`;
  view.innerHTML = `
    <div class="container page">
      <div class="page-head"><div><h1>Compare</h1><p>${plural(products.length, 'piece')} side by side.</p></div><button type="button" class="btn btn-secondary btn-sm" id="clear-compare">Clear all</button></div>
      <div class="panel compare-wrap">
        <table class="compare-table">
          <thead><tr><td></td>${products.map((p) => `<td><a href="#/product/${p.id}"><img src="${esc(p.image)}" alt=""></a></td>`).join('')}</tr></thead>
          <tbody>
            ${row('Piece', (p) => `<a href="#/product/${p.id}"><span class="muted small">${esc(p.brand)}</span><br><strong>${esc(p.name)}</strong></a>`)}
            ${row('Price', (p) => `${priceHtml(p)}${p.price === cheapest && products.length > 1 ? '<br><span class="best small">Lowest price</span>' : ''}`)}
            ${row('Saving', (p) => (p.onSale ? `${money(p.originalPrice - p.price)} (${p.percentOff}% off)` : '<span class="faint">Full price</span>'))}
            ${row('Condition', (p) => `${conditionMeter(p.condition)}${(CONDITIONS[p.condition] || {}).level === bestGrade && products.length > 1 ? '<br><span class="best small">Best condition</span>' : ''}`)}
            ${row('Category', (p) => esc(p.category))}
            ${row('Sizes in stock', (p) => (p.inStock ? esc(p.sizes.map((s) => s.size).join(', ')) : '<span class="faint">Sold out</span>'))}
            ${row('', (p) => `<div class="stack"><a class="btn btn-primary btn-sm btn-block" href="#/product/${p.id}">View piece</a><button type="button" class="btn btn-ghost btn-sm btn-block" data-remove="${p.id}">Remove</button></div>`)}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('clear-compare').addEventListener('click', () => { compare.clear(); router(); });
  view.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { compare.toggle(Number(b.dataset.remove)); router(); }));
});

/* ----------------------------- Cart ----------------------------- */

function freeDeliveryMeter(amount, threshold) {
  const pct = Math.min(100, Math.round((amount / threshold) * 100));
  return `<div class="progress" role="progressbar" aria-label="Progress to free standard delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <p class="small muted" style="margin:0">${amount >= threshold ? 'Standard delivery is free on this order.' : `Add ${money(threshold - amount)} more for free standard delivery.`}</p>`;
}

route(/^\/cart$/, async (view) => {
  setTitle('Your bag');
  if (!requireCustomer(view)) return;
  const [cart, options] = await Promise.all([api('/cart'), loadOptions()]);
  if (!cart.items.length) {
    view.innerHTML = `<div class="container">${emptyState({ icon: 'shopping-bag', title: 'Your bag is empty', text: 'Pieces are one of a kind, and adding one to your bag does not hold it, so check out soon once you find something.', actions: `<a class="btn btn-primary" href="#/shop">Start shopping</a>${state.wishlist.size ? '<a class="btn btn-secondary" href="#/wishlist">Open your wishlist</a>' : ''}` })}</div>`;
    return;
  }
  const problems = cart.items.filter((i) => i.quantity > i.stock);
  view.innerHTML = `
    <div class="container page">
      <div class="page-head"><div><h1>Your bag</h1><p>${plural(cart.itemCount, 'piece')}. Adding to your bag does not reserve stock.</p></div></div>
      <div class="two-col">
        <div class="panel">
          ${problems.length ? `<div class="callout bad" role="alert" style="margin-bottom:16px">${icon('circle-alert', { size: 18 })}<p>${problems.length === 1 ? 'One piece' : `${problems.length} pieces`} changed since you added ${problems.length === 1 ? 'it' : 'them'}. Fix the lines marked below to check out.</p></div>` : ''}
          ${cart.items.map((i) => `
            <div class="line">
              <a class="line-thumb" href="#/product/${i.productId}"><img src="${esc(i.image)}" alt=""></a>
              <div>
                <a class="line-title" href="#/product/${i.productId}">${esc(i.name)}</a>
                <div class="line-sub">${i.size ? `Size ${esc(i.size)}, ` : ''}${money(i.price)} each</div>
                ${i.stock === 0 ? `<div class="line-note" style="color:var(--bad)">Sold out. <button type="button" class="link danger" data-remove="${i.id}">Remove it</button></div>`
                  : i.quantity > i.stock ? `<div class="line-note" style="color:var(--bad)">Only ${i.stock} left in this size. <button type="button" class="link danger" data-fix="${i.id}" data-to="${i.stock}">Reduce to ${i.stock}</button></div>`
                  : i.stock <= 1 ? `<div class="line-note" style="color:var(--warn)">Last one in this size.</div>` : ''}
                <div class="line-actions">
                  ${i.stock > 0 ? `<div class="qty" aria-label="Quantity of ${esc(i.name)}">
                    <button type="button" data-step="${i.id}" data-to="${i.quantity - 1}" aria-label="One fewer" ${i.quantity <= 1 ? 'disabled' : ''}>${icon('minus', { size: 16 })}</button>
                    <span>${i.quantity}</span>
                    <button type="button" data-step="${i.id}" data-to="${i.quantity + 1}" aria-label="One more" ${i.quantity >= i.stock ? 'disabled' : ''}>${icon('plus', { size: 16 })}</button></div>` : ''}
                  <button type="button" class="link quiet small" data-later="${i.id}" data-product="${i.productId}">Save for later</button>
                  <button type="button" class="link quiet small" data-remove="${i.id}">Remove</button>
                </div>
              </div>
              <div class="line-price">${money(i.price * i.quantity)}</div>
            </div>`).join('')}
        </div>
        <aside class="panel sticky-side" aria-label="Summary">
          <h2 style="font-size:1.125rem;margin-bottom:12px">Summary</h2>
          <div class="summary-row"><span>Subtotal</span><span>${money(cart.subtotal)}</span></div>
          <div class="summary-row"><span>Delivery</span><span class="muted">Chosen at checkout</span></div>
          <div style="margin:8px 0 4px">${freeDeliveryMeter(cart.subtotal, options.freeDeliveryThreshold)}</div>
          <div class="summary-row total"><span>Total so far</span><span>${money(cart.subtotal)}</span></div>
          <p class="small muted" style="margin:8px 0 0">Promo codes and Thrift Points go on at checkout.</p>
          <a class="btn btn-primary btn-lg btn-block" style="margin-top:16px" href="#/checkout" ${problems.length ? 'aria-disabled="true" tabindex="-1" onclick="return false"' : ''}>Check out</a>
          <a class="btn btn-ghost btn-block" style="margin-top:8px" href="#/shop">Keep shopping</a>
        </aside>
      </div>
    </div>`;

  const after = async (msg) => { await refreshCounts(); renderChrome(); if (msg) toast(msg, 'success'); router(); };
  view.querySelectorAll('[data-step], [data-fix]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.step || b.dataset.fix;
    try { await api(`/cart/items/${id}`, { method: 'PUT', body: { quantity: Number(b.dataset.to) } }); await after(); } catch (err) { toast(err.message, 'error'); }
  }));
  view.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    const line = cart.items.find((i) => String(i.id) === b.dataset.remove);
    try {
      await api(`/cart/items/${b.dataset.remove}`, { method: 'DELETE' });
      await refreshCounts();
      renderChrome();
      router();
      toast('Removed from your bag.', '', line && line.stock > 0 ? { label: 'Undo', onClick: async () => { try { await api('/cart/items', { method: 'POST', body: { productId: line.productId, quantity: line.quantity, size: line.size } }); await after(); } catch (err) { toast(err.message, 'error'); } } } : null);
    } catch (err) { toast(err.message, 'error'); }
  }));
  view.querySelectorAll('[data-later]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api('/wishlist', { method: 'POST', body: { productId: Number(b.dataset.product) } });
      await api(`/cart/items/${b.dataset.later}`, { method: 'DELETE' });
      await after('Moved to your wishlist.');
    } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Checkout ----------------------------- */

route(/^\/checkout$/, async (view) => {
  setTitle('Checkout');
  if (!requireCustomer(view)) return;
  const [cart, options, { addresses }, pts] = await Promise.all([api('/cart'), loadOptions(), api('/addresses'), api('/account/points')]);
  if (!cart.items.length) { go('#/cart'); return; }
  if (cart.items.some((i) => i.quantity > i.stock)) { toast('Something in your bag changed. Check it before paying.', 'error'); go('#/cart'); return; }

  const choice = {
    deliveryMethod: 'standard',
    addressId: (addresses.find((a) => a.isDefault) || addresses[0] || {}).id || null,
    promoCode: '',
    points: 0,
    collectionDate: null,
    collectionSlot: null,
    method: 'card',
  };
  const maxBlocks = Math.floor(pts.balance / options.points.block);

  view.innerHTML = `
    <div class="container page">
      <a class="back-link" href="#/cart">${icon('chevron-left', { size: 18 })}Bag</a>
      <h1 style="margin-bottom:24px">Checkout</h1>
      <form id="checkout" class="two-col" novalidate>
        <div>
          <section class="panel step" aria-labelledby="s1">
            <div class="step-head"><span class="step-num" aria-hidden="true">1</span><h2 id="s1" style="font-size:1.125rem">Delivery</h2></div>
            ${options.deliveryMethods.map((m) => `
              <label class="option"><input type="radio" name="deliveryMethod" value="${m.id}" ${m.id === choice.deliveryMethod ? 'checked' : ''}>
                <span class="grow"><span class="opt-title"><span>${esc(m.label)}</span><span class="num">${m.fee ? money(m.fee) : 'Free'}</span></span>
                <span class="opt-sub">${m.id === 'collection' ? 'Ready from' : 'Arrives'} ${esc(m.arrives.label)}${m.freeOverThreshold ? `. Free from ${money(options.freeDeliveryThreshold)}` : ''}</span></span></label>`).join('')}
          </section>

          <section class="panel step" id="address-step" aria-labelledby="s2">
            <div class="step-head"><span class="step-num" aria-hidden="true">2</span><h2 id="s2" style="font-size:1.125rem">Address</h2><a class="link small" style="margin-left:auto" href="#/addresses">Manage</a></div>
            ${addresses.length ? addresses.map((a) => `
              <label class="option"><input type="radio" name="addressId" value="${a.id}" ${a.id === choice.addressId ? 'checked' : ''}>
                <span class="grow"><span class="opt-title"><span>${esc(a.label)}${a.isDefault ? ' <span class="pill" style="margin-left:6px">Default</span>' : ''}</span></span>
                <span class="opt-sub">${esc([a.recipient, a.line1, a.suburb, a.city, a.postalCode].filter(Boolean).join(', '))}</span></span></label>`).join('')
              : `<div class="callout info">${icon('map-pin', { size: 18 })}<p>No saved address yet. <a class="link" href="#/addresses?return=checkout">Add a delivery address</a>, or choose collection from the store.</p></div>`}
            <div class="field" style="margin:16px 0 0"><label for="instructions">Delivery instructions (optional)</label><input class="input" id="instructions" name="instructions" maxlength="200" placeholder="For example, leave it with the guard at the gate"></div>
          </section>

          <section class="panel step" id="collect-step" aria-labelledby="s2c" hidden>
            <div class="step-head"><span class="step-num" aria-hidden="true">2</span><h2 id="s2c" style="font-size:1.125rem">Collection time</h2></div>
            <p class="muted small">Collect from iTHRIFT Clothes, ${esc(options.collection.address)}. Bring your order number.</p>
            <div class="label" id="day-label">Day</div>
            <div class="slot-grid" role="radiogroup" aria-labelledby="day-label">${options.collection.dates.map((d) => `<button type="button" class="slot" role="radio" aria-checked="false" data-date="${d}">${esc(ithriftCalendar.label(d).split(' ')[0])}<small>${esc(ithriftCalendar.label(d).split(' ').slice(1).join(' '))}</small></button>`).join('')}</div>
            <div class="label" id="slot-label" style="margin-top:16px">Time</div>
            <div class="segmented" role="radiogroup" aria-labelledby="slot-label" style="flex-wrap:wrap">${options.collection.slots.map((s) => `<button type="button" role="radio" aria-checked="false" aria-pressed="false" data-slot="${esc(s)}">${esc(s)}</button>`).join('')}</div>
            <div class="field-error" id="slot-err" hidden></div>
          </section>

          <section class="panel step" aria-labelledby="s3">
            <div class="step-head"><span class="step-num" aria-hidden="true">3</span><h2 id="s3" style="font-size:1.125rem">Is it a gift?</h2></div>
            <label class="check"><input type="checkbox" id="is-gift"> <span>This is a gift. We will leave the prices off the slip in the parcel.</span></label>
            <div class="field" id="gift-msg-field" hidden style="margin:8px 0 0"><label for="gift-msg">Gift message (optional)</label><textarea class="textarea" id="gift-msg" maxlength="200" placeholder="Happy birthday!"></textarea><div class="hint"><span id="gift-count">0</span> of 200 characters</div></div>
          </section>

          <section class="panel step" aria-labelledby="s4">
            <div class="step-head"><span class="step-num" aria-hidden="true">4</span><h2 id="s4" style="font-size:1.125rem">Payment</h2></div>
            <p class="small muted">Payments are simulated in this version of iTHRIFT. No money changes hands.</p>
            <label class="option"><input type="radio" name="method" value="card" checked><span class="grow"><span class="opt-title">Card</span><span class="opt-sub">Visa or Mastercard</span></span></label>
            <label class="option"><input type="radio" name="method" value="payfast"><span class="grow"><span class="opt-title">PayFast</span><span class="opt-sub">Instant EFT, SnapScan or Zapper</span></span></label>
            <label class="option"><input type="radio" name="method" value="eft"><span class="grow"><span class="opt-title">Bank transfer (EFT)</span><span class="opt-sub">We pack your order once the money clears</span></span></label>
          </section>
        </div>

        <aside class="panel sticky-side" aria-label="Order summary">
          <h2 style="font-size:1.125rem;margin-bottom:12px">Order summary</h2>
          ${cart.items.map((i) => `<div class="summary-row"><span>${i.quantity > 1 ? `${i.quantity} x ` : ''}${esc(i.name)}${i.size ? `, ${esc(i.size)}` : ''}</span><span>${money(i.price * i.quantity)}</span></div>`).join('')}
          <div id="quote" aria-live="polite"></div>
          <div class="divider"></div>
          <label class="label" for="promo">Promo code</label>
          <div class="promo-row"><input class="input" id="promo" autocomplete="off" maxlength="30" placeholder="For example STUDENT15"><button type="button" class="btn btn-secondary" id="apply-promo">Apply</button></div>
          <div id="promo-msg" class="small" style="margin-top:6px" aria-live="polite"></div>
          ${maxBlocks > 0 ? `
            <label class="label" for="points" style="margin-top:16px">Thrift Points <span class="muted" style="font-weight:400">(you have ${pts.balance})</span></label>
            <select class="select" id="points">
              <option value="0">Do not use points</option>
              ${Array.from({ length: Math.min(maxBlocks, 30) }, (_, i) => (i + 1) * options.points.block).map((n) => `<option value="${n}">${n} points for ${money((n / options.points.block) * options.points.randPerBlock)} off</option>`).join('')}
            </select>` : `<p class="small muted" style="margin-top:16px">You have ${pts.balance} Thrift Points. Spend them once you reach ${options.points.block}.</p>`}
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="place" style="margin-top:20px">Place order</button>
          <p class="tiny muted" style="margin:8px 0 0">You earn a Thrift Point for every R10 once your order is delivered.</p>
        </aside>
      </form>
    </div>`;

  const form = document.getElementById('checkout');
  const quoteEl = document.getElementById('quote');
  const place = document.getElementById('place');
  const promoMsg = document.getElementById('promo-msg');

  async function refreshQuote() {
    try {
      const q = await api('/orders/quote', { method: 'POST', body: { deliveryMethod: choice.deliveryMethod, promoCode: choice.promoCode || undefined, pointsToRedeem: choice.points } });
      quoteEl.innerHTML = `
        <div class="divider"></div>
        <div class="summary-row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
        ${q.discount ? `<div class="summary-row discount"><span>${esc(q.promo.code)}</span><span>-${money(q.discount)}</span></div>` : ''}
        ${q.pointsDiscount ? `<div class="summary-row discount"><span>${q.pointsRedeemed} Thrift Points</span><span>-${money(q.pointsDiscount)}</span></div>` : ''}
        <div class="summary-row"><span>Delivery</span><span>${q.deliveryFee ? money(q.deliveryFee) : 'Free'}</span></div>
        ${choice.deliveryMethod === 'standard' && q.freeDeliveryRemaining ? `<div style="margin:4px 0 8px">${freeDeliveryMeter(options.freeDeliveryThreshold - q.freeDeliveryRemaining, options.freeDeliveryThreshold)}</div>` : ''}
        <div class="summary-row total"><span>Total</span><span>${money(q.total)}</span></div>
        <p class="tiny muted" style="margin:4px 0 0">Includes ${money(q.total - q.total / 1.15, { cents: true })} VAT.</p>`;
      place.textContent = `Place order, ${money(q.total)}`;
      return true;
    } catch (err) {
      if (choice.promoCode) {
        promoMsg.innerHTML = `<span style="color:var(--bad)">${esc(err.message)}</span>`;
        choice.promoCode = '';
        await refreshQuote();
        return false;
      }
      if (choice.points) {
        toast(err.message, 'error');
        choice.points = 0;
        const sel = document.getElementById('points');
        if (sel) sel.value = '0';
        await refreshQuote();
        return false;
      }
      quoteEl.innerHTML = `<div class="callout bad" style="margin-top:12px">${icon('circle-alert', { size: 18 })}<p>${esc(err.message)}</p></div>`;
      return false;
    }
  }

  form.querySelectorAll('input[name="deliveryMethod"]').forEach((r) => r.addEventListener('change', () => {
    choice.deliveryMethod = r.value;
    const collect = r.value === 'collection';
    document.getElementById('address-step').hidden = collect;
    document.getElementById('collect-step').hidden = !collect;
    refreshQuote();
  }));
  form.querySelectorAll('input[name="addressId"]').forEach((r) => r.addEventListener('change', () => { choice.addressId = Number(r.value); }));
  form.querySelectorAll('input[name="method"]').forEach((r) => r.addEventListener('change', () => { choice.method = r.value; }));
  form.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => {
    choice.collectionDate = b.dataset.date;
    form.querySelectorAll('[data-date]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    document.getElementById('slot-err').hidden = true;
  }));
  form.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    choice.collectionSlot = b.dataset.slot;
    form.querySelectorAll('[data-slot]').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
    document.getElementById('slot-err').hidden = true;
  }));
  const gift = document.getElementById('is-gift');
  gift.addEventListener('change', () => { document.getElementById('gift-msg-field').hidden = !gift.checked; });
  document.getElementById('gift-msg').addEventListener('input', (e) => { document.getElementById('gift-count').textContent = e.target.value.length; });
  document.getElementById('points')?.addEventListener('change', (e) => { choice.points = Number(e.target.value); refreshQuote(); });

  const applyPromo = async () => {
    const code = document.getElementById('promo').value.trim();
    if (!code) { promoMsg.innerHTML = '<span style="color:var(--bad)">Type a promo code first.</span>'; return; }
    choice.promoCode = code;
    promoMsg.textContent = '';
    if (await refreshQuote()) promoMsg.innerHTML = `<span style="color:var(--good)">${esc(code.toUpperCase())} applied.</span>`;
  };
  document.getElementById('apply-promo').addEventListener('click', applyPromo);
  document.getElementById('promo').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });

  await refreshQuote();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (choice.deliveryMethod === 'collection' && (!choice.collectionDate || !choice.collectionSlot)) {
      const err = document.getElementById('slot-err');
      err.hidden = false;
      err.innerHTML = `${icon('circle-alert', { size: 14 })}<span>Choose a day and a time to collect.</span>`;
      document.getElementById('collect-step').scrollIntoView({ block: 'center' });
      return;
    }
    if (choice.deliveryMethod !== 'collection' && !addresses.length) {
      toast('Add a delivery address first, or choose collection.', 'error');
      return;
    }
    busy(place, async () => {
      try {
        const { order } = await api('/orders', {
          method: 'POST',
          body: {
            method: choice.method,
            deliveryMethod: choice.deliveryMethod,
            addressId: choice.deliveryMethod === 'collection' ? undefined : (choice.addressId || undefined),
            instructions: choice.deliveryMethod === 'collection' ? undefined : (form.instructions.value || undefined),
            collectionDate: choice.deliveryMethod === 'collection' ? choice.collectionDate : undefined,
            collectionSlot: choice.deliveryMethod === 'collection' ? choice.collectionSlot : undefined,
            isGift: gift.checked,
            giftMessage: gift.checked ? document.getElementById('gift-msg').value : undefined,
            promoCode: choice.promoCode || undefined,
            pointsToRedeem: choice.points || undefined,
          },
        });
        await refreshCounts();
        go('#/order-placed/' + order.id);
      } catch (err) { toast(err.message, 'error'); }
    }, 'Placing order');
  });
});

/* ----------------------------- Order placed ----------------------------- */

route(/^\/(?:order-placed|order-confirmation)\/(\d+)$/, async (view, [id]) => {
  if (!requireLogin()) return;
  const { order } = await api(`/orders/${id}`);
  setTitle('Order placed');
  const firstName = order.customer.name.split(' ')[0];
  const willEarn = Math.floor(order.total / 10);
  view.innerHTML = `
    <div class="container narrow">
      <div class="confirm-hero">
        <div class="confirm-mark">${icon('check', { size: 36, stroke: 2.5 })}</div>
        <h1>Thank you, ${esc(firstName)}.</h1>
        <p>Your order <strong>${esc(order.ref)}</strong> is in. ${order.collectionDate
          ? `Collect it on ${esc(ithriftCalendar.label(order.collectionDate))}, ${esc(order.collectionSlot)}.`
          : order.nextStep ? `We will ship it by ${esc(ithriftCalendar.label(order.nextStep.date))}.` : ''}</p>
      </div>
      <div class="panel">
        ${order.items.map((i) => `<div class="summary-row"><span>${i.quantity > 1 ? `${i.quantity} x ` : ''}${esc(i.name)}${i.size ? `, ${esc(i.size)}` : ''}</span><span>${money(i.lineTotal)}</span></div>`).join('')}
        ${orderTotals(order)}
        <div class="divider"></div>
        <div class="summary-row"><span>Payment</span><span>${esc(paymentLabel(order.payment))}</span></div>
        <div class="summary-row"><span>${order.deliveryMethod === 'collection' ? 'Collection' : 'Deliver to'}</span><span style="max-width:60%">${esc(order.deliveryAddress || '')}</span></div>
      </div>
      ${order.payment.status === 'pending' ? `<div class="callout warn" style="margin-top:16px">${icon('clock', { size: 18 })}<p>Pay by EFT using ${esc(order.ref)} as the reference. We start packing once the money clears.</p></div>` : ''}
      <div class="callout good" style="margin-top:16px">${icon('coins', { size: 18 })}<p>You will earn ${willEarn} Thrift Points when this order is delivered.</p></div>
      <div class="row wrap" style="justify-content:center;margin-top:24px">
        <a class="btn btn-primary" href="#/orders/${order.id}">Track this order</a>
        <a class="btn btn-secondary" href="#/shop">Keep shopping</a>
      </div>
    </div>`;
});

function paymentLabel(p) {
  const names = { card: 'Card', payfast: 'PayFast', eft: 'EFT' };
  const status = { paid: 'paid', pending: 'waiting for payment', refunded: 'refunded' };
  return `${names[p.method] || p.method}, ${status[p.status] || p.status}`;
}

function orderTotals(order) {
  return `
    <div class="divider"></div>
    <div class="summary-row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
    ${order.discount ? `<div class="summary-row discount"><span>${esc(order.promoCode || 'Promo')}</span><span>-${money(order.discount)}</span></div>` : ''}
    ${order.pointsDiscount ? `<div class="summary-row discount"><span>${order.pointsRedeemed} Thrift Points</span><span>-${money(order.pointsDiscount)}</span></div>` : ''}
    <div class="summary-row"><span>${esc(order.deliveryLabel)}</span><span>${order.deliveryFee ? money(order.deliveryFee) : 'Free'}</span></div>
    <div class="summary-row total"><span>Total</span><span>${money(order.total)}</span></div>`;
}

/* ----------------------------- Wishlist ----------------------------- */

route(/^\/wishlist$/, async (view) => {
  setTitle('Wishlist');
  if (!requireCustomer(view)) return;
  const { items } = await api('/wishlist');
  state.wishlist = new Set(items.map((i) => i.productId));
  if (!items.length) {
    view.innerHTML = `<div class="container">${emptyState({ icon: 'heart', title: 'Nothing saved yet', text: 'Tap the heart on any piece to keep it here. We will tell you if its price drops.', actions: '<a class="btn btn-primary" href="#/shop">Browse the shop</a>' })}</div>`;
    return;
  }
  const drops = items.filter((i) => i.priceDrop > 0);
  view.innerHTML = `
    <div class="container page">
      <div class="page-head"><div><h1>Wishlist</h1><p>${plural(items.length, 'saved piece')}. Saving does not hold a piece, and each one is one of a kind.</p></div></div>
      ${drops.length ? `<div class="callout sale" style="margin-bottom:16px">${icon('badge-percent', { size: 18 })}<p>${drops.length === 1 ? 'One piece has' : `${drops.length} pieces have`} dropped in price since you saved ${drops.length === 1 ? 'it' : 'them'}.</p></div>` : ''}
      <div class="panel">
        ${items.map((i) => `
          <div class="line">
            <a class="line-thumb" href="#/product/${i.productId}"><img src="${esc(i.image)}" alt=""></a>
            <div>
              <span class="small muted">${esc(i.brand)}</span><br>
              <a class="line-title" href="#/product/${i.productId}">${esc(i.name)}</a>
              <div class="line-sub" style="margin-top:4px">${priceHtml(i)}</div>
              <div class="row wrap" style="margin-top:6px">
                ${i.priceDrop > 0 ? `<span class="pill sale">${icon('badge-percent', { size: 12 })}${money(i.priceDrop)} less than when you saved it</span>` : ''}
                ${i.inStock ? `<span class="small muted">${i.onlySize ? `Size ${esc(i.onlySize)}` : `${i.sizeCount} sizes`}</span>` : '<span class="pill bad">Sold out</span>'}
              </div>
              <div class="line-actions">
                ${i.inStock ? `<button type="button" class="btn btn-primary btn-sm" data-move="${i.productId}" data-size="${esc(i.onlySize || '')}">${i.onlySize ? 'Move to bag' : 'Choose a size'}</button>`
                  : `<button type="button" class="btn btn-secondary btn-sm" data-alert="${i.productId}">${icon('bell', { size: 16 })}Tell me if it is back</button>`}
                <button type="button" class="link quiet small" data-unsave="${i.productId}">Remove</button>
              </div>
            </div>
            <div class="line-price">${money(i.price)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  view.querySelectorAll('[data-unsave]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.dataset.unsave);
    try {
      await api(`/wishlist/${id}`, { method: 'DELETE' });
      await refreshCounts();
      router();
      toast('Removed from your wishlist.', '', { label: 'Undo', onClick: async () => { await api('/wishlist', { method: 'POST', body: { productId: id } }); await refreshCounts(); router(); } });
    } catch (err) { toast(err.message, 'error'); }
  }));
  view.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => stockAlert(Number(b.dataset.alert), null)));
  view.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.dataset.move);
    if (!b.dataset.size) { go('#/product/' + id); return; }
    busy(b, async () => {
      try {
        await api('/cart/items', { method: 'POST', body: { productId: id, quantity: 1, size: b.dataset.size } });
        await api(`/wishlist/${id}`, { method: 'DELETE' });
        await refreshCounts();
        toast('Moved to your bag.', 'success', { label: 'View bag', href: '#/cart' });
        router();
      } catch (err) { toast(err.message, 'error'); }
    }, 'Moving');
  }));
});
