importScripts('../vendor/neighbor-joining.js')

onmessage = function(e){
  var matrix = e.data.matrix;
  var labels = e.data.labels.map(l => ({
    'name': l,
    'genotype': l
  }));
  var RNJ = new RapidNeighborJoining(matrix, labels);
  RNJ.run();
  var encoder = new TextEncoder();
  var output = encoder.encode(RNJ.getAsNewick()).buffer;
  postMessage({tree: output}, [output]);
};
