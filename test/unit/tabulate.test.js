// Unit tests for MT.tabulate in src/index.js (#205): cells are text, and
// swatches are styled through the style API, never parsed as markup.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../../src/index.js'), 'utf8');
const start = src.indexOf('MT.tabulate = ');
const end = src.indexOf('// The color tables');
assert.ok(start > 0 && end > start);
const code = src.slice(start, end);

// A minimal d3 stand-in that records what is written to each element
function fakeD3() {
  const make = tag => ({ tag, children: [], styles: {}, attrs: {}, textValue: undefined, htmlCalled: false });
  const sel = (nodes, parents = nodes) => ({
    append(tag) { return sel(nodes.map(n => { const c = make(tag); n.children.push(c); return c; })); },
    attr(k, v) { nodes.forEach(n => { n.attrs[k] = v; }); return this; },
    style(k, v) { nodes.forEach(n => { n.styles[k] = v; }); return this; },
    text(v) { nodes.forEach(n => { n.textValue = typeof v === 'function' ? v(n.datum) : v; }); return this; },
    html() { nodes.forEach(n => { n.htmlCalled = true; }); return this; },
    selectAll(tag) { return sel(nodes.flatMap(n => n.children.filter(c => c.tag === tag)), nodes); },
    data(d) { this.pending = d; return this; },
    enter() {
      const out = [];
      parents.forEach((parent, i) => {
        const items = typeof this.pending === 'function' ? this.pending(parent.datum, i) : this.pending;
        items.forEach(it => out.push({ parent, datum: it }));
      });
      return { append: tag => sel(out.map(o => { const c = make(tag); c.datum = o.datum; o.parent.children.push(c); return c; })) };
    },
    each(fn) { nodes.forEach(n => fn.call({ __node: n }, n.datum)); return this; }
  });
  return { d3: { select: x => sel([x.__node || x]) }, root: make('svg') };
}

function run(data, columns) {
  const { d3, root } = fakeD3();
  const MT = {};
  const el = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }) };
  new Function('MT', 'd3', code)(MT, d3);
  MT.tabulate(data, columns, el, root, el);
  return root;
}

const collect = (n, out = []) => { out.push(n); n.children.forEach(c => collect(c, out)); return out; };

test('values are written as text, not HTML', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const root = run([{ Node: evil, Count: 3 }], ['Node', 'Count']);
  const tds = collect(root).filter(n => n.tag === 'td');
  assert.deepStrictEqual(tds.map(t => t.textValue), [evil, '3']);
  assert.ok(!collect(root).some(n => n.htmlCalled));
});

test('missing values leave empty cells', () => {
  const root = run([{ Node: 'a' }], ['Node', 'Count']);
  const tds = collect(root).filter(n => n.tag === 'td');
  assert.strictEqual(tds[1].textValue, undefined);
});

test('swatches are elements styled through the style API', () => {
  const root = run([{ Node: 'a', Color: { swatch: '"><script>x</script>' } }], ['Node', 'Color']);
  const div = collect(root).find(n => n.tag === 'div');
  assert.strictEqual(div.styles.background, '"><script>x</script>'); // only ever a style value, which the DOM rejects if invalid
  assert.strictEqual(div.attrs.style, undefined);
  assert.ok(!collect(root).some(n => n.htmlCalled));
});
