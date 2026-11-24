  MT.registerView('files', (root, { settings, events }) => {

    // How long the loading dialog may take to open before the load is given up,
    // and when a long read says it is still working
    const MODAL_WAIT_MS = 5000, STILL_WORKING_MS = 20000;

    const $ = selector => root.querySelector(selector);
    const $$ = selector => Array.from(root.querySelectorAll(selector));
    const get = key => settings.get(key);
    const pane = $('.left-pane');
    const panel = $('.file-panel');
    const table = $('#file-table');
    const launchButton = $('#launch');
    const number = selector => parseFloat($(selector).value);
    const alignerInputs = { match: '.aligner-match', mismatch: '.aligner-mismatch', gapOpen: '.aligner-gap-open', gapExtend: '.aligner-gap-extend', band: '.aligner-band' };
    const alignerCosts = () => Object.fromEntries(Object.keys(alignerInputs).map(k => [k, number(alignerInputs[k])]));
    // The aligner's {match, gap} scores; the preview and the launch both use these
    const alignerScoring = () => MTAlignerScoring(alignerCosts());
    const show = (elements, visible) => [].concat(elements).forEach(el => { el.hidden = !visible; });

    const dropZone = $('.drop-zone-group');
    $('.demo-button').addEventListener('click', () => MT.loadDemo());
    MT.updateDemoButtons();

    // The files' order, which ranks them where they disagree, follows their
    // rows, which can be dragged by their grips
    const fileOf = new WeakMap();
    const rowOf = new WeakMap(); // a file's row, and the columns it has
    const headersOf = new WeakMap();
    const showOrderHint = () => { $('.file-order-hint').hidden = $$('.file-table-row').length < 2; };
    MT.sortable(table, { items: '.file-table-row', handle: '.file-grip', forcePlaceholderSize: true });
    const saveOrder = () => {
      const order = $$('.file-table-row').map(row => fileOf.get(row));
      session.files.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    };
    table.addEventListener('sortupdate', saveOrder);
    // Moving a file up or down without dragging (#185): each row's buttons, or
    // Alt+Up and Alt+Down on the row. The first can't go up and the last can't
    // go down.
    function refreshMoves() {
      const rows = $$('.file-table-row');
      rows.forEach((row, i) => {
        row.querySelector('.file-move-up').disabled = i == 0;
        row.querySelector('.file-move-down').disabled = i == rows.length - 1;
      });
    }
    const moveRow = (row, by) => {
      const rows = $$('.file-table-row'), i = rows.indexOf(row), j = i + by;
      if (j < 0 || j >= rows.length) return false;
      if (by < 0) rows[j].before(row); else rows[j].after(row);
      saveOrder();
      refreshMoves();
      $('.file-order-live').textContent = `${row.querySelector('.file-title').textContent} moved to position ${j + 1} of ${rows.length}.`;
      return true;
    };
    new MutationObserver(refreshMoves).observe(table, { childList: true });
    table.addEventListener('click', e => {
      const button = e.target.closest('.file-move-up, .file-move-down');
      if (!button) return;
      const by = button.classList.contains('file-move-up') ? -1 : 1, row = button.closest('.file-table-row');
      moveRow(row, by);
      // A button that can't go further hands the focus to the other
      (button.disabled ? row.querySelector(by < 0 ? '.file-move-down' : '.file-move-up') : button).focus();
    });
    table.addEventListener('keydown', e => {
      if (!e.altKey || (e.key != 'ArrowUp' && e.key != 'ArrowDown')) return;
      const row = e.target.closest('.file-table-row');
      if (!row) return;
      e.preventDefault();
      moveRow(row, e.key === 'ArrowUp' ? -1 : 1);
      // (A button that can't go further hands the focus to the other)
      (e.target.disabled ? row.querySelector(e.target.classList.contains('file-move-up') ? '.file-move-down' : '.file-move-up') : e.target).focus();
    });

    const ready = () => {
      dropZone.hidden = true;
      checkLaunch();
    };

    // Launch waits until every file can be read as what it's marked: each row
    // that can't says why
    const problems = new WeakMap();
    function checkLaunch() {
      const rows = $$('.file-table-row');
      let blocked = !rows.length;
      rows.forEach(row => {
        const problem = problems.has(row) ? problems.get(row)() : '';
        const note = row.querySelector('.file-problem');
        note.textContent = problem;
        note.hidden = !problem;
        if (problem) blocked = true;
      });
      launchButton.disabled = blocked;
      launchButton.title = !rows.length ? 'Add a network file (a link list, matrix, FASTA or Newick tree) to launch'
        : blocked ? 'Fix the files marked above to launch' : 'Launch MicrobeTrace with these files';
    }

    // Adding files ---------------------------------------------------------------

    $('#data-files').addEventListener('change', e => {
      processFiles(e.target.files);
      e.target.value = ''; // so adding the same file again (after removing it) is a change
    });
    panel.addEventListener('dragover', e => {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      panel.classList.add('dragging');
    });
    panel.addEventListener('dragleave', e => {
      if (!panel.contains(e.relatedTarget)) panel.classList.remove('dragging');
    });
    panel.addEventListener('drop', e => {
      e.stopPropagation();
      e.preventDefault();
      panel.classList.remove('dragging');
      processFiles(e.dataTransfer.files);
    });

    // Session files (and zips, which hold them) replace the current session
    const isSession = file => ['zip', 'microbetrace', 'hivtrace'].includes(file.name.split('.').pop().toLowerCase());

    function processFiles(files) {
      files = Array.from(files);
      if (files.some(isSession)) {
        MT.confirmReplace(() => addFiles(files));
      } else {
        addFiles(files);
      }
    }

    function addFiles(files) {
      ready();
      files.forEach(processFile);
      launchButton.focus();
    }

    // Reads a file as text, or as bytes for a spreadsheet. A read that fails
    // never settles, as it never did (the reader's onload was all that was set).
    const readFile = (rawfile, asBytes) => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      if (asBytes) reader.readAsArrayBuffer(rawfile); else reader.readAsText(rawfile);
    });

    async function processFile(rawfile) {
      const extension = rawfile.name.split('.').pop().toLowerCase();
      if (extension == 'zip') {
        const zip = await new JSZip().loadAsync(rawfile);
        // Each entry is read on its own, not one after another
        zip.forEach(async (relativePath, zipEntry) => {
          MT.processJSON(await zipEntry.async('string'), zipEntry.name.split('.').pop());
        });
        return;
      }
      if (extension == 'microbetrace' || extension == 'hivtrace') {
        MT.processJSON(await rawfile.text(), extension);
        return;
      }
      if (extension == 'svg') {
        MT.processSVG(await rawfile.text());
        return;
      }
      const contents = await readFile(rawfile, extension == 'xlsx' || extension == 'xls');
      const file = { name: rawfile.name, lastModified: rawfile.lastModified, extension: extension, contents: contents };
      file.rawName = file.name; // for the loading log, which shows text
      file.name = MT.escape(file.name);
      file.extension = file.name.split('.').pop().toLowerCase();
      session.files.push(file);
      addToTable(file);
    }

    // What a file is is decided by the format modules (src/formats): from what it
    // holds rather than what it is called (#267), and by its name only where the
    // contents say nothing. The kind is a guess: the buttons in the file's row
    // change it.
    const { formatByName, detectFormat, guessByName, delimiterNames } = MTFormats;

    // A file's row: its name, what kind of file it is, and the fields to read
    function addToTable(file) {
      const extension = file.extension ? file.extension : MT.escape(file.name).split('.').pop().toLowerCase();
      //#291 restore to previous filetype selection if available
      const guess = detectFormat(file.contents, file.name);
      if (!file.delimiter) file.delimiter = guess.delimiter;
      const kind = file.format || guess.kind || guessByName(file.name, extension);
      const detected = !file.format && guess.kind ? `Read as ${formatByName(guess.kind).label} from its contents` : '';
      if (extension == 'xlsx' || extension == 'xls') {
        const workbook = XLSX.read(file.contents, { type: 'array' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd' });
        const headers = [];
        data.forEach(row => Object.keys(row).forEach(key => {
          if (!headers.includes(key)) headers.push(key);
        }));
        addRow(file, kind, headers, detected);
      } else {
        // A table's rows have as many columns as its header: prose (notes, say)
        // doesn't, however its commas fall
        const sample = Papa.parse(file.contents, { delimiter: file.delimiter, preview: 20, skipEmptyLines: true }).data;
        // A file cut off mid-row ends in a short row, which doesn't make it prose
        // (in a short file, that one row would otherwise be most of the sample)
        const rows = sample.slice(1);
        const body = rows.length > 1 && rows[rows.length - 1].length != sample[0].length ? rows.slice(0, -1) : rows;
        const tabular = sample.length > 1 && body.filter(r => r.length == sample[0].length).length >= 0.8 * body.length;
        Papa.parse(file.contents, {
          delimiter: file.delimiter,
          header: true,
          preview: 1,
          complete: output => addRow(file, kind, tabular ? output.meta.fields : [], detected)
        });
      }
    }

    const kinds = [['link', 'Link'], ['node', 'Node'], ['matrix', 'Matrix'], ['fasta', 'FASTA'], ['newick', 'Newick']];
    let rowCount = 0;

    function addRow(file, kind, headers, detected) {
      const row = document.createElement('div');
      row.className = 'file-table-row';
      const group = 'file-kind-' + (rowCount++);
      row.innerHTML = `
        <div class="row w-100">
          <div class="file-name col">
            <span class="bi bi-grip-vertical file-grip" title="Drag to reorder"></span>
            <button type="button" class="btn btn-light btn-sm file-move-up" title="Move this file up" aria-label="Move this file up"><span class="bi bi-arrow-up" aria-hidden="true"></span></button>
            <button type="button" class="btn btn-light btn-sm file-move-down" title="Move this file down" aria-label="Move this file down"><span class="bi bi-arrow-down" aria-hidden="true"></span></button>
            <span class="file-title p-1"></span>
            <div class="btn-group btn-group-toggle btn-group-sm">
              ${kinds.map(([value, label]) => `<label class="btn btn-light">
                <input type="radio" name="${group}" value="${value}" autocomplete="off"${value == kind ? ' checked' : ''}>${label}
              </label>`).join('')}
            </div>
            <a href="#" class="icon-action bi bi-download p-1 ms-2" title="Resave this file" aria-label="Resave this file"></a>
            <a href="#" class="icon-action icon-remove bi bi-x-circle p-1" title="Remove this file" aria-label="Remove this file"></a>
          </div>
        </div>
        <p class="file-detected small text-body-secondary mb-0 mt-1" hidden></p>
        <p class="file-problem small text-danger mb-0 mt-1" hidden></p>
        <div class="row w-100">
          ${[1, 2, 3].map(i => `<div class="col-4 file-field">
            <label></label>
            <select class="form-select form-select-sm"></select>
          </div>`).join('')}
        </div>`;
      row.querySelector('.file-title').textContent = file.name;
      // Say how the kind was chosen, so it can be checked (and changed with the buttons)
      const note = row.querySelector('.file-detected');
      if (detected) {
        const d = delimiterNames[file.delimiter];
        note.textContent = detected + (d && d != 'comma' && !['fasta', 'newick'].includes(kind) ? ` (${d}-separated)` : '') + '. Change it with the buttons if that is wrong.';
        note.hidden = false;
      }
      rowOf.set(file, row);
      headersOf.set(file, headers);
      const fields = Array.from(row.querySelectorAll('.file-field'));
      const selects = fields.map(f => f.querySelector('select'));
      selects.forEach(select => MT.fillSelect(select, headers, { none: true }));
      const kindOf = () => row.querySelector(`input[name="${group}"]:checked`).value;

      row.querySelector('a[title="Remove this file"]').addEventListener('click', e => {
        e.preventDefault();
        const i = session.files.indexOf(file);
        if (i > -1) session.files.splice(i, 1);
        row.remove();
        showOrderHint();
        if (!table.querySelector('.file-table-row')) dropZone.hidden = false;
        checkLaunch();
      });
      row.querySelector('a[title="Resave this file"]').addEventListener('click', e => {
        e.preventDefault();
        MT.saveAs(new Blob([file.contents], { type: file.type || 'text' }), file.name);
      });

      // The fields named for what they hold, or the next column
      function matchHeaders(type) {
        if (file.field1) {
          //#291 restore to previous variable selection if available
          selects.forEach((s, i) => { s.value = file['field' + (i + 1)]; });
          return;
        }
        const names = [
          type == 'node' ? ['ID', 'Id', 'id'] : ['SOURCE', 'Source', 'source'],
          type == 'node' ? ['SEQUENCE', 'SEQ', 'SEQS', 'Sequence', 'Seqs', 'sequence', 'seq', 'seqs'] : ['TARGET', 'Target', 'target'],
          ['length', 'Length', 'distance', 'Distance'].concat(...Object.keys(MT.distanceMetrics).reverse().map(k => [k, MT.distanceMetrics[k].label]))
        ];
        names.forEach((list, i) => {
          selects[i].value = 'None';
          list.forEach(title => { if (headers.includes(title)) selects[i].value = title; });
          // A node's sequence and a link's distance stay None when no field is named for them
          if (selects[i].value == 'None' && !(i == 1 && type == 'node') && !(i == 2 && type == 'link') && headers[i] !== undefined) {
            selects[i].value = headers[i];
          }
        });
      }

      function update() {
        file.format = kindOf();
        selects.forEach((s, i) => { file['field' + (i + 1)] = s.value; });
      }

      function refit(rematch) {
        const type = kindOf();
        const labels = type == 'node' ? ['ID', 'Sequence', 'Distance'] : ['Source', 'Target', 'Distance'];
        fields.forEach((f, i) => { f.querySelector('label').textContent = labels[i]; });
        show(fields.slice(0, 2), type == 'node' || type == 'link');
        show(fields[2], type == 'link');
        if (rematch && (type == 'node' || type == 'link')) {
          delete file.field1;
          matchHeaders(type);
        }
        update();
      }

      // What keeps this file from being read as what it's marked, if anything
      problems.set(row, () => {
        const type = kindOf(), [first, second] = selects.map(select => select.value);
        if (type == 'link') {
          if (headers.length < 2) return `No columns were found in this file (read as ${delimiterNames[file.delimiter] || 'comma'}-separated), so it can’t be read as a link list.`;
          if (first == 'None' || second == 'None') return 'Choose the Source and Target columns.';
          if (first == second) return 'Source and Target need to be different columns.';
        }
        if (type == 'node') {
          if (!headers.length) return `No columns were found in this file (read as ${delimiterNames[file.delimiter] || 'comma'}-separated), so it can’t be read as a node list.`;
          if (first == 'None') return 'Choose the ID column.';
        }
        return '';
      });
      table.append(row);
      fileOf.set(row, file);
      MT.sortable(table, 'reload');
      showOrderHint();
      matchHeaders(kind);
      refit(false);
      checkLaunch();
      row.querySelectorAll(`input[name="${group}"]`).forEach(input => input.addEventListener('change', () => {
        refit(true);
        checkLaunch();
      }));
      selects.forEach(s => s.addEventListener('change', () => {
        update();
        checkLaunch();
      }));
    }

    if (session.files.length > 0) {
      dropZone.hidden = true;
      session.files.forEach(addToTable);
    }

    // The sequence controls ---------------------------------------------------

    const modal = $('#sequence-controls-modal');
    const preview = $('.alignment-preview');
    const referenceSelect = $('.reference-sequence');

    async function readFastas() {
      let data = [];
      for (const fasta of session.files.filter(f => f.extension.includes('fas'))) {
        data = data.concat(await MT.parseFASTA(fasta.contents));
      }
      return data;
    }

    function previewFailed(error) {
      console.error(error);
      preview.innerHTML = '';
      MT.toast.error(`The sequences could not be previewed: ${MT.escape((error && error.message) || '' + error)}.`);
    }

    // The reference the preview aligns to. A consensus is kept for the same
    // sequences and scores, so reopening the preview doesn't rebuild it; the
    // load builds its own, from every sequence (not only the FASTA files').
    let previewConsensus = { key: null, reference: '' };
    async function previewReference(data) {
      const source = referenceSource();
      if (source == 'first') return data.length ? data[0].seq : '';
      if (source == 'file') return session.data.reference;
      const scoring = alignerScoring();
      const key = JSON.stringify(scoring) + '|' + data.map(d => d.id + ':' + d.seq.length).join(',');
      if (previewConsensus.key != key) {
        previewConsensus = { key, reference: await MT.consensusReference(data, scoring) };
      }
      return previewConsensus.reference;
    }

    async function updatePreview(data) {
      preview.innerHTML = '<div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>';
      if (get('align-sw')) {
        const reference = await previewReference(data);
        if (!reference) {
          preview.innerHTML = '';
          preview.textContent = referenceSource() == 'file' ? 'Load a reference from a FASTA file to preview the alignment.' : 'No reference could be made from these sequences.';
          return;
        }
        data = await MT.align({
          nodes: data,
          reference,
          ...alignerScoring()
        });
      }
      const canvas = await alignmentViewer(data, { showID: false });
      preview.innerHTML = '';
      preview.append(canvas);
    }

    const referenceSource = () => ['file', 'first', 'consensus'].find(s => get('reference-source-' + s)) || 'consensus';
    function showAlignmentRows() {
      show($$('.align-config-row'), get('align-sw'));
      show($('.reference-file-row'), get('align-sw') && referenceSource() == 'file');
    }

    // The reference source is three settings, one per choice
    $$('input[name="reference-source"]').forEach(input => {
      input.checked = input.value == referenceSource();
      input.closest('.btn').classList.toggle('active', input.checked);
      input.addEventListener('change', () => {
        if (!input.checked) return;
        ['file', 'first', 'consensus'].forEach(s => settings.set('reference-source-' + s, s == input.value));
        // (Even when no file is loaded: a reference left from another source
        // must not be used as though it had been loaded)
        if (input.value == 'file') session.data.reference = referenceSelect.value;
        showAlignmentRows();
      });
    });

    $('.reference-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      file.text().then(text => MT.parseFASTA(text)).then(nodes => {
        if (!nodes.length) return MT.toast.error(`${MT.escape(file.name)} holds no sequences, so it can't be the reference.`);
        referenceSelect.innerHTML = nodes.map((d, i) => `<option value="${MT.escape(d.seq)}"${i == 0 ? ' selected' : ''}>${MT.escape(d.id)}</option>`).join('');
        referenceSelect.dispatchEvent(new Event('change'));
      }).catch(error => MT.toast.error(`Could not read ${MT.escape(file.name)} as FASTA: ${MT.escape((error && error.message) || '' + error)}.`));
      $('.reference-file-name').textContent = file.name;
    });

    referenceSelect.addEventListener('change', () => { session.data.reference = referenceSelect.value; });

    // Opening the controls (or clicking the preview) previews the sequences
    const showPreview = () => readFastas().then(updatePreview).catch(previewFailed);
    $('.sequence-controls-button').addEventListener('click', showPreview);
    preview.addEventListener('click', showPreview);

    // The audit: sequences that look wrong, each of which can be excluded
    const audited = $('.audited-sequences');
    function logAudit(id, type) {
      const row = document.createElement('div');
      row.className = 'alert alert-warning w-100 d-flex justify-content-between';
      row.setAttribute('role', 'alert');
      row.innerHTML = '<span></span><button type="button" class="btn btn-warning btn-sm audit-exclude">Exclude</button>';
      row.querySelector('span').textContent = `${id} appears to be ${type}.`;
      const button = row.querySelector('button');
      button.addEventListener('click', () => {
        const excluded = session.data.nodeExclusions;
        if (button.textContent === 'Exclude') {
          excluded.push(id);
          button.classList.replace('btn-warning', 'btn-success');
          button.textContent = 'Include';
        } else {
          excluded.splice(excluded.indexOf(id), 1);
          button.classList.replace('btn-success', 'btn-warning');
          button.textContent = 'Exclude';
        }
      });
      audited.append(row);
    }

    // What looks wrong with each sequence, as [{id, type}]: check(name) says
    // whether to look for each of the Audit tab's problems (empty, gaps, RNA,
    // amino-acids, CIGAR, malformed)
    function auditSequences(data, check) {
      const isGaps = /^-+$/;
      const isRNA = /^[ACGURYMKWSBDHVN-]+$/;
      const isAA = /^[ARNDCQEGHILKMFPSTWYVBZN]+$/;
      const isDNA = /^[ACGTRYMKWSBDHVN-]+$/;
      const isCIGAR = /^[0-9MIDNSHP=X]+$/;
      const isMalformed = /[^ACGTURYMKWSBDHVNQEILFPZX0-9-]+/;
      const found = [];
      const log = (id, type) => found.push({ id, type });
      // The length of most sequences, to find ones far from it
      const lengths = data.map(d => d.seq.replace(/-/g, '').length).sort((a, b) => a - b);
      const median = lengths[Math.floor(lengths.length / 2)];
      data.forEach(({ seq, id }) => {
        if (check('empty') && seq == '') log(id, 'empty');
        if (check('gaps') && isGaps.test(seq)) log(id, 'all gaps');
        if (check('RNA') && isRNA.test(seq) && !isGaps.test(seq) && /U/.test(seq)) log(id, 'RNA');
        if (check('amino-acids') && isAA.test(seq) && !isDNA.test(seq)) log(id, 'amino acids');
        if (check('CIGAR') && isCIGAR.test(seq)) log(id, 'a CIGAR');
        if (check('malformed') && isMalformed.test(seq)) log(id, 'malformed');
        if (check('length') && data.length >= 10 && seq && !isGaps.test(seq) && Math.abs(seq.replace(/-/g, '').length - median) > median * 0.2) log(id, 'an outlier in length (median ' + median.toLocaleString() + ')');
      });
      return found;
    }

    $('.audit-launcher').addEventListener('click', () => readFastas().then(data => {
      const start = Date.now();
      const check = name => modal.querySelector(`[name="audit-${name}"]`).checked;
      audited.innerHTML = '';
      auditSequences(data, check).forEach(({ id, type }) => logAudit(id, type));
      MT.time('Sequence Auditing', start);
    }));

    $('.audit-toggle-all').addEventListener('click', () => $$('.audit-exclude').forEach(b => b.click()));

    // The loading settings ----------------------------------------------------

    // A distance metric brings its own link threshold
    const thresholdInput = $('[data-setting="link-threshold"]');
    function applyMetric(resetThreshold) {
      const metric = get('default-distance-metric'), m = MT.distanceMetrics[metric];
      if (!m) return;
      const step = MT.thresholdStep(m);
      [thresholdInput, document.getElementById('link-threshold')].forEach(input => {
        if (!input) return;
        input.step = step;
        if (resetThreshold) input.value = m.threshold;
      });
      if (resetThreshold) settings.set('link-threshold', m.threshold);
    }
    const showAmbiguityRows = () => show($('.ambiguity-threshold-row'), get('ambiguity-resolution-strategy') == 'HIVTRACE-G');

    // The saved layout may not include this view yet (golden-layout saves it
    // shortly after each change)
    const setDefaultView = view => {
      const first = session.layout.content && session.layout.content[0];
      if (first) first.type = view;
    };

    // Generated sequences go in node files of up to about 200 million characters
    // each: one CSV of hundreds of thousands of sequences is longer than the
    // longest string a browser can hold (#301)
    // (Both the Generate button and the generate_sequences tool.) A count that
    // isn't a whole number from 1 to MT.maxGeneratedSequences is refused
    const generateCountError = count => Number.isInteger(count) && count >= 1 && count <= MT.maxGeneratedSequences ? null :
      `Generate makes from 1 to ${MT.maxGeneratedSequences.toLocaleString()} sequences. Enter a whole number in that range.`;
    const isGenerated = name => /^generatedNodes(-\d+)?\.csv$/.test(name);
    // [{name, contents}]: the generated sequences, a node file of CSV each
    const generatedFiles = count => {
      const nodes = MT.generateSeqs('gen-' + session.meta.readyTime + '-', count, 20);
      const perFile = Math.max(1, Math.floor(MT.generatedFileChars / ((nodes[0] ? nodes[0].seq.length : 0) + 50)));
      const files = Math.ceil(nodes.length / perFile);
      return Array.from({ length: files }, (_, i) => ({
        name: files == 1 ? 'generatedNodes.csv' : `generatedNodes-${i + 1}.csv`,
        contents: Papa.unparse(nodes.slice(i * perFile, (i + 1) * perFile))
      }));
    };

    $('.generate-number').max = MT.maxGeneratedSequences;
    $('.generate-sequences').addEventListener('click', () => {
      const count = number('.generate-number'), error = generateCountError(count);
      if (error) {
        MT.toast.error(error);
        $('.generate-number').focus();
        return;
      }
      ready();
      generatedFiles(count).forEach(f => processFile(new File([f.contents], f.name)));
      launchButton.focus();
    });

    // Autostashing is kept by the browser
    $$('input[name="stash-auto"]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) MT.setAutostash(input.value == 'true');
    }));
    db.getItem('stash-auto').then(autostash => {
      if (autostash == 'true') $('input[name="stash-auto"][value="true"]').click();
    });

    // Launching -----------------------------------------------------------------

    // The name as the user gave it: files from sessions saved before rawName existed only have the escaped name
    const shownName = file => file.rawName ?? file.name;

    // Log lines are plain text (file names included), so they are never parsed as HTML
    function message(msg) {
      session.messages.push(msg);
      // A line that starts a step (not a detail of one) is the dialog's progress text
      if (!msg.startsWith(' - ')) MT.progress(msg.replace(/\.+$/, ''));
      const information = document.getElementById('loading-information');
      information.replaceChildren();
      session.messages.forEach((text, i) => {
        if (i) information.appendChild(document.createElement('br'));
        information.appendChild(document.createTextNode(text));
      });
    }

    // Sequence length problems go in the log and in a warning
    function reportLengths(warnings) {
      warnings.forEach(w => { message(' - Warning: ' + w); MT.toast.warning(w, 20); });
    }

    // The loading dialog, opened before the load starts so that the progress has
    // somewhere to show. Resolves when it is shown, rejects if it is not within
    // MODAL_WAIT_MS.
    const openLoadingDialog = (loading, information) => new Promise((resolve, reject) => {
      loading.addEventListener('shown.bs.modal', () => {
        session.messages = [];
        information.innerHTML = '';
        resolve('done');
      }, { once: true });
      bootstrap.Modal.getOrCreateInstance(loading, { backdrop: false, keyboard: false }).show();
      setTimeout(() => reject(new Error('Problem loading information modal!')), MODAL_WAIT_MS);
    });

    launchButton.addEventListener('click', async () => {
      session.meta.startTime = Date.now();
      launchButton.disabled = true;
      MT.startWork();
      document.getElementById('loading-progress').hidden = true;
      const information = document.getElementById('loading-information');
      information.innerHTML = '<p>Processing file(s)...</p>';
      const loading = document.getElementById('loading-information-modal');
      const n = session.files.length;
      document.getElementById('loading-title').textContent = `Loading ${n} file${n == 1 ? '' : 's'}`;
      try {
        await openLoadingDialog(loading, information);
      } catch (error) { // the information dialog didn't open
        console.error(error);
        MT.toast.error('The information window did not open, so the files are loading anyway. If anything looks wrong, reload the page and try again.');
      }
      launch();
    });

    // What the load is doing, for the message when it fails (#222)
    let step = 'reading the files';

    // Whatever goes wrong in the load stops it with a message: the dialog is
    // closed and the user told what failed, not left to close it by hand.
    // (fail, below, is for one file; this is for anything else, such as a
    // worker that throws.)
    const loadFailed = error => {
      MT.progressDone();
      if (error && error.cancelled) return; // the user cancelled; the cancel said so
      const reason = (error && error.message) || error;
      console.error(error);
      const text = `The load failed while ${step}: ${MT.escape('' + reason)}.`;
      message(text);
      MT.toast.error(text, 20);
      clearTimeout(temp.messageTimeout);
      MT.hideModal('loading-information-modal');
      checkLaunch();
      MT.events.emit('session-load-failed', text);
    };

    // Whatever the load throws ends in loadFailed (a file that cannot be read has already said so, in fail)
    async function launch() {
      try {
        await load();
      } catch (error) {
        loadFailed(error);
      }
    }

    // Cancel stops the work (the workers are terminated), drops what the load
    // had read so far and goes back to the files, which stay listed. The dialog
    // has no Close: the work never goes on without it.
    document.getElementById('loading-cancel').addEventListener('click', () => {
      MT.cancelWork();
      clearTimeout(temp.messageTimeout);
      const reference = session.data.reference;
      session.data = MT.dataSkeleton();
      session.data.reference = reference;
      temp.tree = null;
      session.messages = [];
      MT.progressDone();
      MT.hideModal('loading-information-modal');
      checkLaunch();
      MT.toast.info('Loading was cancelled. Your files are still listed.', 8);
    });

    // The load, in the order it happens (#240): load() starts every file's parser
    // at once and waits for all of them, then reports what merged and processes
    // the sequences. Each kind of file has its own parser below. A parser returns
    // true when it is done and false when it has failed, having said so (in fail),
    // which stops the load without an error.

    // Says (in the log and a warning) how many links a file gave without a usable distance (#220)
    function reportDistances(file, noColumn, missing, bad, example) {
      const name = shownName(file);
      if (noColumn) {
        const text = `${name}: no distance column was chosen, so its ${noColumn.toLocaleString()} link${noColumn == 1 ? ' has' : 's have'} no distance and ${noColumn == 1 ? 'is' : 'are'} shown at any link threshold.`;
        message(' - ' + text);
        MT.toast.warning(text);
      }
      const parts = [];
      if (missing) parts.push(`${missing.toLocaleString()} link${missing == 1 ? ' has' : 's have'} an empty distance`);
      if (bad) parts.push(`${bad.toLocaleString()} distance${bad == 1 ? ' is' : 's are'} not numbers (for example "${MT.escape(example)}")`);
      if (!parts.length) return;
      message(` - ${name}: ${parts.join('; ')}. Such links are kept without a distance and are not shown by the link threshold.`);
      MT.toast.warning(`${name}: ${parts.join('; ')}. Such links are not shown by the link threshold; fix the values and load the file again.`);
    }

    // A file that cannot be read stops the load, with the reason (the dialog is not left up)
    function fail(file, kind, error) {
      if (error && error.cancelled) return; // the user cancelled; the cancel said so
      const reason = (error && error.message) || error;
      console.error(error);
      const text = `Could not read ${shownName(file)} as ${kind}: ${MT.escape('' + reason)}.`;
      message(text);
      MT.toast.error(text);
      clearTimeout(temp.messageTimeout);
      MT.progressDone();
      MT.hideModal('loading-information-modal');
      checkLaunch();
    }

    // Files are read in the order their kinds need, but where they disagree
    // about a node, the values of the file nearest the top of the list win
    const hierarchy = ['newick', 'matrix', 'link', 'node', 'fasta'];

    // ctx is what the files of one load share: whether to check for repeats, what
    // was merged, dropped or overwritten without a word (#219), the IDs from node
    // and sequence files (taken) and from files of links (linked), and idOf.
    async function parseFile(file, ctx) {
      const start = Date.now();
      const origin = [file.name];
      const source = session.data.sources.add(file.name, session.files.indexOf(file));

      // An empty file is said to be, not loaded as nothing (#222)
      const contents = file.contents;
      if (contents == null || (typeof contents === 'string' ? contents.trim() === '' : contents.byteLength === 0)) {
        fail(file, (formatByName(file.format) || {}).label || 'a network file', 'the file is empty');
        return false;
      }

      if (file.format == 'fasta') return parseFastaFile(file, ctx, origin, source, start);
      if (file.format == 'link') return parseLinkFile(file, ctx, origin, source, start);
      if (file.format == 'node') return parseNodeFile(file, ctx, origin, source, start);
      if (file.format == 'matrix') return parseMatrixFile(file, ctx, origin, source);
      return parseNewickFile(file, ctx, origin, source, start);
    }

    // The parsers below read a file with its format module (src/formats), which gives
    // plain data, and merge what it gives into the session: the side effects, and the
    // messages, are here (#337).

    // A file's repeated and blank IDs are counted for the report, and the IDs it gave
    // are those the links are checked against (#219)
    function tallyIds(ctx, parsed) {
      ctx.report.duplicates += parsed.duplicates;
      ctx.report.blanks += parsed.blanks;
      parsed.ids.forEach(id => ctx.taken.add(id));
    }

    async function parseFastaFile(file, ctx, origin, source, start) {
      message(`Parsing ${shownName(file)} as FASTA...`);
      let newNodes = 0;
      try {
        // The sequences are read in a worker; what to make of them is the format's
        const sequences = await MT.parseFASTA(file.contents);
        const parsed = formatByName('fasta').parse(file.contents, { sequences, origin });
        if (parsed.problem) {
          fail(file, 'FASTA', parsed.problem);
          return false;
        }
        parsed.nodes.forEach(node => { newNodes += MT.addNode(node, ctx.check, source); });
        tallyIds(ctx, parsed);
        MT.time('FASTA Merge', start);
        message(` - Parsed ${newNodes} New, ${parsed.total} Total Nodes from FASTA.`);
        return true;
      } catch (error) {
        fail(file, 'FASTA', error);
        return false;
      }
    }

    async function parseLinkFile(file, ctx, origin, source, start) {
      message(`Parsing ${shownName(file)} as Link List...`);
      const metric = get('default-distance-metric');
      if (!session.data.linkFields.includes(metric)) session.data.linkFields.push(metric);
      const sheet = file.extension == 'xls' || file.extension == 'xlsx';
      const options = { field1: file.field1, field2: file.field2, field3: file.field3, metric, origin, delimiter: file.delimiter, sheet };
      const linkFormat = formatByName('link');

      const mergeLinks = parsed => {
        let l = 0;
        parsed.fields.forEach(key => { if (!session.data.linkFields.includes(key)) session.data.linkFields.push(key); });
        ctx.report.blanks += parsed.blanks;
        parsed.links.forEach(link => {
          const { source, target } = link;
          const added = MT.addLink(link, ctx.check);
          l += added;
          if (!added) ctx.report[source == target ? 'selfLinks' : 'repeatedLinks']++;
          ctx.linked.add(source).add(target);
        });
        return l;
      };
      const mergeNodes = parsed => parsed.nodes.reduce((count, node) => count + MT.addNode(node, true, source), 0);

      if (sheet) {
        const parsed = linkFormat.parse(file.contents, options);
        const l = mergeLinks(parsed);
        message(` - Parsed ${l} New, ${parsed.total} Total Links from Link Excel Table.`);
        reportDistances(file, parsed.noColumn, parsed.missing, parsed.bad, parsed.badExample);
        const n = mergeNodes(parsed);
        MT.time('Link Excel Parse', start);
        message(` - Parsed ${n} New, ${parsed.nodes.length} Total Nodes from Link Excel Table.`);
        return true;
      }

      try {
        // The text is parsed in a worker, so a large list does not freeze the page
        const results = await MT.runWorker('workers/parse-links.js', { text: file.contents, delimiter: file.delimiter, field1: file.field1, field2: file.field2 }, { name: 'The link list parser' });
        const parsed = linkFormat.parse(file.contents, Object.assign(options, { rows: results.rows, fields: results.fields }));
        const l = mergeLinks(parsed);
        message(` - Parsed ${l} New, ${parsed.total} Total Links from Link CSV.`);
        reportDistances(file, parsed.noColumn, parsed.missing, parsed.bad, parsed.badExample);
        const newNodes = mergeNodes(parsed);
        MT.time('Link CSV Parse', start);
        message(` - Parsed ${newNodes} New, ${parsed.nodes.length} Total Nodes from Link CSV.`);
        return true;
      } catch (error) {
        fail(file, 'a link list', error);
        return false;
      }
    }

    async function parseNodeFile(file, ctx, origin, source, start) {
      message(`Parsing ${shownName(file)} as Node List...`);
      const sheet = file.extension == 'xls' || file.extension == 'xlsx';
      const parsed = formatByName('node').parse(file.contents, { field1: file.field1, field2: file.field2, delimiter: file.delimiter, origin, sheet });
      // A CSV used to be read through a promise, so the other files' parsers got to
      // start before this one went on; their messages stay in the order of the list
      if (!sheet) await null;
      let m = 0;
      // (The columns chosen as the ID and sequence are not among the fields)
      MT.addNodeField(...parsed.fields);
      parsed.nodes.forEach(node => { m += MT.addNode(node, ctx.check, source); });
      tallyIds(ctx, parsed);
      MT.time(sheet ? 'Node Excel Parse' : 'Node CSV Parse', start);
      message(` - Parsed ${m} New, ${parsed.total} Total Nodes from Node ${sheet ? 'Excel Table' : 'CSV'}.`);
      return true;
    }

    async function parseMatrixFile(file, ctx, origin, source) {
      message(`Parsing ${shownName(file)} as Distance Matrix...`);

      // Excel sheets are read as CSV text by the same parser as CSV files, which
      // finds the shape (square, or either triangle) from the first row
      let matrixFile = file, nodeOrigin;
      if (file.extension == 'xls' || file.extension == 'xlsx') {
        try {
          matrixFile = Object.assign({}, file, { contents: formatByName('matrix').toText(file.contents) });
          nodeOrigin = origin;
        } catch (error) {
          fail(file, 'a distance matrix', error);
          return false;
        }
      }
      let o;
      try {
        o = await MT.parseCSVMatrix(matrixFile, source, nodeOrigin);
      } catch (error) { // (only the parse is caught: a throw below fails the whole load)
        fail(file, 'a distance matrix', error);
        return false;
      }
      o.ids.forEach(id => ctx.linked.add(MT.cleanID(id)));
      message(` - Parsed ${o.nn} New, ${o.tn} Total Nodes from Distance Matrix.`);
      message(` - Parsed ${o.nl} New, ${o.tl} Total Links from Distance Matrix.`);
      if (o.unparseable) {
        const text = `${shownName(file)}: ${o.unparseable.toLocaleString()} matrix cell${o.unparseable == 1 ? ' is' : 's are'} not numbers (for example "${MT.escape(o.example)}") and ${o.unparseable == 1 ? 'was' : 'were'} skipped.`;
        message(' - ' + text);
        MT.toast.warning(text);
      }
      return true;
    }

    // (A tree is parsed in place, so this is async only to match the others)
    async function parseNewickFile(file, ctx, origin, source, start) {
      const metric = get('default-distance-metric');
      if (!session.data.linkFields.includes(metric)) session.data.linkFields.push(metric);
      let newLinks = 0;
      let newNodes = 0;
      const parsed = formatByName('newick').parse(file.contents, { origin, metric });
      temp.tree = parsed.tree;
      // Each node is added before its links, as the pairs are met
      parsed.nodes.forEach((node, i) => {
        // The node's provenance is the tree file, not its label: a label there made
        // a tree loaded with a FASTA fail on their shared IDs
        newNodes += MT.addNode(node, ctx.check, source);
        parsed.links.slice(i * (i - 1) / 2, i * (i + 1) / 2).forEach(link => { newLinks += MT.addLink(link, ctx.check); });
      });
      MT.time('Newick Tree Parse', start);
      message(` - Parsed ${newNodes} New, ${parsed.labels.length} Total Nodes from Newick Tree.`);
      message(` - Parsed ${newLinks} New, ${parsed.links.length} Total Links from Newick Tree.`);
      parsed.labels.forEach(id => ctx.linked.add(MT.cleanID(id)));
      return true;
    }

    async function load() {
      step = 'reading the files';
      MT.progress('Reading the files');
      temp.messageTimeout = setTimeout(() => {
        MT.toast.info('Still working. Large sets of sequences can take several minutes to align and compare. Cancel in the loading dialog stops the work and keeps your files listed.', 15);
      }, STILL_WORKING_MS);

      const files = session.files.slice().sort((a, b) => hierarchy.indexOf(a.format) - hierarchy.indexOf(b.format));
      session.data.sources.reset();

      session.meta.anySequences = session.files.some(file => (file.format == "fasta") || (file.format == "node" && file.field2 !== "None"));

      const report = { duplicates: 0, blanks: 0, selfLinks: 0, repeatedLinks: 0 };
      const ctx = {
        check: session.files.length > 1,
        report,
        taken: new Set(), linked: new Set(),
        // A node's ID as it is kept; a repeat within its file is counted, and a blank one is not a node
        idOf: (value, seen) => {
          const id = MT.cleanID(value);
          if (id == '') { report.blanks++; return null; }
          if (seen.has(id)) report.duplicates++;
          seen.add(id);
          return id;
        }
      };

      // Parsers finish in any order (FASTA and matrix parsing is asynchronous), so
      // processing waits for every file, not for the last one in the list (#212).
      // Each parser runs up to its first wait before the next one starts, which
      // keeps the files' messages in the order of the list. A parser that throws
      // fails the load only once the others have settled, so none of them is still
      // merging into the session after the user is told the load failed (#240).
      const settled = await Promise.allSettled(files.map(file => parseFile(file, ctx)));
      const thrown = settled.find(result => result.status === 'rejected');
      if (thrown) throw thrown.reason;
      if (settled.some(result => result.value === false)) return; // a file failed and said so
      if (MT.workCancelled()) throw Object.assign(new Error('it was cancelled'), { cancelled: true });
      reportMerges(ctx);
      return processSequences();
    }

    // Merged, dropped and overwritten rows are said, not silent (#219)
    function reportMerges({ report, taken, linked }) {
      const unmatched = taken.size ? Array.from(linked).filter(id => !taken.has(id)).length : 0;
      const plural = (n, one, many) => n.toLocaleString() + ' ' + (n == 1 ? one : many);
      const notes = [];
      if (report.duplicates) notes.push(`${plural(report.duplicates, 'repeated ID was', 'repeated IDs were')} merged into the node with the same ID (the first row's values are kept, and later rows fill in its blanks)`);
      if (report.blanks) notes.push(`${plural(report.blanks, 'row with a blank ID was', 'rows with a blank ID were')} skipped`);
      if (report.selfLinks) notes.push(`${plural(report.selfLinks, 'link from a node to itself was', 'links from a node to itself were')} dropped`);
      if (report.repeatedLinks) notes.push(`${plural(report.repeatedLinks, 'link repeated', 'links repeated')} a pair of nodes already linked (in either direction), so overwrote its values`);
      if (unmatched) notes.push(`${plural(unmatched, 'node in the links is', 'nodes in the links are')} not in the node or sequence files`);
      notes.forEach(note => message(' - ' + note[0].toUpperCase() + note.slice(1) + '.'));
      if (notes.length) MT.toast.warning(notes.map(note => note[0].toUpperCase() + note.slice(1)).join('. ') + '. See the loading log for details.', 15);
    }

    // Sets the reference the sequences are aligned to, from the chosen source
    async function chooseReference(subset) {
      const source = referenceSource();
      if (source == 'consensus') {
        message('Building a consensus reference from the sequences...');
        step = 'building the consensus reference';
        MT.progress('Building a consensus reference');
        session.data.reference = await MT.consensusReference(subset, alignerScoring());
      } else if (source == 'first') {
        session.data.reference = subset.length ? subset[0].seq : '';
      }
      if (!session.data.reference) {
        throw new Error(source == 'file' ?
          'no reference sequence was loaded: load one from a FASTA file, or use the consensus or the first sequence as the reference' :
          'no reference sequence could be made from the sequences');
      }
    }

    async function processSequences() {
      if (!session.data.nodes.length) throw new Error('no nodes were found in the files (are they empty, or the wrong kind of file?)');
      // Where files disagree about nodes, say so (the top file's values are used)
      const differ = Array.from(MT.nodeConflicts().values()).reduce((n, ids) => n + ids.length, 0);
      if (differ) message(` - ${differ.toLocaleString()} node value${differ == 1 ? '' : 's'} differ between files; the top file's are used.`);
      if (!session.meta.anySequences) return MT.runHamsters();
      MT.addNodeField('seq');
      const nodes = session.data.nodes;
      const subset = nodes.filter(d => d.seq);
      const align = session.style.widgets['align-sw'];
      if (align) await chooseReference(subset);
      // Nodes without a sequence get only gaps, as long as the aligned
      // sequences (the reference) or, unaligned, the longest sequence
      let width = 0;
      if (align) width = session.data.reference.length;
      else for (const d of subset) if (d.seq.length > width) width = d.seq.length;
      const gapString = '-'.repeat(width);
      for (const d of nodes) if (!d.seq) d.seq = gapString;
      if (align){
        message('Aligning Sequences...');
        step = 'aligning the sequences';
        let output = await MT.align({
          reference: session.data.reference,
          isLocal: false,
          ...alignerScoring(),
          nodes: subset
        });
        const start = Date.now();
        const m = subset.length;
        for (let j = 0; j < m; j++) {
          Object.assign(subset[j], output[j]);
        }
        MT.time('Alignment Merge', start);
        reportLengths(MT.lengthWarnings(output.fit));
      } else {
        reportLengths(MT.lengthWarnings(null, subset.map(d => d.seq.length)));
      }
      // Nodes without a sequence hold only gaps; they are left out of the consensus
      step = 'computing the consensus sequence';
      MT.progress('Computing the consensus sequence');
      session.data.consensus = await MT.computeConsensus(subset);
      await MT.computeConsensusDistances();
      subset.sort((a, b) => a['_diff'] - b['_diff']);
      if(session.style.widgets['ambiguity-resolution-strategy']){
        await MT.computeAmbiguityCounts();
      }
      message('Computing Links based on Genomic Proximity...');
      step = 'computing the links';
      MT.progress('Computing distances');
      const k = await MT.computeLinks(subset);
      // Every pair has a distance; the network shows those within the threshold
      const threshold = parseFloat(session.style.widgets['link-threshold']);
      let within = 0;
      session.data.graph.forEachValue(get('default-distance-metric'), v => { if (v <= threshold) within++; });
      message(` - Computed ${k.toLocaleString()} distances between sequences; ${within.toLocaleString()} links are within the link threshold (${threshold}).`);
      const also = MT.computedMetrics().slice(1);
      if (also.length) message(` - Also computed ${also.map(m => MT.distanceMetrics[m].label).join(', ')}, to filter links on in Settings.`);
      step = 'drawing the network';
      MT.progress('Drawing the network');
      return MT.runHamsters();
    }

    // Other metrics to compute too: any but the distance metric
    const alsoMenu = MT.multiSelect($('#distance-metrics-also'));
    const showAlso = () => {
      const metric = get('default-distance-metric');
      const chosen = (get('distance-metrics-also') || []).filter(m => m != metric && MT.distanceMetrics[m]);
      alsoMenu.clear(true);
      alsoMenu.clearOptions();
      alsoMenu.addOptions(Array.from($('#default-distance-metric').options)
        .filter(o => o.value != metric)
        .map(o => ({ value: o.value, text: o.text })));
      alsoMenu.setValue(chosen, true);
      // (Rebuilding a focused menu opens it)
      alsoMenu.close();
    };
    alsoMenu.on('change', () => {
      const chosen = alsoMenu.getValue();
      settings.set('distance-metrics-also', chosen);
      db.setItem('distance-metrics-also', chosen);
    });

    // The metric menu shows short names; its tooltip, the chosen one's full name
    const metricMenu = $('#default-distance-metric');
    const showMetricName = () => {
      const option = metricMenu.selectedOptions[0];
      metricMenu.title = option ? option.title || option.text : '';
      // Visible help, not only the tooltip (#272)
      const help = MT.metricHelp[get('default-distance-metric')];
      $('#distance-metric-help').textContent = help ? help[0] : '';
      $('#default-distance-threshold-unit').textContent = help ? 'In ' + help[1] + '. Same setting as Link Threshold in Settings.' : '';
    };
    const AMBIGUITY_HELP = {
      AVERAGE: 'Ambiguous bases (N, R, Y...) count as the average over every base they could be.',
      RESOLVE: 'Ambiguous bases are taken as whichever base they could be that matches the other sequence.',
      SKIP: 'Sites with an ambiguous base are left out of the comparison.',
      GAPMM: 'Like Average, but a gap facing a base counts as an N, so mostly as a mismatch (the original MicrobeTrace way).',
      'HIVTRACE-G': 'As HIV-TRACE does: resolve ambiguities, unless too many sites in a pair are ambiguous (see Ambiguity Threshold), then average.'
    };
    const showAmbiguityHelp = () => { $('#ambiguity-help').textContent = AMBIGUITY_HELP[get('ambiguity-resolution-strategy')] || ''; };

    MT.paneToggle($('.settings-toggle'), pane, false, { push: [$('.file-panel'), $('.file-footer')] });
    const stop = [
      MTBind(pane, settings),
      MTBind(modal, settings),
      settings.subscribe('default-distance-metric', metric => {
        db.setItem('default-distance-metric', metric);
        // Links are filtered on the distance metric's values
        settings.set('link-sort-variable', metric);
        applyMetric(true);
        showMetricName();
        showAlso();
      }),
      settings.subscribe('ambiguity-resolution-strategy', () => {
        showAmbiguityHelp();
        showAmbiguityRows();
      }),
      settings.subscribe('default-view', view => {
        db.setItem('default-view', view);
        setDefaultView(view);
      }),
      settings.subscribe('align-sw', () => {
        settings.set('align-none', !get('align-sw'));
        showAlignmentRows();
        preview.innerHTML = '';
      })
    ];
    applyMetric(false);
    showMetricName();
    showAmbiguityHelp();
    showAlso();
    showAmbiguityRows();
    showAlignmentRows();
    db.getItem('default-distance-metric').then(cached => {
      if (cached && MT.distanceMetrics[cached]) settings.set('default-distance-metric', cached);
    });
    db.getItem('distance-metrics-also').then(cached => {
      if (!Array.isArray(cached)) return;
      settings.set('distance-metrics-also', cached.filter(m => MT.distanceMetrics[m]));
      showAlso();
    });
    db.getItem('default-view').then(cached => {
      const view = MT.viewName(cached || get('default-view'));
      settings.set('default-view', view);
      setDefaultView(view);
    });

    stop.push(() => MT.sortable(table, 'destroy'), () => alsoMenu.destroy());

    // A programmatic way to do what the view does, for scripts and agents (see
    // src/webmcp/session/). It goes with the view.
    const named = name => session.files.find(f => f.name == name);
    const describe = file => {
      const row = rowOf.get(file);
      const problem = row && problems.has(row) ? problems.get(row)() : '';
      return {
        name: file.name,
        extension: file.extension,
        format: file.format,
        field1: file.field1, field2: file.field2, field3: file.field3,
        headers: (headersOf.get(file) || []).slice(),
        problem: problem || null
      };
    };
    const api = {
      // Adds a file ({name, contents, extension?, format?, field1?, field2?,
      // field3?}) as the view does, returning its description
      add(file) {
        file = Object.assign({}, file);
        file.rawName = file.name; // for the loading log, which shows text
        file.name = MT.escape(file.name);
        file.extension = (file.extension || file.name.split('.').pop()).toLowerCase();
        ready();
        session.files.push(file);
        addToTable(file);
        return describe(file);
      },
      remove(name) {
        const file = named(name), row = file && rowOf.get(file);
        if (!row) return false;
        row.querySelector('a[title="Remove this file"]').click();
        return true;
      },
      // Changes how a pending file is read: {format, field1, field2, field3}
      update(name, changes) {
        const file = named(name), row = file && rowOf.get(file);
        if (!row) return null;
        if (changes.format && changes.format != file.format) {
          const radio = row.querySelector(`input[type="radio"][value="${changes.format}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        const selects = row.querySelectorAll('.file-field select');
        [changes.field1, changes.field2, changes.field3].forEach((value, i) => {
          if (value === undefined) return;
          selects[i].value = value;
          selects[i].dispatchEvent(new Event('change', { bubbles: true }));
        });
        return describe(file);
      },
      // Puts the named files first, in this order (the others follow, as they were)
      reorder(names) {
        const listed = names.map(named).filter(Boolean);
        const order = listed.concat(session.files.filter(f => !listed.includes(f)));
        order.forEach(f => { const row = rowOf.get(f); if (row) table.append(row); });
        MT.sortable(table, 'reload');
        session.files.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return session.files.map(describe);
      },
      list: () => session.files.map(describe),
      // What keeps Launch disabled, by file
      problems: () => session.files.map(describe).filter(d => d.problem).map(d => ({ name: d.name, problem: d.problem })),
      canLaunch() { checkLaunch(); return !launchButton.disabled; },
      // Same as clicking Launch (the load chooses the reference)
      async launch() {
        checkLaunch();
        if (launchButton.disabled) return false;
        launchButton.click();
        return true;
      },
      // Adds generated random sequences as the Generate button does (in several
      // files if there are many), replacing those generated before; throws a
      // count the button refuses
      generate(count) {
        const error = generateCountError(count);
        if (error) throw new Error(error);
        session.files.filter(f => isGenerated(f.rawName || f.name)).forEach(f => api.remove(f.name));
        return generatedFiles(count).map(f => api.add({ name: f.name, extension: 'csv', contents: f.contents }));
      },
      // The audit's findings for [{id, seq}], given {empty, gaps, RNA, 'amino-acids', CIGAR, malformed} (each on unless false)
      auditSequences: (data, checks) => auditSequences(data, name => checks[name] !== false),
      readFastas,
      // The alignment scores {match, mismatch, gapOpen, gapExtend, band}, after setting any given (band null: no band)
      aligner(values) {
        Object.keys(alignerInputs).forEach(k => { if (values && values[k] !== undefined) $(alignerInputs[k]).value = values[k]; });
        // A blank band is NaN, which JSON (the agent's answer) would turn into null anyway
        const costs = alignerCosts();
        if (!Number.isFinite(costs.band)) costs.band = null;
        return costs;
      },
      // Redraws the controls that follow other settings, after those were set
      refresh() {
        showMetricName();
        showAmbiguityHelp();
        showAlso();
        showAmbiguityRows();
        showAlignmentRows();
        $$('input[name="reference-source"]').forEach(input => {
          input.checked = input.value == referenceSource();
          input.closest('.btn').classList.toggle('active', input.checked);
        });
      }
    };
    MT.filesView = api;
    return {
      destroy: () => {
        if (MT.filesView === api) MT.filesView = undefined;
        stop.forEach(fn => fn());
      }
    };
  });
