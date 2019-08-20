#!/usr/bin/env node

const express = require("express");
const redirectToHTTPS = require("express-http-to-https").redirectToHTTPS;
const expressStaticGzip = require("express-static-gzip");

var app = express();

app.use(redirectToHTTPS([/^localhost:?\d*$/, /^127.0.0.1:?\d*$/], [], 301));

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
