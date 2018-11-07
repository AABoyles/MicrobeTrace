var app = {};

app.componentCache = {};

app.dataSkeleton = function(){
  return {
    nodes: [],
    links: [],
    clusters: [],
    distance_matrix: {},
    trees: {},
    nodeFields: ['index', 'id', 'selected', 'cluster', 'visible', 'degree', 'origin'],
    linkFields: ['index', 'source', 'target', 'visible', 'cluster', 'origin'],
    clusterFields: ['id', 'index', 'nodes', 'links', 'sum_distances', 'links_per_node', 'mean_genetic_distance', 'visible'],
    reference: 'CCTCAGGTCACTCTTTGGCAACGACCCCTCGTCACAATAAAGATAGGGGGGCAACTAAAGGAAGCTCTATTAGATACAGGAGCAGATGATACAGTATTAGAAGAAATGAGTTTGCCAGGAAGATGGAAACCAAAAATGATAGGGGGAATTGGAGGTTTTATCAAAGTAAGACAGTATGATCAGATACTCATAGAAATCTGTGGACATAAAGCTATAGGTACAGTATTAGTAGGACCTACACCTGTCAACATAATTGGAAGAAATCTGTTGACTCAGATTGGTTGCACTTTAAATTTTCCCATTAGCCCTATTGAGACTGTACCAGTAAAATTAAAGCCAGGAATGGATGGCCCAAAAGTTAAACAATGGCCATTGACAGAAGAAAAAATAAAAGCATTAGTAGAAATTTGTACAGAGATGGAAAAGGAAGGGAAAATTTCAAAAATTGGGCCTGAAAATCCATACAATACTCCAGTATTTGCCATAAAGAAAAAAGACAGTACTAAATGGAGAAAATTAGTAGATTTCAGAGAACTTAATAAGAGAACTCAAGACTTCTGGGAAGTTCAATTAGGAATACCACATCCCGCAGGGTTAAAAAAGAAAAAATCAGTAACAGTACTGGATGTGGGTGATGCATATTTTTCAGTTCCCTTAGATGAAGACTTCAGGAAGTATACTGCATTTACCATACCTAGTATAAACAATGAGACACCAGGGATTAGATATCAGTACAATGTGCTTCCACAGGGATGGAAAGGATCACCAGCAATATTCCAAAGTAGCATGACAAAAATCTTAGAGCCTTTTAGAAAACAAAATCCAGACATAGTTATCTATCAATACATGGATGATTTGTATGTAGGATCTGACTTAGAAATAGGGCAGCATAGAACAAAAATAGAGGAGCTGAGACAACATCTGTTGAGGTGGGGACTTACCACACCAGACAAAAAACATCAGAAAGAACCTCCATTCCTTTGGATGGGTTATGAACTCCATCCTGATAAATGGACAGTACAGCCTATAGTGCTGCCAGAAAAAGACAGCTGGACTGTCAATGACATACAGAAGTTAGTGGGGAAATTGAATTGGGCAAGTCAGATTTACCCAGGGATTAAAGTAAGGCAATTATGTAAACTCCTTAGAGGAACCAAAGCACTAACAGAAGTAATACCACTAACAGAAGAAGCAGAGCTAGAACTGGCAGAAAACAGAGAGATTCTAAAAGAACCAGTACATGGAGTGTATTATGACCCATCAAAAGACTTAATAGCAGAAATACAGAAGCAGGGGCAAGGCCAATGGACATATCAAATTTATCAAGAGCCATTTAAAAATCTGAAAACAGGAAAATATGCAAGAATGAGGGGTGCCCACACTAATGATGTAAAACAATTAACAGAGGCAGTGCAAAAAATAACCACAGAAAGCATAGTAATATGGGGAAAGACTCCTAAATTTAAACTGCCCATACAAAAGGAAACATGGGAAACATGGTGGACAGAGTATTGGCAAGCCACCTGGATTCCTGAGTGGGAGTTTGTTAATACCCCTCCCTTAGTGAAATTATGGTACCAGTTAGAGAAAGAACCCATAGTAGGAGCAGAAACCTTC'
  };
};

app.defaultWidgets = {
  '3DNet-link-tooltip-variable': 'None',
  '3DNet-link-transparency': 0,
  '3DNet-link-width': 1.6,
  '3DNet-node-tooltip-variable': 'id',
  '3DNet-node-radius': 4,
  '3DNet-node-radius-variable': 'None',
  'background-color': '#ffffff',
  'background-color-contrast': '#000000',
  'bubble-x': 'None',
  'bubble-y': 'None',
  'bubble-size': 5,
  'flow-source-variable': 'selected',
  'flow-target-variable': 'cluster',
  'heatmap-metric': 'tn93',
  'heatmap-invertX': false,
  'heatmap-invertY': false,
  'heatmap-color-high': '#a50026',
  'heatmap-color-medium': '#ffffbf',
  'heatmap-color-low': '#313695',
  'heatmap-axislabels-show': false,
  'histogram-axis-x': true,
  'histogram-scale-log': false,
  'histogram-variable': 'links-tn93',
  'link-color': '#a6cee3',
  'link-color-variable': 'None',
  'link-directed': false,
  'link-length': 0.125,
  'link-opacity': 0,
  'link-tooltip-variable': 'None',
  'link-width': 3,
  'link-width-variable': 'None',
  'link-width-reciprocal': true,
  'map-basemap-show': false,
  'map-counties-show': false,
  'map-countries-show': true,
  'map-field-lat': 'None',
  'map-field-lon': 'None',
  'map-field-tract': 'None',
  'map-field-zipcode': 'None',
  'map-field-county': 'None',
  'map-field-state': 'None',
  'map-field-country': 'None',
  'map-link-show': false,
  'map-link-tooltip-variable': 'None',
  'map-link-transparency': 0,
  'map-node-jitter': 0,
  'map-node-show': true,
  'map-node-tooltip-variable': 'id',
  'map-node-transparency': 0,
  'map-satellite-show': false,
  'map-states-show': true,
  'network-friction': 0.4,
  'network-gravity': 0.05,
  'node-charge': 200,
  'node-color': '#1f77b4',
  'node-color-variable': 'None',
  'node-highlight': false,
  'node-label-variable': 'None',
  'node-radius': 250,
  'node-radius-variable': 'None',
  'node-symbol': 'symbolCircle',
  'node-symbol-variable': 'None',
  'node-tooltip-variable': 'id',
  'scatterplot-xVar': 'snps',
  'scatterplot-yVar': 'tn93',
  'scatterplot-logScale': false,
  'selected-color': '#ff8300',
  'selected-color-contrast': '#000000',
  'tree-metric': 'tn93',
  'tree-layout-circular': false,
  'tree-labels-align': false,
  'tree-labels-show': true
};

app.sessionSkeleton = function(){
  return {
    data: app.dataSkeleton(),
    files: [],
    layout: {
      content: [{
        type: 'files'
      }],
      type: 'stack'
    },
    meta: {
      loadTime: 0,
      startTime: 0
    },
    network: {
      allPinned: false,
      nodes: []
    },
    state: {
      linkSortVariable: 'tn93',
      linkThreshold: 0.015,
      timeStart: 0,
      timeEnd: Date.now()
    },
    style: {
      linkColors: d3.schemePaired,
      linkColorMap: function(){ return session.style.widgets['link-color']; },
      nodeColors: [d3.schemeCategory10[0]].concat(d3.schemeCategory10.slice(2)),
      nodeColorMap: function(){ return session.style.widgets['node-color']; },
      nodeSymbols: ['symbolCircle', 'symbolCross', 'symbolDiamond', 'symbolSquare', 'symbolStar', 'symbolTriangle', 'symbolWye', 'symbolTriangleDown', 'symbolTriangleLeft', 'symbolTriangleRight', 'symbolDiamondAlt', 'symbolDiamondSquare', 'symbolPentagon', 'symbolHexagon', 'symbolHexagonAlt', 'symbolOctagon', 'symbolOctagonAlt', 'symbolX'],
      nodeSymbolMap: function(){ return session.style.widgets['node-symbol']; },
      widgets: app.defaultWidgets
    },
    warnings: []
  };
};

app.defaultNode = function(){
  return {
    index: session.data.nodes.length,
    id: '',
    selected: false,
    cluster: 1,
    visible: true,
    degree: 0,
    origin: []
  }
};

app.addNode = function(newNode){
  if(typeof newNode.id === 'number') newNode.id = '' + newNode.id;
  var oldNode = session.data.nodes.find(function(d){ return d.id === newNode.id; });
  if(oldNode){
    if(newNode.origin) newNode.origin = newNode.origin.concat(oldNode.origin);
    Object.assign(oldNode, newNode);
    return 0;
  } else {
    if('seq' in newNode) newNode._seqInt = newNode.seq.split('').map(function(c){ return tn93.mapChar[c.charCodeAt(0)]; });
    session.data.nodes.push(Object.assign(app.defaultNode(), newNode));
    return 1;
  }
};

app.defaultLink = function(){
  return {
    index: session.data.links.length,
    source: '',
    target: '',
    visible: false,
    cluster: 1,
    origin: []
  }
};

app.addLink = function(newLink, check){
  var links = session.data.links;
  if(check){
    var n = links.length;
    for(var i = 0; i < n; i++){
      var l = links[i];
      if((l.source === newLink.source & l.target === newLink.target) |
      (l.source === newLink.target & l.target === newLink.source)){
        if(newLink.origin && !l.origin.includes(newLink.origin)){
          newLink.origin = newLink.origin.concat(l.origin);
        }
        Object.assign(l, newLink);
        return 0;
      }
    }
  }
  links.push(Object.assign(app.defaultLink(), newLink));
  return 1;
};

app.parseHIVTrace = function(hivtrace){
  hivtrace['trace_results']['Nodes'].forEach(function(node){
    var newNode = JSON.parse(JSON.stringify(node.patient_attributes));
    newNode.id = node.id;
    newNode.origin = 'HIVTRACE Import';
    app.addNode(newNode);
  });
  Object.keys(hivtrace['trace_results']['Nodes'][0]['patient_attributes']).forEach(function(key){
    if(!session.data.nodeFields.includes(key)) session.data.nodeFields.push(key);
  });
  var n = hivtrace['trace_results']['Edges'].length;
  for(var i = 0; i < n; i++){
    var link = hivtrace['trace_results']['Edges'][i];
    app.addLink({
      'source': '' + link.sequences[0],
      'target': '' + link.sequences[1],
      'distance': parseFloat(link.length),
      'origin': ['HIVTRACE Import'],
      'visible': true
    }, false);
  }
};

app.parseFASTA = function(text){
  if(!text || text.length === 0) return []
  var seqs = [], currentSeq = {};
  text.split(/[\r\n]+/g).forEach(function(line, i){
    if(/^\s*$/.test(line)) return;
    if(line[0] === '>' || line[0] === ';'){
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

app.decoder = new TextDecoder('utf-8');

app.align = function(params, callback){
  if(params.aligner === 'none'){
    if(callback) callback(params.nodes);
    return;
  }
  var start = Date.now();
  var n = params.nodes.length;
  aligner = new Worker('scripts/align-'+params.aligner+'.js');
  aligner.onmessage = function(response){
    output = JSON.parse(app.decoder.decode(new Uint8Array(response.data.nodes)));
    console.log('Alignment transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    start = Date.now();
    var minPadding = Number.MAX_SAFE_INTEGER,
        maxLength = 0;
    for(var j = 0; j < n; j++){
      var d = output[j];
      if(!d.seq) d.seq = '';
      if(minPadding > d.padding) minPadding = d.padding;
    }
    for(var j = 0; j < n; j++){
      var d = output[j];
      d.seq = '-'.repeat(d.padding - minPadding) + d.seq;
      delete d.padding;
      if(maxLength < d.seq.length) maxLength = d.seq.length;
    }
    for(var j = 0; j < n; j++){
      var d = output[j];
      d.seq = d.seq + '-'.repeat(maxLength - d.seq.length);
    }
    console.log('Alignment Padding time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    callback(output);
  };
  aligner.postMessage(params);
};

app.computeConsensus = function(callback){
  var nodes = session.data.nodes.filter(function(d){ return d.seq; });
  var computer = new Worker('scripts/compute-consensus.js');
  computer.onmessage = function(response){
    consensus = app.decoder.decode(new Uint8Array(response.data.consensus));
    console.log('Consensus Transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    if(callback) callback(consensus);
  };
  computer.postMessage(nodes);
};

app.computeConsensusDistances = function(callback){
  var start = Date.now();
  var computer = new Worker('scripts/compute-consensus-distances.js');
  computer.onmessage = function(response){
    var nodes = JSON.parse(app.decoder.decode(new Uint8Array(response.data.nodes)));
    console.log('Consensus Difference Transit time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
    if(callback) callback(nodes);
  };
  var subset = [];
  var n = session.data.nodes.length;
  for(var i = 0; i < n; i++){
    var node = session.data.nodes[i];
    if(node.seq) subset.push({
      index: i,
      seq: node.seq
    });
  }
  computer.postMessage({
    consensus: session.data.consensus,
    nodes: subset
  });
};

app.computeLinks = function(subset, metrics, callback){
  var k = 0, computer = new Worker('scripts/compute-links.js');
  computer.onmessage = function(response){
    var links = JSON.parse(app.decoder.decode(new Uint8Array(response.data.links)));
    console.log('Links Transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    var start = Date.now();
    var check = session.files.length > 1;
    links.forEach(function(link, j){
      k += app.addLink(link, check);
    });
    computer.terminate();
    console.log('Links Merge time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
    callback(k);
  };
  computer.postMessage({
    nodes: subset,
    metrics: metrics
  });
};

app.computeDM = function(metrics, callback){
  var computer = new Worker('scripts/compute-dm.js');
  computer.onmessage = function(response){
    session.data.distance_matrix = JSON.parse(app.decoder.decode(new Uint8Array(response.data.matrices)));
    console.log('DM Transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    if(callback) callback();
  };
  computer.postMessage({
    nodes: session.data.nodes,
    links: session.data.links.filter(function(l){
      return _.any(metrics.map(function(m){ return _.isNumber(l[m]); }));
    }),
    metrics: metrics
  });
};

app.computeTree = function(type, callback){
  var computer = new Worker('scripts/compute-tree.js');
  computer.onmessage = function(response){
    session.data.trees[type] = app.decoder.decode(new Uint8Array(response.data.tree));
    console.log('Tree (' +  type + ') Transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    if(callback) callback();
  };
  computer.postMessage({
    matrix: session.data.distance_matrix[type],
    labels: session.data.distance_matrix.labels
  });
};

app.computeNN = function(metric, callback){
  if(!session.data.distance_matrix[metric]){
    console.error('Couldn\'t find Distance Matrix ' + metric + ' to compute Nearest Neighbors.');
    return;
  }
  var nnMachine = new Worker('scripts/compute-nn.js');
  nnMachine.onmessage = function(response){
    if(response.data === 'Error'){
      console.error('Nearest Neighbor washed out');
      return;
    }
    var links = JSON.parse(app.decoder.decode(new Uint8Array(response.data.links)));
    console.log('NN Transit time: ', ((Date.now()-response.data.start)/1000).toLocaleString(), 's');
    var start = Date.now();
    links.forEach(function(l){ session.data.links[l.index].nn = l.nn });
    console.log('NN Merge time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
    if(callback) callback();
  };
  nnMachine.postMessage({
    links: session.data.links,
    nodes: session.data.nodes,
    matrix: session.data.distance_matrix[metric]
  });
};

app.capitalize = function(c){
  return c.toUpperCase();
};

app.titleize = function(title){
  var small = title.toLowerCase().replace(/_/g, ' ');
  if(small === 'id') return 'ID';
  if(small === 'tn93') return 'TN93';
  if(small === 'snps') return 'SNPs';
  if(small === '2d network') return '2D Network';
  if(small === '3d network') return '3D Network';
  if(small === 'geo map') return 'Map';
  return small.replace(/(?:^|\s|-)\S/g, app.capitalize);
};

app.tagClusters = function(){
  session.data.clusters = [];
  session.data.nodes.forEach(function(node){ delete node.cluster; });
  session.data.nodes.forEach(function(node){
    if(typeof node.cluster === 'undefined'){
      session.data.clusters.push({
        id: session.data.clusters.length,
        nodes: 0,
        links: 0,
        sum_distances: 0,
        links_per_node: 0,
        mean_genetic_distance: undefined,
        visible: true
      });
      app.DFS(node);
    }
  });
  session.data.clusters = session.data.clusters.filter(function(c){ return c.nodes > 1; });
};

app.DFS = function(node){
  if(typeof node === 'string') node = session.data.nodes.find(function(d){ return d.id === node; });
  if(typeof node === 'undefined') console.error('That\'s weird: An undefined node was referenced.');
  if(typeof node.cluster !== 'undefined') return;
  var lsv = $('#links-filter-variable').val();
  node.cluster = session.data.clusters.length - 1;
  session.data.clusters[session.data.clusters.length - 1].nodes++;
  session.data.links.forEach(function(l){
    if(l.visible && (l.source === node.id || l.target === node.id)){
      l.cluster = session.data.clusters.length - 1;
      var cluster = session.data.clusters[session.data.clusters.length - 1];
      cluster.links++;
      cluster.sum_distances += parseFloat(l[lsv]);
      if(!l.source.cluster) app.DFS(l.source);
      if(!l.target.cluster) app.DFS(l.target);
    }
  });
};

app.computeDegree = function(){
  session.data.nodes.forEach(function(d){ d.degree = 0; });
  var numLinks = session.data.links.length;
  for(var i = 0; i < numLinks; i++){
    var l = session.data.links[i];
    if(!l.visible) continue;
    session.data.nodes.find(function(d){ return d.id === l.source; }).degree++;
    session.data.nodes.find(function(d){ return d.id === l.target; }).degree++;
  }
  session.data.clusters.forEach(function(c){
    c.links = c.links/2;
    c.links_per_node = c.links/c.nodes;
    c.mean_genetic_distance = c.sum_distances/2/c.links;
  });
};

app.setNodeVisibility = function(){
  var showSingletons = $('#ShowSingletons').is(':checked');
  var field = $('#date-column').val();
  session.data.nodes.forEach(function(n){
    var cluster = session.data.clusters.find(function(c){ return c.id === n.cluster; });
    n.visible = cluster ? cluster.visible : showSingletons;
    if(session.state.time && field){
      n.visible = n.visible && session.state.time.isAfter(n[field]);
    }
  });
  $(window).trigger('node-visibility');
};

app.setLinkVisibility = function(){
  var metric  = $('#links-filter-variable').val(),
      threshold = parseFloat($('#link-threshold').val()),
      showNN = $('#links-show-nn').is(':checked');
  session.state.linkThreshold = threshold;
  session.data.links.forEach(function(link){
    link.visible = true;
    if(showNN){
      link.visible &= link.nn;
    }
    if(metric !== 'none'){
      link.visible &= (link[metric] <= threshold);
    }
    if(session.data.clusters.length > 0){
      //The above condition is a dumb hack to initial load the network
      var cluster = session.data.clusters.find(function(c){ return c.id === link.cluster; });
      if(cluster) link.visible &= cluster.visible;
    }
  });
};

app.getVisibleNodes = function(copy){
  var nodes = session.data.nodes;
  var n = nodes.length;
  var out = [];
  for(var i = 0; i < n; i++){
    var node = nodes[i];
    if(node.visible){
      if(copy){
        out.push(JSON.parse(JSON.stringify(node)));
      } else {
        out.push(node);
      }
    }
  }
  return out;
};

app.getVisibleLinks = function(copy){
  var links = session.data.links;
  var n = links.length;
  var out = [];
  if(copy){
    for(var i = 0; i < n; i++){
      var link = links[i];
      if(link.visible) out.push(JSON.parse(JSON.stringify(link)));
    }
  } else {
    for(var i = 0; i < n; i++){
      var link = links[i];
      if(link.visible) out.push(link);
    }
  }
  return out;
};

// TODO: hideSingletons should be inferred from session.state, not passed.
app.updateNetwork = function(hideSingletons){
  app.setLinkVisibility();
  app.tagClusters();
  if(hideSingletons) app.setNodeVisibility();
  app.computeDegree();
};

app.updateStatistics = function(){
  if($('#network-statistics-hide').is(':checked')) return;
  var vnodes = app.getVisibleNodes();
  var vlinks = app.getVisibleLinks();
  var singletons = vnodes.filter(function(d){ return d.degree === 0; }).length;
  $('#numberOfSelectedNodes').text(vnodes.filter(function(d){ return d.selected; }).length.toLocaleString());
  $('#numberOfNodes').text(vnodes.length.toLocaleString());
  $('#numberOfVisibleLinks').text(vlinks.length.toLocaleString());
  $('#numberOfSingletonNodes').text(singletons.toLocaleString());
  $('#numberOfDisjointComponents').text(session.data.clusters.length);
};

app.reset = function(){
  $('#network-statistics-hide, #color-table-hide').parent().trigger('click');
  window.session = app.sessionSkeleton();
  layout.unbind('stateChanged');
  layout.root.replaceChild(layout.root.contentItems[0], {
    type: 'stack',
    content: []
  });
  layout.contentItems = [];
  app.launchView('files');
};

//adapted from from http://www.movable-type.co.uk/scripts/latlong.html
app.haversine = function(a, b){
  var R = 6371; // kilometers
  var φ1 = a._lat * Math.PI / 180;
  var φ2 = b._lat * Math.PI / 180;
  var Δφ = (b._lat - a._lat) * Math.PI / 180;
  var Δλ = (b._lon - a._lon) * Math.PI / 180;
  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return(c * R);
};

app.geoDM = function(){
  var nodes = session.data.nodes;
  var n = nodes.length;
  var dm = Array(n);
  for(var i = 0; i < n; i++){
    dm[i] = Array(n);
    dm[i][i] = 0;
    for(var j = 0; j < i; j++){
      var dist = app.haversine(nodes[i], nodes[j]);
      dm[i][j] = dist;
      dm[j][i] = dist;
    }
  }
  session.data.distance_matrix.geo = dm;
};

//Adapted from https://24ways.org/2010/calculating-color-contrast/
app.contrastColor = function(hexcolor){
	var r = parseInt(hexcolor.substr(1,2),16);
	var g = parseInt(hexcolor.substr(3,2),16);
	var b = parseInt(hexcolor.substr(5,2),16);
	var yiq = (r*299)+(g*587)+(b*114);
	return (yiq >= 128000) ? '#000000' : '#ffffff';
};

app.launchView = function(view, callback){
  if(!app.componentCache[view]){
    $.get('components/' + view + '.html', function(response){
      app.componentCache[view] = response;
      layout.registerComponent(view, function(container, state){
        container.getElement().html(state.text);
      });
      if(callback){
        app.launchView(view, callback);
      } else {
        return app.launchView(view);
      }
    });
  } else {
    var contentItem = layout.contentItems.find(function(item){
      return item.componentName === view;
    });
    if(contentItem){
      contentItem.parent.setActiveContentItem(contentItem);
    } else {
      var lastStack = _.last(layout.root.contentItems[0].getItemsByType('stack'));
      if(!lastStack) lastStack = layout.root.contentItems[0];
      lastStack.addChild({
        componentName: view,
        componentState: {text: app.componentCache[view]},
        title: app.titleize(view),
        type: 'component'
      });
      contentItem = _.last(lastStack.contentItems);
      contentItem.on('itemDestroyed', function(){
        var i = layout.contentItems.findIndex(function(item){
          return item === contentItem;
        });
        layout.contentItems.splice(i, 1);
      });
      layout.contentItems.push(contentItem);
    }
    contentItem.element.find('select.nodeVariables').html(
      '<option>None</option>' +
      session.data.nodeFields.map(function(field){ return '<option value="'+field+'">'+app.titleize(field)+'</option>'; }).join('\n')
    );
    contentItem.element.find('select.linkVariables').html(
      '<option>None</option>' +
      session.data.linkFields.map(function(field){ return '<option value="'+field+'">'+app.titleize(field)+'</option>'; }).join('\n')
    );
    contentItem.element.find('select.mixedVariables').html(
      '<option>None</option>' +
      session.data.linkFields.map(function(field){ return '<option value="links-'+field+'">Links '+app.titleize(field)+'</option>'; }).concat(
      session.data.nodeFields.map(function(field){ return '<option value="nodes-'+field+'">Nodes '+app.titleize(field)+'</option>'; })).join('\n')
    );
    contentItem.element.find('.launch-color-options').click(function(){
      $('#color-tab').tab('show');
      setTimeout(function(){
        $('#global-settings-modal').modal('show');
      }, 250);
    });
    if(navigator.onLine) contentItem.element.find('.ifOnline').show();
    for(var id in session.style.widgets){
      $id = $('#' + id);
      if($id.length > 0){
        if(['radio', 'checkbox'].includes($id[0].type)){
          if(session.style.widgets[id]) $id.click();
        } else {
          $id.val(session.style.widgets[id]);
        }
      }
    }
    contentItem.element.find('[data-toggle="tooltip"]').tooltip();
    if(callback){
      callback(contentItem);
    } else {
      return contentItem;
    }
  }
};

app.cacheLayout = function(contentItem){
  if(['stack', 'row', 'column'].includes(contentItem.type)){
    return {
      'type': contentItem.type,
      'content': contentItem.contentItems.map(app.cacheLayout)
    };
  }
  return {'type': contentItem.componentName};
};

app.loadLayout = function(component, first){
  if(first) app.lastItem = layout.root.contentItems[0];
  if(['stack', 'row', 'column'].includes(component.type)){
    component.content.map(app.loadLayout);
  } else {
    app.launchView(component.type);
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
  var labels = session.data.distance_matrix.labels;
  return ',' + labels.join(',') + '\n' +
    dm
      .map(function(row, i){ return labels[i] + ',' + row.join(','); })
      .join('\n');
};

app.unparseSVG = function(svgNode){
	svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
  var selectorTextArr = [];

  // Add Parent element Id and Classes to the list
  selectorTextArr.push( '#'+svgNode.id );
  for (var c = 0; c < svgNode.classList.length; c++){
    if (!('.'+svgNode.classList[c]).includes(selectorTextArr)){
      selectorTextArr.push('.'+svgNode.classList[c]);
    }
  }

  // Add Children element Ids and Classes to the list
  var nodes = svgNode.getElementsByTagName('*');
  for(var i = 0; i < nodes.length; i++){
    var id = nodes[i].id;
    if(!('#'+id).includes(selectorTextArr)){
      selectorTextArr.push( '#'+id );
    }
    var classes = nodes[i].classList;
    for(var c = 0; c < classes.length; c++){
      if(!('.'+classes[c]).includes(selectorTextArr)){
        selectorTextArr.push('.'+classes[c]);
      }
    }
  }

  // Extract CSS Rules
  var extractedCSSText = '';
  for (var i = 0; i < document.styleSheets.length; i++) {
    var s = document.styleSheets[i];
    try {
      if(!s.cssRules) continue;
    } catch(e){
      if(e.name !== 'SecurityError') throw e; // for Firefox
      continue;
    }
    var cssRules = s.cssRules;
    for (var r = 0; r < cssRules.length; r++) {
      if(!cssRules[r].selectorText) continue;
      if(cssRules[r].selectorText.includes(selectorTextArr)){
        extractedCSSText += cssRules[r].cssText;
      }
    }
  }

  var styleElement = document.createElement('style');
  styleElement.setAttribute('type', 'text/css');
  styleElement.innerHTML = extractedCSSText;
  var refNode = svgNode.hasChildNodes() ? svgNode.children[0] : null;
  svgNode.insertBefore(styleElement, refNode);
	var serializer = new XMLSerializer();
	return serializer.serializeToString(svgNode);
};

app.blobifySVG = function(svgString, width, height, callback){
	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	var image = new Image();
	image.onload = function(){
    var context = canvas.getContext('2d');
		context.clearRect(0, 0, width, height);
		context.drawImage(image, 0, 0, width, height);
		canvas.toBlob(callback);
	};
	image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
};

app.getHelp = function(filename, callback){
  $.get('help/' + filename, function(response){
    callback(marked(response));
  });
};

app.exportHIVTRACE = function(){
  var links = session.data.links.filter(function(l){ return l.visible });
  var geneticLinks = links.filter(function(l){ return l.origin.includes('Genetic Distance'); });
  var sequences = _.union(
    geneticLinks.map(function(l){ return l.source; }),
    geneticLinks.map(function(l){ return l.target; })
  );
  var pas = {};
  session.data.nodes.forEach(function(d){
    Object.keys(d).forEach(function(key){
      if(pas[key]) return;
      pas[key] = {
        label: key,
        type: app.titleize(typeof d[key])
      }
    });
  });
  return JSON.stringify({
    'trace_results': {
      'Cluster sizes': session.data.clusters.map(function(c){ return c.size; }),
      'Degrees': {
        'Distribution': [],
        'Model': 'Waring',
        'fitted': [],
        'rho': 0,
        'rho CI': [-1, 1]
      },
      'Directed Edges': {
        'Count': 0,
        'Reasons for unresolved directions': {
          'Missing dates': links.length
        }
      },
      'Edge Stages': {},
      'Edges': links.map(function(l){ return {
        'attributes': ['BULK'],
        'directed': false,
        'length': l[session.state.linkSortVariable],
        'removed': false,
        'sequences': [l.source, l.target],
        'source': session.data.nodes.findIndex(function(d){ return d.id === l.source; }),
        'support': 0,
        'target': session.data.nodes.findIndex(function(d){ return d.id === l.target; })
      }}),
      'HIV Stages': {
        "A-1": 0,
        "A-2": 0,
        "A-3": 0,
        "Chronic": session.data.nodes.length,
        "E-1": 0,
        "E-2": 0,
        "E-3": 0
      },
      'Multiple sequences': {
        'Followup, days': null,
        'Subjects with': 0
      },
      'Network Summary': {
        'Clusters': session.data.clusters.length,
        'Edges': links.length,
        'Nodes': session.data.nodes.length,
        'Sequences used to make links': sequences.length
      },
      'Nodes': session.data.nodes.map(function(d){ return {
        'attributes': [],
        'baseline': null,
        'cluster': d.cluster,
        'edi': null,
        'id': d.id,
        'patient_attributes': d
      }}),
      'patient_attribute_schema': pas,
      'Settings': {
        'contaminant-ids': [],
        'contaminants': 'remove',
        'edge-filtering': 'remove',
        'threshold': session.state.linkThreshold
      },
    }
  }, null, 2)
};
