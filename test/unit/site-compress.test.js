// The built site carries .br and .gz copies of its text files, and server.js sends
// them (#350). server.js compresses nothing itself, so without the copies the Docker
// image sent every file uncompressed. Node runs each test file in its own process,
// so this one can point server.js at a small site of its own with SITE_DIR.
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { compressSite } = require("../../scripts/build-site.js");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mt-site-"));
const script = "// a script\n" + "function f(a, b) { return a + b; }\n".repeat(200);
const files = {
  "index.html": "<!DOCTYPE html><title>MicrobeTrace</title>\n" + "<p>text</p>\n".repeat(200),
  "dist/bundle.primary.js": script,
  "data/countries.json": JSON.stringify({ features: Array(200).fill({ type: "Feature" }) }),
  "src/small.js": "export const x = 1;\n",
  "fonts/icons.woff2": Buffer.alloc(4096, 7),
};
for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
}
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const exists = file => fs.existsSync(path.join(dir, file));

test("text files of 1 KB or more get .br and .gz copies that decompress to the file", async () => {
  await compressSite(dir, Object.keys(files));
  for (const file of ["index.html", "dist/bundle.primary.js", "data/countries.json"]) {
    const original = fs.readFileSync(path.join(dir, file));
    assert.deepStrictEqual(zlib.brotliDecompressSync(fs.readFileSync(path.join(dir, file + ".br"))), original, file + ".br");
    assert.deepStrictEqual(zlib.gunzipSync(fs.readFileSync(path.join(dir, file + ".gz"))), original, file + ".gz");
    assert.ok(fs.statSync(path.join(dir, file + ".br")).size < original.length / 4, file + " barely shrank");
  }
  // Too small to be worth it, and a font that is compressed already
  for (const file of ["src/small.js", "fonts/icons.woff2"]) {
    assert.ok(!exists(file + ".br") && !exists(file + ".gz"), file + " was compressed");
  }
});

test("compressing again writes the same bytes", async () => {
  const before = fs.readFileSync(path.join(dir, "dist/bundle.primary.js.gz"));
  await compressSite(dir, Object.keys(files));
  assert.deepStrictEqual(fs.readFileSync(path.join(dir, "dist/bundle.primary.js.gz")), before);
});

test("server.js sends the Brotli copy, or the gzip one, to a browser that accepts it, and the file to one that doesn't", async () => {
  if (!exists("index.html.br")) await compressSite(dir, Object.keys(files));
  process.env.SITE_DIR = dir;
  const server = http.createServer(require("../../server.js"));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  // fetch decompresses what it is sent, so ask with http.get and read the raw bytes
  const get = (url, encoding) => new Promise((resolve, reject) => {
    http.get(base + url, { headers: encoding ? { "Accept-Encoding": encoding } : {} }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
  try {
    const br = await get("/dist/bundle.primary.js", "gzip, deflate, br");
    assert.strictEqual(br.res.headers["content-encoding"], "br");
    assert.match(br.res.headers["content-type"], /javascript/);
    assert.match(br.res.headers.vary || "", /Accept-Encoding/i);
    assert.strictEqual(zlib.brotliDecompressSync(br.body).toString(), script);

    const gz = await get("/dist/bundle.primary.js", "gzip");
    assert.strictEqual(gz.res.headers["content-encoding"], "gzip");
    assert.strictEqual(zlib.gunzipSync(gz.body).toString(), script);

    const plain = await get("/dist/bundle.primary.js");
    assert.strictEqual(plain.res.headers["content-encoding"], undefined);
    assert.strictEqual(plain.body.toString(), script);

    const page = await get("/", "br");
    assert.strictEqual(page.res.headers["content-encoding"], "br");
    assert.match(page.res.headers["content-type"], /html/);
  } finally {
    server.close();
    delete process.env.SITE_DIR;
  }
});
