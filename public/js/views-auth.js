'use strict';

/* =========================================================================
   Sign in, register, welcome onboarding, orders (list, tracking, receipt),
   returns and the About page.
   ========================================================================= */

/* ----------------------------- Sign in and register ----------------------------- */

/** A South African cellphone number in any common form, as ten digits, or null. */
function saPhone(value) {
  let d = String(value || '').replace(/[\s\-()]/g, '');
  if (d.startsWith('+27')) d = '0' + d.slice(3);
  else if (d.startsWith('27') && d.length === 11) d = '0' + d.slice(2);
  return /^0[6-8]\d{8}$/.test(d) ? d : null;
}

function afterSignIn(user, next) {
  if (next) return go('#' + next);
  go(user.type === 'customer' ? '#/' : '#/admin');
}

/**
 * Single sign-on on the website.
 *
 * Draws Google's own "Continue with Google" button when the server reports
 * that single sign-on is configured, and hides it otherwise. Google hands
 * the page an ID token, and the page only passes it on to POST /api/auth/sso:
 * the server verifies the token with Google before any session is issued,
 * exactly as it does for the Android app.
 *
 * Reference: Google. 2025. Display the Sign in with Google button.
 * https://developers.google.com/identity/gsi/web/guides/display-button
 */
let googleScriptPromise = null;

function loadGoogleScript() {
  if (window.google && window.google.accounts) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { googleScriptPromise = null; reject(new Error('Google sign-in could not be loaded.')); };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

async function mountGoogleSignIn(container, form, next, onCredential = null) {
  if (!container) return;
  let status;
  try {
    status = await api('/auth/sso/status');
  } catch (_) {
    return; // No status means no button; email and password still work.
  }
  if (!status.enabled || !status.clientId) {
    if (onCredential) container.innerHTML = '<div class="callout warn">Google sign-in is not set up on this server.</div>';
    return;
  }
  try {
    await loadGoogleScript();
  } catch (err) {
    console.warn('[sso]', err.message);
    return;
  }
  // The page may have changed while the script was loading.
  if (!document.body.contains(container)) return;

  container.innerHTML = (onCredential ? '' : '<div class="sso-divider"><span>or</span></div>') + '<div class="sso-button"></div>';
  google.accounts.id.initialize({
    client_id: status.clientId,
    callback: async (response) => {
      clearErrors(form);
      if (onCredential) return onCredential(response.credential);
      try {
        const { token, user } = await api('/auth/sso', { method: 'POST', body: { idToken: response.credential } });
        setSession(token, user);
        await refreshCounts();
        toast(`Signed in as ${user.name.split(' ')[0]}.`, 'success');
        afterSignIn(user, next);
      } catch (err) { formError(form, err.message); }
    },
  });
  google.accounts.id.renderButton(container.querySelector('.sso-button'), {
    theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: Math.min(container.clientWidth || 360, 400),
  });
}

route(/^\/login$/, async (view, _p, query) => {
  setTitle('Sign in');
  if (state.user) { afterSignIn(state.user, query.next); return; }
  view.innerHTML = `
    <div class="container">
      <div class="auth">
        <h1>Sign in</h1>
        <p class="muted">Use the email address or cellphone number on your account.</p>
        <form id="login" novalidate style="margin-top:24px">
          <div data-form-error></div>
          <div class="field"><label for="identifier">Email or cellphone number</label><input class="input" id="identifier" name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
          <div class="field"><div class="label-row"><label for="password">Password</label><button type="button" class="link small" id="show-pw" aria-controls="password">Show</button></div><input class="input" id="password" name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
        </form>
        <div id="google-signin"></div>
        <p class="small" style="margin-top:20px;text-align:center">New to iTHRIFT? <a class="link" href="#/register${query.next ? '?next=' + encodeURIComponent(query.next) : ''}">Create an account</a></p>
      </div>
    </div>`;
  const form = document.getElementById('login');
  mountGoogleSignIn(document.getElementById('google-signin'), form, query.next);
  document.getElementById('show-pw').addEventListener('click', (e) => {
    const pw = form.password;
    pw.type = pw.type === 'password' ? 'text' : 'password';
    e.currentTarget.textContent = pw.type === 'password' ? 'Show' : 'Hide';
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(form);
    const id = form.identifier.value.trim();
    if (!id) return fieldError(form, 'identifier', 'Enter your email address or cellphone number.');
    if (!id.includes('@') && !/^[+\d][\d\s\-()]*$/.test(id)) return fieldError(form, 'identifier', 'Enter an email address or a cellphone number, like 082 123 4567.');
    if (!form.password.value) return fieldError(form, 'password', 'Enter your password.');
    busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier: form.identifier.value.trim(), password: form.password.value } });
        setSession(token, user);
        await refreshCounts();
        toast(`Signed in as ${user.name.split(' ')[0]}.`, 'success');
        afterSignIn(user, query.next);
      } catch (err) { formError(form, err.message); }
    }, 'Signing in');
  });
});

/**
 * Google sign-in for the Android app. The app opens this page in a browser
 * tab with a challenge; after Google signs the customer in, the server gives
 * a single-use code that only the app can swap for a session, and the page
 * hands that code back to the app through an ithrift:// link. See
 * server/utils/app-codes.js for why it is a code and not a token.
 */
route(/^\/app-sign-in$/, async (view, _p, query) => {
  setTitle('Sign in to the app');
  const challenge = query.challenge || '';
  view.innerHTML = `
    <div class="container">
      <div class="auth">
        <h1>Sign in to the iTHRIFT app</h1>
        <p class="muted">Choose your Google account. You will go straight back to the app.</p>
        <form id="app-sso" novalidate style="margin-top:16px"><div data-form-error></div></form>
        <div id="google-signin"></div>
        <div id="back-to-app"></div>
      </div>
    </div>`;
  const form = document.getElementById('app-sso');
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    formError(form, 'Open this page from the iTHRIFT app: tap Continue with Google on the app\'s sign-in screen.');
    return;
  }
  const back = (qs, label) => {
    const href = 'ithrift://signed-in?' + qs;
    document.getElementById('google-signin').innerHTML = '';
    document.getElementById('back-to-app').innerHTML = `<a class="btn btn-primary btn-lg btn-block" href="${esc(href)}" style="margin-top:20px">${esc(label)}</a>`;
    window.location.href = href;
  };
  mountGoogleSignIn(document.getElementById('google-signin'), form, null, async (credential) => {
    try {
      const { code } = await api('/auth/sso', { method: 'POST', body: { idToken: credential, challenge } });
      back('code=' + encodeURIComponent(code), 'Open the iTHRIFT app');
    } catch (err) {
      formError(form, err.message);
      document.getElementById('back-to-app').innerHTML = `<a class="btn btn-secondary btn-lg btn-block" href="ithrift://signed-in?cancelled=1" style="margin-top:20px">Back to the app</a>`;
    }
  });
});

route(/^\/register$/, async (view, _p, query) => {
  setTitle('Create an account');
  if (state.user) { afterSignIn(state.user, query.next); return; }
  view.innerHTML = `
    <div class="container">
      <div class="auth">
        <h1>Create an account</h1>
        <p class="muted">You start with 50 Thrift Points.</p>
        <form id="register" novalidate style="margin-top:24px">
          <div data-form-error></div>
          <div class="form-grid">
            <div class="field"><label for="firstName">First name</label><input class="input" id="firstName" name="firstName" autocomplete="given-name" required></div>
            <div class="field"><label for="lastName">Last name</label><input class="input" id="lastName" name="lastName" autocomplete="family-name" required></div>
          </div>
          <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="phone">Cellphone number</label><input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="082 123 4567" required aria-describedby="phone-hint">
            <div class="hint" id="phone-hint">You can sign in with this number too.</div></div>
          <div class="field"><div class="label-row"><label for="password">Password</label><button type="button" class="link small" id="show-pw" aria-controls="password confirmPassword">Show</button></div><input class="input" id="password" name="password" type="password" autocomplete="new-password" required aria-describedby="pw-hint">
            <div class="hint" id="pw-hint">At least 8 characters, with an uppercase letter and a number.</div></div>
          <div class="field"><label for="confirmPassword">Confirm password</label><input class="input" id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required></div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
        </form>
        <div id="google-signin"></div>
        <p class="small" style="margin-top:20px;text-align:center">Already have an account? <a class="link" href="#/login${query.next ? '?next=' + encodeURIComponent(query.next) : ''}">Sign in</a></p>
      </div>
    </div>`;
  const form = document.getElementById('register');
  mountGoogleSignIn(document.getElementById('google-signin'), form, query.next);
  document.getElementById('show-pw').addEventListener('click', (e) => {
    const show = form.password.type === 'password';
    form.password.type = form.confirmPassword.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = Object.fromEntries(new FormData(form).entries());
    let bad = false;
    if (!v.firstName.trim()) { fieldError(form, 'firstName', 'Enter your first name.'); bad = true; }
    if (!v.lastName.trim()) { fieldError(form, 'lastName', 'Enter your last name.'); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { fieldError(form, 'email', 'Enter an email address like name@example.com.'); bad = true; }
    if (!saPhone(v.phone)) { fieldError(form, 'phone', 'Enter a South African cellphone number, like 082 123 4567.'); bad = true; }
    if (!(v.password.length >= 8 && /[A-Z]/.test(v.password) && /\d/.test(v.password))) { fieldError(form, 'password', 'Use at least 8 characters, with an uppercase letter and a number.'); bad = true; }
    else if (v.confirmPassword !== v.password) { fieldError(form, 'confirmPassword', 'The two passwords do not match.'); bad = true; }
    if (bad) { form.querySelector('[aria-invalid="true"]').focus(); return; }
    busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const { token, user } = await api('/auth/register', { method: 'POST', body: v });
        setSession(token, user);
        await refreshCounts();
        go('#/welcome' + (query.next ? '?next=' + encodeURIComponent(query.next) : ''));
      } catch (err) {
        if (/email/i.test(err.message)) fieldError(form, 'email', err.message);
        else if (/cellphone/i.test(err.message)) fieldError(form, 'phone', err.message);
        else if (/match/i.test(err.message)) fieldError(form, 'confirmPassword', err.message);
        else formError(form, err.message);
      }
    }, 'Creating account');
  });
});

/* ----------------------------- Welcome onboarding ----------------------------- */

route(/^\/welcome$/, async (view, _p, query) => {
  setTitle('Welcome');
  if (!requireCustomer(view)) return;
  const ov = await api('/account/overview');
  const picks = { sizes: new Set(ov.style.sizes), brands: new Set(ov.style.brands) };
  let step = 0;
  const finish = () => { store.set('ithrift_onboard_later', '1'); go(query.next ? '#' + query.next : '#/'); };

  const steps = [
    () => `
      <h1>Welcome to iTHRIFT, ${esc(ov.customer.firstName)}.</h1>
      <p class="lead" style="margin-top:12px">Two quick questions, and the shop will put pieces in your sizes and favourite brands first. You can change them any time under Account.</p>
      <div class="list" style="margin-top:24px">
        <div class="list-item"><span class="list-icon pine">${icon('ruler', { size: 18 })}</span><span>Pieces in your sizes, picked out on the home page</span></div>
        <div class="list-item"><span class="list-icon pine">${icon('bell', { size: 18 })}</span><span>Alerts when a saved piece drops in price</span></div>
        <div class="list-item"><span class="list-icon pine">${icon('coins', { size: 18 })}</span><span>${ov.points.balance} Thrift Points to start you off</span></div>
      </div>`,
    () => `
      <h1>What sizes do you wear?</h1>
      <p class="muted" style="margin-top:8px">Choose any that apply.</p>
      ${sizeGroups(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', '28', '30', '32', '34', '36', '38', '40', '42', '44'])
        .map(([label, list]) => `<h2 style="font-size:1rem;margin:24px 0 10px">${label}</h2><div class="filter-options">${list.map((s) => `<button type="button" class="chip" data-size="${esc(s)}" aria-pressed="${picks.sizes.has(s)}">${esc(s)}</button>`).join('')}</div>`).join('')}`,
    () => `
      <h1>Any favourite brands?</h1>
      <p class="muted" style="margin-top:8px">We will show these first.</p>
      <div class="filter-options" style="margin-top:20px">${state.brands.filter((b) => b.name !== 'Generic').map((b) => `<button type="button" class="chip" data-brand="${esc(b.name)}" aria-pressed="${picks.brands.has(b.name)}">${esc(b.name)}</button>`).join('')}</div>`,
  ];

  function draw() {
    view.innerHTML = `
      <div class="container">
        <div class="onboard">
          <div class="dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
          <p class="visually-hidden">Step ${step + 1} of ${steps.length}</p>
          <div class="panel" style="padding:32px">${steps[step]()}</div>
          <div class="row between" style="margin-top:20px">
            <button type="button" class="btn btn-ghost" id="skip">${step === 0 ? 'Not now' : 'Back'}</button>
            <button type="button" class="btn btn-primary btn-lg" id="next">${step === steps.length - 1 ? 'Show me the shop' : step === 0 ? 'Get started' : 'Continue'}</button>
          </div>
        </div>
      </div>`;
    view.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => { toggleSet(picks.sizes, b.dataset.size); b.setAttribute('aria-pressed', String(picks.sizes.has(b.dataset.size))); }));
    view.querySelectorAll('[data-brand]').forEach((b) => b.addEventListener('click', () => { toggleSet(picks.brands, b.dataset.brand); b.setAttribute('aria-pressed', String(picks.brands.has(b.dataset.brand))); }));
    document.getElementById('skip').addEventListener('click', async () => {
      if (step > 0) { step--; draw(); return; }
      try { await api('/account/style', { method: 'PUT', body: { skip: true } }); } catch (_) { /* fine */ }
      finish();
    });
    document.getElementById('next').addEventListener('click', (e) => {
      if (step < steps.length - 1) { step++; draw(); view.querySelector('h1').focus?.(); return; }
      busy(e.currentTarget, async () => {
        try {
          await api('/account/style', { method: 'PUT', body: { sizes: [...picks.sizes], brands: [...picks.brands] } });
          toast('Saved. The shop now starts with your sizes.', 'success');
          finish();
        } catch (err) { toast(err.message, 'error'); }
      }, 'Saving');
    });
    view.querySelector('h1').setAttribute('tabindex', '-1');
  }
  draw();
});

function toggleSet(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }

/* ----------------------------- Orders ----------------------------- */

route(/^\/orders$/, async (view) => {
  setTitle('Orders');
  if (!requireLogin()) return;
  if (isStaff()) { go('#/admin/orders'); return; }
  const { orders } = await api('/orders');
  if (!orders.length) {
    view.innerHTML = `<div class="container">${emptyState({ icon: 'package', title: 'No orders yet', text: 'When you buy something, you can follow it here from packing to your door.', actions: '<a class="btn btn-primary" href="#/shop">Start shopping</a>' })}</div>`;
    return;
  }
  const active = orders.filter((o) => o.status === 'Processing' || o.status === 'Shipped');
  const past = orders.filter((o) => !active.includes(o));
  const rows = (list) => `<div class="list">${list.map((o) => `
    <a class="order-row" href="#/orders/${o.id}">
      <img src="${esc(o.image || '')}" alt="">
      <div><strong>${esc(o.ref)}</strong><div class="meta">${dateLabel(o.createdAt)}, ${plural(o.itemCount, 'piece')}${o.collectionDate ? `, collect ${esc(ithriftCalendar.label(o.collectionDate))}` : ''}${o.isGift ? ', gift' : ''}</div></div>
      <div class="right"><span class="pill ${statusClass(o.status)}">${esc(o.status)}</span><span class="num small">${money(o.total)}</span></div>
    </a>`).join('')}</div>`;
  view.innerHTML = `
    <div class="container mid page">
      <div class="page-head"><div><h1>Orders</h1></div><a class="btn btn-secondary btn-sm" href="#/returns">Returns</a></div>
      ${active.length ? `<h2 class="group-label" style="margin-top:0">On the way</h2>${rows(active)}` : ''}
      ${past.length ? `<h2 class="group-label">Earlier</h2>${rows(past)}` : ''}
    </div>`;
});

const STATUS_FLOW = ['Processing', 'Shipped', 'Delivered'];
const STATUS_WORDS = { Processing: 'Order placed', Shipped: 'With the courier', Delivered: 'Delivered', Cancelled: 'Cancelled' };

route(/^\/orders\/(\d+)$/, async (view, [id]) => {
  if (!requireLogin()) return;
  const [{ order }, options] = await Promise.all([api(`/orders/${id}`), loadOptions()]);
  setTitle(order.ref);
  const staff = isStaff();
  const step = STATUS_FLOW.indexOf(order.status);
  const collect = order.deliveryMethod === 'collection';

  view.innerHTML = `
    <div class="container mid page">
      <a class="back-link" href="${staff ? '#/admin/orders' : '#/orders'}">${icon('chevron-left', { size: 18 })}Orders</a>
      <div class="page-head">
        <div><h1>${esc(order.ref)}</h1><p>Placed ${dateLabel(order.createdAt)} at ${timeLabel(order.createdAt)}${staff ? ` by ${esc(order.customer.name)}, ${esc(order.customer.email)}` : ''}</p></div>
        <div class="row wrap">
          <span class="pill ${statusClass(order.status)}">${esc(order.status)}</span>
          <a class="btn btn-secondary btn-sm" href="#/orders/${order.id}/receipt">${icon('printer', { size: 16 })}Receipt</a>
        </div>
      </div>

      <div class="two-col">
        <div>
          <section class="panel" aria-labelledby="track-h">
            <h2 id="track-h" style="font-size:1.125rem;margin-bottom:12px">${order.status === 'Cancelled' ? 'This order was cancelled' : collect ? 'Collection' : 'Tracking'}</h2>
            ${order.status !== 'Cancelled' ? `<div class="tracker" aria-hidden="true">${STATUS_FLOW.map((s, i) => `<div class="${i <= step ? 'done' : ''}"><i></i>${collect && s === 'Shipped' ? 'Ready' : collect && s === 'Delivered' ? 'Collected' : s}</div>`).join('')}</div>` : ''}
            <ol class="timeline">
              ${order.history.map((h) => `<li class="${h.status === 'Cancelled' ? 'cancelled' : ''}"><div class="t-title">${esc(STATUS_WORDS[h.status] || h.status)}</div><div class="t-when">${dateLabel(h.at, { weekday: true })}, ${timeLabel(h.at)}${h.note ? `. ${esc(h.note)}` : ''}</div></li>`).join('')}
              ${order.nextStep ? `<li class="next"><div class="t-title">${esc(order.nextStep.status === 'Ready to collect' ? 'Ready to collect' : order.nextStep.status === 'Shipped' ? 'Handed to the courier' : 'Delivery')}</div><div class="t-when">Expected ${order.nextStep.from && order.nextStep.from !== order.nextStep.date ? `${esc(ithriftCalendar.label(order.nextStep.from))} to ` : ''}${esc(ithriftCalendar.label(order.nextStep.date))}${order.nextStep.slot ? `, ${esc(order.nextStep.slot)}` : ''}</div></li>` : ''}
            </ol>
            ${order.courierRef ? `<p class="small" style="margin:0">Courier reference <strong>${esc(order.courierRef)}</strong></p>` : ''}
          </section>

          <section class="panel" aria-labelledby="items-h">
            <h2 id="items-h" style="font-size:1.125rem;margin-bottom:8px">${plural(order.items.length, 'piece')}</h2>
            ${order.items.map((i) => `
              <div class="line">
                <a class="line-thumb" href="#/product/${i.productId}"><img src="${esc(i.image)}" alt=""></a>
                <div>
                  <a class="line-title" href="#/product/${i.productId}">${esc(i.name)}</a>
                  <div class="line-sub">${esc(i.brand)}${i.size ? `, size ${esc(i.size)}` : ''}${i.quantity > 1 ? `, ${i.quantity} pieces` : ''}</div>
                  ${i.returnStatus ? `<div style="margin-top:6px"><span class="pill ${statusClass(i.returnStatus)}">Return ${esc(i.returnStatus.toLowerCase())}</span> <span class="small muted">${esc(i.returnReason || '')}</span></div>` : ''}
                  ${!staff && i.canReturn ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px" data-return="${i.orderItemId}" data-name="${esc(i.name)}">${icon('rotate-ccw', { size: 16 })}Return this piece</button>` : ''}
                </div>
                <div class="line-price">${money(i.lineTotal)}</div>
              </div>`).join('')}
            ${orderTotals(order)}
            <p class="tiny muted" style="margin:6px 0 0">Includes ${money(order.vatIncluded, { cents: true })} VAT.</p>
          </section>
        </div>

        <aside class="sticky-side">
          ${staff ? `
          <section class="panel" aria-labelledby="process-h">
            <h2 id="process-h" style="font-size:1.125rem;margin-bottom:12px">Process order</h2>
            ${order.nextStatuses.length ? `
            <form id="status-form">
              <div class="field"><label for="st">Move to</label><select class="select" id="st" name="status">${order.nextStatuses.map((s) => `<option value="${s}">${collect ? ({ Shipped: 'Ready to collect', Delivered: 'Collected' }[s] || s) : s}</option>`).join('')}</select></div>
              <div class="field" id="courier-field"${collect ? ' hidden' : ''}><label for="courier">Courier reference</label><input class="input" id="courier" name="courierRef" value="${esc(order.courierRef || '')}" placeholder="For example CR-1042"></div>
              <div class="field"><label for="note">Note for the timeline (optional)</label><input class="input" id="note" name="note" maxlength="200"></div>
              <button class="btn btn-primary btn-block" type="submit">Update order</button>
            </form>` : `<p class="muted small" style="margin:0">This order is ${esc(order.status.toLowerCase())}, so nothing more can change.</p>`}
          </section>` : ''}
          <section class="panel" aria-labelledby="where-h">
            <h2 id="where-h" style="font-size:1.125rem;margin-bottom:8px">${collect ? 'Collect from' : 'Delivery'}</h2>
            <p class="small" style="margin:0">${esc(order.deliveryLabel)}<br><span class="muted">${esc((order.deliveryAddress || '').replace(/^Collect from:\s*/, ''))}</span></p>
            ${order.collectionDate ? `<p class="small" style="margin:8px 0 0"><strong>${esc(ithriftCalendar.label(order.collectionDate))}, ${esc(order.collectionSlot)}</strong></p>` : ''}
            ${order.deliveryInstructions ? `<p class="small muted" style="margin:8px 0 0">Instructions: ${esc(order.deliveryInstructions)}</p>` : ''}
            ${order.isGift ? `<div class="callout" style="margin-top:12px">${icon('gift', { size: 18 })}<p>Gift order${order.giftMessage ? `: &ldquo;${esc(order.giftMessage)}&rdquo;` : ''}</p></div>` : ''}
            <div class="divider"></div>
            <div class="summary-row"><span>Payment</span><span>${esc(paymentLabel(order.payment))}</span></div>
            ${order.pointsEarned ? `<div class="summary-row"><span>Points earned</span><span>${order.pointsEarned}</span></div>` : ''}
          </section>
          ${!staff ? `
          <section class="panel">
            ${order.canCancel ? `<button type="button" class="btn btn-danger btn-block" id="cancel">Cancel this order</button><p class="small muted" style="margin:8px 0 16px">You can cancel until it ships. Paid orders are refunded and any points come back.</p>` : ''}
            ${order.returnWindowOpen ? `<p class="small muted">You can return pieces for ${plural(order.returnDaysLeft, 'more day')}.</p>` : ''}
            <a class="btn btn-quiet btn-block" href="#/help/contact?order=${order.id}">${icon('message-square', { size: 16 })}Ask about this order</a>
          </section>` : ''}
        </aside>
      </div>
    </div>`;

  document.getElementById('cancel')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Cancel ${order.ref}?`, body: 'The pieces go back on sale straight away, so you may not get them back. Paid orders are refunded.', confirmLabel: 'Cancel order', danger: true });
    if (!ok) return;
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'PUT' });
      toast('Order cancelled.', 'success');
      router();
    } catch (err) { toast(err.message, 'error'); }
  });

  view.querySelectorAll('[data-return]').forEach((b) => b.addEventListener('click', () => {
    const s = openSheet({
      title: 'Return a piece', variant: 'center',
      body: `<p class="muted">${esc(b.dataset.name)}</p>
        <form id="return-form"><div data-form-error></div>
          <fieldset style="border:0;padding:0;margin:0"><legend class="label">Why are you returning it?</legend>
            ${options.returnReasons.map((r, i) => `<label class="option"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? '' : ''}><span>${esc(r)}</span></label>`).join('')}
          </fieldset>
          <div class="field" style="margin-top:16px"><label for="ret-comment">Anything else? (optional)</label><textarea class="textarea" id="ret-comment" name="comment" maxlength="300"></textarea></div>
        </form>`,
      foot: `<button type="button" class="btn btn-secondary" data-x>Keep it</button><button type="submit" form="return-form" class="btn btn-primary">Request return</button>`,
    });
    s.el.querySelector('[data-x]').addEventListener('click', s.close);
    s.el.querySelector('#return-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      clearErrors(f);
      const reason = (f.querySelector('input[name="reason"]:checked') || {}).value;
      if (!reason) return formError(f, 'Choose a reason.');
      try {
        await api(`/orders/${order.id}/returns`, { method: 'POST', body: { orderItemId: Number(b.dataset.return), reason, comment: f.comment.value || undefined } });
        s.close();
        toast('Return requested. We will let you know once it is approved.', 'success');
        router();
      } catch (err) { formError(f, err.message); }
    });
  }));

  const sf = document.getElementById('status-form');
  if (sf) {
    const syncCourier = () => { document.getElementById('courier-field').hidden = collect || sf.status.value !== 'Shipped'; };
    sf.status.addEventListener('change', syncCourier);
    syncCourier();
    sf.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(sf.querySelector('button'), async () => {
        try {
          await api(`/orders/${order.id}/status`, { method: 'PUT', body: { status: sf.status.value, courierRef: sf.courierRef.value || undefined, note: sf.note.value || undefined } });
          toast(`Order marked ${sf.status.value.toLowerCase()}. The customer has been notified.`, 'success');
          router();
        } catch (err) { toast(err.message, 'error'); }
      }, 'Updating');
    });
  }
});

/* ----------------------------- Receipt (tax invoice) ----------------------------- */

route(/^\/orders\/(\d+)\/receipt$/, async (view, [id], query) => {
  if (!requireLogin()) return;
  const { order } = await api(`/orders/${id}`);
  setTitle(`Receipt ${order.ref}`);
  const gift = query.gift === '1';
  view.innerHTML = `
    <div class="container">
      <div class="row wrap no-print" style="padding-top:24px;justify-content:space-between">
        <a class="back-link" href="#/orders/${order.id}" style="margin:0">${icon('chevron-left', { size: 18 })}${esc(order.ref)}</a>
        <div class="row wrap">
          <div class="segmented" role="group" aria-label="Receipt type">
            <button type="button" aria-pressed="${!gift}" onclick="go('#/orders/${order.id}/receipt')">Tax invoice</button>
            <button type="button" aria-pressed="${gift}" onclick="go('#/orders/${order.id}/receipt?gift=1')">Gift slip</button>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.print()">${icon('printer', { size: 16 })}Print or save as PDF</button>
        </div>
      </div>
      <article class="receipt">
        <div class="receipt-head">
          <div><div class="logo" style="margin-bottom:16px"><span class="logo-mark">i</span>iTHRIFT Clothes</div>
            <p class="small muted" style="margin:0">${esc(order.store.address)}<br>${esc(order.store.email)}, ${esc(order.store.phone)}</p></div>
          <div style="text-align:right"><h1>${gift ? 'Gift slip' : 'Tax invoice'}</h1><p class="small muted" style="margin:6px 0 0">${esc(order.ref)}<br>${dateLabel(order.createdAt)}</p></div>
        </div>
        <p class="small" style="margin:24px 0 0"><strong>${gift ? 'For' : 'Customer'}</strong><br>${esc(gift ? (order.deliveryAddress || '').split(',')[0] : order.customer.name)}${gift ? '' : `<br>${esc(order.customer.email)}`}</p>
        ${gift && order.giftMessage ? `<p style="margin-top:16px;font-size:1.125rem">&ldquo;${esc(order.giftMessage)}&rdquo;</p>` : ''}
        <table>
          <thead><tr><th>Item</th><th>Size</th><th>Qty</th>${gift ? '' : '<th>Amount</th>'}</tr></thead>
          <tbody>${order.items.map((i) => `<tr><td>${esc(i.brand)} ${esc(i.name)}<br><span class="small muted">${esc(i.productRef)}, pre-loved, ${esc(i.category.toLowerCase())}</span></td><td>${esc(i.size || '')}</td><td>${i.quantity}</td>${gift ? '' : `<td>${money(i.lineTotal, { cents: true })}</td>`}</tr>`).join('')}</tbody>
        </table>
        ${gift ? '<p class="small muted">Returns within 30 days of delivery with this slip. The refund goes to the person who paid.</p>' : `
        <div style="max-width:320px;margin-left:auto">
          <div class="summary-row"><span>Subtotal</span><span>${money(order.subtotal, { cents: true })}</span></div>
          ${order.discount ? `<div class="summary-row"><span>Promo ${esc(order.promoCode || '')}</span><span>-${money(order.discount, { cents: true })}</span></div>` : ''}
          ${order.pointsDiscount ? `<div class="summary-row"><span>Thrift Points</span><span>-${money(order.pointsDiscount, { cents: true })}</span></div>` : ''}
          <div class="summary-row"><span>${esc(order.deliveryLabel)}</span><span>${money(order.deliveryFee, { cents: true })}</span></div>
          <div class="summary-row total"><span>Total</span><span>${money(order.total, { cents: true })}</span></div>
          <div class="summary-row small muted"><span>VAT included at 15%</span><span>${money(order.vatIncluded, { cents: true })}</span></div>
          <div class="summary-row small muted"><span>Paid by</span><span>${esc(paymentLabel(order.payment))}</span></div>
        </div>`}
      </article>
    </div>`;
});

/* ----------------------------- Returns ----------------------------- */

route(/^\/returns$/, async (view) => {
  setTitle('Returns');
  if (!requireCustomer(view)) return;
  const { returns } = await api('/returns');
  const steps = ['Requested', 'Approved', 'Refunded'];
  view.innerHTML = `
    <div class="container mid page">
      <a class="back-link" href="#/account">${icon('chevron-left', { size: 18 })}Account</a>
      <div class="page-head"><div><h1>Returns</h1><p>Return any piece within 30 days of delivery. Open the order and choose Return this piece.</p></div></div>
      ${returns.length ? `<div class="panel">${returns.map((r) => `
        <div class="line">
          <span class="line-thumb"><img src="${esc(r.image)}" alt=""></span>
          <div>
            <div class="line-title">${esc(r.productName)}</div>
            <div class="line-sub">${r.size ? `Size ${esc(r.size)}, ` : ''}${esc(r.reason)}. Asked ${timeAgo(r.createdAt)} on <a class="link" href="#/orders/${r.orderId}">${esc(r.orderRef)}</a></div>
            ${r.status !== 'Rejected' ? `<div class="tracker" style="margin:12px 0 0;max-width:360px" aria-label="Return ${esc(r.status.toLowerCase())}">${steps.map((s, i) => `<div class="${i <= steps.indexOf(r.status) ? 'done' : ''}"><i></i>${s}</div>`).join('')}</div>` : '<p class="small" style="margin:8px 0 0;color:var(--bad)">This return was not accepted. Contact us from Help if you think that is wrong.</p>'}
          </div>
          <div class="line-price">${r.status === 'Refunded' ? money(r.refundAmount) : `<span class="pill ${statusClass(r.status)}">${esc(r.status)}</span>`}</div>
        </div>`).join('')}</div>` : emptyState({ icon: 'rotate-ccw', title: 'No returns', text: 'If something is not right, open a delivered order and choose Return this piece.', actions: '<a class="btn btn-primary" href="#/orders">Open my orders</a>' })}
    </div>`;
});

/* ----------------------------- About ----------------------------- */

/**
 * The privacy policy, written for the Protection of Personal Information Act
 * (POPIA) and linked from the Play Store listing, the footer and Settings.
 * It describes what this system actually stores; keep it in step with the
 * database (server/init-db.js) when a table gains personal data.
 */
route(/^\/privacy$/, async (view) => {
  setTitle('Privacy policy');
  view.innerHTML = `
    <div class="container narrow page prose">
      <h1>Privacy policy</h1>
      <p class="lead" style="margin-top:12px">How iTHRIFT Clothes looks after the personal information you give us on this website and in the iTHRIFT app. Last updated 26 October 2026.</p>

      <h2>Who we are</h2>
      <p>iTHRIFT Clothes, Hatfield Plaza, Burnett Street, Hatfield, Pretoria, 0083. We are the responsible party for your information under the Protection of Personal Information Act 4 of 2013 (POPIA). Questions go to <a class="link" href="mailto:support@ithrift.co.za">support@ithrift.co.za</a> or 012 345 6789.</p>

      <h2>What we collect, and why</h2>
      <ul>
        <li><strong>Your account:</strong> your name, email address, cellphone number and a scrambled (hashed) copy of your password. We never store the password itself. If you sign in with Google, we receive your name, email address and Google's account number for you, and no password at all.</li>
        <li><strong>Delivery:</strong> the addresses you save, so we can deliver your orders.</li>
        <li><strong>Orders and payments:</strong> what you bought, the price, how it was delivered and how you paid. We do not store card numbers.</li>
        <li><strong>Things you choose to give us:</strong> your sizes and favourite brands, your wishlist, saved searches and alerts, reviews, questions, pieces you offer to sell us, and messages to our support team.</li>
        <li><strong>On your device:</strong> the website and the app keep your sign-in, your theme and similar settings on your own phone or browser. We use no advertising or tracking cookies.</li>
      </ul>
      <p>We use this information only to run your account, deliver and support your orders, pay you for pieces you sell us, send the notifications you have switched on, and keep the records the law requires of a shop.</p>

      <h2>Who else sees it</h2>
      <p>Our staff, to process your orders. Our hosting provider, which stores the database for us. Google, only if you choose Continue with Google, and only to confirm who you are. We do not sell your information or share it for marketing.</p>

      <h2>How long we keep it</h2>
      <p>For as long as you have an account. Order and payment records are kept for at least five years after the sale, as South African tax law requires, but without your name or contact details once your account is deleted.</p>

      <h2>Your rights</h2>
      <p>You may ask to see the information we hold about you, have it corrected, or have it deleted, and you may object to how it is used. You can correct most of it yourself under Account, Settings. If you are unhappy with how we handle your information you may complain to the Information Regulator (South Africa).</p>

      <h2 id="delete">Deleting your account</h2>
      <p>On the website or in the app, open <strong>Account, Settings</strong> and choose <strong>Delete my account</strong>. This erases your name, email, cellphone number, addresses, wishlist, alerts and messages at once, and signs you out everywhere. If an order is still on its way, you can delete your account once it has arrived. You can also email <a class="link" href="mailto:support@ithrift.co.za">support@ithrift.co.za</a> from the address on your account and we will delete it for you within 30 days.</p>

      <h2>Security</h2>
      <p>Information travels over an encrypted connection (HTTPS). Passwords are stored only as salted scrypt hashes, staff can only reach what their role allows, and every request is checked on our server.</p>

      <h2>Children</h2>
      <p>Our shop is meant for people aged 18 and over. We do not knowingly collect information from children.</p>
    </div>`;
});

route(/^\/about$/, async (view) => {
  setTitle('About');
  const { products } = await api('/products?inStock=true');
  view.innerHTML = `
    <div class="container narrow page">
      <h1 style="max-width:16ch">A Pretoria shop for clothes that still have years in them.</h1>
      <p class="lead" style="margin-top:16px">iTHRIFT Clothes buys pre-owned branded clothing, checks every piece by hand and sells it on at a price students can manage. We started on WhatsApp and Instagram; this site brings the whole rack online.</p>
      <img src="/images/brand/storefront.jpg" alt="The iTHRIFT Clothes store front in Hatfield" style="border-radius:var(--r-lg);margin:32px 0;width:100%;aspect-ratio:16/9;object-fit:cover">
      <h2 style="margin-bottom:12px">How a piece gets on the rack</h2>
      <ol class="timeline" style="margin-bottom:32px">
        <li><div class="t-title">We buy it</div><div class="t-when">From customers selling through Sell to us, and from bulk lots.</div></li>
        <li><div class="t-title">We check and grade it</div><div class="t-when">Seams, zips, soles and fading, then a grade from Fair to Excellent. Any flaw is written in the description.</div></li>
        <li><div class="t-title">We clean, measure and photograph it</div><div class="t-when">Every piece is listed in its real size, with stock per size.</div></li>
        <li><div class="t-title">It goes on sale</div><div class="t-when">Right now there are ${products.length} pieces on the rack.</div></li>
      </ol>
      <div class="row wrap"><a class="btn btn-primary" href="#/shop">Shop the rack</a><a class="btn btn-secondary" href="#/help">Help and contact</a></div>
    </div>`;
});
