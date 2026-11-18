// Each sequence's number of differences from the consensus: a site counts when
// the sequence's character differs from the consensus's, so a gap where the
// consensus is also a gap is not a difference, and every extra or missing
// site counts (#232). Counts are Uint32, which doesn't wrap.
function consensusDistances(consensus, subset){
  const consensusLength = consensus.length;
  const output = new Uint32Array(subset.length);
  for (let i = 0; i < subset.length; i++) {
    const s1 = subset[i]["seq"].toUpperCase();
    let j = Math.min(s1.length, consensusLength);
    let sum = Math.abs(s1.length - consensusLength);
    while (--j >= 0) sum += s1[j] !== consensus[j] ? 1 : 0;
    output[i] = sum;
  }
  return output;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { consensusDistances };

if(typeof onmessage !== 'undefined' || typeof self !== 'undefined') onmessage = function(e) {
  let start = Date.now();
  const output = consensusDistances(e.data.consensus, e.data.subset);
  console.log("Consensus Difference Compute time: ", (Date.now() - start).toLocaleString(), "ms");
  start = Date.now();
  postMessage({ dists: output.buffer, start }, [output.buffer]);
  close();
};
