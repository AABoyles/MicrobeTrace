var app = {};

app.componentCache = [];

app.dataSkeleton = function(){
  return {
    nodes: [],
    links: [],
    clusters: [],
    distance_matrix: {},
    trees: {},
    nodeFields: ['id', 'index', 'padding', 'selected', 'cluster', 'visible', 'degree', 'seq', 'origin', 'score'],
    linkFields: ['id', 'index', 'source', 'target', 'distance', 'tn93', 'snps', 'visible', 'cluster', 'origin'],
    clusterFields: ['id', 'index', 'nodes', 'links', 'sum_distances', 'links_per_node', 'mean_genetic_distance', 'visible', 'selected'],
    reference: 'CCTCAGGTCACTCTTTGGCAACGACCCCTCGTCACAATAAAGATAGGGGGGCAACTAAAGGAAGCTCTATTAGATACAGGAGCAGATGATACAGTATTAGAAGAAATGAGTTTGCCAGGAAGATGGAAACCAAAAATGATAGGGGGAATTGGAGGTTTTATCAAAGTAAGACAGTATGATCAGATACTCATAGAAATCTGTGGACATAAAGCTATAGGTACAGTATTAGTAGGACCTACACCTGTCAACATAATTGGAAGAAATCTGTTGACTCAGATTGGTTGCACTTTAAATTTTCCCATTAGCCCTATTGAGACTGTACCAGTAAAATTAAAGCCAGGAATGGATGGCCCAAAAGTTAAACAATGGCCATTGACAGAAGAAAAAATAAAAGCATTAGTAGAAATTTGTACAGAGATGGAAAAGGAAGGGAAAATTTCAAAAATTGGGCCTGAAAATCCATACAATACTCCAGTATTTGCCATAAAGAAAAAAGACAGTACTAAATGGAGAAAATTAGTAGATTTCAGAGAACTTAATAAGAGAACTCAAGACTTCTGGGAAGTTCAATTAGGAATACCACATCCCGCAGGGTTAAAAAAGAAAAAATCAGTAACAGTACTGGATGTGGGTGATGCATATTTTTCAGTTCCCTTAGATGAAGACTTCAGGAAGTATACTGCATTTACCATACCTAGTATAAACAATGAGACACCAGGGATTAGATATCAGTACAATGTGCTTCCACAGGGATGGAAAGGATCACCAGCAATATTCCAAAGTAGCATGACAAAAATCTTAGAGCCTTTTAGAAAACAAAATCCAGACATAGTTATCTATCAATACATGGATGATTTGTATGTAGGATCTGACTTAGAAATAGGGCAGCATAGAACAAAAATAGAGGAGCTGAGACAACATCTGTTGAGGTGGGGACTTACCACACCAGACAAAAAACATCAGAAAGAACCTCCATTCCTTTGGATGGGTTATGAACTCCATCCTGATAAATGGACAGTACAGCCTATAGTGCTGCCAGAAAAAGACAGCTGGACTGTCAATGACATACAGAAGTTAGTGGGGAAATTGAATTGGGCAAGTCAGATTTACCCAGGGATTAAAGTAAGGCAATTATGTAAACTCCTTAGAGGAACCAAAGCACTAACAGAAGTAATACCACTAACAGAAGAAGCAGAGCTAGAACTGGCAGAAAACAGAGAGATTCTAAAAGAACCAGTACATGGAGTGTATTATGACCCATCAAAAGACTTAATAGCAGAAATACAGAAGCAGGGGCAAGGCCAATGGACATATCAAATTTATCAAGAGCCATTTAAAAATCTGAAAACAGGAAAATATGCAAGAATGAGGGGTGCCCACACTAATGATGTAAAACAATTAACAGAGGCAGTGCAAAAAATAACCACAGAAAGCATAGTAATATGGGGAAAGACTCCTAAATTTAAACTGCCCATACAAAAGGAAACATGGGAAACATGGTGGACAGAGTATTGGCAAGCCACCTGGATTCCTGAGTGGGAGTTTGTTAATACCCCTCCCTTAGTGAAATTATGGTACCAGTTAGAGAAAGAACCCATAGTAGGAGCAGAAACCTTC'
  };
};

app.sessionSkeleton = function(){
  return {
    files: [],
    data: app.dataSkeleton(),
    state: {
      linkThreshold: 0.015,
      time: 0
    },
    messages: [],
    style: {
      nodeColors: [d3.schemeCategory10[0]].concat(d3.schemeCategory10.slice(2)),
      nodeColorMap: function(){},
      linkColors: d3.schemePaired,
      linkColorMap: function(){}
    }
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
    score: 0,
    seq: '',
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
  var oldLink = session.data.links.find(function(l){
    return (
      (l.source === newLink.source & l.target === newLink.target) |
      (l.source === newLink.target & l.target === newLink.source)
    );
  });
  if(oldLink){
    if(newLink.origin){
      if(oldLink.origin.includes(newLink.origin)) return 0;
      newLink.origin = newLink.origin.concat(oldLink.origin);
    }
    Object.assign(oldLink, newLink);
    return 0;
  } else {
    session.data.links.push(Object.assign(app.defaultLink(), newLink));
    return 1;
  }
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
      'visible': 1
    });
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

app.align = function(params, callback){
  if(params.aligner === 'none'){
    if(callback){
      callback(params.nodes);
    }
    return params.nodes;
  }
  if(!params.cores) params.cores = 2;
  var n = params.nodes.length;
  var aligners = Array(params.cores);
  var nPerI = Math.ceil(n/params.cores);
  var returned = 0;
  var output = [];
  for(var i = 0; i < params.cores; i++){
    aligners[i] = new Worker('scripts/align-'+params.aligner+'.js');
    aligners[i].onmessage = function(response){
      output = output.concat(response.data);
      if(++returned === aligners.length){
        var minPadding = Number.MAX_SAFE_INTEGER,
            maxLength = 0;
        for(var j = 0; j < n; j++){
          var d = output[j];
          if(minPadding > d.padding) minPadding = d.padding;
        }
        for(var j = 0; j < n; j++){
          var d = output[j];
          d.seq = '-'.repeat(d.padding - minPadding) + d.seq;
          if(maxLength < d.seq.length) maxLength = d.seq.length;
        }
        for(var j = 0; j < n; j++){
          var d = output[j];
          d.seq = d.seq + '-'.repeat(maxLength - d.seq.length);
        }
        callback(output);
      }
    };
    aligners[i].postMessage(Object.assign({}, params, {
      nodes: params.nodes.slice(i*nPerI, Math.min((i+1)*nPerI, n))
    }));
  }
};

app.computeConsensus = function(callback){
  var nodes = session.data.nodes.filter(d => d.seq);
  var computer = new Worker('scripts/compute-consensus.js');
  computer.onmessage = function(response){
    session.data.consensus = response.data;
    if(callback) callback(response.data);
  };
  computer.postMessage(nodes);
};

app.titleize = function(title){
  var small = title.toLowerCase().replace(/_/g, ' ');
  if(small === 'id') return 'ID';
  if(small === 'tn93') return 'TN93';
  if(small === 'snps') return 'SNPs';
  if(small === '2d network') return '2D Network';
  if(small === '3d network') return '3D Network';
  if(small === 'geo map') return 'Map';
  return small.replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
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
        visible: 1,
        selected: 0
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
  var lsv = $('#linkSortVariable').val();
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
  $(window).trigger('node_visibility');
};

app.setLinkVisibility = function(){
  var metric  = $('#linkSortVariable').val(),
      threshold = $('#default-link-threshold').val(),
      showNN = $('#showNNLinks').is(':checked');
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
  let nodes = session.data.nodes;
  let n = nodes.length;
  let out = [];
  if(copy){
    for(let i = 0; i < n; i++){
      let node = nodes[i];
      if(node.visible) out.push(JSON.parse(JSON.stringify(node)));
    }
  } else {
    for(let i = 0; i < n; i++){
      let node = nodes[i];
      if(node.visible) out.push(node);
    }
  }
  return out;
};

app.getVisibleLinks = function(copy){
  let links = session.data.links;
  let n = links.length;
  let out = [];
  if(copy){
    for(let i = 0; i < n; i++){
      let link = links[i];
      if(link.visible) out.push(JSON.parse(JSON.stringify(link)));
    }
  } else {
    for(let i = 0; i < n; i++){
      let link = links[i];
      if(link.visible) out.push(link);
    }
  }
  return out;
};

app.updateNetwork = function(hideSingletons){
  app.setLinkVisibility();
  app.tagClusters();
  if(hideSingletons) app.setNodeVisibility();
  app.computeDegree();
};

app.computeDM = function(callback){
  var start = Date.now();
  var DMMaker = new Worker('scripts/compute-dm.js');
  DMMaker.onmessage = function(response){
    session.data.distance_matrix = response.data;
    console.log('DM Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
    if(callback) callback();
  };
  DMMaker.postMessage({
    nodes: session.data.nodes.filter(d => d.seq),
    links: session.data.links.filter(l => l.tn93 && l.snps)
  });
};

app.updateStatistics = function(){
  if($('#hide_2d_network_statistics').is(':checked')) return;
  let vnodes = app.getVisibleNodes();
  var vlinks = app.getVisibleLinks();
  var singletons = vnodes.filter(d => d.degree === 0).length;
  $('#numberOfSelectedNodes').text(vnodes.filter(d => d.selected).length.toLocaleString());
  $('#numberOfNodes').text(vnodes.length.toLocaleString());
  $('#numberOfVisibleLinks').text(vlinks.length.toLocaleString());
  $('#numberOfSingletonNodes').text(singletons.toLocaleString());
  $('#numberOfDisjointComponents').text(session.data.clusters.length);
};

app.computeNN = function(callback){
  var start = Date.now();
  var nnMachine = new Worker('scripts/compute-nn.js');
  nnMachine.onmessage = function(message){
    message.data.forEach(l => session.data.links[l.index].nn = l.nn);
    console.log('NN Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
    if(callback) callback();
  };
  nnMachine.postMessage(session.data);
};

app.reset = function(){
  window.session = app.sessionSkeleton();
  layout.root.replaceChild(layout.root.contentItems[0], {
    type: 'stack',
    content: []
  });
  layout.contentItems = [];
  app.launchView('files');
};

app.haversine = function(lat1, lon1, lat2, lon2){
  let R = 6371e3; // metres
  let φ1 = lat1 * Math.PI / 180;
  let φ2 = lat2 * Math.PI / 180;
  let Δφ = (lat2-lat1) * Math.PI / 180;
  let Δλ = (lon2-lon1) * Math.PI / 180;
  let a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return(c * R);
};

app.geoDM = function(){
  let nodes = session.data.nodes;
  let links = [];
  let n = nodes.length;
  let dm = Array(n);
  for(let i = 0; i < n; i++){
    dm[i] = Array(n);
    dm[i][i] = 0;
    for(let j = 0; j < i; j++){
      let dist = haversine(nodes[i].lat, nodes[i].lon, nodes[j].lat, nodes[j].lon);
      dm[i][j] = dist;
      dm[j][i] = dist;
      links.push({
        source: nodes[i].id,
        target: nodes[j].id,
        geographic_distance: dist
      })
    }
  }
  return(links);
};

app.launchView = function(view, callback){
  if(!app.componentCache[view]){
    $.get('components/' + view + '.html', function(response){
      app.componentCache[view] = { text: response };
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
      layout.root.contentItems[0].addChild({
        componentName: view,
        componentState: app.componentCache[view],
        title: app.titleize(view),
        type: 'component'
      });
      contentItem = _.last(layout.root.contentItems[0].contentItems);
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
    $('.launch-color-options').click(function(){
      $('#color-tab').tab('show');
      setTimeout(() => {
        $('#global_settings_modal').modal('show');
      }, 250);
    });
    contentItem.element.find('[data-toggle="tooltip"]').tooltip();
    if(callback){
      callback(contentItem);
    } else {
      return contentItem;
    }
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
	var svgString = serializer.serializeToString(svgNode);
	return svgString;
};

app.blobifySVG = function(svgString, width, height, format, callback){
	var format = format ? format : 'png';
	var imgsrc = 'data:image/svg+xml;base64,'+ btoa( unescape( encodeURIComponent( svgString ) ) ); // Convert SVG string to data URL
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');

	canvas.width = width;
	canvas.height = height;

	var image = new Image();
	image.onload = function() {
		context.clearRect ( 0, 0, width, height );
		context.drawImage(image, 0, 0, width, height);
		canvas.toBlob(function(blob){
			if(callback) callback(blob);
		});
	};
	image.src = imgsrc;
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
        'length': l.distance,
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
