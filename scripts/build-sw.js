#!/usr/bin/env node
// Writes sw.js, the service worker (#194), from scripts/sw.template.js: the
// template's generated block is filled in with the precache list and cache name.
// sw.js is not committed (#325), so this runs wherever the app is built
// (npm run cache, after npm run bundle, since dist/ is part of the list).
//
//   node scripts/build-sw.js
//
// The list is built from files that exist, so it cannot name a file that has
// gone (which would make cache.addAll, and so the worker's install, fail). The
// cache name ends in a hash of every precached file's path and contents, so it
// changes exactly when something the worker serves changes, and a new worker
// (and the "new version" prompt) follows. Run it after changing any of them.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const swPath = path.join(root, "sw.js");
const templatePath = path.join(__dirname, "sw.template.js");
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
  if (!fs.existsSync(path.join(root, dir))) {
    throw new Error(dir + "/ does not exist: run `npm ci && npm run bundle` first");
  }
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
  if (start < 0 || end < start) throw new Error("scripts/sw.template.js has no generated block");
  return source.slice(0, start) + generatedBlock() + source.slice(end + END.length);
}

module.exports = { precacheList, cacheName, render, swPath, templatePath, root, BEGIN, END };

if (require.main === module) {
  const next = render(fs.readFileSync(templatePath, "utf8"));
  const current = fs.existsSync(swPath) ? fs.readFileSync(swPath, "utf8") : null;
  if (next !== current) {
    fs.writeFileSync(swPath, next);
    console.log("sw.js written");
  } else console.log("sw.js is up to date");
}
