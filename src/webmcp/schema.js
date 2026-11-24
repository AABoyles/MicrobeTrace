// Shared by the WebMCP tool modules: the JSON Schema builders for their
// inputSchema, and the deep equality the tools use to tell whether a setting
// already has the value asked for.

// An object schema. `required` is left out when there are none, since an empty
// list is not valid in every JSON Schema draft
export const obj = (properties, required) => Object.assign({ type: 'object', properties }, required && required.length ? { required } : {});
export const str = (description, extra) => Object.assign({ type: 'string', description }, extra);
export const num = (description, extra) => Object.assign({ type: 'number', description }, extra);
export const bool = (description, def) => ({ type: 'boolean', description, default: def });

// Equal as JSON: the same values in the same shape, which is all a setting or a
// tool's answer needs to be compared by
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
