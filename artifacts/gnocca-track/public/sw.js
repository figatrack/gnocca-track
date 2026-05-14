const CACHE_NAME = "gnocca-v9";
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withScope = (path) => `${scopePath}${path}`;
const STATIC_ASSETS = [
  withScope("/"),
  withScope("/manifest.json"),
  withScope("/icon-192.png"),
  withScope("/icon-512.png"),
];

function cacheResponse(request, response) {
  if (response.ok && response.type === "basic") {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
  }
  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;

  const accept = event.request.headers.get("accept") || "";
  const isNavigation = event.request.mode === "navigate" || accept.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => cacheResponse(event.request, resp))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(withScope("/"))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((resp) => cacheResponse(event.request, resp));
      return cached || network;
    })
  );
});
