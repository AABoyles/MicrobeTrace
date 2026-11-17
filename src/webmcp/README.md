# MicrobeTrace and WebMCP

[WebMCP](https://webmachinelearning.github.io/webmcp/) is a draft W3C proposal that lets a web page
describe tools to an AI agent in the browser. MicrobeTrace exposes its features as WebMCP tools:
loading files, launching a network, querying nodes and links, styling, selecting, and drawing views.
An agent can then load a dataset, color it, and look at the result without the user clicking through
the interface.

The code is in `src/webmcp.js` (the core) and `src/webmcp/*.js` (the tools, in four groups). The
page loads them in that order, from `index.html`.

## How tools are exposed

Each tool is defined once with `MTWebMCP.define({...})`. Where the browser supports WebMCP, the
tool is registered with it as it is defined: `document.modelContext.registerTool`, or
`navigator.modelContext.registerTool` in earlier builds. Where there is no WebMCP, nothing is
registered, and the tools are still usable from the page:

- `MTWebMCP.call(name, args)` runs a tool and returns its plain result, or throws.
- `MTWebMCP.callAsAgent(name, args)` runs a tool the way an agent would, and returns its MCP content
  blocks (`{content: [...], isError?}`).
- `MTWebMCP.list()` describes every tool: name, title, description, input schema and annotations.
- `MTWebMCP.available()` says whether the browser has WebMCP.

A tool's `execute` returns any JSON-compatible value. The agent receives it as JSON text (strings
as they are, `undefined` as `Done.`). Dates, Sets, Maps and typed arrays are converted, and
non-finite numbers become `null`. To send an image too, return `MTWebMCP.image(dataURL, value)`;
the agent gets the image as an image block and `value` as text. If `execute` throws, the agent gets
`{isError: true}` with the message as `Error: ...`. Use `MTWebMCP.fail('message')` (or throw
`MTWebMCP.ToolError`) for errors that are the agent's fault, such as a missing file or an unknown
column. Other errors are also logged to the console.

## The filter, sort and paging language

Tools that pick out nodes, links or clusters share one vocabulary (`MTWebMCP.filter`, `sort`,
`page`, and the schemas in `MTWebMCP.schemas`). It appears in `query_nodes`, `query_links`,
`aggregate` (as `having`), `select_nodes` and others.

A filter is a list of conditions, each `{field, op, value}`, combined with `match`:
`"all"` (the default) or `"any"`.

```json
{
  "filter": [
    { "field": "state", "op": "eq", "value": "Georgia" },
    { "field": "tn93", "op": "lte", "value": 0.01 },
    { "field": "tags", "op": "contains", "value": "urgent", "caseSensitive": false }
  ],
  "match": "all"
}
```

The operators (`OPS`) are:

| Op | Meaning |
|---|---|
| `eq`, `ne` | equal, not equal |
| `lt`, `lte`, `gt`, `gte` | comparisons |
| `in`, `nin` | value is (not) one of an array |
| `contains`, `startsWith`, `endsWith` | text matching |
| `regex` | a regular expression |
| `empty`, `notEmpty` | no value (`null`, `""`, `NaN` or an empty list) |

Comparisons with numbers are numeric (`"10"` equals `10`). ISO-style dates compare as dates when
both sides read as dates. Text ignores case unless `caseSensitive` is set. A field that holds a list
(such as a link's origin files) matches if any element matches.

Sorting takes a list of field names, or `{field, descending}` objects, in priority order. Empty values
sort last.

Paging takes `offset` (default 0) and `limit` (default 100, at most 10000). Paged results have the
shape `{total, offset, limit, returned, items}`, so an agent can see how many matches lie beyond the
page. A few tools also accept `count: true` to return only the total.

## Example agent workflow

A typical session loads files, builds the network, then looks at it:

1. `add_file` with `{"name": "links.csv", "contents": "source,target,tn93\n...", "format": "link"}`
   (repeat for `nodes.csv` with `"format": "node"` and `fasta` files as needed). Each call returns the
   detected headers and any problem that would block launch.
2. `launch` with `{}`. It waits for the network to load and returns a summary (node, link and
   cluster counts, fields, open views).
3. `get_status`. It reports whether data is loaded and the current filter settings.
4. `set_link_filter` with `{"variable": "tn93", "threshold": 0.015}`. Links at or below the
   threshold become visible.
5. `color_nodes` with `{"variable": "state"}`, which gives each state a palette color.
6. `query_nodes` with
   `{"filter": [{"field": "state", "op": "eq", "value": "Georgia"}], "sort": [{"field": "age", "descending": true}], "limit": 20}`.
7. `get_view_image` with `{"view": "network"}`, to see what the network actually looks like.

## Tool reference

There are 100 tools. Each file below is one group. "Read-only?" is the `readOnlyHint` annotation.
Tools marked "consequential" carry `consequentialHint`: they replace or delete data or state, or
download a file, so a client may want to confirm first.

### Session and data loading (`src/webmcp/session.js`, 24 tools)

| Tool | Read-only? | What it does |
|---|---|---|
| `add_file` | No | Adds a file to the pending list, as text (`contents`) or base64 (`contentsBase64`). Sets its format (or guesses it) and link/node columns. A session file opens immediately. |
| `list_pending_files` | Yes | Lists the files `launch` will read, with format, columns, headers and any blocking problem. |
| `update_pending_file` | No | Changes a pending file's format and/or column choices. |
| `remove_pending_file` | No (consequential) | Removes a file from the pending list. |
| `reorder_pending_files` | No | Sets the order of pending files. Where files disagree about a node, the first wins. |
| `get_loading_options` | Yes | Reads the settings that control how files become a network, with valid values. |
| `set_loading_options` | No | Changes those loading settings. |
| `launch` | No (consequential) | Reads the pending files with the loading options, builds the network, and returns a summary. |
| `load_demo` | No (consequential) | Loads the demo outbreak (about 100 nodes), replacing current data. `source` is `session` or `files`. |
| `generate_sequences` | No (consequential) | Adds a node file of random, related sequences, for trying the app without data. |
| `open_session` | No (consequential) | Opens a saved `.microbetrace`, HIV-TRACE or GHOST session, replacing current data. |
| `apply_style` | No | Applies a `.microbetracestyle` (colors, view settings, widget values) to the session and open views. |
| `get_session_json` | Yes | Returns the session as the Save dialog would write it (`microbetrace`, `microbetracestyle` or `hivtrace`), without downloading. |
| `save_session` | No (consequential) | Saves the session like the Save dialog. Can download the file and/or return its JSON text. |
| `new_session` | No (consequential) | Discards the current session and starts empty. |
| `get_session_info` | Yes | Describes the loaded session: counts, fields, distance metric and threshold, load time, files, open views, loading log. |
| `list_stashes` | Yes | Lists sessions stashed in this browser, newest first. |
| `stash_session` | No | Stashes the current session in this browser under a name. |
| `recall_stash` | No (consequential) | Loads a stashed session by key or name, replacing current data. |
| `delete_stash` | No (consequential) | Permanently deletes a stashed session. |
| `get_autostash` | Yes | Says whether autostash is on. When on, the session is stashed each minute after it loads. |
| `set_autostash` | No | Turns autostash on or off. |
| `audit_sequences` | Yes | Checks pending sequences (or the loaded ones) for empty, all-gap, RNA, amino acid, CIGAR and illegal entries. |
| `exclude_sequences` | No (consequential) | Manages the node IDs left out when files are launched (add, remove or set). |

### Querying data (`src/webmcp/query.js`, 22 tools)

All of these are read-only.

| Tool | Read-only? | What it does |
|---|---|---|
| `get_status` | Yes | Summarizes the state: whether data is loaded, node, link and cluster counts (total and visible), selection, filter settings. |
| `get_statistics` | Yes | The statistics panel's figures, computed from the current visibility filters. |
| `list_fields` | Yes | Lists node, link or cluster fields with inferred types, non-empty and distinct counts, and examples. |
| `describe_field` | Yes | Describes one node, link or cluster field. |
| `query_nodes` | Yes | Finds nodes by filter, optionally limited to visible, selected or given IDs. Sorts and pages. |
| `get_neighbors` | Yes | The neighbors of one or more nodes through links, out to a number of hops. |
| `get_node` | Yes | Everything about one node by ID: fields, cluster, degree, visibility, selection. Optionally where each value came from. |
| `query_links` | Yes | Finds links by link field (source, target, distances, origin and so on), optionally touching given nodes. Sorts and pages. |
| `get_link` | Yes | The link between two nodes, in either order: distances, origin files, visibility. |
| `list_clusters` | Yes | Lists clusters with size, links, distance sums and visibility. |
| `get_cluster` | Yes | One cluster in detail: statistics, paged members, internal links, and optional breakdowns by field. |
| `crosstab` | Yes | Counts nodes by the combinations of two fields, as the Crosstab view does. |
| `aggregate` | Yes | Groups nodes by one or more fields and computes statistics per group (a pivot table or GROUP BY). |
| `get_distance_matrix` | Yes | Pairwise link values for a metric, as labels and a square matrix. |
| `get_tree` | Yes | The neighbor-joining tree of the nodes, as a Newick string. |
| `get_sequences` | Yes | The sequences of chosen nodes, as JSON or FASTA text. Paged. |
| `get_consensus` | Yes | The consensus sequence of chosen nodes' sequences. |
| `get_conflicts` | Yes | Where files describing the same nodes disagree, for each field (what the Conflicts view lists). |
| `get_provenance` | Yes | For a node, each file's value for each field, and which one is used. |
| `shortest_path` | Yes | The shortest path between two nodes through links. |
| `get_degree_distribution` | Yes | A histogram of links per node, summary statistics, and the hub nodes. |
| `get_centrality` | Yes | Degree, betweenness and closeness centrality for nodes. |

### Settings, filtering, selection and styling (`src/webmcp/style.js`, 39 tools)

| Tool | Read-only? | What it does |
|---|---|---|
| `list_settings` | Yes | Lists the settings behind the global settings dialog and the views' controls. |
| `get_settings` | Yes | Reads the value, default and type of settings by key. |
| `set_settings` | No | Changes settings by key, through the settings store, so views react as they would to a control. |
| `get_filter_state` | Yes | Reports the link filter variable and threshold, nearest-neighbor pruning, minimum cluster size, timeline, and visible counts. |
| `set_link_filter` | No | Sets the link filter variable and threshold. Links at or below the threshold are visible. |
| `set_cluster_minimum_size` | No | Hides clusters with fewer nodes than the given size. |
| `reveal_all` | No | Sets the minimum cluster size to 1 and makes every cluster, node and link visible. |
| `set_timeline` | No | Turns on the global timeline for a node date field, and/or moves its handle. |
| `clear_timeline` | No | Turns the global timeline off. |
| `get_timeline` | Yes | Reports the timeline variable, dates, handle position, whether it is playing, and node counts. |
| `control_timeline_playback` | No | Plays or pauses the timeline animation. |
| `select_nodes` | No | Selects nodes by ID and/or a filter, in every view. |
| `clear_selection` | No | Deselects every node and empties the search box. |
| `get_selection` | Yes | The selected nodes: count and IDs (or chosen fields, paged). |
| `search_nodes` | No | Selects the nodes whose field matches a query, as the search box does (a regular expression unless `literal`). |
| `select_neighbors` | No | Expands the selection to neighbors along visible links, for a number of steps. |
| `select_cluster` | No | Selects all nodes of one or more clusters. `mode` is replace, add, remove or toggle. |
| `get_color_legend` | Yes | The color legend for nodes or links: the field, each value's count, color, opacity and display name. |
| `set_node_value_colors` | No | Edits the node color table: gives particular values their own color and/or opacity. |
| `set_link_value_colors` | No | Edits the link color table in the same way. |
| `rename_legend_value` | No | Gives a value a display name in color tables and legends, without changing the data. Or clears the name. |
| `list_palettes` | Yes | Lists the d3 color schemes usable with `set_palette`, and the palettes in use. |
| `set_palette` | No | Replaces the ordered colors assigned to the values of a color-by field, from a scheme or a list. |
| `color_nodes` | No | Colors nodes by a node field, or with one color when `variable` is `None`. |
| `size_nodes` | No | Sizes nodes by a numeric field (from `min` to `max`), or with a fixed `radius`. |
| `set_node_shape` | No | Sets one node shape, and/or a shape for each value of a node field. |
| `label_nodes` | No | Shows a node field as text labels, with size and orientation. `None` hides them. |
| `set_node_tooltip` | No | Chooses up to three node fields for the network view's hover tooltip. |
| `set_node_border` | No | Sets the node outline's color and width. |
| `set_selected_color` | No | Sets the color that marks selected nodes. |
| `set_background_color` | No | Sets the background color of the views. |
| `color_links` | No | Colors links by a link field, or with one color when `variable` is `None`. Sets transparency too. |
| `set_link_width` | No | Sets link thickness: fixed, or scaled by a numeric link field. |
| `label_links` | No | Shows a link field as text on links. `None` hides them. |
| `set_link_directed` | No | Shows or hides arrowheads on links in the network view. |
| `set_link_tooltip` | No | Chooses the link field for the network view's hover tooltip. |
| `get_style` | Yes | Summarizes the styling in one call: colors, sizes, shapes, labels, tooltips, open panels, palettes, and legends. |
| `show_panels` | No | Shows or hides the floating panels: the color tables, the shape table, and the statistics. |
| `reset_style` | No (consequential) | Resets styling to the defaults. `scope` limits what is reset. |

### Views and layout (`src/webmcp/views.js`, 15 tools)

| Tool | Read-only? | What it does |
|---|---|---|
| `list_views` | Yes | Lists every view: id, name, menu group, what it shows, what data it needs, and whether it is open. |
| `open_view` | No | Opens a view and waits until it has drawn its first frame. |
| `close_view` | No (consequential) | Closes an open view. |
| `focus_view` | No | Makes an open view the front tab of its panel. |
| `get_layout` | Yes | Returns how the views are arranged: panels in rows and columns. |
| `set_layout` | No (consequential) | Replaces the whole arrangement of views with a layout tree. |
| `get_view_settings` | Yes | Lists a view's settings: keys, labels, current values, types and allowed options. |
| `set_view_settings` | No | Changes a view's settings by key. The view redraws. |
| `set_view_control` | No | Sets a view's input that is not a stored setting, such as the field menus of Conflicts or Crosstab. |
| `list_view_actions` | Yes | Lists a view's buttons and menu items. |
| `invoke_view_action` | No | Clicks one of a view's buttons, found by id or title. |
| `get_view_image` | Yes | Renders a view as an image the agent can see, to check what it draws. |
| `export_view` | No (consequential) | Runs a view's Export dialog in a format, returning the content or downloading it. |
| `network_control` | No | Controls the network view's camera and layout simulation: fit, zoom, pin or unpin all nodes, and the simulation. |
| `get_network_layout` | Yes | Each node's position in the network view, with zoom, pinned and simulation state. |

## Adding a tool

1. Pick the group file that fits (session, query, style or views). If none fits, add a new file,
   and add a `<script defer src="src/webmcp/NAME.js">` tag to `index.html` after the others.
2. Call `define` with these fields:

   ```js
   define({
     name: 'get_node',                    // required; [A-Za-z0-9_.-], 1 to 128 characters, unique
     title: 'Get node',                   // optional, for people
     description: 'What it does, for the agent choosing a tool',   // required
     inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
     annotations: { readOnlyHint: true }, // or consequentialHint: true, if it deletes, replaces or downloads
     execute: async (args, { signal }) => ({ ... })   // required; returns any JSON value
   });
   ```

   `define` throws if the name is invalid or already used, if there is no description, or if there is no
   `execute`. Without an `inputSchema`, the tool takes no arguments.
3. Write the description for an agent, not a person. Say what the tool returns and what its arguments
   mean. Name the related tools to use instead.
4. Reuse the shared helpers (`requireData`, `nodeById`, `filter`, `sort`, `page`, `schemas.filter`,
   `schemas.page`, and so on) rather than writing new ones. Fail with `fail('...')` when the agent
   asks for something that cannot be done.
5. Set `readOnlyHint: true` only if the tool changes nothing. Set `consequentialHint: true` if it
   replaces, deletes or downloads.
6. Add a test. Tests of the tool go in `test/e2e/webmcp-*.spec.js` for the group. Tests of the
   shared helpers go in `test/unit/webmcp.test.js`.

## Testing

```sh
npm test                                        # unit tests: test/unit/webmcp.test.js (and the others)
npx playwright test test/e2e/webmcp-*.spec.js   # end-to-end tests of the four groups
```

The unit tests run in Node with no browser. They cover the filter, sort and paging helpers, and
`define` and `call`. The e2e specs start the app and call the tools through `MTWebMCP.call` and
`callAsAgent`. Each group has a spec: `webmcp-session.spec.js`, `webmcp-query.spec.js`,
`webmcp-style.spec.js` and `webmcp-views.spec.js`.
