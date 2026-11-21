# Unit Tests

Tests of the ES-module files in `src/` are `*.test.mjs` and `import` them (#323); the rest are `*.test.js`. Tests that load files in a `vm` context `require` the modules (Node can require a synchronous ES module) and take the named export.

This is where we're developing MicrobeTrace's unit tests.

`graph.test.js` checks `src/graph.js`, the network store, against the old link-object semantics.
`nodes.test.js` checks `src/nodes.js`, the values each file gives its nodes: which file wins where they disagree, provenance and conflicts.
`menus.test.js` checks `MT.fillSelect`, which builds the variable menus as elements so a field name from a loaded session or HIV-TRACE file can't be markup (#204), with the files in `test/security/`.
`webmcp.test.js` checks the shared helpers of `src/webmcp.js` for WebMCP tools: the filter, sort and paging language, the bounds on regexes, `define` and `call`, turning WebMCP on and off, and asking the user.
`golden-distances.test.js` and `golden-graph.test.js` check the app's genetic distances (every metric and ambiguity strategy), minimum spanning trees, nearest neighbours, clusters, tree and alignment against reference answers derived independently of it, in `test/golden/` (#171). They run the real workers and `src/common.js` in Node; known discrepancies are `todo` tests.
Run them with `npm test` (Node 18 or later).
