(function(self){
  'use strict';

  // Shared by the WebMCP tool modules (session.js, style.js, views.js): the JSON
  // Schema builders for their inputSchema, and the deep equality the tools use to
  // tell whether a setting already has the value asked for. Loaded after
  // src/webmcp.js, which defines MTWebMCP, and before the modules that use it.

  // An object schema. `required` is left out when there are none, since an empty
  // list is not valid in every JSON Schema draft
  const obj = (properties, required) => Object.assign({ type: 'object', properties }, required && required.length ? { required } : {});
  const str = (description, extra) => Object.assign({ type: 'string', description }, extra);
  const num = (description, extra) => Object.assign({ type: 'number', description }, extra);
  const bool = (description, def) => ({ type: 'boolean', description, default: def });

  // Equal as JSON: the same values in the same shape, which is all a setting or a
  // tool's answer needs to be compared by
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  self.MTWebMCP.schema = { obj, str, num, bool, same };

})(typeof self !== 'undefined' ? self : this);
