var app = {};

app.dataSkeleton = function(){
  return {
    files: [],
    data: {
      nodes: [],
      links: [],
      clusters: [],
      distance_matrix: {},
      nodeFields: ['id', 'padding', 'selected', 'cluster', 'visible', 'degree', 'seq', 'origin'],
      linkFields: ['source', 'target', 'distance', 'tn93', 'snps', 'visible', 'cluster', 'origin']
    },
    state: {
      visible_clusters: [],
      alpha: 0.3
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
    padding: 0,
    selected: 0,
    cluster: 1,
    visible: 1,
    degree: 0,
    seq: '',
    origin: ''
  }
};

app.addNode = function(newNode){
  var oldNode = session.data.nodes.find(d => d.id === newNode.id);
  if(oldNode){
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
    tn93: 1,
    snps: Number.INFINITY,
    visible: 0,
    cluster: 1,
    origin: 'Genetic Distance'
  }
};

app.addLink = function(newLink){
  var oldLink = session.data.links.find(l => l.source === newLink.source & l.target === newLink.target);
  if(oldLink){
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
    if(line[0] == ">" || line[0] == ";"){
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
  if(typeof node.cluster !== 'undefined') return;
  var lsv = $('#linkSortVariable').val();
  node.cluster = session.data.clusters.length;
  session.data.clusters[session.data.clusters.length - 1].nodes++;
  session.data.links.forEach(l => {
    try {
      if(l.visible && (l.source.id == node.id || l.target.id == node.id)){
        l.cluster = session.data.clusters.length;
        session.data.clusters[session.data.clusters.length - 1].links++;
        session.data.clusters[session.data.clusters.length - 1].sum_distances += l[lsv];
        if(!l.source.cluster) app.DFS(l.source);
        if(!l.target.cluster) app.DFS(l.target);
      }
    } catch(error) {
      alertify.error('Missing ID. Did you select the correct Parser?');
      //TODO: reset
    }
  });
};

app.computeDegree = function(){
  session.data.nodes.forEach(d => d.degree = 0);
  session.data.links
    .filter(l => l.visible)
    .forEach(l => {
      l.source.degree++;
      l.target.degree++;
    });
  session.data.clusters.forEach(c => {
    c.links = c.links/2;
    c.links_per_node = c.links/c.nodes;
    c.mean_genetic_distance = c.sum_distances/c.links;
  });
};
