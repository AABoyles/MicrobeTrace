# Demo data

This directory holds the sample outbreak that MicrobeTrace loads for `#demo`, the sample
download linked from the top-level README, and the COVID-19 dummy data.

## The attribute values are simulated

The demographic and clinical values in the demo node lists (gender, transmission risk,
age, interview and exposure dates, infectious period dates, and ZIP code) are **simulated**.
They do not describe any real person. The maintainer has confirmed this.

The IDs in the demo outbreak look like GenBank accessions with clone labels (for example
`30582_KF773572_H96cl05`), so the sequences appear to come from public sequence data. The
repository does not record which accessions were used, which database they came from, or
the licence of that data.

The manual's "Downloading Sample Data" section (`docs/MicrobeTrace_Manual.pdf`) describes the
outbreak files as example files. It says nothing else about where they came from.

## Files

Sizes and counts are from the files in this directory at the time of writing.

| File | What it is | Provenance |
|---|---|---|
| `Demo_outbreak_NodeList.csv` | Node list: 86 rows, 12 columns (`anyID`, `gender`, `transmission risk`, `subtype`, `sequence`, `interviewDate`, `exposurestart`, `exposureend`, `ipstart`, `ipend`, `age`, `zip`). Attribute values are simulated (see above). The `sequence` column is the aligned sequence for each ID and matches the FASTA file. | Added in `295f77b` (2019-04-29). Columns renamed in `8b0831e` (2020-01-29, "namespace issues") so they don't collide with MicrobeTrace's own fields. #297 dropped the `neighbors` column (see below) and trimmed a trailing space from one ID. |
| `Demo_outbreak_EdgeList.csv` | Edge list: 368 links (`source`, `target`). All endpoints are in the node list except `30577_KF773461_C94cl29`. | Added in `295f77b`. Method used to derive the links: not recorded. #297 trimmed a trailing space from one endpoint. |
| `Demo_outbreak_Sequences.fas` | Aligned FASTA, 88 records of 1,465 columns, `-` for gaps, CRLF line endings. | Added in `295f77b`. Sequence source: see above (public sequence data, accessions not recorded). |
| `Demo_outbreak_DistanceMatrix.csv` | Square matrix of pairwise distances, 88 IDs by 88 IDs. | Added in `295f77b`. Distance model and software: not recorded. #297 removed an empty duplicate row and column for `30576_KF773440_B96cl58` and trimmed the padded ID. |
| `Demo_outbreak_PhylogeneticTree.nwk` | Newick tree over the sequence IDs. | Added in `295f77b`. Tree method and software: not recorded. |
| `Demo_outbreak_session.microbetrace` | A saved MicrobeTrace session built from the demo node list. Loaded by `#demo` (`src/index.js`). | Added in `abd5569` (2019-06-07, "Set MicrobeTrace to load Demo Data on #demo"). Rebuilt in #297 by loading `Demo_outbreak_NodeList.csv` in the app and saving it, so its node fields are the node list's columns and its node IDs are `_id`, not the 2019 `id`. It holds 86 nodes and 3,655 links computed from the sequences (590 within the default link threshold of 0.015, TN93). It does not include the edge list. |
| `MicrobetraceDemoData.zip` | The sample download linked from the top-level README. Contains the five `Demo_outbreak_*` files listed below. | Created in `b08be98` (2018-11-14). Its members are rebuilt to match these loose files (the node list was out of date until `4ed9553`, which rebuilt the zip from the current loose copy). Rebuilt again in #297. |
| `COVID Dummy Data.zip` | The COVID-19 sample download linked from the top-level README. Contains `edgeList_covidDummy.csv` and `nodeList_covidDummy.csv`, byte-identical to the loose copies. | Added in `31fb3e8` (2020-08-25, Ellsworth Campbell). The loose copies were added in `993be5c` (2020-08-24). |
| `edgeList_covidDummy.csv` | Edge list for the COVID dummy data: 299 links with columns `ID1`, `ID2`, `type` (`locationLink`). | Added in `993be5c` (2020-08-24). Its name and commit say "dummy". |
| `nodeList_covidDummy.csv` | Node list for the COVID dummy data: 265 rows, 34 columns (gender, age, ZIP code, symptom and hospital dates, symptoms, comorbidities, `type` = `person`). | Added in `993be5c` (2020-08-24). Its name and commit say "dummy". The repository has no separate statement on whether its values are simulated. The maintainer's confirmation (issue #257) covers the outbreak demo files, not this file. |

### Contents of `MicrobetraceDemoData.zip`

Members in order, all at the top level (no directory prefix):

1. `Demo_outbreak_EdgeList.csv`
2. `Demo_outbreak_NodeList.csv`
3. `Demo_outbreak_Sequences.fas`
4. `Demo_outbreak_DistanceMatrix.csv`
5. `Demo_outbreak_PhylogeneticTree.nwk`

Each member is byte-identical to the loose file of the same name.

## Known inconsistencies

### Fixed in #297

- The ID `30576_KF773440_B96cl58` had a trailing space in the node list, the edge list and the
  distance matrix (none in the FASTA file), so exact-match joins on it failed. The spaces are gone.
- The distance matrix had two rows and columns for that ID: one padded with a space, holding only
  its own zero, and one with the full distances. The empty one was removed.
- The node list's `neighbors` column matched the edge list's degree for only 6 of 86 nodes, and
  its source is not recorded. It was dropped rather than guessed at. MicrobeTrace computes degree
  itself.
- The session had the 2019 node fields (`id`, `degree`, `cntdate`, `column13`, `_diff`, `cluster`),
  two of which were internal names. It was rebuilt from the current node list.

### Still open

These differences cannot be resolved from the files, so they are recorded and not changed.

- The node list has 86 rows, but the FASTA file and the distance matrix have 88 IDs each. Two of
  them are not in the node list: `30577_KF773448_C02cl26` and `30577_KF773461_C94cl29`. Their
  attribute values are unknown, so they were not added to the node list. The session therefore has
  86 nodes.
- `30577_KF773461_C94cl29` is an edge endpoint that is not in the node list. Ten edges have it at
  one end, and those edges have no node there.
- The sequences in the node list and the FASTA file agree for all 86 node-list rows.
