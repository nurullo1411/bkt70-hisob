// Oflayn ishlash: ilova fayllari va Pyodide kesh qilinadi.
// Ilova fayllari: avval tarmoq (yangilanish keladi), boʻlmasa kesh. Pyodide: avval kesh.
const KESH = "bkt70-ea75a22a";
const ASOS = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "konstruktor.js", "namuna_z002.json", "py/versiya.txt", "py/hisob.py", "py/hisobot.py", "py/zakaz.py", "py/raskroy.py",
  "py/tannarx.py", "narxlar.enc"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(KESH).then((c) => c.addAll(ASOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== KESH).map((x) => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.open(KESH).then(async (c) => {
      const bor = await c.match(e.request);
      if (bor) return bor;
      const javob = await fetch(e.request);
      if (javob.ok) c.put(e.request, javob.clone());
      return javob;
    }));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then((javob) => {
      if (javob.ok) caches.open(KESH).then((c) => c.put(e.request, javob.clone()));
      return javob;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
