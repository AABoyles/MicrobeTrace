import { obj } from '../schema.js';
import { pending } from './helpers.js';

export default {
  name: 'list_pending_files',
  title: 'List pending files',
  description: 'Lists the files that will be read by launch (or that were read to build the loaded network): name, extension, format (link/node/matrix/fasta/newick), the columns chosen (field1/field2/field3: source/target/distance for links, id/sequence for nodes), the file\'s headers, and any problem that blocks launching it. Order matters: where files disagree about a node, the first wins. Opens the Files view only if it is already open; otherwise lists what the session holds.',
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  execute: async () => {
    const view = self.MT.filesView;
    if (view) return Object.assign({ filesViewOpen: true }, pending(view));
    return {
      filesViewOpen: false,
      pendingFiles: (self.session ? self.session.files : []).map(f => ({ name: f.name, extension: f.extension, format: f.format, field1: f.field1, field2: f.field2, field3: f.field3 })),
      note: 'The Files view is closed (a network is loaded), so headers and problems are not shown. add_file opens it.'
    };
  }
};
