  MT.registerView('table', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const grid = $('.table-grid');
    const columnsSelect = $('.table-columns');
    // Bookkeeping fields that aren't worth a column
    const hidden = ['selected', 'visible', 'nn'];
    let dataset = 'nodes', columnsMenu;

    const highlight = row => {
      row.getElement().style.background = row.getData().selected ? settings.get('selected-color') : '';
    };
    // Columns as wide as their contents, the last taking what's left
    const table = MT.table(grid, {
      maxHeight: '100%',
      layout: 'fitDataStretch',
      data: [],
      columns: [],
      rowFormatter: highlight
    });
    const built = new Promise(resolve => table.on('tableBuilt', resolve));

    // Clicking a row selects it (or deselects it), keeping selected rows on top
    table.on('rowClick', (e, row) => {
      const item = row.getData();
      item.selected = !item.selected;
      highlight(row);
      if (item.selected) row.freeze();
      else row.unfreeze();
      events.emit('node-selected', 'table');
    });

    function showColumns() {
      const fields = session.data[dataset.slice(0, -1) + 'Fields'].filter(f => !hidden.includes(f));
      if (columnsMenu) columnsMenu.destroy();
      // The first five, less the internal counter (still there to choose), and
      // for links, the field they're filtered on after their ends
      let order = fields.filter(f => f != 'index');
      const filtered = settings.get('link-sort-variable');
      if (dataset == 'links' && order.includes(filtered)) {
        const rest = order.filter(f => f != filtered);
        order = [...rest.slice(0, 2), filtered, ...rest.slice(2)];
      }
      const shown = order.slice(0, 5);
      MT.fillSelect(columnsSelect, fields, { selected: shown });
      columnsMenu = MT.multiSelect(columnsSelect);
      columnsMenu.on('change', showData);
    }

    // A cell's value as text, lists (like a node's files) joined with commas
    const listed = cell => {
      const value = cell.getValue();
      return document.createTextNode(Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value));
    };

    // Every node and cluster, but only the links that are visible: the full
    // set includes every computed distance (n² of them).
    const items = () => dataset == 'links' ? MT.getVisibleLinks() : session.data[dataset];

    async function showData() {
      await built;
      // In the order they were chosen
      const columns = columnsMenu.getValue();
      table.setColumns(columns.map(c => MT.columnTitle(MT.titleize(c), { field: c, formatter: listed })));
      await table.replaceData(items());
      table.getRows().forEach(row => { if (row.getData().selected) row.freeze(); });
    }

    // Selections and colors changed elsewhere
    function restyle() {
      table.getRows().forEach(row => {
        highlight(row);
        if (row.getData().selected) row.freeze();
        else if (row.isFrozen()) row.unfreeze();
      });
    }

    root.querySelectorAll('[name="table-dataset"]').forEach(input => input.addEventListener('change', () => {
      if (!input.checked) return;
      dataset = input.value;
      showColumns();
      showData();
    }));

    const fontSize = $('.table-font-size');
    // It starts at the size the text is
    fontSize.value = Math.round(parseFloat(getComputedStyle(grid).fontSize)) || fontSize.value;
    fontSize.addEventListener('input', () => {
      grid.style.fontSize = fontSize.value + 'px';
      grid.style.lineHeight = fontSize.value / 10;
    });


    // Exports every row shown, with all its fields, not just the columns shown
    const rows = () => items();
    MT.tableExport(root, {
      csv: name => MT.exportBlob(MT.toCSV(rows()), 'text/csv', name + '.csv'),
      xlsx: name => {
        const headers = session.data[dataset.slice(0, -1) + 'Fields'];
        const data = rows().map(item => {
          const row = {};
          headers.forEach(field => {
            if (field in item) row[field] = Array.isArray(item[field]) ? item[field].join('; ') : item[field];
          });
          return row;
        });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), MT.titleize(dataset));
        XLSX.writeFile(workbook, name + '.xlsx');
      },
      json: name => MT.exportBlob(JSON.stringify(rows()), 'application/json', name + '.json')
    });


    // The toolbar grows when the chosen columns wrap onto more lines: keep the
    // table below it
    const controls = $('.view-controls');
    const belowControls = new ResizeObserver(() => {
      const top = controls.offsetTop + controls.offsetHeight + 8;
      if (grid.style.paddingTop == top + 'px') return;
      grid.style.paddingTop = top + 'px';
      built.then(() => table.redraw());
    });
    belowControls.observe(controls);

    const stop = [
      events.on('link-visibility', showData),
      events.on('node-values-change', () => { if (dataset == 'nodes') showData(); }),
      events.on('node-selected', view => { if (view != 'table') restyle(); }),
      events.on('selected-color-change', restyle)
    ];
    showColumns();
    showData();

    return {
      resize: () => table.redraw(),
      destroy() {
        stop.forEach(fn => fn());
        belowControls.disconnect();
        if (columnsMenu) columnsMenu.destroy();
        table.destroy();
      }
    };
  });
