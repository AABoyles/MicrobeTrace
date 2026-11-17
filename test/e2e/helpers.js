const path = require('path');

const fixtures = ['seqs.fasta', 'links.csv', 'nodes.csv'].map(f => path.join(__dirname, 'fixtures', f));

// Errors that happen on master too, so they don't fail a test. Each is a bug to
// fix; remove its pattern when it is.
const KNOWN_ERRORS = [];

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
  // Opaque isn't enough: until Bootstrap has finished the transition it ignores
  // hide() and hasn't yet moved focus into the dialog (its focus trap)
  const instance = window.bootstrap && bootstrap.Modal.getInstance(modal);
  return modal && modal.classList.contains('show') && getComputedStyle(modal).opacity == '1' &&
    !(instance && instance._isTransitioning);
}, selector);

// Answers the "Replace the current session?" question (asked when opening or
// recalling a session over loaded data) with Replace
async function confirmReplace(page) {
  await waitForModal(page, '#replace-modal');
  await page.evaluate(() => { window.replacing = session; });
  await page.click('#replace-button');
  // (The session is replaced once the dialog has gone)
  await page.waitForFunction(() => session !== window.replacing);
}

// Opens a view's export dialog from its button, once it has finished opening
async function openExport(page, view, title) {
  await view.locator(`button[title="${title}"]`).click();
  const modal = page.locator('.modal.show');
  await waitForModal(page, '.modal.show');
  return modal;
}

// Turns WebMCP on in this tab before the page loads (and again on reloads), as
// the switch in Settings > AI Agents does; webmcp-optin.spec.js tests the switch
const enableWebMCP = page => page.addInitScript(() => sessionStorage.setItem('microbetrace-webmcp', 'on'));

// Runs fn (which calls WebMCP tools in the page), clicking Allow in each
// confirmation dialog the calls raise, as the user would
async function allowing(page, fn) {
  let done = false;
  const allow = page.locator('#webmcp-confirm-allow');
  const clicker = (async () => {
    while (!done) {
      // Poll briefly for the dialog, but give the click itself time: it waits
      // for the button to hold still over two animation frames, and with
      // software WebGL (CI) a busy network can make frames slower than 200 ms
      try {
        await allow.waitFor({ state: 'visible', timeout: 200 });
        await allow.click({ timeout: 10000 });
      } catch (e) { /* none showing, or it closed */ }
      if (page.isClosed()) return;
    }
  })();
  try { return await fn(); } finally { done = true; await clicker; }
}

// Calls WebMCP tools in the page, allowing any that ask the user: call returns
// the plain result (or throws), fails the error message (or null), and agent
// the content blocks an agent would get
function webmcp(page) {
  const run = (method, name, args) => allowing(page, () => page.evaluate(([method, name, args]) => MTWebMCP[method](name, args), [method, name, args || {}]));
  return {
    call: (name, args) => run('call', name, args),
    agent: (name, args) => run('callAsAgent', name, args),
    fails: (name, args) => allowing(page, () => page.evaluate(([name, args]) => MTWebMCP.call(name, args).then(() => null, e => e.message), [name, args || {}]))
  };
}

// Opens MicrobeTrace and dismisses the license agreement. With webmcp: true,
// WebMCP is turned on first.
async function open(page, { webmcp = false } = {}) {
  if (webmcp) await enableWebMCP(page);
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
async function loadNetwork(page, options) {
  await open(page, options);
  await page.setInputFiles('#data-files', fixtures);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 3);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
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

// Reads a downloaded image in the page: its size, and how many colors it
// has (a blank image has one).
async function imageStats(page, download) {
  const data = require('fs').readFileSync(await download.path()).toString('base64');
  return page.evaluate(async data => {
    const blob = new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))]);
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) colors.add(pixels[i] << 16 | pixels[i + 1] << 8 | pixels[i + 2]);
    return { width: bitmap.width, height: bitmap.height, colors: colors.size };
  }, data);
}

module.exports = { confirmReplace, imageStats, fixtures, watchErrors, waitForModal, openExport, open, loadNetwork, launchView, viewNames, closeView, enableWebMCP, allowing, webmcp };
