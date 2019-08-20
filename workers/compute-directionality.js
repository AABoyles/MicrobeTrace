importScripts('../vendor/patristic.min.js');

onmessage = function(e){
  let start = Date.now();
  let links = e.data.links;
  let n = links.length;
  let tree = patristic.parseJSON(e.data.tree);
  let flips = new Uint8Array(n);
  for(let i = 0; i < n; i++){
    let link = links[i];
    let source = tree.getDescendant(link.source);
    let target = tree.getDescendant(link.target);
    if(source instanceof patristic.Branch && target instanceof patristic.Branch){
      if(target.sources(source)){
        flips[i] = 1;
      }
    }
  }
  console.log('Directionality Inference time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  postMessage({output: flips.buffer, start: start}, [flips.buffer]);
  close();
};
