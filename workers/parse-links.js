importScripts("../vendor/papaparse.min.js");

// Reads a link list's CSV text into rows, off the main thread (#253).
// Receives { text, delimiter, field1, field2 }; replies { rows, fields } (the
// rows are cloned across, not serialised). The two ID columns are kept as text:
// 007 and 1E3 are names (#219). Spreadsheets are still read on the main thread
// (the XLSX library is only in the bundle, not a file a worker can load).
onmessage = function(e) {
  const { text, delimiter, field1, field2 } = e.data;
  Papa.parse(text, {
    delimiter: delimiter || ",",
    header: true,
    dynamicTyping: field => field != field1 && field != field2,
    skipEmptyLines: true,
    complete: results => {
      postMessage({ rows: results.data, fields: results.meta.fields || [] });
      close();
    },
    error: err => {
      postMessage({ error: (err && err.message) || "it could not be parsed" });
      close();
    }
  });
};
