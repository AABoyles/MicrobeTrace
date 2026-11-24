// WebMCP tools for MicrobeTrace's global settings, filtering, selection,
// node and link styling, color tables and the global timeline.
// See src/webmcp.js for how tools are defined.

import listSettings from './list-settings.js';
import getSettings from './get-settings.js';
import setSettings from './set-settings.js';
import getFilterState from './get-filter-state.js';
import setLinkFilter from './set-link-filter.js';
import setClusterMinimumSize from './set-cluster-minimum-size.js';
import revealAll from './reveal-all.js';
import setTimeline from './set-timeline.js';
import clearTimeline from './clear-timeline.js';
import getTimeline from './get-timeline.js';
import controlTimelinePlayback from './control-timeline-playback.js';
import selectNodes from './select-nodes.js';
import clearSelection from './clear-selection.js';
import getSelection from './get-selection.js';
import searchNodes from './search-nodes.js';
import selectNeighbors from './select-neighbors.js';
import selectCluster from './select-cluster.js';
import getColorLegend from './get-color-legend.js';
import * as valueColors from './value-colors.js';
import renameLegendValue from './rename-legend-value.js';
import listPalettes from './list-palettes.js';
import setPalette from './set-palette.js';
import colorNodes from './color-nodes.js';
import sizeNodes from './size-nodes.js';
import setNodeShape from './set-node-shape.js';
import labelNodes from './label-nodes.js';
import setNodeTooltip from './set-node-tooltip.js';
import setNodeBorder from './set-node-border.js';
import setSelectedColor from './set-selected-color.js';
import setBackgroundColor from './set-background-color.js';
import colorLinks from './color-links.js';
import setLinkWidth from './set-link-width.js';
import labelLinks from './label-links.js';
import setLinkDirected from './set-link-directed.js';
import setLinkTooltip from './set-link-tooltip.js';
import getStyle from './get-style.js';
import showPanels from './show-panels.js';
import resetStyle from './reset-style.js';

// In the order the tools are listed to an agent
export default [
  listSettings,
  getSettings,
  setSettings,
  getFilterState,
  setLinkFilter,
  setClusterMinimumSize,
  revealAll,
  setTimeline,
  clearTimeline,
  getTimeline,
  controlTimelinePlayback,
  selectNodes,
  clearSelection,
  getSelection,
  searchNodes,
  selectNeighbors,
  selectCluster,
  getColorLegend,
  valueColors.node,
  valueColors.link,
  renameLegendValue,
  listPalettes,
  setPalette,
  colorNodes,
  sizeNodes,
  setNodeShape,
  labelNodes,
  setNodeTooltip,
  setNodeBorder,
  setSelectedColor,
  setBackgroundColor,
  colorLinks,
  setLinkWidth,
  labelLinks,
  setLinkDirected,
  setLinkTooltip,
  getStyle,
  showPanels,
  resetStyle,
];
