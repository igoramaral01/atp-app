// Service worker dos lembretes (Firebase Cloud Messaging).
try {
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyCJkAD090db45ee16Nt9Nqrxy9QPyQsCC4",authDomain:"atp-app-amaral.firebaseapp.com",projectId:"atp-app-amaral",storageBucket:"atp-app-amaral.firebasestorage.app",messagingSenderId:"159136384691",appId:"1:159136384691:web:3895bc5941fde3ae1052c6"});
firebase.messaging();
} catch (e) { /* sem Firebase: o modo offline continua funcionando */ }
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.matchAll({ type: 'window' }).then(L => { for (const c of L) if ('focus' in c) return c.focus(); return clients.openWindow('/') })) });

// ---------- App offline: abre mesmo sem internet ----------
const CACHE = 'atp-v1';
const SHELL = ['/', '/aval.js', '/extras.js', '/manifest.webmanifest', '/img/swirl.png', '/img/icon-192.png', '/img/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))) });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(K => Promise.all(K.filter(k => k.startsWith('atp-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) });
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
function put(req, res) { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}) } return res }
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === self.location.origin;
  if (same && u.pathname.startsWith('/api/')) return;            // API sempre na rede
  if (!same && !CDN.test(r.url)) return;                          // Firebase/Firestore etc. seguem normais
  // Página e scripts do app: rede primeiro (sempre a versão nova); sem sinal ou lento (>4s) → cópia salva
  if (r.mode === 'navigate' || (same && /\.(js|json|webmanifest)$/.test(u.pathname))) {
    const key = r.mode === 'navigate' ? '/' : r;
    e.respondWith(new Promise(ok => {
      let done = false; const fb = () => caches.match(key).then(c => { if (!done && c) { done = true; ok(c) } });
      const t = setTimeout(fb, 4000);
      fetch(r).then(res => { clearTimeout(t); put(key, res.clone()); if (!done) { done = true; ok(res) } })
        .catch(() => { clearTimeout(t); caches.match(key).then(c => { if (!done) { done = true; ok(c || Response.error()) } }) });
    }));
    return;
  }
  // Imagens, fontes e bibliotecas: cópia salva primeiro, atualiza por trás
  e.respondWith(caches.match(r).then(c => { const net = fetch(r).then(res => put(r, res)).catch(() => c); return c || net }));
});
