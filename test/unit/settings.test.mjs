// Unit tests for src/settings.js and src/events.js. Run with: npm test
import test from 'node:test';
import assert from 'node:assert';
import { MTSettings, MTViewSettings } from '../../src/settings.js';
import { MTEvents } from '../../src/events.js';

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

test('a second copy of a view keeps its own settings apart, and shares the rest (#365)', () => {
  const widgets = { 'map-shade': 'states', 'node-color': '#000000' };
  const settings = new MTSettings(() => widgets);
  const second = new MTViewSettings(settings, 'map-', 2, { 'map-shade': 'none', 'map-states-show': true });
  // Its own start as the defaults, not as the first copy's
  assert.strictEqual(second.get('map-shade'), 'none');
  assert.strictEqual(second.get('node-color'), '#000000');
  second.set('map-shade', 'counties');
  second.set('node-color', '#ffffff');
  assert.deepStrictEqual(widgets, { 'map-shade': 'states', 'node-color': '#ffffff', 'map-shade@2': 'counties' });
  // Setting a default it already has stores nothing
  second.set('map-states-show', true);
  assert.ok(!('map-states-show@2' in widgets));
});

test('a second copy of a view hears its own settings and the shared ones, by their plain keys (#365)', () => {
  const widgets = {};
  const settings = new MTSettings(() => widgets);
  const second = new MTViewSettings(settings, 'map-', 2);
  const heard = [];
  const off = second.subscribe(['map-shade', 'node-color'], (value, key) => heard.push([key, value]), { reload: true });
  settings.set('map-shade', 'states');
  second.set('map-shade', 'counties');
  settings.set('node-color', '#ffffff');
  assert.deepStrictEqual(heard, [['map-shade', 'counties'], ['node-color', '#ffffff']]);
  settings.reload();
  assert.strictEqual(heard.length, 4);
  off();
  second.set('map-shade', 'none');
  assert.strictEqual(heard.length, 4);
});
