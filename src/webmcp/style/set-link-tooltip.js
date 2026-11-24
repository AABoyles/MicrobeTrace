import { obj, str } from '../schema.js';
import { T, checkVariable, applyAll, result } from './helpers.js';

export default {
  name: 'set_link_tooltip',
  title: 'Set link tooltip',
  description: 'Chooses the link field the network view\'s hover tooltip shows for links (link-tooltip-variable); "None" for no tooltip. Returns the settings changed.',
  inputSchema: obj({ variable: str('Link field, or "None"') }, ['variable']),
  execute: async ({ variable }) => {
    T.requireData();
    return result(await applyAll({ 'link-tooltip-variable': checkVariable('link', variable) }));
  }
};
