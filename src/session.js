// The session's owner (#338). session.data is written here and nowhere else: the code that
// loads files, restores sessions, excludes sequences or tags clusters calls these functions,
// and each tells the views through MT.events what it changed, so a view doesn't depend on
// who made the change. Reads stay as they were (session.data.nodes and the rest are plain
// data for any code to look at). eslint's no-restricted-syntax rule keeps writes out of
// other files (see eslint.config.js).
//
// The functions are made by makeSession(MT, root) so that Node tests can give them a fake
// MT and a fake root (an object with `session` and `temp`). In the page common.js calls it
// with `self`, and exposes the result as MT.session; the old MT.addNode, MT.addLink,
// MT.addNodeField, MT.resetSession, MT.preferSource and MT.pickSource are aliases of it.
//
// One event covers the data, 'session-data-change', with the list of what changed:
// 'nodes', 'links', 'fields', 'exclusions', 'reference', 'consensus', 'clusters', 'sources'
// or 'reset'. addNode and addLink (one item at a time) are silent, as they are called in loops
// of thousands while loading: use addNodes and addLinks for a batch, which say so once, and
// loading itself ends with 'session-loaded'.
import { cleanID } from './formats/shared.js';

export function makeSession(MT, root) {
  const data = () => root.session.data;
  const changed = (...what) => { if (MT.events) MT.events.emit('session-data-change', what); };
  const addNew = (list, names) => {
    let added = 0;
    names.forEach(name => { if (!list.includes(name)) { list.push(name); added++; } });
    return added;
  };

  const S = {};

  // Replaces the session, and temp too unless `temp: false`; with `keepComponents`, temp keeps
  // its componentCache, the views' compiled components. The one place that replaces the
  // session and temp globals. Everything else reads them and sets their fields.
  S.reset = ({ temp = true, keepComponents = false } = {}) => {
    if (temp) {
      const componentCache = keepComponents ? root.temp.componentCache : undefined;
      root.temp = MT.tempSkeleton();
      if (keepComponents) root.temp.componentCache = componentCache;
    }
    root.session = MT.sessionSkeleton();
    changed('reset');
  };

  // Drops what a load had read so far, keeping the reference sequence, which is the user's
  // choice and not loaded data (Cancel in the loading dialog)
  S.discardData = () => {
    const reference = data().reference;
    root.session.data = MT.dataSkeleton();
    root.session.data.reference = reference;
    changed('reset');
  };

  // Adds a node, or merges it into the node with the same ID. Returns 1 if
  // the node is new. (check is no longer needed: nodes are always merged.)
  //
  // Given the source it came from (session.data.sources), the node's values
  // are recorded there, and where files disagree the top file's win. Without
  // a source (a saved session, an import), its values replace any already set.
  // Silent, for loops: see addNodes.
  S.addNode = (newNode, check, source) => {
    if ('id' in newNode && !('_id' in newNode)) newNode._id = newNode.id;
    newNode._id = cleanID(newNode._id);
    const d = data();
    if (d.nodeExclusions.indexOf(newNode._id) > -1) return 0;
    const index = d.nodeIndex;
    let node = index.get(newNode._id);
    if (!source) {
      if (node) {
        // (Imports may give one origin as text)
        newNode.origin = MT.uniq([].concat(newNode.origin || [], node.origin || []));
        Object.assign(node, newNode);
        return 0;
      }
      node = Object.assign(MT.defaultNode(), newNode);
      d.nodes.push(node);
      index.set(node._id, node);
      return 1;
    }
    const added = !node;
    if (added) {
      node = Object.assign(MT.defaultNode(), { _id: newNode._id });
      d.nodes.push(node);
      index.set(node._id, node);
    }
    node.origin = MT.uniq([].concat(newNode.origin || []).concat(node.origin));
    const values = {};
    for (const field in newNode) if (field !== '_id' && field !== 'origin') values[field] = newNode[field];
    source.add(node._id, values);
    // Each field takes the best source's value (an empty one, if none has more)
    const sources = d.sources;
    for (const field in values) {
      const value = sources.resolve(node._id, field);
      if (value !== undefined) node[field] = value;
      else if (!(field in node)) node[field] = values[field];
    }
    return added ? 1 : 0;
  };

  // Adds a link, or merges it into the link between the same two nodes (its
  // fields win, origins are combined). Returns 1 if the link is new. Silent, as addNode is.
  S.addLink = newLink => {
    newLink.source = cleanID(newLink.source);
    newLink.target = cleanID(newLink.target);
    return data().graph.addLink(newLink);
  };

  // Adds each node (see addNode), and says so once. Returns how many were new.
  S.addNodes = (nodes, source) => {
    let added = 0;
    nodes.forEach(node => { added += S.addNode(node, true, source); });
    changed('nodes');
    return added;
  };

  // Adds each link (see addLink; any iterable, for lists too big to copy), and says so once.
  // Returns how many were new.
  S.addLinks = links => {
    let added = 0;
    for (const link of links) added += S.addLink(link);
    changed('links');
    return added;
  };

  // Lists node fields (once each) so they appear in variable menus and sessions
  S.addNodeField = (...names) => { if (addNew(data().nodeFields, names)) changed('fields'); };
  S.addLinkField = (...names) => { if (addNew(data().linkFields, names)) changed('fields'); };

  // Which nodes are left out of what is loaded next (by ID), as a list or by one ID
  S.excludeNodes = ids => {
    if (addNew(data().nodeExclusions, [].concat(ids).map(String))) changed('exclusions');
  };
  S.includeNodes = ids => {
    const list = data().nodeExclusions;
    let removed = false;
    [].concat(ids).map(String).forEach(id => {
      const i = list.indexOf(id);
      if (i > -1) { list.splice(i, 1); removed = true; }
    });
    if (removed) changed('exclusions');
  };
  // Exactly these nodes (none, to clear)
  S.setExclusions = ids => {
    const list = data().nodeExclusions;
    list.splice(0, list.length, ...new Set([].concat(ids).map(String)));
    changed('exclusions');
  };

  S.setReference = seq => { data().reference = seq; changed('reference'); };
  S.setConsensus = seq => { data().consensus = seq; changed('consensus'); };

  // The clusters (see MT.tagClusters), replacing the last ones
  S.setClusters = clusters => { data().clusters = clusters; changed('clusters'); return clusters; };

  // Starts a file's record of the values it gave nodes, ranked by its place in the file list;
  // pass it to addNode. A new launch clears the records first.
  S.addSource = (name, rank) => data().sources.add(name, rank);
  S.resetSources = () => { data().sources.reset(); changed('sources'); };

  // Gives nodes their fields' chosen values again, and tells the views
  const resolveNodes = (field, keys) => {
    const sources = data().sources, index = data().nodeIndex;
    keys.forEach(key => {
      const node = index.get(key), value = sources.resolve(key, field);
      if (node && value !== undefined) node[field] = value;
    });
    MT.events.emit('node-values-change', field);
    // (The views redraw, and the color table follows)
    MT.events.emit('node-visibility');
  };

  // Which file's values a field uses where files disagree: a file's name, or
  // null for the top file's
  S.preferSource = (field, name) => {
    data().sources.prefer(field, name);
    resolveNodes(field, data().sources.keys(field));
  };

  // Which file's value a node's field uses (or several nodes'): a file's
  // name, or null for the field's choice
  S.pickSource = (ids, field, name) => {
    const keys = [].concat(ids).map(id => '' + id);
    keys.forEach(key => data().sources.pick(key, field, name));
    resolveNodes(field, keys);
  };

  // Puts a saved session's data into the (fresh) session: its nodes and links, where each
  // file's values came from, and its field lists and exclusions added to the defaults. This
  // is the data half of MT.applySession, which has already upgraded the style.
  S.restoreData = saved => {
    const nodes = saved.nodes, links = saved.links;
    // (Older sessions saved each node's encoded sequence, which is rebuilt when needed)
    for (let i = 0; i < nodes.length; i++) { delete nodes[i]._seqInt; S.addNode(nodes[i]); }
    for (let j = 0; j < links.length; j++) S.addLink(links[j]);
    const d = data();
    // Where the nodes' values came from (sessions from before this have none)
    if (saved.nodeSources) d.nodeSources = saved.nodeSources;
    ['nodeFields', 'linkFields', 'clusterFields', 'nodeExclusions'].forEach(v => {
      if (saved[v]) d[v] = MT.uniq(d[v].concat(saved[v]));
    });
    // Sessions saved before the ID column was the ID alone list it as a field
    // too: leave it out where it only repeats the ID
    d.nodeFields = d.nodeFields.filter(field => !(/^id$/i.test(field) &&
      d.nodes.every(n => n[field] == null || '' + n[field] == n._id))); // eslint-disable-line eqeqeq -- IDs in a saved session may be numbers, and match their text
    changed('reset');
  };

  return S;
}
