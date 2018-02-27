function dataSkeleton(){
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
}

function defaultNode(){
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
}

function addNode(newNode){
  let oldNode = session.data.nodes.find(d => d.id === newNode.id);
  if(oldNode){
    Object.assign(oldNode, newNode);
    return 0;
  } else {
    session.data.nodes.push(Object.assign(defaultNode(), newNode));
    return 1;
  }
}

function defaultLink(){
  return {
    source: '',
    target: '',
    tn93: 1,
    snps: Number.INFINITY,
    visible: 0,
    cluster: 1,
    origin: 'Genetic Distance'
  }
}

function addLink(newLink){
  let oldLink = session.data.links.find(l => l.source === newLink.source & l.target === newLink.target);
  if(oldLink){
    Object.assign(oldLink, newLink);
    return 0;
  } else {
    session.data.links.push(Object.assign(defaultLink(), newLink));
    return 1;
  }
}

function parseFASTA(text){
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
}

function hamming(s1, s2){
  let i = s1.length;
  let sum = 0;
  while(--i > 0){
    if(s1[i] !== s2[i]) sum++;
  }
  return sum;
}

function align(subset, reference){
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
}

function computeDistanceMatrices(subset){
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
        snps: hamming(subset[j]['seq'], subset[i]['seq'])
      };
      session.data.distance_matrix.tn93[i][j] = newLink.tn93;
      session.data.distance_matrix.tn93[j][i] = newLink.tn93;
      session.data.distance_matrix.snps[i][j] = newLink.snps;
      session.data.distance_matrix.snps[j][i] = newLink.snps;
      k += addLink(newLink);
    }
  }
  return k;
}

function reset(){
  window.session = dataSkeleton();
  $('#fileTable').empty();
  $('#main-submit').hide();
}

function message(msg){
  session.messages.push(msg);
  $('#loadingInformation').html(session.messages.join('<br />'));
}

function titleize(title){
  let small = title.toLowerCase().replace(/_/g, ' ');
  if(small === 'id') return 'ID';
  if(small === 'snps') return 'SNPs';
  return small.replace(/(?:^|\s|-)\S/g, function(c){
    return c.toUpperCase();
  });
}

$(function(){

  function showFilePanel(){
    $('#main_panel').fadeOut(function(){
      $('#network').empty();
      $('#groupKey').empty();
      $('#loadCancelButton, .showForMST').hide();
      $('.showForNotMST').css('display', 'inline-block');
      $('#loadingInformation').empty();
      $('#file_panel').fadeIn();
    });
  }

  reset();

  // Before anything else gets done, ask the user to accept the legal agreement
  if(!localStorage.getItem('licenseAccepted')){
    $('#acceptAgreement').click(function(){
      // Set that agreement in localStorage
      localStorage.setItem('licenseAccepted', new Date());
    });
    $('#rejectAgreement').click(function(){
      // If you don't agree, no app for you!
      //TODO: Show a message indicating you are not permitted to use the app without agreeing to the terms of use.
    });
    // No hacking around the agreement.
    $('#licenseAgreement').modal({
      backdrop: 'static',
      keyboard: false
    });
  }

  $('#file_panel').on('dragover', function(evt){
    evt.stopPropagation();
    evt.preventDefault();
    evt.originalEvent.dataTransfer.dropEffect = 'copy';
  }).on('drop', function(evt){
    evt.stopPropagation();
    evt.preventDefault();
    let files = evt.originalEvent.dataTransfer.files;
    let output = [];
    for(let i = 0, f; f = files[i]; i++){
      session.files.push(files[i]);
      let filename = files[i].name;
      let extension = filename.split('.').pop().slice(0,3).toLowerCase();
      let isFasta = (extension === 'fas');
      if(isFasta) $('#alignerControlsButton').slideDown();
      let isNode = filename.toLowerCase().includes('node');
      let root = $('<div class="row row-striped"></div>');
      $('<div class="col-xs-8 filename"></div>')
        .append($('<span class="glyphicon glyphicon-remove" aria-hidden="true"></span>').click(function(e){
          session.files.splice(session.files.indexOf(filename), 1);
          root.slideUp(function(){ root.remove(); });
        }))
        .append(`&nbsp;<a href="#" title="${filename}">${filename}</a>`)
        .appendTo(root);
      root.append(`
        <div class="col-xs-4 text-right" style="padding-bottom:5px;">
          <div class="btn-group btn-group-xs" data-toggle="buttons">
            <label class="btn btn-default${!isFasta&!isNode?' active':''}">
              <input type="radio" name="options-${filename}" data-type="link" autocomplete="off"${!isFasta&!isNode?' checked':''}>Link</input>
            </label>
            <label class="btn btn-default${!isFasta&isNode?' active':''}">
              <input type="radio" name="options-${filename}" data-type="node" autocomplete="off"${!isFasta&isNode?' checked':''}>Node</input>
            </label>
            <label class="btn btn-default">
              <input type="radio" name="options-${filename}" data-type="distmat" autocomplete="off">Dist. Mat.</input>
            </label>
            <label class="btn btn-default${isFasta?' active':''}">
              <input type="radio" name="options-${filename}" data-type="fasta" autocomplete="off"${isFasta?' checked':''}>FASTA</input>
            </label>
          </div>
        </div>
      `);
      Papa.parse(files[i], {
      	dynamicTyping: true,
        header: true,
        complete: function(output){
          let data = output.data;
          let headers = output.meta.fields;
          let options = '<option>None</option>' + headers.map(h => `<option value="${h}">${titleize(h)}</option>`).join('\n');
          $(`<div class='col-xs-4 text-right'${isFasta?' style="display: none;"':''} data-file='${filename}'>
              <label style="width:65px">${isNode?'ID':'Source'}</label><span>&nbsp;</span><select style="width:calc(100% - 69px)">${options}</select>
            </div>
            <div class='col-xs-4 text-right'${isFasta?' style="display: none;"':''} data-file='${filename}'>
              <label style="width:65px">${isNode?'Sequence':'Target'}</label><span>&nbsp;</span><select style="width:calc(100% - 69px)">${options}</select>
            </div>
            <div class='col-xs-4 text-right'${!isFasta&&!isNode?'':' style="display: none;"'} data-file='${filename}'>
              <label style="width:65px">Distance</label><span>&nbsp;</span><select style="width:calc(100% - 69px)">${options}</select>
            </div>`).appendTo(root);
          let a = isNode ? ['ID', 'Id', 'id'] : ['SOURCE', 'Source', 'source'],
              b = isNode ? ['SEQUENCE', 'SEQ', 'Sequence', 'sequence', 'seq'] : ['TARGET', 'Target', 'target'],
              c = ['SNPs', 'TN93', 'snps', 'tn93', 'length', 'distance'];
          [a, b, c].forEach((list, i) => {
            list.forEach(title => {
              if(headers.includes(title)){
                $(root.find('select').get(i)).val(title);
              }
            });
          });
          root.appendTo('#file_panel .panel-body').slideDown();
          let refit = function(e){
            let type = $(e ? e.target : `[name="options-${filename}"]:checked`).data('type'),
                these = $(`[data-file='${filename}']`),
                first = $(these.get(0)),
                second = $(these.get(1)),
                third = $(these.get(2)),
                a = ['SOURCE', 'Source', 'source'],
                b = ['TARGET', 'Target', 'target'],
                c = ['SNPs', 'TN93', 'snps', 'tn93', 'length', 'distance'];
            if(type === 'node'){
              a = ['ID', 'Id', 'id'];
              b = ['SEQUENCE', 'SEQ', 'Sequence', 'sequence', 'seq'];
              first.slideDown().find('label').text('ID');
              second.slideDown().find('label').text('Sequence');
              third.slideUp();
            } else if(type === 'link'){
              first.slideDown().find('label').text('Source');
              second.slideDown().find('label').text('Target');
              third.slideDown();
            } else {
              these.slideUp();
            }
            [a, b, c].forEach((list, i) => {
              list.forEach(title => {
                if(headers.includes(title)){
                  $(these.find('select').get(i)).find('select').val(title);
                }
              });
            });
          };
          $(`[name="options-${filename}"]`).change(refit);
          refit();
        }
      });
    }
    $('#main-submit').slideDown();
  });

  $('#align').parent().click(e => $('#referenceRow').slideDown());
  $('#doNotAlign').parent().click(e => $('#referenceRow').slideUp());

  $('#refSeqFileLoad').click(e => {
    //TODO: Replace with Drag 'n Drop loader'
    // remote.dialog.showOpenDialog({
    //   filters: [{name: 'FASTA Files', extensions:['fas', 'fasta', 'txt']}]
    // }, paths => {
    //   if(paths){
    //     $('#refSeqFile').text(paths[0]).slideDown();
    //     $('#reference').val(jetpack.read(paths[0]).split(/[\n>]/)[2]);
    //   }
    // });
  });

  $('#refSeqLoad').click(e => $('#reference').val($('#HXB2pol').html()));
  $('#reference').val($('#HXB2pol').html());

  $('#loadCancelButton').click(e => {
    $('#loadingInformationModal').modal('hide');
    reset(true);
  });

  var messageTimeout;

  $('#main-submit').click(function(e){
    $('#file_panel').fadeOut(function(){
      $('#main_panel').fadeIn(function(){
        $('#loadingInformationModal').modal({
          keyboard: false,
          backdrop: 'static'
        });
      });
    });

    let files = [];
    $('#file_panel .row').each((i, el) => {
      files[i] = {
        file: session.files[i],
        type: $(el).find('input[type="radio"]:checked').data('type'),
        field1: $(el).find('select').get(0).value,
        field2: $(el).find('select').get(1).value,
        field3: $(el).find('select').get(2).value
      };
    });

    messageTimeout = setTimeout(function(){
      $('#loadCancelButton').slideDown();
      alertify.warning("If you stare long enough, you can reverse the DNA Molecule\'s spin direction");
    }, 20000);

    const hierarchy = ['distmat', 'link', 'node', 'fasta'];

    var instructions = {
      files: files,
      align: $('#align').is(':checked'),
      reference: $('#reference').val()
    };

    var anySequences = false;

    instructions.files.sort((a, b) => hierarchy.indexOf(a.type) - hierarchy.indexOf(b.type));
    instructions.files.forEach((file, fileNum) => {
      let filename = file.file.name;

      if(file.type === 'fasta'){

        message(`Parsing ${filename} as FASTA...`);
        let reader = new FileReader();
        reader.onloadend = function(e){
          anySequences = true;
          let n = 0;
          let seqs = parseFASTA(e.target.result);
          seqs.forEach(node => {
            node['origin'] = filename;
            n += addNode(node);
          });
          message(` - Parsed ${n} New, ${seqs.length} Total Nodes from FASTA.`);
          if(fileNum == instructions.files.length - 1) nextStuff();
        };
        reader.readAsText(file.file, 'UTF-8');

      } else if(file.type === 'link'){

        message(`Parsing ${filename} as Link CSV...`);
        let l = 0, m = 0;
        Papa.parse(file.file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            let link = results.data.forEach(link => {
              l += addLink(Object.assign({
                source: link[file.field1],
                target: link[file.field2],
                distance: (file.field3 === "None") ? 0 : link[file.field3],
                origin: filename,
                visible: 1
              }, link));
            });
            message(` - Parsed ${l} New, ${m} Total Links from Link CSV.`);
            results.meta.fields.forEach(key => session.data.linkFields.push(key));
            let n = 0;
            let nodeIDs = _.union(_.map(results.data, file.field1), _.map(results.data, file.field2));
            let t = nodeIDs.length;
            nodeIDs.forEach(d => n += addNode({
              id: d,
              origin: filename
            }));
            message(` - Parsed ${n} New, ${t} Total Nodes from Link CSV.`);
            if(fileNum == instructions.files.length - 1) nextStuff();
          }
        });

      } else if(file.type === 'node'){

        message(`Parsing ${filename} as Node CSV...`);

        Papa.parse(file.file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            let n = 0;
            results.data.forEach(node => {
              node.id = node[file.field1];
              if(file.field2 !== 'None') node.seq = node[file.field2];
              node['origin'] = filename;
              n += addNode(node);
            });
            results.meta.fields.forEach(key => session.data.nodeFields.push(key));
            if(data.nodeFields.has('seq')) anySequences = 1;
            message(` - Parsed ${n} New, ${results.data.length} Total Nodes from Node CSV.`);
            if(fileNum == instructions.files.length - 1) nextStuff();
          }
        });

      } else { //Distance Matrix

        message(`Parsing ${filename} as Distance Matrix...`);

        Papa.parse(file.file, {
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            let nodeIDs = [];
            let nn = 0, nl = 0;
            results.data.forEach((row, i) => {
              if(i == 0){
                nodeIDs = row;
                nodeIDs.forEach((cell, k) => {
                  if(k > 0){
                    nn += addNode({
                      id: cell,
                      origin: filename
                    });
                  }
                });
              } else {
                row.forEach((cell, j) => {
                  if(j > i){
                    nl += addLink({
                      source: nodeIDs[i],
                      target: nodeIDs[j],
                      distance: cell,
                      origin: filename
                    });
                  }
                });
              }
            });
            message(` - Parsed ${nn} New, ${results.data.length - 1} Total Nodes from Distance Matrix.`);
            message(` - Parsed ${nl} New, ${(Math.pow(results.data.length-1, 2) - results.data.length + 1)/2} Total Links from Distance Matrix.`);
            if(fileNum == instructions.files.length - 1) nextStuff();
          }
        });
      }
    });

    function nextStuff(){
      if(anySequences){
        const allDashes = /^-*$/;
        let subset = session.data.nodes.filter(d => !allDashes.test(d.seq));
        if(instructions.align){
          message('Aligning Sequences...');
          align(subset, instructions.reference);
        }
        message('Computing New Distance Matrices...');
        let k = computeDistanceMatrices(subset);
        message(` - Found ${k} New Links while computing Distance Matrices`);
      }

      clearTimeout(messageTimeout);
      $('.nodeVariables').html('<option>none</option>\n' + session.data.nodeFields.map(key => `<option>${key}</option>`).join('\n'));
      $('#nodeTooltipVariable').val('id');
      $('.linkVariables').html('<option>none</option>\n' + session.data.linkFields.map(key => `<option>${key}</option>`).join('\n'));
      $('#linkSortVariable').val('tn93');
      $('#default-link-threshold').show();
      tagClusters();
      setNodeVisibility();
      setLinkVisibility();
      setupNetwork();
      renderNetwork();
      computeDegree();
      session.state.visible_clusters = session.data.clusters.map(c => c.id);
      updateStatistics();
      setTimeout(e => {
        session.network.fit();
        $('#loadingInformationModal').modal('hide');
      }, 1500);
    }
  });

  function updateStatistics(){
    if($('#hideNetworkStatistics').is(':checked')) return;
    let llinks = _.filter(session.data.links, e => e.visible);
    let lnodes = _.filter(session.data.nodes, e => e.visible);
    let singletons = lnodes.length - _.union(_.map(llinks, 'source'), _.map(llinks, 'target')).length;
    $('#numberOfSelectedNodes').text(lnodes.filter(d => d.selected).length.toLocaleString());
    $('#numberOfNodes').text(lnodes.length.toLocaleString());
    $('#numberOfVisibleLinks').text(llinks.length.toLocaleString());
    $('#numberOfSingletonNodes').text(singletons.toLocaleString());
    $('#numberOfDisjointComponents').text(session.data.clusters.length - singletons);
  }

  function tagClusters(){
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
        DFS(node);
      }
    });
    session.state.visible_clusters = session.data.clusters.map(c => c.id);
  }

  function DFS(node){
    if(typeof node.cluster !== 'undefined') return;
    let lsv = $('#linkSortVariable').val();
    node.cluster = session.data.clusters.length;
    session.data.clusters[session.data.clusters.length - 1].nodes++;
    session.data.links.forEach(l => {
      if(l.visible && (l.source.id == node.id || l.target.id == node.id)){
        l.cluster = session.data.clusters.length;
        session.data.clusters[session.data.clusters.length - 1].links++;
        session.data.clusters[session.data.clusters.length - 1].sum_distances += l[lsv];
        if(!l.source.cluster) DFS(l.source);
        if(!l.target.cluster) DFS(l.target);
      }
    });
  }

  function computeDegree(){
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
  }

  function setNodeVisibility(){
    session.data.nodes.forEach(n => n.visible = 1);
    if(session.state.visible_clusters.length < session.data.clusters.length){
      session.data.nodes.forEach(n => n.visible = n.visible && session.state.visible_clusters.includes(n.cluster));
    }
    if($('#HideSingletons').is(':checked')){
      let clusters = session.data.clusters.map(c => c.nodes);
      session.data.nodes.forEach(n => n.visible = n.visible && clusters[n.cluster-1] > 1);
    }
  }

  function setLinkVisibility(){
    let metric  = $('#linkSortVariable').val(),
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
  }

  function setupNetwork(){
    session.network = {};
    let width = $(window).width(),
        height = $(window).height(),
        xScale = d3.scaleLinear().domain([0, width]).range([0, width]),
        yScale = d3.scaleLinear().domain([0, height]).range([0, height]);

    session.network.zoom = d3.zoom().on('zoom', () => session.network.svg.attr('transform', d3.event.transform));

    session.network.svg = d3.select('svg')
      .on('click', hideContextMenu)
      .html('') //Let's make sure the canvas is blank.
      .call(session.network.zoom)
      .append('g');

    session.network.fit = function(bounds){
      if(!bounds) bounds = session.network.svg.node().getBBox();
      if (bounds.width == 0 || bounds.height == 0) return; // nothing to fit
      let parent = session.network.svg.node().parentElement,
          midX = bounds.x + bounds.width / 2,
          midY = bounds.y + bounds.height / 2;
      let scale = 0.95 / Math.max(bounds.width / parent.clientWidth, bounds.height / parent.clientHeight);
      d3.select('svg')
        .transition()
        .duration(750)
        .call(session.network.zoom.transform, d3.zoomIdentity
          .translate(parent.clientWidth / 2 - scale * midX, parent.clientHeight / 2 - scale * midY)
          .scale(scale));
    };

    session.network.force = d3.forceSimulation()
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance($('#default-link-length').val())
        .strength(0.125)
      )
      .force('charge', d3.forceManyBody()
        .strength(-$('#default-node-charge').val())
      )
      .force('gravity', d3.forceAttract()
        .target([width/2, height/2])
        .strength($('#network-gravity').val())
      )
      .force('center', d3.forceCenter(width / 2, height / 2));

    session.network.force.on('end', e => {
      $('#playbutton').data('state', 'paused').html('<i class="fas fa-play" aria-hidden="true"></i>');
    });

    session.network.svg.append('svg:defs').append('marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 20)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('svg:path')
        .attr('d', 'M0,0 L0,10 L10,5 z');

    session.network.svg.append('g').attr('id', 'links');
    session.network.svg.append('g').attr('id', 'nodes');
  }

  function getVLinks(){
    let vlinks = _.cloneDeep(session.data.links.filter(link => link.visible));
    // vlinks.forEach(l => {
    //   l.source = session.data.nodes.find(d => d.id === l.source),
    //   l.target = session.data.nodes.find(d => d.id === l.target)
    // });
    return vlinks;
  }

  function renderNetwork(){
    let vnodes = session.data.nodes.filter(node => node.visible);

    //OK, this is a little bit of expert-level D3 voodoo that deserves some explanation.
    let node = d3.select('g#nodes').selectAll('g.node').data(vnodes);
    node.exit().remove(); //Removing nodes with no representation in the dataset.
    node = node.enter().append('g').attr('class', 'node').attr('tabindex', '0') //Adding nodes that weren't represented in the dataset before.
      .call(d3.drag() //A bunch of mouse handlers.
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('mouseenter focusin', showNodeToolTip)
      .on('mouseout focusout', hideTooltip)
      .on('contextmenu', showContextMenu)
      .on('click', clickHandler)
      .on('keydown', n => {
        if(d3.event.code === 'Space') clickHandler(n);
        if(d3.event.shiftKey && d3.event.key === 'F10') showContextMenu(n);
      });

    // What's this?
    node.append('path'); // Adding a path?
    node.append('text'); // And a text? Wouldn't those already be attached to the nodes?
    // Well, they would for nodes that already existed. The wouldn't for new nodes.
    // And until we merge the old and new nodes, `node` refers only to the *added* nodes.
    // Speaking of merging...
    node = node.merge(node);
    // E voila! node now refers to all the g.node elements in the network,
    // and they all have path and text elements, so we can confidently...
    node.select('path').attr('fill', $('#default-node-color').val());
    // And style them according to the DOM State instructions.
    redrawNodes();
    // And append our label text, too!
    node.select('text')
      .attr('dy', 5)
      .attr('dx', 8);

    let vlinks = getVLinks();

    // Links are considerably simpler.
    let link = d3.select('g#links').selectAll('line').data(vlinks);
    link.exit().remove();
    link.enter().append('line')
      .attr('stroke', $('#default-link-color').val())
      .attr('stroke-width', $('#default-link-width').val())
      .attr('opacity', $('#default-link-opacity').val())
      .on('mouseenter', showLinkToolTip)
      .on('mouseout', hideTooltip);

    setLinkColor();
    scaleLinkThing($('#default-link-width').val(), $('#linkWidthVariable').val(), 'stroke-width');

    var nodes = d3.select('g#nodes').selectAll('g.node').data(vnodes);
    var links = d3.select('g#links').selectAll('line').data(vlinks);
    session.network.force.nodes(vnodes).on('tick', function(){
      nodes
        .attr('transform', d => d.fixed ? `translate(${d.fx}, ${d.fy})` : `translate(${d.x}, ${d.y})`);
      links
        .attr('x1', l => l.source.x)
        .attr('y1', l => l.source.y)
        .attr('x2', l => l.target.x)
        .attr('y2', l => l.target.y);
    });

    session.network.force.force('link').links(vlinks);
  }

  function dragstarted(d){
    if (!d3.event.active) session.network.force.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d){
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d){
    if (!d3.event.active) session.network.force.alphaTarget(0);
    if(!d.fixed){
      d.fx = null;
      d.fy = null;
    }
  }

  function clickHandler(n){
    if(!d3.event.shiftKey){
      session.data.nodes
        .filter(node => node !== n)
        .forEach(node => node.selected = 0);
    }
    n.selected = !n.selected;
    d3.select('g#nodes').selectAll('g.node').data(session.data.nodes).select('path').classed('selected', d => d.selected);
    $('#numberOfSelectedNodes').text(session.data.nodes.filter(d => d.selected).length.toLocaleString());
  }

  new Clipboard('#copyID, #copySeq');

  function showContextMenu(d){
    d3.event.preventDefault();
    hideTooltip();
    $('#copyID').attr('data-clipboard-text', d.id);
    $('#copySeq').attr('data-clipboard-text', d.seq);
    d3.select('#viewAttributes').on('click', e => {
      showAttributeModal(d);
    }).node().focus();
    if(d.fixed){
      $('#pinNode').text('Unpin Node').click(e => {
        d.fx = null;
        d.fy = null;
        d.fixed = false;
        session.network.force.alpha(0.3).alphaTarget(0).restart();
        hideContextMenu();
      });
    } else {
      $('#pinNode').text('Pin Node').click(e => {
        d.fx = d.x;
        d.fy = d.y;
        d.fixed = true;
        hideContextMenu();
      });
    }
    $('#hideCluster').click(e => {
      session.state.visible_clusters = session.state.visible_clusters.filter(cid => cid !== d.cluster);
      setLinkVisibility();
      setNodeVisibility();
      renderNetwork();
      session.network.force.alpha(0.3).alphaTarget(0).restart();
      hideContextMenu();
    });
    if(session.state.visible_clusters < session.data.clusters.length){
      $('#isolateCluster').text('De-isolate Cluster').click(e => {
        session.state.visible_clusters = session.data.clusters.map(c => c.id);
        setNodeVisibility();
        setLinkVisibility();
        renderNetwork();
        session.network.force.alpha(0.3).alphaTarget(0).restart();
        hideContextMenu();
      });
    } else {
      $('#isolateCluster').text('Isolate Cluster').click(e => {
        session.state.visible_clusters = [d.cluster];
        setLinkVisibility();
        setNodeVisibility();
        renderNetwork();
        session.network.force.alpha(0.3).alphaTarget(0).restart();
        hideContextMenu();
      });
    }
    d3.select('#contextmenu')
      .style('z-index', 1)
      .style('left', (d3.event.pageX) + 'px')
      .style('top', (d3.event.pageY) + 'px')
      .style('opacity', 1);
  }

  function hideContextMenu(){
    let menu = d3.select('#contextmenu');
    menu
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () =>  menu.style('z-index', -1));
  }

  function showAttributeModal(d){
    let target = $('#attributeModal tbody').empty();
    for(var attribute in d){
      target.append(`<tr><td><strong>${attribute}</strong></td><td>${d[attribute]}</td></tr>`);
    }
    $('#attributeModal').modal('show');
    hideContextMenu();
  }

  function showNodeToolTip(d){
    if($('#nodeTooltipVariable').val() === 'none') return;
    d3.select('#tooltip')
      .html(d[$('#nodeTooltipVariable').val()])
      .style('left', (d3.event.pageX + 8) + 'px')
      .style('top', (d3.event.pageY - 28) + 'px')
      .style('z-index', 1000)
      .transition().duration(100)
      .style('opacity', 1);
  }

  function showLinkToolTip(d){
    let v = $('#linkTooltipVariable').val();
    if(v === 'none') return;
    d3.select('#tooltip')
      .html((v === 'source' || v === 'target') ? d[v].id : d[v])
      .style('left', (d3.event.pageX + 8) + 'px')
      .style('top', (d3.event.pageY - 28) + 'px')
      .style('z-index', 1000)
      .transition().duration(100)
      .style('opacity', 1);
  }

  function hideTooltip(){
    let tooltip = d3.select('#tooltip');
    tooltip
      .transition().duration(100)
      .style('opacity', 0)
      .on('end', () => tooltip.style('z-index', -1));
  }

  function redrawNodes(){
    //Things to track in the function:
    //* Symbols:
    let type = d3[$('#default-node-symbol').val()];
    let symbolVariable = $('#nodeSymbolVariable').val();
    let o = (b => d3[$('#default-node-symbol').val()]);
    if(symbolVariable !== 'none'){
      let map = {};
      let values = _(session.data.nodes).map(symbolVariable).uniq().sort().value();
      $('#nodeShapes select').each(function(i, el){
        map[values[i]] = $(this).val();
      });
      o = (v => map[v]);
    }
    //* Sizes:
    let defaultSize = $('#default-node-radius').val();
    let size = defaultSize;
    let sizeVariable = $('#nodeRadiusVariable').val();
    if(sizeVariable !== 'none'){
      let values = _(session.data.nodes).map(sizeVariable).without(undefined);
      var min = values.min();
      var max = values.max();
      var oldrng = max - min;
      var med = oldrng / 2;
    }
    let vnodes = session.data.nodes.filter(n => n.visible);
    let nodes = session.network.svg.select('g#nodes').selectAll('g.node').data(vnodes);
    nodes.select('path').each(function(d){
      if(symbolVariable !== 'none'){
        type = d3[o(d[$('#nodeSymbolVariable').val()])];
      }
      if(sizeVariable !== 'none'){
        size = med;
        if(typeof d[sizeVariable] !== 'undefined'){
          size = d[sizeVariable];
        }
        size = (size - min + 1) / oldrng
        size = size * size * defaultSize;
      }
      d3.select(this).attr('d', d3.symbol()
        .size(size)
        .type(type));
    });
    //* Labels:
    let labelVar = $('#nodeLabelVariable').val();
    nodes.select('text').text(n => n[labelVar]);
  }

  $('#nodeLabelVariable').change(e => {
    if(e.target.value === 'none'){
      session.network.svg.select('g#nodes').selectAll('g.node')
        .select('text').text('');
    } else {
      session.network.svg.select('g#nodes').selectAll('g.node').data(session.data.nodes.filter(n => n.visible))
        .select('text').text(d => d[e.target.value]);
    }
  });

  $('#default-node-symbol').on('input', redrawNodes);
  $('#nodeSymbolVariable').change(e => {
    $('#default-node-symbol').fadeOut();
    $('#nodeShapes').fadeOut(function(){$(this).remove()});
    let table = $('<tbody id="nodeShapes"></tbody>').appendTo('#groupKey');
    if(e.target.value === 'none'){
      redrawNodes();
      $('#default-node-symbol').fadeIn();
      return table.fadeOut(e => table.remove());
    }
    table.append('<tr><th>'+e.target.value+'</th><th>Shape</th><tr>');
    let values = _(session.data.nodes).map(e.target.value).uniq().sort().value();
    let symbolKeys = ['symbolCircle', 'symbolCross', 'symbolDiamond', 'symbolSquare', 'symbolStar', 'symbolTriangle', 'symbolWye'].concat(Object.keys(extraSymbols));
    let o = d3.scaleOrdinal(symbolKeys).domain(values);
    let options = $('#default-node-symbol').html();
    values.forEach(v => {
      let selector = $('<select></select>').append(options).val(o(v)).change(redrawNodes);
      let cell = $('<td></td>').append(selector);
      let row = $('<tr><td>' + v + '</td></tr>').append(cell);
      table.append(row);
    });
    redrawNodes();
    table.fadeIn();
  });

  $('#default-node-radius').on('input', redrawNodes);
  $('#nodeRadiusVariable').change(redrawNodes);

  function scaleNodeOpacity(){
    let scalar = $('#default-node-opacity').val();
    let variable = $('#nodeOpacityVariable').val();
    let circles = session.network.svg.select('g#nodes').selectAll('g.node').data(session.data.nodes).select('path');
    if(variable === 'none'){
      return circles.attr('opacity', scalar);
    }
    let values = _(session.data.nodes).map(variable).without(undefined);
    let min = values.min();
    let max = values.max();
    let rng = max - min;
    let med = rng / 2 + min;
    circles.attr('opacity', d => {
      let v = d[variable];
      if(typeof v === 'undefined') v = med;
      return scalar * (v - min) / rng + 0.1;
    });
  }

  $('#default-node-opacity').on('input', scaleNodeOpacity);
  $('#nodeOpacityVariable').change(scaleNodeOpacity);

  $('#default-node-color').on('input', e => session.network.svg.select('g#nodes').selectAll('g.node').select('path').attr('fill', e.target.value));
  $('#nodeColorVariable').change(e => {
    $('#default-node-color').fadeOut();
    let circles = session.network.svg.select('g#nodes').selectAll('g.node').data(session.data.nodes).select('path');
    $('#nodeColors').fadeOut(function(){$(this).remove()});
    let table = $('<tbody id="nodeColors"></tbody>').appendTo('#groupKey');
    if(e.target.value == 'none'){
      circles.attr('fill', $('#default-node-color').val());
      $('#default-node-color').fadeIn();
      table.fadeOut();
      return;
    }
    table.append('<tr><th>'+e.target.value+'</th><th>Color</th><tr>');
    let values = _.map(session.data.nodes, e.target.value);
    let colors = $.getJSON('components/colors.json');
    let o = d3.scaleOrdinal(colors).domain(values);
    circles.attr('fill', d => o(d[e.target.value]));
    values.forEach(value => {
      let input = $('<input type="color" value="'+o(value)+'" />')
        .on('input', evt => {
          circles
            .filter(d => d[e.target.value] == value)
            .attr('fill', d => evt.target.value);
        });
      let cell = $('<td></td>').append(input);
      let row = $('<tr><td>'+value+'</td></tr>').append(cell);
      table.append(row);
    });
    table.fadeIn();
  });

  $('#default-node-charge').on('input', e => {
    session.network.force.force('charge').strength(-e.target.value);
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#DirectedLinks').parent().click(e => {
    session.network.svg.select('g#links').selectAll('line').attr('marker-end', 'url(#end-arrow)');
  });

  $('#UndirectedLinks').parent().click(e => {
    session.network.svg.select('g#links').selectAll('line').attr('marker-end', null);
  });

  $('#default-link-length').on('input', e => {
    session.network.force.force('link').distance(e.target.value);
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  function setLinkColor(e){
    let variable = $('#linkColorVariable').val();
    if(variable == 'none'){
      session.network.svg.select('g#links').selectAll('line').style('stroke', $('#default-link-color').val());
      $('#default-link-color').fadeIn();
      $('#linkColors').fadeOut();
      return;
    }
    $('#default-link-color').fadeOut();
    let links = session.network.svg.select('g#links').selectAll('line').data(session.data.links.filter(l => l.visible));
    $('#linkColors').remove();
    let table = $('<tbody id="linkColors"></tbody>').appendTo('#groupKey');
    table.append('<tr><th>'+variable+'</th><th>Color</th><tr>');
    let values = _(session.data.links).map(variable).uniq().sort().value();
    let colors = $.getJSON('components/colors.json');
    let o = d3.scaleOrdinal(colors).domain(values);
    links.style('stroke', d => o(d[variable]));
    values.forEach(value => {
      let input = $('<input type="color" name="'+value+'-node-color-setter" value="'+o(value)+'" />')
        .on('input', evt => {
          links
            .filter(d => d[variable] === value)
            .style('stroke', d => evt.target.value);
        });
      let cell = $('<td></td>').append(input);
      let row = $('<tr><td>'+value+'</td></tr>').append(cell);
      table.append(row);
    });
    table.fadeIn();
  }

  $('#default-link-color').on('input', setLinkColor);
  $('#linkColorVariable').change(setLinkColor);

  function scaleLinkThing(scalar, variable, attribute, floor){
    let links = session.network.svg.select('g#links').selectAll('line').data(session.data.links.filter(l => l.visible));
    if(variable === 'none'){
      return links.attr(attribute, scalar);
    }
    if(!floor){floor = 1;}
    let values = _(session.data.links).map(variable).without(undefined);
    let min = values.min();
    let max = values.max();
    let rng = max - min;
    let recip = $('#reciprocal-link-width').is(':checked');
    links.attr(attribute, d => {
      let v = d[variable];
      if(typeof v === 'undefined') v = rng / 2 + min;
      if(recip && attribute == 'stroke-width'){
        return scalar * (1 - (v - min) / rng) + floor;
      }
      return scalar * (v - min) / rng + floor;
    });
  }

  $('#default-link-opacity').on('input', e => scaleLinkThing($('#default-link-opacity').val(), $('#linkOpacityVariable').val(), 'opacity', .1));
  $('#linkOpacityVariable').change(e => scaleLinkThing($('#default-link-opacity').val(), $('#linkOpacityVariable').val(), 'opacity', .1));

  $('#default-link-width').on('input', e => scaleLinkThing($('#default-link-width').val(), $('#linkWidthVariable').val(), 'stroke-width'));
  $('#linkWidthVariable, #reciprocal-link-width').change(e => scaleLinkThing($('#default-link-width').val(), $('#linkWidthVariable').val(), 'stroke-width'));

  $('#linkSortVariable').on('change', e => {
    if(e.target.value === 'none'){
      $('#computeMST').fadeOut();
      $('#default-link-threshold').fadeOut();
    } else {
      $('#computeMST').css('display', 'inline-block');
      $('#default-link-threshold').css('visibility', 'visible');
    }
  });

  $('#computeMST').click(e => {
    //TODO: Move algorithm into here
    $('.showForNotMST').fadeOut(e => {
      $('.showForMST').css('opacity', 0).css('display', 'inline-block').animate({'opacity': 1});
    });
  });

  $('#showMSTLinks, #showAllLinks').change(e => {
    setLinkVisibility();
    tagClusters();
    if($('#HideSingletons').is(':checked')) setNodeVisibility();
    renderNetwork();
    computeDegree();
    updateStatistics();
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  })

  $('#ShowSingletons, #HideSingletons').change(e => {
    tagClusters();
    setNodeVisibility();
    renderNetwork();
    computeDegree();
    updateStatistics();
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#default-link-threshold').on('input', e => {
    setLinkVisibility();
    tagClusters();
    if($('#HideSingletons').is(':checked')) setNodeVisibility();
    renderNetwork();
    computeDegree();
    updateStatistics();
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#hideNetworkStatistics').parent().click(() => $('#networkStatistics').fadeOut());
  $('#showNetworkStatistics').parent().click(function(){
    updateStatistics();
    $('#networkStatistics').fadeIn();
  });

  $('#network-friction').on('input', e => {
    session.network.force.velocityDecay(e.target.value);
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#network-gravity').on('input', e => {
    session.network.force.force('gravity').strength(e.target.value);
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#main_panel').css('background-color', $('#network-color').val());

  $('#network-color').on('input', e => $('#main_panel').css('background-color', e.target.value));

  $('#playbutton')
    .data('state', 'paused')
    .click(function(e){
      if($(this).data('state') === 'paused'){
        $(this).data('state', 'playing')
          .html('<i class="fa fa-pause" aria-hidden="true"></i>');
        session.network.force.alphaTarget(session.state.alpha).restart();
      } else {
        $(this).data('state', 'paused')
          .html('<i class="fa fa-play" aria-hidden="true"></i>');
        session.network.force.alpha(0).alphaTarget(0);
      }
    });

  $('#search').on('input', e => {
    if(e.target.value === ''){
      session.data.nodes.forEach(n => n.selected = 0);
    } else {
      session.data.nodes.forEach(n => n.selected = (n.id.indexOf(e.target.value)>-1));
      if(session.data.nodes.filter(n => n.selected).length === 0) alertify.warning('No matches!');
    }
    d3.select('g#nodes')
      .selectAll('g.node')
      .select('path')
      .data(session.data.nodes)
      .classed('selected', d => d.selected);
    $('#numberOfSelectedNodes').text(session.data.nodes.filter(d => d.selected).length.toLocaleString());
  });

  // Let's set up the Nav Bar
  $('#FileTab').click(function(){
    reset();
    showFilePanel();
  });

  $('#ExportDataTab').click(function(){
    var blob = new Blob(["Hello, world!"], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "hello world.txt");
  });

  $('#SaveImageTab').click(function(){
    var blob = new Blob(["Hello, world!"], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "hello world.txt");
  });

  $('#SaveVectorTab').click(function(){
    var content =
      '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 '+(window.innerHeight-50)+' '+window.innerWidth+'" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        document.getElementsByTagName('svg')[0].innerHTML + '\n' +
      '</svg>';
    var blob = new Blob([content], {type: 'image/svg+xml;charset=utf-8'});
    saveAs(blob, 'MicrobeTraceExport.svg');
  });

  $('#ExitTab').click(function(){ window.open('','_self').close(); });

  $('#AddDataTab').click(showFilePanel);

  $('#FindTab').click(function(e){ $('#search').focus(); });

  $('#RevealAllTab').click(function(e) {
    session.state.visible_clusters = session.data.clusters.map(c => c.id);
    $('#HideSingletons').prop('checked', false).parent().removeClass('active');
    $('#ShowSingletons').prop('checked', true).parent().addClass('active');
    setLinkVisibility();
    setNodeVisibility();
    renderNetwork();
    session.network.force.alpha(0.3).alphaTarget(0).restart();
  });

  $('#ReloadTab').click(function(){ window.location.reload(true); });

  $('#FullScreenTab').click(function(){ screenfull.toggle(); });

  $('#ZoomToFitTab').click(function(){ session.network.fit(); });

  $('.viewbutton').click(function(){
    $.get('components/' + $(this).data('href') + '.html', function(response){
      $('#main_panel').html(response);
    });
  });

  $('[data-toggle="tooltip"]').tooltip();

  $(document).on('keydown', e => {
    if(e.key === 'Escape'){
      $('#searchBox').slideUp();
    }
    if(e.ctrlKey && e.key === 'f'){
      e.preventDefault();
      $('#searchBox').slideDown().find('#search').focus();
    }
  });
});

alertify.defaults.transition = 'slide';
alertify.defaults.theme.ok = 'btn btn-primary';
alertify.defaults.theme.cancel = 'btn btn-danger';
alertify.defaults.theme.input = 'form-control';
