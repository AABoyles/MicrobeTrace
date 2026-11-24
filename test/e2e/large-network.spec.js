// A large network lays out as a round cloud, not piled against a wall of the
// simulation space in an opaque square (#152). cosmos.gl 3.6 doesn't bound
// positions by spaceSize; a wall would put many nodes on the layout's extreme
// coordinates, so few nodes should sit at them.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watchErrors, open } = require('./helpers');

const N = 8000;
const links = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-large-')), 'links.csv');
(() => {
  let seed = 3;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let out = 'source,target,distance\n';
  for (let i = 1; i < N; i++) {
    if (i % 6 === 0 && random() < 0.5) continue;
    const j = i % 6 === 0 ? Math.floor(random() * i) : i - 1 - Math.floor(random() * Math.min(i, 3));
    out += `n${i},n${Math.max(0, j)},${(random() * 0.01).toFixed(4)}\n`;
  }
  fs.writeFileSync(links, out);
})();

test('a large network does not pile its nodes against the edge of the space', async ({ page }) => {
  test.setTimeout(300000);
  const errors = watchErrors(page);
  await open(page);
  await page.setInputFiles('#data-files', links);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length === 1);
  await page.click('#launch');
  await page.waitForFunction(n => temp.network && temp.network.points.length > n, N / 2, { timeout: 120000 });
  // Lets the layout settle: the simulation doesn't stop on its own at this size
  // (waiting for it to stop timed out), and no other event marks the end
  await page.waitForTimeout(20000);
  const edge = await page.evaluate(() => {
    const p = temp.network.graph.getPointPositions();
    const n = p.length / 2;
    let edge = 0;
    const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (let i = 0; i < p.length; i++) {
      lo[i & 1] = Math.min(lo[i & 1], p[i]);
      hi[i & 1] = Math.max(hi[i & 1], p[i]);
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        const v = p[2 * i + k], margin = 0.01 * (hi[k] - lo[k]);
        if (v - lo[k] < margin || hi[k] - v < margin) { edge++; break; }
      }
    }
    return { n, edge: edge / n };
  });
  expect(edge.n).toBeGreaterThan(N / 2);
  expect(edge.edge).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});
