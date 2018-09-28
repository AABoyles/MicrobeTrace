#!/bin/sh

echo "var cache = 'MicrobeTraceD`date +%Y-%m-%d`';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([" > sw.js

ls components/ | sed -e 's/^/components\//' | sed "s/.*/        '&',/" >> sw.js

ls scripts/ | sed -e 's/^/scripts\//' | sed "s/.*/        '&',/" >> sw.js
cat index.html | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> sw.js
cat components/*.html | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> sw.js
cat scripts/*.js | grep -o "node_modules/.*\.js" | sed "s/.*/        '&',/" >> sw.js
ls vendor/ | sed -e 's/^/vendor\//' | sed "s/.*/        '&',/" >> sw.js

ls stylesheets/ | sed -e 's/^/stylesheets\//' | sed "s/.*/        '&',/" >> sw.js
cat index.html | grep -o "node_modules/.*\.css" | sed "s/.*/        '&',/" >> sw.js
cat components/*.html | grep -o "node_modules/.*\.css" | sed "s/.*/        '&',/" >> sw.js

ls img/ | sed -e 's/^/img\//' | sed "s/.*/        '&',/" >> sw.js

ls data/ | sed -e 's/^/data\//' | sed "s/.*/        '&',/" >> sw.js
cat cache.extra | sed "s/.*/        '&',/" >> sw.js

echo "      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  event.respondWith(fromCache(event.request));
  event.waitUntil(update(event.request));
});

// Open the cache where the assets were stored and search for the requested
// resource. Notice that in case of no matching, the promise still resolves
// but it does with `undefined` as value.
function fromCache(request){
  return caches.open(CACHE).then(function(cache){
    return cache.match(request).then(function(matching){
      return matching || Promise.reject('No match for ' + request.url);
    });
  });
}

// Update consists in opening the cache, performing a network request and
// storing the new response data.
function update(request){
  return caches.open(CACHE).then(function(cache){
    return fetch(request).then(function(response){
      return cache.put(request, response);
    }).catch(function(error){
      //console.error(error + ' ' + request.url);
    });
  });
}
" >> sw.js
