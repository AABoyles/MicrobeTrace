#!/bin/bash

# Rebuilds the bx-distance-models WebAssembly engine used by workers/compute-links.js
# and copies it into vendor/. Usage: scripts/build-bx.sh [path/to/bx-distance-models]
# Needs Rust with the wasm32-unknown-unknown target and wasm-pack.

set -e
src=${1:-../bx-distance-models}
out=$(mktemp -d)

# no-modules: a classic script that Web Workers can load with importScripts()
wasm-pack build "$src" --release --target no-modules --out-dir "$out"
cp "$out/bx_distance_models.js" "$out/bx_distance_models_bg.wasm" vendor/
rm -rf "$out"
echo "Copied bx-distance-models ($(git -C "$src" rev-parse --short HEAD)) into vendor/"
