// Writes a patched copy of tn93's build (vendor/tn93.min.js, also bundled into
// dist/bundle.primary.js).
//
// tn93 0.3.5's resolutionsCount table, the weight of each resolution under the
// GapMM ambiguity strategy, has seven 0.5 entries where there should be six, so
// every later weight is shifted by one index: B is weighted 1/2 instead of 1/3,
// N 1/3 instead of 1/4, and a gap 1/4 instead of 0 (#282). This drops the extra
// entry. Test: test/unit/golden-distances.test.js.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'tn93');
const { version } = require(path.join(dir, 'package.json'));
let source = fs.readFileSync(path.join(dir, 'dist', 'tn93.min.js'), 'utf8');

const wrong = 'const f=[1,1,1,1,1,.5,.5,.5,.5,.5,.5,.5,1/3,1/3,1/3,1/3,1/4,1/4,0]';
const right = 'const f=[1,1,1,1,1,.5,.5,.5,.5,.5,.5,1/3,1/3,1/3,1/3,1/4,1/4,0]';
const found = source.split(wrong).length - 1;
if (found != 1) {
  throw new Error(`patch-tn93.js: expected 1 copy of the resolutionsCount table in tn93 ${version}, found ${found}. ` +
    'The patch needs updating for this version (or is no longer needed).');
}
source = source.replace(wrong, right);

fs.writeFileSync(process.argv[2] || 'vendor/tn93.min.js', source);
