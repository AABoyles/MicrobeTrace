import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, S, W, nodes, checkVariable, timelineState, dateFields } from './helpers.js';

export default {
  name: 'set_timeline',
  title: 'Set global timeline',
  description: 'Turns on the global timeline for a node date field and/or moves its handle. The timeline shows the network as of a date: nodes dated after the handle are hidden (undated nodes stay), in every view. ' +
    'Give variable to start the timeline on that field (this shows the timeline bar at the bottom and starts with the handle at the end, showing every node), ' +
    'and date (any date text such as "2020-06-15") or position (0..1 along the timeline) to scrub the handle there. ' +
    'Returns the timeline state (variable, start, end, target, counts). Requires loaded data with a date field.',
  inputSchema: obj({
    variable: str('Node field holding dates to run the timeline on (node-timeline-variable)'),
    date: str('Date to move the handle to, e.g. "2020-06-15"; the network shows nodes dated on or before it'),
    position: num('Alternatively, where to put the handle: 0 is the start, 1 the end', { minimum: 0, maximum: 1 })
  }),
  execute: async ({ variable, date, position }) => {
    T.requireData();
    if (variable === undefined && date === undefined && position === undefined) fail('Give variable, date or position');
    if (variable !== undefined) {
      const f = checkVariable('node', variable, { allowNone: false });
      const dated = nodes().filter(d => self.MT.parseDate(d[f])).length;
      if (dated < 2) fail('Node field ' + f + ' has fewer than two dates. Date-like fields: ' + (dateFields().join(', ') || '(none found)'));
      if (W()['node-timeline-variable'] !== f) S().set('node-timeline-variable', f);
    }
    if (date !== undefined || position !== undefined) {
      if (W()['node-timeline-variable'] === 'None' || !self.MT.scrubTimeline) fail('The timeline is not on. Pass variable (a date field) to start it');
      let when;
      if (date !== undefined) {
        when = self.MT.parseDate(date);
        if (!when) fail('Not a date: ' + JSON.stringify(date));
      } else {
        const a = self.MT.parseDate(self.session.state.timeStart), b = self.MT.parseDate(self.session.state.timeTarget);
        when = new Date(a.getTime() + position * (b.getTime() - a.getTime()));
      }
      self.MT.scrubTimeline(when);
    }
    return timelineState();
  }
};
