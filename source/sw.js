// sw.js

// set names for both precache & runtime cache
workbox.core.setCacheNameDetails({
    prefix: 'eaglerex.com',
    suffix: 'v1',
    precache: 'precache',
    runtime: 'runtime-cache'
});

// let Service Worker take control of pages ASAP
workbox.skipWaiting();
workbox.clientsClaim();

// default to `networkFirst` strategy
workbox.routing.setDefaultHandler(workbox.strategies.networkFirst());

// let Workbox handle our precache list
// NOTE: This will be populated by jekyll-workbox-plugin.
workbox.precaching.precacheAndRoute([]);

// use `Stale-while-revalidate` strategy for images and fonts.
workbox.routing.registerRoute(
    /images/, /icons/, /apis/,
    workbox.strategies.staleWhileRevalidate()
);

// Your *full* video file needs to be added to the cache at some point.
// Doing it during `install` is cleanest, but you pay the upfront cost of caching.
// You can't rely on runtime caching to implicitly cache your entire video,
// because the first incoming requests will include a Range: header,
// and the subsequent network response will only be for a small portion of the total video.
// You want the entire video, not only that small portion to be cached! 
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open('video')
        .then(c => c.add('/assets/videos/background.mp4'))
    );
});

workbox.routing.registerRoute(
    // This is only going to work reliably for same-origin video requests.
    // (Or maybe CORS-enabled ones, but https://bugs.webkit.org/show_bug.cgi?id=184447
    //  suggests that could be a problem in Safari.)
    // We need access to the video data in the response body, so opaque responses are a no-no.
    new RegExp('\\.mp4$'),

    workbox.strategies.cacheOnly({
        // Use the same cache name as we used when manually populating the cache.
        cacheName: 'video',
        plugins: [
            // If we have the *entire* video in the cache,
            // then this plugin will properly honor the Range: header on incoming requests,
            // and slice up the response body, giving back only what's asked for.
            new workbox.rangeRequests.Plugin()
        ],
        matchOptions: {
            ignoreVary: true
        }
    })
);
