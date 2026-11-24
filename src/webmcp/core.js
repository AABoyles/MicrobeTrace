// What the tool modules take from MTWebMCP (src/webmcp.js), so each one imports
// only the names it uses. src/webmcp.js is a classic script that runs before the
// modules do, so MTWebMCP exists by the time this is evaluated.

const W = self.MTWebMCP;

export const { define, fail, waitFor, nextEvent, requireData, nodeById, pick, filter, sort, page, schemas, image } = W;
