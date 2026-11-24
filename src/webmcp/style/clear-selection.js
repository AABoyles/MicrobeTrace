import { obj } from '../schema.js';
import { applySelection, selectionSummary } from './helpers.js';

export default {
  name: 'clear_selection',
  title: 'Clear selection',
  description: 'Deselects every node (and empties the search box). Returns the selection summary.',
  inputSchema: obj({}),
  execute: async () => {
    const search = document.getElementById('search');
    if (search && search.value) search.value = '';
    applySelection(new Set(), 'replace');
    return selectionSummary();
  }
};
