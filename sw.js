/* BoromBoutik — service worker : garde l'application sur l'appareil pour qu'elle s'ouvre sans internet.
   Les données (Supabase) ne sont JAMAIS mises en cache ici : elles sont gardées par l'application elle-même (IndexedDB). */
const VERSION = 'sf-v4';
const SHELL = ['./', './index.html', './manifest.json', './boromboutik-logo-192.png', './boromboutik-logo-512.png', './boromboutik-logo.svg'];
// Bibliothèques nécessaires pour démarrer l'app : gardées dès la toute première visite
// Versions figées : l'appli vérifie leur empreinte (SRI), donc elles sont gardées en mode « cors » (jamais « opaque »)
const LIBS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'];
const OK_HOSTS = ['cdn.jsdelivr.net', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})).concat(LIBS.map(u => c.add(new Request(u, { mode: 'cors', credentials: 'omit' })).catch(() => {}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;           // données : jamais ici

  // Page principale : on essaie le réseau (version la plus récente), sinon la copie gardée
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')))) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
        if (r && r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || new Response('Hors connexion', { status: 503 });
      }
    })());
    return;
  }

  // Bibliothèques externes et polices, et fichiers du site : copie gardée d'abord, mise à jour en arrière-plan
  if (url.origin === location.origin || OK_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || (r.type === 'opaque' && req.destination !== 'script'))) c.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('', { status: 504 });
    })());
  }
});
