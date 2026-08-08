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
      <p class="hero-sub">${totalCount} piece${totalCount === 1 ? '' : 's'} available &mdash; every listing condition-rated by the iTHIFT team.</p>
    </div>
    <div class="container">
      <div class="select-bar">
        <span>&#128717; Select items below and add them to your cart</span>
        <a class="pill-btn dark" href="#/cart">&#128722; Show Cart${state.cartCount ? `<span class="cart-badge">${state.cartCount}</span>` : ''}</a>
      </div>
    </div>` : ''}

    <div class="container section" style="padding-top:${isHome ? '4px' : '40px'}">
      <div class="chip-filter-row">
        ${categoryChips}
        <form id="search-form" style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
          <input type="text" name="q" placeholder="Search brand or piece&hellip;" value="${escapeHtml(query.q || '')}" style="border:1.5px solid var(--border);border-radius:999px;padding:9px 16px;background:var(--surface);font-size:14px;min-width:200px;outline:none">
          <button class="pill-btn" type="submit" style="border-color:var(--border)">Search</button>
        </form>
      </div>

      <details style="margin-bottom:18px">
        <summary class="small" style="cursor:pointer;font-weight:700;color:var(--ink);user-select:none">&#9881; More filters (brand, condition, price, sort)</summary>
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
          <button class="pill-btn dark" type="submit">Apply</button>
          ${Object.keys(query).length ? `<a class="muted-link" href="#/shop">Clear filters</a>` : ''}
        </form>
      </details>

      <div class="flex-between" style="margin-bottom:20px">
        <h2 style="margin:0;font-size:20px">${query.category ? escapeHtml(query.category) : query.brand ? escapeHtml(query.brand) : 'All products'}</h2>
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
    if (!requireLogin('/shop')) return;
    if (state.user.type !== 'customer') return toast('Only customer accounts can shop. Sign in with a customer account.', 'error');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    try {
      await api('/cart/items', { method: 'POST', body: { productId, quantity: 1 } });
      toast('Added to your cart.', 'success');
      await refreshCartCount();
      renderNav();
      btn.innerHTML = '&#10003; Added';
      setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 1200);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }));
}

function productCard(p) {
  return `
    <div class="card" data-product-id="${p.id}">
      <a href="#/product/${p.id}" style="display:block">
        <div class="thumb">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
          <span class="badge ${p.inStock ? conditionClass(p.condition) : 'out'}" style="text-transform:uppercase;font-size:10px;letter-spacing:0.04em">${p.inStock ? escapeHtml(p.condition).toUpperCase() : 'SOLD OUT'}</span>
        </div>
      </a>
      <div class="body">
        <span class="brand">${escapeHtml(p.brand)}</span>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="meta">Size ${escapeHtml(p.size)}${p.sellerName ? ` &middot; by ${escapeHtml(p.sellerName)}` : ''}</span>
        <div class="price-row">
          <span><span class="price-from">From</span><span class="price">${money(p.price)}</span></span>
          <span class="small" style="color:var(--muted2)">Qty: ${p.stock}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 14px">
        <a class="pill-btn" href="#/product/${p.id}" style="flex:1;justify-content:center;padding:9px;font-size:13px">&#128065; Details</a>
        ${p.inStock
          ? `<button type="button" class="pill-btn quick-add-btn" data-quick-add="${p.id}" style="flex:1;justify-content:center;padding:9px;font-size:13px;color:var(--muted2)">Add to Cart</button>`
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
        <h2 style="margin:10px 0 18px">${money(product.price)}</h2>
        <p>${escapeHtml(product.description)}</p>

        <div class="spec-list">
          <div class="spec-row"><span class="spec-label">&#128476; Size</span><span class="spec-value">${escapeHtml(product.size)}</span></div>
          <div class="spec-row"><span class="spec-label">&#9733; Condition</span><span class="badge ${product.inStock ? conditionClass(product.condition) : 'out'}">${escapeHtml(product.condition)}</span></div>
          <div class="spec-row"><span class="spec-label">&#127991; Category</span><span class="spec-value">${escapeHtml(product.category)}</span></div>
          <div class="spec-row"><span class="spec-label">&#128230; Stock</span><span class="spec-value">${product.inStock ? `${product.stock} available` : 'Sold out'}</span></div>
          ${avgRating ? `<div class="spec-row"><span class="spec-label">&#9733; Rating</span><span class="spec-value stars">${avgRating}</span><span class="small">(${reviews.length} review${reviews.length === 1 ? '' : 's'})</span></div>` : ''}
        </div>

        ${product.inStock ? `
          <div style="display:flex;align-items:center;gap:14px;margin:16px 0">
            <div class="qty-stepper">
              <button type="button" id="qty-minus">&minus;</button>
              <span id="qty-val">1</span>
              <button type="button" id="qty-plus">+</button>
            </div>
            <span class="small">${product.stock} in stock</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="pill-btn dark" id="add-to-cart-btn">&#128722; Add to Cart &mdash; ${money(product.price)}</button>
            <a class="pill-btn" href="#/shop">&#8592; Back</a>
          </div>
        ` : `
          <div class="form-error" style="max-width:340px">This item is currently out of stock.</div>
          <a class="pill-btn" href="#/shop" style="margin-top:10px">&#8592; Back</a>
        `}
        <div class="spacer-sm"></div>
        <a class="muted-link" href="#/shop?brand=${encodeURIComponent(product.brand)}">More from ${escapeHtml(product.brand)}</a>
      </div>
    </div>

    <div class="container section" style="padding-top:0">
      <h2>Reviews</h2>
      ${reviews.length === 0 ? `<p class="small">No reviews yet &mdash; be the first to share your experience with this item.</p>` : reviews.map(r => `
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
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Average</option>
                <option value="2">2 - Below average</option>
                <option value="1">1 - Poor</option>
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
  const qtyVal = document.getElementById('qty-val');
  document.getElementById('qty-minus')?.addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
  document.getElementById('qty-plus')?.addEventListener('click', () => { qty = Math.min(product.stock, qty + 1); qtyVal.textContent = qty; });

  document.getElementById('add-to-cart-btn')?.addEventListener('click', async () => {
    if (!requireLogin('/product/' + id)) return;
    if (state.user.type !== 'customer') return toast('Only customer accounts can shop. Sign in with a customer account.', 'error');
    try {
      await api('/cart/items', { method: 'POST', body: { productId: product.id, quantity: qty } });
      toast(`Added ${qty} &times; ${product.name} to your cart.`.replace('&times;', '×'), 'success');
      await refreshCartCount();
      renderNav();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

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
          <div class="summary-row"><span>Delivery</span><span>Calculated at checkout</span></div>
          <div class="summary-row total"><span>Total</span><span>${money(cart.subtotal)}</span></div>
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
        <div class="small">${money(item.price)} each &middot; ${item.stock} in stock</div>
      </div>
      <div class="qty-stepper">
        <button type="button" data-qty-minus="${item.id}">&minus;</button>
        <span>${item.quantity}</span>
        <button type="button" data-qty-plus="${item.id}">+</button>
      </div>
      <strong style="width:80px;text-align:right">${money(item.price * item.quantity)}</strong>
      <button type="button" class="muted-link" data-remove="${item.id}" style="background:none;border:none">Remove</button>
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

async function renderCheckout(view) {
  if (!requireLogin('/checkout')) return;
  if (state.user.type !== 'customer') {
    view.innerHTML = `<div class="container section center"><h2>Customer accounts only</h2></div>`;
    return;
  }

  const cart = await api('/cart');
  if (cart.items.length === 0) {
    view.innerHTML = `<div class="container section center"><h2>Your cart is empty</h2><a class="pill-btn dark" href="#/shop">Go shopping</a></div>`;
    return;
  }

  view.innerHTML = `
    <div class="container section">
      <h1>Checkout</h1>
      <div class="cart-layout">
        <div>
          <div class="panel">
            <h3>Payment method</h3>
            <p class="small">Payments are simulated for this prototype &mdash; no money changes hands.</p>
            <form id="checkout-form">
              <label class="pay-option selected" data-pay>
                <input type="radio" name="method" value="card" checked> Credit / debit card
              </label>
              <label class="pay-option" data-pay>
                <input type="radio" name="method" value="payfast"> PayFast
              </label>
              <label class="pay-option" data-pay>
                <input type="radio" name="method" value="eft"> EFT (bank transfer, pending until confirmed)
              </label>
              <button class="pill-btn accent full-btn" type="submit" style="margin-top:14px">Place order &middot; ${money(cart.subtotal)}</button>
            </form>
          </div>
        </div>
        <div class="summary-card">
          <h3>Order summary</h3>
          ${cart.items.map(i => `<div class="summary-row"><span>${i.quantity} &times; ${escapeHtml(i.name)}</span><span>${money(i.price * i.quantity)}</span></div>`).join('')}
          <div class="summary-row total"><span>Total</span><span>${money(cart.subtotal)}</span></div>
        </div>
      </div>
    </div>
  `;

  view.querySelectorAll('[data-pay]').forEach(label => {
    label.addEventListener('click', () => {
      view.querySelectorAll('[data-pay]').forEach(l => l.classList.remove('selected'));
      label.classList.add('selected');
    });
  });

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const method = new FormData(e.target).get('method');
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing order…';
    try {
      const { order } = await api('/orders', { method: 'POST', body: { method } });
      await refreshCartCount();
      location.hash = '#/order-confirmation/' + order.id;
    } catch (err) {
      toast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place order';
    }
  });
}

async function renderOrderConfirmation(view, id) {
  const { order } = await api(`/orders/${id}`);
  view.innerHTML = `
    <div class="container section center">
      <div class="eyebrow">Order placed</div>
      <h1>Thank you, ${escapeHtml(order.customer.name.split(' ')[0])}!</h1>
      <p>Your order <strong>${order.ref}</strong> has been received and is being processed.</p>
      <div class="panel" style="max-width:480px;margin:24px auto;text-align:left">
        ${order.items.map(i => `<div class="summary-row"><span>${i.quantity} &times; ${escapeHtml(i.name)}</span><span>${money(i.lineTotal)}</span></div>`).join('')}
        <div class="summary-row total"><span>Total</span><span>${money(order.total)}</span></div>
        <div class="summary-row"><span>Payment</span><span>${order.payment.method.toUpperCase()} &middot; ${order.payment.status}</span></div>
      </div>
      <a class="pill-btn accent" href="#/orders">View my orders</a>
      <a class="pill-btn" href="#/shop">Continue shopping</a>
    </div>
  `;
}
