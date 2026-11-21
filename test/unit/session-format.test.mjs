// Unit tests for src/session-format.js. Run with: npm test
import test from 'node:test';
import assert from 'node:assert';
import { MTSessionFormat as F } from '../../src/session-format.js';

const base = () => ({ data: { nodes: [], links: [] }, style: { widgets: {} }, files: [], layout: {} });

test('a current session is valid', () => {
  const r = F.validate(Object.assign(base(), { formatVersion: F.CURRENT_VERSION }));
  assert.deepStrictEqual(r, { ok: true, version: F.CURRENT_VERSION });
});

test('a session without a version is legacy and valid', () => {
  assert.deepStrictEqual(F.validate(base()), { ok: true, version: 0 });
});

test('JSON that is not a session is rejected', () => {
  for (const v of [null, 5, 'x', [], {}, { foo: 1 }, { trace_results: {} }]) {
    assert.strictEqual(F.validate(v).ok, false);
  }
});

test('missing nodes or links is rejected', () => {
  let s = base(); delete s.data.nodes;
  assert.strictEqual(F.validate(s).ok, false);
  s = base(); s.data.links = {};
  assert.strictEqual(F.validate(s).ok, false);
});

test('a newer version is rejected with a clear message', () => {
  const r = F.validate(Object.assign(base(), { formatVersion: F.CURRENT_VERSION + 1 }));
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /newer version/);
});

test('an invalid version is rejected', () => {
  assert.strictEqual(F.validate(Object.assign(base(), { formatVersion: 'x' })).ok, false);
});
