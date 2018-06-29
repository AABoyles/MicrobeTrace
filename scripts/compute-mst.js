onmessage = function(e){
  var links = e.data.links;
  links.forEach(l => l.mst = false);
  links.sort((a, b) => a.distance - b.distance);
  links[0].mst = true;
  var nodes_in_tree = [links[0].source, links[0].target];
  var n = links.length;
  var m = e.data.nodes.length;
  while(nodes_in_tree.length < m){
    for(var i = 0; i < n; i++){
      var link = links[i];
      if(nodes_in_tree.includes(link.source) && !nodes_in_tree.includes(link.target)){
        nodes_in_tree.push(link.target);
        link.mst = true;
        break;
      }
      if(nodes_in_tree.includes(link.target) && !nodes_in_tree.includes(link.source)){
        nodes_in_tree.push(link.source);
        link.mst = true;
        break;
      }
    }
  }
  links.sort((a, b) => a.index - b.index);
  postMessage(links);
  close();
};
