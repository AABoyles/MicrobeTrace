/* global registeredTools -- set on window by the specs' page.evaluate calls */
// WebMCP is opt-in, and asks the user before consequential tools run (src/webmcp.js)
const { test, expect } = require('@playwright/test');
const { open, watchErrors, waitForModal } = require('./helpers');

// A stand-in for the browser's WebMCP, recording what is registered
const fakeModelContext = page => page.addInitScript(() => {
  window.registeredTools = new Map();
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool(tool, { signal }) {
        registeredTools.set(tool.name, tool);
        signal.addEventListener('abort', () => registeredTools.delete(tool.name));
      }
    }
  });
});

const registered = page => page.evaluate(() => registeredTools.size);
const toolCount = page => page.evaluate(() => MTWebMCP.list().length);

async function agentsTab(page) {
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  await page.click('#agents-tab');
  await expect(page.locator('#webmcp-enabled')).toBeVisible();
}

// Starts a tool call in the page, without waiting for it
const start = (page, name, args) => page.evaluate(([name, args]) => {
  window.pendingCall = MTWebMCP.call(name, args).then(value => ({ value }), error => ({ error: error.message }));
}, [name, args || {}]);
const settled = page => page.evaluate(() => window.pendingCall);
const dialog = page => page.locator('#webmcp-confirm');

test('WebMCP is off until the user turns it on, for this tab only', async ({ page, context }) => {
  const errors = watchErrors(page);
  await fakeModelContext(page);
  await open(page);
  await page.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('get_status'));

  // Off: nothing registered, and calls from the page fail
  expect(await page.evaluate(() => MTWebMCP.enabled())).toBe(false);
  expect(await registered(page)).toBe(0);
  await expect(page.evaluate(() => MTWebMCP.call('get_status'))).rejects.toThrow(/turned off/);
  const asAgent = await page.evaluate(() => MTWebMCP.callAsAgent('get_status'));
  expect(asAgent.isError).toBe(true);

  // A script can't turn it on through the switch
  await page.evaluate(() => {
    const box = document.getElementById('webmcp-enabled');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => MTWebMCP.enabled())).toBe(false);
  expect(await page.isChecked('#webmcp-enabled')).toBe(false);

  // The user turns it on: every tool is registered
  await agentsTab(page);
  await expect(page.locator('#webmcp-status')).toContainText('Off');
  await page.locator('#webmcp-enabled').check();
  expect(await page.evaluate(() => MTWebMCP.enabled())).toBe(true);
  const count = await toolCount(page);
  expect(count).toBeGreaterThan(90);
  expect(await registered(page)).toBe(count);
  await expect(page.locator('#webmcp-status')).toContainText(count + ' tools');
  expect((await page.evaluate(() => MTWebMCP.call('get_status'))).loaded).toBe(false);
  // Descriptions warn that results are untrusted data
  const descriptions = await page.evaluate(() => Object.fromEntries(MTWebMCP.list().map(t => [t.name, t.description])));
  expect(descriptions.query_nodes).toMatch(/Untrusted data/);
  expect(descriptions.get_session_json).toMatch(/Untrusted data/);
  expect(descriptions.list_palettes).not.toMatch(/Untrusted data/);

  // A reload of this tab keeps it on
  await page.reload();
  await page.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('get_view_image'));
  await page.waitForFunction(() => document.readyState == 'complete');
  expect(await page.evaluate(() => MTWebMCP.enabled())).toBe(true);
  expect(await registered(page)).toBe(count);

  // Another tab starts with it off
  const other = await context.newPage();
  await fakeModelContext(other);
  await open(other);
  await other.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('get_status'));
  expect(await other.evaluate(() => MTWebMCP.enabled())).toBe(false);
  expect(await registered(other)).toBe(0);
  await other.close();

  // Turning it off unregisters everything, and is remembered
  await agentsTab(page);
  await expect(page.locator('#webmcp-enabled')).toBeChecked();
  await page.locator('#webmcp-enabled').uncheck();
  expect(await registered(page)).toBe(0);
  await expect(page.evaluate(() => MTWebMCP.call('get_status'))).rejects.toThrow(/turned off/);
  await page.reload();
  await page.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('get_status'));
  expect(await page.evaluate(() => MTWebMCP.enabled())).toBe(false);
  expect(errors).toEqual([]);
});

test.describe('with WebMCP on', () => {
  test.beforeEach(async ({ page }) => {
    await fakeModelContext(page);
    await open(page, { webmcp: true });
    await page.waitForFunction(() => window.MTWebMCP && MTWebMCP.tools.has('set_autostash') && MTWebMCP.tools.has('invoke_view_action'));
  });

  test('the tools that ask the user', async ({ page }) => {
    const asks = await page.evaluate(() => MTWebMCP.list().filter(t => t.asksUser).map(t => t.name).sort());
    expect(asks).toEqual(['add_file', 'apply_style', 'delete_stash', 'export_view', 'generate_sequences', 'invoke_view_action', 'launch',
      'load_demo', 'new_session', 'open_session', 'recall_stash', 'reset_style', 'save_session', 'set_autostash', 'stash_session']);
    const descriptions = await page.evaluate(() => Object.fromEntries(MTWebMCP.list().map(t => [t.name, t.description])));
    expect(descriptions.delete_stash).toMatch(/user must allow this/);
    expect(descriptions.get_status).not.toMatch(/user must allow this/);
  });

  test('a consequential tool waits for the user, who can decline', async ({ page }) => {
    const errors = watchErrors(page);
    const autostash = () => page.evaluate(() => db.getItem('stash-auto'));
    const before = await autostash();

    // Reading needs no permission
    expect((await page.evaluate(() => MTWebMCP.call('get_autostash'))).autostash).toBe(before == 'true');
    await expect(dialog(page)).toBeHidden();

    // Don't Allow
    await start(page, 'set_autostash', { enabled: true });
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('#webmcp-confirm-tool')).toHaveText('set_autostash');
    await expect(page.locator('#webmcp-confirm-message')).toContainText('Turn autostash on');
    await expect(page.locator('#webmcp-confirm-deny')).toBeFocused();
    // A script's click is not the user's
    await page.evaluate(() => document.getElementById('webmcp-confirm-allow').click());
    // Waits to see the dialog stay open, as a click that isn't the user's must not close it
    await page.waitForTimeout(200);
    await expect(dialog(page)).toBeVisible();
    await page.click('#webmcp-confirm-deny');
    expect((await settled(page)).error).toMatch(/The user did not allow set_autostash/);
    await expect(dialog(page)).toBeHidden();
    expect(await autostash()).toBe(before);

    // Escape declines too
    await start(page, 'set_autostash', { enabled: true });
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    expect((await settled(page)).error).toMatch(/did not allow/);
    expect(await autostash()).toBe(before);

    // Allow
    await start(page, 'set_autostash', { enabled: true });
    await page.click('#webmcp-confirm-allow');
    expect((await settled(page)).value).toEqual({ autostash: true });
    expect(await autostash()).toBe('true');
    // Turning it off doesn't ask
    expect(await page.evaluate(() => MTWebMCP.call('set_autostash', { enabled: false }))).toEqual({ autostash: false });
    await expect(dialog(page)).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('an agent is told it was declined; the dialog shows its text as text', async ({ page }) => {
    // Through the registered tool, as the browser would call it
    await page.evaluate(() => {
      window.pendingCall = registeredTools.get('add_file').execute({ name: '<img src=x onerror="window.pwned=1">.csv', contents: 'a,b\n1,2' });
    });
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('#webmcp-confirm-message')).toContainText('<img src=x');
    expect(await page.locator('#webmcp-confirm img').count()).toBe(0);
    await page.click('#webmcp-confirm-deny');
    const result = await settled(page);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/did not allow add_file/);
    expect(await page.evaluate(() => session.files.length)).toBe(0);
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  });

  test('requests wait their turn, and turning WebMCP off declines them', async ({ page }) => {
    await page.evaluate(() => {
      window.first = MTWebMCP.call('set_autostash', { enabled: true }).then(() => 'allowed', e => e.message);
      window.second = MTWebMCP.call('delete_stash', { name: 'nothing' }).then(() => 'allowed', e => e.message);
    });
    await expect(page.locator('#webmcp-confirm-tool')).toHaveText('set_autostash');
    await page.evaluate(() => MTWebMCP.setEnabled(false));
    expect(await page.evaluate(() => window.first)).toMatch(/did not allow|turned off/);
    expect(await page.evaluate(() => window.second)).toMatch(/did not allow|turned off/);
    await expect(dialog(page)).toBeHidden();
    expect(await page.evaluate(() => db.getItem('stash-auto'))).not.toBe('true');
  });
});
