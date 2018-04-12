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
  var subset = e.data.nodes;
  var j = e.data.j;
  var n = subset.length;
  var output = [];
  for(var i = 0; i < n; i++){
    if(i === j) continue;
    var distance = tn93(subset[i]['seq'], subset[j]['seq'], 'AVERAGE');
    var newLink = {
      source: subset[i].id,
      target: subset[j].id,
      tn93: distance,
      snps: hamming(subset[i]['seq'], subset[j]['seq'], 0),
      distance: distance,
      origin: ['Genetic Distance']
    };
    output.push(newLink);
  }
  postMessage(output);
};
