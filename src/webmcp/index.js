// Registers every WebMCP tool with MTWebMCP (src/webmcp.js). Each tool is a file
// of its own under session/, query/, style/ and views/, with its schema next to
// its handler; the group's index.js lists them. The order here is the order
// MTWebMCP.list() gives (#340).

import { define } from './core.js';
import session from './session/index.js';
import query from './query/index.js';
import style from './style/index.js';
import views from './views/index.js';

for (const tool of [...session, ...query, ...style, ...views]) define(tool);
