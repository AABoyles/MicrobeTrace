importScripts('../vendor/ntseq.js');
onmessage = function(e){
  let start = Date.now();
  let subset = e.data.nodes;
  let reference = new Nt.Seq();
  reference.read(e.data.reference);
  let n = subset.length;
  for(let i = 0; i < n; i++){
    let node = subset[i];
    let match = (new Nt.Seq()).read(node.seq);
    let map = new Nt.MatchMap(match, reference);
    map.initialize();
    map.sort();
    let best = map.best();
    node.padding = best.position;
    node.score = best.score;
  });
  console.log('Alignment time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  let encoder = new TextEncoder();
  output = encoder.encode(JSON.stringify(subset)).buffer;
  postMessage({nodes: output, start: start}, [output]);
  close();
};
