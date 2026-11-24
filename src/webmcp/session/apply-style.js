import { fail } from '../core.js';
import { obj, str } from '../schema.js';

export default {
  name: 'apply_style',
  title: 'Apply a style file',
  description: 'Applies a .microbetracestyle (the style part of a session: colors, view settings, widget values) to the current session and to the views that are open. Give it as JSON text in contents, or as an object in style. A style is what save_session with format microbetracestyle produces. Returns the number of settings in it.',
  inputSchema: obj({
    contents: str('The style file\'s JSON text'),
    style: { type: 'object', description: 'The style as an object (alternatively to contents)' }
  }),
  confirm: () => 'Apply a style, which the agent supplies, replacing the current colors, view settings and other settings.',
  execute: async (args) => {
    let style = args.style;
    if (!style) {
      if (args.contents === undefined) fail('Give the style as contents (JSON text) or style (an object)');
      try { style = JSON.parse(args.contents); } catch (error) { fail('That is not valid JSON: ' + error.message); }
    }
    if (!style || typeof style !== 'object' || typeof style.widgets !== 'object') fail('That is not a MicrobeTrace style: it needs a "widgets" object (save one with save_session, format microbetracestyle).');
    const MT = self.MT;
    MT.applyStyle(style);
    if (MT.showColorTable) { MT.showColorTable('node'); MT.showColorTable('link'); }
    ['background-color-change', 'selected-color-change', 'node-border-change', 'node-color-change', 'link-color-change'].forEach(type => MT.events.emit(type));
    return { applied: true, widgets: Object.keys(style.widgets).length };
  }
};
