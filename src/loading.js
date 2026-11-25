// Loading: files, sessions, generated sequences, fields, geodata and the demo.
//
// Reads the files a user adds, applies a saved session or the HIVTRACE and
// GHOST formats, generates and aligns sequences, infers fields, and loads
// geodata and the demo.
//
// An ES module (#323) that adds to MT: installX(MT, env), which createMT in common.js calls
// (#341). It uses these MT names from the other files at run time, through MT:
//   colors.js: createLinkColorMap, createNodeColorMap, createPolygonColorMap
//   common.js: addLink, addNode, addNodeField, defaultWidgets, events,
//     parseDate, reset, runWorker, sessionSkeleton, settings, time, uniq
//   links-clusters.js: finishUp, runHamsters
// It reads the session and temp (and the layout) from env, which is self on the page and a
// fake in tests; the browser and library globals (document, Worker, d3, ...) it reads bare.
// The body of the installer is not indented, so that the diff of the change that wrapped it
// stays small.
import { MTDates } from './dates.js';
import { MTGraph } from './graph.js';
import { MTSessionFormat } from './session-format.js';
import { rewind, layoutViews, upgradeMapSettings } from './geo.js';
import { upgradeGraphs } from './charts.js';

export function installLoading(MT, env) {

MT.processSVG = svg => {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const all = selector => Array.from(doc.querySelectorAll(selector));
  let nodes = [];
  if (doc.querySelector("#edges")) {
    all("#nodes circle").forEach(node => {
      const gephid = node.getAttribute("class");
      nodes.push(gephid);
      MT.addNode(
        {
          id: gephid + "",
          color: node.getAttribute("fill"),
          size: parseFloat(node.getAttribute("r")),
          origin: ["Scraped Gephi SVG"]
        }
      );
    });
    MT.addNodeField("color", "size");
    all("#edges path").forEach(link => {
      const coords = link.getAttribute("class").split(" ");
      let base = {
        source: coords[0] + "",
        target: coords[1] + "",
        color: link.getAttribute("stroke"),
        origin: ["Scraped MicrobeTrace SVG"]
      };
      base[env.session.style.widgets['default-distance-metric']] = 0;
      MT.addLink(base);
    });
    MT.session.addLinkField("color");
  } else {
    all(".nodes g").forEach((node, i) => {
      nodes.push(node.getAttribute("transform").slice(10, -1).split(",").map(parseFloat));
      MT.addNode({ id: i + "", origin: ["Scraped SVG"] });
    });
    all("line").forEach(link => {
      const at = name => parseFloat(link.getAttribute(name));
      const source = nodes.findIndex(d => Math.abs(d[0] - at("x1")) < 0.0001 && Math.abs(d[1] - at("y1")) < 0.0001);
      const target = nodes.findIndex(d => Math.abs(d[0] - at("x2")) < 0.0001 && Math.abs(d[1] - at("y2")) < 0.0001);
      if (source < 0 || target < 0) return;
      let base = {
        source: source + "",
        target: target + "",
        origin: ["Scraped SVG"]
      };
      base[env.session.style.widgets['default-distance-metric']] = 0;
      MT.addLink(base);
    });
  }
  MT.runHamsters();
};

MT.processJSON = (json, extension) => {
  let data;
  try {
    data = JSON.parse(json);
  } catch (error) {
    MT.toast.error(
      "File Not Recognized! Are you certain this is a MicrobeTrace Session or HIV-TRACE Output File?"
    );
    console.error(error);
    return;
  }
  if (extension === "microbetrace") {
    MT.applySession(data);
  } else {
    if (data.version) {
      MT.applyGHOST(data);
    } else {
      MT.applyHIVTrace(data);
    }
  }
};

// Returns true if the session opened. A file that is not a valid session is
// refused before anything is reset, so the current session stays as it is.
MT.applySession = oldSession => {
  //If anything here seems eccentric, assume it's to maintain compatibility with
  //session files from older versions of MicrobeTrace.
  const check = MTSessionFormat.validate(oldSession);
  if (!check.ok) {
    MT.toast.error(check.error);
    console.error(check.error);
    return false;
  }

  MT.events.emit("stop-force-simulation"); // stop previous network ticks so previous polygon won't show up

  MT.reset();
  const launch = document.getElementById("launch");
  if (launch) launch.disabled = true;
  env.session.files = oldSession.files || [];
  env.session.state = oldSession.state || env.session.state;
  env.session.style = Object.assign({},
    env.session.style,
    oldSession.style
  );
  if (oldSession.layout) env.session.layout = oldSession.layout;
  // Sessions from when the globe and the choropleth were views of their own
  // keep their settings, as the map's
  upgradeMapSettings(env.session.style.widgets, [...layoutViews(env.session.layout), env.session.style.widgets['default-view']]);
  // As do those from when the histogram, scatterplot and epi curve were
  upgradeGraphs(env.session.style.widgets, env.session.layout);
  env.session.meta.startTime = Date.now();
  MT.session.restoreData(oldSession.data);
  if(oldSession.network) env.session.network = oldSession.network;
  keepBrushedDates();
  // Sessions from before distances were kept under their metric's name (#249)
  // kept the distance metric's as distance: they filter on that
  const widgets = env.session.style.widgets;
  if (!env.session.data.linkFields.includes(widgets['link-sort-variable']) && env.session.data.linkFields.includes('distance')) {
    // eslint-disable-next-line no-restricted-syntax -- session upgrade, before anything subscribes (#249)
    widgets['link-sort-variable'] = 'distance';
  }
  MT.applyStyle(env.session.style);
  MT.finishUp(true);
  return true;
};

// The epi curve's brush hid the nodes after a date, which the global timeline now
// does (#366): a session saved with nodes hidden so has the timeline at that date,
// where it can be moved or turned off.
const keepBrushedDates = () => {
  const widgets = env.session.style.widgets, field = widgets["timeline-date-field"];
  if (!field || field === "None" || (widgets["node-timeline-variable"] || "None") !== "None") return;
  const until = +MT.parseDate(env.session.state.timeEnd);
  const hides = until > 0 && env.session.data.nodeFields.includes(field) && MT.nodeTimes(field).some(time => time > until);
  /* eslint-disable no-restricted-syntax -- session upgrade, before anything subscribes (#366) */
  if (hides) {
    widgets["node-timeline-variable"] = field;
    env.session.network.timelinePinned = env.session.network.allPinned;
    env.session.network.timelineNodes = (env.session.network.nodes || []).map(node => Object.assign({}, node));
  } else {
    widgets["timeline-date-field"] = "None";
  }
  /* eslint-enable no-restricted-syntax */
};

MT.applyStyle = style => {
  env.session.style = style;
  // Sessions from before there were two ways to prune (#236) had an on/off
  // link-show-nn, which ran the minimum spanning tree
  const old = style.widgets && style.widgets["link-show-nn"];
  if (old !== undefined) {
    // eslint-disable-next-line no-restricted-syntax -- session upgrade, before anything subscribes (#236)
    if (style.widgets["link-prune"] === undefined) style.widgets["link-prune"] = (old === true || old === "true") ? "mst" : "none";
    delete style.widgets["link-show-nn"];
  }
  env.session.style.widgets = Object.assign({},
    MT.defaultWidgets,
    style.widgets
  );
  MT.createLinkColorMap();
  MT.createNodeColorMap();
  MT.createPolygonColorMap();
  MT.settings.reload();
};

MT.applyHIVTrace = hivtrace => {
  MT.resetSession({ temp: false });
  env.session.meta.startTime = Date.now();
  hivtrace["trace_results"]["Nodes"].forEach(node => {
    let newNode = JSON.parse(JSON.stringify(node.patient_attributes));
    newNode._id = node._id;
    newNode.origin = "HIVTRACE Import";
    MT.addNode(newNode);
  });
  Object.keys(
    hivtrace["trace_results"]["Nodes"][0]["patient_attributes"]
  ).forEach(key => {
    MT.addNodeField(key);
  });
  let n = hivtrace["trace_results"]["Edges"].length;
  let metric = env.session.style.widgets['default-distance-metric'];
  for (let i = 0; i < n; i++) {
    let link = hivtrace["trace_results"]["Edges"][i];
    let newLink = {
      source: "" + link.sequences[0],
      target: "" + link.sequences[1],
      origin: ["HIVTRACE Import"],
      visible: true
    };
    newLink[metric] = parseFloat(link.length);
    MT.addLink(newLink);
  }
  MT.session.addLinkField(metric);
  MT.runHamsters();
};

MT.applyGHOST = ghost => {
  MT.resetSession({ temp: false });   
  env.session.meta.startTime = Date.now();
  ghost["samples"].forEach(node => {     
    let newNode = JSON.parse(JSON.stringify(node));     
    newNode.origin = ["GHOST Import"];     
    newNode.genotypes = Object.keys(newNode.genotypes)[0];     
    newNode.id = "" + newNode.id;     
    MT.addNode(newNode);   
  });
  // (A sample's id is its ID, _id, so isn't listed as a field too)
  MT.addNodeField("genotypes", "group", "name");
  let links = ghost["links"];   
  let n = links.length;   
  for (let i = 0; i < n; i++) {     
    let link = links[i];     
    let newLink = Object.assign({}, link, { 
      source: "" + link.source, 
      target: "" + link.target, 
      [env.session.style.widgets['default-distance-metric']]: parseFloat(link.dist), 
      origin: ["GHOST Import"], visible: true });     
    MT.addLink(newLink);   
  }
  MT.session.addLinkField(env.session.style.widgets['default-distance-metric'], "density", "dist", "shared", "src_genotype", "src_haps", "tgt_genotype", "tgt_haps");
//	MT.finishUp(); 
  MT.runHamsters();
}; 

let decoder = new TextDecoder("utf-8");
MT.decode = x => decoder.decode(x);

MT.parseFASTA = text => MT.runWorker("workers/parse-fasta.js", text, { name: "The FASTA parser" }).then(data => {
  MT.time('FASTA Transit', data.start);
  return data.nodes;
});

MT.parseMEGA = text => MT.runWorker("workers/parse-mega.js", text, { name: "The MEGA parser" }).then(data => {
  MT.time('MEGA Transit', data.start);
  return data.nodes;
});

// Reads a distance matrix (CSV text in file.contents) into the graph. Rejects
// with an Error saying why when the file cannot be read as one.
MT.parseCSVMatrix = (file, source, nodeOrigin) => {
  return new Promise((resolve, reject) => {
    const origin = [file.name];
    let nn = 0,
        nl = 0;
    MT.runWorker("workers/parse-csv-matrix.js", file.contents, { name: "The matrix parser" }).then(response => {
      const data = response.data;
      MT.time('CSV Matrix Transit', response.start);
      const start = Date.now();
      const nodes = data.nodes;
      const tn = nodes.length;
      nn += MT.session.addNodes(nodes.map(id => ({ _id: id, origin: nodeOrigin || ['Genetic Distance'] })), source);
      const links = data.links;
      const tl = links.length;
      // Distances go under the distance metric, which the threshold filters on (#213)
      const field = env.session.style.widgets["default-distance-metric"];
      MT.session.addLinkField(field);
      // (A matrix can hold millions of links, so they are made as they are added)
      nl += MT.session.addLinks((function*() { for (const link of links) yield MTGraph.distanceLink(Object.assign(link, { origin: origin }), field); })());
      MT.time('CSV Matrix Merge', start);
      resolve({ nn, nl, tn, tl, ids: nodes, unparseable: data.unparseable || 0, example: data.example });
    }).catch(reject);
  })
};

MT.r01 = Math.random;

// ported from https://github.com/aaboyles/SeqSpawnR/blob/91d5857dbda5998839a002fbecae0f494dca960a/R/SequenceSpawner.R
// The most characters the Generate button puts in one node file (#301): a
// browser's longest string is about 500 million, and each is read whole
MT.generatedFileChars = 2e8;
// The most sequences the Generate button makes: 250,000 load in a few minutes;
// 300,000 and more run out of memory computing distances, as each distance
// worker gets its own copy of the sequences (#301)
MT.maxGeneratedSequences = 250000;

// How long generated sequences are, when no seed or reference is given
MT.generatedSeedLength = 2100;

MT.generateSeqs = (idPrefix, count, snps, seed) => {
  let start = Date.now();
  if (!count) count = 1000;
  if (!snps) snps = 100;
  if (!seed) seed = env.session.data.reference;
  // No reference to start from (the consensus is built later, from the data)
  if (!seed) seed = Array.from({ length: MT.generatedSeedLength }, () => "ACGT"[Math.floor(MT.r01() * 4)]).join("");

  let sampleCodons = [
    "GCA",
    "GCC",
    "GCG",
    "GCT",
    "AAC",
    "AAT",
    "GAC",
    "GAT",
    "TGC",
    "TGT",
    "GAC",
    "GAT",
    "GAA",
    "GAG",
    "TTC",
    "TTT",
    "GGA",
    "GGC",
    "GGG",
    "GGT",
    "CAC",
    "CAT",
    "ATA",
    "ATC",
    "ATT",
    "AAA",
    "AAG",
    "CTA",
    "CTC",
    "CTG",
    "CTT",
    "TTA",
    "TTG",
    "ATG",
    "AAC",
    "AAT",
    "CCA",
    "CCC",
    "CCG",
    "CCT",
    "CAA",
    "CAG",
    "AGA",
    "AGG",
    "CGA",
    "CGC",
    "CGG",
    "CGT",
    "AGC",
    "AGT",
    "TCA",
    "TCC",
    "TCG",
    "TCT",
    "ACA",
    "ACC",
    "ACG",
    "ACT",
    "GTA",
    "GTC",
    "GTG",
    "GTT",
    "TGG",
    "TAC",
    "TAT",
    "CAA",
    "CAG",
    "GAA",
    "GAG"
  ];
  let sampleSNPs = ["A", "C", "G", "T"];

  let sample = (vec, nCodons) => {
    let samples = [];
    for (let x = 0; x < nCodons; x++) {
      let idx = Math.floor(MT.r01() * vec.length);
      samples.push(vec[idx]);
    }
    return samples;
  }

  let seqs = [];

  seqs.push({ id: idPrefix + "0", seq: seed });

  while (seqs.length < count) {
    // number codons to vary
    let nCodons = Math.floor(MT.r01() * 10) + 1;

    // randomly select this many to check for existence
    let randomCodonSet = sample(sampleCodons, nCodons).join("");

    // try again if not present
    if (seqs[seqs.length - 1].seq.indexOf(randomCodonSet) === -1) continue;

    // sequence to mutate
    let oldseed = seqs[Math.floor(MT.r01() * seqs.length)].seq;

    // select codons to replace randomCodonSet
    let replacementCodonSet = sample(sampleCodons, nCodons).join("");

    // replace codon set
    let newseed = oldseed.replace(randomCodonSet, replacementCodonSet);

    // add snp substitutions randomly across entire sequence
    // - randomly sample addedSNP
    // - randomly pick SNPS to replace
    let addedSNPs = Math.floor(MT.r01() * snps);
    for (let j = 0; j < addedSNPs; j++) {
      let randomSNP = sample(sampleSNPs, 1)[0];
      let locOfSNP = Math.floor(MT.r01() * seed.length);
      newseed =
        newseed.substr(0, locOfSNP) + randomSNP + newseed.substr(locOfSNP + 1);
    }

    seqs.push({ id: idPrefix + "" + seqs.length, seq: newseed });
  }
  MT.time('Sequence spawn', start);
  return seqs;
};

// Puts aligned sequences (nodes with _seq and _padding) on the reference's
// length: leading gaps for the padding, then cut or padded with gaps at the
// end. Returns how many had no sequence, lost bases off the end (cut here,
// or by the aligner, which drops what overhangs the reference; originals
// are the sequences as they were before alignment, to tell), or were padded
// with trailing gaps.
MT.fitToReference = (nodes, referenceLength, minPadding = 0, originals = []) => {
  const fit = { empty: 0, truncated: 0, padded: 0, referenceLength };
  const bases = q => q.replace(/-/g, "").length;
  nodes.forEach((d, i) => {
    if (!d._seq) fit.empty++;
    d._seq = "-".repeat((d._padding || 0) - minPadding) + (d._seq || "");
    let cut = false;
    if (d._seq.length > referenceLength) {
      d._seq = d._seq.substring(0, referenceLength);
      cut = true;
    } else {
      d._seq = d._seq.padEnd(referenceLength, "-");
    }
    if (originals[i] && bases(originals[i]) > bases(d._seq)) cut = true;
    if (cut) fit.truncated++;
    else if (/-$/.test(d._seq) && bases(d._seq) > 0) fit.padded++;
  });
  return fit;
};

// Plain-text warnings for what MT.fitToReference reports, or for sequences
// of differing lengths when nothing aligned them (unaligned: array of lengths)
MT.lengthWarnings = (fit, unaligned) => {
  const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? '' : 's'}`;
  const warnings = [];
  if (fit) {
    if (fit.truncated) warnings.push(`${plural(fit.truncated, 'sequence')} extended past the end of the reference and had the excess cut off before distances were computed.`);
    if (fit.padded) warnings.push(`${plural(fit.padded, 'sequence')} did not reach the end of the reference; ${fit.padded === 1 ? 'its' : 'their'} end was filled with gaps.`);
  }
  if (unaligned && unaligned.length) {
    // (A loop: spreading hundreds of thousands of lengths into Math.min overflows the stack, #302)
    let min = Infinity, max = -Infinity;
    for (const length of unaligned) {
      if (length < min) min = length;
      if (length > max) max = length;
    }
    if (min !== max) warnings.push(`Alignment is off but the sequences differ in length (${min.toLocaleString()} to ${max.toLocaleString()}). Positions will not correspond between sequences, so distances may be wrong. Turn on alignment or align them beforehand.`);
  }
  return warnings;
};

MT.align = params => {
  return new Promise((resolve, reject) => {
    if (params.aligner === "none") {
      return resolve(params.nodes);
    }
    let n = params.nodes.length;
    let referenceLength = params.reference.length;
    const originals = params.nodes.map(d => d.seq || "");
    MT.runWorker("workers/align-sw.js", params, { name: "The aligner" }).then(response => {
      let subset = response.nodes;
      MT.time('Alignment transit', response.start);
      let start = Date.now();
      let minPadding = Infinity,
      d = null;
      for (let i = 0; i < n; i++) {
        d = subset[i];
        if (!d._seq) d._seq = "";
        if (minPadding > d._padding) minPadding = d._padding;
      }
      const fit = MT.fitToReference(subset, referenceLength, minPadding, originals);
      MT.addNodeField('_score', '_padding', '_cigar');
      MT.time('Alignment Padding', start);
      subset.fit = fit;
      resolve(subset);
    }).catch(reject);
  });
};

// The geodata in data/, fetched once (a request made while another is under way
// waits for it) and kept in temp.mapData by name. GeoJSON comes with its
// polygons wound as d3 needs them (see rewind in geo.js). A failed fetch is
// forgotten, so the next request tries again.
const mapRequests = {};
MT.getMapData = type => {
  const [name, format] = type.split(".");
  if (env.temp.mapData[name]) return Promise.resolve(env.temp.mapData[name]);
  if (!mapRequests[type]) {
    mapRequests[type] = fetch("data/" + type)
      .then(response => {
        if (!response.ok) throw new Error("Could not load data/" + type + " (HTTP " + response.status + ")");
        return format === "json" ? response.json() : response.text();
      })
      .then(data => env.temp.mapData[name] = format === "csv" ? Papa.parse(data, { header: true }).data : rewind(data))
      .finally(() => delete mapRequests[type]);
  }
  return mapRequests[type];
};

// Choosing a view's variables from the data. Fields that MicrobeTrace keeps
// for itself, or that identify items, are left out.
const ownFields = ['index', '_id', 'id', 'selected', 'visible', 'origin', 'seq', 'source', 'target', 'nn', 'directed'];
const choosable = fields => fields.filter(field => !ownFields.includes(field) && field[0] !== '_');
const valuesOf = (items, field) => items.map(d => d[field]).filter(v => v != null && v !== '');

// Fields that sort items into a few groups: text with 2 to 20 values
MT.categoricalFields = (items, fields) => choosable(fields).filter(field => {
  const values = valuesOf(items, field);
  if (!values.length || values.some(v => typeof v !== 'string')) return false;
  const distinct = new Set(values).size;
  return distinct >= 2 && distinct <= 20;
});

// Fields of measurements: numbers with at least 3 values (cluster IDs aren't)
MT.numericFields = (items, fields) => choosable(fields).filter(field => {
  if (field === 'cluster') return false;
  const values = valuesOf(items, field);
  return values.length > 0 && values.every(v => typeof v === 'number' && isFinite(v)) && new Set(values).size >= 3;
});

// Whether a value is a date: a Date, or text that reads as one (in the given
// order, see MTDates.dateOrderOf). Numbers aren't, nor text that's just a
// number (as spreadsheets give), though MT.parseDate reads them as times.
MT.isDate = (value, order) => value instanceof Date ? !isNaN(value) :
  typeof value === 'string' && isNaN(value) && !!MT.parseDate(value, order);

// A column's values read as dates: how many are present, how many read, and
// how many distinct dates they are, all in the column's order
MT.dateColumn = values => {
  const present = values.filter(v => v != null && v !== '');
  const { order, status } = MTDates.dateOrderOf(present);
  const dates = present.filter(v => MT.isDate(v, order));
  return { order, status, present: present.length, readable: dates.length, distinct: new Set(dates).size };
};

// Fields of dates: at least half the values are dates, with at least 2
// distinct. The rest are undated (see MT.reportDateColumns). Those named for
// dates come first.
MT.dateFields = (items, fields) => choosable(fields).filter(field => {
  const { present, readable, distinct } = MT.dateColumn(valuesOf(items, field));
  return readable > 0 && readable * 2 >= present && distinct >= 2;
}).sort((a, b) => /date|time|day/i.test(b) - /date|time|day/i.test(a));

// Says, when a file is read, how each date field was read: values that
// couldn't be (so are undated), and columns whose day-first and month-first
// dates are mixed or can't be told apart
MT.reportDateColumns = (items, fields) => {
  const lines = [];
  MT.dateFields(items, fields).forEach(field => {
    const { status, present, readable } = MT.dateColumn(valuesOf(items, field));
    const notes = [];
    if (status === 'inconsistent') notes.push('mixes day-first and month-first dates, so it is read month-first');
    if (status === 'ambiguous') notes.push('has dates that could be day-first or month-first (such as 03/04/2020), so it is read month-first');
    const unreadable = present - readable;
    if (unreadable) notes.push(`${unreadable.toLocaleString()} value${unreadable === 1 ? ' could' : 's could'} not be read as ${unreadable === 1 ? 'a date' : 'dates'} and ${unreadable === 1 ? 'is' : 'are'} undated`);
    if (notes.length) lines.push(`<strong>${MT.escape(field)}</strong>: ${notes.join('; ')}.`);
  });
  if (lines.length) MT.toast.warning(lines.join('<br>'), 15);
};

// Lets the user add GeoJSON files to a map: each file chosen with `input` is
// given to add(data, color), which draws it and returns { setColor(color),
// remove() }. Each is listed in `list` with a color picker and a remove
// button.
MT.geoJSONUpload = (input, list, add, color = '#000000') => {
  input.addEventListener('change', () => {
    Array.from(input.files).forEach(file => {
      if (!/\.(geo)?json$/i.test(file.name)) return MT.toast.error('"' + MT.escape(file.name) + '" is not a GeoJSON file. Choose a file ending in .geojson or .json.');
      file.text().then(text => {
        const layer = add(JSON.parse(text), color);
        const name = document.createElement('div'), remove = document.createElement('a'), colorCell = document.createElement('div'), picker = document.createElement('input');
        name.className = 'col-9';
        name.textContent = file.name.split('.').slice(0, -1).join('.');
        remove.href = '#';
        remove.className = 'icon-action bi bi-x-circle align-middle p-1';
        remove.title = 'Remove this file';
        name.prepend(remove);
        colorCell.className = 'col-3';
        picker.type = 'color';
        picker.className = 'w-100';
        picker.value = color;
        colorCell.append(picker);
        picker.addEventListener('change', () => layer.setColor(picker.value));
        remove.addEventListener('click', e => {
          e.preventDefault();
          name.remove();
          colorCell.remove();
          layer.remove();
        });
        list.append(name, colorCell);
      }).catch(() => MT.toast.error('"' + MT.escape(file.name) + '" could not be read as GeoJSON.'));
    });
    input.value = '';
  });
};

// Placing nodes on a map. The kinds of location field, from the least
// precise to the most: a node takes the most precise location it has.
MT.locationKinds = ['country', 'state', 'county', 'zipcode'];

// With none of a view's location fields (prefix + kind) chosen, node fields
// named for them are used
MT.pickLocationFields = (settings, prefix) => {
  const kinds = [...MT.locationKinds, 'lat', 'lon'];
  if (kinds.some(kind => ![undefined, null, 'None'].includes(settings.get(prefix + kind)))) return;
  kinds.forEach(kind => {
    if (env.session.data.nodeFields.includes(kind)) settings.set(prefix + kind, kind);
  });
};

// What each node is at, by kind of location: an object of functions, one for
// each kind whose field is chosen, each taking a node and returning the
// country, state or county (a GeoJSON feature) or zipcode (a row of
// zipcodes.csv) it names, or undefined. field(kind) is the node field holding
// that kind of location, or null. A county is matched by its FIPS code, or by
// name within the node's state. The map places nodes with these, and shades
// regions by them.
MT.placeFinders = async field => {
  const files = {
    countries: field('country') && 'countries.json',
    states: (field('state') || field('county')) && 'states.json',
    counties: field('county') && 'counties.json',
    zipcodes: field('zipcode') && 'zipcodes.csv'
  };
  const data = {};
  await Promise.all(Object.entries(files).filter(([, file]) => file).map(([name, file]) => MT.getMapData(file).then(rows => data[name] = rows)));

  // Each map file, indexed by the values that match its places
  const index = (rows, keys) => {
    const index = new Map();
    rows.forEach(row => keys(row).forEach(k => {
      if (k != null && k === k && k !== '') index.set(String(k), row);
    }));
    return index;
  };
  const lookup = (index, value) => {
    if (value == null || value === '') return;
    const number = parseFloat(value);
    return index.get(String(value)) || (isFinite(number) && index.get(String(number))) || undefined;
  };

  const find = {};
  if (data.countries) {
    const i = index(data.countries.features, f => [f.id, f.properties.name]);
    find.country = d => lookup(i, d[field('country')]);
  }
  if (data.states) {
    const i = index(data.states.features, f => [f.properties.usps, f.properties.name, f.properties.name.toLowerCase()]);
    const state = d => {
      const v = field('state') && d[field('state')];
      if (v == null || v === '') return;
      return lookup(i, v) || lookup(i, String(v).toUpperCase()) || lookup(i, String(v).toLowerCase());
    };
    if (field('state')) find.state = state;
    if (data.counties) {
      const counties = index(data.counties.features, f => [f.properties.fips]);
      find.county = d => {
        const v = d[field('county')];
        const county = lookup(counties, v);
        if (county || typeof v !== 'string' || !v) return county;
        // Otherwise by name, within the node's state
        const s = state(d), name = v.toLowerCase();
        return s && data.counties.features.find(c => c.properties.state === s.properties.usps &&
          (c.properties.name.includes(name) || name.includes(c.properties.name)));
      };
    }
  }
  if (data.zipcodes) {
    const i = index(data.zipcodes, z => [z.zipcode]);
    find.zipcode = d => lookup(i, d[field('zipcode')]);
  }
  return find;
};

// Where each of `nodes` is, as a Map of _id to [lat, lon]: the most precise
// place it has (see MT.locationKinds), or its latitude and longitude. field is
// as for MT.placeFinders, and also gives the latitude ('lat') and longitude
// ('lon') fields.
MT.locateNodes = async (nodes, field) => {
  const find = await MT.placeFinders(field);
  const at = place => {
    const p = place && (place.properties || place);
    return p && [parseFloat(p._lat), parseFloat(p._lon)];
  };
  const coordinate = (value, negative) => typeof value === 'string' ? (value.toUpperCase().includes(negative) ? -1 : 1) * parseFloat(value) : value;
  const lat = field('lat'), lon = field('lon');
  const positions = new Map();
  nodes.forEach(d => {
    let position;
    MT.locationKinds.forEach(kind => {
      const p = find[kind] && at(find[kind](d));
      if (p && isFinite(p[0]) && isFinite(p[1])) position = p;
    });
    if (lat && lon) {
      const p = [coordinate(d[lat], 'S'), coordinate(d[lon], 'W')];
      if (typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[0]) && isFinite(p[1])) position = p;
    }
    if (position) positions.set(d._id, position);
  });
  return positions;
};

// Random offsets for map positions, as the jitter setting (a power of 2, or
// -2 for none) says. at(id, [lat, lon]) moves a position; reroll() picks new
// offsets.
MT.jitterer = amount => {
  const offsets = new Map();
  return {
    at(id, [lat, lon]) {
      const scale = amount() === -2 ? 0 : Math.pow(2, amount());
      if (!scale) return [lat, lon];
      if (!offsets.has(id)) offsets.set(id, [MT.r01() * Math.PI * 2, MT.r01()]);
      const [theta, j] = offsets.get(id);
      return [lat + scale * j * Math.sin(theta), lon + scale * j * Math.cos(theta)];
    },
    reroll: () => offsets.clear()
  };
};

// Loads the demo outbreak, as the #demo address does
MT.demoURL = "demo/Demo_outbreak_session.microbetrace";

// Whether the demo can load now: always online, and offline once the service
// worker has kept a copy (it caches the demo on first use, #296)
MT.demoAvailable = async () => {
  if (navigator.onLine) return true;
  try { return !!(env.caches && await caches.match(new URL(MT.demoURL, location.href).href)); }
  catch { return false; }
};

// The demo buttons say when they need a connection, rather than failing
MT.updateDemoButtons = async () => {
  const available = await MT.demoAvailable();
  document.querySelectorAll(".demo-button, .view-needs-demo").forEach(button => {
    button.disabled = !available;
    button.textContent = available ? "Try the demo data" : "Demo data needs a connection";
  });
};
// Only in a browser: the unit tests load this file in Node, without a DOM
if (typeof env.addEventListener === "function") {
  env.addEventListener("online", () => MT.updateDemoButtons());
  env.addEventListener("offline", () => MT.updateDemoButtons());
}

MT.loadDemo = () => fetch(MT.demoURL)
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(MT.applySession)
  .catch(error => {
    console.error(error);
    MT.toast.error(navigator.onLine ? "The demo data couldn't be loaded." : "The demo data couldn't be loaded. This browser is offline and hasn't saved it yet.");
  });
}
