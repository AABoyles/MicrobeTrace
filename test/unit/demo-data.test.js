// The demo outbreak in demo/ (#297). The saved session that #demo and the WebMCP demo tool load
// must use the node list's field names, and none of them may be a name MicrobeTrace keeps for
// itself (INTERNAL in src/webmcp/query/helpers.js), or the session's values are read as computed ones.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../../src/session-format.js').MTSessionFormat;

const demo = name => path.join(__dirname, '..', '..', 'demo', name);
const lines = text => text.split(/\r?\n/).filter(line => line !== '');
const read = name => fs.readFileSync(demo(name), 'utf8');

// The query tools keep their list in a module, so the literal is read from its source
const queryJS = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'webmcp', 'query', 'helpers.js'), 'utf8');
const internal = new Function('return ' + queryJS.match(/const INTERNAL = (\[[^\]]*\]);/)[1])();
const isInternal = field => internal.includes(field) || field[0] === '_';

// The fields MicrobeTrace writes on every node itself, rather than from the file's columns
const appFields = ['index', '_id', 'selected', 'cluster', 'visible', 'degree', 'origin', 'seq', '_diff', '_ambiguity'];

const nodeListHeader = lines(read('Demo_outbreak_NodeList.csv'))[0].split(',');
const nodeListIds = lines(read('Demo_outbreak_NodeList.csv')).slice(1).map(line => line.split(',')[0]);
// The FASTA has two sequences that are not in the node list: they load as nodes with only a sequence
const fastaIds = lines(read('Demo_outbreak_Sequences.fas')).filter(line => line[0] === '>').map(line => line.slice(1));
const session = JSON.parse(read('Demo_outbreak_session.microbetrace'));

test('the demo session is a session this version opens', () => {
  assert.deepStrictEqual(F.validate(session), { ok: true, version: F.CURRENT_VERSION });
});

test('the demo session was read from the current node list and FASTA', () => {
  // The session keeps the files as they were loaded, so their columns show the source
  assert.deepStrictEqual(session.files.map(file => file.name), ['Demo_outbreak_NodeList.csv', 'Demo_outbreak_Sequences.fas']);
  assert.deepStrictEqual(lines(session.files[0].contents)[0].split(',').map(f => f.trim()), nodeListHeader);
});

test('the demo session has a node for every ID in the node list or the FASTA', () => {
  const expected = new Set([...nodeListIds, ...fastaIds]);
  assert.strictEqual(expected.size, 88);
  const ids = session.data.nodes.map(node => node._id);
  assert.strictEqual(ids.length, expected.size);
  assert.deepStrictEqual(ids.filter(id => !expected.has(id)), []);
  // Every link joins two of the nodes
  const known = new Set(ids);
  assert.deepStrictEqual(session.data.links.filter(link => !known.has(link.source) || !known.has(link.target)), []);
});

test('no column of the demo node list is a name MicrobeTrace keeps for itself', () => {
  // anyID is the ID and sequence the sequence: the app stores them as _id and seq
  const columns = nodeListHeader.filter(field => field !== 'anyID' && field !== 'sequence');
  assert.deepStrictEqual(columns.filter(isInternal), []);
  assert.ok(isInternal('degree') && isInternal('cluster') && isInternal('_diff'), 'the INTERNAL list was not read');
});

test('the demo session has no field that collides with an internal name', () => {
  const unknown = session.data.nodeFields.filter(field => !nodeListHeader.includes(field) && !appFields.includes(field));
  assert.deepStrictEqual(unknown, []);
  for (const node of session.data.nodes) {
    assert.strictEqual(typeof node._id, 'string');
    assert.ok(!('id' in node), 'a node still has the 2019 id field');
  }
});

test('the demo files have no IDs with surrounding spaces', () => {
  const nodeIds = lines(read('Demo_outbreak_NodeList.csv')).slice(1).map(line => line.split(',')[0]);
  const matrix = lines(read('Demo_outbreak_DistanceMatrix.csv')).map(line => line.split(','));
  const edges = lines(read('Demo_outbreak_EdgeList.csv')).slice(1).map(line => line.split(',')).flat();
  const spaced = [...nodeIds, ...matrix[0].slice(1), ...matrix.slice(1).map(row => row[0]), ...edges]
    .filter(id => id !== id.trim());
  assert.deepStrictEqual(spaced, []);
});
