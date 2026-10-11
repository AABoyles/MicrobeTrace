(function(self){
  'use strict';

  // MTNodeSources: the values each file gives its nodes, kept as the file had
  // them, so a node's values can be traced to their files, and where files
  // disagree is known.
  //
  // A source is a file (or anything else that adds nodes). It keeps a row per
  // node key and a column per field. Sources are ranked: where they disagree,
  // the lowest rank (the file at the top of the list) wins, and a source with
  // no value for a field leaves it to the next. A key repeated within a source
  // keeps its first row, which later rows only fill in.

  const empty = v => v === undefined || v === null || v === '' || (typeof v == 'number' && isNaN(v));

  // Whether two values are the same: equal, the same number (33 and "33.00",
  // as a spreadsheet and a CSV give it), or the same text but for spaces
  const isNumber = v => typeof v == 'number' || (typeof v == 'string' && v.trim() !== '' && !isNaN(v));
  const same = (a, b) => a === b || (isNumber(a) && isNumber(b) ? +a == +b : String(a).trim() == String(b).trim());

  class Source {
    constructor(name, rank) {
      this.name = name;
      this.rank = rank;
      this.rows = 0;
      this.rowOf = new Map();
      this.columns = new Map();
    }

    // Records a node's values (an object of fields), returning its row
    add(key, values) {
      let row = this.rowOf.get(key);
      const fresh = row === undefined;
      if (fresh) {
        row = this.rows++;
        this.rowOf.set(key, row);
      }
      for (const field in values) {
        let column = this.columns.get(field);
        if (!column) this.columns.set(field, column = []);
        // (Holes are filled, so columns stay compact arrays)
        while (column.length < row) column.push(undefined);
        if (fresh || empty(column[row])) column[row] = values[field];
      }
      return row;
    }

    // A node's value for a field, or undefined if the source has none
    value(key, field) {
      const row = this.rowOf.get(key), column = this.columns.get(field);
      if (row === undefined || !column) return undefined;
      const v = column[row];
      return empty(v) ? undefined : v;
    }
  }

  class MTNodeSources {
    constructor() {
      this.list = [];
      this.sorted = null;
    }

    // A new source, ranked rank (lower wins)
    add(name, rank = this.list.length) {
      const source = new Source(name, rank);
      this.list.push(source);
      this.sorted = null;
      return source;
    }

    reset() {
      this.list = [];
      this.sorted = null;
    }

    // The sources, best first
    ranked() {
      if (!this.sorted) this.sorted = this.list.slice().sort((a, b) => a.rank - b.rank);
      return this.sorted;
    }

    // The value to use for a node's field: the best source's, or undefined
    resolve(key, field) {
      for (const s of this.ranked()) {
        const v = s.value(key, field);
        if (v !== undefined) return v;
      }
      return undefined;
    }

    // Every source's value for a node's field, best first, marking the one used
    provenance(key, field) {
      const out = [];
      for (const s of this.ranked()) {
        const value = s.value(key, field);
        if (value !== undefined) out.push({ source: s.name, row: s.rowOf.get(key), value, used: out.length == 0 });
      }
      return out;
    }

    // Where sources disagree: a Map of each field to the keys of the nodes
    // whose sources give it different values
    conflicts() {
      const out = new Map();
      if (this.list.length < 2) return out;
      const fields = new Set();
      this.list.forEach(s => s.columns.forEach((column, field) => fields.add(field)));
      // Only nodes in more than one source can disagree
      const count = new Map();
      this.list.forEach(s => s.rowOf.forEach((row, key) => count.set(key, (count.get(key) || 0) + 1)));
      const shared = [];
      count.forEach((n, key) => { if (n > 1) shared.push(key); });
      fields.forEach(field => {
        const having = this.ranked().filter(s => s.columns.has(field));
        if (having.length < 2) return;
        const keys = [];
        for (const key of shared) {
          let first;
          for (const s of having) {
            const v = s.value(key, field);
            if (v === undefined) continue;
            if (first === undefined) first = v;
            else if (!same(first, v)) {
              keys.push(key);
              break;
            }
          }
        }
        if (keys.length) out.set(field, keys);
      });
      return out;
    }
  }

  MTNodeSources.empty = empty;
  MTNodeSources.same = same;

  self.MTNodeSources = MTNodeSources;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTNodeSources;
})(typeof self !== 'undefined' ? self : this);
