#!/usr/bin/env node

const express = require('express');
const compression = require('compression');

express()
  .use(express.static(__dirname, {
    setHeaders: res => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' googletagmanager.com 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; img-src 'self' api.mapbox.com data:; style-src 'self' 'unsafe-inline'; manifest-src 'self'; font-src 'self';");
      //res.setHeader('HTTP-Strict-Transport-Security', 'max-age=1209600; includeSubDomains');
    }
  }))
  .use(compression())
  .listen(process.env.PORT || 5000);
