// Sklad ilovada (foydalanuvchi, 2026-11-20): Sheets bilan bogʻlanmaydi (ilova sotiladi). Dodorom_sklad bir marta
// koʻchiriladi (sklad_boshlang.enc), keyin hammasi shu yerda: boʻlaklar (S-raqam bilan), butun hivich, seriya va profil.
// Maʼlumot telefonda (localStorage "sklad_baza"); server keyingi bosqichda — jurnal shu uchun.
// Kesish rejasi, tannarx (sklad usuli) va dillerga roʻyxat raskroy.py ga eski Apps Script shaklida beriladi (raskroyQatorlari).
"use strict";

const SKLAD_KALIT = "sklad_baza";
const SK_RANG = { greey: "grey", zd: "z/d", dm: "d/m" };
// raskroy.py faqat shu seriyalarni taniydi (eski Apps Script ham faqat shularni berardi): BKT 70 — oddiy, Aldoks — "ALD|"
const SK_RASKROY = { "BKT 70": "", "Aldoks": "ALD|" };
// Kesish kodi (raskroy_kod): raskroy.py taniydigan profil. Nom faqat koʻrinish — kod boʻyicha raskroy.py ga
// u kutgan nom beriladi (raskroy.SKLAD_NOMI; Aldoks "ALD|" + _ald_sklad nomi; "#>" — bir uchi qiya).
const SK_KOD_NOM = { F702: "Kosa F702", F703: "Kosa F703", M702: "O'rta M702", V702: "Qanot V702", V707: "Balkon o'rta V707",
  V708: "Balkon qanot V708", A701: "Shtulp A701", LII: "Lambri II PVX", L114: "Lambri 114 alyumin", H702: "Lapsha lam",
  "183": "ALD|kosa", "183#>": "ALD|kosa #>", "181": "ALD|qanot", "182": "ALD|Oʻrta ##", "182#>": "ALD|Oʻrta #>", "185": "ALD|Balkon o'rta", "198": "ALD|balkon qanot" };
// Eski Sheets nomidan kod (raskroy._sklad_nom / _ald_sklad bilan bir xil qoida; tanilmasa null)
function skRaskroyKod(seriyaNom, nom) {
  nom = String(nom).trim();
  if (seriyaNom === "BKT 70") {
    if (nom.toLowerCase() === "kosa 702 oq") return "F702";
    if (nom.toLowerCase().endsWith(" 306g")) nom = nom.slice(0, -5).trim();
    const k = Object.keys(SK_KOD_NOM).find((x) => SK_KOD_NOM[x] === nom);
    return k || null;
  }
  if (seriyaNom === "Aldoks") {
    const n = nom.split("/")[0].toLowerCase().split(/\s+/).filter(Boolean).join(" ");
    if (n === "kosa" || n.startsWith("kosa ##")) return "183";
    if (n.startsWith("kosa #>")) return "183#>";
    if (n === "qanot") return "181";
    if (["balkon oʻrta", "balkon o'rta", "balkon o‘rta", "balkon orta", "balkon urta"].some((x) => n.startsWith(x))) return "185";
    if (n === "balkon qanot") return "198";
    if (["oʻrta", "o'rta", "o‘rta", "orta"].some((x) => n.startsWith(x))) return n.includes("#>") ? "182#>" : "182";
  }
  return null;
}
const skKesishda = (seriyaNom, nom) => skRaskroyKod(seriyaNom, nom) != null;

const skNom = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
const skRang = (s) => { const r = skNom(s).toLowerCase(); return SK_RANG[r] || r; };
// "0,87" (metr) → 87 sm; 0,1 sm gacha
function skMetrSm(m) {
  const x = Number(String(m ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) && x > 0 ? Math.round(x * 1000) / 10 : null;
}
// 87 → "0,87" (raskroy.py eski Sheets qiymati kabi oʻqiydi)
const skSmMetr = (sm) => String(Math.round(sm * 10) / 1000).replace(".", ",");
const skBugun = () => new Date().toISOString().slice(0, 10);
// Telefon soatidagi sana (UTC emas — Qoʻqon UTC+5, yarim tundan 05:00 gacha farq qiladi); fayl nomlari uchun
const skMahalliyBugun = () => { const d = new Date(), p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const skUuid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function skBoshBaza() {
  return { versiya: 1, seriyalar: [], profillar: [], bolaklar: [], butunlar: [], keyingi_raqam: 1, keyingi_id: 1, ozgardi: null, jurnal: [] };
}
function skJurnal(b, amal, d) {
  b.jurnal.push({ id: skUuid(), vaqt: new Date().toISOString(), amal, ...d });
  if (b.jurnal.length > 3000) b.jurnal.splice(0, b.jurnal.length - 3000);  // server sinxronigacha chegara
  b.ozgardi = new Date().toISOString();
}

// ---------- seriya va profil ----------
function skSeriyaQosh(b, nom, hivich_sm) {
  nom = skNom(nom);
  const h = Number(hivich_sm);
  if (!nom) throw new Error("Seriya nomini yozing");
  if (!(h > 0 && h <= 1200)) throw new Error("Hivich uzunligi 1–1200 sm");
  if (b.seriyalar.some((s) => s.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`"${nom}" seriyasi bor`);
  const s = { id: "s" + b.keyingi_id++, nom, hivich_sm: h };
  b.seriyalar.push(s);
  skJurnal(b, "seriya", { seriya: s.id, nom, hivich_sm: h });
  return s;
}
function skProfilQosh(b, seriya, nom, narx) {
  nom = skNom(nom);
  if (!nom) throw new Error("Profil nomini yozing");
  if (!b.seriyalar.some((s) => s.id === seriya)) throw new Error("Seriya topilmadi");
  if (b.profillar.some((p) => p.seriya === seriya && p.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`"${nom}" profili bor`);
  const n = narx === "" || narx == null ? null : Number(String(narx).replace(",", "."));
  if (n != null && !(n >= 0)) throw new Error("Narx musbat son boʻlishi kerak");
  const s = skSeriya(b, seriya);
  const p = { id: "p" + b.keyingi_id++, seriya, nom, narx: n, kod: skRaskroyKod(s.nom, nom) };
  b.profillar.push(p);
  skJurnal(b, "profil", { profil: p.id, seriya, nom, narx: n });
  return p;
}
function skProfilTahrir(b, id, nom, narx) {
  const p = b.profillar.find((x) => x.id === id);
  if (!p) throw new Error("Profil topilmadi");
  nom = skNom(nom);
  if (!nom) throw new Error("Profil nomini yozing");
  if (b.profillar.some((x) => x.id !== id && x.seriya === p.seriya && x.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`"${nom}" profili bor`);
  const n = narx === "" || narx == null ? null : Number(String(narx).replace(",", "."));
  if (n != null && !(n >= 0)) throw new Error("Narx musbat son boʻlishi kerak");
  p.nom = nom; p.narx = n;
  skJurnal(b, "profil_tahrir", { profil: id, nom, narx: n });
}
const skProfil = (b, id) => b.profillar.find((p) => p.id === id);
const skSeriya = (b, id) => b.seriyalar.find((s) => s.id === id);
const skHivich = (b, profilId) => { const p = skProfil(b, profilId); const s = p && skSeriya(b, p.seriya); return s ? s.hivich_sm : null; };

// ---------- boʻlak ----------
// soni ta bir xil boʻlak; har biriga yangi raqam. Qaytaradi: raqamlar
function skBolakQosh(b, { profil, rang, sm, soni = 1, manba = "qoʻlda", sana }) {
  const h = skHivich(b, profil);
  if (h == null) throw new Error("Profilni tanlang");
  rang = skRang(rang);
  if (!rang) throw new Error("Rangni yozing");
  const u = Math.round(Number(String(sm).replace(",", ".")) * 10) / 10;
  if (!(u > 0)) throw new Error("Uzunlikni yozing (sm)");
  if (u > h) throw new Error(`Uzunlik hivichdan (${h} sm) katta boʻlmasin`);
  const n = Number(soni);
  if (!(Number.isInteger(n) && n >= 1 && n <= 500)) throw new Error("Soni 1–500");
  const raqamlar = [];
  for (let i = 0; i < n; i++) {
    const r = b.keyingi_raqam++;
    b.bolaklar.push({ raqam: r, profil, rang, sm: u, sana: sana || skBugun(), manba });
    raqamlar.push(r);
  }
  skJurnal(b, "bolak_qosh", { raqamlar, profil, rang, sm: u, manba });
  return raqamlar;
}
function skBolakTahrir(b, raqam, { rang, sm, profil }) {
  const x = b.bolaklar.find((q) => q.raqam === raqam);
  if (!x) throw new Error(`S-${raqam} topilmadi`);
  // profilni oʻzgartirish (foydalanuvchi, 2026-11-22): faqat shu seriya ichida
  const eskiP = x.profil, yangiP = profil || x.profil;
  if (yangiP !== eskiP && (skProfil(b, yangiP) || {}).seriya !== (skProfil(b, eskiP) || {}).seriya) throw new Error("Profil shu seriyada topilmadi");
  const h = skHivich(b, yangiP);
  const u = Math.round(Number(String(sm).replace(",", ".")) * 10) / 10;
  if (!(u > 0) || u > h) throw new Error(`Uzunlik 0–${h} sm`);
  const r = skRang(rang);
  if (!r) throw new Error("Rangni yozing");
  x.sm = u; x.rang = r; x.profil = yangiP;
  skJurnal(b, "bolak_tahrir", { raqam, rang: r, sm: u, ...(yangiP !== eskiP ? { profil: yangiP, eski_profil: eskiP } : {}) });
}
// Kartadagi rang (foydalanuvchi, 2026-11-22): profil + eski rangdagi hamma boʻlak va butun hivich yangi rangga. Qaytaradi: {bolak, butun}
function skGuruhRang(b, profil, eski, yangi) {
  if (!skProfil(b, profil)) throw new Error("Profil topilmadi");
  const r = skRang(yangi);
  if (!r) throw new Error("Rangni yozing");
  if (r === eski) return { bolak: 0, butun: 0 };
  const bol = b.bolaklar.filter((x) => x.profil === profil && x.rang === eski);
  for (const x of bol) skBolakTahrir(b, x.raqam, { rang: r, sm: x.sm });
  const n = (b.butunlar.find((x) => x.profil === profil && x.rang === eski) || {}).soni || 0;
  if (n) { skButun(b, profil, eski, -n); skButun(b, profil, r, n); }
  return { bolak: bol.length, butun: n };
}
function skBolakOchir(b, raqam, sabab = "oʻchirildi") {
  const i = b.bolaklar.findIndex((q) => q.raqam === raqam);
  if (i < 0) throw new Error(`S-${raqam} topilmadi`);
  const [x] = b.bolaklar.splice(i, 1);
  skJurnal(b, "bolak_ochir", { raqam, profil: x.profil, rang: x.rang, sm: x.sm, sabab });
  return x;
}
// Butun hivich: soni oʻzgaradi (manfiy boʻlmaydi)
function skButun(b, profil, rang, delta) {
  if (skHivich(b, profil) == null) throw new Error("Profilni tanlang");
  rang = skRang(rang);
  if (!rang) throw new Error("Rangni yozing");
  const d = Number(delta);
  if (!Number.isInteger(d) || d === 0) throw new Error("Soni butun son");
  let x = b.butunlar.find((q) => q.profil === profil && q.rang === rang);
  if (!x) { x = { profil, rang, soni: 0 }; b.butunlar.push(x); }
  const yangi = Math.max(0, x.soni + d);
  skJurnal(b, "butun", { profil, rang, eski: x.soni, yangi });
  x.soni = yangi;
  if (!x.soni) b.butunlar.splice(b.butunlar.indexOf(x), 1);
}

// ---------- pul ----------
// Sheets "Summa": hivich narxi ÷ hivich uzunligi × boʻlak uzunligi. Narx yoʻq — null
function skBolakSumma(b, x) {
  const p = skProfil(b, x.profil), h = skHivich(b, x.profil);
  return p && p.narx != null && h ? p.narx / h * x.sm : null;
}
function skButunSumma(b, x) { const p = skProfil(b, x.profil); return p && p.narx != null ? p.narx * x.soni : null; }
const skYaxlit = (x) => Math.round(x * 100) / 100;

// ---------- Excel (d-qadam, foydalanuvchi 2026-11-21) ----------
// Bitta varaq, merged yoʻq; qiymat yaxlitlanmaydi (koʻrinishi 0.00) — Σ = skJami.summa. Narx $/m = hivich narxi ÷ hivich × 100.
function skExcel(b) {
  const sana = (x) => /^\d{4}-\d\d-\d\d/.test(x || "") ? `${x.slice(8, 10)}.${x.slice(5, 7)}.${x.slice(0, 4)}` : (x || "");
  const sk = ["Seriya", "Profil", "Rang", "Uzunlik sm", "S-raqam", "Soni", "Sana", "Narx $/m", "Qiymat $"];
  const q = [sk], jami = [["Seriya", "Boʻlak", "Butun hivich", "Qiymat $"]];
  for (const s of b.seriyalar) {
    for (const g of skGuruhlar(b, s.id)) {
      const h = skHivich(b, g.profil.id), m = g.profil.narx != null && h ? g.profil.narx / h * 100 : "";
      if (g.butun) q.push([s.nom, g.profil.nom, g.rang, h, "butun", g.butun, "", m, skButunSumma(b, { profil: g.profil.id, soni: g.butun }) ?? ""]);
      for (const x of g.bolaklar) q.push([s.nom, g.profil.nom, g.rang, x.sm, "S-" + x.raqam, 1, sana(x.sana), m, skBolakSumma(b, x) ?? ""]);
    }
    const j = skJami(b, s.id);
    jami.push([s.nom, j.bolak, j.butun, j.summa]);
  }
  const j = skJami(b);
  jami.push(["Jami", j.bolak, j.butun, j.summa]);
  return [{ nom: "Sklad", qatorlar: q, kenglik: [14, 24, 8, 11, 9, 6, 11, 10, 11], pul: [7, 8] },
    { nom: "Jami", qatorlar: jami, kenglik: [16, 9, 13, 12], pul: [3] }];
}

// ---------- koʻrinish uchun guruhlar ----------
// Seriya ichida profil + rang boʻyicha; profil tartibi — baza tartibi, rang — alifbo; boʻlaklar uzunidan kaltasiga
function skGuruhlar(b, seriya, { rang = "", izla = "", pnom = "" } = {}) {
  const pr = b.profillar.filter((p) => p.seriya === seriya && (!pnom || skAsosNom(p.nom).toLowerCase() === pnom.toLowerCase()));
  const q = skNom(izla).toLowerCase().replace(/^s-?/, "");
  const raqamIzla = /^\d+$/.test(q) ? Number(q) : null;
  const g = [];
  for (const p of pr) {
    const nomMos = !q || raqamIzla != null || p.nom.toLowerCase().includes(skNom(izla).toLowerCase());
    const ranglar = new Set([...b.bolaklar.filter((x) => x.profil === p.id).map((x) => x.rang), ...b.butunlar.filter((x) => x.profil === p.id).map((x) => x.rang)]);
    for (const r of [...ranglar].sort()) {
      if (rang && r !== rang) continue;
      let bol = b.bolaklar.filter((x) => x.profil === p.id && x.rang === r);
      const butun = (b.butunlar.find((x) => x.profil === p.id && x.rang === r) || {}).soni || 0;
      if (raqamIzla != null) { bol = bol.filter((x) => String(x.raqam).startsWith(String(raqamIzla))); if (!bol.length) continue; }
      else if (!nomMos) continue;
      bol = [...bol].sort((a, c) => c.sm - a.sm || a.raqam - c.raqam);
      const summa = bol.reduce((s, x) => s + (skBolakSumma(b, x) || 0), 0) + (p.narx != null ? p.narx * (raqamIzla != null ? 0 : butun) : 0);
      g.push({ profil: p, rang: r, bolaklar: bol, butun: raqamIzla != null ? 0 : butun, summa: p.narx != null ? skYaxlit(summa) : null,
        metr: skYaxlit(bol.reduce((s, x) => s + x.sm, 0) / 100) });
    }
  }
  return g;
}
function skJami(b, seriya) {
  const bol = b.bolaklar.filter((x) => !seriya || (skProfil(b, x.profil) || {}).seriya === seriya);
  const but = b.butunlar.filter((x) => !seriya || (skProfil(b, x.profil) || {}).seriya === seriya);
  return { bolak: bol.length, butun: but.reduce((s, x) => s + x.soni, 0),
    summa: skYaxlit(bol.reduce((s, x) => s + (skBolakSumma(b, x) || 0), 0) + but.reduce((s, x) => s + (skButunSumma(b, x) || 0), 0)) };
}
// Profil tugmasi (foydalanuvchi, 2026-11-22): nomning "/" dan oldingi qismi ("kosa /306g" → "kosa"), katta-kichik harf farqsiz
const skAsosNom = (nom) => (String(nom).split("/")[0].trim() || String(nom).trim());
function skProfilNomlar(b, seriya) {
  const bor = new Set([...b.bolaklar, ...b.butunlar].map((x) => x.profil)), m = new Map();
  for (const p of b.profillar) if (p.seriya === seriya && bor.has(p.id)) { const k = skAsosNom(p.nom); if (!m.has(k.toLowerCase())) m.set(k.toLowerCase(), k); }
  return [...m.values()];  // tartib — profillar tartibi (kartalar kabi)
}
function skRanglar(b, seriya) {
  const s = new Set();
  for (const x of [...b.bolaklar, ...b.butunlar]) if ((skProfil(b, x.profil) || {}).seriya === seriya) s.add(x.rang);
  return [...s].sort();
}

// ---------- eski Sheets skladidan koʻchirish ----------
// manba: sklad_boshlangich.json shakli {varaqlar: [{nom, hivich_m, narx: {profil: $}, qatorlar: [[nom, rang, soni, "0,87"]]}]}
// Oʻlchami yoʻq yoki 0 qator koʻchirilmaydi (foydalanuvchi, 2026-11-20); soni > 1 — alohida boʻlaklar, har biri raqam bilan.
function skEskiKochir(manba, sana) {
  const b = skBoshBaza(), tashlandi = [];
  for (const v of manba.varaqlar || []) {
    const s = skSeriyaQosh(b, v.nom, Math.round(Number(v.hivich_m) * 100));
    const pid = {};
    const profil = (nom) => {
      const n = skNom(nom), k = n.toLowerCase();
      if (!pid[k]) {
        const narx = Object.entries(v.narx || {}).find(([x]) => skNom(x).toLowerCase() === k);
        pid[k] = skProfilQosh(b, s.id, n, narx ? narx[1] : null).id;
      }
      return pid[k];
    };
    Object.keys(v.narx || {}).forEach(profil);
    for (const q of v.qatorlar || []) {
      const sm = skMetrSm(q[3]), soni = Number(q[2]);
      if (!skNom(q[0]) || !sm || !(soni >= 1)) { tashlandi.push(`${v.nom}: ${q.join(" · ")}`); continue; }
      if (sm > s.hivich_sm) { tashlandi.push(`${v.nom}: ${q.join(" · ")} (hivichdan uzun)`); continue; }
      skBolakQosh(b, { profil: profil(q[0]), rang: q[1], sm, soni, manba: "Sheets", sana });
    }
  }
  b.jurnal = [];
  skJurnal(b, "kochirildi", { bolak: b.bolaklar.length, tashlandi: tashlandi.length });
  return { baza: b, tashlandi };
}

// ---------- raskroy.py uchun (eski Apps Script javobi shakli) ----------
// [[nom, rang, soni, metr]]: BKT 70 — oddiy nom, Aldoks — "ALD|" + nom. Butun hivich hozircha berilmaydi (eski sklad kabi).
function skRaskroyQatorlari(b) {
  const qatorlar = [];
  for (const x of b.bolaklar) {
    if (x.holat && x.holat !== "bor") continue;  // serverdan: oʻchirilgan / ishlatilgan kesishga tushmaydi
    const p = skProfil(b, x.profil);
    if (!p || !p.kod || !SK_KOD_NOM[p.kod]) continue;
    qatorlar.push([SK_KOD_NOM[p.kod], x.rang, "1", skSmMetr(x.sm)]);
  }
  return { vaqt: b.ozgardi || new Date().toISOString(), qatorlar, ilova: true };
}

// Zaxiradan tiklash: raqam orqaga ketmasin (markerda yozilgan raqam takrorlanmasin)
function skTiklash(joriy, yangi) {
  const eng = Math.max(0, ...yangi.bolaklar.map((x) => x.raqam));
  yangi.keyingi_raqam = Math.max(yangi.keyingi_raqam || 1, joriy ? joriy.keyingi_raqam || 1 : 1, eng + 1);
  yangi.keyingi_id = Math.max(yangi.keyingi_id || 1, joriy ? joriy.keyingi_id || 1 : 1);
  if (!Array.isArray(yangi.jurnal)) yangi.jurnal = [];
  skJurnal(yangi, "tiklandi", { bolak: yangi.bolaklar.length });
  return yangi;
}

function skTekshir(b) {
  return b && b.versiya === 1 && Array.isArray(b.seriyalar) && Array.isArray(b.profillar) && Array.isArray(b.bolaklar) && Array.isArray(b.butunlar);
}

if (typeof module !== "undefined") module.exports = { skExcel, skNom, skRang, skMetrSm, skSmMetr, skBoshBaza, skSeriyaQosh, skProfilQosh, skProfilTahrir,
  skBolakQosh, skBolakTahrir, skGuruhRang, skBolakOchir, skButun, skBolakSumma, skButunSumma, skGuruhlar, skJami, skRanglar, skAsosNom, skProfilNomlar, skEskiKochir, skRaskroyQatorlari, skTekshir, skTiklash, skKesishda, skRaskroyKod, SK_KOD_NOM };

// ======================= Ekran (faqat brauzerda) =======================
if (typeof document !== "undefined" && document.getElementById("e-sklad")) (function () {
  const el = (id) => document.getElementById(id);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const smM = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  const pul = (x) => x == null ? "—" : x.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
  const ozk = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const okk = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  let seriya = okk("sk_seriya"), rangF = "", profF = "", izla = "", oyna = null, xabarMatn = "", tasdiq = null, tiklash = null, tasdiqB = null;
  // Qoʻshish oynasi oxirgi tanlovni eslaydi (ketma-ket qoʻshish tez boʻlsin)
  let qosh = { tur: "bolak", profil: null, rang: "", soni: 1, yangiProfil: false, oxirgi: [] };

  // Server rejimi (server.js, docs/server.md): kirgan boʻlsa sklad serverdan (telefonda nusxa), aks holda eskicha lokal
  const srv = () => typeof SB !== "undefined" && SB.kirgan();
  const nus = () => (srv() && SB.nusxa()) || null;
  const ega = () => { const n = nus(); return !srv() || !!(n && n.men && n.men.rol === "ega"); };
  let srvHolat = "";  // "" | "yuklanmoqda" | "firmasiz" | "internet"
  function lokalBaza() {
    try { const b = JSON.parse(okk(SKLAD_KALIT) || "null"); return skTekshir(b) ? b : null; } catch (e) { return null; }
  }
  function baza() {
    if (srv()) return SB.baza();
    if (typeof SB !== "undefined" && SB.birKirgan()) return null;  // server bilan ishlagan telefon: eski lokal sklad zakazga ham berilmaydi
    return lokalBaza();
  }
  function saqlaB(b) {
    try { localStorage.setItem(SKLAD_KALIT, JSON.stringify(b)); return true; }
    catch (e) { skXato("Telefon xotirasi toʻldi — sklad saqlanmadi. Zaxirani faylga saqlang."); return false; }
  }
  function skXato(m) { if (typeof xato === "function") xato(m); else alert(m); }
  // Oʻzgartirish: nusxada bajariladi, xato boʻlsa baza oʻzgarmaydi
  function amal(fn) {
    const b = baza() || skBoshBaza();
    try { const r = fn(b); if (!saqlaB(b)) return null; if (typeof xato === "function") xato(""); return r ?? true; }
    catch (e) { skXato(e.message); return null; }
  }
  // Lokal: amal(lokal). Server: avval lokal qoidalar bilan nusxada tekshiriladi (xato matnlari bir xil), keyin RPC.
  let band = false;
  async function ishla(lokal, server, tikla) {
    if (!srv()) return amal(lokal);
    if (band) return null;
    band = true; document.body.classList.add("sk-band");
    try {
      if (lokal) { const b = JSON.parse(JSON.stringify(baza() || skBoshBaza())); b.keyingi_raqam = 1; b.keyingi_id = 1; lokal(b); }
      const r = await server();
      if (typeof xato === "function") xato("");
      return r ?? true;
    } catch (e) {
      if (tikla) { const t = await tikla(e); if (t) { if (typeof xato === "function") xato(""); return t; } }
      if (e.kod === "ziddiyat" && SB.ziddiyatlar().length) { och({ t: "ziddiyat" }); return null; }
      skXato(e.message);
      if (e.st === 401) yop();  // oyna qayta chizilmaydi — yozilgan qiymatlar qolsin
      chiz();
      return null;
    } finally { band = false; document.body.classList.remove("sk-band"); }
  }
  // Serverdan yangilash (ekran ochilganda); firma aʼzosi emas — firmasiz ekran
  async function yangila() {
    if (!srv()) return;
    srvHolat = SB.nusxa() ? "" : "yuklanmoqda";
    chiz();
    try {
      await SB.sinxron().catch(() => {});
      const n = await SB.torting(); srvHolat = "";
      if (n.firma && n.firma.kochirildi && okk(SKLAD_KALIT) && n.men && n.men.rol === "ega") { ozk("sklad_baza_eski", okk(SKLAD_KALIT)); ozk(SKLAD_KALIT, null); }
    }
    catch (e) {
      if (e.st === 403 && /aʼzosi emas/.test(e.message)) { SB.tozala(); srvHolat = "firmasiz"; }
      else if (e.st === 401) srvHolat = "";
      else srvHolat = SB.nusxa() ? "" : "internet";
      if (e.st !== 403 && SB.nusxa()) xabarMatn = "Internet yoʻq — telefondagi nusxa koʻrsatilmoqda";
    }
    chiz();
  }

  // ---------- server: kirish, firma ----------
  function chizSrvBosh() {
    const n = nus();
    if (!srv()) return false;
    if (srvHolat === "yuklanmoqda") { el("sklad-ich").innerHTML = `<p class="xira sk-boshliq">Yuklanmoqda…</p>`; return true; }
    if (srvHolat === "internet") {
      el("sklad-ich").innerHTML = `<section class="karta sk-bosh"><div class="sk-bosh-ikon">📡</div><h2>Internet yoʻq</h2>
        <p class="xira">Sklad birinchi marta serverdan yuklanadi — internet kerak.</p><button class="tugma asosiy keng" data-sk="yangila">Qayta urinish</button>
        <button class="tugma keng" data-sk="chiq">Chiqish</button></section>`;
      return true;
    }
    if (srvHolat === "firmasiz" || !n || !n.firma) {
      const tel = SB.sessiya() && SB.sessiya().tel;
      const yb = SB.yuborilmadi().length;
      el("sklad-ich").innerHTML = (yb ? `<button class="sk-navbat-t" data-sk="navbat">⚠ ${yb} ta amal yuborilmadi (firmadan chiqarilgansiz) — faylga saqlang</button>` : "") + `<section class="karta sk-firma"><h2>Firma</h2><p class="xira">${h(typeof sbChiroyli === "function" ? sbChiroyli(tel) : tel)} bilan kirdingiz. Firma oching yoki ega bergan kodni kiriting.</p>
        <div class="sk-forma"><label class="keng">Ismingiz<input id="skf-ism" type="text" maxlength="40" autocomplete="name"></label></div>
        <h3>Yangi firma (siz — ega)</h3>
        <div class="sk-forma"><label class="keng">Firma nomi<input id="skf-nom" type="text" maxlength="60" placeholder="masalan Dodorom"></label>
          <label class="keng">Shahar<input id="skf-shahar" type="text" maxlength="40" placeholder="Qoʻqon"></label></div>
        <button class="tugma asosiy keng" data-sk="firma-yarat">Firma ochish</button>
        <h3>Ishchiman — kodim bor</h3>
        <div class="sk-forma"><label class="keng">Kod (12 belgi)<input id="skf-kod" type="text" maxlength="14" autocapitalize="characters" autocomplete="off"></label></div>
        <button class="tugma keng" data-sk="taklif-ol">Firmaga qoʻshilish</button>
        ${xabarMatn ? `<p class="sk-xabar">${h(xabarMatn)}</p>` : ""}
        <button class="tugma keng" data-sk="yangila">↻ Yangilash</button>
        <button class="tugma keng" data-sk="chiq">Chiqish</button></section>`;
      return true;
    }
    return false;
  }
  const lokalSoni = () => { const b = lokalBaza(); return b ? b.bolaklar.length : 0; };
  const srvSatr = () => {
    const n = nus();
    if (!n || !n.firma) return "";
    const nb = SB.navbat().length, zd = SB.ziddiyatlar().length, yb = SB.yuborilmadi().length;
    const oflayn = !SB.onlayn() || SB.holat() === "oflayn";
    return `<div class="sk-hisob"><span>${oflayn ? "📵" : "☁"} <b>${h(n.firma.nom)}</b> · ${h(n.men.ism)}${n.men.rol === "ega" ? " (ega)" : ""}</span>
      <span class="sk-ikonlar"><button class="sk-ikon" data-sk="tarix" aria-label="Tarix">🕘</button><button class="sk-ikon" data-sk="hisob" aria-label="Firma va ishchilar">⚙</button></span></div>
      ${zd ? `<button class="sk-ogoh-t" data-sk="ziddiyat">⚠ ${zd} ta ziddiyat — hal qilish</button>` : ""}
      ${nb || yb ? `<button class="sk-navbat-t" data-sk="navbat">⏳ ${nb} ta amal serverga yetmagan${yb ? ` · ${yb} ta yuborilmadi` : ""}${oflayn ? " (internet yoʻq)" : ""}</button>` : ""}`;
  };

  // Qidiruv: bosilganda "S-" oʻzi yoziladi (foydalanuvchi, 2026-11-20) — faqat raqam terish kifoya.
  // "S-" yolgʻiz — filtr yoʻq; "S-" dan keyin harf boʻlsa — profil nomi ("S-kosa" → "kosa").
  const izlaQiymat = (v) => { v = String(v || ""); if (/^\s*s-?\s*$/i.test(v)) return ""; return v.replace(/^\s*s-(?=\s*[^\d\s])/i, ""); };

  // ---------- asosiy roʻyxat ----------
  function chiz() {
    if (chizSrvBosh()) return;
    if (srv() && seriya && SB.id(seriya) !== seriya) { seriya = SB.id(seriya); ozk("sk_seriya", seriya); }  // birlashgan seriya
    const b = baza();
    if (srv() && (!b || !b.seriyalar.length)) {
      el("sklad-ich").innerHTML = srvSatr() + (ega() ? `<section class="karta sk-bosh"><div class="sk-bosh-ikon">📦</div><h2>Firma skladi boʻsh</h2>
        <p class="xira">Bir marta tanlanadi: eski skladingizni koʻchiring yoki namunadan (seriya, profil, narx) boshlang.</p>
        ${xabarMatn ? `<p class="sk-xabar">${h(xabarMatn)}</p>` : ""}
        <button class="tugma${tasdiqB === "kochir" ? " xavf" : " asosiy"} keng" data-sk="kochir">${tasdiqB === "kochir" ? "Rostdan koʻchirilsinmi? Bir marta, qaytarilmaydi" : "Eski skladni koʻchirish"}</button>
        <button class="tugma${tasdiqB === "namuna" ? " xavf" : ""} keng" data-sk="namuna">${tasdiqB === "namuna" ? `Rostdan namunadan boshlansinmi? Keyin koʻchirib boʻlmaydi${lokalSoni() ? ` (telefondagi ${lokalSoni()} boʻlak koʻchmaydi)` : ""}` : "Namunadan boshlash (78 profil, narx bilan)"}</button>
        <button class="tugma${tasdiqB === "seriya" ? " xavf" : ""} keng" data-sk="seriya-bosh">${tasdiqB === "seriya" ? `Rostdan? Telefondagi ${lokalSoni()} boʻlak keyin koʻchmaydi` : "+ Seriya qoʻshish (boʻsh)"}</button></section>`
        : `<section class="karta sk-bosh"><div class="sk-bosh-ikon">📦</div><h2>Sklad hali boʻsh</h2><p class="xira">Firma egasi seriya va profillarni qoʻshgach shu yerda chiqadi.</p>
        <button class="tugma keng" data-sk="yangila">Yangilash</button></section>`);
      return;
    }
    if (!srv() && typeof SB !== "undefined" && SB.birKirgan()) {
      el("sklad-ich").innerHTML = `<section class="karta sk-bosh"><div class="sk-bosh-ikon">☁</div><h2>Skladga kiring</h2>
        <p class="xira">Sklad serverda — telefon raqam va parol bilan kiring.</p>
        <button class="tugma asosiy keng" data-sk="kirish">Kirish</button></section>`;
      return;
    }
    if (!b || !b.seriyalar.length) {
      el("sklad-ich").innerHTML = `<section class="karta sk-bosh"><div class="sk-bosh-ikon">📦</div><h2>Sklad hali boʻsh</h2>
        <p class="xira">Sheetsʼdagi skladni bir marta koʻchiring yoki seriyadan boshlang. Keyin hammasi shu yerda yuradi.</p>
        <button class="tugma asosiy keng" data-sk="kochir">Eski skladni koʻchirish</button>
        <button class="tugma keng" data-sk="seriya">+ Seriya qoʻshish</button>
        <label class="tugma keng">Zaxira fayldan tiklash<input data-sk-fayl type="file" accept=".json,application/json" hidden></label>
        ${typeof SB !== "undefined" ? '<button class="tugma keng" data-sk="kirish">☁ Serverga kirish (firma, ishchilar)</button>' : ""}</section>`;
      return;
    }
    if (!skSeriya(b, seriya)) seriya = b.seriyalar[0].id;
    const s = skSeriya(b, seriya), jami = skJami(b, seriya), ranglar = skRanglar(b, seriya);
    const pnomlar = skProfilNomlar(b, seriya);
    if (rangF && !ranglar.includes(rangF)) rangF = "";
    if (profF && !pnomlar.some((x) => x.toLowerCase() === profF.toLowerCase())) profF = "";
    const g = skGuruhlar(b, seriya, { rang: rangF, izla: izlaQiymat(izla), pnom: profF });
    const tab = (x) => { const j = skJami(b, x.id); return `<button data-sk-s="${x.id}" class="${x.id === seriya ? "faol" : ""}">${h(x.nom)}<small>${j.bolak + j.butun}</small></button>`; };
    let t = srvSatr() + `<div class="sk-tablar" role="tablist">${b.seriyalar.map(tab).join("")}${ega() ? '<button data-sk="seriya" aria-label="Seriya qoʻshish">＋</button>' : ""}</div>
      <section class="sk-tepa"><div><small>${h(s.nom)} · hivich ${smM(s.hivich_sm)} sm</small><b>${jami.bolak} boʻlak${jami.butun ? ` · ${jami.butun} butun` : ""}</b></div>
        <div class="sk-pul"><small>Qiymati</small><b>${pul(jami.summa)}</b></div></section>
      <button class="tugma asosiy keng sk-qosh-t" data-sk="qosh">+ Qoʻshish</button>
      ${xabarMatn ? `<p class="sk-xabar">${xabarMatn}</p>` : ""}
      <div class="sk-filtr"><input id="sk-izla" type="search" placeholder="Profil yoki S-raqam" value="${h(izla)}" autocomplete="off">
        ${pnomlar.length > 1 ? `<div class="sk-ranglar sk-profillar"><button data-sk-pf="" class="${profF ? "" : "faol"}">Hammasi</button>${pnomlar.map((r) => `<button data-sk-pf="${h(r)}" class="${r.toLowerCase() === profF.toLowerCase() ? "faol" : ""}">${h(r)}</button>`).join("")}</div>` : ""}
        ${ranglar.length > 1 ? `<div class="sk-ranglar"><button data-sk-r="" class="${rangF ? "" : "faol"}">Hammasi</button>${ranglar.map((r) => `<button data-sk-r="${h(r)}" class="${r === rangF ? "faol" : ""}">${h(r)}</button>`).join("")}</div>` : ""}</div>`;
    if (!g.length) t += `<p class="xira sk-boshliq">${izlaQiymat(izla) || rangF || profF ? "Hech narsa topilmadi" : "Bu seriyada hali boʻlak yoʻq — “+ Qoʻshish” bosing"}</p>`;
    for (const x of g) {
      t += `<section class="karta sk-karta"><div class="sk-sar"><div class="sk-nom"><b>${h(x.profil.nom)}</b><span class="sk-rang">${h(x.rang)}</span>${s.nom in SK_RASKROY && !x.profil.kod ? '<span class="sk-yoq" title="Kesish rejasi bu nomni tanimaydi">kesishda olinmaydi</span>' : ""}</div>
          ${ega() ? `<button class="sk-ikon" data-sk="profil" data-id="${x.profil.id}" data-r="${h(x.rang)}" aria-label="Profil nomi, narxi va rangi">✏️</button>` : ""}</div>
        <div class="xira sk-info">${x.bolaklar.length} boʻlak · ${smM(x.metr)} m${x.butun ? ` · ${x.butun} butun` : ""} · ${x.summa == null ? "narx yoʻq" : pul(x.summa)}</div>
        ${x.butun ? `<div class="sk-butun"><span>Butun hivich <small class="xira">${smM(s.hivich_sm)} sm</small></span>
          <button data-sk="butun" data-p="${x.profil.id}" data-r="${h(x.rang)}" data-d="-1" aria-label="Bitta kamaytirish">−</button><b>${x.butun}</b>
          <button data-sk="butun" data-p="${x.profil.id}" data-r="${h(x.rang)}" data-d="1" aria-label="Bitta qoʻshish">+</button></div>` : ""}
        ${x.bolaklar.length ? `<div class="sk-bolaklar">${x.bolaklar.map((q) => `<button class="sk-b" data-sk="bolak" data-n="${q.raqam}" style="--u:${Math.min(100, q.sm / s.hivich_sm * 100).toFixed(1)}%">
          <b>${smM(q.sm)}</b><small>S-${q.raqam}${q.kutish ? " ⏳" : ""}</small></button>`).join("")}</div>` : ""}</section>`;
    }
    t += `<details class="karta sk-boshqa"><summary>Boshqa</summary><div class="tugmalar">
        <button class="tugma" data-sk="zaxira">💾 Zaxira faylga</button>
        <button class="tugma" data-sk="excel">⬇ Excel</button>
        ${srv() ? '<button class="tugma" data-sk="yangila">↻ Yangilash</button>' : '<label class="tugma">Fayldan tiklash<input data-sk-fayl type="file" accept=".json,application/json" hidden></label>'}
        ${ega() ? `<button class="tugma" data-sk="seriya-t" data-id="${s.id}">Seriya: ${h(s.nom)}</button>` : ""}
        ${!srv() && typeof SB !== "undefined" ? '<button class="tugma" data-sk="kirish">☁ Serverga kirish</button>' : ""}</div>
        <p class="xira">${srv() ? "Sklad serverda, telefonda nusxasi bor (internetsiz ham koʻrinadi)." : "Sklad shu telefonda saqlanadi. Zaxirani vaqti-vaqti bilan faylga saqlang."}</p></details>`;
    el("sklad-ich").innerHTML = t;
  }

  // ---------- oynalar (pastdan chiqadi) ----------
  function och(o) { oyna = o; tasdiq = null; oynaChiz(); el("sk-parda").hidden = false; }
  function yop() { oyna = null; tiklash = null; el("sk-parda").hidden = true; chiz(); }
  function oynaChiz() {
    const b = baza() || skBoshBaza(), q = el("sk-oyna");
    if (!oyna) return;
    if (oyna.t === "qosh") {
      const pr = b.profillar.filter((p) => p.seriya === seriya);
      if (srv() && qosh.profil) qosh.profil = SB.id(qosh.profil);  // birlashgan profil
      if (!pr.some((p) => p.id === qosh.profil)) qosh.profil = pr.length ? pr[0].id : null;
      if (!pr.length && ega()) qosh.yangiProfil = true;
      if (!ega()) qosh.yangiProfil = false;
      const s = skSeriya(b, seriya), ranglar = skRanglar(b, seriya);
      q.innerHTML = `<div class="sarlavha-katta">Skladga qoʻshish · ${h(s.nom)}</div>
        <div class="seg sk-tur"><button data-q="tur" data-v="bolak" class="${qosh.tur === "bolak" ? "faol" : ""}">Boʻlak</button><button data-q="tur" data-v="butun" class="${qosh.tur === "butun" ? "faol" : ""}">Butun hivich</button></div>
        <div class="sk-forma">
          <label class="keng">Profil<select id="skq-profil">${pr.map((p) => `<option value="${p.id}"${p.id === qosh.profil && !qosh.yangiProfil ? " selected" : ""}>${h(p.nom)}</option>`).join("")}
            ${ega() ? `<option value="+"${qosh.yangiProfil ? " selected" : ""}>+ Yangi profil…</option>` : ""}</select></label>
          ${qosh.yangiProfil ? `<label>Yangi profil nomi<input id="skq-pnom" type="text" maxlength="40" placeholder="masalan Kosa F703"></label>
            <label>Hivich narxi, $<input id="skq-pnarx" type="text" inputmode="decimal" placeholder="boʻsh boʻlishi mumkin"></label>` : ""}
          <label class="keng">Rang<input id="skq-rang" type="text" maxlength="20" value="${h(qosh.rang)}" placeholder="grey, oq, d/m …" autocomplete="off"></label>
          ${ranglar.length ? `<div class="sk-ranglar keng">${ranglar.map((r) => `<button data-q="rang" data-v="${h(r)}" class="${r === qosh.rang ? "faol" : ""}">${h(r)}</button>`).join("")}</div>` : ""}
          ${qosh.tur === "bolak" ? `<label>Uzunlik, sm<input id="skq-sm" type="text" inputmode="decimal" placeholder="≤ ${smM(s.hivich_sm)}"></label>` : ""}
          <label>Soni<span class="sk-son"><button data-q="soni" data-v="-1" aria-label="Kamaytirish">−</button><input id="skq-soni" type="text" inputmode="numeric" value="${qosh.soni}"><button data-q="soni" data-v="1" aria-label="Koʻpaytirish">+</button></span></label>
        </div>
        ${qosh.oxirgi.length ? `<p class="sk-xabar">${qosh.oxirgi.map(h).join("<br>")}</p>` : ""}
        <div class="tugmalar"><button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="saqla">Qoʻshish</button></div>`;
      const f = el(qosh.yangiProfil ? "skq-pnom" : qosh.tur === "bolak" ? "skq-sm" : "skq-rang");
      if (f) setTimeout(() => f.focus(), 50);
      return;
    }
    if (oyna.t === "bolak") {
      const x = b.bolaklar.find((y) => y.raqam === oyna.n);
      if (!x) { yop(); return; }
      const p = skProfil(b, x.profil), s = skSeriya(b, p.seriya), sm = skBolakSumma(b, x);
      q.innerHTML = `<div class="sk-bolak-sar"><span class="sk-raqam">S-${x.raqam}</span><div><b>${h(p.nom)}</b><small class="xira">${h(s.nom)} · ${h(x.rang)}</small></div></div>
        <p class="xira">Qoʻshilgan: ${h(x.sana)} · ${h(x.manba)}${sm != null ? ` · qiymati ${pul(skYaxlit(sm))}` : ""}</p>
        <div class="sk-forma"><label>Uzunlik, sm<input id="skb-sm" type="text" inputmode="decimal" value="${smM(x.sm)}"></label>
          <label>Rang<input id="skb-rang" type="text" maxlength="20" value="${h(x.rang)}"></label>
          <label class="keng">Profil<select id="skb-profil">${b.profillar.filter((q) => q.seriya === p.seriya).map((q) => `<option value="${h(q.id)}"${q.id === p.id ? " selected" : ""}>${h(q.nom)}${s.nom in SK_RASKROY && !q.kod ? " (kesishda olinmaydi)" : ""}</option>`).join("")}</select></label></div>
        <div class="tugmalar"><button class="tugma${tasdiq === "ochir" ? " xavf" : " tasdiq"}" data-q="ochir">${tasdiq === "ochir" ? "Rostdan oʻchirilsinmi?" : "Oʻchirish"}</button>
          <button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="bsaqla">Saqlash</button></div>
        ${srv() ? `<button class="tugma keng sk-tarix-t" data-q="btarix">🕘 S-${x.raqam} tarixi</button>` : ""}`;
      return;
    }
    if (oyna.t === "profil") {
      const p = skProfil(b, oyna.id);
      if (!p) { yop(); return; }
      q.innerHTML = `<div class="sarlavha-katta">Profil</div><div class="sk-forma">
        <label class="keng">Nomi<input id="skp-nom" type="text" maxlength="40" value="${h(p.nom)}"></label>
        <label class="keng">Hivich narxi, $ (summa shundan)<input id="skp-narx" type="text" inputmode="decimal" value="${p.narx == null ? "" : String(p.narx).replace(".", ",")}" placeholder="boʻsh — narx yoʻq"></label>
        ${oyna.rang ? (() => { const nb = b.bolaklar.filter((x) => x.profil === p.id && x.rang === oyna.rang).length, nu = (b.butunlar.find((x) => x.profil === p.id && x.rang === oyna.rang) || {}).soni || 0;
          return `<label class="keng">Shu kartadagi rang<input id="skp-rang" type="text" maxlength="20" value="${h(oyna.rang)}" autocomplete="off"></label>
        <p class="xira keng">Oʻzgartirsangiz, ${nb} boʻlak${nu ? ` va ${nu} butun hivich` : ""} yangi rangga oʻtadi (nom oʻzgarmaydi).</p>`; })() : ""}</div>
        <p class="xira">${p.kod ? `Kesish rejasida: ${h(p.kod)} (nom oʻzgarsa ham qoladi)` : "Kesish rejasida ishlatilmaydi"}</p>
        <div class="tugmalar"><button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="psaqla">Saqlash</button></div>`;
      return;
    }
    if (oyna.t === "seriya") {
      q.innerHTML = `<div class="sarlavha-katta">Yangi seriya</div><div class="sk-forma">
        <label class="keng">Nomi<input id="sks-nom" type="text" maxlength="30" placeholder="masalan Exclusive"></label>
        <label class="keng">Hivich uzunligi, sm<input id="sks-h" type="text" inputmode="decimal" value="600"></label></div>
        <div class="tugmalar"><button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="ssaqla">Qoʻshish</button></div>`;
      setTimeout(() => el("sks-nom").focus(), 50);
      return;
    }
    if (oyna.t === "seriya-t") {
      const s = skSeriya(b, oyna.id);
      q.innerHTML = `<div class="sarlavha-katta">Seriya: ${h(s.nom)}</div><div class="sk-forma">
        <label class="keng">Hivich uzunligi, sm<input id="sks-h" type="text" inputmode="decimal" value="${smM(s.hivich_sm)}"></label></div>
        <p class="xira">Hivich uzunligi boʻlak qiymatini va eng uzun boʻlakni belgilaydi.</p>
        <div class="tugmalar"><button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="stsaqla">Saqlash</button></div>`;
      return;
    }
    if (oyna.t === "kirish") {
      const yangi = oyna.yangi, eT = el("skk-tel"), eP = el("skk-parol"), parol = eP ? eP.value : "";
      if (eT) oyna.tel = eT.value;  // qayta chizishda terilgani yoʻqolmasin
      q.innerHTML = `<div class="sarlavha-katta">${yangi ? "Roʻyxatdan oʻtish" : "Kirish"}</div>
        <div class="seg sk-tur"><button data-q="krejim" data-v="" class="${yangi ? "" : "faol"}">Kirish</button><button data-q="krejim" data-v="1" class="${yangi ? "faol" : ""}">Roʻyxatdan oʻtish</button></div>
        <div class="sk-forma"><label class="keng">Telefon<input id="skk-tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998 90 123 45 67" value="${h(oyna.tel || "")}"></label>
          <label class="keng">Parol${yangi ? " (kamida 6 belgi)" : ""}<input id="skk-parol" type="password" autocomplete="${yangi ? "new-password" : "current-password"}"></label></div>
        ${oyna.xato ? `<p class="ogoh">${h(oyna.xato)}</p>` : ""}
        ${yangi ? "" : `<p class="xira">Parolni unutdingizmi? Ilova egasiga yozing${typeof SB_YORDAM_TEL !== "undefined" && SB_YORDAM_TEL ? `: <a href="tel:${h(SB_YORDAM_TEL.replace(/\s/g, ""))}">${h(SB_YORDAM_TEL)}</a>` : ""} — parolni u tiklaydi.</p>`}
        <div class="tugmalar"><button class="tugma" data-q="yop">Yopish</button><button class="tugma asosiy" data-q="kirish">${yangi ? "Roʻyxatdan oʻtish" : "Kirish"}</button></div>`;
      if (parol) el("skk-parol").value = parol;
      if (!eT) setTimeout(() => el("skk-tel") && el("skk-tel").focus(), 50);
      return;
    }
    if (oyna.t === "hisob") {
      const n = nus();
      if (!n || !n.firma) { yop(); return; }
      const e = n.men.rol === "ega";
      const azo = (a) => `<li><span>${h(a.ism)} <small class="xira">${a.rol === "ega" ? "ega" : "ishchi"}${a.faol ? "" : " · chiqarilgan"}</small></span>
        ${e && a.user_id !== n.men.user_id ? `<button class="tugma" data-q="azo" data-u="${a.user_id}" data-f="${a.faol ? "" : "1"}" data-r="${a.rol}">${a.faol ? "Chiqarish" : "Qaytarish"}</button>` : ""}</li>`;
      q.innerHTML = `<div class="sarlavha-katta">☁ ${h(n.firma.nom)}</div>
        <p class="xira">${h(n.men.ism)} · ${e ? "ega" : "ishchi"} · ${h(sbChiroyli((SB.sessiya() || {}).tel))}${n.firma.shahar ? " · " + h(n.firma.shahar) : ""}</p>
        <h3>Aʼzolar</h3><ul class="sk-azolar">${n.azolar.map(azo).join("")}</ul>
        ${e ? `<h3>Ishchi qoʻshish</h3><p class="xira">Kod 48 soat amal qiladi, bir marta ishlatiladi. Ishchi ilovada roʻyxatdan oʻtib, shu kodni kiritadi.</p>
          ${oyna.kod ? `<p class="sk-kod">${h(oyna.kod)}</p><p class="xira">${oyna.kodRol === "ega" ? "Bu kod bilan kirgan odam — ikkinchi ega" : "Bu kod — ishchi uchun"}</p>` : ""}
          <div class="tugmalar"><button class="tugma asosiy" data-q="taklif" data-v="ishchi">Ishchi uchun kod</button><button class="tugma" data-q="taklif" data-v="ega">Ikkinchi ega uchun kod</button></div>` : ""}
        ${tasdiq === "chiq2" ? `<p class="ogoh">Internet yoʻq: ${SB.navbat().length} ta amal serverga yetmagan. Telefonda saqlanadi — shu raqam bilan qayta kirsangiz yuboriladi.</p>` : ""}
        ${SB.boshqaNavbat().length ? `<p class="ogoh">Bu telefonda boshqa hisobning ${SB.boshqaNavbat().length} ta yuborilmagan amali bor (oʻsha raqam bilan kirsa yuboriladi). <button class="tugma" data-q="boshqa-fayl">Faylga saqlash</button></p>` : ""}
        <div class="tugmalar"><button class="tugma${tasdiq === "chiq" || tasdiq === "chiq2" ? " xavf" : ""}" data-q="chiq">${tasdiq === "chiq2" ? "Baribir chiqish" : tasdiq === "chiq" ? "Rostdan chiqilsinmi?" : "Hisobdan chiqish"}</button><button class="tugma" data-q="yop">Yopish</button></div>`;
      return;
    }
    if (oyna.t === "ziddiyat") {
      const z = SB.ziddiyatlar()[0];
      if (!z) { yop(); return; }
      const v = zidOyna(z), jami = SB.ziddiyatlar().length;
      q.innerHTML = `<div class="sarlavha-katta">${v.sarlavha}${jami > 1 ? ` <small class="xira">(1 / ${jami})</small>` : ""}</div>
        <p class="sk-zid">${v.matn}</p>
        ${z.bogliq && z.bogliq.length ? `<p class="xira">Shu bilan bogʻliq yana ${z.bogliq.length} ta amalingiz: ${z.bogliq.map((x) => h(SB.amalMatn(x, baza()))).join("; ")}${v.bogliqMatn ? " — " + v.bogliqMatn : ""}</p>` : ""}
        <div class="tugmalar">${v.tugmalar.map(([t, m, asosiy]) => `<button class="tugma${asosiy ? " asosiy" : ""}" data-q="hal" data-v="${t}" data-op="${z.op}">${m}</button>`).join("")}</div>`;
      return;
    }
    if (oyna.t === "tarix") {
      const T = oyna;
      q.innerHTML = `<div class="sarlavha-katta">🕘 Tarix</div>
        <div class="sk-forma"><label class="keng">Qidiruv<input id="skt-izla" type="search" placeholder="S-raqam yoki ism" value="${h(T.izla)}" autocomplete="off"></label></div>
        <div class="seg sk-tur">${[["bugun", "Bugun"], ["7", "7 kun"], ["", "Hammasi"]].map(([v, m]) => `<button data-q="tkun" data-v="${v}" class="${T.kun === v ? "faol" : ""}">${m}</button>`).join("")}</div>
        <div id="skt-royxat">${tarixRoyxat()}</div>
        <div class="tugmalar"><button class="tugma" data-q="texcel">⬇ Excel</button><button class="tugma" data-q="yop">Yopish</button></div>`;
      return;
    }
    if (oyna.t === "navbat") {
      const nb = SB.navbat(), yb = SB.yuborilmadi(), b = baza();
      q.innerHTML = `<div class="sarlavha-katta">Serverga yetmagan amallar</div>
        ${nb.length ? `<p class="xira">Internet kelganda oʻzi yuboriladi (shu tartibda).</p><ol class="sk-navbat">${nb.map((x) => `<li>${h(SB.amalMatn(x, b))}</li>`).join("")}</ol>` : `<p>Hammasi yuborilgan.</p>`}
        ${yb.length ? `<p class="ogoh">Yuborilmadi (${yb.length} ta) — siz firmadan chiqarilgansiz. Faylga saqlab, egaga yuboring:</p>
          <ol class="sk-navbat">${yb.map((x) => `<li>${h(SB.amalMatn(x, b))}</li>`).join("")}</ol>
          <div class="tugmalar"><button class="tugma asosiy" data-q="yb-fayl">Faylga saqlash</button><button class="tugma${tasdiq === "yb-tozala" ? " xavf" : ""}" data-q="yb-tozala">${tasdiq === "yb-tozala" ? "Rostdan oʻchirilsinmi?" : "Roʻyxatni oʻchirish"}</button></div>` : ""}
        <div class="tugmalar">${nb.length ? `<button class="tugma asosiy" data-q="yubor">Hozir yuborish</button>` : ""}<button class="tugma" data-q="yop">Yopish</button></div>`;
      return;
    }
    if (oyna.t === "tiklash") {
      const eski = baza();
      q.innerHTML = `<div class="sarlavha-katta">Zaxiradan tiklash</div>
        <p>Fayldagi sklad: <b>${tiklash.bolaklar.length} boʻlak</b>, ${tiklash.seriyalar.length} seriya.</p>
        ${eski ? `<p class="ogoh">Hozirgi sklad (${eski.bolaklar.length} boʻlak) shu fayl bilan almashtiriladi.</p>` : ""}
        <div class="tugmalar"><button class="tugma" data-q="yop">Bekor</button><button class="tugma asosiy" data-q="tiklash">Tiklash</button></div>`;
    }
  }

  // Ziddiyat oynasi matni va tugmalari (docs/server.md "Ziddiyatlar")
  function zidOyna(z) {
    const j = z.javob || {}, zd = j.ziddiyat || {}, a = z.args || {}, b = baza();
    const bol = zd.bolak, S = bol ? `S-${bol.raqam}` : "";
    const kim = zd.oxirgi && zd.oxirgi.kim ? h(zd.oxirgi.kim) : "Boshqa odam";
    const qachon = zd.oxirgi && zd.oxirgi.qachon ? ` (${new Date(zd.oxirgi.qachon).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})` : "";
    const ok = [["ok", "Tushunarli", true]];
    if (j.malumot) return { sarlavha: "Maʼlumot", matn: h(j.malumot), tugmalar: ok };
    if (j.xato) return { sarlavha: "Yozilmadi", matn: `${h(SB.amalMatn(z, b))}: ${h(j.xato)}`, tugmalar: ok, bogliqMatn: "ular ham yozilmaydi" };
    if (zd.tur === "versiya" && bol) {
      if (z.nom === "bolak_ochir") return { sarlavha: `${S} oʻzgargan`, matn: `${kim}${qachon} ${S} ni ${smM(bol.sm)} sm · ${h(bol.rang)} qilgan. Siz uni oʻchirmoqchi edingiz.`,
        tugmalar: [["uniki", "Oʻchirmaslik"], ["meniki", "Baribir oʻchirish", true]] };
      const pn = (pid) => { const q = pid && skProfil(b, pid); return q ? h(q.nom) + " · " : ""; }, pk = a.p_profil && a.p_profil !== bol.profil_id;
      return { sarlavha: `${S}: qaysi toʻgʻri?`, matn: `${kim}${qachon} ${S} ni <b>${pk ? pn(bol.profil_id) : ""}${smM(bol.sm)} sm · ${h(bol.rang)}</b> qilgan, siz — <b>${pk ? pn(a.p_profil) : ""}${smM(a.p_sm)} sm · ${h(a.p_rang)}</b>.`,
        tugmalar: [["uniki", `${kim}niki qolsin`], ["meniki", "Meniki toʻgʻri", true]], bogliqMatn: "“Meniki”da ular ham yoziladi" };
    }
    if (zd.tur === "holat" && bol) {
      const hol = bol.holat === "ochirildi" ? "oʻchirgan" : bol.holat === "ishlatildi" ? "kesishga ishlatgan" : "qaytargan";
      if (bol.holat === "ochirildi" && z.nom === "bolak_tahrir")
        return { sarlavha: `${S} oʻchirilgan`, matn: `${kim}${qachon} ${S} ni oʻchirgan. Siz uni ${smM(a.p_sm)} sm · ${h(a.p_rang)} qilmoqchi edingiz.`,
          tugmalar: [["bekor", "Oʻchgani qolsin"], ["qaytar", "Qaytarib, meniki yozilsin", true]] };
      return { sarlavha: `${S} oʻzgargan`, matn: `${kim}${qachon} ${S} ni ${hol}. ${h(SB.amalMatn(z, b))} — yozilmadi.`, tugmalar: ok };
    }
    if (zd.tur === "versiya" && zd.narx !== undefined)
      return { sarlavha: "Narx: qaysi toʻgʻri?", matn: `${h(zd.nom)}: boshqa odam narxni <b>${zd.narx == null ? "narxsiz" : h(zd.narx) + " $"}</b> qilgan, siz — <b>${a.p_narx == null ? "narxsiz" : h(a.p_narx) + " $"}</b>.`,
        tugmalar: [["uniki", "Uning narxi"], ["meniki", "Mening narxim", true]] };
    if (zd.tur === "versiya" && zd.hivich_sm !== undefined)
      return { sarlavha: "Seriya: qaysi toʻgʻri?", matn: `${h(zd.nom)}: boshqa odam hivichni <b>${smM(zd.hivich_sm)} sm</b> qilgan, siz — <b>${smM(a.p_hivich)} sm</b>.`,
        tugmalar: [["uniki", "Uniki"], ["meniki", "Meniki", true]] };
    return { sarlavha: "Yozilmadi", matn: `${h(SB.amalMatn(z, b))}: ${h(sbZiddiyatMatn(zd))}`, tugmalar: ok, bogliqMatn: "ular ham yozilmaydi" };
  }
  // ---------- Tarix (d-qadam) ----------
  function tarixOch(izla) {
    och({ t: "tarix", izla: izla || "", kun: "7", qatorlar: [], tugadi: false, band: false, xato: "" });
    tarixYukla(true);
  }
  let tarixSorov = 0;
  async function tarixYukla(boshidan) {
    const T = oyna;
    if (!T || T.t !== "tarix") return;
    const n = ++tarixSorov;
    if (boshidan) { T.qatorlar = []; T.tugadi = false; }
    T.band = true; T.xato = ""; tarixYangila();
    try {
      const j = await SB.jurnal({ izla: T.izla, kun: T.kun, gacha: boshidan ? null : (T.qatorlar[T.qatorlar.length - 1] || {}).id, n: 50 });
      if (n !== tarixSorov || oyna !== T) return;  // eskirgan javob
      T.qatorlar.push(...j); T.tugadi = j.length < 50;
    } catch (e) { if (n === tarixSorov) T.xato = e.message; }
    if (n === tarixSorov) { T.band = false; tarixYangila(); }
  }
  function tarixYangila() { const r = el("skt-royxat"); if (r && oyna && oyna.t === "tarix") r.innerHTML = tarixRoyxat(); }
  function tarixRoyxat() {
    const T = oyna, xom = SB.xom ? SB.xom() : null, nb = SB.navbat();
    const korildi = new Set();
    const li = T.qatorlar.map((j) => {
      const m = sbJurnalMatn(j);
      let tug = "";
      if (j.amal === "ochirdi" && j.bolak_id && !korildi.has(j.bolak_id)) {
        const b = xom && xom.bolaklar.find((x) => x.id === j.bolak_id);
        if (b && b.holat === "ochirildi" && !nb.some((o) => o.args.p_id === j.bolak_id)) tug = `<button class="tugma kichik" data-q="tqaytar" data-id="${j.bolak_id}" data-n="${j.raqam}">Qaytarish</button>`;
      }
      if (j.bolak_id) korildi.add(j.bolak_id);
      return `<li><div><small class="xira">${h(m.vaqt)} · ${h(m.kim)}</small> <b>${h(m.amal)}</b> ${h(m.S)}</div>
        <div>${[m.profil, m.rang, m.sm ? m.sm + " sm" : "", m.eski].filter(Boolean).map(h).join(" · ")}</div>${tug}</li>`;
    }).join("");
    let bosh = "";
    if (!T.qatorlar.length && !T.band && !T.xato) {
      const s = /^s?-?\s*(\d+)$/i.exec(T.izla.trim()), b = s && xom && xom.bolaklar.find((x) => x.raqam === Number(s[1]));
      bosh = b && b.manba === "Sheets" ? `<p class="xira">S-${b.raqam} Sheetsʼdan koʻchirilgan (${h(b.sana || "")}), shundan beri oʻzgarmagan.</p>` : `<p class="xira">Hech narsa topilmadi.</p>`;
    }
    return `${T.xato ? `<p class="ogoh">${h(T.xato)}</p>` : ""}${bosh}${li ? `<ol class="sk-tarix">${li}</ol>` : ""}
      ${T.band ? `<p class="xira">Yuklanmoqda…</p>` : !T.tugadi && T.qatorlar.length ? `<button class="tugma keng" data-q="tyana">Yana</button>` : ""}`;
  }
  async function tarixExcel() {
    const T = oyna, hamma = [];
    T.xato = ""; T.band = true; tarixYangila();
    try {
      for (let gacha = null, i = 0; i < 100; i++) {  // 1000 tadan sahifalab (Supabase bir soʻrovda 1000 dan koʻp bermaydi)
        const j = await SB.jurnal({ izla: T.izla, kun: T.kun, gacha, n: 1000 });
        hamma.push(...j);
        if (j.length < 1000) break;
        gacha = j[j.length - 1].id;
      }
      const q = [["Vaqt", "Kim", "Amal", "S-raqam", "Profil", "Rang", "sm", "Izoh"],
        ...hamma.map((j) => { const m = sbJurnalMatn(j); return [m.sana, m.kim, m.amal, m.S, m.profil, m.rang, /→/.test(m.sm) ? m.sm : (j.sm == null ? "" : Number(j.sm)), m.eski]; })];
      xlsxYukla(`Tarix_${firmaNom()}_${skMahalliyBugun()}.xlsx`, [{ nom: "Tarix", qatorlar: q, kenglik: [16, 14, 14, 9, 22, 8, 10, 30] }]);
    } catch (e) { T.xato = e.message; }
    T.band = false; tarixYangila();
  }
  const firmaNom = () => { const n = srv() && SB.nusxa(); return (n && n.firma && n.firma.nom) || "Sklad"; };
  function excelYukla() {
    const b = baza();
    if (!b) { skXato("Sklad yuklanmagan — kiring yoki internetga ulaning"); return; }
    xlsxYukla(`Sklad_${firmaNom()}_${skMahalliyBugun()}.xlsx`, skExcel(b));
  }
  function faylSaqla(nom, d) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- amallar ----------
  async function kochir() {
    if (srv()) return kochirServer();
    if (baza()) { skXato("Sklad boʻsh emas — koʻchirish faqat bir marta"); return; }
    const t = typeof shifrliOch === "function" ? await shifrliOch("sklad_boshlang.enc") : null;
    if (!t) { skXato("Koʻchirish fayli ochilmadi: narx havolasini (kalit bilan) bir marta oching"); return; }
    let r;
    try { r = skEskiKochir(JSON.parse(t), skBugun()); } catch (e) { skXato("Koʻchirish: " + e.message); return; }
    if (!saqlaB(r.baza)) return;
    ozk("sklad", null);  // eski Sheets keshi endi ishlatilmaydi
    seriya = r.baza.seriyalar[0].id; ozk("sk_seriya", seriya);
    xabarMatn = `✓ ${r.baza.bolaklar.length} boʻlak koʻchirildi (${r.baza.seriyalar.length} seriya). Raqamlar S-1 … S-${r.baza.keyingi_raqam - 1}.`;
    chiz();
  }
  // Server: manba — telefondagi lokal sklad, boʻlmasa eski Sheets nusxasi (sklad_boshlang.enc, narx kaliti bilan)
  let kochirManba = null;
  async function kochirServer() {
    if (tasdiqB !== "kochir") {
      let b = lokalBaza();
      if (!b || !b.bolaklar.length) {
        const t = typeof shifrliOch === "function" ? await shifrliOch("sklad_boshlang.enc") : null;
        if (!t) { skXato("Eski sklad topilmadi: bu telefonda lokal sklad yoʻq va koʻchirish fayli ochilmadi (narx havolasini kalit bilan oching)"); return; }
        try { b = skEskiKochir(JSON.parse(t), skBugun()).baza; } catch (e) { skXato("Koʻchirish: " + e.message); return; }
      }
      kochirManba = b; tasdiqB = "kochir";
      const j = skJami(b);
      xabarMatn = `Koʻchiriladi: ${j.bolak} boʻlak${j.butun ? `, ${j.butun} butun` : ""}, ${b.seriyalar.length} seriya, ${pul(j.summa)}. Yana bir bosing.`;
      chiz(); return;
    }
    const b = kochirManba; tasdiqB = null;
    const r = await ishla(null, async () => {
      try { return await SB.togri("kochir", { p: skKochirYuk(b, () => crypto.randomUUID()) }); }
      catch (e) {  // qayta bosilgan: server allaqachon koʻchirgan boʻlsa — muvaffaqiyat
        if (/allaqachon koʻchirilgan/.test(e.message)) { const n = await SB.torting(); if (n.firma && n.firma.kochirildi) return { ok: true, bolak: n.bolaklar.length, keyingi_raqam: n.firma.keyingi_raqam }; }
        throw e;
      }
    });
    if (!r) return;
    if (okk(SKLAD_KALIT)) { ozk("sklad_baza_eski", okk(SKLAD_KALIT)); ozk(SKLAD_KALIT, null); }  // oʻchmaydi, faqat nomi
    ozk("sklad", null);
    seriya = null;
    xabarMatn = `✓ ${r.bolak} boʻlak serverga koʻchirildi. Keyingi raqamlar S-${r.keyingi_raqam} dan.`;
    chiz();
  }
  async function namuna() {
    if (tasdiqB !== "namuna") { tasdiqB = "namuna"; xabarMatn = ""; chiz(); return; }
    tasdiqB = null;
    const r = await ishla(null, () => SB.togri("namuna_ol", {}));
    if (r) { seriya = null; xabarMatn = `✓ Namunadan ${r.profil} profil olindi — narxlarni tekshiring (✏️)`; chiz(); }
  }
  function zaxira() {
    const b = baza();
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: "application/json" }));
    a.download = `Sklad_${skBugun()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const raqMatn = (n) => n.length > 3 ? `S-${n[0]} … S-${n[n.length - 1]}` : n.map((x) => "S-" + x).join(", ");
  const sonV = (x) => x === "" || x == null ? null : Number(String(x).replace(",", "."));
  async function qoshSaqla() {
    qosh.rang = el("skq-rang").value;
    qosh.soni = Number(el("skq-soni").value) || 1;
    const sm = qosh.tur === "bolak" ? el("skq-sm").value : null;
    let r;
    if (!srv()) r = amal((b) => {
      let pid = qosh.profil;
      if (qosh.yangiProfil) pid = skProfilQosh(b, seriya, el("skq-pnom").value, el("skq-pnarx").value).id;
      const p = skProfil(b, pid);
      if (qosh.tur === "butun") {
        skButun(b, pid, qosh.rang, qosh.soni);
        return { pid, matn: `✓ ${p.nom} · ${skRang(qosh.rang)}: butun hivich +${qosh.soni}` };
      }
      const n = skBolakQosh(b, { profil: pid, rang: qosh.rang, sm, soni: qosh.soni });
      return { pid, matn: `✓ ${raqMatn(n)} · ${p.nom} · ${skRang(qosh.rang)} · ${smM(Number(String(sm).replace(",", ".")))} sm — boʻlakka markerda yozing` };
    });
    else {
      const yp = qosh.yangiProfil ? { nom: el("skq-pnom").value, narx: el("skq-pnarx").value } : null;
      r = await ishla((b) => {  // tekshiruv (nusxada)
        const pid = yp ? skProfilQosh(b, seriya, yp.nom, yp.narx).id : qosh.profil;
        if (qosh.tur === "butun") skButun(b, pid, qosh.rang, qosh.soni);
        else skBolakQosh(b, { profil: pid, rang: qosh.rang, sm, soni: qosh.soni });
      }, async () => {
        let pid = qosh.profil;
        if (yp) {
          const s = skSeriya(baza(), seriya);
          pid = crypto.randomUUID();
          await SB.yoz("profil_qosh", { p_id: pid, p_seriya: seriya, p_nom: skNom(yp.nom), p_narx: sonV(yp.narx), p_kod: skRaskroyKod(s.nom, yp.nom) || "" });
        }
        const p = skProfil(baza(), pid) || { nom: "" };
        if (qosh.tur === "butun") {
          const j = await SB.yoz("butun", { p_profil: pid, p_rang: skRang(qosh.rang), p_delta: qosh.soni });
          return { pid, matn: `${j.navbatda ? "⏳" : "✓"} ${p.nom} · ${skRang(qosh.rang)}: butun hivich +${qosh.soni}` };
        }
        const u = Math.round(Number(String(sm).replace(",", ".")) * 10) / 10;
        const n = await SB.bolakQosh(pid, skRang(qosh.rang), u, qosh.soni);
        return { pid, matn: `${n.navbatda ? "⏳" : "✓"} ${raqMatn(n.raqamlar)} · ${p.nom} · ${skRang(qosh.rang)} · ${smM(u)} sm — boʻlakka markerda yozing${n.navbatda ? " (internet kelganda serverga ketadi)" : ""}` };
      });
    }
    if (!r) return;
    qosh.profil = r.pid; qosh.yangiProfil = false; qosh.rang = skRang(qosh.rang); qosh.soni = 1;
    qosh.oxirgi = [r.matn, ...qosh.oxirgi].slice(0, 3);
    oynaChiz();
  }
  function butunPM(p, r, d) {
    if (!srv()) { if (amal((b) => skButun(b, p, r, d))) chiz(); return; }
    ishla((b) => skButun(b, p, r, d), () => SB.yoz("butun", { p_profil: p, p_rang: r, p_delta: d })).then((x) => { if (x) chiz(); });
  }
  async function firmaAmal(a) {
    const ism = el("skf-ism") ? el("skf-ism").value.trim() : "";
    if (!ism) { xabarMatn = "Ismingizni yozing"; chiz(); return; }
    const r = await ishla(null, async () => {
      if (a === "firma-yarat") {
        const nom = el("skf-nom").value.trim();
        if (!nom) throw new Error("Firma nomini yozing");
        await SB.rpc("firma_yarat", { p_nom: nom, p_telefon: "+" + ((SB.sessiya() || {}).tel || ""), p_shahar: el("skf-shahar").value.trim(), p_ism: ism });
      } else {
        const kod = el("skf-kod").value.replace(/[\s-]/g, "");
        if (kod.length !== 12) throw new Error("Kod 12 belgi");
        const j = await SB.rpc("taklif_ol", { p_kod: kod, p_ism: ism });
        if (j && j.xato) throw new Error(j.xato);
      }
      SB.tozala();
      await SB.torting();
      await SB.sinxron().catch(() => {});  // oxirida raqam bloki olinadi — keyin internetsiz ham qoʻshadi
      return SB.nusxa();
    }, async (e) => {  // javob yoʻqolgan yoki qayta bosilgan: server yozgan boʻlsa — muvaffaqiyat
      if (e.st && !/allaqachon firmadasiz|Kod notoʻgʻri/.test(e.message)) return null;
      try { SB.tozala(); const n = await SB.torting(); return n.firma ? n : null; } catch (x) { return null; }
    });
    if (r) { srvHolat = ""; xabarMatn = a === "firma-yarat" ? "✓ Firma ochildi" : "✓ Firmaga qoʻshildingiz"; seriya = null; chiz(); }
  }

  el("e-sklad").addEventListener("click", (e) => {
    const s = e.target.closest("[data-sk-s]");
    if (s) { seriya = s.dataset.skS; ozk("sk_seriya", seriya); rangF = ""; profF = ""; izla = ""; xabarMatn = ""; chiz(); return; }
    const pf = e.target.closest("[data-sk-pf]");
    if (pf) { profF = pf.dataset.skPf; chiz(); return; }
    const r = e.target.closest("[data-sk-r]");
    if (r) { rangF = r.dataset.skR; chiz(); return; }
    const t = e.target.closest("[data-sk]");
    if (!t) return;
    const a = t.dataset.sk;
    if (a === "seriya-bosh") {  // boʻsh firma: lokal sklad bor boʻlsa — tasdiq
      if (lokalSoni() && tasdiqB !== "seriya") { tasdiqB = "seriya"; chiz(); return; }
      tasdiqB = null; och({ t: "seriya" }); return;
    }
    if (a !== "kochir" && a !== "namuna") tasdiqB = null;
    if (a === "kochir") kochir();
    else if (a === "namuna") namuna();
    else if (a === "qosh") { qosh.oxirgi = []; och({ t: "qosh" }); }
    else if (a === "seriya") och({ t: "seriya" });
    else if (a === "seriya-t") och({ t: "seriya-t", id: t.dataset.id });
    else if (a === "profil") och({ t: "profil", id: t.dataset.id, rang: t.dataset.r || "" });
    else if (a === "bolak") och({ t: "bolak", n: Number(t.dataset.n) });
    else if (a === "butun") butunPM(t.dataset.p, t.dataset.r, Number(t.dataset.d));
    else if (a === "zaxira") zaxira();
    else if (a === "excel") excelYukla();
    else if (a === "tarix") tarixOch("");
    else if (a === "kirish") och({ t: "kirish", yangi: false });
    else if (a === "hisob") och({ t: "hisob" });
    else if (a === "ziddiyat") och({ t: "ziddiyat" });
    else if (a === "navbat") och({ t: "navbat" });
    else if (a === "yangila") { xabarMatn = ""; kutganiYangila(); }
    else if (a === "chiq") {
      if (SB.navbat().length && tasdiqB !== "chiq") { tasdiqB = "chiq"; xabarMatn = `${SB.navbat().length} ta amal serverga yetmagan — shu raqam bilan qayta kirsangiz yuboriladi. Yana bir bosing`; chiz(); return; }
      SB.chiq(); srvHolat = ""; xabarMatn = ""; tasdiqB = null; chiz();
    }
    else if (a === "firma-yarat" || a === "taklif-ol") firmaAmal(a);
  });
  // Javobsiz qolgan amal (internet uzilgan) — avval shu yuboriladi, keyin yangilanadi
  async function kutganiYangila() {
    await yangila();
    if (srv() && SB.ziddiyatlar().length && !oyna) och({ t: "ziddiyat" });
  }
  let qaytaChiz = false;  // yozish paytida qayta chizish — "S-" qoʻyilmaydi/olinmaydi (oʻchirgan boʻlsa qaytmasin)
  el("e-sklad").addEventListener("focusin", (e) => {
    if (qaytaChiz || e.target.id !== "sk-izla" || e.target.value) return;
    e.target.value = izla = "S-";
    setTimeout(() => { try { e.target.setSelectionRange(2, 2); } catch (x) {} }, 0);
  });
  el("e-sklad").addEventListener("focusout", (e) => {
    if (!qaytaChiz && e.target.id === "sk-izla" && /^\s*s-?\s*$/i.test(e.target.value)) { e.target.value = izla = ""; }
  });
  el("e-sklad").addEventListener("input", (e) => {
    if (e.target.id !== "sk-izla") return;
    izla = e.target.value;
    const poz = e.target.selectionStart;
    qaytaChiz = true;
    try { chiz(); const i = el("sk-izla"); i.focus(); try { i.setSelectionRange(poz, poz); } catch (x) {} }
    finally { qaytaChiz = false; }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-sk-fayl]")) {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      f.text().then((t) => {
        let b = null;
        try { b = JSON.parse(t); } catch (x) {}
        if (!skTekshir(b)) { skXato("Bu sklad zaxira fayli emas"); return; }
        tiklash = b; och({ t: "tiklash" });
      });
      return;
    }
    if (e.target.id === "skq-profil") {
      qosh.yangiProfil = e.target.value === "+";
      if (!qosh.yangiProfil) qosh.profil = e.target.value;
      qosh.rang = el("skq-rang").value;
      oynaChiz();
    }
  });
  async function kirishAmal() {
    const tel = el("skk-tel").value, parol = el("skk-parol").value;
    oyna.tel = tel;
    try { await SB.kirish(tel, parol, oyna.yangi); }
    catch (e) { oyna.xato = e.message; oynaChiz(); return; }
    yop(); seriya = null;
    await kutganiYangila();
  }
  // Navbat oʻzgarsa (fonda yuborildi, ziddiyat keldi) — ekran yangilanadi; ochiq oyna va terilayotgan maydon tegilmaydi
  if (typeof SB !== "undefined" && SB.kuzat) SB.kuzat(() => {
    if (!srv()) return;
    if (oyna) { if (oyna.t === "navbat") oynaChiz(); return; }
    const f = document.activeElement;
    if (f && f.tagName === "INPUT" && el("e-sklad").contains(f)) return;
    chiz();
  });
  let tarixKut = null;
  el("sk-parda").addEventListener("input", (e) => {
    if (e.target.id !== "skt-izla" || !oyna || oyna.t !== "tarix") return;
    oyna.izla = e.target.value;
    clearTimeout(tarixKut); tarixKut = setTimeout(() => tarixYukla(true), 400);
  });
  el("sk-parda").addEventListener("click", (e) => {
    if (e.target === el("sk-parda")) { yop(); return; }
    const t = e.target.closest("[data-q]");
    if (!t) return;
    const a = t.dataset.q;
    if (a === "yop") yop();
    else if (a === "tkun") { oyna.kun = t.dataset.v; oyna.izla = el("skt-izla").value; el("sk-oyna").querySelectorAll("[data-q=tkun]").forEach((x) => x.classList.toggle("faol", x === t)); tarixYukla(true); }
    else if (a === "tyana") tarixYukla(false);
    else if (a === "texcel") tarixExcel();
    else if (a === "btarix") tarixOch("S-" + oyna.n);
    else if (a === "tqaytar") {
      const T = oyna, id = t.dataset.id, n = t.dataset.n;
      t.disabled = true;
      SB.yoz("bolak_qaytar", { p_id: id }).then((r) => { xabarMatn = `${r.navbatda ? "⏳" : "✓"} S-${n} qaytarildi`; if (oyna === T) tarixYukla(true); },
        (e) => { if (oyna === T) { T.xato = e.message; tarixYangila(); } });
    }
    else if (a === "hal") {
      if (oyna.band) return;  // oldingi tanlov hali yuborilmoqda
      oyna.band = true;
      SB.hal(t.dataset.op, t.dataset.v).catch((x) => { xabarMatn = x.message; }).finally(() => {
        if (oyna) oyna.band = false;
        if (SB.ziddiyatlar().length) oynaChiz(); else { xabarMatn = xabarMatn || "✓ Ziddiyatlar hal qilindi"; yop(); }
      });
    }
    else if (a === "yubor") SB.sinxron().finally(() => { if (oyna && oyna.t === "navbat") oynaChiz(); });
    else if (a === "yb-fayl") faylSaqla(`Yuborilmagan_${skBugun()}.json`, SB.yuborilmadi());
    else if (a === "yb-tozala") { if (tasdiq !== "yb-tozala") { tasdiq = "yb-tozala"; oynaChiz(); } else { SB.yuborilmadiTozala(); tasdiq = null; oynaChiz(); } }
    else if (a === "boshqa-fayl") faylSaqla(`Boshqa_hisob_navbati_${skBugun()}.json`, SB.boshqaNavbat());
    else if (a === "tur") { qosh.tur = t.dataset.v; qosh.rang = el("skq-rang").value; oynaChiz(); }
    else if (a === "rang") { qosh.rang = t.dataset.v; el("skq-rang").value = qosh.rang; el("sk-oyna").querySelectorAll("[data-q=rang]").forEach((x) => x.classList.toggle("faol", x === t)); }
    else if (a === "soni") { const i = el("skq-soni"); i.value = Math.max(1, (Number(i.value) || 1) + Number(t.dataset.v)); }
    else if (a === "saqla") qoshSaqla();
    else if (a === "bsaqla") {
      const n = oyna.n, rang = el("skb-rang").value, sm = el("skb-sm").value, profil = el("skb-profil") ? el("skb-profil").value : undefined;
      if (!srv()) { if (amal((b) => skBolakTahrir(b, n, { rang, sm, profil }))) { xabarMatn = `✓ S-${n} saqlandi`; yop(); } return; }
      const x = baza().bolaklar.find((q) => q.raqam === n);
      // p_profil faqat oʻzgarganda (0003 qoʻllanmagan serverda oddiy tahrir ishlayversin)
      ishla((b) => skBolakTahrir(b, n, { rang, sm, profil }), () => SB.yoz("bolak_tahrir",
        { p_id: x.id, p_versiya: x.versiya, p_sm: Math.round(Number(String(sm).replace(",", ".")) * 10) / 10, p_rang: skRang(rang), ...(profil && profil !== x.profil ? { p_profil: profil } : {}) }))
        .then((r) => { if (r) { xabarMatn = `${r.navbatda ? "⏳" : "✓"} S-${n} saqlandi`; yop(); } });
    }
    else if (a === "ochir") {
      if (tasdiq !== "ochir") { tasdiq = "ochir"; oynaChiz(); return; }
      const n = oyna.n;
      if (!srv()) { if (amal((b) => skBolakOchir(b, n))) { xabarMatn = `✓ S-${n} oʻchirildi`; yop(); } return; }
      const x = baza().bolaklar.find((q) => q.raqam === n);
      ishla(null, () => SB.yoz("bolak_ochir", { p_id: x.id, p_versiya: x.versiya })).then((r) => {
        if (r) { xabarMatn = `${r.navbatda ? "⏳" : "✓"} S-${n} oʻchirildi`; yop(); }
      });
    }
    else if (a === "psaqla") {
      const id = oyna.id, nom = el("skp-nom").value, narx = el("skp-narx").value, eskiR = oyna.rang || "";
      const yangiR = el("skp-rang") ? skRang(el("skp-rang").value) : eskiR, rangOz = !!eskiR && yangiR !== eskiR;
      const p = skProfil(baza() || skBoshBaza(), id);
      if (!p) { yop(); return; }
      const pOz = skNom(nom) !== p.nom || sonV(narx) !== (p.narx ?? null);
      // avval rang (ziddiyatsiz), keyin nom/narx — nom ziddiyatga tushsa ham rang oʻtgan boʻladi
      const lokal = (b) => { const g = rangOz ? skGuruhRang(b, id, eskiR, yangiR) : null; if (pOz || !rangOz) skProfilTahrir(b, id, nom, narx); return g; };
      const xab = (g, nav) => { if (g && rangF === eskiR) rangF = yangiR; if (g) xabarMatn = `${nav ? "⏳" : "✓"} ${h(skNom(nom))}: ${g.bolak} boʻlak${g.butun ? `, ${g.butun} butun` : ""} — ${h(eskiR)} → ${h(yangiR)}`; };
      if (!srv()) { const r = amal(lokal); if (r) { xab(r === true ? null : r); yop(); } return; }
      const sinov = { g: null };
      ishla((b) => { sinov.g = lokal(b); }, async () => {
        let r = null;
        if (rangOz) r = await SB.yoz("guruh_rang", { p_profil: id, p_eski: eskiR, p_yangi: yangiR });
        if (pOz || !rangOz) r = await SB.yoz("profil_tahrir", { p_id: id, p_versiya: p.versiya, p_nom: skNom(nom), p_narx: sonV(narx), p_kod: p.kod || "" });
        return r;
      }).then((r) => { if (r) { xab(sinov.g, r.navbatda); yop(); } });
    }
    else if (a === "ssaqla") {
      const nom = el("sks-nom").value, hv = String(el("sks-h").value).replace(",", ".");
      if (!srv()) {
        const s = amal((b) => skSeriyaQosh(b, nom, hv));
        if (s) { seriya = s.id; ozk("sk_seriya", seriya); xabarMatn = `✓ ${h(s.nom)} seriyasi qoʻshildi — endi profil va boʻlak qoʻshing`; yop(); }
        return;
      }
      const id = crypto.randomUUID();
      ishla((b) => skSeriyaQosh(b, nom, hv), () => SB.yoz("seriya_qosh", { p_id: id, p_nom: skNom(nom), p_hivich: Number(hv) })).then((r) => {
        if (r) { seriya = id; ozk("sk_seriya", seriya); xabarMatn = `${r.navbatda ? "⏳" : "✓"} ${h(skNom(nom))} seriyasi qoʻshildi — endi profil va boʻlak qoʻshing`; yop(); }
      });
    }
    else if (a === "stsaqla") {
      const v = Number(String(el("sks-h").value).replace(",", "."));
      const tek = (b) => {
        const s = skSeriya(b, oyna.id);
        if (!(v > 0 && v <= 1200)) throw new Error("Hivich uzunligi 1–1200 sm");
        const uzun = b.bolaklar.some((x) => (skProfil(b, x.profil) || {}).seriya === s.id && x.sm > v);
        if (uzun) throw new Error("Bu seriyada hivichdan uzun boʻlak bor");
        return s;
      };
      if (!srv()) { if (amal((b) => { const s = tek(b); skJurnal(b, "seriya_tahrir", { seriya: s.id, eski: s.hivich_sm, yangi: v }); s.hivich_sm = v; })) yop(); return; }
      const s = skSeriya(baza(), oyna.id);
      ishla(tek, () => SB.yoz("seriya_tahrir", { p_id: s.id, p_versiya: s.versiya, p_nom: s.nom, p_hivich: v })).then((r) => { if (r) yop(); });
    }
    else if (a === "tiklash") {
      if (srv()) return;
      if (!saqlaB(skTiklash(baza(), tiklash))) return;
      xabarMatn = `✓ Zaxiradan tiklandi: ${tiklash.bolaklar.length} boʻlak`;
      seriya = null; yop();
    }
    else if (a === "krejim") { oyna.yangi = !!t.dataset.v; oyna.tel = el("skk-tel").value; oyna.xato = ""; oynaChiz(); }
    else if (a === "kirish") kirishAmal();
    else if (a === "taklif") {
      const rol = t.dataset.v;
      ishla(null, () => SB.rpc("taklif_ber", { p_rol: rol })).then((k) => { if (k) { oyna.kod = String(k).replace(/(.{4})(?=.)/g, "$1-"); oyna.kodRol = rol; oynaChiz(); } });
    }
    else if (a === "azo") {
      ishla(null, async () => { await SB.rpc("azo_ozgartir", { p_user: t.dataset.u, p_faol: !!t.dataset.f, p_rol: t.dataset.r }); return SB.torting(); })
        .then((r) => { if (r) oynaChiz(); });
    }
    else if (a === "chiq") {
      if (tasdiq !== "chiq" && tasdiq !== "chiq2") { tasdiq = "chiq"; oynaChiz(); return; }
      if (tasdiq === "chiq" && SB.navbat().length) {  // yuborilmagan amal — avval yuborishga urinish
        SB.sinxron().then(() => { if (SB.navbat().length) { tasdiq = "chiq2"; oynaChiz(); } else { SB.chiq(); srvHolat = ""; xabarMatn = ""; yop(); } },
          () => { tasdiq = "chiq2"; oynaChiz(); });
        return;
      }
      SB.chiq(); srvHolat = ""; xabarMatn = ""; yop();
    }
  });
  el("sk-oyna").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && oyna && oyna.t === "qosh" && e.target.tagName === "INPUT") { e.preventDefault(); qoshSaqla(); }
    if (e.key === "Enter" && oyna && oyna.t === "kirish" && e.target.tagName === "INPUT") { e.preventDefault(); kirishAmal(); }
  });

  window.skladChiz = () => {
    xabarMatn = ""; izla = ""; tasdiqB = null; chiz();
    if (srv()) kutganiYangila();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}  // brauzer oʻzi oʻchirmasin
  };
  window.skladBaza = baza;
})();
