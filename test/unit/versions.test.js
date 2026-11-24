// dist/versions.json (#200): every library that ships in dist/ or vendor/ is
// listed, at the version package-lock.json installs. dist/ is built (#325), so
// this is skipped until `npm run bundle` has run; it catches a dependency added
// without being listed.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const pkg = require(path.join(root, "package.json"));
const lock = require(path.join(root, "package-lock.json"));
const versionsPath = path.join(root, "dist", "versions.json");
const skip = fs.existsSync(versionsPath) ? false : "dist/ is missing: run `npm run bundle`";
const { packages } = skip ? { packages: {} } : require(versionsPath);

// Used to build or test, not shipped
const TOOLS = ["@eslint/js", "@playwright/test", "axe-core", "cssnano", "esbuild", "eslint", "globals", "gzipper", "postcss"];

test("every shipped dependency is listed in dist/versions.json at its locked version", { skip }, () => {
  for (const name of Object.keys(pkg.devDependencies)) {
    if (TOOLS.includes(name)) continue;
    assert.ok(packages[name], name + " is a dependency but not in dist/versions.json: add it to the list in scripts/bundle.js");
    assert.strictEqual(packages[name].version, lock.packages["node_modules/" + name].version, name + " in dist/versions.json differs from package-lock.json: run npm run bundle");
  }
});

test("dist/versions.json lists nothing that is not a dependency", { skip }, () => {
  for (const name of Object.keys(packages)) {
    assert.ok(name in pkg.devDependencies, name + " is in dist/versions.json but not in package.json");
  }
});
