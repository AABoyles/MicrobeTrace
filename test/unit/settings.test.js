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

test('events relay the jQuery-triggered versions, and emit fires them for old listeners', () => {
  // A minimal stand-in for jQuery's on/trigger on window
  const handlers = {};
  const jQuery = () => ({
    on(types, fn) { types.split(' ').forEach(t => (handlers[t] = handlers[t] || []).push(fn)); },
    trigger(type) { (handlers[type] || []).forEach(fn => fn({ type })); }
  });
  const events = new MTEvents(jQuery);
  let heard = 0, old = 0;
  events.on('link-color-change', () => heard++);
  jQuery().on('link-color-change', () => old++);
  // An old sender: $window.trigger('link-color-change')
  jQuery().trigger('link-color-change');
  assert.deepStrictEqual([heard, old], [1, 1]);
  // A new sender reaches both, once each
  events.emit('link-color-change');
  assert.deepStrictEqual([heard, old], [2, 2]);
});
