// Zakazlar bazada (Dodorom_Baza_2026 → Zakazlar), 2026-11-08.
// Telefon — tezkor nusxa (localStorage "zakazlar"), baza — asosiy. Saqlanganda zakaz bazaga yuboriladi (3 s kutib),
// internet yoʻqda navbatda turadi ("zakaz_navbat"). Ochilganda bazadagi yangiroq versiyalar olinadi.
// Holat bazada oʻzgaradi: "Shartnoma tuzildi" da shartnoma ID (1087…) beriladi, shuning uchun internet kerak.
"use strict";

const zakazBazaRuxsat = (r) => bazaUlangan() && (!kassaHolat || (kassaHolat.ruxsat || []).includes(r));
function zNavbat() { try { return JSON.parse(ol("zakaz_navbat") || "[]"); } catch (e) { return []; } }
function zNavbatYoz(n) { try { localStorage.setItem("zakaz_navbat", JSON.stringify(n)); } catch (e) {} }
let zYuborTaymer = null;

// saqla("oxirgi_zakaz") → arxivga → shu yer: zakaz navbatga, 3 s dan keyin yuboriladi
function zakazNavbatga(id) {
  if (!bazaUlangan() || !id) return;
  const n = zNavbat();
  if (!n.includes(id)) { n.push(id); zNavbatYoz(n); }
  clearTimeout(zYuborTaymer);
  zYuborTaymer = setTimeout(zakazlarniYubor, 3000);
}

function shartnomaSumma(z) {
  const s = z.shartnoma || {};
  if (Number(s.summa) > 0) return { summa: Number(s.summa), valyuta: s.valyuta === "USD" ? "USD" : "UZS" };
  return { summa: Number(z.narx_som) || 0, valyuta: "UZS" };
}
// Nachalnik maydonlari: m² 5 tur (Termo — qoʻlda kiritilmasa konstruktordan), guruh, montajchi, bitish (Muddat)
function ishMaydonlari(z) {
  const i = z.ish || {};
  return { m2_termo: i.m2_termo ?? Math.round(zakazM2(z) * 100) / 100, m2_pvx: i.m2_pvx, m2_aldoks: i.m2_aldoks, m2_exclusive: i.m2_exclusive,
    dona: i.dona, grux: i.grux || "", mantajchi: i.mantajchi || "", bitish: (z.mijoz && z.mijoz.muddat) || "" };
}
function zakazM2(z) {
  return (z.konstruksiyalar || []).reduce((a, k) => a + (Number(k.L) || 0) * (Number(k.H) || 0) / 10000 * (k.soni ?? 1), 0);
}

let zYuborilmoqda = false;
async function zakazlarniYubor() {
  if (zYuborilmoqda || !zakazBazaRuxsat("zakaz_yoz")) return;
  zYuborilmoqda = true;
  try {
    for (const id of zNavbat()) {
      const a = arxivOl();
      const z = a.find((x) => x.id === id);
      if (!z) { zNavbatYoz(zNavbat().filter((x) => x !== id)); continue; }
      const sh = shartnomaSumma(z);
      const r = await baza("zakaz_yoz", { zakaz: { uid: z.id, versiya: z.versiya || 0, summa: sh.summa, valyuta: sh.valyuta,
        holat: holatOl(z), kurs: Number(ol("kurs")) || "", m2: Math.round(zakazM2(z) * 100) / 100, montaj: montajBor(z),
        ...ishMaydonlari(z), zakaz: z } });
      if (r.ziddiyat) bazadanQoy(r.server, true);
      else zakazgaYoz(id, { versiya: r.versiya, baza_id: r.id, holat: r.holat });
      zNavbatYoz(zNavbat().filter((x) => x !== id));
    }
  } catch (e) {
    // internet yoʻq yoki xato — navbat qoladi, keyin yana urinadi
  } finally { zYuborilmoqda = false; }
}

// Arxivdagi (va ochiq) zakazga maydonlarni yozadi, bazaga qayta yubormasdan
function zakazgaYoz(id, maydon) {
  const a = arxivOl();
  const z = a.find((x) => x.id === id);
  if (z) { Object.assign(z, maydon); arxivYoz(a); }
  if (zakaz && zakaz.id === id) {
    Object.assign(zakaz, maydon);
    try { localStorage.setItem("oxirgi_zakaz", JSON.stringify(zakaz)); } catch (e) {}
  }
}

function bazadanQoy(r, ziddiyat) {
  if (!r || !r.zakaz) return;
  const yangi = { ...r.zakaz, id: r.uid, versiya: r.versiya, baza_id: r.id, holat: r.holat, montaj: r.montaj, tolangan: r.tolangan };
  const a = arxivOl().filter((x) => x.id !== r.uid);
  if (!yangi.ochirilgan) a.unshift(yangi);
  a.sort((x, y) => String(y.sana || "").localeCompare(String(x.sana || "")) || (y.raqam || 0) - (x.raqam || 0));
  arxivYoz(a);
  if (zakaz && zakaz.id === r.uid) {
    if (yangi.ochirilgan) return;
    zakaz = yangi;
    try { localStorage.setItem("oxirgi_zakaz", JSON.stringify(zakaz)); } catch (e) {}
    if (ziddiyat) { holat("Boshqa qurilmada oʻzgargan — baza nusxasi olindi"); hisobla(); }
  }
}

let zOlinmoqda = false;
async function zakazlarniOl() {
  if (zOlinmoqda || !zakazBazaRuxsat("zakaz_kor")) return;
  zOlinmoqda = true;
  try {
    await zakazlarniYubor();
    const r = await baza("zakazlar");
    const navbatda = new Set(zNavbat());
    for (const s of r.zakazlar) {
      const l = arxivOl().find((x) => x.id === s.uid);
      if (!l || (s.versiya > (l.versiya || 0) && !navbatda.has(s.uid))) bazadanQoy(s);
      else zakazgaYoz(s.uid, { tolangan: s.tolangan, baza_id: s.id, holat: s.holat, montaj: s.montaj });
    }
    // Lokal zakaz bazada boʻlmasa (bazaga ulanishdan oldin yaratilgan) — yuboriladi
    const bazada = new Set(r.zakazlar.map((s) => s.uid));
    for (const z of arxivOl()) if (!bazada.has(z.id) && !z.versiya) zakazNavbatga(z.id);
    if (joriyEkran !== "zakaz") arxivniChiz();
    else if (natija) hisobKitobniChiz();
  } catch (e) {
    // oflayn — telefondagi nusxa bilan ishlanadi
  } finally { zOlinmoqda = false; }
}

// Holatni oʻzgartirish: bazaga ulangan boʻlsa avval bazada (ID shu yerda beriladi)
async function holatniOzgartir(id, yangi) {
  const z = arxivOl().find((x) => x.id === id) || (zakaz && zakaz.id === id ? zakaz : null);
  if (!z) return;
  if (yangi === "shartnoma" && !(shartnomaSumma(z).summa > 0)) { holat("Avval shartnoma summasini kiriting"); return; }
  if (!bazaUlangan()) { zakazgaYoz(id, { holat: yangi }); return; }
  holat("Bazaga yozilmoqda…");
  try {
    zakazNavbatga(id);
    clearTimeout(zYuborTaymer);
    await zakazlarniYubor();
    if (zNavbat().includes(id)) throw new Error("zakaz bazaga yuborilmadi");
    const r = await baza("holat_ozgar", { uid: id, yangi });
    zakazgaYoz(id, { holat: r.holat, baza_id: r.id, versiya: r.versiya });
    holat(r.id && yangi === "shartnoma" ? `Shartnoma ID: ${r.id}` : "Holat oʻzgardi");
  } catch (e) {
    holat("Holat oʻzgarmadi: " + (navigator.onLine === false ? "internet yoʻq" : e.message));
  }
}

window.addEventListener("online", () => { if (zNavbat().length) zakazlarniYubor(); });
