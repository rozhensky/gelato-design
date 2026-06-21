/* ============================================================
   sw.js — service worker для PWA-режиму.
   Stale-while-revalidate для свого origin (миттєвий старт +
   офлайн), і повний обхід для зовнішніх/бекенд-запитів
   (Supabase, API) — їх завжди в мережу.

   ВАЖЛИВО: цей файл має лежати в КОРЕНІ застосунку (напр. /app/),
   бо scope service worker-а = його тека. Шляхи в SHELL — відносні
   до цієї теки. Підіймай CACHE-версію, коли міняєш ассети.
   ============================================================ */
var CACHE = 'gelato-app-v1';
var SHELL = ['./', './index.html', './app.css', './app.js', './platform.js', './supabase.js'];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE)
            .then(function (c) { return c.addAll(SHELL); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys()
            .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;          // Supabase/CDN/API — завжди мережа
    if (url.pathname.indexOf('/functions/') > -1) return;     // edge-функції — не кешувати

    e.respondWith(
        caches.match(req).then(function (cached) {
            var net = fetch(req).then(function (res) {
                if (res && res.status === 200) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); });
                }
                return res;
            }).catch(function () { return cached; });
            return cached || net;
        })
    );
});
