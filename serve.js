#!/usr/bin/env node

const express = require('express');
const compression = require('compression');

express()
  .use(express.static(__dirname, {
    setHeaders: res => {
      res.setHeader('Strict-Transport-Security', 'max-age=1209600; includeSubDomains');
    }
  }))
  .use(compression())
  .listen(process.env.PORT || 5000);
