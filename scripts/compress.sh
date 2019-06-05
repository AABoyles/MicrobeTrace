#!/bin/sh

echo 'Compressing Large Files...'

npx gzipper --brotli dist/
npx gzipper dist/
npx gzipper --brotli workers/
npx gzipper workers/
npx gzipper --brotli data/
npx gzipper data/
npx gzipper --brotli components/
npx gzipper components/
