// Unit tests for src/nodes.js. Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const MTNodeSources = require('../../src/nodes.js');

// Two node tables and a FASTA, as three files listed top to bottom
function three() {
  const sources = new MTNodeSources();
  const top = sources.add('nodes.csv', 0), middle = sources.add('meta.xlsx', 1), bottom = sources.add('seqs.fasta', 2);
  top.add('S1', { state: 'Texas', date: '2020-01-04', lat: 31 });
  top.add('S2', { state: 'Utah', date: '', lat: null });
  middle.add('S1', { state: 'Ohio', date: '2020-01-05', lat: '31.00' });
  middle.add('S2', { state: 'Utah', date: '2020-02-01', lat: 40 });
  bottom.add('S1', { seq: 'ACGT' });
  return { sources, top, middle, bottom };
}

test('the top source wins, and a source without a value leaves it to the next', () => {
  const { sources } = three();
  assert.strictEqual(sources.resolve('S1', 'state'), 'Texas');
  assert.strictEqual(sources.resolve('S2', 'date'), '2020-02-01'); // empty at the top
  assert.strictEqual(sources.resolve('S2', 'lat'), 40); // null at the top
  assert.strictEqual(sources.resolve('S1', 'seq'), 'ACGT'); // only at the bottom
  assert.strictEqual(sources.resolve('S3', 'state'), undefined);
});

test('ranks, not the order sources were added, decide', () => {
  const sources = new MTNodeSources();
  const later = sources.add('second.csv', 1), first = sources.add('first.csv', 0);
  later.add('S1', { state: 'Ohio' });
  first.add('S1', { state: 'Texas' });
  assert.strictEqual(sources.resolve('S1', 'state'), 'Texas');
  assert.deepStrictEqual(sources.ranked().map(s => s.name), ['first.csv', 'second.csv']);
});

test('provenance lists each source\'s value, best first, marking the one used', () => {
  const { sources } = three();
  assert.deepStrictEqual(sources.provenance('S1', 'state'), [
    { source: 'nodes.csv', row: 0, value: 'Texas', used: true },
    { source: 'meta.xlsx', row: 0, value: 'Ohio', used: false }
  ]);
  assert.deepStrictEqual(sources.provenance('S2', 'date'), [{ source: 'meta.xlsx', row: 1, value: '2020-02-01', used: true }]);
  assert.deepStrictEqual(sources.provenance('S9', 'date'), []);
});

test('conflicts lists the nodes whose sources disagree, counting 31 and "31.00" as the same', () => {
  const { sources } = three();
  const conflicts = sources.conflicts();
  assert.deepStrictEqual([...conflicts.keys()].sort(), ['date', 'state']);
  assert.deepStrictEqual(conflicts.get('state'), ['S1']);
  assert.deepStrictEqual(conflicts.get('date'), ['S1']); // S2's top date is empty, not different
  assert.strictEqual(conflicts.has('lat'), false);
  assert.strictEqual(new MTNodeSources().conflicts().size, 0);
});

test('a key repeated within a source keeps its first row, which later rows fill in', () => {
  const sources = new MTNodeSources();
  const file = sources.add('nodes.csv', 0);
  assert.strictEqual(file.add('S1', { state: 'Texas', date: '' }), 0);
  assert.strictEqual(file.add('S1', { state: 'Ohio', date: '2020-01-04', group: 'g1' }), 0);
  assert.strictEqual(file.add('S2', { state: 'Utah' }), 1);
  assert.strictEqual(sources.resolve('S1', 'state'), 'Texas');
  assert.strictEqual(sources.resolve('S1', 'date'), '2020-01-04');
  assert.strictEqual(sources.resolve('S1', 'group'), 'g1');
  // A field first seen on a later row leaves earlier rows without it
  assert.strictEqual(sources.resolve('S2', 'group'), undefined);
  assert.strictEqual(file.columns.get('group').length, 1);
});

test('reset forgets every source', () => {
  const { sources } = three();
  sources.reset();
  assert.strictEqual(sources.resolve('S1', 'state'), undefined);
  assert.strictEqual(sources.ranked().length, 0);
});

test('same compares numbers as numbers and text without surrounding spaces', () => {
  const { same } = MTNodeSources;
  assert.strictEqual(same(31, '31.00'), true);
  assert.strictEqual(same('Texas', ' Texas '), true);
  assert.strictEqual(same('Texas', 'texas'), false);
  assert.strictEqual(same(31, 32), false);
});

// The nodes as MicrobeTrace has them: each field the value used
const resolved = sources => {
  const nodes = new Map();
  sources.list.forEach(s => s.rowOf.forEach((row, key) => {
    const node = nodes.get(key) || { _id: key };
    s.columns.forEach((column, field) => { node[field] = sources.resolve(key, field); });
    nodes.set(key, node);
  }));
  return nodes;
};

test('saved and restored, sources give the same values, provenance and conflicts', () => {
  const { sources } = three();
  const nodes = resolved(sources);
  const saved = JSON.parse(JSON.stringify(sources.save(key => nodes.get(key))));
  const restored = MTNodeSources.restore(saved, key => nodes.get(key));
  assert.deepStrictEqual(restored.ranked().map(s => [s.name, s.rank]), [['nodes.csv', 0], ['meta.xlsx', 1], ['seqs.fasta', 2]]);
  for (const key of ['S1', 'S2']) {
    for (const field of ['state', 'date', 'lat', 'seq']) {
      assert.deepStrictEqual(restored.provenance(key, field), sources.provenance(key, field), `${key} ${field}`);
    }
  }
  assert.deepStrictEqual(restored.conflicts(), sources.conflicts());
});

test('a saved value the node has is 1, one it does not is kept, and none is 0', () => {
  const { sources } = three();
  const nodes = resolved(sources);
  const saved = sources.save(key => nodes.get(key));
  const meta = saved.sources.find(s => s.name == 'meta.xlsx');
  assert.deepStrictEqual(meta.keys, ['S1', 'S2']);
  assert.deepStrictEqual(meta.columns.state, [['Ohio'], 1]); // S1 uses Texas; S2's Utah agrees
  assert.deepStrictEqual(meta.columns.date, [['2020-01-05'], 1]);
  const top = saved.sources.find(s => s.name == 'nodes.csv');
  assert.deepStrictEqual(top.columns.date, [1, 0]); // S2's top date is empty
});

test('a value saved as 1 for a node that is gone is no value', () => {
  const { sources } = three();
  const nodes = resolved(sources);
  const saved = sources.save(key => nodes.get(key));
  const restored = MTNodeSources.restore(saved, key => key == 'S1' ? nodes.get(key) : undefined);
  assert.strictEqual(restored.resolve('S2', 'state'), undefined);
  assert.strictEqual(restored.resolve('S1', 'state'), 'Texas');
});

test('restoring nothing, or something else, gives no sources', () => {
  assert.strictEqual(MTNodeSources.restore(undefined).list.length, 0);
  assert.strictEqual(MTNodeSources.restore({ version: 1 }).list.length, 0);
  assert.deepStrictEqual(new MTNodeSources().save(), { version: 1, sources: [] });
});
