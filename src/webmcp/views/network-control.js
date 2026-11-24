import { fail, waitFor } from '../core.js';
import { GRAPH_WAIT_MS, settle, need, networkHandle, networkState } from './helpers.js';

export default {
  name: 'network_control',
  title: 'Control network view',
  description: 'Controls the 2D network view\'s camera and layout simulation. action: "fit" (center and scale the network to the view), "zoom" (set zoom level; level 1 is default, bigger is closer), "pin_all" / "unpin_all" (fix every node where it is / let the force layout move them again), "freeze" (pause the force simulation without pinning), "resume" (restart the simulation), "reheat" (restart with more energy to re-spread nodes). Opens the network view if needed. Returns the network\'s state (nodes, zoom, pinned).',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['fit', 'zoom', 'pin_all', 'unpin_all', 'freeze', 'resume', 'reheat'] },
      level: { type: 'number', minimum: 0.01, maximum: 100, description: 'For zoom: the zoom level' },
      duration: { type: 'integer', minimum: 0, description: 'Animation time in ms for fit/zoom (default 300)' }
    },
    required: ['action'],
    additionalProperties: false
  },
  execute: async ({ action, level, duration = 300 }) => {
    const item = await need('network', { open: true, show: true });
    void item;
    await waitFor(() => self.temp && self.temp.network && self.temp.network.graph, { timeout: GRAPH_WAIT_MS, message: 'The network graph did not start' });
    const h = networkHandle();
    const g = h.graph;
    switch (action) {
      case 'fit': h.fit(); break;
      case 'zoom':
        if (typeof level !== 'number') fail('zoom needs a level');
        if (typeof g.setZoomLevel !== 'function') fail('This network build cannot set a zoom level; use fit.');
        g.setZoomLevel(level, duration);
        break;
      case 'pin_all': if (!self.session.network.allPinned) h.pinAll(); break;
      case 'unpin_all': if (self.session.network.allPinned) h.pinAll(); break;
      case 'freeze': g.pause(); break;
      case 'resume': g.start(0.3); break;
      case 'reheat': g.start(1); break;
    }
    await settle(action === 'fit' ? 900 : 300);
    return Object.assign({ action }, networkState(networkHandle()));
  }
};
