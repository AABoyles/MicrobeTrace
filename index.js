#!/usr/bin/env nodejs

const { execFileSync } = require('child_process');
execFileSync('node_modules/http-server/bin/http-server', []);
