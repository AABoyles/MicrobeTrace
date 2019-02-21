onmessage = function(e){
  var start = Date.now();
  var m = e.data.matrix;
  var n = m.length;
  for(var i = 0; i < n; i++){
    for(var j = 0; j < i; j++){
      var missingCell = m[i][j];
      if(typeof missingCell !== 'number'){
        var minRange = Infinity, min = Infinity;
        for(var k = 0; k < i; k++){
          var companionA = m[i][k];
          if(typeof companionA == 'number'){
            for(var l = j+1; l < n; l++){
              var companionB = m[l][j];
              if(typeof companionB == 'number'){
                var diff = Math.abs(companionA - companionB);
                if(minRange > diff){
                  minRange = diff;
                  min = Math.min(companionA, companionB);
                }
              }
            }
          }
        }
      }
      if(minRange < Infinity){
        var newVal = min + minRange/2;
        m[i][j] = newVal;
        m[j][i] = newVal;
      }
    }
  }
  console.log('Triangulation Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(JSON.stringify(m)).buffer;
  postMessage({matrix: output, start: start}, [output]);
  close();
};
