onmessage = function(e){
  var start = Date.now();
  var text = e.data;
  if(!text || text.length == 0) return [];
  var seqs = [], currentSeq = {};
  var lines = text.split(/[\r\n]+/g);
  var n = lines.length;
  var isblank = /^\s*$/;
  for(var i = 0; i < n; i++){
    var line = lines[i];
    if(isblank.test(line) || line[0] == ';') continue;
    if(line[0] == '>'){
      if(i > 0) seqs.push(currentSeq);
      currentSeq = {
        id: line.slice(1),
        seq: ''
      };
    } else {
      currentSeq.seq += line.toUpperCase();
    }
  }
  seqs.push(currentSeq);
  console.log('FASTA Parse time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(JSON.stringify(seqs)).buffer;
  postMessage({nodes: output, start: start}, [output]);
  close();
};
