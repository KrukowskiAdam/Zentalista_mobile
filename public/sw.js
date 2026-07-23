const CACHE_VERSION = 'v2';
const JSON_CACHE = `zentalist-json-${CACHE_VERSION}`;
const AUDIO_CACHE = `zentalist-audio-${CACHE_VERSION}`;

// Fetch with a hard timeout so a bad/slow connection fails fast instead of
// hanging indefinitely (plain fetch() has no built-in timeout).
async function fetchWithTimeout(request, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const LANGUAGES = ['es', 'de', 'fr', 'ru', 'zh', 'ja', 'ko', 'it'];
const JSON_BASE = 'https://costam-3f612.web.app/languages';
const PRECACHE_URLS = LANGUAGES.flatMap(lang =>
  Array.from({ length: 9 }, (_, i) =>
    `${JSON_BASE}/${lang}/${lang}_en_0${i + 1}.json`
  )
);

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Zentalist — Offline</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Nunito',-apple-system,BlinkMacSystemFont,sans-serif;background:#232f34;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;padding-top:calc(24px + env(safe-area-inset-top,0px))}
    .container{text-align:center;max-width:360px}
    .icon{width:80px;height:80px;margin:0 auto 24px;opacity:.6}
    h1{font-size:22px;font-weight:700;margin-bottom:12px}
    p{font-size:14px;opacity:.7;line-height:1.6;margin-bottom:8px}
    .saved{margin-top:20px;padding:12px 16px;background:#344955;border-radius:12px;font-size:13px;opacity:.8}
    .retry-btn{margin-top:28px;display:inline-flex;align-items:center;justify-content:center;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;background:#ff8c02;border:none;border-radius:999px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    .retry-btn:active{opacity:.85}
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
    <h1>No internet connection</h1>
    <p>Zentalist needs an internet connection to load your vocabulary and sync progress.</p>
    <div class="saved">Your learning progress is safely saved on this device.</div>
    <button class="retry-btn" onclick="window.location.reload()">Try again</button>
  </div>
</body>
</html>`;

// Install: pre-cache all language JSON files in the background
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(JSON_CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          fetch(url)
            .then(res => { if (res.ok) return cache.put(url, res); })
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: remove caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== JSON_CACHE && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // JSON language files — cache-first, background revalidate
  if (url.hostname === 'costam-3f612.web.app' && url.pathname.includes('/languages/')) {
    event.respondWith(handleJson(request, url));
    return;
  }

  // MP3 audio files — network-first, cache on demand
  if (
    url.hostname === 'storage.googleapis.com' &&
    url.pathname.includes('/audio/')
  ) {
    event.respondWith(handleAudio(request));
    return;
  }

  // Navigation — offline page fallback
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );
  }
});

// Cache-first: dataService adds ?nocache=timestamp — strip it as cache key
async function handleJson(request, url) {
  const cacheKey = `${url.origin}${url.pathname}`;
  const cache = await caches.open(JSON_CACHE);
  const cached = await cache.match(cacheKey);

  if (cached) {
    // Serve stale immediately, revalidate in background
    fetchWithTimeout(request)
      .then(res => { if (res.ok) cache.put(cacheKey, res); })
      .catch(() => {});
    return cached;
  }

  // Not cached yet — fetch from network and store
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch {
    // Offline and nothing in cache — return empty so the app doesn't crash
    return new Response(JSON.stringify({ categories: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Network-first: cache MP3 on first play, serve from cache when offline
async function handleAudio(request) {
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) {
      const cache = await caches.open(AUDIO_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 404 });
  }
}
