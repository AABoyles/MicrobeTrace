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
  //
  // A field can prefer a source (named), which then wins for it, and a node's
  // field can pick one, which wins for that node alone. A preferred or picked
  // source without a value leaves it to the others. Both are kept when the
  // sources are reset, as they are each time files are read again.

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
      this.rules = new Map(); // field → the preferred source's name
      this.picks = new Map(); // key → Map of field → the picked source's name
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

    // Which source's value a field prefers (a source's name), or null for the
    // ranks to decide
    prefer(field, name) {
      if (name == null) this.rules.delete(field);
      else this.rules.set(field, name);
    }

    // Which source's value one node's field uses (a source's name), or null
    // for the field's rule to decide
    pick(key, field, name) {
      let fields = this.picks.get(key);
      if (name == null) {
        if (fields) fields.delete(field);
        if (fields && !fields.size) this.picks.delete(key);
        return;
      }
      if (!fields) this.picks.set(key, fields = new Map());
      fields.set(field, name);
    }

    // The name of the source a node's field picks, if any
    picked(key, field) {
      const fields = this.picks.get(key);
      return fields && fields.get(field) || null;
    }

    // The source whose value a node's field uses: the one it picks, then the
    // one its field prefers, then the best ranked with a value
    decides(key, field) {
      const named = name => name != null && this.ranked().find(s => s.name == name && s.value(key, field) !== undefined);
      const picked = named(this.picked(key, field));
      if (picked) return picked;
      const preferred = named(this.rules.get(field));
      if (preferred) return preferred;
      return this.ranked().find(s => s.value(key, field) !== undefined);
    }

    // The value to use for a node's field, or undefined
    resolve(key, field) {
      const source = this.decides(key, field);
      return source ? source.value(key, field) : undefined;
    }

    // Every source's value for a node's field, best ranked first, marking the
    // one used
    provenance(key, field) {
      const used = this.decides(key, field);
      const out = [];
      for (const s of this.ranked()) {
        const value = s.value(key, field);
        if (value !== undefined) out.push({ source: s.name, row: s.rowOf.get(key), value, used: s === used });
      }
      return out;
    }

    // The keys of every node a source gives a field
    keys(field) {
      const keys = new Set();
      this.list.forEach(s => { if (s.columns.has(field)) s.rowOf.forEach((row, key) => keys.add(key)); });
      return keys;
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

  // Saving and restoring sources, as sessions do. nodeOf(key) gives a node:
  // a source's value the node also has (usually most) is saved as 1, and read
  // back from the node; a value it doesn't have is saved as [value], and no
  // value as 0.
  MTNodeSources.prototype.save = function (nodeOf = () => undefined) {
    return {
      version: 1,
      sources: this.list.map(source => {
        const keys = new Array(source.rows);
        source.rowOf.forEach((row, key) => { keys[row] = key; });
        const columns = {};
        source.columns.forEach((column, field) => {
          columns[field] = keys.map((key, row) => {
            const value = column[row];
            if (empty(value)) return 0;
            const node = nodeOf(key);
            return node && node[field] === value ? 1 : [value];
          });
        });
        return { name: source.name, rank: source.rank, keys, columns };
      }),
      rules: Object.fromEntries(this.rules),
      picks: Array.from(this.picks, ([key, fields]) => Array.from(fields, ([field, name]) => [key, field, name])).flat()
    };
  };

  MTNodeSources.restore = (saved, nodeOf = () => undefined) => {
    const sources = new MTNodeSources();
    if (!saved || !Array.isArray(saved.sources)) return sources;
    Object.entries(saved.rules || {}).forEach(([field, name]) => sources.prefer(field, name));
    (saved.picks || []).forEach(([key, field, name]) => sources.pick(key, field, name));
    saved.sources.forEach((s, i) => {
      const source = sources.add(s.name, typeof s.rank == 'number' ? s.rank : i);
      const keys = s.keys || [];
      keys.forEach((key, row) => source.rowOf.set(key, row));
      source.rows = keys.length;
      Object.keys(s.columns || {}).forEach(field => {
        source.columns.set(field, s.columns[field].map((cell, row) => {
          if (cell === 1) {
            const node = nodeOf(keys[row]);
            return node ? node[field] : undefined;
          }
          return Array.isArray(cell) ? cell[0] : undefined;
        }));
      });
    });
    return sources;
  };

  MTNodeSources.empty = empty;
  MTNodeSources.same = same;

  self.MTNodeSources = MTNodeSources;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTNodeSources;
})(typeof self !== 'undefined' ? self : this);
