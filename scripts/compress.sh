#!/bin/sh

echo 'Compressing Large Files...'

npx gzipper compress --brotli components/
npx gzipper compress --gzip components/
npx gzipper compress --brotli data/
npx gzipper compress --gzip data/
npx gzipper compress --brotli dist/
npx gzipper compress --gzip dist/
npx gzipper compress --brotli vendor/
npx gzipper compress --gzip vendor/
npx gzipper compress --brotli workers/
npx gzipper compress --gzip workers/
