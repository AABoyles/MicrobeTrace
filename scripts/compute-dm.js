onmessage = function(e){
  var links = e.data.links, nodes = e.data.nodes, metrics = e.data.metrics;
  var n = nodes.length, m = links.length, labels = nodes.map(s => s.id);
  var output = {};
  metrics.forEach(metric => output[metric] = Array(n));
  for(var i = 0; i < n; i++){
    metrics.forEach(metric => output[metric][i] = Array(n).fill(0));
  }
  for(var i = 0; i < m; i++){
    var link = links[i];
    var row = labels.findIndex(l => l === link.source);
    if(row === -1) continue;
    var col = labels.findIndex(l => l === link.target);
    if(col === -1) continue;
    metrics.forEach(metric => {
      output[metric][row][col] = link[metric];
      output[metric][col][row] = link[metric];
    });
  }
  output.labels = labels;
  postMessage(output);
  close();
};
