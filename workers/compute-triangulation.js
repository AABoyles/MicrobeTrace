onmessage = function(e){
  let start = Date.now();
  // The n by n distance matrix, flat, NaN where there's no distance
  let m = e.data.matrix;
  let n = Math.round(Math.sqrt(m.length));
  for(let i = 0; i < n; i++){
    for(let j = 0; j < i; j++){
      if(!isNaN(m[i * n + j])) continue;
      let minRange = Infinity, min = Infinity;
      for(let k = 0; k < i; k++){
        let companionA = m[i * n + k];
        if(isNaN(companionA)) continue;
        for(let l = j+1; l < n; l++){
          let companionB = m[l * n + j];
          if(isNaN(companionB)) continue;
          let diff = Math.abs(companionA - companionB);
          if(minRange > diff){
            minRange = diff;
            min = Math.min(companionA, companionB);
          }
        }
      }
      if(minRange < Infinity){
        let newVal = min + minRange/2;
        m[i * n + j] = newVal;
        m[j * n + i] = newVal;
      }
    }
  }
  console.log('Triangulation Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  postMessage({matrix: m.buffer, start: start}, [m.buffer]);
  close();
};
