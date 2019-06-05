#!/bin/sh

scripts/cleanup.sh

rmdir /s .git demo/ docs/ node_modules/ test/ \
      *.md *.sh package-lock.json\
      cache.extra Dockerfile postcss.config.js
