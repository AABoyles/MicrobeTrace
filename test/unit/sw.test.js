// The service worker's precache list (#194): the template has the markers
// build-sw.js fills in, the list it builds covers everything the app loads and
// every file in it exists (a missing one makes cache.addAll, so the worker's
// install, fail), and the server never calls unversioned files immutable (#211).
// sw.js itself is generated and not committed (#325), so these render the
// template in memory. The list includes dist/, which needs `npm run bundle`.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { precacheList, cacheName, render, templatePath, swPath, root, BEGIN, END } = require("../../scripts/build-sw.js");

const template = fs.readFileSync(templatePath, "utf8");
const skip = fs.existsSync(path.join(root, "dist", "versions.json")) ? false : "dist/ is missing: run `npm run bundle`";

test("the template has one generated block, and the rest of the worker uses what it defines", () => {
  assert.strictEqual(template.split(BEGIN).length, 2);
  assert.strictEqual(template.split(END).length, 2);
  assert.ok(template.indexOf(BEGIN) < template.indexOf(END));
  assert.match(template, /caches\.open\(CACHE\)/);
  assert.match(template, /PRECACHE\.map/);
  assert.doesNotMatch(template, /const (CACHE|PRECACHE) =/, "the template must not define what is generated");
});

test("the page registers the worker at the site root, where build-sw.js writes it", () => {
  assert.strictEqual(path.relative(root, swPath), "sw.js");
  assert.match(fs.readFileSync(path.join(root, "src", "index.js"), "utf8"), /serviceWorker\.register\("sw\.js"\)/);
});

test("every precached path exists on disk, and the list covers everything in the app's directories", { skip }, () => {
  const rendered = render(template);
  const listed = JSON.parse(rendered.match(/const PRECACHE = (\[[\s\S]*?\]);\n/)[1].replace(/,\s*\]$/, "]"));
  assert.ok(listed.length > 50);
  assert.deepStrictEqual(listed, precacheList());
  assert.strictEqual(new Set(listed).size, listed.length);
  for (const file of listed) {
    assert.ok(fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(), file + " is precached but missing");
  }
  for (const dir of ["src", "dist", "vendor", "workers", "components", "fonts", "img"]) {
    assert.ok(listed.some(file => file.startsWith(dir + "/")), dir + "/ has nothing in the precache list");
  }
  assert.ok(rendered.includes('const CACHE = "' + cacheName(listed) + '";'));
  assert.strictEqual(render(rendered), rendered, "rendering is not repeatable");
});

test("the precache list covers what index.html loads", { skip }, () => {
  const listed = precacheList();
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const local = [...html.matchAll(/(?:src|href)="((?:src|dist|vendor|fonts|img|workers)\/[^"?#]+)"/g)].map(m => m[1]);
  assert.ok(local.length > 5);
  for (const file of local) assert.ok(listed.includes(file), file + " is loaded by index.html but not precached");
});

test("server.js doesn't mark unversioned files immutable", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.ok(!/immutable/.test(server.replace(/\/\/.*$/gm, "")), "immutable caching of unhashed files");
  assert.match(server, /"Cache-Control", "no-cache"/);
});
