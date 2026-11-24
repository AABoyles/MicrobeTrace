#!/usr/bin/env node
// Copies exactly the files the deployed app needs into _site/, for the GitHub
// Pages deploy (#196). Everything else in the repository (tests, docs, build
// scripts, server and Docker files) stays out of the public site.
//
//   node scripts/build-site.js [outDir]   (default: _site)
//
// Needs dist/, fonts/ and sw.js, so run `npm ci && npm run bundle && npm run cache`
// first (#325). The app shell comes from the service worker's precache list, so the two
// cannot drift apart. On top of that, the site needs the worker itself, the
// map boundary files it caches on first use, the demo session and its pieces (loaded by
// #demo and the WebMCP demo tool), package.json (read for the version shown
// in the app) and robots.txt.
//
// It also writes a Brotli (.br) and a gzip (.gz) copy of each text file, which server.js
// sends to browsers that accept them (#350). server.js compresses nothing itself, so
// without these the Docker image sent every file uncompressed. GitHub Pages compresses
// on its own and ignores them.
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");
const { execFileSync } = require("child_process");
const { appFiles, root } = require("./build-sw.js");

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
  const list = [...appFiles(), ...EXTRA_FILES, ...EXTRA_DIRS.flatMap(filesIn)];
  return [...new Set(list)].sort();
}

// The commit the site is built from, shown after the version in Help > About (#202).
// GIT_COMMIT wins (the Docker build passes it, since its context has no .git); otherwise
// git is asked. Null when neither is available, and the About dialog shows only the version.
function buildCommit() {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim() || null;
  } catch {
    return null;
  }
}

// The copy of package.json in the site carries the commit; the repository's stays as it is
function publishedPackageJson(source) {
  const pkg = JSON.parse(fs.readFileSync(source, "utf8"));
  const commit = buildCommit();
  if (commit) pkg.commit = commit;
  return JSON.stringify(pkg, null, 2) + "\n";
}

// Text compresses well; images, fonts (woff2 is already compressed) and anything this
// small don't gain enough to be worth a second request path
const COMPRESSIBLE = /\.(js|css|html|json|csv|svg|txt|wasm|nwk|fas|microbetrace)$/i;
const MIN_BYTES = 1024;
const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

// Writes file.br and file.gz beside each compressible file in dir, keeping a copy only
// when it is smaller than the file. The output depends only on the input (gzip's header
// has no time in it), so a rebuild writes the same bytes. Returns the files it tried.
async function compressSite(dir, files) {
  const targets = files.filter(file => COMPRESSIBLE.test(file) && fs.statSync(path.join(dir, file)).size >= MIN_BYTES);
  const compressOne = async file => {
    const source = path.join(dir, file);
    const data = fs.readFileSync(source);
    const [br, gz] = await Promise.all([
      brotli(data, { params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      } }),
      gzip(data, { level: zlib.constants.Z_BEST_COMPRESSION }),
    ]);
    if (br.length < data.length) fs.writeFileSync(source + ".br", br);
    if (gz.length < data.length) fs.writeFileSync(source + ".gz", gz);
  };
  // A few at a time: Brotli's best quality is slow on the large bundles, and runs off the main thread
  const queue = [...targets];
  const workers = Array.from({ length: Math.min(os.availableParallelism(), queue.length) }, async () => {
    while (queue.length) await compressOne(queue.shift());
  });
  await Promise.all(workers);
  return targets;
}

module.exports = { siteFiles, publishedPackageJson, compressSite };

async function main() {
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
    if (file === "package.json") fs.writeFileSync(dest, publishedPackageJson(path.join(root, file)));
    else fs.copyFileSync(path.join(root, file), dest);
  }
  console.log("Copied " + files.length + " files to " + path.relative(root, out) + "/");
  const compressed = await compressSite(out, files);
  console.log("Compressed " + compressed.length + " of them (.br and .gz)");
}

if (require.main === module) main().catch(error => { console.error(error); process.exit(1); });
