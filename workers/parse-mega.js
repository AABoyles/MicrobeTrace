// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
const isblank = /^\s*$/;

// Parses MEGA text into [{id, seq}]; tolerates a BOM, CRLF and leading
// blank/comment lines (#223); sequence lines before the first '#' are ignored.
function parseMega(text){
  let seqs = [], currentSeq = null;
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  let lines = text.split(/[\r\n]+/g);
  let n = lines.length;
  for (let i = 0; i < n; i++) {
    let line = lines[i];
    if (isblank.test(line) || line[0] == ';') continue;
    if (line[0] == '#') {
      if (currentSeq) seqs.push(currentSeq);
      currentSeq = {
        id: line.slice(1),
        seq: '#'
      };
    } else if (currentSeq) {
      currentSeq.seq += line.toUpperCase();
    }
  }
  if (currentSeq) seqs.push(currentSeq);
  return seqs;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parseMega };

if (typeof onmessage !== 'undefined' || typeof self !== 'undefined') onmessage = function (e) {
  let start = Date.now();
  let text = e.data;
  let seqs = (!text || text.length == 0) ? [] : parseMega(text);   // an empty file still answers (#222)
  debugTime('MEGA Parse', start);
  start = Date.now();
  postMessage({ nodes: seqs, start: start });
  close();
};
