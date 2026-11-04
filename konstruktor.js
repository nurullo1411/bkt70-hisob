// 2D konstruktor (Romchi uslubida): tepada asboblar, asbobni tanlab boʻlakka bosiladi,
// oʻlcham chiziqlari rasm atrofida, raqamga bosib oʻzgartiriladi. Natija — zakaz JSON (hisob.py formati).
// Daraxt: bolak = gluxoy | tabaqa (dvaynoy) | eshik | bolinish (yonalish, olchamlar, bolaklar).
// Faqat chizish uchun kalitlar: petlya_tomoni, aktiv (hisobga taʼsir qilmaydi).
"use strict";

const RANGLAR = ["Laminatsiya", "Svetnoy (kraska)", "Oq", "Anod"];
const ESHIK_RUCHKA = ["Komfort dver ruchka", "Stublina 1177", "Stublina 1177 (Uz)", "Ruchka Dver (1076.92.28) (Qora)"];
const ZAMOKLAR = ["Zamok Dver (3147) (Otvetka) (Tr)", "TERMO Zamok Dvernoy GIESSE", "Stublina Serbia"];
const PETLYALAR = ["(A8060) 2SK TERMO Petlya (Tr)", "(A8060) 2SK TERMO Petlya (Uz)", "(A9211.3) 2SK TERMO Petlya (Tr)"];

const nusxa = (x) => JSON.parse(JSON.stringify(x));
let tahrir = null;      // tahrirlanayotgan konstruksiya (nusxa)
let tahrirIndeks = -1;  // zakazdagi oʻrni, yangi boʻlsa -1
let tanlangan = "";     // tanlangan boʻlak yoʻli: "" ildiz, "1.0" ...
let bolim = "impost";   // asboblar boʻlimi
let asbob = null;       // tanlangan asbob yoki null (tanlash rejimi)
let eshikOchilish = "ichkariga";
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
  if (otaB && otaB.tur === "bolinish" && otaB.yonalish === yonalish) {
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

// Barglar (boʻlaklar), impostlar va boʻlinishlar (oʻlcham zanjiri uchun)
function joyla(b, x, y, w, h, p, g, chuqur = 0) {
  if (b.tur === "bolinish") {
    const v = b.yonalish === "vertikal";
    const s = taqsimla(b.olchamlar, v ? w : h);
    g.bolinishlar.push({ p, v, x, y, w, h, s, olchamlar: b.olchamlar, chuqur });
    let q = v ? x : y;
    s.forEach((o, i) => {
      if (i > 0) g.impostlar.push(v ? { x1: q, y1: y, x2: q, y2: y + h } : { x1: x, y1: q, x2: x + w, y2: q });
      if (v) joyla(b.bolaklar[i], q, y, o, h, bolaYoli(p, i), g, chuqur + 1);
      else joyla(b.bolaklar[i], x, q, w, o, bolaYoli(p, i), g, chuqur + 1);
      q += o;
    });
  } else g.barglar.push({ b, x, y, w, h, p });
}

function geometriya(k) {
  const g = { barglar: [], impostlar: [], bolinishlar: [], ramalar: ramalar(k) };
  const a = g.ramalar.find((r) => r.asosiy);
  joyla(k.bolak, a.x, 0, a.w, Number(k.H) || 0, "", g);
  return g;
}

function olchamTaxmin(p) {
  const g = geometriya(tahrir);
  const bor = g.barglar.find((o) => o.p === p) || g.bolinishlar.find((o) => o.p === p);
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

// ---------- SVG ----------
function chizmaSVG(k, opts = {}) {
  const L = Number(k.L) || 1, H = Number(k.H) || 1;
  const M = Math.max(L, H);
  const t = Math.max(2.5, Math.min(7, Math.min(L, H) * 0.045));
  const g = geometriya(k);
  const shrift = M * 0.04;
  const qadam = M * 0.085;  // oʻlcham qatorlari orasidagi masofa
  let s = "";
  const rect = (x, y, w, h, cls, qosh = "") => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" class="${cls}" ${qosh}/>`;
  const chiziq = (x1, y1, x2, y2, cls = "ch") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const matn = (x, y, m, kat = 1, cls = "yoz", qosh = "") => `<text x="${x}" y="${y}" font-size="${shrift * kat}" class="${cls}" text-anchor="middle" dominant-baseline="middle" ${qosh}>${esc(m)}</text>`;

  function tabaqa(x, y, w, h, petlya, dvaynoy, ruchkaBor) {
    const i = t * 0.35;
    let q = rect(x + i, y + i, w - 2 * i, h - 2 * i, "tb") + rect(x + i + t * 0.8, y + i + t * 0.8, w - 2 * i - 1.6 * t, h - 2 * i - 1.6 * t, "oy");
    const x1 = x + i + t * 0.8, y1 = y + i + t * 0.8, x2 = x + w - i - t * 0.8, y2 = y + h - i - t * 0.8;
    // uchburchak uchi petlya tomonida
    if (petlya === "ong") q += chiziq(x1, y1, x2, (y1 + y2) / 2) + chiziq(x1, y2, x2, (y1 + y2) / 2);
    else q += chiziq(x2, y1, x1, (y1 + y2) / 2) + chiziq(x2, y2, x1, (y1 + y2) / 2);
    if (dvaynoy) q += chiziq(x1, y1, (x1 + x2) / 2, y2, "ch uz") + chiziq(x2, y1, (x1 + x2) / 2, y2, "ch uz");
    if (ruchkaBor !== false) {
      const rx = petlya === "ong" ? x + i + t * 0.25 : x + w - i - t * 0.55;
      q += rect(rx, y + h / 2 - t * 0.9, t * 0.3, t * 1.8, "ru");
    }
    return q;
  }

  const belgi = opts.kichik ? {} : belgilar(g.barglar);
  for (const r of g.ramalar) {
    s += rect(r.x, 0, r.w, H, "ra");
    if (!r.asosiy) { s += rect(r.x + t, t, r.w - 2 * t, H - 2 * t, "oy"); continue; }
  }
  for (const o of g.barglar) {
    const x = o.x + t * 0.5, y = o.y + t * 0.5, w = o.w - t, h = o.h - t;
    const b = o.b;
    if (b.tur === "gluxoy") s += rect(x + t * 0.3, y + t * 0.3, w - t * 0.6, h - t * 0.6, "oy");
    else if (b.tur === "tabaqa") s += tabaqa(x, y, w, h, b.petlya_tomoni || "chap", b.dvaynoy, true);
    else if (b.tur === "eshik") {
      if (b.tabaqa_soni === 2) {
        const aktiv = b.aktiv || "ong";
        s += tabaqa(x, y, w / 2, h, "chap", false, aktiv === "chap") + tabaqa(x + w / 2, y, w / 2, h, "ong", false, aktiv === "ong");
      } else s += tabaqa(x, y, w, h, b.petlya_tomoni || "chap", false, true);
    } else s += rect(x, y, w, h, "xt");
  }
  for (const c of g.impostlar) s += c.x1 === c.x2 ? rect(c.x1 - t / 2, c.y1 + t, t, c.y2 - c.y1 - 2 * t, "ra im") : rect(c.x1 + t, c.y1 - t / 2, c.x2 - c.x1 - 2 * t, t, "ra im");
  if (!opts.kichik) {
    for (const o of g.barglar) {
      s += matn(o.x + o.w / 2, o.y + o.h / 2, belgi[o.p], 1.1, "yoz fon qalin");
      if (o.b.tur === "eshik") s += matn(o.x + o.w / 2, o.y + o.h / 2 + shrift * 1.4, o.b.ochilish === "tashqariga" ? "tashqariga" : "ichkariga", 0.65, "yoz fon");
      s += rect(o.x, o.y, o.w, o.h, "bos" + (o.p === opts.tanlangan ? " tanl" : ""), `data-p="${o.p}"`);
    }
  }

  // Oʻlcham chiziqlari: tik boʻlinishlar pastda, yotiqlari oʻngda; umumiy L pastda, H chapda
  let pastQator = 0, ongQator = 0;
  const olchamChizigi = (x1, y1, x2, y2, qiymat, avto, kalit) => {
    const yot = y1 === y2;
    const uz = qadam * 0.18;
    let q = chiziq(x1, y1, x2, y2, "ol") +
      (yot ? chiziq(x1, y1 - uz, x1, y1 + uz, "ol") + chiziq(x2, y2 - uz, x2, y2 + uz, "ol")
           : chiziq(x1 - uz, y1, x1 + uz, y1, "ol") + chiziq(x2 - uz, y2, x2 + uz, y2, "ol"));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const yozuv = (avto ? "≈" : "") + yx(qiymat);
    q += yot ? matn(mx, my - shrift * 0.15, yozuv, 0.95, "yoz fon olch" + (avto ? " avto" : ""))
             : matn(mx + shrift * 0.15, my, yozuv, 0.95, "yoz fon olch" + (avto ? " avto" : ""), `transform="rotate(-90 ${mx + shrift * 0.15} ${my})"`);
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
      b.s.forEach((o, i) => { s += olchamChizigi(q, yy, q + o, yy, o, b.olchamlar[i] == null, `${b.p}|${i}`); q += o; });
    }
    for (const b of yotiq) {
      const xx = L + qadam * (++ongQator);
      let q = b.y;
      b.s.forEach((o, i) => { s += olchamChizigi(xx, q, xx, q + o, o, b.olchamlar[i] == null, `${b.p}|${i}`); q += o; });
    }
    if (k.tur === "lapshali") {
      const yy = H + qadam * (++pastQator);
      for (const r of g.ramalar) s += olchamChizigi(r.x, yy, r.x + r.w, yy, r.w, r.asosiy, r.asosiy ? null : (r.x === 0 ? "chap" : "ong"));
    }
    s += olchamChizigi(0, H + qadam * (++pastQator), L, H + qadam * pastQator, L, false, "L");
    s += olchamChizigi(-qadam, 0, -qadam, H, H, false, "H");
  }
  const chap = opts.kichik ? t : qadam * 1.6, tepa = opts.kichik ? t : qadam * 0.6;
  const vb = `${-chap} ${-tepa} ${L + chap + (opts.kichik ? t : qadam * (ongQator + 0.7))} ${H + tepa + (opts.kichik ? t : qadam * (pastQator + 0.7))}`;
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="chizma${opts.kichik ? " kichik" : ""}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
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
    ["shtulp", "Shtulp: 2 tabaqali eshik", ik('<line x1="12" y1="3" x2="12" y2="21" class="q"/><path d="M9 9h6M9 15h6"/>')],
    ["yotiq3", "3 ga boʻlish (yotiq)", ik('<line x1="3" y1="8" x2="21" y2="8" class="q"/><line x1="3" y1="16" x2="21" y2="16" class="q"/>')],
    ["ochir", "Boʻlakni oʻchirish", ik(ramaIk() + '<path d="M8 8l8 8M16 8l-8 8" class="x"/>')],
  ],
  tabaqa: [
    ["tab_chap", "Tabaqa, petlya chapda", ik(ramaIk() + '<path d="M18 5L6 12l12 7"/>')],
    ["tab_ong", "Tabaqa, petlya oʻngda", ik(ramaIk() + '<path d="M6 5l12 7-12 7"/>')],
    ["dv_chap", "Dvaynoy, petlya chapda", ik(ramaIk() + '<path d="M18 5L6 12l12 7"/><path d="M6 5l6 14 6-14" class="uz"/>')],
    ["dv_ong", "Dvaynoy, petlya oʻngda", ik(ramaIk() + '<path d="M6 5l12 7-12 7"/><path d="M6 5l6 14 6-14" class="uz"/>')],
    ["gluxoy", "Gluxoy", ik(ramaIk())],
  ],
  eshik: [
    ["esh1_chap", "1 tabaqa, petlya chapda", ik(ramaIk(6, 12) + '<path d="M16 5L8 12l8 7"/>')],
    ["esh1_ong", "1 tabaqa, petlya oʻngda", ik(ramaIk(6, 12) + '<path d="M8 5l8 7-8 7"/>')],
    ["esh2_ong", "2 tabaqa, ruchka oʻngda", ik(ramaIk(3, 18) + '<line x1="12" y1="3" x2="12" y2="21"/><path d="M11 5L5 12l6 7M13 5l6 7-6 7"/><circle cx="14" cy="12" r="1"/>')],
    ["esh2_chap", "2 tabaqa, ruchka chapda", ik(ramaIk(3, 18) + '<line x1="12" y1="3" x2="12" y2="21"/><path d="M11 5L5 12l6 7M13 5l6 7-6 7"/><circle cx="10" cy="12" r="1"/>')],
    ["gluxoy", "Gluxoy", ik(ramaIk())],
  ],
};
const BOLIMLAR = [
  ["impost", "Impost", ik('<line x1="12" y1="3" x2="12" y2="21" class="q"/>')],
  ["tabaqa", "Tabaqa", ik(ramaIk() + '<path d="M18 5L6 12l12 7"/>')],
  ["eshik", "Eshik", ik(ramaIk(6, 12) + '<circle cx="15" cy="12" r="1"/>')],
];

function asboblarniChiz() {
  $("k-bolimlar").innerHTML = BOLIMLAR.map(([id, nom, i]) => `<button data-bolim="${id}" class="${id === bolim ? "faol" : ""}" title="${nom}" aria-label="${nom}">${i}</button>`).join("") +
    `<span class="bosh"></span><button data-tarix="orqaga" ${orqaga.length ? "" : "disabled"} aria-label="Orqaga">↶</button><button data-tarix="oldinga" ${oldinga.length ? "" : "disabled"} aria-label="Oldinga">↷</button>`;
  let html = ASBOBLAR[bolim].map(([id, nom, i]) => `<button data-asbob="${id}" class="${id === asbob ? "faol" : ""}" title="${nom}" aria-label="${nom}">${i}</button>`).join("");
  if (bolim === "eshik" || (bolim === "impost" && asbob === "shtulp")) html += `<button data-ochilish class="matnli">${eshikOchilish === "tashqariga" ? "Tashqariga" : "Ichkariga"} ⇄</button>`;
  $("k-asboblar").innerHTML = html;
  const nom = asbob ? ASBOBLAR[bolim].find((a) => a[0] === asbob)[1] : null;
  $("k-maslahat").textContent = nom ? `${nom}: rasmdagi boʻlakka bosing` : "Asbob tanlang yoki boʻlakka bosib sozlang. Oʻlchamni oʻzgartirish uchun raqamga bosing.";
}

function saqlaTarix() { orqaga.push(nusxa(tahrir)); if (orqaga.length > 50) orqaga.shift(); oldinga = []; }

function asbobniQolla(p) {
  const b = tugun(tahrir.bolak, p);
  saqlaTarix();
  const tabaqa = (petlya, dv) => ({ tur: "tabaqa", petlya_tomoni: petlya, ...(dv ? { dvaynoy: true } : {}) });
  switch (asbob) {
    case "tik": bolish(p, "vertikal"); break;
    case "yotiq": bolish(p, "gorizontal"); break;
    case "tik3": bolish(p, "vertikal", 3); break;
    case "yotiq3": bolish(p, "gorizontal", 3); break;
    case "shtulp":
      almashtir(p, { tur: "eshik", tabaqa_soni: 2, ochilish: b.tur === "eshik" ? b.ochilish : eshikOchilish, aktiv: b.aktiv || "ong" }); break;
    case "ochir": if (!ochir(p)) { orqaga.pop(); xabar("Bitta boʻlakni oʻchirib boʻlmaydi"); return; } break;
    case "tab_chap": almashtir(p, tabaqa("chap")); break;
    case "tab_ong": almashtir(p, tabaqa("ong")); break;
    case "dv_chap": almashtir(p, tabaqa("chap", true)); break;
    case "dv_ong": almashtir(p, tabaqa("ong", true)); break;
    case "gluxoy": almashtir(p, { tur: "gluxoy" }); break;
    case "esh1_chap": case "esh1_ong":
      almashtir(p, { tur: "eshik", tabaqa_soni: 1, ochilish: eshikOchilish, petlya_tomoni: asbob.endsWith("chap") ? "chap" : "ong" }); break;
    case "esh2_chap": case "esh2_ong":
      almashtir(p, { tur: "eshik", tabaqa_soni: 2, ochilish: eshikOchilish, aktiv: asbob.endsWith("chap") ? "chap" : "ong" }); break;
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
  if (kalit === "L" || kalit === "H" || kalit === "chap" || kalit === "ong") {
    const nom = { L: "Umumiy eni (L), sm", H: "Umumiy boʻyi (H), sm", chap: "Chap yon oyna eni, sm", ong: "Oʻng yon oyna eni, sm" }[kalit];
    const j = await soraSon(nom, tahrir[kalit], false);
    if (!j) return;
    saqlaTarix();
    tahrir[kalit] = j.son;
  } else {
    const [p, i] = kalit.split("|");
    const b = tugun(tahrir.bolak, p);
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

// ---------- tahrirlash oynasi ----------
function konstruktorniOch(i) {
  tahrirIndeks = i;
  tahrir = i >= 0 ? nusxa(zakaz.konstruksiyalar[i]) : { nom: "K" + (zakaz.konstruksiyalar.length + 1), soni: 1, L: 150, H: 150, bolak: { tur: "gluxoy" } };
  tanlangan = geometriya(tahrir).barglar[0].p;
  asbob = null;
  orqaga = []; oldinga = [];
  $("asosiy").hidden = true;
  $("konstruktor").hidden = false;
  window.scrollTo(0, 0);
  yangila();
}

function konstruktorniYop(saqlansin) {
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
  hisobla();
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
  $("asosiy").hidden = true;
  $("konstruktor").hidden = false;
  yangila();
  xabar("Chala chizma tiklandi");
  return true;
}

function yangila() {
  saqla("qoralama", JSON.stringify({ tahrir, indeks: tahrirIndeks, orqaga: orqaga.slice(-20) }));
  $("k-nom").textContent = `${tahrir.nom || ""} · ${yx(Number(tahrir.L))} × ${yx(Number(tahrir.H))}${(tahrir.soni ?? 1) > 1 ? " · " + tahrir.soni + " dona" : ""}`;
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
  const turNomi = { gluxoy: "gluxoy", tabaqa: b.dvaynoy ? "dvaynoy tabaqa" : "tabaqa", eshik: "eshik" }[b.tur];
  let p = `<div class="panel-bosh"><b>${belgi}</b> · ${turNomi} · ≈ ${yx(o.w)} × ${yx(o.h)} sm</div>`;
  if (b.tur === "tabaqa") {
    p += `<div class="sarlavha">Petlya tomoni</div>${tugmalar("petlya_tomoni", b.petlya_tomoni || "chap", [["chap", "Chap"], ["ong", "Oʻng"]])}
      <div class="sarlavha">Turi</div>${tugmalar("dvaynoy", !!b.dvaynoy, [[false, "Oddiy"], [true, "Dvaynoy"]])}`;
  } else if (b.tur === "eshik") {
    p += `<div class="sarlavha">Ochilishi</div>${tugmalar("ochilish", b.ochilish, [["ichkariga", "Ichkariga"], ["tashqariga", "Tashqariga"]])}
      <div class="sarlavha">Tabaqa soni</div>${tugmalar("tabaqa_soni", b.tabaqa_soni, [[1, "1 tabaqa"], [2, "2 tabaqa"]])}`;
    p += b.tabaqa_soni === 2
      ? `<div class="sarlavha">Ruchkali (aktiv) tabaqa</div>${tugmalar("aktiv", b.aktiv || "ong", [["chap", "Chap"], ["ong", "Oʻng"]])}`
      : `<div class="sarlavha">Petlya tomoni</div>${tugmalar("petlya_tomoni", b.petlya_tomoni || "chap", [["chap", "Chap"], ["ong", "Oʻng"]])}`;
  } else p += `<div class="xira">Turini almashtirish uchun tepadan asbob tanlab, boʻlakka bosing.</div>`;
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
    $("k-holat").innerHTML = `<b>1 dona: ${usd(k.bir_dona_usd)}</b>${k.izoh ? `<br><span class="ogoh">${esc(k.izoh)}</span>` : ""}<br><span class="xira">Oynalar: ${esc(oy)}</span>`;
    $("k-holat").className = "";
  }, 250);
}

function sonOl(v) { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : null; }

// ---------- sozlamalar oynasi (⚙) ----------
function tanlov(nom, qiymat, variantlar) {
  return `<select data-m="${nom}">${variantlar.map(([v, y]) => `<option value="${esc(JSON.stringify(v))}"${JSON.stringify(v) === JSON.stringify(qiymat) ? " selected" : ""}>${esc(y)}</option>`).join("")}</select>`;
}

function sozlamaOynasi() {
  const k = tahrir;
  const lap = k.tur === "lapshali";
  $("k-maydon").innerHTML = `
    <div class="panjara">
      <label>Nomi<input data-m="nom" value="${esc(k.nom)}"></label>
      <label>Soni<input data-m="soni" type="number" inputmode="numeric" min="1" step="1" value="${esc(k.soni ?? 1)}"></label>
      <label>L (eni), sm<input data-m="L" type="number" inputmode="decimal" step="0.1" value="${esc(k.L)}"></label>
      <label>H (boʻyi), sm<input data-m="H" type="number" inputmode="decimal" step="0.1" value="${esc(k.H)}"></label>
      <label>Rama${tanlov("rama", k.rama ?? null, [[null, "umumiy (" + (zakaz.umumiy.rama || "") + ")"], ["F702", "F702"], ["F703", "F703"]])}</label>
      <label>Steklopaket${tanlov("oyna_turi", (k.tanlov || {}).oyna_turi ?? null, [[null, "umumiy (" + (zakaz.umumiy.tanlov.oyna_turi || "") + ")"], ...oynaTurlari().map((x) => [x, x])])}</label>
    </div>
    <label class="belgi"><input type="checkbox" data-m="lapsha" ${lap ? "checked" : ""}> Yon oynalar alohida ramada, lapsha bilan (tashqariga eshik)</label>
    ${lap ? `<div class="panjara">
      <label>Chap oyna eni, sm<input data-m="chap" type="number" inputmode="decimal" step="0.1" value="${esc(k.chap ?? "")}" placeholder="yoʻq"></label>
      <label>Oʻng oyna eni, sm<input data-m="ong" type="number" inputmode="decimal" step="0.1" value="${esc(k.ong ?? "")}" placeholder="yoʻq"></label>
    </div>` : ""}`;
  $("sozlama-oyna").hidden = false;
}

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
  } else if (m === "rama") {
    const v = JSON.parse(el.value);
    if (v == null) delete k.rama; else k.rama = v;
  } else if (m === "oyna_turi") {
    const v = JSON.parse(el.value);
    k.tanlov = { ...(k.tanlov || {}) };
    if (v == null) delete k.tanlov.oyna_turi; else k.tanlov.oyna_turi = v;
    if (!Object.keys(k.tanlov).length) delete k.tanlov;
  } else if (m === "lapsha") {
    if (el.checked) { k.tur = "lapshali"; k.chap = k.chap ?? 50; k.ong = k.ong ?? 50; }
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
$("k-panel").addEventListener("click", (e) => {
  const el = e.target.closest("[data-amal]");
  if (!el) return;
  const b = tugun(tahrir.bolak, tanlangan);
  saqlaTarix();
  const v = JSON.parse(el.dataset.v);
  if (el.dataset.amal === "dvaynoy") { if (v) b.dvaynoy = true; else delete b.dvaynoy; }
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
  const qator = (yorliq, html) => `<label>${yorliq}${html}</label>`;
  const qoshib = (royxat, qiymat) => (qiymat != null && !royxat.includes(qiymat) ? [qiymat, ...royxat] : royxat).map((x) => [x, x]);
  $("sozlama").innerHTML = `<div class="panjara">
    ${qator("Zakaz nomi", `<input data-s="nom" value="${esc(zakaz.nom || "")}">`)}
    ${qator("Rama", tanlov("s:rama", u.rama, [["F702", "F702"], ["F703", "F703"]]))}
    ${qator("Rang", tanlov("t:rang", t.rang, qoshib(RANGLAR, t.rang)))}
    ${qator("Steklopaket", tanlov("t:oyna_turi", t.oyna_turi, qoshib(oynaTurlari(), t.oyna_turi)))}
    ${qator("Oyna qalinligi", tanlov("s:oyna_qalinligi", u.oyna_qalinligi ?? 24, [[24, "24 mm"], [32, "32 mm"]]))}
    ${qator("Eshik ruchkasi", tanlov("t:ruchka", t.ruchka ?? null, [[null, "—"], ...qoshib(ESHIK_RUCHKA, t.ruchka)]))}
    ${qator("Zamok", tanlov("t:zamok", t.zamok ?? null, [[null, "—"], ...qoshib(ZAMOKLAR, t.zamok)]))}
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
