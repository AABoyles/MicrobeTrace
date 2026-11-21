// Unit tests for src/events.js. Run with: node --test test/unit
import test from 'node:test';
import assert from 'node:assert';
import { MTEvents } from '../../src/events.js';

test('emitTogether runs a function that listens to several of the events once', () => {
  const events = new MTEvents();
  let both = 0, link = 0, node = 0;
  const redraw = () => both++;
  events.on('link-visibility', redraw);
  events.on('node-visibility', redraw);
  events.on('link-visibility', () => link++);
  events.on('node-visibility', () => node++);
  events.emitTogether(['cluster-visibility', 'link-visibility', 'node-visibility']);
  assert.deepStrictEqual([both, link, node], [1, 1, 1]);
  // (Alone, each still runs for each)
  events.emit('link-visibility');
  events.emit('node-visibility');
  assert.strictEqual(both, 3);
  // ...and the next together runs it again
  events.emitTogether(['link-visibility', 'node-visibility']);
  assert.strictEqual(both, 4);
});

test('emitTogether ends, and passes what a listener throws on, as emit does', () => {
  const events = new MTEvents();
  let ran = 0;
  events.on('link-visibility', () => ran++);
  assert.throws(() => events.emitTogether(['link-visibility', 'nope']), /Unknown MicrobeTrace event/);
  assert.strictEqual(events.together, null);
  events.emit('link-visibility');
  events.emit('link-visibility');
  assert.strictEqual(ran, 3);
});
