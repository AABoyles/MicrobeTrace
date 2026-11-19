#!/usr/bin/env node
// Copies exactly the files the deployed app needs into _site/, for the GitHub
// Pages deploy (#196). Everything else in the repository (tests, docs, build
// scripts, server and Docker files) stays out of the public site.
//
//   node scripts/build-site.js [outDir]   (default: _site)
//
// The app shell comes from the service worker's precache list, so the two
// cannot drift apart. On top of that, the site needs the worker itself, the
// map boundary files it caches on first use, the demo session and its pieces (loaded by
// #demo and the WebMCP demo tool), package.json (read for the version shown
// in the app) and robots.txt.
const fs = require("fs");
const path = require("path");
const { precacheList, root } = require("./build-sw.js");

const EXTRA_FILES = ["sw.js", "robots.txt", "package.json", "demo/Demo_outbreak_session.microbetrace",
  // the pieces the WebMCP load_demo tool can fetch one at a time
  "demo/Demo_outbreak_EdgeList.csv", "demo/Demo_outbreak_NodeList.csv", "demo/Demo_outbreak_Sequences.fas",
  "demo/Demo_outbreak_DistanceMatrix.csv", "demo/Demo_outbreak_PhylogeneticTree.nwk"];
const EXTRA_DIRS = ["data"];

function filesIn(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap(entry => {
      const rel = dir + "/" + entry.name;
      // Notes such as data/README.md describe the files; the app doesn't fetch them
      return entry.isDirectory() ? filesIn(rel) : entry.isFile() && !entry.name.endsWith(".md") ? [rel] : [];
    });
}

function siteFiles() {
  const list = [...precacheList(), ...EXTRA_FILES, ...EXTRA_DIRS.flatMap(filesIn)];
  return [...new Set(list)].sort();
}

module.exports = { siteFiles };

if (require.main === module) {
  const out = path.resolve(root, process.argv[2] || "_site");
  if (out === root || !out.startsWith(root + path.sep)) {
    console.error("Refusing to write outside the repository or over it: " + out);
    process.exit(1);
  }
  fs.rmSync(out, { recursive: true, force: true });
  const files = siteFiles();
  for (const file of files) {
    const dest = path.join(out, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, file), dest);
  }
  console.log("Copied " + files.length + " files to " + path.relative(root, out) + "/");
}
