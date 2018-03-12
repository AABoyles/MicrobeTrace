#!/bin/sh

echo "CACHE MANIFEST
# `date +%Y-%m-%d`

CACHE:
index.html
stylesheets/main.css" > microbetrace.appcache
ls components/ | sed -e 's/^/components\//' >> microbetrace.appcache
ls scripts/ | sed -e 's/^/scripts\//' >> microbetrace.appcache
ls vendor/ | sed -e 's/^/vendor\//' >> microbetrace.appcache
ls img/ | sed -e 's/^/img\//' >> microbetrace.appcache
cat index.html | grep -o "node_modules/.*\.js" >> microbetrace.appcache
cat components/*.html | grep -o "node_modules/.*\.js" >> microbetrace.appcache
cat index.html | grep -o "node_modules/.*\.css" >> microbetrace.appcache
cat components/*.html | grep -o "node_modules/.*\.css" >> microbetrace.appcache
ls data/ | sed -e 's/^/data\//' >> microbetrace.appcache

echo "
NETWORK:
*" >> microbetrace.appcache
