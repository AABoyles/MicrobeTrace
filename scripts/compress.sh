#!/bin/sh

echo 'Compressing Large Files...'

npx gzipper --brotli scripts/
npx gzipper scripts/
npx gzipper --brotli stylesheets/
npx gzipper stylesheets/
npx gzipper --brotli workers/
npx gzipper workers/
# npx gzipper --brotli data/
# npx gzipper data/
# npx gzipper --brotli components/
# npx gzipper components/
