#!/bin/sh

echo "var CACHE = 'MicrobeTraceD`date +%Y-%m-%d`R`shuf -i 1000-9999 -n 1`';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([" > sw.js

cat cache.extra | sed "s/.*/        '&',/" >> sw.js
ls vendor/*     | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls dist/*       | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls workers/*    | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls components/* | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls fonts/*      | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls img/*        | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls data/*       | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js
ls help/*.md    | grep -vE "*\.(br|gz)" | sed "s/.*/        '&',/" >> sw.js

echo """      ]);
    })
  );
});

self.addEventListener('fetch', function(evt){
  evt.respondWith(fetch(evt.request).catch(function(){
    return caches.open(CACHE).then(function(cache){
      return cache.match(evt.request).then(function(matching){
        return matching || Promise.reject('No Match for ', evt.request, 'in Service Worker Cache!');
      });
    });
  }));
});
""" >> sw.js
