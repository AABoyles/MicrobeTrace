importScripts("../vendor/papaparse.min.js");

// A distance as a number; null for an empty cell; NaN for text that is not a
// distance. "0,015" is read as 0.015 (a decimal comma, quoted so it is one cell);
// other comma forms ("1,234") could be a thousands separator and are not guessed.
// (Also in src/graph.js as MTGraph.parseDistance: workers cannot load it.)
function parseDistance(v) {
  if (v == null) return null;
  if (typeof v == "number") return isFinite(v) ? v : NaN;
  const s = ("" + v).trim();
  if (s === "") return null;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s);
  const comma = /^([+-]?)0?,(\d+)$/.exec(s);
  if (comma) return Number(comma[1] + "0." + comma[2]);
  return NaN;
}

// An ID: trimmed, and stripped of stray quotes
const clean = v => v == null ? "" : ("" + v).replace(/^[\s"']+|[\s"']+$/g, "");

// The first ID named more than once (a blank ID does not count), or null
const firstRepeat = ids => {
  const seen = new Set();
  for (const id of ids) {
    if (id === "") continue;
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
};

// Whether a row is blank: an empty line, or only empty cells
const blank = row => !row || row.every(c => c == null || ("" + c).trim() === "");

onmessage = function(e) {
  let start = Date.now();
  const text = e.data;
  const links = [];
  let nodeIDs = null;        // the IDs, in order
  let square = null;         // true: IDs across a header row; false: IDs down the first column only
  let rows = [];             // rows kept until the IDs are known (a matrix without a header row)
  let rowIDs = [];           // the ID of each row, in order
  let unparseable = 0, example = null;
  let failed = false;

  const fail = message => {
    if (failed) return;
    failed = true;
    postMessage({ error: message });
    close();
  };

  // One row against the IDs: its ID, and its cells, the first after the ID being
  // the first ID's
  const addRow = (source, row) => {
    if (source === "") return;
    for (let j = 1; j < row.length; j++) {
      const target = nodeIDs[j - 1];
      if (target === undefined || target === "" || source === target) continue;
      const v = parseDistance(row[j]);
      if (v === null) continue;  // an empty cell is no distance, and must not overwrite one
      if (v !== v) {
        unparseable++;
        if (example === null) example = "" + row[j];
        continue;
      }
      links.push({ source: source, target: target, distance: v });
    }
  };

  Papa.parse(text, {
    skipEmptyLines: "greedy",
    chunk: function(result) {
      if (failed) return;
      for (const row of result.data) {
        if (blank(row)) continue;
        if (square === null) {
          // The shape is read once, from the first row: with an empty first cell
          // it is the header (IDs across the top) of a square or triangular matrix;
          // otherwise there is no header and the IDs are the first column
          square = clean(row[0]) === "";
          if (square) {
            nodeIDs = row.slice(1).map(clean);
            continue;
          }
        }
        if (square) {
          const id = clean(row[0]);
          rowIDs.push(id);
          addRow(id, row);
        } else rows.push(row);
      }
    },
    complete: function() {
      if (failed) return;
      if (square === null) return fail("it has no rows");
      if (!square) {
        // Row i is node i; either triangle, or all of it, may be filled
        nodeIDs = rows.map(r => clean(r[0]));
        rowIDs = nodeIDs;
        rows.forEach((row, i) => addRow(nodeIDs[i], row));
        rows = [];
      }
      // Each ID names one node: once in the header, and once per row. A repeat would give
      // two nodes the same distances, so the file is refused. A header ID with no row means
      // the file was cut off before that row (#172).
      if (square) {
        const repeatedHeader = firstRepeat(nodeIDs);
        if (repeatedHeader !== null) return fail(`it names "${repeatedHeader}" more than once`);
      }
      const repeatedRow = firstRepeat(rowIDs);
      if (repeatedRow !== null) return fail(`it has more than one row for "${repeatedRow}"`);
      if (square) {
        const withRows = new Set(rowIDs);
        const missing = nodeIDs.find(id => id !== "" && !withRows.has(id));
        if (missing !== undefined) return fail(`it has no row for "${missing}", so it may be cut off`);
      }
      const nodes = nodeIDs.filter(id => id !== "");
      if (!nodes.length) return fail("it names no nodes");
      console.log("CSV Matrix Parse time: ", (Date.now() - start).toLocaleString(), "ms");
      start = Date.now();
      postMessage({ data: { links: links, nodes: nodes, unparseable: unparseable, example: example }, start: start });
      close();
    },
    error: err => fail((err && err.message) || "it could not be parsed")
  });
};
