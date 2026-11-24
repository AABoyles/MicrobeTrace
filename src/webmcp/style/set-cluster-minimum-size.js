import { fail } from '../core.js';
import { obj } from '../schema.js';
import { T, counts, applySetting } from './helpers.js';

export default {
  name: 'set_cluster_minimum_size',
  title: 'Set minimum cluster size',
  description: 'Hides every cluster (connected group of nodes) with fewer nodes than this (cluster-minimum-size; 1 shows everything including singletons, 2 hides singletons). ' +
    'Updates node, link and cluster visibility immediately. Returns the new visible counts. Requires loaded data.',
  inputSchema: obj({ size: { type: 'integer', minimum: 1, description: 'Smallest cluster size to keep visible' } }, ['size']),
  execute: async ({ size }) => {
    T.requireData();
    if (!Number.isInteger(size) || size < 1) fail('size must be an integer >= 1');
    const r = await applySetting('cluster-minimum-size', size);
    return { changed: r.changed, old: r.old, new: size, counts: counts() };
  }
};
