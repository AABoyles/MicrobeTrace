import { obj } from '../schema.js';
import { STRATEGIES, viewNames, readOptions } from './helpers.js';

const metricsInfo = () => Object.keys(self.MT.distanceMetrics).map(k => {
  const m = self.MT.distanceMetrics[k];
  return { id: k, label: m.label, defaultThreshold: m.threshold, countsSites: !!m.count };
});

export default {
  name: 'get_loading_options',
  title: 'Get loading options',
  description: 'Reads the settings that control how files are turned into a network (the Files view\'s settings), with the valid values for each. They apply the next time launch runs. ' +
    'distanceMetric: which genetic distance builds links from sequences (also the name distances in link files are stored under); distanceMetricsAlso: other metrics to compute too; linkThreshold: the largest distance that counts as linked (each metric has its own default); ' +
    'ambiguityStrategy / ambiguityThreshold: how ambiguous bases (N, R, Y...) are handled; linkStorage: keep every pair\'s distance or only links within the threshold (auto decides by size); defaultView: the view shown after launch; inferDirectionality; ' +
    'alignment (none or smith-waterman) with referenceSource (consensus, the default, is derived from the loaded sequences; first: the first sequence; file: a reference sequence) and aligner scores. Use set_loading_options to change them.',
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  execute: async () => ({
    options: readOptions(),
    valid: {
      distanceMetric: metricsInfo(),
      ambiguityStrategy: STRATEGIES,
      linkStorage: { auto: 'Decide by network size', all: 'Keep all pairs (more memory; threshold can be raised later)', threshold: 'Only links within the link threshold (less memory)' },
      defaultView: viewNames(),
      alignment: ['none', 'smith-waterman'],
      referenceSource: ['file', 'first', 'consensus']
    },
    note: 'These apply to the next launch; they do not recompute a loaded network. For filtering a loaded network use the settings tools.'
  })
};
