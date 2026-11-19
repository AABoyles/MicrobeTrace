// A sequence dataset past bench.spec.js's 2,000: 4,000 sequences, so about 8
// million pairs to compare, load through the Files view and get every link
// computed, within the test's timeout (#172)
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watchErrors, open } = require('./helpers');

const N = 4000;
const fasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-large-fasta-')), `large${N}.fasta`);
(() => {
  // The same generator as bench.spec.js: clusters of close sequences
  let seed = 11;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bases = 'ACGT', length = 1000;
  const base = Array.from({ length }, () => bases[Math.floor(random() * 4)]);
  const mutate = (s, k) => {
    s = s.slice();
    for (let i = 0; i < k; i++) s[Math.floor(random() * length)] = bases[Math.floor(random() * 4)];
    return s;
  };
  const centres = Array.from({ length: Math.ceil(N / 25) }, () => mutate(base, 60));
  fs.writeFileSync(fasta, Array.from({ length: N }, (_, i) => `>s${i}\n${mutate(centres[i % centres.length], 8).join('')}\n`).join(''));
})();

// Runs under the config's test timeout (90 s): about 6 s here, so a load that
// hangs or crawls fails the test rather than being waited out
test('4,000 sequences load and every pair gets its distance', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await page.setInputFiles('#data-files', fasta);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length == 1);
  const start = Date.now();
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 80000 });
  await page.waitForFunction(() => !document.querySelector('#loading-information-modal.show'), null, { timeout: 80000 });
  console.log(`Loading ${N} sequences took ${Date.now() - start} ms`);
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(N);
  expect(await page.evaluate(() => session.data.graph.edgeCount)).toBe(N * (N - 1) / 2);
  expect(errors).toEqual([]);
});
