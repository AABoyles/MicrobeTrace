import { obj } from '../schema.js';
import { T, counts } from './helpers.js';

export default {
  name: 'reveal_all',
  title: 'Reveal everything',
  description: 'Does what Settings > Filtering > Hidden Elements > Show All Hidden does: sets the minimum cluster size to 1 and makes every cluster, node and link visible regardless of the cluster-size filter (the link threshold setting is unchanged). Returns the visible counts.',
  inputSchema: obj({}),
  execute: async () => {
    T.requireData();
    self.MT.revealAll();
    return { counts: counts() };
  }
};
