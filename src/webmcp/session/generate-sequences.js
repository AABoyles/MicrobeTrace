import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { timeoutSchema, dataLoaded, filesView, loading, summary, pending } from './helpers.js';

export default {
  name: 'generate_sequences',
  title: 'Generate random sequences',
  description: 'Adds a node file of randomly generated, related sequences (as the Files view\'s Generate button does) as generatedNodes.csv, or as generatedNodes-1.csv, -2 and so on when there are too many for one file (replacing those generated before), useful for trying MicrobeTrace without data. Link distances are then computed from the sequences at launch; hundreds of thousands take minutes. ' +
    'With launch true, launches immediately and returns the network summary; otherwise returns the pending files.',
  inputSchema: obj({
    count: { type: 'integer', minimum: 1, maximum: self.MT.maxGeneratedSequences, default: 100, description: 'How many sequences to generate (at most ' + self.MT.maxGeneratedSequences.toLocaleString('en-US') + ', as the Generate button)' },
    launch: bool('Launch right after adding', false),
    timeoutMs: timeoutSchema(300000)
  }),
  annotations: { consequentialHint: true },
  confirm: args => args.launch && dataLoaded() ? 'Generate random sequences and launch them, replacing the network loaded now.' : null,
  execute: async (args) => {
    const view = await filesView();
    try {
      view.generate(args.count == null ? 100 : args.count);
    } catch (e) {
      fail(e.message);
    }
    if (!args.launch) return pending(view);
    const problems = view.problems();
    if (problems.length) fail('Fix these files before launching: ' + problems.map(p => p.name + ': ' + p.problem).join(' | '));
    await loading(() => view.launch(), args.timeoutMs || 300000);
    return summary();
  }
};
