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
  // zaxira chiqish: manzil oxirida #tozala — chala chizma tiklanmaydi
  if (location.hash === "#tozala") {
    try { localStorage.setItem("qoralama_buzuq", localStorage.getItem("qoralama") || ""); localStorage.removeItem("qoralama"); } catch (e) {}
    history.replaceState(null, "", location.pathname);
  }
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
    if (zakaz && !qoralamaniTikla() && ol("qoralama_buzuq")) holat("Oldingi chala chizma ochilmadi (ilova qotgan edi) — u tiklanmadi");
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
  document.body.dataset.ekran = nom;
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
  // Boʻlim aksenti (docs/dizayn.md): Hisoblangan — koʻk, Boshlangan — toʻq sariq, Tugallangan — yashil
  const BELGI = { yangi: ["🧮", "var(--aks-k-fon)", "var(--aks-k)"], jarayonda: ["🛠", "var(--aks-s-fon)", "var(--aks-s)"], qarzdor: ["⏰", "#ffebee", "var(--xato)"], tugatilgan: ["✔", "var(--aks-h-fon)", "var(--aks-h)"] };
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
// Konstruksiya narxi — yolgʻiz narx (chegara, skladsiz, 1 dona); jami — haqiqiy kesish, farqi otxod_tuzatma_usd (foydalanuvchi, 2026-11-15)
function pyTannarx(z, faqatNarx) {
  // faqatNarx (konstruktor): konstruksiya narxi usulga bogʻliq emas — chegara, skladsiz, tezroq
  const usul = faqatNarx ? "chegara" : otxodUsuli();
  const sk = usul.startsWith("sklad") ? skladSaqlangan() : null;
  py.globals.set("_zakaz", JSON.stringify(z));
  py.globals.set("_kurs", Number($("kurs").value) || 12000);
  py.globals.set("_ou", usul);
  py.globals.set("_osk", sk ? JSON.stringify(sk.qatorlar) : "null");
  try {
    return JSON.parse(py.runPython(`
try:
    _natija = json.dumps({"ok": tannarx.tannarx(json.loads(_zakaz), kurs=_kurs, otxod_usuli=_ou, sklad=json.loads(_osk), otxod_bolish="yolgiz")}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _natija = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_natija`));
  } catch (e) {
    return { xato: "Kutilmagan xato: " + e.message.split("\n").slice(-2).join(" ") };
  }
}

// Tanlangan boʻlakdagi tabaqa(lar)ning kesish oʻlchami (konstruktor paneli; foydalanuvchi, 2026-11-14)
// chizma uchun: tabaqa kesish oʻlchami (belgilangan) va profil ustidagi kesish uzunligi (yozuvlar)
function pyChizma(k) {
  py.globals.set("_k", JSON.stringify(k));
  py.globals.set("_u", JSON.stringify(zakaz.umumiy));
  try {
    return JSON.parse(py.runPython(`
import zakaz as _zm
try:
    _kk = json.loads(_k)
    _n = hisob.hisobla(_zm._birlashtir(json.loads(_u), {a: b for a, b in _kk.items() if a not in ("nom", "soni")}))
    _t = json.dumps({"belgilangan": _n.get("belgilangan") or [], "yozuvlar": _n.get("yozuvlar") or []})
except (hisob.HisobXato, KeyError, ValueError, TypeError, AttributeError):
    _t = '{"belgilangan": [], "yozuvlar": []}'
_t`));
  } catch (_) { return { belgilangan: [], yozuvlar: [] }; }
}
const pyTabaqa = (k) => pyChizma(k).belgilangan;

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
  // rang_id yoʻq (eski zakaz) — xotirada beriladi (tartib boʻyicha 1, 2, 3 …), keyingi oʻzgarishda saqlanadi
  rangBer(zakaz.konstruksiyalar);
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

// ---------- konstruksiyalar roʻyxati (foydalanuvchi, 2026-11-15; docs/dizayn.md "Konstruksiyalar paneli") ----------
// Bitta panel, qator: rang tasmasi · raqam · rasm · nom, oʻlcham, farqli teglar · narx · soni · ⋯
const mijozRejim = () => ol("mijoz_rejimi") === "1";
function kTeglar(k) {
  const u = zakaz.umumiy, t = { ...(u.tanlov || {}), ...(k.tanlov || {}) };
  return [k.rama || u.rama, t.rang_nomi || t.rang, (t.oyna_turi || "") + " " + (k.oyna_qalinligi || u.oyna_qalinligi || 24) + " mm",
    t.podokonnik && !/"tur":"eshik"/.test(JSON.stringify(k.bolak || {})) ? "podokonnik " + t.podokonnik : null].filter(Boolean);
}
// Mijozga narx (soʻm): mijozga PDF dagi formula — qator = (tannarx + otxod tuzatma ulushi) × seriya ustamasi × kurs,
// jami = kelishilgan narx (chegirmadan keyin, qulflangan boʻlsa eski narx)
// Qatorlar yigʻindisi = jami (foydalanuvchi, 2026-11-15): har qator yaxlitlanadi (qadam), oxirgisi — jami − qolganlari.
// Kalit — hisob natijasidagi konstruksiya obʼyekti (nom emas: nomlar takrorlanishi mumkin).
function qoldiqBilan(n, qiymat, jami, qadam) {
  const ks = n.konstruksiyalar, v = ks.map((x) => Math.round(qiymat(x) / qadam) * qadam);
  if (v.length) v[v.length - 1] = Math.round((jami - v.slice(0, -1).reduce((a, b) => a + b, 0)) / qadam) * qadam;
  return new Map(ks.map((x, i) => [x, v[i]]));
}
// Zakaz konstruksiyasi → hisob natijasi: faol (soni ≠ 0) tartib boʻyicha (zakaz.py/tannarx bilan bir xil shart)
function hisobMos(n = natija) {
  const m = new Map();
  let j = 0;
  for (const k of zakaz.konstruksiyalar) if ((k.soni ?? 1) !== 0) m.set(k, n.konstruksiyalar[j++]);
  return m;
}
// Oddiy rejim qatori ($): yolgʻiz narx + otxod tuzatmasi ulushi (narxga mutanosib) — Σ qatorlar = TANNARX (n.jami_usd)
function qatorTannarx(n = natija) { return qoldiqBilan(n, (x) => x.jami_usd + tuzUlush(n, x), n.jami_usd, 0.01); }
function mijozNarx(n = natija) {
  const kurs = n.kurs, h = hk();
  const chegirma = Number(h.chegirma_som) || 0;
  const boshlang = Math.round((n.jami_usd + ustamalar(n).reduce((a, u) => a + u.ustama, 0)) * kurs);
  const qulfSom = narxQulfi(boshlang / kurs);
  const q = qoldiqBilan(n, (x) => (x.jami_usd + tuzUlush(n, x)) * ustamaKoef(n, x.seriya) * kurs, boshlang, 1);
  return { boshlang, chegirma, qulf: qulfSom != null, kelish: qulfSom != null ? qulfSom : boshlang - chegirma,
    qator: (x) => q.get(x) };
}
let izohOchiq = null;  // izohi tahrirlanayotgan konstruksiya indeksi
function royxatniChiz() {
  const n = natija, mr = mijozRejim() && n, mn = mr ? mijozNarx(n) : null, qt = n ? qatorTannarx(n) : null;
  const kl = zakaz.konstruksiyalar;
  const sonlar = kl.map((k) => k.soni ?? 1);
  const jamiSoni = sonlar.reduce((a, b) => a + b, 0), jamiM2 = kl.reduce((a, k, i) => a + yuza(k) * sonlar[i], 0);
  $("x-soni").textContent = jamiSoni;
  $("x-m2").textContent = m2(jamiM2);
  if (mn) $("x-narx").textContent = som(mn.kelish);
  else if (mijozRejim()) $("x-narx").textContent = "—";
  mijozniChiz();
  $("zakaz-nomi").textContent = (zakaz.nom ? zakaz.nom + " · " : "") + kl.length + " ta konstruksiya";
  const hm = n ? hisobMos(n) : new Map();
  const teglar = kl.map(kTeglar);
  const umumiy = teglar.length ? teglar[0].filter((t) => teglar.every((q) => q.includes(t))) : [];
  const qatorlar = kl.map((k, i) => {
    const nom = k.nom || "K" + (i + 1), h = hm.get(k), soni = sonlar[i];
    const [fon] = kRang(k);
    const farq = teglar[i].filter((t) => !umumiy.includes(t));
    let narx;
    if (!h) narx = `<span class="xira">${soni === 0 ? "hisobga kirmaydi" : "—"}</span>`;
    else if (mn) { const q = mn.qator(h); narx = `<b data-qator-som="${q}">${som(q)}</b>${soni > 1 ? `<small>1 dona ${som(q / soni)}</small>` : ""}`; }
    else { const q = qt.get(h); narx = `<b data-qator-usd="${q.toFixed(2)}">${usd(q)}</b><small>${soni > 1 ? `1 dona ${usd(q / soni)}` : "tannarx"}</small>`; }
    const izoh = izohOchiq === i
      ? `<input class="eslatma" data-eslatma="${i}" value="${esc(k.eslatma || "")}" placeholder="Izoh (masalan: 2-qavat, oshxona)" autocomplete="off">`
      : k.eslatma ? `<button class="kq-izoh" data-izoh="${i}">📝 ${esc(k.eslatma)}</button>` : "";
    return `<div class="kq${soni === 0 ? " nol" : ""}" style="--kr:${fon}">
      <div class="kq-ich" data-tahrir="${i}" role="button" tabindex="0" aria-label="${esc(nom)} — tahrirlash">
        ${kRaqamHtml(k)}
        <div class="kq-rasm">${chizmaSVG(k, { kichik: true })}</div>
        <div class="kq-matn"><b>${esc(nom)}</b><span class="kq-olcham">${esc(k.L)} × ${esc(k.H)}</span>
          ${farq.length ? `<span class="kq-teg">${farq.map(esc).join(" · ")}</span>` : ""}</div>
      </div>
      <div class="kq-amal"><div class="kq-narx">${narx}</div><div class="kq-boshqar"><div class="soni"><button data-i="${i}" data-d="-1" aria-label="Kamaytirish">−</button><span>${soni}</span><button data-i="${i}" data-d="1" aria-label="Koʻpaytirish">+</button></div>
        <button class="kq-menyu" data-menyu="${i}" aria-label="Amallar">⋯</button></div></div>
      ${h && h.izoh ? `<div class="ogoh kq-ogoh">${esc(h.izoh)}</div>` : ""}${izoh}
    </div>`;
  }).join("");
  let jami = "";
  if (kl.length) {
    const narx = !n ? "—" : mn ? `<span>mijozga narx</span><b data-jami-som="${mn.boshlang}">${som(mn.kelish)}</b>` : `<span>tannarx</span><b data-jami-usd="${n.jami_usd.toFixed(2)}">${usd(n.jami_usd)}</b>`;
    jami = `<div class="kp-jami"><div><b>Jami</b> — ${jamiSoni} dona · ${m2(jamiM2)}</div><div class="kp-jami-narx">${narx}</div></div>` +
      (mn && mn.qulf ? `<div class="kp-chegirma"><span>qatorlar (hozirgi hisob) ${som(mn.boshlang)}</span><span>kelishilgan narx — eski</span></div>`
        : mn && mn.chegirma ? `<div class="kp-chegirma"><span>chegirmagacha ${som(mn.boshlang)}</span><span>chegirma − ${som(mn.chegirma)}</span></div>` : "");
  }
  $("konstruksiyalar").innerHTML = kl.length ? `<div class="kpanel">${umumiy.length ? `<div class="kp-teglar">${umumiy.map(esc).join(" · ")}</div>` : ""}${qatorlar}${jami}</div>`
    : '<p class="xira">Konstruksiya yoʻq. Pastdagi tugma bilan qoʻshing.</p>';
  if (izohOchiq != null) { const inp = $("konstruksiyalar").querySelector("[data-eslatma]"); if (inp) inp.focus(); }
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
// Otxod tuzatmasi (haqiqiy kesish − konstruksiyalar yolgʻiz narxi) konstruksiyalarga narxiga mutanosib ulush:
// ustama shu ulush bilan hisoblanadi, mijoz PDF ida qatorlar yigʻindisi = jami (2026-11-15)
function tuzUlush(n, k) {
  const t = n.otxod_tuzatma_usd || 0, s = n.konstruksiyalar.reduce((a, x) => a + x.jami_usd, 0);
  return t && s ? t * k.jami_usd / s : 0;
}
function ustamalar(n = natija) {
  const h = hk(), st = ustamaStandart(), guruh = new Map();
  for (const k of n.konstruksiyalar) {
    const s = k.seriya || "Termo 70";
    guruh.set(s, (guruh.get(s) || 0) + k.jami_usd + tuzUlush(n, k));
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
// Faqat oʻqiydi (konstruktor uchun): zakazga hech narsa yozmaydi
function ustamaKoefOqi(seriya) {
  const h = hk(), s = seriya || "Termo 70";
  const f = (h.ustama_seriya && h.ustama_seriya[s]) ?? (h.ustama_foiz != null ? Number(h.ustama_foiz) : null) ?? ustamaStandart()[s];
  return 1 + (Number(f) || 0) / 100;
}
function ustamaKoef(n, seriya) { const u = ustamalar(n).find((x) => x.seriya === (seriya || "Termo 70")); return 1 + (u ? u.foiz : 0) / 100; }

// Qulflangan zakazda yangi hisob eski narxdan farq qilsa — eski narx_som (soʻm), aks holda null
const TUZATMA_OGOH_FOIZ = 5;
function narxQulfi(mijozga) {
  const h = hk(), kurs = natija.kurs, ch = h.narx_chegirma_som != null ? Number(h.narx_chegirma_som) : Number(h.chegirma_som) || 0;
  const qulf = !!((zakaz.shartnoma && zakaz.shartnoma.summa) || Number(h.avans_som) > 0 || Number(zakaz.tolangan) > 0 ||
    holatOl(zakaz) !== "hisoblangan");
  return qulf && zakaz.narx_som && Math.abs(zakaz.narx_som + ch - Math.round(mijozga * kurs)) > 1 ? zakaz.narx_som : null;
}
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
  const tuz = n.otxod_tuzatma_usd || 0;
  $("j-tuz-q").hidden = Math.abs(tuz) < 0.005;
  $("j-tuz").textContent = (tuz > 0 ? "+ " : "− ") + pul(Math.abs(tuz));
  $("j-tuz").className = tuz > 0 ? "zarar" : "tejam";
  // Tuzatma (zarar) jamining 5 % idan oshsa — ogohlantirish (foydalanuvchi, 2026-11-15)
  const tuzFoiz = n.jami_usd > 0 ? tuz / n.jami_usd * 100 : 0;
  $("tuz-ogoh").hidden = !(tuzFoiz > TUZATMA_OGOH_FOIZ);
  $("tuz-ogoh").textContent = `Otxod tuzatmasi jamining ${son(tuzFoiz, 0)} % i — otxod usuli (${n.otxod_usuli_nomi}) yoki birga kesish narxni oshirmoqda.`;
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
  $("x-narx").textContent = mijozRejim() ? som(mijozNarx(n).kelish) : pul(mijozga);
  const narxSom = Math.round((mijozga - chegirma) * kurs);
  // Shartnoma, avans, kassada toʻlov yoki ish boshlangan zakazda narx jimgina qayta yozilmaydi (foydalanuvchi, 2026-11-15).
  // Chegirma oʻzgarishi qulfga tushmaydi (qoʻlda kiritiladi) — taqqoslash chegirmagacha.
  const qolganSom = narxQulfi(mijozga);
  $("j-tolov").textContent = qolganSom != null ? pul(qolganSom / kurs) : pul(mijozga - chegirma);
  $("j-qoldiq").textContent = qolganSom != null ? pul(qolganSom / kurs - avans) : pul(mijozga - chegirma - avans);
  const oz = $("narx-ozgardi");
  if (qolganSom != null) {
    oz.hidden = false;
    oz.innerHTML = `Narx oʻzgardi: ${som(zakaz.narx_som)} → ${som(narxSom)}. <button class="kichik-t" data-narx-yangila="${narxSom}">Yangilash</button>`;
  } else {
    oz.hidden = true;
    const ch = Number(h.chegirma_som) || 0;  // narx_som qaysi chegirma bilan yozilgani — qulfda chegirma oʻzgarishi uchun
    if (zakaz.narx_som !== narxSom || h.narx_chegirma_som !== ch) { zakaz.narx_som = narxSom; h.narx_chegirma_som = ch; saqla("oxirgi_zakaz", JSON.stringify(zakaz)); }
  }
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
function xarajatHtml(h) {
  const n = natija, j = n.konstruksiyalar.indexOf(h);
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
// Boʻlak "k" — faol (soni ≠ 0) konstruksiyalar ichidagi indeks (raskroy.kesish_chizmasi bilan bir xil shart)
function kesishHtml(r) {
  const faol = zakaz.konstruksiyalar.filter((k) => (k.soni ?? 1) !== 0);
  const kk = (i) => faol[i] || { rang_id: i + 1 };
  const leg = r.konstruksiyalar.map((k, i) => `<span class="kl">${kRaqamHtml(kk(i))}${esc(k.nom)} × ${k.soni}</span>`).join("");
  return `<div class="k-leg">${leg}</div>` + r.profillar.map((p) => `<div class="kp">
    <div class="kp-bosh"><b>${esc(p.nom)}</b><span>${p.hivich_sm} sm × ${p.hivichlar.length} dona</span></div>
    <div class="kp-stat"><span>Samaradorlik <b>${son(p.samaradorlik, 1)}%</b></span><span>Kesimlar <b>${p.kesimlar}</b></span><span>Qoldiq <b>${son(p.qoldiq_sm, 1)} sm</b></span></div>
    <div class="xira kp-kesim">${kesimMatn(p.kesim)}${p.otxod_chegara ? ` · ${p.otxod_chegara} sm dan kichik qoldiq otxod` : ""}</div>
    ${p.hivichlar.map((h, i) => `<div class="kb-qator"><span class="kb-n">#${i + 1}</span><div class="kb">${h.bolaklar.map((b) =>
      `<div style="flex:${b.uzunlik} 0 0;background:${kRang(kk(b.k))[0]};color:${kRang(kk(b.k))[1]}"><i>${kRaqam(kk(b.k))}</i>${son(b.uzunlik, 1)}</div>`).join("")}${h.qoldiq > 0 ?
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
const RASM_NOM = [[/A6004|A6011|cremone|comfort okon/i, "RUCHKA_ROM"], [/nojnitsa|3400\.2/i, "NOJNITSA"], [/3420F|dv\. otk/i, "DVAYNOY_MEX"],
  [/rezina ю|5603/i, "EPDM_YU"], [/A9211\.3/, "A9211_3"], [/4514/, "A4514"], [/1076\.92\.28|komfort dver/i, "1076_92_28"], [/stublina 1177|1177\.85/i, "1177"],
  [/roto lux/i, "ROTO_LUX"], [/petlya 100/i, "PETLYA_100"], [/krishka podokonnik/i, "KRISHKA_POD"], [/ct 203|takos pvh/i, "CT203"],
  [/takos regul/i, "TAKOS_REG"], [/soedinitel 7000/i, "SOED_7000"], [/M(115)?35/, "M535"], [/W02/, "W02"], [/W03/, "W03"],
  [/J01/, "J01"], [/J05/, "J05"], [/5025/, "EPDM_5025"], [/5108/, "EPDM_5108"],
  // AKFA "Механизмы" rasmi Fornax/Roto uchun (foydalanuvchi: deyarli bir xil)
  [/4207/, "ZATSEP_4207"], [/vadasliv/i, "VADASLIV"], [/zatsepka/i, "ZATSEP_PVX"], [/ispanilet/i, "ISPANILET"], [/sredniy prijim/i, "SREDNIY_ZAPOR"], [/petli komplekt/i, "PETLYA_OPORA"]];
const BELGILAR = [[/ruchka/i, "✋"], [/zamok|serdtsevina|otvetka|a4202|cylinder/i, "🔒"], [/petlya|nojnitsa|dv\. otk/i, "🔗"],
  [/tij/i, "📏"], [/samorez|yhbm|ysbm|3,9×/i, "🔩"], [/kley|k188/i, "🧴"], [/pena|mk 01/i, "🧯"], [/podokonnik/i, "▭"],
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
  if (Math.abs(n.otxod_tuzatma_usd || 0) >= 0.005) q.push(`Otxod tuzatmasi: ${n.otxod_tuzatma_usd > 0 ? "+" : "−"} ${usd(Math.abs(n.otxod_tuzatma_usd))}`);
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
// Roʻyxatdagi oʻzgarish (soni, nusxa, oʻchirish): rang_id lar ham shu bilan saqlanadi
function royxatOzgardi() {
  rangBer(zakaz.konstruksiyalar);
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
}
$("konstruksiyalar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && b.dataset.menyu != null) { menyuOch(Number(b.dataset.menyu), b); return; }
  if (b && b.dataset.izoh != null) { izohOchiq = Number(b.dataset.izoh); royxatniChiz(); return; }
  if (b && b.dataset.i != null) {
    const k = zakaz.konstruksiyalar[Number(b.dataset.i)];
    k.soni = Math.max(0, (k.soni ?? 1) + Number(b.dataset.d));
    royxatOzgardi();
    return;
  }
  if (b || e.target.closest("input")) return;
  const q = e.target.closest("[data-tahrir]");
  if (q) konstruktorniOch(Number(q.dataset.tahrir));
});
$("konstruksiyalar").addEventListener("keydown", (e) => {
  const q = e.target.closest("[data-tahrir]");
  if (q && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); konstruktorniOch(Number(q.dataset.tahrir)); }
});
// "⋯" menyu: Xarajat (oddiy rejimda), Nusxa, Izoh, Oʻchirish (tasdiq bilan)
let menyuK = null;
function menyuYop() { $("k-menyu").hidden = true; menyuK = null; }
function menyuOch(i, tugma) {
  const m = $("k-menyu");
  if (menyuK === i && !m.hidden) { menyuYop(); return; }
  menyuK = i;
  const k = zakaz.konstruksiyalar[i], nom = k.nom || "K" + (i + 1);
  const h = natija && hisobMos().get(k);
  m.innerHTML = `<div class="k-menyu-bosh">${kRaqamHtml(k)}<b>${esc(nom)}</b></div>` +
    (h && !mijozRejim() ? `<button data-m="xarajat">💲 Xarajat</button>` : "") +
    `<button data-m="nusxa">⧉ Nusxa</button><button data-m="izoh">📝 Izoh</button><button data-m="ochir" class="xavfli">🗑 Oʻchirish</button>`;
  m.hidden = false;
  const r = tugma.getBoundingClientRect(), mb = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(innerWidth - mb.width - 8, r.right - mb.width)) + "px";
  // pastga sigʻmasa tepaga, u yerga ham sigʻmasa ekran ichida (yotiq holat)
  const top = r.bottom + mb.height + 8 <= innerHeight ? r.bottom + 4 : r.top - mb.height - 4 >= 8 ? r.top - mb.height - 4 : innerHeight - mb.height - 8;
  m.style.top = Math.max(8, top) + "px";
}
$("k-menyu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]");
  if (!b || menyuK == null) return;
  const i = menyuK, k = zakaz.konstruksiyalar[i], amal = b.dataset.m;
  if (amal === "ochir" && !b.classList.contains("tasdiq")) { b.classList.add("tasdiq"); b.textContent = "Rostdan oʻchirilsinmi?"; return; }
  menyuYop();
  if (amal === "xarajat") { xarajatOch(i); return; }
  if (amal === "izoh") { izohOchiq = i; royxatniChiz(); return; }
  if (amal === "nusxa") {
    const y = nusxa(k);
    delete y.rang_id;  // nusxa yangi rang oladi
    const nomlar = zakaz.konstruksiyalar.map((x) => x.nom);
    let n = 2;
    while (nomlar.includes(`${y.nom} (${n})`)) n++;
    y.nom = `${y.nom} (${n})`;
    zakaz.konstruksiyalar.splice(i + 1, 0, y);
  } else if (amal === "ochir") {
    zakaz.konstruksiyalar.splice(i, 1);
    izohOchiq = null;
  }
  royxatOzgardi();
});
document.addEventListener("click", (e) => {
  if (!$("k-menyu").hidden && !e.target.closest("#k-menyu") && !e.target.closest("[data-menyu]")) menyuYop();
});
window.addEventListener("scroll", () => { if (!$("k-menyu").hidden) menyuYop(); }, { passive: true });
function xarajatOch(i) {
  const k = zakaz.konstruksiyalar[i], nom = k.nom || "K" + (i + 1);
  $("xarajat-sarlavha").innerHTML = `${kRaqamHtml(k)} ${esc(nom)} <span class="xira">${esc(k.L)} × ${esc(k.H)}</span>`;
  $("xarajat-ich").innerHTML = (natija && xarajatHtml(hisobMos().get(k))) || '<p class="xira">Hisob yoʻq</p>';
  $("xarajat-oyna").hidden = false;
}
$("xarajat-yop").addEventListener("click", () => { $("xarajat-oyna").hidden = true; });
$("xarajat-oyna").addEventListener("click", (e) => { if (e.target === $("xarajat-oyna")) $("xarajat-oyna").hidden = true; });
$("k-qosh").addEventListener("click", () => konstruktorniOch(-1));
$("k-qosh2").addEventListener("click", () => konstruktorniOch(-1));
$("konstruksiyalar").addEventListener("change", (e) => {
  const el = e.target.closest("[data-eslatma]");
  if (!el) return;
  const k = zakaz.konstruksiyalar[Number(el.dataset.eslatma)];
  if (el.value.trim()) k.eslatma = el.value.trim(); else delete k.eslatma;
  rangBer(zakaz.konstruksiyalar);
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
});
$("konstruksiyalar").addEventListener("focusout", (e) => {
  if (!e.target.closest("[data-eslatma]")) return;
  // butun roʻyxat qayta chizilmaydi (aks holda boshqa tugmaga birinchi bosish yoʻqoladi) — faqat maydon almashadi
  const inp = e.target, i = Number(inp.dataset.eslatma), k = zakaz.konstruksiyalar[i];
  izohOchiq = null;
  if (k && k.eslatma) { const b = document.createElement("button"); b.className = "kq-izoh"; b.dataset.izoh = i; b.textContent = "📝 " + k.eslatma; inp.replaceWith(b); }
  else inp.remove();
});
// Mijoz rejimi (foydalanuvchi, 2026-11-15): tannarx, xarajat, otxod, ustama, $ yashiriladi; faqat mijozga narx soʻmda
function mijozRejimQoy(yoq) {
  saqla("mijoz_rejimi", yoq ? "1" : "0");
  document.body.classList.toggle("mijoz-rejim", yoq);
  $("mijoz-rejim").setAttribute("aria-pressed", String(yoq));
  $("mijoz-rejim").innerHTML = yoq ? "👁 Mijoz rejimi <b>YOQILGAN</b>" : "👁 Mijoz rejimi";
  if (yoq && /^[hs]$/.test($("e-zakaz").dataset.tab)) tabOch("k");
  if (zakaz && natija) { hisobKitobniChiz(); royxatniChiz(); }
}
$("mijoz-rejim").addEventListener("click", () => { menyuYop(); mijozRejimQoy(!mijozRejim()); });
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
  const n = natija, m = zakaz.mijoz || {}, h = hk();
  const avans = Number(h.avans_som) || 0;
  const { boshlang, chegirma, kelish, qator } = mijozNarx(n);  // qulf: kelishilgan eski narx
  const hm = hisobMos(n);
  const u = zakaz.umumiy;
  const faol = zakaz.konstruksiyalar.filter((k) => (k.soni ?? 1) > 0);
  const jamiSoni = faol.reduce((a, k) => a + (k.soni ?? 1), 0);
  const jamiM2 = faol.reduce((a, k) => a + yuza(k) * (k.soni ?? 1), 0);
  const kHisob = (k) => hm.get(k);
  const malumot = (y, v) => (v ? `<div><span>${esc(y)}</span><b>${esc(v)}</b></div>` : "");
  let s = `<div class="p-bosh"><div><div class="p-sarlavha">BUYURTMA №${esc(zakaz.raqam ?? "")}</div>
      <div>${esc(zakaz.sana || new Date().toISOString().slice(0, 10))} · TERMO 70 (BKT 70)</div></div>
      ${ol("bajaruvchi") ? `<div class="p-baj"><b>${esc(ol("bajaruvchi"))}</b>${ol("bajaruvchi_tel") ? `<span>${esc(ol("bajaruvchi_tel"))}</span>` : ""}</div>` : ""}</div>
    <div class="p-mijoz">${malumot("Buyurtmachi", m.ism)}${malumot("Telefon", m.telefon)}${malumot("Manzil", m.manzil)}${malumot("Muddat", m.muddat)}</div>
    <table class="p-faktura"><thead><tr><th>№</th><th>Nomi</th><th>Oʻlchami, sm</th><th>Soni</th><th>Yuzasi</th>${o.narx ? "<th>Narxi</th>" : ""}</tr></thead><tbody>
    ${faol.map((k) => { const x = kHisob(k); return `<tr><td>${kRaqamHtml(k)}</td><td>${esc(k.nom)}</td><td>${esc(k.L)} × ${esc(k.H)}</td><td>${k.soni ?? 1}</td><td>${son(yuza(k) * (k.soni ?? 1), 2)} m²</td>${o.narx ? `<td>${x ? som(qator(x)) : "—"}</td>` : ""}</tr>`; }).join("")}
    </tbody><tfoot><tr><td></td><td>Jami</td><td></td><td>${jamiSoni}</td><td>${son(jamiM2, 2)} m²</td>${o.narx ? `<td>${som(boshlang)}</td>` : ""}</tr></tfoot></table>`;
  if (o.narx) {
    s += `<div class="p-jami">${chegirma ? `<div><span>Chegirma</span><b>− ${som(chegirma)}</b></div>` : ""}
      <div class="p-asosiy"><span>Kelishilgan narx</span><b>${som(kelish)}</b></div>
      ${avans ? `<div><span>Avans</span><b>${som(avans)}</b></div><div class="p-qoldiq"><span>Qoldiq</span><b>${som(kelish - avans)}</b></div>` : ""}</div>`;
  }
  s += `<div class="p-kartalar">`;
  faol.forEach((k) => {
    const t = { ...(u.tanlov || {}), ...(k.tanlov || {}) };
    const x = kHisob(k);
    s += `<div class="p-k"><div class="p-k-bosh">${kRaqamHtml(k, true)}<b>${esc(k.nom)}</b><span>${esc(k.L)} × ${esc(k.H)} sm · ${k.soni ?? 1} dona</span></div>
      <div class="p-rasm">${chizmaSVG(k, { kichik: !o.olcham })}</div>
      <div class="p-xus">${malumot("Rama", k.rama || u.rama)}${malumot("Rang", t.rang_nomi ? `${t.rang} (${t.rang_nomi})` : t.rang)}
        ${malumot("Oyna", `${t.oyna_turi || ""} ${k.oyna_qalinligi || u.oyna_qalinligi || 24} mm`)}${malumot("Yuzasi", son(yuza(k), 2) + " m²")}
        ${malumot("Izoh", k.eslatma)}${o.narx && x ? malumot("Narxi", som(qator(x))) : ""}</div></div>`;
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
    ${p.konstruksiyalar.map((k) => `<div class="sp-kon"><b>${(({ x }) => (x ? kRaqamHtml(x) + " " : ""))({ x: zakaz.konstruksiyalar.find((z) => z.nom === k.nom) })}${esc(k.nom)}: ${son(k.L, 1)} × ${son(k.H, 1)} sm, ${k.soni} dona</b>
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
  if (mijozRejim() && /^[hs]$/.test(t)) t = "k";  // mijoz rejimida Hisob va Sex yoʻq
  $("e-zakaz").dataset.tab = t;
  document.body.dataset.tab = t;
  for (const b of $("z-tablar").querySelectorAll("button")) b.classList.toggle("faol", b.dataset.tab === t);
  saqla("z_tab", t);
  window.scrollTo(0, 0);
  if (t === "s" && zakaz && natija) $("kesish-quti").open = true;
}
$("z-tablar").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) tabOch(b.dataset.tab); });
$("d-kesish").addEventListener("click", () => {
  if (mijozRejim()) return; $("kesish-quti").open = true; tabOch("s"); });
mijozRejimQoy(mijozRejim());
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
{"konstruksiyalar": [ {"nom": "...", "soni": 1, "L": 150, "H": 150, "bolak": BOLAK} ], "savollar": [SAVOL, ...]}
SAVOL — noaniq joy, oʻzbekcha, qisqa. Iloji boʻlsa variantlar bilan (usta bitta tugma bosib javob beradi):
{"k": 0 (konstruksiya tartib raqami, 0 dan), "savol": "3-boʻlak ochiladimi?", "variantlar": [{"nom": "Gluxoy", "ozgarish": []}, {"nom": "Tabaqa, petlya chapda", "ozgarish": [{"yol": ["bolak", "bolaklar", 2], "qiymat": {"tur": "tabaqa", "petlya_tomoni": "chap"}}]}]}
Konstruksiyaga eng ehtimolli javobni yoz; u birinchi variant boʻlsin, "ozgarish": [] bilan. Boshqa variant — shu konstruksiya obyektiga qoʻllanadigan oʻzgarishlar: "yol" — kalitlar va indekslar ("L", "H", "bolak", "olchamlar", 0 …), "qiymat" — shu joyga qoʻyiladigan yangi qiymat (son yoki butun BOLAK). 2–4 variant. Variant berib boʻlmasa — oddiy matn: "savol matni".

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
IMPOST TARTIBI: avval TIK impost (butun boʻyga, tepadan pastgacha), keyin yotiq. Agar tik impost yotiq impostni kesib oʻtib tepadan pastgacha borsa (yuqori va pastki qatorda bir joyda), ildiz — "vertikal" boʻlinish (ustunlar), har ustun ichida "gorizontal". Ildiz "gorizontal" faqat yotiq impost butun eniga uzluksiz borsa (masalan eshik ustidagi butun framuga, ostida ustunlar boshqa joyda).
SERIYA VA RANG (hujjatda yoki eskiz yonida yozilgan boʻlsa; lotin yoki kirill, masalan "Алдокс 306g"): har konstruksiyaga "rama" qoʻsh — Aldoks / Aldox / Алдокс → "183"; Engelberg / 7000 → "7051"; Termo 70 / BKT 70 → "F702" (F703 aniq yozilsa "F703"). Rang — "tanlov" ga: oq → "rang": "Oq", "rang_nomi": "oq"; 306g (kraska) → "rang": "Svetnoy (kraska)", "rang_nomi": "306g"; grey, z/d, d/m, sh/d, alux → "rang": "Laminatsiya", "rang_nomi": shu nom; anod → "rang": "Anod", "rang_nomi": "anod". Yozilmagan boʻlsa qoʻshma.
Boʻlak ichida uning enini (yoki boʻyini) toʻliq kesib oʻtgan kalta chiziq — shu boʻlakning oʻz impostidir, uni tashlab ketma: boʻlakni ichida "bolinish" qil. Ochiladigan tabaqa ostidagi yotiq impost (pastki gluxoy) oʻlchami yozilmagan boʻlsa — pastki boʻlak 70 sm (pastdan impost oʻqigacha): "olchamlar": [null, 70], "bolaklar": [tabaqa, {"tur":"gluxoy"}] (foydalanuvchi qoidasi).
Qoʻlda chizilgan eskizda ichki oʻlcham yozilmagan boʻlsa, chiziq tepadan pastgacha bitta boʻlib ketsa — bu bitta tik impost: ustunlarni oldin ajrat, yuqori va pastki qatordagi joyi bir xil boʻlsin.
Soni yozilmagan boʻlsa 1. nom: hujjatdagi raqam yoki "Rom 1", "Eshik 1".
Rasm yonboshlab olingan boʻlsa, raqamlar va yozuvlar yoʻnalishiga qarab konstruksiyani toʻgʻri holatda oʻqi: L gorizontal (eni), H vertikal (boʻyi) oʻlcham. Eshik doim boʻyi enidan katta.
Agar usta "Nima chizilgan" deb Eshik yoki Vitraj tanlagan boʻlsa, T/Z yozilmagan boʻlsa ham ochiladigan qism eshik; ochilishi bilinmasa "ichkariga" yoz va savollar ga qoʻsh.
Oʻqib boʻlmagan oʻlchamni taxmin qilma: eng ehtimolini yoz va savollar ga qoʻsh.
TAXMIN QILGAN HAR JOYINGNI SOʻRA (usta savolga javob beradi, savolsiz taxmin qoldirma):
- ichki oʻlchamlar yozilmagan, eskizdan chamalangan boʻlsa — har konstruksiyaga bitta savol: qaysi oʻlchamlar chamalanganini sanab, variantlar "Chamalangani toʻgʻri" (ozgarish []) va "Teng boʻlinsin" (shu boʻlinishlar olchamlari null);
- belgi noaniq boʻlsa (eshikmi yoki rom tabaqasimi, fortochkami, petlya qaysi tomonda) — variantlar bilan;
- seriya yoki rang yozilmagan boʻlsa soʻrama (dastur standartini oladi).

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
- Seriya yoki Система TERMO 70 / BKT 70 boʻlmasa (masalan TRIO, PVX), konstruksiyani baribir oʻqi, savollar ga "N: seriya X, Termo 70 da hisoblandi" deb yoz.
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
  return aiSorov([{ role: "user", content: mazmun }]);
}
// Suhbat davomi: usta javoblari bilan qayta soʻrash (xabarlar — oldingi suhbat)
async function aiSorov(xabarlar) {
  const kalit = await aiKalitniOl();
  if (!kalit) throw new Error("API kaliti yoʻq");
  const sarf = aiSarf();
  if (sarf.dollar >= AI_OYLIK_CHEGARA) throw new Error(`Shu oy chegarasi (${AI_OYLIK_CHEGARA} $) toʻldi`);
  const javob = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": kalit, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 8000, system: AI_TIZIM.replace("OYNA_ROYXATI", oynaTurlari().join(", ") || "—"), output_config: { effort: "medium" }, messages: xabarlar }),
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
  return { natija: JSON.parse(matn.slice(a, b + 1)), dollar, xabarlar: [...xabarlar, { role: "assistant", content: matn }] };
}

// Har konstruksiyani hisob.py bilan tekshiradi; yaroqlisi zakazga qoʻshiladi
function konstrTekshir(k) {
  py.globals.set("_k", JSON.stringify(k));
  py.globals.set("_u", JSON.stringify(zakaz.umumiy));
  try {
    return JSON.parse(py.runPython(`
import zakaz as _zm, raskroy as _rs
try:
    _kk = json.loads(_k)
    hisob.hisobla(_zm._birlashtir(json.loads(_u), {a: b for a, b in _kk.items() if a not in ("nom", "soni")}))
    _t = "null"
    _, _jj = _rs.detallarni_yig({"umumiy": json.loads(_u), "konstruksiyalar": [_kk]})
    for _p, _c in _jj.items():
        if _c and max(_c) > _rs.hivich(_p) * 100:
            _t = json.dumps(f"{_p}: {_rs._k(max(_c))} sm detal hivichdan uzun", ensure_ascii=False)
            break
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
  aiSuhbat = { r, javob: {}, matn: {}, dollar: r.dollar };
  aiSavolKorsat();
});

// ---------- Rasmdan oʻqilgandan keyin savollar (foydalanuvchi, 2026-11-15) ----------
// AI savollari variantli (tugma) yoki matnli; dastur oʻzi soʻraydi: tik impost joyi (tepa / past qator farqi),
// detal hivichdan uzun — qaysi impost joyidan 2 ramaga (Aldoksda chift, boshqasida lapsha). Javob bosilganda qayta quriladi,
// matnli javob boʻlsa "Davom" AI ga qayta yuboradi.
let aiSuhbat = null;
const AI_RAMALAR = ["F702", "F703", "183", "7051"];
const aiSon = (x) => son(Number(x) || 0, 2);
function aiQur() {
  const { r, javob } = aiSuhbat, n = r.natija;
  const konstr = (n.konstruksiyalar || []).map((k) => JSON.parse(JSON.stringify(k)));
  const savollar = [];
  (n.savollar || []).forEach((sv, j) => {
    const id = "ai" + j;
    if (sv && typeof sv === "object" && Array.isArray(sv.variantlar) && sv.variantlar.length) {
      const ki = Number.isInteger(sv.k) ? sv.k : 0;
      savollar.push({ id, matn: String(sv.savol || ""), k: ki, variantlar: sv.variantlar.map((v) => String(v.nom || "")) });
      const v = sv.variantlar[javob[id]], k = konstr[ki];
      if (v && k) (v.ozgarish || []).forEach((o) => yolQoy(k, o.yol, o.qiymat));
    } else savollar.push({ id, matn: typeof sv === "string" ? sv : String((sv && sv.savol) || ""), variantlar: [] });
  });
  // yangi (boʻsh) zakazda hamma konstruksiya seriyasi / rangi bir xil boʻlsa — zakazning umumiy tanloviga
  if (!zakaz.konstruksiyalar.length && konstr.length) {
    const bir = (f) => { const v = konstr.map(f); return v[0] != null && v.every((x) => x === v[0]) ? v[0] : null; };
    const rama = bir((k) => (AI_RAMALAR.includes(k.rama) ? k.rama : null));
    if (rama) {
      zakaz.umumiy.rama = rama;
      if (rama === "183") zakaz.umumiy.oyna_qalinligi = 20; else if (zakaz.umumiy.oyna_qalinligi === 20) zakaz.umumiy.oyna_qalinligi = 24;
      konstr.forEach((k) => delete k.rama);
    }
    const rang = bir((k) => (k.tanlov && k.tanlov.rang ? k.tanlov.rang + "|" + (k.tanlov.rang_nomi || "") : null));
    const rt = rang && RANG_TURKUMLARI.find((x) => x[0] === rang.split("|")[0]);
    if (rt) {
      zakaz.umumiy.tanlov = { ...(zakaz.umumiy.tanlov || {}), rang: rt[0], rang_nomi: (rt[2].find((x) => x[0] === rang.split("|")[1]) || rt[2][0])[0] };
      konstr.forEach((k) => { if (k.tanlov) { delete k.tanlov.rang; delete k.tanlov.rang_nomi; } });
    }
  }
  const natija = konstr.map((k, i) => {
    k.soni = Number.isInteger(k.soni) && k.soni > 0 ? k.soni : 1;
    k.nom = String(k.nom || "K" + (i + 1));
    if (!AI_RAMALAR.includes(k.rama)) delete k.rama;
    if (k.tanlov && typeof k.tanlov === "object") {
      const t = k.tanlov.oyna_turi, pk = k.tanlov.podokonnik;
      const tl = {}, rt = RANG_TURKUMLARI.find((x) => x[0] === k.tanlov.rang);
      if (oynaTurlari().includes(t)) tl.oyna_turi = t;
      if ([15, 20, 25, 30, 35, 40, 45].includes(pk)) tl.podokonnik = pk;
      if (rt) { tl.rang = rt[0]; tl.rang_nomi = (rt[2].find((x) => x[0] === k.tanlov.rang_nomi) || rt[2][0])[0]; }
      if (Object.keys(tl).length) k.tanlov = tl; else delete k.tanlov;
    } else delete k.tanlov;
    // avval tik impost; tepa va past qator farq qilsa — qaysi biri (eskizda oʻlcham taxminiy: eni 2,5 % gacha farq)
    if (typeof tikBirinchi === "function" && k.bolak && Number(k.L) > 0) {
      const iz = [];
      k.bolak = tikBirinchi(k.bolak, Number(k.L), iz, Math.max(5, Number(k.L) * 0.025), javob["tik" + i] === 1);
      if (iz.juft) savollar.push({ id: "tik" + i, k: i, matn: `${k.nom}: tik impost tepa va past qatorda har xil joyda — qaysi biri toʻgʻri?`,
        variantlar: [`Tepadagi: ${iz.juft.map((j) => aiSon(j.tepa)).join(", ")}`, `Pastdagi: ${iz.juft.map((j) => aiSon(j.past)).join(", ")}`], tanlov: javob["tik" + i] || 0 });
    }
    let xato = konstrTekshir(k);
    // detal hivichdan uzun — 2 ramaga boʻlish
    if (xato && /hivichdan uzun/.test(xato) && !k.arka && typeof ramaBol === "function") {
      const ald = (k.rama || zakaz.umumiy.rama) === "183";
      const joy = ildizChegaralar(k.bolak, Number(k.L)), var_ = [];
      joy.forEach((x, ii) => { const b = ramaBol(k.bolak, Number(k.L), ii, ald); if (b && !konstrTekshir({ ...k, bolak: b })) var_.push({ x, b }); });
      if (var_.length) {
        const tl = javob["rama" + i];
        savollar.push({ id: "rama" + i, k: i, matn: `${k.nom}: ${xato}. Rama qaysi impost joyidan 2 ga boʻlinsin (${ald ? "Chift Quloq 109" : "lapsha H702"})?`,
          variantlar: var_.map((v) => `Chapdan ${aiSon(v.x)} sm`), tanlov: tl });
        if (tl != null && var_[tl]) { k.bolak = var_[tl].b; xato = null; }
      }
    }
    // boshqa hisob xatosi — usta matn bilan javob beradi (AI ga qayta yuboriladi)
    if (xato && !savollar.some((q) => q.id === "rama" + i))
      savollar.push({ id: "xato" + i, k: i, matn: `${k.nom} hisobdan oʻtmadi. Qanday tuzataylik? (masalan: "pastdagi boʻlaklar eshik emas, rom tabaqasi")`, variantlar: [] });
    return { k, xato };
  });
  return { natija, savollar };
}
function aiSavolKorsat() {
  const { natija, savollar } = aiQur(), s = aiSuhbat;
  if (!savollar.length) { aiQosh(natija, []); return; }
  $("ai-sarlavha").textContent = "Savollar";
  const rasm = (k) => { try { return chizmaSVG({ ...zakaz.umumiy, ...k, tanlov: { ...(zakaz.umumiy.tanlov || {}), ...(k.tanlov || {}) } }, { kichik: true }); } catch (e) { return ""; } };
  $("ai-matn").innerHTML = natija.map(({ k, xato }, i) => `<div class="ai-k"><b>${esc(k.nom)}</b> · ${aiSon(k.L)} × ${aiSon(k.H)}
      <div class="ai-k-rasm">${rasm(k)}</div>${xato ? `<p class="ogoh">${esc(xato)}</p>` : ""}
      ${savollar.filter((q) => q.k === i).map(savolHtml).join("")}</div>`).join("") +
    savollar.filter((q) => q.k == null || !natija[q.k]).map(savolHtml).join("") +
    `<p class="xira">Javob berilmagan savolda birinchi taxmin qoladi. Matn yozilsa — AI ga qayta yuboriladi.</p>
     <div class="tugmalar"><button class="tugma asosiy" data-ai-davom>Davom</button></div>`;
  function savolHtml(q) {
    const tan = q.tanlov != null ? q.tanlov : s.javob[q.id];
    return `<div class="ai-savol" data-sid="${q.id}"><p>${esc(q.matn)}</p>` +
      (q.variantlar.length ? `<div class="seg holatlar ai-var">${q.variantlar.map((v, j) => `<button data-aiv="${j}" class="${tan === j ? "faol" : ""}">${esc(v)}</button>`).join("")}</div>` : "") +
      `<input type="text" class="ai-javob" placeholder="${q.variantlar.length ? "Boshqa javob…" : "Javob…"}" value="${esc(s.matn[q.id] || "")}"></div>`;
  }
  s.savolMatn = Object.fromEntries(savollar.map((q) => [q.id, q.matn]));
}
$("ai-matn").addEventListener("click", async (e) => {
  if (!aiSuhbat) return;
  const v = e.target.closest("[data-aiv]");
  if (v) {
    const id = v.closest("[data-sid]").dataset.sid, j = +v.dataset.aiv;
    aiSuhbat.javob[id] = aiSuhbat.javob[id] === j && !id.startsWith("tik") ? undefined : j;
    aiSavolKorsat();
    return;
  }
  if (!e.target.closest("[data-ai-davom]")) return;
  const matnli = Object.entries(aiSuhbat.matn).filter(([, t]) => t.trim());
  const q0 = aiQur();
  if (!matnli.length) { aiQosh(q0.natija, q0.savollar); return; }
  // usta yozgan javoblar AI ga qayta yuboriladi, natija yana savollar bilan koʻrsatiladi
  const tanlangan = Object.entries(aiSuhbat.javob).filter(([, j]) => j != null).map(([id]) => {
    const q = q0.savollar.find((x) => x.id === id);
    return q && q.variantlar[aiSuhbat.javob[id]] ? `- ${q.matn} → ${q.variantlar[aiSuhbat.javob[id]]}` : "";
  }).filter(Boolean);
  const matn = ["Ustaning javoblari:", ...tanlangan, ...matnli.map(([id, t]) => `- ${aiSuhbat.savolMatn[id] || id} → ${t.trim()}`),
    "Shu javoblar boʻyicha tuzatilgan toʻliq JSON ni qaytar (hamma konstruksiyalar)."].join("\n");
  $("ai-matn").innerHTML = '<p>Javoblar yuborilmoqda… (10–40 soniya)</p>';
  try {
    const r = await aiSorov([...aiSuhbat.r.xabarlar, { role: "user", content: matn }]);
    aiSuhbat = { r, javob: {}, matn: {}, dollar: aiSuhbat.dollar + r.dollar };
    aiSavolKorsat();
  } catch (x) { $("ai-matn").innerHTML = `<p class="ogoh">${esc(x.message)}</p>`; }
});
$("ai-matn").addEventListener("input", (e) => {
  const i = e.target.closest(".ai-javob");
  if (i && aiSuhbat) aiSuhbat.matn[i.closest("[data-sid]").dataset.sid] = i.value;
});
function aiQosh(natija, savollar) {
  const qoshildi = [], xatolar = [];
  const nomlar = new Set(zakaz.konstruksiyalar.map((k) => k.nom));
  for (const { k, xato } of natija) {
    let nom = k.nom;
    while (nomlar.has(nom)) nom += "+";
    k.nom = nom;
    if (xato) { xatolar.push(`${nom}: ${xato}`); continue; }
    nomlar.add(nom);
    zakaz.konstruksiyalar.push(k);
    qoshildi.push(nom);
  }
  $("ai-izoh").value = "";
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
  ekran("zakaz");
  const javobsiz = savollar.filter((q) => !q.id.startsWith("tik") && !q.id.startsWith("xato") && aiSuhbat.javob[q.id] == null).map((q) => q.matn);
  $("ai-sarlavha").textContent = qoshildi.length ? `${qoshildi.length} ta konstruksiya qoʻshildi` : "Konstruksiya qoʻshilmadi";
  $("ai-matn").innerHTML = (qoshildi.length ? `<p>${qoshildi.map(esc).join(", ")}</p><p class="xira">Har birini ochib tekshiring: oʻlcham va ochilish tomoni.</p>` : "") +
    (xatolar.length ? `<p class="ogoh">Qoʻshilmadi:<br>${xatolar.map(esc).join("<br>")}</p>` : "") +
    (javobsiz.length ? `<p><b>Tekshiring:</b><br>${javobsiz.map(esc).join("<br>")}</p>` : "") +
    `<p class="xira">Sarf: ${aiSuhbat.dollar.toFixed(3)} $</p>`;
  aiSuhbat = null;
}

// Yangi versiya chiqsa: yangi service worker oʻrnashgach sahifa bir marta oʻzi yangilanadi
let versiyaQayta = false;
if ("serviceWorker" in navigator) {
  const birinchi = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!birinchi && !versiyaQayta) { versiyaQayta = true; location.reload(); } });
}
// Eski index.html keshdan qolmasin (foydalanuvchi, 2026-11-15): sahifadagi versiya (meta, ilova_yig.py yozadi)
// py/versiya.txt bilan solishtiriladi — farq boʻlsa SW yangilanadi va sahifa bir marta qayta yuklanadi
// (ochilganda va ilovaga qaytilganda). Bir versiyaga bir marta — tarmoq eski boʻlsa halqa boʻlmaydi.
const SAHIFA_VERSIYA = (document.querySelector('meta[name="ilova-versiya"]') || {}).content || "";
async function versiyaTekshir() {
  if (!SAHIFA_VERSIYA || versiyaQayta) return false;
  try {
    const v = (await (await fetch("py/versiya.txt", { cache: "no-store" })).text()).trim();
    if (!v || v === SAHIFA_VERSIYA) return false;
    try { if (sessionStorage.getItem("versiya_qayta") === v) return false; sessionStorage.setItem("versiya_qayta", v); } catch (e) {}
    const r = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (r) await r.update().catch(() => {});
    if (!versiyaQayta) { versiyaQayta = true; location.reload(); }
    return true;
  } catch (e) { return false; }
}
versiyaTekshir();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") versiyaTekshir(); });
window.addEventListener("DOMContentLoaded", arxivniChiz);
yukla();

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-narx-yangila]");
  if (!b || !zakaz) return;
  zakaz.narx_som = Number(b.dataset.narxYangila);
  hk().narx_chegirma_som = Number(hk().chegirma_som) || 0;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobKitobniChiz();
});
