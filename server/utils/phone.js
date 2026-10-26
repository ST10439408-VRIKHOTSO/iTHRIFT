'use strict';

/**
 * South African cellphone numbers.
 *
 * Customers type their number in many ways ("082 555 0101", "0825550101",
 * "+27 82 555 0101"), so every number is reduced to the same ten-digit
 * national form before it is stored, compared or used to sign in.
 */

/** "+27 82 555 0101" -> "0825550101", or null when it is not a cellphone number. */
function normalisePhone(value) {
  if (value === undefined || value === null) return null;
  let digits = String(value).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+27')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('27') && digits.length === 11) digits = '0' + digits.slice(2);
  return /^0[6-8]\d{8}$/.test(digits) ? digits : null;
}

/** "0825550101" -> "082 555 0101", the form shown on screen and stored. */
function formatPhone(national) {
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** Whether `value` looks like a phone number rather than an email address. */
function looksLikePhone(value) {
  return /^[+\d][\d\s\-()]*$/.test(String(value || '').trim());
}

/** Finds the customer who owns this number, comparing in the national form. */
function findCustomerByPhone(db, value, exceptCustomerId = null) {
  const wanted = normalisePhone(value);
  if (!wanted) return null;
  const rows = db.prepare('SELECT CustomerID, Phone FROM Customer WHERE Phone IS NOT NULL').all();
  const hit = rows.find((r) => r.CustomerID !== exceptCustomerId && normalisePhone(r.Phone) === wanted);
  return hit ? db.prepare('SELECT * FROM Customer WHERE CustomerID = ?').get(hit.CustomerID) : null;
}

const PHONE_HINT = 'Enter a South African cellphone number, like 082 123 4567.';

module.exports = { normalisePhone, formatPhone, looksLikePhone, findCustomerByPhone, PHONE_HINT };
