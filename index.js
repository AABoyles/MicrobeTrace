#!/usr/bin/env node

const express = require('express');

const redirect = express.Router().get('/', function(req, res, next){
  if(req.get('X-Forwarded-Proto') !== 'https'){
    res.redirect('https://' + req.get('Host') + req.url);
  }
});

express()
  .use(redirect, express.static(__dirname))
  .listen(process.env.PORT || 5000);
