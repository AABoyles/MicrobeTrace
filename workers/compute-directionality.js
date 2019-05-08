importScripts('../vendor/patristic.min.js');

onmessage = function(e){
  var start = Date.now();
  var links = e.data.links;
  var n = links.length;
  var tree = patristic.parseJSON(e.data.tree);
  var flips = Array(n).fill(0);
  for(var i = 0; i < n; i++){
    var link = links[i];
    var source = tree.getDescendant(link.source);
    var target = tree.getDescendant(link.target);
    if(source instanceof patristic.Branch && target instanceof patristic.Branch){
      if(target.sources(source)){
        flips[i] = 1;
      }
    }
  }
  console.log('Directionality Inference time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(JSON.stringify(flips)).buffer;
  postMessage({output, start}, [output]);
  close();
};
