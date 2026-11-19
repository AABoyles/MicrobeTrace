// The files published to GitHub Pages (#196): the app and what it fetches at
// run time, and nothing else from the repository.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { siteFiles, publishedPackageJson } = require("../../scripts/build-site.js");
const { precacheList, root } = require("../../scripts/build-sw.js");

const files = siteFiles();

test("the published package.json names the build commit, and the repository's does not (#202)", () => {
  const saved = process.env.GIT_COMMIT;
  process.env.GIT_COMMIT = "abcdef0123";
  try {
    const published = JSON.parse(publishedPackageJson(path.join(root, "package.json")));
    assert.strictEqual(published.commit, "abcdef0");
    assert.strictEqual(published.version, require(path.join(root, "package.json")).version);
  } finally {
    if (saved === undefined) delete process.env.GIT_COMMIT; else process.env.GIT_COMMIT = saved;
  }
  assert.strictEqual(require(path.join(root, "package.json")).commit, undefined);
});

test("the site includes the app shell and the files it fetches at run time", () => {
  for (const file of precacheList()) assert.ok(files.includes(file), file + " is precached but not published");
  for (const file of ["sw.js", "package.json", "robots.txt", "demo/Demo_outbreak_session.microbetrace",
    "data/countries.json", "data/stars.json", "data/states.json", "data/counties.json",
    "data/zipcodes.csv", "data/tracts.csv"]) {
    assert.ok(files.includes(file), file + " is not published");
  }
});

test("the site leaves out tests, docs, build and server files", () => {
  const forbidden = /^(test|docs|scripts|node_modules|\.github)\/|^(server\.js|Dockerfile|package-lock\.json)$|\.md$/;
  const leaked = files.filter(file => forbidden.test(file));
  assert.deepStrictEqual(leaked, []);
});
