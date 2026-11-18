#!/usr/bin/env node

const express = require("express");
const path = require("path");
const redirectToHTTPS = require("express-http-to-https").redirectToHTTPS;
const expressStaticGzip = require("express-static-gzip");

// What is served (#210). Either SITE_DIR, a directory holding exactly the
// published files (the Docker image builds one with scripts/build-site.js), or,
// when it is not set, the repository itself restricted to siteFiles(): the same
// list the GitHub Pages deploy publishes, so the two cannot drift apart. Tests,
// docs, package-lock.json, Dockerfile, server.js and node_modules stay private.
const SITE_DIR = process.env.SITE_DIR ? path.resolve(__dirname, process.env.SITE_DIR) : null;
const root = SITE_DIR || __dirname;
const served = SITE_DIR ? null : new Set(require("./scripts/build-site.js").siteFiles());

const app = express();

// ---------------------------------------------------------------------------
// Remove X-Powered-By header (security: don't reveal the framework)
// ---------------------------------------------------------------------------
app.disable("x-powered-by");

// ---------------------------------------------------------------------------
// 1. Security headers (every response)
// ---------------------------------------------------------------------------
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; " +
    "connect-src 'self'; " +
    "img-src 'self' *.basemaps.cartocdn.com server.arcgisonline.com data:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "manifest-src 'self'; font-src 'self'; " +
    "base-uri 'none'; form-action 'none'; object-src 'none';",
};

for (const [key, value] of Object.entries(securityHeaders)) {
  app.use((req, res, next) => {
    res.setHeader(key, value);
    next();
  });
}

// ---------------------------------------------------------------------------
// 2. HTTPS redirect, opt-in (#210): set FORCE_HTTPS=1 when running behind a
// proxy or load balancer that terminates TLS and sets X-Forwarded-Proto. Off by
// default, because run directly (e.g. `docker run -p 5000:5000`) nothing serves
// HTTPS and every request would redirect to a dead end. localhost is exempt.
// ---------------------------------------------------------------------------
if (/^(1|true|yes|on)$/i.test(process.env.FORCE_HTTPS || "")) {
  app.use(redirectToHTTPS([/^localhost:\d*$/, /^127\.0\.0\.1:\d*$/], [], 301));
}

// ---------------------------------------------------------------------------
// 3. Cache-Control headers (#211)
// Nothing here has a content hash in its name (index.html, src/*.js, dist/*,
// fonts/, vendor/ ... are all served at fixed URLs), so none of it may be
// "immutable": a browser holding such a copy would ignore a deployed fix for a
// year. "no-cache" lets browsers keep a copy but revalidate it every time; the
// static middleware below adds ETag and Last-Modified, so an unchanged file
// costs a 304 with no body. (The service worker, sw.js, handles offline use.)
// ---------------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  next();
});

// ---------------------------------------------------------------------------
// 4. Access logging
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${res.getHeader("content-length") || 0}B - ${Date.now() - start}ms`
    );
  });
  next();
});

// ---------------------------------------------------------------------------
// 5. Health check endpoint (before static serving)
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// 6. Static file serving (Brotli / Gzip), only for files the app needs (#210)
// A path outside the served set is a 404, never index.html: a missing .js file
// must not answer with HTML (a service worker could cache it under a script
// URL). expressStaticGzip then finds .br/.gz siblings of the files that pass.
// "/" is served as index.html by the static middleware; the app has no
// client-side routes (it uses the #hash only), so nothing else falls back to it.
// ---------------------------------------------------------------------------
if (served) {
  app.use((req, res, next) => {
    let pathname;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return notFound(req, res);
    }
    const file = pathname.replace(/^\/+/, "");
    if (file === "" || served.has(file)) return next();
    return notFound(req, res);
  });
}

app.use(
  expressStaticGzip(root, {
    enableBrotli: true,
    orderPreference: ["br", "gz"],
    serveStatic: { index: "index.html" },
  })
);

// ---------------------------------------------------------------------------
// 7. Explicit 404 for anything that reaches here
// ---------------------------------------------------------------------------
function notFound(_req, res) {
  res.status(404).type("html").send(
    "<!DOCTYPE html><html><head><title>404</title></head>" +
    "<body><h1>404 - Not Found</h1>" +
    '<p><a href="/">Return to MicrobeTrace</a></p></body></html>'
  );
}
app.use(notFound);

// ---------------------------------------------------------------------------
// 8. Global error handler — no stack traces to clients
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error(`${new Date().toISOString()} ERROR: ${err.message}`);
  res.status(500).type("html").send(
    "<!DOCTYPE html><html><head><title>Error</title></head>" +
    "<body><h1>Something went wrong</h1>" +
    "<p>Please try refreshing the page.</p></body></html>"
  );
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`MicrobeTrace server running on port ${PORT}`);
    console.log(
      `Environment: ${process.env.NODE_ENV || "production"}`
    );
  });
}

module.exports = app;
