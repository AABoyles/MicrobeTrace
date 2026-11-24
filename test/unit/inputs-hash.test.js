// scripts/inputs-hash.js (#345): the hash that says whether dist/ is out of date.
// It must repeat for the same inputs and change when any one of them does.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { inputsHash, inputFiles } = require("../../scripts/inputs-hash");

const real = path.join(__dirname, "..", "..");

// A copy of the inputs in a scratch directory, so a test can change one
function copyInputs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mt-hash-"));
  for (const file of inputFiles(real)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(real, file), path.join(dir, file));
  }
  return dir;
}

test("the hash is a repeatable sha256", () => {
  assert.match(inputsHash(), /^[0-9a-f]{64}$/);
  assert.strictEqual(inputsHash(), inputsHash());
});

test("a copy of the inputs has the same hash, whatever the file times", () => {
  const dir = copyInputs();
  try {
    assert.strictEqual(inputsHash(dir), inputsHash(real));
    const old = new Date(2000, 0, 1);
    for (const file of inputFiles(dir)) fs.utimesSync(path.join(dir, file), old, old);
    assert.strictEqual(inputsHash(dir), inputsHash(real));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("changing any input changes the hash", () => {
  const dir = copyInputs();
  try {
    const before = inputsHash(dir);
    for (const file of inputFiles(dir)) {
      const full = path.join(dir, file);
      const original = fs.readFileSync(full);
      fs.appendFileSync(full, "\n");
      assert.notStrictEqual(inputsHash(dir), before, file + " is not covered by the hash");
      fs.writeFileSync(full, original);
    }
    assert.strictEqual(inputsHash(dir), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the hash covers the lockfile, the build scripts and every entry module", () => {
  const files = inputFiles(real);
  for (const file of ["package-lock.json", "scripts/bundle.js", "scripts/plotly-bundle.js", "scripts/buffer-shim.js",
    "scripts/minify-css.js", "scripts/write-versions.js", "postcss.config.js",
    "scripts/entries/primary.js", "scripts/entries/xlsx.js", "scripts/entries/map.js"]) {
    assert.ok(files.includes(file), file + " is missing");
  }
});
