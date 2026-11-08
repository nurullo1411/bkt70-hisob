// 2D konstruktor (Romchi uslubida): tepada asboblar, asbobni tanlab boʻlakka bosiladi,
// oʻlcham chiziqlari rasm atrofida, raqamga bosib oʻzgartiriladi. Natija — zakaz JSON (hisob.py formati).
// Daraxt: bolak = gluxoy | tabaqa (dvaynoy) | eshik | bolinish (yonalish, olchamlar, bolaklar).
// Faqat chizish uchun kalitlar: petlya_tomoni, aktiv (hisobga taʼsir qilmaydi).
"use strict";

const RANGLAR = ["Laminatsiya", "Svetnoy (kraska)", "Oq", "Anod"];
const ESHIK_RUCHKA = ["Komfort dver ruchka", "Stublina 1177", "Stublina 1177 (Uz)", "Ruchka Dver (1076.92.28) (Qora)"];
const ZAMOKLAR = ["Zamok Dver (3147) (Otvetka) (Tr)", "TERMO Zamok Dvernoy GIESSE", "Stublina Serbia"];
const PETLYALAR = ["(A8060) 2SK TERMO Petlya (Tr)", "(A8060) 2SK TERMO Petlya (Uz)"];  // A9211.3 — rom petlyasi, eshikka emas

const nusxa = (x) => JSON.parse(JSON.stringify(x));
let tahrir = null;      // tahrirlanayotgan konstruksiya (nusxa)
let tahrirIndeks = -1;  // zakazdagi oʻrni, yangi boʻlsa -1
let tanlangan = "";     // tanlangan boʻlak yoʻli: "" ildiz, "1.0" ...
let bolim = "impost";   // asboblar boʻlimi
let asbob = null;       // tanlangan asbob yoki null (tanlash rejimi)
let eshikOchilish = "ichkariga";
// Konstruksiyadagi hamma eshik (ochilishi ⚙ dagi eshik profilidan: Balkon Qanot — ichkariga, Balkon Oʻrta — tashqariga)
function eshiklar(n, r = []) {
  if (!n) return r;
  if (n.tur === "eshik") r.push(n);
  for (const c of n.bolaklar || []) eshiklar(c, r);
  return r;
}
function joriyOchilish(k) { const e = eshiklar(k && k.bolak)[0]; return e ? e.ochilish : (k && k.tur === "lapshali" ? "tashqariga" : eshikOchilish); }
let orqaga = [], oldinga = [];
let oldindanTaymer = null;

function oynaTurlari() {
  try { return Object.keys(JSON.parse(ol("narxlar")).steklopaket_som || {}); } catch (e) { return ["Oq+oq"]; }
}

function yangiZakaz() {
  return {
    nom: "Yangi zakaz",
    umumiy: {
      rama: "F702", oyna_qalinligi: 24,
      tanlov: { rang: "Laminatsiya", oyna_turi: "Oq+oq", ruchka: ESHIK_RUCHKA[0], zamok: ZAMOKLAR[0], montaj: false },
    },
    konstruksiyalar: [],
  };
}

// ---------- daraxt ----------
const yolQism = (p) => (p === "" ? [] : p.split(".").map(Number));
const bolaYoli = (p, i) => (p === "" ? String(i) : p + "." + i);
function tugun(ildiz, p) { let b = ildiz; for (const i of yolQism(p)) b = b.bolaklar[i]; return b; }
function ota(p) { const q = yolQism(p); return q.length ? { yol: q.slice(0, -1).join("."), i: q[q.length - 1] } : null; }
function almashtir(p, yangi) {
  if (p === "") { tahrir.bolak = yangi; return; }
  const o = ota(p);
  tugun(tahrir.bolak, o.yol).bolaklar[o.i] = yangi;
}
const yaxlit = (x) => Math.round(x * 10) / 10;

// Boʻlakni n qismga boʻladi. Ota xuddi shu yoʻnalishda boʻlsa, unga qoʻshiladi.
function bolish(p, yonalish, n = 2) {
  const b = tugun(tahrir.bolak, p);
  const o = ota(p);
  const otaB = o ? tugun(tahrir.bolak, o.yol) : null;
  if (otaB && otaB.tur === "bolinish" && otaB.yonalish === yonalish && !otaB.egilgan) {
    for (let j = 1; j < n; j++) { otaB.bolaklar.splice(o.i + j, 0, { tur: "gluxoy" }); otaB.olchamlar.splice(o.i + j, 0, null); }
    // bu boʻlakning oʻlchami berilgan boʻlsa, yangilari bilan teng boʻlishsin
    if (otaB.olchamlar[o.i] != null && otaB.olchamlar.filter((x) => x != null).length > 1) otaB.olchamlar[o.i] = null;
    else if (otaB.olchamlar[o.i] != null) otaB.olchamlar[o.i] = yaxlit(otaB.olchamlar[o.i] / n);
    return;
  }
  // Yangi boʻlinish: hisob.py kamida bitta oʻlcham talab qiladi — birinchisiga teng ulush yoziladi
  const [w, h] = olchamTaxmin(p);
  const ulush = yaxlit((yonalish === "vertikal" ? w : h) / n);
  const bolalar = [b, ...Array.from({ length: n - 1 }, () => ({ tur: "gluxoy" }))];
  almashtir(p, { tur: "bolinish", yonalish, olchamlar: [ulush, ...Array(n - 1).fill(null)], bolaklar: bolalar });
}

function ochir(p) {
  const o = ota(p);
  if (!o) return false;
  const otaB = tugun(tahrir.bolak, o.yol);
  if (otaB.tur === "portal") { almashtir(o.yol, otaB.bolaklar[1]); tanlangan = o.yol; return true; }
  const [w, h] = olchamTaxmin(o.yol);
  otaB.bolaklar.splice(o.i, 1);
  otaB.olchamlar.splice(o.i, 1);
  if (otaB.bolaklar.length === 1) { almashtir(o.yol, otaB.bolaklar[0]); tanlangan = o.yol; return true; }
  if (otaB.olchamlar.every((x) => x == null)) otaB.olchamlar[0] = yaxlit((otaB.yonalish === "vertikal" ? w : h) / otaB.olchamlar.length);
  else if (otaB.olchamlar.every((x) => x != null)) otaB.olchamlar[otaB.olchamlar.length - 1] = null;
  tanlangan = bolaYoli(o.yol, Math.max(0, o.i - 1));
  return true;
}

// ---------- geometriya (faqat chizish uchun, taxminiy) ----------
function taqsimla(olchamlar, jami) {
  const berilgan = olchamlar.filter((x) => x != null).reduce((a, b) => a + Number(b), 0);
  const boshlar = olchamlar.filter((x) => x == null).length;
  const ulush = boshlar ? (jami - berilgan) / boshlar : 0;
  return olchamlar.map((x) => (x == null ? ulush : Number(x)));
}

function ramalar(k) {
  const L = Number(k.L) || 0;
  if (k.tur !== "lapshali") return [{ x: 0, w: L, asosiy: true }];
  const chap = Number(k.chap) || 0, ong = Number(k.ong) || 0;
  const r = [];
  let x = 0;
  if (chap) { r.push({ x: 0, w: chap }); x = chap + 0.5; }
  const eshikW = L - chap - ong - (chap ? 0.5 : 0) - (ong ? 0.5 : 0);
  r.push({ x, w: eshikW, asosiy: true });
  if (ong) r.push({ x: x + eshikW + 0.5, w: ong });
  return r;
}

// ---------- yoylar: rama arkasi va egilgan impost (foydalanuvchi, 2026-11-06) ----------
// Yoy: {cx, R, y0 (choʻqqi), c (chuqurlik), rama}. y oʻqi pastga. ich > 0 — ostidagi, < 0 — ustidagi konsentrik yoy.
function yoyYasa(cx, en, c, y0, rama = false) { return { cx, R: (en * en / 4 + c * c) / (2 * c), y0, c, rama }; }
function yoyY(yo, x, ich = 0) { const r = yo.R - ich; return yo.y0 + yo.R - Math.sqrt(Math.max(0, r * r - (x - yo.cx) ** 2)); }
function yoyChuqurligi(yo, x1, x2) {
  if (!yo) return 0;
  return Math.max(yoyY(yo, x1), yoyY(yo, x2)) - yoyY(yo, Math.min(Math.max(yo.cx, x1), x2));
}
// Egilgan impost chuqurligi: berilmasa tepadagi yoyga parallel (hisob.py bilan bir xil qoida)
function egilganChuqurlik(b, x, w, tY) {
  const eg = b.egilgan || {};
  const c = eg.chuqurlik != null ? Number(eg.chuqurlik) : tY ? yoyChuqurligi(tY, x, x + w) : w * 0.2;
  return Math.max(0.1, Math.min(c, w / 2));
}

// Barglar (boʻlaklar), impostlar va boʻlinishlar (oʻlcham zanjiri uchun). tY / pY — boʻlak tepasi / pasti yoy boʻlsa.
// Portal yon ustunlari: berilmasa uch teng, bittasi berilsa ikkinchisi unga teng (hisob.py bilan bir xil)
function portalEnlar(b, w) {
  const c = b.chap ?? b.ong, o = b.ong ?? c;
  return [c != null ? Number(c) : w / 3, o != null ? Number(o) : w / 3];
}

function joyla(b, x, y, w, h, p, g, chuqur = 0, tY = null, pY = null) {
  if (b.tur === "portal") {
    // Portal (foydalanuvchi, 2026-11-06): arkali oʻrta, atrofida U oyna, yon ustunlar pastida yotiq impost
    const [chap, ong] = portalEnlar(b, w), tepa = Number(b.tepa);
    const orta = Math.max(1, w - chap - ong);
    const c = Math.max(0.1, Math.min(b.chuqurlik != null ? Number(b.chuqurlik) : orta / 2, orta / 2));
    const xa = x + chap, xb = x + w - ong, ys = y + tepa + c;
    const yo = yoyYasa(xa + orta / 2, orta, c, y + tepa);
    const yl = b.chap_boy != null ? y + Number(b.chap_boy) : null, yr = b.ong_boy != null ? y + Number(b.ong_boy) : null;
    g.portallar.push({ p, x, y, w, h, xa, xb, tepa, c, ys, yl, yr, parallel: b.chuqurlik == null, chapAvto: b.chap == null, ongAvto: b.ong == null, b });
    g.impostlar.push({ portalTik: true, x: xa, y1: ys, y2: y + h }, { portalTik: true, x: xb, y1: ys, y2: y + h });
    g.impostlar.push({ yoy: yo, x1: xa, x2: xb });
    if (yl != null) g.impostlar.push({ x1: x, y1: yl, x2: xa, y2: yl });
    if (yr != null) g.impostlar.push({ x1: xb, y1: yr, x2: x + w, y2: yr });
    const ul = yl ?? y + h, ur = yr ?? y + h;
    const u = { xa, xb, yo, ys, ul, ur, ux: x, uw: w, tY };
    if (b.tepa_impost !== false) {
      // tepada tik impost: ramadan arka choʻqqisigacha, U oyna ikkiga boʻlinadi
      const cx = xa + orta / 2;
      g.impostlar.push({ portalTepa: true, x: cx, y1: tY ? Math.max(y, yoyY(tY, cx)) : y, y2: y + tepa });
      g.barglar.push({ b: b.bolaklar[0], x, y, w: cx - x, h: ul - y, p: bolaYoli(p, 0), tY, u: { ...u, yarim: "chap", cx } });
      g.barglar.push({ b: b.bolaklar[0], x: cx, y, w: x + w - cx, h: ur - y, p: bolaYoli(p, 0), tY, u: { ...u, yarim: "ong", cx } });
    } else g.barglar.push({ b: b.bolaklar[0], x, y, w, h: Math.max(ul, ur) - y, p: bolaYoli(p, 0), tY, u });
    joyla(b.bolaklar[1], xa, y + tepa, orta, h - tepa, bolaYoli(p, 1), g, chuqur + 1, yo, pY);
    if (yl != null && b.bolaklar[2]) joyla(b.bolaklar[2], x, yl, chap, y + h - yl, bolaYoli(p, 2), g, chuqur + 1, null, pY);
    if (yr != null && b.bolaklar[3]) joyla(b.bolaklar[3], xb, yr, ong, y + h - yr, bolaYoli(p, 3), g, chuqur + 1, null, pY);
    return;
  }
  if (b.tur === "bolinish") {
    const v = b.yonalish === "vertikal";
    const s = taqsimla(b.olchamlar, v ? w : h);
    if (!v && b.egilgan && b.bolaklar.length === 2) {
      // egilgan impost: olchamlar[0] — tepadan choʻqqigacha; tepadagi boʻlak impost uchlarigacha
      const c = egilganChuqurlik(b, x, w, tY);
      const yo = yoyYasa(x + w / 2, w, c, y + s[0]);
      g.bolinishlar.push({ p, v, x, y, w, h, s, olchamlar: b.olchamlar, chuqur, egilgan: c, parallel: b.egilgan.chuqurlik == null, tY });
      g.impostlar.push({ yoy: yo, x1: x, x2: x + w, tY, pY });
      joyla(b.bolaklar[0], x, y, w, s[0] + c, bolaYoli(p, 0), g, chuqur + 1, tY, yo);
      joyla(b.bolaklar[1], x, y + s[0], w, h - s[0], bolaYoli(p, 1), g, chuqur + 1, yo, pY);
      return;
    }
    g.bolinishlar.push({ p, v, x, y, w, h, s, olchamlar: b.olchamlar, chuqur, tY });
    let q = v ? x : y;
    const oxiri = s.length - 1;
    s.forEach((o, i) => {
      if (i > 0) g.impostlar.push(v ? { x1: q, y1: y, x2: q, y2: y + h, tY, pY } : { x1: x, y1: q, x2: x + w, y2: q, tY, pY });
      if (v) joyla(b.bolaklar[i], q, y, o, h, bolaYoli(p, i), g, chuqur + 1, tY, pY);
      else joyla(b.bolaklar[i], x, q, w, o, bolaYoli(p, i), g, chuqur + 1, i === 0 ? tY : null, i === oxiri ? pY : null);
      q += o;
    });
  } else g.barglar.push({ b, x, y, w, h, p, tY, pY });
}

function geometriya(k) {
  const g = { barglar: [], impostlar: [], bolinishlar: [], portallar: [], ramalar: ramalar(k), ark: arkaGeom(k) };
  const a = g.ramalar.find((r) => r.asosiy);
  joyla(k.bolak, a.x, 0, a.w, Number(k.H) || 0, "", g, 0, g.ark, null);
  return g;
}

function olchamTaxmin(p) {
  const g = geometriya(tahrir);
  const bor = g.barglar.find((o) => o.p === p) || g.bolinishlar.find((o) => o.p === p) || g.portallar.find((o) => o.p === p);
  return bor ? [bor.w, bor.h] : [Number(tahrir.L), Number(tahrir.H)];
}

// F1, C1, E1 belgilari (chapdan oʻngga, tepadan pastga)
function belgilar(barglar) {
  const sanoq = { F: 0, C: 0, E: 0 };
  const tartib = [...barglar].sort((a, b) => (Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x));
  const nat = {};
  for (const o of tartib) {
    const h = o.b.tur === "gluxoy" ? "F" : o.b.tur === "eshik" ? "E" : "C";
    nat[o.p] = h + ++sanoq[h];
  }
  return nat;
}

// ---------- arka (foydalanuvchi, 2026-11-06; WinPro kabi) ----------
// k.arka = {balandlik: a}: tepasi aylana yoyi, a — yoy balandligi (yon devor tepasidan choʻqqigacha), sm.
// H — umumiy boʻy (choʻqqigacha). a = L/2 — yarim doira. Lapshali vitrajda arka yoʻq.
function arkaGeom(k) {
  if (!k || !k.arka || k.tur === "lapshali") return null;
  const L = Number(k.L) || 0, H = Number(k.H) || 0;
  const a = Math.min(Number(k.arka.balandlik) || 0, L / 2, H);
  if (!(a > 0) || !(L > 0)) return null;
  return { ...yoyYasa(L / 2, L, a, 0, true), a };
}

// ---------- rang: profil rom rangida, oyna oʻz turida (foydalanuvchi, 2026-11-07) ----------
// Chizmaga qarab profil va oyna rangini tez anglash uchun
function aralash(hex, bilan, p) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(bilan.slice(1), 16);
  const k = (x, y) => Math.round(x + (y - x) * p);
  const r = k(a >> 16, b >> 16), g = k((a >> 8) & 255, (b >> 8) & 255), bl = k(a & 255, b & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function umumiyTanlov() { return (typeof zakaz !== "undefined" && zakaz && zakaz.umumiy && zakaz.umumiy.tanlov) || {}; }
// Profil rangi (hex) yoki null — oq (standart och rang qoladi)
function profilRangi(k) {
  const t = { ...umumiyTanlov(), ...(k.tanlov || {}) };
  const turkum = RANG_TURKUMLARI.find((r) => r[0] === t.rang);
  if (!turkum) return null;
  const r = turkum[2].find((x) => x[0] === t.rang_nomi) || turkum[2][0];
  return r[0] === "oq" ? null : r[2];
}
// Oyna turi boʻyicha gradient (boshi, oxiri, chiziq); oddiy oq oyna — null (standart koʻk)
function oynaTuslari(nom) {
  const n = String(nom || "").toLowerCase();
  if (n.includes("qora")) return ["#79828c", "#2c3137", "#22262b"];
  if (n.includes("koʻzgu") || n.includes("kozgu")) return ["#f4f7f9", "#9eabb6", "#6d7a85"];
  if (n.includes("yod")) return ["#f6d9a6", "#c8893c", "#9a6526"];
  return null;
}
// Boʻlakning oyna turi: oʻzida yoki eng yaqin ota boʻlakda, boʻlmasa konstruksiyaniki
function bargOynaTuri(k, p) {
  let ot = (k.tanlov && k.tanlov.oyna_turi) || umumiyTanlov().oyna_turi || "";
  let n = k.bolak;
  if (n && n.oyna_turi) ot = n.oyna_turi;
  for (const i of yolQism(p)) {
    n = n && n.bolaklar ? n.bolaklar[i] : null;
    if (n && n.oyna_turi) ot = n.oyna_turi;
  }
  return ot;
}

// ---------- SVG ----------
let svgSanoq = 0;  // har chizmaga alohida gradient id (yashirin chizmadagi gradient boshqasida ishlamaydi)
function chizmaSVG(k, opts = {}) {
  const gid = "g" + ++svgSanoq;
  const L = Number(k.L) || 1, H = Number(k.H) || 1;
  const M = Math.max(L, H);
  const t = Math.max(2.5, Math.min(7, Math.min(L, H) * 0.045));
  const g = geometriya(k);
  // oyna turlari: har turga oʻz gradienti; gul — ustidan naqsh
  const turlar = [...new Set(g.barglar.map((o) => bargOynaTuri(k, o.p)))];
  const oynaGradlar = turlar.map((tur, i) => {
    const tus = oynaTuslari(tur);
    return tus ? `<linearGradient id="${gid}-oy${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tus[0]}"/><stop offset="1" stop-color="${tus[1]}"/></linearGradient>` : "";
  }).join("");
  let oynaUslub = "", oynaGul = false;
  const oynaTanla = (p) => {
    const tur = bargOynaTuri(k, p), i = turlar.indexOf(tur), tus = oynaTuslari(tur);
    oynaUslub = tus ? `style="fill:url(#${gid}-oy${i});stroke:${tus[2]}"` : "";
    oynaGul = String(tur).toLowerCase().includes("gul");
  };
  // profil rom rangida (oq — standart)
  const pr = profilRangi(k);
  const prUslub = pr ? `;--rama-1:${aralash(pr, "#ffffff", 0.3)};--rama-2:${aralash(pr, "#000000", 0.12)};--rama-chiziq:${aralash(pr, "#000000", 0.5)}` : "";
  const ark = g.ark;
  const shrift = M * 0.04;
  const qadam = M * 0.085;  // oʻlcham qatorlari orasidagi masofa
  const f = (v) => Math.round(v * 100) / 100;
  let s = "";
  const rect = (x, y, w, h, cls, qosh = "") => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}" class="${cls}" ${qosh}/>`;
  const chiziq = (x1, y1, x2, y2, cls = "ch") => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}"/>`;
  const matn = (x, y, m, kat = 1, cls = "yoz", qosh = "") => `<text x="${f(x)}" y="${f(y)}" font-size="${f(shrift * kat)}" class="${cls}" text-anchor="middle" dominant-baseline="central" ${qosh}>${esc(m)}</text>`;

  // Yoy chegaralari: tepa — tY dan dT ichkarida, past — pY dan dB yuqorida (konsentrik). Yoʻq boʻlsa toʻgʻri chiziq.
  const tepaY = (tY, xx, y0, d) => (tY ? Math.max(y0, yoyY(tY, xx, d)) : y0);
  const pastY = (pY, xx, y1, d) => (pY ? Math.min(y1, yoyY(pY, xx, -d)) : y1);
  // Toʻrtburchak, yoylar bilan kesilgan qismi (dT, dB — yoydan ichkariga masofa)
  function shakl(x, y, w, h, dT, tY = null, pY = null, dB = dT) {
    w = Math.max(0, w); h = Math.max(0, h);
    if (!tY && !pY) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
    const n = Math.max(16, Math.ceil((w / L) * 128));
    const yt = (xx) => tepaY(tY, xx, y, dT), yb = (xx) => pastY(pY, xx, y + h, dB);
    let p = "";
    // chetlarda zichroq nuqta: tik yoy (yarim aylana burchagi) siniq chiqmasin
    const nx = (j) => x + (w * (1 - Math.cos((Math.PI * j) / n))) / 2;
    for (let j = 0; j <= n; j++) { const xx = nx(j); p += (j ? "L" : "M") + f(xx) + " " + f(Math.min(yt(xx), yb(xx))); }
    for (let j = n; j >= 0; j--) { const xx = nx(j); p += "L" + f(xx) + " " + f(Math.max(yt(xx), yb(xx))); }
    return p + "Z";
  }
  const yuza = (x, y, w, h, d, cls, qosh = "", tY = null, pY = null, dB = d) => `<path d="${shakl(x, y, w, h, d, tY, pY, dB)}" class="${cls}" ${qosh}/>`;

  // Portal U oynasi: tashqi chetdan, impost oʻqlaridan va arka oʻqidan d ichkarida
  function uYol(o, d) {
    const { xa, xb, yo, ys, yarim, cx, tY, eL = 0, eR = 0, eT = 0, eBL = 0, eBR = 0 } = o.u;
    const x = o.u.ux + eL, w = o.u.uw - eL - eR, ul = o.u.ul - eBL, ur = o.u.ur - eBR;
    const y = o.y + eT, n = 40;
    const yoyB = (x1, x2) => { let q = ""; for (let j = 0; j <= n; j++) { const xx = x1 + ((x2 - x1) * j) / n; q += `L${f(xx)} ${f(yoyY(yo, xx, -d))}`; } return q; };
    // tepa cheti: toʻgʻri yoki rama arkasi boʻylab (x1 dan x2 gacha)
    const tepaB = (x1, x2, bosh) => {
      if (!tY) return `${bosh ? "M" : "L"}${f(x1)} ${f(y + d)}L${f(x2)} ${f(y + d)}`;
      let q = ""; for (let j = 0; j <= n; j++) { const xx = x1 + ((x2 - x1) * j) / n; q += `${bosh && !j ? "M" : "L"}${f(xx)} ${f(tepaY(tY, xx, y, d + eT))}`; } return q;
    };
    if (yarim === "chap")
      return tepaB(x + d, cx - d, true) + yoyB(cx - d, xa) + `L${f(xa - d)} ${f(ys)}L${f(xa - d)} ${f(ul - d)}L${f(x + d)} ${f(ul - d)}Z`;
    if (yarim === "ong")
      return tepaB(cx + d, x + w - d, true) + `L${f(x + w - d)} ${f(ur - d)}L${f(xb + d)} ${f(ur - d)}L${f(xb + d)} ${f(ys)}` + yoyB(xb, cx + d) + "Z";
    const q = tepaB(x + d, x + w - d, true) + `L${f(x + w - d)} ${f(ur - d)}L${f(xb + d)} ${f(ur - d)}L${f(xb + d)} ${f(ys)}`;
    return q + yoyB(xb, xa) + `L${f(xa - d)} ${f(ys)}L${f(xa - d)} ${f(ul - d)}L${f(x + d)} ${f(ul - d)}Z`;
  }

  // Oyna: gradient va ikkita yaltiroq chiziq (faqat katta chizmada)
  function oyna(x, y, w, h, d, tY = null, pY = null) {
    const sh = opts.kichik ? 0 : t * 0.22;
    let q = sh ? yuza(x - sh, y - sh, w + 2 * sh, h + 2 * sh, d - sh, "sht", "", tY, pY) : "";
    q += yuza(x, y, w, h, d, "oy", oynaUslub, tY, pY);
    if (oynaGul) q += yuza(x, y, w, h, d, "gul", `style="fill:url(#${gid}-gul)"`, tY, pY);
    if (!opts.kichik && w > t * 3 && h > t * 3) {
      const yt = tepaY(tY, x + w * 0.5, y, d), yb = pastY(pY, x + w * 0.5, y + h, d);
      const hh = yb - yt;
      for (const [k1, k2] of [[0.18, 0.5], [0.3, 0.58]]) {
        q += chiziq(x + w * (k2 - 0.05), yt + hh * (k1 + 0.06), x + w * (k1 - 0.06), yt + hh * (k2 - 0.02), "nur");
      }
    }
    return q;
  }

  // d0 — boʻlak katagi chetidan tabaqa chetigacha masofa (arka chegarasi uchun)
  function tabaqa(x, y, w, h, petlya, dvaynoy, ruchkaBor, fortochka, d0, tY = null, pY = null, eshik = false) {
    // tabaqa rama/impost ichki chetidan kattaroq — ustiga kirib turadi (foydalanuvchi, 2026-11-08)
    // eshik tabaqasi (Balkon Oʻrta V707 / Qanot V708) rom tabaqasidan (V702) kengroq (foydalanuvchi, 2026-11-08)
    const i = -t * 0.15, ic = i + t * (eshik ? 1.3 : 0.8);
    let q = yuza(x + i, y + i, w - 2 * i, h - 2 * i, d0 + i, "tb", "", tY, pY) + oyna(x + ic, y + ic, w - 2 * ic, h - 2 * ic, d0 + ic, tY, pY);
    const x1 = x + ic, x2 = x + w - ic, xo = (x1 + x2) / 2;
    const tepa = (xx) => tepaY(tY, xx, y + ic, d0 + ic);  // oyna tepasi shu nuqtada
    const past = (xx) => pastY(pY, xx, y + h - ic, d0 + ic);  // oyna pasti
    if (!opts.kichik) {
      const pt = (px, py, pw, ph) => rect(px, py, pw, ph, "pt", `rx="${f(Math.min(pw, ph) * 0.3)}"`);
      const a = t * 0.32, b = t * 1.5;  // petlya qalinligi va uzunligi
      const joylar = (n, u1, u2) => Array.from({ length: n }, (_, j) => u1 + ((u2 - u1) * (n === 1 ? 0.5 : 0.1 + (0.8 * j) / (n - 1))));
      if (fortochka) {
        const n = w > 100 ? 3 : 2, yy = petlya === "tepa" ? tepa(xo) - ic + i - a / 2 : past(xo) + ic - i - a / 2;
        for (const px of joylar(n, x1, x2)) q += pt(px - b / 2, yy, b, a);
      } else {
        const n = eshik ? (h > 260 ? 4 : 3) : h < 90 ? 2 : 3;
        const xx = petlya === "ong" ? x + w - i - a / 2 : x + i - a / 2, ex = petlya === "ong" ? x2 : x1;
        for (const py of joylar(n, tepa(ex), past(ex))) q += pt(xx, py - b / 2, a, b);
      }
    }
    const ru = (rx, ry, rw, rh) => rect(rx, ry, rw, rh, "ru", `rx="${f(Math.min(rw, rh) / 2)}"`);
    if (fortochka) {
      // uchburchak uchi ruchka (chit-chit) tomonida, petlya qarama-qarshi tomonda (foydalanuvchi, 2026-11-05)
      if (petlya === "tepa") {
        q += chiziq(x1, tepa(x1), xo, past(xo)) + chiziq(x2, tepa(x2), xo, past(xo));
        return q + ru(x + w / 2 - t * 0.9, past(xo) + t * 0.2, t * 1.8, t * 0.38);
      }
      q += chiziq(x1, past(x1), xo, tepa(xo)) + chiziq(x2, past(x2), xo, tepa(xo));
      return q + ru(x + w / 2 - t * 0.9, tepa(xo) - t * 0.6, t * 1.8, t * 0.38);
    }
    // uchburchak uchi ruchka tomonida, petlya qarama-qarshi tomonda (foydalanuvchi, 2026-11-05)
    const ym = (tepa(xo) + past(xo)) / 2;
    if (petlya === "ong") q += chiziq(x2, tepa(x2), x1, ym) + chiziq(x2, past(x2), x1, ym);
    else q += chiziq(x1, tepa(x1), x2, ym) + chiziq(x1, past(x1), x2, ym);
    // dvaynoy: yon uchburchak + uchi pastdagi uchburchak (foydalanuvchi namunasi, 2026-11-05)
    if (dvaynoy) q += chiziq(x1, tepa(x1), xo, past(xo), "ch uz") + chiziq(x2, tepa(x2), xo, past(xo), "ch uz");
    if (ruchkaBor !== false) {
      const rx = petlya === "ong" ? x + i + t * 0.22 : x + w - i - t * 0.6;
      q += ru(rx, ym - t * 1.1, t * 0.38, t * 2.2);
    }
    return q;
  }

  s += `<defs>
    <linearGradient id="${gid}-ra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--rama-1)"/><stop offset="1" style="stop-color:var(--rama-2)"/></linearGradient>
    <linearGradient id="${gid}-oy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--oyna-1)"/><stop offset="1" style="stop-color:var(--oyna-2)"/></linearGradient>
    ${oynaGradlar}
    <pattern id="${gid}-gul" width="${f(t * 1.1)}" height="${f(t * 1.1)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${f(t * 0.16)}" height="${f(t * 1.1)}" fill="rgba(255,255,255,.5)"/></pattern>
  </defs>`;

  const rama = k.rama ?? (typeof zakaz !== "undefined" && zakaz && zakaz.umumiy ? zakaz.umumiy.rama : null);
  const eF = rama === "F703" ? t * 0.45 : 0;
  if (eF) {
    const e = eF, a = g.ramalar.find((r) => r.asosiy), yaqin = (u, v) => Math.abs(u - v) < 0.01;
    for (const o of g.barglar) {
      if (o.u) {
        // portal U oynasi: ramaga tegadigan tomonlari (chap, oʻng, tepa, past) e ichkariga
        const u = o.u;
        o.u = { ...u, eL: yaqin(u.ux, a.x) ? e : 0, eR: yaqin(u.ux + u.uw, a.x + a.w) ? e : 0, eT: yaqin(o.y, 0) ? e : 0,
          eBL: yaqin(u.ul, H) ? e : 0, eBR: yaqin(u.ur, H) ? e : 0 };
        continue;
      }
      if (yaqin(o.x, a.x)) { o.x += e; o.w -= e; }
      if (yaqin(o.x + o.w, a.x + a.w)) o.w -= e;
      if (!o.tY && yaqin(o.y, 0)) { o.y += e; o.h -= e; }
      // rama arkasiga tegsa: yoy e ichkariga (konsentrik) — yoyY(yangi, x, d) = yoyY(eski, x, d + e)
      if (o.tY && o.tY === g.ark) o.tY = { ...o.tY, R: o.tY.R - e, y0: o.tY.y0 + e };
      if (!o.pY && yaqin(o.y + o.h, H)) o.h -= e;
    }
  }
  const belgi = opts.kichik ? {} : belgilar(g.barglar);
  for (const r of g.ramalar) {
    if (r.asosiy && ark) {
      // arkali rama: tashqi va ichki chegara orasidagi tasma
      s += `<path d="${shakl(0, 0, L, H, 0, ark)} ${shakl(t + eF, t + eF, L - 2 * (t + eF), H - 2 * (t + eF), t + eF, ark)}" class="ra" fill-rule="evenodd"/>`;
      continue;
    }
    s += rect(r.x, 0, r.w, H, "ra");
    if (!r.asosiy) s += oyna(r.x + t, t, r.w - 2 * t, H - 2 * t, t);
  }
  // impostlar tabaqadan oldin: tabaqa impost ustiga kirib turadi, petlya koʻrinadi
  // impost uchi: rama yoyidan t, impost yoyidan t/2 ichkarida
  const ichOf = (yo) => (yo ? (yo.rama ? t : t / 2) : t);
  for (const c of g.impostlar) {
    if (c.portalTepa) { s += rect(c.x - t / 2, c.y1 + t, t, c.y2 - c.y1 - t - t / 2, "ra im"); continue; }
    if (c.portalTik) { s += rect(c.x - t / 2, c.y1, t, c.y2 - t - c.y1, "ra im"); continue; }
    if (c.yoy) {
      // egilgan impost: yoy boʻylab t qalinlikdagi tasma
      const n = Math.max(12, Math.ceil(((c.x2 - c.x1) / L) * 64));
      const xa = c.x1 + t * 0.5, xb = c.x2 - t * 0.5;
      let p = "";
      for (let j = 0; j <= n; j++) { const xx = xa + ((xb - xa) * j) / n; p += (j ? "L" : "M") + f(xx) + " " + f(yoyY(c.yoy, xx, -t / 2)); }
      for (let j = n; j >= 0; j--) { const xx = xa + ((xb - xa) * j) / n; p += "L" + f(xx) + " " + f(yoyY(c.yoy, xx, t / 2)); }
      s += `<path d="${p}Z" class="ra im"/>`;
      continue;
    }
    s += c.x1 === c.x2
      ? yuza(c.x1 - t / 2, c.y1 + t, t, c.y2 - c.y1 - 2 * t, ichOf(c.tY), "ra im", "", c.tY, c.pY, ichOf(c.pY))
      : yuza(c.x1 + t, c.y1 - t / 2, c.x2 - c.x1 - 2 * t, t, ichOf(c.tY), "ra im", "", c.tY, null);
  }
  for (const o of g.barglar) {
    const d = t * 0.5;
    const x = o.x + d, y = o.y + d, w = o.w - 2 * d, h = o.h - 2 * d;
    const b = o.b, tY = o.tY, pY = o.pY;
    oynaTanla(o.p);
    if (o.u) {
      if (!opts.kichik) s += `<path d="${uYol(o, d + t * 0.08)}" class="sht"/>`;
      s += `<path d="${uYol(o, d + t * 0.3)}" class="oy" ${oynaUslub}/>`;
      if (oynaGul) s += `<path d="${uYol(o, d + t * 0.3)}" class="gul" style="fill:url(#${gid}-gul)"/>`;
      continue;
    }
    if (b.tur === "gluxoy") s += oyna(x + t * 0.3, y + t * 0.3, w - t * 0.6, h - t * 0.6, d + t * 0.3, tY, pY);
    else if (b.tur === "tabaqa") s += tabaqa(x, y, w, h, b.petlya_tomoni || (b.fortochka ? "past" : "chap"), b.dvaynoy, true, b.fortochka, d, tY, pY);
    else if (b.tur === "eshik") {
      if (b.tabaqa_soni === 2) {
        const aktiv = b.aktiv || "ong";
        s += tabaqa(x, y, w / 2, h, "chap", false, aktiv === "chap", false, d, tY, pY, true) + tabaqa(x + w / 2, y, w / 2, h, "ong", false, aktiv === "ong", false, d, tY, pY, true);
      } else s += tabaqa(x, y, w, h, b.petlya_tomoni || "chap", false, true, false, d, tY, pY, true);
    } else s += rect(x, y, w, h, "xt");
  }
  if (!opts.kichik) {
    for (const o of g.barglar) {
      const cx = o.x + o.w / 2;
      const yt = tepaY(o.tY, cx, o.y, t), yb = o.u ? o.u.yo.y0 - t : pastY(o.pY, cx, o.y + o.h, t);
      // eshik belgisi yuqoriroqda: oʻrtada ruchka (shtulp) bor
      const cy = o.b.tur === "eshik" ? yt + (yb - yt) * 0.3 : (yt + yb) / 2;
      s += nishon(cx, cy, belgi[o.p]);
      const bosCls = "bos" + (o.p === opts.tanlangan ? " tanl" : "");
      s += o.u ? `<path d="${uYol(o, 0)}" class="${bosCls}" data-p="${o.p}"/>` : yuza(o.x, o.y, o.w, o.h, 0, bosCls, `data-p="${o.p}"`, o.tY, o.pY);
    }
  }
  // F1 / C1 / E1 belgisi: yumaloq taxtacha
  function nishon(x, y, m) {
    const w = shrift * (0.75 + 0.62 * String(m).length), h = shrift * 1.45;
    return rect(x - w / 2, y - h / 2, w, h, "belgi-fon", `rx="${f(h / 2)}"`) + matn(x, y, m, 0.95, "yoz qalin");
  }

  // Oʻlcham chiziqlari: tik boʻlinishlar pastda, yotiqlari oʻngda; umumiy L pastda, H chapda.
  // Uchlari qiya chiziqcha (arxitektura uslubi), qiymat yumaloq taxtachada.
  let pastQator = 0, ongQator = 0;
  const olchamChizigi = (x1, y1, x2, y2, qiymat, avto, kalit, uzat) => {
    const yot = y1 === y2;
    const uz = qadam * 0.16;
    let q = "";
    if (uzat != null) {
      q += yot ? chiziq(x1, uzat, x1, y1 + uz, "ol-uzat") + chiziq(x2, uzat, x2, y1 + uz, "ol-uzat")
               : chiziq(uzat, y1, x1 + uz, y1, "ol-uzat") + chiziq(uzat, y2, x1 + uz, y2, "ol-uzat");
    }
    q += chiziq(x1, y1, x2, y2, "ol") + chiziq(x1 - uz, y1 + uz, x1 + uz, y1 - uz, "ol qiya") + chiziq(x2 - uz, y2 + uz, x2 + uz, y2 - uz, "ol qiya");
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const yozuv = (avto ? "≈" : "") + String(yx(qiymat)).replace(".", ",");
    const pw = shrift * (0.7 + 0.56 * yozuv.length), ph = shrift * 1.3;
    const pill = rect(mx - pw / 2, my - ph / 2, pw, ph, "ol-fon" + (kalit ? " bosiladi" : ""), `rx="${f(ph / 2)}"`) +
      matn(mx, my, yozuv, 0.9, "yoz olch" + (avto ? " avto" : ""));
    q += yot ? pill : `<g transform="rotate(-90 ${f(mx)} ${f(my)})">${pill}</g>`;
    if (kalit) {
      q += yot ? rect(x1, my - qadam * 0.45, x2 - x1, qadam * 0.9, "olbos", `data-ol="${kalit}"`)
               : rect(mx - qadam * 0.45, y1, qadam * 0.9, y2 - y1, "olbos", `data-ol="${kalit}"`);
    }
    return q;
  };
  if (!opts.kichik) {
    const tik = g.bolinishlar.filter((b) => b.v).sort((a, b) => a.chuqur - b.chuqur);
    const yotiq = g.bolinishlar.filter((b) => !b.v).sort((a, b) => a.chuqur - b.chuqur);
    for (const b of tik) {
      const yy = H + qadam * (++pastQator);
      let q = b.x;
      b.s.forEach((o, i) => { s += olchamChizigi(q, yy, q + o, yy, o, b.olchamlar[i] == null, `${b.p}|${i}`, H + qadam * 0.2); q += o; });
    }
    for (const b of yotiq) {
      const xx = L + qadam * (++ongQator);
      let q = b.y;
      b.s.forEach((o, i) => { s += olchamChizigi(xx, q, xx, q + o, o, b.olchamlar[i] == null, `${b.p}|${i}`, L + qadam * 0.2); q += o; });
      if (b.egilgan != null) {
        // yoy impost chuqurligi: choʻqqidan uchlarigacha (≈ — arkaga parallel)
        const x2 = L + qadam * (++ongQator);
        s += olchamChizigi(x2, b.y + b.s[0], x2, b.y + b.s[0] + b.egilgan, b.egilgan, b.parallel, `${b.p}|yoy`);
      }
    }
    for (const pt of g.portallar) {
      const yy = H + qadam * (++pastQator);
      s += olchamChizigi(pt.x, yy, pt.xa, yy, pt.xa - pt.x, pt.chapAvto, `${pt.p}|chap`, H + qadam * 0.2) +
        olchamChizigi(pt.xa, yy, pt.xb, yy, pt.xb - pt.xa, true, null, H + qadam * 0.2) +
        olchamChizigi(pt.xb, yy, pt.x + pt.w, yy, pt.x + pt.w - pt.xb, pt.ongAvto, `${pt.p}|ong`, H + qadam * 0.2);
      let xx = L + qadam * (++ongQator);
      s += olchamChizigi(xx, pt.y, xx, pt.y + pt.tepa, pt.tepa, false, `${pt.p}|tepa`, L + qadam * 0.2) +
        olchamChizigi(xx, pt.y + pt.tepa, xx, pt.ys, pt.c, pt.parallel, `${pt.p}|yoy`);
      for (const [kal, yv] of [["chap_boy", pt.yl], ["ong_boy", pt.yr]]) {
        xx = L + qadam * (++ongQator);
        s += olchamChizigi(xx, pt.y, xx, yv ?? pt.y + pt.h, (yv ?? pt.y + pt.h) - pt.y, yv == null, `${pt.p}|${kal}`);
      }
    }
    if (ark) {
      const xx = L + qadam * (++ongQator);
      s += olchamChizigi(xx, 0, xx, ark.a, ark.a, false, "arka");
    }
    if (k.tur === "lapshali") {
      const yy = H + qadam * (++pastQator);
      for (const r of g.ramalar) s += olchamChizigi(r.x, yy, r.x + r.w, yy, r.w, r.asosiy, r.asosiy ? null : (r.x === 0 ? "chap" : "ong"), H + qadam * 0.2);
    }
    s += olchamChizigi(0, H + qadam * (++pastQator), L, H + qadam * pastQator, L, false, "L", H + qadam * 0.2);
    s += olchamChizigi(-qadam, 0, -qadam, H, H, false, "H", -qadam * 0.2);
  }
  const chap = opts.kichik ? t : qadam * 1.6, tepa = opts.kichik ? t : qadam * 0.6;
  const vb = `${f(-chap)} ${f(-tepa)} ${f(L + chap + (opts.kichik ? t : qadam * (ongQator + 0.7)))} ${f(H + tepa + (opts.kichik ? t : qadam * (pastQator + 0.7)))}`;
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="chizma${opts.kichik ? " kichik" : ""}" style="--g-ra:url(#${gid}-ra);--g-oy:url(#${gid}-oy)${prUslub}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}
const yx = (v) => Math.round(v * 10) / 10;

// ---------- asboblar ----------
const ik = (ichki) => `<svg viewBox="0 0 24 24" class="ik">${ichki}</svg>`;
const ramaIk = (x = 4, w = 16) => `<rect x="${x}" y="3" width="${w}" height="18" rx="1"/>`;
const ASBOBLAR = {
  impost: [
    ["tik", "Tik impost", ik('<line x1="12" y1="3" x2="12" y2="21" class="q"/>')],
    ["yotiq", "Yotiq impost", ik('<line x1="3" y1="12" x2="21" y2="12" class="q"/>')],
    ["tik3", "3 ga boʻlish", ik('<line x1="8" y1="3" x2="8" y2="21" class="q"/><line x1="16" y1="3" x2="16" y2="21" class="q"/>')],
    ["yoy", "Yoy impost (arkaga parallel yoki oʻz chuqurligi)", ik('<path d="M3 15q9-9 18 0" class="q"/>')],
    ["portal", "Portal: arkali oʻrta, atrofida U oyna", ik('<path d="M3 3h18v18H3z" class="q"/><path d="M8 21v-9a4 4 0 0 1 8 0v9"/>')],
    // "Shtulp" asbobi olib tashlandi (foydalanuvchi, 2026-11-08): 2 tabaqali eshik — Eshik boʻlimida
    ["ochir", "Impostni olib tashlash (yonidagi boʻlak bilan)", ik(ramaIk() + '<path d="M8 8l8 8M16 8l-8 8" class="x"/>')],
  ],
  tabaqa: [
    ["tab_chap", "Tabaqa, petlya chapda", ik(ramaIk() + '<path d="M6 5l12 7-12 7"/>')],
    ["tab_ong", "Tabaqa, petlya oʻngda", ik(ramaIk() + '<path d="M18 5L6 12l12 7"/>')],
    ["dv_chap", "Dvaynoy, petlya chapda", ik(ramaIk() + '<path d="M6 5l12 7-12 7"/><path d="M6 5l6 14 6-14" class="uz"/>')],
    ["dv_ong", "Dvaynoy, petlya oʻngda", ik(ramaIk() + '<path d="M18 5L6 12l12 7"/><path d="M6 5l6 14 6-14" class="uz"/>')],
    ["fortochka", "Fortochka, petlya pastda", ik(ramaIk() + '<path d="M5 19l7-14 7 14"/><path d="M10 4h4"/>')],
    ["fortochka_tepa", "Fortochka, petlya tepada", ik(ramaIk() + '<path d="M5 5l7 14 7-14"/><path d="M10 20h4"/>')],
    ["gluxoy", "Gluxoy", ik(ramaIk())],
  ],
  eshik: [
    ["esh1_chap", "1 tabaqa, petlya chapda", ik(ramaIk(6, 12) + '<path d="M8 5l8 7-8 7"/>')],
    ["esh1_ong", "1 tabaqa, petlya oʻngda", ik(ramaIk(6, 12) + '<path d="M16 5L8 12l8 7"/>')],
    ["esh2_ong", "2 tabaqa, ruchka oʻngda", ik(ramaIk(3, 18) + '<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 5l6 7-6 7M19 5l-6 7 6 7"/><circle cx="14" cy="12" r="1"/>')],
    ["esh2_chap", "2 tabaqa, ruchka chapda", ik(ramaIk(3, 18) + '<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 5l6 7-6 7M19 5l-6 7 6 7"/><circle cx="10" cy="12" r="1"/>')],
    ["gluxoy", "Gluxoy", ik(ramaIk())],
  ],
  shakl: [
    ["togri", "Toʻgʻri burchak", ik(ramaIk())],
    ["arka_yarim", "Arka: yarim doira", ik('<path d="M4 21V12a8 8 0 0 1 16 0v9z"/>')],
    ["arka", "Arka: pologiy", ik('<path d="M4 21V9q8-6 16 0v12z"/>')],
    ["aylana", "Yarim aylana (yon devorsiz)", ik('<path d="M3 18a9 9 0 0 1 18 0z"/>')],
  ],
};
const BOLIMLAR = [
  ["impost", "Impost", ik('<line x1="12" y1="3" x2="12" y2="21" class="q"/>')],
  ["tabaqa", "Tabaqa", ik(ramaIk() + '<path d="M6 5l12 7-12 7"/>')],
  ["eshik", "Eshik", ik(ramaIk(6, 12) + '<circle cx="15" cy="12" r="1"/>')],
  ["shakl", "Shakl (arka)", ik('<path d="M5 21V12a7 7 0 0 1 14 0v9z"/>')],
];

// Tugma ostidagi qisqa nom (belgining oʻzi tushunarsiz boʻlmasin)
const QISQA = {
  tik: "Tik", yotiq: "Yotiq", yoy: "Yoy impost", portal: "Portal", tik3: "Tik 3 ga", yotiq3: "Yotiq 3 ga", ochir: "Impostni olish",
  tab_chap: "Chap", tab_ong: "Oʻng", dv_chap: "Dvaynoy chap", dv_ong: "Dvaynoy oʻng", fortochka: "Fortochka ↓", fortochka_tepa: "Fortochka ↑", gluxoy: "Gluxoy",
  esh1_chap: "1 tab. chap", esh1_ong: "1 tab. oʻng", esh2_ong: "2 tab. ruchka oʻng", esh2_chap: "2 tab. ruchka chap",
  togri: "Toʻgʻri", arka_yarim: "Yarim doira", arka: "Pologiy arka", aylana: "Yarim aylana",
};

// Shakl butun konstruksiyaga qoʻllanadi (boʻlakka emas)
function shaklId(k) {
  if (!k.arka) return "togri";
  if (Number(k.arka.balandlik) >= Number(k.H) - 0.05) return "aylana";
  return Number(k.arka.balandlik) >= Number(k.L) / 2 - 0.05 ? "arka_yarim" : "arka";
}
function shaklniQolla(id) {
  if (id !== "togri" && tahrir.tur === "lapshali") { xabar("Lapshali vitrajda arka boʻlmaydi: ⚙ da lapshani oʻchiring"); return; }
  saqlaTarix();
  const L = Number(tahrir.L), H = Number(tahrir.H);
  if (id === "togri") {
    // yarim aylanadan toʻgʻriga: boʻy oʻzgarmaydi
    delete tahrir.arka;
  } else if (id === "aylana") {
    // Yarim aylana (foydalanuvchi, 2026-11-07): yon devor yoʻq, H = arka balandligi = L/2
    tahrir.H = yaxlit(L / 2);
    tahrir.arka = { balandlik: tahrir.H };
  } else {
    const a = id === "arka_yarim" ? L / 2 : yaxlit(L * 0.2);
    if (a >= H) { orqaga.pop(); xabar("Arka uchun boʻy yetmaydi: H arka balandligidan katta boʻlishi kerak (yon devorsiz — Yarim aylana)"); return; }
    tahrir.arka = { balandlik: yaxlit(a) };
  }
  yangila();
  if (id === "aylana") xabar("Yarim aylana: yon devor yoʻq, boʻyi = L/2. Eni oʻzgarsa boʻyi ham oʻzgaradi.");
  else if (id !== "togri") xabar("Arka balandligini oʻngdagi raqamga bosib oʻzgartiring. H — choʻqqigacha umumiy boʻy.");
}

function asboblarniChiz() {
  $("k-bolimlar").innerHTML = BOLIMLAR.map(([id, nom, i]) => `<button data-bolim="${id}" class="${id === bolim ? "faol" : ""}" title="${nom}" aria-label="${nom}">${i}</button>`).join("") +
    `<span class="bosh"></span><button data-tarix="orqaga" ${orqaga.length ? "" : "disabled"} aria-label="Orqaga">↶</button><button data-tarix="oldinga" ${oldinga.length ? "" : "disabled"} aria-label="Oldinga">↷</button>`;
  const faolId = bolim === "shakl" ? shaklId(tahrir) : asbob;
  let html = ASBOBLAR[bolim].map(([id, nom, i]) => `<button data-asbob="${id}" class="nomli${id === faolId ? " faol" : ""}" title="${nom}" aria-label="${nom}">${i}</button>`).join("");
  $("k-asboblar").innerHTML = html;
  const nom = asbob ? (ASBOBLAR[bolim].find((a) => a[0] === asbob) || [])[1] : null;
  if (bolim === "shakl") { $("k-maslahat").textContent = "Shakl butun konstruksiyaga qoʻllanadi. Arka balandligi oʻngda, H — choʻqqigacha boʻy."; return; }
  $("k-maslahat").textContent = asbob === "ochir" ? "Impostni olib tashlash: impost yonidagi boʻlakka bosing — shu boʻlak va uning chap/tepa impost(i) olinadi, joyi qoʻshnisiga oʻtadi"
    : nom ? `${nom}: rasmdagi boʻlakka bosing` : "Asbob tanlang yoki boʻlakka bosib sozlang. Oʻlchamni oʻzgartirish uchun raqamga bosing.";
}

function saqlaTarix() { orqaga.push(nusxa(tahrir)); if (orqaga.length > 50) orqaga.shift(); oldinga = []; }

function asbobniQolla(p) {
  const b = tugun(tahrir.bolak, p);
  // Portal U oynasi faqat gluxoy (shakli impostlardan chiqadi)
  const o_ = ota(p);
  if (o_ && o_.i === 0 && tugun(tahrir.bolak, o_.yol).tur === "portal" && asbob === "tik") {
    const pt = tugun(tahrir.bolak, o_.yol);
    saqlaTarix();
    if (pt.tepa_impost === false) delete pt.tepa_impost; else pt.tepa_impost = false;
    xabar(pt.tepa_impost === false ? "Tepadagi impost olindi: U oyna bitta" : "Tepada impost: U oyna ikkiga boʻlindi");
    yangila();
    return;
  }
  if (o_ && o_.i === 0 && tugun(tahrir.bolak, o_.yol).tur === "portal" && asbob !== "ochir" && asbob !== "gluxoy") {
    xabar("Portal atrofidagi U oyna faqat gluxoy boʻladi");
    return;
  }
  saqlaTarix();
  const tabaqa = (petlya, dv) => ({ tur: "tabaqa", petlya_tomoni: petlya, ...(dv ? { dvaynoy: true } : {}) });
  switch (asbob) {
    case "tik": bolish(p, "vertikal"); break;
    case "yotiq": bolish(p, "gorizontal"); break;
    case "tik3": bolish(p, "vertikal", 3); break;
    case "yotiq3": bolish(p, "gorizontal", 3); break;
    case "yoy": {
      // egilgan impost: tepada lenta (gluxoy), pastda boʻlakning oʻzi; tepada yoy boʻlsa unga parallel
      const o = geometriya(tahrir).barglar.find((x) => x.p === p);
      if (!o) { orqaga.pop(); return; }
      const c = o.tY ? yoyChuqurligi(o.tY, o.x, o.x + o.w) : yaxlit(o.w * 0.2);
      const s0 = yaxlit(Math.max(10, (o.h - c) * 0.3));
      if (s0 + c >= o.h - 10) { orqaga.pop(); xabar("Yoy impost uchun boʻy yetmaydi"); return; }
      almashtir(p, { tur: "bolinish", yonalish: "gorizontal", egilgan: o.tY ? {} : { chuqurlik: c }, olchamlar: [s0, null], bolaklar: [{ tur: "gluxoy" }, b] });
      break;
    }
    case "portal": {
      const o = geometriya(tahrir).barglar.find((x) => x.p === p);
      if (!o) { orqaga.pop(); return; }
      if (o.pY) { orqaga.pop(); xabar("Portal ostida yoy boʻlmaydi"); return; }
      const chap = null, orta = o.w / 3, c = orta / 2;
      let tepa = Math.max(10, Math.min(30, o.h * 0.13));
      if (o.tY) {
        // rama arkasi ostida: portal arkasi rama arkasiga tegmasin
        const xa = o.x + o.w / 3, xb = o.x + (o.w * 2) / 3, tt = 5.8;
        tepa = Math.max(tepa, yoyY(o.tY, o.x + o.w / 2, tt) - o.y + 15, yoyY(o.tY, xa, tt) - o.y + 8 - c, yoyY(o.tY, xb, tt) - o.y + 8 - c);
      }
      tepa = yaxlit(Math.ceil(tepa));
      if (tepa + c > o.h * 0.6 || orta < 30) { orqaga.pop(); xabar("Portal uchun joy yetmaydi"); return; }
      const yb = yaxlit(tepa + c + (o.h - tepa - c) * 0.25);
      almashtir(p, { tur: "portal", chap, ong: chap, tepa, chuqurlik: null, chap_boy: yb, ong_boy: yb,
        bolaklar: [{ tur: "gluxoy" }, b, { tur: "gluxoy" }, { tur: "gluxoy" }] });
      xabar("Oʻlchamlarni raqamlarga bosib kiriting: ustun enlari pastda, arka va yon impostlar oʻngda");
      break;
    }
    case "shtulp":
      almashtir(p, { tur: "eshik", tabaqa_soni: 2, ochilish: b.tur === "eshik" ? b.ochilish : joriyOchilish(tahrir), aktiv: b.aktiv || "ong" }); break;
    case "ochir": if (!ochir(p)) { orqaga.pop(); xabar("Bitta boʻlakni oʻchirib boʻlmaydi"); return; } break;
    case "tab_chap": almashtir(p, tabaqa("chap")); break;
    case "tab_ong": almashtir(p, tabaqa("ong")); break;
    case "dv_chap": almashtir(p, tabaqa("chap", true)); break;
    case "dv_ong": almashtir(p, tabaqa("ong", true)); break;
    case "fortochka": almashtir(p, { tur: "tabaqa", fortochka: true }); break;
    case "fortochka_tepa": almashtir(p, { tur: "tabaqa", fortochka: true, petlya_tomoni: "tepa" }); break;
    case "gluxoy": almashtir(p, { tur: "gluxoy" }); break;
    case "esh1_chap": case "esh1_ong":
      almashtir(p, { tur: "eshik", tabaqa_soni: 1, ochilish: joriyOchilish(tahrir), petlya_tomoni: asbob.endsWith("chap") ? "chap" : "ong" }); break;
    case "esh2_chap": case "esh2_ong":
      almashtir(p, { tur: "eshik", tabaqa_soni: 2, ochilish: joriyOchilish(tahrir), aktiv: asbob.endsWith("chap") ? "chap" : "ong" }); break;
    default: orqaga.pop(); return;
  }
  if (asbob !== "ochir") tanlangan = tugun(tahrir.bolak, p) ? p : "";
  if (!tugun(tahrir.bolak, tanlangan) || tugun(tahrir.bolak, tanlangan).tur === "bolinish") tanlangan = geometriya(tahrir).barglar[0].p;
  yangila();
}

function xabar(m) { $("k-maslahat").textContent = m; }

// ---------- oʻlcham kiritish: oʻz raqam klaviaturasi (Romchi kabi) ----------
// Eski qiymat kulrang koʻrinadi; birinchi bosilgan raqam uning oʻrniga yoziladi.
function soraSon(sarlavha, qiymat, boshMumkin) {
  return new Promise((hal) => {
    let matn = "", yangi = true;
    const eski = qiymat == null ? "" : String(yx(Number(qiymat))).replace(".", ",");
    const korsat = () => {
      $("son-qiymat").textContent = yangi ? (eski || "0") : (matn || "0");
      $("son-qiymat").classList.toggle("eski", yangi);
    };
    $("son-sarlavha").textContent = sarlavha;
    $("son-teng").hidden = !boshMumkin;
    $("son-oyna").hidden = false;
    korsat();
    const tugat = (natija) => {
      $("son-oyna").hidden = true;
      $("son-oyna").onclick = null;
      document.removeEventListener("keydown", klav);
      hal(natija);
    };
    const bos = (k) => {
      if (k === "del") { if (yangi) { matn = eski; yangi = false; } matn = matn.slice(0, -1); }
      else if (k === ",") { if (yangi) { matn = "0"; yangi = false; } if (!matn.includes(",")) matn += ","; }
      else { if (yangi) { matn = ""; yangi = false; } if (matn.length < 7) matn = matn === "0" ? k : matn + k; }
      korsat();
    };
    const saqlash = () => {
      const x = yangi ? sonOl(eski) : sonOl(matn);
      if (x == null || x <= 0) { if (yangi && !eski && boshMumkin) tugat({ bosh: true }); return; }
      tugat({ son: x });
    };
    $("son-oyna").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) { if (e.target.id === "son-oyna") tugat(null); return; }
      if (b.dataset.k) bos(b.dataset.k);
      else if (b.id === "son-ok") saqlash();
      else if (b.id === "son-teng") tugat({ bosh: true });
      else if (b.id === "son-bekor") tugat(null);
    };
    function klav(e) {
      if (/^[0-9]$/.test(e.key)) bos(e.key);
      else if (e.key === "," || e.key === ".") bos(",");
      else if (e.key === "Backspace") bos("del");
      else if (e.key === "Enter") saqlash();
      else if (e.key === "Escape") tugat(null);
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", klav);
  });
}

async function olchamniOzgartir(kalit) {
  if (kalit === "arka") {
    const j = await soraSon(`Arka balandligi, sm (yarim doira = ${yx(Number(tahrir.L) / 2)})`, tahrir.arka.balandlik, false);
    if (!j) return;
    const a = Math.min(j.son, Number(tahrir.L) / 2);
    if (a > Number(tahrir.H)) { xabar("Arka balandligi H dan katta boʻlmaydi"); return; }
    saqlaTarix();
    tahrir.arka = { balandlik: yaxlit(a) };
    if (a < j.son) { yangila(); xabar("Arka L/2 dan baland boʻlmaydi: yarim doira qilindi"); return; }
  } else if (kalit === "L" || kalit === "H" || kalit === "chap" || kalit === "ong") {
    const nom = { L: "Umumiy eni (L), sm", H: "Umumiy boʻyi (H), sm", chap: "Chap yon oyna eni, sm", ong: "Oʻng yon oyna eni, sm" }[kalit];
    const j = await soraSon(nom, tahrir[kalit], false);
    if (!j) return;
    saqlaTarix();
    const aylana = shaklId(tahrir) === "aylana";
    tahrir[kalit] = j.son;
    if (aylana && kalit === "L") { tahrir.H = yaxlit(j.son / 2); tahrir.arka = { balandlik: tahrir.H }; }
    if (tahrir.arka && kalit === "H" && Number(tahrir.arka.balandlik) > j.son) tahrir.arka = { balandlik: yaxlit(j.son) };
    if (tahrir.arka && Number(tahrir.arka.balandlik) > Number(tahrir.L) / 2) tahrir.arka = { balandlik: yaxlit(Number(tahrir.L) / 2) };
  } else {
    const [p, i] = kalit.split("|");
    const b = tugun(tahrir.bolak, p);
    if (b.tur === "portal") { await portalOlchami(p, b, i); return; }
    if (i === "yoy") {
      const bo = geometriya(tahrir).bolinishlar.find((x) => x.p === p);
      const j = await soraSon(bo.tY ? "Yoy impost chuqurligi, sm (Teng — arkaga parallel)" : "Yoy impost chuqurligi, sm", b.egilgan.chuqurlik ?? bo.egilgan, !!bo.tY);
      if (!j) return;
      saqlaTarix();
      if (j.bosh) b.egilgan = {};
      else {
        const c = Math.min(j.son, bo.w / 2);
        if (b.olchamlar[0] != null && Number(b.olchamlar[0]) + c >= bo.h - 5) { orqaga.pop(); xabar("Bu chuqurlikka boʻy yetmaydi"); return; }
        b.egilgan = { chuqurlik: yaxlit(c) };
        if (c < j.son) xabar("Chuqurlik eni yarmidan katta boʻlmaydi");
      }
      yangila();
      return;
    }
    const v = b.yonalish === "vertikal";
    const j = await soraSon(`Boʻlak ${v ? "eni" : "boʻyi"}, sm (chetdan impost oʻrtasigacha)`, b.olchamlar[+i], true);
    if (!j) return;
    saqlaTarix();
    if (j.bosh) {
      const eski = b.olchamlar[+i];
      b.olchamlar[+i] = null;
      if (b.olchamlar.every((x) => x == null)) { b.olchamlar[+i] = eski; orqaga.pop(); xabar("Hech boʻlmasa bitta oʻlcham berilishi kerak"); }
    } else {
      b.olchamlar[+i] = j.son;
      // hammasi berilgan boʻlsa, oxirgi boʻsh qolmasa yigʻindi mos kelmaydi: boshqa birini avtomatik qilamiz
      if (b.olchamlar.every((x) => x != null)) b.olchamlar[+i === b.olchamlar.length - 1 ? 0 : b.olchamlar.length - 1] = null;
    }
  }
  yangila();
}

async function portalOlchami(p, b, i) {
  const nomlar = {
    chap: "Chap ustun eni, sm (Teng — uchga teng)", ong: "Oʻng ustun eni, sm (Teng — chapga teng)", tepa: "Tepadan arka choʻqqisigacha, sm",
    yoy: "Arka chuqurligi, sm (Teng — yarim doira)", chap_boy: "Chap yotiq impost, tepadan, sm (Teng — impost yoʻq)",
    ong_boy: "Oʻng yotiq impost, tepadan, sm (Teng — impost yoʻq)",
  };
  const kal = i === "yoy" ? "chuqurlik" : i;
  const pt = geometriya(tahrir).portallar.find((x) => x.p === p);
  const avtoQiymat = i === "yoy" ? pt.c : i === "chap" ? pt.xa - pt.x : i === "ong" ? pt.x + pt.w - pt.xb : null;
  const j = await soraSon(nomlar[i], b[kal] ?? avtoQiymat, true);
  if (!j) return;
  if (j.bosh && i === "tepa") { xabar("Tepadan arkagacha oʻlcham kerak"); return; }
  const eski = nusxa(b);
  saqlaTarix();
  if (j.bosh) {
    b[kal] = null;
    if (i === "chap_boy") b.bolaklar[2] = null;
    if (i === "ong_boy") b.bolaklar[3] = null;
  } else {
    b[kal] = j.son;
    if (i === "chap_boy" && !b.bolaklar[2]) b.bolaklar[2] = { tur: "gluxoy" };
    if (i === "ong_boy" && !b.bolaklar[3]) b.bolaklar[3] = { tur: "gluxoy" };
  }
  // chegaralar (hisob.py bilan bir xil): oʻrta tor emas, arka sigʻadi, yon impost arka boshlanishidan pastda
  const [ec, eo] = portalEnlar(b, pt.w);
  const orta = pt.w - ec - eo;
  const c = b.chuqurlik != null ? Number(b.chuqurlik) : orta / 2;
  let xato = null;
  if (orta < 20) xato = "Oʻrta juda tor qoldi";
  else if (c > orta / 2) xato = "Arka chuqurligi oʻrta eni yarmidan katta boʻlmaydi";
  else if (Number(b.tepa) + c >= pt.h - 10) xato = "Arka boʻyga sigʻmaydi";
  else for (const yb of [b.chap_boy, b.ong_boy]) if (yb != null && (yb <= Number(b.tepa) + c || yb >= pt.h - 10)) xato = "Yon impost arka boshlanishidan pastda boʻlishi kerak";
  if (xato) { Object.keys(b).forEach((k) => delete b[k]); Object.assign(b, eski); orqaga.pop(); xabar(xato); return; }
  yangila();
}
function almashtirIchida(ildiz, p, yangi) {
  const o = ota(p);
  if (!o) { ildiz.bolak = yangi; return; }
  tugun(ildiz.bolak, o.yol).bolaklar[o.i] = yangi;
}

// ---------- tahrirlash oynasi ----------
function konstruktorniOch(i) {
  tahrirIndeks = i;
  tahrir = i >= 0 ? nusxa(zakaz.konstruksiyalar[i]) : { nom: "K" + (zakaz.konstruksiyalar.length + 1), soni: 1, L: 150, H: 150, bolak: { tur: "gluxoy" } };
  tanlangan = geometriya(tahrir).barglar[0].p;
  asbob = null;
  orqaga = []; oldinga = [];
  $("asosiy").hidden = true;
  $("konstruktor").hidden = false;
  history.pushState({ ekran: "konstruktor" }, "");
  window.scrollTo(0, 0);
  yangila();
}

function konstruktorniYop(saqlansin, tarixdan) {
  // Tugma bilan yopilsa konstruktorning tarix yozuvini olib tashlaymiz (popstate e'tiborsiz qoldiriladi)
  if (!tarixdan && history.state && history.state.ekran === "konstruktor") { ichkiOrqaga = true; history.back(); }
  if (saqlansin) {
    const nomlar = zakaz.konstruksiyalar.filter((_, j) => j !== tahrirIndeks).map((k) => k.nom);
    let nom = (tahrir.nom || "").trim() || "K" + (zakaz.konstruksiyalar.length + 1);
    while (nomlar.includes(nom)) nom += "+";
    tahrir.nom = nom;
    if (tahrirIndeks >= 0) zakaz.konstruksiyalar[tahrirIndeks] = tahrir;
    else zakaz.konstruksiyalar.push(tahrir);
    saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  }
  tahrir = null;
  try { localStorage.removeItem("qoralama"); } catch (e) {}
  $("sozlama-oyna").hidden = true;
  $("konstruktor").hidden = true;
  $("asosiy").hidden = false;
  if (zakaz) ekran("zakaz", joriyEkran !== "zakaz");
  hisoblaKeyin();
}

// Chala chizma har oʻzgarishda saqlanadi: sahifa yangilansa yoki ilova yopilsa, joyidan davom etadi
function qoralamaniTikla() {
  let q = null;
  try { q = JSON.parse(ol("qoralama")); } catch (e) { q = null; }
  if (!q || !q.tahrir || !zakaz) return false;
  tahrirIndeks = q.indeks < zakaz.konstruksiyalar.length ? q.indeks : -1;
  tahrir = q.tahrir;
  orqaga = q.orqaga || []; oldinga = [];
  tanlangan = geometriya(tahrir).barglar[0].p;
  asbob = null;
  ekran("zakaz");
  $("asosiy").hidden = true;
  $("konstruktor").hidden = false;
  history.pushState({ ekran: "konstruktor" }, "");
  yangila();
  xabar("Chala chizma tiklandi");
  return true;
}

function yangila() {
  saqla("qoralama", JSON.stringify({ tahrir, indeks: tahrirIndeks, orqaga: orqaga.slice(-20) }));
  $("k-nom").innerHTML = `<b>${esc(tahrir.nom || "")}</b><span>${yx(Number(tahrir.L))} × ${yx(Number(tahrir.H))} sm${(tahrir.soni ?? 1) > 1 ? " · " + tahrir.soni + " dona" : ""}</span>`;
  asboblarniChiz();
  $("k-chizma").innerHTML = chizmaSVG(tahrir, { tanlangan: asbob ? null : tanlangan });
  panelniChiz();
  oldindanHisobla();
}

const tugmalar = (amal, qiymat, variantlar) => `<div class="seg">${variantlar.map(([v, y]) => `<button data-amal="${amal}" data-v="${esc(JSON.stringify(v))}" class="${JSON.stringify(v) === JSON.stringify(qiymat) ? "faol" : ""}">${esc(y)}</button>`).join("")}</div>`;

function panelniChiz() {
  const b = tugun(tahrir.bolak, tanlangan);
  if (!b || b.tur === "bolinish") { $("k-panel").innerHTML = ""; return; }
  const g = geometriya(tahrir);
  const belgi = belgilar(g.barglar)[tanlangan] || "";
  const o = g.barglar.find((x) => x.p === tanlangan);
  const turNomi = { gluxoy: "gluxoy", tabaqa: b.fortochka ? "fortochka" : b.dvaynoy ? "dvaynoy tabaqa" : "tabaqa", eshik: "eshik" }[b.tur];
  let p = `<div class="panel-bosh"><b>${belgi}</b> · ${turNomi} · ≈ ${yx(o.w)} × ${yx(o.h)} sm</div>`;
  if (b.tur === "tabaqa") {
    const turi = b.fortochka ? "fortochka" : b.dvaynoy ? "dvaynoy" : "oddiy";
    p += `<div class="sarlavha">Turi</div>${tugmalar("turi", turi, [["oddiy", "Oddiy"], ["dvaynoy", "Dvaynoy"], ["fortochka", "Fortochka"]])}`;
    p += b.fortochka
      ? `<div class="sarlavha">Petlya</div>${tugmalar("petlya_tomoni", b.petlya_tomoni || "past", [["past", "Pastda"], ["tepa", "Tepada"]])}
         <div class="sarlavha">Yopilishi</div>${tugmalar("ruchka", !!b.ruchka, [[false, "Chit-chit"], [true, "Ruchka"]])}`
      : "";
  } else if (b.tur === "eshik") {
    p += `<div class="xira">${b.ochilish === "tashqariga" ? "Balkon Oʻrta V707 (tashqariga)" : "Balkon Qanot V708 (ichkariga)"} — ⚙ sozlamada almashtiriladi. Tabaqa soni va ruchka tomoni tepadagi asboblarda.</div>`;
  } else p += `<div class="xira">Turini almashtirish uchun tepadan asbob tanlab, boʻlakka bosing.</div>`;
  // Oyna turi ⚙ sozlamada (foydalanuvchi, 2026-11-07: panelda ortiqcha)
  $("k-panel").innerHTML = p;
}

function oldindanHisobla() {
  clearTimeout(oldindanTaymer);
  $("k-holat").textContent = "Hisoblanmoqda…";
  $("k-holat").className = "xira";
  oldindanTaymer = setTimeout(() => {
    if (!tahrir) return;
    const d = pyTannarx({ umumiy: zakaz.umumiy, konstruksiyalar: [{ ...tahrir, nom: tahrir.nom || "K", soni: 1 }] });
    if (d.xato) {
      const m = d.xato.replace(/^[^:]*: /, "");
      $("k-holat").innerHTML = `<span class="ogoh">${esc(m)}</span>` +
        (/lapshali/.test(m) ? '<br><span class="xira">⚙ sozlamalarda "Yon oynalar alohida ramada" ni yoqing.</span>' : "");
      $("k-holat").className = "";
      return;
    }
    const k = d.ok.konstruksiyalar[0];
    const oy = d.ok.oynalar.map((o) => `${o.joy} ${son(o.en, 2)}×${son(o.boy, 2)}${o.soni > 1 ? " ×" + o.soni : ""}`).join("; ");
    $("k-holat").innerHTML = `<span class="k-narx">1 dona <b>${usd(k.bir_dona_usd)}</b></span>${k.izoh ? `<br><span class="ogoh">${esc(k.izoh)}</span>` : ""}<br><span class="xira">Oynalar: ${esc(oy)}</span>`;
    $("k-holat").className = "";
  }, 250);
}

function sonOl(v) { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : null; }

// ---------- sozlamalar oynasi (⚙) ----------
function tanlov(nom, qiymat, variantlar) {
  return `<select data-m="${nom}">${variantlar.map(([v, y]) => `<option value="${esc(JSON.stringify(v))}"${JSON.stringify(v) === JSON.stringify(qiymat) ? " selected" : ""}>${esc(y)}</option>`).join("")}</select>`;
}

// Romchi uslubidagi sozlama oynasi: seriya, oyna, rama, rang — katta tugma va namunalar bilan.
// Tanlov shu konstruksiyaga yoziladi; zakazning umumiy qiymatiga teng boʻlsa, alohida yozilmaydi.
const RANG_TURKUMLARI = [
  ["Oq", "Oq", [["oq", "Oq", "#ffffff"]]],
  ["Svetnoy (kraska)", "Kraska", [["306g", "306g", "#2c2d30"]]],
  ["Laminatsiya", "Laminatsiya", [["grey", "Grey", "#6b7178"], ["z/d", "Z/D", "#b8742f"], ["d/m", "D/M", "#6e4a33"], ["sh/d", "Sh/D", "#4a3328"], ["alux", "Alux", "#4b4d50"]]],
  ["Anod", "Anod", [["anod", "Anod", "#c3c7cc"]]],
];
const RAMALAR = [["F702", "Kosa (Sredniy)", "F702 · r = 3,8"], ["F703", "Kosa Shirokaya", "F703 · r = 5,8"]];

function oynaRangi(nom) {
  const n = nom.toLowerCase();
  if (n.includes("qora")) return "#34383d";
  if (n.includes("koʻzgu") || n.includes("kozgu")) return "#a9b4bd";
  if (n.includes("yod")) return "#e59a3a";
  return "#5bd3f7";
}

function joriy(k) {
  const u = zakaz.umumiy, t = k.tanlov || {}, ut = u.tanlov || {};
  return {
    rama: k.rama ?? u.rama, qal: Number(k.oyna_qalinligi ?? u.oyna_qalinligi ?? 24),
    rang: t.rang ?? ut.rang, rangNomi: t.rang_nomi ?? ut.rang_nomi, oyna: t.oyna_turi ?? ut.oyna_turi,
    pod: t.podokonnik ?? ut.podokonnik ?? null,
  };
}

// Qiymatni konstruksiyaga yozadi; umumiyga teng boʻlsa olib tashlaydi
function ornat(joy, kalit, qiymat) {
  const k = tahrir, u = zakaz.umumiy;
  if (joy === "s") {
    if (qiymat === u[kalit]) delete k[kalit]; else k[kalit] = qiymat;
  } else {
    k.tanlov = { ...(k.tanlov || {}) };
    if (qiymat == null || qiymat === (u.tanlov || {})[kalit]) delete k.tanlov[kalit]; else k.tanlov[kalit] = qiymat;
    if (!Object.keys(k.tanlov).length) delete k.tanlov;
  }
}

// Eshik furniturasi (foydalanuvchi, 2026-11-07): konstruksiyaga alohida; tanlanmasa — zakazning standarti
function eshikFurnitura(k) {
  const t = k.tanlov || {}, ut = zakaz.umumiy.tanlov || {};
  const bolim = (nom, kalit, royxat, asos) => {
    const std = ut[kalit] ?? asos;
    return `<div class="sz-bolim">${nom}</div>
    <div class="sz-seg sz-fur">${[[null, `Standart <small>${esc(std || "—")}</small>`], ...royxat.map((x) => [x, esc(x)])]
      .map(([v, y]) => `<button data-sz="t:${kalit}" data-v="${esc(JSON.stringify(v))}" class="${(v == null ? t[kalit] == null : t[kalit] === v) ? " faol" : ""}">${y}</button>`).join("")}</div>`;
  };
  return `<div class="sz-sarlavha">Eshik furniturasi</div>` +
    bolim("Ruchka", "ruchka", ESHIK_RUCHKA, ESHIK_RUCHKA[0]) +
    bolim("Zamok", "zamok", ZAMOKLAR, ZAMOKLAR[0]) +
    bolim("Petlya", "petlya", PETLYALAR, PETLYALAR[0]);
}

function sozlamaOynasi() {
  const k = tahrir;
  const lap = k.tur === "lapshali";
  const j = joriy(k);
  const faol = (shart) => (shart ? " faol" : "");
  const turkum = RANG_TURKUMLARI.find((r) => r[0] === j.rang) || RANG_TURKUMLARI[2];
  const alohida = k.rama != null || k.oyna_qalinligi != null || (k.tanlov && Object.keys(k.tanlov).length);
  const gul = (o) => (o.toLowerCase().includes("gul") ? ";background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 7px)" : "");
  $("k-maydon").innerHTML = `
    <div class="sz-seg"><button class="faol">Termo 70 (BKT 70)</button><button disabled>Alumin</button><button disabled>Plast</button></div>

    <div class="sz-bolim">Oyna</div>
    <div class="sz-seg">${[[24, "24 mm (ikki qavat)"], [32, "32 mm"]].map(([v, y]) => `<button data-sz="s:oyna_qalinligi" data-v="${v}" class="${faol(j.qal === v)}">${y}</button>`).join("")}</div>
    <div class="sz-oynalar">${oynaTurlari().map((o) => `<button data-sz="t:oyna_turi" data-v="${esc(JSON.stringify(o))}" class="sz-oyna${faol(j.oyna === o)}"><span class="namuna" style="background:${oynaRangi(o)}${gul(o)}"></span>${esc(o)}</button>`).join("")}</div>

    <div class="sz-bolim">Rama profili</div>
    <div class="sz-ramalar">${RAMALAR.map(([v, y, iz]) => `<button data-sz="s:rama" data-v="${esc(JSON.stringify(v))}" class="sz-rama${faol(j.rama === v)}"><svg viewBox="0 0 40 40" class="ik"><path d="M6 34V6h28" fill="none" stroke="currentColor" stroke-width="${v === "F703" ? 6 : 3.5}"/></svg><b>${y}</b><span>${iz}</span></button>`).join("")}</div>

    <div class="sz-bolim">Rang</div>
    <div class="sz-seg">${RANG_TURKUMLARI.map(([v, y]) => `<button data-sz="t:rang" data-v="${esc(JSON.stringify(v))}" class="${faol(j.rang === v)}">${y}</button>`).join("")}</div>
    <div class="sz-ranglar">${turkum[2].map(([v, y, c]) => `<button data-sz="t:rang_nomi" data-v="${esc(JSON.stringify(v))}" class="sz-rang${faol((j.rangNomi ?? turkum[2][0][0]) === v)}"><span class="namuna" style="background:${c}"></span>${y}</button>`).join("")}</div>

    <div class="sz-bolim">Podokonnik <span class="xira">(uzunligi L + 15 sm, rangi rom rangida)</span></div>
    <div class="sz-seg sz-pod">${[[null, "Yoʻq"], ...[15, 20, 25, 30, 35, 40, 45].map((v) => [v, String(v)])].map(([v, y]) => `<button data-sz="t:podokonnik" data-v="${JSON.stringify(v)}" class="${faol(j.pod === v)}">${y}</button>`).join("")}</div>

    <div class="sz-bolim">Eshik profili <span class="xira">(ochilishi shundan)</span></div>
    <div class="sz-seg">${[["ichkariga", "Balkon Qanot V708 · ichkariga"], ["tashqariga", "Balkon Oʻrta V707 · tashqariga"]].map(([v, y]) => `<button data-sz-esh="${v}" class="${faol(joriyOchilish(k) === v)}">${y}</button>`).join("")}</div>
    ${eshiklar(k.bolak).length ? eshikFurnitura(k) : ""}

    <div class="sz-bolim">Konstruksiya</div>
    <div class="panjara">
      <label>Nomi<input data-m="nom" value="${esc(k.nom)}"></label>
      <label>Soni<input data-m="soni" type="number" inputmode="numeric" min="1" step="1" value="${esc(k.soni ?? 1)}"></label>
    </div>
    <label class="belgi"><input type="checkbox" data-m="lapsha" ${lap ? "checked" : ""}> Yon oynalar alohida ramada, lapsha bilan (tashqariga eshik)</label>
    ${lap ? `<div class="panjara">
      <label>Chap oyna eni, sm<input data-m="chap" type="number" inputmode="decimal" step="0.1" value="${esc(k.chap ?? "")}" placeholder="yoʻq"></label>
      <label>Oʻng oyna eni, sm<input data-m="ong" type="number" inputmode="decimal" step="0.1" value="${esc(k.ong ?? "")}" placeholder="yoʻq"></label>
    </div>` : ""}
    <p class="xira sz-izoh">${alohida ? "Bu konstruksiyada zakazdan farqli tanlov bor." : "Hamma tanlov zakazning umumiy tanlovi bilan bir xil."}</p>
    <button data-sz-asosiy class="tugma keng"${alohida ? "" : " disabled"}>Shu tanlovni butun zakaz uchun asosiy qilish</button>`;
  $("sozlama-oyna").hidden = false;
}

$("k-maydon").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.szEsh) {
    saqlaTarix();
    eshikOchilish = b.dataset.szEsh;
    for (const e of eshiklar(tahrir.bolak)) e.ochilish = eshikOchilish;
  } else if (b.dataset.szAsosiy != null) {
    // Shu konstruksiya tanlovini umumiyga koʻchiramiz, boshqalardagi bir xil qiymatlarni tozalaymiz
    const k = tahrir, u = zakaz.umumiy;
    for (const kalit of ["rama", "oyna_qalinligi"]) if (k[kalit] != null) { u[kalit] = k[kalit]; delete k[kalit]; }
    if (k.tanlov) { u.tanlov = { ...u.tanlov, ...k.tanlov }; delete k.tanlov; }
    for (const boshqa of zakaz.konstruksiyalar) {
      for (const kalit of ["rama", "oyna_qalinligi"]) if (boshqa[kalit] === u[kalit]) delete boshqa[kalit];
      if (boshqa.tanlov) {
        for (const [a, v] of Object.entries(boshqa.tanlov)) if (u.tanlov[a] === v) delete boshqa.tanlov[a];
        if (!Object.keys(boshqa.tanlov).length) delete boshqa.tanlov;
      }
    }
    saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  } else if (b.dataset.sz) {
    saqlaTarix();
    const [joy, kalit] = b.dataset.sz.split(":");
    const v = JSON.parse(b.dataset.v);
    ornat(joy, kalit, v);
    // rang turkumi almashsa, rang nomi shu turkumning birinchisi boʻladi
    if (kalit === "rang") ornat("t", "rang_nomi", RANG_TURKUMLARI.find((r) => r[0] === v)[2][0][0]);
  } else return;
  sozlamaOynasi();
  yangila();
});

function maydonOzgardi(e) {
  const el = e.target.closest("[data-m]");
  if (!el) return;
  const m = el.dataset.m;
  const k = tahrir;
  if (m === "nom") k.nom = el.value;
  else if (m === "soni") k.soni = Math.max(1, parseInt(el.value) || 1);
  else if (m === "L" || m === "H" || m === "chap" || m === "ong") {
    const x = sonOl(el.value);
    if (x == null || x <= 0) { if (m === "chap" || m === "ong") delete k[m]; else return; } else k[m] = x;
  } else if (m === "lapsha") {
    if (el.checked) { k.tur = "lapshali"; k.chap = k.chap ?? 50; k.ong = k.ong ?? 50; delete k.arka; }
    else { delete k.tur; delete k.chap; delete k.ong; }
    sozlamaOynasi();
  }
  yangila();
}

// ---------- hodisalar ----------
$("k-maydon").addEventListener("change", (e) => { saqlaTarix(); maydonOzgardi(e); });
$("k-sozlama").addEventListener("click", sozlamaOynasi);
$("sozlama-yop").addEventListener("click", () => { $("sozlama-oyna").hidden = true; });
$("k-bolimlar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.bolim) { bolim = b.dataset.bolim; asbob = null; }
  else if (b.dataset.tarix === "orqaga" && orqaga.length) { oldinga.push(nusxa(tahrir)); tahrir = orqaga.pop(); }
  else if (b.dataset.tarix === "oldinga" && oldinga.length) { orqaga.push(nusxa(tahrir)); tahrir = oldinga.pop(); }
  else return;
  if (!tugun(tahrir.bolak, tanlangan) || tugun(tahrir.bolak, tanlangan).tur === "bolinish") tanlangan = geometriya(tahrir).barglar[0].p;
  yangila();
});
$("k-asboblar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (surildi) { surildi = false; return; }  // surib tashlangandan keyingi "click" hisoblanmaydi
  if (bolim === "shakl" && b.dataset.asbob) { shaklniQolla(b.dataset.asbob); return; }
  if (b.dataset.ochilish != null) eshikOchilish = eshikOchilish === "ichkariga" ? "tashqariga" : "ichkariga";
  else asbob = asbob === b.dataset.asbob ? null : b.dataset.asbob;
  yangila();
});
$("k-chizma").addEventListener("click", (e) => {
  const ol_ = e.target.closest("[data-ol]");
  if (ol_) { olchamniOzgartir(ol_.dataset.ol); return; }
  const r = e.target.closest("[data-p]");
  if (!r) return;
  if (asbob) { asbobniQolla(r.dataset.p); return; }
  tanlangan = r.dataset.p;
  yangila();
});
$("k-panel").addEventListener("change", (e) => {
  const el = e.target.closest("[data-maydon-oyna]");
  if (!el) return;
  const b = tugun(tahrir.bolak, tanlangan);
  saqlaTarix();
  if (el.value) b.oyna_turi = el.value; else delete b.oyna_turi;
  yangila();
});
$("k-panel").addEventListener("click", (e) => {
  const el = e.target.closest("[data-amal]");
  if (!el) return;
  const b = tugun(tahrir.bolak, tanlangan);
  saqlaTarix();
  const v = JSON.parse(el.dataset.v);
  if (el.dataset.amal === "turi") {
    delete b.dvaynoy; delete b.fortochka; delete b.ruchka; delete b.petlya_tomoni;
    if (v === "dvaynoy") b.dvaynoy = true;
    if (v === "fortochka") b.fortochka = true;
  } else if (el.dataset.amal === "ruchka") { if (v) b.ruchka = true; else delete b.ruchka; }
  else b[el.dataset.amal] = v;
  yangila();
});
$("k-saqla").addEventListener("click", () => konstruktorniYop(true));
$("k-bekor").addEventListener("click", () => konstruktorniYop(false));
$("k-tozala").addEventListener("click", () => {
  const b = $("k-tozala");
  if (!b.classList.contains("tasdiq")) { b.classList.add("tasdiq"); setTimeout(() => b.classList.remove("tasdiq"), 3000); xabar("Hammasini tozalash uchun yana bosing"); return; }
  b.classList.remove("tasdiq");
  saqlaTarix();
  tahrir.bolak = { tur: "gluxoy" };
  delete tahrir.tur; delete tahrir.chap; delete tahrir.ong;
  tanlangan = "";
  yangila();
});

// ---------- umumiy tanlovlar ----------
function sozlamaniChiz() {
  const u = zakaz.umumiy, t = u.tanlov || (u.tanlov = {});
  // tanlanmasa standart (foydalanuvchi, 2026-11-07)
  if (t.ruchka == null) t.ruchka = ESHIK_RUCHKA[0];
  if (t.zamok == null) t.zamok = ZAMOKLAR[0];
  const qator = (yorliq, html) => `<label>${yorliq}${html}</label>`;
  const qoshib = (royxat, qiymat) => (qiymat != null && !royxat.includes(qiymat) ? [qiymat, ...royxat] : royxat).map((x) => [x, x]);
  $("sozlama").innerHTML = `<div class="panjara">
    ${qator("Zakaz nomi", `<input data-s="nom" value="${esc(zakaz.nom || "")}">`)}
    ${qator("Rama", tanlov("s:rama", u.rama, [["F702", "F702"], ["F703", "F703"]]))}
    ${qator("Rang", tanlov("t:rang", t.rang, qoshib(RANGLAR, t.rang)))}
    ${qator("Steklopaket", tanlov("t:oyna_turi", t.oyna_turi, qoshib(oynaTurlari(), t.oyna_turi)))}
    ${qator("Oyna qalinligi", tanlov("s:oyna_qalinligi", u.oyna_qalinligi ?? 24, [[24, "24 mm"], [32, "32 mm"]]))}
    ${qator("Eshik ruchkasi", tanlov("t:ruchka", t.ruchka, qoshib(ESHIK_RUCHKA, t.ruchka)))}
    ${qator("Zamok", tanlov("t:zamok", t.zamok, qoshib(ZAMOKLAR, t.zamok)))}
    ${qator("Petlya", tanlov("t:petlya", t.petlya ?? PETLYALAR[0], qoshib(PETLYALAR, t.petlya)))}
    ${qator("Impost soedineli", tanlov("t:impost_soedinitel", t.impost_soedinitel ?? "ugol", [["ugol", "01.553 ugol"], ["J01+J05", "236 J01 + J05"]]))}
    ${qator("Vertikal shtapik", tanlov("t:vertikal_shtapik", t.vertikal_shtapik ?? "R", [["R", "G…-R"], ["oddiy", "oddiy G"]]))}
    ${qator("Montaj (pena)", tanlov("t:montaj", !!t.montaj, [[false, "yoʻq"], [true, "bor"]]))}
  </div>`;
}

$("sozlama").addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.s === "nom") zakaz.nom = el.value;
  else if (el.dataset.m) {
    const [joy, kalit] = el.dataset.m.split(":");
    const v = JSON.parse(el.value);
    const obj = joy === "s" ? zakaz.umumiy : zakaz.umumiy.tanlov;
    if (v == null) delete obj[kalit]; else obj[kalit] = v;
  } else return;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
});

// ---------- surib chizish (Romchi kabi): asbobni bosib turib boʻlakka olib borish ----------
// Barmoq ostidagi boʻlak yashil boʻladi, impost asbobida uning tushadigan joyi chiziq bilan koʻrinadi.
let surish = null, surildi = false;

function nishonniTozala() {
  document.querySelectorAll("#k-chizma .nishon").forEach((el) => el.classList.remove("nishon"));
  document.querySelectorAll("#k-chizma .korinish").forEach((el) => el.remove());
}

function nishonniKorsat(p, id) {
  nishonniTozala();
  if (p == null) return;
  const rect = document.querySelector(`#k-chizma [data-p="${p}"]`);
  if (!rect) return;
  rect.classList.add("nishon");
  const o = geometriya(tahrir).barglar.find((x) => x.p === p);
  if (!o) return;
  const svg = document.querySelector("#k-chizma svg");
  const chiz = (x1, y1, x2, y2) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
    l.setAttribute("class", "korinish");
    svg.appendChild(l);
  };
  const n = id === "tik3" || id === "yotiq3" ? 3 : 2;
  for (let j = 1; j < n; j++) {
    if (id === "tik" || id === "tik3" || id === "shtulp") chiz(o.x + (o.w * j) / n, o.y, o.x + (o.w * j) / n, o.y + o.h);
    if (id === "yotiq" || id === "yotiq3") chiz(o.x, o.y + (o.h * j) / n, o.x + o.w, o.y + (o.h * j) / n);
  }
}

function barmoqOstidagiBolak(x, y) {
  const el = document.elementFromPoint(x, y);
  const r = el && el.closest && el.closest("#k-chizma [data-p]");
  return r ? r.dataset.p : null;
}

$("k-asboblar").addEventListener("pointerdown", (e) => {
  const b = e.target.closest("button[data-asbob]");
  if (!b || !tahrir || bolim === "shakl") return;
  surish = { id: b.dataset.asbob, x0: e.clientX, y0: e.clientY, kochdi: false, soya: null, p: null, tugma: b };
});

document.addEventListener("pointermove", (e) => {
  if (!surish) return;
  if (!surish.kochdi) {
    if (Math.hypot(e.clientX - surish.x0, e.clientY - surish.y0) < 8) return;
    surish.kochdi = true;
    const soya = document.createElement("div");
    soya.className = "surish-soya";
    soya.innerHTML = surish.tugma.innerHTML;
    document.body.appendChild(soya);
    surish.soya = soya;
    try { surish.tugma.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  e.preventDefault();
  surish.soya.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 72}px)`;
  // soya barmoq ustida (tepada) turadi, boʻlak barmoq uchidan aniqlanadi
  const p = barmoqOstidagiBolak(e.clientX, e.clientY);
  if (p !== surish.p) { surish.p = p; nishonniKorsat(p, surish.id); }
}, { passive: false });

function surishniTugat(qollansin) {
  if (!surish) return;
  const s_ = surish;
  surish = null;
  if (s_.soya) s_.soya.remove();
  nishonniTozala();
  if (!s_.kochdi) return;
  surildi = true;
  setTimeout(() => { surildi = false; }, 400);
  if (qollansin && s_.p != null) {
    const avvalgi = asbob;
    asbob = s_.id;
    asbobniQolla(s_.p);
    asbob = avvalgi;
    yangila();
  }
}
document.addEventListener("pointerup", () => surishniTugat(true));
document.addEventListener("pointercancel", () => surishniTugat(false));
