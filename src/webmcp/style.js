(function(self){
  'use strict';

  // WebMCP tools for MicrobeTrace's global settings, filtering, selection,
  // node and link styling, color tables and the global timeline.
  // See src/webmcp.js for how tools are defined.

  const T = self.MTWebMCP;
  if (!T) return;
  const { fail } = T;

  const S = () => self.MT.settings;
  const W = () => self.session.style.widgets;
  const events = () => self.MT.events;
  const readOnly = { readOnlyHint: true };
  const obj = (properties, required) => ({ type: 'object', properties, required: required || [] });
  const str = description => ({ type: 'string', description });
  const num = (description, extra) => Object.assign({ type: 'number', description }, extra);
  const bool = description => ({ type: 'boolean', description });
  const strList = description => ({ type: 'array', items: { type: 'string' }, description });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Data helpers --------------------------------------------------------------

  const nodes = () => T.requireData().nodes;
  const nodeFields = () => self.session.data.nodeFields.slice();
  const linkFields = () => self.session.data.linkFields.slice();

  // A node (or link) field name, or None, as the variable menus offer them
  function checkVariable(kind, name, { allowNone = true, what = 'variable' } = {}) {
    T.requireData();
    if (name === 'None' || name === null || name === '') {
      if (!allowNone) fail(what + ' must be a field name, not None');
      return 'None';
    }
    const fields = kind == 'node' ? nodeFields() : linkFields();
    if (!fields.includes(name)) fail('Unknown ' + kind + ' field ' + JSON.stringify(name) + '. Available ' + kind + ' fields: ' + fields.join(', '));
    return name;
  }

  // Does a node field hold numbers (for sizing)?
  function numericNodeField(field) {
    let n = 0, numeric = 0;
    for (const d of nodes()) {
      const v = d[field];
      if (v === null || v === undefined || v === '') continue;
      n++;
      if (typeof v == 'number' || (typeof v == 'string' && v.trim() !== '' && !isNaN(+v))) numeric++;
    }
    return n > 0 && numeric / n > 0.5;
  }

  const linkFieldNumeric = field => {
    const g = self.session.data.graph;
    if (self.MT.distanceMetrics[field]) return true;
    const col = g.columns.get(field);
    if (col && col.numeric) return true;
    return !!g.denseValues(field);
  };

  // A color as #rrggbb, from hex or any CSS color name or function
  function toHex(color) {
    if (typeof color != 'string') fail('A color must be text like "#ff8300" or "orange"');
    const c = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = '#010203';
    ctx.fillStyle = c;
    const a = ctx.fillStyle;
    ctx.fillStyle = '#040506';
    ctx.fillStyle = c;
    const b = ctx.fillStyle;
    if (a !== b) fail('Not a color: ' + JSON.stringify(color) + '. Use #rrggbb or a CSS color name.');
    if (!/^#[0-9a-f]{6}$/i.test(a)) fail('Use an opaque color (#rrggbb): ' + JSON.stringify(color) + '. Transparency is set separately.');
    return a.toLowerCase();
  }

  // Counts ----------------------------------------------------------------------

  function counts() {
    const d = self.session.data, g = d.graph;
    const all = d.nodes;
    return {
      nodes: { total: all.length, visible: all.filter(n => n.visible).length, selected: all.filter(n => n.selected).length },
      links: { total: g ? g.edgeCount : 0, visible: g ? g.visibleCount : 0 },
      clusters: { total: d.clusters.length, visible: d.clusters.filter(c => c.visible).length }
    };
  }

  // Settings catalog ----------------------------------------------------------

  const typeOf = v => v === null || v === undefined ? 'null' : Array.isArray(v) ? 'array' : typeof v;

  function labelFor(el) {
    const row = el.closest('.form-group, .row');
    let text = '';
    if (row) {
      const label = row.querySelector('label[for]:not(.btn), label:not(.btn)');
      const col = row.querySelector('.col-4');
      text = (label || col || {}).textContent || '';
    }
    text = text.replace(/\s+/g, ' ').trim();
    return text || (row && row.getAttribute('title')) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
  }

  function viewOf(el) {
    if (el.closest('#global-settings-modal')) return 'global settings';
    if (el.closest('#search-form')) return 'search';
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = Array.from(p.classList || []).find(c => /-view$/.test(c));
      if (c) return c.replace(/-view$/, '');
    }
    return null;
  }

  // What the page's controls say about each setting: one entry per key
  function controls() {
    const out = new Map();
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      let info = out.get(key);
      if (!info) {
        info = { control: null, label: labelFor(el), view: viewOf(el) };
        out.set(key, info);
      }
      if (el.tagName == 'SELECT') {
        info.control = el.multiple ? 'multiselect' : 'select';
        info.options = Array.from(el.options).map(o => ({ value: o.value, label: o.textContent.replace(/\s+/g, ' ').trim() }));
      } else if (el.type == 'radio') {
        info.control = 'radio';
        info.options = (info.options || []).concat([{ value: el.value, label: (el.closest('label') ? el.closest('label').textContent : el.value).replace(/\s+/g, ' ').trim() }]);
      } else {
        info.control = el.type || el.tagName.toLowerCase();
        ['min', 'max', 'step'].forEach(a => { if (el.getAttribute(a) !== null && el.getAttribute(a) !== '') info[a] = +el.getAttribute(a); });
      }
    });
    return out;
  }

  const allKeys = () => Array.from(new Set(Object.keys(self.MT.defaultWidgets).concat(Object.keys(W())))).sort();

  function describeSetting(key, ctl) {
    const def = self.MT.defaultWidgets[key], value = W()[key];
    const entry = { key, value: value === undefined ? null : value, default: def === undefined ? null : def, type: typeOf(def === null || def === undefined ? value : def), modified: !same(value, def) };
    const c = ctl.get(key);
    if (c) {
      entry.control = c.control;
      if (c.label) entry.label = c.label;
      if (c.view) entry.view = c.view;
      if (c.options) entry.options = c.options;
      ['min', 'max', 'step'].forEach(a => { if (c[a] !== undefined) entry[a] = c[a]; });
    } else if (!(key in self.MT.defaultWidgets)) {
      entry.note = 'Not a standard setting';
    }
    return entry;
  }

  // The value, checked and coerced to what the setting holds. Returns {value, warnings}.
  function coerce(key, value, ctl) {
    const warnings = [];
    const ref = self.MT.defaultWidgets[key] !== undefined ? self.MT.defaultWidgets[key] : W()[key];
    const c = ctl.get(key);
    const bad = msg => fail(key + ': ' + msg);
    if (ref === null || ref === undefined) return { value, warnings };
    if (typeof ref == 'boolean') {
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      if (typeof value != 'boolean') bad('expected true or false, got ' + JSON.stringify(value));
    } else if (typeof ref == 'number') {
      if (typeof value == 'string' && value.trim() !== '' && !isNaN(+value)) value = +value;
      if (typeof value != 'number' || !isFinite(value)) bad('expected a number, got ' + JSON.stringify(value));
      if (c && c.min !== undefined && value < c.min) warnings.push(key + ' ' + value + ' is below the control\'s minimum of ' + c.min);
      if (c && c.max !== undefined && value > c.max) warnings.push(key + ' ' + value + ' is above the control\'s maximum of ' + c.max);
    } else if (typeof ref == 'string') {
      if (/tooltip-variable$/.test(key) && Array.isArray(value) && value.every(v => typeof v == 'string')) {
        // (multi-field tooltips)
      } else {
        if (typeof value != 'string') bad('expected text, got ' + JSON.stringify(value));
        if (/^#[0-9a-f]{6}$/i.test(ref)) value = toHex(value);
        else if (c && c.options && c.options.length && (c.control == 'select' || c.control == 'radio') && !c.options.some(o => o.value === value || (o.value === '' && o.label === value))) {
          bad('must be one of ' + c.options.map(o => JSON.stringify(o.value)).join(', '));
        }
      }
    } else if (Array.isArray(ref)) {
      if (!Array.isArray(value)) bad('expected a list');
    } else if (typeof ref == 'object') {
      if (typeof value != 'object' || value === null || Array.isArray(value)) bad('expected an object');
    }
    return { value, warnings };
  }

  // Settings that drive the network filter: setting them reruns clustering and
  // visibility, which finishes a moment later
  const FILTER_KEYS = ['link-show-nn', 'filtering-epsilon', 'link-sort-variable', 'link-threshold', 'cluster-minimum-size'];

  function visibilityWaiter(timeout = 120000) {
    let off, timer;
    const promise = new Promise((resolve, reject) => {
      off = events().on('node-visibility', () => { clearTimeout(timer); off(); resolve(); });
      timer = setTimeout(() => { off(); reject(new T.ToolError('Timed out waiting for the network to finish updating')); }, timeout);
    });
    promise.cancel = () => { clearTimeout(timer); off(); };
    promise.catch(() => {});
    return promise;
  }

  // Sets a setting, and for filter settings waits for the network to update
  async function applySetting(key, value) {
    const old = W()[key];
    if (old === value) return { old, new: value, changed: false };
    if (FILTER_KEYS.includes(key)) {
      const waiter = visibilityWaiter();
      try { S().set(key, value); } catch (e) { waiter.cancel(); throw e; }
      await waiter;
    } else {
      S().set(key, value);
    }
    return { old, new: W()[key], changed: true };
  }

  // Applies {key: value} in order, returning what changed
  async function applyAll(map) {
    const ctl = controls();
    const changes = {}, warnings = [];
    const prepared = Object.entries(map).filter(([, v]) => v !== undefined).map(([k, v]) => {
      const r = coerce(k, v, ctl);
      warnings.push(...r.warnings);
      return [k, r.value];
    });
    for (const [k, v] of prepared) {
      const r = await applySetting(k, v);
      if (r.changed) changes[k] = { old: r.old, new: r.new };
    }
    return { changes, warnings };
  }

  const PRIORITY = ['link-show-nn', 'filtering-epsilon', 'link-sort-variable', 'link-threshold', 'cluster-minimum-size', 'node-timeline-variable'];
  const rank = key => PRIORITY.includes(key) ? PRIORITY.indexOf(key) : /-variable$/.test(key) ? 10 : 20;

  T.define({
    name: 'list_settings',
    title: 'List settings',
    description: 'Lists MicrobeTrace\'s settings (the values behind the global settings dialog and every view\'s controls, stored in session.style.widgets). ' +
      'Each entry has: key, current value, default, type (boolean, number, string, array, object, null), whether it was modified from the default, and, when a control for it exists in the page right now ' +
      '(the global settings always; each view\'s controls only while that view is open), its control type (select, range, number, checkbox, radio, color, text, multiselect), ' +
      'options (select/radio values with labels), min/max/step, a human label and the view it belongs to. Filter by key prefix (e.g. "node-", "link-", "network-", "timeline-"), search text, view, or modified-only. ' +
      'Use get_settings / set_settings to read or change them. Many dedicated tools (set_link_filter, color_nodes, size_nodes...) wrap the common ones.',
    inputSchema: obj(Object.assign({
      prefix: str('Only keys starting with this, e.g. "node-color"'),
      search: str('Only keys, labels or option labels containing this text (case-insensitive)'),
      view: str('Only settings whose control is in this view (e.g. "network", "global settings"), when the view is open'),
      modifiedOnly: bool('Only settings that differ from their default'),
      withControlOnly: bool('Only settings that have a control in the page now')
    }, T.schemas.page)),
    annotations: readOnly,
    execute: async args => {
      const ctl = controls();
      const search = args.search && args.search.toLowerCase();
      let items = allKeys().filter(k => !args.prefix || k.startsWith(args.prefix)).map(k => describeSetting(k, ctl));
      if (args.modifiedOnly) items = items.filter(i => i.modified);
      if (args.withControlOnly) items = items.filter(i => i.control);
      if (args.view) items = items.filter(i => i.view == args.view);
      if (search) items = items.filter(i => i.key.toLowerCase().includes(search) || (i.label || '').toLowerCase().includes(search) ||
        (i.options || []).some(o => (o.label + ' ' + o.value).toLowerCase().includes(search)));
      return T.page(items, { offset: args.offset, limit: args.limit == null ? 200 : args.limit });
    }
  });

  T.define({
    name: 'get_settings',
    title: 'Get settings',
    description: 'Reads the current value (and default, type, control info, as list_settings gives) of specific settings by key. Unknown keys are reported in "unknown".',
    inputSchema: obj({ keys: strList('Setting keys, e.g. ["node-color-variable", "link-threshold"]') }, ['keys']),
    annotations: readOnly,
    execute: async ({ keys }) => {
      const ctl = controls(), known = new Set(allKeys());
      const settings = {}, unknown = [];
      keys.forEach(k => { if (known.has(k)) settings[k] = describeSetting(k, ctl); else unknown.push(k); });
      return { settings, unknown };
    }
  });

  T.define({
    name: 'set_settings',
    title: 'Set settings',
    description: 'Changes one or more settings by key, through MicrobeTrace\'s settings store so views and the page react exactly as if a control had been used. ' +
      'Values are checked against each setting\'s type and, where a control exists, its options (an invalid value fails the whole call with nothing applied); out-of-range numbers are applied with a warning. ' +
      'Unknown keys are skipped with a warning unless allowNew is true. Settings are applied in a sensible order (filter settings first, then variable choices, then the rest), ' +
      'and filter settings (link-threshold, link-sort-variable, link-show-nn, filtering-epsilon, cluster-minimum-size) wait for the network to finish updating. ' +
      'Returns {applied: {key: {old, new}}, unchanged, warnings, counts}. Prefer the dedicated tools for common changes; use list_settings to discover keys.',
    inputSchema: obj({
      values: { type: 'object', description: 'Map of setting key to new value, e.g. {"node-color": "#ff0000", "link-width": 4}', additionalProperties: true },
      allowNew: bool('Create keys that are not existing settings (default false: they are skipped with a warning)')
    }, ['values']),
    execute: async ({ values, allowNew }) => {
      if (!values || typeof values != 'object' || !Object.keys(values).length) fail('values must be an object of {key: value}');
      const known = new Set(allKeys()), warnings = [];
      const map = {};
      Object.keys(values).sort((a, b) => rank(a) - rank(b)).forEach(k => {
        if (known.has(k) || allowNew) map[k] = values[k];
        else warnings.push('Unknown setting ' + JSON.stringify(k) + ' skipped (use list_settings to see keys, or allowNew to create it)');
      });
      const ctl = controls();
      // Check everything before applying anything
      Object.keys(map).forEach(k => { map[k] = coerce(k, map[k], ctl).value; });
      const r = await applyAll(map);
      const unchanged = Object.keys(map).filter(k => !(k in r.changes));
      return { applied: r.changes, unchanged, warnings: warnings.concat(r.warnings), counts: self.session.data.nodes.length ? counts() : null };
    }
  });

  // Filtering -------------------------------------------------------------------

  function linkValueRange(variable, bins) {
    const g = self.session.data.graph;
    let min = Infinity, max = -Infinity, n = 0, infinite = 0;
    // Saturated distances are Infinity (#281): counted, but not part of the range
    g.forEachValue(variable, v => { v = +v; if (isNaN(v)) return; if (!isFinite(v)) { infinite++; return; } n++; if (v < min) min = v; if (v > max) max = v; });
    if (!n) return infinite ? { count: 0, infinite } : { count: 0 };
    const out = { count: n, min, max };
    if (infinite) out.infinite = infinite;
    if (bins > 0 && max > min) {
      const counts = new Array(bins).fill(0), width = (max - min) / bins;
      g.forEachValue(variable, v => { v = +v; if (isFinite(v)) counts[Math.min(bins - 1, Math.floor((v - min) / width))]++; });
      out.histogram = counts.map((count, i) => ({ from: min + i * width, to: min + (i + 1) * width, count }));
    }
    return out;
  }

  function filterState(bins) {
    const w = W(), data = self.session.data;
    const state = {
      linkVariable: w['link-sort-variable'],
      linkThreshold: w['link-threshold'],
      thresholdsByVariable: w['link-thresholds'] || {},
      nearestNeighbors: !!w['link-show-nn'],
      epsilonExponent: w['filtering-epsilon'],
      epsilon: Math.pow(10, w['filtering-epsilon']),
      clusterMinimumSize: w['cluster-minimum-size'],
      timelineVariable: w['node-timeline-variable'],
      counts: counts()
    };
    if (data.nodes.length) {
      state.numericLinkFields = linkFields().filter(linkFieldNumeric).map(f => {
        const metric = self.MT.distanceMetrics[f];
        return metric ? { field: f, label: metric.label, defaultThreshold: metric.threshold, countsSites: !!metric.count } : { field: f };
      });
      state.linkValueRange = data.graph && linkFields().includes(state.linkVariable) ? linkValueRange(state.linkVariable, bins) : null;
      state.largestClusters = data.clusters.slice().sort((a, b) => b.nodes - a.nodes).slice(0, 10)
        .map(c => ({ id: c.id, nodes: c.nodes, links: c.links, visible: c.visible }));
      state.singletons = data.clusters.filter(c => c.nodes == 1).length;
    }
    return state;
  }

  T.define({
    name: 'get_filter_state',
    title: 'Get filter state',
    description: 'Reports how the network is currently filtered: the link filter variable and threshold (and each variable\'s remembered threshold), nearest-neighbor pruning and epsilon, minimum cluster size, ' +
      'the timeline variable, visible/total counts of nodes, links and clusters, the numeric link fields that can be filtered on (with default thresholds of distance metrics), ' +
      'the range of the current variable\'s link values with an optional histogram (useful for choosing a threshold), and the largest clusters. Requires loaded data.',
    inputSchema: obj({ bins: { type: 'integer', minimum: 0, maximum: 200, description: 'Histogram bins for the link values of the filter variable (default 20; 0 for none)' } }),
    annotations: readOnly,
    execute: async ({ bins = 20 }) => { T.requireData(); return filterState(bins); }
  });

  T.define({
    name: 'set_link_filter',
    title: 'Set link filter',
    description: 'Sets how links are filtered, as the Filtering tab of the global settings does: links are visible when the filter variable\'s value is at or below the threshold. ' +
      'All arguments are optional; give any. Changes rerun clustering and visibility and this waits until the network has finished updating. ' +
      'Changing the variable restores that variable\'s last threshold (or its metric\'s default, e.g. TN93 0.015, SNPs 16) unless you also pass threshold. ' +
      'Returns the old/new settings and the new visible counts of nodes, links and clusters. Requires loaded data. Use get_filter_state first to see the variables and value ranges.',
    inputSchema: obj({
      variable: str('Numeric link field to filter on (link-sort-variable), e.g. "tn93", "snps", "distance". See get_filter_state.numericLinkFields'),
      threshold: num('Maximum link value that still counts as a link (link-threshold); must be >= 0', { minimum: 0 }),
      showNearestNeighbors: bool('Prune links to nearest neighbors only (link-show-nn). Computes a minimum spanning tree; may take a while for big networks'),
      epsilon: num('Filtering epsilon exponent (filtering-epsilon): distances within 10^epsilon of each other count as ties when pruning to nearest neighbors. UI range -3..2')
    }),
    execute: async args => {
      T.requireData();
      const map = {};
      if (args.variable !== undefined) {
        const f = checkVariable('link', args.variable, { allowNone: false, what: 'variable' });
        if (!linkFieldNumeric(f)) fail('Link field ' + f + ' is not numeric, so it cannot be filtered on. Numeric fields: ' + linkFields().filter(linkFieldNumeric).join(', '));
        map['link-sort-variable'] = f;
      }
      if (args.threshold !== undefined) {
        if (typeof args.threshold != 'number' || !isFinite(args.threshold) || args.threshold < 0) fail('threshold must be a number >= 0');
        map['link-threshold'] = args.threshold;
      }
      if (args.showNearestNeighbors !== undefined) map['link-show-nn'] = !!args.showNearestNeighbors;
      if (args.epsilon !== undefined) {
        if (typeof args.epsilon != 'number' || !isFinite(args.epsilon)) fail('epsilon must be a number');
        map['filtering-epsilon'] = args.epsilon;
      }
      if (!Object.keys(map).length) fail('Give at least one of variable, threshold, showNearestNeighbors, epsilon (get_filter_state reads the current state)');
      const keys = Object.keys(map).sort((a, b) => rank(a) - rank(b));
      const changes = {};
      for (const k of keys) {
        const r = await applySetting(k, map[k]);
        if (r.changed) changes[k] = { old: r.old, new: r.new };
      }
      // Changing the variable may bring back a different threshold than the old one
      return { changes, state: filterState(0) };
    }
  });

  T.define({
    name: 'set_cluster_minimum_size',
    title: 'Set minimum cluster size',
    description: 'Hides every cluster (connected group of nodes) with fewer nodes than this (cluster-minimum-size; 1 shows everything including singletons, 2 hides singletons). ' +
      'Updates node, link and cluster visibility immediately. Returns the new visible counts. Requires loaded data.',
    inputSchema: obj({ size: { type: 'integer', minimum: 1, description: 'Smallest cluster size to keep visible' } }, ['size']),
    execute: async ({ size }) => {
      T.requireData();
      if (!Number.isInteger(size) || size < 1) fail('size must be an integer >= 1');
      const r = await applySetting('cluster-minimum-size', size);
      return { changed: r.changed, old: r.old, new: size, counts: counts() };
    }
  });

  T.define({
    name: 'reveal_all',
    title: 'Reveal everything',
    description: 'Does what Settings > Filtering > Reveal Everything does: sets the minimum cluster size to 1 and makes every cluster, node and link visible regardless of the cluster-size filter (the link threshold setting is unchanged). Returns the visible counts.',
    inputSchema: obj({}),
    execute: async () => {
      T.requireData();
      const button = document.getElementById('RevealAllTab');
      if (!button) fail('The Reveal Everything control is not available');
      button.click();
      return { counts: counts() };
    }
  });

  // Timeline --------------------------------------------------------------------

  const iso = v => { const d = self.MT.parseDate(v); return d ? d.toISOString() : null; };

  function timelineState() {
    const variable = W()['node-timeline-variable'];
    const state = { variable, active: variable != 'None' };
    if (state.active) {
      state.start = iso(self.session.state.timeStart);
      state.end = iso(self.session.state.timeEnd);
      state.target = iso(self.session.state.timeTarget);
      state.playing = (document.getElementById('timeline-play-button') || {}).textContent == 'Pause';
      state.barVisible = document.getElementById('global-timeline-wrapper').style.display != 'none';
    }
    state.counts = counts();
    return state;
  }

  // Node fields with at least two values that read as dates (not plain numbers)
  const dateFields = () => nodeFields().filter(f => {
    let n = 0;
    for (const d of nodes()) {
      const v = d[f];
      if (typeof v == 'string' && isNaN(+v) && self.MT.parseDate(v) && ++n >= 2) return true;
    }
    return false;
  });

  T.define({
    name: 'set_timeline',
    title: 'Set global timeline',
    description: 'Turns on the global timeline for a node date field and/or moves its handle. The timeline shows the network as of a date: nodes dated after the handle are hidden (undated nodes stay), in every view. ' +
      'Give variable to start the timeline on that field (this shows the timeline bar at the bottom and starts with the handle at the end, showing every node), ' +
      'and date (any date text such as "2020-06-15") or position (0..1 along the timeline) to scrub the handle there. ' +
      'Returns the timeline state (variable, start, end, target, counts). Requires loaded data with a date field.',
    inputSchema: obj({
      variable: str('Node field holding dates to run the timeline on (node-timeline-variable)'),
      date: str('Date to move the handle to, e.g. "2020-06-15"; the network shows nodes dated on or before it'),
      position: num('Alternatively, where to put the handle: 0 is the start, 1 the end', { minimum: 0, maximum: 1 })
    }),
    execute: async ({ variable, date, position }) => {
      T.requireData();
      if (variable === undefined && date === undefined && position === undefined) fail('Give variable, date or position');
      if (variable !== undefined) {
        const f = checkVariable('node', variable, { allowNone: false });
        const dated = nodes().filter(d => self.MT.parseDate(d[f])).length;
        if (dated < 2) fail('Node field ' + f + ' has fewer than two dates. Date-like fields: ' + (dateFields().join(', ') || '(none found)'));
        if (W()['node-timeline-variable'] !== f) S().set('node-timeline-variable', f);
      }
      if (date !== undefined || position !== undefined) {
        if (W()['node-timeline-variable'] == 'None' || !self.MT.scrubTimeline) fail('The timeline is not on. Pass variable (a date field) to start it');
        let when;
        if (date !== undefined) {
          when = self.MT.parseDate(date);
          if (!when) fail('Not a date: ' + JSON.stringify(date));
        } else {
          const a = self.MT.parseDate(self.session.state.timeStart), b = self.MT.parseDate(self.session.state.timeTarget);
          when = new Date(a.getTime() + position * (b.getTime() - a.getTime()));
        }
        self.MT.scrubTimeline(when);
      }
      return timelineState();
    }
  });

  T.define({
    name: 'clear_timeline',
    title: 'Clear global timeline',
    description: 'Turns the global timeline off (node-timeline-variable = None): hides the timeline bar and shows nodes of all dates again. Returns the timeline state.',
    inputSchema: obj({}),
    execute: async () => {
      if (W()['node-timeline-variable'] != 'None') S().set('node-timeline-variable', 'None');
      return timelineState();
    }
  });

  T.define({
    name: 'get_timeline',
    title: 'Get global timeline',
    description: 'Reports the global timeline: the variable (None when off), start/end/target dates (end is where the handle is, target the last date), whether it is playing, and node counts. Also lists the node fields that look like dates.',
    inputSchema: obj({}),
    annotations: readOnly,
    execute: async () => { T.requireData(); return Object.assign(timelineState(), { dateFields: dateFields() }); }
  });

  T.define({
    name: 'control_timeline_playback',
    title: 'Play or pause timeline',
    description: 'Plays or pauses the global timeline animation (the handle advances over the dates, 5 steps per second, restarting from the start once at the end). The timeline must be on (set_timeline with a variable). Returns the timeline state.',
    inputSchema: obj({ action: { type: 'string', enum: ['play', 'pause'] } }, ['action']),
    execute: async ({ action }) => {
      if (W()['node-timeline-variable'] == 'None') fail('The timeline is not on. Use set_timeline with a date field first');
      const button = document.getElementById('timeline-play-button');
      const playing = button.textContent == 'Pause';
      if ((action == 'play') != playing) button.click();
      return timelineState();
    }
  });

  // Selection -------------------------------------------------------------------

  const MODES = ['replace', 'add', 'remove', 'toggle'];

  // Applies a mode to the set of node objects, returning how many nodes changed
  function applySelection(set, mode) {
    let changed = 0;
    nodes().forEach(d => {
      const was = !!d.selected;
      let now = was;
      if (mode == 'replace') now = set.has(d);
      else if (mode == 'add') now = was || set.has(d);
      else if (mode == 'remove') now = was && !set.has(d);
      else if (mode == 'toggle') now = set.has(d) ? !was : was;
      if (now !== was) { d.selected = now; changed++; }
    });
    events().emit('node-selected');
    return changed;
  }

  function selectionSummary(limit = 100, fields) {
    const selected = nodes().filter(d => d.selected);
    return {
      selectedCount: selected.length,
      selectedIds: selected.slice(0, limit).map(d => d._id),
      truncated: selected.length > limit,
      counts: counts()
    };
  }

  const modeSchema = { type: 'string', enum: MODES, description: 'How the result combines with the current selection: replace (default), add, remove or toggle' };

  function resolveNodes({ ids, filter, match, all, visibleOnly }) {
    let candidates = nodes();
    if (visibleOnly) candidates = candidates.filter(d => d.visible);
    if (ids && ids.length) {
      const wanted = new Set(ids.map(String));
      const missing = ids.map(String).filter(id => !self.session.data.nodes.some(d => d._id == id));
      if (missing.length == ids.length) fail('None of those IDs match a node: ' + missing.slice(0, 5).join(', '));
      candidates = candidates.filter(d => wanted.has(String(d._id)));
      var unknown = missing;
    } else if (!filter && !all) {
      fail('Say which nodes: ids, filter (with optional match), or all: true');
    }
    if (filter && filter.length) candidates = T.filter(candidates, filter, match);
    return { set: new Set(candidates), unknown: unknown || [] };
  }

  T.define({
    name: 'select_nodes',
    title: 'Select nodes',
    description: 'Selects (highlights) nodes in every view by ID and/or by a condition on node fields, and emits node-selected. ' +
      'ids and filter combine as an intersection (listed IDs that also meet the filter); all: true selects every node (or, with filter, those meeting it). ' +
      'mode: replace (default; deselect everything else), add, remove, or toggle. visibleOnly limits to nodes currently visible. ' +
      'Filter: array of {field, op, value}, ops eq ne lt lte gt gte in nin contains startsWith endsWith regex empty notEmpty. ' +
      'Returns how many nodes changed, the selected count and the first selected IDs. Requires loaded data. Use get_selection to read, clear_selection to clear.',
    inputSchema: obj({
      ids: strList('Node IDs (_id) to select'),
      filter: T.schemas.filter,
      match: T.schemas.match,
      all: bool('Select all nodes (subject to filter)'),
      visibleOnly: bool('Only consider visible nodes (default false)'),
      mode: modeSchema
    }),
    execute: async args => {
      const { set, unknown } = resolveNodes(args);
      const changed = applySelection(set, args.mode || 'replace');
      return Object.assign({ matched: set.size, changed, unknownIds: unknown }, selectionSummary());
    }
  });

  T.define({
    name: 'clear_selection',
    title: 'Clear selection',
    description: 'Deselects every node (and empties the search box). Returns the selection summary.',
    inputSchema: obj({}),
    execute: async () => {
      const search = document.getElementById('search');
      if (search && search.value) search.value = '';
      applySelection(new Set(), 'replace');
      return selectionSummary();
    }
  });

  T.define({
    name: 'get_selection',
    title: 'Get selection',
    description: 'Returns the currently selected nodes: count, and their IDs (or chosen fields, paged). Selection is shared by all views. Requires loaded data.',
    inputSchema: obj(Object.assign({
      fields: strList('Node fields to return for each selected node; omit for just the _id of each')
    }, T.schemas.page)),
    annotations: readOnly,
    execute: async ({ fields, offset, limit }) => {
      const selected = nodes().filter(d => d.selected);
      const items = fields && fields.length ? selected.map(d => T.pick(d, fields)) : selected.map(d => d._id);
      return T.page(items, { offset, limit });
    }
  });

  T.define({
    name: 'search_nodes',
    title: 'Search nodes',
    description: 'Selects the nodes whose field matches a query, with the same semantics as the search box: the query is a regular expression (unless literal: true), strings are tested with it, numbers match when their text equals the query, nodes with empty values do not match. ' +
      'field defaults to the search box\'s field (search-field). caseSensitive and wholeWord mirror the box\'s toggle buttons. ' +
      'mirrorSearchBox: true instead drives the real search box (setting search-field, case and whole-word settings and its text; replace mode only), so the box shows the query and its suggestions. ' +
      'mode: replace (default), add, remove, toggle. Returns matches and the selection summary. Requires loaded data.',
    inputSchema: obj({
      query: str('Text or regular expression to find'),
      field: str('Node field to search (default: the current search-field)'),
      caseSensitive: bool('Match case (default: the search-case-sensitive setting)'),
      wholeWord: bool('Match whole words only (default: the search-whole-word setting)'),
      literal: bool('Treat the query as plain text rather than a regular expression'),
      mirrorSearchBox: bool('Run it through the visible search box (replace mode)'),
      mode: modeSchema
    }, ['query']),
    execute: async args => {
      T.requireData();
      const w = W();
      const field = args.field !== undefined ? checkVariable('node', args.field, { allowNone: false, what: 'field' }) : w['search-field'];
      const caseSensitive = args.caseSensitive !== undefined ? args.caseSensitive : !!w['search-case-sensitive'];
      const wholeWord = args.wholeWord !== undefined ? args.wholeWord : !!w['search-whole-word'];
      const mode = args.mode || 'replace';
      if (args.mirrorSearchBox) {
        if (mode != 'replace') fail('mirrorSearchBox works in replace mode only');
        const search = document.getElementById('search');
        S().set('search-case-sensitive', caseSensitive);
        S().set('search-whole-word', wholeWord);
        S().set('search-field', field);
        search.value = args.query;
        search.dispatchEvent(new Event('input'));
        return Object.assign({ field, query: args.query, via: 'search box' }, selectionSummary());
      }
      let text = args.query;
      if (args.literal) text = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) text = '\\b' + text + '\\b';
      let re;
      try { re = new RegExp(text, caseSensitive ? '' : 'i'); } catch (e) { fail('Invalid regular expression: ' + args.query + ' (use literal: true for plain text)'); }
      const set = new Set();
      nodes().forEach(d => {
        const v = d[field];
        if (typeof v == 'string') { if (re.test(v)) set.add(d); }
        else if (typeof v == 'number') { if (v + '' == args.query) set.add(d); }
      });
      const changed = applySelection(set, mode);
      return Object.assign({ field, query: args.query, matched: set.size, changed }, selectionSummary());
    }
  });

  T.define({
    name: 'select_neighbors',
    title: 'Select neighbors',
    description: 'Expands a set of nodes to their neighbors along the currently visible links, to a given number of steps, and selects the result. ' +
      'The seed nodes are the given ids, or the currently selected nodes when ids is omitted. includeSeeds (default true) keeps the seeds selected. ' +
      'mode: replace (default), add, remove or toggle. Returns the selection summary and how many nodes lie at each distance. Requires loaded data.',
    inputSchema: obj({
      ids: strList('Seed node IDs (default: the current selection)'),
      depth: { type: 'integer', minimum: 1, maximum: 50, description: 'Steps along links (default 1)' },
      includeSeeds: bool('Keep the seed nodes in the result (default true)'),
      mode: modeSchema
    }),
    execute: async ({ ids, depth = 1, includeSeeds = true, mode = 'replace' }) => {
      const all = nodes(), g = self.session.data.graph;
      const byId = new Map(all.map(d => [String(d._id), d]));
      let seeds;
      if (ids && ids.length) {
        const unknown = ids.filter(id => !byId.has(String(id)));
        if (unknown.length == ids.length) fail('None of those IDs match a node: ' + unknown.slice(0, 5).join(', '));
        seeds = ids.map(id => byId.get(String(id))).filter(Boolean);
      } else {
        seeds = all.filter(d => d.selected);
        if (!seeds.length) fail('No seed nodes: pass ids or select some nodes first');
      }
      const adjacency = new Map();
      const link = (a, b) => { if (!adjacency.has(a)) adjacency.set(a, []); adjacency.get(a).push(b); };
      for (let i = 0; i < g.visibleCount; i++) {
        const e = g.visible[i], s = g.ids[g.source(e)], t = g.ids[g.target(e)];
        link(s, t); link(t, s);
      }
      const distance = new Map(seeds.map(d => [String(d._id), 0]));
      let frontier = seeds.map(d => String(d._id));
      for (let step = 1; step <= depth && frontier.length; step++) {
        const next = [];
        frontier.forEach(id => (adjacency.get(id) || []).forEach(n => {
          if (!distance.has(n)) { distance.set(n, step); next.push(n); }
        }));
        frontier = next;
      }
      const set = new Set();
      distance.forEach((dist, id) => { if ((includeSeeds || dist > 0) && byId.has(id)) set.add(byId.get(id)); });
      const byDistance = {};
      distance.forEach(dist => { byDistance[dist] = (byDistance[dist] || 0) + 1; });
      const changed = applySelection(set, mode);
      return Object.assign({ seeds: seeds.length, reached: set.size, nodesAtDistance: byDistance, changed }, selectionSummary());
    }
  });

  T.define({
    name: 'select_cluster',
    title: 'Select clusters',
    description: 'Selects all nodes of one or more clusters (connected groups under the current link filter), named by cluster number or by nodes in them. ' +
      'mode: replace (default), add, remove or toggle. visibleOnly limits to visible nodes. Returns the selection summary. Requires loaded data.',
    inputSchema: obj({
      clusters: { type: 'array', items: { type: 'integer' }, description: 'Cluster numbers (the cluster field of nodes)' },
      nodeIds: strList('Select the clusters these nodes belong to'),
      visibleOnly: bool('Only visible nodes'),
      mode: modeSchema
    }),
    execute: async ({ clusters, nodeIds, visibleOnly, mode = 'replace' }) => {
      const all = nodes();
      const wanted = new Set(clusters || []);
      (nodeIds || []).forEach(id => { wanted.add(T.nodeById(id).cluster); });
      if (!wanted.size) fail('Give clusters or nodeIds');
      const set = new Set(all.filter(d => wanted.has(d.cluster) && (!visibleOnly || d.visible)));
      const changed = applySelection(set, mode);
      return Object.assign({ clusters: Array.from(wanted), matched: set.size, changed }, selectionSummary());
    }
  });

  // Color tables and legends ----------------------------------------------------

  const KINDS = {
    node: { variable: 'node-color-variable', fields: nodeFields, table: 'nodeColorsTable', keys: 'nodeColorsTableKeys', alphas: 'nodeAlphas', names: 'nodeValueNames',
      colorMap: 'nodeColorMap', alphaMap: 'nodeAlphaMap', palette: 'nodeColors', create: () => self.MT.createNodeColorMap(), single: 'node-color' },
    link: { variable: 'link-color-variable', fields: linkFields, table: 'linkColorsTable', keys: 'linkColorsTableKeys', alphas: 'linkAlphas', names: 'linkValueNames',
      colorMap: 'linkColorMap', alphaMap: 'linkAlphaMap', palette: 'linkColors', create: () => self.MT.createLinkColorMap(), single: 'link-color' }
  };

  function legend(kind) {
    const cfg = KINDS[kind], w = W();
    const variable = w[cfg.variable];
    if (variable == 'None') {
      return {
        kind, variable, singleColor: w[cfg.single],
        opacity: kind == 'link' ? 1 - w['link-opacity'] : 1,
        values: []
      };
    }
    const aggregates = cfg.create();
    const names = self.session.style[cfg.names] || {};
    const total = Object.values(aggregates).reduce((a, b) => a + b, 0);
    const values = Object.keys(aggregates).map(value => ({
      value,
      label: self.MT.valueLabel(value),
      name: names[value] !== undefined ? names[value] : null,
      count: aggregates[value],
      frequency: total ? aggregates[value] / total : 0,
      color: self.temp.style[cfg.colorMap](value),
      opacity: self.temp.style[cfg.alphaMap](value)
    }));
    return { kind, variable, total, valueCount: values.length, values };
  }

  function refreshTable(kind) {
    if (typeof self.MT.showColorTable == 'function') self.MT.showColorTable(kind);
    else events().emit(kind + '-color-change');
  }

  T.define({
    name: 'get_color_legend',
    title: 'Get color legend',
    description: 'Returns the color legend for nodes or links: the field being colored by, and for each value (among visible nodes/links) its count, frequency, color (#rrggbb), opacity (1 opaque) and any custom display name. ' +
      'With no color variable, returns the single color. For nodes it also reports the shape variable and symbols if shapes vary. These are the rows of the floating color table. Requires loaded data.',
    inputSchema: obj(Object.assign({
      kind: { type: 'string', enum: ['node', 'link'], description: 'Whose legend' },
      sortBy: { type: 'string', enum: ['count', 'value', 'table'], description: 'count (default, most first), value, or table (the order of the underlying color table)' }
    }, T.schemas.page), ['kind']),
    annotations: readOnly,
    execute: async ({ kind, sortBy = 'count', offset, limit }) => {
      T.requireData();
      const l = legend(kind);
      if (sortBy == 'count') l.values.sort((a, b) => b.count - a.count);
      else if (sortBy == 'value') l.values.sort((a, b) => T.compare(a.value, b.value));
      const p = T.page(l.values, { offset, limit: limit == null ? 200 : limit });
      const out = Object.assign({}, l, { values: p.items, returned: p.returned, offset: p.offset });
      if (kind == 'node') {
        const sv = W()['node-symbol-variable'];
        out.shapeVariable = sv;
        out.defaultShape = W()['node-symbol'];
        if (sv != 'None' && self.session.style.nodeSymbolsTable[sv]) {
          const keys = self.session.style.nodeSymbolsTableKeys[sv] || [], symbols = self.session.style.nodeSymbolsTable[sv];
          out.shapes = keys.map((value, i) => ({ value: String(value), shape: symbols[i] }));
        }
      }
      const o = self.session.style.overwrite || {};
      if (o[kind + 'ColorHeaderVariable'] == l.variable) out.title = o[kind + 'ColorHeaderTitle'];
      return out;
    }
  });

  function valueColorTool(kind) {
    const cfg = KINDS[kind], Kind = kind == 'node' ? 'node' : 'link';
    return {
      name: 'set_' + kind + '_value_colors',
      title: 'Set ' + Kind + ' value colors',
      description: 'Edits the color table rows for the field ' + Kind + 's are colored by: gives particular values their own color and/or opacity, as editing the floating ' + Kind + ' color table does. ' +
        'values is a list of {value, color?, opacity?}; value is the field value as text as get_color_legend lists it (e.g. "Georgia", "0"). color is #rrggbb or a CSS color name; opacity is 0 (invisible) to 1 (opaque). ' +
        'variable switches the color-by field first (otherwise the current one is used; color the ' + Kind + 's by a field first with color_' + Kind + 's). reset: true restores the palette colors for this field before applying. ' +
        'Notes: colors are kept per field but follow the position of the value in the table, so they can shift if filtering changes which values are visible; opacities are shared by all fields by position. ' +
        'All values are checked before anything is applied. Returns the resulting legend. Requires loaded data.',
      inputSchema: obj({
        variable: str(Kind + ' field to color by (default: the current one)'),
        values: { type: 'array', description: 'Rows to change', items: obj({
          value: { description: 'The value of the field (as text, or a number)' },
          color: str('New color, #rrggbb or a CSS color name'),
          opacity: num('0 to 1; 1 is opaque', { minimum: 0, maximum: 1 })
        }, ['value']) },
        reset: bool('Restore this field\'s palette colors and opacities first')
      }, ['values']),
      execute: async ({ variable, values, reset }) => {
        T.requireData();
        if (variable !== undefined) {
          const v = checkVariable(kind, variable, { allowNone: false });
          if (W()[cfg.variable] !== v) S().set(cfg.variable, v);
        }
        const current = W()[cfg.variable];
        if (current == 'None') fail('The ' + Kind + 's are not colored by a field. Use color_' + Kind + 's with a variable first, or pass variable');
        const style = self.session.style;
        if (reset) {
          delete style[cfg.table][current];
          delete style[cfg.keys][current];
          style[cfg.alphas] = [1];
        }
        cfg.create();
        const keys = style[cfg.keys][current], colors = style[cfg.table][current];
        const errors = [];
        const edits = values.map(({ value, color, opacity }) => {
          const key = String(value);
          const index = keys.findIndex(k => k === key);
          if (index < 0) { errors.push('No row for value ' + JSON.stringify(key)); return null; }
          let hex = null;
          if (color !== undefined) { try { hex = toHex(color); } catch (e) { errors.push(e.message); return null; } }
          if (opacity !== undefined && (typeof opacity != 'number' || opacity < 0 || opacity > 1)) { errors.push('opacity for ' + key + ' must be 0..1'); return null; }
          return { index, hex, opacity };
        });
        if (errors.length) fail(errors.slice(0, 10).join('; ') + (errors.length > 10 ? '; ...' : '') + '. Values available: ' + keys.slice(0, 30).join(', ') + (keys.length > 30 ? ', ...' : ''));
        edits.forEach(({ index, hex, opacity }) => {
          if (hex) colors[index] = hex;
          if (opacity !== undefined) {
            while (style[cfg.alphas].length <= index) style[cfg.alphas].push(1);
            style[cfg.alphas][index] = opacity;
          }
        });
        cfg.create();
        refreshTable(kind);
        return { applied: edits.length, legend: legend(kind) };
      }
    };
  }
  T.define(valueColorTool('node'));
  T.define(valueColorTool('link'));

  T.define({
    name: 'rename_legend_value',
    title: 'Rename legend value',
    description: 'Gives a value a different display name in the node or link color table and legends (as double-clicking a row does; the data is unchanged), or clears the custom name. ' +
      'Can also retitle the table header for the current color variable. Returns the legend. Requires loaded data.',
    inputSchema: obj({
      kind: { type: 'string', enum: ['node', 'link'] },
      value: { description: 'The value whose name to change (as text)' },
      name: str('The display name; empty text or omitted clears the custom name'),
      title: str('New header text for the table\'s name column (for the current color variable)')
    }, ['kind']),
    execute: async ({ kind, value, name, title }) => {
      T.requireData();
      const cfg = KINDS[kind], style = self.session.style;
      if (value === undefined && title === undefined) fail('Give value (with name) and/or title');
      if (value !== undefined) {
        style[cfg.names] = style[cfg.names] || {};
        const key = String(value);
        if (name === undefined || name === '') delete style[cfg.names][key];
        else style[cfg.names][key] = name;
      }
      if (title !== undefined) {
        const variable = W()[cfg.variable];
        if (variable == 'None') fail('There is no color table: color by a field first');
        style.overwrite = style.overwrite || {};
        style.overwrite[kind + 'ColorHeaderVariable'] = variable;
        style.overwrite[kind + 'ColorHeaderTitle'] = title;
      }
      refreshTable(kind);
      return legend(kind);
    }
  });

  // Palettes
  function schemeNames() {
    return Object.keys(self.d3).filter(k => /^scheme/.test(k) && Array.isArray(self.d3[k]) && self.d3[k].length).sort();
  }
  function schemeColors(name, size) {
    const s = self.d3[name];
    if (!Array.isArray(s)) fail('Unknown scheme ' + name + '. See list_palettes');
    if (typeof s[0] == 'string') return s.slice();
    const sizes = s.map((x, i) => x ? i : -1).filter(i => i >= 0);
    const n = size && s[size] ? size : sizes[sizes.length - 1];
    return s[n].slice();
  }

  T.define({
    name: 'list_palettes',
    title: 'List color palettes',
    description: 'Lists the named d3 color schemes usable with set_palette (e.g. schemeCategory10, schemePaired, schemeTableau10, schemeSet1, and sequential/diverging ones like schemeBlues, schemeRdYlBu), with their sizes and sample colors, and the palettes currently in use for nodes and links.',
    inputSchema: obj({}),
    annotations: readOnly,
    execute: async () => ({
      schemes: schemeNames().map(name => {
        const s = self.d3[name];
        return typeof s[0] == 'string' ? { name, colors: s.length, sample: s.slice(0, 6) } :
          { name, sizes: s.map((x, i) => x ? i : -1).filter(i => i >= 0), sample: (s[s.length - 1] || []).slice(0, 6) };
      }),
      current: { nodeColors: self.session.style.nodeColors, linkColors: self.session.style.linkColors }
    })
  });

  T.define({
    name: 'set_palette',
    title: 'Set color palette',
    description: 'Replaces the list of colors assigned, in order, to the values of a color-by field for nodes or links, from a named d3 scheme (see list_palettes) or an explicit list of colors. ' +
      'With apply (default true) the existing color tables (and opacities) are rebuilt from the new palette so the change shows immediately; otherwise it applies only to fields colored for the first time. ' +
      'Returns the palette and the legend. Requires loaded data.',
    inputSchema: obj({
      kind: { type: 'string', enum: ['node', 'link'] },
      scheme: str('d3 scheme name, e.g. "schemeTableau10"'),
      size: { type: 'integer', description: 'For schemes with several sizes (like schemeBlues), the number of colors (default the largest)' },
      colors: strList('Explicit colors (#rrggbb or CSS names), in order, instead of scheme'),
      apply: bool('Rebuild the current color tables from the palette (default true)')
    }, ['kind']),
    execute: async ({ kind, scheme, size, colors, apply = true }) => {
      T.requireData();
      let list;
      if (colors && colors.length) list = colors.map(toHex);
      else if (scheme) list = schemeColors(scheme, size);
      else fail('Give scheme or colors');
      const cfg = KINDS[kind], style = self.session.style;
      style[cfg.palette] = list;
      if (apply) {
        style[cfg.table] = {};
        style[cfg.keys] = {};
        style[cfg.alphas] = [1];
      }
      cfg.create();
      refreshTable(kind);
      return { kind, palette: list, legend: legend(kind) };
    }
  });

  // Node styling ----------------------------------------------------------------

  function result(changes, warnings, extra) {
    return Object.assign({ changes: changes.changes, warnings: changes.warnings.concat(warnings || []) }, extra);
  }

  const SHAPES = () => self.session.style.nodeSymbols.slice();
  const shapeName = s => {
    if (typeof s != 'string') fail('shape must be text');
    const all = SHAPES();
    if (all.includes(s)) return s;
    const t = 'symbol' + s.replace(/[^A-Za-z]/g, '').replace(/^symbol/i, '');
    const found = all.find(x => x.toLowerCase() == t.toLowerCase());
    if (!found) fail('Unknown shape ' + JSON.stringify(s) + '. Shapes: ' + all.join(', '));
    return found;
  };

  T.define({
    name: 'color_nodes',
    title: 'Color nodes',
    description: 'Chooses how nodes are colored: by the values of a node field (variable; each value gets a palette color, shown in the node color table) or, with variable "None", all one color (color, node-color). ' +
      'Both may be given. Applies in every view. Returns the settings changed and the node legend. Requires loaded data. Use set_node_value_colors to recolor particular values, set_palette to change the palette.',
    inputSchema: obj({
      variable: str('Node field to color by, or "None" for a single color'),
      color: str('The single color (#rrggbb or CSS name), used when variable is None')
    }),
    execute: async ({ variable, color }) => {
      T.requireData();
      const map = {};
      if (variable !== undefined) map['node-color-variable'] = checkVariable('node', variable);
      if (color !== undefined) map['node-color'] = toHex(color);
      if (!Object.keys(map).length) fail('Give variable and/or color');
      const r = await applyAll(map);
      return result(r, [], { legend: legend('node') });
    }
  });

  T.define({
    name: 'size_nodes',
    title: 'Size nodes',
    description: 'Sets node size. variable: a numeric node field to scale radius by (node-radius-variable; values map from min to max), or "None" for a fixed size (radius). ' +
      'radius is the fixed size; min and max bound the scaled range. Sizes are in the network view\'s units (default fixed 250, range 250 to 4500; sliders allow 100..5000). Returns the settings changed.',
    inputSchema: obj({
      variable: str('Numeric node field to size by, or "None"'),
      radius: num('Fixed radius when variable is None', { minimum: 1 }),
      min: num('Smallest radius when scaling by a variable', { minimum: 1 }),
      max: num('Largest radius when scaling by a variable', { minimum: 1 })
    }),
    execute: async ({ variable, radius, min, max }) => {
      T.requireData();
      const map = {}, warnings = [];
      if (variable !== undefined) {
        map['node-radius-variable'] = checkVariable('node', variable);
        if (variable != 'None' && !numericNodeField(variable)) warnings.push('Field ' + variable + ' does not look numeric; sizes may not vary');
      }
      if (radius !== undefined) map['node-radius'] = radius;
      if (min !== undefined) map['node-radius-min'] = min;
      if (max !== undefined) map['node-radius-max'] = max;
      if (!Object.keys(map).length) fail('Give variable, radius, min or max');
      const lo = min !== undefined ? min : W()['node-radius-min'], hi = max !== undefined ? max : W()['node-radius-max'];
      if (lo > hi) fail('min (' + lo + ') cannot exceed max (' + hi + ')');
      const r = await applyAll(map);
      return result(r, warnings, { sizing: { variable: W()['node-radius-variable'], radius: W()['node-radius'], min: W()['node-radius-min'], max: W()['node-radius-max'] } });
    }
  });

  T.define({
    name: 'set_node_shape',
    title: 'Set node shape',
    description: 'Sets node shapes in the network view: one shape for all nodes (shape, node-symbol) and/or a different shape for each value of a node field (variable, node-symbol-variable; "None" for one shape). ' +
      'Shapes: ' + 'symbolCircle, symbolCross, symbolDiamond, symbolSquare, symbolStar, symbolTriangle, symbolWye, symbolTriangleDown, symbolTriangleLeft, symbolTriangleRight, symbolDiamondAlt, symbolDiamondSquare, symbolPentagon, symbolHexagon, symbolHexagonAlt, symbolOctagon, symbolOctagonAlt, symbolX ' +
      '(short names like "circle" or "triangleDown" are accepted). Per-value shapes are assigned automatically from the list in order of frequency. Returns the settings changed.',
    inputSchema: obj({
      shape: str('The shape for all nodes (when variable is None), e.g. "symbolSquare" or "square"'),
      variable: str('Node field whose values get different shapes, or "None"')
    }),
    execute: async ({ shape, variable }) => {
      T.requireData();
      const map = {};
      if (variable !== undefined) map['node-symbol-variable'] = checkVariable('node', variable);
      if (shape !== undefined) map['node-symbol'] = shapeName(shape);
      if (!Object.keys(map).length) fail('Give shape and/or variable');
      const r = await applyAll(map);
      return result(r, [], { shape: W()['node-symbol'], variable: W()['node-symbol-variable'] });
    }
  });

  T.define({
    name: 'label_nodes',
    title: 'Label nodes',
    description: 'Shows text labels next to nodes in the network view: variable is the node field to show ("None" hides labels), size the font size (6..72, default 16), orientation where the label sits relative to the node (Right, Left, Top, Bottom, Middle). Returns the settings changed.',
    inputSchema: obj({
      variable: str('Node field to label with, or "None"'),
      size: num('Font size, 6 to 72', { minimum: 1, maximum: 200 }),
      orientation: { type: 'string', enum: ['Right', 'Left', 'Top', 'Bottom', 'Middle'] }
    }),
    execute: async ({ variable, size, orientation }) => {
      T.requireData();
      const map = {};
      if (variable !== undefined) map['node-label-variable'] = checkVariable('node', variable);
      if (size !== undefined) map['node-label-size'] = size;
      if (orientation !== undefined) map['node-label-orientation'] = orientation;
      if (!Object.keys(map).length) fail('Give variable, size or orientation');
      const r = await applyAll(map);
      return result(r, [], { labels: { variable: W()['node-label-variable'], size: W()['node-label-size'], orientation: W()['node-label-orientation'] } });
    }
  });

  T.define({
    name: 'set_node_tooltip',
    title: 'Set node tooltip',
    description: 'Chooses which node fields the network view\'s hover tooltip shows (node-tooltip-variable): up to three node fields, in order. Default is just the ID (_id). Pass an empty list for the default. Returns the new setting.',
    inputSchema: obj({ variables: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Up to 3 node fields' } }, ['variables']),
    execute: async ({ variables }) => {
      T.requireData();
      if (variables.length > 3) fail('At most 3 tooltip fields');
      variables.forEach(v => checkVariable('node', v, { allowNone: false }));
      const list = variables.length ? variables : ['_id'];
      const r = await applySetting('node-tooltip-variable', list);
      return { old: r.old, new: list };
    }
  });

  T.define({
    name: 'set_node_border',
    title: 'Set node border',
    description: 'Sets the node outline: color (node-color-border, default #000000) and width (node-border-width, default 2; 0 for none). Returns the settings changed.',
    inputSchema: obj({ color: str('Border color'), width: num('Border width, >= 0', { minimum: 0 }) }),
    execute: async ({ color, width }) => {
      const map = {};
      if (color !== undefined) map['node-color-border'] = toHex(color);
      if (width !== undefined) map['node-border-width'] = width;
      if (!Object.keys(map).length) fail('Give color and/or width');
      return result(await applyAll(map));
    }
  });

  T.define({
    name: 'set_selected_color',
    title: 'Set selected-node color',
    description: 'Sets the color that marks selected nodes (selected-color, default #ff8300). The contrast color used for text over it follows automatically. Returns the settings.',
    inputSchema: obj({ color: str('Color, #rrggbb or CSS name') }, ['color']),
    execute: async ({ color }) => {
      const r = await applyAll({ 'selected-color': toHex(color) });
      return result(r, [], { color: W()['selected-color'], contrast: W()['selected-color-contrast'] });
    }
  });

  T.define({
    name: 'set_background_color',
    title: 'Set background color',
    description: 'Sets the background color of the views (background-color, default #ffffff). The contrast color for text and gridlines (background-color-contrast) is chosen automatically, black or white. Returns the settings.',
    inputSchema: obj({ color: str('Color, #rrggbb or CSS name') }, ['color']),
    execute: async ({ color }) => {
      const r = await applyAll({ 'background-color': toHex(color) });
      return result(r, [], { color: W()['background-color'], contrast: W()['background-color-contrast'] });
    }
  });

  // Link styling ----------------------------------------------------------------

  T.define({
    name: 'color_links',
    title: 'Color links',
    description: 'Chooses how links are colored: by the values of a link field (variable, e.g. "origin" for the source file, or a categorical field; each value gets a palette color, shown in the link color table) or, with variable "None", all one color (color, link-color). ' +
      'transparency (link-opacity, 0 opaque to 1 invisible) sets how see-through links are when not colored by a field. Returns the settings changed and the link legend. Requires loaded data.',
    inputSchema: obj({
      variable: str('Link field to color by, or "None"'),
      color: str('The single link color, used when variable is None'),
      transparency: num('0 (opaque) to 1 (fully transparent)', { minimum: 0, maximum: 1 })
    }),
    execute: async ({ variable, color, transparency }) => {
      T.requireData();
      const map = {};
      if (variable !== undefined) map['link-color-variable'] = checkVariable('link', variable);
      if (color !== undefined) map['link-color'] = toHex(color);
      if (transparency !== undefined) map['link-opacity'] = transparency;
      if (!Object.keys(map).length) fail('Give variable, color or transparency');
      const r = await applyAll(map);
      return result(r, [], { legend: legend('link') });
    }
  });

  T.define({
    name: 'set_link_width',
    title: 'Set link width',
    description: 'Sets link thickness in the network view: a fixed width (width, default 3), or scaled by a numeric link field (variable; values map from min to max, defaults 3 to 27), "None" for fixed. Widths are 0.3..30 on the sliders. Returns the settings changed.',
    inputSchema: obj({
      variable: str('Numeric link field to scale width by, or "None"'),
      width: num('Fixed width when variable is None', { minimum: 0 }),
      min: num('Thinnest width when scaling', { minimum: 0 }),
      max: num('Thickest width when scaling', { minimum: 0 })
    }),
    execute: async ({ variable, width, min, max }) => {
      T.requireData();
      const map = {}, warnings = [];
      if (variable !== undefined) {
        map['link-width-variable'] = checkVariable('link', variable);
        if (variable != 'None' && !linkFieldNumeric(variable)) warnings.push('Link field ' + variable + ' does not look numeric; widths may not vary');
      }
      if (width !== undefined) map['link-width'] = width;
      if (min !== undefined) map['link-width-min'] = min;
      if (max !== undefined) map['link-width-max'] = max;
      if (!Object.keys(map).length) fail('Give variable, width, min or max');
      const lo = min !== undefined ? min : W()['link-width-min'], hi = max !== undefined ? max : W()['link-width-max'];
      if (lo > hi) fail('min (' + lo + ') cannot exceed max (' + hi + ')');
      const r = await applyAll(map);
      return result(r, warnings, { width: { variable: W()['link-width-variable'], width: W()['link-width'], min: W()['link-width-min'], max: W()['link-width-max'] } });
    }
  });

  T.define({
    name: 'label_links',
    title: 'Label links',
    description: 'Shows a link field as text on links in the network view (link-label-variable); "None" hides link labels. Returns the settings changed.',
    inputSchema: obj({ variable: str('Link field to label with, or "None"') }, ['variable']),
    execute: async ({ variable }) => {
      T.requireData();
      return result(await applyAll({ 'link-label-variable': checkVariable('link', variable) }));
    }
  });

  T.define({
    name: 'set_link_directed',
    title: 'Set link arrows',
    description: 'Shows (true) or hides (false) arrowheads pointing to links\' targets in the network view (link-directed). Returns the settings changed.',
    inputSchema: obj({ directed: bool('Show arrowheads') }, ['directed']),
    execute: async ({ directed }) => result(await applyAll({ 'link-directed': !!directed })),
  });

  T.define({
    name: 'set_link_tooltip',
    title: 'Set link tooltip',
    description: 'Chooses the link field the network view\'s hover tooltip shows for links (link-tooltip-variable); "None" for no tooltip. Returns the settings changed.',
    inputSchema: obj({ variable: str('Link field, or "None"') }, ['variable']),
    execute: async ({ variable }) => {
      T.requireData();
      return result(await applyAll({ 'link-tooltip-variable': checkVariable('link', variable) }));
    }
  });

  // Overview, panels, reset -------------------------------------------------------

  const STYLE_KEYS = {
    nodes: ['node-color-variable', 'node-color', 'node-color-border', 'node-border-width', 'node-radius-variable', 'node-radius', 'node-radius-min', 'node-radius-max',
      'node-symbol-variable', 'node-symbol', 'node-label-variable', 'node-label-size', 'node-label-orientation', 'node-tooltip-variable', 'node-highlight',
      'node-color-table-show', 'node-color-table-counts', 'node-color-table-frequencies', 'node-color-table-name-sort', 'node-color-table-counts-sort',
      'node-symbol-table-show', 'node-symbol-table-counts', 'node-symbol-table-frequencies'],
    links: ['link-color-variable', 'link-color', 'link-opacity', 'link-width-variable', 'link-width', 'link-width-min', 'link-width-max', 'link-label-variable',
      'link-tooltip-variable', 'link-directed', 'link-color-table-show', 'link-color-table-counts', 'link-color-table-frequencies', 'link-color-table-name-sort', 'link-color-table-counts-sort'],
    page: ['selected-color', 'background-color']
  };

  T.define({
    name: 'get_style',
    title: 'Get style',
    description: 'Summarizes the current styling in one call: node and link color variables and colors, sizes, shapes, labels, tooltips, borders, selected and background colors, which floating panels are shown, the palettes, and the node and link legends (compact). Requires loaded data.',
    inputSchema: obj({ legends: bool('Include the color legends (default true)') }),
    annotations: readOnly,
    execute: async ({ legends = true }) => {
      T.requireData();
      const w = W(), out = { settings: {} };
      Object.values(STYLE_KEYS).flat().forEach(k => { out.settings[k] = w[k]; });
      out.panels = { nodeColorTable: !!w['node-color-table-show'], linkColorTable: !!w['link-color-table-show'], nodeSymbolTable: !!w['node-symbol-table-show'], statistics: !!w['network-statistics-show'] };
      out.palettes = { nodeColors: self.session.style.nodeColors, linkColors: self.session.style.linkColors };
      out.shapes = self.session.style.nodeSymbols;
      if (legends) {
        const compact = l => Object.assign({}, l, { values: l.values.slice(0, 50).map(v => ({ value: v.value, name: v.name, count: v.count, color: v.color, opacity: v.opacity })), truncated: l.values.length > 50 });
        out.nodeLegend = compact(legend('node'));
        out.linkLegend = compact(legend('link'));
      }
      return out;
    }
  });

  T.define({
    name: 'show_panels',
    title: 'Show or hide floating panels',
    description: 'Shows or hides the floating panels over the views: the node color table, the link color table (both appear only while coloring by a field), the node shape table (network view) and the network statistics (node, link, cluster counts). ' +
      'Give any of the booleans. Returns which panels are shown.',
    inputSchema: obj({
      nodeColorTable: bool('Show the node color table'),
      linkColorTable: bool('Show the link color table'),
      nodeSymbolTable: bool('Show the node shape table'),
      statistics: bool('Show the network statistics panel')
    }),
    execute: async args => {
      const keys = { nodeColorTable: 'node-color-table-show', linkColorTable: 'link-color-table-show', nodeSymbolTable: 'node-symbol-table-show', statistics: 'network-statistics-show' };
      const map = {};
      Object.keys(keys).forEach(k => { if (args[k] !== undefined) map[keys[k]] = !!args[k]; });
      if (!Object.keys(map).length) fail('Give at least one panel');
      await applyAll(map);
      const w = W();
      const visible = id => { const el = document.getElementById(id); return !!el && el.style.display != 'none' && !el.hidden && getComputedStyle(el).display != 'none'; };
      return {
        settings: Object.fromEntries(Object.values(keys).map(k => [k, !!w[k]])),
        displayed: { nodeColorTable: visible('node-color-table-wrapper'), linkColorTable: visible('link-color-table-wrapper'), statistics: visible('network-statistics-wrapper') }
      };
    }
  });

  T.define({
    name: 'reset_style',
    title: 'Reset style',
    description: 'Resets styling to MicrobeTrace\'s defaults: colors, sizes, shapes, labels, tooltips, borders, floating table options, and (by default) the per-value color tables, opacities, renamed legend values and palettes. ' +
      'scope: nodes, links, page (selected and background colors), or all (default). Does not touch filters, the timeline, layout or data. This discards custom styling. Returns the settings changed.',
    inputSchema: obj({
      scope: { type: 'string', enum: ['all', 'nodes', 'links', 'page'], description: 'What to reset (default all)' },
      clearValueColors: bool('Also reset per-value colors, opacities, names and palettes for the scope (default true)')
    }),
    annotations: { consequentialHint: true },
    execute: async ({ scope = 'all', clearValueColors = true }) => {
      T.requireData();
      const groups = scope == 'all' ? ['nodes', 'links', 'page'] : [scope];
      const defaults = self.MT.defaultWidgets, style = self.session.style, fresh = self.MT.sessionSkeleton().style;
      const keys = groups.flatMap(g => STYLE_KEYS[g]);
      const map = {};
      // Variables first, so the tables go before their colors are put back
      keys.sort((a, b) => (/-variable$/.test(a) ? 0 : 1) - (/-variable$/.test(b) ? 0 : 1)).forEach(k => { map[k] = defaults[k]; });
      const changes = {};
      for (const [k, v] of Object.entries(map)) {
        const r = await applySetting(k, Array.isArray(v) ? v.slice() : v);
        if (r.changed) changes[k] = { old: r.old, new: r.new };
      }
      if (clearValueColors) {
        groups.filter(g => g != 'page').forEach(g => {
          const kind = g == 'nodes' ? 'node' : 'link', cfg = KINDS[kind];
          style[cfg.table] = {};
          style[cfg.keys] = {};
          style[cfg.alphas] = fresh[cfg.alphas].slice();
          style[cfg.names] = {};
          style[cfg.palette] = fresh[cfg.palette].slice();
          if (kind == 'node') { style.nodeSymbolsTable = {}; style.nodeSymbolsTableKeys = {}; }
          style.overwrite = style.overwrite || {};
          delete style.overwrite[kind + 'ColorHeaderVariable'];
          delete style.overwrite[kind + 'ColorHeaderTitle'];
          cfg.create();
          refreshTable(kind);
        });
      }
      return { scope, changes, counts: counts() };
    }
  });

})(typeof self !== 'undefined' ? self : this);
