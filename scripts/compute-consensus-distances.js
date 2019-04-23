onmessage = function(e){
  var start = Date.now();
  var consensus = e.data.consensus;
  var subset = e.data.nodes;
  var n = e.data.nodes.length;
  for(var i = 0; i < n; i++){
    var s1 = subset[i]['seq'];
    var j = Math.min(s1.length, consensus.length);
    var sum = Math.abs(s1.length - consensus.length);
    while(--j >= 0){
      if(s1[j] !== consensus[j] || s1[j] !== '-') sum++;
    }
    subset[i]._diff = sum;
  }
  console.log('Consensus Difference Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(JSON.stringify(e.data.nodes)).buffer;
  postMessage({nodes: output, start: start}, [output]);
  close();
};
