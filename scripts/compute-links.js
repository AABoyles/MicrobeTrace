importScripts('../node_modules/tn93/dist/tn93.min.js');

function hamming(s1, s2){
  //If we aligned them, these will definitely be the same length. If not...
  var i = Math.min(s1.length, s2.length);
  var sum = 0;
  while(--i > 0){
    if(s1[i] !== s2[i] && s1[i] !== '-' && s2[i] !== '-'){
      sum++;
    }
  }
  return sum;
};

onmessage = function(e){
  var subset = e.data.nodes;
  var j = e.data.j;
  var output = [];
  for(var i = 0; i < j; i++){
    var distance = tn93(subset[i]['seq'], subset[j]['seq'], 'AVERAGE');
    var newLink = {
      source: subset[i].id,
      target: subset[j].id,
      tn93: distance,
      snps: hamming(subset[i]['seq'], subset[j]['seq']),
      origin: ['Genetic Distance']
    };
    output.push(newLink);
  }
  postMessage(output);
};
