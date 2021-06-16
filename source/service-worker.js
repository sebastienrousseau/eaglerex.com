---
---

{% capture digest_paths %}{% for asset in assets %}{% unless asset[0] contains "/" %}{% unless asset[0] contains "merriweather" %}{% unless asset[0] contains "raleway" %}{% unless asset[0] contains "package" %}{{ asset[1].digest_path }},{% endunless %}{% endunless %}{% endunless %}{% endunless %}{% endfor %}{% endcapture %}

var version = "v{{ site.sw_cache_version }}-";

var staticCacheName = version + "assets-{{ digest_paths | md5 }}";
var staticAssets = ['/manifest.json', '{{ digest_paths | split: "," | join: "', '" }}'];

var pageCacheName = version + 'pages';
var offlinePages = ['/', 'api', '/offline/'];
var currentCaches = [staticCacheName, pageCacheName];

self.addEventListener('install', function(event) {
  event.waitUntil(
    Promise.all([
      cacheAllIn(staticAssets, staticCacheName),
      cacheAllIn(offlinePages, pageCacheName)
    ]).then(function() {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    deleteOldCaches(currentCaches).then(function() {
      self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (url.pathname.match(/^\/((assets)\/|manifest.json$)/)) {
    if (event.request.headers.get('range')) {
      event.respondWith(returnRangeRequest(event.request, staticCacheName));
    } else {
      event.respondWith(returnFromCacheOrFetch(event.request, staticCacheName));
    }
  } else if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('Accept').indexOf('text/html') !== -1
  ) {
    // cache then network
    event.respondWith(cacheThenNetwork(event.request, pageCacheName));
  }
});

function returnRangeRequest(request, cacheName) {
  return caches
    .open(cacheName)
    .then(function(cache) {
      return cache.match(request.url);
    })
    .then(function(res) {
      if (!res) {
        fetch(request.url)
          .then(res => {
            return caches
              .open(cacheName)
              .then(cache => cache.put(request, res))
          });
        return fetch(request);
      } else {
        return res;
      }
    })
    .then(function(res) {
      if (res.status === 206) {
        return res;
      } else {
        return res.blob();
      }
    })
    .then(function(responseOrBlob) {
      if (responseOrBlob instanceof Response) {
        return responseOrBlob;
      }
      const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(
        request.headers.get('range')
      );
      if (bytes) {
        const start = Number(bytes[1]);
        const end = Number(bytes[2]) || responseOrBlob.size - 1;
        return new Response(responseOrBlob.slice(start, end + 1), {
          status: 206,
          statusText: 'Partial Content',
          headers: [
            ['Content-Range', `bytes ${start}-${end}/${responseOrBlob.size}`]
          ]
        });
      } else {
        return new Response(null, {
          status: 416,
          statusText: 'Range Not Satisfiable',
          headers: [['Content-Range', `*/${responseOrBlob.size}`]]
        });
      }
    });
}
function cacheAllIn(paths, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.addAll(paths);
  });
}
function deleteOldCaches(currentCaches) {
  return caches.keys().then(function(names) {
    return Promise.all(
      names
        .filter(function(name) {
          return currentCaches.indexOf(name) === -1;
        })
        .map(function(name) {
          return caches.delete(name);
        })
    );
  });
}
function openCacheAndMatchRequest(cacheName, request) {
  var cachePromise = caches.open(cacheName);
  var matchPromise = cachePromise.then(function(cache) {
    return cache.match(request);
  });
  return [cachePromise, matchPromise];
}

function cacheSuccessfulResponse(cache, request, response) {
  if (response.ok) {
    return cache.put(request, response.clone()).then(() => {
      return response;
    });
  } else {
    return response;
  }
}

function returnFromCacheOrFetch(request, cacheName) {
  return Promise.all(openCacheAndMatchRequest(cacheName, request)).then(
    function(responses) {
      var cache = responses[0];
      var cacheResponse = responses[1];
      // return the cached response if we have it, otherwise the result of the fetch.
      return (
        cacheResponse ||
        fetch(request).then(function(fetchResponse) {
          // Cache the updated file and then return the response
          cacheSuccessfulResponse(cache, request, fetchResponse);
          return fetchResponse;
        })
      );
    }
  );
}

function cacheThenNetwork(request, cacheName) {
  return Promise.all(openCacheAndMatchRequest(cacheName, request)).then(
    function(responses) {
      var cache = responses[0];
      var cacheResponse = responses[1];
      if (cacheResponse) {
        // If it's in the cache then start a fetch to update the cache, but
        // return the cached response
        fetch(request)
          .then(function(fetchResponse) {
            return cacheSuccessfulResponse(cache, request, fetchResponse);
          })
          .then(refresh)
          .catch(function(err) {
            // Offline/network failure, but nothing to worry about
          });
        return cacheResponse;
      } else {
        // If it's not in the cache then start a fetch
        return fetch(request)
          .then(function(fetchResponse) {
            cacheSuccessfulResponse(cache, request, fetchResponse);
            return fetchResponse;
          })
          .catch(function() {
            // Offline, so return the offline page.
            return caches.match('/offline/');
          });
      }
    }
  );
}
function refresh(response) {
  return self.clients.matchAll().then(function(clients) {
    if (response.headers.get('Content-Type').indexOf('text/html') !== -1) {
      clients.forEach(function(client) {
        var message = {
          type: 'refresh',
          url: response.url,
          eTag: response.headers.get('ETag')
        };
        client.postMessage(JSON.stringify(message));
      });
    }
  });
}