// Service worker dos lembretes (Firebase Cloud Messaging).
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyCJkAD090db45ee16Nt9Nqrxy9QPyQsCC4",authDomain:"atp-app-amaral.firebaseapp.com",projectId:"atp-app-amaral",storageBucket:"atp-app-amaral.firebasestorage.app",messagingSenderId:"159136384691",appId:"1:159136384691:web:3895bc5941fde3ae1052c6"});
firebase.messaging();
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.matchAll({ type: 'window' }).then(L => { for (const c of L) if ('focus' in c) return c.focus(); return clients.openWindow('/') })) });
