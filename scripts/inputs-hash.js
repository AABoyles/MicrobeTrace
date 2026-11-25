// A hash of everything scripts/bundle.js reads besides node_modules (#345): the
// lockfile, the build scripts, the entry modules and the PostCSS config.
// bundle.js records it in dist/versions.json and ensure-built.js compares against
// it, so a build is redone when an input changes and not when git checkout or a
// cache restore merely touches file times.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const FILES = ["package-lock.json", "postcss.config.js", "scripts/bundle.js",
  "scripts/minify-css.js", "scripts/write-versions.js", "scripts/inputs-hash.js"];
const DIRECTORIES = ["scripts/entries"];

// Paths use "/" whatever the platform, so the hash is the same on Windows (#328).
function inputFiles(base = root) {
  const files = [...FILES];
  for (const dir of DIRECTORIES) {
    for (const name of fs.readdirSync(path.join(base, dir)).sort()) files.push(dir + "/" + name);
  }
  return files;
}

// Hex sha256 over each input's name and bytes. The name and length go in so that
// moving bytes from one file to the next changes the hash.
function inputsHash(base = root) {
  const hash = crypto.createHash("sha256");
  for (const file of inputFiles(base)) {
    const bytes = fs.readFileSync(path.join(base, file));
    hash.update(file + "\0" + bytes.length + "\0").update(bytes);
  }
  return hash.digest("hex");
}

module.exports = { inputsHash, inputFiles };
