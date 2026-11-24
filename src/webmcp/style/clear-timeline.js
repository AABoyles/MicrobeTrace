import { obj } from '../schema.js';
import { S, W, timelineState } from './helpers.js';

export default {
  name: 'clear_timeline',
  title: 'Clear global timeline',
  description: 'Turns the global timeline off (node-timeline-variable = None): hides the timeline bar and shows nodes of all dates again. Returns the timeline state.',
  inputSchema: obj({}),
  execute: async () => {
    if (W()['node-timeline-variable'] != 'None') S().set('node-timeline-variable', 'None');
    return timelineState();
  }
};
