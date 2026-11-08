// Hisobot hisobi (Dodorom Hisobot Sheets oʻrniga), 2026-11-08. Sof funksiyalar: maʼlumot bazadan (amal "hisobot").
// Qoidalar (foydalanuvchi tasdiqlagan):
// - Har yozuv oʻz valyutasi va oʻz kursi bilan; jami soʻmda — USD yozuv oʻz kursida, shartnoma summasi AKFA kursida.
// - Toʻlangan = kassa kod 1 kirim (zakaz ID bilan). Kod 1 chiqim + zakaz ID = shu zakaz rasxodi.
// - Zakaz materiali = yuklar (Akfa 1, Akfa 2, oyna) shu zakaz ID bilan + kod 1 chiqim (bozor, boshqa joy). Kassadan Akfa (5, Kimga: Akfa 1/2) / oyna (6) toʻlovi faqat qarzni kamaytiradi.
// - Foyda faqat BITGAN ishlar boʻyicha, tugash oyiga yoziladi. Sof foyda = bitgan foyda − xodim m² (kod 8) − korxona rasxodlari.
// - Registratsiyadan koʻchgan maʼlumot: kassa "eski", yuk manba "eski" — hisobotda bor, lekin kassa qoldigʻi, Akfa/oyna qarzi va xodim qarziga kirmaydi.
// - Hayriya fondi (sherik, kod 40) = sof foydaning 10% (sozlanadi).
"use strict";

const HB_KODLAR = { 0: "Boshqa kirim / boshlangʻich qoldiq", 1: "Mijozlar uchun", 2: "Ishxona uchun", 3: "Shovroom", 4: "Rahbar", 5: "Akfa diller", 6: "Oyna", 7: "Bank",
  8: "Xodim m²", 9: "Sklad boʻlimi", 10: "Savdo boʻlimi", 11: "Mijozlar uchun qarz", 15: "Akfa qarz", 16: "Oyna qarz", 20: "Servis",
  30: "Marketing", 40: "Sherik (hayriya)", 44: "Rahbar investitsiya", 80: "Boʻlim boshligʻi", 85: "Zapas 1", 90: "Zapas 2" };
// Korxona rasxodi (zakazga bogʻlanmagan, sof foydadan ayriladi)
const KORXONA_KODLARI = [2, 3, 9, 10, 20, 30, 80, 85, 90];
const M2_TURLARI = [["m2_termo", "Termo"], ["m2_pvx", "PVX"], ["m2_aldoks", "Aldoks"], ["m2_exclusive", "Exclusive"], ["dona", "Dona"]];
const YETKAZUVCHILAR = { akfa1: ["Akfa 1", "USD", 5], akfa2: ["Akfa 2", "USD", 5], oyna: ["Oyna", "UZS", 6] };

const hbSon = (x) => Number(x) || 0;
// Yozuvni soʻmga: oʻz kursi bilan
const hbSom = (summa, valyuta, kurs) => (valyuta === "USD" ? hbSon(summa) * hbSon(kurs) : hbSon(summa));
const hbValyutaga = (summa, valyuta, kurs, kerak) =>
  valyuta === kerak ? hbSon(summa) : kerak === "USD" ? (hbSon(kurs) ? hbSon(summa) / hbSon(kurs) : 0) : hbSon(summa) * hbSon(kurs);
const hbOy = (sana) => String(sana || "").slice(0, 7);
const bitganmi = (z) => z.holat === "montaj_tugadi" || (z.holat === "sex_tugadi" && !z.montaj);

function hisobotTuz(d, o = {}) {
  const kurs = hbSon(o.kurs) || (d.kurslar && d.kurslar.length ? hbSon(d.kurslar[d.kurslar.length - 1].kurs) : 0);
  const davr = o.davr || ""; // "" — hammasi, "2026" — yil, "2026-11" — oy
  const ichida = (sana) => !davr || String(sana || "").startsWith(davr);
  const hayriyaFoiz = o.hayriya_foiz ?? 10;
  const shartnomaSom = (z) => (z.valyuta === "USD" ? hbSon(z.summa) * kurs : hbSon(z.summa));

  const zakazlar = (d.zakazlar || []).filter((z) => z.id && !z.ochirilgan);
  const byId = Object.fromEntries(zakazlar.map((z) => [String(z.id), z]));
  const har = d.harakatlar || [], yuk = d.yuklar || [];

  // Har zakaz: toʻlangan (zakaz valyutasida), xarajat (soʻmda, har yozuv oʻz kursida)
  const zk = {};
  for (const z of zakazlar) zk[z.id] = { tolangan: 0, xarajat_som: 0, tolovlar: [], xarajatlar: [] };
  for (const h of har) {
    const z = byId[String(h.zakaz)];
    if (!z || String(h.kod) !== "1") continue;
    if (h.tur === "kirim") { zk[z.id].tolangan += hbValyutaga(h.summa, h.valyuta, h.kurs, z.valyuta); zk[z.id].tolovlar.push(h); }
    else if (h.tur === "chiqim") { zk[z.id].xarajat_som += -hbSom(h.summa, h.valyuta, h.kurs); zk[z.id].xarajatlar.push(h); }
  }
  for (const y of yuk) {
    const z = byId[String(y.zakaz)];
    if (!z) continue;
    zk[z.id].xarajat_som += hbSom(y.summa, y.valyuta, y.kurs);
    zk[z.id].xarajatlar.push(y);
  }
  const zakazQatori = (z) => {
    const x = zk[z.id], tol = Math.round(x.tolangan * 100) / 100;
    return { ...z, tolangan: tol, qarz: Math.round((hbSon(z.summa) - tol) * 100) / 100, xarajat_som: Math.round(x.xarajat_som),
      bitgan: bitganmi(z), tolovlar: x.tolovlar, xarajatlar: x.xarajatlar };
  };
  const hammasi = zakazlar.map(zakazQatori).sort((a, b) => a.id - b.id);

  // Savdo: shartnoma tuzilgan sana davrda
  const savdo = hammasi.filter((z) => ichida(z.shartnoma_sana || z.sana));
  const bitgan = hammasi.filter((z) => z.bitgan && ichida(z.tugadi_sana));
  const m2 = (royxat) => Object.fromEntries(M2_TURLARI.map(([k]) => [k, Math.round(royxat.reduce((a, z) => a + hbSon(z[k]), 0) * 100) / 100]));
  const mijozSoni = (royxat) => new Set(royxat.map((z) => (z.btb ? "btb:" + String(z.mijoz).trim().toLowerCase() : "z:" + z.id))).size;
  const savdoSom = savdo.reduce((a, z) => a + shartnomaSom(z), 0);

  // Kassa: rasxod kod boʻyicha (davrda), soʻmda har yozuv oʻz kursida
  const rasxod = {};
  let tushum = 0;
  for (const h of har) {
    if (!ichida(h.sana) || h.tur === "ayirboshlash") continue;
    const s = hbSom(h.summa, h.valyuta, h.kurs);
    if (h.tur === "chiqim") { const k = String(h.kod); rasxod[k] = (rasxod[k] || 0) - s; }
    else if (h.tur === "kirim" && String(h.kod) === "1") tushum += s;
  }
  const rasxodJami = Object.values(rasxod).reduce((a, x) => a + x, 0);

  // Yetkazib beruvchiga qarz (davrsiz — hozirgi holat): yuk − kassa toʻlovi, qarz valyutasida
  const qarzlar = {};
  for (const [k, [nom, val, kod]] of Object.entries(YETKAZUVCHILAR)) {
    let olindi = 0;
    for (const y of yuk) if (y.yetkazuvchi === k && y.manba !== "eski") olindi += hbValyutaga(y.summa, y.valyuta, y.kurs, val);
    qarzlar[k] = { nom, valyuta: val, kod, olindi };
  }
  // Kassadan toʻlov: kod 5 → "Kimga" boʻyicha Akfa 1 yoki Akfa 2; kod 6 → Oyna
  for (const q of Object.values(qarzlar)) q.tolandi = 0;
  for (const h of har) {
    if (h.tur !== "chiqim" || h.kassa === "eski") continue; // Registratsiyadan koʻchgan: eski yuk toʻlangan deb olingan
    const kod = String(h.kod);
    const k = kod === "5" ? (String(h.kimga || "").trim() === "Akfa 2" ? "akfa2" : "akfa1") : kod === "6" ? "oyna" : null;
    if (k) qarzlar[k].tolandi += -hbValyutaga(h.summa, h.valyuta, h.kurs, qarzlar[k].valyuta);
  }
  for (const q of Object.values(qarzlar)) q.qarz = Math.round((q.olindi - q.tolandi) * 100) / 100;
  const xodimlar = xodimHaqi(d, hammasi);

  // Bitgan ishlar: foyda va marja
  const bitganSumma = bitgan.reduce((a, z) => a + shartnomaSom(z), 0);
  const bitganMaterial = bitgan.reduce((a, z) => a + z.xarajat_som, 0);
  const foyda = bitganSumma - bitganMaterial;
  const xodim = rasxod["8"] || 0;
  const korxona = KORXONA_KODLARI.reduce((a, k) => a + (rasxod[String(k)] || 0), 0);
  const sof = foyda - xodim - korxona;
  const bitganM2 = m2(bitgan);
  const jamiBitganM2 = M2_TURLARI.slice(0, 4).reduce((a, [k]) => a + bitganM2[k], 0);

  const nasiya = hammasi.filter((z) => z.qarz > 0.009);
  const nasiyaSom = (royxat) => royxat.reduce((a, z) => a + (z.valyuta === "USD" ? z.qarz * kurs : z.qarz), 0);

  return {
    kurs, davr,
    zakazlar: hammasi,
    savdo: { soni: savdo.length, mijozlar: mijozSoni(savdo), summa_som: savdoSom, ortacha_som: savdo.length ? savdoSom / savdo.length : 0,
      usd: savdo.filter((z) => z.valyuta === "USD").reduce((a, z) => a + hbSon(z.summa), 0),
      som: savdo.filter((z) => z.valyuta !== "USD").reduce((a, z) => a + hbSon(z.summa), 0),
      bitgan_som: savdo.filter((z) => z.bitgan).reduce((a, z) => a + shartnomaSom(z), 0),
      m2: m2(savdo) },
    bitgan: { soni: bitgan.length, summa_som: bitganSumma, material_som: bitganMaterial, foyda_som: foyda,
      marja: bitganSumma ? foyda / bitganSumma : 0, natsenka: bitganMaterial ? foyda / bitganMaterial : 0,
      m2: bitganM2, jami_m2: jamiBitganM2, xodim_som: xodim, korxona_som: korxona, sof_som: sof,
      bir_m2_sof: jamiBitganM2 ? sof / jamiBitganM2 : 0,
      hayriya_som: Math.max(0, sof) * hayriyaFoiz / 100, hayriya_berildi: rasxod["40"] || 0 },
    kassa: { qoldiq: d.qoldiq || {}, tushum_som: tushum, rasxod, rasxod_jami: rasxodJami },
    nasiya: { soni: nasiya.length, som: nasiyaSom(nasiya), bitgan_som: nasiyaSom(nasiya.filter((z) => z.bitgan)) },
    qarzlar, xodimlar,
  };
}

// Xodim haqi (foydalanuvchi, 2026-11-08): bitgan ish m² × stavka. Sex haqi — sex tugaganda guruhga, montaj haqi — montaj tugaganda montajchiga.
// Stavka zakazda muzlatilgan (sex_stavka / montaj_stavka); yoʻq boʻlsa hozirgi stavka. Toʻlangan — kassa kod 8 chiqim, "Kimga" = guruh nomi.
const STAVKA_TURI = { termo: "m2_termo", pvx: "m2_pvx", aldoks: "m2_aldoks", exclusive: "m2_exclusive", dona: "dona" };
const SEXDAN_KEYIN = ["sex_tugadi", "montaj_jarayon", "montaj_tugadi"];
function xodimHaqi(d, zakazlar) {
  const hozir = d.stavkalar || {};
  const stavka = (muz, bosqich) => {
    let x = null;
    try { x = muz ? JSON.parse(muz) : null; } catch (e) {}
    return x || Object.fromEntries(Object.keys(STAVKA_TURI).map((t) => [t, (hozir[t] && hozir[t][bosqich]) || 0]));
  };
  const haq = (z, st) => Object.entries(STAVKA_TURI).reduce((a, [t, m]) => a + hbSon(z[m]) * hbSon(st[t]), 0);
  const x = {};
  const kim = (nom, tur) => (x[nom] = x[nom] || { nom, tur, hisoblandi: 0, tolandi: 0, ishlar: [], tolovlar: [] });
  for (const z of zakazlar) {
    if (SEXDAN_KEYIN.includes(z.holat)) {
      const s = Math.round(haq(z, stavka(z.sex_stavka, "sex")));
      if (s) { const g = kim(z.grux || "Guruh belgilanmagan", "sex"); g.hisoblandi += s; g.ishlar.push({ id: z.id, mijoz: z.mijoz, haq: s }); }
    }
    if (z.holat === "montaj_tugadi" && z.montaj) {
      const s = Math.round(haq(z, stavka(z.montaj_stavka, "montaj")));
      if (s) { const g = kim(z.mantajchi || "Montajchi belgilanmagan", "montaj"); g.hisoblandi += s; g.ishlar.push({ id: z.id, mijoz: z.mijoz, haq: s }); }
    }
  }
  for (const h of d.harakatlar || []) {
    if (h.tur !== "chiqim" || String(h.kod) !== "8" || h.kassa === "eski") continue;
    const g = kim(String(h.kimga || "").trim() || "Kimga yozilmagan", "");
    g.tolandi += -hbSom(h.summa, h.valyuta, h.kurs);
    g.tolovlar.push(h);
  }
  const royxat = Object.values(x).map((g) => ({ ...g, qarz: g.hisoblandi - g.tolandi }));
  return royxat.sort((a, b) => a.nom.localeCompare(b.nom, "uz", { numeric: true }));
}

// Oylar boʻyicha jadval (yil): shartnoma soni, mijozlar, summa; bitgan ishlar soni, summa, m²; tushum
function oylikJadval(d, yil, kurs) {
  const oylar = [];
  for (let i = 1; i <= 12; i++) {
    const oy = `${yil}-${String(i).padStart(2, "0")}`;
    const h = hisobotTuz(d, { davr: oy, kurs });
    oylar.push({ oy, shartnoma: h.savdo.soni, mijozlar: h.savdo.mijozlar, summa_som: h.savdo.summa_som,
      bitgan: h.bitgan.soni, bitgan_som: h.bitgan.summa_som, bitgan_m2: h.bitgan.jami_m2, tushum_som: h.kassa.tushum_som, sof_som: h.bitgan.sof_som });
  }
  return oylar;
}

if (typeof module !== "undefined") module.exports = { hisobotTuz, oylikJadval, xodimHaqi, HB_KODLAR, KORXONA_KODLARI, M2_TURLARI, YETKAZUVCHILAR };
