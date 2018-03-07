var layout = new window.GoldenLayout({
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

function launchView(view){
  if(!layout._components[view]){
    layout.registerComponent(view, function(container, state){
      container.getElement().html(state.text);
    });
  }
  if(!componentCache[view]){
    $.get('components/' + view + '.html', function(response){
      componentCache[view] = response;
      launchView(view);
    });
  } else {
    layout.root.contentItems[0].addChild({
      title: app.titleize(view),
      type: 'component',
      componentName: view,
      componentState: { text: componentCache[view] }
    });
    $('select.nodeVariables').html(
      '<option>None</option>' +
      session.data.nodeFields.map(function(field){
        return '<option value="'+field+'">'+app.titleize(field)+'</option>';
      }).join('\n')
    );
    $('select.linkVariables').html(
      '<option>None</option>' +
      session.data.linkFields.map(function(field){
        return '<option value="'+field+'">'+app.titleize(field)+'</option>';
      }).join('\n')
    );
    $('[data-toggle="tooltip"]').tooltip();
  }
}

var componentCache = {};

$(function(){

  function reset(){
    window.session = app.dataSkeleton();
    //TODO: Kill all open tabs
    launchView('files');
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

  // Let's set up the Nav Bar
  $('#FileTab').click(reset);

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
        document.getElementsByTagName('svg#network')[0].innerHTML + '\n' +
      '</svg>';
    var blob = new Blob([content], {type: 'image/svg+xml;charset=utf-8'});
    saveAs(blob, 'MicrobeTraceExport.svg');
  });

  $('#ExitTab').click(function(){ window.open('','_self').close(); });

  $('#FindTab').click(function(e){ $('#search').focus(); });

  $('#AddDataTab').click(function(){ launchView('file'); });

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

  $('.viewbutton').click(function(){ launchView($(this).data('href')); });

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
