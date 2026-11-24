import { obj } from '../schema.js';
import { readOnly } from './helpers.js';

// Palettes
function schemeNames() {
  return Object.keys(self.d3).filter(k => /^scheme/.test(k) && Array.isArray(self.d3[k]) && self.d3[k].length).sort();
}

export default {
  name: 'list_palettes',
  title: 'List color palettes',
  description: 'Lists the named d3 color schemes usable with set_palette (e.g. schemeCategory10, schemePaired, schemeTableau10, schemeSet1, and sequential/diverging ones like schemeBlues, schemeRdYlBu), with their sizes and sample colors, and the palettes currently in use for nodes and links.',
  inputSchema: obj({}),
  annotations: readOnly,
  untrusted: false,
  execute: async () => ({
    schemes: schemeNames().map(name => {
      const s = self.d3[name];
      return typeof s[0] === 'string' ? { name, colors: s.length, sample: s.slice(0, 6) } :
        { name, sizes: s.map((x, i) => x ? i : -1).filter(i => i >= 0), sample: (s[s.length - 1] || []).slice(0, 6) };
    }),
    current: { nodeColors: self.session.style.nodeColors, linkColors: self.session.style.linkColors }
  })
};
