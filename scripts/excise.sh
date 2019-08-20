#!/bin/sh

scripts/cleanup.sh

rm -rf demo/ docs/ node_modules/ test/ \
      *.md *.sh package-lock.json\
      cache.extra Dockerfile postcss.config.js
