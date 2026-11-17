// The service worker's precache list (#194): every file in it exists (a missing
// one makes cache.addAll, so the worker's install, fail), the generated block
// in sw.js is current (a stale one means users keep an old version, or none),
// and the server never calls unversioned files immutable (#211).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { precacheList, render, swPath, root } = require("../../scripts/build-sw.js");

const source = fs.readFileSync(swPath, "utf8");
const listed = JSON.parse(source.match(/const PRECACHE = (\[[\s\S]*?\]);\n/)[1].replace(/,\s*\]$/, "]"));

test("every precached path exists on disk", () => {
  assert.ok(listed.length > 50);
  for (const file of listed) {
    assert.ok(fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(), file + " is precached but missing");
  }
});

test("the precache list has no duplicates and covers what index.html loads", () => {
  assert.strictEqual(new Set(listed).size, listed.length);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const local = [...html.matchAll(/(?:src|href)="((?:src|dist|vendor|fonts|img|workers)\/[^"?#]+)"/g)].map(m => m[1]);
  assert.ok(local.length > 5);
  for (const file of local) assert.ok(listed.includes(file), file + " is loaded by index.html but not precached");
});

test("sw.js is up to date: run `npm run cache` after changing a precached file", () => {
  assert.deepStrictEqual(listed, precacheList());
  assert.strictEqual(render(source), source);
});

test("server.js doesn't mark unversioned files immutable", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.ok(!/immutable/.test(server.replace(/\/\/.*$/gm, "")), "immutable caching of unhashed files");
  assert.match(server, /"Cache-Control", "no-cache"/);
});
