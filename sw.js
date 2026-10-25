/* sw.js — 오프라인 캐시: 앱 파일은 캐시 우선, 구글 폰트는 받아 둔 것 재사용 */
const VERSION = 'bk-shorts-v1';
const FONTS = 'bk-shorts-fonts';
/* 같은 주소(bangkeukryul.github.io)를 BK톡톡과 함께 쓰므로, 지울 때는 BK쇼츠 것('bk-shorts-'로 시작)만 지운다 */
const APP = ['./', './index.html', './style.css', './app.js', './engine.js', './mp4mux.js', './samples.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('bk-shorts-') || k.startsWith('gamseong-')) && k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true })).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => hit || (req.mode === 'navigate' ? caches.open(VERSION).then(c => c.match('./index.html')) : undefined));
    return hit || net;
  }));
});
