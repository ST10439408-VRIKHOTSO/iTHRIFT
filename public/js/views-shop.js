'use strict';

/* ----------------------------- Shop / catalogue ----------------------------- */

async function renderShop(view, query) {
  const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
  const data = await api('/products?' + params.toString());
  const products = data.products;

  const brandOptions = state.brands.map(b => `<option value="${escapeHtml(b.name)}" ${query.brand === b.name ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
  const conditions = ['Excellent', 'Very Good', 'Good', 'Fair'];
  const conditionOptions = conditions.map(c => `<option value="${c}" ${query.condition === c ? 'selected' : ''}>${c}</option>`).join('');

  const isHome = Object.keys(query).length === 0;
  const totalCount = data.totalCount ?? products.length;

  const categoryChips = [{ name: 'All' }, ...state.categories].map(c => {
    const isAll = c.name === 'All';
    const active = isAll ? !query.category : query.category === c.name;
    const href = isAll ? buildHash('shop') : buildHash('shop', { ...query, category: c.name });
    return `<a class="chip-filter ${active ? 'active' : ''}" href="${href}">${escapeHtml(c.name)}</a>`;
  }).join('');

  view.innerHTML = `
    ${isHome ? `
    <div class="container hero">
      <div class="eyebrow">The catalogue</div>
      <h1>Pre-loved pieces, ready to be <span style="font-weight:400">re-worn.</span></h1>
      <p class="hero-sub">${totalCount} piece${totalCount === 1 ? '' : 's'} available, every listing condition-rated by the iTHRIFT team.</p>
    </div>
    <div class="container">
      <div class="select-bar">
        <span>Select items below and add them to your cart</span>
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="pill-btn" href="${buildHash('shop', { onSale: 'true' })}">Shop the sale</a>
          <a class="pill-btn dark" href="#/cart">Show Cart${state.cartCount ? `<span class="cart-badge">${state.cartCount}</span>` : ''}</a>
        </span>
      </div>
    </div>` : ''}

    <div class="container section" style="padding-top:${isHome ? '4px' : '40px'}">
      <div class="chip-filter-row">
        ${categoryChips}
        <form id="search-form" style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
          <input type="text" name="q" aria-label="Search products by brand or name" placeholder="Search brand or piece&hellip;" value="${escapeHtml(query.q || '')}" style="border:1.5px solid var(--border);border-radius:999px;padding:9px 16px;background:var(--surface);font-size:14px;min-width:200px;outline:none">
          <button class="pill-btn" type="submit" style="border-color:var(--border)">Search</button>
        </form>
      </div>

      <details style="margin-bottom:18px">
        <summary class="small" style="cursor:pointer;font-weight:700;color:var(--ink);user-select:none">More filters (brand, condition, price, sort)</summary>
        <form id="filter-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px;padding:16px;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--surface)">
          <input type="hidden" name="q" value="${escapeHtml(query.q || '')}">
          ${query.category ? `<input type="hidden" name="category" value="${escapeHtml(query.category)}">` : ''}
          <select name="brand" style="border:1.5px solid var(--border);border-radius:999px;padding:9px 16px;background:var(--surface);font-size:14px"><option value="">All brands</option>${brandOptions}</select>
          <select name="condition" style="border:1.5px solid var(--border);border-radius:999px;padding:9px 16px;background:var(--surface);font-size:14px"><option value="">Any condition</option>${conditionOptions}</select>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" name="minPrice" placeholder="Min R" value="${escapeHtml(query.minPrice || '')}" style="width:90px;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-size:14px">
            <span style="color:var(--muted)">&ndash;</span>
            <input type="number" name="maxPrice" placeholder="Max R" value="${escapeHtml(query.maxPrice || '')}" style="width:90px;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-size:14px">
          </div>
          <select name="sort" style="border:1.5px solid var(--border);border-radius:999px;padding:9px 16px;background:var(--surface);font-size:14px">
            <option value="">Sort: featured</option>
            <option value="price_asc" ${query.sort === 'price_asc' ? 'selected' : ''}>Price: low to high</option>
            <option value="price_desc" ${query.sort === 'price_desc' ? 'selected' : ''}>Price: high to low</option>
            <option value="newest" ${query.sort === 'newest' ? 'selected' : ''}>Newest</option>
          </select>
          <label class="small" style="display:flex;align-items:center;gap:6px;white-space:nowrap">
            <input type="checkbox" name="inStock" value="true" ${query.inStock === 'true' ? 'checked' : ''}> In stock only
          </label>
          <label class="small" style="display:flex;align-items:center;gap:6px;white-space:nowrap">
            <input type="checkbox" name="onSale" value="true" ${query.onSale === 'true' ? 'checked' : ''}> On sale only
          </label>
          <button class="pill-btn dark" type="submit">Apply</button>
          ${Object.keys(query).length ? `<a class="muted-link" href="#/shop">Clear filters</a>` : ''}
        </form>
      </details>

      <div class="flex-between" style="margin-bottom:20px">
        <h2 style="margin:0;font-size:20px">${query.onSale === 'true' ? 'On sale' : query.category ? escapeHtml(query.category) : query.brand ? escapeHtml(query.brand) : 'All products'}</h2>
        <span class="small">${products.length} item${products.length === 1 ? '' : 's'}</span>
      </div>

      ${products.length === 0 ? `<div class="empty-state"><h3>No products match those filters</h3><p>Try widening your search.</p></div>` : `
      <div class="grid">
        ${products.map(productCard).join('')}
      </div>`}
    </div>
  `;

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = { ...query };
    const q = fd.get('q');
    if (q) next.q = q; else delete next.q;
    location.hash = buildHash('shop', next);
  });

  document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = {};
    for (const [k, v] of fd.entries()) if (v) next[k] = v;
    location.hash = buildHash('shop', next);
  });

  view.querySelectorAll('[data-quick-add]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const productId = btn.dataset.quickAdd;
    // A piece stocked in more than one size needs the shopper to pick one.
    if (Number(btn.dataset.sizeCount) > 1) {
      location.hash = '#/product/' + productId;
      return;
    }
    if (!requireLogin('/shop')) return;
    if (state.user.type !== 'customer') return toast('Only customer accounts can shop. Sign in with a customer account.', 'error');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    try {
      await api('/cart/items', { method: 'POST', body: { productId, quantity: 1 } });
      toast('Added to your cart.', 'success');
      await refreshCartCount();
      renderNav();
      btn.innerHTML = 'Added';
      setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 1200);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }));

  bindWishButtons(view);
}

function productCard(p) {
  return `
    <div class="card" data-product-id="${p.id}">
      <a href="#/product/${p.id}" style="display:block">
        <div class="thumb">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
          ${p.onSale && p.inStock ? `<span class="sale-tag">${p.percentOff}% off</span>` : ''}
          <span class="badge ${p.inStock ? conditionClass(p.condition) : 'out'}" style="text-transform:uppercase;font-size:10px;letter-spacing:0.04em">${p.inStock ? escapeHtml(p.condition).toUpperCase() : 'SOLD OUT'}</span>
        </div>
      </a>
      <div class="body">
        <span class="brand">${escapeHtml(p.brand)}</span>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="meta">${(p.sizes || []).length > 1 ? 'Sizes' : 'Size'} ${escapeHtml(p.size)}${p.sellerName ? ` &middot; by ${escapeHtml(p.sellerName)}` : ''}</span>
        <div class="price-row">
          <span><span class="price-from">${p.onSale ? 'Sale' : 'From'}</span>${priceHtml(p)}</span>
          <span class="small" style="color:var(--muted2)">Qty: ${p.stock}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 14px">
        ${!state.user || state.user.type === 'customer' ? wishButton(p.id, true) : ''}
        <a class="pill-btn" href="#/product/${p.id}" style="flex:1;justify-content:center;padding:9px;font-size:13px">Details</a>
        ${p.inStock
          ? `<button type="button" class="pill-btn quick-add-btn" data-quick-add="${p.id}" data-size-count="${(p.sizes || []).length}" style="flex:1;justify-content:center;padding:9px;font-size:13px;color:var(--muted2)">Add to Cart</button>`
          : `<button type="button" class="pill-btn" disabled style="flex:1;justify-content:center;padding:9px;font-size:13px;opacity:0.4;cursor:not-allowed">Sold out</button>`
        }
      </div>
    </div>
  `;
}

/* ----------------------------- Product detail ----------------------------- */

async function renderProductDetail(view, id) {
  const [{ product }, { reviews }] = await Promise.all([
    api(`/products/${id}`),
    api(`/products/${id}/reviews`),
  ]);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  view.innerHTML = `
    <div class="container product-detail">
      <div class="thumb-lg"><img src="${product.image}" alt="${escapeHtml(product.name)}"></div>
      <div>
        <div class="eyebrow">${escapeHtml(product.brand)}</div>
        <h1>${escapeHtml(product.name)}</h1>
        <h2 style="margin:10px 0 18px">${money(product.price)}${product.onSale ? ` <span class="price-was" style="font-size:16px"><span class="visually-hidden">Was </span>${money(product.originalPrice)}</span> <span class="sale-tag" style="vertical-align:middle">${product.percentOff}% off</span>` : ''}</h2>
        <p>${escapeHtml(product.description)}</p>

        <div class="spec-list">
          <div class="spec-row"><span class="spec-label">Size</span><span class="spec-value">${escapeHtml(product.size)}</span></div>
          <div class="spec-row"><span class="spec-label">Condition</span><span class="badge ${product.inStock ? conditionClass(product.condition) : 'out'}">${escapeHtml(product.condition)}</span></div>
          <div class="spec-row"><span class="spec-label">Category</span><span class="spec-value">${escapeHtml(product.category)}</span></div>
          <div class="spec-row"><span class="spec-label">Stock</span><span class="spec-value">${product.inStock ? `${product.stock} available` : 'Sold out'}</span></div>
          ${avgRating ? `<div class="spec-row"><span class="spec-label">Rating</span><span class="spec-value stars">${avgRating}</span><span class="small">(${reviews.length} review${reviews.length === 1 ? '' : 's'})</span></div>` : ''}
        </div>

        ${product.inStock ? `
          <div style="margin:18px 0 4px">
            <div class="spec-label" id="size-label" style="margin-bottom:8px">Choose a size</div>
            <div role="radiogroup" aria-labelledby="size-label" style="display:flex;flex-wrap:wrap;gap:8px">
              ${product.sizes.map(sz => `<button type="button" class="pill-btn size-btn" role="radio" aria-checked="false" data-size="${escapeHtml(sz.size)}" data-stock="${sz.stock}" style="min-width:56px;justify-content:center;padding:8px 14px">${escapeHtml(sz.size)}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:14px;margin:16px 0">
            <div class="qty-stepper">
              <button type="button" id="qty-minus" aria-label="Decrease quantity">&minus;</button>
              <span id="qty-val" aria-live="polite">1</span>
              <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
            </div>
            <span class="small" id="size-stock">${product.sizes.length === 1 ? `${product.sizes[0].stock} in size ${escapeHtml(product.sizes[0].size)}` : 'Pick a size to see stock'}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="pill-btn dark" id="add-to-cart-btn">Add to Cart: ${money(product.price)}</button>
            ${!state.user || state.user.type === 'customer' ? wishButton(product.id) : ''}
            <a class="pill-btn" href="#/shop">&#8592; Back</a>
          </div>
        ` : `
          <div class="form-error" style="max-width:340px">This item is currently out of stock. Save it to your wishlist to keep an eye on it.</div>
          <div style="display:flex;gap:10px;margin-top:10px">
            ${!state.user || state.user.type === 'customer' ? wishButton(product.id) : ''}
            <a class="pill-btn" href="#/shop">&#8592; Back</a>
          </div>
        `}
        <div class="spacer-sm"></div>
        <a class="muted-link" href="#/shop?brand=${encodeURIComponent(product.brand)}">More from ${escapeHtml(product.brand)}</a>
      </div>
    </div>

    <div class="container section" style="padding-top:0">
      <h2>Reviews</h2>
      ${reviews.length === 0 ? `<p class="small">No reviews yet. Be the first to share your experience with this item.</p>` : reviews.map(r => `
        <div class="review-card">
          <div class="flex-between">
            <strong>${escapeHtml(r.author)}</strong>
            <span class="stars">${'&starf;'.repeat(r.rating)}${'&star;'.repeat(5 - r.rating)}</span>
          </div>
          ${r.comment ? `<p style="margin-top:6px">${escapeHtml(r.comment)}</p>` : ''}
          <span class="small">${timeAgo(r.createdAt)}</span>
        </div>
      `).join('')}

      <div class="spacer"></div>
      ${state.user && state.user.type === 'customer' ? `
        <div class="form-card" style="margin:0">
          <h3>Write a review</h3>
          <form id="review-form">
            <div class="field">
              <label>Rating</label>
              <select name="rating" required>
                <option value="5">5 (Excellent)</option>
                <option value="4">4 (Good)</option>
                <option value="3">3 (Average)</option>
                <option value="2">2 (Below average)</option>
                <option value="1">1 (Poor)</option>
              </select>
            </div>
            <div class="field">
              <label>Comment (optional)</label>
              <textarea name="comment" placeholder="How did it fit? Was it true to the photos?"></textarea>
            </div>
            <button class="pill-btn dark full-btn" type="submit">Submit review</button>
          </form>
        </div>
      ` : `<p class="small"><a href="#/login?next=${encodeURIComponent('/product/' + id)}">Sign in</a> to write a review.</p>`}
    </div>
  `;

  let qty = 1;
  // With one size left it is chosen already; otherwise the shopper picks one.
  let chosenSize = product.sizes && product.sizes.length === 1 ? product.sizes[0] : null;
  const qtyVal = document.getElementById('qty-val');
  const sizeButtons = view.querySelectorAll('.size-btn');
  const markSize = () => sizeButtons.forEach(b => {
    const on = chosenSize && b.dataset.size === chosenSize.size;
    b.classList.toggle('dark', !!on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  markSize();
  sizeButtons.forEach(b => b.addEventListener('click', () => {
    chosenSize = { size: b.dataset.size, stock: Number(b.dataset.stock) };
    qty = 1; qtyVal.textContent = qty;
    document.getElementById('size-stock').textContent = `${chosenSize.stock} in size ${chosenSize.size}`;
    markSize();
  }));
  const maxQty = () => (chosenSize ? chosenSize.stock : 1);
  document.getElementById('qty-minus')?.addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
  document.getElementById('qty-plus')?.addEventListener('click', () => { qty = Math.min(maxQty(), qty + 1); qtyVal.textContent = qty; });

  document.getElementById('add-to-cart-btn')?.addEventListener('click', async () => {
    if (!requireLogin('/product/' + id)) return;
    if (state.user.type !== 'customer') return toast('Only customer accounts can shop. Sign in with a customer account.', 'error');
    if (!chosenSize) return toast('Choose a size first.', 'error');
    try {
      await api('/cart/items', { method: 'POST', body: { productId: product.id, quantity: qty, size: chosenSize.size } });
      toast(`Added ${qty} x ${product.name} (size ${chosenSize.size}) to your cart.`, 'success');
      await refreshCartCount();
      renderNav();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  bindWishButtons(view);

  document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/products/${id}/reviews`, { method: 'POST', body: { rating: Number(fd.get('rating')), comment: fd.get('comment') } });
      toast('Thanks for your review!', 'success');
      await renderProductDetail(view, id);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ----------------------------- Cart ----------------------------- */

async function renderCartView(view) {
  if (!requireLogin('/cart')) return;
  if (state.user.type !== 'customer') {
    view.innerHTML = `<div class="container section center"><h2>Customer accounts only</h2><p>Staff and administrator accounts don't have a shopping cart.</p></div>`;
    return;
  }

  const cart = await api('/cart');

  view.innerHTML = `
    <div class="container section">
      <h1>Shopping cart</h1>
      ${cart.items.length === 0 ? `
        <div class="empty-state"><h3>Your cart is empty</h3><a class="pill-btn dark" href="#/shop">Continue shopping</a></div>
      ` : `
      <div class="cart-layout">
        <div class="cart-list">
          <div class="small" style="margin-bottom:8px">${cart.items.length} item${cart.items.length === 1 ? '' : 's'}</div>
          ${cart.items.map(cartLine).join('')}
        </div>
        <div class="summary-card">
          <h3>Summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${money(cart.subtotal)}</span></div>
          <div class="summary-row"><span>Delivery</span><span>Chosen at checkout</span></div>
          ${freeDeliveryBar(cart.subtotal)}
          <div class="summary-row total"><span>Total so far</span><span>${money(cart.subtotal)}</span></div>
          <p class="small" style="margin:6px 0 0">Have a promo code? Add it at checkout.</p>
          <a class="pill-btn accent full-btn" href="#/checkout" style="margin-top:14px">Checkout</a>
          <a class="pill-btn full-btn" href="#/shop" style="margin-top:8px">Continue shopping</a>
        </div>
      </div>`}
    </div>
  `;

  view.querySelectorAll('[data-qty-minus]').forEach(btn => btn.addEventListener('click', () => updateCartQty(btn.dataset.qtyMinus, -1, view)));
  view.querySelectorAll('[data-qty-plus]').forEach(btn => btn.addEventListener('click', () => updateCartQty(btn.dataset.qtyPlus, 1, view)));
  view.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/cart/items/${btn.dataset.remove}`, { method: 'DELETE' });
    await refreshCartCount();
    renderCartView(view);
  }));
}

function cartLine(item) {
  return `
    <div class="cart-line">
      <div class="thumb-sm"><img src="${item.image}" alt=""></div>
      <div class="grow">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="small">${item.size ? `Size ${escapeHtml(item.size)} &middot; ` : ''}${money(item.price)} each &middot; ${item.stock} in stock</div>
      </div>
      <div class="qty-stepper">
        <button type="button" data-qty-minus="${item.id}" aria-label="Decrease quantity of ${escapeHtml(item.name)}">&minus;</button>
        <span>${item.quantity}</span>
        <button type="button" data-qty-plus="${item.id}" aria-label="Increase quantity of ${escapeHtml(item.name)}">+</button>
      </div>
      <strong style="width:80px;text-align:right">${money(item.price * item.quantity)}</strong>
      <button type="button" class="muted-link" data-remove="${item.id}" aria-label="Remove ${escapeHtml(item.name)} from cart" style="background:none;border:none">Remove</button>
    </div>
  `;
}

async function updateCartQty(itemId, delta, view) {
  const cart = await api('/cart');
  const item = cart.items.find(i => String(i.id) === String(itemId));
  if (!item) return;
  const newQty = item.quantity + delta;
  try {
    if (newQty < 1) {
      await api(`/cart/items/${itemId}`, { method: 'DELETE' });
    } else {
      await api(`/cart/items/${itemId}`, { method: 'PUT', body: { quantity: newQty } });
    }
    await refreshCartCount();
    renderNav();
    renderCartView(view);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ----------------------------- Checkout ----------------------------- */

const FREE_DELIVERY_FROM = 1000;

function freeDeliveryBar(amount) {
  const pct = Math.min(100, Math.round((amount / FREE_DELIVERY_FROM) * 100));
  const message = amount >= FREE_DELIVERY_FROM
    ? 'You qualify for free standard delivery.'
    : `Add ${money(FREE_DELIVERY_FROM - amount)} more for free standard delivery.`;
  return `<div class="free-bar"><div class="track" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="fill" style="width:${pct}%"></div></div><p>${message}</p></div>`;
}

async function renderCheckout(view) {
  if (!requireLogin('/checkout')) return;
  if (state.user.type !== 'customer') {
    view.innerHTML = `<div class="container section center"><h2>Customer accounts only</h2></div>`;
    return;
  }

  const [cart, options, { addresses }] = await Promise.all([api('/cart'), api('/orders/options'), api('/addresses')]);
  if (cart.items.length === 0) {
    view.innerHTML = `<div class="container section center"><h2>Your cart is empty</h2><a class="pill-btn dark" href="#/shop">Go shopping</a></div>`;
    return;
  }

  const choice = {
    deliveryMethod: 'standard',
    addressId: (addresses.find(a => a.isDefault) || addresses[0] || {}).id || null,
    promoCode: '',
  };

  const addressHtml = addresses.length
    ? addresses.map(a => `
        <label class="pay-option ${a.id === choice.addressId ? 'selected' : ''}" data-choice="address">
          <input type="radio" name="addressId" value="${a.id}" ${a.id === choice.addressId ? 'checked' : ''}>
          <span><strong>${escapeHtml(a.label)}</strong>${a.isDefault ? ' <span class="small">(default)</span>' : ''}<br>
          <span class="small">${escapeHtml([a.recipient, a.line1, a.suburb, a.city, a.postalCode].filter(Boolean).join(', '))}</span></span>
        </label>`).join('')
    : `<p class="small">You have no saved addresses yet. We will use the address on your profile, or you can <a href="#/addresses">add a delivery address</a>.</p>`;

  view.innerHTML = `
    <div class="container section">
      <h1>Checkout</h1>
      <form id="checkout-form" class="cart-layout">
        <div>
          <div class="panel">
            <h3>1. Delivery method</h3>
            ${options.deliveryMethods.map(m => `
              <label class="pay-option ${m.id === choice.deliveryMethod ? 'selected' : ''}" data-choice="delivery">
                <input type="radio" name="deliveryMethod" value="${m.id}" ${m.id === choice.deliveryMethod ? 'checked' : ''}>
                <span><strong>${escapeHtml(m.label)}</strong> &middot; ${m.fee ? money(m.fee) : 'Free'}${m.freeOverThreshold ? ` <span class="small">(free from ${money(options.freeDeliveryThreshold)})</span>` : ''}<br>
                <span class="small">${escapeHtml(m.eta)}</span></span>
              </label>`).join('')}
          </div>

          <div class="panel" id="address-panel">
            <div class="flex-between"><h3 style="margin:0">2. Delivery address</h3><a class="muted-link" href="#/addresses">Manage addresses</a></div>
            <div style="margin-top:12px">${addressHtml}</div>
            <div class="field" style="margin-top:12px">
              <label for="instructions">Delivery instructions (optional)</label>
              <textarea id="instructions" name="instructions" maxlength="200" placeholder="For example: leave with the guard at the gate"></textarea>
            </div>
          </div>
          <div class="panel" id="collect-panel" hidden>
            <h3>2. Collection</h3>
            <p class="small">Collect from iTHRIFT Clothes, Hatfield Plaza, Pretoria. We will email you when your order is ready, usually within 2 working days. Bring your order number.</p>
          </div>

          <div class="panel">
            <h3>3. Payment method</h3>
            <p class="small">Payments are simulated for this prototype, so no money changes hands.</p>
            <label class="pay-option selected" data-choice="pay">
              <input type="radio" name="method" value="card" checked> Credit / debit card
            </label>
            <label class="pay-option" data-choice="pay">
              <input type="radio" name="method" value="payfast"> PayFast
            </label>
            <label class="pay-option" data-choice="pay">
              <input type="radio" name="method" value="eft"> EFT (bank transfer, pending until confirmed)
            </label>
          </div>
        </div>
        <div class="summary-card">
          <h3>Order summary</h3>
          ${cart.items.map(i => `<div class="summary-row"><span>${i.quantity} &times; ${escapeHtml(i.name)}${i.size ? ` (${escapeHtml(i.size)})` : ''}</span><span>${money(i.price * i.quantity)}</span></div>`).join('')}
          <div id="quote-box"></div>
          <label class="small" for="promo-input" style="display:block;margin-top:14px;font-weight:700;color:var(--ink)">Promo code</label>
          <div class="promo-row">
            <input id="promo-input" type="text" autocomplete="off" placeholder="e.g. WELCOME10" maxlength="30">
            <button class="pill-btn" type="button" id="promo-apply">Apply</button>
          </div>
          <div id="promo-msg" class="small" aria-live="polite" style="margin-top:6px"></div>
          <button class="pill-btn accent full-btn" type="submit" id="place-btn" style="margin-top:14px">Place order</button>
        </div>
      </form>
    </div>
  `;

  const quoteBox = document.getElementById('quote-box');
  const placeBtn = document.getElementById('place-btn');
  const promoMsg = document.getElementById('promo-msg');

  async function refreshQuote() {
    try {
      const q = await api('/orders/quote', { method: 'POST', body: { deliveryMethod: choice.deliveryMethod, promoCode: choice.promoCode || undefined } });
      quoteBox.innerHTML = `
        <div class="summary-row" style="margin-top:8px"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
        ${q.discount ? `<div class="summary-row discount"><span>Promo ${escapeHtml(q.promo.code)}</span><span>&minus;${money(q.discount)}</span></div>` : ''}
        <div class="summary-row"><span>Delivery</span><span>${q.deliveryFee ? money(q.deliveryFee) : 'Free'}</span></div>
        ${choice.deliveryMethod === 'standard' ? freeDeliveryBar(q.subtotal - q.discount) : ''}
        <div class="summary-row total"><span>Total</span><span>${money(q.total)}</span></div>`;
      placeBtn.textContent = `Place order: ${money(q.total)}`;
      return true;
    } catch (err) {
      // A promo that stopped applying (for example after a delivery change) is dropped with a message.
      if (choice.promoCode) {
        promoMsg.innerHTML = `<span style="color:var(--bad)">${escapeHtml(err.message)}</span>`;
        choice.promoCode = '';
        return refreshQuote().then(() => false);
      }
      quoteBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
      return false;
    }
  }

  view.querySelectorAll('[data-choice]').forEach(label => {
    label.addEventListener('change', () => {
      const group = label.dataset.choice;
      view.querySelectorAll(`[data-choice="${group}"]`).forEach(l => l.classList.toggle('selected', l.querySelector('input').checked));
      const input = label.querySelector('input');
      if (group === 'delivery') {
        choice.deliveryMethod = input.value;
        const collect = input.value === 'collection';
        document.getElementById('address-panel').hidden = collect;
        document.getElementById('collect-panel').hidden = !collect;
        refreshQuote();
      }
      if (group === 'address') choice.addressId = Number(input.value);
    });
  });

  document.getElementById('promo-apply').addEventListener('click', async () => {
    const code = document.getElementById('promo-input').value.trim();
    if (!code) { promoMsg.textContent = 'Type a promo code first.'; return; }
    choice.promoCode = code;
    promoMsg.textContent = '';
    if (await refreshQuote()) promoMsg.innerHTML = `<span style="color:var(--good)">${escapeHtml(code.toUpperCase())} applied.</span>`;
  });
  document.getElementById('promo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('promo-apply').click(); }
  });

  await refreshQuote();

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const label = placeBtn.textContent;
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order...';
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          method: fd.get('method'),
          deliveryMethod: choice.deliveryMethod,
          addressId: choice.deliveryMethod === 'collection' ? undefined : (choice.addressId || undefined),
          instructions: choice.deliveryMethod === 'collection' ? undefined : (fd.get('instructions') || undefined),
          promoCode: choice.promoCode || undefined,
        },
      });
      await refreshCartCount();
      location.hash = '#/order-confirmation/' + order.id;
    } catch (err) {
      toast(err.message, 'error');
      placeBtn.disabled = false;
      placeBtn.textContent = label;
    }
  });
}

/** Subtotal, discount, delivery and total lines for a placed order. */
function orderTotalsHtml(order) {
  return `
    ${order.subtotal ? `<div class="summary-row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>` : ''}
    ${order.discount ? `<div class="summary-row discount"><span>Promo ${escapeHtml(order.promoCode || '')}</span><span>&minus;${money(order.discount)}</span></div>` : ''}
    ${order.deliveryLabel ? `<div class="summary-row"><span>${escapeHtml(order.deliveryLabel)}</span><span>${order.deliveryFee ? money(order.deliveryFee) : 'Free'}</span></div>` : ''}
    <div class="summary-row total"><span>Total</span><span>${money(order.total)}</span></div>`;
}

async function renderOrderConfirmation(view, id) {
  const { order } = await api(`/orders/${id}`);
  view.innerHTML = `
    <div class="container section center">
      <div class="eyebrow">Order placed</div>
      <h1>Thank you, ${escapeHtml(order.customer.name.split(' ')[0])}!</h1>
      <p>Your order <strong>${order.ref}</strong> has been received and is being processed.</p>
      <div class="panel" style="max-width:480px;margin:24px auto;text-align:left">
        ${order.items.map(i => `<div class="summary-row"><span>${i.quantity} &times; ${escapeHtml(i.name)}${i.size ? ` (${escapeHtml(i.size)})` : ''}</span><span>${money(i.lineTotal)}</span></div>`).join('')}
        ${orderTotalsHtml(order)}
        ${order.deliveryAddress ? `<div class="summary-row"><span>${order.deliveryMethod === 'collection' ? 'Collection' : 'Deliver to'}</span><span style="text-align:right;max-width:60%">${escapeHtml(order.deliveryAddress)}</span></div>` : ''}
        <div class="summary-row"><span>Payment</span><span>${order.payment.method.toUpperCase()} &middot; ${order.payment.status}</span></div>
      </div>
      <a class="pill-btn accent" href="#/orders">View my orders</a>
      <a class="pill-btn" href="#/shop">Continue shopping</a>
    </div>
  `;
}

/* ----------------------------- Wishlist ----------------------------- */

async function renderWishlist(view) {
  if (!requireLogin('/wishlist')) return;
  if (state.user.type !== 'customer') {
    view.innerHTML = `<div class="container section center"><h2>Customer accounts only</h2></div>`;
    return;
  }
  const { items } = await api('/wishlist');
  state.wishlist = new Set(items.map(i => i.productId));

  view.innerHTML = `
    <div class="container section">
      <div class="flex-between"><h1 style="margin:0">Wishlist</h1><span class="small">${items.length} saved item${items.length === 1 ? '' : 's'}</span></div>
      <p class="small">Pieces you saved for later. Every item is one of a kind, so sold-out pieces stay here in case one comes back.</p>
      ${items.length === 0 ? `<div class="empty-state"><h3>Nothing saved yet</h3><p>Tap Save on any piece to keep it here.</p><a class="pill-btn dark" href="#/shop">Browse the shop</a></div>` : `
      <div class="cart-list">
        ${items.map(i => `
          <div class="cart-line">
            <a class="thumb-sm" href="#/product/${i.productId}"><img src="${i.image}" alt=""></a>
            <div class="grow">
              <span class="small" style="text-transform:uppercase;letter-spacing:0.06em;font-weight:700">${escapeHtml(i.brand)}</span><br>
              <a href="#/product/${i.productId}"><strong>${escapeHtml(i.name)}</strong></a>
              <div class="small">${priceHtml(i, '')} &middot; ${i.inStock ? (i.onlySize ? `Size ${escapeHtml(i.onlySize)}` : `${i.sizeCount} sizes`) : '<span style="color:var(--bad)">Sold out</span>'}</div>
            </div>
            ${i.inStock ? `<button type="button" class="pill-btn dark" data-move="${i.productId}" data-size="${escapeHtml(i.onlySize || '')}">${i.onlySize ? 'Move to cart' : 'Choose size'}</button>` : ''}
            <button type="button" class="link-btn danger" data-unsave="${i.productId}" aria-label="Remove ${escapeHtml(i.name)} from wishlist">Remove</button>
          </div>`).join('')}
      </div>`}
    </div>
  `;

  view.querySelectorAll('[data-unsave]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/wishlist/${btn.dataset.unsave}`, { method: 'DELETE' });
      toast('Removed from your wishlist.', 'success');
      await renderWishlist(view);
      renderNav();
    } catch (err) { toast(err.message, 'error'); }
  }));

  view.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.move;
    // More than one size in stock: the shopper picks one on the product page.
    if (!btn.dataset.size) { location.hash = '#/product/' + id; return; }
    btn.disabled = true;
    try {
      await api('/cart/items', { method: 'POST', body: { productId: Number(id), quantity: 1, size: btn.dataset.size } });
      await api(`/wishlist/${id}`, { method: 'DELETE' });
      toast('Moved to your cart.', 'success');
      await refreshCartCount();
      await renderWishlist(view);
      renderNav();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }));
}
