// Tayyor fasonlar (foydalanuvchi, 2026-11-15). Roʻyxatni shu yerda oʻzgartiring: qoʻshish — bitta qator,
// olib tashlash — qatorni oʻchirish. Har fason: tab ("oyna" | "eshik" | "arka"), nom, yasa(L, H, o) → {bolak, arka?, ...}.
// o.ochilish — joriy eshik ochilishi ("ichkariga" | "tashqariga"). Oʻlcham berilmagan boʻlaklar (null) teng boʻlinadi.
// Boʻlak oʻlchami — rama tashqi chetidan impost oʻqigacha (konstruktordagidek), sm.

const FASON_TABLAR = [["oyna", "Oyna"], ["eshik", "Eshik"], ["arka", "Arka"]];

// --- kichik yasovchilar ---
const fG = () => ({ tur: "gluxoy" });
const fT = (petlya = "chap") => ({ tur: "tabaqa", petlya_tomoni: petlya });
const fF = () => ({ tur: "tabaqa", fortochka: true });
const fTik = (...b) => ({ tur: "bolinish", yonalish: "vertikal", olchamlar: b.map(() => null), bolaklar: b });
const fYotiq = (tepa, ...b) => ({ tur: "bolinish", yonalish: "gorizontal", olchamlar: [tepa, ...b.slice(1).map(() => null)], bolaklar: b });
const fEshik = (o, qosh = {}) => ({ tur: "eshik", tabaqa_soni: 1, ochilish: o.ochilish, petlya_tomoni: "chap", ...qosh });
const fChorak = (H) => Math.round(H / 4 * 2) / 2;  // fortochka: umumiy boʻyning ~1/4, 0,5 sm ga
const fYarim = (L) => Math.round(L / 2 * 10) / 10;
const fYassi = (L) => Math.round(L * 0.2 * 10) / 10;

const FASONLAR = [
  // OYNA
  { tab: "oyna", nom: "Bitta butun oyna", yasa: () => ({ bolak: fG() }) },
  { tab: "oyna", nom: "2 boʻlak", yasa: () => ({ bolak: fTik(fT("chap"), fG()) }) },
  { tab: "oyna", nom: "3 boʻlak", yasa: () => ({ bolak: fTik(fG(), fT("chap"), fG()) }) },
  { tab: "oyna", nom: "Tepada fortochka + 2 boʻlak", yasa: (L, H) => ({ bolak: fYotiq(fChorak(H), fF(), fTik(fT("chap"), fG())) }) },
  { tab: "oyna", nom: "Tepada fortochka + 3 boʻlak", yasa: (L, H) => ({ bolak: fYotiq(fChorak(H), fF(), fTik(fG(), fT("chap"), fG())) }) },
  { tab: "oyna", nom: "4 boʻlak", yasa: () => ({ bolak: fTik(fG(), fT("chap"), fT("ong"), fG()) }) },
  // ESHIK
  { tab: "eshik", nom: "Eshik, butun oyna", yasa: (L, H, o) => ({ bolak: fEshik(o) }) },
  { tab: "eshik", nom: "Eshik, pasti sendvich", yasa: (L, H, o) => ({ bolak: fEshik(o, {
      tabaqa_impost: { yonalish: "gorizontal", olchamlar: [null, null], bolaklar: [null, { oyna_turi: "Lambri" }] } }) }) },
  { tab: "eshik", nom: "Eshik + tepada fortochka", yasa: (L, H, o) => ({ bolak: fYotiq(fChorak(H), fF(), fEshik(o)) }) },
  { tab: "eshik", nom: "2 tabaqa (katta + kichik)", yasa: (L, H, o) => ({ bolak: { tur: "eshik", tabaqa_soni: 2, ochilish: o.ochilish, aktiv: "chap" }, kichik65: true }) },
  // tashqariga ochilsa yon oyna alohida ramada, H702 lapsha bilan (Termo / Engelberg qoidasi); Aldoksda lapsha yoʻq
  { tab: "eshik", nom: "Balkon blok: eshik + oyna", yasa: (L, H, o) => ({ bolak: o.ochilish === "tashqariga" && !o.aldoks
      ? { ...fTik(fEshik(o), fG()), lapsha: true } : fTik(fEshik(o), fG()) }) },
  // ARKA
  { tab: "arka", nom: "Yarim doira arka", yasa: (L) => ({ bolak: fG(), arka: { balandlik: fYarim(L) } }) },
  { tab: "arka", nom: "Arka + pastda 2 boʻlak", yasa: (L) => ({ bolak: fYotiq(fYarim(L), fG(), fTik(fT("chap"), fG())), arka: { balandlik: fYarim(L) } }) },
  { tab: "arka", nom: "Arka + pastda 3 boʻlak", yasa: (L) => ({ bolak: fYotiq(fYarim(L), fG(), fTik(fG(), fT("chap"), fG())), arka: { balandlik: fYarim(L) } }) },
  { tab: "arka", nom: "Yassi arka + pastda 3 boʻlak", yasa: (L) => ({ bolak: fYotiq(fYassi(L), fG(), fTik(fG(), fT("chap"), fG())), arka: { balandlik: fYassi(L) } }) },
];

// Kichik rasm (preview): fasonning oʻzidan chiziladi — roʻyxat oʻzgarsa rasm ham oʻzgaradi
function fasonRasm(f) {
  const L = f.tab === "eshik" ? 100 : f.tab === "arka" ? 150 : 150, H = f.tab === "eshik" ? 220 : f.tab === "arka" ? 200 : 150;
  const r = f.yasa(L, H, { ochilish: "ichkariga" });
  const s = 64 / Math.max(L, H), W = L * s, Hh = H * s, ox = (72 - W) / 2, oy = (72 - Hh) / 2, t = 2.6;
  let ich = "";
  const a = r.arka ? Number(r.arka.balandlik) * s : 0;
  const oyna = (x, y, w, h, lam) => `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${Math.max(h, 0)}" class="${lam ? "fr-lam" : "fr-oy"}"/>`;
  const belgi = (x, y, w, h, b) => {
    if (b.tur === "tabaqa" && b.fortochka) return `<path d="M${x} ${y + h}L${x + w / 2} ${y}L${x + w} ${y + h}" class="fr-ch"/>`;
    if (b.tur === "tabaqa") return b.petlya_tomoni === "ong" ? `<path d="M${x + w} ${y}L${x} ${y + h / 2}L${x + w} ${y + h}" class="fr-ch"/>`
      : `<path d="M${x} ${y}L${x + w} ${y + h / 2}L${x} ${y + h}" class="fr-ch"/>`;
    return "";
  };
  const chiz = (b, x, y, w, h) => {
    if (b.tur === "bolinish") {
      const v = b.yonalish === "vertikal", jami = v ? w : h, n = b.bolaklar.length;
      const ber = b.olchamlar.map((q) => (q == null ? null : q * s)), bor = ber.reduce((m, q) => m + (q || 0), 0), bosh = ber.filter((q) => q == null).length;
      let p = 0;
      b.bolaklar.forEach((c, i) => {
        const d = ber[i] != null ? ber[i] - (i === 0 ? 0 : 0) : (jami - bor) / bosh;
        if (v) chiz(c, x + p, y, d, h); else chiz(c, x, y + p, w, d);
        p += d;
        if (i < n - 1) ich += v ? `<rect x="${x + p - t / 2}" y="${y}" width="${t}" height="${h}" class="fr-pr"/>` : `<rect x="${x}" y="${y + p - t / 2}" width="${w}" height="${t}" class="fr-pr"/>`;
      });
      return;
    }
    if (b.tur === "eshik") {
      const n = b.tabaqa_soni === 2 ? 2 : 1, w1 = n === 2 ? w * 0.62 : w;
      for (let i = 0; i < n; i++) {
        const xx = i === 0 ? x : x + w1, ww = i === 0 ? w1 : w - w1;
        ich += `<rect x="${xx + 1}" y="${y + 1}" width="${ww - 2}" height="${h - 2}" class="fr-pr"/>`;
        const ii = b.tabaqa_impost;
        if (ii) {
          const ym = y + h / 2;
          ich += oyna(xx + 3, y + 3, ww - 6, ym - y - 4) + oyna(xx + 3, ym + 1, ww - 6, y + h - ym - 4, true);
        } else ich += oyna(xx + 3, y + 3, ww - 6, h - 6);
        ich += `<rect x="${i === 0 && n === 1 ? xx + ww - 6 : i === 0 ? xx + ww - 5 : xx + 3}" y="${y + h * 0.5 - 3}" width="2" height="6" rx="1" class="fr-rk"/>`;
      }
      return;
    }
    ich += oyna(x + t / 2, y + t / 2, w - t, h - t, b.oyna_turi === "Lambri") + belgi(x + t, y + t, w - 2 * t, h - 2 * t, b);
  };
  chiz(r.bolak, ox + t, oy + t, W - 2 * t, Hh - 2 * t);
  let tashqi = `<rect x="${ox}" y="${oy}" width="${W}" height="${Hh}" rx="1" class="fr-pr"/>`, klip = "";
  if (a) {
    // arka: tepasi aylana yoyi (yarim doira yoki yassi)
    const R = (W * W / 4 + a * a) / (2 * a), yon = oy + a;
    const yol = `M${ox} ${oy + Hh}V${yon}A${R} ${R} 0 0 1 ${ox + W} ${yon}V${oy + Hh}Z`;
    const id = "fk" + Math.random().toString(36).slice(2, 8);
    tashqi = `<path d="${yol}" class="fr-pr"/>`;
    klip = `<clipPath id="${id}"><path d="${yol}" transform="translate(${ox + W / 2} ${oy + Hh}) scale(${(W - 2 * t) / W} ${(Hh - t) / Hh}) translate(${-ox - W / 2} ${-oy - Hh})"/></clipPath>`;
    return `<svg viewBox="0 0 72 72" class="fason-rasm"><defs>${klip}</defs>${tashqi}<g clip-path="url(#${id})">${ich}</g></svg>`;
  }
  return `<svg viewBox="0 0 72 72" class="fason-rasm">${tashqi}${ich}</svg>`;
}

if (typeof module !== "undefined") module.exports = { FASONLAR, FASON_TABLAR, fasonRasm };
