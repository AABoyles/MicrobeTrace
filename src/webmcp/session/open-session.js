import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { timeoutSchema, replacing, bytesOf, loading, summary, openJSON, sessionInZip } from './helpers.js';

export default {
  name: 'open_session',
  title: 'Open a session file',
  description: 'Opens a saved session, replacing the current data: a MicrobeTrace session (.microbetrace JSON), an HIV-TRACE output (.hivtrace/.json with trace_results) or a GHOST output, given as text in contents, or a zip containing one as contentsBase64. extension (microbetrace, hivtrace, zip) is guessed from the content when auto. ' +
    'Waits for the network to load and returns the summary.',
  inputSchema: obj({
    contents: str('The file\'s JSON text'),
    contentsBase64: str('The file\'s bytes, base64-encoded (for a zip)'),
    extension: { type: 'string', enum: ['auto', 'microbetrace', 'hivtrace', 'zip'], default: 'auto' },
    timeoutMs: timeoutSchema(300000)
  }),
  annotations: { consequentialHint: true },
  confirm: () => 'Open a session file, which the agent supplies' + replacing() + '.',
  execute: async (args) => {
    if (args.contents === undefined && args.contentsBase64 === undefined) fail('Give the session as contents (JSON text) or contentsBase64 (a zip)');
    let text = args.contents, extension = args.extension || 'auto';
    if (args.contentsBase64 !== undefined) {
      const bytes = bytesOf(args.contentsBase64);
      if (extension === 'zip' || (extension === 'auto' && bytes[0] === 0x50 && bytes[1] === 0x4b)) ({ text, extension } = await sessionInZip(bytes));
      else text = new TextDecoder().decode(bytes);
    } else if (extension === 'zip') {
      fail('A zip must be given as contentsBase64');
    }
    await loading(() => openJSON(text, extension), args.timeoutMs || 300000);
    return summary();
  }
};
