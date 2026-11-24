// An independent reference implementation of the pairwise distances, written
// from the published formulas, for the golden tests (#171). It shares no code
// with MicrobeTrace or its engines (bx-distance-models, tn93.js): change it only
// to follow the literature, never to agree with the app.
//
// Site counting follows HIV-TRACE's tn93 (github.com/veg/tn93, tn93_shared.cc),
// whose ambiguity modes MicrobeTrace offers:
// - a site where either sequence has a gap is not compared (GAPMM: a gap facing
//   anything but a gap is compared as an N, a fourfold ambiguity);
// - skip: a site holding an IUPAC ambiguity code is not compared;
// - average: an ambiguous site adds 1 / (|S1| |S2|) to every pair of bases
//   (x, y) its two codes allow;
// - resolve: if the two codes share bases, it adds 1 / |S1 ∩ S2| to each shared
//   (b, b); otherwise it is averaged.
// Every metric is then a function of the 4 x 4 matrix F of (fractional) site
// counts, F[x][y] for base x in the first sequence and y in the second.

const BASES = 'ACGT';
const IUPAC = {
  A: 'A', C: 'C', G: 'G', T: 'T', U: 'T',
  R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC',
  B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG', N: 'ACGT', '?': 'ACGT'
};
const A = 0, C = 1, G = 2, T = 3;

// The bases a character allows, as indices; [] for a gap or anything unknown
const resolve = ch => [...(IUPAC[ch.toUpperCase()] || '')].map(b => BASES.indexOf(b));

function siteCounts(s1, s2, mode = 'resolve') {
  if (s1.length !== s2.length) throw new Error('Sequences must be aligned');
  const F = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (let p = 0; p < s1.length; p++) {
    const g1 = s1[p] === '-', g2 = s2[p] === '-';
    let r1 = resolve(s1[p]), r2 = resolve(s2[p]);
    if (g1 && g2) continue;
    if (g1 || g2) {
      if (mode !== 'gapmm') continue;
      if (g1) r1 = [A, C, G, T]; else r2 = [A, C, G, T];
    }
    if (!r1.length || !r2.length) continue;
    const ambiguous = r1.length > 1 || r2.length > 1;
    if (ambiguous && mode === 'skip') continue;
    const shared = r1.filter(b => r2.includes(b));
    if (ambiguous && mode === 'resolve' && shared.length) {
      shared.forEach(b => { F[b][b] += 1 / shared.length; });
      continue;
    }
    const w = 1 / (r1.length * r2.length);
    r1.forEach(x => r2.forEach(y => { F[x][y] += w; }));
  }
  return F;
}

// The quantities the formulas use: L compared sites, P1 (A<->G) and P2 (C<->T)
// transition proportions, Q transversion proportion, and the base frequencies
// pi of the two sequences together over the compared sites.
function summarize(F) {
  let L = 0;
  const pi = [0, 0, 0, 0];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
    L += F[x][y];
    pi[x] += F[x][y];
    pi[y] += F[x][y];
  }
  const ag = F[A][G] + F[G][A], ct = F[C][T] + F[T][C];
  let tv = 0;
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if ((x % 2) !== (y % 2)) tv += F[x][y];
  return { L, ts: ag + ct, tv, P1: ag / L, P2: ct / L, Q: tv / L, pi: pi.map(f => f / (2 * L)) };
}

// Tamura & Nei (1993), Mol Biol Evol 10:512, eq. 7 (as in tn93's computeTN93)
function tn93({ P1, P2, Q, pi }) {
  const [pA, pC, pG, pT] = pi, gR = pA + pG, gY = pC + pT;
  const k1 = 2 * pA * pG / gR, k2 = 2 * pC * pT / gY;
  const k3 = 2 * (gR * gY - pA * pG * gY / gR - pC * pT * gR / gY);
  return -k1 * Math.log(1 - P1 / k1 - Q / (2 * gR))
    - k2 * Math.log(1 - P2 / k2 - Q / (2 * gY))
    - k3 * Math.log(1 - Q / (2 * gR * gY));
}

// Jukes & Cantor (1969): d = -3/4 ln(1 - 4p/3)
const jc69 = ({ P1, P2, Q }) => -0.75 * Math.log(1 - 4 / 3 * (P1 + P2 + Q));

// Kimura (1980): d = -1/2 ln(1 - 2P - Q) - 1/4 ln(1 - 2Q)
const k2p = ({ P1, P2, Q }) => -0.5 * Math.log(1 - 2 * (P1 + P2) - Q) - 0.25 * Math.log(1 - 2 * Q);

// Tamura (1992), Mol Biol Evol 9:678, eq. 8: h = theta1 + theta2 - 2 theta1 theta2,
// theta the G+C content of each sequence (over the compared sites);
// d = -h ln(1 - P/h - Q) - 1/2 (1 - h) ln(1 - 2Q)
function t92(F, { P1, P2, Q, L }) {
  let gc1 = 0, gc2 = 0;
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
    if (x === C || x === G) gc1 += F[x][y];
    if (y === C || y === G) gc2 += F[x][y];
  }
  const t1 = gc1 / L, t2 = gc2 / L, h = t1 + t2 - 2 * t1 * t2;
  return -h * Math.log(1 - (P1 + P2) / h - Q) - 0.5 * (1 - h) * Math.log(1 - 2 * Q);
}

// Every metric MicrobeTrace offers, by its name there
function distances(s1, s2, mode) {
  const F = siteCounts(s1, s2, mode), s = summarize(F);
  const p = (s.ts + s.tv) / s.L;
  return {
    tn93: tn93(s),
    snps: s.ts + s.tv,
    hamming: p,
    p_distance: p,
    jc69: jc69(s),
    k2p: k2p(s),
    tn92: t92(F, s),
    transitions: s.ts,
    transversions: s.tv,
    ts_tv_ratio: s.ts / s.tv,
    sites: s.L
  };
}

// HIV-TRACE -g (tn93 -a resolve -g FRACTION): a pair is resolved unless the
// ambiguous sites resolution touched are at least FRACTION of its compared
// sites, in which case it is averaged. tn93 counts an ambiguous site facing a
// base it allows, and every site ambiguous in both (tn93_shared.cc, ambig_count).
function hivtraceG(s1, s2, fraction) {
  let resolved = 0;
  for (let p = 0; p < s1.length; p++) {
    const r1 = resolve(s1[p]), r2 = resolve(s2[p]);
    if (!r1.length || !r2.length || (r1.length === 1 && r2.length === 1)) continue;
    if (r1.length > 1 && r2.length > 1) resolved++;
    else if (r1.some(b => r2.includes(b))) resolved++;
  }
  const sites = summarize(siteCounts(s1, s2, 'resolve')).L;
  const mode = sites * fraction <= resolved ? 'average' : 'resolve';
  return { mode, resolved, sites, ...distances(s1, s2, mode) };
}

module.exports = { siteCounts, summarize, tn93, jc69, k2p, t92, distances, hivtraceG };
