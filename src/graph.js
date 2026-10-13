(function(self){
  'use strict';

  // MTGraph: the canonical store for MicrobeTrace's network. Every other view of
  // the links (link objects, the distance matrix, clusters, neighbor lists) is
  // derived from it.
  //
  // Nodes are integers inside the store; string IDs are mapped at the boundary.
  //
  // Links come in two kinds that share one edge-ID space:
  // - Explicit edges (IDs below IMPLICIT): a columnar edge list. Source and target
  //   indices, flags and origins are typed arrays; each link field is one column
  //   (Float64Array while every value is numeric, a plain Array otherwise).
  // - Implicit edges (IDs IMPLICIT + k): computed genetic distances, kept as
  //   condensed upper triangles (4 bytes per pair, no indices), one per field
  //   (a distance metric) over the same rows. Pair k of rows i < j has source
  //   rows[j] and target rows[i]. A pair that also has an explicit edge is
  //   "shadowed": the explicit edge carries its distances and the implicit one
  //   is skipped.
  //
  // While links are being added, a Map finds duplicate pairs. freeze() replaces it
  // with a CSR adjacency index (offsets / neighbors / edge IDs), which is much
  // smaller, and adding another link thaws it again.

  const IMPLICIT = 2 ** 31;
  const NN = 1, DIRECTED = 2;
  // Fields that describe a link's place in the store rather than its data.
  const RESERVED = new Set(['source', 'target', 'origin', 'index', 'visible', 'cluster', 'nn', 'directed']);

  const grow = (array, size) => {
    if (size <= array.length) return array;
    const out = new array.constructor(Math.max(size, array.length * 2, 16));
    out.set(array);
    return out;
  };

  // Position of pair (i, j), i < j, in the condensed upper triangle of n rows.
  const pairIndex = (i, j, n) => i * n - i * (i + 1) / 2 + (j - i - 1);

  // Inverse of pairIndex.
  const pairRows = (k, n) => {
    let i = Math.floor(n - 0.5 - Math.sqrt((n - 0.5) * (n - 0.5) - 2 * k));
    if (i < 0) i = 0;
    while (i > 0 && pairIndex(i, i + 1, n) > k) i--;
    while (i < n - 2 && pairIndex(i + 1, i + 2, n) <= k) i++;
    return [i, k - pairIndex(i, i + 1, n) + i + 1];
  };

  class MTGraph {
    constructor() {
      // Nodes
      this.ids = [];
      this.index = new Map();
      // Explicit edges
      this.m = 0;
      this.src = new Uint32Array(0);
      this.tgt = new Uint32Array(0);
      this.flags = new Uint8Array(0);
      this.combo = new Uint16Array(0);
      this.columns = new Map();
      this.pairs = new Map();
      this.csr = null;
      // Interned origin lists: each edge stores the ID of its list
      this.combos = [[]];
      this.comboIDs = new Map([['', 0]]);
      // Implicit edges
      this.dense = null;
      this.implicitFlags = new Map();
      // Derived state
      this.visible = new Uint32Array(0);
      this.visibleCount = 0;
      this.visibleVersion = 0;
      this.nodeCluster = null;
      this.version = 0;
    }

    // Nodes ------------------------------------------------------------------

    get nodeCount() { return this.ids.length; }

    node(id) {
      id = '' + id;
      let i = this.index.get(id);
      if (i === undefined) {
        i = this.ids.length;
        this.ids.push(id);
        this.index.set(id, i);
      }
      return i;
    }

    // Origins ----------------------------------------------------------------

    internOrigins(list) {
      const key = list.join('\u0000');
      let id = this.comboIDs.get(key);
      if (id === undefined) {
        id = this.combos.length;
        if (id > 0xffff) throw new Error('Too many distinct link origin combinations');
        this.combos.push(list.slice());
        this.comboIDs.set(key, id);
      }
      return id;
    }

    // New origins first, then old ones not repeated (as MT.addLink always did).
    mergeOrigins(comboID, origins) {
      if (!origins || origins.length == 0) return comboID;
      const seen = new Set();
      const list = [];
      origins.concat(this.combos[comboID]).forEach(o => {
        if (!seen.has(o)) {
          seen.add(o);
          list.push(o);
        }
      });
      return this.internOrigins(list);
    }

    // Columns ----------------------------------------------------------------

    column(field) {
      let col = this.columns.get(field);
      if (!col) {
        col = { numeric: true, data: new Float64Array(this.src.length).fill(NaN) };
        this.columns.set(field, col);
      }
      return col;
    }

    setValue(e, field, value) {
      let col = this.column(field);
      if (col.numeric && !(value == null || typeof value == 'number')) {
        col.numeric = false;
        col.data = Array.from(col.data.subarray(0, this.m), v => isNaN(v) ? null : v);
      }
      if (col.numeric) {
        if (col.data.length < this.src.length) {
          const data = new Float64Array(this.src.length).fill(NaN);
          data.set(col.data);
          col.data = data;
        }
        col.data[e] = value == null ? NaN : value;
      } else {
        col.data[e] = value === undefined ? null : value;
      }
    }

    getValue(e, field) {
      if (e >= IMPLICIT) {
        const tri = this.denseValues(field);
        if (!tri) return null;
        const v = tri[e - IMPLICIT];
        return isNaN(v) ? null : v;
      }
      const col = this.columns.get(field);
      if (!col) return null;
      const v = col.data[e];
      if (col.numeric) return isNaN(v) ? null : v;
      return v === undefined ? null : v;
    }

    // Explicit edges ---------------------------------------------------------

    static pairKey(a, b) {
      return a < b ? a * 0x4000000 + b : b * 0x4000000 + a;
    }

    thaw() {
      if (!this.csr) return;
      this.csr = null;
      this.pairs = new Map();
      for (let e = 0; e < this.m; e++) this.pairs.set(MTGraph.pairKey(this.src[e], this.tgt[e]), e);
    }

    // Adds a link (an object with source and target IDs, an origin list and any
    // other fields) or merges it into the existing link between the same pair:
    // its fields win and the origins are combined. Returns 1 if the link is new.
    addLink(link) {
      const s = this.node(link.source), t = this.node(link.target);
      if (s == t) return 0;
      this.thaw();
      this.version++;
      const key = MTGraph.pairKey(s, t);
      let e = this.pairs.get(key);
      let isNew = 0;
      if (e === undefined) {
        const k = this.densePair(s, t);
        e = this.pushEdge(s, t);
        this.pairs.set(key, e);
        if (k >= 0) {
          // This pair already had computed distances: it becomes explicit.
          const d = this.dense;
          d.shadow[k >> 3] |= 1 << (k & 7);
          d.shadowCount++;
          d.tris.forEach((tri, field) => this.setValue(e, field, tri[k]));
          this.combo[e] = d.combo;
          if (this.implicitFlags.has(k)) {
            this.flags[e] = this.implicitFlags.get(k);
            this.implicitFlags.delete(k);
          }
        } else {
          isNew = 1;
        }
      }
      this.src[e] = s;
      this.tgt[e] = t;
      let origins = link.origin;
      if (typeof origins == 'string') origins = [origins];
      this.combo[e] = this.mergeOrigins(this.combo[e], origins || []);
      if ('nn' in link) this.setFlag(e, NN, link.nn);
      if ('directed' in link) this.setFlag(e, DIRECTED, link.directed);
      for (const field in link) {
        if (!RESERVED.has(field)) this.setValue(e, field, link[field]);
      }
      return isNew;
    }

    pushEdge(s, t) {
      const e = this.m++;
      if (e >= IMPLICIT) throw new Error('Too many links');
      this.src = grow(this.src, this.m);
      this.tgt = grow(this.tgt, this.m);
      this.flags = grow(this.flags, this.m);
      this.combo = grow(this.combo, this.m);
      this.src[e] = s;
      this.tgt[e] = t;
      return e;
    }

    // Builds the CSR adjacency index for explicit edges and drops the pair Map.
    freeze() {
      if (this.csr) return;
      const n = this.nodeCount, m = this.m;
      const offsets = new Uint32Array(n + 1);
      for (let e = 0; e < m; e++) {
        offsets[this.src[e] + 1]++;
        offsets[this.tgt[e] + 1]++;
      }
      for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
      const fill = offsets.slice(0, n);
      const nbr = new Uint32Array(2 * m), eid = new Uint32Array(2 * m);
      for (let e = 0; e < m; e++) {
        const s = this.src[e], t = this.tgt[e];
        nbr[fill[s]] = t; eid[fill[s]++] = e;
        nbr[fill[t]] = s; eid[fill[t]++] = e;
      }
      // Sort each row by neighbor, for binary search
      for (let i = 0; i < n; i++) {
        const a = offsets[i], b = offsets[i + 1];
        if (b - a < 2) continue;
        const order = Array.from({ length: b - a }, (_, x) => a + x).sort((x, y) => nbr[x] - nbr[y]);
        const nn = order.map(x => nbr[x]), ee = order.map(x => eid[x]);
        nbr.set(nn, a);
        eid.set(ee, a);
      }
      this.csr = { offsets, nbr, eid };
      this.pairs = null;
    }

    explicitEdge(a, b) {
      if (!this.csr) {
        const e = this.pairs.get(MTGraph.pairKey(a, b));
        return e === undefined ? -1 : e;
      }
      const { offsets, nbr, eid } = this.csr;
      if (a >= offsets.length - 1) return -1;
      let lo = offsets[a], hi = offsets[a + 1] - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nbr[mid] == b) return eid[mid];
        if (nbr[mid] < b) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    }

    // Implicit edges ---------------------------------------------------------

    // Stores computed distances for every pair of ids (a condensed upper
    // triangle in that row order) as field `field`. Pairs that already have an
    // explicit edge get the distance and origin on that edge. Distances over
    // the same ids, in the same order, are kept beside those already stored
    // (another metric for the same sequences); over others, they replace them.
    setDistances(ids, tri, field, origin) {
      const n = ids.length;
      if (tri.length != n * (n - 1) / 2) throw new Error('Distance triangle does not match the number of sequences');
      this.version++;
      const old = this.dense;
      if (old && old.n == n && ids.every((id, r) => this.index.get('' + id) === old.rows[r])) {
        old.tris.set(field, tri);
        this.column(field);
        // The explicit edges over these pairs carry this field too
        for (let e = 0; e < this.m; e++) {
          const k = this.densePair(this.src[e], this.tgt[e]);
          if (k >= 0) this.setValue(e, field, tri[k]);
        }
        return;
      }
      const rows = Uint32Array.from(ids, id => this.node(id));
      const pos = new Int32Array(this.nodeCount).fill(-1);
      rows.forEach((g, r) => { pos[g] = r; });
      const combo = this.internOrigins([origin]);
      const d = this.dense = {
        rows, pos, n, combo,
        tris: new Map([[field, tri]]),
        shadow: new Uint8Array(Math.ceil(tri.length / 8)),
        shadowCount: 0
      };
      this.implicitFlags = new Map();
      this.column(field);
      for (let e = 0; e < this.m; e++) {
        const k = this.densePair(this.src[e], this.tgt[e]);
        if (k < 0) continue;
        const i = Math.min(pos[this.src[e]], pos[this.tgt[e]]), j = Math.max(pos[this.src[e]], pos[this.tgt[e]]);
        d.shadow[k >> 3] |= 1 << (k & 7);
        d.shadowCount++;
        this.src[e] = rows[j];
        this.tgt[e] = rows[i];
        this.setValue(e, field, tri[k]);
        this.combo[e] = this.mergeOrigins(this.combo[e], [origin]);
      }
    }

    // The computed distances stored for field, a condensed triangle, or null
    denseValues(field) {
      return this.dense ? this.dense.tris.get(field) || null : null;
    }

    // The number of pairs the triangles cover
    get densePairs() {
      return this.dense ? this.dense.n * (this.dense.n - 1) / 2 : 0;
    }

    // Position k of pair (a, b) in the triangle, or -1. Shadowed pairs count.
    densePair(a, b) {
      const d = this.dense;
      if (!d || a >= d.pos.length || b >= d.pos.length) return -1;
      let i = d.pos[a], j = d.pos[b];
      if (i < 0 || j < 0 || i == j) return -1;
      if (i > j) [i, j] = [j, i];
      return pairIndex(i, j, d.n);
    }

    isShadowed(k) {
      return (this.dense.shadow[k >> 3] >> (k & 7)) & 1;
    }

    // Any edges --------------------------------------------------------------

    get edgeCount() {
      return this.m + (this.dense ? this.densePairs - this.dense.shadowCount : 0);
    }

    // The edge between node indices a and b, or -1.
    edgeBetween(a, b) {
      const e = this.explicitEdge(a, b);
      if (e >= 0) return e;
      const k = this.densePair(a, b);
      return k >= 0 && !this.isShadowed(k) ? IMPLICIT + k : -1;
    }

    source(e) {
      if (e < IMPLICIT) return this.src[e];
      const d = this.dense;
      return d.rows[pairRows(e - IMPLICIT, d.n)[1]];
    }

    target(e) {
      if (e < IMPLICIT) return this.tgt[e];
      const d = this.dense;
      return d.rows[pairRows(e - IMPLICIT, d.n)[0]];
    }

    origins(e) {
      return this.combos[e < IMPLICIT ? this.combo[e] : this.dense.combo];
    }

    getFlags(e) {
      return e < IMPLICIT ? this.flags[e] : (this.implicitFlags.get(e - IMPLICIT) || 0);
    }

    setFlag(e, flag, on) {
      const f = on ? this.getFlags(e) | flag : this.getFlags(e) & ~flag;
      if (e < IMPLICIT) {
        this.flags[e] = f;
      } else if (f) {
        this.implicitFlags.set(e - IMPLICIT, f);
      } else {
        this.implicitFlags.delete(e - IMPLICIT);
      }
    }

    clearFlag(flag) {
      for (let e = 0; e < this.m; e++) this.flags[e] &= ~flag;
      if (this.implicitFlags) {
        this.implicitFlags.forEach((f, k) => {
          if (f & ~flag) this.implicitFlags.set(k, f & ~flag);
          else this.implicitFlags.delete(k);
        });
      }
    }

    // Reverses an edge's direction. Only explicit edges have a stored direction,
    // so an implicit edge becomes explicit first.
    flip(e) {
      if (e >= IMPLICIT) {
        const s = this.source(e), t = this.target(e);
        this.addLink({ source: this.ids[t], target: this.ids[s] });
        return this.explicitEdge(s, t);
      }
      const s = this.src[e];
      this.src[e] = this.tgt[e];
      this.tgt[e] = s;
      return e;
    }

    // Calls fn(e, source, target) for every edge.
    forEachEdge(fn) {
      for (let e = 0; e < this.m; e++) fn(e, this.src[e], this.tgt[e]);
      const d = this.dense;
      if (!d) return;
      const { rows, n, shadow } = d;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const t = rows[i];
        for (let j = i + 1; j < n; j++, k++) {
          if (!((shadow[k >> 3] >> (k & 7)) & 1)) fn(IMPLICIT + k, rows[j], t);
        }
      }
    }

    // Calls fn(value, e, source, target) for every edge with a value in field
    // (nulls skipped).
    forEachValue(field, fn) {
      const col = this.columns.get(field);
      if (col) {
        for (let e = 0; e < this.m && e < col.data.length; e++) {
          const v = col.data[e];
          if (v == null || (col.numeric && isNaN(v))) continue;
          fn(v, e, this.src[e], this.tgt[e]);
        }
      }
      const d = this.dense, tri = this.denseValues(field);
      if (!tri) return;
      const { rows, n, shadow } = d;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const t = rows[i];
        for (let j = i + 1; j < n; j++, k++) {
          const v = tri[k];
          if (v != v || ((shadow[k >> 3] >> (k & 7)) & 1)) continue;
          fn(v, IMPLICIT + k, rows[j], t);
        }
      }
    }

    // Visibility -------------------------------------------------------------

    // Recomputes the visible edge list: a value in field at or under threshold,
    // the NN flag if nnOnly, and keep(source) for the cluster filter.
    computeVisible(field, threshold, nnOnly, keep) {
      let out = this.visible, c = 0;
      const push = e => {
        if (c >= out.length) out = grow(out, c + 1);
        out[c++] = e;
      };
      const col = this.columns.get(field);
      if (col) {
        for (let e = 0; e < this.m; e++) {
          const v = col.data[e];
          if (v == null || !(v <= threshold)) continue;
          if (nnOnly && !(this.flags[e] & NN)) continue;
          if (!keep(this.src[e])) continue;
          push(e);
        }
      }
      const d = this.dense, tri = this.denseValues(field);
      if (tri) {
        if (nnOnly) {
          this.implicitFlags.forEach((f, k) => {
            if ((f & NN) && tri[k] <= threshold && !this.isShadowed(k)) {
              const e = IMPLICIT + k;
              if (keep(this.source(e))) push(e);
            }
          });
        } else {
          const { rows, n, shadow } = d;
          let k = 0;
          for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++, k++) {
              if (tri[k] <= threshold && !((shadow[k >> 3] >> (k & 7)) & 1) && keep(rows[j])) push(IMPLICIT + k);
            }
          }
        }
      }
      this.visible = out;
      this.visibleCount = c;
      this.visibleVersion++;
      this.version++;
      return out.subarray(0, c);
    }

    // Connected components over the visible edges, by union-find. Returns a
    // component number per node (numbered in node order, from 0).
    components() {
      const n = this.nodeCount;
      const parent = new Int32Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      const find = i => {
        while (parent[i] != i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
      for (let x = 0; x < this.visibleCount; x++) {
        const e = this.visible[x];
        const a = find(this.source(e)), b = find(this.target(e));
        if (a != b) parent[Math.max(a, b)] = Math.min(a, b);
      }
      const label = new Int32Array(n).fill(-1);
      const out = new Int32Array(n);
      let next = 0;
      for (let i = 0; i < n; i++) {
        const r = find(i);
        if (label[r] < 0) label[r] = next++;
        out[i] = label[r];
      }
      return out;
    }

    // Link objects -----------------------------------------------------------

    // A plain link object for edge e, the shape MicrobeTrace has always used.
    link(e) {
      const out = {
        index: e,
        source: this.ids[this.source(e)],
        target: this.ids[this.target(e)]
      };
      this.columns.forEach((col, field) => {
        out[field] = this.getValue(e, field);
      });
      const f = this.getFlags(e);
      out.origin = this.origins(e).slice();
      out.nn = !!(f & NN);
      out.directed = !!(f & DIRECTED);
      return out;
    }

    // Approximate bytes held by the store, for diagnostics.
    get bytes() {
      let b = this.src.byteLength + this.tgt.byteLength + this.flags.byteLength + this.combo.byteLength;
      this.columns.forEach(col => { b += col.numeric ? col.data.byteLength : col.data.length * 8; });
      if (this.csr) b += this.csr.offsets.byteLength + this.csr.nbr.byteLength + this.csr.eid.byteLength;
      if (this.pairs) b += this.pairs.size * 40;
      if (this.dense) {
        this.dense.tris.forEach(tri => { b += tri.byteLength; });
        b += this.dense.shadow.byteLength + this.dense.pos.byteLength + this.dense.rows.byteLength;
      }
      return b;
    }
  }

  MTGraph.IMPLICIT = IMPLICIT;
  MTGraph.NN = NN;
  MTGraph.DIRECTED = DIRECTED;
  MTGraph.pairIndex = pairIndex;
  MTGraph.pairRows = pairRows;

  self.MTGraph = MTGraph;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTGraph;
})(typeof self !== 'undefined' ? self : this);
