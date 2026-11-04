// 2D konstruktor: konstruksiyani chizib zakaz JSON (hisob.py formati) ni tuzadi.
// Daraxt: bolak = gluxoy | tabaqa (dvaynoy) | eshik | bolinish (yonalish, olchamlar, bolaklar).
// Faqat chizish uchun qoʻshimcha kalitlar: petlya_tomoni, aktiv (hisobga taʼsir qilmaydi).
"use strict";

const RANGLAR = ["Laminatsiya", "Svetnoy (kraska)", "Oq", "Anod"];
const ESHIK_RUCHKA = ["Komfort dver ruchka", "Stublina 1177", "Stublina 1177 (Uz)", "Ruchka Dver (1076.92.28) (Qora)"];
const ZAMOKLAR = ["Zamok Dver (3147) (Otvetka) (Tr)", "TERMO Zamok Dvernoy GIESSE", "Stublina Serbia"];
const PETLYALAR = ["(A8060) 2SK TERMO Petlya (Tr)", "(A8060) 2SK TERMO Petlya (Uz)", "(A9211.3) 2SK TERMO Petlya (Tr)"];

const nusxa = (x) => JSON.parse(JSON.stringify(x));
let tahrir = null;      // tahrirlanayotgan konstruksiya (nusxa)
let tahrirIndeks = -1;  // zakazdagi oʻrni, yangi boʻlsa -1
let tanlangan = "";     // tanlangan boʻlak yoʻli: "" ildiz, "1.0" ...
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
function tugun(ildiz, p) { let b = ildiz; for (const i of yolQism(p)) b = b.bolaklar[i]; return b; }
function ota(p) { const q = yolQism(p); return q.length ? { yol: q.slice(0, -1).join("."), i: q[q.length - 1] } : null; }
function almashtir(p, yangi) {
  if (p === "") { tahrir.bolak = yangi; return; }
  const o = ota(p);
  tugun(tahrir.bolak, o.yol).bolaklar[o.i] = yangi;
}

function bolish(p, yonalish) {
  const b = tugun(tahrir.bolak, p);
  const o = ota(p);
  const otaB = o ? tugun(tahrir.bolak, o.yol) : null;
  if (otaB && otaB.yonalish === yonalish) {
    otaB.bolaklar.splice(o.i + 1, 0, { tur: "gluxoy" });
    otaB.olchamlar.splice(o.i + 1, 0, null);
    tanlangan = o.yol ? o.yol + "." + (o.i + 1) : String(o.i + 1);
    return;
  }
  // Yangi boʻlinish: kamida bitta oʻlcham kerak (hisob.py qoidasi) — birinchisiga yarmini yozamiz
  const [w, h] = olchamTaxmin(p);
  const yarmi = Math.round((yonalish === "vertikal" ? w : h) / 2 * 10) / 10;
  almashtir(p, { tur: "bolinish", yonalish, olchamlar: [yarmi, null], bolaklar: [b, { tur: "gluxoy" }] });
  tanlangan = p === "" ? "1" : p + ".1";
}

function ochir(p) {
  const o = ota(p);
  if (!o) return;
  const otaB = tugun(tahrir.bolak, o.yol);
  otaB.bolaklar.splice(o.i, 1);
  otaB.olchamlar.splice(o.i, 1);
  if (otaB.bolaklar.length === 1) { almashtir(o.yol, otaB.bolaklar[0]); tanlangan = o.yol; }
  else {
    if (otaB.olchamlar.every((x) => x == null)) otaB.olchamlar[0] = Math.round(olchamTaxmin(o.yol)[otaB.yonalish === "vertikal" ? 0 : 1] / otaB.olchamlar.length * 10) / 10;
    tanlangan = o.yol ? o.yol + "." + Math.max(0, o.i - 1) : String(Math.max(0, o.i - 1));
  }
}

// ---------- geometriya (faqat chizish uchun, taxminiy) ----------
function taqsimla(olchamlar, jami) {
  const berilgan = olchamlar.filter((x) => x != null).reduce((a, b) => a + Number(b), 0);
  const boshlar = olchamlar.filter((x) => x == null).length;
  const ulush = boshlar ? (jami - berilgan) / boshlar : 0;
  return olchamlar.map((x) => (x == null ? ulush : Number(x)));
}

function ramalar(k) {
  const L = Number(k.L) || 0, H = Number(k.H) || 0;
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

function barglar(b, x, y, w, h, p, out, imp) {
  if (b.tur === "bolinish") {
    const v = b.yonalish === "vertikal";
    const s = taqsimla(b.olchamlar, v ? w : h);
    let q = v ? x : y;
    s.forEach((o, i) => {
      if (i > 0) imp.push(v ? { x1: q, y1: y, x2: q, y2: y + h } : { x1: x, y1: q, x2: x + w, y2: q });
      const bola = p === "" ? String(i) : p + "." + i;
      if (v) barglar(b.bolaklar[i], q, y, o, h, bola, out, imp);
      else barglar(b.bolaklar[i], x, q, w, o, bola, out, imp);
      q += o;
    });
  } else out.push({ b, x, y, w, h, p });
}

function olchamTaxmin(p) {
  const asosiy = ramalar(tahrir).find((r) => r.asosiy);
  const out = [], imp = [];
  barglar(tahrir.bolak, asosiy.x, 0, asosiy.w, Number(tahrir.H), "", out, imp);
  const bor = out.find((o) => o.p === p);
  if (bor) return [bor.w, bor.h];
  // ichki tugun: bolalari chegarasi
  const ichida = out.filter((o) => o.p === p || o.p.startsWith(p === "" ? "" : p + "."));
  const x1 = Math.min(...ichida.map((o) => o.x)), x2 = Math.max(...ichida.map((o) => o.x + o.w));
  const y1 = Math.min(...ichida.map((o) => o.y)), y2 = Math.max(...ichida.map((o) => o.y + o.h));
  return [x2 - x1, y2 - y1];
}

// ---------- SVG ----------
const yx = (v) => Math.round(v * 10) / 10;
function chizmaSVG(k, opts = {}) {
  const L = Number(k.L) || 1, H = Number(k.H) || 1;
  const t = Math.max(2.5, Math.min(7, Math.min(L, H) * 0.045));
  const pad = opts.kichik ? t : Math.max(L, H) * 0.11;
  const shrift = Math.max(L, H) * 0.045;
  let s = "";
  const rect = (x, y, w, h, cls, qosh = "") => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" class="${cls}" ${qosh}/>`;
  const chiziq = (x1, y1, x2, y2, cls = "ch") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const matn = (x, y, m, kat = 1, qosh = "") => `<text x="${x}" y="${y}" font-size="${shrift * kat}" class="yoz" text-anchor="middle" dominant-baseline="middle" ${qosh}>${esc(m)}</text>`;

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

  for (const r of ramalar(k)) {
    s += rect(r.x, 0, r.w, H, "ra");
    if (!r.asosiy) { s += rect(r.x + t, t, r.w - 2 * t, H - 2 * t, "oy"); continue; }
    const out = [], imp = [];
    barglar(k.bolak, r.x, 0, r.w, H, "", out, imp);
    for (const o of out) {
      const x = o.x + t * 0.5, y = o.y + t * 0.5, w = o.w - t, h = o.h - t;
      const b = o.b;
      if (b.tur === "gluxoy") s += rect(x + t * 0.3, y + t * 0.3, w - t * 0.6, h - t * 0.6, "oy");
      else if (b.tur === "tabaqa") s += tabaqa(x, y, w, h, b.petlya_tomoni || "chap", b.dvaynoy, true);
      else if (b.tur === "eshik") {
        if (b.tabaqa_soni === 2) {
          const aktiv = b.aktiv || "ong";
          s += tabaqa(x, y, w / 2, h, "chap", false, aktiv === "chap") + tabaqa(x + w / 2, y, w / 2, h, "ong", false, aktiv === "ong");
        } else s += tabaqa(x, y, w, h, b.petlya_tomoni || "chap", false, true);
        if (!opts.kichik) s += matn(o.x + o.w / 2, o.y + o.h - t * 2.2, b.ochilish === "tashqariga" ? "tashqariga" : "ichkariga", 0.6);
      } else s += rect(x, y, w, h, "xt");
      if (!opts.kichik) {
        s += matn(o.x + o.w / 2, o.y + o.h / 2, `${yx(o.w)}×${yx(o.h)}`, 0.7, 'class="yoz fon"');
        s += rect(o.x, o.y, o.w, o.h, "bos" + (o.p === opts.tanlangan ? " tanl" : ""), `data-p="${o.p}"`);
      }
    }
    for (const c of imp) s += c.x1 === c.x2 ? rect(c.x1 - t / 2, c.y1 + t, t, c.y2 - c.y1 - 2 * t, "ra im") : rect(c.x1 + t, c.y1 - t / 2, c.x2 - c.x1 - 2 * t, t, "ra im");
  }
  if (!opts.kichik) {
    s += matn(L / 2, -pad * 0.45, `L = ${yx(L)}`, 0.9);
    s += matn(-pad * 0.45, H / 2, `H = ${yx(H)}`, 0.9, `transform="rotate(-90 ${-pad * 0.45} ${H / 2})"`);
  }
  const vb = `${-pad} ${-pad} ${L + 2 * pad} ${H + 2 * pad}`;
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="chizma${opts.kichik ? " kichik" : ""}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

// ---------- tahrirlash oynasi ----------
function tanlov(nom, qiymat, variantlar) {
  return `<select data-m="${nom}">${variantlar.map(([v, y]) => `<option value="${esc(JSON.stringify(v))}"${JSON.stringify(v) === JSON.stringify(qiymat) ? " selected" : ""}>${esc(y)}</option>`).join("")}</select>`;
}
const tugmalar = (amal, qiymat, variantlar) => `<div class="seg">${variantlar.map(([v, y]) => `<button data-amal="${amal}" data-v="${esc(JSON.stringify(v))}" class="${JSON.stringify(v) === JSON.stringify(qiymat) ? "faol" : ""}">${esc(y)}</button>`).join("")}</div>`;

function konstruktorniOch(i) {
  tahrirIndeks = i;
  tahrir = i >= 0 ? nusxa(zakaz.konstruksiyalar[i]) : { nom: "K" + (zakaz.konstruksiyalar.length + 1), soni: 1, L: 150, H: 150, bolak: { tur: "gluxoy" } };
  tanlangan = "";
  $("asosiy").hidden = true;
  $("konstruktor").hidden = false;
  window.scrollTo(0, 0);
  konstruktorniChiz();
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
  $("konstruktor").hidden = true;
  $("asosiy").hidden = false;
  hisobla();
}

function konstruktorniChiz() {
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
  chizmaVaPanel();
}

function chizmaVaPanel() {
  $("k-chizma").innerHTML = chizmaSVG(tahrir, { tanlangan });
  const b = tugun(tahrir.bolak, tanlangan);
  const o = ota(tanlangan);
  const otaB = o ? tugun(tahrir.bolak, o.yol) : null;
  const [w, h] = olchamTaxmin(tanlangan);
  const tur = b.tur === "tabaqa" ? (b.dvaynoy ? "dvaynoy" : "tabaqa") : b.tur;
  let p = `<div class="xira">Tanlangan boʻlak ≈ ${yx(w)} × ${yx(h)} sm. Boshqasini tanlash uchun rasmda bosing.</div>
    <div class="sarlavha">Turi</div>
    ${tugmalar("tur", tur, [["gluxoy", "Gluxoy"], ["tabaqa", "Tabaqa"], ["dvaynoy", "Dvaynoy"], ["eshik", "Eshik"]])}`;
  if (tur === "tabaqa" || tur === "dvaynoy" || (tur === "eshik" && b.tabaqa_soni !== 2)) {
    p += `<div class="sarlavha">Petlya tomoni</div>${tugmalar("petlya_tomoni", b.petlya_tomoni || "chap", [["chap", "Chap"], ["ong", "Oʻng"]])}`;
  }
  if (tur === "eshik") {
    p += `<div class="sarlavha">Tabaqa soni</div>${tugmalar("tabaqa_soni", b.tabaqa_soni, [[1, "1 tabaqa"], [2, "2 tabaqa"]])}
      <div class="sarlavha">Ochilishi</div>${tugmalar("ochilish", b.ochilish, [["ichkariga", "Ichkariga"], ["tashqariga", "Tashqariga"]])}`;
    if (b.tabaqa_soni === 2) p += `<div class="sarlavha">Ruchkali (aktiv) tabaqa</div>${tugmalar("aktiv", b.aktiv || "ong", [["chap", "Chap"], ["ong", "Oʻng"]])}`;
  }
  p += `<div class="sarlavha">Impost qoʻshish</div>
    <div class="seg"><button data-amal="bol" data-v="&quot;vertikal&quot;">│ Tik impost</button><button data-amal="bol" data-v="&quot;gorizontal&quot;">─ Yotiq impost</button></div>`;
  if (otaB) {
    const v = otaB.yonalish === "vertikal";
    const qiymat = otaB.olchamlar[o.i];
    p += `<div class="sarlavha">Shu boʻlak ${v ? "eni" : "boʻyi"}, sm (chetdan impost oʻrtasigacha)</div>
      <div class="qator"><input id="k-olcham" type="number" inputmode="decimal" step="0.1" value="${qiymat ?? ""}" placeholder="boʻsh = qolgani teng"><button class="tugma" data-amal="ochir">Boʻlakni oʻchirish</button></div>`;
  }
  $("k-panel").innerHTML = p;
  oldindanHisobla();
}

function oldindanHisobla() {
  clearTimeout(oldindanTaymer);
  $("k-holat").textContent = "Hisoblanmoqda…";
  $("k-holat").className = "xira";
  oldindanTaymer = setTimeout(() => {
    if (!tahrir) return;
    const d = pyTannarx({ umumiy: zakaz.umumiy, konstruksiyalar: [{ ...tahrir, nom: tahrir.nom || "K", soni: 1 }] });
    if (d.xato) { $("k-holat").textContent = d.xato; $("k-holat").className = "ogoh"; return; }
    const k = d.ok.konstruksiyalar[0];
    const oy = d.ok.oynalar.map((o) => `${o.joy} ${son(o.en, 2)}×${son(o.boy, 2)}${o.soni > 1 ? " ×" + o.soni : ""}`).join("; ");
    $("k-holat").innerHTML = `<b>1 dona: ${usd(k.bir_dona_usd)}</b>${k.izoh ? `<br><span class="ogoh">${esc(k.izoh)}</span>` : ""}<br><span class="xira">Oynalar: ${esc(oy)}</span>`;
    $("k-holat").className = "";
  }, 250);
}

function sonOl(v) { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : null; }

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
    konstruktorniChiz();
    return;
  }
  chizmaVaPanel();
}

function panelAmal(e) {
  const el = e.target.closest("[data-amal]");
  if (!el) return;
  const v = el.dataset.v ? JSON.parse(el.dataset.v) : null;
  const b = tugun(tahrir.bolak, tanlangan);
  switch (el.dataset.amal) {
    case "tur":
      if (v === "gluxoy") almashtir(tanlangan, { tur: "gluxoy" });
      else if (v === "tabaqa" || v === "dvaynoy") almashtir(tanlangan, { tur: "tabaqa", petlya_tomoni: b.petlya_tomoni || "chap", ...(v === "dvaynoy" ? { dvaynoy: true } : {}) });
      else if (v === "eshik") almashtir(tanlangan, { tur: "eshik", tabaqa_soni: b.tabaqa_soni || 2, ochilish: b.ochilish || "ichkariga" });
      break;
    case "petlya_tomoni": case "tabaqa_soni": case "ochilish": case "aktiv":
      b[el.dataset.amal] = v;
      break;
    case "bol": bolish(tanlangan, v); break;
    case "ochir": ochir(tanlangan); break;
    default: return;
  }
  chizmaVaPanel();
}

function olchamOzgardi(e) {
  if (e.target.id !== "k-olcham") return;
  const o = ota(tanlangan);
  const otaB = tugun(tahrir.bolak, o.yol);
  const x = sonOl(e.target.value);
  otaB.olchamlar[o.i] = x != null && x > 0 ? x : null;
  $("k-chizma").innerHTML = chizmaSVG(tahrir, { tanlangan });
  oldindanHisobla();
}

$("k-maydon").addEventListener("change", maydonOzgardi);
$("k-maydon").addEventListener("input", (e) => { if (e.target.matches("input[type=number]")) maydonOzgardi(e); });
$("k-panel").addEventListener("click", panelAmal);
$("k-panel").addEventListener("input", olchamOzgardi);
$("k-chizma").addEventListener("click", (e) => {
  const r = e.target.closest("[data-p]");
  if (!r) return;
  tanlangan = r.dataset.p;
  chizmaVaPanel();
});
$("k-saqla").addEventListener("click", () => konstruktorniYop(true));
$("k-bekor").addEventListener("click", () => konstruktorniYop(false));

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
