#!/usr/bin/env node
// Regenerates the precache list and cache name inside sw.js (#194).
//
//   node scripts/build-sw.js          rewrite sw.js
//   node scripts/build-sw.js --check  exit 1 if sw.js is out of date
//
// The list is built from files that exist, so it cannot name a file that has
// gone (which would make cache.addAll, and so the worker's install, fail). The
// cache name ends in a hash of every precached file's path and contents, so it
// changes exactly when something the worker serves changes, and a new worker
// (and the "new version" prompt) follows. Run it after changing any of them;
// test/unit/sw.test.js fails until you do.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const swPath = path.join(root, "sw.js");
const BEGIN = "// BEGIN GENERATED (scripts/build-sw.js)";
const END = "// END GENERATED";

// Top-level files, then directories whose files are all needed. data/ (8 MB of
// map boundaries) is left out: it is only for the map views, and the worker
// caches it the first time it is fetched instead.
const FILES = ["index.html", "manifest.json", "favicon.ico", "humans.txt"];
const DIRS = ["src", "dist", "vendor", "workers", "components", "fonts", "img"];
const skip = name => /\.(br|gz|md|map)$/.test(name);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + "/" + entry.name;
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (entry.isFile() && !skip(entry.name)) out.push(rel);
  }
  return out;
}

function precacheList() {
  const list = [...FILES, ...DIRS.flatMap(walk)];
  return [...new Set(list)].sort();
}

function cacheName(list) {
  const hash = crypto.createHash("sha256");
  for (const file of list) {
    hash.update(file + "\0");
    hash.update(fs.readFileSync(path.join(root, file)));
    hash.update("\0");
  }
  return "microbetrace-" + hash.digest("hex").slice(0, 12);
}

function generatedBlock() {
  const list = precacheList();
  return [
    BEGIN,
    "const CACHE = " + JSON.stringify(cacheName(list)) + ";",
    "const PRECACHE = [",
    ...list.map(file => "  " + JSON.stringify(file) + ","),
    "];",
    END
  ].join("\n");
}

function render(source) {
  const start = source.indexOf(BEGIN), end = source.indexOf(END);
  if (start < 0 || end < start) throw new Error("sw.js has no generated block");
  return source.slice(0, start) + generatedBlock() + source.slice(end + END.length);
}

module.exports = { precacheList, cacheName, render, swPath, root };

if (require.main === module) {
  const current = fs.readFileSync(swPath, "utf8");
  const next = render(current);
  if (process.argv.includes("--check")) {
    if (next !== current) { console.error("sw.js is out of date: run `npm run cache`"); process.exit(1); }
  } else if (next !== current) {
    fs.writeFileSync(swPath, next);
    console.log("sw.js updated");
  } else console.log("sw.js is up to date");
}
