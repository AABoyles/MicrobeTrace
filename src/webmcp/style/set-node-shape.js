import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { T, W, checkVariable, applyAll, result } from './helpers.js';

const SHAPES = () => self.session.style.nodeSymbols.slice();

const shapeName = s => {
  if (typeof s != 'string') fail('shape must be text');
  const all = SHAPES();
  if (all.includes(s)) return s;
  const t = 'symbol' + s.replace(/[^A-Za-z]/g, '').replace(/^symbol/i, '');
  const found = all.find(x => x.toLowerCase() == t.toLowerCase());
  if (!found) fail('Unknown shape ' + JSON.stringify(s) + '. Shapes: ' + all.join(', '));
  return found;
};

export default {
  name: 'set_node_shape',
  title: 'Set node shape',
  description: 'Sets node shapes in the network view: one shape for all nodes (shape, node-symbol) and/or a different shape for each value of a node field (variable, node-symbol-variable; "None" for one shape). ' +
    'Shapes: ' + 'symbolCircle, symbolCross, symbolDiamond, symbolSquare, symbolStar, symbolTriangle, symbolWye, symbolTriangleDown, symbolTriangleLeft, symbolTriangleRight, symbolDiamondAlt, symbolDiamondSquare, symbolPentagon, symbolHexagon, symbolHexagonAlt, symbolOctagon, symbolOctagonAlt, symbolX ' +
    '(short names like "circle" or "triangleDown" are accepted). Per-value shapes are assigned automatically from the list in order of frequency. Returns the settings changed.',
  inputSchema: obj({
    shape: str('The shape for all nodes (when variable is None), e.g. "symbolSquare" or "square"'),
    variable: str('Node field whose values get different shapes, or "None"')
  }),
  execute: async ({ shape, variable }) => {
    T.requireData();
    const map = {};
    if (variable !== undefined) map['node-symbol-variable'] = checkVariable('node', variable);
    if (shape !== undefined) map['node-symbol'] = shapeName(shape);
    if (!Object.keys(map).length) fail('Give shape and/or variable');
    const r = await applyAll(map);
    return result(r, [], { shape: W()['node-symbol'], variable: W()['node-symbol-variable'] });
  }
};
