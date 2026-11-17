# Unit Tests

This is where we're developing MicrobeTrace's unit tests.

`graph.test.js` checks `src/graph.js`, the network store, against the old link-object semantics.
`nodes.test.js` checks `src/nodes.js`, the values each file gives its nodes: which file wins where they disagree, provenance and conflicts.
`webmcp.test.js` checks the shared helpers of `src/webmcp.js` for WebMCP tools: the filter, sort and paging language, and `define` and `call`.
Run them with `npm test` (Node 18 or later).
