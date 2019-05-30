onmessage = function(e) {
  var start = Date.now();
  var links = e.data.links,
    nodes = e.data.nodes,
    metric = e.data.metrics[0];
  var n = nodes.length,
    m = links.length,
    labels = nodes.map(s => s.id);
  var output = Array(n);
  for (var i = 0; i < n; i++) {
    output[i] = Array(n).fill(null);
    output[i][i] = 0;
  }
  for (var j = 0; j < m; j++) {
    var link = links[j];
    var row = labels.findIndex(l => l === link.source);
    if (row === -1) continue;
    var col = labels.findIndex(l => l === link.target);
    if (col === -1) continue;
    output[row][col] = link["distance"];
    output[col][row] = link["distance"];
  }
  console.log("DM Compute time: ", (Date.now() - start).toLocaleString(), "ms");
  start = Date.now();
  var encoder = new TextEncoder();
  output = encoder.encode(JSON.stringify(output)).buffer;
  labels = encoder.encode(JSON.stringify(labels)).buffer;
  postMessage(
    {
      matrix: output,
      labels: labels,
      start: start
    },
    [output, labels]
  );
  close();
};
