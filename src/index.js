$(function(){
  'use strict';

  $.getJSON('package.json', function(r){ $('#version').html(r.version); });

  if(navigator.onLine) $('.ifOnline').show();

  window.session = app.sessionSkeleton();

  window.layout = new window.GoldenLayout({
    settings: {
      selectionEnabled: true,
      showPopoutIcon: false
    },
    content: [{
      type: 'stack',
      content: []
    }]
  }, $('#main_panel'));

  layout.init();

  layout.contentItems = [];

  app.launchView('files');

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

  // Let's set up the Nav Bar
  $('#FileTab').click(app.reset);

  $('#SaveTab').click(function(){
    var blob = new Blob([JSON.stringify(session)], {type: 'application/json;charset=utf-8'});
    saveAs(blob, $('#save-file-name').val()+'.microbetrace');
  });

  $('#OpenTab').change(function(e){
    if(e.target.files.length > 0){
      var reader = new FileReader();
      reader.onloadend = function(out){
        session = JSON.parse(out.target.result);
        app.launchView('2d_network');
      };
      reader.readAsText(e.target.files[0], 'UTF-8');
    }
  });

  $('#ImportTab').change(function(e){
    if(e.target.files.length > 0){
      var reader = new FileReader();
      reader.onloadend = function(out){
        session = app.sessionSkeleton();
        app.parseHIVTrace(JSON.parse(out.target.result));
        app.launchView('2d_network');
        $('#linkSortVariable').html(
          session.data.linkFields.map(function(field){
            return '<option value="' + field + '"' + (field === 'distance' ? ' selected' : '') + '>' + app.titleize(field) + '</option>';
          }).join('\n')
        );
        try {
          app.updateThresholdHistogram();
        } catch(error){
          console.error(error);
          app.reset();
        }
        app.setLinkVisibility();
        app.setNodeVisibility();
        app.tagClusters();
        app.computeDegree();
        setTimeout(function(){
          session.network.render();
          session.network.force.alpha(0.3).alphaTarget(0).restart();
          session.network.updateStatistics();
          session.loadTime = Date.now() - session.startTime;
          $('.hideForHIVTrace').hide();
          setTimeout(session.network.fit, 1500);
        }, 80);
      };
      reader.readAsText(e.target.files[0], 'UTF-8');
    }
  });

  $('#ExitTab').click(function(){ window.open('','_self').close(); });

  $('#FindTab').click(function(e){ $('#search').focus(); });

  $('#AddDataTab').click(function(){ app.launchView('files'); });

  $('#RevealAllTab').click(function(e) {
    session.data.clusters.forEach(function(c){ c.visible = 1; });
    $('#HideSingletons').prop('checked', false).parent().removeClass('active');
    $('#ShowSingletons').prop('checked', true).parent().addClass('active');
    app.setLinkVisibility();
    app.setNodeVisibility();
  });

  $('.viewbutton').click(function(){ app.launchView($(this).data('href')); });

  $('#ReloadTab').click(function(){ window.location.reload(true); });

  $('#FullScreenTab').click(function(){ screenfull.toggle(); });

  $('#UpdateTab').click(function(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js', { scope: '/' }).then(function(reg){
        if(reg.installing || reg.waiting){
          alertify.warning('MicrobeTrace is Updating...');
        } else if(reg.active) {
          alertify.success('You\'re running the latest available version of MicrobeTrace!');
        }
      }).catch(function(error){
        alertify.error('MicrobeTrace failed to Update!');
        console.log(error);
      });
    } else {
      alertify.warning('Old Browser Detected!\nPlease consider updating!');
    }
  });

  $('#computeMST').click(function(){
    //TODO: Write
    $('.showForNotMST').fadeOut(function(){
      $('.showForMST').fadeIn();
    });
  });

  $('#showMSTLinks, #showAllLinks').change(function(){
    app.setLinkVisibility();
    app.tagClusters();
    if($('#HideSingletons').is(':checked')) app.setNodeVisibility();
    app.computeDegree();
  })

  $('#ShowSingletons, #HideSingletons').change(app.setNodeVisibility);

  app.updateThresholdHistogram = function(){
    var width = 280,
        height = 48,
        svg = d3.select('svg#link-threshold-sparkline')
          .html(null)
          .attr('width', width)
          .attr('height', height);

    var lsv = $('#linkSortVariable').val(),
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

    var x = d3.scaleLinear()
      .domain([min, max])
      .range([0, width]);

    var bins = d3.histogram()
        .domain(x.domain())
        .thresholds(x.ticks(40))
        (data);

    var y = d3.scaleLinear()
        .domain([0, d3.max(bins, function(d) { return d.length; })])
        .range([height, 0]);

    var bar = svg.selectAll('.bar')
      .data(bins)
      .enter().append('g')
        .attr('class', 'bar')
        .attr('transform', function(d) { return 'translate(' + x(d.x0) + ',' + y(d.length) + ')'; });

    bar.append('rect')
        .attr('x', 1)
        .attr('width', 6)
        .attr('height', function(d) { return height - y(d.length); });

    function updateThreshold(){
      var x = d3.mouse(svg.node())[0];
      session.state.linkThreshold = x / width * range + min;
      $('#default-link-threshold').val(parseFloat(session.state.linkThreshold.toLocaleString()));
      $(window).trigger('updateThreshold');
    }

    svg.on('click', function(){
      updateThreshold();
      app.setLinkVisibility();
      app.tagClusters();
      if($('#HideSingletons').is(':checked')) app.setNodeVisibility();
      app.computeDegree();
      session.network.render();
      session.network.updateStatistics();
      session.network.force.alpha(0.3).alphaTarget(0).restart();
    });

    svg.on('mousedown', function(){
      d3.event.preventDefault();
      svg.on('mousemove', updateThreshold);
      svg.on('mouseup', function(){
        app.setLinkVisibility();
        app.tagClusters();
        if($('#HideSingletons').is(':checked')) app.setNodeVisibility();
        app.computeDegree();
        session.network.render();
        session.network.updateStatistics();
        session.network.force.alpha(0.3).alphaTarget(0).restart();
        svg
          .on('mousemove', null)
          .on('mouseup', null);
      });
    });

    session.state.linkThreshold = parseFloat($('#defaultDistanceThreshold').val());
    $('#default-link-threshold').val(parseFloat(session.state.linkThreshold.toLocaleString()));
    $(window).trigger('updateThreshold');
  };

  $('#linkSortVariable').on('change', app.updateThresholdHistogram);

  $('#default-link-threshold').on('input', function(){
    app.setLinkVisibility();
    app.tagClusters();
    if($('#HideSingletons').is(':checked')) app.setNodeVisibility();
    app.computeDegree();
    $(window).trigger('updateThreshold');
  });

  $('#export-data').click(function(){
    var mime = 'application/json;';
    var format = $('#export-file-format').val();
    var name = $('#export-file-name').val();
    var blob = new Blob([app.exportHIVTRACE()], {type: mime + 'charset=utf-8'});
    saveAs(blob, name + '.' + format);
  });

  $('form').on('keydown', function(e){
    if(e.key === 'Enter'){
      e.preventDefault();
      e.stopPropagation();
    }
  });

  $('#search').on('input', function(e){
    if(e.target.value === ''){
      session.data.nodes.forEach(function(n){ n.selected = 0; });
    } else {
      session.data.nodes.forEach(function(n){ n.selected = (n.id.indexOf(e.target.value)>-1); });
      if(!session.data.nodes.some(function(n){ return n.selected; })) alertify.warning('No matches!');
    }
    $(window).trigger('node_selected');
  });

  $(document).on('keydown', function(e){
    if(e.ctrlKey && e.key === 'f'){
      e.preventDefault();
      $('#search').focus();
    }
  });

  $(window).on('resize', function(){ layout.root.setSize(); });
});

alertify.defaults.transition = 'slide';
alertify.defaults.theme.ok = 'btn btn-primary';
alertify.defaults.theme.cancel = 'btn btn-danger';
alertify.defaults.theme.input = 'form-control';
