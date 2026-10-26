'use strict';

/**
 * End-to-end checks for the release 1.3.0 features.
 * Run with: npm run test:features   (the server must already be running)
 *
 * Kept separate from smoke-test.js so the original 131 checks are untouched.
 * Every check talks to the API the website uses; nothing is mocked.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition) {
  if (condition) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); } else { fail++; failures.push(label); console.log(`  \x1b[31m✗\x1b[0m ${label}`); }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
  return { status: res.status, data, headers: res.headers };
}

const login = async (identifier, password) => (await call('/api/auth/login', { method: 'POST', body: { identifier, password } })).data.token;

async function main() {
  console.log(`\nRunning iTHRIFT release 1.3.0 feature checks against ${BASE}\n`);
  const cal = require('../public/js/calendar');

  const admin = await login('vukosir@icloud.com', 'ithrift@2025');
  const staff = await login('kabelo.tau@ithrift.co.za', 'Staff@123');
  const lerato = await login('lerato.m@gmail.com', 'Password1');
  const sipho = await login('sipho.n@gmail.com', 'Password2');
  const email = `feature.${Date.now()}@example.com`;
  const reg = await call('/api/auth/register', { method: 'POST', body: { firstName: 'Feature', lastName: 'Tester', email, phone: '07' + String(Date.now()).slice(-8), password: 'Password9' } });
  const fresh = reg.data.token;
  check('Test accounts sign in', Boolean(admin && staff && lerato && sipho && fresh));

  // 1. Instant search suggestions
  {
    const r = await call('/api/products/suggest?q=nike');
    check('Instant search suggests products and the brand', r.status === 200 && r.data.products.length > 0 && r.data.brands.includes('Nike'));
    const empty = await call('/api/products/suggest?q=');
    check('An empty search suggests nothing', empty.data.products.length === 0);
  }

  // 2. Multi-select filters
  {
    const r = await call('/api/products?brand=Nike,Adidas&category=Footwear&sort=price_asc');
    const ok = r.data.products.length > 0 && r.data.products.every((p) => ['Nike', 'Adidas'].includes(p.brand) && p.category === 'Footwear');
    const sorted = r.data.products.every((p, i, a) => i === 0 || a[i - 1].price <= p.price);
    check('Several brands can be filtered at once', ok);
    check('Filtered results respect the sort order', sorted);
    const sizes = await call('/api/products?size=UK 8,UK 9&category=Footwear');
    check('Several sizes can be filtered at once', sizes.data.products.every((p) => p.sizes.some((s) => ['UK 8', 'UK 9'].includes(s.size))));
    const discount = await call('/api/products?onSale=true&sort=discount');
    check('Sorting by biggest discount puts the largest saving first', discount.data.products.every((p, i, a) => i === 0 || a[i - 1].percentOff >= p.percentOff));
    const list = await call('/api/products/sizes');
    check('The size filter lists sizes in a sensible order', list.data.sizes.indexOf('XS') < list.data.sizes.indexOf('XXL') && list.data.sizes.indexOf('UK 3') < list.data.sizes.indexOf('UK 10'));
  }

  // 3. Style profile and onboarding, For you
  {
    const before = await call('/api/account/overview', { token: fresh });
    check('A new customer has not been through onboarding', before.status === 200 && before.data.style.onboarded === false);
    const save = await call('/api/account/style', { method: 'PUT', token: fresh, body: { sizes: ['UK 8', 'M', 'Nonsense'], brands: ['Nike', 'NotABrand'] } });
    check('Saving the style profile keeps only real sizes and brands', save.status === 200 && save.data.style.sizes.join() === 'UK 8,M' && save.data.style.brands.join() === 'Nike');
    const forYou = await call('/api/account/for-you', { token: fresh });
    check('For you returns in-stock picks for the profile', forYou.data.productIds.length > 0);
  }

  // 4. Saved searches and new-listing alerts
  {
    const r = await call('/api/account/saved-searches', { method: 'POST', token: fresh, body: { name: 'Puma trainers', criteria: { brand: 'Puma', category: 'Footwear' } } });
    check('A search can be saved', r.status === 201 && r.data.savedSearches.some((s) => s.name === 'Puma trainers' && s.matches > 0));
    const dup = await call('/api/account/saved-searches', { method: 'POST', token: fresh, body: { name: 'Puma trainers', criteria: { brand: 'Puma' } } });
    check('A saved search name cannot be used twice', dup.status === 409);
    const blank = await call('/api/account/saved-searches', { method: 'POST', token: fresh, body: { name: 'Nothing', criteria: {} } });
    check('An empty search cannot be saved', blank.status === 400);

    const brands = (await call('/api/products/brands')).data.brands;
    const cats = (await call('/api/products/categories')).data.categories;
    const created = await call('/api/products', {
      method: 'POST', token: staff,
      body: { name: 'Feature Test Clyde', description: 'Suede Puma Clyde in navy, lightly worn.', brandId: brands.find((b) => b.name === 'Puma').id,
        categoryId: cats.find((c) => c.name === 'Footwear').id, condition: 'Very Good', price: 700, sizes: [{ size: 'UK 8', stock: 1 }, { size: 'UK 9', stock: 0 }] },
    });
    check('Staff can list a piece with a size table', created.status === 201 && created.data.product.stock === 1 && created.data.product.allSizes.length === 2);
    check('A new listing alerts matching saved searches', created.data.savedSearchAlerts >= 1);
    const inbox = await call('/api/notifications', { token: fresh });
    check('The saved-search alert lands in the notification centre', inbox.data.notifications.some((n) => n.type === 'saved_search'));
    var clydeId = created.data.product.id;
  }

  // 5. Back-in-stock alerts
  {
    const inStock = await call(`/api/products/${clydeId}/alerts`, { method: 'POST', token: fresh, body: { size: 'UK 8' } });
    check('An alert cannot be set for a size that is in stock', inStock.status === 409);
    const badSize = await call(`/api/products/${clydeId}/alerts`, { method: 'POST', token: fresh, body: { size: 'XL' } });
    check('An alert cannot be set for a size the category does not sell', badSize.status === 400);
    const set = await call(`/api/products/${clydeId}/alerts`, { method: 'POST', token: fresh, body: { size: 'UK 9' } });
    check('An alert can be set for a sold-out size', set.status === 201);
    await call(`/api/products/${clydeId}`, { method: 'PUT', token: staff, body: { sizes: [{ size: 'UK 8', stock: 1 }, { size: 'UK 9', stock: 1 }] } });
    const alerts = await call('/api/account/alerts', { token: fresh });
    check('Restocking the size closes the alert', alerts.data.alerts.some((a) => a.productId === clydeId && a.fulfilledAt));
    const inbox = await call('/api/notifications', { token: fresh });
    check('The customer is told the size is back', inbox.data.notifications.some((n) => n.type === 'back_in_stock'));
  }

  // 6. Price-drop alerts on the wishlist
  {
    await call('/api/wishlist', { method: 'POST', token: fresh, body: { productId: clydeId } });
    await call(`/api/products/${clydeId}`, { method: 'PUT', token: staff, body: { price: 600, originalPrice: 700 } });
    const wl = await call('/api/wishlist', { token: fresh });
    const item = wl.data.items.find((i) => i.productId === clydeId);
    check('The wishlist shows how much a saved piece has dropped', item && item.priceDrop === 100 && item.onSale);
    const inbox = await call('/api/notifications', { token: fresh });
    check('A price drop is announced to the saver', inbox.data.notifications.some((n) => n.type === 'price_drop' && /R700 to R600/.test(n.body)));
    const badSale = await call(`/api/products/${clydeId}`, { method: 'PUT', token: staff, body: { price: 600, originalPrice: 500 } });
    check('A pre-sale price lower than the price is refused', badSale.status === 400);
  }

  // 7. Notification preferences and the centre itself
  {
    const off = await call('/api/account/preferences', { method: 'PUT', token: fresh, body: { notifyOrders: true, notifyAlerts: false } });
    check('Notification preferences can be changed', off.status === 200);
    const before = (await call('/api/notifications', { token: fresh })).data.notifications.length;
    await call(`/api/products/${clydeId}`, { method: 'PUT', token: staff, body: { price: 550, originalPrice: 700 } });
    const after = (await call('/api/notifications', { token: fresh })).data.notifications.length;
    check('With shopping alerts off, a price drop is not announced', after === before);
    await call('/api/account/preferences', { method: 'PUT', token: fresh, body: { notifyOrders: true, notifyAlerts: true } });
    const count = await call('/api/notifications/unread-count', { token: fresh });
    check('The unread count is available for the bell', count.data.unread > 0);
    const all = await call('/api/notifications/read-all', { method: 'PUT', token: fresh });
    check('Mark all as read clears the unread count', all.data.unread === 0);
    const other = await call(`/api/notifications/${all.data.notifications[0].id}/read`, { method: 'PUT', token: lerato });
    check('A customer cannot touch someone else\'s notification', other.status === 404);
  }

  // 8. Bulk markdown
  {
    const tees = (await call('/api/products?category=Tees&onSale=false')).data.products.filter((p) => !p.onSale).slice(0, 2);
    const r = await call('/api/products/bulk-price', { method: 'POST', token: staff, body: { productIds: tees.map((t) => t.id), percentOff: 20 } });
    const after = (await call(`/api/products/by-ids?ids=${tees.map((t) => t.id).join(',')}`)).data.products;
    check('A bulk markdown puts several pieces on sale', r.status === 200 && after.every((p, i) => p.onSale && p.price === Math.round(tees[i].price * 0.8)));
    const again = await call('/api/products/bulk-price', { method: 'POST', token: staff, body: { productIds: tees.map((t) => t.id), percentOff: 20 } });
    const again2 = (await call(`/api/products/by-ids?ids=${tees.map((t) => t.id).join(',')}`)).data.products;
    check('Repeating a markdown does not compound it', again.status === 200 && again2.every((p, i) => p.price === Math.round(tees[i].price * 0.8)));
    await call('/api/products/bulk-price', { method: 'POST', token: staff, body: { productIds: tees.map((t) => t.id), endSale: true } });
    const ended = (await call(`/api/products/by-ids?ids=${tees.map((t) => t.id).join(',')}`)).data.products;
    check('Ending the sale restores the full price', ended.every((p, i) => !p.onSale && p.price === tees[i].price));
    const denied = await call('/api/products/bulk-price', { method: 'POST', token: lerato, body: { productIds: [1], percentOff: 50 } });
    check('A customer cannot mark prices down', denied.status === 403);
  }

  // 9. Similar pieces, compare (by ids), reviews summary, questions
  {
    const sim = await call(`/api/products/${clydeId}/similar`);
    check('Similar pieces exclude the piece itself', sim.status === 200 && sim.data.products.length > 0 && !sim.data.products.some((p) => p.id === clydeId));
    const ids = await call('/api/products/by-ids?ids=3,1,2');
    check('Pieces come back in the order asked for (compare, recently viewed)', ids.data.products.map((p) => p.id).join() === '3,1,2');
    const af1 = (await call('/api/products?q=Air Force 1')).data.products[0];
    const rv = await call(`/api/products/${af1.id}/reviews`);
    check('Reviews come with an average and a star breakdown', rv.data.summary.count > 0 && rv.data.summary.histogram[5] >= 1);
    check('A review from a buyer is marked as a verified purchase', rv.data.reviews.some((r) => r.verified));
    const short = await call(`/api/products/${af1.id}/questions`, { method: 'POST', token: fresh, body: { question: 'Hi?' } });
    check('A too-short question is refused', short.status === 400);
    const ask = await call(`/api/products/${af1.id}/questions`, { method: 'POST', token: fresh, body: { question: 'Are the laces original or replacements?' } });
    check('A customer can ask a question about a piece', ask.status === 201);
    const mine = await call(`/api/products/${af1.id}/questions`, { token: fresh });
    const pub = await call(`/api/products/${af1.id}/questions`);
    check('An unanswered question is visible to the asker only', mine.data.questions.some((q) => q.mine && !q.answer) && !pub.data.questions.some((q) => !q.answer));
    const open = await call('/api/admin/questions?status=open', { token: staff });
    const q = open.data.questions.find((x) => x.question.startsWith('Are the laces'));
    const ans = await call(`/api/admin/questions/${q.id}`, { method: 'PUT', token: staff, body: { answer: 'They are the original laces.' } });
    check('Staff can answer a question', ans.status === 200);
    const pub2 = await call(`/api/products/${af1.id}/questions`);
    check('The answer is then public', pub2.data.questions.some((x) => x.answer === 'They are the original laces.'));
  }

  // 10. Checkout extras: collection slot, gift, points, history, invoice data
  {
    const opts = await call('/api/orders/options');
    check('Options include collection days and slots', opts.data.collection.dates.length === 9 && opts.data.collection.slots.length === 3);
    check('Collection days skip weekends and public holidays', opts.data.collection.dates.every(cal.isWorkingDay));
    check('Each delivery method shows an arrival estimate', opts.data.deliveryMethods.every((m) => m.arrives && m.arrives.label));

    const p = (await call('/api/products?inStock=true&sort=price_asc')).data.products.find((x) => x.sizes.length);
    await call('/api/cart/items', { method: 'POST', token: lerato, body: { productId: p.id, quantity: 1, size: p.sizes[0].size } });
    const bal = (await call('/api/account/points', { token: lerato })).data.balance;
    check('Lerato has Thrift Points to spend', bal >= 100);
    const odd = await call('/api/orders/quote', { method: 'POST', token: lerato, body: { deliveryMethod: 'collection', pointsToRedeem: 150 } });
    check('Points must be spent in blocks of 100', odd.status === 400 && /blocks of 100/.test(odd.data.error));
    const tooMany = await call('/api/orders/quote', { method: 'POST', token: lerato, body: { deliveryMethod: 'collection', pointsToRedeem: bal + 10000 - ((bal + 10000) % 100) } });
    check('A customer cannot spend more points than they have', tooMany.status === 400);
    const q = await call('/api/orders/quote', { method: 'POST', token: lerato, body: { deliveryMethod: 'collection', pointsToRedeem: 100 } });
    check('100 points take R10 off the quote', q.status === 200 && q.data.pointsDiscount === 10 && q.data.total === q.data.subtotal - 10);

    const badSlot = await call('/api/orders', { method: 'POST', token: lerato, body: { method: 'card', deliveryMethod: 'collection', collectionDate: '2020-01-01', collectionSlot: '10:00 to 12:00' } });
    check('A collection date in the past is refused', badSlot.status === 400);
    const date = opts.data.collection.dates[0];
    const placed = await call('/api/orders', {
      method: 'POST', token: lerato,
      body: { method: 'card', deliveryMethod: 'collection', collectionDate: date, collectionSlot: '12:00 to 14:00', isGift: true, giftMessage: 'Enjoy!', pointsToRedeem: 100 },
    });
    const o = placed.data.order;
    check('An order books a collection slot', placed.status === 201 && o.collectionDate === date && o.collectionSlot === '12:00 to 14:00');
    check('A gift order keeps its message', o.isGift && o.giftMessage === 'Enjoy!');
    check('Spent points are recorded on the order', o.pointsRedeemed === 100 && o.pointsDiscount === 10);
    check('The order timeline starts at Processing', o.history.length === 1 && o.history[0].status === 'Processing');
    check('The order carries the VAT included in its total', o.vatIncluded > 0 && Math.abs(o.vatIncluded - (o.total - o.total / 1.15)) < 0.02);
    const balAfter = (await call('/api/account/points', { token: lerato })).data.balance;
    check('The points balance drops by what was spent', balAfter === bal - 100);

    const coll = await call('/api/admin/collections', { token: staff });
    check('The order appears in the staff collections list', coll.data.collections.some((c) => c.id === o.id && c.slot === '12:00 to 14:00'));

    const skip = await call(`/api/orders/${o.id}/status`, { method: 'PUT', token: staff, body: { status: 'Delivered' } });
    check('A collected order can go straight to Delivered', skip.status === 200 && skip.data.order.history.length === 2);
    check('Delivery earns points on the order', skip.data.order.pointsEarned === Math.floor(skip.data.order.total / 10));
    const back = await call(`/api/orders/${o.id}/status`, { method: 'PUT', token: staff, body: { status: 'Processing' } });
    check('A delivered order cannot be moved back', back.status === 409);

    // Cancelling gives the points back
    const p2 = (await call('/api/products?inStock=true&sort=price_asc')).data.products.find((x) => x.sizes.length);
    await call('/api/cart/items', { method: 'POST', token: lerato, body: { productId: p2.id, quantity: 1, size: p2.sizes[0].size } });
    const bal2 = (await call('/api/account/points', { token: lerato })).data.balance;
    const placed2 = await call('/api/orders', { method: 'POST', token: lerato, body: { method: 'card', deliveryMethod: 'collection', pointsToRedeem: 100 } });
    await call(`/api/orders/${placed2.data.order.id}/cancel`, { method: 'PUT', token: lerato });
    const bal3 = (await call('/api/account/points', { token: lerato })).data.balance;
    check('Cancelling an order returns the points spent on it', bal3 === bal2);
    const detail = await call(`/api/orders/${placed2.data.order.id}`, { token: lerato });
    check('The cancellation is on the timeline', detail.data.order.history.map((h) => h.status).join() === 'Processing,Cancelled');

    // Staff cancelling puts stock back (it did not before)
    const p3 = (await call('/api/products?inStock=true&sort=price_asc')).data.products.find((x) => x.sizes.length);
    await call('/api/cart/items', { method: 'POST', token: sipho, body: { productId: p3.id, quantity: 1, size: p3.sizes[0].size } });
    const stockBefore = (await call(`/api/products/${p3.id}`)).data.product.stock;
    const placed3 = await call('/api/orders', { method: 'POST', token: sipho, body: { method: 'card', deliveryMethod: 'collection' } });
    await call(`/api/orders/${placed3.data.order.id}/status`, { method: 'PUT', token: staff, body: { status: 'Cancelled' } });
    const stockAfter = (await call(`/api/products/${p3.id}`)).data.product.stock;
    check('When staff cancel an order its stock goes back on sale', stockAfter === stockBefore);
  }

  // 11. Promo manager: expiry and usage limits
  {
    const expired = await call('/api/orders/quote', { method: 'POST', token: sipho, body: { promoCode: 'WINTER20' } });
    check('A promo past its end date is refused with the date', expired.status === 400 || /expired on/.test(expired.data.error || ''));
    const list = await call('/api/admin/promos', { token: staff });
    check('Staff can see promo codes with their usage', list.status === 200 && list.data.promos.every((p) => typeof p.usedCount === 'number'));
    const staffCreate = await call('/api/admin/promos', { method: 'POST', token: staff, body: { code: 'STAFFTRY', discountType: 'fixed', discountValue: 10 } });
    check('Only the administrator can create promo codes', staffCreate.status === 403);
    const code = 'TEST' + String(Date.now()).slice(-6);
    const make = await call('/api/admin/promos', { method: 'POST', token: admin, body: { code, discountType: 'fixed', discountValue: 5, usageLimit: 1 } });
    check('The administrator can create a promo code with a usage limit', make.status === 201 && make.data.promos.some((p) => p.code === code && p.usageLimit === 1));
    const bad = await call('/api/admin/promos', { method: 'POST', token: admin, body: { code: 'HALF', discountType: 'percent', discountValue: 95 } });
    check('A percentage over 90 is refused', bad.status === 400);
    const p = (await call('/api/products?inStock=true&sort=price_asc')).data.products.find((x) => x.sizes.length);
    await call('/api/cart/items', { method: 'POST', token: sipho, body: { productId: p.id, quantity: 1, size: p.sizes[0].size } });
    const used = await call('/api/orders', { method: 'POST', token: sipho, body: { method: 'card', deliveryMethod: 'collection', promoCode: code } });
    check('The new code works once', used.status === 201 && used.data.order.discount === 5);
    const p2 = (await call('/api/products?inStock=true&sort=price_asc')).data.products.find((x) => x.sizes.length);
    await call('/api/cart/items', { method: 'POST', token: sipho, body: { productId: p2.id, quantity: 1, size: p2.sizes[0].size } });
    const second = await call('/api/orders/quote', { method: 'POST', token: sipho, body: { promoCode: code } });
    check('A code at its usage limit is refused', second.status === 400 && /fully redeemed/.test(second.data.error));
    const promo = make.data.promos.find((x) => x.code === code);
    const off = await call(`/api/admin/promos/${promo.id}`, { method: 'PUT', token: admin, body: { active: false } });
    check('A promo code can be switched off', off.data.promos.find((x) => x.code === code).active === false);
  }

  // 12. Sell to iTHRIFT
  {
    const bad = await call('/api/sell', { method: 'POST', token: fresh, body: { brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Great', description: 'Barely worn trainers in white.' } });
    check('A sell submission needs a real condition grade', bad.status === 400);
    const ok = await call('/api/sell', { method: 'POST', token: fresh, body: { brand: 'Nike', category: 'Footwear', size: 'UK 8', condition: 'Excellent', description: 'Barely worn trainers in white, original box.', askingPrice: 600 } });
    const sub = ok.data.submissions[0];
    check('A customer can offer a piece to the shop', ok.status === 201 && sub.status === 'Submitted');
    const early = await call(`/api/sell/${sub.id}/respond`, { method: 'PUT', token: fresh, body: { accept: true, payoutMethod: 'eft' } });
    check('There is nothing to accept before an offer is made', early.status === 409);
    const offer = await call(`/api/sell/${sub.id}`, { method: 'PUT', token: staff, body: { status: 'Offer made', offerAmount: 450 } });
    check('Staff can make an offer', offer.status === 200);
    const before = (await call('/api/account/points', { token: fresh })).data.balance;
    const accept = await call(`/api/sell/${sub.id}/respond`, { method: 'PUT', token: fresh, body: { accept: true, payoutMethod: 'points' } });
    check('The customer can accept the offer as points', accept.data.submissions[0].status === 'Accepted');
    await call(`/api/sell/${sub.id}`, { method: 'PUT', token: staff, body: { status: 'Received' } });
    const paid = await call(`/api/sell/${sub.id}`, { method: 'PUT', token: staff, body: { status: 'Paid' } });
    const after = (await call('/api/account/points', { token: fresh })).data.balance;
    check('Paying in points credits the offer plus 20 percent', paid.status === 200 && after - before === Math.round(450 * 10 * 1.2));
    const skip = await call(`/api/sell/${sub.id}`, { method: 'PUT', token: staff, body: { status: 'Offer made', offerAmount: 1 } });
    check('A paid submission cannot be reopened', skip.status === 409);
  }

  // 13. Support conversations
  {
    const t = await call('/api/support', { method: 'POST', token: fresh, body: { topic: 'Order', subject: 'Where is my parcel?', message: 'Ordered last week and nothing yet.' } });
    check('A customer can start a support conversation', t.status === 201 && t.data.ticket.messages.length === 1);
    const peek = await call(`/api/support/${t.data.ticket.id}`, { token: lerato });
    check('Another customer cannot read it', peek.status === 404);
    const reply = await call(`/api/support/${t.data.ticket.id}/messages`, { method: 'POST', token: staff, body: { message: 'It is with the courier and arrives tomorrow.' } });
    check('Staff can reply, which marks it answered', reply.status === 201 && reply.data.ticket.status === 'Answered');
    const inbox = await call('/api/notifications', { token: fresh });
    check('The customer is told about the reply', inbox.data.notifications.some((n) => n.type === 'support'));
    const close = await call(`/api/support/${t.data.ticket.id}/status`, { method: 'PUT', token: fresh, body: { status: 'Closed' } });
    check('The customer can close the conversation', close.data.ticket.status === 'Closed');
    const reopen = await call(`/api/support/${t.data.ticket.id}/status`, { method: 'PUT', token: fresh, body: { status: 'Open' } });
    check('Only staff can reopen it', reopen.status === 400);
  }

  // 14. Account overview, points tiers, impact
  {
    const ov = await call('/api/account/overview', { token: lerato });
    check('The account overview has points, a tier and counts', ov.status === 200 && ov.data.points.tier.name && ov.data.counts.orders > 0);
    check('The sustainability estimate counts delivered pieces', ov.data.impact.items > 0 && ov.data.impact.waterLitres > 0);
    const staffDenied = await call('/api/account/overview', { token: staff });
    check('Staff accounts have no customer overview', staffDenied.status === 403);
  }

  // 15. Analytics and CSV export
  {
    const a = await call('/api/admin/reports/analytics', { token: staff });
    check('Analytics cover the last 30 days, day by day', a.status === 200 && a.data.days.length === 30);
    check('Analytics include the average order value and what needs attention', a.data.averageOrderValue > 0 && typeof a.data.attention.processing === 'number');
    const csv = await fetch(BASE + '/api/admin/reports/orders.csv', { headers: { Authorization: 'Bearer ' + staff } });
    const text = await csv.text();
    check('Orders export as a CSV file', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')) && text.includes('ORD-0001'));
    const denied = await call('/api/admin/reports/analytics', { token: lerato });
    check('Customers cannot see analytics', denied.status === 403);
  }

  // 16. Calendar rules
  {
    check('Christmas 2026 is not a working day', !cal.isWorkingDay('2026-12-25'));
    check('Two working days after Friday 24 Dec 2027 is Wednesday 29 Dec', cal.addWorkingDays('2027-12-24', 2) === '2027-12-29');
    check('Women\'s Day 2026 is observed on Monday 10 August', !cal.isWorkingDay('2026-08-10'));
  }

  console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total checks.`);
  if (fail) { console.log('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch((err) => { console.error(err); process.exit(1); });
