import { fail } from '../core.js';
import { obj, str, bool } from '../schema.js';
import { FORMATS, quote, replacing, bytesOf, filesView, loading, summary, fieldProps, fieldsFor, withoutUndefined, pending, openJSON, sessionInZip } from './helpers.js';

export default {
  name: 'add_file',
  title: 'Add a data file',
  description: 'Adds a data file to the Files view\'s pending list, to be read when you call launch. ' +
    'Give the file\'s text as contents (CSV, FASTA, Newick) or, for binary files (.xlsx, .xls, .zip, or any), as contentsBase64. ' +
    'format says how to read it: link (an edge list with source/target/distance columns), node (a node list with an ID column and optionally a sequence column and any attributes), matrix (a distance matrix), fasta (sequences; links are computed from them), newick (a tree), or auto (default: guessed from the name: *.fas*/*.fasta -> fasta, *.nwk/*.newick -> newick, a name containing "node" -> node, else link). ' +
    'For link and node files, choose columns with source/target/distance or id/sequence (matched to the file\'s headers, ignoring case); unspecified columns are guessed from the headers. ' +
    'An invalid column name is an error that lists the headers. ' +
    'Files named .microbetrace, .hivtrace, or a .zip containing one, are sessions: they open immediately (replacing the current data) instead of being added; same as open_session. ' +
    'Where several files disagree about a node, the file nearest the top of the list wins (see reorder_pending_files). ' +
    'Returns the pending files with their detected headers and any problems that would block launch. Opens the Files view if it is not open.',
  inputSchema: obj(Object.assign({
    name: str('The file name, including its extension (e.g. "links.csv"). Must be unique among pending files unless replace is true'),
    contents: str('The file\'s text'),
    contentsBase64: str('The file\'s bytes, base64-encoded (use for .xlsx/.xls/.zip)'),
    format: { type: 'string', enum: ['auto'].concat(FORMATS), default: 'auto', description: 'How to read the file' },
    replace: bool('Replace a pending file of the same name instead of failing', false)
  }, fieldProps), ['name']),
  // It brings the agent's content into the page (and a session opens at once)
  confirm: args => !String(args.name || '').trim() ? fail('name is required') :
    /\.(microbetrace|hivtrace|zip)$/i.test(String(args.name).trim()) ?
    'Open the session file ' + quote(args.name) + ', which the agent supplies' + replacing() + '.' :
    'Add the file ' + quote(args.name) + ', which the agent supplies, to the files to load.',
  execute: async (args) => {
    const name = String(args.name || '').trim();
    if (!name) fail('name is required');
    if (args.contents === undefined && args.contentsBase64 === undefined) fail('Give the file\'s text as contents, or its bytes as contentsBase64');
    const extension = name.split('.').pop().toLowerCase();
    if (extension == 'microbetrace' || extension == 'hivtrace' || extension == 'zip') {
      let text = args.contents, ext = extension;
      if (extension == 'zip') {
        if (args.contentsBase64 === undefined) fail('A zip file must be given as contentsBase64');
        ({ text, extension: ext } = await sessionInZip(bytesOf(args.contentsBase64)));
      } else if (text === undefined) {
        text = new TextDecoder().decode(bytesOf(args.contentsBase64));
      }
      await loading(() => openJSON(text, ext), 300000);
      return Object.assign({ opened: 'session', name }, summary());
    }
    if (extension == 'svg') fail('SVG files are not data files; they are not supported here');
    const binary = extension == 'xlsx' || extension == 'xls';
    let contents;
    if (args.contentsBase64 !== undefined) {
      const bytes = bytesOf(args.contentsBase64);
      contents = binary ? bytes.buffer : new TextDecoder().decode(bytes);
    } else {
      if (binary) fail('Excel files must be given as contentsBase64');
      contents = args.contents;
    }
    if (binary) await self.MT.loadLibrary('xlsx');
    const view = await filesView();
    // The view stores names escaped (view.add escapes the raw name it is given), so the
    // duplicate check compares escaped names. Pass the raw name to view.add, not safeName.
    const safeName = self.MT.escape(name);
    const existing = self.session.files.find(f => f.name == safeName);
    if (existing) {
      if (!args.replace) fail('A file named ' + name + ' is already added. Use replace: true, or remove_pending_file first.');
      view.remove(safeName);
    }
    const format = args.format && args.format != 'auto' ? args.format : undefined;
    const added = view.add({ name, contents, extension, format });
    try {
      const fields = fieldsFor(args, added.format, added.headers);
      if (Object.keys(fields).length) view.update(added.name, withoutUndefined(fields));
    } catch (error) {
      view.remove(added.name);
      throw error;
    }
    return Object.assign({ added: view.list().find(f => f.name == added.name) }, pending(view));
  }
};
