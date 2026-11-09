// BKT 70 hisob: zakaz JSON → tannarx. Hisob mantigʻi Python (Pyodide) da, loyihadagi fayllarning oʻzi.
"use strict";

// narxlar.json ilovada yoʻq (ochiq repo): foydalanuvchi bir marta yuklaydi, telefonda saqlanadi.
const PY_FAYLLAR = ["hisob.py", "hisobot.py", "zakaz.py", "raskroy.py", "tannarx.py", "narx_sheets.py", "diller.py"];
const $ = (id) => document.getElementById(id);
let py = null;
let zakaz = null;
let natija = null;

function saqla(kalit, qiymat) {
  try { localStorage.setItem(kalit, qiymat); } catch (e) {}
  if (kalit === "oxirgi_zakaz") arxivga(qiymat);
}
function ol(kalit) { try { return localStorage.getItem(kalit); } catch (e) { return null; } }

const usd = (x) => x == null ? "—" : x.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
const som = (x) => Math.round(x).toLocaleString("ru-RU") + " soʻm";
const son = (x, k = 3) => Number(x.toFixed(k)).toLocaleString("ru-RU", { maximumFractionDigits: k });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function holat(matn) { $("holat").textContent = matn; }
function xato(matn) { const e = $("xato"); e.textContent = matn || ""; e.hidden = !matn; }

async function yukla() {
  try {
    holat("Python yuklanmoqda…");
    py = await loadPyodide();
    const versiya = await (await fetch("py/versiya.txt", { cache: "no-cache" })).text().catch(() => "");
    for (const f of PY_FAYLLAR) {
      const javob = await fetch("py/" + f);
      if (!javob.ok) throw new Error(f + " topilmadi");
      py.FS.writeFile("/home/pyodide/" + f, await javob.text());
    }
    py.runPython("import sys; sys.path.insert(0, '/home/pyodide'); import json, tannarx, hisob");
    $("versiya").dataset.hisob = versiya.trim() || "nusxa";
    // Sheets dan olingan oxirgi narx saytdagi narxlar.enc dan yangiroq: avval u
    if (!narxlarniQoy(ol("narxlar_jonli") || await shifrliNarx() || ol("narxlar"))) { jonliNarx(); return; }
    jonliNarx();
    const oxirgi = ol("oxirgi_zakaz");
    if (oxirgi) zakazniOch(oxirgi, true);
    zakazlarniOl();
    if (zakaz) qoralamaniTikla();
  } catch (e) {
    holat("Xato");
    xato("Dastur yuklanmadi: " + e.message + ". Birinchi marta ochishda internet kerak.");
  }
}

// Shifrlangan narxlar (narxlar.enc) saytda turadi. Kalit faqat havoladagi #k= da keladi,
// serverga yuborilmaydi va telefonda saqlanadi. Har ochilishda yangi narx olinadi; internet boʻlmasa null.
async function shifrliOch(fayl) {
  const kalitMatn = ol("narx_kalit");
  if (!kalitMatn) return null;
  try {
    const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
    const javob = await fetch(fayl, { cache: "no-cache" });
    if (!javob.ok) return null;
    const baytlar = b64((await javob.text()).trim());
    const kalit = await crypto.subtle.importKey("raw", b64(kalitMatn), "AES-GCM", false, ["decrypt"]);
    const ochiq = await crypto.subtle.decrypt({ name: "AES-GCM", iv: baytlar.slice(0, 12) }, kalit, baytlar.slice(12));
    return new TextDecoder().decode(ochiq);
  } catch (e) {
    return null;
  }
}

async function shifrliNarx() {
  const m = location.hash.match(/k=([A-Za-z0-9_-]+)/);
  if (m) { saqla("narx_kalit", m[1]); history.replaceState(null, "", location.pathname); }
  const kalitMatn = ol("narx_kalit");
  if (!kalitMatn) return null;
  try {
    const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
    const javob = await fetch("narxlar.enc", { cache: "no-cache" });
    if (!javob.ok) return null;
    const baytlar = b64((await javob.text()).trim());
    const kalit = await crypto.subtle.importKey("raw", b64(kalitMatn), "AES-GCM", false, ["decrypt"]);
    const ochiq = await crypto.subtle.decrypt({ name: "AES-GCM", iv: baytlar.slice(0, 12) }, kalit, baytlar.slice(12));
    return new TextDecoder().decode(ochiq);
  } catch (e) {
    return null;
  }
}

// Jonli narx: "bkt 70 hisoblash" (Narxlar, Malumot, Hisob!F5) Apps Script orqali (sklad bilan bitta manzil, kalit bilan).
// narx_sheets.py narxlar.json shaklini tuzadi. Internet boʻlmasa oxirgi olingani qoladi.
async function jonliNarx(qolda) {
  if (!py) return;
  const url = await shifrliOch("sklad.enc");
  if (!url) { if (qolda) xato("Sheets ulanmagan (narx havolasi ochilmagan)"); return; }
  if (qolda) holat("Narx olinmoqda…");
  let j;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 20000);
    j = await fetch(url + "&t=narx", { signal: c.signal }).then((r) => r.json());
    clearTimeout(t);
  } catch (e) { if (qolda) { holat("Tayyor"); xato("Sheets ga ulanib boʻlmadi: internetni tekshiring"); } return; }
  if (!j || j.xato) { if (qolda) xato("Sheets: " + ((j && j.xato) || "javob yoʻq")); return; }
  py.globals.set("_nj", JSON.stringify(j));
  let matn;
  try {
    matn = py.runPython(`import narx_sheets
json.dumps(narx_sheets.tuz(json.loads(_nj)), ensure_ascii=False)`);
  } catch (e) { if (qolda) xato("Sheets narxlari oʻqilmadi: " + e.message.split("\n").slice(-2).join(" ")); return; }
  const toza = (m) => { try { const o = JSON.parse(m); delete o.manba; delete o.kurs; return JSON.stringify(o); } catch (e) { return ""; } };
  const ozgardi = toza(ol("narxlar")) !== toza(matn);
  if (!narxlarniQoy(matn)) return;
  saqla("narxlar_jonli", matn);
  if (ozgardi && zakaz) hisobla();
  holat(ozgardi ? "Narxlar Sheets dan yangilandi" : "Tayyor");
  if (qolda && !ozgardi) holat("Narxlar oʻzgarmagan");
}

// Narxlar faylini tekshirib Python ga beradi. Muvaffaqiyatli boʻlsa true.
function narxlarniQoy(matn) {
  let narx = null;
  try { narx = matn ? JSON.parse(matn) : null; } catch (e) { narx = null; }
  const togri = narx && narx.profil_hivich && narx.narx && narx.hivich_m;
  $("narx-quti").hidden = !!togri;
  if (!togri) {
    holat("Narx kerak");
    if (matn) xato("Bu fayl narxlar fayli emas (narxlar.json kerak).");
    return false;
  }
  py.FS.writeFile("/home/pyodide/narxlar.json", matn);
  saqla("narxlar", matn);
  if (!$("kurs").value) $("kurs").value = ol("kurs") || narx.kurs || 12000;
  $("versiya").textContent = "Hisob: " + $("versiya").dataset.hisob + " · Narxlar: " + (narx.manba || "yuklangan").slice(0, 80);
  holat("Tayyor");
  return true;
}

function zakazniOch(matn, jim) {
  if (!ol("narxlar")) { xato("Avval narxlar faylini yuklang."); return; }
  try {
    zakaz = JSON.parse(matn);
  } catch (e) {
    if (!jim) xato("JSON notogri: " + e.message);
    return;
  }
  belgila(zakaz);
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
  if (!jim) ekran("zakaz");
}

// ---------- ekranlar: bosh sahifa → boʻlim roʻyxati → zakaz (telefonning ← tugmasi ham ishlaydi) ----------
let joriyEkran = "bosh";
function ekran(nom, push = true) {
  for (const e of ["bosh", "royxat", "zakaz", "kassa", "katalog"]) $("e-" + e).hidden = e !== nom;
  if (push && nom !== joriyEkran) history.pushState({ ekran: nom }, "");
  joriyEkran = nom;
  $("orqaga").hidden = nom === "bosh";
  const bolim = BOSH_BOLIMLAR.find((h) => h[0] === arxivTab) || HOLATLAR.find((h) => h[0] === arxivTab);
  $("sarlavha").textContent = nom === "bosh" ? "BKT 70 hisob" : nom === "royxat" ? bolim[1] : nom === "kassa" ? "Hisobot" : nom === "katalog" ? "Katalog" : "Buyurtma maʼlumotlari";
  if (nom === "kassa") { hbChiz(); kassaYangila(); }
  else if (nom === "katalog") katalogChiz();
  else if (nom !== "zakaz") { arxivniChiz(); zakazlarniOl(); }
  window.scrollTo(0, 0);
}
let ichkiOrqaga = false, chiqishTasdiq = false;
window.addEventListener("popstate", (e) => {
  if (ichkiOrqaga) { ichkiOrqaga = false; return; }
  if (!$("konstruktor").hidden) {
    // Konstruktorda ← : chizma oʻzgargan boʻlsa ikkinchi bosishda chiqadi
    if (orqaga.length && !chiqishTasdiq) {
      history.pushState({ ekran: "konstruktor" }, "");
      chiqishTasdiq = true;
      setTimeout(() => { chiqishTasdiq = false; }, 3000);
      xabar("Saqlamasdan chiqish uchun yana bir marta ← bosing");
      return;
    }
    chiqishTasdiq = false;
    konstruktorniYop(false, true);
    return;
  }
  ekran((e.state && e.state.ekran) || "bosh", false);
});
history.replaceState({ ekran: "bosh" }, "");

// ---------- zakazlar arxivi (Romchi "Buyurtmalar"): telefonda saqlanadi ----------
// Zakaz holatlari (foydalanuvchi, 2026-11-08). Montajsiz zakaz "Sex tugallangan" da tugaydi.
const HOLATLAR = [["hisoblangan", "Hisoblangan"], ["shartnoma", "Shartnoma tuzildi"], ["sex_jarayon", "Sex jarayonda"],
  ["sex_tugadi", "Sex tugallangan"], ["montaj_jarayon", "Montaj jarayonda"], ["montaj_tugadi", "Montaj tugallangan"]];
const HOLAT_ZANJIR = HOLATLAR.map((h) => h[0]);
const ESKI_HOLAT = { yangi: "hisoblangan", jarayonda: "sex_jarayon", qarzdor: "montaj_tugadi", tugatilgan: "montaj_tugadi" };
const holatOl = (z) => ESKI_HOLAT[z.holat] || z.holat || "hisoblangan";
const holatNomi = (h) => (HOLATLAR.find((x) => x[0] === h) || [h, h])[1];
const montajBor = (z) => z.montaj !== false;
// Bosh sahifa boʻlimi: Hisoblangan · Boshlangan (shartnomadan montaj tugaguncha) · Tugallangan
function bolimi(z) {
  const h = holatOl(z);
  if (h === "hisoblangan") return "yangi";
  if (h === "montaj_tugadi" || (h === "sex_tugadi" && !montajBor(z))) return "tugatilgan";
  return "jarayonda";
}
// Bosh sahifa boʻlimlari (foydalanuvchi, 2026-11-07); qarzdor hozircha tugallanganlar ichida
const BOSH_BOLIMLAR = [["yangi", "Hisoblangan buyurtmalar", ["yangi"]], ["jarayonda", "Boshlangan ishlar", ["jarayonda"]],
  ["tugatilgan", "Tugallangan ishlar", ["tugatilgan", "qarzdor"]]];
function arxivOl() { try { return JSON.parse(ol("zakazlar") || "[]"); } catch (e) { return []; } }
function arxivYoz(a) { try { localStorage.setItem("zakazlar", JSON.stringify(a)); } catch (e) {} }
function belgila(z) {
  if (z.id) return;
  const raqam = Number(ol("zakaz_raqam") || 0) + 1;
  try { localStorage.setItem("zakaz_raqam", String(raqam)); } catch (e) {}
  z.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  z.raqam = raqam;
  z.sana = new Date().toISOString().slice(0, 10);
  z.holat = "hisoblangan";
}
function arxivga(matn) {
  let z;
  try { z = JSON.parse(matn); } catch (e) { return; }
  if (!z || !z.id) return;
  const a = arxivOl().filter((x) => x.id !== z.id);
  if (z.konstruksiyalar && z.konstruksiyalar.length) { a.unshift(z); zakazNavbatga(z.id); }
  arxivYoz(a);
  arxivniChiz();
}
let arxivTab = "yangi";
// Roʻyxatdan keyingi boʻlimga oʻtkazish (foydalanuvchi, 2026-11-07)
let holatTasdiq = null; // "id|holat" — tasdiq kutilayotgan oʻtkazish
function keyingiHolat(z) {
  const h = holatOl(z), i = HOLAT_ZANJIR.indexOf(h);
  const OT = [];
  if (i > 0) OT.push([HOLAT_ZANJIR[i - 1], "← " + holatNomi(HOLAT_ZANJIR[i - 1]), "orqa"]);
  const oxiri = h === "montaj_tugadi" || (h === "sex_tugadi" && !montajBor(z));
  if (!oxiri) {
    const k = HOLAT_ZANJIR[i + 1];
    OT.push([k, holatNomi(k) + (k === "montaj_tugadi" || (k === "sex_tugadi" && !montajBor(z)) ? " ✓" : " →"), k.endsWith("tugadi") ? "yashil" : ""]);
  }
  const tugmalar = OT.map(([yangi, y, kl]) => {
    const kalit = `${z.id}|${yangi}`;
    if (holatTasdiq === kalit) return `<span class="holat-tasdiq">${esc(y)} — tasdiqlaysizmi?
      <button data-holatga="${kalit}" class="kichik-t ha">Ha</button><button data-holat-yoq="1" class="kichik-t">Yoʻq</button></span>`;
    return `<button data-holat-sora="${kalit}" class="kichik-t ${kl}">${esc(y)}</button>`;
  });
  return tugmalar.length ? `<div class="holat-ot">${tugmalar.join("")}</div>` : "";
}
// Zakaz pul holati: shartnoma summasi, kassadan toʻlangan (bazadan), qarz
function pulHolati(z) {
  const sh = shartnomaSumma(z);
  const p = (x) => (sh.valyuta === "USD" ? usd(x) : som(x));
  if (z.tolangan == null || !z.baza_id) return sh.summa ? p(sh.summa) : "—";
  const qarz = sh.summa - z.tolangan;
  return `${p(sh.summa)} · toʻlangan ${p(z.tolangan)}${Math.abs(qarz) > 0.009 ? ` · <b class="${qarz > 0 ? "qarz" : "ortiq"}">${qarz > 0 ? "qarz" : "ortiqcha"} ${p(Math.abs(qarz))}</b>` : " ✓"}`;
}
function arxivniChiz() {
  const a = arxivOl();
  const narxi = (z) => { const sh = shartnomaSumma(z); return sh.valyuta === "USD" ? sh.summa * (Number(ol("kurs")) || 0) : sh.summa; };
  const BELGI = { yangi: ["🧮", "#e3f2fd", "#1e88e5"], jarayonda: ["🛠", "#fff8e1", "#f9a825"], qarzdor: ["⏰", "#ffebee", "#e53935"], tugatilgan: ["✔", "#e8f5e9", "#43a047"] };
  $("arxiv-tablar").innerHTML = BOSH_BOLIMLAR.map(([k, y, hl]) => {
    const t = a.filter((z) => bolimi(z) === k);
    const [b, fon, rang] = BELGI[k];
    return `<button data-tab="${k}" class="bolim-k" style="--b-rang:${rang};--b-fon:${fon}"><span class="bolim-yuqori"><span class="bolim-belgi">${b}</span></span>
      <span class="bolim-matn2"><b>${y}</b><span class="bolim-summa">${t.length ? som(t.reduce((s, z) => s + narxi(z), 0)) : "—"}</span></span><span class="bolim-katta">${t.length}</span></button>`;
  }).join("");
  const dv = $("davom");
  dv.hidden = !(zakaz && zakaz.konstruksiyalar && zakaz.konstruksiyalar.length);
  if (!dv.hidden) dv.innerHTML = `<span class="xira">Oxirgi ochilgan</span><b>№${esc(zakaz.raqam ?? "")} · ${esc((zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "")}</b><span class="bolim-oq">›</span>`;
  let t = a.filter((z) => bolimi(z) === arxivTab);
  // BTB ustalar: hamma zakazi bitta guruhda, ism ostida (foydalanuvchi, 2026-11-08)
  const btbNom = (z) => (z.mijoz && z.mijoz.btb && z.mijoz.ism ? z.mijoz.ism.trim() : "");
  const tartib = [];
  for (const z of t) {
    const g = btbNom(z);
    if (!g) { tartib.push(z); continue; }
    if (tartib.some((x) => x.guruh === g)) continue;
    const ich = t.filter((x) => btbNom(x) === g);
    tartib.push({ guruh: g, soni: ich.length, summa: ich.reduce((s2, x) => s2 + narxi(x), 0) }, ...ich);
  }
  t = tartib;
  $("arxiv").innerHTML = t.map((z) => z.guruh ? `<div class="btb-guruh"><b>BTB · ${esc(z.guruh)}</b><span>${z.soni} ta · ${som(z.summa)}</span></div>` : `<div class="arxiv-k${zakaz && zakaz.id === z.id ? " joriy" : ""}${btbNom(z) ? " btb" : ""}">
      <div class="arxiv-eskiz">${z.konstruksiyalar[0] ? chizmaSVG(z.konstruksiyalar[0], { kichik: true }) : ""}</div>
      <div class="arxiv-matn"><span class="xira">${z.baza_id ? `<b class="id-teg">ID ${z.baza_id}</b> ` : `№${esc(z.raqam ?? "")} · `}${esc(z.sana || "")} · ${esc(holatNomi(holatOl(z)))}${montajBor(z) ? "" : " · montajsiz"}</span>
        <b>${esc((z.mijoz && z.mijoz.ism) || z.nom || "Mijoz")}</b>
        <span class="pul-holat">${pulHolati(z)}</span></div>
      ${keyingiHolat(z)}<div class="arxiv-tugma"><button data-och="${z.id}" class="tugma asosiy">Ochish</button><button data-dub="${z.id}" class="tugma">Dublikat</button><button data-arx-ochir="${z.id}" class="tugma">Oʻchirish</button></div>
    </div>`).join("") || '<p class="xira">Bu boʻlimda zakaz yoʻq.</p>';
}

// Profil otxodi usuli har seriya uchun alohida, telefonda saqlanadi (foydalanuvchi, 2026-11-05). Hozir faqat Termo 70.
const SERIYA = "Termo 70";
function otxodUsuli(seriya = SERIYA) {
  try { return (JSON.parse(ol("otxod_usuli") || "{}"))[seriya] || "chegara"; } catch (e) { return "chegara"; }
}
function otxodUsuliniSaqla(usul, seriya = SERIYA) {
  let o = {};
  try { o = JSON.parse(ol("otxod_usuli") || "{}"); } catch (e) { o = {}; }
  o[seriya] = usul;
  saqla("otxod_usuli", JSON.stringify(o));
}

// Python hisobi: {ok: natija} yoki {xato: matn}
function pyTannarx(z) {
  const usul = otxodUsuli();
  const sk = usul.startsWith("sklad") ? skladSaqlangan() : null;
  py.globals.set("_zakaz", JSON.stringify(z));
  py.globals.set("_kurs", Number($("kurs").value) || 12000);
  py.globals.set("_ou", usul);
  py.globals.set("_osk", sk ? JSON.stringify(sk.qatorlar) : "null");
  try {
    return JSON.parse(py.runPython(`
try:
    _natija = json.dumps({"ok": tannarx.tannarx(json.loads(_zakaz), kurs=_kurs, otxod_usuli=_ou, sklad=json.loads(_osk))}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _natija = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_natija`));
  } catch (e) {
    return { xato: "Kutilmagan xato: " + e.message.split("\n").slice(-2).join(" ") };
  }
}

// Ekran avval chiziladi, hisob keyin: "Saqlash" bosilganda ilova qotib turmasin
let hisobNavbat = 0;
function hisoblaKeyin() {
  const n = ++hisobNavbat;
  const eski = $("holat").textContent;
  holat("Hisoblanmoqda…");
  requestAnimationFrame(() => setTimeout(() => {
    if (n !== hisobNavbat) return;
    hisobla();
    if ($("holat").textContent === "Hisoblanmoqda…") holat(eski);
  }, 0));
}

function hisobla() {
  hisobNavbat++;
  if (!py || !zakaz) return;
  xato("");
  zakaz.konstruksiyalar = zakaz.konstruksiyalar || [];
  zakaz.umumiy = zakaz.umumiy || { tanlov: {} };
  $("zakaz-ish").hidden = false;
  sozlamaniChiz();
  natija = null;
  if (zakaz.konstruksiyalar.length) {
    const d = pyTannarx(zakaz);
    if (d.xato) xato(d.xato); else natija = d.ok;
  }
  $("natija").hidden = !natija;
  if (natija) chiz();
  royxatniChiz();
  kesishEskirgan = true;
  if (natija && $("kesish-quti").open) kesishniChiz();
}

const yuza = (k) => (Number(k.L) || 0) * (Number(k.H) || 0) / 10000;
const m2 = (x) => son(x, 2) + " m²";

function royxatniChiz() {
  const n = natija;
  const sonlar = zakaz.konstruksiyalar.map((k) => k.soni ?? 1);
  $("x-soni").textContent = sonlar.reduce((a, b) => a + b, 0);
  $("x-m2").textContent = m2(zakaz.konstruksiyalar.reduce((a, k, i) => a + yuza(k) * sonlar[i], 0));
  mijozniChiz();
  $("zakaz-nomi").textContent = (zakaz.nom ? zakaz.nom + " · " : "") + zakaz.konstruksiyalar.length + " ta konstruksiya";
  // Konstruksiyalar: soni 0 boʻlganlari ham koʻrinadi, qaytarish uchun
  const hisoblangan = Object.fromEntries((n ? n.konstruksiyalar : []).map((k) => [k.nom, k]));
  $("konstruksiyalar").innerHTML = zakaz.konstruksiyalar.map((k, i) => {
    const nom = k.nom || "K" + (i + 1);
    const h = hisoblangan[nom];
    const soni = k.soni ?? 1;
    const u = zakaz.umumiy, t = { ...(u.tanlov || {}), ...(k.tanlov || {}) };
    const teglar = [k.rama || u.rama, t.rang_nomi || t.rang, (t.oyna_turi || "") + " " + (k.oyna_qalinligi || u.oyna_qalinligi || 24) + " mm", t.podokonnik ? "podokonnik " + t.podokonnik : null];
    return `<div class="konstr${soni === 0 ? " nol" : ""}">
      <div class="konstr-ichi">
        <button class="eskiz" data-tahrir="${i}" aria-label="Tahrirlash">${chizmaSVG(k, { kichik: true })}</button>
        <div class="konstr-matn">
          <div class="konstr-bosh"><b>${esc(nom)}</b><span>${esc(k.L)} × ${esc(k.H)}</span></div>
          <div class="teglar">${teglar.filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
          <div class="xira">Yuzasi: ${m2(yuza(k))}${soni > 1 ? ` · jami ${m2(yuza(k) * soni)}` : ""}</div>
          <div class="konstr-past">
            <div class="soni"><button data-i="${i}" data-d="-1" aria-label="Kamaytirish">−</button><span>${soni}</span><button data-i="${i}" data-d="1" aria-label="Koʻpaytirish">+</button></div>
            <div style="text-align:right">${h ? `<div class="xira">1 dona ${usd(h.bir_dona_usd)}</div><b>${usd(h.jami_usd)}</b>` : `<span class="xira">${soni === 0 ? "hisobga kirmaydi" : "—"}</span>`}</div>
          </div>
        </div>
      </div>
      ${h && h.izoh ? `<div class="ogoh xira">${esc(h.izoh)}</div>` : ""}
      <input class="eslatma" data-eslatma="${i}" value="${esc(k.eslatma || "")}" placeholder="Izoh qoʻshish (masalan: 2-qavat, oshxona)" autocomplete="off">
      ${h && xarajatOchiq.has(nom) ? xarajatHtml(nom) : ""}
      <div class="kichik-tugmalar">${h ? `<button data-xarajat="${esc(nom)}">${xarajatOchiq.has(nom) ? "Yopish" : "Xarajat"}</button>` : ""}<button data-tahrir="${i}">Tahrirlash</button><button data-nusxa="${i}">Nusxa</button><button data-ochir="${i}">Oʻchirish</button></div>
    </div>`;
  }).join("") || '<p class="xira">Konstruksiya yoʻq. Pastdagi tugma bilan qoʻshing.</p>';
}

// ---------- hisob-kitob (Romchi kabi): tannarx, ustama, chegirma, avans, qoldiq ----------
// Chegirma va avans soʻmda saqlanadi; USD rejimida kurs bilan oʻgiriladi.
function hk() { zakaz.hisob_kitob = zakaz.hisob_kitob || {}; return zakaz.hisob_kitob; }
function valyuta() { return ol("valyuta") === "usd" ? "usd" : "som"; }
function pul(usdQiymat) { return valyuta() === "usd" ? usd(usdQiymat) : som(usdQiymat * natija.kurs); }

// Ustama har seriyaga alohida (foydalanuvchi, 2026-11-09: Termoni baland, Aldoksni past foizda sotib boʻlmaydi).
// Zakazda hisob_kitob.ustama_seriya {seriya: foiz}; berilmagan seriyaga oxirgi kiritilgan foiz (localStorage
// "ustama_seriya") yoziladi va zakazda muzlatiladi. Eski zakazdagi yagona ustama_foiz hamma seriyaga.
function ustamaStandart() { try { return JSON.parse(ol("ustama_seriya")) || {}; } catch (e) { return {}; } }
function ustamalar(n = natija) {
  const h = hk(), st = ustamaStandart(), guruh = new Map();
  for (const k of n.konstruksiyalar) {
    const s = k.seriya || "Termo 70";
    guruh.set(s, (guruh.get(s) || 0) + k.jami_usd);
  }
  let yozildi = false;
  const roy = [...guruh].map(([seriya, tannarx]) => {
    let foiz = h.ustama_seriya && h.ustama_seriya[seriya];
    if (foiz == null) foiz = h.ustama_foiz != null ? Number(h.ustama_foiz) : null;
    if (foiz == null && st[seriya] > 0) { h.ustama_seriya = h.ustama_seriya || {}; foiz = h.ustama_seriya[seriya] = st[seriya]; yozildi = true; }
    foiz = Number(foiz) || 0;
    return { seriya, tannarx, foiz, ustama: tannarx * foiz / 100 };
  });
  if (yozildi) saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  return roy;
}
function ustamaKoef(n, seriya) { const u = ustamalar(n).find((x) => x.seriya === (seriya || "Termo 70")); return 1 + (u ? u.foiz : 0) / 100; }

function hisobKitobniChiz() {
  const n = natija, h = hk(), kurs = n.kurs, v = valyuta();
  const otxod = n.materiallar.filter((m) => m.bolim === "Profil otxod").reduce((a, m) => a + (m.summa || 0), 0);
  document.querySelectorAll("[data-valyuta]").forEach((b) => b.classList.toggle("faol", b.dataset.valyuta === v));
  $("j-mat").textContent = pul(n.materiallar_usd - otxod);
  $("j-otx").textContent = pul(otxod);
  $("otxod-usul").value = n.otxod_usuli;
  $("j-str").textContent = pul(n.straxovka_usd);
  $("j-tan").textContent = pul(n.jami_usd);
  $("j-tan2").textContent = v === "usd" ? som(n.jami_som) : usd(n.jami_usd);
  const ust = ustamalar(n);
  const ustama = ust.reduce((a, u) => a + u.ustama, 0);
  const mijozga = n.jami_usd + ustama;
  const qut = $("hk-ustamalar"), kal = ust.map((u) => u.seriya).join("|");
  if (qut.dataset.kal !== kal) {
    qut.dataset.kal = kal;
    qut.innerHTML = ust.map((u) => `<div class="hk-maydon"><label>Ustama${ust.length > 1 || u.seriya !== "Termo 70" ? " — " + esc(u.seriya) : " (foyda)"}, %<input data-ust-seriya="${esc(u.seriya)}" type="number" inputmode="decimal" min="0" step="1" placeholder="0"></label><b data-ust-summa="${esc(u.seriya)}"></b></div>`).join("");
  }
  for (const u of ust) {
    const inp = qut.querySelector(`[data-ust-seriya="${CSS.escape(u.seriya)}"]`), b = qut.querySelector(`[data-ust-summa="${CSS.escape(u.seriya)}"]`);
    if (document.activeElement !== inp) inp.value = u.foiz || "";
    b.textContent = u.ustama ? "+ " + pul(u.ustama) : "";
  }
  const chegirma = (Number(h.chegirma_som) || 0) / kurs, avans = (Number(h.avans_som) || 0) / kurs;
  $("j-mijoz").textContent = pul(mijozga);
  $("x-narx").textContent = pul(mijozga);
  $("j-tolov").textContent = pul(mijozga - chegirma);
  $("j-qoldiq").textContent = pul(mijozga - chegirma - avans);
  const narxSom = Math.round((mijozga - chegirma) * kurs);
  if (zakaz.narx_som !== narxSom) { zakaz.narx_som = narxSom; saqla("oxirgi_zakaz", JSON.stringify(zakaz)); }
  const sh = shartnomaSumma(zakaz);
  if (document.activeElement !== $("sh-summa")) $("sh-summa").value = zakaz.shartnoma && zakaz.shartnoma.summa ? zakaz.shartnoma.summa : "";
  $("sh-summa").placeholder = zakaz.narx_som ? String(zakaz.narx_som) + " (mijozga narx)" : "";
  document.querySelectorAll("[data-shv]").forEach((b) => b.classList.toggle("faol", b.dataset.shv === sh.valyuta));
  document.querySelectorAll("[data-montaj]").forEach((b) => b.classList.toggle("faol", (b.dataset.montaj === "1") === montajBor(zakaz)));
  $("sh-holat").innerHTML = `${zakaz.baza_id ? `<b class="id-teg">ID ${zakaz.baza_id}</b> · ` : ""}${esc(holatNomi(holatOl(zakaz)))}<br>${pulHolati(zakaz)}` +
    (bazaUlangan() ? "" : `<br><span class="xira">Bazaga ulanmagan: ID va toʻlov chiqmaydi</span>`);
  $("holatlar").innerHTML = keyingiHolat(zakaz);
  $("m-btb").checked = !!(zakaz.mijoz && zakaz.mijoz.btb);
  const ish = zakaz.ish || {};
  document.querySelectorAll("[data-ish]").forEach((el) => { if (document.activeElement !== el) el.value = ish[el.dataset.ish] ?? ""; });
  $("ish-termo").placeholder = son(zakazM2(zakaz), 2) + " (avto)";
  const korsat = (s) => (s ? (v === "usd" ? Math.round(s / kurs * 100) / 100 : s) : "");
  if (document.activeElement !== $("hk-chegirma")) $("hk-chegirma").value = korsat(h.chegirma_som);
  if (document.activeElement !== $("hk-avans")) $("hk-avans").value = korsat(h.avans_som);
  document.querySelectorAll(".hk-birlik").forEach((s) => { s.textContent = v === "usd" ? "$" : "soʻm"; });
}

function mijozniChiz() {
  const m = zakaz.mijoz || {};
  document.querySelectorAll("[data-mijoz]").forEach((el) => { if (document.activeElement !== el) el.value = m[el.dataset.mijoz] || ""; });
}

// ---------- konstruksiya xarajati (Romchi "Xarajatni koʻrish"): 1 dona uchun ----------
const xarajatOchiq = new Set();
function xarajatHtml(nom) {
  const n = natija, j = n.konstruksiyalar.findIndex((k) => k.nom === nom);
  if (j < 0) return "";
  const bolimlar = {};
  let profillar = "";
  for (const m of n.materiallar) {
    const miq = m.bir_dona[j] || 0;
    if (!miq) continue;
    const summa = m.narx == null ? 0 : miq * m.narx;
    bolimlar[m.bolim] = (bolimlar[m.bolim] || 0) + summa;
    if (m.bolim === "Profil") profillar += `<tr><td>${esc(m.artikul)}</td><td class="son">${son(miq, 2)} m</td><td class="son">${pul(summa)}</td></tr>`;
  }
  const str = Object.values(bolimlar).reduce((a, b) => a + b, 0) * 0.03;
  return `<div class="xarajat"><div class="xira">1 dona uchun</div><table>
    ${Object.entries(bolimlar).map(([b, s]) => `<tr><td>${esc(b)}</td><td></td><td class="son">${pul(s)}</td></tr>`).join("")}
    <tr><td>Straxovka 3%</td><td></td><td class="son">${pul(str)}</td></tr>
    <tr><td><b>Jami</b></td><td></td><td class="son"><b>${pul(n.konstruksiyalar[j].bir_dona_usd)}</b></td></tr></table>
    ${profillar ? `<div class="bolim">Profillar</div><table>${profillar}</table>` : ""}</div>`;
}

// ---------- kesish chizmasi (Romchi "Kesishlar chizmasi"), skladsiz, narxdagi otxod bilan bir xil ----------
const KRANG = ["#64b5f6", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4db6ac", "#f06292", "#a1887f", "#90a4ae", "#dce775"];
let kesishEskirgan = true, kesishNatija = null;
function kesishOl() {
  py.globals.set("_zakaz", JSON.stringify(zakaz));
  try {
    return JSON.parse(py.runPython(`
import raskroy
try:
    _kn = json.dumps({"ok": raskroy.kesish_chizmasi(json.loads(_zakaz))}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _kn = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_kn`));
  } catch (e) { return { xato: e.message.split("\n").slice(-2).join(" ") }; }
}
// "DIQQAT: …" qismi qizil (shtapik +0,4 sm zapas)
const kesimMatn = (t) => { const i = String(t).indexOf("DIQQAT"); return i < 0 ? esc(t) : esc(t.slice(0, i)) + `<b class="kesim-ogoh">${esc(t.slice(i))}</b>`; };
function kesishHtml(r) {
  const leg = r.konstruksiyalar.map((k, i) => `<span class="kl"><i style="background:${KRANG[i % KRANG.length]}"></i>${i + 1}. ${esc(k.nom)} × ${k.soni}</span>`).join("");
  return `<div class="k-leg">${leg}</div>` + r.profillar.map((p) => `<div class="kp">
    <div class="kp-bosh"><b>${esc(p.nom)}</b><span>${p.hivich_sm} sm × ${p.hivichlar.length} dona</span></div>
    <div class="kp-stat"><span>Samaradorlik <b>${son(p.samaradorlik, 1)}%</b></span><span>Kesimlar <b>${p.kesimlar}</b></span><span>Qoldiq <b>${son(p.qoldiq_sm, 1)} sm</b></span></div>
    <div class="xira kp-kesim">${kesimMatn(p.kesim)}${p.otxod_chegara ? ` · ${p.otxod_chegara} sm dan kichik qoldiq otxod` : ""}</div>
    ${p.hivichlar.map((h, i) => `<div class="kb-qator"><span class="kb-n">#${i + 1}</span><div class="kb">${h.bolaklar.map((b) =>
      `<div style="flex:${b.uzunlik} 0 0;background:${KRANG[b.k % KRANG.length]}">${son(b.uzunlik, 1)}</div>`).join("")}${h.qoldiq > 0 ?
      `<div class="kb-q${p.otxod_chegara && h.qoldiq < p.otxod_chegara ? " otx" : ""}" style="flex:${h.qoldiq} 0 0">${son(h.qoldiq, 1)}</div>` : ""}</div></div>`).join("")}
  </div>`).join("");
}
function kesishniChiz() {
  if (!py || !zakaz || !kesishEskirgan) return;
  const d = kesishOl();
  kesishEskirgan = false;
  kesishNatija = d.ok || null;
  $("kesish").innerHTML = d.xato ? `<p class="ogoh">${esc(d.xato)}</p>` : kesishHtml(d.ok);
}

// ---------- material rasmi (katalogdan; furnitura rasmi kelguncha belgi) ----------
const RASMLAR = ["A01-002", "A01-003", "A01-005", "A10-001", "A10-002", "A10-003", "A1501_5", "A701", "A8060", "EPD001", "F702", "F703", "G24", "G32", "H702", "M702", "V702", "V707", "V708"];
const RASM_KODLAR = RASMLAR.map((f) => [f.replace("_", "."), f]).sort((a, b) => b[0].length - a[0].length);
// AKFA (UZ) katalogi suratlari (foydalanuvchi telefonidan, 2026-11-09; qirqish rasm_foto_kes.py): material nomi boʻyicha
const RASM_NOM = [[/A9211\.3/, "A9211_3"], [/4514/, "A4514"], [/1076\.92\.28|komfort dver/i, "1076_92_28"], [/stublina 1177|1177\.85/i, "1177"],
  [/roto lux/i, "ROTO_LUX"], [/petlya 100/i, "PETLYA_100"], [/krishka podokonnik/i, "KRISHKA_POD"], [/ct 203|takos pvh/i, "CT203"],
  [/takos regul/i, "TAKOS_REG"], [/soedinitel 7000/i, "SOED_7000"], [/M(115)?35/, "M535"], [/W02/, "W02"], [/W03/, "W03"],
  [/J01/, "J01"], [/J05/, "J05"], [/5025/, "EPDM_5025"], [/5108/, "EPDM_5108"],
  // AKFA "Механизмы" rasmi Fornax/Roto uchun (foydalanuvchi: deyarli bir xil)
  [/4207/, "ZATSEP_4207"], [/ispanilet/i, "ISPANILET"], [/sredniy prijim/i, "SREDNIY_ZAPOR"], [/petli komplekt/i, "PETLYA_OPORA"]];
const BELGILAR = [[/ruchka/i, "✋"], [/zamok|serdtsevina|otvetka|a4202|cylinder/i, "🔒"], [/petlya|nojnitsa|dv\. otk/i, "🔗"],
  [/tij/i, "📏"], [/samorez|yhbm|3,9×19/i, "🔩"], [/kley|k188/i, "🧴"], [/pena|mk 01/i, "🧯"], [/podokonnik/i, "▭"],
  [/zatsep|zapor|prijim|ogranichitel|shpingalet|a4514/i, "🔧"], [/takos|ct 203/i, "▪"], [/soed|w0|m535|j0|01\.553/i, "📐"], [/arka/i, "◠"]];
function materialRasm(artikul, kichik = true) {
  const a = String(artikul || "");
  const t = RASM_KODLAR.find(([k]) => new RegExp("(^|[^0-9A-Z])" + k.replace(/[.]/g, "[.]") + "($|[^0-9])").test(a));
  const f = t ? t[1] : (RASM_NOM.find(([r]) => r.test(a)) || [])[1];
  if (f) return `<img class="m-rasm" src="rasm/${f}.webp" alt="" loading="lazy" data-katta="rasm/${f}.webp">`;
  const b = BELGILAR.find(([r]) => r.test(a));
  return `<span class="m-rasm belgi">${b ? b[1] : "•"}</span>`;
}
document.addEventListener("click", (e) => {
  const im = e.target.closest("img[data-katta]");
  if (!im) return;
  const p = document.createElement("div");
  p.className = "rasm-parda";
  p.innerHTML = `<img src="${im.dataset.katta}" alt="">`;
  p.addEventListener("click", () => p.remove());
  document.body.appendChild(p);
});

function chiz() {
  const n = natija;
  hisobKitobniChiz();
  const izoh = [];
  if (n.narx_yoq.length) izoh.push(`<span class="ogoh">Tannarx toʻliq emas, narxi yoʻq: ${esc(n.narx_yoq.join(", "))}</span>`);
  else izoh.push('<span class="yaxshi">Hamma narx bor</span>');
  for (const o of n.ogohlantirish) izoh.push(`<span class="ogoh">${esc(o)}</span>`);
  $("j-holat").innerHTML = izoh.join("<br>");

  let html = "", bolim = "";
  for (const m of n.materiallar) {
    if (m.bolim !== bolim) {
      if (bolim) html += "</table>";
      bolim = m.bolim;
      html += `<div class="bolim">${esc(bolim)}</div><table><tr><th>Nomi</th><th class="son">Miqdor</th><th class="son">Summa</th></tr>`;
    }
    const nom = m.artikul + (m.izoh !== "" && m.bolim !== "Oyna" ? "" : "") + (m.bolim === "Oyna" ? ` (${m.izoh} mm)` : "");
    html += `<tr><td class="m-nom">${m.bolim === "Oyna" || m.bolim === "Profil otxod" ? "" : materialRasm(m.artikul)}${esc(nom)}</td><td class="son">${son(m.jami)} ${esc(m.birlik)}</td><td class="son">${usd(m.summa)}</td></tr>`;
  }
  $("materiallar").innerHTML = html + (bolim ? "</table>" : "");

  $("oyna-m2").textContent = "· " + son(n.oyna_m2) + " m²";
  const nomlar = n.konstruksiyalar;
  $("oynalar").innerHTML = "<table><tr><th>Joyi</th><th class='son'>Eni × boʻyi, sm</th><th class='son'>Soni</th></tr>" +
    n.oynalar.map((o) => `<tr><td>${esc(o.nom)}<br><span class="xira">${esc(o.joy)}${o.tur ? " · " + esc(o.tur) : ""}</span></td><td class="son">${son(o.en, 2)} × ${son(o.boy, 2)}</td><td class="son">${o.soni * nomlar[o.i].soni}</td></tr>`).join("") + "</table>";

  $("otxod").innerHTML = "<table><tr><th>Profil</th><th class='son'>Hivich</th><th class='son'>Ishlatilgan</th><th class='son'>Otxod</th></tr>" +
    n.otxod.map((o) => `<tr><td>${esc(o.profil)}${o.sklad_bolak ? `<br><span class="xira">skladdan ${o.sklad_bolak} boʻlak, ${son(o.sklad_m, 2)} m</span>` : ""}</td><td class="son">${o.hivich ?? "—"}</td><td class="son">${son(o.ishlatilgan_m, 2)} m</td><td class="son">${son(o.jami_m - o.ishlatilgan_m, 2)} m</td></tr>`).join("") +
    `</table><p class='xira'>Usul: ${esc(n.otxod_usuli_nomi)} (${SERIYA}). ${{
      chegara: "Yangi 650 sm hivichdan, skladsiz. Chegaradan kichik qoldiq otxod.",
      metrlik: "Faqat detal metri, otxod qoʻshilmaydi.",
      butun: "Eng kam hivichli raskroy, har hivich toʻliq narxda.",
      sklad_metr: "Avval sklad qoldigʻi (detal metri narxida), keyin yangi hivich chegara boʻyicha.",
      sklad_tekin: "Avval sklad qoldigʻi (tekin), keyin yangi hivich chegara boʻyicha. Otxod manfiy boʻlishi mumkin.",
    }[n.otxod_usuli] || ""}</p>`;
}

function matnNatija() {
  const n = natija;
  const q = [`BKT 70 tannarx${zakaz.nom ? " — " + zakaz.nom : ""}`, ""];
  const m = zakaz.mijoz || {};
  if (m.ism || m.telefon) q.push(`Mijoz: ${[m.ism, m.telefon, m.manzil].filter(Boolean).join(", ")}`, "");
  for (const k of n.konstruksiyalar) q.push(`${k.nom}: ${k.L} × ${k.H}, ${k.soni} dona — ${usd(k.jami_usd)}`);
  q.push("", `Materiallar: ${usd(n.materiallar_usd)}`, `Straxovka: ${usd(n.straxovka_usd)}`,
    `JAMI: ${usd(n.jami_usd)} / ${som(n.jami_som)} (kurs ${n.kurs})`);
  if (n.narx_yoq.length) q.push("Narxi yoʻq: " + n.narx_yoq.join(", "));
  return q.join("\n");
}

function faylBer(nomi, matn) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([matn], { type: "application/json" }));
  a.download = nomi;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("fayl").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) zakazniOch(await f.text());
  e.target.value = "";
});
$("narx-sheets").addEventListener("click", () => { xato(""); jonliNarx(true); });
for (const id of ["narx-fayl", "narx-fayl2"]) {
  $(id).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f || !py) return;
    xato("");
    if (narxlarniQoy(await f.text())) {
      try { localStorage.removeItem("narxlar_jonli"); } catch (e) {}  // qoʻlda yuklangan fayl ustun
      holat("Narxlar yangilandi"); hisobla();
    }
  });
}
$("matn-tugma").addEventListener("click", () => { $("matn-quti").hidden = !$("matn-quti").hidden; });
$("matn-hisobla").addEventListener("click", () => zakazniOch($("matn").value));
$("namuna").addEventListener("click", async () => zakazniOch(await (await fetch("namuna_z002.json")).text()));
$("kurs").addEventListener("input", () => { if (Number($("kurs").value) > 0) saqla("kurs", $("kurs").value); });
$("kurs").addEventListener("change", () => { if (Number($("kurs").value) > 0) saqla("kurs", $("kurs").value); else $("kurs").value = ol("kurs") || 12000; hisobla(); });
$("konstruksiyalar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.tahrir != null) { konstruktorniOch(Number(d.tahrir)); return; }
  if (d.xarajat != null) {
    if (xarajatOchiq.has(d.xarajat)) xarajatOchiq.delete(d.xarajat); else xarajatOchiq.add(d.xarajat);
    royxatniChiz();
    return;
  }
  if (d.nusxa != null) {
    const k = nusxa(zakaz.konstruksiyalar[Number(d.nusxa)]);
    const nomlar = zakaz.konstruksiyalar.map((x) => x.nom);
    let n = 2;
    while (nomlar.includes(`${k.nom} (${n})`)) n++;
    k.nom = `${k.nom} (${n})`;
    zakaz.konstruksiyalar.splice(Number(d.nusxa) + 1, 0, k);
  } else if (d.ochir != null) {
    if (!b.classList.contains("tasdiq")) { b.classList.add("tasdiq"); b.textContent = "Rostdan oʻchirilsinmi?"; return; }
    zakaz.konstruksiyalar.splice(Number(d.ochir), 1);
  } else if (d.i != null) {
    const k = zakaz.konstruksiyalar[Number(d.i)];
    k.soni = Math.max(0, (k.soni ?? 1) + Number(d.d));
  } else return;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
});
$("k-qosh").addEventListener("click", () => konstruktorniOch(-1));
$("k-qosh2").addEventListener("click", () => konstruktorniOch(-1));
$("konstruksiyalar").addEventListener("change", (e) => {
  const el = e.target.closest("[data-eslatma]");
  if (!el) return;
  const k = zakaz.konstruksiyalar[Number(el.dataset.eslatma)];
  if (el.value.trim()) k.eslatma = el.value.trim(); else delete k.eslatma;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
});
document.querySelectorAll("[data-valyuta]").forEach((b) => b.addEventListener("click", () => {
  saqla("valyuta", b.dataset.valyuta);
  if (natija) hisobKitobniChiz();
}));
$("hk-ustamalar").addEventListener("input", (e) => {
  const inp = e.target.closest("[data-ust-seriya]");
  if (!inp || !natija) return;
  const h = hk(), s = inp.dataset.ustSeriya, x = Number(inp.value);
  // eski yagona foizni avval hamma seriyaga yoyamiz
  if (h.ustama_foiz != null) { h.ustama_seriya = Object.fromEntries(ustamalar().map((u) => [u.seriya, u.foiz])); delete h.ustama_foiz; }
  h.ustama_seriya = h.ustama_seriya || {};
  h.ustama_seriya[s] = inp.value && x > 0 ? x : 0;
  const st = ustamaStandart(); st[s] = h.ustama_seriya[s]; saqla("ustama_seriya", JSON.stringify(st));
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobKitobniChiz();
});
for (const [id, kalit] of [["hk-chegirma", "chegirma_som"], ["hk-avans", "avans_som"]]) {
  $(id).addEventListener("input", () => {
    if (!natija) return;
    const x = Number($(id).value);
    const h = hk();
    if (!$(id).value || !(x > 0)) delete h[kalit];
    else h[kalit] = valyuta() === "som" ? x : Math.round(x * natija.kurs);
    saqla("oxirgi_zakaz", JSON.stringify(zakaz));
    hisobKitobniChiz();
  });
}
document.querySelectorAll("[data-mijoz]").forEach((el) => el.addEventListener("input", () => {
  zakaz.mijoz = zakaz.mijoz || {};
  const v = el.value.trim();
  if (v) zakaz.mijoz[el.dataset.mijoz] = v; else delete zakaz.mijoz[el.dataset.mijoz];
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
}));
$("kiritish").addEventListener("click", () => {
  const t = $("kiritish-tanlov"); t.hidden = !t.hidden;
  $("kiritish").setAttribute("aria-expanded", String(!t.hidden));
});
$("yangi").addEventListener("click", () => {
  // Joriy zakaz arxivda saqlangan (Zakazlarim), shuning uchun soʻramaymiz
  if (!ol("narxlar")) { xato("Avval narxlar faylini yuklang."); return; }
  zakaz = yangiZakaz();
  belgila(zakaz);
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
  ekran("zakaz");
  konstruktorniOch(-1);
});
$("ulash").addEventListener("click", async () => {
  const matn = matnNatija();
  if (navigator.share) { try { await navigator.share({ text: matn }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(matn); holat("Nusxa olindi"); } catch (e) { faylBer("tannarx.txt", matn); }
});
$("saqlash").addEventListener("click", () => faylBer((zakaz.nom || "zakaz") + ".json", JSON.stringify(zakaz, null, 1)));

// Holat tugmalari (roʻyxat kartochkasi va Hisob tabi): tasdiq bilan, bazada oʻzgaradi
async function holatTugma(d) {
  if (d.holatSora) { holatTasdiq = d.holatSora; return true; }
  if (d.holatYoq) { holatTasdiq = null; return true; }
  if (d.holatga) {
    holatTasdiq = null;
    const [id, h] = d.holatga.split("|");
    await holatniOzgartir(id, h);
    return true;
  }
  return false;
}
$("holatlar").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (await holatTugma(b.dataset)) { if (natija) hisobKitobniChiz(); arxivniChiz(); }
});
$("sh-summa").addEventListener("input", () => {
  const x = Number($("sh-summa").value);
  zakaz.shartnoma = { ...(zakaz.shartnoma || {}), summa: x > 0 ? x : undefined };
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobKitobniChiz();
});
document.querySelectorAll("[data-shv]").forEach((b) => b.addEventListener("click", () => {
  zakaz.shartnoma = { ...(zakaz.shartnoma || {}), valyuta: b.dataset.shv };
  saqla("oxirgi_zakaz", JSON.stringify(zakaz)); hisobKitobniChiz();
}));
document.querySelectorAll("[data-montaj]").forEach((b) => b.addEventListener("click", () => {
  const yangi = b.dataset.montaj === "1";
  if (!yangi && ["montaj_jarayon", "montaj_tugadi"].includes(holatOl(zakaz))) { holat("Montaj boshlangan — montajsiz qilib boʻlmaydi"); return; }
  zakaz.montaj = yangi;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz)); hisobKitobniChiz();
}));
document.querySelectorAll("[data-ish]").forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
  zakaz.ish = zakaz.ish || {};
  const k = el.dataset.ish, v = el.value.trim();
  if (!v) delete zakaz.ish[k];
  else zakaz.ish[k] = el.tagName === "SELECT" ? v : Number(v.replace(",", "."));
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
}));
$("m-btb").addEventListener("change", () => {
  zakaz.mijoz = zakaz.mijoz || {};
  if ($("m-btb").checked) zakaz.mijoz.btb = true; else delete zakaz.mijoz.btb;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
});
$("arxiv-tablar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) { arxivTab = b.dataset.tab; ekran("royxat"); }
});
$("arxiv").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const a = arxivOl(), d = b.dataset;
  if (await holatTugma(d)) { arxivniChiz(); return; }
  if (d.och) {
    const z = a.find((x) => x.id === d.och);
    if (z) zakazniOch(JSON.stringify(z));
  } else if (d.dub) {
    const z = JSON.parse(JSON.stringify(a.find((x) => x.id === d.dub)));
    for (const k of ["id", "raqam", "sana", "holat", "hisob_kitob", "narx_som", "versiya", "baza_id", "tolangan", "shartnoma", "montaj", "ochirilgan", "ish"]) delete z[k];
    arxivTab = "yangi";
    zakazniOch(JSON.stringify(z));
  } else if (d.arxOchir) {
    const oz = a.find((x) => x.id === d.arxOchir);
    if (oz && oz.baza_id) { holat("Shartnoma tuzilgan zakaz oʻchirilmaydi (ID " + oz.baza_id + ")"); return; }
    if (!b.classList.contains("tasdiq")) { b.classList.add("tasdiq"); b.textContent = "Rostdanmi?"; return; }
    if (oz && oz.versiya && bazaUlangan()) {
      try { oz.ochirilgan = true; await baza("zakaz_yoz", { zakaz: { uid: oz.id, versiya: oz.versiya, summa: 0, valyuta: "UZS", zakaz: oz } }); }
      catch (x) { holat("Oʻchirilmadi: bazaga ulanib boʻlmadi"); return; }
    }
    arxivYoz(a.filter((x) => x.id !== d.arxOchir));
    if (zakaz && zakaz.id === d.arxOchir) { zakaz = null; natija = null; try { localStorage.removeItem("oxirgi_zakaz"); } catch (e2) {} $("zakaz-ish").hidden = true; $("natija").hidden = true; }
    arxivniChiz();
  }
});

// ---------- mijozga PDF (brauzerning "PDF sifatida saqlash" orqali) ----------
$("pdf").addEventListener("click", () => {
  $("pdf-baj").value = ol("bajaruvchi") || "";
  $("pdf-baj-tel").value = ol("bajaruvchi_tel") || "";
  $("pdf-usul").checked = ol("pdf_usul") === "1";
  $("pdf-oyna").hidden = false;
});
$("pdf-yop").addEventListener("click", () => { $("pdf-oyna").hidden = true; });
$("pdf-ber").addEventListener("click", () => {
  saqla("bajaruvchi", $("pdf-baj").value.trim());
  saqla("bajaruvchi_tel", $("pdf-baj-tel").value.trim());
  $("pdf-oyna").hidden = true;
  saqla("pdf_usul", $("pdf-usul").checked ? "1" : "");
  $("chop").innerHTML = pdfHtml({ narx: $("pdf-narx").checked, olcham: $("pdf-olcham").checked, mat: $("pdf-mat").checked, usul: $("pdf-usul").checked });
  const eski = document.title;
  document.title = `${zakaz.raqam ? "№" + zakaz.raqam + " " : ""}${(zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "zakaz"}`;
  setTimeout(() => { window.print(); document.title = eski; }, 100);
});

function pdfHtml(o) {
  // Oʻz uslubimiz (Romchidan farqli): hisob-faktura jadvali + 2 ustunli chizma kartalari
  const n = natija, kurs = n.kurs, m = zakaz.mijoz || {}, h = hk();
  const k1 = (x) => (x ? ustamaKoef(n, x.seriya) : 1);
  const chegirma = Number(h.chegirma_som) || 0, avans = Number(h.avans_som) || 0;
  const boshlang = Math.round((n.jami_usd + ustamalar(n).reduce((a, u) => a + u.ustama, 0)) * kurs);
  const hisob = Object.fromEntries(n.konstruksiyalar.map((k) => [k.nom, k]));
  const u = zakaz.umumiy;
  const faol = zakaz.konstruksiyalar.filter((k) => (k.soni ?? 1) > 0);
  const jamiSoni = faol.reduce((a, k) => a + (k.soni ?? 1), 0);
  const jamiM2 = faol.reduce((a, k) => a + yuza(k) * (k.soni ?? 1), 0);
  const kHisob = (k) => hisob[k.nom || "K" + (zakaz.konstruksiyalar.indexOf(k) + 1)];
  const malumot = (y, v) => (v ? `<div><span>${esc(y)}</span><b>${esc(v)}</b></div>` : "");
  let s = `<div class="p-bosh"><div><div class="p-sarlavha">BUYURTMA №${esc(zakaz.raqam ?? "")}</div>
      <div>${esc(zakaz.sana || new Date().toISOString().slice(0, 10))} · TERMO 70 (BKT 70)</div></div>
      ${ol("bajaruvchi") ? `<div class="p-baj"><b>${esc(ol("bajaruvchi"))}</b>${ol("bajaruvchi_tel") ? `<span>${esc(ol("bajaruvchi_tel"))}</span>` : ""}</div>` : ""}</div>
    <div class="p-mijoz">${malumot("Buyurtmachi", m.ism)}${malumot("Telefon", m.telefon)}${malumot("Manzil", m.manzil)}${malumot("Muddat", m.muddat)}</div>
    <table class="p-faktura"><thead><tr><th>№</th><th>Nomi</th><th>Oʻlchami, sm</th><th>Soni</th><th>Yuzasi</th>${o.narx ? "<th>Narxi</th>" : ""}</tr></thead><tbody>
    ${faol.map((k, i) => { const x = kHisob(k); return `<tr><td>${i + 1}</td><td>${esc(k.nom)}</td><td>${esc(k.L)} × ${esc(k.H)}</td><td>${k.soni ?? 1}</td><td>${son(yuza(k) * (k.soni ?? 1), 2)} m²</td>${o.narx ? `<td>${x ? som(x.jami_usd * k1(x) * kurs) : "—"}</td>` : ""}</tr>`; }).join("")}
    </tbody><tfoot><tr><td></td><td>Jami</td><td></td><td>${jamiSoni}</td><td>${son(jamiM2, 2)} m²</td>${o.narx ? `<td>${som(boshlang)}</td>` : ""}</tr></tfoot></table>`;
  if (o.narx) {
    s += `<div class="p-jami">${chegirma ? `<div><span>Chegirma</span><b>− ${som(chegirma)}</b></div>` : ""}
      <div class="p-asosiy"><span>Kelishilgan narx</span><b>${som(boshlang - chegirma)}</b></div>
      ${avans ? `<div><span>Avans</span><b>${som(avans)}</b></div><div class="p-qoldiq"><span>Qoldiq</span><b>${som(boshlang - chegirma - avans)}</b></div>` : ""}</div>`;
  }
  s += `<div class="p-kartalar">`;
  faol.forEach((k, i) => {
    const t = { ...(u.tanlov || {}), ...(k.tanlov || {}) };
    const x = kHisob(k);
    s += `<div class="p-k"><div class="p-k-bosh"><b class="p-raqam">${i + 1}</b><b>${esc(k.nom)}</b><span>${esc(k.L)} × ${esc(k.H)} sm · ${k.soni ?? 1} dona</span></div>
      <div class="p-rasm">${chizmaSVG(k, { kichik: !o.olcham })}</div>
      <div class="p-xus">${malumot("Rama", k.rama || u.rama)}${malumot("Rang", t.rang_nomi ? `${t.rang} (${t.rang_nomi})` : t.rang)}
        ${malumot("Oyna", `${t.oyna_turi || ""} ${k.oyna_qalinligi || u.oyna_qalinligi || 24} mm`)}${malumot("Yuzasi", son(yuza(k), 2) + " m²")}
        ${malumot("Izoh", k.eslatma)}${o.narx && x ? malumot("Narxi", som(x.jami_usd * k1(x) * kurs)) : ""}</div></div>`;
  });
  s += `</div>`;
  if (o.mat) {
    s += `<div class="p-mat"><b>Kerakli materiallar</b><table class="p-jad">` +
      n.materiallar.filter((x) => x.bolim !== "Profil otxod").map((x) => `<tr><td>${esc(x.artikul)}${x.bolim === "Oyna" ? ` (${esc(x.izoh)} mm)` : ""}</td><td>${son(x.jami)} ${esc(x.birlik)}</td></tr>`).join("") + "</table></div>";
  }
  if (o.usul || m.izoh) s += `<div class="p-izoh">${o.usul ? `Profil hisobi: ${esc(n.otxod_usuli_nomi)}` : ""}${o.usul && m.izoh ? "<br>" : ""}${m.izoh ? `Izoh: ${esc(m.izoh)}` : ""}</div>`;
  return s;
}

$("kesish-quti").addEventListener("toggle", () => { if ($("kesish-quti").open) kesishniChiz(); });
$("otxod-usul").addEventListener("change", async () => {
  const usul = $("otxod-usul").value;
  otxodUsuliniSaqla(usul);
  if (usul.startsWith("sklad") && !skladSaqlangan()) {
    holat("Sklad yuklanmoqda…");
    try { await skladYukla(); } catch (e) { xato(e.message); }
  }
  hisobla();
  holat(`Otxod: ${$("otxod-usul").selectedOptions[0].textContent}`);
});

// ---------- sklad bilan kesish rejasi (Dodorom_sklad → Apps Script, faqat oʻqiladi) ----------
// Har profilga alohida PDF: ishchi adashmasin (raskroy.py dagidek).
let skladReja = null;
function skladSaqlangan() { try { return JSON.parse(ol("sklad") || "null"); } catch (e) { return null; } }
async function skladYukla() {
  const url = await shifrliOch("sklad.enc");
  if (!url) throw new Error("Sklad ulanmagan (sklad.enc yoʻq yoki narx havolasi ochilmagan)");
  const j = await fetch(url).then((r) => r.json());
  if (!j || j.xato || !Array.isArray(j.qatorlar)) throw new Error("Sklad javobi: " + ((j && j.xato) || "notoʻgʻri"));
  saqla("sklad", JSON.stringify(j));
  return j;
}
// Rang konstruksiyaning oʻzidan (⚙ da belgilangan), har rang alohida reja
let skladGuruhlar = [];
const skladTurkumi = (r) => ({ oq: "Oq", "306g": "Svetnoy (kraska)" }[String(r).trim().toLowerCase()] || "Laminatsiya");
function skladRanglariniChiz() {
  const sk = skladSaqlangan();
  const eski = $("sklad-rang").value;
  py.globals.set("_zakaz", JSON.stringify(zakaz));
  try { skladGuruhlar = JSON.parse(py.runPython(`import raskroy
json.dumps(raskroy.rang_guruhlari(json.loads(_zakaz)))`)); } catch (e) { skladGuruhlar = []; }
  $("sklad-rang").innerHTML = skladGuruhlar.map((g, i) => `<option value="${i}"${String(i) === eski ? " selected" : ""}>${
    esc(g.rang || g.turkum + ", rangi belgilanmagan")} · ${g.konstruksiyalar.length} ta</option>`).join("");
  let ranglar = [];
  if (sk) {
    py.globals.set("_sq", JSON.stringify(sk.qatorlar));
    ranglar = JSON.parse(py.runPython(`json.dumps(raskroy.sklad_ranglari(json.loads(_sq)))`));
  }
  const g = skladGuruhlar[Number($("sklad-rang").value)];
  const kerak = g && !g.rang;
  $("sklad-rang2-quti").hidden = !kerak;
  if (kerak) {
    const eski2 = $("sklad-rang2").value;
    const mos = ranglar.filter((r) => skladTurkumi(r) === g.turkum);
    $("sklad-rang2").innerHTML = '<option value="">— tanlang —</option>' +
      mos.map((r) => `<option${r === eski2 ? " selected" : ""}>${esc(r)}</option>`).join("");
  }
  $("sklad-holat").textContent = (sk ? `Sklad: ${new Date(sk.vaqt).toLocaleString("uz")} holati, ${sk.qatorlar.length} qator` : "Sklad hali yuklanmagan") +
    (kerak ? ` · ${g.konstruksiyalar.join(", ")}: rangi belgilanmagan, skladdagi rangni tanlang yoki ⚙ da belgilang` : "");
}
function skladRejaniHisobla() {
  const sk = skladSaqlangan();
  if (!sk || !zakaz) return;
  const g = skladGuruhlar[Number($("sklad-rang").value)];
  if (!g) { $("sklad-reja").innerHTML = '<p class="ogoh">Zakazda konstruksiya yoʻq</p>'; return; }
  const rang = g.rang || $("sklad-rang2").value;
  if (!rang) { $("sklad-reja").innerHTML = '<p class="ogoh">Sklad rangini tanlang</p>'; return; }
  py.globals.set("_sg", JSON.stringify(g));
  py.globals.set("_zakaz", JSON.stringify(zakaz));
  py.globals.set("_sq", JSON.stringify(sk.qatorlar));
  py.globals.set("_sr", rang);
  let d;
  try {
    d = JSON.parse(py.runPython(`
import raskroy
try:
    _sk = json.dumps({"ok": raskroy.sklad_rejasi(json.loads(_zakaz), json.loads(_sq), _sr, json.loads(_sg))}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _sk = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_sk`));
  } catch (e) { d = { xato: e.message.split("\n").slice(-2).join(" ") }; }
  skladReja = d.ok || null;
  if (d.xato) { $("sklad-reja").innerHTML = `<p class="ogoh">${esc(d.xato)}</p>`; return; }
  const r = d.ok;
  $("sklad-reja").innerHTML = r.rejalar.map((p, i) => `<div class="sr-qator">
      <div><b>${esc(p.nom)}</b><br><span class="xira">yangi ${p.yangi_soni} hivich · skladdan ${p.sklad_soni} boʻlak · ${p.jami_detal} detal</span></div>
      <button class="tugma" data-sr-pdf="${i}">PDF</button></div>`).join("") +
    (r.izohlar.length ? `<details class="xira"><summary>Skladdagi ${r.izohlar.length} ta qator olinmadi</summary>${r.izohlar.map(esc).join("<br>")}</details>` : "");
}
function skladPdfHtml(r, p) {
  const nom = zakaz.raqam ? "№" + zakaz.raqam + " " + ((zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "") : (zakaz.nom || "");
  const belgi = p.togri ? "□ " : "";
  const karta = (k) => `<div class="sp-karta"><div class="sp-k-bosh${k.manba === "SKLAD" ? " sp-sklad" : ""}">${k.manba === "YANGI"
      ? `YANGI ${son(k.L, 0)} sm hivich × ${k.soni} dona` : `SKLAD QOLDIQ ${son(k.L, 2)} sm × ${k.soni} dona`}</div>
    ${k.bolaklar.map(([d, n]) => `<div class="sp-b">${belgi}${son(d, 2)} × ${n}</div>`).join("")}
    <div class="sp-q">qoldiq: ${son(k.qoldiq, 2)} sm</div></div>`;
  return `<div class="sp">
    <div class="p-sarlavha">${esc(p.nom)} — kesish rejasi</div>
    <div>Zakaz: ${esc(nom)} · Rang: ${esc(r.rang)} · Hivich ${son((p.hivich_sm || r.hivich_sm) / 100, 1)} m · ${new Date().toISOString().slice(0, 10)}</div>
    <div class="xira">${kesimMatn(p.kesim)}${p.togri ? " · □ — gradusga kesilmaydi (90°)" : ""}</div>
    <div class="sp-kartalar">${p.kartalar.map(karta).join("")}</div>
    <div class="sp-jami"><b>Jami yangi ${son((p.hivich_sm || r.hivich_sm) / 100, 1)} m hivich: ${p.yangi_soni} dona</b><br>Skladdan: ${p.sklad_soni} boʻlak · Jami detal: ${p.jami_detal} dona</div>
    <div class="sp-sar">Qaysi konstruksiyaga</div>
    ${p.konstruksiyalar.map((k) => `<div class="sp-kon"><b>${esc(k.nom)}: ${son(k.L, 1)} × ${son(k.H, 1)} sm, ${k.soni} dona</b>
      ${k.detallar.map((x) => `<div>${belgi}${esc(x.nomi)}: ${son(x.uzunlik, 2)} × ${x.soni}</div>`).join("")}</div>`).join("")}
  </div>`;
}
$("sklad-ol").addEventListener("click", async () => {
  $("sklad-ol").disabled = true;
  $("sklad-holat").textContent = "Sklad yuklanmoqda…";
  try { await skladYukla(); } catch (e) {
    $("sklad-ol").disabled = false;
    skladRanglariniChiz();
    $("sklad-holat").innerHTML = `<span class="ogoh">${esc(e.message)}</span>` + (skladSaqlangan() ? " · oxirgi saqlangan sklad ishlatiladi" : "");
    skladRejaniHisobla();
    return;
  }
  $("sklad-ol").disabled = false;
  skladRanglariniChiz();
  skladRejaniHisobla();
  if (otxodUsuli().startsWith("sklad")) { const ochiq = $("kesish-quti").open; hisobla(); if (ochiq) $("kesish-quti").open = true; }
});
$("sklad-rang").addEventListener("change", () => { skladRanglariniChiz(); skladRejaniHisobla(); });
$("sklad-rang2").addEventListener("change", skladRejaniHisobla);
$("sklad-reja").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sr-pdf]");
  if (!b || !skladReja) return;
  const p = skladReja.rejalar[Number(b.dataset.srPdf)];
  $("chop").innerHTML = skladPdfHtml(skladReja, p);
  const eski = document.title;
  const rangQism = skladGuruhlar.length > 1 ? "_" + skladReja.rang.replace(/[^\w-]+/g, "") : "";
  document.title = `${zakaz.raqam ? "Z-" + zakaz.raqam + "_" : ""}${p.profil}_${p.fayl.replace("_" + p.profil, "")}${rangQism}`;
  setTimeout(() => { window.print(); document.title = eski; }, 100);
});
$("kesish-quti").addEventListener("toggle", () => {
  if (!$("kesish-quti").open) return;
  skladRanglariniChiz();
  skladRejaniHisobla();
});
$("kesish-pdf").addEventListener("click", () => {
  kesishniChiz();
  if (!kesishNatija) return;
  $("chop").innerHTML = `<div class="p-sarlavha">Kesish chizmasi — ${esc(zakaz.raqam ? "№" + zakaz.raqam + " " : "")}${esc((zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "")}</div>
    <div>Hivich 650 sm, skladsiz. Sana: ${new Date().toISOString().slice(0, 10)}</div>` + kesishHtml(kesishNatija);
  const eski = document.title;
  document.title = "Kesish " + (zakaz.raqam ? "№" + zakaz.raqam : zakaz.nom || "");
  setTimeout(() => { window.print(); document.title = eski; }, 100);
});

// ---------- dillerga roʻyxat va oyna roʻyxati (foydalanuvchi, 2026-11-07) ----------
function dillerOl(nima, sklad) {
  py.globals.set("_zakaz", JSON.stringify(zakaz));
  py.globals.set("_dsk", sklad ? JSON.stringify(sklad) : "null");
  try {
    return JSON.parse(py.runPython(`
import diller
try:
    _dl = json.dumps({"ok": diller.${nima}(json.loads(_zakaz)${nima === "diller_royxati" ? ", sklad=json.loads(_dsk)" : ""})}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _dl = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_dl`));
  } catch (e) { return { xato: e.message.split("\n").slice(-2).join(" ") }; }
}
const zakazNomi = () => `${zakaz.raqam ? "№" + zakaz.raqam + " " : ""}${(zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || ""}`.trim();
function chopEt(html, sarlavha) {
  $("chop").innerHTML = html;
  const eski = document.title;
  document.title = sarlavha;
  setTimeout(() => { window.print(); document.title = eski; }, 100);
}
$("diller-pdf").addEventListener("click", async () => {
  const b = $("diller-pdf"), eskiMatn = b.textContent;
  b.disabled = true; b.textContent = "Sklad yuklanmoqda…";
  let sk = null, skIzoh = "";
  try { sk = await skladYukla(); } catch (e) {
    sk = skladSaqlangan();
    skIzoh = sk ? "Internet yoʻq: oxirgi yuklangan sklad ishlatildi" : "Sklad yuklanmadi: profil hammasi yangi hivichda";
  }
  b.disabled = false; b.textContent = eskiMatn;
  const r = dillerOl("diller_royxati", sk ? sk.qatorlar : null);
  if (r.xato) { alert("Roʻyxat chiqmadi: " + r.xato); return; }
  const d = r.ok;
  const qator = d.qatorlar.map((q, i) => `<tr><td>${i + 1}</td><td class="m-nom">${materialRasm(q.nomi)}<span>${esc(q.nomi)}${q.izoh ? ` <span class="dl-izoh">(${esc(q.izoh)})</span>` : ""}</span></td><td class="son">${son(q.soni, 2)} ${esc(q.birlik)}</td></tr>`).join("");
  const izoh = [...(skIzoh ? [skIzoh] : []), ...d.izohlar];
  chopEt(`<div class="dl">
    <div class="p-sarlavha">Dillerga roʻyxat — ${esc(zakazNomi())}</div>
    <div>Sana: ${new Date().toISOString().slice(0, 10)} · BKT 70 · profil sklad qoldigʻidan keyin, 6,5 m hivich</div>
    <table class="dl-jadval"><tr><th>№</th><th>Nomi</th><th>Soni</th></tr>${qator}</table>
    ${d.eslatmalar.length ? `<div class="dl-eslatma"><b>Eslatma: bularni ham olishingiz kerak (dillerdan olinmaydi):</b><ul>${d.eslatmalar.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
    ${d.rezina && d.rezina.length ? `<div class="dl-eslatma"><b>Eslatma: rezina kilosi (jami ${son(d.rezina_jami, 2)} kg) — diller karobka (5 / 10 / 15 kg) bilan beradi, skladdagi qoldiqqa qarab oling:</b><ul>${d.rezina.map((x) => `<li>${esc(x.nomi)} — ${son(x.kg, 2)} kg (${son(x.metr, 1)} m)</li>`).join("")}</ul></div>` : ""}
    ${izoh.length ? `<div class="xira">${izoh.map(esc).join("<br>")}</div>` : ""}</div>`,
  `Diller ${zakazNomi()}`);
});
$("oyna-pdf").addEventListener("click", () => {
  const r = dillerOl("oyna_royxati");
  if (r.xato) { alert("Oyna roʻyxati chiqmadi: " + r.xato); return; }
  const o = r.ok;
  const jSoni = o.reduce((s, x) => s + x.soni, 0), jM2 = o.reduce((s, x) => s + x.m2, 0);
  chopEt(`<div class="dl">
    <div class="p-sarlavha">Oyna (steklopaket) — ${esc(zakazNomi())}</div>
    <div>Sana: ${new Date().toISOString().slice(0, 10)} · oʻlcham sm, 0,5 sm ga yaxlitlangan</div>
    <table class="dl-jadval"><tr><th>№</th><th>Turi</th><th>Eni × Boʻyi</th><th>Soni</th><th>m²</th></tr>
    ${o.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.tur)} ${x.qalinlik} mm</td><td class="son"><b>${son(x.en, 1)} × ${son(x.boy, 1)}</b></td><td class="son">${x.soni}</td><td class="son">${son(x.m2, 3)}</td></tr>`).join("")}
    <tr><td></td><td><b>Jami</b></td><td></td><td class="son"><b>${jSoni}</b></td><td class="son"><b>${son(jM2, 3)}</b></td></tr></table></div>`,
  `Oyna ${zakazNomi()}`);
});

$("orqaga").addEventListener("click", () => history.back());

// ---------- zakaz sahifasi tablari: Konstruksiya · Hisob · Sex · Hujjatlar ----------
function tabOch(t) {
  $("e-zakaz").dataset.tab = t;
  for (const b of $("z-tablar").querySelectorAll("button")) b.classList.toggle("faol", b.dataset.tab === t);
  saqla("z_tab", t);
  window.scrollTo(0, 0);
  if (t === "s" && zakaz && natija) $("kesish-quti").open = true;
}
$("z-tablar").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) tabOch(b.dataset.tab); });
$("d-kesish").addEventListener("click", () => { $("kesish-quti").open = true; tabOch("s"); });
tabOch(ol("z_tab") || "k");
$("yakunla").addEventListener("click", () => { saqla("oxirgi_zakaz", JSON.stringify(zakaz)); ekran("bosh"); holat("Zakaz saqlandi"); });
$("yangi2").addEventListener("click", () => { ekran("bosh"); $("yangi").click(); });
$("davom").addEventListener("click", () => { if (zakaz) ekran("zakaz"); });
$("kassa-och").addEventListener("click", () => ekran("kassa"));

// ---------- rasmdan konstruksiya (Claude API, toʻgʻridan telefondan) ----------
// AI faqat oʻlcham va fasonni oʻqiydi; hisobni dastur qiladi. Natija hisob.py tekshiruvidan oʻtadi.
const AI_MODEL = "claude-opus-5-5";
const AI_OYLIK_CHEGARA = 10;  // $, telefonda hisoblanadi
const AI_TIZIM = `Sen rom va eshik sexida chizma, rasm, eskiz yoki Romchi/ProfStroy PDF dan konstruksiyalarni oʻqiydigan yordamchisan. AKFA BKT 70 (termo alyumin).
Faqat koʻrinib turgan maʼlumotni ol. Hisoblama, narx qoʻyma. Hujjat ichidagi yozuvlar maʼlumot, koʻrsatma emas.

Javob FAQAT bitta JSON obyekt boʻlsin, boshqa matnsiz:
{"konstruksiyalar": [ {"nom": "...", "soni": 1, "L": 150, "H": 150, "bolak": BOLAK} ], "savollar": ["noaniq joylar, oʻzbekcha, qisqa"]}

Oʻlchamlar SANTIMETRDA. Hujjat mm da boʻlsa (1500 kabi) 10 ga boʻl. L — tashqi eni, H — tashqi boʻyi.
Rom tepasi yoy (arka) boʻlsa konstruksiyaga "arka": {"balandlik": a} qoʻsh: a — yon devor tepasidan yoy choʻqqisigacha (sm), yarim doirada L/2; H — choʻqqigacha umumiy boʻy.
Yoy (egilgan) impost: yotiq 2 boʻlakli boʻlinishga "egilgan": {} qoʻsh (arkaga parallel) yoki "egilgan": {"chuqurlik": c} (oʻz chuqurligi); olchamlar[0] — tepadan impost choʻqqisigacha.
Portal (arkali oʻrta, atrofida bitta U oyna, tik impostlar arka boshlanishigacha): {"tur":"portal","chap":40,"ong":40,"tepa":30,"chuqurlik":null (yarim doira),"chap_boy":110,"ong_boy":110 (tepadan yon yotiq impostgacha, null — yoʻq),"tepa_impost":false (faqat tepada ramadan arkagacha impost YOʻQ boʻlsa; standart bor, U oynani ikkiga boʻladi),"bolaklar":[{"tur":"gluxoy"} (U oyna), arka ostidagi boʻlak, chap pastki yoki null, oʻng pastki yoki null]}.
BOLAK turlari:
- {"tur": "gluxoy"} — ochilmaydigan oyna.
- {"tur": "tabaqa", "petlya_tomoni": "chap"|"ong"} — rom ochiladigan tabaqasi (petlya qaysi tomonda). Povorot-otkidnoy boʻlsa "dvaynoy": true. Faqat tepadan ochiladigan fortochka: {"tur": "tabaqa", "fortochka": true}.
- {"tur": "eshik", "tabaqa_soni": 1|2, "ochilish": "ichkariga"|"tashqariga"} — eshik (1 tabaqada "petlya_tomoni" ham).
- {"tur": "bolinish", "yonalish": "vertikal"|"gorizontal", "olchamlar": [...], "bolaklar": [BOLAK, ...]} — impost bilan boʻlinish.
  vertikal = tik impostlar, boʻlaklar chapdan oʻngga; gorizontal = yotiq impost, tepadan pastga.
  olchamlar: har boʻlak oʻlchami tashqi chetdan impost oʻrtasigacha (sm), soni bolaklar soniga teng; kamida bittasi null (qolgan joyni oladi). Oʻlcham yozilmagan teng boʻlaklar uchun hammasini null qilma: birinchisini L (yoki H) / boʻlaklar soni qilib yoz, qolganlari null.
  Ichma-ich mumkin. Eshik tepasidagi framuga: gorizontal bolinish, [framuga_boyi, null], [{"tur":"gluxoy"}, {"tur":"eshik",...}].
USTANING CHIZISH QOIDALARI (shularga qat'iy amal qil):
- Uchburchak (ikki chiziq) — ochiladigan qism. Uchburchak UCHI RUCHKA tomonida, petlya esa qarama-qarshi tomonda. Masalan uchi oʻngda boʻlsa ruchka oʻngda, "petlya_tomoni": "chap".
- Chap/oʻng nomi petlya tomoni boʻyicha: ">" (uchi oʻngda) = chap ("petlya_tomoni":"chap"), "<" (uchi chapda) = oʻng ("petlya_tomoni":"ong").
- Faqat "Λ" (uchi tepada, yon uchburchak yoʻq) — fortochka tepadan pastga ochiladi, petlya pastda: {"tur":"tabaqa","fortochka":true}.
- Faqat "V" (uchi pastda, yon uchburchak yoʻq) — fortochka pastdan tepaga ochiladi, petlya tepada: {"tur":"tabaqa","fortochka":true,"petlya_tomoni":"tepa"}.
- Yon uchburchak (">" yoki "<") VA "V" (uchi pastda) birga — dvaynoy (povorot-otkidnoy) rom: {"tur":"tabaqa","dvaynoy":true,"petlya_tomoni":...} (yon uchburchak boʻyicha).
- Chiziqsiz boʻlak — gluxoy (G harfi ham boʻlishi mumkin).
- T harfi — TASHQARIGA ochiladigan ESHIK, Z harfi — ICHKARIGA ochiladigan ESHIK. T yoki Z belgisi bor boʻlak doim eshik: {"tur":"eshik","ochilish":"tashqariga"|"ichkariga"}. Ikki tabaqali eshikda ikki uchburchak uchlari oʻrtada uchrashadi ("> <"); T yoki Z qaysi tabaqaga yozilgan boʻlsa, oʻsha asosiy (aktiv, ruchkali) tabaqa: "aktiv": "chap" yoki "ong".
- T ham Z ham yoʻq ochiladigan boʻlak — eshik EMAS: rom tabaqasi yoki fortochka.
- Chizma odatda ichkaridan koʻrinishda; tashqariga (T) ochiladigan eshik tashqaridan koʻrinishda chiziladi. Chap/oʻngni chizmada koʻringanidek yoz.
Rom tabaqalari orasida doim impost.
Soni yozilmagan boʻlsa 1. nom: hujjatdagi raqam yoki "Rom 1", "Eshik 1".
Rasm yonboshlab olingan boʻlsa, raqamlar va yozuvlar yoʻnalishiga qarab konstruksiyani toʻgʻri holatda oʻqi: L gorizontal (eni), H vertikal (boʻyi) oʻlcham. Eshik doim boʻyi enidan katta.
Agar usta "Nima chizilgan" deb Eshik yoki Vitraj tanlagan boʻlsa, T/Z yozilmagan boʻlsa ham ochiladigan qism eshik; ochilishi bilinmasa "ichkariga" yoz va savollar ga qoʻsh.
Oʻqib boʻlmagan oʻlchamni taxmin qilma: eng ehtimolini yoz va savollar ga qoʻsh.

ROMCHI PDF ("BUYURTMA MA'LUMOTI", har konstruksiya raqamlangan kartochka: chizma + Brend, Seriya, Rangi, Oynasi, ... Soni):
- Oʻlchamlar mm da: chap tomondagi umumiy boʻy = H, pastdagi eng uzun = L, ichkaridagi kichik raqamlar boʻlak oʻlchamlari (impost oʻrtasigacha). 10 ga boʻl.
- Chizmada ham ochilish chiziqlarining uchi ruchka tomonida, petlya belgilari (kichik toʻrtburchaklar) qarama-qarshi tomonda. F1, F2 — gluxoy; C1, C2 — ochiladigan.
- Chizma ostidagi TASHQARI/ICHKARI sxemasi: chiziq TASHQARI tomonga chiqsa tashqariga, ICHKARI tomonga tushsa ichkariga ochiladi.
- "Eshik ochilishi: ... T" yoki "Balkon Oʻrta T" — tashqariga ochiladigan eshik; "Z" yoki "Balkon Qanot Z" — ichkariga ochiladigan eshik. "Oyna ochilishi: Qanot Z" — rom tabaqasi (eshik emas).
- Yon uchburchak bilan birga uchi TEPADA boʻlgan chiziqlar (Romchi shunday chizadi) — dvaynoy: {"tur":"tabaqa","dvaynoy":true,...}.
- "Soni: N dona" — soni. nom: kartochka raqami bilan, masalan "1 Eshik", "2 Rom".
ProfStroy / ProfOkna PDF ("Коммерческое предложение", "№ 1 ..." jadval):
- "Размеры 810 x 2350 мм" — L x H (mm, 10 ga boʻl), "Количество" — soni. Chizma boʻlsa undagi oʻlchamlardan boʻlinishni ol.
- "дверная T створка" yoki "наружу" — tashqariga; "дверная Z", "внутрь", "вовнутрь" — ichkariga ochiladigan eshik. "поворотное вправо" — petlya oʻngda ("ong"), "влево" — chapda. "поворотно-откидное" — dvaynoy, "откидное" — fortochka.
- Chizmasi boʻlmasa ham jadvaldan konstruksiyani tuz; boʻlinishi bilinmasa bitta boʻlak qilib, savollar ga yoz.
Ikkala PDF uchun ham:
- Seriya yoki Система TERMO 70 / BKT 70 boʻlmasa (masalan TRIO, ENGELBERG, Aldoks, PVX), konstruksiyani baribir oʻqi, savollar ga "N: seriya X, Termo 70 da hisoblandi" deb yoz.
- Narx, rang, ruchka — oʻqima (dastur oʻzi hisoblaydi). Podokonnik chizmada aniq yozilgan boʻlsa (masalan "podokonnik 25"), konstruksiyaga "tanlov": {"podokonnik": 25} qoʻsh (faqat 15, 20, 25, 30, 35, 40, 45). Faqat oyna turi roʻyxatdagilardan biriga aniq mos kelsa, konstruksiyaga "tanlov": {"oyna_turi": "..."} qoʻsh. Roʻyxat: OYNA_ROYXATI.`;

function aiKalit() { return ol("ai_kalit"); }
async function aiKalitniOl() {
  if (aiKalit()) return aiKalit();
  const k = await shifrliOch("ai.enc");
  if (k) saqla("ai_kalit", k.trim());
  return aiKalit();
}
function aiSarf() {
  const oy = new Date().toISOString().slice(0, 7);
  let s = {};
  try { s = JSON.parse(ol("ai_sarf") || "{}"); } catch (e) { s = {}; }
  return s.oy === oy ? s : { oy, dollar: 0, soni: 0 };
}

let aiBurchak = 0;  // foydalanuvchi burgan burchak (0, 90, 180, 270)
async function rasmCanvas(f, maks) {
  // EXIF boʻyicha toʻgʻrilanadi, keyin foydalanuvchi burgan burchakka buriladi
  const img = await createImageBitmap(f, { imageOrientation: "from-image" });
  const k = Math.min(1, maks / Math.max(img.width, img.height));
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const yon = aiBurchak % 180 !== 0;
  const c = document.createElement("canvas");
  c.width = yon ? h : w; c.height = yon ? w : h;
  const x = c.getContext("2d");
  x.translate(c.width / 2, c.height / 2);
  x.rotate(aiBurchak * Math.PI / 180);
  x.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}
function pdfmi(f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""); }
function oynaTurlari() {
  try { return Object.keys(JSON.parse(ol("narxlar")).steklopaket_som || {}); } catch (e) { return []; }
}
async function aiKorinish() {
  if (!aiFayl || pdfmi(aiFayl)) { $("ai-korinish").hidden = true; return; }
  const c = await rasmCanvas(aiFayl, 600);
  $("ai-korinish").hidden = false;
  $("ai-rasm").src = c.toDataURL("image/jpeg", 0.8);
}

async function rasmTayyorla(f) {
  // Katta rasm kichraytiriladi (API chegarasi va tezlik uchun)
  if (pdfmi(f)) {
    const b = new Uint8Array(await f.arrayBuffer());
    let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(s) } };
  }
  const c = await rasmCanvas(f, 1600);
  const data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

async function aiOqi(fayl, izoh) {
  const kalit = await aiKalitniOl();
  if (!kalit) throw new Error("API kaliti yoʻq");
  const sarf = aiSarf();
  if (sarf.dollar >= AI_OYLIK_CHEGARA) throw new Error(`Shu oy chegarasi (${AI_OYLIK_CHEGARA} $) toʻldi`);
  const tur = $("ai-tur").querySelector(".faol").dataset.v;
  const qism = [];
  if (tur === "Eshik") qism.push("Bu ESHIK (rom emas). Ochiladigan qismi eshik boʻlagi boʻlsin: tur \"eshik\". Tepasida alohida oyna boʻlsa — framuga (gorizontal bolinish).");
  else if (tur === "Vitraj") qism.push("Bu VITRAJ: eshik va uning yonida (yoki tepasida) gluxoy oynalar. Ochiladigan qism tur \"eshik\", qolgani gluxoy.");
  else if (tur === "Rom") qism.push("Bu ROM (deraza): ochiladigan qismlar tur \"tabaqa\", eshik yoʻq.");
  if (izoh) qism.push("Ustaning izohi: " + izoh);
  const mazmun = [await rasmTayyorla(fayl), { type: "text", text: qism.join("\n") || "Hujjatdagi konstruksiyalarni ajrat." }];
  const javob = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": kalit, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 8000, system: AI_TIZIM.replace("OYNA_ROYXATI", oynaTurlari().join(", ") || "—"), output_config: { effort: "medium" }, messages: [{ role: "user", content: mazmun }] }),
  });
  const d = await javob.json().catch(() => ({}));
  if (!javob.ok) {
    if (javob.status === 401) { try { localStorage.removeItem("ai_kalit"); } catch (e) {} throw new Error("API kaliti notoʻgʻri"); }
    throw new Error(`API xatosi ${javob.status}: ${(d.error && d.error.message) || ""}`);
  }
  const dollar = (d.usage.input_tokens * 4 + d.usage.output_tokens * 20) / 1e6;
  sarf.dollar += dollar; sarf.soni += 1;
  saqla("ai_sarf", JSON.stringify(sarf));
  if (d.stop_reason !== "end_turn") throw new Error("Javob toʻliq emas: " + d.stop_reason);
  const matn = d.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const a = matn.indexOf("{"), b = matn.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Javob JSON emas");
  return { natija: JSON.parse(matn.slice(a, b + 1)), dollar };
}

// Har konstruksiyani hisob.py bilan tekshiradi; yaroqlisi zakazga qoʻshiladi
function konstrTekshir(k) {
  py.globals.set("_k", JSON.stringify(k));
  py.globals.set("_u", JSON.stringify(zakaz.umumiy));
  try {
    return JSON.parse(py.runPython(`
import zakaz as _zm
try:
    _kk = json.loads(_k)
    hisob.hisobla(_zm._birlashtir(json.loads(_u), {a: b for a, b in _kk.items() if a not in ("nom", "soni")}))
    _t = "null"
except (hisob.HisobXato, KeyError, ValueError, TypeError, AttributeError) as _e:
    _t = json.dumps(str(_e) or type(_e).__name__, ensure_ascii=False)
_t`));
  } catch (e) { return e.message.split("\n").slice(-2).join(" "); }
}

let aiFayl = null, aiRejim = "qosh";
document.querySelectorAll("[data-rasm]").forEach((inp) => inp.addEventListener("change", async () => {
  const f = inp.files[0];
  inp.value = "";
  if (!f) return;
  if (!ol("narxlar")) { xato("Avval narxlar faylini yuklang."); return; }
  if (f.size > 20 * 1024 * 1024) { xato("Fayl juda katta (20 MB dan oshmasin)."); return; }
  aiFayl = f; aiRejim = inp.dataset.rasm; aiBurchak = 0;
  aiKorinish().catch(() => { $("ai-korinish").hidden = true; });
  const s = aiSarf();
  $("ai-sarlavha").textContent = pdfmi(f) ? "PDF dan oʻqish" : "Rasmdan oʻqish";
  $("ai-matn").innerHTML = `<p><b>${esc(f.name)}</b></p><p class="xira">Shu oy: ${s.soni} ta, ${s.dollar.toFixed(2)} $ (chegara ${AI_OYLIK_CHEGARA} $)</p>`;
  $("ai-kalit-quti").hidden = !!(await aiKalitniOl());
  $("ai-izoh-quti").hidden = false;
  $("ai-tur-quti").hidden = false;
  $("ai-boshla").hidden = false;
  $("ai-oyna").hidden = false;
}));
$("ai-bur").addEventListener("click", () => { aiBurchak = (aiBurchak + 90) % 360; aiKorinish(); });
$("ai-tur").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  $("ai-tur").querySelectorAll("button").forEach((x) => x.classList.toggle("faol", x === b));
});
$("ai-yop").addEventListener("click", () => { $("ai-oyna").hidden = true; });
$("ai-boshla").addEventListener("click", async () => {
  if (!$("ai-kalit-quti").hidden) {
    const k = $("ai-kalit").value.trim();
    if (!k) return;
    saqla("ai_kalit", k);
  }
  $("ai-boshla").hidden = true; $("ai-izoh-quti").hidden = true; $("ai-tur-quti").hidden = true; $("ai-korinish").hidden = true; $("ai-kalit-quti").hidden = true;
  $("ai-matn").innerHTML = '<p>Oʻqilmoqda… (10–40 soniya)</p>';
  let r;
  try { r = await aiOqi(aiFayl, $("ai-izoh").value.trim()); } catch (e) {
    $("ai-matn").innerHTML = `<p class="ogoh">${esc(e.message)}</p>`;
    return;
  }
  if (aiRejim === "yangi" || !zakaz) { zakaz = yangiZakaz(); belgila(zakaz); }
  const qoshildi = [], xatolar = [];
  const nomlar = new Set(zakaz.konstruksiyalar.map((k) => k.nom));
  for (const k of r.natija.konstruksiyalar || []) {
    k.soni = Number.isInteger(k.soni) && k.soni > 0 ? k.soni : 1;
    let nom = String(k.nom || "K" + (zakaz.konstruksiyalar.length + 1));
    while (nomlar.has(nom)) nom += "+";
    k.nom = nom;
    if (k.tanlov && typeof k.tanlov === "object") {
      const t = k.tanlov.oyna_turi;
      k.tanlov = oynaTurlari().includes(t) ? { oyna_turi: t } : undefined;
      if (!k.tanlov) delete k.tanlov;
    } else delete k.tanlov;
    const x = konstrTekshir(k);
    if (x) { xatolar.push(`${nom}: ${x}`); continue; }
    nomlar.add(nom);
    zakaz.konstruksiyalar.push(k);
    qoshildi.push(nom);
  }
  $("ai-izoh").value = "";
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
  ekran("zakaz");
  const savol = r.natija.savollar || [];
  $("ai-sarlavha").textContent = qoshildi.length ? `${qoshildi.length} ta konstruksiya qoʻshildi` : "Konstruksiya qoʻshilmadi";
  $("ai-matn").innerHTML = (qoshildi.length ? `<p>${qoshildi.map(esc).join(", ")}</p><p class="xira">Har birini ochib tekshiring: oʻlcham va ochilish tomoni.</p>` : "") +
    (xatolar.length ? `<p class="ogoh">Qoʻshilmadi:<br>${xatolar.map(esc).join("<br>")}</p>` : "") +
    (savol.length ? `<p><b>Tekshiring:</b><br>${savol.map(esc).join("<br>")}</p>` : "") +
    `<p class="xira">Sarf: ${r.dollar.toFixed(3)} $</p>`;
});

// Yangi versiya chiqsa: yangi service worker oʻrnashgach sahifa bir marta oʻzi yangilanadi
if ("serviceWorker" in navigator) {
  const birinchi = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
  let qayta = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!birinchi && !qayta) { qayta = true; location.reload(); } });
}
window.addEventListener("DOMContentLoaded", arxivniChiz);
yukla();
