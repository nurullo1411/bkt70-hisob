// Dillerga roʻyxat: qoʻlda oʻzgarishlar (foydalanuvchi, 2026-11-16).
// zakaz.diller_tahrir = { asl: [{nomi, soni, birlik}] — tahrir paytidagi hisob, soni: {kalit: son}, ochir: [kalit],
//   qosh: [{nomi, soni, birlik}] }. Kalit — nomi (takror boʻlsa "nomi#2"). Zakaz bilan saqlanadi (bazaga ham).
//   imzo — tahrir paytidagi konstruksiyalar imzosi (dtKImzo). Konstruksiya oʻzgarsa (imzo farq) — ogohlantirish,
//   "saqlash" yoki "tashlab yuborish". Sklad tufayli oʻzgargan profil soni ogohlantirmaydi (tekshiruvchi, 2026-11-16).

function dtKalitlar(qatorlar) {
  const n = {};
  return qatorlar.map((q) => { n[q.nomi] = (n[q.nomi] || 0) + 1; return n[q.nomi] > 1 ? `${q.nomi}#${n[q.nomi]}` : q.nomi; });
}
const dtYangi = () => ({ asl: [], soni: {}, ochir: [], qosh: [], imzo: "" });
// Konstruksiya imzosi: hisobga taʼsir qiladigan qism (nom, izoh, rang raqami — yoʻq)
function dtKImzo(zakaz) {
  const ks = (zakaz.konstruksiyalar || []).map((k) => { const { nom, eslatma, rang_id, ...q } = k; return q; });
  return JSON.stringify({ u: zakaz.umumiy || {}, k: ks });
}
function dtBoshmi(t) {
  return !t || (!Object.keys(t.soni || {}).length && !(t.ochir || []).length && !(t.qosh || []).length);
}
const dtNusxa = (hisob) => hisob.map((q) => ({ nomi: q.nomi, soni: q.soni, birlik: q.birlik }));
const dtImzo = (qatorlar) => JSON.stringify((qatorlar || []).map((q) => [q.nomi, Math.round(Number(q.soni) * 1000) / 1000, q.birlik]));
// Konstruksiya tahrir paytidagidan oʻzgarganmi (faqat qoʻlda oʻzgarish boʻlsa)
const dtEskirdimi = (imzo, t) => !dtBoshmi(t) && (t.imzo || "") !== imzo;

// Yakuniy qatorlar: [{nomi, soni, birlik, izoh, kalit, asl_soni, qolda, ochirilgan, qoshilgan, qi}]
function dtQolla(hisob, t) {
  t = t || dtYangi();
  const kal = dtKalitlar(hisob), soni = t.soni || {}, ochir = new Set(t.ochir || []);
  const r = hisob.map((q, i) => {
    const k = kal[i], oz = Object.prototype.hasOwnProperty.call(soni, k);
    return { ...q, kalit: k, asl_soni: q.soni, soni: oz ? soni[k] : q.soni, qolda: oz || ochir.has(k), ochirilgan: ochir.has(k) };
  });
  (t.qosh || []).forEach((q, i) => r.push({ nomi: q.nomi, soni: q.soni, birlik: q.birlik || "", kalit: "+" + i, qolda: true, qoshilgan: true, qi: i }));
  return r;
}
// PDF uchun: oʻchirilganlarsiz, belgisiz
const dtPdf = (hisob, t) => dtQolla(hisob, t).filter((q) => !q.ochirilgan && q.nomi && Number(q.soni) > 0)
  .map(({ nomi, soni, birlik, izoh }) => ({ nomi, soni, birlik, izoh }));

const dtSon = (x) => { const v = Math.round(Number(x) * 100) / 100; return String(v).replace(".", ","); };
// "1,46 kg (31,7 m)", "1 pachka (31,7 m kerak)", "12 dona"
const dtSoniMatn = (q) => `${dtSon(q.soni)}${q.birlik ? " " + q.birlik : ""}${q.izoh ? ` (${q.izoh})` : ""}`;

// Oʻzgartirishlar (t oʻzgaradi; asl — joriy hisob nusxasi, imzo — joriy konstruksiyalar)
function dtBelgila(t, hisob, imzo) { t.asl = dtNusxa(hisob); if (imzo != null) t.imzo = imzo; t.vaqt = Date.now(); }
function dtSoniYoz(t, hisob, kalit, qiymat, imzo) {
  const i = dtKalitlar(hisob).indexOf(kalit);
  if (i < 0) return t;
  dtBelgila(t, hisob, imzo);
  if (Math.abs(Number(qiymat) - Number(hisob[i].soni)) < 1e-9) delete t.soni[kalit];
  else t.soni[kalit] = Number(qiymat);
  return t;
}
function dtOchir(t, hisob, kalit, imzo) {
  dtBelgila(t, hisob, imzo);
  if (!t.ochir.includes(kalit)) t.ochir.push(kalit);
  return t;
}
function dtQaytar(t, kalit) {  // oʻchirilgan yoki soni oʻzgargan qator — hisobdagidek
  t.ochir = t.ochir.filter((k) => k !== kalit);
  delete t.soni[kalit];
  t.vaqt = Date.now();
  return t;
}
function dtQosh(t, hisob, q, imzo) {
  dtBelgila(t, hisob, imzo);
  t.qosh.push({ nomi: String(q.nomi || "").trim(), soni: Number(q.soni) || 0, birlik: String(q.birlik || "").trim() });
  return t;
}
function dtQoshYoz(t, i, q) { if (t.qosh[i]) Object.assign(t.qosh[i], q); t.vaqt = Date.now(); return t; }
function dtQoshOchir(t, i) { t.qosh.splice(i, 1); t.vaqt = Date.now(); return t; }
// Baza ziddiyati (ikki telefon): qaysi tahrir keyinroq boʻlsa — oʻsha (vaqt boʻyicha); null — tahrir yoʻq
function dtBirlashtir(server, mahalliy) {
  if (!mahalliy) return server || null;
  if (!server) return mahalliy;
  return (Number(mahalliy.vaqt) || 0) > (Number(server.vaqt) || 0) ? mahalliy : server;
}

// Ogohlantirish uchun qoʻlda oʻzgarishlar (eski asl boʻyicha); yangi hisobda yoʻq qator — "endi yoʻq"
function dtOzgarishlar(t, hisob) {
  if (dtBoshmi(t)) return [];
  const asl = t.asl || [], kal = dtKalitlar(asl), r = [], yangi = hisob ? new Set(dtKalitlar(hisob)) : null;
  kal.forEach((k, i) => {
    const q = asl[i], yoq = yangi && !yangi.has(k) ? " (yangi hisobda endi yoʻq)" : "";
    if ((t.ochir || []).includes(k)) r.push(`${q.nomi} — oʻchirilgan${yoq}`);
    else if (Object.prototype.hasOwnProperty.call(t.soni || {}, k)) r.push(`${q.nomi}: ${dtSon(q.soni)} → ${dtSon(t.soni[k])} ${q.birlik || ""}`.trim() + yoq);
  });
  for (const q of t.qosh || []) r.push(`${q.nomi} — qoʻshilgan, ${dtSon(q.soni)} ${q.birlik || ""}`.trim());
  return r;
}
// "Qoʻlda oʻzgarishlarni saqlash": tahrir yangi hisob ustida qoladi; yangi hisobda yoʻq qatorning tahriri tushadi
function dtSaqla(t, hisob, imzo) {
  const kal = new Set(dtKalitlar(hisob));
  for (const k of Object.keys(t.soni)) if (!kal.has(k)) delete t.soni[k];
  t.ochir = t.ochir.filter((k) => kal.has(k));
  dtBelgila(t, hisob, imzo);
  return t;
}

if (typeof module !== "undefined") module.exports = { dtKalitlar, dtYangi, dtBoshmi, dtEskirdimi, dtQolla, dtPdf, dtSon, dtSoniMatn,
  dtSoniYoz, dtOchir, dtQaytar, dtQosh, dtQoshYoz, dtQoshOchir, dtOzgarishlar, dtSaqla, dtImzo, dtKImzo, dtBirlashtir };
