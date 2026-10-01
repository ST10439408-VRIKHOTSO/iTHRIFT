'use strict';

/* ----------------------------- Orders (customer) ----------------------------- */

async function renderOrdersList(view) {
  if (!requireLogin('/orders')) return;

  const { orders } = await api('/orders');
  const isStaff = state.user.type !== 'customer';

  view.innerHTML = `
    <div class="container section">
      <h1>${isStaff ? 'All orders' : 'My orders'}</h1>
      ${orders.length === 0 ? `<div class="empty-state"><h3>No orders yet</h3><a class="pill-btn dark" href="#/shop">Start shopping</a></div>` : `
      <table>
        <thead><tr><th scope="col">Order</th>${isStaff ? '<th scope="col">Customer</th>' : ''}<th scope="col">Date</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col"></th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${o.ref}</strong></td>
              ${isStaff ? `<td>${escapeHtml(o.customer)}</td>` : ''}
              <td>${timeAgo(o.createdAt)}</td>
              <td><span class="badge ${statusClass(o.status)}">${o.status}</span></td>
              <td>${money(o.total)}</td>
              <td><a class="muted-link" href="#/orders/${o.id}">View</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>
  `;
}

const STATUS_FLOW = ['Processing', 'Shipped', 'Delivered'];

async function renderOrderDetail(view, id) {
  if (!requireLogin('/orders/' + id)) return;
  const [{ order }, options] = await Promise.all([api(`/orders/${id}`), api('/orders/options')]);
  const isStaff = state.user.type !== 'customer';
  const stepIndex = STATUS_FLOW.indexOf(order.status);

  view.innerHTML = `
    <div class="container section">
      <a class="muted-link" href="#/orders">&larr; Back to orders</a>
      <div class="flex-between" style="margin-top:10px">
        <h1 style="margin:0">${order.ref}</h1>
        <span class="badge ${statusClass(order.status)}">${order.status}</span>
      </div>
      <p class="small">Placed ${timeAgo(order.createdAt)} by ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.email)})</p>

      ${order.status !== 'Cancelled' ? `
      <div class="panel" style="margin:18px 0">
        <div class="flex-between">
          ${STATUS_FLOW.map((s, i) => `<span class="small" style="font-weight:${i <= stepIndex ? 700 : 400};color:${i <= stepIndex ? 'var(--accent)' : 'var(--muted2)'}">${s}</span>`).join('<span class="small">&rarr;</span>')}
        </div>
        ${order.courierRef ? `<p class="small" style="margin-top:10px">Courier reference: <strong>${escapeHtml(order.courierRef)}</strong></p>` : ''}
      </div>` : ''}

      <div class="two-col">
        <div class="panel">
          <h3>Items</h3>
          ${order.items.map(i => `
            <div class="summary-row" style="flex-wrap:wrap">
              <span>${i.quantity} &times; ${escapeHtml(i.name)}${i.size ? `, size ${escapeHtml(i.size)}` : ''} (${i.productRef})
                ${i.returnStatus ? `<br><span class="badge ${statusClass(i.returnStatus)}" style="margin-top:4px">Return ${i.returnStatus.toLowerCase()}</span> <span class="small">${escapeHtml(i.returnReason || '')}</span>` : ''}
                ${!isStaff && i.canReturn ? `<br><button type="button" class="link-btn" data-return-open="${i.orderItemId}" style="margin-top:4px">Return this item</button>` : ''}
              </span>
              <span>${money(i.lineTotal)}</span>
              ${!isStaff && i.canReturn ? `
              <form class="return-form" data-return-form="${i.orderItemId}" hidden style="flex-basis:100%">
                <label class="small" for="reason-${i.orderItemId}"><strong>Why are you returning it?</strong></label>
                <select id="reason-${i.orderItemId}" name="reason" required>
                  <option value="">Choose a reason</option>
                  ${options.returnReasons.map(r => `<option>${escapeHtml(r)}</option>`).join('')}
                </select>
                <textarea name="comment" maxlength="300" rows="2" aria-label="More detail (optional)" placeholder="More detail (optional)"></textarea>
                <div style="display:flex;gap:8px"><button class="pill-btn dark" type="submit">Request return</button><button class="pill-btn" type="button" data-return-cancel>Cancel</button></div>
              </form>` : ''}
            </div>`).join('')}
          ${orderTotalsHtml(order)}
          <div class="summary-row"><span>Payment</span><span>${order.payment.method.toUpperCase()} &middot; ${order.payment.status}</span></div>
          ${!isStaff && order.returnWindowOpen ? `<p class="small" style="margin-top:10px">You can return items for ${order.returnDaysLeft} more day${order.returnDaysLeft === 1 ? '' : 's'}.</p>` : ''}
          ${!isStaff && order.canCancel ? `
            <div class="spacer-sm"></div>
            <button type="button" class="pill-btn full-btn" id="cancel-order-btn" style="color:var(--bad);border-color:var(--bad)">Cancel this order</button>
            <p class="small" style="margin-top:6px">You can cancel until the order is shipped. Paid orders are refunded.</p>` : ''}
        </div>

        ${isStaff ? `
        <div class="panel">
          <h3>Process order</h3>
          <form id="status-form">
            <div class="field">
              <label>Status</label>
              <select name="status">
                ${['Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Courier reference</label>
              <input type="text" name="courierRef" value="${escapeHtml(order.courierRef || '')}" placeholder="e.g. CR-1042">
            </div>
            <button class="pill-btn dark full-btn" type="submit">Save</button>
          </form>
          <div class="spacer-sm"></div>
          <p class="small"><strong>${escapeHtml(order.deliveryLabel || 'Standard delivery')}</strong><br>${escapeHtml(order.deliveryAddress || '')}</p>
          ${order.deliveryInstructions ? `<p class="small">Instructions: ${escapeHtml(order.deliveryInstructions)}</p>` : ''}
        </div>` : `
        <div class="panel">
          <h3>${order.deliveryMethod === 'collection' ? 'Collection' : 'Delivery'}</h3>
          <p class="small"><strong>${escapeHtml(order.deliveryLabel || 'Standard delivery')}</strong><br>${escapeHtml(order.deliveryAddress || order.customer.name)}</p>
          ${order.deliveryInstructions ? `<p class="small">Instructions: ${escapeHtml(order.deliveryInstructions)}</p>` : ''}
          <p class="small">This prototype simulates courier delivery; no live courier integration is included.</p>
        </div>`}
      </div>
    </div>
  `;

  document.getElementById('cancel-order-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.confirm !== 'yes') {
      // A second press confirms, so a stray tap never cancels an order.
      btn.dataset.confirm = 'yes';
      btn.textContent = 'Press again to confirm cancelling';
      return;
    }
    btn.disabled = true;
    try {
      await api(`/orders/${id}/cancel`, { method: 'PUT' });
      toast('Your order has been cancelled.', 'success');
      renderOrderDetail(view, id);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  view.querySelectorAll('[data-return-open]').forEach(btn => btn.addEventListener('click', () => {
    const form = view.querySelector(`[data-return-form="${btn.dataset.returnOpen}"]`);
    form.hidden = false;
    btn.hidden = true;
    form.querySelector('select').focus();
  }));
  view.querySelectorAll('[data-return-form]').forEach(form => {
    form.querySelector('[data-return-cancel]').addEventListener('click', () => {
      form.hidden = true;
      view.querySelector(`[data-return-open="${form.dataset.returnForm}"]`).hidden = false;
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api(`/orders/${id}/returns`, { method: 'POST', body: { orderItemId: Number(form.dataset.returnForm), reason: fd.get('reason'), comment: fd.get('comment') || undefined } });
        toast('Return requested. We will email you once it is approved.', 'success');
        renderOrderDetail(view, id);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  document.getElementById('status-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/orders/${id}/status`, { method: 'PUT', body: { status: fd.get('status'), courierRef: fd.get('courierRef') } });
      toast('Order updated.', 'success');
      renderOrderDetail(view, id);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ----------------------------- Auth views ----------------------------- */

function renderLogin(view, next) {
  if (state.user) { location.hash = next ? '#' + next : '#/account'; return; }

  view.innerHTML = `
    <div class="container section">
      <div class="form-card">
        <h2>Welcome back</h2>
        <p class="small">Sign in to your iTHRIFT account. Customers sign in with their email; staff and the administrator sign in with a username.</p>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field"><label>Email or username <span class="req">*</span></label><input type="text" name="identifier" required autofocus></div>
          <div class="field"><label>Password <span class="req">*</span></label><input type="password" name="password" required></div>
          <button class="pill-btn dark full-btn" type="submit">&#8594; Sign In</button>
        </form>
        <div class="spacer-sm"></div>
        <p class="small center">Don&rsquo;t have an account? <a href="#/register${next ? '?next=' + encodeURIComponent(next) : ''}"><strong>Register here</strong></a></p>
        <div class="spacer-sm"></div>
        <p class="small"><strong>Demo accounts</strong><br>
          Customer: lerato.m@gmail.com / Password1<br>
          Administrator: admin / Admin@123<br>
          Staff: staff01 / Staff@123</p>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('login-error');
    errBox.innerHTML = '';
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier: fd.get('identifier'), password: fd.get('password') } });
      setSession(token, user);
      await refreshCartCount();
      location.hash = next ? '#' + next : (user.type === 'customer' ? '#/shop' : '#/admin');
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function renderRegister(view, next) {
  if (state.user) { location.hash = next ? '#' + next : '#/account'; return; }

  view.innerHTML = `
    <div class="container section">
      <div class="form-card">
        <h2>Create account</h2>
        <p class="small">Join iTHRIFT. Complete all required fields.</p>
        <div id="register-error"></div>
        <form id="register-form">
          <div class="form-row">
            <div class="field"><label>First name <span class="req">*</span></label><input type="text" name="firstName" required></div>
            <div class="field"><label>Last name <span class="req">*</span></label><input type="text" name="lastName" required></div>
          </div>
          <div class="field"><label>Email <span class="req">*</span></label><input type="email" name="email" required placeholder="e.g. thabo@gmail.com"></div>
          <div class="form-row">
            <div class="field"><label>Password <span class="req">*</span></label><input type="password" name="password" required></div>
            <div class="field"><label>Phone (optional)</label><input type="text" name="phone" placeholder="e.g. 082 123 4567"></div>
          </div>
          <p class="small" style="margin-top:-8px">Password needs at least 8 characters, with one uppercase letter and one number.</p>
          <div class="form-row">
            <div class="field"><label>City (optional)</label><input type="text" name="city"></div>
            <div class="field"><label>Postal code (optional)</label><input type="text" name="postalCode"></div>
          </div>
          <div class="field"><label>Delivery address (optional)</label><input type="text" name="address" placeholder="e.g. 12 Mandela Ave, Soweto, 1804"></div>
          <button class="pill-btn dark full-btn" type="submit">Create account</button>
        </form>
        <div class="spacer-sm"></div>
        <p class="small center">Already have an account? <a href="#/login${next ? '?next=' + encodeURIComponent(next) : ''}"><strong>Sign in</strong></a></p>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('register-error');
    errBox.innerHTML = '';
    try {
      const { token, user } = await api('/auth/register', {
        method: 'POST',
        body: Object.fromEntries(fd.entries()),
      });
      setSession(token, user);
      await refreshCartCount();
      toast('Welcome to iTHRIFT, ' + user.name.split(' ')[0] + '!', 'success');
      location.hash = next ? '#' + next : '#/shop';
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function renderAccount(view) {
  if (!requireLogin('/account')) return;
  const u = state.user;

  view.innerHTML = `
    <div class="container section">
      <div class="form-card">
        <h2>My account</h2>
        <p><strong>${escapeHtml(u.name)}</strong><br><span class="small">Account type: <span class="badge role-${u.type === 'customer' ? 'staff' : u.type}" style="background:${u.type === 'customer' ? 'var(--ink)' : ''}">${u.type}</span></span></p>
        ${u.type === 'customer' ? `
          <a class="pill-btn dark full-btn" href="#/orders">View my orders</a><div class="spacer-sm"></div>
          <a class="pill-btn full-btn" href="#/wishlist">My wishlist</a><div class="spacer-sm"></div>
          <a class="pill-btn full-btn" href="#/addresses">Delivery addresses</a><div class="spacer-sm"></div>
          <a class="pill-btn full-btn" href="#/returns">My returns</a><div class="spacer-sm"></div>` : `<a class="pill-btn dark full-btn" href="#/admin">Go to admin console</a><div class="spacer-sm"></div>`}
        <button type="button" class="pill-btn full-btn" id="logout-btn">Sign out</button>
      </div>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
    setSession(null, null);
    toast('Signed out.');
    location.hash = '#/shop';
  });
}

/* ----------------------------- Address book ----------------------------- */

async function renderAddresses(view, editing = null) {
  if (!requireLogin('/addresses')) return;
  if (state.user.type !== 'customer') {
    view.innerHTML = `<div class="container section center"><h2>Customer accounts only</h2></div>`;
    return;
  }
  const { addresses } = await api('/addresses');
  const current = editing ? addresses.find(a => a.id === editing) : null;
  const val = (k) => escapeHtml(current ? (current[k] || '') : '');

  view.innerHTML = `
    <div class="container section">
      <a class="muted-link" href="#/account">&larr; Back to account</a>
      <h1>Delivery addresses</h1>
      <div class="two-col">
        <div>
          ${addresses.length === 0 ? `<div class="empty-state"><h3>No saved addresses</h3><p>Add one so checkout is quicker.</p></div>` : addresses.map(a => `
            <div class="address-card ${a.isDefault ? 'is-default' : ''}">
              <div class="flex-between"><strong>${escapeHtml(a.label)}</strong>${a.isDefault ? '<span class="badge status-delivered">Default</span>' : ''}</div>
              <div class="small">${escapeHtml(a.recipient)}${a.phone ? ` &middot; ${escapeHtml(a.phone)}` : ''}<br>${escapeHtml([a.line1, a.suburb, a.city, a.postalCode].filter(Boolean).join(', '))}</div>
              <div class="actions">
                <button type="button" class="link-btn" data-edit="${a.id}">Edit</button>
                ${a.isDefault ? '' : `<button type="button" class="link-btn" data-default="${a.id}">Make default</button>`}
                <button type="button" class="link-btn danger" data-delete="${a.id}">Delete</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="panel">
          <h3>${current ? 'Edit address' : 'Add an address'}</h3>
          <div id="address-error"></div>
          <form id="address-form">
            <div class="field"><label for="a-label">Label</label><input id="a-label" name="label" maxlength="30" placeholder="Home, Work, Res" value="${val('label')}"></div>
            <div class="field"><label for="a-recipient">Recipient name</label><input id="a-recipient" name="recipient" required value="${val('recipient')}"></div>
            <div class="field"><label for="a-phone">Phone (optional)</label><input id="a-phone" name="phone" inputmode="tel" placeholder="082 123 4567" value="${val('phone')}"></div>
            <div class="field"><label for="a-line1">Street address</label><input id="a-line1" name="line1" required placeholder="12 Jacaranda Street" value="${val('line1')}"></div>
            <div class="field"><label for="a-suburb">Suburb (optional)</label><input id="a-suburb" name="suburb" value="${val('suburb')}"></div>
            <div class="field"><label for="a-city">City or town</label><input id="a-city" name="city" required value="${val('city')}"></div>
            <div class="field"><label for="a-postal">Postal code</label><input id="a-postal" name="postalCode" required inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${val('postalCode')}"></div>
            ${current ? '' : `<label class="small" style="display:flex;gap:6px;align-items:center;margin-bottom:12px"><input type="checkbox" name="isDefault"> Make this my default address</label>`}
            <button class="pill-btn dark full-btn" type="submit">${current ? 'Save changes' : 'Add address'}</button>
            ${current ? `<div class="spacer-sm"></div><button class="pill-btn full-btn" type="button" id="cancel-edit">Cancel</button>` : ''}
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('address-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.isDefault = fd.get('isDefault') === 'on';
    try {
      if (current) await api(`/addresses/${current.id}`, { method: 'PUT', body });
      else await api('/addresses', { method: 'POST', body });
      toast(current ? 'Address updated.' : 'Address saved.', 'success');
      renderAddresses(view);
    } catch (err) {
      document.getElementById('address-error').innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    }
  });
  document.getElementById('cancel-edit')?.addEventListener('click', () => renderAddresses(view));
  view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => renderAddresses(view, Number(b.dataset.edit))));
  view.querySelectorAll('[data-default]').forEach(b => b.addEventListener('click', async () => {
    await api(`/addresses/${b.dataset.default}/default`, { method: 'PUT' });
    toast('Default address changed.', 'success');
    renderAddresses(view);
  }));
  view.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = 'Press again to delete'; return; }
    await api(`/addresses/${b.dataset.delete}`, { method: 'DELETE' });
    toast('Address deleted.', 'success');
    renderAddresses(view);
  }));
}

/* ----------------------------- My returns ----------------------------- */

async function renderMyReturns(view) {
  if (!requireLogin('/returns')) return;
  const { returns } = await api('/returns');
  view.innerHTML = `
    <div class="container section">
      <a class="muted-link" href="#/account">&larr; Back to account</a>
      <h1>My returns</h1>
      <p class="small">Items can be returned within 30 days of delivery. Open a delivered order and choose Return this item.</p>
      ${returns.length === 0 ? `<div class="empty-state"><h3>No returns</h3><a class="pill-btn dark" href="#/orders">View my orders</a></div>` : `
      <div class="cart-list">
        ${returns.map(r => `
          <div class="cart-line">
            <div class="thumb-sm"><img src="${r.image}" alt=""></div>
            <div class="grow">
              <strong>${escapeHtml(r.productName)}</strong>${r.size ? ` <span class="small">size ${escapeHtml(r.size)}</span>` : ''}
              <div class="small">${escapeHtml(r.reason)} &middot; requested ${timeAgo(r.createdAt)} &middot; <a href="#/orders/${r.orderId}">${r.orderRef}</a></div>
              ${r.status === 'Refunded' ? `<div class="small">Refunded ${money(r.refundAmount)}</div>` : ''}
            </div>
            <span class="badge ${statusClass(r.status)}">${r.status}</span>
          </div>`).join('')}
      </div>`}
    </div>
  `;
}

function renderAbout(view) {
  view.innerHTML = `
    <div class="container section" style="max-width:800px">
      <div class="eyebrow">Our story</div>
      <h1 style="font-size:34px;font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:16px">Pre-loved fashion that <span style="font-weight:400">tells a story.</span></h1>
      <p style="font-size:16px;color:var(--muted);max-width:600px;line-height:1.7">iTHRIFT connects South African buyers with verified sellers of premium branded second-hand clothing. Every piece is condition-rated by our team as <strong>Excellent</strong>, <strong>Very Good</strong>, or <strong>Good</strong>, so you know exactly what you're getting.</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:28px 0;border-radius:var(--radius);overflow:hidden">
        <div style="aspect-ratio:4/3;background:var(--surface-2);border-radius:var(--radius);overflow:hidden">
          <img src="/images/brand/storefront.jpg" alt="iTHRIFT storefront" style="width:100%;height:100%;object-fit:cover">
        </div>
        <div style="background:var(--surface-2);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;padding:32px">
          <div style="text-align:center">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div><div style="font-size:28px;font-weight:900;letter-spacing:-0.02em">300+</div><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Happy buyers</div></div>
              <div><div style="font-size:28px;font-weight:900;letter-spacing:-0.02em">620+</div><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Pieces sold</div></div>
              <div><div style="font-size:28px;font-weight:900;letter-spacing:-0.02em">60+</div><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Verified sellers</div></div>
              <div><div style="font-size:28px;font-weight:900;letter-spacing:-0.02em">4.8 / 5</div><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Average rating</div></div>
            </div>
          </div>
        </div>
      </div>

      <div style="background:var(--surface-2);border-radius:var(--radius);padding:28px;margin:24px 0;border:1.5px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <h3 style="margin:0;font-size:16px">Staying Safe on iTHRIFT</h3>
        </div>
        <p style="font-size:12px;color:var(--muted2);margin:0 0 16px">Last updated: June 2026</p>
        <p><strong>Verified Accounts Only</strong><br>Every buyer and seller must register and be verified by our admin team before they can trade.</p>
        <p><strong>Never Share Personal Details</strong><br>Do not share your phone number, home address or banking details through the chat system. All payments must go through the official iTHRIFT checkout.</p>
        <p style="margin:0"><strong>Condition-Rated Listings</strong><br>Every listing is reviewed and condition-rated (Excellent, Very Good, or Good) by our team before it goes live.</p>
      </div>

      <a class="pill-btn dark" href="#/shop" style="margin-top:8px;display:inline-flex">Browse the catalogue</a>
    </div>
  `;
}
