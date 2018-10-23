onmessage = function(e){
  var consensus = e.data.consensus;
  var subset = e.data.nodes;
  var n = e.data.nodes.length;
  for(var i = 0; i < n; i++){
    var s1 = subset[i]['seq'];
    var j = Math.min(s1.length, consensus.length);
    var sum = 0;
    while(--j >= 0){
      if(s1[j] !== consensus[j] & s1[j] !== '-' & consensus[j] !== '-') sum++;
    }
    subset[i]._diff = sum;
  }
  var encoder = new TextEncoder();
  output = encoder.encode(JSON.stringify(e.data.nodes)).buffer;
  postMessage({nodes: output}, [output]);
};
