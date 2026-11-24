// Builds the page's MT (#341). Importing the modules that make MT has no effect; this is
// the one place that runs them, so the page gets a single MT, on self for the classic
// scripts (components, src/index.js, WebMCP). Tests import createMT instead.
import { createMT } from './common.js';

self.MT = createMT(self);
