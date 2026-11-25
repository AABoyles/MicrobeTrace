// workers/compute-directionality.js (#170): which links the tree says to turn
// around, run as the app runs it (a tree from patristic, and the link's source
// and target node IDs). Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const patristic = require('../../vendor/patristic.min.js');
const { runWorker } = require('../golden/harness.js');

// The rule the worker applies (patristic's Branch.sources): a link is turned when
// its target is nearer the common ancestor of the two than its source is, by path
// length. So every link ends at the endpoint further from their common ancestor.
//
//            R
//          /   \
//       X:2     C:4
//      /   \
//    A:1   B:3
//
// Path lengths from the common ancestor: A from X is 1, B from X is 3, X from X
// is 0, A from R is 3, C from R is 4, X from R is 2, B from R is 5.
const TREE = '((A:1,B:3)X:2,C:4)R;';

// Each row: [source, target, flip, why]. flip is 1 when the link is turned.
const CASES = [
  ['X', 'A', 0, 'ancestor to descendant already points at the tip: kept'],
  ['A', 'X', 1, 'tip to ancestor: turned, so it runs from X to A'],
  ['X', 'B', 0, 'ancestor to descendant (the other tip): kept'],
  ['B', 'X', 1, 'tip to ancestor: turned'],
  ['A', 'B', 0, 'siblings: B is further from X (3 against 1), so A to B is kept'],
  ['B', 'A', 1, 'siblings: A is nearer X, so B to A is turned'],
  ['A', 'C', 0, 'cousins: C is 4 from R, A is 3, so A to C is kept'],
  ['C', 'A', 1, 'cousins: A is nearer R, so C to A is turned'],
  ['A', 'R', 1, 'to the root: the root is nearer, so the link is turned'],
  ['A', 'A', 0, 'a node with itself: distances are equal, so kept'],
  ['R', 'A', 0, 'from the root: already points at the tip, so kept (patristic 0.6 threw here)'],
];

// Runs the worker on several links at once
async function flips(tree, links) {
  const out = await runWorker('workers/compute-directionality.js', {
    sources: links.map(l => l[0]),
    targets: links.map(l => l[1]),
    tree: patristic.parseNewick(tree).toObject(),
  });
  return Array.from(new Uint8Array(out.output));
}

test('each link is turned when its target is nearer the common ancestor', async () => {
  for (const [source, target, flip, why] of CASES) {
    const [got] = await flips(TREE, [[source, target]]);
    assert.strictEqual(got, flip, `${source} -> ${target}: ${why}`);
  }
});

test('one message returns one flag per link, in the order they were sent', async () => {
  const got = await flips(TREE, CASES);
  assert.deepStrictEqual(got, CASES.map(c => c[2]));
});

test('links between tips at equal distance from their common ancestor are not turned', async () => {
  // P is the common ancestor of Q and S, which are both 2 from it
  const links = [['Q', 'S'], ['S', 'Q']];
  assert.deepStrictEqual(await flips('(Q:2,S:2)P:1;', links), [0, 0]);
});

test('a link to a node that is not in the tree is not turned, and does not stop the rest', async () => {
  const got = await flips(TREE, [['nope', 'A'], ['A', 'X'], ['A', 'nope2']]);
  assert.deepStrictEqual(got, [0, 1, 0]);
});

test('no links gives no flags', async () => {
  assert.deepStrictEqual(await flips(TREE, []), []);
});
