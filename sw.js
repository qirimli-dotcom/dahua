/* Dahua прайс IT-Trade — service worker.
   Страница и данные: сначала сеть, без сети — кэш (новый прайс подтягивается сам).
   Фото и превью: кэш, затем сеть. При изменении этого файла меняй VERSION. */
const VERSION = 'dahua-app-v16';
const IMG_CACHE = 'dahua-img';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'config.js', 'data.js', 'images.js', 'manifest.webmanifest',
  'assets/logo-it.png', 'assets/logo-dahua.png', 'assets/icons/favicon-32.png', 'assets/icons/icon-192.png',
  'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/maskable-512.png'];
const EXTRA = ['vendor/jspdf.umd.min.js', 'vendor/xlsx.full.min.js',
  'assets/fonts/LiberationSans-Regular.ttf', 'assets/fonts/LiberationSans-Bold.ttf'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    await Promise.all(EXTRA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== IMG_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isImg = p => /\/(images|thumbs)\//.test(p);
const isFresh = (req, p) => req.mode === 'navigate' || /\/(index\.html|app\.js|app\.css|config\.js|data\.js|images\.js|manifest\.webmanifest|admin\.html|admin\.js|admin\.css)?$/.test(p);

async function networkFirst(req) {
  const c = await caches.open(VERSION);
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(req, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
    if (r.ok) c.put(req.mode === 'navigate' ? 'index.html' : req, r.clone());
    return r;
  } catch (e) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html') : undefined) || Response.error();
  }
}
async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: true }) || (name !== VERSION ? await caches.match(req, { ignoreSearch: true }) : null);
  if (hit) return hit;
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch (e) { return Response.error(); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (isImg(p)) e.respondWith(cacheFirst(req, IMG_CACHE));
  else if (isFresh(req, p)) e.respondWith(networkFirst(req));
  else e.respondWith(cacheFirst(req, VERSION));
});
