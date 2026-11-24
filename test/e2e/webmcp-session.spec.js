// WebMCP tools for loading data and managing sessions (src/webmcp/session/)
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, webmcp } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

let page, errors, tools;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page, { webmcp: true });
  await page.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('launch') && MT.filesView);
  tools = webmcp(page);
});
test.afterAll(() => page.close());

// Tools that ask the user are allowed, as the user would (webmcp-optin.spec.js
// tests the asking)
const call = (name, args) => tools.call(name, args);
const fails = (name, args) => tools.fails(name, args);

test('defines the session tools', async () => {
  const names = await page.evaluate(() => MTWebMCP.list().map(t => t.name));
  for (const n of ['add_file', 'list_pending_files', 'update_pending_file', 'remove_pending_file', 'reorder_pending_files',
    'get_loading_options', 'set_loading_options', 'launch', 'load_demo', 'generate_sequences', 'open_session', 'apply_style',
    'save_session', 'get_session_json', 'new_session', 'list_stashes', 'stash_session', 'recall_stash', 'delete_stash',
    'get_autostash', 'set_autostash', 'get_session_info', 'audit_sequences', 'exclude_sequences']) expect(names).toContain(n);
  expect(await call('get_session_info')).toMatchObject({ loaded: false, filesViewOpen: true });
});

test('adds files with detected headers and column choices', async () => {
  let r = await call('add_file', { name: 'links.csv', contents: fixture('links.csv') });
  expect(r.added).toMatchObject({ format: 'link', field1: 'source', field2: 'target', field3: 'distance' });
  expect(r.added.headers).toEqual(['source', 'target', 'distance', 'contact']);
  expect(r.canLaunch).toBe(true);
  r = await call('add_file', { name: 'nodes.csv', contents: fixture('nodes.csv') });
  expect(r.added).toMatchObject({ format: 'node', field1: 'id' });
  r = await call('add_file', { name: 'seqs.fasta', contents: fixture('seqs.fasta') });
  expect(r.added.format).toBe('fasta');
  expect(r.pendingFiles.map(f => f.name)).toEqual(['links.csv', 'nodes.csv', 'seqs.fasta']);
  // The rows are in the view
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(3);
});

test('validates names and columns', async () => {
  expect(await fails('add_file', { name: 'links.csv', contents: 'a,b\n1,2' })).toMatch(/already added/);
  expect(await fails('add_file', { name: 'x.csv', contents: 'a,b\n1,2', source: 'nope' })).toMatch(/no column named "nope".*\["a","b"\]/);
  expect(await call('list_pending_files').then(r => r.pendingFiles.length)).toBe(3);
  expect(await fails('update_pending_file', { name: 'links.csv', id: 'source' })).toMatch(/takes source, target and distance/);
  expect(await fails('update_pending_file', { name: 'missing.csv' })).toMatch(/No pending file/);
});

test('updates, reorders and removes pending files', async () => {
  let r = await call('update_pending_file', { name: 'links.csv', source: 'TARGET', target: 'Source' });
  expect(r.updated).toMatchObject({ field1: 'target', field2: 'source' });
  r = await call('update_pending_file', { name: 'links.csv', source: 'contact', target: 'contact' });
  expect(r.problems[0].problem).toMatch(/different columns/);
  expect(r.canLaunch).toBe(false);
  expect(await fails('launch')).toMatch(/Fix these files/);
  r = await call('update_pending_file', { name: 'links.csv', format: 'node' });
  expect(r.updated.format).toBe('node');
  r = await call('update_pending_file', { name: 'links.csv', format: 'link', source: 'source', target: 'target', distance: 'distance' });
  expect(r.canLaunch).toBe(true);
  r = await call('reorder_pending_files', { order: ['seqs.fasta', 'nodes.csv'] });
  expect(r.pendingFiles.map(f => f.name)).toEqual(['seqs.fasta', 'nodes.csv', 'links.csv']);
  expect(await page.evaluate(() => session.files.map(f => f.name))).toEqual(['seqs.fasta', 'nodes.csv', 'links.csv']);
  r = await call('remove_pending_file', { name: 'seqs.fasta' });
  expect(r.pendingFiles.map(f => f.name)).toEqual(['nodes.csv', 'links.csv']);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(2);
  await call('add_file', { name: 'seqs.fasta', contents: fixture('seqs.fasta') });
});

test('gets and sets loading options', async () => {
  let r = await call('get_loading_options');
  expect(r.options).toMatchObject({ distanceMetric: 'tn93', alignment: 'none', referenceSource: 'consensus' });
  expect(r.valid.distanceMetric.map(m => m.id)).toContain('snps');
  r = await call('set_loading_options', { distanceMetric: 'snps', linkThreshold: 5, ambiguityStrategy: 'RESOLVE', linkStorage: 'all', inferDirectionality: false, alignment: 'smith-waterman', referenceSource: 'first', distanceMetricsAlso: ['tn93'], aligner: { match: 2 } });
  expect(r).toMatchObject({ distanceMetric: 'snps', linkThreshold: 5, ambiguityStrategy: 'RESOLVE', linkStorage: 'all', alignment: 'smith-waterman', referenceSource: 'first', distanceMetricsAlso: ['tn93'] });
  expect(r.aligner.match).toBe(2);
  // The Files view's default band
  expect(r.aligner.band).toBe(100);
  r = await call('set_loading_options', { aligner: { band: 50 } });
  expect(r.aligner.band).toBe(50);
  expect(await page.evaluate(() => document.querySelector('.aligner-band').value)).toBe('50');
  expect(await fails('set_loading_options', { aligner: { band: 1.5 } })).toMatch(/whole number/);
  // Blank in the Files view is no band
  await page.evaluate(() => { document.querySelector('.aligner-band').value = ''; });
  expect((await call('get_loading_options')).options.aligner.band).toBeNull();
  r = await call('set_loading_options', { aligner: { band: 0 } });
  expect(r.aligner.band).toBe(0);
  expect(await page.evaluate(() => document.querySelector('#default-distance-metric').value)).toBe('snps');
  // GapMM works with any metric
  r = await call('set_loading_options', { distanceMetric: 'snps', ambiguityStrategy: 'GAPMM' });
  expect(r.ambiguityStrategy).toBe('GAPMM');
  expect(await fails('set_loading_options', { distanceMetric: 'bogus' })).toMatch(/"distanceMetric" must be one of/);
  // The metric alone brings its default threshold
  r = await call('set_loading_options', { distanceMetric: 'tn93', ambiguityStrategy: 'AVERAGE', alignment: 'none', referenceSource: 'consensus', distanceMetricsAlso: [], aligner: { match: 1 }, linkStorage: 'auto', inferDirectionality: true });
  expect(r.linkThreshold).toBe(0.015);
  await call('set_loading_options', { inferDirectionality: false });
});

test('audits and excludes sequences', async () => {
  let r = await call('audit_sequences');
  expect(r.sequences).toBe(300);
  r = await call('exclude_sequences', { ids: ['S5'] });
  expect(r.excluded).toEqual(['S5']);
  r = await call('exclude_sequences', { mode: 'clear' });
  expect(r.excluded).toEqual([]);
});

test('launches and summarizes', async () => {
  const r = await call('launch');
  expect(r).toMatchObject({ loaded: true, nodes: 310 });
  expect(r.clusters).toBeGreaterThan(0);
  expect(r.nodeFields).toContain('state');
  expect(r.messages.join(' ')).toMatch(/Parsing/);
  expect(await page.evaluate(() => layout.contentItems.map(i => i.componentType))).not.toContain('files');
  const info = await call('get_session_info');
  expect(info.files.map(f => f.name)).toContain('nodes.csv');
  expect(info.filesViewOpen).toBe(false);
  expect(info.version).toBeTruthy();
});

test('saves the session and the style, and reopens them', async () => {
  const json = await call('get_session_json');
  expect(json.characters).toBeGreaterThan(1000);
  const style = await call('save_session', { format: 'microbetracestyle' });
  expect(JSON.parse(style.contents).widgets).toBeTruthy();
  const bare = await call('save_session', { returnContents: false });
  expect(bare.contents).toBeUndefined();
  const hiv = await call('get_session_json', { format: 'hivtrace' });
  expect(JSON.parse(hiv.contents).trace_results).toBeTruthy();

  const download = page.waitForEvent('download');
  const saved = await call('save_session', { download: true, filename: 'tool-test', returnContents: false });
  expect(saved.downloaded).toBe('tool-test.microbetrace');
  expect((await download).suggestedFilename()).toBe('tool-test.microbetrace');

  const info = await call('open_session', { contents: json.contents });
  expect(info).toMatchObject({ loaded: true, nodes: 310 });

  const red = JSON.parse(style.contents);
  red.widgets['link-color'] = '#ff0000';
  expect(await call('apply_style', { contents: JSON.stringify(red) })).toMatchObject({ applied: true });
  expect(await page.evaluate(() => session.style.widgets['link-color'])).toBe('#ff0000');
  expect(await fails('apply_style', { contents: '{}' })).toMatch(/widgets/);
  expect(await fails('open_session', { contents: 'nope' })).toMatch(/valid JSON/);
});

test('stashes, lists, recalls and deletes', async () => {
  const stash = await call('stash_session', { name: 'tool stash' });
  expect(stash.name).toBe('tool stash');
  expect((await call('list_stashes')).stashes.map(s => s.name)).toContain('tool stash');
  await call('load_demo');
  expect(await page.evaluate(() => session.data.nodes.length)).not.toBe(310);
  const r = await call('recall_stash', { name: 'tool stash' });
  expect(r).toMatchObject({ nodes: 310 });
  expect(await call('delete_stash', { key: stash.key })).toMatchObject({ deleted: { name: 'tool stash' } });
  expect(await fails('recall_stash', { name: 'tool stash' })).toMatch(/No stash/);
});

test('autostash', async () => {
  expect((await call('get_autostash')).autostash).toBe(false);
  await call('set_autostash', { enabled: true });
  expect((await call('get_autostash')).autostash).toBe(true);
  await call('set_autostash', { enabled: false });
  expect((await call('get_autostash')).autostash).toBe(false);
});

test('new session requires confirmation', async () => {
  expect(await fails('new_session', {})).toMatch(/confirm/);
  expect(await page.evaluate(() => session.data.nodes.length)).toBeGreaterThan(0);
  await call('new_session', { confirm: true });
  expect(await call('get_session_info')).toMatchObject({ loaded: false, filesViewOpen: true });
});

test('loads the demo as files, with options', async () => {
  const r = await call('load_demo', { source: 'files' });
  expect(r.loaded).toBe(true);
  expect(r.nodes).toBeGreaterThan(50);
});

test('generates sequences and launches', async () => {
  await call('new_session', { confirm: true });
  let r = await call('generate_sequences', { count: 30 });
  expect(r.pendingFiles.map(f => f.name)).toEqual(['generatedNodes.csv']);
  r = await call('generate_sequences', { count: 25, launch: true });
  expect(r).toMatchObject({ loaded: true, nodes: 25, anySequences: true });
});

test('aligns to a consensus built from the sequences by default (#317)', async () => {
  await call('new_session', { confirm: true });
  await call('set_loading_options', { alignment: 'smith-waterman' });
  expect((await call('get_loading_options')).options.referenceSource).toBe('consensus');
  const r = await call('generate_sequences', { count: 25, launch: true });
  expect(r).toMatchObject({ loaded: true, nodes: 25, anySequences: true });
  const { reference, lengths } = await page.evaluate(() => ({
    reference: session.data.reference,
    lengths: Array.from(new Set(session.data.nodes.map(d => d._seq.length)))
  }));
  expect(reference).toMatch(/^[ACGT]+$/);
  // Every sequence is put on the consensus's coordinates
  expect(lengths).toEqual([reference.length]);
  await call('set_loading_options', { alignment: 'none' });
});

test('aligning to a file reference refuses to launch without one', async () => {
  await call('new_session', { confirm: true });
  await call('set_loading_options', { alignment: 'smith-waterman', referenceSource: 'file' });
  await page.evaluate(() => { session.data.reference = ''; });
  // The tool fails with the load's message, rather than waiting until it times out
  expect(await fails('generate_sequences', { count: 5, launch: true })).toContain('no reference sequence was loaded');
  // (The failed load logs its error, as it should; only that one is expected)
  expect(errors.filter(e => !/no reference sequence was loaded/.test(e))).toEqual([]);
  errors.length = 0;
  await call('set_loading_options', { alignment: 'none', referenceSource: 'consensus' });
  // (The failed load's error toast stays until dismissed)
  await page.evaluate(() => document.querySelectorAll('#mt-toast-container .toast').forEach(t => t.remove()));
});

test('generates as the Generate button does: up to 250,000, in several files when many', async () => {
  await call('new_session', { confirm: true });
  expect(await page.evaluate(() => MTWebMCP.list().find(t => t.name === 'generate_sequences').inputSchema.properties.count.maximum)).toBe(250000);
  expect(await fails('generate_sequences', { count: 0 })).toMatch(/"count" must be at least 1/);
  expect(await fails('generate_sequences', { count: 2.5 })).toMatch(/"count" must be a whole number/);
  expect(await fails('generate_sequences', { count: 250001 })).toMatch(/"count" must be at most 250000/);
  expect(await page.evaluate(() => session.files.length)).toBe(0);
  // Five sequences a file, as hundreds of thousands are at the real limit
  const limit = await page.evaluate(() => { const was = MT.generatedFileChars; MT.generatedFileChars = 5 * (MT.generatedSeedLength + 50); return was; });
  let r = await call('generate_sequences', { count: 12 });
  expect(r.pendingFiles.map(f => f.name)).toEqual(['generatedNodes-1.csv', 'generatedNodes-2.csv', 'generatedNodes-3.csv']);
  // Generating again replaces them all
  r = await call('generate_sequences', { count: 4 });
  expect(r.pendingFiles.map(f => f.name)).toEqual(['generatedNodes.csv']);
  await page.evaluate(limit => { MT.generatedFileChars = limit; }, limit);
});

test('adds an excel file as base64 and a session by file name', async () => {
  await call('new_session', { confirm: true });
  const base64 = await page.evaluate(async () => {
    await MT.loadLibrary('xlsx'); // fetched when first needed (#324)
    const ws = XLSX.utils.aoa_to_sheet([['source', 'target', 'distance'], ['a', 'b', 0.001], ['b', 'c', 0.002]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  });
  const added = await call('add_file', { name: 'edges.xlsx', contentsBase64: base64 });
  expect(added.added).toMatchObject({ format: 'link', field1: 'source' });
  expect(await fails('add_file', { name: 'e2.xlsx', contents: 'x' })).toMatch(/contentsBase64/);
  const r = await call('launch');
  expect(r.nodes).toBe(3);
  const session = (await call('get_session_json')).contents;
  const opened = await call('add_file', { name: 'x.microbetrace', contents: session });
  expect(opened).toMatchObject({ opened: 'session', nodes: 3 });
});

test('had no page errors', () => {
  expect(errors).toEqual([]);
});
