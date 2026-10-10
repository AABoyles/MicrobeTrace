// Writes a patched copy of cosmos.gl's ES build (the input for vendor/cosmos.min.js).
//
// Above 4,096 points, cosmos.gl's many-body repulsion bins points into a fixed
// pyramid of square grids, computing the force from each cell's center of mass
// out to the point's 3×3 neighborhood, and pairwise forces inside it. Which cells
// count as "near" depends on which cell the point is in, so the approximation
// error jumps wherever a point crosses a cell boundary, and with the grid fixed
// those jumps always fall on the same lines. Once a layout settles, points
// collect along them, drawing an invisible square grid.
//
// This shifts the whole grid pyramid by a random offset every tick (the usual
// cure for fixed-grid tree codes), so the error averages out instead of piling
// up on fixed lines. The patch touches only how points are binned into cells:
// cell sums and forces still use true positions.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', '@cosmos.gl', 'graph');
const { version } = require(path.join(dir, 'package.json'));
let source = fs.readFileSync(path.join(dir, 'dist', 'index.js'), 'utf8');

function replace(pattern, replacement, expected) {
  const found = (source.match(new RegExp(pattern.source, 'g')) || []).length;
  if (found != expected) {
    throw new Error(`patch-cosmos.js: expected ${expected} match(es) of ${pattern} in @cosmos.gl/graph ${version}, found ${found}. The patch needs updating for this version.`);
  }
  source = source.replace(new RegExp(pattern.source, 'g'), replacement);
}

const blocks = ['calculateLevelsPrecise', 'forceLevelPrecise', 'buildNearFieldSlots', 'forceNearField'];

blocks.forEach(block => {
  // The offset is appended to each pass's uniforms: std140 block, its defines,
  // and the plain uniforms used without uniform buffers.
  replace(new RegExp(`\\} ${block};\\n([\\s\\S]*?)#else\\n`),
    `  float gridOffsetX;\n  float gridOffsetY;\n} ${block};\n$1#define gridOffsetX ${block}.gridOffsetX\n#define gridOffsetY ${block}.gridOffsetY\n#else\nuniform float gridOffsetX;\nuniform float gridOffsetY;\n`, 1);
  // ...and to the matching uniform stores, in the same order
  replace(new RegExp(`(${block}Uniforms: \\{\\s*uniformTypes: \\{[^}]*?)(\\n\\s*\\},\\s*defaultUniforms: \\{[^}]*?)(\\n\\s*\\})`),
    '$1,\n          gridOffsetX: "f32",\n          gridOffsetY: "f32"$2,\n          gridOffsetX: 0,\n          gridOffsetY: 0$3', 1);
  // ...and set every tick
  replace(new RegExp(`(${block}Uniforms: \\{)(?=\\s*(levelGridSize|pointsTextureSize):)`),
    '$1\n            gridOffsetX: this.gridOffset[0],\n            gridOffsetY: this.gridOffset[1],', 1);
});

// The four places points are binned into cells (levels, near-field slots, and
// the two force passes)
replace(/floor\(pointPosition\.rg \/ cellSize\)/, 'floor((pointPosition.rg + vec2(gridOffsetX, gridOffsetY)) / cellSize)', 2);
replace(/floor\(position \/ cellSize\)/, 'floor((position + vec2(gridOffsetX, gridOffsetY)) / cellSize)', 2);

// A new offset each tick, up to half the coarsest cell either way
replace(/this\.levels = 0, this\.levelTargets = /, 'this.gridOffset = [0, 0], this.levels = 0, this.levelTargets = ', 1);
replace(/\(this\.drawLevels\(\), this\.drawNearFieldSlots\(\), this\.drawForces\(\)\)/,
  '(this.shiftGrid(), this.drawLevels(), this.drawNearFieldSlots(), this.drawForces())', 1);
replace(/(\n  \/\*\* Aggregates points into every grid level texture\. \*\/\n  drawLevels\(\) \{)/,
  '\n  shiftGrid() {\n    const t = this.store, c = t.adjustedSpaceSize / 4;\n    this.gridOffset = [t.getRandomFloat(-0.5, 0.5) * c, t.getRandomFloat(-0.5, 0.5) * c];\n  }$1', 1);

fs.writeFileSync(process.argv[2] || 'temp.cosmos.mjs', source);
