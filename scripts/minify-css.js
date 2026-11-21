#!/usr/bin/env node
// Minifies a stylesheet with the plugins in postcss.config.js (cssnano).
// Used by bundle.js in place of postcss-cli, whose file-globbing dependencies
// carry an unpatched advisory (GHSA-fc5q-39xc-vjpf) and are not needed here.
//
//   node scripts/minify-css.js input.css output.css
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const { plugins } = require(path.join(__dirname, "..", "postcss.config.js"));

// Resolves once output is written.
function minifyCss(input, output) {
  return postcss(plugins)
    .process(fs.readFileSync(input, "utf8"), { from: input, to: output, map: false })
    .then(result => fs.writeFileSync(output, result.css));
}

module.exports = minifyCss;

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Usage: node scripts/minify-css.js input.css output.css");
    process.exit(1);
  }
  minifyCss(input, output)
    .catch(error => { console.error(error.message || error); process.exit(1); });
}
