if(typeof window === 'undefined') window = self;
importScripts('../node_modules/tn93/dist/tn93.min.js');

function hamming(s1, s2, gapPenalty){
  if(!gapPenalty) gapPenalty = 0;
  var i = s1.length;
  var sum = 0;
  while(--i > 0){
    if(s1[i] === '-' ^ s2[i] === '-'){
      sum += gapPenalty;
    } else if(s1[i] !== s2[i]){
      sum++;
    }
  }
  return sum;
};

onmessage = function(e){
  var subset = e.data;
  var n = subset.length;
  var output = {
    tn93: Array(n),
    snps: Array(n),
    labels: subset.map(d => d.id),
    links: []
  };
  for(var i = 0; i < n; i++){
    output.tn93[i] = Array(n);
    output.snps[i] = Array(n);
    output.tn93[i][i] = output.snps[i][i] = 0;
    for(var j = 0; j < i; j++){
      var distance = tn93(subset[j]['seq'], subset[i]['seq'], 'AVERAGE');
      var newLink = {
        source: subset[j].id,
        target: subset[i].id,
        tn93: distance,
        snps: hamming(subset[j]['seq'], subset[i]['seq'], 0),
        distance: distance,
        origin: ['Genetic Distance']
      };
      output.tn93[i][j] = newLink.tn93;
      output.tn93[j][i] = newLink.tn93;
      output.snps[i][j] = newLink.snps;
      output.snps[j][i] = newLink.snps;
      output.links.push(newLink);
    }
  }
  postMessage(output);
  close();
};
