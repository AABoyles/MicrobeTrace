#!/usr/bin/env node

const express = require('express');
const compression = require('compression');

express()
  .use(express.static(__dirname, {
    setHeaders: res => {
      //res.setHeader('HTTP-Strict-Transport-Security', 'max-age=1209600; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' googletagmanager.com; connect-src 'self' googletagmanager.com; img-src 'self' api.mapbox.com data:; style-src 'self' 'unsafe-inline'; manifest-src 'self'; font-src 'self';");
    }
  }))
  .use(compression())
  .listen(process.env.PORT || 5000);
