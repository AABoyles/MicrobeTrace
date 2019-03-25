#!/usr/bin/env node

const express = require('express');
const compression = require('compression');
const serveStatic = require('serve-static');

express()
  .use(serveStatic(__dirname, {
    setHeaders: res => res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; img-src * data:; script-src 'self' googletagmanager.com 'unsafe-inline' 'unsafe-eval'")
  }))
  .use(compression())
  .listen(process.env.PORT || 5000);
