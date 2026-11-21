#!/usr/bin/env node
// Builds what the app loads but the repository doesn't hold (#325): dist/, fonts/
// and most of vendor/ (npm run bundle), and sw.js (npm run cache). Run by
// `npm start` and by the Playwright web server, so a fresh clone works after
// `npm ci` alone. The bundles are rebuilt when they are missing or older than
// package-lock.json or a script bundle.js reads (a pull that changed a dependency);
// sw.js is cheap, so it is rewritten every time, which keeps its cache name in step
// with files edited since the last start.
//
// Fails with a hint when it needs to bundle but esbuild is missing, so that a
// production install (npm ci --omit=dev) says what is wrong instead of crashing.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const mtime = file => fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.mtimeMs ?? 0;

// versions.json is written last by bundle.js, so it dates the build
const built = mtime("dist/versions.json");
// Everything bundle.js reads besides node_modules, so editing any of it rebuilds
const inputs = ["package-lock.json", "scripts/bundle.js", "scripts/plotly-bundle.js", "scripts/buffer-shim.js",
  "scripts/minify-css.js", "scripts/write-versions.js", "postcss.config.js"];
const stale = !built || inputs.some(file => built < mtime(file))
  || !fs.existsSync(path.join(root, "vendor/cosmos.min.js")) || !fs.existsSync(path.join(root, "fonts"));

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
