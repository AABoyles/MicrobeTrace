// Helpers the format modules share (#337). Nothing here reads or writes the
// session, `temp`, `MT` or the page: a format is a function of its contents.
// Papa and XLSX are the bundles' globals, looked up when called so that Node
// tests can set them first.

// An ID as the app keeps it: text, without the spaces around it. The same rule as
// MT.cleanID in src/common.js, which every loaded ID goes through, so that one ID
// from two files is one node.
export const cleanID = id => id == null ? '' : String(id).trim();

// Counts one node ID of a file. `seen` is the IDs the file has given so far and
// `tally` the file's { blanks, duplicates }: a blank ID is no node, and a repeat is
// counted (the caller merges it into the first node with that ID). Returns the ID,
// or null when it is blank (#219).
export function claimId(value, seen, tally) {
  const id = cleanID(value);
  if (id == '') { tally.blanks++; return null; }
  if (seen.has(id)) tally.duplicates++;
  seen.add(id);
  return id;
}

export const delimiterNames = { ',': 'comma', '\t': 'tab', ';': 'semicolon', '|': 'bar' };
export const blankCell = c => c == null || ('' + c).trim() === '';
export const isNumber = c => !blankCell(c) && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$|^[+-]?0?,\d+$/.test(('' + c).trim());
// A cell as a name: without the spaces and quotes around it
export const cleanCell = c => blankCell(c) ? '' : ('' + c).replace(/^[\s"']+|[\s"']+$/g, '');

// The first rows of a delimited text, and the delimiter they were read with (a comma
// unless the rows say it is a tab, semicolon or bar). `usable` is false for what
// cannot be a table of columns: fewer than two rows, or one column.
export function tableSample(text) {
  const sample = Papa.parse(text, { preview: 60, skipEmptyLines: 'greedy', delimitersToGuess: [',', '\t', ';', '|'] });
  const delimiter = sample.meta.delimiter && delimiterNames[sample.meta.delimiter] ? sample.meta.delimiter : ',';
  const rows = sample.data;
  return { delimiter, rows, usable: rows.length >= 2 && rows[0].length >= 2 };
}

// The first sheet of a spreadsheet (an ArrayBuffer), as the objects of its rows
export function sheetRows(contents) {
  const workbook = XLSX.read(contents, { type: 'array' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd' });
}

// The first sheet of a spreadsheet as CSV text, which the table parsers read as they
// read a CSV file. Throws when the workbook has no sheets. Dates are formatted only
// when asked, as a matrix's are.
export function sheetText(contents, { dates = false } = {}) {
  const workbook = XLSX.read(contents, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('the workbook has no sheets');
  return XLSX.utils.sheet_to_csv(sheet, dates ? { rawNumbers: true, dateNF: 'yyyy-mm-dd' } : { rawNumbers: true });
}

// Whether a file's extension says it is a spreadsheet
export const isSheet = extension => extension == 'xlsx' || extension == 'xls';
