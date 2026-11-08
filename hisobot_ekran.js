// Hisobot ekrani (2026-11-08): Umumiy · Kassa · Qarzdorlar · Rasxod · Oylik · Ishlar. Hisob — hisobot.js.
// Maʼlumot bazadan (amal "hisobot"), oxirgisi telefonda ("hisobot_kesh") — internet yoʻqda shu koʻrinadi.
"use strict";

const HB_TABLAR = [["umumiy", "Umumiy"], ["kassa", "Kassa"], ["qarz", "Qarzdorlar"], ["rasxod", "Rasxod"], ["oylik", "Oylik"], ["ishlar", "Ishlar"]];
const GRUXLAR = ["Grux 1", "Grux 2", "Grux 3", "Grux 4", "Grux 5", "Grux 6"];
const MANTAJCHILAR = ["Mantaj 1", "Mantaj 2", "Mantaj 3", "Mantaj 4"];
let hbTab = (() => { try { return localStorage.getItem("hb_tab") || "umumiy"; } catch (e) { return "umumiy"; } })();
let hbMalumot = (() => { try { return JSON.parse(localStorage.getItem("hisobot_kesh") || "null"); } catch (e) { return null; } })();
let hbDavr = new Date().toISOString().slice(0, 4); // yil yoki "YYYY-MM"
let hbQarzFiltr = "hammasi", hbOchiq = null, hbRasxodKod = null;

const hbFoiz = (x) => (x * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "%";
const hbPul = (x, v) => (v === "USD" ? usd(x) : som(x));
const hbOyNomi = (oy) => ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"][Number(oy.slice(5, 7)) - 1] || oy;

async function hisobotYangila() {
  if (!bazaUlangan()) return;
  try {
    hbMalumot = await baza("hisobot");
    try { localStorage.setItem("hisobot_kesh", JSON.stringify(hbMalumot)); } catch (e) {}
  } catch (e) {
    if (!/ruxsat/.test(e.message)) kXabar("Hisobot yangilanmadi: " + (navigator.onLine === false ? "internet yoʻq" : e.message));
  }
  hbChiz();
}

function hbChiz() {
  $("hb-tablar").innerHTML = HB_TABLAR.map(([k, y]) => `<button data-hbtab="${k}" class="${hbTab === k ? "faol" : ""}">${y}</button>`).join("");
  const kassada = hbTab === "kassa";
  $("kassa-ich").hidden = !kassada;
  $("hb-ich").hidden = kassada;
  if (kassada) return;
  if (!hbMalumot) { $("hb-ich").innerHTML = `<p class="xira">${bazaUlangan() ? "Yuklanmoqda…" : "Bazaga ulanmagan."}</p>`; return; }
  const f = { umumiy: hbUmumiy, qarz: hbQarzdorlar, rasxod: hbRasxod, oylik: hbOylik, ishlar: hbIshlar }[hbTab];
  $("hb-ich").innerHTML = f();
}

function hbDavrTanlov() {
  const yil = hbDavr.slice(0, 4);
  const oylar = Array.from({ length: 12 }, (_, i) => `${yil}-${String(i + 1).padStart(2, "0")}`);
  return `<label class="hb-davr">Davr <select id="hb-davr"><option value="${yil}"${hbDavr === yil ? " selected" : ""}>${yil} yil (hammasi)</option>
    ${oylar.map((o) => `<option value="${o}"${hbDavr === o ? " selected" : ""}>${hbOyNomi(o)} ${yil}</option>`).join("")}</select></label>`;
}
const hbKarta = (y, q, izoh = "", kl = "") => `<div class="hb-k ${kl}"><span>${y}</span><b>${q}</b>${izoh ? `<small>${izoh}</small>` : ""}</div>`;

function hbUmumiy() {
  const h = hisobotTuz(hbMalumot, { davr: hbDavr });
  const b = h.bitgan, s = h.savdo, q = h.qarzlar;
  const kassaJami = Object.entries(h.kassa.qoldiq).reduce((a, [k, x]) => a + (k === "naqd_usd" ? x * h.kurs : x), 0);
  const m2q = M2_TURLARI.map(([k, y]) => `<tr><td>${y}</td><td class="son">${son(s.m2[k], 2)}</td><td class="son">${son(b.m2[k], 2)}</td></tr>`).join("");
  const rasxod = Object.entries(h.kassa.rasxod).filter(([, x]) => Math.abs(x) > 0.5).sort((a, c) => c[1] - a[1]);
  return hbDavrTanlov() + `<div class="hb-grid">
      ${hbKarta("Mijozlar (shartnoma)", `${s.mijozlar} <small>/ ${s.soni} ta</small>`)}
      ${hbKarta("Savdo", som(s.summa_som), [s.som ? som(s.som) : "", s.usd ? usd(s.usd) : ""].filter(Boolean).join(" + "))}
      ${hbKarta("Oʻrtacha chek", som(s.ortacha_som))}
      ${hbKarta("Kassa (hozir)", som(kassaJami), `AKFA kursi ${h.kurs || "—"}`)}
      ${hbKarta("Koʻchadagi nasiya", som(h.nasiya.som), `${h.nasiya.soni} ta · bitganlarda ${som(h.nasiya.bitgan_som)}`, "ogoh")}
      ${["akfa1", "akfa2"].map((k) => hbKarta(q[k].nom + " qarz", usd(q[k].qarz), `olindi ${usd(q[k].olindi)} · toʻlandi ${usd(q[k].tolandi)}`, q[k].qarz > 0 ? "ogoh" : "")).join("")}
      ${hbKarta("Oynaga qarz", som(q.oyna.qarz), "", q.oyna.qarz > 0 ? "ogoh" : "")}
    </div>
    <h3 class="hb-sar">Bitgan ishlar <small>(tugagan oyi boʻyicha · ${b.soni} ta)</small></h3>
    <table class="hb-jad">
      <tr><td>Bitgan ishlar summasi</td><td class="son">${som(b.summa_som)}</td><td class="son">100%</td></tr>
      <tr><td>Material (yuk + kod 1 rasxod)</td><td class="son">${som(b.material_som)}</td><td class="son">${b.summa_som ? hbFoiz(b.material_som / b.summa_som) : ""}</td></tr>
      <tr class="qalin"><td>Foyda · marja</td><td class="son">${som(b.foyda_som)}</td><td class="son">${hbFoiz(b.marja)}</td></tr>
      <tr><td>Natsenka</td><td></td><td class="son">${hbFoiz(b.natsenka)}</td></tr>
      <tr><td>Xodim m² (kod 8, toʻlangan)</td><td class="son">− ${som(b.xodim_som)}</td><td></td></tr>
      <tr><td>Korxona rasxodlari</td><td class="son">− ${som(b.korxona_som)}</td><td></td></tr>
      <tr class="qalin ${b.sof_som < 0 ? "manfiy" : ""}"><td>Sof foyda</td><td class="son">${som(b.sof_som)}</td><td class="son">${b.summa_som ? hbFoiz(b.sof_som / b.summa_som) : ""}</td></tr>
      <tr><td>1 m² ga sof foyda</td><td class="son">${som(b.bir_m2_sof)}</td><td></td></tr>
      <tr><td>Hayriya fondi 10% · berildi</td><td class="son">${som(b.hayriya_som)}</td><td class="son">${som(b.hayriya_berildi)}</td></tr>
    </table>
    <h3 class="hb-sar">m²</h3>
    <table class="hb-jad"><tr class="xira"><td></td><td class="son">Shartnoma</td><td class="son">Bitgan</td></tr>${m2q}</table>
    <h3 class="hb-sar">Rasxod kodlar boʻyicha <small>(kassa, ${som(h.kassa.rasxod_jami)})</small></h3>
    <table class="hb-jad">${rasxod.map(([k, x]) => `<tr><td>${esc(HB_KODLAR[k] || k)} (${esc(k)})</td><td class="son">${som(x)}</td><td class="son">${h.kassa.rasxod_jami ? hbFoiz(x / h.kassa.rasxod_jami) : ""}</td></tr>`).join("") || `<tr><td class="xira">Rasxod yoʻq</td></tr>`}</table>
    <p class="xira hb-izoh">Toʻlangan: kassa kod 1 kirim (zakaz ID bilan). Material: yuklar va kod 1 chiqim shu zakaz ID bilan. Akfa (5) va oyna (6) toʻlovi faqat qarzni kamaytiradi.</p>`;
}

function hbQarzdorlar() {
  const h = hisobotTuz(hbMalumot, {});
  let t = h.zakazlar.filter((z) => Math.abs(z.qarz) > 0.009);
  if (hbQarzFiltr === "btb") t = t.filter((z) => z.btb);
  if (hbQarzFiltr === "oddiy") t = t.filter((z) => !z.btb);
  const usdJ = t.filter((z) => z.valyuta === "USD").reduce((a, z) => a + z.qarz, 0);
  const somJ = t.filter((z) => z.valyuta !== "USD").reduce((a, z) => a + z.qarz, 0);
  const filtr = [["hammasi", "Hammasi"], ["oddiy", "Oddiy mijoz"], ["btb", "BTB"]].map(([k, y]) =>
    `<button data-qfiltr="${k}" class="${hbQarzFiltr === k ? "faol" : ""}">${y}</button>`).join("");
  const qator = (z) => {
    const och = hbOchiq === z.id;
    const tarix = och ? `<div class="hb-tarix"><b>Toʻlovlar</b>${z.tolovlar.map((x) => `<div><span>${esc(x.sana)} · ${esc(KASSA_NOMLAR[x.kassa] ? KASSA_NOMLAR[x.kassa][0] : x.kassa)} · kurs ${esc(x.kurs)}</span><span>${hbPul(x.summa, x.valyuta)}</span></div>`).join("") || "<div class='xira'>yoʻq</div>"}
      <b>Xarajat (yuk, kod 1)</b>${z.xarajatlar.map((x) => `<div><span>${esc(x.sana)} · ${esc(x.yetkazuvchi ? YETKAZUVCHILAR[x.yetkazuvchi][0] : "Kassa kod 1")}</span><span>${hbPul(Math.abs(x.summa), x.valyuta)}</span></div>`).join("") || "<div class='xira'>yoʻq</div>"}
      <div class="qalin"><span>Xarajat jami</span><span>${som(z.xarajat_som)}</span></div></div>` : "";
    return `<div class="hb-q${z.btb ? " btb" : ""}" data-qoch="${z.id}"><div class="hb-q1"><b class="id-teg">${z.id}</b> <b>${esc(z.mijoz || "—")}</b>${z.btb ? ' <span class="teg-btb">BTB</span>' : ""}<span class="xira"> · ${esc(holatNomi(z.holat))}</span></div>
      <div class="hb-q2"><span>${hbPul(z.summa, z.valyuta)}</span><span>toʻlandi ${hbPul(z.tolangan, z.valyuta)}</span><b class="${z.qarz > 0 ? "qarz" : "ortiq"}">${z.qarz > 0 ? "" : "ortiq "}${hbPul(Math.abs(z.qarz), z.valyuta)}</b></div>${tarix}</div>`;
  };
  return `<div class="seg hb-filtr">${filtr}</div>
    <div class="hb-grid">${hbKarta("Qarz $", usd(usdJ))}${hbKarta("Qarz soʻm", som(somJ))}${hbKarta("Jami (AKFA kursi)", som(somJ + usdJ * h.kurs), `${t.length} ta zakaz`, "ogoh")}</div>
    ${t.map(qator).join("") || '<p class="xira">Qarzdor yoʻq.</p>'}`;
}

function hbRasxod() {
  const h = hisobotTuz(hbMalumot, { davr: hbDavr });
  const rasxod = Object.entries(h.kassa.rasxod).filter(([, x]) => Math.abs(x) > 0.5).sort((a, c) => c[1] - a[1]);
  const yozuvlar = hbRasxodKod ? (hbMalumot.harakatlar || []).filter((x) => x.tur === "chiqim" && String(x.kod) === hbRasxodKod && String(x.sana).startsWith(hbDavr)) : [];
  return hbDavrTanlov() + `<table class="hb-jad bosiladi">${rasxod.map(([k, x]) => `<tr data-rkod="${esc(k)}" class="${hbRasxodKod === k ? "faol" : ""}"><td>${esc(HB_KODLAR[k] || k)} (${esc(k)})</td><td class="son">${som(x)}</td><td class="son">${hbFoiz(x / h.kassa.rasxod_jami)}</td></tr>`).join("")}
      <tr class="qalin"><td>Jami rasxod</td><td class="son">${som(h.kassa.rasxod_jami)}</td><td></td></tr></table>
    ${hbRasxodKod ? `<h3 class="hb-sar">${esc(HB_KODLAR[hbRasxodKod] || hbRasxodKod)}</h3>` + yozuvlar.map((x) => `<div class="hb-yoz"><span>${esc(x.sana)} · ${esc(KASSA_NOMLAR[x.kassa] ? KASSA_NOMLAR[x.kassa][0] : x.kassa)}${x.zakaz ? " · ID " + esc(x.zakaz) : ""}${x.kimga ? " · " + esc(x.kimga) : ""}${x.izoh ? " · " + esc(x.izoh) : ""}</span><b>${hbPul(-x.summa, x.valyuta)}</b></div>`).join("") : '<p class="xira">Kodni bossangiz, yozuvlari chiqadi.</p>'}`;
}

function hbOylik() {
  const yil = hbDavr.slice(0, 4);
  const oy = oylikJadval(hbMalumot, yil);
  const jami = oy.reduce((a, x) => { for (const k in x) if (typeof x[k] === "number") a[k] = (a[k] || 0) + x[k]; return a; }, {});
  const qator = (x, nom) => `<tr><td>${nom}</td><td class="son">${x.mijozlar} / ${x.shartnoma}</td><td class="son">${som(x.summa_som)}</td><td class="son">${x.bitgan}</td><td class="son">${som(x.bitgan_som)}</td><td class="son">${son(x.bitgan_m2, 1)}</td><td class="son">${som(x.tushum_som)}</td></tr>`;
  return `<p class="xira">${yil} yil. Mijoz / shartnoma — shartnoma tuzilgan oy; bitgan — ish tugagan oy.</p>
    <div class="hb-scroll"><table class="hb-jad keng"><tr class="xira"><td>Oy</td><td class="son">Mijoz / shartn.</td><td class="son">Summa</td><td class="son">Bitgan</td><td class="son">Bitgan summa</td><td class="son">m²</td><td class="son">Tushum</td></tr>
    ${oy.map((x) => qator(x, hbOyNomi(x.oy))).join("")}${qator({ ...jami, mijozlar: hisobotTuz(hbMalumot, { davr: yil }).savdo.mijozlar }, "<b>Jami</b>")}</table></div>`;
}

function hbIshlar() {
  const h = hisobotTuz(hbMalumot, {});
  const sex = h.zakazlar.filter((z) => ["shartnoma", "sex_jarayon"].includes(z.holat));
  const montaj = h.zakazlar.filter((z) => z.montaj && ["sex_tugadi", "montaj_jarayon"].includes(z.holat));
  const bugun = new Date().toISOString().slice(0, 10);
  const q = (z, kim) => `<tr class="${z.bitish && z.bitish < bugun ? "kechikdi" : ""}"><td><b class="id-teg">${z.id}</b></td><td>${esc(z.mijoz || "—")}<br><span class="xira">${esc(holatNomi(z.holat))}</span></td><td>${esc(z.bitish || "—")}</td><td>${esc(z[kim] || "—")}</td></tr>`;
  const oy = hisobotTuz(hbMalumot, { davr: new Date().toISOString().slice(0, 7) }).bitgan;
  return `<h3 class="hb-sar">Ishlab chiqarish <small>(${sex.length})</small></h3>
    <table class="hb-jad"><tr class="xira"><td>ID</td><td>Mijoz</td><td>Bitish</td><td>Guruh</td></tr>${sex.map((z) => q(z, "grux")).join("")}</table>
    <h3 class="hb-sar">Ustanovka <small>(${montaj.length})</small></h3>
    <table class="hb-jad"><tr class="xira"><td>ID</td><td>Mijoz</td><td>Bitish</td><td>Montajchi</td></tr>${montaj.map((z) => q(z, "mantajchi")).join("")}</table>
    <h3 class="hb-sar">Shu oy bitgan m²</h3>
    <table class="hb-jad">${M2_TURLARI.map(([k, y]) => `<tr><td>${y}</td><td class="son">${son(oy.m2[k], 2)}</td></tr>`).join("")}</table>
    <p class="xira hb-izoh">Bitish sanasi oʻtgan ishlar qizil. Guruh va montajchi zakazning Hisob tabida tanlanadi.</p>`;
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-hbtab],[data-qfiltr],[data-qoch],[data-rkod]");
  if (!t || !t.closest("#e-kassa")) return;
  if (t.dataset.hbtab) { hbTab = t.dataset.hbtab; try { localStorage.setItem("hb_tab", hbTab); } catch (x) {} if (hbTab === "kassa") kassaniChiz(); }
  else if (t.dataset.qfiltr) hbQarzFiltr = t.dataset.qfiltr;
  else if (t.dataset.qoch) hbOchiq = hbOchiq === Number(t.dataset.qoch) ? null : Number(t.dataset.qoch);
  else if (t.dataset.rkod) hbRasxodKod = hbRasxodKod === t.dataset.rkod ? null : t.dataset.rkod;
  hbChiz();
});
document.addEventListener("change", (e) => { if (e.target.id === "hb-davr") { hbDavr = e.target.value; hbRasxodKod = null; hbChiz(); } });

// Kassa va yuk formasida zakazni roʻyxatdan tanlash (datalist): "1087 · Tamos · qarz 950 $"
function zakazRoyxatHtml() {
  if (!hbMalumot) return "";
  const h = hisobotTuz(hbMalumot, {});
  return `<datalist id="zakaz-royxat">${h.zakazlar.slice().reverse().map((z) => `<option value="${z.id}">${esc(z.mijoz || "")}${z.qarz > 0.009 ? " · qarz " + hbPul(z.qarz, z.valyuta) : ""}</option>`).join("")}</datalist>`;
}
