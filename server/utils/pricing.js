'use strict';

/**
 * Pricing rules for checkout: delivery fees, the free-delivery threshold and
 * promo codes. Both clients ask the server for a quote and show what comes
 * back, so a total can never be worked out two different ways.
 *
 * computeTotals() is pure (no database), which is what lets the unit tests
 * pin every rule down without a running server.
 */

const FREE_DELIVERY_THRESHOLD = 1000;

const DELIVERY_METHODS = {
  standard: { id: 'standard', label: 'Standard delivery', fee: 80, eta: '3 to 5 working days', freeOverThreshold: true },
  express: { id: 'express', label: 'Express delivery', fee: 150, eta: '1 to 2 working days', freeOverThreshold: false },
  collection: { id: 'collection', label: 'Collect from the Pretoria store', fee: 0, eta: 'Ready in 2 working days', freeOverThreshold: false },
};

function roundRand(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Thrift Points: 1 point per R10 paid on a delivered order, and every 100
 * points take R10 off a later order. Points are spent in blocks of 100.
 */
const POINTS_PER_RAND_EARNED = 0.1;
const POINTS_BLOCK = 100;
const RAND_PER_POINTS_BLOCK = 10;

function pointsEarnedFor(totalPaid) {
  return Math.max(0, Math.floor(Number(totalPaid) * POINTS_PER_RAND_EARNED));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Discount a promo code gives on a subtotal, or the reason it does not apply. */
function promoDiscount(promo, subtotal, today) {
  if (!promo) return { discount: 0 };
  if (!promo.Active) return { discount: 0, error: `${promo.Code} has expired.` };
  if (promo.ExpiresAt && today && today > promo.ExpiresAt) {
    return { discount: 0, error: `${promo.Code} expired on ${longDate(promo.ExpiresAt)}.` };
  }
  if (promo.UsageLimit && Number(promo.UsedCount || 0) >= promo.UsageLimit) {
    return { discount: 0, error: `${promo.Code} has been fully redeemed.` };
  }
  if (subtotal < promo.MinSpend) {
    const short = roundRand(promo.MinSpend - subtotal);
    return { discount: 0, error: `${promo.Code} needs a subtotal of R${promo.MinSpend}. Add R${short} more to use it.` };
  }
  const raw = promo.DiscountType === 'percent' ? subtotal * (promo.DiscountValue / 100) : promo.DiscountValue;
  // A discount can never take the goods below zero.
  return { discount: roundRand(Math.min(raw, subtotal)) };
}

function computeTotals({ subtotal, deliveryMethod = 'standard', promo = null, pointsToRedeem = 0, pointsBalance = 0, today = null }) {
  const method = DELIVERY_METHODS[deliveryMethod];
  if (!method) return { error: 'Delivery method must be standard, express or collection.' };

  const promoResult = promoDiscount(promo, subtotal, today);
  const discount = promoResult.discount;
  const afterDiscount = roundRand(subtotal - discount);

  // Points come off after the promo, in blocks of 100, and never below zero.
  const points = Number(pointsToRedeem) || 0;
  if (points < 0 || !Number.isInteger(points) || points % POINTS_BLOCK !== 0) {
    return { error: `Thrift Points are spent in blocks of ${POINTS_BLOCK}.` };
  }
  if (points > pointsBalance) {
    return { error: `You have ${pointsBalance} Thrift Points, so you cannot spend ${points}.` };
  }
  const pointsDiscount = roundRand((points / POINTS_BLOCK) * RAND_PER_POINTS_BLOCK);
  if (pointsDiscount > afterDiscount) {
    return { error: 'That is more points than this order needs. Spend fewer points.' };
  }
  const goods = roundRand(afterDiscount - pointsDiscount);

  // Free standard delivery is judged on what the customer actually pays for the goods.
  const qualifiesFree = method.freeOverThreshold && goods >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = qualifiesFree ? 0 : method.fee;
  const freeDeliveryRemaining = method.freeOverThreshold && !qualifiesFree
    ? roundRand(FREE_DELIVERY_THRESHOLD - goods)
    : 0;

  return {
    subtotal: roundRand(subtotal),
    discount,
    pointsRedeemed: points,
    pointsDiscount,
    deliveryMethod: method.id,
    deliveryFee,
    total: roundRand(goods + deliveryFee),
    freeDeliveryRemaining,
    promoError: promoResult.error || null,
  };
}

/** The promo row plus how many live orders have used it (for the usage cap). */
function findPromo(db, code) {
  if (!code) return null;
  const promo = db.prepare('SELECT * FROM PromoCode WHERE Code = ? COLLATE NOCASE').get(String(code).trim()) || null;
  if (!promo) return null;
  promo.UsedCount = db.prepare(`SELECT COUNT(*) AS n FROM Orders WHERE PromoCode = ? COLLATE NOCASE AND Status != 'Cancelled'`).get(promo.Code).n;
  return promo;
}

module.exports = {
  FREE_DELIVERY_THRESHOLD, DELIVERY_METHODS, POINTS_BLOCK, RAND_PER_POINTS_BLOCK,
  computeTotals, promoDiscount, findPromo, pointsEarnedFor,
};
