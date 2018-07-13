let epsilon = 1E-9;

onmessage = function(e){
  let nodes = e.data.nodes;
  let links = e.data.links;
  let dm = e.data.distance_matrix.tn93;
  let m = links.length;
  let n = nodes.length;
  for(let j = 0; j < m; j++){ links[j].nn = false; }
  for(let i = 0; i < n; i++){
    let minDist = Number.MAX_VALUE;
    let targets = [];
    for(let j = 0; j < i; j++){
      if(Math.abs(dm[i][j] - minDist) < epsilon){
        targets.push(nodes[j].id);
      } else if(dm[i][j] < minDist){
        minDist = dm[i][j];
        targets = [nodes[j].id];
      }
    }
    for(let j = 0; j < m; j++){
      let l = links[j];
      if((l.source == nodes[i].id && targets.includes(l.target)) ||
         (l.target == nodes[i].id && targets.includes(l.source))){
        l.nn = true;
      }
    }
  }
  postMessage(links);
  close();
};
