# Unit Tests

This is where we're developing MicrobeTrace's unit tests.

`graph.test.js` checks `src/graph.js`, the network store, against the old link-object semantics.
`nodes.test.js` checks `src/nodes.js`, the values each file gives its nodes: which file wins where they disagree, provenance and conflicts.
Run them with `npm test` (Node 18 or later).
