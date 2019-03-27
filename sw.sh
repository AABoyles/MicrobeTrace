#!/bin/sh

ls components/ | sed -e 's/^/components\//' | sed "s/.*/        '&',/" >> temp

ls scripts/ | sed -e 's/^/scripts\//' | sed "s/.*/        '&',/" >> temp
cat index.html | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> temp
cat components/*.html | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> temp
cat scripts/*.js | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> temp
ls vendor/ | sed -e 's/^/vendor\//' | sed "s/.*/        '&',/" >> temp

ls stylesheets/ | sed -e 's/^/stylesheets\//' | sed "s/.*/        '&',/" >> temp
cat index.html | grep -o "node_modules/.*\.css" | sed "s/.*/        '&',/" >> temp
cat components/*.html | grep -o "node_modules/.*\.css" | sed "s/.*/        '&',/" >> temp

ls img/ | sed -e 's/^/img\//' | sed "s/.*/        '&',/" >> temp

ls data/ | sed -e 's/^/data\//' | sed "s/.*/        '&',/" >> temp

ls help/*.md | sed "s/.*/        '&',/" >> temp

cat cache.extra | sed "s/.*/        '&',/" >> temp

echo "var CACHE = 'MicrobeTraceD`date +%Y-%m-%d`R`shuf -i 1000-9999 -n 1`';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([" > sw.js

awk '!seen[$0]++' temp >> sw.js
rm temp

echo """      ]);
    })
  );
});

self.addEventListener('fetch', function(evt){
  evt.respondWith(fetch(evt.request).catch(function(){
    return caches.open(CACHE).then(function(cache){
      return cache.match(evt.request).then(function(matching){
        return matching || Promise.reject('no-match');
      });
    });
  }));
});
""" >> sw.js
