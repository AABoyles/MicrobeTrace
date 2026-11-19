// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
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
 debugTime('Directionality Inference', start);
 postMessage({output: flips.buffer, start: Date.now()}, [flips.buffer]);
 close();
};
