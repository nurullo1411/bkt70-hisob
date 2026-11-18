// Kesish varoqlari (foydalanuvchi, 2026-11-15; docs/dizayn.md "Kesish varoqlari") — sof funksiyalar.
// Hisob raskroy.py da; bu yerda faqat koʻrinish uchun guruhlash.
// Sexda uzunlik 1 kasr (mm), yarim yuqoriga: 142,24 → 142,2; 142,25 → 142,3 (docs/raskroy-narx.md). Hisob qiymati oʻzgarmaydi.
const mm = (x) => Math.round(Number(x) * 10 + 1e-7);           // butun mm (solishtirish kaliti)
const sexSon = (x) => Math.round(Number(x) * 10 + 1e-7) / 10;  // sm, 1 kasr
const kkSon = (x) => sexSon(x).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
// Qoldiq — pastga (mm): sex bor uzunlikdan oshirmaydi; "butun boʻlak" tekshiruvi xom qiymat bilan (butunmi)
const qoldiqMm = (x) => Math.floor(Number(x) * 10 + 1e-7);
const qoldiqSon = (x) => (qoldiqMm(x) / 10).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const sm100 = (x) => Math.round(Number(x) * 100);
// Qoldiq butun boʻlakmi: profil otxod chegarasidan (raskroy.OTXOD_CHEGARA) katta yoki teng. Chegara yoʻq — otxod.
const butunmi = (q, ch) => ch != null && Number(q) >= Number(ch);
// Konstruksiya raqami: ① … ⑳, keyin (21)
const doiraRaqam = (r) => (r >= 1 && r <= 20 ? String.fromCharCode(0x245F + r) : `(${r})`);
// "① ×4 ② ×4"; bitta raqam — "①"
// jami (raqamsiz boʻlak bor boʻlsa — "raqamsiz ×n", jami — boʻlaklar soni)
function raqamMatn(rq, jami) {
  const qolgan = jami == null ? 0 : jami - rq.reduce((a, x) => a + x[1], 0);
  if (rq.length === 1 && !qolgan) return doiraRaqam(rq[0][0]);
  return rq.map(([r, n]) => `${doiraRaqam(r)} ×${n}`).concat(qolgan > 0 ? [`raqamsiz ×${qolgan}`] : []).join(" ");
}
// Tab uchun qisqa nom: qavs ichi olib tashlanadi ("Kosa (Sredniy) F702" → "Kosa F702")
// (qavs ichidagi "90°" qoladi: "Qanot (impost, 90°) 181" → "Qanot 90° 181")
const qisqaNom = (nom) => String(nom).replace(/\s*\(([^)]*)\)/g, (m, ich) => (/90°/.test(ich) ? " 90°" : "")).replace(/\s+/g, " ").trim();

// Hivichlar [{manba, L, qoldiq, juft: [[uzunlik, raqam]]}] → kartalar. Bir xil boʻlaklar toʻplami (sexdagi oʻlcham — mm) +
// qoldiq + manba + L — bitta karta, raqamidan qatʼi nazar (foydalanuvchi, 2026-11-15).
// Boʻlak qatori [d, har hivichda soni, [[raqam, jami soni]]].
function yigKartalar(hivichlar) {
  const g = new Map();
  for (const h of hivichlar) {
    const uz = h.juft.map(([d]) => mm(d)).sort((a, b) => b - a);
    const k = `${h.manba}|${sm100(h.L)}|${uz.join(",")}|${qoldiqMm(h.qoldiq)}`;
    let c = g.get(k);
    if (!c) {
      const n = new Map();
      for (const d of uz) n.set(d, (n.get(d) || 0) + 1);
      c = { manba: h.manba, L: h.L, soni: 0, qoldiq: h.qoldiq, n, r: new Map() };
      g.set(k, c);
    }
    c.soni++;
    for (const [d, r] of h.juft) {
      const key = mm(d);
      if (!c.r.has(key)) c.r.set(key, new Map());
      if (r != null && r !== "") c.r.get(key).set(r, (c.r.get(key).get(r) || 0) + 1);
    }
  }
  return [...g.values()].map((c) => ({
    manba: c.manba, L: c.L, soni: c.soni, qoldiq: c.qoldiq,
    bolaklar: [...c.n].map(([d, n]) => [d / 10, n, [...c.r.get(d)].sort((a, b) => a[0] - b[0])]),
  }));
}

// Skladsiz: kesish_chizmasi hivichlari [{bolaklar: [{uzunlik, k}], qoldiq}] → kartalar (qoldiq oʻsishi tartibida).
// raqam(k) — boʻlak egasining raqami (null — yoʻq).
function hivichKartalar(hivichlar, L, raqam) {
  return yigKartalar((hivichlar || []).map((h) => ({ manba: "YANGI", L, qoldiq: h.qoldiq,
    juft: h.bolaklar.map((b) => [b.uzunlik, raqam ? raqam(b.k) : null]) })))
    .sort((a, b) => sm100(a.qoldiq) - sm100(b.qoldiq));
}

// Sklad rejasi: sklad_rejasi kartalari [{manba, L, soni, qoldiq, bolaklar: [[d, n]]}] (allaqachon birlashgan) → raqamlar.
// Har uzunlikka konstruksiyalar detallaridan navbat (kesish_chizmasi dagi egalari.pop kabi) — har boʻlak aniq egasiga,
// raqamlar karta boʻyicha sanaladi. Kartalar tartibi (SKLAD → YANGI) saqlanadi. konstruksiyalar: [{raqam, detallar: [{uzunlik, soni}]}]
function skladKartalar(kartalar, konstruksiyalar) {
  const navbat = new Map();
  for (const c of konstruksiyalar || []) {
    for (const d of c.detallar || []) {
      const q = navbat.get(sm100(d.uzunlik)) || [];
      for (let i = 0; i < d.soni; i++) q.push(c.raqam);
      navbat.set(sm100(d.uzunlik), q);
    }
  }
  return (kartalar || []).map((k) => {
    const g = new Map();  // sexda 1 kasr: 75,18 va 75,22 — bitta "75,2" qatori
    for (const [d, n] of k.bolaklar) {
      const q = navbat.get(sm100(d)) || [], x = g.get(mm(d)) || { n: 0, m: new Map() };
      x.n += n;
      for (let i = 0; i < n * k.soni && q.length; i++) { const r = q.pop(); if (r != null && r !== "") x.m.set(r, (x.m.get(r) || 0) + 1); }
      g.set(mm(d), x);
    }
    return { ...k, bolaklar: [...g].sort((a, b) => b[0] - a[0]).map(([d, x]) => [d / 10, x.n, [...x.m].sort((a, b) => a[0] - b[0])]) };
  });
}

// Profil boʻyicha yigʻindi: yangi hivich soni, skladdan ishlatilgan sm, butun qoldiqlar, jami qoldiq, samaradorlik
// (samaradorlik — raskroy kabi: detallar uzunligi ÷ hivichlar uzunligi)
function kartaJami(kartalar, chegara) {
  let yangi = 0, skladSm = 0, skladSoni = 0, qoldiq = 0, detal = 0, uzun = 0, kesim = 0;
  const butun = new Map();
  for (const k of kartalar) {
    if (k.manba === "SKLAD") { skladSm += k.L * k.soni; skladSoni += k.soni; } else yangi += k.soni;
    qoldiq += k.qoldiq * k.soni;
    uzun += k.L * k.soni;
    for (const [d, n] of k.bolaklar) { detal += d * n * k.soni; kesim += n * k.soni; }
    if (butunmi(k.qoldiq, chegara)) butun.set(qoldiqMm(k.qoldiq), (butun.get(qoldiqMm(k.qoldiq)) || 0) + k.soni);
  }
  return { yangi, skladSm, skladSoni, qoldiq, kesim, hivich: yangi + skladSoni, samaradorlik: uzun ? detal / uzun * 100 : 0,
    butun: [...butun].sort((a, b) => b[0] - a[0]).map(([q, n]) => [q / 10, n]) };
}
function jamiMatn(j, hivich) {
  const q = j.yangi ? [`Jami yangi ${kkSon(hivich)} sm: ${j.yangi} dona`] : ["Jami: yangi profil kerak emas"];
  if (j.skladSm > 0) q.push(`skladdan ${kkSon(j.skladSm)} sm ishlatildi`);
  if (j.butun.length) q.push(j.butun.map(([x, n]) => `${qoldiqSon(x)} sm lik ${n} ta`).join(", ") + " butun boʻlak qoladi");
  return q.join(" · ");
}
// Kesish turi qisqa (varoq sarlavhasi): "45°", "45°, aylantirib", "90°"
function kesimQisqa(kesim) {
  const t = String(kesim || "").split("DIQQAT")[0];
  if (/90°/.test(t)) return "90°";
  return /aylantirib/.test(t) ? "45°, aylantirib" : "45°";
}
// Kesildi belgisi imzosi: reja oʻzgarsa (boʻlaklar, qoldiq, soni) belgi eskiradi
const imzo = (kartalar) => kartalar.map((k) => `${k.manba}${sm100(k.L)}x${k.soni}q${sm100(k.qoldiq)}:${k.bolaklar.map(([d, n, rq]) => sm100(d) + "*" + n + (rq || []).map((x) => "r" + x.join("x")).join("")).join(",")}`).join(";");

// Kesim belgisi (foydalanuvchi, 2026-11-16): □ ikki uchi 90°, ◿ bir uchi 45°, ⏢ ikki uchi 45°; qiya (45/90 dan boshqa) — qizil.
// Profil burchagi (kesim matnining DIQQAT dan oldingi qismi): "Toʻgʻri (90°)" — 90°, aks holda 45°.
// Qiya uchlar — hisob detallaridan (hisob.burchak matni, raskroy.detallarni_yig orqali), uzunlik boʻyicha soni bilan:
// xarita {mm(uzunlik): {jami, qiya: {"tepa uchi 74,05°": soni}}} — kartadagi kabi mm (160,76 → 1608). Shu uzunlikdagi hamma detal qiya boʻlmasa — "2 tasi (3 tadan)".
const profilBurchagi = (kesim) => (/Toʻgʻri \(90°\)|□/.test(String(kesim || "").split("DIQQAT")[0]) ? 90 : 45);
// hisob.burchak matni → ikki uch burchagi (son); tanilmasa null
function uchlar(m, asos) {
  const s = (x) => Number(String(x).replace(",", "."));
  let r = m.match(/^ikki uchi ([\d,]+)°$/);
  if (r) return [s(r[1]), s(r[1])];
  r = m.match(/^(?:bir|tepa) uchi ([\d,]+)°, (?:ikkinchisi|past uchi) ([\d,]+)°$/);
  if (r) return [s(r[1]), s(r[2])];
  // chiftga tegadigan kosa (hisob.uch, 2026-11-18): "chap uchi 45°, oʻng uchi 90°", "past uchi 45°, tepa uchi 90°"
  r = m.match(/^(?:(?:chap|oʻng|tepa|past) kosa, )?(?:chap|oʻng|tepa|past) uchi ([\d,]+)°, (?:chap|oʻng|tepa|past) uchi ([\d,]+)°$/);
  if (r) return [s(r[1]), s(r[2])];
  r = m.match(/^(?:bir|tepa|past) uchi ([\d,]+)°$/);
  if (r) return [s(r[1]), asos];
  return null;
}
function uchBelgi(u, asos) {
  if (!u) return asos === 90 ? "□" : "⏢";
  const n45 = u.filter((x) => x === 45).length;
  if (n45 === 2) return "⏢";
  if (n45 === 1) return "◿";
  return u.some((x) => x === 90) ? "□" : "⏢";
}
function kesimBelgilari(kesim, xarita) {
  const asos = profilBurchagi(kesim), oddiy = asos === 90 ? "□" : "⏢";
  return (d) => {
    const e = xarita && xarita[mm(d)];
    const q = e ? Object.entries(e.qiya || {}) : [];
    const u = e ? Object.entries(e.uch || {}) : [];
    if (!q.length && u.length) return uchNatija(u, e.jami, asos, oddiy);
    if (!q.length) return { belgi: oddiy, qiya: null };
    const matn = q.map(([m]) => m).join("; "), n = q.reduce((a, [, x]) => a + x, 0);
    const belgi = uchBelgi(uchlar(q[0][0].split(" | ")[0], asos), asos);
    const r = { belgi, qiya: n < e.jami ? `${n} tasi (${e.jami} tadan): ${matn}` : matn };
    if (u.length) r.uch = u.map(([m, x]) => `${x} tasi ${uchYozuv(m)}`).join(" · ");  // arka + chift bir uzunlikda
    return r;
  };
}
// Chiftga tegadigan kosa uchlari (kulrang yozuv, qiya emas; hisob.uch, 2026-11-18): "1 tasi tepa kosa chap uchi 45° · 1 tasi past kosa chap uchi 45°"
// (tepa va past boʻlak koʻzgu aksi — joyi bilan yoziladi); "ikki uchi 90°" — □, yolgʻiz boʻlsa yozuvsiz. Shu uzunlikdagi qolgan detallar
// (boshqa konstruksiya) — "2 tasi ikki uchi 45°". Belgi: ◿ bor boʻlsa ◿, hammasi 90° boʻlsa □, aks holda ⏢ (tekshiruvchi, 2026-11-18).
const uchYozuv = (m) => (m === "ikki uchi 90°" ? m : m.replace(/^(\S+) kosa, /, "$1 kosa ").split(", ")[0]);
function uchNatija(u, jami, asos, oddiy) {
  const bel = u.map(([m]) => uchBelgi(uchlar(m, asos), asos));
  const n = u.reduce((a, [, x]) => a + x, 0), qolgan = jami - n;
  const hammasi = [...bel, ...(qolgan > 0 ? [oddiy] : [])];
  const belgi = hammasi.includes("◿") ? "◿" : hammasi.every((x) => x === "□") ? "□" : "⏢";
  const qism = u.map(([m, x]) => `${x} tasi ${uchYozuv(m)}`);
  if (qolgan > 0) qism.push(`${qolgan} tasi ${oddiy === "□" ? "ikki uchi 90°" : "ikki uchi 45°"}`);
  const r = { belgi, qiya: null };
  if (!(u.length === 1 && qolgan <= 0 && bel[0] === "□")) r.uch = qism.join(" · ");
  return r;
}
const KESIM_IZOH = "□ 90° · ◿ bir uchi 45° · ⏢ 45°";
// Qiya kesim belgilari — kichik inline SVG (matn balandligida, hamma telefonda bir xil; foydalanuvchi, 2026-11-16).
// □ (90°) — matn. ◿ bir uchi 45° — toʻgʻri trapetsiya (chap yoni tik, oʻng yoni 45°); ⏢ ikki uchi 45° — teng yonli trapetsiya (past uzun).
const _svg = (n, nuqta) => `<svg class="kb-svg" viewBox="0 0 22 10" width="1.45em" height="0.7em" role="img" aria-label="${n}">` +
  `<polygon points="${nuqta}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter"/></svg>`;
const BELGI_SVG = { "◿": _svg("bir uchi 45°", "1,9 21,9 13,1 1,1"), "⏢": _svg("ikki uchi 45°", "1,9 21,9 13,1 9,1") };
const belgiHtml = (b) => BELGI_SVG[b] || b;
const KESIM_IZOH_HTML = `□ 90° · ${BELGI_SVG["◿"]} bir uchi 45° · ${BELGI_SVG["⏢"]} 45°`;

// Karta kaliti (Kesildi sanogʻi uchun): manba, L, qoldiq, boʻlaklar — raqam va hivich sonisiz (reja oʻzgarsa ham mos karta topiladi)
const kartaKalit = (k) => `${k.manba}|${sm100(k.L)}|${qoldiqMm(k.qoldiq)}|${k.bolaklar.map(([d, n]) => mm(d) + "*" + n).join(",")}`;
// Kesildi sanoqlari: saqlangan {imzo, k: {kartaKalit: n}, t: {kartaKalit: vaqt ms}, sana} → {k: [har karta kesilgan hivich], eski}
// eski — reja oʻzgargan va saqlangan belgining biri hozirgi kartalarga sigʻmaydi (karta yoʻq yoki soni kamaygan); mos kartalarning
// sanogʻi saqlanadi. Eski shakllar: k massiv (karta tartibi) yoki k yoʻq (butun profil kesildi) — faqat imzo mos boʻlsa.
function kesildiOqi(saqlangan, kartalar, imzoHozir) {
  const nol = kartalar.map(() => 0);
  if (!saqlangan) return { k: nol, eski: false };
  const mos = saqlangan.imzo === imzoHozir;
  const k = saqlangan.k;
  if (k && !Array.isArray(k) && typeof k === "object") {
    const soni = new Map(kartalar.map((c) => [kartaKalit(c), c.soni]));
    const sigmaydi = Object.entries(k).some(([kal, n]) => n > 0 && !(soni.get(kal) >= n));
    return { k: kartalar.map((c) => Math.max(0, Math.min(c.soni, Number(k[kartaKalit(c)]) || 0))), eski: !mos && sigmaydi };
  }
  if (!mos) return { k: nol, eski: true };
  return { k: Array.isArray(k) ? kartalar.map((c, i) => Math.max(0, Math.min(c.soni, Number(k[i]) || 0))) : kartalar.map((c) => c.soni), eski: false };
}
// Saqlash: hozirgi kartalar sanogʻi (0 ham — bekor qilish ikki telefonda ham yoʻqolmasin), oʻzgargan karta (i) ga vaqt.
function kesildiYoz(kartalar, sanoq, imzoHozir, sana, oldingi, i, vaqt) {
  const k = {}, t = {};
  const ot = (oldingi && oldingi.t) || {};
  kartalar.forEach((c, j) => {
    const kal = kartaKalit(c);
    if (sanoq[j] > 0 || ot[kal] || j === i) { k[kal] = sanoq[j]; if (ot[kal]) t[kal] = ot[kal]; }
  });
  if (i != null) t[kartaKalit(kartalar[i])] = vaqt;
  return { imzo: imzoHozir, k, t, sana, vaqt };
}
// Ikki telefon (baza ziddiyati): kesildi birlashtiriladi — profil kaliti boʻyicha; imzo bir xil boʻlsa har karta uchun
// keyin bosilgani (vaqt; vaqt yoʻq — katta sanoq), imzo boshqa boʻlsa — keyingi yozilgani.
function kesildiBirlashtir(a, b) {
  const r = { ...(a || {}) };
  const keyin = (x, y) => (Number(y.vaqt) || 0) > (Number(x.vaqt) || 0) || (!x.vaqt && !y.vaqt && String(y.sana || "") > String(x.sana || ""));
  for (const [kal, y] of Object.entries(b || {})) {
    const x = r[kal];
    if (!x) { r[kal] = y; continue; }
    if (x.imzo === y.imzo && x.k && y.k && !Array.isArray(x.k) && !Array.isArray(y.k)) {
      const k = { ...x.k }, t = { ...(x.t || {}) };
      for (const [kk, n] of Object.entries(y.k)) {
        const tx = (x.t || {})[kk], ty = (y.t || {})[kk];
        if (!(kk in k) || (tx != null || ty != null ? (ty || 0) > (tx || 0) : n > k[kk])) { k[kk] = n; if (ty != null) t[kk] = ty; }
      }
      const so = keyin(x, y) ? y : x;
      r[kal] = { imzo: x.imzo, k, t, sana: so.sana, vaqt: Math.max(Number(x.vaqt) || 0, Number(y.vaqt) || 0) || undefined };
    } else if (keyin(x, y)) r[kal] = y;
  }
  return r;
}
// "Konstruksiyalar boʻyicha" jadvali (foydalanuvchi, 2026-11-16): kartalar → [[raqam, [[uzunlik, jami soni]]]], raqam oʻsishi,
// uzunlik kattadan kichikka; egasi topilmagan boʻlaklar — raqam null, oxirida.
function konstruksiyaBolaklar(kartalar) {
  const m = new Map();
  const qosh = (r, d, n) => { if (!m.has(r)) m.set(r, new Map()); const x = m.get(r); x.set(mm(d), (x.get(mm(d)) || 0) + n); };
  for (const k of kartalar || []) {
    for (const [d, c, rq] of k.bolaklar) {
      let qolgan = c * k.soni;
      for (const [r, n] of rq || []) { qosh(r, d, n); qolgan -= n; }
      if (qolgan > 0) qosh(null, d, qolgan);
    }
  }
  return [...m].sort((a, b) => (a[0] == null) - (b[0] == null) || a[0] - b[0])
    .map(([r, x]) => [r, [...x].sort((a, b) => b[0] - a[0]).map(([d, n]) => [d / 10, n])]);
}
const bolaklarMatn = (b) => b.map(([d, n]) => `${kkSon(d)} × ${n}`).join(" · ");
// Raqamli tugma holati: kesilmagan "", toʻliq "toliq", qisman "qisman"
const tugmaHolat = (n, soni) => (n >= soni && soni > 0 ? "toliq" : n > 0 ? "qisman" : "");

// Katak bosildi: j < n — bitta kamayadi (bekor), aks holda bitta oshadi
const katakBos = (n, j, soni) => Math.max(0, Math.min(soni, j < n ? n - 1 : n + 1));

if (typeof module !== "undefined") module.exports = { mm, sexSon, kkSon, qoldiqSon, sm100, butunmi, doiraRaqam, raqamMatn, qisqaNom, yigKartalar,
  qoldiqMm, profilBurchagi, uchlar, uchBelgi, kesimBelgilari, KESIM_IZOH, KESIM_IZOH_HTML, BELGI_SVG, belgiHtml, kartaKalit, kesildiOqi, kesildiYoz, kesildiBirlashtir, katakBos, konstruksiyaBolaklar, bolaklarMatn, tugmaHolat, hivichKartalar, skladKartalar, kartaJami, jamiMatn, kesimQisqa, imzo };
