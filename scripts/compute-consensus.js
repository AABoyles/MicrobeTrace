onmessage = function(e){
  var subset = e.data.nodes;
  var n = subset.length;
  var k = subset[0].seq.length;
  var output = Array(k);
  for(var i = 0; i < n; i++){
    var seq = subset[i].seq.toUpperCase();
    for(var j = 0; j < seq.length; j++){
      if(!output[i]) output.push({A: 0, C: 0, G: 0, T: 0});
      if(typeof output[i][j] === 'number') output[i][j]++;
    }
  }
  var consensus = "";
  for(var i = 0; i < n; i++){
    var entry = output[i];
    var c = 'A';
    ['C', 'G', 'T'].forEach(char => {
      if(entry[c] < entry[char]){
        c = char;
      }
    });
    consensus += c;
  }
  postMessage(consensus);
};
