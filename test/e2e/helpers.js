const path = require('path');

const fixtures = ['seqs.fasta', 'links.csv', 'nodes.csv'].map(f => path.join(__dirname, 'fixtures', f));

// Errors that happen on master too, so they don't fail a test. Each is a bug to
// fix; remove its pattern when it is.
const KNOWN_ERRORS = [
  /reading 'checked'/,      // files view: a radio read before the view exists
  /ga is not defined/,      // Google Analytics, blocked or offline
  /googletagmanager|google-analytics|doubleclick/
];

// Collects page errors and console errors, minus the known ones above.
function watchErrors(page) {
  const errors = [];
  const add = text => { if (!KNOWN_ERRORS.some(p => p.test(text))) errors.push(text); };
  page.on('pageerror', e => add(e.message));
  page.on('console', m => {
    // Network failures (blocked analytics, offline map tiles) are not app errors
    if (m.type() == 'error' && !/Failed to load resource|net::ERR_|GL Driver/.test(m.text())) add(m.text());
  });
  return errors;
}

// Waits for a Bootstrap dialog to finish fading in: Bootstrap ignores hide()
// until it has, so a click that closes it would do nothing.
const waitForModal = (page, selector) => page.waitForFunction(selector => {
  const modal = document.querySelector(selector);
  return modal && modal.classList.contains('show') && getComputedStyle(modal).opacity == '1';
}, selector);

// Opens a view's export dialog from its button, once it has finished opening
async function openExport(page, view, title) {
  await view.locator(`button[title="${title}"]`).click();
  const modal = page.locator('.modal.show');
  await waitForModal(page, '.modal.show');
  return modal;
}

// Opens MicrobeTrace and dismisses the license agreement.
async function open(page) {
  await page.goto('/index.html');
  await page.waitForSelector('#data-files', { state: 'attached' });
  const accept = page.locator('#acceptAgreement');
  await accept.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await accept.isVisible()) {
    await waitForModal(page, 'div#licenseAgreement');
    await accept.click();
    await page.locator('div#licenseAgreement').waitFor({ state: 'hidden' });
  }
}

// Loads the fixture network (300 sequences, a links file and a nodes file) and
// waits for the default view and the network statistics.
async function loadNetwork(page) {
  await open(page);
  await page.setInputFiles('#data-files', fixtures);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 3);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && $('#numberOfNodes').text() != '', null, { timeout: 120000 });
  await page.waitForFunction(() => !layout.contentItems.some(i => i.componentType == 'files'));
}

const viewNames = page => page.evaluate(() => layout.contentItems.map(i => i.componentType));

// Launches a view and waits until its item is in the layout.
async function launchView(page, view) {
  await page.evaluate(view => MT.launchView(view), view);
  await page.waitForFunction(view => layout.contentItems.some(i => i.componentType == view), view);
}

async function closeView(page, view) {
  await page.evaluate(view => { const i = layout.contentItems.find(i => i.componentType == view); if (i) i.remove(); }, view);
}

module.exports = { fixtures, watchErrors, waitForModal, openExport, open, loadNetwork, launchView, viewNames, closeView };
