// Oflayn ishlash: ilova fayllari va Pyodide kesh qilinadi.
// Ilova fayllari: avval tarmoq (yangilanish keladi), boʻlmasa kesh. Pyodide: avval kesh.
const KESH = "bkt70-e0250513";
const ASOS = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "konstruktor.js", "kassa.js", "zakaz_baza.js", "hisobot.js", "hisobot_ekran.js", "katalog.js", "namuna_z002.json", "py/versiya.txt", "py/hisob.py", "py/hisobot.py", "py/zakaz.py", "py/raskroy.py",
  "py/tannarx.py", "py/narx_sheets.py", "py/diller.py", "narxlar.enc",
  "rasm/A01-002.webp", "rasm/A01-003.webp", "rasm/A01-005.webp", "rasm/A10-001.webp", "rasm/A10-002.webp", "rasm/A10-003.webp", "rasm/A1501_5.webp", "rasm/A701.webp", "rasm/A8060.webp", "rasm/EPD001.webp", "rasm/F702.webp", "rasm/F703.webp", "rasm/G24.webp", "rasm/G32.webp", "rasm/H702.webp", "rasm/M702.webp", "rasm/V702.webp", "rasm/V707.webp", "rasm/V708.webp",
  "rasm/ROTO_LUX.webp", "rasm/1076_92_28.webp", "rasm/1177.webp", "rasm/PETLYA_100.webp", "rasm/A9211_3.webp", "rasm/A4514.webp", "rasm/KRISHKA_POD.webp", "rasm/CT203.webp", "rasm/TAKOS_REG.webp", "rasm/SOED_7000.webp", "rasm/W02.webp", "rasm/W03.webp", "rasm/M535.webp", "rasm/J01.webp", "rasm/J05.webp", "rasm/EPDM_5025.webp", "rasm/EPDM_5108.webp", "rasm/ISPANILET.webp", "rasm/SREDNIY_ZAPOR.webp", "rasm/PETLYA_OPORA.webp", "rasm/ZATSEP_4207.webp", "rasm/VADASLIV.webp", "rasm/ZATSEP_PVX.webp", "rasm/RUCHKA_ROM.webp", "rasm/NOJNITSA.webp", "rasm/DVAYNOY_MEX.webp", "rasm/EPDM_YU.webp"];

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
