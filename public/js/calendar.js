/* =========================================================================
   iTHRIFT working-day calendar
   Shared by the website (delivery estimates, collection booking) and the
   API (which re-checks a booked collection date). One copy of the rules,
   so the date a customer is shown is the date the server accepts.
   ========================================================================= */
(function (root) {
  'use strict';

  // South African public holidays, with the Sunday-to-Monday rule applied.
  var PUBLIC_HOLIDAYS = {
    '2026-01-01': "New Year's Day",
    '2026-03-21': 'Human Rights Day',
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Family Day',
    '2026-04-27': 'Freedom Day',
    '2026-05-01': "Workers' Day",
    '2026-06-16': 'Youth Day',
    '2026-08-10': "National Women's Day (observed)",
    '2026-09-24': 'Heritage Day',
    '2026-12-16': 'Day of Reconciliation',
    '2026-12-25': 'Christmas Day',
    '2026-12-26': 'Day of Goodwill',
    '2027-01-01': "New Year's Day",
    '2027-03-22': 'Human Rights Day (observed)',
    '2027-03-26': 'Good Friday',
    '2027-03-29': 'Family Day',
    '2027-04-27': 'Freedom Day',
    '2027-06-16': 'Youth Day',
    '2027-08-09': "National Women's Day",
    '2027-09-24': 'Heritage Day',
    '2027-12-16': 'Day of Reconciliation',
    '2027-12-27': 'Day of Goodwill (observed)',
  };

  // Store collection windows.
  var COLLECTION_SLOTS = ['10:00 to 12:00', '12:00 to 14:00', '14:00 to 16:00'];
  var COLLECTION_MIN_DAYS = 2;
  var COLLECTION_MAX_DAYS = 10;

  // Working days each delivery method takes: [earliest, latest].
  var DELIVERY_DAYS = { standard: [3, 5], express: [1, 2], collection: [2, 2] };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** A Date (treated as a calendar day) as YYYY-MM-DD. */
  function iso(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /** YYYY-MM-DD as a Date at midnight UTC, which keeps day arithmetic free of time zones. */
  function parse(s) {
    var p = String(s).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  /** Today in South Africa (UTC+2, no daylight saving). */
  function todayInSouthAfrica(now) {
    var t = now ? new Date(now) : new Date();
    return iso(new Date(t.getTime() + 2 * 3600 * 1000));
  }

  function isWorkingDay(s) {
    var d = parse(s);
    var dow = d.getUTCDay();
    return dow !== 0 && dow !== 6 && !PUBLIC_HOLIDAYS[s];
  }

  function addDays(s, n) {
    var d = parse(s);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  }

  /** The date n working days after `from` (from itself is never counted). */
  function addWorkingDays(from, n) {
    var d = from;
    var left = n;
    while (left > 0) {
      d = addDays(d, 1);
      if (isWorkingDay(d)) left--;
    }
    return d;
  }

  /** Earliest and latest arrival for a delivery method, ordered today. */
  function deliveryWindow(method, from) {
    var days = DELIVERY_DAYS[method] || DELIVERY_DAYS.standard;
    var start = from || todayInSouthAfrica();
    return { from: addWorkingDays(start, days[0]), to: addWorkingDays(start, days[1]) };
  }

  /** Every date a collection can be booked for, from 2 to 10 working days ahead. */
  function collectionDates(from) {
    var start = from || todayInSouthAfrica();
    var out = [];
    for (var i = COLLECTION_MIN_DAYS; i <= COLLECTION_MAX_DAYS; i++) out.push(addWorkingDays(start, i));
    return out;
  }

  function isValidCollection(date, slot, from) {
    return collectionDates(from).indexOf(date) !== -1 && COLLECTION_SLOTS.indexOf(slot) !== -1;
  }

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** "Tue 21 Oct" */
  function label(s) {
    var d = parse(s);
    return DAY_NAMES[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTH_NAMES[d.getUTCMonth()];
  }

  /** "Tue 21 Oct to Thu 23 Oct", or one date when both ends match. */
  function rangeLabel(w) {
    return w.from === w.to ? label(w.from) : label(w.from) + ' to ' + label(w.to);
  }

  var api = {
    PUBLIC_HOLIDAYS: PUBLIC_HOLIDAYS,
    COLLECTION_SLOTS: COLLECTION_SLOTS,
    DELIVERY_DAYS: DELIVERY_DAYS,
    todayInSouthAfrica: todayInSouthAfrica,
    isWorkingDay: isWorkingDay,
    addWorkingDays: addWorkingDays,
    deliveryWindow: deliveryWindow,
    collectionDates: collectionDates,
    isValidCollection: isValidCollection,
    label: label,
    rangeLabel: rangeLabel,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ithriftCalendar = api;
})(this);
