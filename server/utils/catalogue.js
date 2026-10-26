'use strict';

/**
 * Catalogue search criteria, in one place. The shop's filters, saved
 * searches and the "does this new piece match anybody's saved search" check
 * all turn the same criteria into the same SQL, so a saved search can never
 * match differently from the screen it was saved on.
 *
 * Multi-value filters (brand, category, condition, size) arrive as a comma
 * separated list, so `brand=Nike` (the original API) still works.
 */

const LIST_KEYS = ['brand', 'category', 'condition', 'size'];
const CONDITIONS = ['Excellent', 'Very Good', 'Good', 'Fair'];

function toList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

/** Cleans criteria from a query string or a saved search into one shape. */
function normalise(input = {}) {
  const c = {};
  if (input.q && String(input.q).trim()) c.q = String(input.q).trim().slice(0, 80);
  for (const k of LIST_KEYS) {
    const list = toList(input[k]);
    if (list.length) c[k] = list;
  }
  if (c.condition) c.condition = c.condition.filter((x) => CONDITIONS.includes(x));
  if (c.condition && !c.condition.length) delete c.condition;
  const min = Number(input.minPrice);
  const max = Number(input.maxPrice);
  if (input.minPrice !== undefined && input.minPrice !== '' && Number.isFinite(min) && min > 0) c.minPrice = min;
  if (input.maxPrice !== undefined && input.maxPrice !== '' && Number.isFinite(max) && max > 0) c.maxPrice = max;
  if (input.onSale === true || input.onSale === 'true') c.onSale = true;
  if (input.inStock === true || input.inStock === 'true') c.inStock = true;
  return c;
}

/** WHERE clauses and parameters for normalised criteria (tables p, b, c). */
function whereFor(c) {
  const clauses = [];
  const params = [];
  if (c.q) {
    clauses.push('(p.Name LIKE ? OR p.Description LIKE ? OR b.Name LIKE ? OR c.Name LIKE ?)');
    params.push(`%${c.q}%`, `%${c.q}%`, `%${c.q}%`, `%${c.q}%`);
  }
  const inList = (col, list) => {
    clauses.push(`${col} IN (${list.map(() => '?').join(',')})`);
    params.push(...list);
  };
  if (c.brand) inList('b.Name', c.brand);
  if (c.category) inList('c.Name', c.category);
  if (c.condition) inList('p.ConditionGrade', c.condition);
  if (c.size) {
    clauses.push(`EXISTS (SELECT 1 FROM ProductSize ps WHERE ps.ProductID = p.ProductID AND ps.StockQty > 0 AND ps.Size IN (${c.size.map(() => '?').join(',')}))`);
    params.push(...c.size);
  }
  if (c.minPrice) { clauses.push('p.Price >= ?'); params.push(c.minPrice); }
  if (c.maxPrice) { clauses.push('p.Price <= ?'); params.push(c.maxPrice); }
  if (c.inStock) clauses.push('p.StockQty > 0');
  if (c.onSale) clauses.push('p.OriginalPrice IS NOT NULL AND p.OriginalPrice > p.Price');
  return { clauses, params };
}

/** A short human summary of criteria: "Nike, Footwear, size UK 8, under R800". */
function describe(c) {
  const bits = [];
  if (c.q) bits.push(`"${c.q}"`);
  if (c.brand) bits.push(c.brand.join(' or '));
  if (c.category) bits.push(c.category.join(' or '));
  if (c.condition) bits.push(c.condition.join(' or ') + ' condition');
  if (c.size) bits.push('size ' + c.size.join(' or '));
  if (c.minPrice && c.maxPrice) bits.push(`R${c.minPrice} to R${c.maxPrice}`);
  else if (c.maxPrice) bits.push(`under R${c.maxPrice}`);
  else if (c.minPrice) bits.push(`from R${c.minPrice}`);
  if (c.onSale) bits.push('on sale');
  return bits.join(', ') || 'Everything';
}

module.exports = { normalise, whereFor, describe, toList, CONDITIONS };
