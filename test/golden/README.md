# Golden data

Small, hand-checkable datasets with reference answers worked out independently of MicrobeTrace,
so the tests in `test/unit/golden-distances.test.js` and `test/unit/golden-graph.test.js` check
that the app's numbers are right, not just that they agree with themselves (#171). Those tests run
the app's own code: the Web Workers in `workers/` (bx-distance-models' WebAssembly, tn93.js,
patristic, bioseq) and `src/common.js` (`MT.computeLinks`, `MT.computeMST`, `MT.computeNN`,
`MT.tagClusters`), in Node `vm` contexts set up by `harness.js`.

## Files

| File | What it holds |
| --- | --- |
| `distances.fasta` | 8 sequences of 40 sites, `ref` balanced at 10 of each base |
| `ambiguity.fasta` | 4 sequences of 40 sites with IUPAC ambiguity codes and gaps |
| `hivtrace-g.fasta` | 5 sequences of 100 sites (in two lines each) for the HIV-TRACE `-g` strategy |
| `*.expected.json` | Every pair's expected value for every metric and ambiguity mode, and the external tools' values |
| `graph.json` | Toy distance graphs with their minimum spanning trees, nearest neighbours and clusters; an additive matrix with its tree; an alignment |
| `reference.js` | The independent reference implementation of the distances, from the published formulas |
| `derive.js` | Writes `*.expected.json` from `reference.js`, and cross-checks it against tn93 and scikit-bio |
| `harness.js` | Runs MicrobeTrace's workers and `src/common.js` in Node |

### The sequences

Sites are numbered from 0. Every sequence of `distances.fasta` differs from `ref` only as listed:

| Sequence | Differences from `ref` | Exercises |
| --- | --- | --- |
| `ident` | none | identical sequences (distance 0) |
| `ts_ag` | 5 A→G | one purine transition |
| `ts_ct` | 4 C→T | one pyrimidine transition |
| `tv` | 5 A→T | one transversion |
| `mix` | 0 A→G, 9 T→C, 20 G→A; 13 C→G, 31 T→A | 3 transitions, 2 transversions |
| `gapped` | 5 A→G; 10-13 gaps | gaps shrink the compared sites (36) |
| `far` | `mix` and 2 G→C, 16 G→T, 24 C→T, 27 A→T, 35 A→G, 38 C→A | 5 transitions, 6 transversions (p = 0.275) |

`ambiguity.fasta`:

| Sequence | Differences from `ref` | Exercises |
| --- | --- | --- |
| `ambA` | 2 G→Y, 5 A→R | R facing A resolves to a match; Y facing G cannot |
| `ambB` | 5 A→S, 16 G→K, 31 T→A | S against `ambA`'s R shares only G; K resolves against G |
| `gapamb` | 0 and 10-12 gaps, 20 G→A, 30 C→Y, 34 C→B | leading and inner gaps (GapMM), a threefold code |

`hivtrace-g.fasta` repeats `ref` to 100 sites (`h0`). `h1` has R at 5; `h2` Y at 4 and 60 G→A; `h3` Y,
R and K at 44, 45 and 47; `h4` R at 17 and gaps at 70-89. Every code is resolvable against `h0`.

## How the expected values were derived

**Distances** (`*.expected.json`, under `modes`) come from `reference.js`, which shares no code
with MicrobeTrace, bx-distance-models or tn93.js. It counts each pair's sites into a 4 × 4 matrix,
then applies:

- TN93: Tamura & Nei (1993), *Mol Biol Evol* 10:512, eq. 7, with the base frequencies of the two
  sequences together over the compared sites (as HIV-TRACE's tn93 does);
- JC69: Jukes & Cantor (1969), d = -3/4 ln(1 - 4p/3);
- K2P: Kimura (1980), d = -1/2 ln(1 - 2P - Q) - 1/4 ln(1 - 2Q);
- TN92 (Tamura 1992, *Mol Biol Evol* 9:678): d = -h ln(1 - P/h - Q) - (1 - h)/2 ln(1 - 2Q), with
  h = θ1 + θ2 - 2θ1θ2 and θ each sequence's G+C content over the compared sites;
- Hamming and p-distance: mismatches / compared sites; SNPs: mismatches;
- transitions, transversions and their ratio: counts of A↔G and C↔T, and of the rest.

Sites are counted as HIV-TRACE's tn93 counts them (`tn93_shared.cc`): a site with a gap on either
side is not compared; **skip** drops sites with an ambiguity code; **average** spreads a site over
every pair of bases its two codes allow, equally; **resolve** counts it as the bases the two codes
share, if any, and averages it otherwise; **GapMM** compares a gap facing anything but a gap as an
N. **HIV-TRACE -g** is what hivtrace runs (`tn93 -a resolve -g FRACTION`): a pair is averaged if
the ambiguous sites resolution touched are at least FRACTION of its compared sites, else resolved.

**External cross-checks** (`external` in each JSON): `derive.js` checks that every TN93 value
agrees with HIV-TRACE's tn93 to 1e-12, in every mode, and p-distance, JC69, K2P (and TN93 where no
site is skipped) with scikit-bio; it found no disagreement (289 values). The tools:

- tn93 v1.1.0 (github.com/veg/tn93, commit 076eb0f), built with CMake. To print full precision,
  `%g` was changed to `%.17g` in `src/TN93.cpp`'s output (`sed -i 's/%g/%.17g/g' src/TN93.cpp`),
  which leaves the computation alone. Run as `tn93 -q -t 100 -l 1 -f csv -a MODE FILE`, and
  `tn93 -q -t 100 -l 1 -f csv -a resolve -g 0.015 hivtrace-g.fasta`.
- scikit-bio 0.7.4 (`pip install scikit-bio` into a venv), `skbio.sequence.distance.pdist`, `jc69`,
  `k2p` and `tn93`, which skip gaps and ambiguity codes like skip mode.

TN92 and the transition/transversion counts have no external check here; at 50% G+C TN92 equals
K2P, which the stored values show (`ref` against `tv`: both 0.0254822).

To regenerate: `TN93_BIN=/path/to/tn93 SKBIO_PYTHON=/path/to/python node test/golden/derive.js`.
Without the tools it rewrites the reference values and keeps the recorded external ones.

**Graphs** (`graph.json`) were worked out by hand. In `toy` all 15 distances differ, so Kruskal's
algorithm gives one minimum spanning tree: A-B (0.004), D-E (0.006), B-C (0.010), C-D (0.020),
E-F (0.038), weighing 0.078 (A-C and C-E close cycles). Each node's nearest neighbour: A↔B, C→B,
D↔E, F→E. Clusters are the connected components of the links at or under the threshold: at 0.015,
A-B, B-C, A-C and D-E give {A, B, C}, {D, E}, {F}. `square` has four unit sides and diagonals of 2,
so four trees tie and every side is in one of them; every node's two nearest neighbours tie. The
test also checks the hand-worked trees with the cycle property.

**Tree**: the matrix holds the path lengths of `((A:0.1,B:0.2):0.05,C:0.3,(D:0.15,E:0.25):0.1);`,
an additive matrix, from which neighbour joining recovers that tree exactly.

**Alignment**: deleting CT at sites 6-7 is the only two-base deletion turning the reference into
the query, so the query aligns as `ACGTAG--TGCAATCG`, scoring 14 - (5 + 2 × 2) = 5 with the default
costs (match 1, mismatch 1, gap open 5, gap extend 2).

## Conventions where MicrobeTrace and tn93 differ by design

- The FASTA parser turns every `N` into a gap, so an N is never compared; tn93 resolves or averages
  it as A/C/G/T. The golden FASTA files have no N.
- A Ts/Tv ratio with neither transitions nor transversions has no value; MicrobeTrace gives 0.
- When a base is missing from a pair, tn93 falls back to K2P, while bx-distance-models drops the
  TN93 terms that vanish. Every pair here has all four bases (each at least 20% of the pair's
  bases), so the data don't depend on it.
- MicrobeTrace's HIV-TRACE -g decides by sequence: a pair is averaged if either sequence's share of
  non-ACGT characters (gaps included) reaches the threshold. tn93 decides by pair (see above). The
  two disagree on `h1`-`h2` and `h0`-`h4`; see below.

## Discrepancies found

These tests are marked `todo`, so `npm test` passes, until the app is fixed.

1. **GapMM** weighs a gap facing a base as 4/3 of a site. tn93.js's `resolutionsCount` table has
   one 1/2 too many, so B counts 1/2 per base (not 1/3) and N, which GapMM puts in for a gap, 1/3
   (not 1/4). `ref` against `gapped`: 0.1330724 against tn93's 0.1084786; with those weights the
   reference gives the app's value exactly. Pairs with no gap facing a base agree.
2. **HIV-TRACE -g** averages by sequence, not by pair, and counts gaps as ambiguity. `h1`-`h2`
   (one resolvable code each, 2 of 100 sites): tn93 averages (0.0205196), MicrobeTrace resolves
   (0.0102056). `h0`-`h4` (`h4` has one code and 20 gaps, 21% non-ACGT): tn93 resolves (0),
   MicrobeTrace averages (0.0063275).

## Not covered

Triangulation (`workers/compute-triangulation.js`) is switched off in the app (#236) and has no
published definition to test against. Directionality and the consensus are not covered either.
