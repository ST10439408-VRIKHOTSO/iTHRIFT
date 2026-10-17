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

/** Discount a promo code gives on a subtotal, or the reason it does not apply. */
function promoDiscount(promo, subtotal) {
  if (!promo) return { discount: 0 };
  if (!promo.Active) return { discount: 0, error: `${promo.Code} has expired.` };
  if (subtotal < promo.MinSpend) {
    const short = roundRand(promo.MinSpend - subtotal);
    return { discount: 0, error: `${promo.Code} needs a subtotal of R${promo.MinSpend}. Add R${short} more to use it.` };
  }
  const raw = promo.DiscountType === 'percent' ? subtotal * (promo.DiscountValue / 100) : promo.DiscountValue;
  // A discount can never take the goods below zero.
  return { discount: roundRand(Math.min(raw, subtotal)) };
}

function computeTotals({ subtotal, deliveryMethod = 'standard', promo = null }) {
  const method = DELIVERY_METHODS[deliveryMethod];
  if (!method) return { error: 'Delivery method must be standard, express or collection.' };

  const promoResult = promoDiscount(promo, subtotal);
  const discount = promoResult.discount;
  const afterDiscount = roundRand(subtotal - discount);

  // Free standard delivery is judged on what the customer actually pays for the goods.
  const qualifiesFree = method.freeOverThreshold && afterDiscount >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = qualifiesFree ? 0 : method.fee;
  const freeDeliveryRemaining = method.freeOverThreshold && !qualifiesFree
    ? roundRand(FREE_DELIVERY_THRESHOLD - afterDiscount)
    : 0;

  return {
    subtotal: roundRand(subtotal),
    discount,
    deliveryMethod: method.id,
    deliveryFee,
    total: roundRand(afterDiscount + deliveryFee),
    freeDeliveryRemaining,
    promoError: promoResult.error || null,
  };
}

function findPromo(db, code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM PromoCode WHERE Code = ? COLLATE NOCASE').get(String(code).trim()) || null;
}

module.exports = { FREE_DELIVERY_THRESHOLD, DELIVERY_METHODS, computeTotals, promoDiscount, findPromo };
