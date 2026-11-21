// dist/versions.json (#200): every library that ships in dist/ or vendor/ is
// listed, at the version package-lock.json installs. CI's bundle job checks
// the bundles themselves; this catches a dependency added without being listed.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const pkg = require(path.join(root, "package.json"));
const lock = require(path.join(root, "package-lock.json"));
const { packages } = require(path.join(root, "dist", "versions.json"));

// Used to build or test, not shipped
const TOOLS = ["@eslint/js", "@playwright/test", "axe-core", "cssnano", "esbuild", "eslint", "globals", "gzipper", "postcss"];

test("every shipped dependency is listed in dist/versions.json at its locked version", () => {
  for (const name of Object.keys(pkg.devDependencies)) {
    if (TOOLS.includes(name)) continue;
    assert.ok(packages[name], name + " is a dependency but not in dist/versions.json: add it to the list in scripts/bundle.js");
    assert.strictEqual(packages[name].version, lock.packages["node_modules/" + name].version, name + " in dist/versions.json differs from package-lock.json: run npm run bundle");
  }
});

test("dist/versions.json lists nothing that is not a dependency", () => {
  for (const name of Object.keys(packages)) {
    assert.ok(name in pkg.devDependencies, name + " is in dist/versions.json but not in package.json");
  }
});
