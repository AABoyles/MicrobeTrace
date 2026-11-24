import { obj, bool } from '../schema.js';
import { dataLoaded, filesView, unique, checksSchema, pendingSequences } from './helpers.js';

export default {
  name: 'exclude_sequences',
  title: 'Exclude sequences from loading',
  description: 'Manages the list of node IDs left out of the network when files are launched (the Audit tab\'s Exclude buttons). ' +
    'mode: add (default) puts ids (and, with fromAudit, everything audit_sequences finds using the checks given) on the list; remove takes ids off; set replaces the list; clear empties it; list just returns it. ' +
    'Exclusions apply as nodes are loaded, so set them before launch; they do not remove nodes from a network already loaded. Returns the exclusion list.',
  inputSchema: obj({
    mode: { type: 'string', enum: ['add', 'remove', 'set', 'clear', 'list'], default: 'add' },
    ids: { type: 'array', items: { type: 'string' }, description: 'Node/sequence IDs' },
    fromAudit: bool('Also exclude every sequence the audit flags', false),
    checks: checksSchema
  }),
  annotations: { consequentialHint: true },
  execute: async (args) => {
    const list = self.session.data.nodeExclusions;
    const mode = args.mode || 'add';
    let ids = (args.ids || []).map(String);
    if (args.fromAudit) {
      const view = await filesView();
      ids = unique(ids.concat(view.auditSequences(await pendingSequences(), args.checks || {}).map(f => f.id)));
    }
    if (mode == 'add') ids.forEach(id => { if (!list.includes(id)) list.push(id); });
    else if (mode == 'remove') ids.forEach(id => { const i = list.indexOf(id); if (i > -1) list.splice(i, 1); });
    else if (mode == 'set') list.splice(0, list.length, ...unique(ids));
    else if (mode == 'clear') list.splice(0, list.length);
    return { excluded: list.slice(), count: list.length, note: dataLoaded() ? 'A network is loaded: exclusions only apply to nodes added by a later launch.' : undefined };
  }
};
