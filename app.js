// BKT 70 hisob: zakaz JSON → tannarx. Hisob mantigʻi Python (Pyodide) da, loyihadagi fayllarning oʻzi.
"use strict";

// narxlar.json ilovada yoʻq (ochiq repo): foydalanuvchi bir marta yuklaydi, telefonda saqlanadi.
const PY_FAYLLAR = ["hisob.py", "hisobot.py", "zakaz.py", "raskroy.py", "tannarx.py"];
const $ = (id) => document.getElementById(id);
let py = null;
let zakaz = null;
let natija = null;

function saqla(kalit, qiymat) { try { localStorage.setItem(kalit, qiymat); } catch (e) {} }
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
  saqla("oxirgi_zakaz", JSON.stringify(zakaz));
  hisobla();
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
}

function royxatniChiz() {
  const n = natija;
  $("zakaz-nomi").textContent = (zakaz.nom ? zakaz.nom + " · " : "") + zakaz.konstruksiyalar.length + " ta konstruksiya";
  // Konstruksiyalar: soni 0 boʻlganlari ham koʻrinadi, qaytarish uchun
  const hisoblangan = Object.fromEntries((n ? n.konstruksiyalar : []).map((k) => [k.nom, k]));
  $("konstruksiyalar").innerHTML = zakaz.konstruksiyalar.map((k, i) => {
    const nom = k.nom || "K" + (i + 1);
    const h = hisoblangan[nom];
    const soni = k.soni ?? 1;
    return `<div class="konstr${soni === 0 ? " nol" : ""}">
      <div class="konstr-ichi">
        <button class="eskiz" data-tahrir="${i}" aria-label="Tahrirlash">${chizmaSVG(k, { kichik: true })}</button>
        <div class="konstr-matn">
          <div class="konstr-bosh"><b>${esc(nom)}</b><span>${esc(k.L)} × ${esc(k.H)}</span></div>
          <div class="konstr-past">
            <div class="soni"><button data-i="${i}" data-d="-1" aria-label="Kamaytirish">−</button><span>${soni}</span><button data-i="${i}" data-d="1" aria-label="Koʻpaytirish">+</button></div>
            <div style="text-align:right">${h ? `<div class="xira">1 dona ${usd(h.bir_dona_usd)}</div><b>${usd(h.jami_usd)}</b>` : `<span class="xira">${soni === 0 ? "hisobga kirmaydi" : "—"}</span>`}</div>
          </div>
        </div>
      </div>
      ${h && h.izoh ? `<div class="ogoh xira">${esc(h.izoh)}</div>` : ""}
      <div class="kichik-tugmalar"><button data-tahrir="${i}">Tahrirlash</button><button data-nusxa="${i}">Nusxa</button><button data-ochir="${i}">Oʻchirish</button></div>
    </div>`;
  }).join("") || '<p class="xira">Konstruksiya yoʻq. Pastdagi tugma bilan qoʻshing.</p>';
}

function chiz() {
  const n = natija;
  $("j-mat").textContent = usd(n.materiallar_usd);
  $("j-str").textContent = usd(n.straxovka_usd);
  $("j-usd").textContent = usd(n.jami_usd);
  $("j-som").textContent = som(n.jami_som);
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
    n.oynalar.map((o) => `<tr><td>${esc(o.nom)}<br><span class="xira">${esc(o.joy)}</span></td><td class="son">${son(o.en, 2)} × ${son(o.boy, 2)}</td><td class="son">${o.soni * nomlar[o.i].soni}</td></tr>`).join("") + "</table>";

  $("otxod").innerHTML = "<table><tr><th>Profil</th><th class='son'>Hivich</th><th class='son'>Ishlatilgan</th><th class='son'>Otxod</th></tr>" +
    n.otxod.map((o) => `<tr><td>${esc(o.profil)}</td><td class="son">${o.hivich}</td><td class="son">${son(o.ishlatilgan_m, 2)} m</td><td class="son">${son(o.jami_m - o.ishlatilgan_m, 2)} m</td></tr>`).join("") +
    "</table><p class='xira'>Yangi 650 sm hivichdan, skladsiz. Chegaradan kichik qoldiq otxod.</p>";
}

function matnNatija() {
  const n = natija;
  const q = [`BKT 70 tannarx${zakaz.nom ? " — " + zakaz.nom : ""}`, ""];
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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
yukla();
