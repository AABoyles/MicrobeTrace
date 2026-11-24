import { fail, waitFor, nextEvent } from '../core.js';
import { obj, str, bool } from '../schema.js';

// How long a tool waits for the Files view to open, once it is asked to
export const FILES_VIEW_WAIT_MS = 20000;

export const timeoutSchema = def => ({ type: 'integer', minimum: 1000, description: 'Milliseconds to wait for the network to finish loading before giving up (default ' + def + ')', default: def });

export const FORMATS = ['link', 'node', 'matrix', 'fasta', 'newick'];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const dataLoaded = () => !!(self.session && self.session.data && self.session.data.nodes.length);

// An agent's text, quoted and short, for a confirmation message
export const quote = text => JSON.stringify(String(text == null ? '' : text).slice(0, 100));

export const replacing = () => dataLoaded() ? ', replacing the data loaded now' : '';

export function bytesOf(base64) {
  try {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  } catch (e) {
    return fail('contentsBase64 is not valid base64');
  }
}

// The Files view, opened if it isn't
export async function filesView() {
  if (!self.MT.filesView) {
    self.MT.launchView('files');
    await waitFor(() => self.MT.filesView, { timeout: FILES_VIEW_WAIT_MS, message: 'The Files view did not open' });
  }
  return self.MT.filesView;
}

// After a network loads: wait until the Files view has gone and the loading dialog has closed (the app does that a moment later)
async function settle() {
  const modal = document.getElementById('loading-information-modal');
  await waitFor(() => !self.layout.contentItems.some(i => i.componentType == 'files') && !(modal && modal.classList.contains('show')),
    { timeout: 6000, interval: 100 }).catch(() => {});
}

// Runs start(), then waits for the load it began to finish, or to fail
// (which otherwise would only show as a timeout). Both events are listened
// for from before it starts.
export async function loading(start, timeout) {
  let offFailed = () => {};
  const failed = new Promise((resolve, reject) => {
    offFailed = self.MT.events.on('session-load-failed', text => {
      try { fail(String(text || 'The load failed')); } catch (error) { reject(error); }
    });
  });
  const loaded = nextEvent('session-loaded', { timeout });
  loaded.catch(() => {});
  failed.catch(() => {});
  try {
    await start();
    await Promise.race([loaded, failed]);
  } finally {
    offFailed();
  }
  await settle();
}

export const unique = list => Array.from(new Set(list));

export function summary() {
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

export const fieldProps = {
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
export function fieldsFor(args, format, headers) {
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

export const withoutUndefined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const pending = view => ({
  pendingFiles: view.list(),
  canLaunch: view.canLaunch(),
  problems: view.problems(),
  hint: 'Use launch to build the network once no file has a problem.'
});

// Fails (leaving the current session alone) unless data is a session this version can open
export function checkSession(data) {
  const check = self.MTSessionFormat.validate(data);
  if (!check.ok) fail(check.error);
}

// Opens a session or HIV-TRACE/GHOST JSON, from text and an extension
export function openJSON(text, extension) {
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
  if (extension == 'microbetrace') checkSession(data);
  if (extension != 'microbetrace' && !(data && (data.trace_results || data.samples))) fail('That JSON is not HIV-TRACE (trace_results) or GHOST (samples) output.');
  self.MT.processJSON(text, extension);
}

// The session JSON inside a zip, as {text, extension}
export async function sessionInZip(bytes) {
  let zip;
  try {
    await self.MT.loadLibrary('xlsx');
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

export const STRATEGIES = {
  AVERAGE: 'Average the possibilities of ambiguous bases',
  RESOLVE: 'Resolve ambiguous bases to the closest match',
  SKIP: 'Skip sites with ambiguous bases',
  GAPMM: 'Average, with a gap facing a base compared as an N (mostly a mismatch)',
  'HIVTRACE-G': 'HIV-TRACE -g: resolve ambiguities only up to the ambiguity threshold'
};

export const viewNames = () => {
  const names = ['network', 'bubbles', 'table'];
  return unique(names.concat(self.MT.views ? Object.keys(self.MT.views).filter(v => v != 'files') : []));
};

export function readOptions() {
  const w = self.session.style.widgets;
  const referenceSource = ['file', 'first', 'consensus'].find(s => w['reference-source-' + s]) || 'consensus';
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

export function sessionText(format) {
  const MT = self.MT;
  if (format == 'microbetracestyle') return JSON.stringify(self.session.style);
  if (!dataLoaded()) fail('No data is loaded, so there is nothing to save. Load data first.');
  return MT.sessionText(format);
}

export const formatSchema = { type: 'string', enum: ['microbetrace', 'microbetracestyle', 'hivtrace'], default: 'microbetrace', description: 'microbetrace: the whole session (data, style, layout); microbetracestyle: only the style/settings; hivtrace: HIV-TRACE-style output of the visible network' };

export const stashOf = key => {
  const parts = /^stash-(\d+)-([\s\S]*)$/.exec(key);
  return parts && { key, time: +parts[1], name: parts[2], stashed: new Date(+parts[1]).toISOString() };
};

export const listStashes = async () => (await self.db.keys()).map(stashOf).filter(Boolean).sort((a, b) => b.time - a.time);

export async function findStash(args) {
  const all = await listStashes();
  const found = args.key ? all.find(s => s.key == args.key) : all.find(s => s.name == args.name);
  if (!found) fail('No stash ' + (args.key ? 'with key ' + args.key : 'named ' + JSON.stringify(args.name)) + '. Stashes: ' + JSON.stringify(all.map(s => ({ key: s.key, name: s.name }))));
  return found;
}

export const stashRef = { key: str('The stash\'s key (from list_stashes)'), name: str('The stash\'s name (the most recent with that name is used)') };

const AUDITS = ['empty', 'gaps', 'RNA', 'amino-acids', 'CIGAR', 'malformed'];

export const checksSchema = obj(Object.fromEntries(AUDITS.map(a => [a, bool('Look for sequences that are ' + { empty: 'empty', gaps: 'all gaps', RNA: 'RNA (contain U)', 'amino-acids': 'amino acids', CIGAR: 'CIGAR alignment strings', malformed: 'made of illegal characters' }[a], true)])));

// [{id, seq}] from the pending FASTA files and node files with a sequence column
export async function pendingSequences() {
  const MT = self.MT, data = [];
  for (const file of self.session.files) {
    if (file.format == 'fasta') {
      for (const d of await MT.parseFASTA(file.contents)) data.push(d); // (no spread: it overflows the stack on large files)
    } else if (file.format == 'node' && file.field2 && file.field2 != 'None') {
      let rows;
      if (file.extension == 'xlsx' || file.extension == 'xls') {
        await MT.loadLibrary('xlsx');
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
