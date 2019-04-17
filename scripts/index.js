$(function(){
  'use strict';

  $('#ie-warning').remove();

  console.log('%cPLEASE DO NOT TYPE OR PASTE ANYTHING HERE.', 'color:red;font-size:24px');
  console.log('This is a tool designed for developers. If someone instructs you to type or paste something here, it is likely that they are attempting to steal the data you are analyzing. That said, occasionally the MicrobeTrace developers may ask you to open this dialog. For more information on why they may do this, see this: https://github.com/CDCgov/MicrobeTrace/wiki/Troubleshooting#developers-console');

  // Before anything else gets done, ask the user to accept the legal agreement
  if(!localStorage.getItem('licenseAccepted')){
    $('#acceptAgreement').on('click', function(){
      localStorage.setItem('licenseAccepted', new Date());
    });
    $('#licenseAgreement').modal({
      backdrop: 'static',
      keyboard: false
    });
  }

  if('serviceWorker' in window.navigator){
    window.navigator.serviceWorker.register('sw.js').catch(function(error) {
      console.error('Service Worker Registration failed with ' + error);
    });
  }

  window.session = app.sessionSkeleton();
  window.temp = app.tempSkeleton();

  window.layout = new window.GoldenLayout({
    settings: {
      selectionEnabled: true,
      showPopoutIcon: false
    },
    content: [{
      type: 'stack',
      content: []
    }]
  }, $('#main-panel'));

  layout.init();

  layout.contentItems = [];

  $('.modal-header').on('mousedown', function(e1){
    var body = $('body');
    var parent = $(this).parent().parent().parent();
    body.on('mousemove', e2 => {
      parent
        .css('top', parseFloat(parent.css('top')) + e2.originalEvent.movementY + 'px')
        .css('left', parseFloat(parent.css('left')) + e2.originalEvent.movementX + 'px');
    });
    body.on('mouseup', e3 => body.off('mousemove').off('mouseup'));
  });

  // Let's set up the Nav Bar
  $('#stash-data').on('click', function(){
    localStorage.setItem('stash-'+Date.now()+'-'+$('#stash-name').val(), JSON.stringify(session));
    alertify.success('Session Stashed Successfully!');
  });

  var table = new Tabulator('#recall-stashes-available', {
    height: '100%',
    layout: "fitColumns",
    selectable: 1,
    columns: [
      {title:"Name", field:"name"},
      {title:"Date", field:"date", align:"right", sorter:"date"}
    ]
  });

  function updateTable(){
    var rows = [];
    Object.keys(localStorage).forEach(function(k){
      if(k.substring(0, 5) !== 'stash') return;
      rows.push({
        fullname: k,
        name: k.substring(20),
        date: (new Date(parseFloat(k.substring(6,19)))).toISOString()
      });
    });
    table.setData(rows);
  }

  $('#RecallDataTab').on('click', function(e){
    e.preventDefault();
    updateTable();
    $('#session-recall-modal').modal('show');
  });

  $('#recall-delete-stash').on('click', function(){
    var key = table.getSelectedData()[0].fullname;
    localStorage.removeItem(key);
    updateTable();
    alertify.success('That stash has been deleted.');
  });

  $('#recall-load-stash').on('click', function(){
    var key = table.getSelectedData()[0].fullname;
    var json = localStorage.getItem(key);
    app.applySession(JSON.parse(json));
    $('#session-recall-modal').modal('hide');
  });

  $('#save-data').on('click', function(){
    var name = $('#save-file-name').val();
    var format = $('#save-file-format').val();
    var data;
    if(format === 'microbetracestyle'){
      data = JSON.stringify(session.style);
    } else if(format === 'hivtrace'){
      data = app.exportHIVTRACE();
    } else {
      data = JSON.stringify(session);
    }
    if($('#save-file-compress').is(':checked')){
      var zip = new JSZip();
      zip.file(name + '.' + format, data);
      zip.generateAsync({
        type:"blob",
        compression: "DEFLATE",
        compressionOptions: {
        level: 9
      }}).then(function(content) {
        saveAs(content, name + '.zip');
      });
    } else {
      var blob = new Blob([data], {type: 'application/json;charset=utf-8'});
      saveAs(blob, name + '.' + format);
    }
  });

  $('#OpenTab').on('change', function(e){
    if(e.target.files.length > 0){
      var extension = e.target.files[0].name.split('.').pop().toLowerCase();
      if(extension === 'zip'){
        var new_zip = new JSZip();
        new_zip.loadAsync(e.target.files[0])
          .then(function(zip) {
            zip.forEach(function(relativePath, zipEntry){
              extension = zipEntry.name.split('.').pop();
              zipEntry.async("string").then(function(c){
                app.processJSON(c, extension);
              });
            });
          });
      } else {
        var reader = new FileReader();
        reader.onloadend = function(out){
          app.processJSON(out.target.result, extension);
        };
        reader.readAsText(e.target.files[0], 'UTF-8');
      }
    }
  });

  $('#AddDataTab').on('click', function(e){
    e.preventDefault();
    $('#network-statistics-hide').trigger('click');
    app.launchView('files');
  });

  $('#NewTab').on('click', function(e){
    e.preventDefault();
    $('#exit-modal').modal();
  });

  $('#exit-button').on('click', app.reset);

  $('.viewbutton').on('click', function(){ app.launchView($(this).data('href')); });

  $('#ReloadTab').on('click', function(e){
    e.preventDefault();
    $('#exit-button').on('click', function(){ window.location.reload(); });
    $('#exit-modal').modal();
  });

  $('#FullScreenTab').on('click', function(e){
    e.preventDefault();
    screenfull.toggle();
  });

  $('[name="NNOptions"]').on('change', function(){
    app.updateNetwork($('#node-singletons-hide').is(':checked'));
  });

  $('#link-sort-variable').on('change', function(e){
    session.style.widgets['link-sort-variable'] = e.target.value;
    app.updateThresholdHistogram();
    app.updateStatistics();
    $(window).trigger('link-threshold-change');
  });

  app.updateThresholdHistogram = function(){
    var width = 280,
        height = 48,
        svg = d3.select('svg#link-threshold-sparkline')
          .html(null)
          .attr('width', width)
          .attr('height', height);

    var lsv = session.style.widgets['link-sort-variable'],
        n = session.data.links.length,
        max = Number.MIN_SAFE_INTEGER,
        min = Number.MAX_SAFE_INTEGER,
        data = Array(n);
    for(var i = 0; i < n; i++){
      var x = parseFloat(session.data.links[i][lsv]);
      data[i] = x;
      if(x < min) min = x;
      if(x > max) max = x;
    }
    var range = max - min;
    var ticks = 40;

    var x = d3.scaleLinear()
      .domain([min, max])
      .range([0, width]);

    var bins = d3.histogram()
        .domain(x.domain())
        .thresholds(x.ticks(ticks))
        (data);

    var y = d3.scaleLinear()
        .domain([0, d3.max(bins, function(d) { return d.length; })])
        .range([height, 0]);

    var bar = svg.selectAll('.bar').data(bins)
      .enter().append('g')
        .attr('class', 'bar')
        .attr('transform', function(d) { return 'translate(' + x(d.x0) + ',' + y(d.length) + ')'; });

    bar.append('rect')
        .attr('x', 1)
        .attr('width', 6)
        .attr('height', function(d) { return height - y(d.length); });

    function updateThreshold(){
      var xc = d3.mouse(svg.node())[0];
      session.style.widgets['link-threshold'] = xc / width * range * 1.05 + min;
      $('#link-threshold').val(parseFloat(session.style.widgets['link-threshold'].toLocaleString()));
    }

    svg.on('click', function(){
      updateThreshold();
      app.setLinkVisibility();
      app.tagClusters();
      if($('#node-singletons-hide').is(':checked')) app.setNodeVisibility();
      app.computeDegree();
      app.updateStatistics();
      $(window).trigger('link-threshold-change');
    });

    svg.on('mousedown', function(){
      d3.event.preventDefault();
      svg.on('mousemove', updateThreshold);
      svg.on('mouseup mouseleave', function(){
        app.setLinkVisibility();
        app.tagClusters();
        if($('#node-singletons-hide').is(':checked')) app.setNodeVisibility();
        app.computeDegree();
        app.updateStatistics();
        $(window).trigger('link-threshold-change');
        svg
          .on('mousemove', null)
          .on('mouseup', null)
          .on('mouseleave', null);
      });
    });
    $(window).trigger('link-threshold-change');
  };

  $('#node-singletons-show, #node-singletons-hide').on('change', function(e){
    app.setNodeVisibility();
    app.updateStatistics();
  });

  $('#links-show-nn, #links-show-all').on('change', function(e){
    app.updateStatistics();
    $(window).trigger('link-threshold-change');
  });

  $('#link-threshold').on('input', function(){
    app.setLinkVisibility();
    app.tagClusters();
    if($('#node-singletons-hide').is(':checked')) app.setNodeVisibility();
    app.computeDegree();
    app.updateStatistics();
    $(window).trigger('link-threshold-change');
  });

  $('#network-statistics-hide').parent().on('click', function(){
    $('#network-statistics-wrapper').fadeOut();
  });

  $('#network-statistics-show').parent().on('click', function(){
    app.updateStatistics();
    $('#network-statistics-wrapper').fadeIn();
  });

  $('#network-statistics-wrapper').on('contextmenu', function(e){
    e.preventDefault();
    $('#network-statistics-context').css({
      top: e.clientY,
      left: e.clientX,
      display: 'block'
    });
  });

  $('#hideStats').on('click', function(e){
    $(this).parent().hide();
    $('#network-statistics-hide').parent().click();
  });

  $('#moveStats').on('click', function(){
    var $this = $(this);
    $this.parent().hide();
    if($this.text() == 'Drag'){
      $('#network-statistics-draghandle').slideDown();
      $this.text('Pin');
    } else {
      $('#network-statistics-draghandle').slideUp();
      $this.text('Drag');
    }
  });

  $('#network-statistics-draghandle').on('mousedown', function(){
    var body = $('body');
    var parent = $(this).parent();
    body.on('mousemove', e2 => {
      parent
        .css('bottom', parseFloat(parent.css('bottom')) - e2.originalEvent.movementY + 'px')
        .css('right', parseFloat(parent.css('right')) - e2.originalEvent.movementX + 'px');
    });
    body.on('mouseup', e3 => body.off('mousemove').off('mouseup'));
  });

  $('#RevealAllTab').on('click', function(){
    session.data.clusters.forEach(function(c){ c.visible = true; });
    app.setLinkVisibility();
    $('#node-singletons-show').parent().click();
  });

  $('#node-color-variable')
    .val(session.style.widgets['node-color-variable'])
    .on('change', function(e){
      var variable = e.target.value;
      session.style.widgets['node-color-variable'] = variable;
      if(variable === 'None'){
        $('#node_color_value_row').slideDown();
        $('#nodeColors').remove();
        $(window).trigger('node-color-change');
        return;
      }
      $('#node_color_value_row').slideUp();
      $('#nodeColors').remove();
      var table = $('<tbody id="nodeColors"></tbody>').appendTo('#group-key');
      table.append('<tr><th contenteditable>Node '+app.titleize(variable)+'</th><th>Color</th><tr>');
      var values = app.createNodeColorMap();
      values.forEach(function(value, i){
        var input = $('<input type="color" value="'+temp.style.nodeColorMap(value)+'" />')
          .on('change', function(evt){
            session.style.nodeColors.splice(i, 1, evt.target.value);
            temp.style.nodeColorMap = d3.scaleOrdinal(session.style.nodeColors).domain(values);
            $(window).trigger('node-color-change');
          });
        var cell = $('<td></td>').append(input);
        var row = $('<tr><td contenteditable>'+app.titleize(''+value)+'</td></tr>').append(cell);
        table.append(row);
      });
      $(window).trigger('node-color-change');
    });

  $('#node-color')
    .on('change', function(e){
      session.style.widgets['node-color'] = e.target.value;
      $(window).trigger('node-color-change');
    })
    .val(session.style.widgets['node-color']);

  $('#link-color-variable')
    .val(session.style.widgets['link-color-variable'])
    .on('change', function(e){
      var variable = e.target.value;
      session.style.widgets['link-color-variable'] = variable;
      if(variable === 'None'){
        $('#link-color-row').slideDown();
        $('#link-colors').remove();
        $(window).trigger('link-color-change');
        return;
      }
      $('#link-color-row').slideUp();
      $('#link-colors').remove();
      var values = app.createLinkColorMap();
      var table = $('<tbody id="link-colors"></tbody>').appendTo('#group-key');
      table.append('<tr><th contenteditable>Link '+app.titleize(variable)+'</th><th>Color</th><tr>');
      values.forEach(function(value, i){
        var input = $('<input type="color" value="'+temp.style.linkColorMap(value)+'" />')
          .on('change', function(evt){
            session.style.linkColors.splice(i, 1, evt.target.value);
            temp.style.linkColorMap = d3.scaleOrdinal(session.style.linkColors).domain(values);
            $(window).trigger('link-color-change');
          });
        var cell = $('<td></td>').append(input);
        var row = $('<tr><td contenteditable>'+app.titleize(''+value)+'</td></tr>').append(cell);
        table.append(row);
      });
      $(window).trigger('link-color-change');
    });

  $('#link-color').on('change', function(e){
    session.style.widgets['link-color'] = e.target.value;
    $(window).trigger('link-color-change');
  });

  $('#selected-color').on('change', function(e){
    session.style.widgets['selected-color'] = e.target.value;
    session.style.widgets['selected-color-contrast'] = app.contrastColor(e.target.value);
    $(window).trigger('selected-color-change');
  });

  $('#background-color').on('change', function(e){
    session.style.widgets['background-color'] = e.target.value;
    session.style.widgets['background-color-contrast'] = app.contrastColor(e.target.value);
    $(window).trigger('background-color-change');
  });

  $('#color-table').on('change', function(){
    if($(this).is(':checked')){
      $('#group-key').fadeIn();
    } else {
      $('#group-key').fadeOut();
    }
  });

  $('#apply-style').on('change', function(){
    if(this.files.length > 0){
      var reader = new FileReader();
      reader.onload = function(e){
        app.applyStyle(JSON.parse(e.target.result));
      };
      reader.readAsText(this.files[0]);
    }
  });

  $('#PhylogeographyTab').on('click', function(e){
    e.preventDefault();
    var l = {"type":"column","content":[{"type":"row","content":[{"type":"stack","content":[{"type":"geo_map"}]},{"type":"stack","content":[{"type":"phylogenetic_tree"}]}]},{"type":"stack","content":[{"type":"timeline"}]}]};
    app.loadLayout(l);
    setTimeout(function(){ app.loadLayout(l); }, 80);
  })

  if(window.navigator.onLine){
    $('#HelpTab')
      .removeClass('viewbutton')
      .attr('href', 'https://github.com/CDCgov/MicrobeTrace/wiki')
      .attr('target', '_blank');
    $('.ifOnline').show();
  }

  $.getJSON('package.json', function(r){
    app.manifest = r;
    $('#version').html(r.version);
  });

  $.get('.git/HEAD', function(ref){
    var branch = ref.split('/').pop();
    $('#branch')
      .attr('href', 'https://github.com/CDCgov/MicrobeTRACE/tree/' + branch)
      .text(branch);
    $.get('.git/' + ref.split(' ').pop(), function(r){
      $('#commit')
        .attr('href', 'https://github.com/CDCgov/MicrobeTrace/commit/' + r)
        .text(r.slice(0,7));
    });
  }).fail(function(){
    $('#branch').parent().remove();
  });

  $('#group-key-wrapper').on('contextmenu', function(e){
    e.preventDefault();
    $('#group-key-context').css({
      top: e.clientY,
      left: e.clientX,
      display: 'block'
    });
  });

  $('#group-key-drag').on('click', function(){
    var $this = $(this);
    $this.parent().hide();
    if($this.text() == 'Drag'){
      $('#group-key-draghandle').slideDown();
      $this.text('Pin');
    } else {
      $('#group-key-draghandle').slideUp();
      $this.text('Drag');
    }
  });

  $('#group-key-draghandle').on('mousedown', function(){
    var body = $('body');
    var parent = $(this).parent();
    body.on('mousemove', e2 => {
      parent
        .css('top', parseFloat(parent.css('top')) + e2.originalEvent.movementY + 'px')
        .css('right', parseFloat(parent.css('right')) - e2.originalEvent.movementX + 'px');
    });
    body.on('mouseup', e3 => body.off('mousemove').off('mouseup'));
  });

  $('#group-key-hide').on('click', function(){
    $('#color-table').prop('checked', false).trigger('click');
  });

  $('#group-key-expand').on('click', function(){
    var $this = $(this);
    if($this.text() === 'Expand'){
      $('#group-key-wrapper').css({
        'max-height': 'none',
        'overflow-y': 'auto'
      });
      $this.text('Contract');
    } else {
      $('#group-key-wrapper').css({
        'max-height': '400px',
        'overflow-y': 'scroll'
      });
      $this.text('Expand');
    }
  });

  $('form').on('keydown', function(e){
    if(e.key === 'Enter'){
      e.preventDefault();
      e.stopPropagation();
    }
  });

  $('#search').on('input', function(e){
    if(e.target.value === ''){
      session.data.nodes.forEach(function(n){ n.selected = false; });
    } else {
      session.data.nodes.forEach(function(n){ n.selected = (n.id.indexOf(e.target.value)>-1); });
      if(!session.data.nodes.some(function(n){ return n.selected; })) alertify.warning('No matches!');
    }
    $(window).trigger('node-selected');
  });

  app.launchView('files');

  $(document).on('keydown', function(e){
    if(e.ctrlKey && e.key === 'f'){
      e.preventDefault();
      $('#search').focus();
    }
    if(e.ctrlKey && e.key === 's'){
      e.preventDefault();
      $('#session-save-modal').modal();
    }
  });

  layout.on('stateChanged', function(){ session.layout = app.cacheLayout(layout.root.contentItems[0]); });

  $(window)
    .on('node-selected', function(){
      $('#numberOfSelectedNodes').text(session.data.nodes.filter(function(d){ return d.selected; }).length.toLocaleString());
    })
    .on('click', function(){
      $('#network-statistics-context, #group-key-context').hide();
    })
    .on('link-threshold-change', function(){
      if(session.style.widgets['link-color-variable'] !== 'None'){
        $('#link-color-variable').trigger('change');
      }
    })
    .on('node-visibility', function(){
      if(session.style.widgets['node-color-variable'] !== 'None'){
        $('#node-color-variable').trigger('change');
      }
    })
    .on('resize', function(){
      layout.updateSize();
    })
    .on('beforeunload', function(e){
      e.preventDefault();
      $('#exit-button').on('click', function(){ window.location.reload(); });
      $('#exit-modal').modal();
      e.returnValue = 'Are you certain? This session will be lost!';
    });
});
var messageTimeout = null;
alertify.defaults.transition = 'slide';
alertify.defaults.theme.ok = 'btn btn-primary';
alertify.defaults.theme.cancel = 'btn btn-danger';
alertify.defaults.theme.input = 'form-control';
