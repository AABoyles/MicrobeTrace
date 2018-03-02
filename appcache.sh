#!/bin/sh

echo "CACHE MANIFEST
# `date +%Y-%m-%d`

CACHE:
index.html
stylesheets/main.css
scripts/app.js
components/nav.html" > microbetrace.appcache

cat index.html | grep -o "node_modules/.*.js" >> microbetrace.appcache
cat index.html | grep -o "node_modules/.*.css" >> microbetrace.appcache

echo "
NETWORK:
*
" >> microbetrace.appcache
