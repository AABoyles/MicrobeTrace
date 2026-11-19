  MT.registerView('aggregation', (root, { events }) => {

    const $ = selector => root.querySelector(selector);
    const grid = $('.aggregation-grid'), list = $('.aggregation-variables');
    // One Tabulator per variable, and the counts they show (for export)
    let tables = [], data = [];

    const datasets = { node: 'nodeFields', link: 'linkFields', cluster: 'clusterFields' };
    const fill = (select, value) => Object.entries(datasets).forEach(([dataset, fields], i) =>
      MT.fillSelect(select, session.data[fields], { prefix: dataset + ' ', label: MT.titleize(dataset) + ' ', selected: value, append: i > 0 }));

    function addVariable(value) {
      const item = document.createElement('li');
      item.className = 'd-inline-flex aggregation-items';
      item.innerHTML = `<span class="bi bi-x pt-2 aggregation-remove" title="Remove this table"></span>
        <select class="flex-grow-1 form-select form-select-sm aggregation-variable" aria-label="Table variable"></select>
        <span class="pt-2 bi bi-grip-vertical" title="Drag to reorder"></span>`;
      fill(item.querySelector('select'), value);
      list.appendChild(item);
      MT.sortable(list, 'reload');
    }

    // How many of the visible items have each value of a variable
    function count(dataset, column) {
      const items = MT['getVisible' + dataset[0].toUpperCase() + dataset.slice(1) + 's']();
      const counts = new Map();
      items.forEach(d => {
        const value = MT.valueLabel(d[column]) == '(Empty)' ? '(Empty)' : d[column];
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      // Most common first (ties in the values' order), each a share to one decimal
      const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
      return Array.from(counts, ([value, n]) => ({ [column]: value, n, percent: (n / items.length * 100).toFixed(1) + '%' }))
        .sort((a, b) => b.n - a.n || natural(a[column], b[column]));
    }

    function update() {
      tables.forEach(table => table.destroy());
      grid.innerHTML = '';
      tables = [];
      data = Array.from(list.querySelectorAll('select'), select => {
        const [dataset, ...rest] = select.value.split(' ');
        const column = rest.join(' ');
        const rows = count(dataset, column);
        const element = document.createElement('div');
        element.className = 'aggregation-tables table-sm';
        grid.appendChild(element);
        tables.push(MT.table(element, {
          layout: 'fitColumns',
          columns: [
            // A natural sort, so numbers (cluster IDs, say) don't sort as text
            MT.columnTitle(MT.titleize(dataset) + ' ' + MT.titleize(column), { field: column, sorter: 'alphanum' }),
            { title: `Number of ${MT.titleize(dataset)}s`, field: 'n', sorter: 'number', hozAlign: 'right', headerHozAlign: 'right' },
            { title: 'Percentage', field: 'percent', headerSort: false, hozAlign: 'right', headerHozAlign: 'right' }
          ],
          data: rows,
          // One sort, by the count (rows come in that order already)
          initialSort: [{ column: 'n', dir: 'desc' }]
        }));
        return { dataset, column, data: rows };
      });
    }

    $('.aggregation-add-variable').addEventListener('click', () => {
      addVariable('node cluster');
      update();
    });
    list.addEventListener('change', update);
    list.addEventListener('click', e => {
      if (!e.target.classList.contains('aggregation-remove')) return;
      e.target.closest('li').remove();
      update();
    });
    MT.sortable(list, { forcePlaceholderSize: true });
    list.addEventListener('sortupdate', update);

    MT.paneToggle($('.settings-toggle'), $('.left-pane'), false, { beside: $('.aggregation-grid'), resize: () => tables.forEach(table => table.redraw()) });

    const title = t => MT.titleize(t.dataset) + ' ' + MT.titleize(t.column);
    MT.tableExport(root, {
      'csv.zip': name => {
        const zip = new JSZip();
        data.forEach(t => zip.file(t.dataset + '_' + t.column + '.csv', MT.toCSV(t.data)));
        zip.generateAsync({ type: 'blob' }).then(content => MT.saveAs(content, name + '.zip'));
      },
      xlsx: name => {
        const workbook = XLSX.utils.book_new();
        // Sheet names must be unique and at most 31 characters
        data.forEach((t, i) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(t.data), (i + 1) + ' ' + title(t).slice(0, 27)));
        XLSX.writeFile(workbook, name + '.xlsx');
      },
      pdf: name => MT.tablesPDF('Aggregation', data.map(t => ({
        headers: [title(t), `Number of ${MT.titleize(t.dataset)}s`, 'Percentage'],
        rows: t.data.map(row => [row[t.column] + '', row.n + '', row.percent])
      })), name),
      json: name => MT.exportBlob(JSON.stringify(data), 'application/json', name + '.json')
    });

    root.style.overflowY = 'scroll';

    addVariable('node cluster');
    update();
    const stop = ['link-visibility', 'node-visibility'].map(type => events.on(type, update));

    return {
      resize: () => tables.forEach(table => table.redraw()),
      destroy() {
        stop.forEach(fn => fn());
        MT.sortable(list, 'destroy');
        tables.forEach(table => table.destroy());
      }
    };
  });
