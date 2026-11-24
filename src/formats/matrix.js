import { blankCell, cleanCell, isNumber, sheetText } from './shared.js';

// A distance matrix: a square or triangular table, a row and a column for each node (#337).
// Its cells are read by the matrix worker (workers/parse-csv-matrix.js) and merged by
// MT.parseCSVMatrix (src/loading.js), so this module detects the format and gives the
// worker its text.
export const name = 'matrix';
export const label = 'a distance matrix';
export const extensions = [];

// (A matrix is not told from its name)
export const matchName = () => false;

// A spreadsheet's first sheet as the CSV text the worker reads. Throws when it has no sheets.
export const toText = contents => sheetText(contents, { dates: true });

// A matrix's header names (all of) its rows, in order, below an empty corner; or,
// without a header row, it is a square table of numbers below a column of names.
// `table` gives the sample of the text's rows (see tableSample).
export function detect(text, fileName, table) {
  const { rows, usable } = table();
  if (!usable) return false;
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim() !== '').length;
  const header = rows[0].slice();
  while (header.length && blankCell(header[header.length - 1])) header.pop();
  const values = rows.slice(1).reduce((all, r) => all.concat(r.slice(1)), []).filter(c => !blankCell(c));
  const mostlyNumbers = values.length > 0 && values.filter(isNumber).length >= 0.9 * values.length;
  const k = Math.min(rows.length - 1, header.length - 1);
  if (blankCell(rows[0][0]) && header.length - 1 === lines - 1 && k >= 2 && mostlyNumbers
    && rows.slice(1, k + 1).every((r, i) => cleanCell(r[0]) !== '' && cleanCell(r[0]) === cleanCell(header[i + 1]))) {
    return true;
  }
  return !blankCell(rows[0][0]) && !isNumber(rows[0][0]) && rows[0].length - 1 === lines && lines >= 3
    && rows.every(r => r.length === rows[0].length && !isNumber(r[0])) && mostlyNumbers
    && rows.slice(1).flat().length > 0 && rows[0].slice(1).every(isNumber);
}
