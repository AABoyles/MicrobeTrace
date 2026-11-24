// The ES modules that make up the app's MT namespace, in the order index.html loads
// them (#240, #323). common.js comes first and creates MT.
//
// Tests that need several fresh copies of MT, each with its own fake globals (session,
// temp, document, Worker), can't import the modules: an import is evaluated once. So
// runAppFiles(ctx) runs each file in a vm context as the page would, with the
// import lines turned into reads from the context (the step 1 modules come from
// require(), which Node can do for a synchronous ES module) and each file wrapped
// in a function so their private names stay apart.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_FILES = [
  'src/common.js',
  'src/loading.js',
  'src/links-clusters.js',
  'src/colors.js',
  'src/export.js',
  'src/views.js',
  'src/ui.js',
];

const root = path.join(__dirname, '..');
const leaves = {
  db: ['db', 'db'], MTDates: ['dates', 'MTDates'], MTEvents: ['events', 'MTEvents'], MTGraph: ['graph', 'MTGraph'],
  MTNodeSources: ['nodes', 'MTNodeSources'], MTSessionFormat: ['session-format', 'MTSessionFormat'], MTSettings: ['settings', 'MTSettings'], cleanID: ['formats/shared', 'cleanID'],
};

function runAppFiles(ctx) {
  for (const [name, [file, key]] of Object.entries(leaves)) {
    if (!(name in ctx)) ctx[name] = require(path.join(root, 'src', file + '.js'))[key];
  }
  for (const file of APP_FILES) {
    const names = [];
    const body = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(/^import \{ (.*) \} from '.*';$/gm, (m, list) => { names.push(...list.split(',').map(s => s.trim())); return ''; })
      .replace(/^export const MT = /m, 'const MT = ');
    // Only one-line named imports are rewritten above; say so rather than fail later
    // with a SyntaxError that doesn't name the cause.
    if (/^\s*(import|export)\b/m.test(body)) {
      throw new Error(file + ' has an import or export that runAppFiles cannot rewrite: use one-line `import { a, b } from \'./x.js\';`');
    }
    const wrapped = '(function(){\n' + (names.length ? 'const { ' + names.join(', ') + ' } = self;' : '') + body + '\n})();';
    vm.runInContext(wrapped, ctx, { filename: path.join(root, file) });
  }
}

module.exports = { APP_FILES, runAppFiles };
