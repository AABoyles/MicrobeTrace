#!/usr/bin/env node

const express = require('express');
const compression = require('compression');

var app = express().use(compression());

app
  .use(express.static(__dirname))
  .listen(process.env.PORT || 5000);
