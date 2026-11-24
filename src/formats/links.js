import { MTGraph } from '../graph.js';
import { cleanID, sheetRows } from './shared.js';

// A link list: a row for each link, with a source and a target column, perhaps a
// distance, and any other fields (#337). What a file is when it is no other kind, so
// it has no `detect`.
export const name = 'link';
export const label = 'a link list';
export const extensions = ['csv', 'tsv', 'txt', 'xlsx', 'xls'];

// (A link list is what a file is called when nothing else fits)
export const matchName = () => false;

// A link list's rows as objects, and its column names: the contents' own header, read
// as the link-list worker (workers/parse-links.js) reads it, which does the same off
// the main thread. The two ID columns are kept as text: 007 and 1E3 are names (#219).
export function readRows(contents, { field1, field2, delimiter, sheet }) {
  if (sheet) return { rows: sheetRows(contents), fields: [] };
  let result = { rows: [], fields: [] };
  Papa.parse(contents, {
    delimiter: delimiter || ',',
    header: true,
    dynamicTyping: field => field != field1 && field != field2, // eslint-disable-line eqeqeq -- field names arrive from menus and files; a number and its text name the same column
    skipEmptyLines: true,
    complete: output => { result = { rows: output.data, fields: output.meta.fields || [] }; }
  });
  return result;
}

// The links and nodes of a link list. options: field1 and field2 (the source and target
// columns), field3 (the distance column, or 'None'), metric (the field a distance is
// stored under), origin, delimiter, sheet (the contents are a spreadsheet), and rows
// and fields when the worker has read them already. Returns:
//   links: a link for each row with a source and a target, with its distance (a link
//     with none has none, not 0, which every threshold passes, and one with an unreadable
//     distance has none rather than NaN, #220; links from a file with no distance column
//     are flagged `unmeasured`, so that the threshold shows them),
//   nodes: a node ({ _id, origin }) for each ID the rows name, once,
//   fields: the columns, in the order they were met,
//   total: how many rows,
//   blanks: rows without a source or target,
//   noColumn, missing, bad, badExample: how many links had no distance column, an empty
//     distance, or one that is not a number (and the first of those, as text) (#220).
export function parse(contents, options) {
  const { field1, field2, field3, metric, origin } = options;
  const { rows, fields: columns } = options.rows ? { rows: options.rows, fields: options.fields || [] } : readRows(contents, options);
  const result = { links: [], nodes: [], fields: [], total: rows.length, blanks: 0, noColumn: 0, missing: 0, bad: 0, badExample: null };
  const known = new Set();
  const noteField = key => { if (!known.has(key)) { known.add(key); result.fields.push(key); } };

  for (const row of rows) {
    const copy = {};
    for (const key of Object.keys(row)) {
      // Read the row by its own header; store under its name as written (#217)
      copy[key] = row[key];
      noteField(key);
    }
    const source = cleanID(copy[field1]), target = cleanID(copy[field2]);
    if (source === '' || target === '') { result.blanks++; continue; }
    const link = Object.assign({ origin, visible: true }, copy, { source, target });
    // A file's distances are taken to be the distance metric's
    const distance = field3 === 'None' ? null : MTGraph.parseDistance(copy[field3]);
    if (distance === null || distance !== distance) {
      if (field3 === 'None') { result.noColumn++; link.unmeasured = true; }
      else if (distance === null) result.missing++;
      else { result.bad++; if (result.badExample === null) result.badExample = '' + copy[field3]; }
      if (field3 === 'None' || field3 == metric) delete link[metric]; // eslint-disable-line eqeqeq -- field names arrive from menus and files; a number and its text name the same column
    } else {
      link[metric] = distance;
    }
    result.links.push(link);
  }
  columns.forEach(noteField);

  // Each endpoint once, in the order the rows name them (a blank one is no node)
  const seen = new Set();
  for (const row of rows) {
    for (const value of [row[field1], row[field2]]) {
      const id = cleanID(value);
      if (id === '' || seen.has(id)) continue;
      seen.add(id);
      result.nodes.push({ _id: id, origin });
    }
  }
  return result;
}
