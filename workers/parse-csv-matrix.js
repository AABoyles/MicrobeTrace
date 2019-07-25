importScripts("../vendor/papaparse.min.js");

onmessage = function(e) {
  var start = Date.now();
  var text = e.data;
  var nodeIDs, n;
  var links = [];
  Papa.parse(text, {
    skipEmptyLines: "greedy",
    fastMode: true,
    chunk: function(result) {
      var rowsInChunk = result.data.length;
      for (var rowInChunk = 0; rowInChunk < rowsInChunk; rowInChunk++) {
        var row = result.data[rowInChunk];
        if (nodeIDs) {
          var source = "" + row[0];
          for (var j = 1; j < n; j++) {
            var target = "" + nodeIDs[j];
            if (source == target) continue;
            links.push({
              source: source,
              target: target,
              distance: parseFloat(row[j])
            });
          }
        } else {
          nodeIDs = row;
          n = nodeIDs.length;
        }
      }
    },
    complete: function() {
      console.log(
        "CSV Matrix Parse time: ",
        (Date.now() - start).toLocaleString(),
        "ms"
      );
      start = Date.now();
      var encoder = new TextEncoder();
      var output = encoder.encode(
        JSON.stringify({
          links: links,
          nodes: nodeIDs.slice(1)
        })
      ).buffer;
      postMessage({ data: output, start: start }, [output]);
      close();
    }
  });
};
