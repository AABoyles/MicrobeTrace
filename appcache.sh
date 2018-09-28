#!/bin/sh

echo "CACHE MANIFEST
# `date +%Y-%m-%d`

CACHE:
index.html" > microbetrace.appcache

ls components/ | sed -e 's/^/components\//' >> microbetrace.appcache

ls scripts/ | sed -e 's/^/scripts\//' >> microbetrace.appcache
cat index.html | grep -o "node_modules/.*\.js" >> microbetrace.appcache
cat components/*.html | grep -o "node_modules/.*\.js" >> microbetrace.appcache
cat scripts/*.js | grep -o "node_modules/.*\.js" >> microbetrace.appcache
ls vendor/ | sed -e 's/^/vendor\//' >> microbetrace.appcache

ls stylesheets/ | sed -e 's/^/stylesheets\//' >> microbetrace.appcache
cat index.html | grep -o "node_modules/.*\.css" >> microbetrace.appcache
cat components/*.html | grep -o "node_modules/.*\.css" >> microbetrace.appcache

ls img/ | sed -e 's/^/img\//' >> microbetrace.appcache

ls data/ | sed -e 's/^/data\//' >> microbetrace.appcache
cat cache.extra >> microbetrace.appcache

echo "
NETWORK:
*

SETTINGS:
prefer-online
" >> microbetrace.appcache
