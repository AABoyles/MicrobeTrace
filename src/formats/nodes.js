import { claimId, cleanCell, sheetRows } from './shared.js';

// A node list: a row for each node, with an ID column, perhaps a sequence column,
// and any other fields (#337).
export const name = 'node';
export const label = 'a node list';
export const extensions = ['csv', 'tsv', 'txt', 'xlsx', 'xls'];

// What the file is called, when its contents do not say: "node" anywhere in its name
export const matchName = (extension, fileName) => fileName.toLowerCase().includes('node');

// A node list has an ID column and no source and target; a link list names both.
// `table` gives the sample of the text's rows (see tableSample).
export function detect(text, fileName, table) {
  const { rows, usable } = table();
  if (!usable) return false;
  const names = rows[0].map(c => cleanCell(c).toLowerCase());
  const has = list => list.some(n => names.includes(n));
  return has(['id', '_id']) && !(has(['source']) && has(['target']));
}

// The nodes of a node list. options: field1 (the ID column), field2 (the sequence
// column, or 'None'), delimiter, origin, and sheet (the contents are a spreadsheet,
// not text). Returns { nodes, fields, ids, total, blanks, duplicates }: a node for
// each row with an ID (a repeat is a node again, for the caller to merge), the
// other columns in the order they were first met (the node fields to list), the IDs
// the file gave, and how many rows it had.
export function parse(contents, { field1, field2, delimiter, origin, sheet }) {
  const result = { nodes: [], fields: [], ids: new Set(), total: 0, blanks: 0, duplicates: 0 };
  const known = new Set();
  const addRow = row => {
    result.total++;
    const id = claimId(row[field1], result.ids, result);
    if (id === null) return;
    const node = { _id: id, seq: field2 == 'None' ? '' : row[field2], origin };
    Object.keys(row).forEach(key => {
      if (key == field1 || key == field2) return;
      if (!known.has(key)) { known.add(key); result.fields.push(key); }
      node[key] = row[key]; // (#173)
    });
    result.nodes.push(node);
  };
  if (sheet) {
    sheetRows(contents).forEach(addRow);
  } else {
    Papa.parse(contents, {
      delimiter: delimiter || ',',
      header: true,
      // Numbers are read as numbers, except IDs and sequences: 007 and 1E3 are names (#219)
      dynamicTyping: field => field != field1 && field != field2,
      skipEmptyLines: true,
      step: output => addRow(output.data)
    });
  }
  return result;
}
