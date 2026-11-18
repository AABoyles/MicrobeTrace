const isblank = /^\s*$/;

// Parses FASTA text into [{id, seq}]. Tolerates a UTF-8 BOM, CRLF line endings,
// and blank or ';' comment lines anywhere (#223); sequence lines before the
// first header are ignored.
function parseFasta(text){
  let seqs = [], currentSeq = null;
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  let lines = text.split(/[\r\n]+/g);
  let n = lines.length;
  for(let i = 0; i < n; i++){
    let line = lines[i].trim();  // issue 189, 190
    if(isblank.test(line) || line[0] == ';') continue;
    if(line[0] == '>'){
      if(currentSeq) seqs.push(currentSeq);
      currentSeq = {
        id: line.slice(1).trim(),
        seq: ''
      };
    } else if(currentSeq){
      currentSeq.seq += line.toUpperCase();
    }
  }
  if(currentSeq) seqs.push(currentSeq);
  return seqs;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { parseFasta };

if(typeof onmessage !== 'undefined' || typeof self !== 'undefined') onmessage = function(e){
  let start = Date.now();
  let text = e.data;
  let seqs = (!text || text.length == 0) ? [] : parseFasta(text);   // an empty file still answers (#222)
  console.log('FASTA Parse time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  let encoder = new TextEncoder();
  let output = encoder.encode(JSON.stringify(seqs)).buffer;
  postMessage({nodes: output, start: start}, [output]);
  close();
};
