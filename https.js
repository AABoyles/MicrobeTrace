#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const express = require('express');

var app = express().use(express.static(__dirname));

https.createServer({
  key:  fs.readFileSync('sslcert/key.pem', 'utf8'),
  cert: fs.readFileSync('sslcert/cert.pem', 'utf8')
}, app).listen(process.env.PORT || 5000);
