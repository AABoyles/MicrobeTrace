// Writes a patched copy of TidyTree's build (bundled into dist/bundle.secondary.js).
//
// When TidyTree redraws a tree it already drew, it fades the branches out, then
// moves them and fades them back in, chaining the second step on the first
// transition's end() promise. A second redraw before the first finishes (say,
// changing the layout and then the type) interrupts the transition, and end()
// rejects with the branch's data, which nothing catches: an unhandled rejection
// each time. This lets an interrupted step's promise never settle instead, so
// its stale follow-up is skipped; the redraw that interrupted it sets the final
// state.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'tidytree');
const { version } = require(path.join(dir, 'package.json'));
let source = fs.readFileSync(path.join(dir, 'dist', 'tidytree.min.js'), 'utf8');

const pattern = /\.end\(\)\.then\(/g;
const found = (source.match(pattern) || []).length;
if (found != 2) {
  throw new Error(`patch-tidytree.js: expected 2 matches of ${pattern} in tidytree ${version}, found ${found}. The patch needs updating for this version.`);
}
source = source.replace(pattern, '.end().catch(()=>new Promise(()=>{})).then(');

fs.writeFileSync(process.argv[2] || 'temp.tidytree.js', source);
