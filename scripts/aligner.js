importScripts('../node_modules/lodash/lodash.min.js');
if(typeof window == 'undefined') window = self;
importScripts('../node_modules/bioseq/dist/bioseq.min.js');
importScripts('common.js');
onmessage = function(e){
  var subset = e.data.nodes;
  var reference = e.data.reference;

  subset.forEach(node => {
    var rst = bioseq.align(reference, node.seq, true, [1, -1], [-5, -1.7]);
    var fmt = bioseq.cigar2gaps(reference, node.seq, rst.position, rst.CIGAR);
    node.padding = rst.position;
    node.seq = fmt[1];
  });

  var minPadding = _.minBy(subset, 'padding').padding;
  subset.forEach(d => d.seq = '-'.repeat(d.padding - minPadding) + d.seq);

  var maxLength = _.max(subset.map(d => d.seq.length));
  subset.forEach(d => d.seq = d.seq + '-'.repeat(maxLength - d.seq.length));

  postMessage(subset);
  close();
};
