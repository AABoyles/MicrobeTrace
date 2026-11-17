// The WebMCP query tools (src/webmcp/query.js) against the fixture network
const { test, expect } = require('@playwright/test');
const { loadNetwork, open, watchErrors } = require('./helpers');

const call = (page, name, args) => page.evaluate(([name, args]) => MTWebMCP.call(name, args || {}), [name, args]);

test('get_status works with no data', async ({ page }) => {
  await open(page);
  const s = await call(page, 'get_status');
  expect(s.loaded).toBe(false);
  expect(Array.isArray(s.views)).toBe(true);
});

test.describe('with a network', () => {
  test.beforeEach(async ({ page }) => { await loadNetwork(page); });

  test('status, statistics and fields', async ({ page }) => {
    const errors = watchErrors(page);
    const s = await call(page, 'get_status');
    expect(s.loaded).toBe(true);
    expect(s.nodes.total).toBe(310);
    expect(s.links.visible).toBeGreaterThan(0);
    expect(s.filters.linkMetric).toBeTruthy();
    expect(s.views.length).toBeGreaterThan(0);

    const st = await call(page, 'get_statistics');
    expect(st.nodes).toBe(await page.evaluate(() => +document.getElementById('numberOfNodes').textContent.replace(/,/g, '')));
    expect(st.visibleLinks).toBe(await page.evaluate(() => +document.getElementById('numberOfVisibleLinks').textContent.replace(/,/g, '')));
    expect(st.disjointClusters).toBe(await page.evaluate(() => +document.getElementById('numberOfDisjointComponents').textContent.replace(/,/g, '')));

    const f = await call(page, 'list_fields');
    const byName = Object.fromEntries(f.fields.map(x => [x.field, x]));
    expect(byName.state.type).toBe('categorical');
    expect(byName.date.type).toBe('date');
    expect(byName.lat.type).toBe('numeric');
    expect(byName._id.internal).toBe(true);
    const lf = await call(page, 'list_fields', { entity: 'link' });
    expect(lf.fields.map(x => x.field)).toContain('tn93');

    const d = await call(page, 'describe_field', { field: 'state' });
    expect(d.values.length).toBeGreaterThan(1);
    expect(d.values.reduce((a, v) => a + v.count, 0) + (d.otherValues || 0)).toBeGreaterThan(0);
    const n = await call(page, 'describe_field', { field: 'lat', bins: 4 });
    expect(n.histogram).toHaveLength(4);
    expect(n.min).toBeLessThanOrEqual(n.max);
    const t = await call(page, 'describe_field', { entity: 'link', field: 'tn93', visibleOnly: true });
    expect(t.type).toBe('numeric');
    expect(errors).toEqual([]);
  });

  test('query_nodes, get_node and sequences', async ({ page }) => {
    const r = await call(page, 'query_nodes', { limit: 5, sort: [{ field: 'degree', descending: true }] });
    expect(r.total).toBe(310);
    expect(r.items).toHaveLength(5);
    expect(r.items[0].seq).toBeUndefined();
    expect(r.items[0].seq_length).toBeGreaterThan(0);
    expect(r.items[0].degree).toBeGreaterThanOrEqual(r.items[1].degree);
    const g0 = await call(page, 'query_nodes', { filter: [{ field: 'group', op: 'eq', value: 'g0' }], fields: ['_id', 'group'], count: false });
    expect(g0.total).toBeGreaterThan(0);
    expect(g0.items.every(n => n.group == 'g0')).toBe(true);
    const full = await call(page, 'query_nodes', { ids: ['S0'], fields: ['_id', 'seq'], sequences: 'truncated', maxSequenceLength: 10 });
    expect(full.items[0].seq).toContain('…');

    const node = await call(page, 'get_node', { id: 'S0', neighbors: true });
    expect(node.node._id).toBe('S0');
    expect(node.degree.visible).toBe(node.neighbors.length);
    await expect(call(page, 'get_node', { id: 'nope' })).rejects.toThrow(/No node/);

    const seqs = await call(page, 'get_sequences', { ids: ['S0', 'S1'], format: 'fasta', maxLength: 20 });
    expect(seqs.fasta.startsWith('>S0\n')).toBe(true);
    const cons = await call(page, 'get_consensus', { ids: ['S0', 'S1', 'S2'] });
    expect(cons.length).toBeGreaterThan(0);
  });

  test('links, neighbors and paths', async ({ page }) => {
    const all = await call(page, 'query_links', { scope: 'visible', limit: 3, sort: [{ field: 'tn93' }] });
    const status = await call(page, 'get_status');
    expect(all.total).toBe(status.links.visible);
    expect(all.items[0].tn93).toBeLessThanOrEqual(all.items[1].tn93);
    const big = await call(page, 'query_links', { scope: 'all', filter: [{ field: 'tn93', op: 'lte', value: 0.02 }], count: true });
    expect(big.total).toBeGreaterThanOrEqual(all.total > 0 ? 1 : 0);
    const a = all.items[0];
    const touching = await call(page, 'query_links', { nodes: [a.source] });
    expect(touching.items.every(l => l.source == a.source || l.target == a.source)).toBe(true);
    const between = await call(page, 'query_links', { between: { a: [a.source], b: [a.target] } });
    expect(between.total).toBe(1);
    const link = await call(page, 'get_link', { source: a.target, target: a.source });
    expect(link.exists).toBe(true);
    expect(link.link.index).toBe(a.index);

    const nb = await call(page, 'get_neighbors', { ids: [a.source], depth: 2 });
    expect(nb.nodes[0].neighbors.some(n => n.id == a.target && n.depth == 1)).toBe(true);
    const path = await call(page, 'shortest_path', { source: a.source, target: a.target });
    expect(path.found).toBe(true);
    expect(path.hops).toBe(1);
    const weighted = await call(page, 'shortest_path', { source: a.source, target: a.target, weight: 'tn93' });
    expect(weighted.path[0]).toBe(a.source);
  });

  test('clusters, aggregates and matrices', async ({ page }) => {
    const cl = await call(page, 'list_clusters', { sort: [{ field: 'nodes', descending: true }], limit: 3, includeMembers: true });
    expect(cl.items[0].nodes).toBeGreaterThanOrEqual(cl.items[1].nodes);
    expect(cl.items[0].members.length).toBeGreaterThan(0);
    const one = await call(page, 'get_cluster', { id: cl.items[0].id, summarize: ['state'] });
    expect(one.members.total).toBe(cl.items[0].nodes);
    expect(one.summaries.state.count).toBeGreaterThan(0);

    const x = await call(page, 'crosstab', { fieldA: 'state', fieldB: 'group' });
    expect(x.total).toBe(310);
    expect(x.matrix.flat().reduce((p, q) => p + q, 0)).toBe(310);
    const ag = await call(page, 'aggregate', { groupBy: ['state'], metrics: [{ field: 'lat', op: 'mean' }] });
    expect(ag.items.reduce((p, r) => p + r.count, 0)).toBe(310);
    expect(ag.items[0]).toHaveProperty('mean_lat');

    const dm = await call(page, 'get_distance_matrix', { ids: ['S0', 'S1', 'S3'] });
    expect(dm.matrix).toHaveLength(3);
    expect(dm.matrix[0][0]).toBe(0);
    await expect(call(page, 'get_distance_matrix', { maxNodes: 5, visibleOnly: true })).rejects.toThrow(/maxNodes/);

    const dd = await call(page, 'get_degree_distribution', {});
    expect(dd.distribution.reduce((p, q) => p + q.count, 0)).toBe(dd.nodes);
    const ce = await call(page, 'get_centrality', { top: 3, maxNodes: 3000 });
    expect(ce.items).toHaveLength(3);
    const conf = await call(page, 'get_conflicts', {});
    expect(conf.total).toBeGreaterThanOrEqual(0);
    const prov = await call(page, 'get_provenance', { id: 'S0' });
    expect(prov.id).toBe('S0');
  });

  test('get_tree returns newick', async ({ page }) => {
    const t = await call(page, 'get_tree', {});
    expect(t.newick).toMatch(/;$/);
    expect(t.leaves).toBeGreaterThan(10);
  });
});
