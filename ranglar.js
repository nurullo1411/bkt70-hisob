// Konstruksiya rangi va raqami (foydalanuvchi, 2026-11-15): docs/dizayn.md "Konstruksiya palitrasi".
// rang_id konstruksiyaga bir marta beriladi va oʻzgarmaydi (oʻchirish, nusxa, tartib) — sexdagi PDF bilan mos qolishi uchun.
// Hisobga taʼsir qilmaydi. 10 dan koʻp boʻlsa rang takrorlanadi, raqam noyob qoladi.
const KPALITRA = [
  ["#1F6FE0", "#fff"], ["#E06A00", "#000"], ["#2E8B3E", "#000"], ["#D62839", "#fff"], ["#8E44AD", "#fff"],
  ["#00838F", "#000"], ["#B58900", "#000"], ["#D63384", "#000"], ["#6E7F00", "#000"], ["#5F6B7A", "#fff"],
];

// rang_id yoʻq konstruksiyalarga birinchi boʻsh raqamni beradi (tartib boʻyicha). Berilganlar soni.
function rangBer(konstruksiyalar) {
  const band = new Set(), takror = new Set();
  for (const k of konstruksiyalar || []) {
    const r = Number(k.rang_id);
    if (r > 0 && Number.isInteger(r) && !band.has(r)) band.add(r);
    else if (k.rang_id != null) takror.add(k);  // takror yoki notoʻgʻri — qayta beriladi
  }
  let n = 0;
  for (const k of konstruksiyalar || []) {
    if (k.rang_id != null && !takror.has(k)) continue;
    let r = 1;
    while (band.has(r)) r++;
    band.add(r); k.rang_id = r; n++;
  }
  return n;
}
// Yangi konstruksiya oladigan raqam (konstruktor sarlavhasi uchun, saqlamaydi)
function keyingiRang(konstruksiyalar) {
  const y = {};
  rangBer([...(konstruksiyalar || []).map((k) => ({ rang_id: k.rang_id })), y]);
  return y.rang_id;
}
const kRang = (k) => KPALITRA[((Number(k && k.rang_id) || 1) - 1) % KPALITRA.length];
const kRaqam = (k) => Number(k && k.rang_id) || "";
function kRaqamHtml(k, katta) {
  const [fon, matn] = kRang(k);
  return `<span class="k-raqam${katta ? " katta" : ""}" style="background:${fon};color:${matn}">${kRaqam(k)}</span>`;
}

if (typeof module !== "undefined") module.exports = { KPALITRA, rangBer, keyingiRang, kRang, kRaqam };
