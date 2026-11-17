// Reading dates from node data, and what to do with nodes that have none.
// Missing dates stay missing: nothing here (or anywhere) fills them in.
(function (self) {
  'use strict';

  // Reads a date field: a Date, a time in milliseconds, or text. Dates written
  // without a time (2020, 2020-03, 2020-03-14 or 20200314) are local midnight,
  // as people mean them (Date alone reads the dashed ones as UTC). Anything
  // else is read as Date reads it. Returns null if it isn't a date.
  function parseDate(value) {
    if (value == null || value === '') return null;
    let time;
    if (value instanceof Date || typeof value == 'number') {
      time = new Date(value);
    } else {
      const text = String(value).trim();
      const day = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?|(\d{2})(\d{2}))?$/.exec(text);
      if (day) {
        const year = +day[1], month = +(day[2] || day[4] || 1) - 1, date = +(day[3] || day[5] || 1);
        time = new Date(year, month, date);
        time.setFullYear(year); // years before 100 aren't 19xx
        if (time.getMonth() != month || time.getDate() != date) return null;
      } else {
        time = new Date(text);
      }
    }
    return isNaN(time) ? null : time;
  }

  // Whether a node has no usable date in a field (empty, absent or unreadable)
  const isUndated = value => parseDate(value) === null;

  // How many nodes have no date in a field
  const countUndated = (nodes, field) => nodes.reduce((n, d) => n + (isUndated(d[field]) ? 1 : 0), 0);

  // Whether a node is shown with the timeline at a time (a Date or ms). Nodes
  // without a date are always shown: nothing says they come later.
  function shownAt(value, end) {
    const time = parseDate(value), until = parseDate(end);
    if (!until || !time) return true;
    return time <= until;
  }

  const MTDates = { parseDate, isUndated, countUndated, shownAt };
  self.MTDates = MTDates;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTDates;
})(typeof self !== 'undefined' ? self : this);
