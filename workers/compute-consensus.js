// The consensus of aligned sequences: at each site, the character that occurs
// most often. A tie goes to the first character in ORDER (the bases, then the
// gap), then to any other character (an ambiguity code) in alphabetical order.
// That order is fixed, so the consensus doesn't depend on how the sequences
// were loaded (#232).
const ORDER = 'ACGT-';
const rank = c => { const i = ORDER.indexOf(c); return i < 0 ? ORDER.length : i; };

function consensusOf(subset){
  const columns = [];
  for (const { seq } of subset) {
    const s = seq.toUpperCase();
    for (let j = 0; j < s.length; j++) {
      const column = columns[j] || (columns[j] = {});
      column[s[j]] = (column[s[j]] || 0) + 1;
    }
  }
  let consensus = '';
  for (const column of columns) {
    const chars = Object.keys(column).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    let best = chars[0];
    for (const c of chars) if (column[c] > column[best]) best = c;
    consensus += best;
  }
  return consensus;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { consensusOf };

if(typeof onmessage !== 'undefined' || typeof self !== 'undefined') onmessage = function(e){
  var start = Date.now();
  var consensus = consensusOf(e.data);
  console.log('Consensus Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  postMessage({consensus: consensus, start: start});
  close();
};
