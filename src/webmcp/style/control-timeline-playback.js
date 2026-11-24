import { fail } from '../core.js';
import { obj } from '../schema.js';
import { W, timelineState } from './helpers.js';

export default {
  name: 'control_timeline_playback',
  title: 'Play or pause timeline',
  description: 'Plays or pauses the global timeline animation (the handle advances over the dates, 5 steps per second, restarting from the start once at the end). The timeline must be on (set_timeline with a variable). Returns the timeline state.',
  inputSchema: obj({ action: { type: 'string', enum: ['play', 'pause'] } }, ['action']),
  execute: async ({ action }) => {
    if (W()['node-timeline-variable'] === 'None') fail('The timeline is not on. Use set_timeline with a date field first');
    if (typeof self.MT.setTimelinePlaying !== 'function') fail('The timeline is not drawn yet. Use set_timeline with a date field first');
    self.MT.setTimelinePlaying(action === 'play');
    return timelineState();
  }
};
