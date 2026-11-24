import { obj } from '../schema.js';
import { sessionText, formatSchema } from './helpers.js';

export default {
  name: 'get_session_json',
  title: 'Get the session as JSON',
  description: 'Returns the current session serialized as the Save dialog would, without downloading anything: format microbetrace (whole session; can be megabytes), microbetracestyle (just the style and settings; small), or hivtrace (the visible network as HIV-TRACE output). Use it to inspect or hand off a session, then give the text to open_session / apply_style elsewhere.',
  inputSchema: obj({ format: formatSchema }),
  annotations: { readOnlyHint: true },
  execute: async (args) => {
    const format = args.format || 'microbetrace';
    const text = sessionText(format);
    return { format, characters: text.length, contents: text };
  }
};
