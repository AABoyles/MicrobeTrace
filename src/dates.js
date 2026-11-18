// Reading dates from node data, and what to do with nodes that have none.
// Missing dates stay missing: nothing here (or anywhere) fills them in.
(function (self) {
  'use strict';

  // Numeric dates with -, / or . between their parts: a/b/yy, a/b/yyyy or
  // yyyy/mm/dd, with an optional time. (yyyy-mm-dd is read by the ISO branch.)
  const NUMERIC = /^(\d{1,4})([-\/.])(\d{1,2})\2(\d{1,4})(?:(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  // Starts like a day-first or month-first date, so is never left to the engine
  const SLASHED = /^\d{1,2}[-\/.]\d{1,2}[-\/.]/;

  // Two-digit years: 00 to 69 are 2000 to 2069, and 70 to 99 are 1970 to 1999
  // (the pivot spreadsheets use). Four-digit years are as written.
  const fullYear = text => text.length == 2 ? (+text < 70 ? 2000 : 1900) + +text : +text;

  // A local time on a day, or null if the day doesn't exist (31 April, or 29
  // February in a common year)
  function localDate(year, month, day, [hours, minutes, seconds]) {
    const time = new Date(year, month - 1, day, hours, minutes, seconds);
    time.setFullYear(year); // years before 100 aren't 19xx
    return time.getMonth() == month - 1 && time.getDate() == day ? time : null;
  }

  // The parts of a numeric date, or null. For a/b/yy the first two parts are as
  // written; for yyyy/mm/dd they are the month and the day.
  function numericParts(text) {
    const m = NUMERIC.exec(text);
    if (!m) return null;
    const [, p1, , p2, p3] = m;
    const time = [m[5], m[6], m[7]].map(t => +(t || 0));
    if (time[0] > 23 || time[1] > 59 || time[2] > 59) return null;
    if (p1.length == 4) return p3.length <= 2 ? { yearFirst: true, year: +p1, first: +p2, second: +p3, time } : null;
    if (p1.length > 2 || (p3.length != 2 && p3.length != 4)) return null;
    return { yearFirst: false, year: fullYear(p3), first: +p1, second: +p2, time };
  }

  // The date numeric parts name, with a/b/yy read in the order given ('dmy' or 'mdy')
  function numericDate(parts, order) {
    const [month, day] = parts.yearFirst || order != 'dmy' ? [parts.first, parts.second] : [parts.second, parts.first];
    return localDate(parts.year, month, day, parts.time);
  }

  // The order a column's numeric dates are written in, as 'dmy' (day first) or
  // 'mdy' (month first). A date whose first part is over 12 is day first, and
  // one whose second part is over 12 is month first. A column with both is
  // 'inconsistent': it's read month-first, so its day-first dates can't be read.
  // A column with dates that could go either way, and none to settle it, is
  // 'ambiguous': it's read month-first, as it always was. Dates with the same
  // number in both places (03/03/2020) say nothing, and yyyy/mm/dd is never
  // ambiguous.
  function dateOrderOf(values) {
    let dayFirst = 0, monthFirst = 0, ambiguous = 0;
    for (const value of values) {
      const parts = typeof value == 'string' ? numericParts(value.trim()) : null;
      if (!parts || parts.yearFirst) continue;
      const { first, second } = parts;
      if (first > 12 && second <= 12) dayFirst++;
      else if (second > 12 && first <= 12) monthFirst++;
      else if (first >= 1 && second >= 1 && first <= 12 && second <= 12 && first != second) ambiguous++;
    }
    if (dayFirst && monthFirst) return { order: 'mdy', status: 'inconsistent' };
    if (dayFirst) return { order: 'dmy', status: 'day-first' };
    if (monthFirst) return { order: 'mdy', status: 'month-first' };
    return { order: 'mdy', status: ambiguous ? 'ambiguous' : 'none' };
  }

  // Reads a date field: a Date, a time in milliseconds, or text. Dates written
  // without a time (2020, 2020-03, 2020-03-14 or 20200314) are local midnight,
  // as people mean them (Date alone reads the dashed ones as UTC). Numeric
  // dates with / - or . are read in the order given ('mdy' by default; see
  // dateOrderOf). Anything else is read as Date reads it. Returns null if it
  // isn't a date.
  function parseDate(value, order = 'mdy') {
    if (value == null || value === '') return null;
    let time;
    if (value instanceof Date || typeof value == 'number') {
      time = new Date(value);
    } else {
      const text = String(value).trim();
      const day = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?|(\d{2})(\d{2}))?$/.exec(text);
      const parts = day ? null : numericParts(text);
      if (day) {
        const month = +(day[2] || day[4] || 1), date = +(day[3] || day[5] || 1);
        time = localDate(+day[1], month, date, [0, 0, 0]);
      } else if (parts) {
        time = numericDate(parts, order);
      } else if (SLASHED.test(text)) {
        return null;
      } else {
        time = new Date(text);
      }
    }
    return time && !isNaN(time) ? time : null;
  }

  // Whether a node has no usable date in a field (empty, absent or unreadable)
  const isUndated = (value, order) => parseDate(value, order) === null;

  // How many nodes have no date in a field
  const countUndated = (nodes, field, order) => nodes.reduce((n, d) => n + (isUndated(d[field], order) ? 1 : 0), 0);

  // Whether a node is shown with the timeline at a time (a Date or ms). Nodes
  // without a date are always shown: nothing says they come later.
  function shownAt(value, end, order) {
    const time = parseDate(value, order), until = parseDate(end);
    if (!until || !time) return true;
    return time <= until;
  }

  const MTDates = { parseDate, dateOrderOf, isUndated, countUndated, shownAt };
  self.MTDates = MTDates;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTDates;
})(typeof self !== 'undefined' ? self : this);
