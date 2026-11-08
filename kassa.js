// Kassa (hisobot tizimining 1-qadami, 2026-11-08). Maʼlumot Dodorom_Baza_2026 (Apps Script, baza_skript.gs) da.
// Har yozuv oʻz valyutasida va oʻsha kun kursi bilan. Yozuv oʻchirilmaydi, "bekor" teskari yozuv qoʻshadi.
// Internet yoʻqda yozuv navbatga tushadi ("kassa_navbat"), keyin yuboriladi; uuid takrorni toʻsadi.
"use strict";

const KASSA_KODLAR = [[1, "Mijozlar uchun"], [2, "Ishxona uchun"], [3, "Shovroom"], [4, "Rahbar"], [5, "Akfa diller uchun"],
  [6, "Oyna uchun"], [7, "Bank uchun"], [8, "Xodim m²"], [9, "Sklad boʻlimi"], [10, "Savdo boʻlimi"], [11, "Mijozlar uchun qarz"],
  [15, "Akfa diller uchun qarz"], [16, "Oyna uchun qarz"], [20, "Servis"], [30, "Marketing"], [40, "Sherik (hayriya fondi)"],
  [44, "Rahbar investitsiya"], [80, "Boʻlim boshligʻi"], [85, "Zapas 1"], [90, "Zapas 2"]];
const KASSA_NOMLAR = { naqd_usd: ["Naqd $", "USD"], naqd_som: ["Naqd soʻm", "UZS"], karta: ["Karta", "UZS"], hisob: ["Hisob raqam", "UZS"] };
let kassaHolat = null; // serverdan: {qoldiq, kurs, ism, rol, ruxsat}
let kassaHarakat = []; // sinx natijasi
let kassaForma = null; // "kirim" | "chiqim" | "ayirboshlash" | null
let kassaBekor = null; // bekor qilinayotgan uuid

// Kirish havolasi: …/#b=<kalit>&u=<deployment id>. Kalit telefonda qoladi, havoladan oʻchiriladi.
function bazaHavola(matn) {
  const m = String(matn).match(/b=([0-9a-f]{20,})&u=([A-Za-z0-9_-]{20,})/);
  if (!m) return false;
  try { localStorage.setItem("baza_kalit", m[1]); localStorage.setItem("baza_url", `https://script.google.com/macros/s/${m[2]}/exec`); } catch (e) {}
  return true;
}
if (bazaHavola(location.hash)) history.replaceState(null, "", location.pathname);
function kXabar(m) { const e = $("kassa-xabar"); if (!e) return; e.textContent = m; e.hidden = !m; clearTimeout(kXabar.t); kXabar.t = setTimeout(() => { e.hidden = true; }, 4000); }
const bazaUlangan = () => !!(ol("baza_kalit") && ol("baza_url"));
const kassaPul = (x, v) => v === "USD" ? usd(x) : som(x);
const bugun = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const yangiUuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

async function baza(amal, d = {}) {
  const javob = await fetch(ol("baza_url"), { method: "POST", headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ k: ol("baza_kalit"), amal, ...d }) });
  const j = await javob.json();
  if (j.xato) throw new Error(j.xato);
  return j;
}
function navbat() { try { return JSON.parse(ol("kassa_navbat") || "[]"); } catch (e) { return []; } }
function navbatYoz(n) { try { localStorage.setItem("kassa_navbat", JSON.stringify(n)); } catch (e) {} }

async function navbatniYubor() {
  const n = navbat();
  if (!n.length) return;
  const j = await baza("qosh", { yozuvlar: n });
  // Qabul qilingan va takrorlar navbatdan chiqadi; xatolilar ham chiqadi, lekin xabar beriladi
  const xatolar = j.natija.filter((r) => r.xato);
  navbatYoz([]);
  if (xatolar.length) kXabar("Yozilmadi: " + xatolar.map((r) => r.xato).join("; "));
}

async function kassaYangila() {
  if (!bazaUlangan()) { kassaniChiz(); return; }
  $("kassa-holat").textContent = "Yangilanmoqda…";
  try {
    await navbatniYubor();
    kassaHolat = await baza("holat");
    if (kassaHolat.ruxsat.includes("kassa_kor")) kassaHarakat = (await baza("sinx")).harakatlar;
    try { localStorage.setItem("kassa_kesh", JSON.stringify({ kassaHolat, kassaHarakat })); } catch (e) {}
    await yukNavbatniYubor();
    if (kassaHolat.ruxsat.includes("hisobot")) await hisobotYangila();
    $("kassa-holat").textContent = "Yangilandi " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    try { ({ kassaHolat, kassaHarakat } = JSON.parse(ol("kassa_kesh") || "{}")); } catch (x) {}
    $("kassa-holat").textContent = navigator.onLine === false ? "Internet yoʻq — oxirgi maʼlumot" : "Xato: " + e.message;
  }
  kassaniChiz();
  hbChiz();
}

function kassaniChiz() {
  const q = $("kassa-ich");
  if (!bazaUlangan()) {
    q.innerHTML = `<section class="karta"><h2>Bazaga ulanmagan</h2><p class="xira">Rahbar bergan kirish havolasini shu yerga qoʻying (yoki ilova oʻrnatilgan brauzerda oching).</p>
      <div class="kassa-qator"><input id="kb-havola" type="text" autocomplete="off" placeholder="https://…#b=…"><button id="kb-ulash" class="tugma asosiy">Ulash</button></div></section>`;
    return;
  }
  if (!kassaHolat) { q.innerHTML = `<p class="xira">Yuklanmoqda…</p>`; return; }
  if (!kassaHolat.ruxsat.includes("kassa_kor")) {
    q.innerHTML = `<section class="karta"><p>${esc(kassaHolat.ism)} (${esc(kassaHolat.rol)}): kassani koʻrishga ruxsat yoʻq.</p></section>`;
    return;
  }
  const n = navbat();
  const qol = { ...kassaHolat.qoldiq };
  for (const y of n) { // yuborilmagan yozuvlar ham qoldiqda koʻrinsin
    if (y.tur === "ayirboshlash") { qol[y.kassa] -= y.summa; qol[y.kassa2] += y.summa2; }
    else qol[y.kassa] += y.tur === "chiqim" ? -y.summa : y.summa;
  }
  const kurs = (kassaHolat.kurs && kassaHolat.kurs.kurs) || Number(ol("kurs")) || 0;
  const jamiSom = Object.entries(qol).reduce((s, [k, x]) => s + (KASSA_NOMLAR[k][1] === "USD" ? x * kurs : x), 0);
  const yoz = kassaHolat.ruxsat.includes("kassa_yoz");
  let s = `<div class="kassa-plitkalar">${Object.entries(KASSA_NOMLAR).map(([k, [nom, v]]) =>
    `<div class="kassa-p${qol[k] < 0 ? " manfiy" : ""}"><span>${nom}</span><b>${kassaPul(qol[k] || 0, v)}</b></div>`).join("")}</div>
    <div class="kassa-jami"><span>Jami (AKFA kursi ${kurs ? som(kurs).replace(" soʻm", "") : "—"})</span><b>${kurs ? som(jamiSom) : "kurs kiriting"}</b></div>
    ${n.length ? `<p class="kassa-navbat">⏳ ${n.length} ta yozuv internet kutmoqda</p>` : ""}`;
  if (yoz) {
    s += `<div class="kassa-amal">${[["kirim", "+ Kirim"], ["chiqim", "− Chiqim"], ["ayirboshlash", "⇄ Almashtirish"], ["yuk", "📦 Yuk"]].map(([t, y]) =>
      `<button data-kforma="${t}" class="tugma${kassaForma === t ? " asosiy" : ""}">${y}</button>`).join("")}</div>`;
    if (kassaForma) s += kassaFormaHtml(kurs) + zakazRoyxatHtml();
    s += `<details class="karta kassa-kurs"><summary>Bugungi AKFA kursi: ${kassaHolat.kurs ? `${som(kassaHolat.kurs.kurs)} (${esc(kassaHolat.kurs.sana)})` : "kiritilmagan"}</summary>
      <div class="kassa-qator"><input id="kk-kurs" type="number" inputmode="decimal" placeholder="masalan 12050"><button id="kk-kurs-saqla" class="tugma asosiy">Saqlash</button></div></details>`;
  }
  s += `<h3 class="kassa-sar">Harakatlar</h3>` + kassaRoyxat(yoz) + yukRoyxat(yoz);
  q.innerHTML = s;
}

function kassaFormaHtml(kurs) {
  const opt = (k) => Object.entries(KASSA_NOMLAR).map(([id, [nom]]) => `<option value="${id}"${id === k ? " selected" : ""}>${nom}</option>`).join("");
  if (kassaForma === "ayirboshlash") {
    return `<section class="karta kassa-forma">
      <label>Qayerdan<select id="kf-kassa">${opt("naqd_usd")}</select></label>
      <label>Summa<input id="kf-summa" type="number" inputmode="decimal"></label>
      <label>Qayerga<select id="kf-kassa2">${opt("naqd_som")}</select></label>
      <label>Kurs<input id="kf-kurs" type="number" inputmode="decimal" value="${kurs || ""}"></label>
      <label>Tushgan summa<input id="kf-summa2" type="number" inputmode="decimal" placeholder="avtomatik"></label>
      <label>Sana<input id="kf-sana" type="date" value="${bugun()}"></label>
      <label class="keng">Izoh<input id="kf-izoh" type="text" autocomplete="off"></label>
      <button id="kf-saqla" class="tugma asosiy keng">Saqlash</button></section>`;
  }
  if (kassaForma === "yuk") {
    const yet = Object.entries(YETKAZUVCHILAR).map(([k, [nom]]) => `<option value="${k}">${nom}</option>`).join("");
    return `<section class="karta kassa-forma">
      <p class="keng xira">Yuk — yetkazib beruvchidan olingan material (nakladnoy). Zakaz materiali boʻladi va qarzni oshiradi. Toʻlov — kassadan chiqim (Akfa kod 5, oyna kod 6). Bozor va boshqa joydan olingani — kod 1 chiqim.</p>
      <label>Kimdan<select id="kf-yet">${yet}</select></label>
      <label>Zakaz ID<input id="kf-zakaz" type="number" inputmode="numeric" list="zakaz-royxat" placeholder="tanlang"></label>
      <label>Summa<input id="kf-summa" type="number" inputmode="decimal"></label>
      <label>Valyuta<select id="kf-val"><option value="USD">$</option><option value="UZS">soʻm</option></select></label>
      <label>Kurs (shu kun)<input id="kf-kurs" type="number" inputmode="decimal" value="${kurs || ""}"></label>
      <label>Sana<input id="kf-sana" type="date" value="${bugun()}"></label>
      <label class="keng">Izoh (nakladnoy №)<input id="kf-izoh" type="text" autocomplete="off"></label>
      <button id="kf-saqla" class="tugma asosiy keng">Saqlash</button></section>`;
  }
  const kodlar = KASSA_KODLAR.map(([k, y]) => `<option value="${k}"${(kassaForma === "kirim" ? 1 : 2) === k ? " selected" : ""}>${k} · ${y}</option>`).join("");
  return `<section class="karta kassa-forma">
    <label>Kassa<select id="kf-kassa">${opt("naqd_som")}</select></label>
    <label>Summa<input id="kf-summa" type="number" inputmode="decimal"></label>
    <label>Kod<select id="kf-kod">${kodlar}</select></label>
    <label>Kurs (shu kun)<input id="kf-kurs" type="number" inputmode="decimal" value="${kurs || ""}"></label>
    <label>Zakaz ID<input id="kf-zakaz" type="number" inputmode="numeric" list="zakaz-royxat" placeholder="tanlang"></label>
    <label>Sana<input id="kf-sana" type="date" value="${bugun()}"></label>
    <label class="keng" id="kf-diller-q" hidden><span id="kf-diller-y">Kimga</span><select id="kf-diller"></select></label>
    <label class="keng">Kimga / kimdan<input id="kf-kimga" type="text" autocomplete="off"></label>
    <label class="keng">Izoh<input id="kf-izoh" type="text" autocomplete="off"></label>
    <button id="kf-saqla" class="tugma asosiy keng">Saqlash</button></section>`;
}

function kassaRoyxat(yoz) {
  const bekorQilingan = new Set(kassaHarakat.filter((h) => h.bekor_qilgan).map((h) => h.bekor_qilgan));
  const qatorlar = kassaHarakat.filter((h) => h.kassa !== "eski" && !String(h.uuid).endsWith("#2") && !String(h.uuid).startsWith("bekor:"))
    .slice().reverse().slice(0, 100);
  if (!qatorlar.length) return `<p class="xira">Hali yozuv yoʻq.</p>`;
  const kodNomi = (k) => (KASSA_KODLAR.find((x) => String(x[0]) === String(k)) || [k, k])[1];
  return qatorlar.map((h) => {
    const juft = h.juft ? kassaHarakat.find((x) => x.uuid === h.juft) : null;
    const v = KASSA_NOMLAR[h.kassa] ? KASSA_NOMLAR[h.kassa][1] : h.valyuta;
    const bekor = bekorQilingan.has(h.uuid);
    const sarlavha = h.tur === "ayirboshlash" && juft
      ? `${KASSA_NOMLAR[h.kassa][0]} → ${KASSA_NOMLAR[juft.kassa][0]}`
      : `${esc(KASSA_NOMLAR[h.kassa] ? KASSA_NOMLAR[h.kassa][0] : h.kassa)} · ${esc(kodNomi(h.kod))}`;
    const summa = h.tur === "ayirboshlash" && juft
      ? `${kassaPul(-h.summa, v)} → ${kassaPul(Number(juft.summa), KASSA_NOMLAR[juft.kassa][1])}`
      : `${h.summa > 0 ? "+" : "−"} ${kassaPul(Math.abs(h.summa), v)}`;
    let amal = "";
    if (yoz && !bekor) {
      amal = kassaBekor === h.uuid
        ? `<div class="kassa-qator"><input id="kb-sabab" type="text" placeholder="Bekor sababi" autocomplete="off"><button data-kbekor-ha="${esc(h.uuid)}" class="kichik-t ha">Bekor qilish</button><button data-kbekor-yoq="1" class="kichik-t">Yoʻq</button></div>`
        : `<button data-kbekor="${esc(h.uuid)}" class="kichik-t orqa">Bekor</button>`;
    }
    return `<div class="kassa-h${bekor ? " bekor" : ""} ${h.tur === "ayirboshlash" ? "ayir" : h.summa > 0 ? "kirim" : "chiqim"}">
      <div class="kassa-h1"><b>${sarlavha}</b><span class="kassa-s">${summa}</span></div>
      <div class="kassa-h2 xira">${esc(h.sana)}${h.zakaz ? ` · ID ${esc(h.zakaz)}` : ""}${h.kimga ? ` · ${esc(h.kimga)}` : ""}${h.izoh ? ` · ${esc(h.izoh)}` : ""} · kurs ${esc(h.kurs)} · ${esc(h.kim)}${bekor ? " · BEKOR QILINGAN" : ""}</div>
      ${amal}</div>`;
  }).join("");
}

async function kassaSaqla() {
  const n = (id) => Number(String(($(id) || {}).value || "").replace(",", "."));
  const t = (id) => (($(id) || {}).value || "").trim();
  if (kassaForma === "yuk") return yukSaqla(n, t);
  const y = { uuid: yangiUuid(), tur: kassaForma, sana: t("kf-sana"), kassa: t("kf-kassa"), summa: n("kf-summa"), kurs: n("kf-kurs"), izoh: t("kf-izoh") };
  if (!(y.summa > 0)) return kXabar("Summani kiriting");
  if (!(y.kurs > 0)) return kXabar("Shu kun kursini kiriting");
  if (kassaForma === "ayirboshlash") {
    y.kassa2 = t("kf-kassa2");
    if (y.kassa2 === y.kassa) return kXabar("Ikki xil kassani tanlang");
    const v1 = KASSA_NOMLAR[y.kassa][1], v2 = KASSA_NOMLAR[y.kassa2][1];
    y.summa2 = n("kf-summa2") || (v1 === v2 ? y.summa : v1 === "USD" ? Math.round(y.summa * y.kurs) : Math.round(y.summa / y.kurs * 100) / 100);
  } else {
    y.kod = Number(t("kf-kod"));
    if (t("kf-zakaz")) y.zakaz = Number(t("kf-zakaz"));
    if (t("kf-kimga")) y.kimga = t("kf-kimga");
    if (KIMGA_TANLOV_F()[y.kod] && y.tur === "chiqim") {
      if (!t("kf-diller")) return kXabar(KIMGA_TANLOV_F()[y.kod][0] + "ni tanlang");
      y.kimga = t("kf-diller");
    }
  }
  navbatYoz([...navbat(), y]);
  kassaForma = null;
  kassaniChiz();
  kXabar("Saqlandi");
  kassaYangila();
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || !b.closest("#e-kassa")) return;
  if (b.dataset.kforma) { kassaForma = kassaForma === b.dataset.kforma ? null : b.dataset.kforma; kassaniChiz(); return; }
  if (b.id === "kf-saqla") { kassaSaqla(); return; }
  if (b.id === "kassa-yangila") { kassaYangila(); return; }
  if (b.id === "kb-ulash") {
    if (!bazaHavola($("kb-havola").value)) return kXabar("Havola notoʻgʻri");
    kassaYangila();
    return;
  }
  if (b.dataset.kbekor) { kassaBekor = b.dataset.kbekor; kassaniChiz(); return; }
  if (b.dataset.kbekorYoq) { kassaBekor = null; kassaniChiz(); return; }
  if (b.dataset.kbekorHa) {
    const sabab = ($("kb-sabab").value || "").trim();
    if (!sabab) return kXabar("Sababini yozing");
    try { await baza("bekor", { uuid: b.dataset.kbekorHa, sabab }); kassaBekor = null; kXabar("Bekor qilindi"); }
    catch (x) { kXabar("Bekor qilinmadi: " + x.message); }
    kassaYangila();
    return;
  }
  if (b.id === "kk-kurs-saqla") {
    const k = Number(String($("kk-kurs").value).replace(",", "."));
    if (!(k > 0)) return kXabar("Kursni kiriting");
    try { await baza("kurs", { sana: bugun(), kurs: k }); kXabar("Kurs saqlandi"); } catch (x) { kXabar("Saqlanmadi: " + x.message); }
    kassaYangila();
  }
});
// Ayirboshlashda tushgan summa avtomatik (qoʻlda oʻzgartirsa boʻladi)
document.addEventListener("input", (e) => {
  if (!["kf-summa", "kf-kurs", "kf-kassa", "kf-kassa2"].includes(e.target.id) || !$("kf-summa2")) return;
  const s = Number($("kf-summa").value), k = Number($("kf-kurs").value);
  const v1 = KASSA_NOMLAR[$("kf-kassa").value][1], v2 = KASSA_NOMLAR[$("kf-kassa2").value][1];
  $("kf-summa2").placeholder = s > 0 && k > 0 ? String(v1 === v2 ? s : v1 === "USD" ? Math.round(s * k) : Math.round(s / k * 100) / 100) : "avtomatik";
});
window.addEventListener("online", () => { if (navbat().length) kassaYangila(); });

// ---------- yuk (2026-11-08): Akfa 1 / Akfa 2 / oyna nakladnoyi, zakaz ID bilan ----------
function yukNavbat() { try { return JSON.parse(ol("yuk_navbat") || "[]"); } catch (e) { return []; } }
async function yukNavbatniYubor() {
  const n = yukNavbat();
  if (!n.length) return;
  const j = await baza("yuk_qosh", { yozuvlar: n });
  try { localStorage.setItem("yuk_navbat", "[]"); } catch (e) {}
  const x = j.natija.filter((r) => r.xato);
  if (x.length) kXabar("Yuk yozilmadi: " + x.map((r) => r.xato).join("; "));
}
function yukSaqla(n, t) {
  const y = { uuid: yangiUuid(), sana: t("kf-sana"), yetkazuvchi: t("kf-yet"), summa: n("kf-summa"), valyuta: t("kf-val"), kurs: n("kf-kurs"), izoh: t("kf-izoh") };
  if (t("kf-zakaz")) y.zakaz = Number(t("kf-zakaz"));
  if (!(y.summa > 0)) return kXabar("Summani kiriting");
  if (!(y.kurs > 0)) return kXabar("Shu kun kursini kiriting");
  try { localStorage.setItem("yuk_navbat", JSON.stringify([...yukNavbat(), y])); } catch (e) {}
  kassaForma = null;
  kXabar(y.zakaz ? "Yuk saqlandi" : "Yuk saqlandi (zakazsiz — umumiy)");
  kassaYangila();
}
let yukBekorId = null;
function yukRoyxat(yoz) {
  const yuk = (hbMalumot && hbMalumot.yuklar) || [];
  const bekor = new Set(yuk.filter((x) => x.bekor_qilgan).map((x) => x.bekor_qilgan));
  const t = yuk.filter((x) => !x.bekor_qilgan).slice().reverse().slice(0, 50);
  const nav = yukNavbat().length;
  if (!t.length && !nav) return "";
  return `<h3 class="kassa-sar">Yuklar</h3>${nav ? `<p class="kassa-navbat">⏳ ${nav} ta yuk internet kutmoqda</p>` : ""}` + t.map((x) => {
    const b = bekor.has(x.uuid);
    const amal = yoz && !b ? (yukBekorId === x.uuid
      ? `<div class="kassa-qator"><input id="kyb-sabab" type="text" placeholder="Bekor sababi" autocomplete="off"><button data-kyb-ha="${esc(x.uuid)}" class="kichik-t ha">Bekor qilish</button><button data-kyb-yoq="1" class="kichik-t">Yoʻq</button></div>`
      : `<button data-kyb="${esc(x.uuid)}" class="kichik-t orqa">Bekor</button>`) : "";
    return `<div class="kassa-h yuk${b ? " bekor" : ""}"><div class="kassa-h1"><b>📦 ${esc(YETKAZUVCHILAR[x.yetkazuvchi] ? YETKAZUVCHILAR[x.yetkazuvchi][0] : x.yetkazuvchi)}${x.zakaz ? " · ID " + esc(x.zakaz) : " · umumiy"}</b><span class="kassa-s">${kassaPul(Number(x.summa), x.valyuta)}</span></div>
      <div class="kassa-h2 xira">${esc(x.sana)} · kurs ${esc(x.kurs)}${x.izoh ? " · " + esc(x.izoh) : ""} · ${esc(x.kim)}${b ? " · BEKOR QILINGAN" : ""}</div>${amal}</div>`;
  }).join("");
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || !b.closest("#e-kassa")) return;
  if (b.dataset.kyb) { yukBekorId = b.dataset.kyb; kassaniChiz(); }
  else if (b.dataset.kybYoq) { yukBekorId = null; kassaniChiz(); }
  else if (b.dataset.kybHa) {
    const sabab = ($("kyb-sabab").value || "").trim();
    if (!sabab) return kXabar("Sababini yozing");
    try { await baza("yuk_bekor", { uuid: b.dataset.kybHa, sabab }); yukBekorId = null; kXabar("Yuk bekor qilindi"); }
    catch (x) { kXabar("Bekor qilinmadi: " + x.message); }
    kassaYangila();
  }
});
// Yuk valyutasi yetkazib beruvchiga qarab (Akfa $, oyna soʻm); kod 5 da diller tanlovi
document.addEventListener("change", (e) => {
  if (e.target.id === "kf-kod") kimgaTanlov();
  if (e.target.id === "kf-yet" && $("kf-val")) $("kf-val").value = YETKAZUVCHILAR[e.target.value][1];
});

// Kod 5 — qaysi Akfa diller, kod 8 — qaysi guruh / montajchi (xodim qarzi shundan ayriladi)
const KIMGA_TANLOV_F = () => ({ 5: ["Diller", ["Akfa 1", "Akfa 2"]], 8: ["Guruh / montajchi", [...GRUXLAR, ...MANTAJCHILAR]] });
function kimgaTanlov() {
  const q = $("kf-diller-q"), kod = $("kf-kod");
  if (!q || !kod) return;
  const x = kassaForma === "chiqim" && KIMGA_TANLOV_F()[kod.value];
  q.hidden = !x;
  if (!x) return;
  $("kf-diller-y").textContent = x[0];
  $("kf-diller").innerHTML = `<option value="">— tanlang —</option>` + x[1].map((v) => `<option>${v}</option>`).join("");
}
