importScripts('../node_modules/bioseq/dist/bioseq.min.js');
onmessage = function(e){
  var subset = e.data.nodes;
  var reference = e.data.reference;

  subset.forEach(node => {
    var rst = bioseq.align(reference, node.seq, e.data.isLocal, e.data.match, e.data.gap);
    var fmt = bioseq.cigar2gaps(reference, node.seq, rst.position, rst.CIGAR);
    node.padding = rst.position;
    node.seq = fmt[1];
  });

  postMessage(subset);
  close();
};
