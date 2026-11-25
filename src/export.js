// Export: file names, tables, plots, images, CSV and SVG.
//
// Default and clean file names, the table export menu, SVG and plot
// images, saving a Blob, CSV, and the HIVTRACE export.
//
// An ES module (#323) that adds to MT: installX(MT, env), which createMT in common.js calls
// (#341). It uses these MT names from the other files at run time, through MT:
//   common.js: today
//   links-clusters.js: getVisibleLinks
//   ui.js: titleize
// It reads the session and temp (and the layout) from env, which is self on the page and a
// fake in tests; the browser and library globals (document, Worker, d3, ...) it reads bare.
// The body of the installer is not indented, so that the diff of the change that wrapped it
// stays small.

// A file name as typed, made safe to save: characters no file system takes
// are dropped, and an extension that will be added anyway (or one of
// `extensions` that was typed) is stripped, so figure.png does not become
// figure.png.png. An empty result falls back to `fallback`.

export function installExport(MT, env) {
MT.cleanFilename = (name, extensions = [], fallback = 'microbetrace-' + MT.today()) => {
  let clean = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  const typed = /\.([A-Za-z0-9]+)$/.exec(clean);
  if (typed && extensions.includes(typed[1].toLowerCase())) clean = clean.slice(0, -typed[0].length).trim();
  clean = clean.replace(/^\.+/, '').trim();
  return clean || fallback;
};

// A filename field that suggests a name each time its dialog opens:
// microbetrace-<what>-<today>, or microbetrace-<today>, where what() names
// what's saved. A name typed in is kept.
MT.defaultFilename = (field, what = () => '') => {
  field.closest('.modal').addEventListener('show.bs.modal', () => {
    if (field.value && field.value !== field.dataset.suggested) return;
    field.value = field.dataset.suggested = ['microbetrace', what(), MT.today()].filter(Boolean).join('-');
  });
};

// What an export dialog inside a view suggests calling the file: the view's
// name, e.g. graph
const exportName = root => {
  const item = env.layout.contentItems.find(item => item.container.element.contains(root));
  return item ? MT.viewTitle(item.componentType, item.instance).toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
};

// The actions of export dialogs, by the view's root element: the file types a
// dialog offers, and run({filetype, filename, scale, quality}), which its
// button runs too. WebMCP's export_view runs it, so it needn't click the dialog.
const exporters = new WeakMap();
// A file type's library (the spreadsheet one, say) is fetched when it is first used (#324)
const exportFailed = error => {
  console.error(error);
  MT.toast.error("The file couldn't be made: " + error.message + ". Check your connection and try again.");
};
const optionsOf = select => Array.from(select.options).map(o => ({ value: o.value, label: o.textContent.trim() }));
MT.exporterOf = root => exporters.get(root) || null;

// Wires a table view's export dialog: a filename field (export-filename), a
// file type menu (export-filetype) and an .export-button. `formats` maps each
// file type to a function that saves the file, given the filename.
MT.tableExport = (root, formats) => {
  const field = name => root.querySelector(`[name="${name}"]`);
  MT.defaultFilename(field('export-filename'), () => exportName(root));
  // Resolves to the base name used (the filename without its extension)
  const run = async ({ filetype, filename }) => {
    const name = filename === undefined ? field('export-filename').value || 'microbetrace-' + exportName(root) : filename;
    await formats[filetype](name);
    return name;
  };
  exporters.set(root, { types: optionsOf(field('export-filetype')), run });
  root.querySelector('.export-button').addEventListener('click', () => {
    run({ filetype: field('export-filetype').value, filename: field('export-filename').value }).catch(exportFailed);
  });
};

// Loads a script once, on demand: the promise is cached by URL, and a failed
// load is forgotten so it can be tried again
const scripts = {};
MT.loadScript = src => scripts[src] || (scripts[src] = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = src;
  script.onload = resolve;
  script.onerror = () => {
    delete scripts[src];
    script.remove();
    reject(new Error('Could not load ' + src));
  };
  document.head.appendChild(script);
}));

// The libraries that are not in the page's first bundle (dist/bundle.NAME.js, one
// per lazy bundle in scripts/bundle.js) are fetched the first time something needs
// one (#324). A bundle's global tells whether it is already there (a test page, or
// an older script, may have put it there); the ones with a stylesheet also fetch
// dist/bundle.NAME.css, which goes ahead of main.css so that it can still override.
// The promise is cached, so asking again, or from several views, loads it once.
const LIBRARY_GLOBALS = { xlsx: 'XLSX', table: 'Tabulator', sankey: 'd3Sankey', tree: 'TidyTree', alignment: 'alignmentViewer' };
const LIBRARY_STYLES = ['table'];
const styles = {};
MT.loadStyle = href => styles[href] || (styles[href] = new Promise((resolve, reject) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.onload = resolve;
  link.onerror = () => {
    delete styles[href];
    link.remove();
    reject(new Error('Could not load ' + href));
  };
  document.head.insertBefore(link, document.querySelector('link[href$="main.css"]'));
}));
MT.loadLibrary = name => {
  if (!LIBRARY_GLOBALS[name]) return Promise.reject(new Error('There is no library bundle named ' + name));
  return Promise.all([
    env[LIBRARY_GLOBALS[name]] ? null : MT.loadScript('dist/bundle.' + name + '.js'),
    LIBRARY_STYLES.includes(name) ? MT.loadStyle('dist/bundle.' + name + '.css') : null
  ]).then(() => {});
};

// Wires the export dialog of a view drawn as an SVG. The dialog (inside root)
// has fields named export-filename, -filetype, -scale and -quality,
// an .export-advanced-button, an .export-dimensions readout and an .export-button. Image formats save getSVG(); `formats`
// maps other file types to functions that save them, given the filename.
MT.svgExport = (root, getSVG, settings, formats = {}, done) => {
  const $ = selector => root.querySelector(selector);
  const field = name => $(`[name="${name}"]`);
  const modal = $('.export-button').closest('.modal');
  MT.defaultFilename(field('export-filename'), () => exportName(root));
  const advancedButton = $('.export-advanced-button');
  const advanced = $(advancedButton.dataset.bsTarget);
  field('export-filetype').addEventListener('change', e => {
    const image = ['png', 'jpeg', 'webp'].includes(e.target.value);
    advancedButton.hidden = !image;
    if (!image) bootstrap.Collapse.getOrCreateInstance(advanced, { toggle: false }).hide();
  });
  const showDimensions = () => {
    const scale = parseFloat(field('export-scale').value);
    $('.export-dimensions').textContent = Math.round(root.clientWidth * scale) + 'x' + Math.round(root.clientHeight * scale) + 'px';
  };
  field('export-scale').addEventListener('input', showDimensions);
  modal.addEventListener('show.bs.modal', showDimensions);

  // Saves the file; resolves to its base name. A filename of undefined is the dialog's own field.
  const run = async ({ filetype, filename, scale, quality }) => {
    const name = MT.cleanFilename(filename === undefined ? field('export-filename').value : filename, [filetype, 'jpg', 'png', 'jpeg', 'webp', 'svg'], ['microbetrace', exportName(root), MT.today()].filter(Boolean).join('-'));
    if (formats[filetype]) {
      await formats[filetype](name);
      return name;
    }
    const svg = getSVG();
    if (filetype === 'svg') {
      MT.exportBlob(MT.unparseSVG(svg), 'image/svg+xml', name + '.' + filetype);
      if (done) done(svg);
    } else {
      // (The dialog's own scale and quality unless given)
      await MT.svgImage(svg, {
        scale: scale === undefined ? parseFloat(field('export-scale').value) : scale,
        backgroundColor: settings.get('background-color'),
        type: 'image/' + filetype,
        quality: quality === undefined ? parseFloat(field('export-quality').value) : quality
      }).then(blob => MT.saveImage(blob, name + '.' + filetype), error => {
        console.error(error);
        MT.toast.error('The image could not be made (' + error.message + '). Try a smaller scale.');
      }).finally(() => {
        if (done) done(svg);
      });
    }
    return name;
  };
  exporters.set(root, { types: optionsOf(field('export-filetype')), run });
  $('.export-button').addEventListener('click', () => {
    run({ filetype: field('export-filetype').value, filename: field('export-filename').value }).catch(exportFailed);
  });
};

// Downloads a Blob as a file
MT.saveAs = (blob, filename) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers read the URL after the click returns
  setTimeout(() => URL.revokeObjectURL(link.href), 60000);
};

// Saves text as a UTF-8 file of the given type (a MIME type such as 'text/csv'),
// the way every export of text does; MT.saveAs does the download
MT.exportBlob = (text, type, filename) => MT.saveAs(new Blob([text], { type: type + ';charset=utf-8' }), filename);

// Papa.unparse with the settings every export needs. escapeFormulae stops a
// cell such as =HYPERLINK(...) from being evaluated when a spreadsheet opens
// the file. Rows that are objects get the union of their keys as columns, in
// first-seen order (Papa would use the first row's alone), unless opts.columns
// says otherwise. Rows that are arrays, or {fields, data}, pass through.
MT.toCSV = (rows, opts = {}) => {
  const config = { escapeFormulae: true, ...opts };
  if (Array.isArray(rows) && !config.columns && rows.some(r => r && typeof r === 'object' && !Array.isArray(r))) {
    const seen = new Set();
    rows.forEach(r => { if (r && typeof r === 'object') Object.keys(r).forEach(k => seen.add(k)); });
    config.columns = Array.from(seen);
  }
  return Papa.unparse(rows, config);
};

// Saves an image Blob; a null one (canvas.toBlob gives null for a canvas too
// large to encode) is reported to the user instead of thrown.
MT.saveImage = (blob, filename) => {
  if (!blob) {
    MT.toast.error('The image could not be made. It may be too large: try a smaller scale.');
    return false;
  }
  MT.saveAs(blob, filename);
  return true;
};

// Loads an image, crossOrigin so that drawing it leaves a canvas readable.
// Resolves to null if it doesn't load.
const loadImage = src => new Promise(resolve => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

const blobToDataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

// Draws an SVG element as a raster image, as a Blob. An SVG drawn as an
// image can't reach the page, so the stylesheet rules that apply inside it
// and the images it links are copied into it first.
MT.svgImage = async (svg, { scale = 1, backgroundColor, type = 'image/png', quality } = {}) => {
  const box = svg.getBoundingClientRect();
  const width = box.width || parseFloat(svg.getAttribute('width')), height = box.height || parseFloat(svg.getAttribute('height'));
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!copy.getAttribute('viewBox')) copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
  copy.setAttribute('width', width * scale);
  copy.setAttribute('height', height * scale);

  let css = '';
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // another origin's
    for (const rule of rules || []) {
      if (!rule.selectorText) continue;
      try {
        if (svg.matches(rule.selectorText) || svg.querySelector(rule.selectorText)) css += rule.cssText + '\n';
      } catch { /* a selector this browser can't match, like ::-moz- */ }
    }
  }
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    copy.insertBefore(style, copy.firstChild);
  }

  await Promise.all(Array.from(copy.querySelectorAll('image')).map(async image => {
    const href = image.getAttribute('href') || image.getAttribute('xlink:href');
    if (!href || href.startsWith('data:')) return;
    try {
      const data = await blobToDataURL(await (await fetch(href)).blob());
      image.setAttribute('href', data);
      image.removeAttribute('xlink:href');
    } catch {
      image.remove();
    }
  }));

  // A data URL, since the page's Content Security Policy refuses blob: images
  const image = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy)));
  if (!image) throw new Error('The SVG could not be drawn');
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
};

MT.unparseSVG = svgNode => {
  svgNode.setAttribute("xlink", "http://www.w3.org/1999/xlink");
  let selectorTextArr = [];

  // Add Parent element Id and Classes to the list
  selectorTextArr.push("#" + svgNode.id);
  let nClasses = svgNode.classList.length;
  for (let c = 0; c < nClasses; c++) {
    if (!("." + svgNode.classList[c]).includes(selectorTextArr)) {
      selectorTextArr.push("." + svgNode.classList[c]);
    }
  }

  // Add Children element Ids and Classes to the list
  let nodes = svgNode.getElementsByTagName("*");
  let nNodes = nodes.length;
  for (let i = 0; i < nNodes; i++) {
    let id = nodes[i]._id;
    if (!("#" + id).includes(selectorTextArr)) {
      selectorTextArr.push("#" + id);
    }
    let classes = nodes[i].classList;
    for (let d = 0; d < classes.length; d++) {
      if (!("." + classes[d]).includes(selectorTextArr)) {
        selectorTextArr.push("." + classes[d]);
      }
    }
  }

  // Extract CSS Rules
  let extractedCSSText = "";
  let nStylesheets = document.styleSheets.length;
  for (let j = 0; j < nStylesheets; j++) {
    let s = document.styleSheets[j];
    try {
      if (!s.cssRules) continue;
    } catch (e) {
      if (e.name !== "SecurityError") throw e; // for Firefox
      continue;
    }
    let cssRules = s.cssRules;
    let nRules = cssRules.length;
    for (let r = 0; r < nRules; r++) {
      let rule = cssRules[r];
      if (!rule.selectorText) continue;
      if (rule.selectorText.includes(selectorTextArr)) {
        extractedCSSText += rule.cssText;
      }
      if (rule.selectorText === 'body') {  // issue #110
        extractedCSSText += rule.cssText.replace("body" , "text");;
      }
      // if (rule.selectorText == '.nodes path.selected') {  // issue #156
      //   extractedCSSText += rule.cssText;
      // }
    }
  }
  
  extractedCSSText += ".nodes path.selected { stroke: rgb(255, 131, 0); stroke-width: 4px; }";  // issue #201

  let styleElement = document.createElement("style");
  styleElement.setAttribute("type", "text/css");
  styleElement.innerHTML = extractedCSSText;
  let refNode = svgNode.hasChildNodes() ? svgNode.children[0] : null;
  svgNode.insertBefore(styleElement, refNode);
  let serializer = new XMLSerializer();
  return serializer.serializeToString(svgNode);
};

MT.exportHIVTRACE = () => {
  let links = MT.getVisibleLinks();
  let geneticLinks = links.filter(l => l.origin.includes("Genetic Distance"));
  let sequences = new Set(
    geneticLinks.map(l => l.source).concat(
    geneticLinks.map(l => l.target))
  ).size;
  let pas = {};
  env.session.data.nodes.forEach(d => {
    Object.keys(d).forEach(key => {
      if (pas[key]) return;
      pas[key] = {
        label: key,
        type: MT.titleize(typeof d[key])
      };
    });
  });
  return JSON.stringify(
    {
      trace_results: {
        "Cluster sizes": env.session.data.clusters.map(c => c.size),
        Degrees: {
          Distribution: [],
          Model: "Waring",
          fitted: [],
          rho: 0,
          "rho CI": [-1, 1]
        },
        "Directed Edges": {
          Count: 0,
          "Reasons for unresolved directions": {
            "Missing dates": links.length
          }
        },
        "Edge Stages": {},
        Edges: links.map(l => ({
          attributes: ["BULK"],
          directed: false,
          length: l[env.session.style.widgets["link-sort-variable"]],
          removed: false,
          sequences: [l.source, l.target],
          source: env.session.data.nodes.findIndex(d => d._id == l.source), // eslint-disable-line eqeqeq -- node and link IDs may be numbers or text, depending on the file they came from
          support: 0,
          target: env.session.data.nodes.findIndex(d => d._id == l.target) // eslint-disable-line eqeqeq -- node and link IDs may be numbers or text, depending on the file they came from
        })),
        "HIV Stages": {
          "A-1": 0,
          "A-2": 0,
          "A-3": 0,
          Chronic: env.session.data.nodes.length,
          "E-1": 0,
          "E-2": 0,
          "E-3": 0
        },
        "Multiple sequences": {
          "Followup, days": null,
          "Subjects with": 0
        },
        "Network Summary": {
          Clusters: env.session.data.clusters.length,
          Edges: links.length,
          Nodes: env.session.data.nodes.length,
          "Sequences used to make links": sequences
        },
        Nodes: env.session.data.nodes.map(d => ({
          attributes: [],
          baseline: null,
          cluster: d.cluster,
          edi: null,
          id: d._id,
          patient_attributes: d
        })),
        patient_attribute_schema: pas,
        Settings: {
          "contaminant-ids": [],
          contaminants: "remove",
          "edge-filtering": "remove",
          threshold: env.session.style.widgets["link-threshold"]
        }
      }
    },
    null,
    2
  );
};
}
