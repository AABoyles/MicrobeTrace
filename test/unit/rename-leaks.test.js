// A mechanical rename of the `session` global to `env.session` once leaked into
// toasts ("A new env.session will start...") (#341). Text the user can read must
// never name the code-level handles, so scan the text of every string literal
// and comment in src/ and components/ for them.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const LEAK = /\b(?:env|ctx|app)\.(?:session|temp)\b/;

// Splits source into string text and comment text. Code inside ${...} is skipped.
// Regex literals are not understood; a stray quote in one would only shift the
// scan, and the test checks that every file ends outside a template literal.
function textSegments(src) {
  const out = [];
  const stack = []; // 'brace' for each open ${ } or { inside one
  let i = 0, line = 1;
  const add = (text, kind, at) => out.push({ text, kind, line: at });
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') line++;
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i); const e = end < 0 ? src.length : end;
      add(src.slice(i, e), 'comment', line); i = e; continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2); const e = end < 0 ? src.length : end + 2;
      add(src.slice(i, e), 'comment', line);
      line += (src.slice(i, e).match(/\n/g) || []).length; i = e; continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      add(src.slice(i + 1, j), 'string', line); i = j + 1; continue;
    }
    if (c === '`' || (c === '}' && stack[stack.length - 1] === 'tplbrace')) {
      if (c === '}') stack.pop();
      let j = i + 1;
      const startLine = line, start = j;
      while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) {
        if (src[j] === '\n') line++;
        j += src[j] === '\\' ? 2 : 1;
      }
      add(src.slice(start, j), 'template', startLine);
      if (src[j] === '$') { stack.push('tplbrace'); i = j + 2; } else i = j + 1;
      continue;
    }
    if (c === '{' && stack.length) stack.push('brace');
    else if (c === '}' && stack.length) stack.pop();
    i++;
  }
  return { out, open: stack.length };
}

function files(dir) {
  return fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));
}

test('no string or comment names env.session, ctx.temp and the like', () => {
  const leaks = [];
  for (const file of [...files('src'), ...files('components')]) {
    const { out, open } = textSegments(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.strictEqual(open, 0, `${file}: scanner lost track of a template literal`);
    for (const s of out) if (LEAK.test(s.text)) leaks.push(`${file}:${s.line} ${s.kind}: ${s.text.trim().slice(0, 80)}`);
  }
  assert.deepStrictEqual(leaks, []);
});
