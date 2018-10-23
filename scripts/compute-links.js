importScripts('../node_modules/tn93/dist/tn93.min.js');

function snps(s1, s2){
  //If we aligned them, these will definitely be the same length. If not...
  var i = Math.min(s1.length, s2.length);
  var sum = 0;
  while(--i >= 0){
    if(s1[i] !== s2[i] & s1[i] !== 17 & s2[i] !== 17) sum++;
  }
  return sum;
}

onmessage = function(e){
  var subset = e.data.nodes, metrics = e.data.metrics, n = subset.length;
  var output = [];
  for(var i = 0; i < n; i++){
    for(var j = 0; j < i; j++){
      var link = {
        source: subset[i].id,
        target: subset[j].id,
        origin: ['Genetic Distance']
      }
      if(metrics.includes('tn93')) link.tn93 = tn93.onInts(subset[i]['_seqInt'], subset[j]['_seqInt'], 'AVERAGE');
      if(metrics.includes('snps')) link.snps = snps(subset[i]['_seqInt'], subset[j]['_seqInt']);
      output.push(link);
    }
  }
  postMessage(output);
};
