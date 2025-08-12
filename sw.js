
const CACHE_NAME = 'friends-snake-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/music_bg.wav',
  '/assets/sfx_power.wav',
  '/assets/sfx_boost.wav'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e)=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request).then(fetchRes => {
    return caches.open(CACHE_NAME).then(cache => {
      cache.put(e.request, fetchRes.clone());
      return fetchRes;
    });
  })).catch(()=> caches.match('/index.html')));
});
