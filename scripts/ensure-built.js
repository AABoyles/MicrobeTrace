#!/usr/bin/env node
// Builds what the app loads but the repository doesn't hold (#325): dist/, fonts/
// and most of vendor/ (npm run bundle), and sw.js (npm run cache). Run by
// `npm start` and by the Playwright web server, so a fresh clone works after
// `npm ci` alone. The bundles are rebuilt when they are missing or when the hash
// of what they are built from has changed (a pull that changed a dependency or a
// script); sw.js is cheap, so it is rewritten every time, which keeps its cache name in step
// with files edited since the last start.
//
// Fails with a hint when it needs to bundle but esbuild is missing, so that a
// production install (npm ci --omit=dev) says what is wrong instead of crashing.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { inputsHash } = require("./inputs-hash");

const root = path.join(__dirname, "..");

// bundle.js records a hash of its inputs in versions.json (scripts/inputs-hash.js,
// #345). File times are no use here: git checkout and cache restores change them
// without changing the content.
function recordedHash() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "dist/versions.json"), "utf8")).inputsHash;
  } catch {
    return undefined;
  }
}
const stale = recordedHash() !== inputsHash()
  || !fs.existsSync(path.join(root, "vendor/cosmos.min.js")) || !fs.existsSync(path.join(root, "fonts"))
  || !["primary", "xlsx", "table", "plotly", "map", "tree", "alignment", "pdf"].every(name => fs.existsSync(path.join(root, `dist/bundle.${name}.js`)));

function run(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], { cwd: root, stdio: "inherit" });
}

if (stale) {
  if (!fs.existsSync(path.join(root, "node_modules/esbuild"))) {
    console.error("dist/ needs building, but the dev dependencies are not installed: run `npm ci` first.");
    process.exit(1);
  }
  console.log("Building dist/, vendor/ and fonts/ (npm run bundle)...");
  run("bundle.js");
}
run("build-sw.js");
