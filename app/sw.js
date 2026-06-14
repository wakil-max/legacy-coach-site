/* Legacy Foundry app — service worker (network-first, cache fallback) */
var CACHE = 'lf-app-v1';
var CORE = ['./','./index.html','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', function(e){ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE).catch(function(){}); })); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method!=='GET') return;
  var url = new URL(req.url);
  // never cache API calls (supabase, gemini, config)
  if(url.origin!==location.origin || url.pathname.indexOf('config.js')>=0){ return; }
  e.respondWith(
    fetch(req).then(function(res){ var copy=res.clone(); caches.open(CACHE).then(function(c){ c.put(req,copy).catch(function(){}); }); return res; })
      .catch(function(){ return caches.match(req).then(function(m){ return m || caches.match('./index.html'); }); })
  );
});
