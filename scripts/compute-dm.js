onmessage = function(e){
  var links = e.data.links;
  var nodes = e.data.nodes;
  var n = nodes.length;
  var m = links.length;
  var labels = nodes.map(s => s.id);
  var tn93 = Array(n);
  var snps = Array(n);
  for(var i = 0; i < n; i++){
    tn93[i] = Array(n).fill(0);
    snps[i] = Array(n).fill(0);
  }
  for(var i = 0; i < m; i++){
    var row = labels.findIndex(l => l === links[i].source);
    var col = labels.findIndex(l => l === links[i].target);
    if(row === -1 || col === -1) continue;
    tn93[row][col] = links[i].tn93;
    tn93[col][row] = links[i].tn93;
    snps[row][col] = links[i].snps;
    snps[col][row] = links[i].snps;
  }
  postMessage({
    tn93: tn93,
    snps: snps,
    labels: labels
  });
  close();
};
