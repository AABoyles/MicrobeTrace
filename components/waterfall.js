// The waterfall view, loaded as an ES module by src/views.js (#339). Library globals (d3, MTBind)
// stay globals; MT, the session and temp come from ctx.

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const lists = { clusters: $('.waterfall-clusters'), nodes: $('.waterfall-nodes'), links: $('.waterfall-links') };
  const meta = ['index', 'id', 'visible', 'degree', '_diff', 'seq', 'cluster', 'directed', 'source', 'target'];
  const format = value => typeof value === 'number' ? value.toLocaleString() : value;
  const details = item => Object.keys(item).filter(k => !meta.includes(k)).map(k => MT.escape(MT.titleize(k) + ': ' + format(item[k]))).join('<br>');

  root.style.overflowY = 'scroll';

  // An item of a list: its name, its number and the details shown when it's
  // chosen. Choosing it again unchooses it; onChoose gets whether it's chosen.
  function item(list, name, number, detail, onChoose) {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'list-group-item list-group-item-action';
    a.innerHTML = `<div class="d-flex w-100 justify-content-between">
        <span class="ellipsisToFit">${MT.escape(name)}</span>
        <small>${MT.escape(format(number))}</small>
      </div>
      <div class="hideIfNotActive">${detail}</div>`;
    a.addEventListener('click', e => {
      e.preventDefault();
      const chosen = !a.classList.contains('active');
      list.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
      a.classList.toggle('active', chosen);
      if (onChoose) onChoose(chosen);
    });
    list.append(a);
  }

  // What's chosen, kept across redraws while it's still there
  let cluster, node;

  function showClusters() {
    lists.clusters.innerHTML = '';
    const clusters = ctx.session.data.clusters.filter(c => c.visible && c.nodes > 1);
    // Single nodes aren't listed (they've no links to show): say how many
    const singles = ctx.session.data.clusters.filter(c => c.visible && c.nodes === 1).length;
    $('.waterfall-skipped').hidden = !singles;
    $('.waterfall-skipped').textContent = singles === 1 ? '1 cluster of a single node isn’t listed.' : `${singles.toLocaleString()} clusters of a single node aren’t listed.`;
    if (!clusters.some(c => c.id === cluster)) cluster = undefined;
    clusters.forEach(c => {
      item(lists.clusters, c.id, c.nodes, `Links: ${c.links}<br>
        Links per Node: ${c.links_per_node.toLocaleString()}<br>
        Average Distance: ${c.mean_genetic_distance.toLocaleString()}`, chosen => {
        cluster = chosen ? c.id : undefined;
        node = undefined;
        showNodes();
      });
      if (c.id === cluster) lists.clusters.lastChild.classList.add('active');
    });
    showNodes();
  }

  function showNodes() {
    lists.nodes.innerHTML = '';
    const nodes = cluster === undefined ? [] : ctx.session.data.nodes.filter(d => d.cluster === cluster);
    $('.waterfall-nodes-hint').hidden = cluster !== undefined;
    if (!nodes.some(d => d._id === node)) node = undefined;
    nodes.forEach(d => {
      item(lists.nodes, d._id, d.degree, details(d), chosen => {
        node = chosen ? d._id : undefined;
        showLinks();
      });
      if (d._id === node) lists.nodes.lastChild.classList.add('active');
    });
    showLinks();
  }

  function showLinks() {
    lists.links.innerHTML = '';
    $('.waterfall-links-hint').hidden = node !== undefined;
    if (node === undefined) return;
    const metric = settings.get('link-sort-variable');
    MT.getVisibleNeighbors(node).forEach(({ neighbor, link }) => item(lists.links, neighbor, link[metric], details(link)));
  }

  const setBackground = () => { $('.waterfall').style.backgroundColor = settings.get('background-color'); };

  const stop = [
    events.on('background-color-change', setBackground),
    ...['link-visibility', 'node-visibility', 'cluster-visibility'].map(type => events.on(type, showClusters))
  ];
  showClusters();
  setBackground();

  return {
    destroy: () => stop.forEach(fn => fn())
  };
}
