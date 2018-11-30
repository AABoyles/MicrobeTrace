importScripts('../node_modules/neighborjoining/dist/neighborjoining.min.js');

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
  var RNJ = new neighborjoining(matrix, labels);
  console.log('Tree Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(RNJ.getAsNewick(true, e.data.round, e.data.addOne)).buffer;
  postMessage({tree: output, start: start}, [output]);
  close();
};
