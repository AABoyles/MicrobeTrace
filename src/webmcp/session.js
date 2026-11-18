(function(self){
  'use strict';

  // WebMCP tools for loading data and managing sessions: adding files and
  // choosing how each is read, the loading options, launching, the demo,
  // opening and saving sessions, stashes, and the sequence audit.
  // (See src/webmcp.js. Files are added through MT.filesView, which the Files
  // view, components/files.html, provides while it is open.)

  const { define, fail, waitFor, nextEvent, requireData } = self.MTWebMCP;

  // Small helpers -----------------------------------------------------------------

  const obj = (properties, required) => Object.assign({ type: 'object', properties }, required ? { required } : {});
  const str = (description, extra) => Object.assign({ type: 'string', description }, extra);
  const bool = (description, def) => ({ type: 'boolean', description, default: def });
  const num = (description, extra) => Object.assign({ type: 'number', description }, extra);
  const timeoutSchema = def => ({ type: 'integer', minimum: 1000, description: 'Milliseconds to wait for the network to finish loading before giving up (default ' + def + ')', default: def });

  const FORMATS = ['link', 'node', 'matrix', 'fasta', 'newick'];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const dataLoaded = () => !!(self.session && self.session.data && self.session.data.nodes.length);

  // An agent's text, quoted and short, for a confirmation message
  const quote = text => JSON.stringify(String(text == null ? '' : text).slice(0, 100));
  const replacing = () => dataLoaded() ? ', replacing the data loaded now' : '';

  function bytesOf(base64) {
    try {
      return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    } catch (e) {
      return fail('contentsBase64 is not valid base64');
    }
  }

  // The Files view, opened if it isn't
  async function filesView() {
    if (!self.MT.filesView) {
      self.MT.launchView('files');
      await waitFor(() => self.MT.filesView, { timeout: 20000, message: 'The Files view did not open' });
    }
    return self.MT.filesView;
  }

  // After a network loads: wait until the Files view has gone and the loading dialog has closed (the app does that a moment later)
  async function settle() {
    const modal = document.getElementById('loading-information-modal');
    await waitFor(() => !self.layout.contentItems.some(i => i.componentType == 'files') && !(modal && modal.classList.contains('show')),
      { timeout: 6000, interval: 100 }).catch(() => {});
  }

  // Runs start() and resolves once the session has loaded (the event is awaited from before it starts)
  async function loading(start, timeout) {
    const loaded = nextEvent('session-loaded', { timeout });
    loaded.catch(() => {});
    try {
      await start();
    } catch (error) {
      throw error;
    }
    await loaded;
    await settle();
  }

  const unique = list => Array.from(new Set(list));

  function summary() {
    const s = self.session, g = s.data.graph;
    const metric = s.style.widgets['default-distance-metric'];
    return {
      loaded: dataLoaded(),
      nodes: s.data.nodes.length,
      links: g ? g.m : 0,
      visibleLinks: g ? g.visibleCount : 0,
      clusters: s.data.clusters.length,
      visibleClusters: s.data.clusters.filter(c => c.visible).length,
      nodeFields: s.data.nodeFields.slice(),
      linkFields: s.data.linkFields.slice(),
      distanceMetric: metric,
      linkThreshold: s.style.widgets['link-threshold'],
      anySequences: !!s.meta.anySequences,
      loadTimeMs: s.meta.loadTime,
      views: self.layout && self.layout.contentItems ? self.layout.contentItems.map(i => i.componentType) : [],
      messages: (s.messages || []).slice()
    };
  }

  // Fields -------------------------------------------------------------------------

  const fieldProps = {
    source: str('Link files: the column holding each link\'s source node ID (default: a column named source, else the first column)'),
    target: str('Link files: the column holding each link\'s target node ID (default: a column named target, else the second column)'),
    distance: str('Link files: the column holding each link\'s distance, or "None". It is stored under the distance metric (see get_loading_options). Default: a column named distance/length/the metric, else None'),
    id: str('Node files: the column holding each node\'s ID (default: a column named id, else the first column)'),
    sequence: str('Node files: the column holding each node\'s sequence, or "None" (default: a column named sequence/seq, else None)')
  };

  // Resolves one column name against a file's headers (ignoring case), or fails naming the headers
  function column(name, headers, role, allowNone) {
    if (name === undefined || name === null) return undefined;
    if (name === 'None' || name === '') {
      if (!allowNone) fail('The ' + role + ' column can\'t be None. Columns in this file: ' + JSON.stringify(headers));
      return 'None';
    }
    const exact = headers.find(h => h === name) || headers.find(h => h.toLowerCase() == String(name).toLowerCase());
    if (!exact) fail('This file has no column named ' + JSON.stringify(name) + ' (for ' + role + '). Columns in this file: ' + JSON.stringify(headers));
    return exact;
  }

  // {field1, field2, field3} for the arguments given, validated against the file
  function fieldsFor(args, format, headers) {
    const given = ['source', 'target', 'distance', 'id', 'sequence'].filter(k => args[k] !== undefined);
    if (!given.length) return {};
    if (format == 'link') {
      const wrong = ['id', 'sequence'].filter(k => args[k] !== undefined);
      if (wrong.length) fail('A link file takes source, target and distance, not ' + wrong.join(' or '));
      return {
        field1: column(args.source, headers, 'source', false),
        field2: column(args.target, headers, 'target', false),
        field3: column(args.distance, headers, 'distance', true)
      };
    }
    if (format == 'node') {
      const wrong = ['source', 'target', 'distance'].filter(k => args[k] !== undefined);
      if (wrong.length) fail('A node file takes id and sequence, not ' + wrong.join(' or '));
      return {
        field1: column(args.id, headers, 'id', false),
        field2: column(args.sequence, headers, 'sequence', true)
      };
    }
    return fail('Column choices only apply to link and node files; this file is read as ' + format);
  }

  const withoutUndefined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  const pending = view => ({
    pendingFiles: view.list(),
    canLaunch: view.canLaunch(),
    problems: view.problems(),
    hint: 'Use launch to build the network once no file has a problem.'
  });

  // Opens a session or HIV-TRACE/GHOST JSON, from text and an extension
  function openJSON(text, extension) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      fail('That is not valid JSON, so it is not a MicrobeTrace session (.microbetrace) or HIV-TRACE output (.hivtrace): ' + error.message);
    }
    if (!extension || extension == 'auto' || extension == 'json') {
      extension = data && data.data && data.style ? 'microbetrace' : data && (data.trace_results || data.samples) ? 'hivtrace' : '';
      if (!extension) fail('Could not tell what kind of file this is. A MicrobeTrace session has "data" and "style"; HIV-TRACE output has "trace_results". Set extension to microbetrace or hivtrace.');
    }
    if (extension == 'microbetrace' && !(data && data.data && data.data.nodes && data.style)) fail('That JSON is not a MicrobeTrace session (it needs "data" with nodes, and "style").');
    if (extension != 'microbetrace' && !(data && (data.trace_results || data.samples))) fail('That JSON is not HIV-TRACE (trace_results) or GHOST (samples) output.');
    self.MT.processJSON(text, extension);
  }

  // The session JSON inside a zip, as {text, extension}
  async function sessionInZip(bytes) {
    let zip;
    try {
      zip = await new self.JSZip().loadAsync(bytes);
    } catch (error) {
      fail('Could not read that as a zip file: ' + error.message);
    }
    const entries = [];
    zip.forEach((path, entry) => { if (!entry.dir) entries.push(entry); });
    const found = entries.find(e => /\.(microbetrace|hivtrace)$/i.test(e.name));
    if (!found) fail('The zip has no .microbetrace or .hivtrace file (it has: ' + entries.map(e => e.name).join(', ') + '). Add data files to the Files view one at a time with add_file.');
    return { text: await found.async('string'), extension: found.name.split('.').pop().toLowerCase() };
  }

  // Files ----------------------------------------------------------------------------

  define({
    name: 'add_file',
    title: 'Add a data file',
    description: 'Adds a data file to the Files view\'s pending list, to be read when you call launch. ' +
      'Give the file\'s text as contents (CSV, FASTA, Newick) or, for binary files (.xlsx, .xls, .zip, or any), as contentsBase64. ' +
      'format says how to read it: link (an edge list with source/target/distance columns), node (a node list with an ID column and optionally a sequence column and any attributes), matrix (a distance matrix), fasta (sequences; links are computed from them), newick (a tree), or auto (default: guessed from the name: *.fas*/*.fasta -> fasta, *.nwk/*.newick -> newick, a name containing "node" -> node, else link). ' +
      'For link and node files, choose columns with source/target/distance or id/sequence (matched to the file\'s headers, ignoring case); unspecified columns are guessed from the headers. ' +
      'An invalid column name is an error that lists the headers. ' +
      'Files named .microbetrace, .hivtrace, or a .zip containing one, are sessions: they open immediately (replacing the current data) instead of being added; same as open_session. ' +
      'Where several files disagree about a node, the file nearest the top of the list wins (see reorder_pending_files). ' +
      'Returns the pending files with their detected headers and any problems that would block launch. Opens the Files view if it is not open.',
    inputSchema: obj(Object.assign({
      name: str('The file name, including its extension (e.g. "links.csv"). Must be unique among pending files unless replace is true'),
      contents: str('The file\'s text'),
      contentsBase64: str('The file\'s bytes, base64-encoded (use for .xlsx/.xls/.zip)'),
      format: { type: 'string', enum: ['auto'].concat(FORMATS), default: 'auto', description: 'How to read the file' },
      replace: bool('Replace a pending file of the same name instead of failing', false)
    }, fieldProps), ['name']),
    // It brings the agent's content into the page (and a session opens at once)
    confirm: args => !String(args.name || '').trim() ? fail('name is required') :
      /\.(microbetrace|hivtrace|zip)$/i.test(String(args.name).trim()) ?
      'Open the session file ' + quote(args.name) + ', which the agent supplies' + replacing() + '.' :
      'Add the file ' + quote(args.name) + ', which the agent supplies, to the files to load.',
    execute: async (args) => {
      const name = String(args.name || '').trim();
      if (!name) fail('name is required');
      if (args.contents === undefined && args.contentsBase64 === undefined) fail('Give the file\'s text as contents, or its bytes as contentsBase64');
      const extension = name.split('.').pop().toLowerCase();
      if (extension == 'microbetrace' || extension == 'hivtrace' || extension == 'zip') {
        let text = args.contents, ext = extension;
        if (extension == 'zip') {
          if (args.contentsBase64 === undefined) fail('A zip file must be given as contentsBase64');
          ({ text, extension: ext } = await sessionInZip(bytesOf(args.contentsBase64)));
        } else if (text === undefined) {
          text = new TextDecoder().decode(bytesOf(args.contentsBase64));
        }
        await loading(() => openJSON(text, ext), 300000);
        return Object.assign({ opened: 'session', name }, summary());
      }
      if (extension == 'svg') fail('SVG files are not data files; they are not supported here');
      const binary = extension == 'xlsx' || extension == 'xls';
      let contents;
      if (args.contentsBase64 !== undefined) {
        const bytes = bytesOf(args.contentsBase64);
        contents = binary ? bytes.buffer : new TextDecoder().decode(bytes);
      } else {
        if (binary) fail('Excel files must be given as contentsBase64');
        contents = args.contents;
      }
      const view = await filesView();
      // The view stores names escaped (view.add escapes the raw name it is given), so the
      // duplicate check compares escaped names. Pass the raw name to view.add, not safeName.
      const safeName = self.MT.escape(name);
      const existing = self.session.files.find(f => f.name == safeName);
      if (existing) {
        if (!args.replace) fail('A file named ' + name + ' is already added. Use replace: true, or remove_pending_file first.');
        view.remove(safeName);
      }
      const format = args.format && args.format != 'auto' ? args.format : undefined;
      const added = view.add({ name, contents, extension, format });
      try {
        const fields = fieldsFor(args, added.format, added.headers);
        if (Object.keys(fields).length) view.update(added.name, withoutUndefined(fields));
      } catch (error) {
        view.remove(added.name);
        throw error;
      }
      return Object.assign({ added: view.list().find(f => f.name == added.name) }, pending(view));
    }
  });

  define({
    name: 'list_pending_files',
    title: 'List pending files',
    description: 'Lists the files that will be read by launch (or that were read to build the loaded network): name, extension, format (link/node/matrix/fasta/newick), the columns chosen (field1/field2/field3: source/target/distance for links, id/sequence for nodes), the file\'s headers, and any problem that blocks launching it. Order matters: where files disagree about a node, the first wins. Opens the Files view only if it is already open; otherwise lists what the session holds.',
    inputSchema: obj({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      const view = self.MT.filesView;
      if (view) return Object.assign({ filesViewOpen: true }, pending(view));
      return {
        filesViewOpen: false,
        pendingFiles: (self.session ? self.session.files : []).map(f => ({ name: f.name, extension: f.extension, format: f.format, field1: f.field1, field2: f.field2, field3: f.field3 })),
        note: 'The Files view is closed (a network is loaded), so headers and problems are not shown. add_file opens it.'
      };
    }
  });

  define({
    name: 'update_pending_file',
    title: 'Change how a pending file is read',
    description: 'Changes a pending file\'s format (link/node/matrix/fasta/newick) and/or its column choices. Changing the format re-guesses the columns, then any columns you give are applied. Columns are checked against the file\'s headers (an error lists them). Returns the pending files.',
    inputSchema: obj(Object.assign({
      name: str('The pending file\'s name'),
      format: { type: 'string', enum: FORMATS, description: 'How to read the file' }
    }, fieldProps), ['name']),
    execute: async (args) => {
      const view = await filesView();
      const file = view.list().find(f => f.name == self.MT.escape(args.name));
      if (!file) fail('No pending file is named ' + args.name + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
      const format = args.format || file.format;
      const fields = fieldsFor(args, format, file.headers);
      view.update(file.name, Object.assign({ format: args.format }, withoutUndefined(fields)));
      return Object.assign({ updated: view.list().find(f => f.name == file.name) }, pending(view));
    }
  });

  define({
    name: 'remove_pending_file',
    title: 'Remove a pending file',
    description: 'Removes a file from the Files view\'s pending list (it will not be read at launch). Returns the remaining pending files.',
    inputSchema: obj({ name: str('The pending file\'s name') }, ['name']),
    annotations: { consequentialHint: true },
    execute: async (args) => {
      const view = await filesView();
      if (!view.remove(self.MT.escape(args.name))) fail('No pending file is named ' + args.name + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
      return pending(view);
    }
  });

  define({
    name: 'reorder_pending_files',
    title: 'Reorder pending files',
    description: 'Sets the order of the pending files: those named come first, in the order given, and the rest follow as they were. Where files disagree about a node\'s value, the file nearest the top wins. Returns the pending files in their new order.',
    inputSchema: obj({ order: { type: 'array', items: { type: 'string' }, description: 'File names, highest priority first' } }, ['order']),
    execute: async (args) => {
      const view = await filesView();
      const names = args.order.map(n => self.MT.escape(n));
      const missing = names.filter(n => !view.list().some(f => f.name == n));
      if (missing.length) fail('No pending file is named ' + missing.join(', ') + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
      view.reorder(names);
      return pending(view);
    }
  });

  // Loading options ----------------------------------------------------------------------

  const STRATEGIES = {
    AVERAGE: 'Average the possibilities of ambiguous bases',
    RESOLVE: 'Resolve ambiguous bases to the closest match',
    SKIP: 'Skip sites with ambiguous bases',
    GAPMM: 'TN93 only: gaps as mismatches (slower engine)',
    'HIVTRACE-G': 'HIV-TRACE -g: resolve ambiguities only up to the ambiguity threshold'
  };
  const LINK_STORAGE = ['auto', 'all', 'threshold'];

  const metricsInfo = () => Object.keys(self.MT.distanceMetrics).map(k => {
    const m = self.MT.distanceMetrics[k];
    return { id: k, label: m.label, defaultThreshold: m.threshold, countsSites: !!m.count };
  });

  const viewNames = () => {
    const names = ['network', 'bubbles', 'table'];
    return unique(names.concat(self.MT.views ? Object.keys(self.MT.views).filter(v => v != 'files') : []));
  };

  function readOptions() {
    const w = self.session.style.widgets;
    const referenceSource = ['file', 'first', 'consensus'].find(s => w['reference-source-' + s]) || 'file';
    const view = self.MT.filesView;
    return {
      distanceMetric: w['default-distance-metric'],
      distanceMetricsAlso: w['distance-metrics-also'] || [],
      linkThreshold: w['link-threshold'],
      ambiguityStrategy: w['ambiguity-resolution-strategy'],
      ambiguityThreshold: w['ambiguity-threshold'],
      linkStorage: w['link-storage'] || 'auto',
      defaultView: w['default-view'],
      inferDirectionality: !w['infer-directionality-false'],
      alignment: w['align-sw'] ? 'smith-waterman' : 'none',
      referenceSource,
      aligner: view ? view.aligner() : '(open the Files view to read the alignment scores: add_file opens it)',
      referenceSequenceLength: self.session.data.reference ? self.session.data.reference.length : 0
    };
  }

  define({
    name: 'get_loading_options',
    title: 'Get loading options',
    description: 'Reads the settings that control how files are turned into a network (the Files view\'s settings), with the valid values for each. They apply the next time launch runs. ' +
      'distanceMetric: which genetic distance builds links from sequences (also the name distances in link files are stored under); distanceMetricsAlso: other metrics to compute too; linkThreshold: the largest distance that counts as linked (each metric has its own default); ' +
      'ambiguityStrategy / ambiguityThreshold: how ambiguous bases (N, R, Y...) are handled; linkStorage: keep every pair\'s distance or only links within the threshold (auto decides by size); defaultView: the view shown after launch; inferDirectionality; ' +
      'alignment (none or smith-waterman) with referenceSource (file: a reference sequence, first: the first sequence, consensus) and aligner scores. Use set_loading_options to change them.',
    inputSchema: obj({}),
    annotations: { readOnlyHint: true },
    execute: async () => ({
      options: readOptions(),
      valid: {
        distanceMetric: metricsInfo(),
        ambiguityStrategy: STRATEGIES,
        linkStorage: { auto: 'Decide by network size', all: 'Keep all pairs (more memory; threshold can be raised later)', threshold: 'Only links within the link threshold (less memory)' },
        defaultView: viewNames(),
        alignment: ['none', 'smith-waterman'],
        referenceSource: ['file', 'first', 'consensus']
      },
      note: 'These apply to the next launch; they do not recompute a loaded network. For filtering a loaded network use the settings tools.'
    })
  });

  define({
    name: 'set_loading_options',
    title: 'Set loading options',
    description: 'Changes the settings that control how files become a network (see get_loading_options for what each means and its valid values). Only the options you pass change. They apply to the next launch. ' +
      'Changing distanceMetric also resets linkThreshold to that metric\'s default (pass linkThreshold too to override it); GAPMM ambiguity handling needs the tn93 metric. ' +
      'referenceSequence (a nucleotide string) or referencePreset (pol = HXB2 pol region, complete = full HXB2) sets the alignment reference used with referenceSource "file". ' +
      'Returns the options as set.',
    inputSchema: obj({
      distanceMetric: { type: 'string', enum: Object.keys((self.MT && self.MT.distanceMetrics) || { tn93: 1, tn92: 1, k2p: 1, jc69: 1, snps: 1, hamming: 1, p_distance: 1, transitions: 1, transversions: 1, ts_tv_ratio: 1 }), description: 'The genetic distance metric' },
      distanceMetricsAlso: { type: 'array', items: { type: 'string' }, description: 'Other metric ids to compute as well (not the distance metric itself). Ignored by GAPMM' },
      linkThreshold: num('Largest distance considered a link', { minimum: 0 }),
      ambiguityStrategy: { type: 'string', enum: Object.keys(STRATEGIES), description: 'How ambiguous bases are handled' },
      ambiguityThreshold: num('For HIVTRACE-G: the largest distance at which ambiguities are resolved', { minimum: 0 }),
      linkStorage: { type: 'string', enum: LINK_STORAGE, description: 'Which pairs become links' },
      defaultView: str('The view shown after launch (e.g. network, bubbles, table)'),
      inferDirectionality: bool('Try to infer link directions (experimental)'),
      alignment: { type: 'string', enum: ['none', 'smith-waterman'], description: 'Whether to align sequences (Smith-Waterman) before computing distances' },
      referenceSource: { type: 'string', enum: ['file', 'first', 'consensus'], description: 'What sequences are aligned against' },
      referencePreset: { type: 'string', enum: ['pol', 'complete'], description: 'Use HXB2\'s pol region or complete genome as the reference' },
      referenceSequence: str('A nucleotide sequence to use as the reference'),
      aligner: obj({
        match: num('Reward for matching bases', { minimum: 0 }),
        mismatch: num('Cost of a mismatch', { minimum: 0 }),
        gapOpen: num('Cost of opening a gap', { minimum: 0 }),
        gapExtend: num('Cost of extending a gap', { minimum: 0 })
      })
    }),
    execute: async (args) => {
      const MT = self.MT, settings = MT.settings, widgets = self.session.style.widgets;
      const metrics = MT.distanceMetrics;
      if (args.distanceMetric !== undefined && !metrics[args.distanceMetric]) fail('Unknown distance metric ' + JSON.stringify(args.distanceMetric) + '. Use one of ' + Object.keys(metrics).join(', '));
      if (args.ambiguityStrategy !== undefined && !STRATEGIES[args.ambiguityStrategy]) fail('Unknown ambiguityStrategy. Use one of ' + Object.keys(STRATEGIES).join(', '));
      if (args.linkStorage !== undefined && !LINK_STORAGE.includes(args.linkStorage)) fail('linkStorage must be one of ' + LINK_STORAGE.join(', '));
      if (args.defaultView !== undefined && !viewNames().includes(MT.viewName(args.defaultView))) fail('Unknown view ' + JSON.stringify(args.defaultView) + '. Use one of ' + viewNames().join(', '));
      const metric = args.distanceMetric || widgets['default-distance-metric'];
      const strategy = args.ambiguityStrategy || widgets['ambiguity-resolution-strategy'];
      if (strategy == 'GAPMM' && metric != 'tn93') fail('GAPMM ambiguity handling works only with the tn93 metric');
      if (args.distanceMetricsAlso !== undefined) {
        const bad = args.distanceMetricsAlso.filter(m => !metrics[m]);
        if (bad.length) fail('Unknown metrics in distanceMetricsAlso: ' + bad.join(', '));
      }
      const view = MT.filesView;
      const idle = !view && !dataLoaded(); // no view to react to settings: do what it would

      if (args.distanceMetric !== undefined) {
        settings.set('default-distance-metric', metric);
        // (As the Files view does: the metric brings its own threshold)
        if (idle) {
          settings.set('link-sort-variable', metric);
          settings.set('link-threshold', metrics[metric].threshold);
          if (metric != 'tn93' && widgets['ambiguity-resolution-strategy'] == 'GAPMM') settings.set('ambiguity-resolution-strategy', 'AVERAGE');
        }
        self.db.setItem('default-distance-metric', metric);
      }
      if (args.ambiguityStrategy !== undefined) settings.set('ambiguity-resolution-strategy', args.ambiguityStrategy);
      if (args.linkThreshold !== undefined) settings.set('link-threshold', args.linkThreshold);
      if (args.ambiguityThreshold !== undefined) settings.set('ambiguity-threshold', args.ambiguityThreshold);
      if (args.linkStorage !== undefined) settings.set('link-storage', args.linkStorage);
      if (args.defaultView !== undefined) {
        const v = MT.viewName(args.defaultView);
        settings.set('default-view', v);
        self.db.setItem('default-view', v);
        if (idle && self.session.layout.content && self.session.layout.content[0]) self.session.layout.content[0].type = v;
      }
      if (args.inferDirectionality !== undefined) settings.set('infer-directionality-false', !args.inferDirectionality);
      if (args.alignment !== undefined) {
        settings.set('align-sw', args.alignment == 'smith-waterman');
        settings.set('align-none', args.alignment != 'smith-waterman');
      }
      if (args.referenceSource !== undefined) ['file', 'first', 'consensus'].forEach(s => settings.set('reference-source-' + s, s == args.referenceSource));
      if (args.referencePreset !== undefined) {
        const hxb2 = MT.HXB2;
        if (!hxb2) fail('The HXB2 reference is not available');
        self.session.data.reference = args.referencePreset == 'pol' ? hxb2.substr(2000, 2100) : hxb2;
      }
      if (args.referenceSequence !== undefined) {
        const seq = String(args.referenceSequence).replace(/\s+/g, '').toUpperCase();
        if (!/^[ACGTURYMKWSBDHVN-]+$/.test(seq)) fail('referenceSequence must be nucleotides (ACGT and ambiguity codes)');
        self.session.data.reference = seq;
      }
      if (args.distanceMetricsAlso !== undefined) {
        const also = unique(args.distanceMetricsAlso.filter(m => m != metric));
        settings.set('distance-metrics-also', also);
        self.db.setItem('distance-metrics-also', also);
      }
      if (args.aligner) {
        if (view) view.aligner(args.aligner);
        else fail('The alignment scores are set in the Files view; call add_file (which opens it) first, then set aligner');
      }
      if (view) view.refresh();
      return readOptions();
    }
  });

  // Launching --------------------------------------------------------------------------------

  define({
    name: 'launch',
    title: 'Launch the network',
    description: 'Reads the pending files (add_file) with the current loading options (set_loading_options) and builds the network: parses the files, computes links from sequences if there are any, finds clusters, and opens the default view. ' +
      'Waits until the network has loaded (up to timeoutMs), then returns a summary: node, link and cluster counts, node and link fields, the open views, and the loading log messages. ' +
      'Fails if there are no files or a file has a problem (the error says which and how to fix it; see list_pending_files). Large sequence sets can take minutes.',
    inputSchema: obj({ timeoutMs: timeoutSchema(300000) }),
    annotations: { consequentialHint: true },
    confirm: () => dataLoaded() ? 'Build a new network from the files waiting to load, replacing the network loaded now.' : null,
    execute: async (args) => {
      if (!self.session.files.length) fail('There are no files to launch. Add some with add_file (or use load_demo / generate_sequences / open_session).');
      const view = await filesView();
      const problems = view.problems();
      if (problems.length) fail('Fix these files before launching: ' + problems.map(p => p.name + ': ' + p.problem).join(' | ') + '. Use update_pending_file to choose columns or a format.');
      await loading(async () => {
        if (!(await view.launch())) fail('Launch is not available: ' + (view.problems().map(p => p.name + ': ' + p.problem).join(' | ') || 'no files'));
      }, args.timeoutMs || 300000);
      return summary();
    }
  });

  const DEMO_FILES = {
    edgeList: ['Demo_outbreak_EdgeList.csv', 'link'],
    nodeList: ['Demo_outbreak_NodeList.csv', 'node'],
    sequences: ['Demo_outbreak_Sequences.fas', 'fasta'],
    distanceMatrix: ['Demo_outbreak_DistanceMatrix.csv', 'matrix'],
    tree: ['Demo_outbreak_PhylogeneticTree.nwk', 'newick']
  };

  define({
    name: 'load_demo',
    title: 'Load the demo outbreak',
    description: 'Loads MicrobeTrace\'s demo outbreak (an HIV-like outbreak of about 100 nodes), replacing any current data. ' +
      'source "session" (default) opens the finished demo session (demo/Demo_outbreak_session.microbetrace), as the #demo link does. ' +
      'source "files" adds the demo\'s raw files instead (choose with files: edgeList, nodeList, sequences, distanceMatrix, tree; default edgeList + nodeList) and, unless launch is false, launches them so you can try the loading options. ' +
      'Waits for the network to load and returns the summary.',
    inputSchema: obj({
      source: { type: 'string', enum: ['session', 'files'], default: 'session' },
      files: { type: 'array', items: { type: 'string', enum: Object.keys(DEMO_FILES) }, description: 'For source "files": which demo files to add (default edgeList and nodeList)' },
      launch: bool('For source "files": launch after adding them', true),
      timeoutMs: timeoutSchema(300000)
    }),
    annotations: { consequentialHint: true },
    confirm: () => dataLoaded() || self.session.files.length ? 'Load the demo outbreak, replacing the current data and files.' : null,
    execute: async (args) => {
      const source = args.source || 'session';
      const timeout = args.timeoutMs || 300000;
      if (source == 'session') {
        const response = await fetch('demo/Demo_outbreak_session.microbetrace');
        if (!response.ok) fail('Could not fetch the demo session (HTTP ' + response.status + ')');
        const session = await response.json();
        await loading(() => self.MT.applySession(session), timeout);
        return summary();
      }
      const keys = args.files && args.files.length ? args.files : ['edgeList', 'nodeList'];
      const bad = keys.filter(k => !DEMO_FILES[k]);
      if (bad.length) fail('Unknown demo files ' + bad.join(', ') + '. Use ' + Object.keys(DEMO_FILES).join(', '));
      const texts = await Promise.all(keys.map(async k => {
        const response = await fetch('demo/' + DEMO_FILES[k][0]);
        if (!response.ok) fail('Could not fetch demo/' + DEMO_FILES[k][0]);
        return response.text();
      }));
      if (dataLoaded() || self.session.files.length) self.MT.reset();
      const view = await filesView();
      keys.forEach((k, i) => view.add({ name: DEMO_FILES[k][0], contents: texts[i], format: DEMO_FILES[k][1] }));
      if (args.launch === false) return pending(view);
      await loading(() => view.launch(), timeout);
      return summary();
    }
  });

  define({
    name: 'generate_sequences',
    title: 'Generate random sequences',
    description: 'Adds a node file of randomly generated, related sequences (as the Files view\'s Generate button does) as generatedNodes.csv (replacing a previous one), useful for trying MicrobeTrace without data. Link distances are then computed from the sequences at launch. ' +
      'With launch true, launches immediately and returns the network summary; otherwise returns the pending files.',
    inputSchema: obj({
      count: { type: 'integer', minimum: 1, maximum: 2000, default: 100, description: 'How many sequences to generate' },
      launch: bool('Launch right after adding', false),
      timeoutMs: timeoutSchema(300000)
    }),
    annotations: { consequentialHint: true },
    confirm: args => args.launch && dataLoaded() ? 'Generate random sequences and launch them, replacing the network loaded now.' : null,
    execute: async (args) => {
      const view = await filesView();
      view.remove('generatedNodes.csv');
      view.generate(args.count || 100);
      if (!args.launch) return pending(view);
      const problems = view.problems();
      if (problems.length) fail('Fix these files before launching: ' + problems.map(p => p.name + ': ' + p.problem).join(' | '));
      await loading(() => view.launch(), args.timeoutMs || 300000);
      return summary();
    }
  });

  // Sessions ------------------------------------------------------------------------------------

  define({
    name: 'open_session',
    title: 'Open a session file',
    description: 'Opens a saved session, replacing the current data: a MicrobeTrace session (.microbetrace JSON), an HIV-TRACE output (.hivtrace/.json with trace_results) or a GHOST output, given as text in contents, or a zip containing one as contentsBase64. extension (microbetrace, hivtrace, zip) is guessed from the content when auto. ' +
      'Waits for the network to load and returns the summary. For a .microbetracestyle file use apply_style.',
    inputSchema: obj({
      contents: str('The file\'s JSON text'),
      contentsBase64: str('The file\'s bytes, base64-encoded (for a zip)'),
      extension: { type: 'string', enum: ['auto', 'microbetrace', 'hivtrace', 'zip'], default: 'auto' },
      timeoutMs: timeoutSchema(300000)
    }),
    annotations: { consequentialHint: true },
    confirm: () => 'Open a session file, which the agent supplies' + replacing() + '.',
    execute: async (args) => {
      if (args.contents === undefined && args.contentsBase64 === undefined) fail('Give the session as contents (JSON text) or contentsBase64 (a zip)');
      let text = args.contents, extension = args.extension || 'auto';
      if (args.contentsBase64 !== undefined) {
        const bytes = bytesOf(args.contentsBase64);
        if (extension == 'zip' || (extension == 'auto' && bytes[0] == 0x50 && bytes[1] == 0x4b)) ({ text, extension } = await sessionInZip(bytes));
        else text = new TextDecoder().decode(bytes);
      } else if (extension == 'zip') {
        fail('A zip must be given as contentsBase64');
      }
      await loading(() => openJSON(text, extension), args.timeoutMs || 300000);
      return summary();
    }
  });

  define({
    name: 'apply_style',
    title: 'Apply a style file',
    description: 'Applies a .microbetracestyle (the style part of a session: colors, view settings, widget values) to the current session and to the views that are open. Give it as JSON text in contents, or as an object in style. A style is what save_session with format microbetracestyle produces. Returns the number of settings in it.',
    inputSchema: obj({
      contents: str('The style file\'s JSON text'),
      style: { type: 'object', description: 'The style as an object (alternatively to contents)' }
    }),
    confirm: () => 'Apply a style, which the agent supplies, replacing the current colors, view settings and other settings.',
    execute: async (args) => {
      let style = args.style;
      if (!style) {
        if (args.contents === undefined) fail('Give the style as contents (JSON text) or style (an object)');
        try { style = JSON.parse(args.contents); } catch (error) { fail('That is not valid JSON: ' + error.message); }
      }
      if (!style || typeof style != 'object' || typeof style.widgets != 'object') fail('That is not a MicrobeTrace style: it needs a "widgets" object (save one with save_session, format microbetracestyle).');
      const MT = self.MT;
      MT.applyStyle(style);
      if (MT.showColorTable) { MT.showColorTable('node'); MT.showColorTable('link'); }
      ['background-color-change', 'selected-color-change', 'node-border-change', 'node-color-change', 'link-color-change'].forEach(type => MT.events.emit(type));
      return { applied: true, widgets: Object.keys(style.widgets).length };
    }
  });

  function sessionText(format) {
    const MT = self.MT;
    if (format == 'microbetracestyle') return JSON.stringify(self.session.style);
    if (!dataLoaded()) fail('No data is loaded, so there is nothing to save. Load data first.');
    if (format == 'hivtrace') return MT.exportHIVTRACE();
    // The network's positions are on the GPU until synced (see MT.syncLayout)
    if (MT.syncLayout) MT.syncLayout();
    return JSON.stringify(self.session);
  }

  const formatSchema = { type: 'string', enum: ['microbetrace', 'microbetracestyle', 'hivtrace'], default: 'microbetrace', description: 'microbetrace: the whole session (data, style, layout); microbetracestyle: only the style/settings; hivtrace: HIV-TRACE-style output of the visible network' };

  define({
    name: 'get_session_json',
    title: 'Get the session as JSON',
    description: 'Returns the current session serialized as the Save dialog would, without downloading anything: format microbetrace (whole session; can be megabytes), microbetracestyle (just the style and settings; small), or hivtrace (the visible network as HIV-TRACE output). Use it to inspect or hand off a session, then give the text to open_session / apply_style elsewhere.',
    inputSchema: obj({ format: formatSchema }),
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const format = args.format || 'microbetrace';
      const text = sessionText(format);
      return { format, characters: text.length, contents: text };
    }
  });

  define({
    name: 'save_session',
    title: 'Save the session',
    description: 'Saves the current session like the Save dialog: with download true it downloads a file named <filename>.<format> (or <filename>.zip with compress true) through the browser; returnContents (default true) also returns the JSON text. ' +
      'Use returnContents false with download true to avoid a large result. Formats: microbetrace (whole session), microbetracestyle (settings only), hivtrace. For just reading the JSON without downloading use get_session_json.',
    inputSchema: obj({
      format: formatSchema,
      download: bool('Download a file in the browser', false),
      filename: str('File name without extension (default: a default name from the app)'),
      compress: bool('Download as a zip (DEFLATE) holding the file', false),
      returnContents: bool('Return the JSON text in the result', true)
    }),
    annotations: { consequentialHint: true },
    confirm: args => args.download ? 'Download the session (' + (args.format || 'microbetrace') + ') as a file' + (args.filename ? ' named ' + quote(args.filename) : '') + ' to this computer.' : null,
    execute: async (args) => {
      const MT = self.MT, format = args.format || 'microbetrace';
      const data = sessionText(format);
      const result = { format, characters: data.length };
      if (args.download) {
        let name = args.filename;
        if (!name) {
          const input = document.getElementById('save-file-name');
          name = input && input.value || 'MicrobeTrace-' + new Date().toISOString().slice(0, 10);
        }
        if (args.compress) {
          const zip = new self.JSZip();
          zip.file(name + '.' + format, data);
          const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
          MT.saveAs(content, name + '.zip');
          result.downloaded = name + '.zip';
        } else {
          MT.saveAs(new Blob([data], { type: 'application/json;charset=utf-8' }), name + '.' + format);
          result.downloaded = name + '.' + format;
        }
      }
      if (args.returnContents !== false) result.contents = data;
      return result;
    }
  });

  define({
    name: 'new_session',
    title: 'Start a new session',
    description: 'Discards the current session (all loaded data, files and settings) and starts empty at the Files view, as File > New does. This cannot be undone; stash_session or save_session first if the data matters. You must pass confirm: true (and the user must then allow it).',
    inputSchema: obj({ confirm: { type: 'boolean', description: 'Must be true to proceed' } }, ['confirm']),
    annotations: { consequentialHint: true },
    // The confirm argument is the agent saying it means it; the user still decides
    confirm: args => {
      if (args.confirm !== true) fail('This discards all loaded data and settings. Pass confirm: true to proceed (stash_session or save_session first to keep it).');
      return 'Discard all the loaded data, files and settings, and start a new session. This cannot be undone.';
    },
    execute: async (args) => {
      if (args.confirm !== true) fail('This discards all loaded data and settings. Pass confirm: true to proceed (stash_session or save_session first to keep it).');
      self.MT.reset();
      await waitFor(() => self.MT.filesView, { timeout: 20000, message: 'The Files view did not open' });
      return { reset: true, hint: 'Add files with add_file, or load_demo / generate_sequences / open_session.' };
    }
  });

  define({
    name: 'get_session_info',
    title: 'Get session info',
    description: 'Describes the current session: whether a network is loaded, node/link/cluster counts, fields, distance metric and threshold, how long it took to load, which files were loaded (name, format, columns), whether it has sequences, the open views, the loading log, the MicrobeTrace version, and whether autostash is on. Cheap; call it first to see what state the app is in.',
    inputSchema: obj({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      const s = self.session;
      const autostash = await self.db.getItem('stash-auto');
      return Object.assign(summary(), {
        version: self.MT.manifest ? self.MT.manifest.version : null,
        files: s.files.map(f => ({ name: f.name, extension: f.extension, format: f.format, field1: f.field1, field2: f.field2, field3: f.field3 })),
        nodeExclusions: s.data.nodeExclusions.slice(),
        filesViewOpen: !!self.MT.filesView,
        autostash: autostash == 'true',
        startedAt: s.meta.readyTime ? new Date(s.meta.readyTime).toISOString() : null
      });
    }
  });

  // Stashes ------------------------------------------------------------------------------------------

  const stashOf = key => {
    const parts = /^stash-(\d+)-([\s\S]*)$/.exec(key);
    return parts && { key, time: +parts[1], name: parts[2], stashed: new Date(+parts[1]).toISOString() };
  };
  const listStashes = async () => (await self.db.keys()).map(stashOf).filter(Boolean).sort((a, b) => b.time - a.time);

  async function findStash(args) {
    const all = await listStashes();
    const found = args.key ? all.find(s => s.key == args.key) : all.find(s => s.name == args.name);
    if (!found) fail('No stash ' + (args.key ? 'with key ' + args.key : 'named ' + JSON.stringify(args.name)) + '. Stashes: ' + JSON.stringify(all.map(s => ({ key: s.key, name: s.name }))));
    return found;
  }
  const stashRef = { key: str('The stash\'s key (from list_stashes)'), name: str('The stash\'s name (the most recent with that name is used)') };

  define({
    name: 'list_stashes',
    title: 'List stashed sessions',
    description: 'Lists the sessions stashed in this browser (File > Stash), newest first: key, name, time. Stashes live in the browser\'s IndexedDB and persist across reloads. Autostash saves are named "autostash".',
    inputSchema: obj({}),
    annotations: { readOnlyHint: true },
    execute: async () => ({ stashes: await listStashes() })
  });

  define({
    name: 'stash_session',
    title: 'Stash the session',
    description: 'Saves the current session in this browser under a name (key stash-<time>-<name>), to recall later with recall_stash, as File > Stash does. Stashed data stays on this computer\'s disk, which may matter for PII. Returns the stash\'s key.',
    inputSchema: obj({ name: str('A name for the stash (may be empty)') }),
    confirm: args => 'Store a copy of the session, with all its data, in this browser' + (args.name ? ' as ' + quote(args.name) : '') + '.',
    execute: async (args) => {
      requireData();
      const key = 'stash-' + Date.now() + '-' + (args.name || '');
      if (self.MT.syncLayout) self.MT.syncLayout();
      await self.db.setItem(key, JSON.stringify(self.session));
      return stashOf(key);
    }
  });

  define({
    name: 'recall_stash',
    title: 'Recall a stashed session',
    description: 'Loads a stashed session (by key, or by name for the most recent with that name), replacing the current data. Waits for the network to load and returns the summary.',
    inputSchema: obj(Object.assign({ timeoutMs: timeoutSchema(300000) }, stashRef)),
    annotations: { consequentialHint: true },
    // A stash is another dataset than the one the user is sharing, and recalling it replaces that
    confirm: args => 'Recall the stashed session ' + quote(args.key || args.name) + replacing() + '.',
    execute: async (args) => {
      if (!args.key && !args.name && args.name !== '') fail('Give the stash\'s key or name (list_stashes shows them)');
      const stash = await findStash(args);
      const json = await self.db.getItem(stash.key);
      let data;
      try { data = JSON.parse(json); } catch (error) { fail('That stash could not be read: ' + error.message); }
      await loading(() => self.MT.applySession(data), args.timeoutMs || 300000);
      return Object.assign({ recalled: stash }, summary());
    }
  });

  define({
    name: 'delete_stash',
    title: 'Delete a stash',
    description: 'Permanently deletes a stashed session (by key, or by name: the most recent with that name). It cannot be undone.',
    inputSchema: obj(stashRef),
    annotations: { consequentialHint: true },
    confirm: args => 'Permanently delete the stashed session ' + quote(args.key || args.name) + '.',
    execute: async (args) => {
      const stash = await findStash(args);
      await self.db.removeItem(stash.key);
      return { deleted: stash, remaining: (await listStashes()).length };
    }
  });

  define({
    name: 'get_autostash',
    title: 'Get autostash',
    description: 'Says whether autostash is on: when it is, a session is stashed automatically each minute (named "autostash") after it loads, so it can be recovered after a crash. This stores data on disk, which may matter for PII.',
    inputSchema: obj({}),
    annotations: { readOnlyHint: true },
    untrusted: false,
    execute: async () => ({ autostash: (await self.db.getItem('stash-auto')) == 'true', running: !!(self.temp && self.temp.autostash) })
  });

  define({
    name: 'set_autostash',
    title: 'Set autostash',
    description: 'Turns autostash on or off (as the Files view\'s Session Recovery setting does). Turning it on takes effect the next time a network loads; turning it off stops it immediately. Autostash writes the session to this browser\'s storage every minute.',
    inputSchema: obj({ enabled: { type: 'boolean' } }, ['enabled']),
    untrusted: false,
    // Turning it off stores less, so only turning it on asks
    confirm: args => args.enabled ? 'Turn autostash on: every session loaded from now on would be saved in this browser each minute, until it is turned off.' : null,
    execute: async (args) => {
      await self.db.setItem('stash-auto', args.enabled ? 'true' : 'false');
      if (!args.enabled && self.temp && self.temp.autostash) clearInterval(self.temp.autostash.interval);
      const radio = document.querySelector('input[name="stash-auto"][value="' + (args.enabled ? 'true' : 'false') + '"]');
      if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      return { autostash: !!args.enabled };
    }
  });

  // Sequence audit -------------------------------------------------------------------------------------

  const AUDITS = ['empty', 'gaps', 'RNA', 'amino-acids', 'CIGAR', 'malformed'];
  const checksSchema = obj(Object.fromEntries(AUDITS.map(a => [a, bool('Look for sequences that are ' + { empty: 'empty', gaps: 'all gaps', RNA: 'RNA (contain U)', 'amino-acids': 'amino acids', CIGAR: 'CIGAR alignment strings', malformed: 'made of illegal characters' }[a], true)])));

  // [{id, seq}] from the pending FASTA files and node files with a sequence column
  async function pendingSequences() {
    const MT = self.MT, data = [];
    for (const file of self.session.files) {
      if (file.format == 'fasta') {
        data.push(...await MT.parseFASTA(file.contents));
      } else if (file.format == 'node' && file.field2 && file.field2 != 'None') {
        let rows;
        if (file.extension == 'xlsx' || file.extension == 'xls') {
          const workbook = self.XLSX.read(file.contents, { type: 'array' });
          rows = self.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
        } else {
          rows = self.Papa.parse(file.contents, { delimiter: ',', header: true, skipEmptyLines: true }).data;
        }
        rows.forEach(r => data.push({ id: String(r[file.field1]), seq: r[file.field2] == null ? '' : String(r[file.field2]) }));
      }
    }
    if (!data.length && dataLoaded()) self.session.data.nodes.forEach(d => { if (d.seq != null) data.push({ id: d._id, seq: String(d.seq) }); });
    return data;
  }

  define({
    name: 'audit_sequences',
    title: 'Audit sequences',
    description: 'Checks the sequences about to be loaded (FASTA files and node files with a sequence column that are pending, or the loaded nodes\' sequences when nothing is pending) for ones that look wrong: empty, all gaps, RNA, amino acids, CIGAR strings, or illegal characters (each check is on by default). Returns the findings [{id, type}] and the sequences already excluded. Follow with exclude_sequences to keep them out of the network.',
    inputSchema: obj({ checks: checksSchema }),
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const view = await filesView();
      const data = await pendingSequences();
      if (!data.length) fail('There are no sequences to audit. Add a FASTA file or a node file with a sequence column first.');
      const findings = view.auditSequences(data, args.checks || {});
      return { sequences: data.length, findings: findings.length, problems: findings, excluded: self.session.data.nodeExclusions.slice() };
    }
  });

  define({
    name: 'exclude_sequences',
    title: 'Exclude sequences from loading',
    description: 'Manages the list of node IDs left out of the network when files are launched (the Audit tab\'s Exclude buttons). ' +
      'mode: add (default) puts ids (and, with fromAudit, everything audit_sequences finds using the checks given) on the list; remove takes ids off; set replaces the list; clear empties it; list just returns it. ' +
      'Exclusions apply as nodes are loaded, so set them before launch; they do not remove nodes from a network already loaded. Returns the exclusion list.',
    inputSchema: obj({
      mode: { type: 'string', enum: ['add', 'remove', 'set', 'clear', 'list'], default: 'add' },
      ids: { type: 'array', items: { type: 'string' }, description: 'Node/sequence IDs' },
      fromAudit: bool('Also exclude every sequence the audit flags', false),
      checks: checksSchema
    }),
    annotations: { consequentialHint: true },
    execute: async (args) => {
      const list = self.session.data.nodeExclusions;
      const mode = args.mode || 'add';
      let ids = (args.ids || []).map(String);
      if (args.fromAudit) {
        const view = await filesView();
        ids = unique(ids.concat(view.auditSequences(await pendingSequences(), args.checks || {}).map(f => f.id)));
      }
      if (mode == 'add') ids.forEach(id => { if (!list.includes(id)) list.push(id); });
      else if (mode == 'remove') ids.forEach(id => { const i = list.indexOf(id); if (i > -1) list.splice(i, 1); });
      else if (mode == 'set') list.splice(0, list.length, ...unique(ids));
      else if (mode == 'clear') list.splice(0, list.length);
      return { excluded: list.slice(), count: list.length, note: dataLoaded() ? 'A network is loaded: exclusions only apply to nodes added by a later launch.' : undefined };
    }
  });

})(typeof self !== 'undefined' ? self : this);
