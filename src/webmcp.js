(function(self){
  'use strict';

  // MTWebMCP: MicrobeTrace's tools for AI agents, through WebMCP
  // (https://webmachinelearning.github.io/webmcp/).
  //
  // Each file in src/webmcp/ defines a group of tools:
  //
  //   MTWebMCP.define({
  //     name: 'get_node',                       // [A-Za-z0-9_.-]{1,128}
  //     title: 'Get node',
  //     description: 'What it does, for the agent choosing a tool',
  //     inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  //     annotations: { readOnlyHint: true },     // or consequentialHint: true
  //     execute: async (args, { signal }) => ({ ... })   // any JSON value
  //   });
  //
  // Where the browser has WebMCP (document.modelContext, or navigator.modelContext
  // in earlier builds) each tool is registered with it as it's defined. Either
  // way, MTWebMCP.call(name, args) runs one from the page (as the tests do), and
  // MTWebMCP.list() describes them all.
  //
  // execute returns a plain value; the agent is given it as JSON text. To give it
  // an image too, return MTWebMCP.image(dataURL, value). Throwing an Error (or
  // MTWebMCP.fail('message')) tells the agent what went wrong instead.

  const NAME = /^[A-Za-z0-9_.-]{1,128}$/;
  const tools = new Map();
  const controllers = new Map();

  const modelContext = () => {
    if (typeof document != 'undefined' && document.modelContext) return document.modelContext;
    if (typeof navigator != 'undefined' && navigator.modelContext) return navigator.modelContext;
    return null;
  };

  class ToolError extends Error {}
  const fail = message => { throw new ToolError(message); };

  const IMAGE = Symbol('image');
  // A result with an image (a data: URL) for the agent to see
  const image = (dataURL, value = {}) => ({ [IMAGE]: true, dataURL, value });

  // The result as WebMCP and MCP clients expect it: content blocks
  function toContent(result) {
    const content = [];
    if (result && result[IMAGE]) {
      const [, mimeType, data] = /^data:([^;,]+);base64,(.*)$/.exec(result.dataURL) || [];
      if (data) content.push({ type: 'image', data, mimeType });
      result = result.value;
    }
    content.unshift({ type: 'text', text: result === undefined ? 'Done.' : typeof result == 'string' ? result : JSON.stringify(result, jsonReplacer) });
    return { content };
  }

  // Dates, Sets, Maps and typed arrays as JSON can say them
  function jsonReplacer(key, value) {
    if (value instanceof Map) return Object.fromEntries(value);
    if (value instanceof Set) return Array.from(value);
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (typeof value == 'number' && !isFinite(value)) return null;
    return value;
  }

  // Runs a tool, with its result (or error) as content
  async function run(tool, args, options) {
    try {
      const result = await tool.execute(args || {}, options || {});
      return toContent(result);
    } catch (error) {
      if (!(error instanceof ToolError)) console.error('WebMCP tool ' + tool.name + ' failed:', error);
      return { content: [{ type: 'text', text: 'Error: ' + (error && error.message || error) }], isError: true };
    }
  }

  function register(tool) {
    const context = modelContext();
    if (!context || typeof context.registerTool != 'function') return;
    const controller = typeof AbortController != 'undefined' ? new AbortController() : null;
    const descriptor = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execute: (args, options) => run(tool, args, options)
    };
    try {
      const registered = context.registerTool(descriptor, controller ? { signal: controller.signal } : undefined);
      // Earlier builds returned { unregister() } instead of taking a signal
      controllers.set(tool.name, {
        abort() {
          if (controller) controller.abort();
          if (registered && typeof registered.unregister == 'function') registered.unregister();
        }
      });
      if (registered && typeof registered.catch == 'function') {
        registered.catch(error => console.warn('WebMCP: ' + tool.name + ' was not registered:', error));
      }
    } catch (error) {
      console.warn('WebMCP: ' + tool.name + ' was not registered:', error);
    }
  }

  function define(tool) {
    if (!tool || !NAME.test(tool.name)) throw new Error('Invalid WebMCP tool name: ' + (tool && tool.name));
    if (!tool.description) throw new Error('WebMCP tool ' + tool.name + ' needs a description');
    if (typeof tool.execute != 'function') throw new Error('WebMCP tool ' + tool.name + ' needs execute()');
    if (tools.has(tool.name)) throw new Error('WebMCP tool ' + tool.name + ' is defined twice');
    tool = Object.assign({ inputSchema: { type: 'object', properties: {} }, annotations: {} }, tool);
    tools.set(tool.name, tool);
    register(tool);
    return tool;
  }

  function undefine(name) {
    tools.delete(name);
    const c = controllers.get(name);
    if (c) c.abort();
    controllers.delete(name);
  }

  // Runs a tool from the page, returning its plain result (or throwing)
  async function call(name, args = {}) {
    const tool = tools.get(name);
    if (!tool) throw new Error('No WebMCP tool named ' + name);
    return tool.execute(args, {});
  }

  // Runs a tool from the page as an agent would, returning its content blocks
  async function callAsAgent(name, args = {}) {
    const tool = tools.get(name);
    if (!tool) throw new Error('No WebMCP tool named ' + name);
    return run(tool, args, {});
  }

  const list = () => Array.from(tools.values()).map(({ name, title, description, inputSchema, annotations }) =>
    ({ name, title, description, inputSchema, annotations }));

  // Shared helpers --------------------------------------------------------------

  // Waits until test() is truthy (polling), or fails after timeout ms
  function waitFor(test, { timeout = 120000, interval = 50, message = 'Timed out' } = {}) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        let value;
        try { value = test(); } catch (e) { value = false; }
        if (value) return resolve(value);
        if (Date.now() - start > timeout) return reject(new ToolError(message));
        setTimeout(check, interval);
      };
      check();
    });
  }

  // Resolves on the next MicrobeTrace event of this type (see src/events.js)
  function nextEvent(type, { timeout = 120000 } = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new ToolError('Timed out waiting for ' + type)); }, timeout);
      const off = self.MT.events.on(type, detail => { clearTimeout(timer); off(); resolve(detail); });
    });
  }

  // Fails unless a network has been loaded
  function requireData() {
    if (!self.session || !self.session.data || !self.session.data.nodes.length) {
      fail('No data is loaded. Load files (add_file then launch), open a session, or load the demo first.');
    }
    return self.session.data;
  }

  // The node with this ID, or a failure naming it
  function nodeById(id) {
    const data = requireData();
    const node = data.nodeIndex && data.nodeIndex.get('' + id) || data.nodes.find(d => d._id == id);
    if (!node) fail('No node has the ID ' + JSON.stringify(id));
    return node;
  }

  // A plain copy of an item with only these fields (all of its own, if none)
  function pick(item, fields) {
    const out = {};
    (fields && fields.length ? fields : Object.keys(item)).forEach(f => {
      const v = item[f];
      if (typeof v != 'function') out[f] = v === undefined ? null : v;
    });
    return out;
  }

  // Filters ---------------------------------------------------------------------
  //
  // Tools that pick out nodes, links or clusters share one filter language:
  //
  //   filter: [ { field: 'cluster', op: 'eq', value: 3 },
  //             { field: 'tn93', op: 'lte', value: 0.01 } ],
  //   match: 'all'   // or 'any'
  //
  // Comparisons with numbers compare numerically (and dates as dates when both
  // sides read as dates); text comparisons ignore case unless caseSensitive.

  const OPS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'nin', 'contains', 'startsWith', 'endsWith', 'regex', 'empty', 'notEmpty'];

  const filterSchema = {
    type: 'array',
    description: 'Conditions an item must meet. Each is {field, op, value}. ops: ' + OPS.join(', ') +
      '. "in"/"nin" take an array value; "regex" a regular expression; "empty"/"notEmpty" no value. ' +
      'Numbers compare numerically, ISO dates as dates, text case-insensitively unless caseSensitive is set.',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'The field to test' },
        op: { type: 'string', enum: OPS },
        value: { description: 'The value to compare with' },
        caseSensitive: { type: 'boolean' }
      },
      required: ['field', 'op']
    }
  };
  const matchSchema = { type: 'string', enum: ['all', 'any'], description: 'Whether items must meet all conditions (default) or any one' };

  const isEmpty = v => v === undefined || v === null || v === '' || (typeof v == 'number' && isNaN(v)) || (Array.isArray(v) && !v.length);
  const asNumber = v => typeof v == 'number' ? v : typeof v == 'string' && v.trim() !== '' && !isNaN(+v) ? +v : NaN;
  const asTime = v => {
    if (v instanceof Date) return v.getTime();
    if (typeof v == 'string' && /^\d{4}-\d{1,2}(-\d{1,2})?|[A-Za-z]{3} [A-Za-z]{3} \d/.test(v)) {
      const t = Date.parse(v);
      return isNaN(t) ? NaN : t;
    }
    return NaN;
  };

  function compare(a, b) {
    const na = asNumber(a), nb = asNumber(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    const ta = asTime(a), tb = asTime(b);
    if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
    return String(a).localeCompare(String(b));
  }

  function test(item, { field, op, value, caseSensitive }) {
    const v = item[field];
    const text = x => caseSensitive ? String(x) : String(x).toLowerCase();
    const equals = (x, y) => {
      if (isEmpty(x) || isEmpty(y)) return isEmpty(x) && isEmpty(y);
      const nx = asNumber(x), ny = asNumber(y);
      if (!isNaN(nx) && !isNaN(ny)) return nx == ny;
      return text(x) == text(y);
    };
    const values = [].concat(v); // links' origins and the like are lists
    switch (op) {
      case 'eq': return values.some(x => equals(x, value));
      case 'ne': return !values.some(x => equals(x, value));
      case 'lt': return !isEmpty(v) && compare(v, value) < 0;
      case 'lte': return !isEmpty(v) && compare(v, value) <= 0;
      case 'gt': return !isEmpty(v) && compare(v, value) > 0;
      case 'gte': return !isEmpty(v) && compare(v, value) >= 0;
      case 'in': return [].concat(value).some(y => values.some(x => equals(x, y)));
      case 'nin': return ![].concat(value).some(y => values.some(x => equals(x, y)));
      case 'contains': return !isEmpty(v) && values.some(x => text(x).includes(text(value)));
      case 'startsWith': return !isEmpty(v) && values.some(x => text(x).startsWith(text(value)));
      case 'endsWith': return !isEmpty(v) && values.some(x => text(x).endsWith(text(value)));
      case 'regex': {
        let re;
        try { re = new RegExp(value, caseSensitive ? '' : 'i'); } catch (e) { fail('Invalid regex: ' + value); }
        return !isEmpty(v) && values.some(x => re.test(String(x)));
      }
      case 'empty': return isEmpty(v);
      case 'notEmpty': return !isEmpty(v);
      default: fail('Unknown filter op ' + JSON.stringify(op) + '; use one of ' + OPS.join(', '));
    }
  }

  // The items meeting the filter (all of them, with no filter)
  function filter(items, conditions, match = 'all') {
    if (!conditions || !conditions.length) return items;
    conditions.forEach(c => { if (!c || !c.field || !OPS.includes(c.op)) fail('Each filter condition needs a field and an op (' + OPS.join(', ') + ')'); });
    const any = match == 'any';
    return items.filter(item => any ? conditions.some(c => test(item, c)) : conditions.every(c => test(item, c)));
  }

  // Sorts items by fields ({field, descending}), numbers as numbers
  function sort(items, by) {
    if (!by || !by.length) return items;
    by = [].concat(by).map(s => typeof s == 'string' ? { field: s } : s);
    return items.slice().sort((a, b) => {
      for (const { field, descending } of by) {
        const ea = isEmpty(a[field]), eb = isEmpty(b[field]);
        if (ea || eb) { if (ea != eb) return ea ? 1 : -1; continue; } // empty last
        const c = compare(a[field], b[field]);
        if (c) return descending ? -c : c;
      }
      return 0;
    });
  }

  // Pages a list: { total, offset, limit, items }
  function page(items, { offset = 0, limit = 100 } = {}) {
    offset = Math.max(0, offset | 0);
    limit = Math.max(0, Math.min(limit == null ? 100 : limit, 10000));
    return { total: items.length, offset, limit, returned: Math.min(limit, Math.max(items.length - offset, 0)), items: items.slice(offset, offset + limit) };
  }

  const sortSchema = {
    type: 'array',
    description: 'Fields to sort by, in order: each a field name or {field, descending}',
    items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { field: { type: 'string' }, descending: { type: 'boolean' } }, required: ['field'] }] }
  };
  const pageSchema = {
    offset: { type: 'integer', minimum: 0, description: 'Items to skip (default 0)' },
    limit: { type: 'integer', minimum: 0, maximum: 10000, description: 'Most items to return (default 100)' }
  };

  const MTWebMCP = {
    define, undefine, call, callAsAgent, list, tools,
    available: () => !!modelContext(),
    fail, image, ToolError,
    waitFor, nextEvent, requireData, nodeById, pick,
    filter, sort, page, compare, isEmpty,
    schemas: { filter: filterSchema, match: matchSchema, sort: sortSchema, page: pageSchema },
    OPS
  };

  self.MTWebMCP = MTWebMCP;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTWebMCP;
})(typeof self !== 'undefined' ? self : this);
