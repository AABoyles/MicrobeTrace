#!/usr/bin/env node

const express = require('express');
const compression = require('compression');

express()
  .use(express.static(__dirname, {
    setHeaders: res => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' googletagmanager.com *.google-analytics.com; connect-src 'self' googletagmanager.com *.google-analytics.com; img-src 'self' *.google-analytics.com *.doubleclick.net www.google.com api.mapbox.com data:; style-src 'self' 'unsafe-inline'; manifest-src 'self'; font-src 'self';");
      res.setHeader('Strict-Transport-Security', 'max-age=1209600; includeSubDomains');
    }
  }))
  .use(compression())
  .listen(process.env.PORT || 5000);
