'use strict';

/**
 * The database uses plain integer primary keys throughout (see the ERD in
 * the System Design document). These helpers format those integers into the
 * friendly references shown in the interface - e.g. PRD010, ORD-0003 - at
 * the display layer only. The underlying key never changes.
 */
function productRef(id) {
  return `PRD${String(id).padStart(3, '0')}`;
}

function orderRef(id) {
  return `ORD-${String(id).padStart(4, '0')}`;
}

module.exports = { productRef, orderRef };
