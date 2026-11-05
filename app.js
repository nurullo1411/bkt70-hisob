// BKT 70 hisob: zakaz JSON → tannarx. Hisob mantigʻi Python (Pyodide) da, loyihadagi fayllarning oʻzi.
"use strict";

// narxlar.json ilovada yoʻq (ochiq repo): foydalanuvchi bir marta yuklaydi, telefonda saqlanadi.
const PY_FAYLLAR = ["hisob.py", "hisobot.py", "zakaz.py", "raskroy.py", "tannarx.py"];
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
    if (!narxlarniQoy(await shifrliNarx() || ol("narxlar"))) return;
    const oxirgi = ol("oxirgi_zakaz");
    if (oxirgi) zakazniOch(oxirgi, true);
    if (zakaz) qoralamaniTikla();
  } catch (e) {
    holat("Xato");
    xato("Dastur yuklanmadi: " + e.message + ". Birinchi marta ochishda internet kerak.");
  }
}

// Shifrlangan narxlar (narxlar.enc) saytda turadi. Kalit faqat havoladagi #k= da keladi,
// serverga yuborilmaydi va telefonda saqlanadi. Har ochilishda yangi narx olinadi; internet boʻlmasa null.
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
}

// ---------- zakazlar arxivi (Romchi "Buyurtmalar"): telefonda saqlanadi ----------
const HOLATLAR = [["yangi", "Yangi"], ["jarayonda", "Ish jarayonida"], ["qarzdor", "Qarzdor"], ["tugatilgan", "Tugatilgan"]];
function arxivOl() { try { return JSON.parse(ol("zakazlar") || "[]"); } catch (e) { return []; } }
function arxivYoz(a) { try { localStorage.setItem("zakazlar", JSON.stringify(a)); } catch (e) {} }
function belgila(z) {
  if (z.id) return;
  const raqam = Number(ol("zakaz_raqam") || 0) + 1;
  try { localStorage.setItem("zakaz_raqam", String(raqam)); } catch (e) {}
  z.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  z.raqam = raqam;
  z.sana = new Date().toISOString().slice(0, 10);
  z.holat = "yangi";
}
function arxivga(matn) {
  let z;
  try { z = JSON.parse(matn); } catch (e) { return; }
  if (!z || !z.id) return;
  const a = arxivOl().filter((x) => x.id !== z.id);
  if (z.konstruksiyalar && z.konstruksiyalar.length) a.unshift(z);
  arxivYoz(a);
  arxivniChiz();
}
let arxivTab = "yangi";
function arxivniChiz() {
  const a = arxivOl();
  const narxi = (z) => Number(z.narx_som) || 0;
  $("arxiv-quti").hidden = !a.length;
  $("arxiv-tablar").innerHTML = HOLATLAR.map(([k, y]) => {
    const t = a.filter((z) => (z.holat || "yangi") === k);
    return `<button data-tab="${k}" class="${arxivTab === k ? "faol" : ""}"><b>${y}</b><span>${t.length} ta${t.length ? " · " + som(t.reduce((s, z) => s + narxi(z), 0)) : ""}</span></button>`;
  }).join("");
  const t = a.filter((z) => (z.holat || "yangi") === arxivTab);
  $("arxiv").innerHTML = t.map((z) => `<div class="arxiv-k${zakaz && zakaz.id === z.id ? " joriy" : ""}">
      <div class="arxiv-eskiz">${z.konstruksiyalar[0] ? chizmaSVG(z.konstruksiyalar[0], { kichik: true }) : ""}</div>
      <div class="arxiv-matn"><span class="xira">№${esc(z.raqam ?? "")} · ${esc(z.sana || "")}</span>
        <b>${esc((z.mijoz && z.mijoz.ism) || z.nom || "Mijoz")}</b>
        <span>${narxi(z) ? som(narxi(z)) : "—"}</span></div>
      <div class="arxiv-tugma"><button data-och="${z.id}" class="tugma asosiy">Ochish</button><button data-dub="${z.id}" class="tugma">Dublikat</button><button data-arx-ochir="${z.id}" class="tugma">Oʻchirish</button></div>
    </div>`).join("") || '<p class="xira">Bu boʻlimda zakaz yoʻq.</p>';
}

// Python hisobi: {ok: natija} yoki {xato: matn}
function pyTannarx(z) {
  py.globals.set("_zakaz", JSON.stringify(z));
  py.globals.set("_kurs", Number($("kurs").value) || 12000);
  try {
    return JSON.parse(py.runPython(`
try:
    _natija = json.dumps({"ok": tannarx.tannarx(json.loads(_zakaz), kurs=_kurs)}, ensure_ascii=False)
except (hisob.HisobXato, KeyError, ValueError, TypeError) as _e:
    _natija = json.dumps({"xato": str(_e)}, ensure_ascii=False)
_natija`));
  } catch (e) {
    return { xato: "Kutilmagan xato: " + e.message.split("\n").slice(-2).join(" ") };
  }
}

function hisobla() {
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
    const teglar = [k.rama || u.rama, t.rang_nomi || t.rang, (t.oyna_turi || "") + " " + (k.oyna_qalinligi || u.oyna_qalinligi || 24) + " mm"];
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

function hisobKitobniChiz() {
  const n = natija, h = hk(), kurs = n.kurs, v = valyuta();
  const otxod = n.materiallar.filter((m) => m.bolim === "Profil otxod").reduce((a, m) => a + (m.summa || 0), 0);
  document.querySelectorAll("[data-valyuta]").forEach((b) => b.classList.toggle("faol", b.dataset.valyuta === v));
  $("j-mat").textContent = pul(n.materiallar_usd - otxod);
  $("j-otx").textContent = pul(otxod);
  $("j-str").textContent = pul(n.straxovka_usd);
  $("j-tan").textContent = pul(n.jami_usd);
  $("j-tan2").textContent = v === "usd" ? som(n.jami_som) : usd(n.jami_usd);
  const ustama = n.jami_usd * (Number(h.ustama_foiz) || 0) / 100;
  const mijozga = n.jami_usd + ustama;
  const chegirma = (Number(h.chegirma_som) || 0) / kurs, avans = (Number(h.avans_som) || 0) / kurs;
  $("j-ust").textContent = ustama ? "+ " + pul(ustama) : "";
  $("j-mijoz").textContent = pul(mijozga);
  $("j-tolov").textContent = pul(mijozga - chegirma);
  $("j-qoldiq").textContent = pul(mijozga - chegirma - avans);
  const narxSom = Math.round((mijozga - chegirma) * kurs);
  if (zakaz.narx_som !== narxSom) { zakaz.narx_som = narxSom; saqla("oxirgi_zakaz", JSON.stringify(zakaz)); }
  $("holatlar").innerHTML = HOLATLAR.map(([k, y]) => `<button data-holat="${k}" class="${(zakaz.holat || "yangi") === k ? "faol" : ""}">${y}</button>`).join("");
  if (document.activeElement !== $("hk-ustama")) $("hk-ustama").value = h.ustama_foiz ?? "";
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
function kesishHtml(r) {
  const leg = r.konstruksiyalar.map((k, i) => `<span class="kl"><i style="background:${KRANG[i % KRANG.length]}"></i>${i + 1}. ${esc(k.nom)} × ${k.soni}</span>`).join("");
  return `<div class="k-leg">${leg}</div>` + r.profillar.map((p) => `<div class="kp">
    <div class="kp-bosh"><b>${esc(p.nom)}</b><span>${p.hivich_sm} sm × ${p.hivichlar.length} dona</span></div>
    <div class="kp-stat"><span>Samaradorlik <b>${son(p.samaradorlik, 1)}%</b></span><span>Kesimlar <b>${p.kesimlar}</b></span><span>Qoldiq <b>${son(p.qoldiq_sm, 1)} sm</b></span></div>
    <div class="xira kp-kesim">${esc(p.kesim)}${p.otxod_chegara ? ` · ${p.otxod_chegara} sm dan kichik qoldiq otxod` : ""}</div>
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
    html += `<tr><td>${esc(nom)}</td><td class="son">${son(m.jami)} ${esc(m.birlik)}</td><td class="son">${usd(m.summa)}</td></tr>`;
  }
  $("materiallar").innerHTML = html + (bolim ? "</table>" : "");

  $("oyna-m2").textContent = "· " + son(n.oyna_m2) + " m²";
  const nomlar = n.konstruksiyalar;
  $("oynalar").innerHTML = "<table><tr><th>Joyi</th><th class='son'>Eni × boʻyi, sm</th><th class='son'>Soni</th></tr>" +
    n.oynalar.map((o) => `<tr><td>${esc(o.nom)}<br><span class="xira">${esc(o.joy)}${o.tur ? " · " + esc(o.tur) : ""}</span></td><td class="son">${son(o.en, 2)} × ${son(o.boy, 2)}</td><td class="son">${o.soni * nomlar[o.i].soni}</td></tr>`).join("") + "</table>";

  $("otxod").innerHTML = "<table><tr><th>Profil</th><th class='son'>Hivich</th><th class='son'>Ishlatilgan</th><th class='son'>Otxod</th></tr>" +
    n.otxod.map((o) => `<tr><td>${esc(o.profil)}</td><td class="son">${o.hivich}</td><td class="son">${son(o.ishlatilgan_m, 2)} m</td><td class="son">${son(o.jami_m - o.ishlatilgan_m, 2)} m</td></tr>`).join("") +
    "</table><p class='xira'>Yangi 650 sm hivichdan, skladsiz. Chegaradan kichik qoldiq otxod.</p>";
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
for (const id of ["narx-fayl", "narx-fayl2"]) {
  $(id).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f || !py) return;
    xato("");
    if (narxlarniQoy(await f.text())) { holat("Narxlar yangilandi"); hisobla(); }
  });
}
$("matn-tugma").addEventListener("click", () => { $("matn-quti").hidden = !$("matn-quti").hidden; });
$("matn-hisobla").addEventListener("click", () => zakazniOch($("matn").value));
$("namuna").addEventListener("click", async () => zakazniOch(await (await fetch("namuna_z002.json")).text()));
$("kurs").addEventListener("change", () => { saqla("kurs", $("kurs").value); hisobla(); });
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
for (const [id, kalit] of [["hk-ustama", "ustama_foiz"], ["hk-chegirma", "chegirma_som"], ["hk-avans", "avans_som"]]) {
  $(id).addEventListener("input", () => {
    if (!natija) return;
    const x = Number($(id).value);
    const h = hk();
    if (!$(id).value || !(x > 0)) delete h[kalit];
    else h[kalit] = kalit === "ustama_foiz" || valyuta() === "som" ? x : Math.round(x * natija.kurs);
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
$("yangi").addEventListener("click", () => {
  const b = $("yangi");
  if (zakaz && zakaz.konstruksiyalar && zakaz.konstruksiyalar.length && !b.classList.contains("tasdiq")) {
    b.classList.add("tasdiq"); b.textContent = "Joriy zakaz oʻchadi. Davom?";
    setTimeout(() => { b.classList.remove("tasdiq"); b.textContent = "Yangi zakaz"; }, 4000);
    return;
  }
  b.classList.remove("tasdiq"); b.textContent = "Yangi zakaz";
  if (!ol("narxlar")) { xato("Avval narxlar faylini yuklang."); return; }
  zakaz = yangiZakaz();
  belgila(zakaz);
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
  konstruktorniOch(-1);
});
$("ulash").addEventListener("click", async () => {
  const matn = matnNatija();
  if (navigator.share) { try { await navigator.share({ text: matn }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(matn); holat("Nusxa olindi"); } catch (e) { faylBer("tannarx.txt", matn); }
});
$("saqlash").addEventListener("click", () => faylBer((zakaz.nom || "zakaz") + ".json", JSON.stringify(zakaz, null, 1)));

$("holatlar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-holat]");
  if (!b) return;
  zakaz.holat = b.dataset.holat;
  arxivTab = zakaz.holat;
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobKitobniChiz();
});
$("arxiv-tablar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) { arxivTab = b.dataset.tab; arxivniChiz(); }
});
$("arxiv").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const a = arxivOl(), d = b.dataset;
  if (d.och) {
    const z = a.find((x) => x.id === d.och);
    if (z) { zakazniOch(JSON.stringify(z)); window.scrollTo({ top: $("zakaz-ish").offsetTop - 10, behavior: "smooth" }); }
  } else if (d.dub) {
    const z = JSON.parse(JSON.stringify(a.find((x) => x.id === d.dub)));
    for (const k of ["id", "raqam", "sana", "holat", "hisob_kitob", "narx_som"]) delete z[k];
    zakazniOch(JSON.stringify(z));
    arxivTab = "yangi"; arxivniChiz();
  } else if (d.arxOchir) {
    if (!b.classList.contains("tasdiq")) { b.classList.add("tasdiq"); b.textContent = "Rostdanmi?"; return; }
    arxivYoz(a.filter((x) => x.id !== d.arxOchir));
    if (zakaz && zakaz.id === d.arxOchir) { zakaz = null; natija = null; try { localStorage.removeItem("oxirgi_zakaz"); } catch (e2) {} $("zakaz-ish").hidden = true; $("natija").hidden = true; }
    arxivniChiz();
  }
});

// ---------- mijozga PDF (brauzerning "PDF sifatida saqlash" orqali) ----------
$("pdf").addEventListener("click", () => {
  $("pdf-baj").value = ol("bajaruvchi") || "";
  $("pdf-baj-tel").value = ol("bajaruvchi_tel") || "";
  $("pdf-oyna").hidden = false;
});
$("pdf-yop").addEventListener("click", () => { $("pdf-oyna").hidden = true; });
$("pdf-ber").addEventListener("click", () => {
  saqla("bajaruvchi", $("pdf-baj").value.trim());
  saqla("bajaruvchi_tel", $("pdf-baj-tel").value.trim());
  $("pdf-oyna").hidden = true;
  $("chop").innerHTML = pdfHtml({ narx: $("pdf-narx").checked, olcham: $("pdf-olcham").checked, mat: $("pdf-mat").checked });
  const eski = document.title;
  document.title = `${zakaz.raqam ? "№" + zakaz.raqam + " " : ""}${(zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "zakaz"}`;
  setTimeout(() => { window.print(); document.title = eski; }, 100);
});

function pdfHtml(o) {
  const n = natija, kurs = n.kurs, m = zakaz.mijoz || {}, h = hk();
  const k1 = 1 + (Number(h.ustama_foiz) || 0) / 100;
  const chegirma = Number(h.chegirma_som) || 0, avans = Number(h.avans_som) || 0;
  const boshlang = Math.round(n.jami_usd * k1 * kurs);
  const hisob = Object.fromEntries(n.konstruksiyalar.map((k) => [k.nom, k]));
  const u = zakaz.umumiy;
  const faol = zakaz.konstruksiyalar.filter((k) => (k.soni ?? 1) > 0);
  const jamiSoni = faol.reduce((a, k) => a + (k.soni ?? 1), 0);
  const jamiM2 = faol.reduce((a, k) => a + yuza(k) * (k.soni ?? 1), 0);
  const q = (y, v) => (v ? `<tr><td>${esc(y)}</td><td><b>${esc(v)}</b></td></tr>` : "");
  let s = `<div class="p-bosh"><div><div class="p-sarlavha">BUYURTMA MAʼLUMOTI</div>
      <div>Buyurtma raqami: <b>№${esc(zakaz.raqam ?? "")}</b> · Sana: <b>${esc(zakaz.sana || new Date().toISOString().slice(0, 10))}</b></div></div></div>
    <div class="p-ikki"><table class="p-jad">
      ${q("Buyurtmachi", m.ism)}${q("Telefon", m.telefon)}${q("Manzil", m.manzil)}${q("Muddat", m.muddat)}
      ${q("Bajaruvchi", ol("bajaruvchi"))}${q("Telefon", ol("bajaruvchi_tel"))}
      <tr><td>Umumiy soni</td><td><b>${jamiSoni} dona</b></td></tr><tr><td>Umumiy yuzasi</td><td><b>${son(jamiM2, 2)} m²</b></td></tr></table>
    ${o.narx ? `<table class="p-jad p-narx"><tr><td>Boshlangʻich narx</td><td><b>${som(boshlang)}</b></td></tr>
      <tr><td>Chegirma</td><td><b>${som(chegirma)}</b></td></tr>
      <tr class="yashil"><td>Kelishilgan narx</td><td><b>${som(boshlang - chegirma)}</b></td></tr>
      ${avans ? `<tr><td>Avans</td><td><b>${som(avans)}</b></td></tr><tr><td>Qoldiq</td><td><b>${som(boshlang - chegirma - avans)}</b></td></tr>` : ""}</table>` : ""}</div>`;
  faol.forEach((k, i) => {
    const t = { ...(u.tanlov || {}), ...(k.tanlov || {}) };
    const hk_ = hisob[k.nom || "K" + (zakaz.konstruksiyalar.indexOf(k) + 1)];
    s += `<div class="p-k"><div class="p-rasm"><b>${i + 1}.</b>${chizmaSVG(k, { kichik: !o.olcham })}</div>
      <table class="p-jad">${q("Nomi", k.nom)}${q("Seriya", "TERMO 70 (BKT 70)")}${q("Rama", k.rama || u.rama)}
        ${q("Rang", t.rang_nomi ? `${t.rang} (${t.rang_nomi})` : t.rang)}
        ${q("Oyna", `${t.oyna_turi || ""} ${k.oyna_qalinligi || u.oyna_qalinligi || 24} mm`)}
        ${q("Oʻlchami", `${k.L} × ${k.H} sm`)}${q("Yuzasi", son(yuza(k), 2) + " m²")}${q("Soni", (k.soni ?? 1) + " dona")}
        ${q("Izoh", k.eslatma)}
        ${o.narx && hk_ ? `<tr class="yashil"><td>Narxi</td><td><b>${som(hk_.jami_usd * k1 * kurs)}</b></td></tr>` : ""}</table></div>`;
  });
  if (o.mat) {
    s += `<div class="p-k p-mat"><b>Kerakli materiallar</b><table class="p-jad">` +
      n.materiallar.filter((x) => x.bolim !== "Profil otxod").map((x) => `<tr><td>${esc(x.artikul)}${x.bolim === "Oyna" ? ` (${esc(x.izoh)} mm)` : ""}</td><td>${son(x.jami)} ${esc(x.birlik)}</td></tr>`).join("") + "</table></div>";
  }
  s += `<div class="p-oxir">Umumiy yuzasi: <b>${son(jamiM2, 2)} m²</b>${m.izoh ? `<br>Izoh: ${esc(m.izoh)}` : ""}</div>`;
  return s;
}

$("kesish-quti").addEventListener("toggle", () => { if ($("kesish-quti").open) kesishniChiz(); });
$("kesish-pdf").addEventListener("click", () => {
  kesishniChiz();
  if (!kesishNatija) return;
  $("chop").innerHTML = `<div class="p-sarlavha">Kesish chizmasi — ${esc(zakaz.raqam ? "№" + zakaz.raqam + " " : "")}${esc((zakaz.mijoz && zakaz.mijoz.ism) || zakaz.nom || "")}</div>
    <div>Hivich 650 sm, skladsiz. Sana: ${new Date().toISOString().slice(0, 10)}</div>` + kesishHtml(kesishNatija);
  const eski = document.title;
  document.title = "Kesish " + (zakaz.raqam ? "№" + zakaz.raqam : zakaz.nom || "");
  setTimeout(() => { window.print(); document.title = eski; }, 100);
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
window.addEventListener("DOMContentLoaded", arxivniChiz);
yukla();
