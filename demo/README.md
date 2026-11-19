# Demo data

This directory holds the sample outbreak that MicrobeTrace loads for `#demo`, the sample
download linked from the top-level README.

## The attribute values are simulated

The demographic and clinical values in the demo node lists (gender, transmission risk,
age, interview and exposure dates, infectious period dates, and ZIP code) are **simulated**.
They do not describe any real person. The maintainer has confirmed this.

The IDs in the demo outbreak look like GenBank accessions with clone labels (for example
`30582_KF773572_H96cl05`), so the sequences appear to come from public sequence data. The
repository does not record which accessions were used, which database they came from, or
the licence of that data.

## Files

Sizes and counts are from the files in this directory at the time of writing.

| File | What it is | Provenance |
|---|---|---|
| `Demo_outbreak_NodeList.csv` | Node list: 86 rows, 13 columns (`anyID`, `neighbors`, `gender`, `transmission risk`, `subtype`, `sequence`, `interviewDate`, `exposurestart`, `exposureend`, `ipstart`, `ipend`, `age`, `zip`). Attribute values are simulated (see above). The `sequence` column is the aligned sequence for each ID and matches the FASTA file. | Added in `295f77b` (2019-04-29). Columns renamed in `8b0831e` (2020-01-29, "namespace issues") so they don't collide with MicrobeTrace's own fields (`id`, `degree`, `cluster`, `_diff`). Sequence source: see above. |
| `Demo_outbreak_EdgeList.csv` | Edge list: 368 links (`source`, `target`). All endpoints are in the node list except `30577_KF773461_C94cl29`. | Added in `295f77b`. Method used to derive the links: not recorded. |
| `Demo_outbreak_Sequences.fas` | Aligned FASTA, 88 records of 1,465 columns, `-` for gaps, CRLF line endings. | Added in `295f77b`. Sequence source: see above (public sequence data, accessions not recorded). |
| `Demo_outbreak_DistanceMatrix.csv` | Square matrix of pairwise distances, 89 IDs by 89 IDs. | Added in `295f77b`. Distance model and software: not recorded. |
| `Demo_outbreak_PhylogeneticTree.nwk` | Newick tree over the sequence IDs. | Added in `295f77b`. Tree method and software: not recorded. |
| `Demo_outbreak_session.microbetrace` | A saved MicrobeTrace session built from the demo data. Loaded by `#demo` (`src/index.js`). | Added in `abd5569` (2019-06-07, "Set MicrobeTrace to load Demo Data on #demo"). Its node fields use the 2019 column names (`id`, `degree`, `cntdate`, `_diff`, `column13`, `cluster`), not the current node list's, so it does not reproduce the current `Demo_outbreak_NodeList.csv` exactly. |
| `MicrobetraceDemoData.zip` | The sample download linked from the top-level README. Contains the five `Demo_outbreak_*` files listed below. | Created in `b08be98` (2018-11-14). Its members are rebuilt to match these loose files (the node list was out of date until `4ed9553`, which rebuilt the zip from the current loose copy). |

### Contents of `MicrobetraceDemoData.zip`

Members in order, all at the top level (no directory prefix):

1. `Demo_outbreak_EdgeList.csv`
2. `Demo_outbreak_NodeList.csv`
3. `Demo_outbreak_Sequences.fas`
4. `Demo_outbreak_DistanceMatrix.csv`
5. `Demo_outbreak_PhylogeneticTree.nwk`

Each member is byte-identical to the loose file of the same name.

## Known inconsistencies

These are recorded here and have not been changed.

- The node list has 86 rows, the FASTA file has 88 records and the distance matrix has 89 IDs.
  Two FASTA records (`30577_KF773448_C02cl26`, `30577_KF773461_C94cl29`) are not in the node
  list, and `30577_KF773461_C94cl29` is an edge endpoint. Three distance-matrix IDs are not in the
  node list.
- The ID `30576_KF773440_B96cl58` has a trailing space in the node list and in the distance matrix
  (it has none in the FASTA file), so exact-match joins on that ID fail.
- The sequences in the node list and the FASTA file agree for all 86 node-list rows (the trailing
  space is the only difference).
