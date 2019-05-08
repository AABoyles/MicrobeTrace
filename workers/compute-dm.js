onmessage = function(e){
  var start = Date.now();
  var links = e.data.links, nodes = e.data.nodes, metrics = e.data.metrics;
  var n = nodes.length, m = links.length, labels = nodes.map(s => s.id);
  var output = {};
  metrics.forEach(metric => output[metric] = Array(n));
  for(var i = 0; i < n; i++){
    metrics.forEach(metric => {
      output[metric][i] = Array(n).fill(null);
      output[metric][i][i] = 0;
    });
  }
  for(var j = 0; j < m; j++){
    var link = links[j];
    var row = labels.findIndex(l => l === link.source);
    if(row === -1) continue;
    var col = labels.findIndex(l => l === link.target);
    if(col === -1) continue;
    metrics.forEach(metric => {
      if(metric in link){
        output[metric][row][col] = link[metric];
        output[metric][col][row] = link[metric];
      }
    });
  }
  output.labels = labels;
  console.log('DM Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  var encoder = new TextEncoder();
  output = encoder.encode(JSON.stringify(output)).buffer;
  postMessage({matrices: output, start: start}, [output]);
  close();
};
