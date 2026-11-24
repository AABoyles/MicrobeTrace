import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { timeoutSchema, dataLoaded, filesView, loading, summary, pending, checkSession } from './helpers.js';

const DEMO_FILES = {
  edgeList: ['Demo_outbreak_EdgeList.csv', 'link'],
  nodeList: ['Demo_outbreak_NodeList.csv', 'node'],
  sequences: ['Demo_outbreak_Sequences.fas', 'fasta'],
  distanceMatrix: ['Demo_outbreak_DistanceMatrix.csv', 'matrix'],
  tree: ['Demo_outbreak_PhylogeneticTree.nwk', 'newick']
};

export default {
  name: 'load_demo',
  title: 'Load the demo outbreak',
  description: 'Loads MicrobeTrace\'s demo outbreak (an HIV-like outbreak of about 100 nodes), replacing any current data. ' +
    'source "session" (default) opens the finished demo session (demo/Demo_outbreak_session.microbetrace), as the #demo link does. ' +
    'source "files" adds the demo\'s raw files instead (choose with files: edgeList, nodeList, sequences, distanceMatrix, tree; default edgeList + nodeList) and, unless launch is false, launches them so you can try the loading options. ' +
    'Waits for the network to load and returns the summary.',
  inputSchema: obj({
    source: { type: 'string', enum: ['session', 'files'], default: 'session' },
    files: { type: 'array', items: { type: 'string', enum: Object.keys(DEMO_FILES) }, description: 'For source "files": which demo files to add (default edgeList and nodeList)' },
    launch: bool('For source "files": launch after adding them', true),
    timeoutMs: timeoutSchema(300000)
  }),
  annotations: { consequentialHint: true },
  confirm: () => dataLoaded() || self.session.files.length ? 'Load the demo outbreak, replacing the current data and files.' : null,
  execute: async (args) => {
    const source = args.source || 'session';
    const timeout = args.timeoutMs || 300000;
    if (source == 'session') {
      const response = await fetch('demo/Demo_outbreak_session.microbetrace');
      if (!response.ok) fail('Could not fetch the demo session (HTTP ' + response.status + ')');
      const session = await response.json();
      checkSession(session);
      await loading(() => self.MT.applySession(session), timeout);
      return summary();
    }
    const keys = args.files && args.files.length ? args.files : ['edgeList', 'nodeList'];
    const bad = keys.filter(k => !DEMO_FILES[k]);
    if (bad.length) fail('Unknown demo files ' + bad.join(', ') + '. Use ' + Object.keys(DEMO_FILES).join(', '));
    const texts = await Promise.all(keys.map(async k => {
      const response = await fetch('demo/' + DEMO_FILES[k][0]);
      if (!response.ok) fail('Could not fetch demo/' + DEMO_FILES[k][0]);
      return response.text();
    }));
    if (dataLoaded() || self.session.files.length) self.MT.reset();
    const view = await filesView();
    keys.forEach((k, i) => view.add({ name: DEMO_FILES[k][0], contents: texts[i], format: DEMO_FILES[k][1] }));
    if (args.launch === false) return pending(view);
    await loading(() => view.launch(), timeout);
    return summary();
  }
};
