onmessage = function(e){
  e.data.links.forEach(l => l.mst = false);
  e.data.links.sort((a, b) => a.distance - b.distance);
  e.data.links[0].mst = true;
  var nodes_in_tree = [e.data.links[0].source.id, e.data.links[0].target.id],
  n = e.data.links.length;
  while(nodes_in_tree.length < e.data.nodes.length){
    for(var i = 0; i < n; i++){
      var link = e.data.links[i];
      if(nodes_in_tree.includes(link.source.id) && !nodes_in_tree.includes(link.target.id)){
        nodes_in_tree.push(link.target.id);
        link.mst = true;
        break;
      }
      if(nodes_in_tree.includes(link.target.id) && !nodes_in_tree.includes(link.source.id)){
        nodes_in_tree.push(link.source.id);
        link.mst = true;
        break;
      }
    });
  }
  postMessage(e.data.links);
  close();
};
