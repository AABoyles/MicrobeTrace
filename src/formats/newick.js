// A Newick tree: its leaves are the nodes, and the distances along the tree the links (#337).
export const name = 'newick';
export const label = 'a Newick tree';
export const extensions = ['nwk', 'newick'];

export const matchName = extension => extension.indexOf('nwk') > -1 || extension.indexOf('newick') > -1;

// Parenthesised and ended by a ";", with the parentheses balanced
const balanced = text => {
  let depth = 0;
  for (const c of text) {
    if (c == '(') depth++;
    else if (c == ')' && --depth < 0) return false;
  }
  return depth == 0;
};

export const detect = text => text.trimStart().startsWith('(') && /;\s*$/.test(text) && balanced(text);

// The tree, its nodes ({ _id, origin }) and a link ({ source, target, origin, [metric]:
// distance }) between every pair of them. The links come in the order the pairs are
// met, so nodes[i] is followed by links.slice(i * (i - 1) / 2, i * (i + 1) / 2): a
// caller that adds each node before its links keeps that order. Needs patristic, a
// global of the bundle.
export function parse(contents, { origin, metric }) {
  const tree = patristic.parseNewick(contents);
  const { matrix, ids } = tree.toMatrix();
  const nodes = [], links = [];
  for (let i = 0; i < ids.length; i++) {
    nodes.push({ _id: ids[i], origin });
    for (let j = 0; j < i; j++) {
      links.push({ source: ids[i], target: ids[j], origin, [metric]: parseFloat(matrix[i][j]) });
    }
  }
  return { tree, nodes, links, labels: ids };
}
