#!/usr/bin/env node
// Derives the expected values in test/golden/*.expected.json from the golden
// FASTA files, with the independent reference implementation (reference.js) and,
// when they are available, external tools to cross-check it:
//
//   TN93_BIN=/path/to/tn93 SKBIO_PYTHON=/path/to/venv/bin/python node test/golden/derive.js
//
// TN93_BIN is HIV-TRACE's tn93 (github.com/veg/tn93); SKBIO_PYTHON a Python with
// scikit-bio. See README.md for the versions used. Nothing here loads any
// MicrobeTrace code. Without the tools, the reference values are still written
// and the cross-checks already recorded in the JSON are kept.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ref = require('./reference.js');

const dir = __dirname;
const METRICS = ['tn93', 'snps', 'hamming', 'p_distance', 'jc69', 'k2p', 'tn92', 'transitions', 'transversions', 'ts_tv_ratio'];
const MODES = ['skip', 'resolve', 'average'];
const TOLERANCE = 1e-12;

function readFasta(file) {
  const out = [];
  fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).forEach(line => {
    if (line[0] === '>') out.push({ id: line.slice(1).trim(), seq: '' });
    else if (line.trim()) out[out.length - 1].seq += line.trim().toUpperCase();
  });
  return out;
}

const pairsOf = seqs => {
  const pairs = [];
  for (let i = 0; i < seqs.length; i++) for (let j = i + 1; j < seqs.length; j++) pairs.push([i, j]);
  return pairs;
};

// JSON has no Infinity or NaN; they are stored as strings
const encode = v => Number.isFinite(v) ? v : String(v);

// tn93's distances for one file, by pair, in pair order
function tn93Binary(file, seqs, args) {
  if (!process.env.TN93_BIN) return null;
  const out = execFileSync(process.env.TN93_BIN, ['-q', '-t', '100', '-l', '1', '-f', 'csv', ...args, path.join(dir, file)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const ids = seqs.map(s => s.id), d = {};
  out.trim().split('\n').slice(1).forEach(line => {
    const [a, b, v] = line.split(',');
    d[[ids.indexOf(a), ids.indexOf(b)].sort((x, y) => x - y).join(',')] = parseFloat(v);
  });
  return pairsOf(seqs).map(p => d[p.join(',')]);
}

// scikit-bio's distances (gaps and ambiguity codes skipped, as in skip mode)
function skbio(seqs) {
  if (!process.env.SKBIO_PYTHON) return null;
  const script = `
import json, sys
from skbio import DNA
import skbio, skbio.sequence.distance as d
seqs = json.load(sys.stdin)
n = len(seqs)
out = {'version': skbio.__version__, 'pairs': []}
for i in range(n):
    for j in range(i + 1, n):
        a, b = DNA(seqs[i]), DNA(seqs[j])
        out['pairs'].append({m: getattr(d, f)(a, b) for m, f in [('p_distance', 'pdist'), ('jc69', 'jc69'), ('k2p', 'k2p'), ('tn93', 'tn93')]})
print(json.dumps(out))
`;
  return JSON.parse(execFileSync(process.env.SKBIO_PYTHON, ['-I', '-c', script], { input: JSON.stringify(seqs.map(s => s.seq)), encoding: 'utf8' }));
}

const close = (a, b) => Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(b));
let problems = 0, checks = 0;
function check(label, expected, external) {
  if (external == null) return;
  checks++;
  if (!close(expected, external)) {
    problems++;
    console.error(`MISMATCH ${label}: reference ${expected}, external ${external}`);
  }
}

function derive(file, { modes = MODES, metrics = METRICS, gapmm = false, hivtraceG = null }) {
  const seqs = readFasta(file), pairs = pairsOf(seqs);
  const jsonFile = path.join(dir, file.replace(/\.fasta$/, '.expected.json'));
  const old = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : {};
  const out = {
    source: file,
    derivation: 'Every value is from test/golden/reference.js (the published formulas; see README.md). ' +
      'external holds the same quantities from independent tools, which derive.js checks agree to 1e-12.',
    ids: seqs.map(s => s.id),
    pairs: pairs.map(([i, j]) => [seqs[i].id, seqs[j].id]),
    modes: {},
    external: old.external || {}
  };
  modes.forEach(mode => {
    out.modes[mode] = {};
    const values = pairs.map(([i, j]) => ref.distances(seqs[i].seq, seqs[j].seq, mode));
    metrics.forEach(m => { out.modes[mode][m] = values.map(v => encode(v[m])); });
    out.modes[mode].sites = values.map(v => v.sites);
    const bin = tn93Binary(file, seqs, ['-a', mode]);
    if (bin) out.external[`tn93 -a ${mode}`] = bin;
    (out.external[`tn93 -a ${mode}`] || []).forEach((v, k) => check(`${file} ${mode} tn93 ${out.pairs[k]}`, values[k].tn93, v));
  });
  if (gapmm) {
    const values = pairs.map(([i, j]) => ref.distances(seqs[i].seq, seqs[j].seq, 'gapmm'));
    out.modes.gapmm = { tn93: values.map(v => v.tn93), sites: values.map(v => v.sites) };
    const bin = tn93Binary(file, seqs, ['-a', 'gapmm']);
    if (bin) out.external['tn93 -a gapmm'] = bin;
    (out.external['tn93 -a gapmm'] || []).forEach((v, k) => check(`${file} gapmm tn93 ${out.pairs[k]}`, values[k].tn93, v));
  }
  if (hivtraceG != null) {
    // HIV-TRACE -g: tn93 -a resolve -g FRACTION, decided pair by pair (reference.hivtraceG)
    const values = pairs.map(([i, j]) => ref.hivtraceG(seqs[i].seq, seqs[j].seq, hivtraceG));
    out.modes['hivtrace-g'] = {
      fraction: hivtraceG,
      tn93: values.map(v => v.tn93),
      averaged: values.map(v => v.mode === 'average'),
      resolvedAmbiguities: values.map(v => v.resolved),
      sites: values.map(v => v.sites)
    };
    const bin = tn93Binary(file, seqs, ['-a', 'resolve', '-g', String(hivtraceG)]);
    if (bin) out.external[`tn93 -a resolve -g ${hivtraceG}`] = bin;
    (out.external[`tn93 -a resolve -g ${hivtraceG}`] || []).forEach((v, k) => check(`${file} -g tn93 ${out.pairs[k]}`, values[k].tn93, v));
  }
  if (modes.includes('skip')) {
    const sk = skbio(seqs);
    if (sk) out.external[`scikit-bio ${sk.version} (skip)`] = sk.pairs;
    const recorded = Object.keys(out.external).find(k => k.startsWith('scikit-bio'));
    (recorded ? out.external[recorded] : []).forEach((v, k) => {
      const [i, j] = pairs[k];
      // scikit-bio takes base frequencies from each whole sequence, not just the
      // sites both hold a base at, so its TN93 only matches where nothing is skipped
      const skipped = ref.distances(seqs[i].seq, seqs[j].seq, 'skip').sites < seqs[i].seq.length;
      ['p_distance', 'jc69', 'k2p'].concat(skipped ? [] : ['tn93']).forEach(m =>
        check(`${file} skip ${m} ${out.pairs[k]} (scikit-bio)`, ref.distances(seqs[i].seq, seqs[j].seq, 'skip')[m], v[m]));
    });
  }
  fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote', path.relative(process.cwd(), jsonFile));
}

derive('distances.fasta', { gapmm: true });
derive('ambiguity.fasta', { gapmm: true });
derive('hivtrace-g.fasta', { modes: ['resolve', 'average'], metrics: ['tn93'], hivtraceG: 0.015 });
console.log(checks + ' values checked against external tools, ' + problems + ' disagreements');
if (problems) {
  console.error(problems + ' disagreement(s) between the reference and the external tools');
  process.exit(1);
}
