importScripts('../vendor/patristic.min.js');

onmessage = function(e){
  const start = Date.now();
  const { sources, targets } = e.data;
  const n = sources.length;
  const tree = patristic.parseJSON(e.data.tree);
  let flips = new Uint8Array(n);
  for(let i = 0; i < n; i++){
    const source = tree.getDescendant(sources[i]);
    const target = tree.getDescendant(targets[i]);
    if(source instanceof patristic.Branch && target instanceof patristic.Branch){
      if(target.sources(source)){
        flips[i] = 1;
      }
    }
  }
  console.log('Directionality Inference time: ', (Date.now()-start).toLocaleString(), 'ms');
  postMessage({output: flips.buffer, start: Date.now()}, [flips.buffer]);
  close();
};
