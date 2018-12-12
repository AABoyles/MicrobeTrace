#!/usr/bin/env node

const express = require('express');

express()
  .use(express.static(__dirname))
  .listen(process.env.PORT || 5000);
