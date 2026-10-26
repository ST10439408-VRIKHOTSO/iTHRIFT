'use strict';

/* =========================================================================
   Account: hub, settings, style profile, Thrift Points, saved searches,
   stock alerts, notifications, addresses, Sell to us and Help (with the
   support conversations).
   ========================================================================= */

const NOTE_ICONS = {
  order: 'package', return: 'rotate-ccw', price_drop: 'badge-percent', back_in_stock: 'bell', saved_search: 'bookmark',
  question: 'message-circle', sell: 'hand-coins', support: 'message-square', points: 'coins', welcome: 'sparkles',
};

/* ----------------------------- Account hub ----------------------------- */

route(/^\/account$/, async (view) => {
  setTitle('Account');
  if (!requireLogin()) return;
  if (isStaff()) {
    view.innerHTML = `
      <div class="container narrow page">
        <div class="account-head"><div class="avatar">${esc(state.user.name[0])}</div><div><h1 style="font-size:1.75rem">${esc(state.user.name)}</h1><p class="muted" style="margin:4px 0 0">${isAdmin() ? 'Administrator' : 'Staff'} account</p></div></div>
        <div class="list">
          <a class="list-item" href="#/admin"><span class="list-icon pine">${icon('clipboard-list', { size: 18 })}</span><span>Staff console</span>${icon('chevron-right', { size: 18, cls: 'chev' })}</a>
          <a class="list-item" href="#/account/settings"><span class="list-icon">${icon('settings', { size: 18 })}</span><span>Appearance and accessibility</span>${icon('chevron-right', { size: 18, cls: 'chev' })}</a>
          <button type="button" class="list-item" id="sign-out"><span class="list-icon">${icon('log-out', { size: 18 })}</span><span>Sign out</span></button>
        </div>
      </div>`;
    document.getElementById('sign-out').addEventListener('click', signOut);
    return;
  }
  const ov = await api('/account/overview');
  const c = ov.counts;
  const tier = ov.points.tier;
  const item = (href, ic, label, meta = '', tone = '') => `<a class="list-item" href="${href}"><span class="list-icon ${tone}">${icon(ic, { size: 18 })}</span><span>${label}</span>${meta !== '' ? `<span class="list-meta">${meta}</span>` : ''}${icon('chevron-right', { size: 18, cls: 'chev' })}</a>`;

  view.innerHTML = `
    <div class="container mid page">
      <div class="account-head">
        <div class="avatar" aria-hidden="true">${esc(ov.customer.firstName[0])}</div>
        <div><h1 style="font-size:1.75rem">${esc(ov.customer.firstName)} ${esc(ov.customer.lastName)}</h1><p class="muted" style="margin:4px 0 0">${esc(ov.customer.email)}. Member since ${dateLabel(ov.customer.memberSince, { year: true })}.</p></div>
      </div>

      <div class="tiles">
        <a class="tile" href="#/account/points"><span class="tile-value">${ov.points.balance}</span><span class="tile-label">Thrift Points, ${esc(tier.name)}</span></a>
        <a class="tile" href="#/orders"><span class="tile-value">${c.activeOrders}</span><span class="tile-label">${c.activeOrders === 1 ? 'Order' : 'Orders'} on the way</span></a>
        <a class="tile" href="#/notifications"><span class="tile-value">${c.unread}</span><span class="tile-label">Unread ${c.unread === 1 ? 'notification' : 'notifications'}</span></a>
      </div>

      <div class="two-col even">
        <div>
          <h2 class="group-label" style="margin-top:0">Shopping</h2>
          <div class="list">
            ${item('#/orders', 'package', 'Orders', c.orders)}
            ${item('#/wishlist', 'heart', 'Wishlist', c.wishlist)}
            ${item('#/account/saved', 'bookmark', 'Saved searches', c.savedSearches)}
            ${item('#/account/alerts', 'bell', 'Back-in-stock alerts', c.alerts)}
            ${item('#/returns', 'rotate-ccw', 'Returns', c.returns)}
          </div>
          <h2 class="group-label">Selling and help</h2>
          <div class="list">
            ${item('#/sell', 'hand-coins', 'Sell to us', c.sellSubmissions)}
            ${item('#/help/messages', 'message-square', 'Messages with iTHRIFT', c.openTickets ? `${c.openTickets} open` : '')}
            ${item('#/help', 'circle-help', 'Help centre')}
          </div>
        </div>
        <div>
          <h2 class="group-label" style="margin-top:0">Your impact</h2>
          <div class="panel tight">
            ${ov.impact.items ? `
              <p style="margin:0 0 12px">Buying ${plural(ov.impact.items, 'piece')} second-hand instead of new saved roughly:</p>
              <div class="impact">
                <div>${icon('droplets', { size: 18 })}<strong>${groupThousands(Math.round(ov.impact.waterLitres))} L</strong>of water</div>
                <div>${icon('leaf', { size: 18 })}<strong>${groupThousands(Math.round(ov.impact.co2Kg))} kg</strong>of CO2</div>
                <div>${icon('shirt', { size: 18 })}<strong>${ov.impact.items}</strong>${ov.impact.items === 1 ? 'piece' : 'pieces'} kept in use</div>
              </div>
              <p class="tiny muted" style="margin:12px 0 0">${esc(ov.impact.basis)} Rough figures, for a sense of scale.</p>`
              : '<p class="muted" style="margin:0">Once your first order is delivered, we will show roughly how much water and CO2 buying second-hand saved.</p>'}
          </div>
          <h2 class="group-label">Settings</h2>
          <div class="list">
            ${item('#/account/settings', 'settings', 'Details, password and notifications')}
            ${item('#/account/style', 'ruler', 'Your sizes and brands', ov.style.sizes.length ? esc(ov.style.sizes.slice(0, 3).join(', ')) + (ov.style.sizes.length > 3 ? '...' : '') : 'Not set')}
            ${item('#/addresses', 'map-pin', 'Delivery addresses')}
            <button type="button" class="list-item" id="sign-out"><span class="list-icon">${icon('log-out', { size: 18 })}</span><span>Sign out</span></button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('sign-out').addEventListener('click', signOut);
});

async function signOut() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (_) { /* signed out locally either way */ }
  setSession(null, null);
  toast('Signed out.');
  go('#/');
}

/* ----------------------------- Settings ----------------------------- */

route(/^\/account\/settings$/, async (view) => {
  setTitle('Settings');
  if (!requireLogin()) return;
  const customer = isCustomer();
  const [profileData, ov] = customer ? await Promise.all([api('/auth/profile'), api('/account/overview')]) : [null, null];
  const p = profileData && profileData.profile;
  const theme = prefs.theme();

  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <h1 style="margin-bottom:24px">Settings</h1>

      ${customer ? `
      <section class="settings-group" aria-labelledby="det-h">
        <h2 id="det-h">Your details</h2>
        <form class="panel" id="profile" novalidate>
          <div data-form-error></div>
          <div class="form-grid">
            <div class="field"><label for="fn">First name</label><input class="input" id="fn" name="firstName" value="${esc(p.firstName)}" autocomplete="given-name"></div>
            <div class="field"><label for="ln">Last name</label><input class="input" id="ln" name="lastName" value="${esc(p.lastName)}" autocomplete="family-name"></div>
          </div>
          <div class="field"><label for="em">Email</label><input class="input" id="em" value="${esc(p.email)}" disabled><div class="hint">Your email is how you sign in. Contact us to change it.</div></div>
          <div class="field"><label for="ph">Cellphone number</label><input class="input" id="ph" name="phone" type="tel" inputmode="tel" value="${esc(p.phone || '')}" autocomplete="tel" placeholder="082 123 4567" required></div>
          <button class="btn btn-primary" type="submit">Save details</button>
        </form>
      </section>

      ${p.canChangePassword ? `
      <section class="settings-group" aria-labelledby="pw-h">
        <h2 id="pw-h">Password</h2>
        <form class="panel" id="password" novalidate>
          <div data-form-error></div>
          <div class="field"><label for="cur">Current password</label><input class="input" id="cur" name="currentPassword" type="password" autocomplete="current-password"></div>
          <div class="field"><label for="new">New password</label><input class="input" id="new" name="newPassword" type="password" autocomplete="new-password"><div class="hint">At least 8 characters, with an uppercase letter and a number.</div></div>
          <button class="btn btn-primary" type="submit">Change password</button>
        </form>
      </section>` : `<div class="callout info" style="margin-bottom:24px">${icon('info', { size: 18 })}<p>You sign in with Google, so there is no iTHRIFT password to change.</p></div>`}

      <section class="settings-group" aria-labelledby="note-h">
        <h2 id="note-h">Notifications</h2>
        <div class="panel tight">
          <div class="switch-row"><label for="n-orders"><strong>Orders and requests</strong><br><span class="small muted">Order updates, returns, replies from support and offers on pieces you sell us.</span></label><span class="switch"><input type="checkbox" id="n-orders" ${ov.preferences.notifyOrders ? 'checked' : ''}><span></span></span></div>
          <div class="switch-row"><label for="n-alerts"><strong>Shopping alerts</strong><br><span class="small muted">Price drops on saved pieces, sizes coming back and new matches for saved searches.</span></label><span class="switch"><input type="checkbox" id="n-alerts" ${ov.preferences.notifyAlerts ? 'checked' : ''}><span></span></span></div>
        </div>
      </section>` : ''}

      <section class="settings-group" aria-labelledby="look-h">
        <h2 id="look-h">Appearance</h2>
        <div class="panel tight">
          <div class="switch-row" style="flex-wrap:wrap"><span><strong>Theme</strong><br><span class="small muted">Saved on this device.</span></span>
            <div class="segmented" role="group" aria-label="Theme">
              ${[['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'Automatic']].map(([v, ic, l]) => `<button type="button" data-theme-choice="${v}" aria-pressed="${theme === v}">${icon(ic, { size: 16 })}${l}</button>`).join('')}
            </div>
          </div>
          <div class="switch-row"><label for="a-text"><strong>Larger text</strong><br><span class="small muted">Makes everything about an eighth bigger.</span></label><span class="switch"><input type="checkbox" id="a-text" ${prefs.textLarge() ? 'checked' : ''}><span></span></span></div>
          <div class="switch-row"><label for="a-motion"><strong>Reduce motion</strong><br><span class="small muted">Turns off sliding and fading. Your device setting is followed too.</span></label><span class="switch"><input type="checkbox" id="a-motion" ${prefs.reduceMotion() ? 'checked' : ''}><span></span></span></div>
        </div>
      </section>
      ${customer ? `<p class="small"><a class="link" href="#/account/style">Edit your sizes and favourite brands</a></p>` : ''}
    </div>`;

  view.querySelectorAll('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => {
    prefs.setTheme(b.dataset.themeChoice);
    view.querySelectorAll('[data-theme-choice]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  document.getElementById('a-text').addEventListener('change', (e) => prefs.setTextLarge(e.target.checked));
  document.getElementById('a-motion').addEventListener('change', (e) => prefs.setReduceMotion(e.target.checked));

  if (!customer) return;
  const pf = document.getElementById('profile');
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(pf);
    if (!pf.firstName.value.trim()) return fieldError(pf, 'firstName', 'Enter your first name.');
    if (!pf.lastName.value.trim()) return fieldError(pf, 'lastName', 'Enter your last name.');
    if (!saPhone(pf.phone.value)) return fieldError(pf, 'phone', 'Enter a South African cellphone number, like 082 123 4567.');
    busy(pf.querySelector('button'), async () => {
      try {
        const r = await api('/auth/profile', { method: 'PUT', body: { firstName: pf.firstName.value, lastName: pf.lastName.value, phone: pf.phone.value, address: p.address, city: p.city, postalCode: p.postalCode } });
        setSession(state.token, { ...state.user, name: r.user.name });
        toast('Details saved.', 'success');
      } catch (err) { if (/cellphone/i.test(err.message)) fieldError(pf, 'phone', err.message); else formError(pf, err.message); }
    }, 'Saving');
  });
  const pw = document.getElementById('password');
  pw?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(pw);
    if (!pw.currentPassword.value) return fieldError(pw, 'currentPassword', 'Enter your current password.');
    busy(pw.querySelector('button'), async () => {
      try {
        await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.currentPassword.value, newPassword: pw.newPassword.value } });
        pw.reset();
        toast('Password changed.', 'success');
      } catch (err) {
        if (/current/i.test(err.message)) fieldError(pw, 'currentPassword', err.message); else fieldError(pw, 'newPassword', err.message);
      }
    }, 'Changing');
  });
  const savePrefs = async () => {
    try {
      await api('/account/preferences', { method: 'PUT', body: { notifyOrders: document.getElementById('n-orders').checked, notifyAlerts: document.getElementById('n-alerts').checked } });
      toast('Notification settings saved.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };
  document.getElementById('n-orders').addEventListener('change', savePrefs);
  document.getElementById('n-alerts').addEventListener('change', savePrefs);
});

/* ----------------------------- Style profile ----------------------------- */

route(/^\/account\/style$/, async (view) => {
  setTitle('Your sizes and brands');
  if (!requireCustomer(view)) return;
  const ov = await api('/account/overview');
  const picks = { sizes: new Set(ov.style.sizes), brands: new Set(ov.style.brands) };
  const all = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', '28', '30', '32', '34', '36', '38', '40', '42', '44'];
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <h1>Your sizes and brands</h1>
      <p class="muted" style="margin:8px 0 24px">The home page picks pieces in these sizes, and the My sizes filter uses them.</p>
      <div class="panel">
        ${sizeGroups(all).map(([label, list]) => `<h2 style="font-size:1rem;margin:0 0 10px">${label}</h2><div class="filter-options" style="margin-bottom:20px">${list.map((s) => `<button type="button" class="chip" data-size="${esc(s)}" aria-pressed="${picks.sizes.has(s)}">${esc(s)}</button>`).join('')}</div>`).join('')}
        <h2 style="font-size:1rem;margin:0 0 10px">Favourite brands</h2>
        <div class="filter-options">${state.brands.filter((b) => b.name !== 'Generic').map((b) => `<button type="button" class="chip" data-brand="${esc(b.name)}" aria-pressed="${picks.brands.has(b.name)}">${esc(b.name)}</button>`).join('')}</div>
      </div>
      <button type="button" class="btn btn-primary btn-lg" id="save-style" style="margin-top:20px">Save</button>
    </div>`;
  view.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => { toggleSet(picks.sizes, b.dataset.size); b.setAttribute('aria-pressed', String(picks.sizes.has(b.dataset.size))); }));
  view.querySelectorAll('[data-brand]').forEach((b) => b.addEventListener('click', () => { toggleSet(picks.brands, b.dataset.brand); b.setAttribute('aria-pressed', String(picks.brands.has(b.dataset.brand))); }));
  document.getElementById('save-style').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try {
      await api('/account/style', { method: 'PUT', body: { sizes: [...picks.sizes], brands: [...picks.brands] } });
      toast('Saved.', 'success', { label: 'See your picks', href: '#/' });
    } catch (err) { toast(err.message, 'error'); }
  }, 'Saving'));
});

/* ----------------------------- Thrift Points ----------------------------- */

route(/^\/account\/points$/, async (view) => {
  setTitle('Thrift Points');
  if (!requireCustomer(view)) return;
  const pts = await api('/account/points');
  const nextTier = pts.tier.next;
  const tierFloor = { Bronze: 0, Silver: 500, Gold: 1500 }[pts.tier.name];
  const pct = nextTier ? Math.round(((pts.lifetime - tierFloor) / (pts.lifetime - tierFloor + nextTier.pointsToGo)) * 100) : 100;
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <h1 style="margin-bottom:24px">Thrift Points</h1>
      <div class="points-card">
        <div class="small" style="opacity:.85">${esc(pts.tier.name)} member</div>
        <div class="big" style="margin-top:8px">${pts.balance}</div>
        <p>points, worth ${money(Math.floor(pts.balance / 100) * 10)} off your next order.</p>
        ${nextTier ? `<div class="progress" style="margin-top:20px" role="progressbar" aria-label="Progress to ${esc(nextTier.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><p class="small">${nextTier.pointsToGo} more points earned to reach ${esc(nextTier.name)}.</p>` : '<p class="small">You are at the top tier. Thank you for shopping second-hand.</p>'}
      </div>
      <div class="panel" style="margin-top:16px">
        <h2 style="font-size:1.0625rem;margin-bottom:12px">How points work</h2>
        <div class="list" style="border:0">
          <div class="list-item" style="padding-left:0">${icon('coins', { size: 18 })}<span>Earn 1 point for every R10 you spend, once your order is delivered.</span></div>
          <div class="list-item" style="padding-left:0">${icon('tag', { size: 18 })}<span>Spend 100 points for R10 off at checkout.</span></div>
          <div class="list-item" style="padding-left:0">${icon('hand-coins', { size: 18 })}<span>Sell us a piece and take the payment as points to get 20 percent extra.</span></div>
          <div class="list-item" style="padding-left:0">${icon('star', { size: 18 })}<span>Silver from 500 points earned, Gold from 1,500.</span></div>
        </div>
      </div>
      <h2 class="group-label">History</h2>
      <div class="list">${pts.history.map((h) => `
        <div class="list-item"><span class="list-icon ${h.points > 0 ? 'pine' : ''}">${icon(h.points > 0 ? 'plus' : 'minus', { size: 16 })}</span><span class="grow">${esc(h.reason)}<br><span class="small muted">${dateLabel(h.createdAt)}</span></span><span class="num strong" style="color:${h.points > 0 ? 'var(--good)' : 'var(--ink)'}">${h.points > 0 ? '+' : ''}${h.points}</span></div>`).join('')}</div>
    </div>`;
});

/* ----------------------------- Saved searches ----------------------------- */

route(/^\/account\/saved$/, async (view) => {
  setTitle('Saved searches');
  if (!requireCustomer(view)) return;
  const { savedSearches } = await api('/account/saved-searches');
  const toQuery = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]));
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <div class="page-head"><div><h1>Saved searches</h1><p>When a new piece matches one of these, it appears in your notifications.</p></div></div>
      ${savedSearches.length ? `<div class="list">${savedSearches.map((s) => `
        <div class="list-item">
          <span class="list-icon pine">${icon('bookmark', { size: 18 })}</span>
          <a class="grow" href="${hashFor('shop', toQuery(s.criteria))}"><strong>${esc(s.name)}</strong><br><span class="small muted">${esc(s.summary)}. ${s.matches ? `${plural(s.matches, 'piece')} in stock now` : 'Nothing in stock right now'}</span></a>
          <button type="button" class="icon-btn" data-del="${s.id}" aria-label="Delete saved search ${esc(s.name)}">${icon('trash-2', { size: 18 })}</button>
        </div>`).join('')}</div>`
      : emptyState({ icon: 'bookmark', title: 'No saved searches', text: 'Search or filter the shop, then choose Save search. We will tell you when something new matches.', actions: '<a class="btn btn-primary" href="#/shop">Go to the shop</a>' })}
    </div>`;
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/account/saved-searches/${b.dataset.del}`, { method: 'DELETE' }); toast('Saved search deleted.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Stock alerts ----------------------------- */

route(/^\/account\/alerts$/, async (view) => {
  setTitle('Back-in-stock alerts');
  if (!requireCustomer(view)) return;
  const { alerts } = await api('/account/alerts');
  const waiting = alerts.filter((a) => !a.fulfilledAt);
  const sent = alerts.filter((a) => a.fulfilledAt);
  const rows = (list) => `<div class="list">${list.map((a) => `
    <div class="list-item">
      <img src="${esc(a.image)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover">
      <a class="grow" href="#/product/${a.productId}"><span class="small muted">${esc(a.brand)}</span><br><strong>${esc(a.name)}</strong>${a.size ? `, size ${esc(a.size)}` : ''}<br><span class="small muted">${a.fulfilledAt ? `Back in stock, told you ${timeAgo(a.fulfilledAt)}` : `Waiting since ${dateLabel(a.createdAt)}`}</span></a>
      <button type="button" class="icon-btn" data-del="${a.id}" aria-label="Delete alert for ${esc(a.name)}">${icon('trash-2', { size: 18 })}</button>
    </div>`).join('')}</div>`;
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <div class="page-head"><div><h1>Back-in-stock alerts</h1><p>Tap a crossed-out size on any piece to be told if it comes back.</p></div></div>
      ${alerts.length ? `${waiting.length ? `<h2 class="group-label" style="margin-top:0">Waiting</h2>${rows(waiting)}` : ''}${sent.length ? `<h2 class="group-label">Sent</h2>${rows(sent)}` : ''}`
      : emptyState({ icon: 'bell', title: 'No alerts', text: 'On a sold-out piece or size, choose Tell me if it comes back.', actions: '<a class="btn btn-primary" href="#/shop">Go to the shop</a>' })}
    </div>`;
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/account/alerts/${b.dataset.del}`, { method: 'DELETE' }); toast('Alert deleted.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Notifications ----------------------------- */

route(/^\/notifications$/, async (view) => {
  setTitle('Notifications');
  if (!requireCustomer(view)) return;
  const data = await api('/notifications');
  state.unread = data.unread;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = [['Today', []], ['This week', []], ['Earlier', []]];
  for (const n of data.notifications) {
    const t = parseDate(n.createdAt).getTime();
    groups[t >= startOfToday ? 0 : t >= startOfToday - 6 * 86400000 ? 1 : 2][1].push(n);
  }
  view.innerHTML = `
    <div class="container narrow page">
      <div class="page-head"><div><h1>Notifications</h1><p>${data.unread ? `${data.unread} unread.` : 'All caught up.'} <a class="link" href="#/account/settings">Choose what you hear about</a></p></div>
        ${data.unread ? '<button type="button" class="btn btn-secondary btn-sm" id="read-all">Mark all as read</button>' : ''}</div>
      ${data.notifications.length ? groups.filter(([, l]) => l.length).map(([label, list]) => `
        <h2 class="group-label">${label}</h2>
        <div class="list">${list.map((n) => `
          <div class="note${n.isRead ? '' : ' unread'}">
            <span class="list-icon ${n.type === 'price_drop' ? 'sale' : 'pine'}">${icon(NOTE_ICONS[n.type] || 'bell', { size: 18 })}</span>
            <a href="${n.link ? '#' + esc(n.link) : '#/notifications'}" data-open="${n.id}" data-read="${n.isRead}">
              <div class="note-title">${n.isRead ? '' : '<span class="dot" aria-hidden="true"></span><span class="visually-hidden">Unread. </span>'}${esc(n.title)}</div>
              <p>${esc(n.body)}</p>
              <time datetime="${esc(n.createdAt)}">${timeAgo(n.createdAt)}</time>
            </a>
            <button type="button" class="icon-btn" data-del="${n.id}" aria-label="Delete notification">${icon('x', { size: 16 })}</button>
          </div>`).join('')}</div>`).join('')
      : emptyState({ icon: 'bell', title: 'Nothing yet', text: 'Order updates, price drops on saved pieces and replies from the store will appear here.' })}
    </div>`;
  document.getElementById('read-all')?.addEventListener('click', async () => {
    try { await api('/notifications/read-all', { method: 'PUT' }); state.unread = 0; router(); } catch (err) { toast(err.message, 'error'); }
  });
  view.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', () => {
    if (a.dataset.read === 'false') api(`/notifications/${a.dataset.open}/read`, { method: 'PUT' }).catch(() => {});
  }));
  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/notifications/${b.dataset.del}`, { method: 'DELETE' }); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Addresses ----------------------------- */

route(/^\/addresses$/, async (view, _p, query) => {
  setTitle('Delivery addresses');
  if (!requireCustomer(view)) return;
  const { addresses } = await api('/addresses');
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="${query.return === 'checkout' ? '#/checkout' : '#/account'}">${icon('chevron-left', { size: 18 })}${query.return === 'checkout' ? 'Checkout' : 'Account'}</a>
      <div class="page-head"><div><h1>Delivery addresses</h1><p>Up to ten. The default is picked first at checkout.</p></div>
        <button type="button" class="btn btn-primary btn-sm" id="add" ${addresses.length >= 10 ? 'disabled' : ''}>${icon('plus', { size: 16 })}Add address</button></div>
      ${addresses.length ? `<div class="list">${addresses.map((a) => `
        <div class="list-item" style="align-items:flex-start">
          <span class="list-icon ${a.isDefault ? 'pine' : ''}">${icon('map-pin', { size: 18 })}</span>
          <div class="grow"><strong>${esc(a.label)}</strong>${a.isDefault ? ' <span class="pill pine" style="margin-left:6px">Default</span>' : ''}<br>
            <span class="small muted">${esc(a.recipient)}${a.phone ? `, ${esc(a.phone)}` : ''}<br>${esc([a.line1, a.suburb, a.city, a.postalCode].filter(Boolean).join(', '))}</span>
            <div class="row wrap" style="margin-top:8px">
              <button type="button" class="link small" data-edit="${a.id}">Edit</button>
              ${a.isDefault ? '' : `<button type="button" class="link small" data-default="${a.id}">Make default</button>`}
              <button type="button" class="link danger small" data-delete="${a.id}">Delete</button>
            </div>
          </div>
        </div>`).join('')}</div>`
      : emptyState({ icon: 'map-pin', title: 'No saved addresses', text: 'Add one so checkout is quicker. Res, campus and work addresses all work.', actions: '<button type="button" class="btn btn-primary" id="add-empty">Add an address</button>' })}
    </div>`;

  const open = (current) => {
    const v = (k) => esc(current ? current[k] || '' : '');
    const s = openSheet({
      title: current ? 'Edit address' : 'Add an address',
      body: `<form id="address-form" novalidate><div data-form-error></div>
        <div class="field"><label for="a-label">Label</label><input class="input" id="a-label" name="label" maxlength="30" placeholder="Home, Res, Campus, Work" value="${v('label')}"></div>
        <div class="field"><label for="a-rec">Who receives it</label><input class="input" id="a-rec" name="recipient" autocomplete="name" value="${v('recipient') || esc(current ? '' : state.user.name)}"></div>
        <div class="field"><label for="a-ph">Phone for the courier (optional)</label><input class="input" id="a-ph" name="phone" type="tel" autocomplete="tel" placeholder="082 123 4567" value="${v('phone')}"></div>
        <div class="field"><label for="a-l1">Street address</label><input class="input" id="a-l1" name="line1" autocomplete="address-line1" placeholder="12 Jacaranda Street, or Res name and room" value="${v('line1')}"></div>
        <div class="field"><label for="a-sub">Suburb (optional)</label><input class="input" id="a-sub" name="suburb" value="${v('suburb')}"></div>
        <div class="form-grid">
          <div class="field"><label for="a-city">City or town</label><input class="input" id="a-city" name="city" autocomplete="address-level2" value="${v('city')}"></div>
          <div class="field"><label for="a-pc">Postal code</label><input class="input" id="a-pc" name="postalCode" inputmode="numeric" maxlength="4" autocomplete="postal-code" value="${v('postalCode')}"></div>
        </div>
        ${current ? '' : '<label class="check"><input type="checkbox" name="isDefault"> <span>Make this my default address</span></label>'}
      </form>`,
      foot: `<button type="button" class="btn btn-secondary" data-x>Cancel</button><button type="submit" form="address-form" class="btn btn-primary">${current ? 'Save changes' : 'Add address'}</button>`,
    });
    s.el.querySelector('[data-x]').addEventListener('click', s.close);
    const f = s.el.querySelector('#address-form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(f);
      const body = Object.fromEntries(new FormData(f).entries());
      body.isDefault = f.isDefault ? f.isDefault.checked : undefined;
      let bad = false;
      if (!body.recipient.trim()) { fieldError(f, 'recipient', 'Enter the name of the person receiving the parcel.'); bad = true; }
      if (body.line1.trim().length < 5) { fieldError(f, 'line1', 'Enter the street address with the house or building number.'); bad = true; }
      if (!body.city.trim()) { fieldError(f, 'city', 'Enter the city or town.'); bad = true; }
      if (!/^\d{4}$/.test(body.postalCode.trim())) { fieldError(f, 'postalCode', 'A South African postal code has four digits.'); bad = true; }
      if (bad) return;
      try {
        if (current) await api(`/addresses/${current.id}`, { method: 'PUT', body });
        else await api('/addresses', { method: 'POST', body });
        s.close();
        toast(current ? 'Address saved.' : 'Address added.', 'success');
        if (query.return === 'checkout') go('#/checkout'); else router();
      } catch (err) {
        if (/phone/i.test(err.message)) fieldError(f, 'phone', err.message); else formError(f, err.message);
      }
    });
  };
  document.getElementById('add')?.addEventListener('click', () => open(null));
  document.getElementById('add-empty')?.addEventListener('click', () => open(null));
  view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(addresses.find((a) => a.id === Number(b.dataset.edit)))));
  view.querySelectorAll('[data-default]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/addresses/${b.dataset.default}/default`, { method: 'PUT' }); toast('Default address changed.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
  view.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    const a = addresses.find((x) => x.id === Number(b.dataset.delete));
    if (!(await confirmDialog({ title: `Delete ${a.label}?`, body: esc([a.line1, a.city].join(', ')), confirmLabel: 'Delete address', danger: true }))) return;
    try { await api(`/addresses/${a.id}`, { method: 'DELETE' }); toast('Address deleted.', 'success'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Sell to us ----------------------------- */

const SELL_STEPS = ['Submitted', 'Offer made', 'Accepted', 'Received', 'Paid'];

route(/^\/sell$/, async (view) => {
  setTitle('Sell to us');
  const signedIn = isCustomer();
  const subs = signedIn ? (await api('/sell')).submissions : [];
  view.innerHTML = `
    <div class="container mid page">
      <div class="page-head"><div><h1>Sell your clothes to iTHRIFT</h1><p>We buy branded pieces in good condition. Tell us about one and we reply with an offer within two working days.</p></div></div>
      <div class="two-col">
        <div>
          ${signedIn ? `
          <form class="panel" id="sell" novalidate>
            <h2 style="font-size:1.125rem;margin-bottom:16px">Offer us a piece</h2>
            <div data-form-error></div>
            <div class="form-grid">
              <div class="field"><label for="s-brand">Brand</label><input class="input" id="s-brand" name="brand" list="brand-list" maxlength="40" placeholder="Nike, Zara, Levi's"><datalist id="brand-list">${state.brands.map((b) => `<option value="${esc(b.name)}">`).join('')}</datalist></div>
              <div class="field"><label for="s-cat">Category</label><select class="select" id="s-cat" name="category"><option value="">Choose</option>${state.categories.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select></div>
              <div class="field"><label for="s-size">Size</label><input class="input" id="s-size" name="size" maxlength="20" placeholder="M, UK 8 or 32"></div>
              <div class="field"><label for="s-ask">What you hope to get (optional)</label><input class="input" id="s-ask" name="askingPrice" type="number" inputmode="numeric" min="0" placeholder="R"></div>
            </div>
            <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="label">Condition</legend>
              ${Object.entries(CONDITIONS).map(([name, c]) => `<label class="option"><input type="radio" name="condition" value="${esc(name)}"><span class="grow"><span class="opt-title"><span>${esc(name)}</span>${conditionMeter(name, { label: false })}</span><span class="opt-sub">${esc(c.meaning)}</span></span></label>`).join('')}
            </fieldset>
            <div class="field"><label for="s-desc">Describe it</label><textarea class="textarea" id="s-desc" name="description" maxlength="500" placeholder="Colour, fit, how often it was worn, and any marks or fading"></textarea></div>
            <button class="btn btn-primary btn-lg" type="submit">Send for an offer</button>
            <p class="small muted" style="margin:12px 0 0">Bring the piece to the Hatfield store once you accept. We check it there before paying.</p>
          </form>` : `<div class="panel">${emptyState({ icon: 'hand-coins', title: 'Sign in to sell to us', text: 'You need an account so we can send you the offer and pay you.', actions: `<a class="btn btn-primary" href="#/login?next=%2Fsell">Sign in</a><a class="btn btn-secondary" href="#/register?next=%2Fsell">Create an account</a>` })}</div>`}
        </div>
        <aside class="panel">
          <h2 style="font-size:1.125rem;margin-bottom:12px">How it works</h2>
          <ol class="timeline">
            <li><div class="t-title">Tell us about it</div><div class="t-when">Brand, size, condition and any wear.</div></li>
            <li><div class="t-title">Get an offer</div><div class="t-when">Within two working days, in your notifications.</div></li>
            <li><div class="t-title">Accept and drop it off</div><div class="t-when">At Hatfield Plaza, any weekday.</div></li>
            <li><div class="t-title">Get paid</div><div class="t-when">By EFT, or as Thrift Points with 20 percent extra.</div></li>
          </ol>
          <p class="small muted" style="margin:0">We take Excellent, Very Good and Good pieces from most high-street and sports brands.</p>
        </aside>
      </div>
      ${subs.length ? `
      <section class="section" aria-labelledby="mine-h">
        <h2 id="mine-h" style="margin-bottom:16px">Your pieces</h2>
        <div class="list">${subs.map((s) => `
          <div class="list-item" style="align-items:flex-start;flex-wrap:wrap">
            <span class="list-icon">${icon(categoryIcon(s.category), { size: 18 })}</span>
            <div class="grow">
              <div class="row wrap"><strong>${esc(s.brand)} ${esc(s.category.toLowerCase())}, ${esc(s.size)}</strong><span class="pill ${statusClass(s.status)}">${esc(s.status)}</span></div>
              <div class="small muted">${esc(s.ref)}, sent ${dateLabel(s.createdAt)}. ${esc(s.condition)}.${s.askingPrice ? ` You asked ${money(s.askingPrice)}.` : ''}</div>
              ${s.staffNote ? `<div class="small" style="margin-top:6px">${esc(s.staffNote)}</div>` : ''}
              ${s.status !== 'Declined' ? `<div class="tracker" style="grid-template-columns:repeat(5,1fr);max-width:480px;margin:10px 0 0" aria-hidden="true">${SELL_STEPS.map((st, i) => `<div class="${i <= SELL_STEPS.indexOf(s.status) ? 'done' : ''}"><i></i>${st}</div>`).join('')}</div>` : ''}
              ${s.status === 'Offer made' ? `
                <div class="callout info" style="margin-top:12px">${icon('hand-coins', { size: 18 })}<p>We offer <strong>${money(s.offerAmount)}</strong> by EFT, or <strong>${s.pointsOffer} Thrift Points</strong> (worth ${money(Math.floor(s.pointsOffer / 100) * 10)} in store).</p></div>
                <div class="row wrap" style="margin-top:10px">
                  <button type="button" class="btn btn-primary btn-sm" data-accept="${s.id}" data-pay="points">Take ${s.pointsOffer} points</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-accept="${s.id}" data-pay="eft">Take ${money(s.offerAmount)} by EFT</button>
                  <button type="button" class="link quiet small" data-decline="${s.id}">Decline</button>
                </div>` : ''}
              ${s.status === 'Accepted' ? `<p class="small" style="margin:8px 0 0">Bring it to the Hatfield store with reference ${esc(s.ref)}. You chose ${s.payoutMethod === 'points' ? 'Thrift Points' : 'EFT'}.</p>` : ''}
            </div>
          </div>`).join('')}</div>
      </section>` : ''}
    </div>`;

  const f = document.getElementById('sell');
  f?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(f);
    const body = Object.fromEntries(new FormData(f).entries());
    let bad = false;
    if (!body.brand.trim()) { fieldError(f, 'brand', 'Tell us the brand.'); bad = true; }
    if (!body.category) { fieldError(f, 'category', 'Choose a category.'); bad = true; }
    if (!body.size.trim()) { fieldError(f, 'size', 'Tell us the size on the label.'); bad = true; }
    if (!body.condition) { formError(f, 'Choose the condition that fits best.'); bad = true; }
    if (body.description.trim().length < 15) { fieldError(f, 'description', 'Tell us a bit more, including any wear (at least 15 characters).'); bad = true; }
    if (bad) return;
    busy(f.querySelector('button[type="submit"]'), async () => {
      try {
        await api('/sell', { method: 'POST', body });
        toast('Sent. We will reply with an offer within two working days.', 'success');
        router();
      } catch (err) { formError(f, err.message); }
    }, 'Sending');
  });
  view.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    try {
      await api(`/sell/${b.dataset.accept}/respond`, { method: 'PUT', body: { accept: true, payoutMethod: b.dataset.pay } });
      toast('Offer accepted. Bring the piece to the store.', 'success');
      router();
    } catch (err) { toast(err.message, 'error'); }
  }, 'Accepting')));
  view.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Decline this offer?', body: 'You can offer us the piece again later.', confirmLabel: 'Decline offer', danger: true }))) return;
    try { await api(`/sell/${b.dataset.decline}/respond`, { method: 'PUT', body: { accept: false } }); toast('Offer declined.'); router(); } catch (err) { toast(err.message, 'error'); }
  }));
});

/* ----------------------------- Help centre ----------------------------- */

const FAQ = [
  ['delivery', 'Delivery and collection', [
    ['How much is delivery?', 'Standard delivery is R80 and takes 3 to 5 working days. It is free when the goods come to R1,000 or more after discounts. Express is R150 and takes 1 to 2 working days. Collection from the Hatfield store is free.'],
    ['How do I collect from the store?', 'Choose Collect from the Pretoria store at checkout, then pick a day and a two-hour slot. Bring your order number. The store is in Hatfield Plaza, Burnett Street.'],
    ['Which days count as working days?', 'Monday to Friday, except South African public holidays. The dates shown at checkout already skip weekends and holidays.'],
  ]],
  ['buying', 'Buying', [
    ['Does adding to my bag hold a piece?', 'No. Most pieces are one of a kind, so stock is only reserved when you place the order. If someone checks out first, your bag will say the piece has gone.'],
    ['What do the condition grades mean?', 'Excellent is as new. Very Good is lightly worn with no marks. Good is worn, with small marks or fading noted in the description. Fair has visible wear and is priced to match.'],
    ['Can I pay by EFT?', 'Yes. Use your order number as the reference. We start packing once the money clears.'],
    ['How do promo codes and Thrift Points work together?', 'Apply the promo code first, then choose how many points to spend. Points come off in blocks of 100 for R10.'],
  ]],
  ['returns', 'Returns and cancelling', [
    ['Can I cancel an order?', 'Yes, until it ships. Open the order and choose Cancel this order. Paid orders are refunded and any points you spent come back.'],
    ['How do I return something?', 'You have 30 days from delivery. Open the order, choose Return this piece and tell us why. Follow it under Account, then Returns.'],
    ['When do I get my money back?', 'Once the piece is back with us and has been checked, usually within 3 working days.'],
  ]],
  ['selling', 'Selling to iTHRIFT', [
    ['What do you buy?', 'Branded clothing, shoes and accessories in Good condition or better. We reply to every piece with an offer or a reason.'],
    ['How am I paid?', 'By EFT, or as Thrift Points worth 20 percent more. You choose when you accept the offer.'],
  ]],
  ['account', 'Your account', [
    ['I signed up with Google. How do I sign in?', 'Use Continue with Google in the iTHRIFT app. There is no password on your iTHRIFT account to type.'],
    ['How do I stop notifications?', 'Account, then Settings. You can switch off order updates and shopping alerts separately.'],
  ]],
];

route(/^\/help$/, async (view) => {
  setTitle('Help');
  view.innerHTML = `
    <div class="container mid page">
      <h1>How can we help?</h1>
      <div class="help-search search-field">${icon('search', { size: 18 })}<input class="search-input" id="faq-search" type="search" placeholder="Search the answers, for example returns" aria-label="Search help"></div>
      <div class="row wrap" style="margin-bottom:32px">
        <a class="btn btn-primary" href="#/help/contact">${icon('message-square', { size: 16 })}Message us</a>
        ${isCustomer() ? `<a class="btn btn-secondary" href="#/help/messages">Your conversations</a>` : ''}
        <a class="btn btn-secondary" href="#/help/size-guide">${icon('ruler', { size: 16 })}Size guide</a>
        <button type="button" class="btn btn-secondary" id="grades">How we grade condition</button>
      </div>
      <div id="faq">${FAQ.map(([id, title, qs]) => `
        <section class="faq" id="${id}" data-section style="margin-bottom:28px">
          <h2 style="font-size:1.125rem;margin-bottom:12px">${esc(title)}</h2>
          ${qs.map(([q, a]) => `<details data-q="${esc((q + ' ' + a).toLowerCase())}"><summary>${esc(q)}${icon('chevron-down', { size: 18 })}</summary><div class="faq-body">${esc(a)}</div></details>`).join('')}
        </section>`).join('')}</div>
      <div id="faq-none" hidden>${emptyState({ icon: 'search', title: 'No answer matches that', text: 'Send us a message and the store team will reply, usually the same working day.', actions: '<a class="btn btn-primary" href="#/help/contact">Message us</a>' })}</div>
      <div class="panel" style="margin-top:16px">
        <h2 style="font-size:1.125rem;margin-bottom:8px">Other ways to reach us</h2>
        <p class="muted" style="margin:0">WhatsApp or call <a class="link" href="tel:0123456789">012 345 6789</a>, email <a class="link" href="mailto:support@ithrift.co.za">support@ithrift.co.za</a>. Monday to Friday 09:00 to 17:00. Have your order number ready.</p>
      </div>
    </div>`;
  document.getElementById('grades').addEventListener('click', () => openConditionGuide());
  const input = document.getElementById('faq-search');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let any = false;
    view.querySelectorAll('[data-section]').forEach((sec) => {
      let shown = 0;
      sec.querySelectorAll('details').forEach((d) => {
        const hit = !q || d.dataset.q.includes(q);
        d.hidden = !hit;
        if (q && hit) d.open = true;
        if (hit) shown++;
      });
      sec.hidden = !shown;
      if (shown) any = true;
    });
    document.getElementById('faq-none').hidden = any;
  });
});

route(/^\/help\/size-guide$/, async (view) => {
  setTitle('Size guide');
  view.innerHTML = `<div class="container narrow page"><a class="back-link" href="#/help">${icon('chevron-left', { size: 18 })}Help</a><h1 style="margin-bottom:24px">Size guide</h1><div class="panel">${sizeGuideHtml('apparel')}</div></div>`;
  bindSizeGuide(view);
});

route(/^\/help\/contact$/, async (view, _p, query) => {
  setTitle('Message us');
  if (!requireCustomer(view)) return;
  const { orders } = await api('/orders');
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/help">${icon('chevron-left', { size: 18 })}Help</a>
      <h1>Message us</h1>
      <p class="muted" style="margin:8px 0 24px">The store team replies in your notifications, usually the same working day.</p>
      <form class="panel" id="contact" novalidate>
        <div data-form-error></div>
        <div class="form-grid">
          <div class="field"><label for="c-topic">About</label><select class="select" id="c-topic" name="topic">${['Order', 'Return', 'Selling', 'Account', 'Other'].map((t) => `<option ${query.order && t === 'Order' ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label for="c-order">Order (optional)</label><select class="select" id="c-order" name="orderId"><option value="">None</option>${orders.map((o) => `<option value="${o.id}" ${String(o.id) === query.order ? 'selected' : ''}>${esc(o.ref)}, ${dateLabel(o.createdAt)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="c-subj">Subject</label><input class="input" id="c-subj" name="subject" maxlength="80"></div>
        <div class="field"><label for="c-msg">Message</label><textarea class="textarea" id="c-msg" name="message" maxlength="1000"></textarea></div>
        <button class="btn btn-primary" type="submit">${icon('send', { size: 16 })}Send message</button>
      </form>
    </div>`;
  const f = document.getElementById('contact');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(f);
    let bad = false;
    if (f.subject.value.trim().length < 4) { fieldError(f, 'subject', 'Add a short subject.'); bad = true; }
    if (f.message.value.trim().length < 10) { fieldError(f, 'message', 'Tell us a little more (at least 10 characters).'); bad = true; }
    if (bad) return;
    busy(f.querySelector('button'), async () => {
      try {
        const { ticket } = await api('/support', { method: 'POST', body: { topic: f.topic.value, orderId: f.orderId.value || undefined, subject: f.subject.value, message: f.message.value } });
        toast('Message sent. We will reply in your notifications.', 'success');
        go('#/help/messages/' + ticket.id);
      } catch (err) { formError(f, err.message); }
    }, 'Sending');
  });
});

route(/^\/help\/messages$/, async (view) => {
  setTitle('Messages');
  if (!requireCustomer(view)) return;
  const { tickets } = await api('/support');
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="#/help">${icon('chevron-left', { size: 18 })}Help</a>
      <div class="page-head"><div><h1>Messages</h1></div><a class="btn btn-primary btn-sm" href="#/help/contact">${icon('plus', { size: 16 })}New message</a></div>
      ${tickets.length ? `<div class="list">${tickets.map((t) => `
        <a class="list-item" href="#/help/messages/${t.id}">
          <span class="list-icon ${t.status === 'Answered' ? 'pine' : ''}">${icon('message-square', { size: 18 })}</span>
          <span class="grow"><strong>${esc(t.subject)}</strong><br><span class="small muted">${esc(t.topic)}${t.orderRef ? `, ${esc(t.orderRef)}` : ''}. ${esc((t.lastMessage || '').slice(0, 70))}</span></span>
          <span class="list-meta"><span class="pill ${statusClass(t.status)}">${esc(t.status)}</span><br><span class="tiny">${timeAgo(t.updatedAt)}</span></span>
        </a>`).join('')}</div>`
      : emptyState({ icon: 'message-square', title: 'No messages yet', text: 'Ask about an order, a return or selling to us.', actions: '<a class="btn btn-primary" href="#/help/contact">Message us</a>' })}
    </div>`;
});

route(/^\/help\/messages\/(\d+)$/, async (view, [id]) => {
  if (!requireLogin()) return;
  const { ticket } = await api(`/support/${id}`);
  setTitle(ticket.subject);
  renderThread(view, ticket, false);
});

/** One support conversation. Used by customers and, in the console, by staff. */
function renderThread(view, ticket, staffView) {
  const mineSender = staffView ? 'staff' : 'customer';
  view.innerHTML = `
    <div class="container narrow page">
      <a class="back-link" href="${staffView ? '#/admin/support' : '#/help/messages'}">${icon('chevron-left', { size: 18 })}${staffView ? 'Support inbox' : 'Messages'}</a>
      <div class="page-head"><div><h1 style="font-size:1.5rem">${esc(ticket.subject)}</h1><p>${esc(ticket.ref)}, ${esc(ticket.topic)}${ticket.orderRef ? `, <a class="link" href="#/orders/${ticket.orderId}">${esc(ticket.orderRef)}</a>` : ''}${staffView ? `, from ${esc(ticket.customer)}` : ''}</p></div>
        <div class="row"><span class="pill ${statusClass(ticket.status)}">${esc(ticket.status)}</span>
        ${ticket.status !== 'Closed' ? '<button type="button" class="btn btn-secondary btn-sm" id="close-t">Mark as sorted</button>' : (staffView ? '<button type="button" class="btn btn-secondary btn-sm" id="reopen-t">Reopen</button>' : '')}</div></div>
      <div class="thread" aria-live="polite">${ticket.messages.map((m) => `
        <div class="bubble ${m.sender === mineSender ? 'mine' : 'theirs'}">${esc(m.body)}<div class="who">${esc(m.sender === mineSender ? 'You' : m.author)}, ${timeAgo(m.createdAt)}</div></div>`).join('')}</div>
      ${ticket.status !== 'Closed' || staffView ? `
      <form class="composer" id="reply"><label class="visually-hidden" for="reply-msg">Reply</label><textarea class="textarea grow" id="reply-msg" name="message" maxlength="1000" placeholder="Write a reply" rows="1"></textarea><button class="btn btn-primary" type="submit" aria-label="Send reply">${icon('send', { size: 18 })}</button></form>`
      : '<p class="small muted" style="margin-top:16px">This conversation is closed. <a class="link" href="#/help/contact">Start a new one</a> if you need more help.</p>'}
    </div>`;
  const reload = async () => {
    const { ticket: t } = await api(`/support/${ticket.id}`);
    renderThread(view, t, staffView);
  };
  const f = document.getElementById('reply');
  const ta = document.getElementById('reply-msg');
  ta?.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; });
  f?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (ta.value.trim().length < 2) { ta.focus(); return; }
    busy(f.querySelector('button'), async () => {
      try { await api(`/support/${ticket.id}/messages`, { method: 'POST', body: { message: ta.value } }); await reload(); document.getElementById('reply-msg')?.focus(); }
      catch (err) { toast(err.message, 'error'); }
    }, 'Sending');
  });
  document.getElementById('close-t')?.addEventListener('click', async () => {
    try { await api(`/support/${ticket.id}/status`, { method: 'PUT', body: { status: 'Closed' } }); toast('Marked as sorted.', 'success'); await reload(); } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('reopen-t')?.addEventListener('click', async () => {
    try { await api(`/support/${ticket.id}/status`, { method: 'PUT', body: { status: 'Open' } }); await reload(); } catch (err) { toast(err.message, 'error'); }
  });
}
