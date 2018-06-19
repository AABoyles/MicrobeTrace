(function(){

  $('#data_files').on('change', function(e){
    var files = e.target.files;
    for(var i = 0, f; f = files[i]; i++) addFileToTable(f);
    $('#main-submit').css('display', 'inline').focus();
  }).filestyle({
    text: 'Add File(s)',
    input: false,
    btnClass: 'btn-primary'
  });

  $('#file_panel').on('dragover', function(evt){
    evt.stopPropagation();
    evt.preventDefault();
    evt.originalEvent.dataTransfer.dropEffect = 'copy';
  }).on('drop', function(evt){
    evt.stopPropagation();
    evt.preventDefault();
    var files = evt.originalEvent.dataTransfer.files;
    for(var i = 0, f; f = files[i]; i++) addFileToTable(f);
    $('#main-submit').css('display', 'inline').focus();
  });

  function addFileToTable(file){
    session.files.push(file);
    var extension = file.name.split('.').pop().slice(0,3).toLowerCase();
    var isFasta = (extension === 'fas');
    if(isFasta) $('#alignerControlsButton').css('display', 'inline');
    var isNode = file.name.toLowerCase().includes('node');
    var root = $('<div class="form-group row file-table-row"></div>');
    $('<div class="col-8 filename"></div>')
      .append($('<a href="#"><span class="oi oi-circle-x"></span></a>').click(function(e){
        session.files.splice(session.files.indexOf(file.name), 1);
        root.slideUp(function(){ root.remove(); });
      }))
      .append(`&nbsp;<a href="#" title="${file.name}">${file.name}</a>`)
      .appendTo(root);
    root.append(`
      <div class="col-4 text-right">
        <div class="btn-group btn-group-toggle btn-group-sm" data-toggle="buttons">
          <label class="btn btn-secondary${!isFasta&!isNode?' active':''}">
            <input type="radio" name="options-${file.name}" data-type="link" autocomplete="off"${!isFasta&!isNode?' checked':''}>Link</input>
          </label>
          <label class="btn btn-secondary${!isFasta&isNode?' active':''}">
            <input type="radio" name="options-${file.name}" data-type="node" autocomplete="off"${!isFasta&isNode?' checked':''}>Node</input>
          </label>
          <label class="btn btn-secondary">
            <input type="radio" name="options-${file.name}" data-type="distmat" autocomplete="off">Dist. Mat.</input>
          </label>
          <label class="btn btn-secondary${isFasta?' active':''}">
            <input type="radio" name="options-${file.name}" data-type="fasta" autocomplete="off"${isFasta?' checked':''}>FASTA</input>
          </label>
        </div>
      </div>
    `);
    Papa.parse(file, {
      dynamicTyping: true,
      header: true,
      preview: 1,
      complete: function(output){
        var headers = output.meta.fields.map(filterXSS);
        var options = '<option>None</option>' + headers.map(function(h){ return '<option value="'+h+'">'+app.titleize(h)+'</option>'; }).join('\n');
        $(`<div class='col-4 '${isFasta?' style="display: none;"':''} data-file='${file.name}'>
            <label for="file-${file.name}-field-1">${isNode?'ID':'Source'}</label>
            <select id="file-${file.name}-field-1" class="custom-select custom-select-sm">${options}</select>
          </div>
          <div class='col-4 '${isFasta?' style="display: none;"':''} data-file='${file.name}'>
            <label for="file-${file.name}-field-2">${isNode?'Sequence':'Target'}</label>
            <select id="file-${file.name}-field-2" class="custom-select custom-select-sm">${options}</select>
          </div>
          <div class='col-4 '${!isFasta&&!isNode?'':' style="display: none;"'} data-file='${file.name}'>
            <label for="file-${file.name}-field-3">Distance</label>
            <select id="file-${file.name}-field-3" class="custom-select custom-select-sm">${options}</select>
          </div>`).appendTo(root);
        var a = isNode ? ['ID', 'Id', 'id'] : ['SOURCE', 'Source', 'source'],
            b = isNode ? ['SEQUENCE', 'SEQ', 'Sequence', 'sequence', 'seq'] : ['TARGET', 'Target', 'target'],
            c = ['SNPs', 'TN93', 'snps', 'tn93', 'length', 'distance'];
        [a, b, c].forEach(function(list, i){
          list.forEach(function(title){
            if(headers.includes(title)){
              $(root.find('select').get(i)).val(title);
            }
          });
        });
        root.appendTo('#file_table');
        var refit = function(e){
          var type = $(e ? e.target : `[name="options-${file.name}"]:checked`).data('type'),
              these = $(`[data-file='${file.name}']`),
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
          [a, b, c].forEach(function(list, i){
            list.forEach(function(title){
              if(headers.includes(title)){
                $(these.find('select').get(i)).find('select').val(title);
              }
            });
          });
        };
        $(`[name="options-${file.name}"]`).change(refit);
        refit();
      }
    });
  }

  $('#distanceMetrics').chosen({width: "100%"}).change(function(){
    $('#defaultDistanceMetric').html($(this).val().map((v, i) => {
      return '<option value="' + v.toLowerCase() + '"' + (i == 0 ? ' selected': '') + '>' + v + '</option>';
    }).join('\n'));
  });

  $('#defaultDistanceMetric').change(function(){
    if($(this).val() == 'snps'){
      $('#defaultDistanceThreshold')
        .attr('step', 1)
        .val(1);
    } else {
      $('#defaultDistanceThreshold')
        .attr('step', 0.001)
        .val(0.015);
    }
  });

  var data;
  function updatePreview(){
    if(!data){
      var reader = new FileReader();
      reader.onloadend = function(e){
        data = app.parseFASTA(e.target.result);
        data.forEach(function(node){
          node.id = filterXSS(node.id);
          node.seq = filterXSS(node.seq);
        });
        updatePreview();
      };
      reader.readAsText(session.files.find(function(f){ return f.name.includes('fas'); }), 'UTF-8');
      return;
    }
    $('#alignmentPreview').empty().append('<img src="img/spinner.gif" class="mx-auto" />');
    app.align({
      nodes: data,
      reference: session.data.reference,
      aligner: $('input[name="shouldAlign"]:checked').data('aligner'),
      isLocal: $('#localAlign').is(':checked'),
      match: [parseFloat($('#alignerMatch').val()), parseFloat($('#alignerMismatch').val())],
      gap: [parseFloat($('#alignerGapO').val()), parseFloat($('#alignerGapE').val())],
      cores: $('#availableCores').val()|0
    }, function(output){
      var n = output.length;
      var seqs = Array(n);
      for(var i = 0; i < n; i++) seqs[i] = output[i].seq;
      alignmentViewer(seqs).then(function(canvas){
        $('#alignmentPreview').empty().append(canvas);
      });
    });
  }

  $('.alignConfigRow').hide();

  $('#swAlign').parent().click(function(){
    $('.alignConfigRow').slideDown();
    if($('#autoPreview').is(':checked')) updatePreview();
  });

  $('#doNotAlign, #nbeamAlign').parent().click(function(){
    $('.alignConfigRow').slideUp();
    if($('#autoPreview').is(':checked')) updatePreview();
  });

  $('#refSeqFileLoad').on('change', function(e){
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onloadend = function(e){
      if (e.target.readyState == FileReader.DONE){
        var node = app.parseFASTA(e.target.result)[0];
        session.data.reference = filterXSS(node.seq);
        $('label[for="refSeqFileLoad"]').text(`${file.name} (${filterXSS(node.id)})`);
        if($('#autoPreview').is(':checked')) updatePreview();
      }
    };
    reader.readAsText(file);
  });

  $('#alignerControlsButton, #previewAlignment').click(updatePreview);

  $('#availableCores').html(
    _.range(1, (navigator.hardwareConcurrency|4)+1).map(i => {
      return `<option${i === Math.ceil((navigator.hardwareConcurrency|4)/2) ? ' selected' : ''}>${i}</option>`;
    }).join()
  );

  $('#loadCancelButton').click(e => {
    $('#loadingInformationModal').modal('hide');
    app.reset();
  });

  function message(msg){
    session.messages.push(msg);
    $('#loadingInformation').html(session.messages.join('<br />'));
  }

  var messageTimeout;

  $('#main-submit').click(function(e){
    session.startTime = Date.now();
    session.messages = [];
    session.data = app.dataSkeleton();
    $('#loadingInformation').html('');

    $('#loadingInformationModal').modal({
      keyboard: false,
      backdrop: 'static'
    });

    messageTimeout = setTimeout(function(){
      $('#loadCancelButton').slideDown();
      alertify.warning('If you stare long enough, you can reverse the DNA Molecule\'s spin direction');
    }, 20000);

    var files = [];
    $('#file_panel .row').each((i, el) => {
      var $el = $(el);
      var fname = $el.find('.filename').text().trim();
      var selects = $el.find('select');
      files.push({
        file: session.files.find(function(file){ return file.name === fname; }),
        type: $el.find('input[type="radio"]:checked').data('type'),
        field1: selects.get(0).value,
        field2: selects.get(1).value,
        field3: selects.get(2).value
      });
    });

    var hierarchy = ['distmat', 'link', 'node', 'fasta'];

    var anySequences = false;

    files.sort((a, b) => hierarchy.indexOf(a.type) - hierarchy.indexOf(b.type));
    files.forEach((file, fileNum) => {
      var filename = file.file.name;

      if(file.type === 'fasta'){

        message(`Parsing ${filename} as FASTA...`);
        var reader = new FileReader();
        reader.onloadend = function(e){
          anySequences = true;
          var n = 0;
          var seqs = app.parseFASTA(e.target.result);
          seqs.forEach(node => {
            node.id = filterXSS(node.id);
            node.seq = filterXSS(node.seq);
            node['origin'] = [filename];
            n += app.addNode(node);
          });
          message(` - Parsed ${n} New, ${seqs.length} Total Nodes from FASTA.`);
          if(fileNum == files.length - 1) nextStuff();
        };
        reader.readAsText(file.file, 'UTF-8');

      } else if(file.type === 'link'){

        message(`Parsing ${filename} as Link CSV...`);
        var l = 0;
        Papa.parse(file.file, {
          header: true,
          worker: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            results.data.forEach(link => {
              Object.keys(link).forEach(function(key){
                link[key] = filterXSS(link[key]);
              });
              l += app.addLink(Object.assign({
                source: '' + link[file.field1],
                target: '' + link[file.field2],
                distance: file.field3 === 'None' ? 0 : link[file.field3],
                origin: [filename],
                visible: 1
              }, link));
            });
            message(` - Parsed ${l} New, ${results.data.length} Total Links from Link CSV.`);
            results.meta.fields.map(key => {
              key = filterXSS(key);
              if(!session.data.linkFields.includes(key)){
                session.data.linkFields.push(key);
              }
            });
            var n = 0;
            var nodeIDs = _.union(_.map(results.data, l => l[file.field1]), _.map(results.data, l => l[file.field2]));
            var t = nodeIDs.length;
            nodeIDs.forEach(d => n += app.addNode({
              id: '' + d,
              origin: [filename]
            }));
            message(` - Parsed ${n} New, ${t} Total Nodes from Link CSV.`);
            if(fileNum == files.length - 1) nextStuff();
          }
        });

      } else if(file.type === 'node'){

        message(`Parsing ${filename} as Node CSV...`);

        if(file.field2 !== 'None') anySequences = true;

        var m = 0, n = 0;
        Papa.parse(file.file, {
          header: true,
          worker: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          step: results => {
            if(0 === n++){
              results.meta.fields.forEach(key => {
                key = filterXSS(key);
                if(!session.data.nodeFields.includes(key)){
                  session.data.nodeFields.push(key);
                }
              });
            }
            node = JSON.parse(filterXSS(JSON.stringify(results.data[0])));
            node.id = '' + node[file.field1];
            if(file.field2 !== 'None') node.seq = node[file.field2];
            node['origin'] = [filename];
            m += app.addNode(node);
          },
          complete: () => {
            message(` - Parsed ${m} New, ${n} Total Nodes from Node CSV.`);
            if(fileNum === files.length - 1) nextStuff();
          }
        });

      } else { //Distance Matrix

        message(`Parsing ${filename} as Distance Matrix...`);

        Papa.parse(file.file, {
          worker: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: results => {
            var nodeIDs = [];
            var nn = 0, nl = 0;
            results.data.forEach((row, i) => {
              if(i == 0){
                nodeIDs = row.map(filterXSS);
                nodeIDs.forEach((cell, k) => {
                  if(k > 0){
                    nn += app.addNode({
                      id: '' + cell,
                      origin: [filename]
                    });
                  }
                });
              } else {
                row.forEach((cell, j) => {
                  if(j > i){
                    nl += app.addLink({
                      source: '' + nodeIDs[i],
                      target: '' + nodeIDs[j],
                      distance: cell,
                      origin: [filename]
                    });
                  }
                });
              }
            });
            message(` - Parsed ${nn} New, ${results.data.length - 1} Total Nodes from Distance Matrix.`);
            message(` - Parsed ${nl} New, ${(Math.pow(results.data.length-1, 2) - results.data.length + 1)/2} Total Links from Distance Matrix.`);
            if(fileNum == files.length - 1) nextStuff();
          }
        });
      }
    });

    function nextStuff(){
      if(!anySequences){
        $('.showForSequence').hide();
        finishUp();
        return;
      }
      $('.showForSequence').show();
      var allDashes = /^-*$/;
      var subset = session.data.nodes.filter(d => !allDashes.test(d.seq));
      if($('#doNotAlign').is(':checked')){
        computeLinks(subset);
      } else {
        message('Aligning Sequences...');
        app.align({
          reference: session.data.reference,
          aligner: $('input[name="shouldAlign"]:checked').data('aligner'),
          isLocal: $('#localAlign').is(':checked'),
          match: [$('#alignerMatch').val(), $('#alignerMismatch').val()].map(parseFloat),
          gap: [$('#alignerGapO').val(), $('#alignerGapE').val()].map(parseFloat),
          nodes: subset,
          cores: parseFloat($('#availableCores').val())
        }, function(response){
          response.forEach(function(node){
            Object.assign(subset[node.index], node);
          });
          computeLinks(subset);
        });
      }
    };

    function computeLinks(subset){
      message('Computing Links based on Genomic Proximity...');
      var k = 0;
      var n = subset.length;
      var cores = parseFloat($('#availableCores').val());
      var computers = Array(cores);
      var nPerI = Math.ceil(n/cores);
      var returned = 0;
      for(var i = 0; i < cores; i++){
        computers[i] = new Worker('scripts/compute-links.js');
        computers[i].onmessage = function(response){
          response.data.forEach(function(link, j){
            k += app.addLink(link);
          });
          if(++returned === n){
            computers.forEach(c => c.terminate());
            message(` - Found ${k} New Links from Genomic Proximity`);
            var DMMaker = new Worker('scripts/compute-dm.js');
            DMMaker.onmessage = function(response){
              session.data.distance_matrix = response.data;
              DMMaker.terminate();
            };
            DMMaker.postMessage({
              nodes: session.data.nodes.filter(d => d.seq),
              links: session.data.links.filter(l => l.tn93 && l.snps)
            });
            finishUp();
          }
        };
      }
      for(var j = 0; j < n; j++){
        computers[j % cores].postMessage({
          j: j,
          nodes: subset
        });
      }
    };

    var finishUp = function(){
      clearTimeout(messageTimeout);
      $('#linkSortVariable').html(
        session.data.linkFields.map(function(field){
          return '<option value="' + field + '"' + (field === 'distance' ? ' selected' : '') + '>' + app.titleize(field) + '</option>';
        }).join('\n')
      );
      try {
        app.updateThresholdHistogram();
      } catch(error){
        console.error(error);
        $('#loadingInformationModal').modal('hide');
        app.reset();
      }
      app.setLinkVisibility();
      app.setNodeVisibility();
      app.tagClusters();
      app.computeDegree();
      app.launchView('2d_network', function(){
        session.network.render();
        session.network.force.alpha(0.3).alphaTarget(0).restart();
        session.network.updateStatistics();
        session.loadTime = Date.now() - session.startTime;
        console.log('Network Loadtime:', (session.loadTime/1000).toLocaleString() + 's');
        $('.hideForHIVTrace').css('display', 'flex');
        setTimeout(function(){
          session.network.fit();
          $('#loadingInformationModal').modal('hide');
        }, 1500);
      });
    };
  });
})();
