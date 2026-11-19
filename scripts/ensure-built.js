#!/usr/bin/env node
// Builds what the app needs and the repository doesn't commit (#325) before
// `npm start`: dist/, vendor/ and fonts/ (`npm run bundle`, only when missing)
// and sw.js (`npm run cache`, always, since it is quick and lists the files).
// The bundles come from the dev dependencies, so a production-only install
// can't build them; it says so instead of failing halfway.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const exists = file => fs.existsSync(path.join(root, file));

// One output of each part of scripts/bundle.sh
const outputs = ["dist/bundle.primary.js", "dist/bundle.secondary.js", "dist/versions.json",
  "vendor/tn93.min.js", "vendor/cosmos.min.js", "fonts/bootstrap-icons.woff2"];

const missing = outputs.filter(file => !exists(file));
if (missing.length) {
  if (!exists("node_modules/esbuild")) {
    console.error(`MicrobeTrace isn't built (${missing.join(", ")} missing), and building it needs the ` +
      "dev dependencies. Run `npm ci` (without --omit=dev), then `npm start` again.");
    process.exit(1);
  }
  console.log("Building dist/, vendor/ and fonts/ (npm run bundle)...");
  execFileSync("bash", [path.join(__dirname, "bundle.sh")], { cwd: root, stdio: "inherit" });
}
execFileSync(process.execPath, [path.join(__dirname, "build-sw.js")], { cwd: root, stdio: "inherit" });
