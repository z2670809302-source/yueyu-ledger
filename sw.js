const CACHE_PREFIX = "yueyu-";
const APP_VERSION = "38";
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`;
const FONT_STYLESHEET = "./assets/fonts/lxgw-wenkai-lite/lxgwwenkailite-bold.css";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./ledger-core.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./assets/branding/liqing-logo.png", "./assets/branding/liqing-wordmark.webp?v=2.211", "./assets/illustrations/horse-money.webp?v=2.211", "./assets/illustrations/pony-ledger-peek.webp?v=2.211", "./assets/illustrations/nav-ledger.webp?v=2.211", "./assets/illustrations/nav-stats.webp?v=2.211", "./assets/illustrations/categories/salary.webp?v=2.211", "./assets/illustrations/categories/receivable.webp?v=2.211", "./assets/illustrations/categories/repayment.webp?v=2.211", "./assets/illustrations/categories/rent.webp?v=2.211", "./assets/illustrations/categories/daily.webp?v=2.211", "./assets/illustrations/categories/special.webp?v=2.211", FONT_STYLESHEET];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const stylesheet = await fetch(FONT_STYLESHEET);
    const css = await stylesheet.clone().text();
    const fontUrls = [...css.matchAll(/url\(['"]?(.+?\.woff2)['"]?\)/g)]
      .map((match) => new URL(match[1], new URL(FONT_STYLESHEET, self.location.href)).href);
    await cache.addAll([...APP_SHELL, ...fontUrls]);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "GET_VERSION") event.ports[0]?.postMessage(APP_VERSION);
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(event.request, { signal: controller.signal });
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return await caches.match(event.request)
        || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined)
        || Response.error();
    } finally {
      clearTimeout(timeout);
    }
  })());
});
