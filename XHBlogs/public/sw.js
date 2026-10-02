// zzcspace Service Worker：PWA 安装 + 离线读取已访问内容。
// 策略：
//   - HTML 导航 / RSC 数据(.txt)：网络优先（保证每次部署后内容立刻最新），断网回退缓存
//   - 内容寻址的静态资源（_next/static、图标、字体、图片）：缓存优先
//   - API（/api/*）与音视频：一律直连，不缓存
const VERSION = 'zzc-v1';
const CORE_CACHE = VERSION + '-core';
const ASSET_CACHE = VERSION + '-assets';
const CORE_URLS = ['/', '/archive', '/chatter', '/photowall', '/404.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => Promise.allSettled(CORE_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHashedAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/photos/') ||
    url.pathname.startsWith('/images/') ||
    /\.(woff2?|ttf|png|jpe?g|webp|gif|svg)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (/\.(mp3|m4a|ogg|wav|mp4|webm)$/i.test(url.pathname)) return; // 音视频走 Range，不适合缓存

  // 缓存优先：内容寻址资源
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // 网络优先：页面与 RSC 数据；失败回退缓存，导航再回退首页
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CORE_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const home = await caches.match('/');
          if (home) return home;
        }
        return new Response('离线且无缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })()
  );
});
