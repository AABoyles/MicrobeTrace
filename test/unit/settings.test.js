// Unit tests for src/settings.js and src/events.js. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const MTSettings = require('../../src/settings.js');
const MTEvents = require('../../src/events.js');

test('settings read and write the source object', () => {
  let widgets = { a: 1 };
  const settings = new MTSettings(() => widgets);
  assert.strictEqual(settings.get('a'), 1);
  settings.set('b', 'x');
  assert.deepStrictEqual(widgets, { a: 1, b: 'x' });
  // The source is looked up each time, so a newly loaded session takes effect
  widgets = { a: 2 };
  assert.strictEqual(settings.get('a'), 2);
});

test('subscribers hear changes to their keys only, once per change', () => {
  const widgets = {};
  const settings = new MTSettings(() => widgets);
  const heard = [];
  const off = settings.subscribe(['a', 'b'], (value, key) => heard.push([key, value]));
  settings.subscribe('c', () => heard.push('c'));
  settings.set('a', 1);
  settings.set('a', 1); // unchanged
  settings.set('b', false);
  settings.set('z', 3);
  assert.deepStrictEqual(heard, [['a', 1], ['b', false]]);
  off();
  settings.set('a', 2);
  assert.deepStrictEqual(heard, [['a', 1], ['b', false]]);
});

test('a subscriber can unsubscribe while being notified', () => {
  const settings = new MTSettings(() => ({}));
  const heard = [];
  const off = settings.subscribe('a', () => { heard.push(1); off(); });
  settings.subscribe('a', () => heard.push(2));
  settings.set('a', 1);
  settings.set('a', 2);
  assert.deepStrictEqual(heard, [1, 2, 2]);
});

test('events reach listeners until they stop listening', () => {
  const events = new MTEvents();
  const heard = [];
  const off = events.on('node-color-change', detail => heard.push(detail));
  events.emit('node-color-change', { field: 'group' });
  off();
  events.emit('node-color-change');
  assert.deepStrictEqual(heard, [{ field: 'group' }]);
});

test('unknown events are refused', () => {
  const events = new MTEvents();
  assert.throws(() => events.on('node-colour-change', () => {}), /Unknown MicrobeTrace event/);
  assert.throws(() => events.emit('nope'), /Unknown MicrobeTrace event/);
});

test('reload calls only the subscribers that ask for it', () => {
  let widgets = { a: 1 };
  const settings = new MTSettings(() => widgets);
  const shown = [], acted = [];
  settings.subscribe('a', value => shown.push(value), { reload: true });
  settings.subscribe('a', value => acted.push(value));
  widgets = { a: 2 };
  settings.reload();
  assert.deepStrictEqual([shown, acted], [[2], []]);
  settings.set('a', 3);
  assert.deepStrictEqual([shown, acted], [[2, 3], [3]]);
});

test('event details reach listeners', () => {
  const events = new MTEvents();
  const heard = [];
  events.on('node-selected', detail => heard.push(detail));
  events.emit('node-selected', 'heatmap');
  events.emit('node-selected');
  assert.deepStrictEqual(heard, ['heatmap', undefined]);
});
