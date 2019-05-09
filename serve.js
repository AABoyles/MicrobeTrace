#!/usr/bin/env node

const express = require('express');
const expressStaticGzip = require("express-static-gzip");

express()
  .use(expressStaticGzip(__dirname, {
    enableBrotli: true,
    orderPreference: ['br', 'gz'],
    setHeaders: res => {
      res.setHeader('Strict-Transport-Security', 'max-age=1209600; includeSubDomains');
    }
  }))
  .listen(process.env.PORT || 5000);
