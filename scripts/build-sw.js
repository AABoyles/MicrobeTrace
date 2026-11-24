#!/usr/bin/env node
// Writes sw.js, the service worker (#194), from scripts/sw.template.js: the
// template's generated block is filled in with the app shell to precache (#343) and the cache name.
// sw.js is not committed (#325), so this runs wherever the app is built
// (npm run cache, after npm run bundle, since dist/ is part of the list).
//
//   node scripts/build-sw.js
//
// The list is built from files that exist, so it cannot name a file that has
// gone (which would make cache.addAll, and so the worker's install, fail). The
// cache name ends in a hash of every file the app loads, not just the shell, by path and
// contents, so it changes exactly when something the worker serves changes, and a new worker
// (and the "new version" prompt) follows. Run it after changing any of them.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const swPath = path.join(root, "sw.js");
const templatePath = path.join(__dirname, "sw.template.js");
const BEGIN = "// BEGIN GENERATED (scripts/build-sw.js)";
const END = "// END GENERATED";

// Everything the app can load: top-level files, then directories whose files are all
// needed. data/ (8 MB of map boundaries) is left out: it is only for the map views, and
// the worker caches it the first time it is fetched instead. This is what the cache
// name is a hash of, so a change to any of it (a view, a lazy bundle) is a new version.
const FILES = ["index.html", "manifest.json", "favicon.ico", "humans.txt", "package.json"];
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

function appFiles() {
  const list = [...FILES.filter(file => fs.existsSync(path.join(root, file))), ...DIRS.flatMap(walk)];
  return [...new Set(list)].sort();
}

// The app shell (#343): what a first visit needs to start, and to add a file in the
// Files view, which is what opens first. The worker fetches these when it installs, so
// the app then loads offline. Everything else (the other views, the lazy library
// bundles, cosmos.gl, the map data) is cached the first time it is fetched, so a first
// visit downloads only what it uses and a view opened once still opens offline.
//
// The shell is spelled out, not "everything but a few files", so that a new file is
// lazy until someone decides it is not. It is:
//   - index.html and the files it names: its scripts, styles, icons and fonts;
//   - the ES modules those scripts import (a static `import ... from` is part of the
//     page's startup; a dynamic import() is not followed);
//   - the primary library bundle, and the Files view (components/files.html and .js);
//   - workers/ and vendor/, bar cosmos.gl (the network view loads it when it opens): the
//     Files view starts them to parse and compute as soon as it is given data;
//   - fonts/ and img/, which the styles and the manifest refer to.
const SHELL_DIRS = ["fonts", "img", "workers", "vendor"];
const SHELL_FILES = [
  "index.html", "manifest.json", "favicon.ico", "humans.txt", "package.json",
  "dist/bundle.primary.js", "dist/bundle.primary.css", "components/files.html", "components/files.js"
];
const NOT_SHELL = ["vendor/cosmos.min.js"];

// The files index.html loads
function pageFiles() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  return [...html.matchAll(/(?:src|href)="((?:src|dist|vendor|fonts|img|workers|components)\/[^"?#]+)"/g)].map(m => m[1]);
}

// The files a module imports statically, by their paths from the root
function importsOf(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const found = [
    ...source.matchAll(/(?:^|[;\s])(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g),
    ...source.matchAll(/(?:^|[;\s])import\s*['"](\.{1,2}\/[^'"]+)['"]/g)
  ];
  return found.map(m => path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
}

function shellList() {
  const shell = new Set([...SHELL_FILES, ...pageFiles()]);
  const queue = [...shell].filter(file => file.endsWith(".js") && file.startsWith("src/"));
  for (const file of queue) {
    for (const imported of importsOf(file)) {
      if (!shell.has(imported)) {
        shell.add(imported);
        queue.push(imported);
      }
    }
  }
  for (const dir of SHELL_DIRS) walk(dir).forEach(file => shell.add(file));
  NOT_SHELL.forEach(file => shell.delete(file));
  // (Only files that exist: a missing one would fail the worker's install)
  return [...shell].filter(file => fs.existsSync(path.join(root, file)) && !skip(file)).sort();
}

// The name is a hash of every file the app can load, not just the shell's, so that a
// changed view or lazy bundle (cached when first used) makes a new version too
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
  return [
    BEGIN,
    "const CACHE = " + JSON.stringify(cacheName(appFiles())) + ";",
    "const PRECACHE = [",
    ...shellList().map(file => "  " + JSON.stringify(file) + ","),
    "];",
    END
  ].join("\n");
}

function render(source) {
  const start = source.indexOf(BEGIN), end = source.indexOf(END);
  if (start < 0 || end < start) throw new Error("scripts/sw.template.js has no generated block");
  return source.slice(0, start) + generatedBlock() + source.slice(end + END.length);
}

module.exports = { shellList, appFiles, pageFiles, importsOf, cacheName, render, swPath, templatePath, root, BEGIN, END };

if (require.main === module) {
  const next = render(fs.readFileSync(templatePath, "utf8"));
  const current = fs.existsSync(swPath) ? fs.readFileSync(swPath, "utf8") : null;
  if (next !== current) {
    fs.writeFileSync(swPath, next);
    console.log("sw.js written");
  } else console.log("sw.js is up to date");
}
