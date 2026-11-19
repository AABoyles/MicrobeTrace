// Unit tests for MT.fillSelect in src/ui.js (#204): field
// names from loaded files (sessions, HIV-TRACE and GHOST output, which aren't
// escaped as they load) must reach the variable menus as text, never markup.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const APP_FILES = require('../app-files.js');

const root = path.join(__dirname, '../..');
const fixture = name => JSON.parse(fs.readFileSync(path.join(root, 'test/security', name), 'utf8'));

// A stand-in for anything common.js touches in the page as it loads
const stub = () => new Proxy(function() {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub(),
  apply: () => stub(),
  construct: () => stub()
});

// Just enough of the DOM for a menu. Markup (innerHTML and the like) throws:
// the menus must be built of elements.
function fakeDocument() {
  const markup = () => { throw new Error('markup was parsed'); };
  const element = tag => {
    const el = {
      tagName: tag.toUpperCase(), children: [], ownerDocument: doc,
      value: '', textContent: '', selected: false, defaultSelected: false,
      appendChild(child) { el.children.push(child); return child; },
      replaceChildren(...children) { el.children = children; },
      insertAdjacentHTML: markup
    };
    Object.defineProperty(el, 'innerHTML', { get: () => '', set: markup });
    Object.defineProperty(el, 'outerHTML', { get: () => '', set: markup });
    return el;
  };
  const doc = { createElement: element };
  return doc;
}
const select = () => fakeDocument().createElement('select');
const options = el => el.children.map(o => ({ value: o.value, text: o.textContent, selected: o.selected }));

function load() {
  const ctx = {
    console: { log() {}, error() {}, warn() {} },
    TextDecoder, TextEncoder,
    MTSettings: require('../../src/settings.js'),
    MTSessionFormat: require('../../src/session-format.js'),
    MTDates: require('../../src/dates.js'),
    MTEvents: require('../../src/events.js'),
    MTGraph: require('../../src/graph.js'),
    MTNodeSources: require('../../src/nodes.js'),
    d3: { schemePaired: ['#a6cee3', '#1f78b4'], schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c'] },
    document: stub()
  };
  ctx.self = ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of APP_FILES) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: path.join(root, file) });
  // MT.escape is defined in src/index.js, as the page loads: take it from there
  const escape = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8').match(/const escape = (value => .*);\n/)[1];
  ctx.MT.escape = vm.runInContext('(' + escape + ')', ctx);
  return { MT: ctx.MT, ctx };
}

const payload = 'x"><img src=x onerror="alert(1)">';

test('fillSelect makes an option per field, its value the field and its text the title', () => {
  const { MT } = load();
  const el = MT.fillSelect(select(), ['index', 'transmission_risk', 'id']);
  assert.deepStrictEqual(options(el), [
    { value: 'index', text: 'Index', selected: false },
    { value: 'transmission_risk', text: 'Transmission Risk', selected: false },
    { value: 'id', text: 'ID', selected: false }
  ]);
});

test('fillSelect puts None first, prefixes, labels, appends and selects', () => {
  const { MT } = load();
  const el = MT.fillSelect(select(), ['distance'], { none: true, prefix: 'links-', label: 'Link ' });
  MT.fillSelect(el, ['age', 'gender'], { prefix: 'nodes-', label: 'Node ', append: true, selected: ['nodes-gender'] });
  assert.deepStrictEqual(options(el), [
    { value: 'None', text: 'None', selected: false },
    { value: 'links-distance', text: 'Link Distance', selected: false },
    { value: 'nodes-age', text: 'Node Age', selected: false },
    { value: 'nodes-gender', text: 'Node Gender', selected: true }
  ]);
  // Without append, what was there goes
  MT.fillSelect(el, ['age'], { selected: 'age' });
  assert.deepStrictEqual(options(el), [{ value: 'age', text: 'Age', selected: true }]);
});

test('fillSelect gives a field that is markup as text, and the field itself as its value', () => {
  const { MT } = load();
  const el = MT.fillSelect(select(), [payload, 7], { none: true });
  assert.strictEqual(el.children.length, 3);
  assert.strictEqual(el.children[1].value, payload);
  assert.strictEqual(el.children[1].textContent, 'X"><img Src=x Onerror="alert(1)">');
  assert.strictEqual(el.children[2].value, '7'); // a number for a name doesn't break it
});

test('fillSelect shows a field as it was written (names are stored as loaded, #218)', () => {
  const { MT } = load();
  const field = 'HIV+ & HCV+ <2y / "risk"';
  const option = MT.fillSelect(select(), [field]).children[0];
  assert.strictEqual(option.value, field); // the field's name, as the nodes have it
  assert.strictEqual(option.textContent, 'Hiv+ & Hcv+ <2y / "risk"');
  // A name that happens to contain an entity is just text too
  assert.strictEqual(MT.fillSelect(select(), ['a&amp;b']).children[0].textContent, 'A&amp;b');
});

test('an HIV-TRACE file keeps its attribute names as they are, and its menus show them as text', () => {
  const { MT, ctx } = load();
  MT.runHamsters = () => {};
  const hivtrace = fixture('hivtraceInjection.json');
  MT.applyHIVTrace(hivtrace);
  const field = Object.keys(hivtrace.trace_results.Nodes[0].patient_attributes).find(f => f.includes('<img'));
  const fields = ctx.session.data.nodeFields;
  assert.ok(fields.includes(field) && fields.includes('note'));
  const node = ctx.session.data.nodes.find(d => d._id == 'P2');
  assert.strictEqual(node[field], hivtrace.trace_results.Nodes[1].patient_attributes[field]);
  const el = MT.fillSelect(select(), fields, { none: true });
  const option = el.children.find(o => o.value == field);
  assert.ok(option, 'the attribute is offered');
  assert.ok(option.textContent.includes('<img'), 'as text');
  assert.strictEqual(el.children.length, fields.length + 1);
});

test('a session keeps its names and values as saved (they are not escaped again), and its menus show them as text', () => {
  const { MT, ctx } = load();
  const saved = fixture('sessionInjection.microbetrace');
  ctx.session = MT.sessionSkeleton();
  ctx.temp = MT.tempSkeleton();
  MT.reset = () => { ctx.session = MT.sessionSkeleton(); };
  MT.applyStyle = style => { ctx.session.style = style; };
  MT.finishUp = () => {};
  MT.applySession(saved);
  const nodeField = saved.data.nodeFields.find(f => f.includes('<img'));
  const linkField = saved.data.linkFields.find(f => f.includes('<img'));
  assert.ok(ctx.session.data.nodeFields.includes(nodeField));
  assert.ok(ctx.session.data.linkFields.includes(linkField));
  const s1 = ctx.session.data.nodes.find(d => d._id == 'S1');
  assert.strictEqual(s1.note, saved.data.nodes[0].note);
  // As the views' menus are filled (setupView)
  const mixed = MT.fillSelect(select(), ctx.session.data.linkFields, { none: true, prefix: 'links-', label: 'Link ' });
  MT.fillSelect(mixed, ctx.session.data.nodeFields, { prefix: 'nodes-', label: 'Node ', append: true });
  assert.strictEqual(mixed.children.length, 1 + ctx.session.data.linkFields.length + ctx.session.data.nodeFields.length);
  assert.ok(mixed.children.some(o => o.value == 'nodes-' + nodeField && o.textContent.startsWith('Node Gender"><img')));
  assert.ok(mixed.children.some(o => o.value == 'links-' + linkField && o.textContent.startsWith('Link Kind"><img')));
});

test('IDs are text without surrounding spaces, however they arrive (#219), and are not escaped (#218)', () => {
  const { MT, ctx } = load();
  ctx.session = MT.sessionSkeleton();
  ctx.temp = MT.tempSkeleton();
  assert.strictEqual(MT.cleanID(' 007 '), '007');
  assert.strictEqual(MT.cleanID(7), '7');
  assert.strictEqual(MT.cleanID(null), '');
  MT.addNode({ _id: ' A/California/07/2009 ' });
  MT.addNode({ id: 'A/California/07/2009' });
  assert.deepStrictEqual(Array.from(ctx.session.data.nodes, d => d._id), ['A/California/07/2009']);
  MT.addLink({ source: ' A/California/07/2009', target: 'B ' });
  assert.ok(MT.getLink('A/California/07/2009', 'B'));
  assert.strictEqual(MT.addLink({ source: 'B', target: ' B' }), 0); // a self-link
});

test('no menu of fields is built as markup any more', () => {
  // An option whose value or text is interpolated without escaping
  const unsafe = /<option value="(?:'\s*\+|\$\{(?!MT\.escape\(|text\())/;
  const files = APP_FILES.concat(['src/index.js'])
    .concat(fs.readdirSync(path.join(root, 'components')).filter(f => /\.(html|js)$/.test(f)).map(f => 'components/' + f));
  const found = [];
  files.forEach(file => fs.readFileSync(path.join(root, file), 'utf8').split('\n').forEach((line, i) => {
    if (unsafe.test(line)) found.push(file + ':' + (i + 1) + ': ' + line.trim());
  }));
  assert.deepStrictEqual(found, []);
});
