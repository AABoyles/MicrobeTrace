// The service worker's precache list (#194, #343): the template has the markers
// build-sw.js fills in, the list it builds is the app shell (what startup loads, not
// the lazy libraries or the other views) and every file in it exists (a missing one makes cache.addAll, so the worker's
// install, fail), and the server never calls unversioned files immutable (#211).
// sw.js itself is generated and not committed (#325), so these render the
// template in memory. The list includes dist/, which needs `npm run bundle`.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { shellList, appFiles, pageFiles, importsOf, cacheName, render, templatePath, swPath, root, BEGIN, END } = require("../../scripts/build-sw.js");

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

test("every precached path exists, and the shell is rendered into the worker with a name for the whole app", { skip }, () => {
  const rendered = render(template);
  const listed = JSON.parse(rendered.match(/const PRECACHE = (\[[\s\S]*?\]);\n/)[1].replace(/,\s*\]$/, "]"));
  assert.ok(listed.length > 50);
  assert.deepStrictEqual(listed, shellList());
  assert.strictEqual(new Set(listed).size, listed.length);
  for (const file of listed) {
    assert.ok(fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(), file + " is precached but missing");
  }
  // The name covers every file the app loads, so a changed view or lazy bundle is a new version
  assert.ok(rendered.includes('const CACHE = "' + cacheName(appFiles()) + '";'));
  assert.strictEqual(render(rendered), rendered, "rendering is not repeatable");
});

test("the shell is the app's startup, not the whole app (#343)", { skip }, () => {
  const shell = shellList(), all = appFiles();
  // What a first visit needs
  for (const file of ["index.html", "dist/bundle.primary.js", "dist/bundle.primary.css", "components/files.html",
    "components/files.js", "src/common.js", "src/views.js", "src/formats/shared.js", "src/webmcp/core.js",
    "workers/parse-links.js", "vendor/papaparse.min.js", "fonts/bootstrap-icons.woff2"]) {
    assert.ok(shell.includes(file), file + " is needed at startup but not in the shell");
  }
  // What is cached when first used: the lazy libraries, the other views, cosmos.gl
  const lazy = fs.readdirSync(path.join(root, "dist")).filter(f => /^bundle\.(?!primary)/.test(f)).map(f => "dist/" + f);
  assert.ok(lazy.length >= 7, "the lazy bundles are missing");
  for (const file of [...lazy, "vendor/cosmos.min.js", "components/network.html", "components/network.js", "components/table.js"]) {
    assert.ok(all.includes(file), file + " is not in the app");
    assert.ok(!shell.includes(file), file + " is precached, but it is loaded when first used");
  }
  for (const file of shell) assert.ok(all.includes(file), file + " is in the shell but not the app");
  const bytes = list => list.reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0);
  assert.ok(bytes(shell) < 0.6 * bytes(all), "the shell is most of the app");
});

test("the shell follows the modules index.html loads", { skip }, () => {
  assert.ok(importsOf("src/mt.js").includes("src/common.js"));
  assert.ok(importsOf("src/common.js").includes("src/views.js"));
  assert.ok(importsOf("src/formats/index.js").includes("src/formats/fasta.js"));
  const shell = shellList();
  const local = pageFiles();
  assert.ok(local.length > 5);
  for (const file of local) assert.ok(shell.includes(file), file + " is loaded by index.html but not precached");
  // Every module the shell's modules import statically is in the shell
  for (const file of shell.filter(f => f.startsWith("src/") && f.endsWith(".js"))) {
    for (const imported of importsOf(file)) assert.ok(shell.includes(imported), file + " imports " + imported + ", which is not in the shell");
  }
});

test("server.js doesn't mark unversioned files immutable", () => {
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.ok(!/immutable/.test(server.replace(/\/\/.*$/gm, "")), "immutable caching of unhashed files");
  assert.match(server, /"Cache-Control", "no-cache"/);
});
