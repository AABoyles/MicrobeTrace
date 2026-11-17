#!/usr/bin/env node

const express = require("express");
const path = require("path");
const fs = require("fs");
const redirectToHTTPS = require("express-http-to-https").redirectToHTTPS;
const expressStaticGzip = require("express-static-gzip");

const app = express();

// ---------------------------------------------------------------------------
// Remove X-Powered-By header (security: don't reveal the framework)
// ---------------------------------------------------------------------------
app.disable("x-powered-by");

// ---------------------------------------------------------------------------
// Static asset extension heuristic
// ---------------------------------------------------------------------------
const STATIC_EXTENSIONS = new Set([
  ".js", ".mjs", ".css", ".html",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif", ".woff",
  ".woff2", ".ttf", ".eot", ".otf", ".map",
  ".br", ".gz",
]);

const isStaticAsset = (url) =>
  STATIC_EXTENSIONS.has(path.extname(url).toLowerCase());

// ---------------------------------------------------------------------------
// 1. Security headers (every response)
// ---------------------------------------------------------------------------
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
    "googletagmanager.com *.google-analytics.com; " +
    "connect-src 'self' googletagmanager.com *.google-analytics.com " +
    "stats.g.doubleclick.net *.cdc.gov; " +
    "img-src 'self' googletagmanager.com *.google-analytics.com " +
    "*.doubleclick.net www.google.com *.basemaps.cartocdn.com " +
    "server.arcgisonline.com data:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "manifest-src 'self'; font-src 'self';",
};

for (const [key, value] of Object.entries(securityHeaders)) {
  app.use((req, res, next) => {
    res.setHeader(key, value);
    next();
  });
}

// ---------------------------------------------------------------------------
// 2. HTTPS redirect (non-localhost only)
// ---------------------------------------------------------------------------
app.use(redirectToHTTPS([/^localhost:\d*$/, /^127\.0\.0\.1:\d*$/], [], 301));

// ---------------------------------------------------------------------------
// 3. Cache-Control headers
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (isStaticAsset(req.url)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-cache");
  }
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
  res.json({
    status: "ok",
    uptime: process.uptime(),
    version: require(path.join(__dirname, "package.json")).version,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 6. Static file serving (Brotli / Gzip)
// expressStaticGzip only calls next() for paths it cannot serve
// ---------------------------------------------------------------------------
app.use(
  expressStaticGzip(path.join(__dirname, "."), {
    enableBrotli: true,
    orderPreference: ["br", "gz"],
  })
);

// ---------------------------------------------------------------------------
// 7. SPA catch-all — unmatched GET requests get index.html
// This is reached only when expressStaticGzip could not serve a file
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  // Prevent directory traversal
  const resolved = path.resolve(path.join(__dirname, req.url));
  if (!resolved.startsWith(path.resolve(__dirname))) {
    return res.status(403).type("html").send("Forbidden");
  }

  // GET → serve index.html for client-side routing (SPA)
  if (req.method === "GET") {
    // Guard: don't serve index.html for paths that look like API endpoints
    if (req.url.startsWith("/api/")) {
      return next();
    }
    return res.sendFile(path.join(__dirname, "index.html"));
  }

  // Non-GET → fall through to 404
  next();
});

// ---------------------------------------------------------------------------
// 8. Explicit 404 for anything that reaches here
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).type("html").send(
    "<!DOCTYPE html><html><head><title>404</title></head>" +
    "<body><h1>404 - Not Found</h1>" +
    '<p><a href="/">Return to MicrobeTrace</a></p></body></html>'
  );
});

// ---------------------------------------------------------------------------
// 9. Global error handler — no stack traces to clients
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MicrobeTrace server running on port ${PORT}`);
  console.log(
    `Environment: ${process.env.NODE_ENV || "production"}`
  );
});
