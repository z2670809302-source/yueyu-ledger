const CACHE_PREFIX = "yueyu-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const FONT_STYLESHEET = "./assets/fonts/lxgw-wenkai-lite/lxgwwenkailite-bold.css";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./ledger-core.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", FONT_STYLESHEET];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const stylesheet = await fetch(FONT_STYLESHEET);
    const css = await stylesheet.clone().text();
    const fontUrls = [...css.matchAll(/url\(['"]?(.+?\.woff2)['"]?\)/g)]
      .map((match) => new URL(match[1], new URL(FONT_STYLESHEET, self.location.href)).href);
    await cache.addAll([...APP_SHELL, ...fontUrls]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
