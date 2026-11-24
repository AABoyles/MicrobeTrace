import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { FORMATS, filesView, fieldProps, fieldsFor, withoutUndefined, pending } from './helpers.js';

export default {
  name: 'update_pending_file',
  title: 'Change how a pending file is read',
  description: 'Changes a pending file\'s format (link/node/matrix/fasta/newick) and/or its column choices. Changing the format re-guesses the columns, then any columns you give are applied. Columns are checked against the file\'s headers (an error lists them). Returns the pending files.',
  inputSchema: obj(Object.assign({
    name: str('The pending file\'s name'),
    format: { type: 'string', enum: FORMATS, description: 'How to read the file' }
  }, fieldProps), ['name']),
  execute: async (args) => {
    const view = await filesView();
    const file = view.list().find(f => f.name == self.MT.escape(args.name));
    if (!file) fail('No pending file is named ' + args.name + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
    const format = args.format || file.format;
    const fields = fieldsFor(args, format, file.headers);
    view.update(file.name, Object.assign({ format: args.format }, withoutUndefined(fields)));
    return Object.assign({ updated: view.list().find(f => f.name == file.name) }, pending(view));
  }
};
