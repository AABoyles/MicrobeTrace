// Writes a patched copy of TidyTree's build (bundled into dist/bundle.secondary.js),
// with two fixes for bugs new in 0.8.
//
// 1. Since 0.8, an animated redraw moves each branch by transitioning its path's
// d attribute, which d3 does by interpolating every number in the string. The
// circular layouts draw branches with arcs, whose large-arc and sweep flags
// must be 0 or 1: halfway between, they are 0.5, and the browser logs an error
// for every branch on every frame. This interpolates the numbers the same way
// but rounds the flags. Where the two paths have different commands (say, on a
// change of layout) there is nothing sensible in between, so it jumps to the
// new path at the start. (CDCgov/TidyTree#80)
//
// 2. Since 0.8, a redraw waits for the next animation frame, and destroy()
// doesn't cancel it: a tree destroyed in between (the view draws a new one
// whenever it is resized) redraws into an emptied element and throws. This
// marks a destroyed tree and has its waiting redraw do nothing. (CDCgov/TidyTree#81)
//
// Remove each fix once a TidyTree release includes it.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'tidytree');
const { version } = require(path.join(dir, 'package.json'));
let source = fs.readFileSync(path.join(dir, 'dist', 'tidytree.min.js'), 'utf8');

// Replaces exactly one match of pattern, or fails: a new release needs the patch rechecked
function patch(pattern, replacement) {
  const found = (source.match(pattern) || []).length;
  if (found != 1) {
    throw new Error(`patch-tidytree.js: expected 1 match of ${pattern} in tidytree ${version}, found ${found}. The patch needs updating for this version.`);
  }
  source = source.replace(pattern, replacement);
}

const pattern = /(paths\.transition\(\)\.duration\(([\w$]+)\.animation\))\.attr\("d",([\w$]+)\)/g;
const tween = transformer => `.attrTween("d",function(d){` +
  `var n=/-?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?/gi,a=this.getAttribute("d")||"",b=${transformer}(d),s=b.replace(n,"#");` +
  `if(a.replace(n,"#")!==s)return function(){return b};` +
  `var x=a.match(n)||[],y=b.match(n)||[];` +
  `return function(t){if(t>=1)return b;var k=0;` +
  `return s.replace(/#/g,function(){var v=+x[k]+(y[k]-x[k])*t;k++;return v})` +
  `.replace(/A([^A-Za-z]*)/g,function(m,p){p=p.trim().split(/[\\s,]+/);` +
  `for(var i=3;i<p.length;i+=7){p[i]=Math.round(p[i]);p[i+1]=Math.round(p[i+1])}return"A"+p.join(" ")})}})`;

patch(pattern, (m, transition, tree, transformer) => transition + tween(transformer));

patch(/destroy\(\)\{this\.parent&&/g, 'destroy(){this._destroyed=!0,this.parent&&');
patch(/(redraw\(\)\{const ([\w$]+)=this;return requestAnimationFrame\(\(\)=>\{)/g, (m, start, tree) => start + `if(${tree}._destroyed)return;`);

fs.writeFileSync(process.argv[2] || 'temp.tidytree.js', source);
