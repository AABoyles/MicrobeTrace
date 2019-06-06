#!/usr/bin/env node

const express = require("express");
const expressStaticGzip = require("express-static-gzip");

var app = express();

app.use(function(req, res, next) {
  if (req.secure || req.headers.host.split(":")[0] == "localhost") {
    next();
  } else {
    res.redirect("https://" + req.headers.host + req.url);
  }
});

app.use(
  expressStaticGzip(__dirname, {
    enableBrotli: true,
    orderPreference: ["br", "gz"],
    setHeaders: res => {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=1209600; includeSubDomains"
      );
    }
  })
);

app.listen(process.env.PORT || 5000);
