// The network from the keyboard (#181): the view takes the focus, the keys
// move between nodes, follow links, select, pin and open the node menu, and
// the status region says which node has the focus, as a ring on the canvas
// shows.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
});
test.afterAll(() => page.close());

const network = () => page.locator('.network-view');
const live = () => page.locator('.network-live');
const focused = () => page.evaluate(() => temp.network.focused);
const focusedId = () => page.evaluate(() => temp.network.points[temp.network.focused]._id);
const selected = () => page.evaluate(() => session.data.nodes.filter(d => d.selected).map(d => d._id));
// Where point i is in the view
const at = i => page.evaluate(i => {
  const { graph } = temp.network;
  const p = graph.getPointPositions();
  return graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
}, i);
// The IDs linked to point i, by the links drawn
const linked = i => page.evaluate(i => {
  const { points, links } = temp.network, id = points[i]._id;
  return links.filter(l => l.source == id || l.target == id).map(l => l.source == id ? l.target : l.source);
}, i);
// A point with this many links or more
const withLinks = n => page.evaluate(n => {
  const { points, links } = temp.network, count = new Map();
  links.forEach(l => [l.source, l.target].forEach(id => count.set(id, (count.get(id) || 0) + 1)));
  return points.findIndex(d => (count.get(d._id) || 0) >= n);
}, n);

test('the network is named, focusable, and says how to use it', async () => {
  await expect(network()).toHaveAttribute('role', 'application');
  await expect(network()).toHaveAttribute('tabindex', '0');
  const nodes = await page.evaluate(() => temp.network.points.length);
  await expect(network()).toHaveAttribute('aria-label', new RegExp(`^Network of ${nodes.toLocaleString('en-US')} nodes and 299 links in \\d+ clusters$`));
  await expect(page.locator('#network-keys-summary')).toContainText('Table view');
  await expect(live()).toHaveAttribute('aria-live', 'polite');
  // The key list, from its button
  const button = page.locator('.keys-button');
  await button.click();
  await expect(page.locator('#network-keys')).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await button.click();
  await expect(page.locator('#network-keys')).toBeHidden();
});

test('N and P step through the nodes, and the focused node is described and ringed', async () => {
  await network().focus();
  const total = await page.evaluate(() => temp.network.points.length);
  expect(await page.evaluate(() => temp.network.drawn.focus)).toBe(0);
  await page.keyboard.press('n');
  expect(await focused()).toBe(0);
  const id = await focusedId();
  await expect(live()).toHaveText(new RegExp(`^Node ${id}, 1 of ${total}\\. Cluster \\d+\\. .*(\\d+ links?: |No links)`));
  await expect.poll(() => page.evaluate(() => temp.network.drawn.focus)).toBe(1);
  await page.keyboard.press('n');
  expect(await focused()).toBe(1);
  await page.keyboard.press('p');
  await page.keyboard.press('p');
  expect(await focused()).toBe(total - 1);
  await expect(live()).toContainText(`${total} of ${total}`);
  await page.keyboard.press('Home');
  expect(await focused()).toBe(0);
  // I describes it again, and the same words again are spoken again
  await page.keyboard.press('i');
  await expect(live()).toHaveText(new RegExp(`^Node ${id}\\. Cluster`));
  const before = await live().textContent();
  await page.keyboard.press('i');
  expect((await live().textContent()).trim()).toBe(before.trim());
  expect(await live().textContent()).not.toBe(before);
  // The ring goes with the focus
  await page.locator('#search').focus();
  await expect.poll(() => page.evaluate(() => temp.network.drawn.focus)).toBe(0);
  await network().focus();
  await expect.poll(() => page.evaluate(() => temp.network.drawn.focus)).toBe(1);
});

test('the arrow keys move to the nearest node that way', async () => {
  await network().focus();
  await page.evaluate(() => temp.network.focus(Math.floor(temp.network.points.length / 2)));
  for (const [key, axis, sign] of [['ArrowRight', 0, 1], ['ArrowLeft', 0, -1], ['ArrowDown', 1, 1], ['ArrowUp', 1, -1]]) {
    const from = await focused(), start = await at(from);
    await page.keyboard.press(key);
    const to = await focused();
    if (to === from) {
      await expect(live()).toHaveText('No node that way.');
      continue;
    }
    expect(sign * ((await at(to))[axis] - start[axis])).toBeGreaterThan(0);
    await expect(live()).toContainText('Node ' + await focusedId());
  }
});

test('L follows the focused node’s links, closest first', async () => {
  const i = await withLinks(2);
  expect(i).toBeGreaterThanOrEqual(0);
  await page.evaluate(i => temp.network.focus(i), i);
  const from = await focusedId(), neighbours = await linked(i);
  await expect(live()).toContainText(`${neighbours.length} link${neighbours.length == 1 ? '' : 's'}: `);
  await page.keyboard.press('l');
  await expect(live()).toHaveText(new RegExp(`^Link 1 of ${neighbours.length} from ${from}, \\w+ [\\d.]+\\. Node `));
  const first = await focusedId();
  expect(neighbours).toContain(first);
  await page.keyboard.press('l');
  await expect(live()).toContainText(`Link 2 of ${neighbours.length} from ${from}`);
  expect(await focusedId()).not.toBe(first);
  await page.keyboard.press('Shift+L');
  expect(await focusedId()).toBe(first);
});

test('Enter selects, Ctrl+Enter adds, and Escape clears the selection, then the focus', async () => {
  // The settings pane stays open through Escape
  const pane = page.locator('.lm_content:has(.network-view) .left-pane');
  if (!await pane.isVisible()) await page.locator('button[title="Network Settings"]').click();
  await expect(pane).toBeVisible();
  await network().focus();
  await page.keyboard.press('Home');
  const a = await focusedId();
  await page.keyboard.press('Enter');
  expect(await selected()).toEqual([a]);
  await expect(live()).toHaveText(`${a} selected. 1 node selected.`);
  await expect.poll(() => page.evaluate(() => (temp.network.graph.config.outlinedPointIndices || []).length)).toBe(1);
  await page.keyboard.press('n');
  await expect(live()).toContainText('Node');
  const b = await focusedId();
  await page.keyboard.press('Control+Enter');
  expect((await selected()).sort()).toEqual([a, b].sort());
  await expect(live()).toHaveText(`${b} selected. 2 nodes selected.`);
  await page.keyboard.press('Control+Space');
  expect(await selected()).toEqual([a]);
  await page.keyboard.press('Escape');
  expect(await selected()).toEqual([]);
  await expect(live()).toHaveText('Selection cleared.');
  await expect(pane).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await focused()).toBeUndefined();
  await expect(live()).toHaveText('No node focused.');
  await expect.poll(() => page.evaluate(() => temp.network.drawn.focus)).toBe(0);
  await page.keyboard.press('Enter');
  await expect(live()).toContainText('No node is focused');
  await page.locator('button[title="Network Settings"]').click();
});

test('F pins and unpins the focused node', async () => {
  await network().focus();
  await page.keyboard.press('Home');
  const id = await focusedId();
  await page.keyboard.press('f');
  expect(await page.evaluate(() => temp.network.points[0].fixed)).toBe(true);
  await expect(live()).toHaveText(`${id} pinned.`);
  await page.keyboard.press('i');
  await expect(live()).toContainText('Pinned');
  await page.keyboard.press('f');
  expect(await page.evaluate(() => temp.network.points[0].fixed)).toBe(false);
  await expect(live()).toHaveText(`${id} unpinned.`);
});

test('M opens the node menu, whose items take the arrows, and Escape returns to the network', async () => {
  await network().focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('m');
  const menu = page.locator('.network-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.pin-node')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('.copy-id')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(menu.locator('.view-attributes')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(network()).toBeFocused();
  // Its items work from the keyboard, and the focus comes back
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => temp.network.points[0].fixed)).toBe(true);
  await expect(network()).toBeFocused();
  await page.keyboard.press('f');
  expect(await page.evaluate(() => temp.network.points[0].fixed)).toBe(false);
  // ...from the attributes dialog too
  await page.keyboard.press('m');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press(' ');
  await waitForModal(page, '.network-attribute-modal');
  await expect(page.locator('.network-attribute-modal tbody')).toContainText(await focusedId());
  await page.keyboard.press('Escape');
  await expect(page.locator('.network-attribute-modal')).toBeHidden();
  await expect(network()).toBeFocused();
});

test('the links described follow the threshold', async () => {
  const i = await withLinks(2);
  await page.evaluate(() => MT.settings.set('link-threshold', 0.005));
  await expect.poll(() => page.evaluate(() => temp.network.links.length)).toBeLessThan(299);
  await network().focus();
  const j = await page.evaluate(id => temp.network.points.findIndex(d => d._id == id), await page.evaluate(i => temp.network.points[i]._id, i));
  await page.evaluate(j => temp.network.focus(j), j);
  const neighbours = await linked(j);
  await expect(live()).toContainText(neighbours.length ? `${neighbours.length} link${neighbours.length == 1 ? '' : 's'}: ` : 'No links');
  await page.evaluate(() => MT.settings.set('link-threshold', 0.015));
  await expect.poll(() => page.evaluate(() => temp.network.links.length)).toBe(299);
  await expect(network()).toHaveAttribute('aria-label', /299 links/);
  expect(errors).toEqual([]);
});

// The nodes within r links of a node, by ID, found from the links drawn
const reach = (i, r) => page.evaluate(([i, r]) => {
  const { points, links } = temp.network;
  let ids = new Set([points[i]._id]);
  for (let step = 0; step < r; step++) {
    const grown = new Set(ids);
    links.forEach(l => {
      if (ids.has(l.source)) grown.add(l.target);
      if (ids.has(l.target)) grown.add(l.source);
    });
    ids = grown;
  }
  return Array.from(ids).sort();
}, [i, r]);

// G (#295): the focused node's neighbours, then one more link out per press
test('G selects the neighbours, then takes in one more link out each press; Shift+G adds them', async () => {
  // A node whose first two rings each add nodes
  const i = await page.evaluate(() => {
    const { points, links } = temp.network;
    const adjacent = new Map(points.map(d => [d._id, new Set()]));
    links.forEach(l => { adjacent.get(l.source)?.add(l.target); adjacent.get(l.target)?.add(l.source); });
    const rings = id => {
      let ids = new Set([id]);
      return [1, 2].map(() => {
        const next = new Set(ids);
        ids.forEach(x => adjacent.get(x)?.forEach(y => next.add(y)));
        ids = next;
        return ids.size;
      });
    };
    return points.findIndex(d => { const [one, two] = rings(d._id); return one > 1 && two > one; });
  });
  expect(i).toBeGreaterThanOrEqual(0);
  await network().focus();
  await page.evaluate(i => temp.network.focus(i), i);
  const id = await focusedId();
  await page.keyboard.press('g');
  let expected = await reach(i, 1);
  expect((await selected()).sort()).toEqual(expected);
  await expect(live()).toHaveText(new RegExp(`^${expected.length} nodes? within 1 link of ${id} selected\\. ${expected.length} nodes? selected in all\\.$`));
  await page.keyboard.press('g');
  expected = await reach(i, 2);
  expect((await selected()).sort()).toEqual(expected);
  await expect(live()).toContainText(`within 2 links of ${id} selected`);
  // Shift adds the nodes one more link out to the selection (if there are any)
  const three = await reach(i, 3);
  await page.keyboard.press('Shift+g');
  expect((await selected()).sort()).toEqual(three);
  if (three.length > expected.length) await expect(live()).toContainText(`within 3 links of ${id} selected`);
  else await expect(live()).toContainText('No more nodes within 2 links');
  // Pressing on until the group stops growing says so, and keeps the selection
  let before = null;
  for (let k = 0; k < 60; k++) {
    before = await selected();
    await page.keyboard.press('g');
    if (JSON.stringify(await selected()) === JSON.stringify(before)) break;
  }
  await expect(live()).toContainText('No more nodes within');
  expect((await selected()).sort()).toEqual(before.sort());
  // Moving the focus starts again from one link (or says the node has none)
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  await page.keyboard.press('g');
  await expect(live()).toHaveText(/within 1 link of \S+ selected|has no links/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  expect(await focused()).toBeUndefined();
  expect(errors).toEqual([]);
});

test('the key list and the summary name G', async () => {
  await network().focus();
  const button = page.locator('.keys-button');
  await button.click();
  await expect(page.locator('#network-keys')).toContainText('G / Shift+G');
  await button.click();
  await expect(page.locator('#network-keys-summary')).toContainText('G selects');
});
