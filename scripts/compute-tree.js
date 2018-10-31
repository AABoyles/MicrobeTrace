importScripts('../vendor/neighbor-joining.js')

onmessage = function(e){
  var start = Date.now();
  var matrix = e.data.matrix;
  var labels = e.data.labels.map(l => {
    l = l.replace(/[;(),]*/g, '');
    return {
      'name': l,
      'genotype': l
    };
  });
  var RNJ = new RapidNeighborJoining(matrix, labels);
  RNJ.run();
  console.log('Tree Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(RNJ.getAsNewick()).buffer;
  postMessage({tree: output, start: start}, [output]);
  close();
};
