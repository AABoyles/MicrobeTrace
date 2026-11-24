import { fail } from '../core.js';
import { obj, str, bool } from '../schema.js';
import { T, S, W, nodes, checkVariable, applySelection, selectionSummary, modeSchema } from './helpers.js';

export default {
  name: 'search_nodes',
  title: 'Search nodes',
  description: 'Selects the nodes whose field matches a query, with the same semantics as the search box: the query is a regular expression (unless literal: true), strings are tested with it, numbers match when their text equals the query, nodes with empty values do not match. ' +
    'field defaults to the search box\'s field (search-field). caseSensitive and wholeWord mirror the box\'s toggle buttons. ' +
    'mirrorSearchBox: true instead drives the real search box (setting search-field, case and whole-word settings and its text; replace mode only), so the box shows the query and its suggestions. ' +
    'mode: replace (default), add, remove, toggle. Returns matches and the selection summary. Requires loaded data.',
  inputSchema: obj({
    query: str('Text or regular expression to find'),
    field: str('Node field to search (default: the current search-field)'),
    caseSensitive: bool('Match case (default: the search-case-sensitive setting)'),
    wholeWord: bool('Match whole words only (default: the search-whole-word setting)'),
    literal: bool('Treat the query as plain text rather than a regular expression'),
    mirrorSearchBox: bool('Run it through the visible search box (replace mode)'),
    mode: modeSchema
  }, ['query']),
  execute: async args => {
    T.requireData();
    const w = W();
    const field = args.field !== undefined ? checkVariable('node', args.field, { allowNone: false, what: 'field' }) : w['search-field'];
    const caseSensitive = args.caseSensitive !== undefined ? args.caseSensitive : !!w['search-case-sensitive'];
    const wholeWord = args.wholeWord !== undefined ? args.wholeWord : !!w['search-whole-word'];
    const mode = args.mode || 'replace';
    if (args.mirrorSearchBox) {
      if (mode != 'replace') fail('mirrorSearchBox works in replace mode only');
      const search = document.getElementById('search');
      S().set('search-case-sensitive', caseSensitive);
      S().set('search-whole-word', wholeWord);
      S().set('search-field', field);
      search.value = args.query;
      search.dispatchEvent(new Event('input'));
      return Object.assign({ field, query: args.query, via: 'search box' }, selectionSummary());
    }
    let text = args.query;
    if (args.literal) text = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) text = '\\b' + text + '\\b';
    let re;
    if (args.literal) {
      re = new RegExp(text, caseSensitive ? '' : 'i'); // escaped: it can't backtrack badly
    } else {
      try { re = T.regex(text, caseSensitive ? '' : 'i'); } catch (e) { fail(e.message + ' (use literal: true for plain text)'); }
    }
    const set = new Set();
    nodes().forEach(d => {
      const v = d[field];
      if (typeof v === 'string') { if (re.test(T.regexInput(v))) set.add(d); }
      else if (typeof v === 'number') { if (v + '' == args.query) set.add(d); }
    });
    const changed = applySelection(set, mode);
    return Object.assign({ field, query: args.query, matched: set.size, changed }, selectionSummary());
  }
};
