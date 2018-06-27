onmessage = function(e){
  let nodes = e.data.nodes;
  let links = e.data.links;
  links.forEach(l => l.nn = false);
  let dm = e.data.distance_matrix.tn93;
  let m = links.length;
  let n = nodes.length;
  for(let i = 0; i < n; i++){
    let minDist = Number.MAX_VALUE;
    let targets = [];
    for(let j = 0; j < i; j++){
      if(dm[i][j] < minDist){
        minDist = dm[i][j];
        targets = [nodes[j].id];
      } else if(dm[i][j] == minDist){
        minDist = dm[i][j];
        targets.push(nodes[j].id);
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
