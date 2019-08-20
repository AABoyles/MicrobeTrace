onmessage = function(e){
  let start = Date.now();
  let nodes = e.data.nodes,
      links = e.data.links,
      dm = e.data.matrix,
      epsilon = Math.pow(10, e.data.epsilon);
  let n = nodes.length, m = links.length;
  let output = new Uint8Array(m);
  for(let i = 0; i < n; i++){
    let minDist = Number.MAX_VALUE;
    let targets = [];
    let nodeid = nodes[i].id;
    let row = dm[i];
    for(let j = 0; j < i; j++){
      let cell = row[j];
      if(typeof cell !== 'number' || isNaN(cell)) continue;
      if(cell < minDist) minDist = cell;
    }
    for(let h = 0; h < i; h++){
      let cell = row[h];
      if(typeof cell !== 'number' || isNaN(cell)) continue;
      if(Math.abs(cell - minDist) < epsilon){
        targets.push(nodes[h].id);
      }
    }
    for(let k = 0; k < m; k++){
      let l = links[k];
      if((l.source == nodeid & targets.includes(l.target)) |
         (l.target == nodeid & targets.includes(l.source))){
        output[k] = true;
      }
    }
  }
  console.log('NN Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  postMessage({links: output.buffer, start: start}, [output.buffer]);
  close();
};
