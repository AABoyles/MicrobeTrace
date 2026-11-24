import { obj, str, bool } from '../schema.js';
import { quote, sessionText, formatSchema } from './helpers.js';

export default {
  name: 'save_session',
  title: 'Save the session',
  description: 'Saves the current session like the Save dialog: with download true it downloads a file named <filename>.<format> (or <filename>.zip with compress true) through the browser; returnContents (default true) also returns the JSON text. ' +
    'Use returnContents false with download true to avoid a large result. Formats: microbetrace (whole session), microbetracestyle (settings only), hivtrace. For just reading the JSON without downloading use get_session_json.',
  inputSchema: obj({
    format: formatSchema,
    download: bool('Download a file in the browser', false),
    filename: str('File name without extension (default: a default name from the app)'),
    compress: bool('Download as a zip (DEFLATE) holding the file', false),
    returnContents: bool('Return the JSON text in the result', true)
  }),
  annotations: { consequentialHint: true },
  confirm: args => args.download ? 'Download the session (' + (args.format || 'microbetrace') + ') as a file' + (args.filename ? ' named ' + quote(args.filename) : '') + ' to this computer.' : null,
  execute: async (args) => {
    const format = args.format || 'microbetrace';
    const data = sessionText(format);
    const result = { format, characters: data.length };
    // The Save dialog's name unless given
    if (args.download) result.downloaded = await self.MT.saveSession({ format, name: args.filename, compress: !!args.compress, data });
    if (args.returnContents !== false) result.contents = data;
    return result;
  }
};
