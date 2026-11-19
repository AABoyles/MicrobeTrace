// Loading the injection files in test/security/ runs no script and puts no
// injected element in the page (#218): values are stored as loaded, so every
// place that shows them has to show them as text. Each file is loaded, then
// the views that show IDs, names and values are opened and every field is
// tried as the color variable (which fills the color tables and legends).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { watchErrors, open, launchView } = require('./helpers');

const security = name => path.join(__dirname, '../security', name);
const files = [
  'fastaIDInjection.fasta', 'fastaSequenceInjection.fasta',
  'linksFieldnameInjection.csv', 'linksValueInjection.csv',
  'nodesFieldnameInjection.csv', 'nodesValueInjection.csv',
  'sessionInjection.microbetrace', 'hivtraceInjection.json'
];

// A file added to test/security/ must be loaded by the loop below (#173)
test('every file in test/security/ is loaded by this spec', () => {
  const present = fs.readdirSync(path.join(__dirname, '../security')).filter(name => !/^(README\.md|pwn\.js)$/.test(name));
  expect(present.sort()).toEqual([...files].sort());
});

for (const name of files) {
  test(`loading ${name} runs no script and adds no element`, async ({ browser }) => {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    const dialogs = [], requests = [];
    page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });
    page.on('request', request => { if (/\/x$|pwn\.js/.test(request.url())) requests.push(request.url()); });
    await open(page);
    // What the payloads do (pwn.js and the onerror handlers) is raise an error toast
    await page.evaluate(() => {
      window.pwned = [];
      for (const kind of ['error', 'warning', 'info', 'success']) {
        const toast = MT.toast[kind];
        MT.toast[kind] = (message, ...rest) => { if (/pwned/.test(message)) window.pwned.push(message); return toast(message, ...rest); };
      }
    });
    // (HIV-TRACE output is read as such by its extension)
    const hivtrace = name.endsWith('.json');
    const file = hivtrace ? { name: 'trace.hivtrace', mimeType: 'application/json', buffer: fs.readFileSync(security(name)) } : security(name);
    await page.setInputFiles('#data-files', file);
    if (!hivtrace && !name.endsWith('.microbetrace')) {
      await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 1);
      await page.click('#launch');
    }
    await page.waitForFunction(() => session.data.nodes.length > 0 || session.data.graph.m > 0, null, { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('#loading-information-modal.show') && !layout.contentItems.some(i => i.componentType == 'files'), null, { timeout: 60000 });

    for (const view of ['table', 'aggregation', 'crosstab', 'network']) {
      await launchView(page, view);
    }
    await page.evaluate(() => {
      const columns = document.querySelector('.table-columns');
      if (columns && columns.tomselect) columns.tomselect.setValue(Array.from(columns.options).map(o => o.value));
      session.data.nodeFields.forEach(field => MT.settings.set('node-color-variable', field));
      session.data.linkFields.forEach(field => MT.settings.set('link-color-variable', field));
    });
    // A payload's effects would show up soon after the views draw; this gives
    // them time to, before the checks below find none
    await page.waitForTimeout(500);

    // Neither the markup nor its effects: no dialog, request, element or toast
    // (The payloads' text may well be shown: as text)
    const found = await page.evaluate(() => ({
      elements: document.querySelectorAll('script[src*="pwn"], img[src="x"], [onerror]').length,
      pwned: window.pwned
    }));
    expect(found).toEqual({ elements: 0, pwned: [] });
    expect(dialogs).toEqual([]);
    expect(requests).toEqual([]);
    // (A crosstab opened on data with no categories, as FASTA alone is, trips Tabulator's redraw: not this test's concern)
    expect(errors.filter(e => !/reading 'offsetWidth'/.test(e))).toEqual([]);
    await page.close();
  });
}

test('IDs and values are stored as loaded, not as HTML entities', async ({ browser }) => {
  const page = await browser.newPage();
  await open(page);
  const csv = 'id,note\nA/B<1>,"x & y <b>"\n';
  await page.setInputFiles('#data-files', { name: 'nodes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length == 1, null, { timeout: 60000 });
  expect(await page.evaluate(() => [session.data.nodes[0]._id, session.data.nodes[0].note])).toEqual(['A/B<1>', 'x & y <b>']);
  await page.close();
});
