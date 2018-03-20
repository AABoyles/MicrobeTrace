var app = {};

app.componentCache = [];

app.dataSkeleton = function(){
  return {
    nodes: [],
    links: [],
    clusters: [],
    distance_matrix: {},
    nodeFields: ['id', 'index', 'padding', 'selected', 'cluster', 'visible', 'degree', 'seq', 'origin'],
    linkFields: ['source', 'target', 'index', 'distance', 'tn93', 'snps', 'visible', 'cluster', 'origin']
  };
};

app.sessionSkeleton = function(){
  return {
    files: [],
    data: app.dataSkeleton(),
    state: {
      visible_clusters: [],
      alpha: 0.3,
      contentItems: []
    },
    style: {
      palette: ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"]
    },
    messages: []
  };
};

app.defaultNode = function(){
  return {
    id: '',
    index: session.data.nodes.length,
    padding: 0,
    selected: 0,
    cluster: 1,
    visible: 1,
    degree: 0,
    seq: '',
    origin: []
  }
};

app.addNode = function(newNode){
  if(typeof newNode.id === 'number') newNode.id = '' + newNode.id;
  var oldNode = session.data.nodes.find(d => d.id === newNode.id);
  if(oldNode){
    if(newNode.origin) newNode.origin = newNode.origin.concat(oldNode.origin);
    Object.assign(oldNode, newNode);
    return 0;
  } else {
    session.data.nodes.push(Object.assign(app.defaultNode(), newNode));
    return 1;
  }
};

app.defaultLink = function(){
  return {
    source: '',
    target: '',
    index: session.data.links.length,
    tn93: 1,
    snps: Number.INFINITY,
    visible: 0,
    cluster: 1,
    origin: []
  }
};

app.addLink = function(newLink){
  var oldLink = session.data.links.find(l => l.source === newLink.source & l.target === newLink.target);
  if(oldLink){
    if(newLink.origin) newLink.origin = newLink.origin.concat(oldLink.origin);
    Object.assign(oldLink, newLink);
    return 0;
  } else {
    session.data.links.push(Object.assign(app.defaultLink(), newLink));
    return 1;
  }
};

app.parseFASTA = function(text){
  if(!text || text.length === 0) return []
  var seqs = [], currentSeq = {};
  text.split(/[\r\n]+/g).forEach((line, i) => {
    if(/^\s*$/.test(line)) return;
    if(line[0] === ">" || line[0] === ";"){
      if(i > 0) seqs.push(currentSeq);
      currentSeq = {
        id: line.slice(1),
        seq: ''
      };
    } else {
      currentSeq.seq += line;
    }
  });
  seqs.push(currentSeq);
  return seqs;
};

app.parseNewick = function(a){
  for(var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0; t < s.length; t++){
    var n = s[t];
    switch(n){
      case "(": var c = {}; r.branchset = [c], e.push(r), r = c; break;
      case ",": var c = {}; e[e.length-1].branchset.push(c), r = c; break;
      case ")": r = e.pop(); break;
      case ":": break;
      default: var h = s[t-1]; ")" == h || "(" == h || "," == h ? r.name = n : ":" == h && (r.length = parseFloat(n))
    }
  }
  return r;
};

app.titleize = function(title){
  var small = title.toLowerCase().replace(/_/g, ' ');
  if(small === 'id') return 'ID';
  if(small === 'tn93') return 'TN93';
  if(small === 'snps') return 'SNPs';
  if(small === '2d network') return '2D Network';
  if(small === '3d network') return '3D Network';
  return small.replace(/(?:^|\s|-)\S/g, function(c){
    return c.toUpperCase();
  });
};

app.tagClusters = function(){
  session.data.clusters = [];
  session.data.nodes.forEach(node => delete node.cluster);
  session.data.nodes.forEach(node => {
    if(typeof node.cluster === 'undefined'){
      session.data.clusters.push({
        id: session.data.clusters.length,
        nodes: 0,
        links: 0,
        sum_distances: 0,
        visible: 1
      });
      app.DFS(node);
    }
  });
  session.state.visible_clusters = session.data.clusters.map(c => c.id);
};

app.DFS = function(node){
  if(typeof node === 'string') node = session.data.nodes.find(function(d){ return d.id === node; });
  if(typeof node.cluster !== 'undefined') return;
  var lsv = $('#linkSortVariable').val();
  node.cluster = session.data.clusters.length;
  session.data.clusters[session.data.clusters.length - 1].nodes++;
  session.data.links.forEach(l => {
    if(l.visible && (l.source === node.id || l.target === node.id)){
      l.cluster = session.data.clusters.length;
      var cluster = session.data.clusters[session.data.clusters.length - 1];
      cluster.links++;
      cluster.sum_distances += l[lsv];
      var source = session.data.nodes.find(d => d.id === l.source);
      if(!l.source.cluster) app.DFS(source);
      var target = session.data.nodes.find(d => d.id === l.target);
      if(!l.target.cluster) app.DFS(target);
    }
  });
};

app.computeDegree = function(){
  session.data.nodes.forEach(d => d.degree = 0);
  session.data.links
    .filter(l => l.visible)
    .forEach(l => {
      session.data.nodes.find(d => d.id === l.source).degree++;
      session.data.nodes.find(d => d.id === l.target).degree++;
    });
  session.data.clusters.forEach(c => {
    c.links = c.links/2;
    c.links_per_node = c.links/c.nodes;
    c.mean_genetic_distance = c.sum_distances/2/c.links;
  });
};

app.setNodeVisibility = function(){
  session.data.nodes.forEach(n => n.visible = 1);
  if(session.state.visible_clusters.length < session.data.clusters.length){
    session.data.nodes.forEach(n => n.visible = n.visible && session.state.visible_clusters.includes(n.cluster));
  }
  if($('#HideSingletons').is(':checked')){
    var clusters = session.data.clusters.map(c => c.nodes);
    session.data.nodes.forEach(n => n.visible = n.visible && clusters[n.cluster-1] > 1);
  }
};

app.setLinkVisibility = function(){
  var metric  = $('#linkSortVariable').val(),
      threshold = $('#default-link-threshold').val();
  session.data.links.forEach(link => link.visible = 1);
  if(metric !== 'none'){
    session.data.links.forEach(link => link.visible = link.visible && (link[metric] <= threshold));
  }
  if($('#showMSTLinks').is(':checked')){
    session.data.links.forEach(link => link.visible = link.visible && link.mst);
  }
  if(session.state.visible_clusters.length < session.data.clusters.length){
    session.data.links.forEach(link => link.visible = link.visible && session.state.visible_clusters.includes(link.cluster));
  }
};

app.reset = function(){
  window.session = app.sessionSkeleton();
  layout.root.replaceChild(layout.root.contentItems[0], {
    type: 'stack',
    content: []
  });
  session.state.contentItems = [];
  app.launchView('files');
};

app.launchView = function(view){
  if(!layout._components[view]){
    layout.registerComponent(view, function(container, state){
      container.getElement().html(state.text);
    });
  }
  if(!app.componentCache[view]){
    $.get('components/' + view + '.html', function(response){
      app.componentCache[view] = response;
      app.launchView(view);
    });
  } else {
    var contentItem = session.state.contentItems.find(function(item){
      return item.componentName === view;
    });
    if(contentItem){
      contentItem.parent.setActiveContentItem(contentItem);
    } else {
      layout.root.contentItems[0].addChild({
        componentName: view,
        componentState: { text: app.componentCache[view] },
        title: app.titleize(view),
        type: 'component'
      });
      contentItem = _.last(layout.root.contentItems[0].contentItems);
      contentItem.on('itemDestroyed', function(){
        var i = session.state.contentItems.findIndex(function(item){
          return item === contentItem;
        });
        session.state.contentItems.splice(i, 1);
      });
      session.state.contentItems.push(contentItem);
      contentItem.element.find('select.nodeVariables').html(
        '<option>None</option>' +
        session.data.nodeFields.map(function(field){
          return '<option value="'+field+'">'+app.titleize(field)+'</option>';
        }).join('\n')
      );
      contentItem.element.find('select.linkVariables').html(
        '<option>None</option>' +
        session.data.linkFields.map(function(field){
          return '<option value="'+field+'">'+app.titleize(field)+'</option>';
        }).join('\n')
      );
      contentItem.element.find('[data-toggle="tooltip"]').tooltip();
    }
    return contentItem;
  }
};

app.unparseFASTA = function(nodes){
  return nodes.map(function(node){
    return '>' + node.id + '\r\n' + node.seq;
  }).join('\r\n');
};

app.unparseMEGA = function(nodes){
  return nodes.map(function(node){
    return '#' + node.id + '\r\n' + node.seq;
  }).join('\r\n');
};

app.unparseDM = function(dm){
  return ',' + session.data.distance_matrix.labels.join(',') + '\n' +
    dm
      .map((row, i) => labels[i] + ',' + row.join(','))
      .join('\n');
};

app.exportHIVTRACE = function(){
  return JSON.stringify({
    'trace_results': {
      'HIV Stages': {},
      'Degrees': {},
      'Multiple sequences': {},
      'Edge Stages': {},
      'Cluster sizes': session.data.clusters.map(c => c.size),
      'Settings': {
        'contaminant-ids': [],
        'contaminants': 'remove',
        'edge-filtering': 'remove',
        'threshold': $('#default-link-threshold').val()
      },
      'Network Summary': {
        'Sequences used to make links': 0,
        'Clusters': session.data.clusters.length,
        'Edges': session.data.links.filter(l => l.visible).length,
        'Nodes': session.data.nodes.length
      },
      'Directed Edges': {},
      'Edges': session.data.links,
      'Nodes': session.data.nodes
    }
  }, null, 2)
};
