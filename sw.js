const C = "proseco-seguimiento-eme-v1.0";
const A = ["./", "./index.html", "./styles.css", "./app.js", "./catalogo.js", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png",
  "./vendor/NotoSans-latin.woff2", "./vendor/jszip.min.js", "./vendor/xlsx.bundle.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(A)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(n => {
    if (n.ok && n.status === 200) { const cp = n.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
    return n;
  }).catch(() => caches.match("./index.html"))));
});
