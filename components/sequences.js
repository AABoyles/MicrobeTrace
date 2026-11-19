  MT.registerView('sequences', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const panel = $('.sequences-panel');
    const pane = $('.left-pane');
    let canvas = null, labels = null, transform = d3.zoomIdentity;
    // The alignment is drawn in a worker (workers/render-alignment.js), shown in
    // the view while it is, with a Cancel (#293)
    const computing = MT.viewComputing(root, 'the alignment');

    const sequences = () => session.data.nodes.filter(d => d.seq);

    // A color for each base, distinct from the others and light enough for
    // its letter; anything else (gaps, ambiguity codes) is pale grey
    const colors = { A: '#8dd38d', C: '#7fb3e6', G: '#ffd54f', T: '#f28482', ambig: '#ececec' };
    $('.sequences-key').innerHTML = Object.entries(colors).map(([base, color]) =>
      `<span><i style="background:${color}"></i>${base == 'ambig' ? 'Other' : base}</span>`).join('');
    // Letters only where they fit; smaller cells would turn them to hatching
    const lettersFit = (width, height) => width >= 7 && height >= 8;

    // The ids stay at the left as the alignment pans beneath them, and follow
    // it up and down and in zoom
    function place() {
      const x = Math.round(transform.x), y = Math.round(transform.y), k = transform.k;
      const offset = labels ? labels.width * k : 0;
      if (canvas) canvas.style.transform = `translate(${x + offset}px,${y}px) scale(${k})`;
      if (labels) labels.style.transform = `translate(0,${y}px) scale(${k})`;
    }

    // Each row's id, in a column as tall as the alignment
    function drawLabels(ids, height) {
      const column = document.createElement('canvas');
      const context = column.getContext('2d');
      const font = `${Math.max(1, height - 2)}px ${getComputedStyle(document.body).fontFamily}`;
      context.font = font;
      column.width = Math.ceil(Math.max(0, ...ids.map(id => context.measureText(id).width))) + 14;
      column.height = ids.length * height;
      context.fillStyle = settings.get('background-color');
      context.fillRect(0, 0, column.width, column.height);
      context.font = font;
      context.fillStyle = settings.get('background-color-contrast');
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      ids.forEach((id, i) => context.fillText(id, column.width - 4, i * height + height / 2));
      column.className = 'sequence-ids';
      column.style.transformOrigin = '0 0';
      return column;
    }

    // Draws the alignment, replacing the last one when it's ready. The worker
    // gets copies of the sequences, so the nodes stay as they are.
    function draw() {
      const width = settings.get('sequences-cell-width'), height = settings.get('sequences-cell-height');
      if (!(width >= 1) || !(height >= 1)) return;
      const rows = sequences();
      const show = settings.get('sequences-show-chars');
      const showChar = show && lettersFit(width, height);
      $('.sequences-letters-note').hidden = !show || lettersFit(width, height);
      computing.run((scope, onProgress) => MT.runWorker('workers/render-alignment.js', {
        seqs: rows.map(d => d.seq.toUpperCase()),
        width: 0 | width,
        height: 0 | height,
        showChar,
        colors
      }, { name: 'The alignment', scope, onProgress }).then(response => {
        const c = document.createElement('canvas');
        if (response.image) {
          c.width = response.image.width;
          c.height = response.image.height;
          c.getContext('2d').drawImage(response.image, 0, 0);
          response.image.close();
        }
        return c;
      }), c => {
        if (canvas) canvas.remove();
        if (labels) labels.remove();
        canvas = c;
        canvas.className = 'alignment';
        canvas.style.transformOrigin = '0 0';
        labels = drawLabels(rows.map(d => '' + d._id), 0 | height);
        panel.append(canvas, labels);
        place();
      });
    }

    const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', event => {
      transform = event.transform;
      place();
    });
    d3.select(panel).call(zoom);
    panel.addEventListener('mousedown', () => { panel.style.cursor = 'grabbing'; });
    panel.addEventListener('mouseup', () => { panel.style.cursor = 'grab'; });

    const setBackground = () => {
      panel.style.background = settings.get('background-color');
      // (The ids are drawn on the background)
      if (canvas) draw();
    };

    // The ids and the alignment, side by side
    function image() {
      const out = document.createElement('canvas');
      out.width = labels.width + canvas.width;
      out.height = canvas.height;
      const context = out.getContext('2d');
      context.drawImage(labels, 0, 0);
      context.drawImage(canvas, labels.width, 0);
      return out;
    }

    const saveText = (prefix, extension) => filename => MT.saveAs(
      new Blob([sequences().map(d => prefix + d._id + '\r\n' + d.seq).join('\r\n')]),
      filename + '.' + extension
    );

    MT.paneToggle($('.settings-toggle'), pane);
    MT.tableExport(root, {
      png: filename => canvas && image().toBlob(blob => MT.saveImage(blob, filename + '.png')),
      fasta: saveText('>', 'fasta'),
      mega: saveText('#', 'mega')
    });

    const stop = [
      MTBind(pane, settings),
      settings.subscribe(['sequences-cell-width', 'sequences-cell-height', 'sequences-show-chars'], draw),
      events.on('background-color-change', setBackground)
    ];
    draw();
    setBackground();

    return {
      destroy() {
        computing.destroy();
        stop.forEach(fn => fn());
        d3.select(panel).on('.zoom', null);
      }
    };
  });
