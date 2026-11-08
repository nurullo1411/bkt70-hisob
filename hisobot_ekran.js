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
      ${hbKarta("Bizdan qarzdorlar", som(mijozQarzi(h).jami), hbIkkiPul(mijozQarzi(h)), "ogoh")}
      ${hbKarta("Ishxona qarzi", som(ishxonaQarzi(h).jami), hbIkkiPul(ishxonaQarzi(h)), ishxonaQarzi(h).jami > 0 ? "ogoh" : "")}
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

// Qarzdorlar (foydalanuvchi, 2026-11-08): 2 tur — Ishxona qarzi (biz: Akfa 1, Akfa 2, oyna, xodimlar) va Mijozlar qarzi (BTB usta boʻyicha, BTC ID boʻyicha)
let hbQarzTur = "mijoz", hbStavkaOch = false;
const STAVKA_NOMI = [["termo", "Termo m²"], ["pvx", "PVX m²"], ["aldoks", "Aldoks m²"], ["exclusive", "Exclusive m²"], ["dona", "Dona"]];
const hbYozuv = (sana, chap, pul) => `<div><span>${esc(sana)} · ${chap}</span><span>${pul}</span></div>`;
const hbKassaNomi = (k) => esc(KASSA_NOMLAR[k] ? KASSA_NOMLAR[k][0] : k);
function ishxonaQarzi(h) {
  const q = h.qarzlar;
  const usdQ = Math.max(0, q.akfa1.qarz) + Math.max(0, q.akfa2.qarz);
  const somQ = Math.max(0, q.oyna.qarz) + h.xodimlar.reduce((a, g) => a + Math.max(0, g.qarz), 0);
  return { usd: usdQ, som: somQ, jami: somQ + usdQ * h.kurs };
}
function mijozQarzi(h) {
  const t = h.zakazlar.filter((z) => z.qarz > 0.009);
  const usdQ = t.filter((z) => z.valyuta === "USD").reduce((a, z) => a + z.qarz, 0);
  const somQ = t.filter((z) => z.valyuta !== "USD").reduce((a, z) => a + z.qarz, 0);
  return { usd: usdQ, som: somQ, jami: somQ + usdQ * h.kurs, soni: t.length };
}
const hbIkkiPul = (x) => [x.usd ? usd(x.usd) : "", x.som || !x.usd ? som(x.som) : ""].filter(Boolean).join(" + ");

function hbQarzdorlar() {
  const h = hisobotTuz(hbMalumot, {});
  const iq = ishxonaQarzi(h), mq = mijozQarzi(h);
  const tur = [["mijoz", "Bizdan qarzdorlar"], ["ishxona", "Ishxona qarzi"]].map(([k, y]) =>
    `<button data-qtur="${k}" class="${hbQarzTur === k ? "faol" : ""}">${y}</button>`).join("");
  const tepa = `<div class="seg hb-filtr">${tur}</div>`;
  return tepa + (hbQarzTur === "ishxona" ? hbIshxona(h, iq) : hbMijozlar(h, mq));
}

function hbMijozlar(h, mq) {
  const t = h.zakazlar.filter((z) => Math.abs(z.qarz) > 0.009);
  const filtr = [["hammasi", "Hammasi"], ["oddiy", "BTC"], ["btb", "BTB"]].map(([k, y]) =>
    `<button data-qfiltr="${k}" class="${hbQarzFiltr === k ? "faol" : ""}">${y}</button>`).join("");
  const tarix = (z) => `<div class="hb-tarix"><b>Toʻlovlar</b>${z.tolovlar.map((x) => hbYozuv(x.sana, hbKassaNomi(x.kassa), hbPul(x.summa, x.valyuta))).join("") || "<div class='xira'>yoʻq</div>"}</div>`;
  const zq = (z, ichki) => {
    const k = "z:" + z.id, och = hbOchiq === k;
    return `<div class="hb-q${ichki ? " ichki" : ""}" data-qoch="${k}"><div class="hb-q1"><b class="id-teg">${z.id}</b> ${ichki ? "" : `<b>${esc(z.mijoz || "—")}</b>`}<span class="xira"> ${esc(holatNomi(z.holat))}</span></div>
      <div class="hb-q2"><span>${hbPul(z.summa, z.valyuta)}</span><span>berdi ${hbPul(z.tolangan, z.valyuta)}</span><b class="${z.qarz > 0 ? "qarz" : "ortiq"}">${z.qarz > 0 ? "" : "ortiq "}${hbPul(Math.abs(z.qarz), z.valyuta)}</b></div>${och ? tarix(z) : ""}</div>`;
  };
  // BTB — usta boʻyicha bitta qator; BTC — zakaz boʻyicha
  const ustalar = {};
  for (const z of t.filter((z) => z.btb)) (ustalar[String(z.mijoz || "—").trim()] = ustalar[String(z.mijoz || "—").trim()] || []).push(z);
  const ustaQatori = ([nom, zz]) => {
    const k = "btb:" + nom, och = hbOchiq === k;
    const x = { usd: zz.filter((z) => z.valyuta === "USD").reduce((a, z) => a + z.qarz, 0), som: zz.filter((z) => z.valyuta !== "USD").reduce((a, z) => a + z.qarz, 0) };
    return `<div class="hb-q btb" data-qoch="${k}"><div class="hb-q1"><b>${esc(nom)}</b> <span class="teg-btb">BTB</span><span class="xira"> · ${zz.length} ta zakaz</span></div>
      <div class="hb-q2"><span></span><b class="qarz">${hbIkkiPul(x)}</b></div></div>${och ? zz.map((z) => zq(z, true)).join("") : ""}`;
  };
  const btb = hbQarzFiltr !== "oddiy" ? Object.entries(ustalar).sort((a, c) => a[0].localeCompare(c[0])).map(ustaQatori).join("") : "";
  const btc = hbQarzFiltr !== "btb" ? t.filter((z) => !z.btb).map((z) => zq(z, false)).join("") : "";
  return `<div class="hb-grid">${hbKarta("Mijozlar qarzi", som(mq.jami), `${hbIkkiPul(mq)} · ${mq.soni} ta zakaz`, "ogoh")}</div>
    <div class="seg hb-filtr">${filtr}</div>
    ${btb ? `<h3 class="hb-sar">BTB ustalar</h3>${btb}` : ""}${btc ? `<h3 class="hb-sar">BTC mijozlar <small>(ID tartibida)</small></h3>${btc}` : ""}
    ${btb || btc ? "" : '<p class="xira">Qarzdor yoʻq.</p>'}`;
}

function hbIshxona(h, iq) {
  const yoz = kassaHolat && kassaHolat.ruxsat && kassaHolat.ruxsat.includes("sozlama_yoz");
  const yuk = hbMalumot.yuklar || [], har = hbMalumot.harakatlar || [];
  const qator = (k, nom, qarz, pul, ichi) => {
    const och = hbOchiq === k;
    return `<div class="hb-q" data-qoch="${esc(k)}"><div class="hb-q2"><b>${esc(nom)}</b><b class="${qarz > 0.009 ? "qarz" : qarz < -0.009 ? "ortiq" : ""}">${qarz < -0.009 ? "ortiq " : ""}${pul(Math.abs(qarz))}</b></div>${och ? `<div class="hb-tarix">${ichi()}</div>` : ""}</div>`;
  };
  const yetkazuvchi = ["akfa1", "akfa2", "oyna"].map((k) => {
    const q = h.qarzlar[k], pul = q.valyuta === "USD" ? usd : som;
    const kod = k === "oyna" ? "6" : "5";
    const ichi = () => `<div class="qalin"><span>Olindi ${pul(q.olindi)}</span><span>Toʻlandi ${pul(q.tolandi)}</span></div>
      <b>Yuklar</b>${yuk.filter((y) => y.yetkazuvchi === k).map((y) => hbYozuv(y.sana, (y.zakaz ? "ID " + esc(y.zakaz) : "umumiy") + (y.izoh ? " · " + esc(y.izoh) : ""), hbPul(y.summa, y.valyuta))).join("") || "<div class='xira'>yoʻq</div>"}
      <b>Toʻlovlar</b>${har.filter((x) => x.tur === "chiqim" && String(x.kod) === kod && (kod === "6" || (String(x.kimga || "").trim() === "Akfa 2") === (k === "akfa2")))
        .map((x) => hbYozuv(x.sana, hbKassaNomi(x.kassa) + " · kurs " + esc(x.kurs), hbPul(-x.summa, x.valyuta))).join("") || "<div class='xira'>yoʻq</div>"}`;
    return qator("y:" + k, q.nom, q.qarz, pul, ichi);
  }).join("");
  const xodim = h.xodimlar.map((g) => qator("x:" + g.nom, g.nom + (g.tur ? (g.tur === "sex" ? " · sex" : " · montaj") : ""), g.qarz, som, () =>
    `<div class="qalin"><span>Hisoblandi ${som(g.hisoblandi)}</span><span>Toʻlandi ${som(g.tolandi)}</span></div>
     <b>Bitgan ishlar</b>${g.ishlar.map((i) => hbYozuv("ID " + i.id, esc(i.mijoz || ""), som(i.haq))).join("") || "<div class='xira'>yoʻq</div>"}
     <b>Toʻlovlar (kod 8)</b>${g.tolovlar.map((x) => hbYozuv(x.sana, hbKassaNomi(x.kassa), hbPul(-x.summa, x.valyuta))).join("") || "<div class='xira'>yoʻq</div>"}`)).join("");
  const st = hbMalumot.stavkalar || {};
  const stavka = `<div class="hb-stavka"><div class="hb-q2"><span class="xira">1 m² haqi: ${STAVKA_NOMI.filter(([t]) => st[t]).map(([t, y]) => `${y.replace(" m²", "")} sex ${som(st[t].sex || 0)}, montaj ${som(st[t].montaj || 0)}`).join("; ") || "berilmagan"}</span>
      ${yoz ? `<button data-stavka="och" class="kichik-t">${hbStavkaOch ? "Yopish" : "⚙ Oʻzgartirish"}</button>` : ""}</div>
    ${hbStavkaOch ? `<div class="panjara ish">${STAVKA_NOMI.map(([t, y]) => `<label>${y} · sex<input data-st="${t}.sex" type="number" inputmode="numeric" value="${(st[t] && st[t].sex) || ""}"></label><label>${y} · montaj<input data-st="${t}.montaj" type="number" inputmode="numeric" value="${(st[t] && st[t].montaj) || ""}"></label>`).join("")}</div>
      <p class="xira">Yangi stavka faqat bundan keyin bitgan ishlarga. Oldin bitgan ish oʻz stavkasida qoladi.</p>
      <button data-stavka="saqla" class="tugma asosiy keng">Saqlash</button>` : ""}</div>`;
  return `<div class="hb-grid">${hbKarta("Ishxona qarzi", som(iq.jami), hbIkkiPul(iq), iq.jami > 0 ? "ogoh" : "")}</div>
    <h3 class="hb-sar">Yetkazib beruvchilar</h3>${yetkazuvchi}
    <h3 class="hb-sar">Xodimlar <small>(bitgan ish m² × stavka − kod 8)</small></h3>${stavka}${xodim || '<p class="xira">Hali bitgan ish yoʻq.</p>'}`;
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
  if (e.target.closest("input")) return;
  const t = e.target.closest("[data-hbtab],[data-qfiltr],[data-qoch],[data-rkod],[data-qtur],[data-stavka]");
  if (!t || !t.closest("#e-kassa")) return;
  if (t.dataset.hbtab) { hbTab = t.dataset.hbtab; try { localStorage.setItem("hb_tab", hbTab); } catch (x) {} if (hbTab === "kassa") kassaniChiz(); }
  else if (t.dataset.qfiltr) hbQarzFiltr = t.dataset.qfiltr;
  else if (t.dataset.qoch) hbOchiq = hbOchiq === t.dataset.qoch ? null : t.dataset.qoch;
  else if (t.dataset.qtur) { hbQarzTur = t.dataset.qtur; hbOchiq = null; }
  else if (t.dataset.stavka === "och") hbStavkaOch = !hbStavkaOch;
  else if (t.dataset.stavka === "saqla") { stavkaSaqla(); return; }
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

async function stavkaSaqla() {
  const st = {};
  document.querySelectorAll("[data-st]").forEach((el) => {
    const [t, k] = el.dataset.st.split("."), v = Number(String(el.value).replace(",", ".")) || 0;
    if (v) (st[t] = st[t] || {})[k] = v;
  });
  try {
    await baza("stavka_yoz", { stavkalar: st });
    hbStavkaOch = false;
    kXabar("Stavka saqlandi");
    await hisobotYangila();
  } catch (e) { kXabar("Saqlanmadi: " + e.message); }
}
