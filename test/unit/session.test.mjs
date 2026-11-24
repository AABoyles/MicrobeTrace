// Unit tests for src/session.js, the owner of session.data (#338). Run with: node --test test/unit
import test from 'node:test';
import assert from 'node:assert';
import { makeSession } from '../../src/session.js';
import { MTEvents } from '../../src/events.js';
import { MTGraph } from '../../src/graph.js';
import { MTNodeSources } from '../../src/nodes.js';

// A MT with what the owner reads from it, and a root with its own session and temp
function setup() {
  const dataSkeleton = () => ({
    nodes: [], clusters: [], nodeFields: ['_id'], nodeExclusions: [], linkFields: ['source'], reference: '',
    graph: new MTGraph(), nodeIndex: new Map(), sources: new MTNodeSources(),
  });
  const MT = {
    events: new MTEvents(),
    dataSkeleton,
    sessionSkeleton: () => ({ data: dataSkeleton(), files: [] }),
    tempSkeleton: () => ({ fresh: true }),
    defaultNode: () => ({ origin: [], selected: false }),
    uniq: a => [...new Set(a)],
  };
  const root = { session: MT.sessionSkeleton(), temp: { componentCache: 'cache', stale: true } };
  const S = makeSession(MT, root);
  const heard = [];
  MT.events.on('session-data-change', what => heard.push(what));
  return { MT, root, S, heard };
}

test('addNode adds once, merges by cleaned ID, and honors exclusions', () => {
  const { root, S } = setup();
  assert.strictEqual(S.addNode({ id: ' A ', x: 1 }), 1);
  assert.strictEqual(S.addNode({ _id: 'A', y: 2, origin: ['f'] }), 0);
  const d = root.session.data;
  assert.strictEqual(d.nodes.length, 1);
  assert.strictEqual(d.nodes[0]._id, 'A');
  assert.deepStrictEqual([d.nodes[0].x, d.nodes[0].y], [1, 2]);
  assert.strictEqual(d.nodeIndex.get('A'), d.nodes[0]);
  S.excludeNodes('B');
  assert.strictEqual(S.addNode({ _id: 'B' }), 0);
  assert.strictEqual(d.nodes.length, 1);
});

test('addNode with a source records the values and the top file wins', () => {
  const { root, S } = setup();
  const d = root.session.data;
  const top = S.addSource('top.csv', 0), bottom = S.addSource('bottom.csv', 1);
  S.addNode({ _id: 'A', state: 'Ohio' }, true, bottom);
  S.addNode({ _id: 'A', state: 'Texas' }, true, top);
  assert.strictEqual(d.nodes[0].state, 'Texas');
  assert.strictEqual(d.nodes.length, 1);
});

test('addNode and addLink are silent; addNodes and addLinks say so once and count the new', () => {
  const { root, S, heard } = setup();
  S.addNode({ _id: 'A' });
  S.addLink({ source: 'A', target: 'B' });
  assert.deepStrictEqual(heard, []);
  assert.strictEqual(S.addNodes([{ _id: 'A' }, { _id: 'B' }, { _id: 'C' }]), 2);
  assert.strictEqual(S.addLinks(new Set([{ source: ' B', target: 'C ' }, { source: 'A', target: 'B' }])), 1);
  assert.deepStrictEqual(heard, [['nodes'], ['links']]);
  assert.strictEqual(root.session.data.graph.edgeCount, 2);
});

test('field lists get each name once and only say so when something was added', () => {
  const { root, S, heard } = setup();
  S.addNodeField('a', 'b', 'a');
  S.addNodeField('a');
  S.addLinkField('distance', 'source');
  assert.deepStrictEqual(root.session.data.nodeFields, ['_id', 'a', 'b']);
  assert.deepStrictEqual(root.session.data.linkFields, ['source', 'distance']);
  assert.deepStrictEqual(heard, [['fields'], ['fields']]);
});

test('exclusions are added, removed and set in place', () => {
  const { root, S, heard } = setup();
  const list = root.session.data.nodeExclusions;
  S.excludeNodes(['a', 'b', 'a']);
  S.excludeNodes('b');
  assert.deepStrictEqual(list, ['a', 'b']);
  S.includeNodes('a');
  S.includeNodes('zzz');
  assert.deepStrictEqual(list, ['b']);
  S.setExclusions(['x', 'y', 'x']);
  assert.deepStrictEqual(list, ['x', 'y']);
  assert.strictEqual(root.session.data.nodeExclusions, list, 'callers holding the list keep seeing it');
  S.setExclusions([]);
  assert.deepStrictEqual(list, []);
  assert.deepStrictEqual(heard, [['exclusions'], ['exclusions'], ['exclusions'], ['exclusions']]);
});

test('reference, consensus and clusters are set and announced', () => {
  const { root, S, heard } = setup();
  S.setReference('ACGT');
  S.setConsensus('ACGA');
  const clusters = [{ id: 0 }];
  assert.strictEqual(S.setClusters(clusters), clusters);
  const d = root.session.data;
  assert.deepStrictEqual([d.reference, d.consensus, d.clusters], ['ACGT', 'ACGA', clusters]);
  assert.deepStrictEqual(heard, [['reference'], ['consensus'], ['clusters']]);
});

test('reset replaces the session, and temp unless told not to, keeping the component cache on request', () => {
  const { root, S, heard } = setup();
  const before = root.session, temp = root.temp;
  S.reset({ temp: false });
  assert.notStrictEqual(root.session, before);
  assert.strictEqual(root.temp, temp);
  S.reset({ keepComponents: true });
  assert.deepStrictEqual(root.temp, { fresh: true, componentCache: 'cache' });
  S.reset();
  assert.deepStrictEqual(root.temp, { fresh: true });
  assert.deepStrictEqual(heard, [['reset'], ['reset'], ['reset']]);
});

test('discardData drops nodes and links but keeps the reference', () => {
  const { root, S } = setup();
  S.addNode({ _id: 'A' });
  S.setReference('ACGT');
  S.discardData();
  assert.strictEqual(root.session.data.nodes.length, 0);
  assert.strictEqual(root.session.data.reference, 'ACGT');
});

test('preferSource and pickSource re-resolve values and emit the view events', () => {
  const { root, S, MT } = setup();
  const top = S.addSource('top.csv', 0), bottom = S.addSource('bottom.csv', 1);
  S.addNode({ _id: 'A', state: 'Ohio' }, true, bottom);
  S.addNode({ _id: 'A', state: 'Texas' }, true, top);
  const heard = [];
  ['node-values-change', 'node-visibility'].forEach(type => MT.events.on(type, detail => heard.push([type, detail])));
  S.preferSource('state', 'bottom.csv');
  assert.strictEqual(root.session.data.nodes[0].state, 'Ohio');
  S.pickSource('A', 'state', 'top.csv');
  assert.strictEqual(root.session.data.nodes[0].state, 'Texas');
  assert.deepStrictEqual(heard, [['node-values-change', 'state'], ['node-visibility', undefined], ['node-values-change', 'state'], ['node-visibility', undefined]]);
});

test('restoreData adds nodes and links, merges field lists and drops an ID field that repeats the ID', () => {
  const { root, S } = setup();
  S.restoreData({
    nodes: [{ _id: 'A', id: 'A', _seqInt: [1] }, { _id: 'B', id: 'B' }],
    links: [{ source: 'A', target: 'B' }],
    nodeFields: ['_id', 'id', 'extra'], linkFields: ['distance'], nodeExclusions: ['Z'],
  });
  const d = root.session.data;
  assert.strictEqual(d.nodes.length, 2);
  assert.ok(!('_seqInt' in d.nodes[0]));
  assert.strictEqual(d.graph.edgeCount, 1);
  assert.deepStrictEqual(d.nodeFields, ['_id', 'extra']);
  assert.deepStrictEqual(d.linkFields, ['source', 'distance']);
  assert.deepStrictEqual(d.nodeExclusions, ['Z']);
});
