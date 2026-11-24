// WebMCP tools for reading and analysing the loaded network. Everything here is
// read-only: it never changes the data, the settings or the views.
//
// Nodes are session.data.nodes (plain objects). Links live in the graph
// (session.data.graph, src/graph.js) and are only turned into objects for the
// links a tool returns; filtering and sorting read the graph's columns.

import getStatus from './get-status.js';
import getStatistics from './get-statistics.js';
import listFields from './list-fields.js';
import describeField from './describe-field.js';
import queryNodes from './query-nodes.js';
import getNeighbors from './get-neighbors.js';
import getNode from './get-node.js';
import queryLinks from './query-links.js';
import getLink from './get-link.js';
import listClusters from './list-clusters.js';
import getCluster from './get-cluster.js';
import crosstab from './crosstab.js';
import aggregate from './aggregate.js';
import getDistanceMatrix from './get-distance-matrix.js';
import getTree from './get-tree.js';
import getSequences from './get-sequences.js';
import getConsensus from './get-consensus.js';
import getConflicts from './get-conflicts.js';
import getProvenance from './get-provenance.js';
import shortestPath from './shortest-path.js';
import getDegreeDistribution from './get-degree-distribution.js';
import getCentrality from './get-centrality.js';

// In the order the tools are listed to an agent
export default [
  getStatus,
  getStatistics,
  listFields,
  describeField,
  queryNodes,
  getNeighbors,
  getNode,
  queryLinks,
  getLink,
  listClusters,
  getCluster,
  crosstab,
  aggregate,
  getDistanceMatrix,
  getTree,
  getSequences,
  getConsensus,
  getConflicts,
  getProvenance,
  shortestPath,
  getDegreeDistribution,
  getCentrality,
];
