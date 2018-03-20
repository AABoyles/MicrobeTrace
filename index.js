#!/usr/bin/env nodejs

const { execFileSync } = require('child_process');

var port = process.env.PORT || 8080;
execFileSync('node_modules/http-server/bin/http-server', ['-p', port]);
