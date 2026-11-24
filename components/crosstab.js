// The crosstab view, loaded as an ES module by src/views.js (#339). Library globals (XLSX) stay globals; MT and the session come from ctx.
export const libraries = ['table'];

export function mount(root, ctx) {
  const { MT, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const fieldX = $('.crosstab-x'), fieldY = $('.crosstab-y');
  // data: a row per Y value; headers and rows: the same for export
  let dataset = 'nodes', data = [], headers = [], rows = [], chosen = false;

  const table = MT.table($('.crosstab-grid'), { layout: 'fitColumns', data: [], columns: [] });
  const built = new Promise(resolve => table.on('tableBuilt', resolve));

  const items = () => MT['getVisible' + dataset[0].toUpperCase() + dataset.slice(1)]();

  // The menus offer the dataset's fields, starting on its first two
  // categorical fields. Without any, the table waits for a choice.
  function showFields() {
    const fields = ctx.session.data[dataset.slice(0, -1) + 'Fields'];
    MT.fillSelect(fieldX, fields);
    MT.fillSelect(fieldY, fields);
    const [x, y = x] = MT.categoricalFields(items(), fields);
    chosen = !!x;
    if (chosen) [fieldX.value, fieldY.value] = [x, y];
  }

  // Values in natural order (2 before 10), missing ones last
  const missing = v => MT.valueLabel(v) === '(Empty)';
  const natural = (a, b) => (missing(a) - missing(b)) || a.localeCompare(b, undefined, { numeric: true });

  // One row per Y value, headed by the Y variable, and one column per X value,
  // under a heading naming the X variable, counting the visible items. The
  // columns are v0, v1… (a value, with a dot say, may not be a usable field).
  async function update() {
    if (!chosen) {
      data = headers = rows = [];
      await built;
      table.setColumns([]);
      table.replaceData([]);
      return;
    }
    const xVar = fieldX.value, yVar = fieldY.value;
    const visible = items();
    const xValues = Array.from(new Set(visible.map(d => String(d[xVar])))).sort(natural);
    const column = new Map(xValues.map((x, i) => [x, 'v' + i]));
    const byY = new Map();
    visible.forEach(d => {
      const y = String(d[yVar]);
      if (!byY.has(y)) {
        const row = { col: MT.valueLabel(y) };
        xValues.forEach((x, i) => row['v' + i] = 0);
        byY.set(y, row);
      }
      byY.get(y)[column.get(String(d[xVar]))]++;
    });
    data = Array.from(byY.keys()).sort(natural).map(y => byY.get(y));
    headers = [MT.titleize(yVar)].concat(xValues.map(MT.valueLabel));
    rows = data.map(row => [row.col].concat(xValues.map((x, i) => row['v' + i])));
    await built;
    table.setColumns([
      MT.columnTitle(MT.titleize(yVar), { field: 'col', cssClass: 'fw-bold', sorter: 'alphanum' }),
      MT.columnTitle(MT.titleize(xVar), { columns: xValues.map((x, i) => MT.columnTitle(MT.valueLabel(x), { field: 'v' + i })) })
    ]);
    table.replaceData(data);
  }

  root.querySelectorAll('[name="crosstab-dataset"]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    dataset = input.value;
    showFields();
    update();
  }));
  [fieldX, fieldY].forEach(select => select.addEventListener('change', () => {
    chosen = true;
    update();
  }));
  $('.crosstab-pivot').addEventListener('click', () => {
    [fieldX.value, fieldY.value] = [fieldY.value, fieldX.value];
    update();
  });

  showFields();
  // The settings start open when there's nothing to show until a choice
  MT.paneToggle($('.settings-toggle'), $('.left-pane'), !chosen, { beside: $('.crosstab-grid'), resize: () => table.redraw() });

  const title = () => MT.titleize(fieldX.value) + ' by ' + MT.titleize(fieldY.value);
  MT.tableExport(root, {
    csv: name => MT.exportBlob(MT.toCSV({ fields: headers, data: rows }), 'text/csv', name + '.csv'),
    xlsx: async name => {
      await MT.loadLibrary('xlsx');
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers].concat(rows)), title().slice(0, 31));
      XLSX.writeFile(workbook, name + '.xlsx');
    },
    json: name => {
      const objects = rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
      MT.exportBlob(JSON.stringify(objects), 'application/json', name + '.json');
    }
  });


  update();
  const stop = ['link-visibility', 'node-visibility'].map(type => events.on(type, update));

  return {
    resize: () => table.redraw(),
    destroy() {
      stop.forEach(fn => fn());
      table.destroy();
    }
  };
}
