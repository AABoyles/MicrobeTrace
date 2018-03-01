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
      linkFields: ['source', 'target', 'tn93', 'snps', 'visible', 'cluster', 'origin']
    },
    state: {
      visible_clusters: [],
      alpha: 0.3
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
  let oldNode = session.data.nodes.find(d => d.id === newNode.id);
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
  let oldLink = session.data.links.find(l => l.source === newLink.source & l.target === newLink.target);
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
  let seqs = [], currentSeq = {};
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

app.hamming = function(s1, s2){
  let i = s1.length;
  let sum = 0;
  while(--i > 0){
    if(s1[i] !== s2[i]) sum++;
  }
  return sum;
};

app.align = function(subset, reference){
  subset.forEach(node => {
    let rst = bioseq.align(reference, node.seq, true, [1, -1], [-5, -1.7]);
    let fmt = bioseq.cigar2gaps(reference, node.seq, rst.position, rst.CIGAR);
    node.padding = rst.position;
    node.seq = fmt[1];
  });

  //Final step in alignment: left- and right- padding with hyphens
  let minPadding = _.minBy(subset, 'padding');
  subset.forEach(d => d.seq = '-'.repeat(d.padding - minPadding) + d.seq);

  let maxLength = _.max(subset.map(d => d.seq.length));
  subset.forEach(d => d.seq = d.seq + '-'.repeat(maxLength - d.seq.length));
};

app.computeDistanceMatrices = function(subset){
  let n = subset.length;
  let k = 0;
  session.data.distance_matrix.tn93 = Array(n);
  session.data.distance_matrix.snps = Array(n);
  session.data.distance_matrix.labels = subset.map(d => d.id);
  for(let i = 0; i < n; i++){
    session.data.distance_matrix.tn93[i] = Array(n);
    session.data.distance_matrix.snps[i] = Array(n);
    session.data.distance_matrix.tn93[i][i] = session.data.distance_matrix.snps[i][i] = 0;
    for(let j = 0; j < i; j++){
      let newLink = {
        source: subset[j].id,
        target: subset[i].id,
        tn93: tn93(subset[j]['seq'], subset[i]['seq'], 'AVERAGE'),
        snps: app.hamming(subset[j]['seq'], subset[i]['seq'])
      };
      session.data.distance_matrix.tn93[i][j] = newLink.tn93;
      session.data.distance_matrix.tn93[j][i] = newLink.tn93;
      session.data.distance_matrix.snps[i][j] = newLink.snps;
      session.data.distance_matrix.snps[j][i] = newLink.snps;
      k += app.addLink(newLink);
    }
  }
  return k;
};

app.titleize = function(title){
  let small = title.toLowerCase().replace(/_/g, ' ');
  if(small === 'id') return 'ID';
  if(small === 'snps') return 'SNPs';
  if(small === '2d') return '2D';
  if(small === '3d') return '3D';
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
  let lsv = $('#linkSortVariable').val();
  node.cluster = session.data.clusters.length;
  session.data.clusters[session.data.clusters.length - 1].nodes++;
  session.data.links.forEach(l => {
    if(l.visible && (l.source.id == node.id || l.target.id == node.id)){
      l.cluster = session.data.clusters.length;
      session.data.clusters[session.data.clusters.length - 1].links++;
      session.data.clusters[session.data.clusters.length - 1].sum_distances += l[lsv];
      if(!l.source.cluster) app.DFS(l.source);
      if(!l.target.cluster) app.DFS(l.target);
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
