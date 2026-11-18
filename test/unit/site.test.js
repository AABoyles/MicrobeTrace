// The files published to GitHub Pages (#196): the app and what it fetches at
// run time, and nothing else from the repository.
const test = require("node:test");
const assert = require("node:assert");
const { siteFiles } = require("../../scripts/build-site.js");
const { precacheList } = require("../../scripts/build-sw.js");

const files = siteFiles();

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
