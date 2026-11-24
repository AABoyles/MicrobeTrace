import { obj } from '../schema.js';
import { T, readOnly, timelineState, dateFields } from './helpers.js';

export default {
  name: 'get_timeline',
  title: 'Get global timeline',
  description: 'Reports the global timeline: the variable (None when off), start/end/target dates (end is where the handle is, target the last date), whether it is playing, and node counts. Also lists the node fields that look like dates.',
  inputSchema: obj({}),
  annotations: readOnly,
  execute: async () => { T.requireData(); return Object.assign(timelineState(), { dateFields: dateFields() }); }
};
