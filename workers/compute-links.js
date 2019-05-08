importScripts('../vendor/tn93.min.js');

function snps(s1, s2){
  //If we aligned them, these will definitely be the same length. If not...
  var n = Math.min(s1.length, s2.length);
  var sum = 0;
  for(var i = 0; i < n; i++){
    sum += (s1[i] !== s2[i] & s1[i] !== '-' & s2[i] !== '-');
  }
  return sum;
}

onmessage = function(e){
  var start = Date.now();
  var subset = e.data.nodes,
      metrics = e.data.metrics,
      n = subset.length,
      s = e.data.strategy.toUpperCase(),
      t = 0;
  var output = Array((n*n-n)/2);
  for(var i = 0; i < n; i++){
    var source = subset[i];
    for(var j = 0; j < i; j++){
      var target = subset[j];
      var link = {
        source: source.id,
        target: target.id,
        origin: ['Genetic Distance']
      };
      if(metrics.includes('tn93')) link.tn93 = tn93(source['seq'], target['seq'], s);
      if(metrics.includes('snps')) link.snps = snps(source['seq'], target['seq']);
      output[t++] = link;
    }
  }
  console.log('Links Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  var encoder = new TextEncoder();
  output = encoder.encode(JSON.stringify(output)).buffer;
  postMessage({links: output, start: start}, [output]);
  close();
};
