import { obj, str } from '../schema.js';
import { T, checkVariable, applyAll, result } from './helpers.js';

export default {
  name: 'label_links',
  title: 'Label links',
  description: 'Shows a link field as text on links in the network view (link-label-variable); "None" hides link labels. Returns the settings changed.',
  inputSchema: obj({ variable: str('Link field to label with, or "None"') }, ['variable']),
  execute: async ({ variable }) => {
    T.requireData();
    return result(await applyAll({ 'link-label-variable': checkVariable('link', variable) }));
  }
};
