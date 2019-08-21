onmessage = function(e) {
  let start = Date.now();
  let subset = e.data;
  const n = subset.length;
  let output = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sequence = subset[i]["seq"];
    const sequenceLength = sequence.length;
    let count = 0;
    for (let j = 0; j < sequenceLength; j++){
      let character = sequence[j];
      count += (
        sequence[j] == "-" || (
          sequence[j] != "A" &&
          sequence[j] != "C" &&
          sequence[j] != "G" &&
          sequence[j] != "T"
        )
      );
    }
    output[i] = count/sequenceLength;
  }
  console.log("Ambiguity Count time: ", (Date.now() - start).toLocaleString(), "ms");
  start = Date.now();
  postMessage({ counts: output.buffer, start }, [output.buffer]);
  close();
};
