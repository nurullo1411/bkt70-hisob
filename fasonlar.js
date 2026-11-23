// Tayyor fasonlar (foydalanuvchi, 2026-11-15; Romchidagi roʻyxat boʻyicha). Roʻyxatni shu yerda oʻzgartiring:
// qoʻshish — bitta qator, olib tashlash — qatorni oʻchirish.
// Har fason: tab ("oyna" | "eshik" | "arka"), nom, yasa(L, H, o) → {bolak, arka?}; rasm: [L, H] — faqat kichik rasm uchun.
// o.ochilish — joriy eshik ochilishi ("ichkariga" | "tashqariga"), o.aldoks — Aldoks seriyasi.
// Boʻlak ulushlari (0…1) joriy oʻlchamga koʻra sm ga aylanadi (fasonTayyorla); null — qolgani teng boʻlinadi.
// Boʻlak oʻlchami — tashqi chetdan (yoki impost oʻqidan) impost oʻqigacha, konstruktordagidek.

const FASON_TABLAR = [["oyna", "Oyna"], ["eshik", "Eshik"], ["arka", "Arka"]];

// --- kichik yasovchilar ---
const fG = () => ({ tur: "gluxoy" });
const fLam = () => ({ tur: "gluxoy", oyna_turi: "Lambri" });               // sendvich (PVX lambri)
const fT = (petlya = "chap") => ({ tur: "tabaqa", petlya_tomoni: petlya });
const fF = () => ({ tur: "tabaqa", fortochka: true });
// ulush: null — hammasi teng; [0.25, null] — birinchisi 25 %, qolgani teng
const fBol = (yon, ulush, b) => ({ tur: "bolinish", yonalish: yon, olchamlar: b.map(() => null), _u: ulush, bolaklar: b });
const fTik = (...b) => fBol("vertikal", null, b);
const fTikU = (ulush, ...b) => fBol("vertikal", ulush, b);
const fYot = (ulush, ...b) => fBol("gorizontal", ulush, b);
const TEPA = 0.25, PAST = 0.2;                                              // tepa / past kichik boʻlak ulushi
// Framuga boʻyi (foydalanuvchi, 2026-11-15): rom — H 180 dan kichik 45, 180–220 50, kattasi 55;
// eshik — H 270 gacha 45, 270–290 50, kattasi 55; arkada — yelkadan (arka boshlanishidan) 15 sm pastda.
// Faqat konstruksiya tepasiga tegadigan boʻlinishda; ichkaridagi kichik boʻlinish — eski ulush (25 %).
const framugaBoyi = (h, eshik) => (eshik ? (h <= 270 ? 45 : h <= 290 ? 50 : 55) : (h < 180 ? 45 : h <= 220 ? 50 : 55));
const FR = (jami, c, ol, h, tepada) => (!tepada ? TEPA * jami : c.arka ? c.arka + 15 : framugaBoyi(h, c.eshik));
// Pastki gluxoy 70 sm (foydalanuvchi, 2026-11-15; rasmdan oʻqishdagidek); oʻrtaga 30 sm dan kam qolsa — eski 20 %
const PAST_SM = 70;
const pastBoy = (jami, tepa) => (jami - tepa - PAST_SM >= 30 ? PAST_SM : PAST * jami);
const ORTA = (jami, c, ol) => jami - ol[0] - pastBoy(jami, ol[0]);         // 3 qavatda oʻrtasi: framuga va pastdan qolgani
const fTepa = (...b) => fYot([FR], ...b);                                   // tepada framuga
const fUch = () => fYot([FR, ORTA], fG(), fG(), fG());                      // framuga, oʻrta, past kichik
// lapsha: alohida ramalar (H702); kalta ramaga _k — boʻy ulushi (tepaga tekislanadi)
const fLapsha = (yon, ulush, ...b) => ({ ...fBol(yon, ulush, b), lapsha: true });
const fKalta = (b, k = 0.62) => ({ ...b, _k: k });
// eshik
const SENDVICH = () => ({ yonalish: "gorizontal", olchamlar: [null, null], bolaklar: [null, { oyna_turi: "Lambri" }] });
const SENDVICH_2 = () => ({ yonalish: "gorizontal", olchamlar: [null, null],
  bolaklar: [{ yonalish: "vertikal", olchamlar: [null, null], bolaklar: [null, null] }, { oyna_turi: "Lambri" }] });
const fE1 = (o, ii) => ({ tur: "eshik", tabaqa_soni: 1, ochilish: o.ochilish, petlya_tomoni: "chap", ...(ii ? { tabaqa_impost: ii } : {}) });
// kichik: "chap" | "ong" — shu tabaqa 65 sm, ruchkalisi (aktiv) kattasi; null — teng
const fE2 = (o, kichik, ii) => ({ tur: "eshik", tabaqa_soni: 2, ochilish: o.ochilish, aktiv: kichik === "chap" ? "ong" : "chap",
  ...(kichik ? { _k65: true } : {}), ...(ii ? { tabaqa_impost: ii } : {}) });
// vitrajda eshik ustuni ulushi: 2 tabaqa — 140 sm atrofida, 1 tabaqa — 90; yon oyna kamida 30
const fEshikUlush = (L, ikki) => Math.min(L - 60, Math.max(L * (ikki ? 0.5 : 0.34), ikki ? 140 : 90)) / L;
// tashqariga ochilsa yon oyna alohida ramada (H702 lapsha; Termo / Engelberg qoidasi), Aldoksda lapsha yoʻq
const fVitraj = (o, ulush, ...b) => (o.ochilish === "tashqariga" && !o.aldoks ? fLapsha("vertikal", ulush, ...b) : fTikU(ulush, ...b));
// framuga + vitraj: vitraj lapshali boʻlsa framuga ham alohida rama (rama ichida lapsha boʻlmaydi)
const fTepaV = (tepa, past) => (past.lapsha ? fLapsha("gorizontal", [FR], tepa, past) : fTepa(tepa, past));
const fYarim = (L) => Math.round(L / 2 * 10) / 10;
const fYassi = (L) => Math.round(L * 0.2 * 10) / 10;
const fArka = (a, bolak) => ({ arka: { balandlik: a }, bolak });
const fArkaOsti = (a, tepa, past) => fArka(a, { tur: "bolinish", yonalish: "gorizontal", olchamlar: [a + 15, null], bolaklar: [tepa, past] });  // impost yelkadan 15 sm pastda

const FASONLAR = [
  // ---------- OYNA ----------
  { tab: "oyna", nom: "Bitta butun oyna", yasa: () => ({ bolak: fG() }) },
  { tab: "oyna", nom: "2 boʻlak", yasa: () => ({ bolak: fTik(fT("chap"), fG()) }) },
  { tab: "oyna", nom: "3 boʻlak", yasa: () => ({ bolak: fTik(fG(), fT("chap"), fG()) }) },
  { tab: "oyna", nom: "Tepada fortochka + 2 boʻlak", yasa: () => ({ bolak: fTepa(fF(), fTik(fT("chap"), fG())) }) },
  { tab: "oyna", nom: "Tepada fortochka + 3 boʻlak", yasa: () => ({ bolak: fTepa(fF(), fTik(fG(), fT("chap"), fG())) }) },
  { tab: "oyna", nom: "4 boʻlak", yasa: () => ({ bolak: fTik(fG(), fT("chap"), fT("ong"), fG()) }) },
  { tab: "oyna", nom: "5 boʻlak", rasm: [250, 150], yasa: () => ({ bolak: fTik(fG(), fG(), fG(), fG(), fG()) }) },
  { tab: "oyna", nom: "Tepa + past", rasm: [70, 150], yasa: () => ({ bolak: fTepa(fG(), fG()) }) },
  { tab: "oyna", nom: "Tepa + 2 boʻlak", yasa: () => ({ bolak: fTepa(fG(), fTik(fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa + 3 boʻlak", yasa: () => ({ bolak: fTepa(fG(), fTik(fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 2 + past 2", yasa: () => ({ bolak: fTepa(fTik(fG(), fG()), fTik(fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 2 + past 3", yasa: () => ({ bolak: fTepa(fTik(fG(), fG()), fTik(fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 3 + past 4", rasm: [200, 150], yasa: () => ({ bolak: fTepa(fTik(fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 2 + past 4", rasm: [200, 150], yasa: () => ({ bolak: fTepa(fTik(fG(), fG()), fTik(fG(), fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 3 + past 5", rasm: [250, 150], yasa: () => ({ bolak: fTepa(fTik(fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Chapi boʻlingan", yasa: () => ({ bolak: fTik(fTepa(fG(), fG()), fG()) }) },
  { tab: "oyna", nom: "Oʻngi boʻlingan", yasa: () => ({ bolak: fTik(fG(), fTepa(fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa + chapi boʻlingan", yasa: () => ({ bolak: fTepa(fG(), fTik(fTepa(fG(), fG()), fG())) }) },
  { tab: "oyna", nom: "3 boʻlak, oʻrtasi boʻlingan", yasa: () => ({ bolak: fTik(fG(), fTepa(fG(), fG()), fG()) }) },
  { tab: "oyna", nom: "3 boʻlak, chetlari boʻlingan", yasa: () => ({ bolak: fTik(fTepa(fG(), fG()), fG(), fTepa(fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa + 3, oʻrtasi boʻlingan", yasa: () => ({ bolak: fTepa(fG(), fTik(fG(), fTepa(fG(), fG()), fG())) }) },
  { tab: "oyna", nom: "3 ustun, hammasi boʻlingan", yasa: () => ({ bolak: fTepa(fTikU([0.25, 0.5], fG(), fG(), fG()), fTikU([0.25, 0.5], fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Oʻrtasi katta, chetlari 3 qavat", yasa: () => ({ bolak: fTikU([0.25, 0.5], fUch(), fG(), fUch()) }) },
  { tab: "oyna", nom: "Tepa 4 + oʻrta 5 + past 5", rasm: [250, 170], yasa: () => ({ bolak: fYot([FR, ORTA],
      fTikU([0.15, 0.35, 0.35], fG(), fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "4 ustun, 3 qavat", rasm: [200, 170], yasa: () => ({ bolak: fYot([FR, ORTA],
      fTik(fG(), fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG())) }) },
  { tab: "oyna", nom: "Tepa 2 + 3 + sendvich", yasa: () => ({ bolak: fYot([FR, ORTA],
      fTik(fG(), fG()), fTik(fG(), fG(), fG()), fTik(fLam(), fLam(), fLam())) }) },
  { tab: "oyna", nom: "Tepa 3 + 4 + sendvich", rasm: [200, 170], yasa: () => ({ bolak: fYot([FR, ORTA],
      fTik(fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG()), fTik(fLam(), fLam(), fLam(), fLam())) }) },
  { tab: "oyna", nom: "Tepa 3 + 5 + sendvich", rasm: [250, 170], yasa: () => ({ bolak: fYot([FR, ORTA],
      fTik(fG(), fG(), fG()), fTik(fG(), fG(), fG(), fG(), fG()), fTik(fLam(), fLam(), fLam(), fLam(), fLam())) }) },

  // ---------- ESHIK ----------
  { tab: "eshik", nom: "Eshik, butun oyna", yasa: (L, H, o) => ({ bolak: fE1(o) }) },
  { tab: "eshik", nom: "Eshik, pasti sendvich", yasa: (L, H, o) => ({ bolak: fE1(o, SENDVICH()) }) },
  { tab: "eshik", nom: "Eshik, 2 oyna + sendvich", yasa: (L, H, o) => ({ bolak: fE1(o, SENDVICH_2()) }) },
  { tab: "eshik", nom: "Eshik + tepada fortochka", yasa: (L, H, o) => ({ bolak: fTepa(fF(), fE1(o)) }) },
  { tab: "eshik", nom: "Framuga + eshik", yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE1(o)) }) },
  { tab: "eshik", nom: "Framuga + eshik, sendvich", yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE1(o, SENDVICH())) }) },
  { tab: "eshik", nom: "Framuga + eshik, 2 oyna + sendvich", yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE1(o, SENDVICH_2())) }) },
  { tab: "eshik", nom: "2 tabaqa (katta + kichik)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fE2(o, "ong") }) },
  { tab: "eshik", nom: "2 tabaqa, kichigi chapda", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fE2(o, "chap") }) },
  { tab: "eshik", nom: "2 tabaqa, sendvich (kichigi chapda)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fE2(o, "chap", SENDVICH()) }) },
  { tab: "eshik", nom: "2 tabaqa, sendvich (kichigi oʻngda)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fE2(o, "ong", SENDVICH()) }) },
  { tab: "eshik", nom: "Framuga + 2 tabaqa (kichigi chapda)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE2(o, "chap")) }) },
  { tab: "eshik", nom: "Framuga + 2 tabaqa (kichigi oʻngda)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE2(o, "ong")) }) },
  { tab: "eshik", nom: "Framuga + 2 tabaqa, sendvich (chap)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE2(o, "chap", SENDVICH())) }) },
  { tab: "eshik", nom: "Framuga + 2 tabaqa, sendvich (oʻng)", rasm: [150, 220], yasa: (L, H, o) => ({ bolak: fTepa(fG(), fE2(o, "ong", SENDVICH())) }) },
  { tab: "eshik", nom: "Balkon blok: eshik + oyna", rasm: [180, 220], yasa: (L, H, o) => ({ bolak: fVitraj(o, null, fE1(o), fG()) }) },
  // balkon: oyna eshikdan kalta, tepasi tekis (alohida ramalar, lapsha) — Aldoksda xato
  { tab: "eshik", nom: "Balkon: oyna + eshik + oyna", rasm: [250, 220], yasa: (L, H, o) => {
      const d = fEshikUlush(L, false); return { bolak: fLapsha("vertikal", [(1 - d) / 2, d], fKalta(fG()), fE1(o), fKalta(fG())) }; } },
  { tab: "eshik", nom: "Balkon: oyna + eshik", rasm: [180, 220], yasa: (L, H, o) => ({ bolak: fLapsha("vertikal", null, fKalta(fG()), fE1(o)) }) },
  { tab: "eshik", nom: "Balkon: eshik + oyna", rasm: [180, 220], yasa: (L, H, o) => ({ bolak: fLapsha("vertikal", null, fE1(o), fKalta(fG())) }) },
  { tab: "eshik", nom: "Balkon: framuga + oyna + eshik + oyna", rasm: [250, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, false);
      return { bolak: fLapsha("gorizontal", [FR], fG(), fLapsha("vertikal", [(1 - d) / 2, d], fKalta(fG(), 0.55), fE1(o), fKalta(fG(), 0.55))) }; } },
  { tab: "eshik", nom: "Balkon: framuga + oyna + eshik", rasm: [180, 240], yasa: (L, H, o) => ({
      bolak: fLapsha("gorizontal", [FR], fG(), fLapsha("vertikal", null, fKalta(fG(), 0.55), fE1(o))) }) },
  { tab: "eshik", nom: "Balkon: framuga + eshik + oyna", rasm: [180, 240], yasa: (L, H, o) => ({
      bolak: fLapsha("gorizontal", [FR], fG(), fLapsha("vertikal", null, fE1(o), fKalta(fG(), 0.55))) }) },
  { tab: "eshik", nom: "Oyna + 2 tabaqa", rasm: [220, 220], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [1 - d], fG(), fE2(o, "chap")) }; } },
  { tab: "eshik", nom: "2 tabaqa + oyna", rasm: [220, 220], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [d], fE2(o, "ong"), fG()) }; } },
  { tab: "eshik", nom: "Oyna + 2 tabaqa + oyna", rasm: [280, 220], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fG(), fE2(o, "chap"), fG()) }; } },
  { tab: "eshik", nom: "Oyna + 2 tabaqa sendvich + oyna", rasm: [280, 220], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true);
      return { bolak: fVitraj(o, [(1 - d) / 2, d], fYot([0.55], fG(), fG()), fE2(o, "chap", SENDVICH()), fYot([0.55], fG(), fG())) }; } },
  { tab: "eshik", nom: "Oyna + framuga, 2 tabaqa + oyna", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fG(), fTepa(fG(), fE2(o, "chap")), fG()) }; } },
  { tab: "eshik", nom: "Oyna + framuga, 2 tabaqa sendvich + oyna", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fG(), fTepa(fG(), fE2(o, "chap", SENDVICH())), fG()) }; } },
  { tab: "eshik", nom: "Framuga + oyna, 2 tabaqa, oyna", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fTepaV(fG(), fVitraj(o, [(1 - d) / 2, d], fG(), fE2(o, "chap"), fG())) }; } },
  { tab: "eshik", nom: "Framuga + oyna, 2 tabaqa sendvich, oyna", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fTepaV(fG(), fVitraj(o, [(1 - d) / 2, d], fG(), fE2(o, "chap", SENDVICH()), fG())) }; } },
  { tab: "eshik", nom: "Framuga 2 + oyna, 2 tabaqa sendvich, oyna", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fTepaV(fTik(fG(), fG()), fVitraj(o, [(1 - d) / 2, d], fG(), fE2(o, "chap", SENDVICH()), fG())) }; } },
  { tab: "eshik", nom: "Boʻlingan oyna + framuga, 2 tabaqa", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fTepa(fG(), fG()), fTepa(fG(), fE2(o, "chap")), fTepa(fG(), fG())) }; } },
  { tab: "eshik", nom: "Boʻlingan oyna + framuga, 2 tabaqa sendvich", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true);
      return { bolak: fVitraj(o, [(1 - d) / 2, d], fTepa(fG(), fG()), fTepa(fG(), fE2(o, "chap", SENDVICH())), fTepa(fG(), fG())) }; } },
  { tab: "eshik", nom: "3 qavat oyna + framuga, 2 tabaqa", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fUch(), fTepa(fG(), fE2(o, "chap")), fUch()) }; } },
  { tab: "eshik", nom: "3 qavat oyna + framuga, 2 tabaqa sendvich", rasm: [280, 240], yasa: (L, H, o) => {
      const d = fEshikUlush(L, true); return { bolak: fVitraj(o, [(1 - d) / 2, d], fUch(), fTepa(fG(), fE2(o, "chap", SENDVICH())), fUch()) }; } },

  // ---------- ARKA ----------
  { tab: "arka", nom: "Yarim doira arka", yasa: (L) => fArka(fYarim(L), fG()) },
  { tab: "arka", nom: "Arka + pastda 1 boʻlak", yasa: (L) => fArkaOsti(fYarim(L), fG(), fG()) },
  { tab: "arka", nom: "Arka + pastda 2 boʻlak", yasa: (L) => fArkaOsti(fYarim(L), fG(), fTik(fT("chap"), fG())) },
  { tab: "arka", nom: "Arka + pastda 3 boʻlak", yasa: (L) => fArkaOsti(fYarim(L), fG(), fTik(fG(), fT("chap"), fG())) },
  { tab: "arka", nom: "Arka 2 + pastda 3", yasa: (L) => fArkaOsti(fYarim(L), fTik(fG(), fG()), fTik(fG(), fG(), fG())) },
  { tab: "arka", nom: "Arka + chapi boʻlingan", yasa: (L) => fArkaOsti(fYarim(L), fG(), fTik(fTepa(fG(), fG()), fG())) },
  { tab: "arka", nom: "Yassi arka + pastda 2 boʻlak", yasa: (L) => fArkaOsti(fYassi(L), fG(), fTik(fG(), fG())) },
  { tab: "arka", nom: "Yassi arka + pastda 3 boʻlak", yasa: (L) => fArkaOsti(fYassi(L), fG(), fTik(fG(), fT("chap"), fG())) },
  { tab: "arka", nom: "Yassi arka + 3, oʻrtasi boʻlingan", yasa: (L) => fArkaOsti(fYassi(L), fG(), fTik(fG(), fTepa(fG(), fG()), fG())) },
  { tab: "arka", nom: "Yassi arka + 3, chetlari boʻlingan", yasa: (L) => fArkaOsti(fYassi(L), fG(), fTik(fTepa(fG(), fG()), fG(), fTepa(fG(), fG()))) },
  { tab: "arka", nom: "Yassi arka 2 + pastda 3", yasa: (L) => fArkaOsti(fYassi(L), fTik(fG(), fG()), fTik(fG(), fG(), fG())) },
  { tab: "arka", nom: "Yassi arka 2 + 3, oʻrtasi boʻlingan", yasa: (L) => fArkaOsti(fYassi(L), fTik(fG(), fG()), fTik(fG(), fTepa(fG(), fG()), fG())) },
  { tab: "arka", nom: "Yassi arka 2 + 3, chetlari boʻlingan", yasa: (L) => fArkaOsti(fYassi(L), fTik(fG(), fG()), fTik(fTepa(fG(), fG()), fG(), fTepa(fG(), fG()))) },
  { tab: "arka", nom: "Yassi arka, 3 ustun (oʻrtasi boʻlingan)", rasm: [150, 220], yasa: (L) => fArka(fYassi(L), fTik(fG(), fTepa(fG(), fG()), fG())) },
];

// Ulushlarni (_u, _k) joriy oʻlchamga koʻra sm ga aylantiradi; eshik _k65 qoladi (konstruktor hisoblaydi).
// _u: son — ulush (0…1), funksiya (jami, c, oldingilar, h, tepada) — sm; c = {eshik, arka}; tepada — konstruksiya tepasiga tegadi
function fasonTayyorla(b, w, h, c = {}, tepada = true) {
  if (!b || b.tur !== "bolinish") return b;
  const v = b.yonalish === "vertikal", jami = (v ? w : h) - (b.lapsha ? 0.5 * (b.bolaklar.length - 1) : 0);
  const yx = (x) => Math.round(x * 2) / 2;
  if (b._u) {
    const ol = [];
    b.bolaklar.forEach((_, i) => {
      const u = i < b._u.length && i < b.bolaklar.length - 1 ? b._u[i] : null;
      ol.push(u == null ? null : yx(typeof u === "function" ? u(jami, c, ol, h, tepada) : u * jami));
    });
    b.olchamlar = ol;
  }
  delete b._u;
  const ber = b.olchamlar.reduce((m, q) => m + (q || 0), 0), bosh = b.olchamlar.filter((q) => q == null).length;
  b.bolaklar.forEach((q, i) => {
    const d = b.olchamlar[i] != null ? b.olchamlar[i] : (jami - ber) / bosh;
    if (q._k != null) { if (b.lapsha && v) q.boy = yx(h * q._k); delete q._k; }
    fasonTayyorla(q, v ? d : w, v ? (q.boy || h) : d, c, tepada && (v || i === 0));
  });
  return b;
}
function fasonYasa(f, L, H, o) {
  const r = f.yasa(L, H, o);
  fasonTayyorla(r.bolak, L, H, { eshik: f.tab === "eshik", arka: r.arka ? Number(r.arka.balandlik) : 0 });
  r.bolak = tikBirinchi(r.bolak, L, [], 0.01);   // avval tik impost (foydalanuvchi, 2026-11-15); fasonda faqat aniq bir joy
  return r;
}

// Kichik rasm (preview): fasonning oʻzidan chiziladi — roʻyxat oʻzgarsa rasm ham oʻzgaradi
function fasonRasm(f) {
  const [L, H] = f.rasm || (f.tab === "eshik" ? [100, 220] : f.tab === "arka" ? [150, 200] : [150, 150]);
  const r = fasonYasa(f, L, H, { ochilish: "ichkariga" });
  const s = 64 / Math.max(L, H), t = 2.4;
  let ich = "";
  const oyna = (x, y, w, h, lam) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(w, 0).toFixed(2)}" height="${Math.max(h, 0).toFixed(2)}" class="${lam ? "fr-lam" : "fr-oy"}"/>`;
  const pr = (x, y, w, h) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(w, 0).toFixed(2)}" height="${Math.max(h, 0).toFixed(2)}" class="fr-pr"/>`;
  const belgi = (x, y, w, h, b) => {
    if (b.tur === "tabaqa" && b.fortochka) return `<path d="M${x} ${y + h}L${x + w / 2} ${y}L${x + w} ${y + h}" class="fr-ch"/>`;
    if (b.tur === "tabaqa") return b.petlya_tomoni === "ong" ? `<path d="M${x + w} ${y}L${x} ${y + h / 2}L${x + w} ${y + h}" class="fr-ch"/>`
      : `<path d="M${x} ${y}L${x + w} ${y + h / 2}L${x} ${y + h}" class="fr-ch"/>`;
    return "";
  };
  // boʻlinish oʻlchamlari (sm) → boʻlak oʻlchamlari (px)
  const qism = (ol, jami, n) => {
    const ber = ol.reduce((m, q) => m + (q == null ? 0 : q * s), 0), bosh = ol.filter((q) => q == null).length;
    return ol.map((q) => (q == null ? (jami - ber) / Math.max(bosh, 1) : q * s));
  };
  // tabaqa ichi (sendvich, ichki impost)
  const ichki = (ii, x, y, w, h) => {
    if (!ii) { ich += oyna(x, y, w, h); return; }
    if (/^Lambri/.test(ii.oyna_turi || "")) { ich += oyna(x, y, w, h, true); return; }
    const v = ii.yonalish === "vertikal", d = qism(ii.olchamlar, v ? w : h);
    let p = 0;
    d.forEach((q, i) => {
      const c = (ii.bolaklar || [])[i];
      if (v) ichki(c, x + p + (i ? 0.8 : 0), y, q - (i ? 0.8 : 0), h); else ichki(c, x, y + p + (i ? 0.8 : 0), w, q - (i ? 0.8 : 0));
      p += q;
    });
  };
  const chiz = (b, x, y, w, h, rama) => {
    if (rama) { ich += pr(x, y, w, h); x += t; y += t; w -= 2 * t; h -= 2 * t; }
    if (b.tur === "bolinish") {
      const v = b.yonalish === "vertikal", lap = b.lapsha ? 0.5 * s : 0;
      const d = qism(b.olchamlar, (v ? w : h) - lap * (b.bolaklar.length - 1) + (b.lapsha ? 2 * t : 0));
      let p = b.lapsha ? -t : 0;
      b.bolaklar.forEach((c, i) => {
        const q = d[i];
        if (b.lapsha) {
          // har bola alohida rama, kaltasi tepaga tekislanadi
          const hb = v && c.boy ? c.boy * s : (v ? h + 2 * t : q), wb = !v && c.en ? c.en * s : (v ? q : w + 2 * t);
          if (v) chiz(c, x + p, y - t, wb, hb, true); else chiz(c, x - t, y + p, wb, hb, true);
          p += q + lap;
          return;
        }
        if (v) chiz(c, x + p, y, q, h); else chiz(c, x, y + p, w, q);
        p += q;
        if (i < b.bolaklar.length - 1) ich += v ? pr(x + p - t / 2, y, t, h) : pr(x, y + p - t / 2, w, t);
      });
      return;
    }
    if (b.tur === "eshik") {
      const n = b.tabaqa_soni === 2 ? 2 : 1, kichik = b._k65 ? (b.aktiv === "ong" ? 0 : 1) : -1;
      const w1 = n === 2 ? (kichik === 0 ? w * 0.38 : kichik === 1 ? w * 0.62 : w / 2) : w;
      for (let i = 0; i < n; i++) {
        const xx = i === 0 ? x : x + w1, ww = i === 0 ? w1 : w - w1;
        ich += pr(xx + 0.5, y + 0.5, ww - 1, h - 1);
        ichki(b.tabaqa_impost, xx + 3, y + 3, ww - 6, h - 6);
        const ruchka = n === 1 ? (b.petlya_tomoni === "ong" ? xx + 3.5 : xx + ww - 5.5) : (i === 0) === (b.aktiv !== "ong") ? (i === 0 ? xx + ww - 5 : xx + 3) : null;
        if (ruchka != null) ich += `<rect x="${ruchka}" y="${y + h * 0.5 - 3}" width="2" height="6" rx="1" class="fr-rk"/>`;
      }
      return;
    }
    ich += oyna(x + t / 2, y + t / 2, w - t, h - t, /^Lambri/.test(b.oyna_turi || "")) + belgi(x + t, y + t, w - 2 * t, h - 2 * t, b);
  };
  const W = L * s, Hh = H * s, ox = (72 - W) / 2, oy = (72 - Hh) / 2;
  if (r.bolak.lapsha) chiz(r.bolak, ox + t, oy + t, W - 2 * t, Hh - 2 * t);
  else chiz(r.bolak, ox, oy, W, Hh, true);
  const a = r.arka ? Number(r.arka.balandlik) * s : 0;
  if (a) {
    // arka: tepasi aylana yoyi (yarim doira yoki yassi) — ichi yoy boʻyicha qirqiladi, ustidan rama yoyi
    const R = (W * W / 4 + a * a) / (2 * a), yon = oy + a;
    const yol = (k) => `M${ox + k} ${oy + Hh}V${yon}A${R - k} ${R - k} 0 0 1 ${ox + W - k} ${yon}V${oy + Hh}Z`;
    const id = "fk" + Math.random().toString(36).slice(2, 8);
    return `<svg viewBox="0 0 72 72" class="fason-rasm"><defs><clipPath id="${id}"><path d="${yol(0)}"/></clipPath></defs>` +
      `<g clip-path="url(#${id})">${ich}</g><path d="${yol(t / 2)}" class="fr-yoy" style="stroke-width:${t}"/></svg>`;
  }
  return `<svg viewBox="0 0 72 72" class="fason-rasm">${ich}</svg>`;
}

// Impost tartibi (foydalanuvchi, 2026-11-02 va 2026-11-15): avval tik impost (butun boʻyga), keyin yotiq.
// Yotiq boʻlinish qatorlarida bir xil joyda (TIK_FARQ sm gacha farq) tik impost boʻlsa — tik ustunlarga oʻgiriladi:
// ildiz tik boʻlinish, har ustun ichida oʻsha yotiq qatorlar. Farq boʻlsa birinchi (tepa) qatordagi joy olinadi, izoh[] ga yoziladi.
// W — shu boʻlak eni (sm), tol — farq chegarasi. Rasmdan oʻqilgan (AI), qoʻlda chizilgan (5 sm) va fasonlarda (aniq) qoʻllanadi.
const TIK_FARQ = 5;
function tikBirinchi(b, W, izoh = [], tol = TIK_FARQ, past = false) {
  if (!b || b.tur !== "bolinish") return b;
  const qism = (ol, jami) => {
    const ber = ol.reduce((m, q) => m + (q == null ? 0 : Number(q)), 0), bosh = ol.filter((q) => q == null).length;
    return ol.map((q) => (q == null ? (jami - ber) / Math.max(bosh, 1) : Number(q)));
  };
  // avval ichkaridagilar (tik boʻlinishda har bola oʻz enida)
  if (b.yonalish === "vertikal" && !b.lapsha) { const en = qism(b.olchamlar || [], W); b.bolaklar = b.bolaklar.map((c, i) => tikBirinchi(c, en[i], izoh, tol, past)); }
  else if (!b.lapsha) b.bolaklar = b.bolaklar.map((c) => tikBirinchi(c, W, izoh, tol, past));
  if (b.yonalish !== "gorizontal" || b.lapsha || b.egilgan || b.chift || b.bolaklar.length < 2) return b;
  // har qator: boʻlaklar [{c, x1, x2}]
  const qatorlar = b.bolaklar.map((c) => {
    if (!c || c.tur !== "bolinish" || c.yonalish !== "vertikal" || c.lapsha || c.chift || c.impost_profil || c.tashqi) return null;
    const en = qism(c.olchamlar || [], W); let x = 0;
    return c.bolaklar.map((d, i) => ({ d, x1: x, x2: (x += en[i]), bosh: (c.olchamlar || [])[i] == null }));
  });
  if (qatorlar.some((q) => !q)) return b;
  const chegara = qatorlar[0].slice(0, -1).map((p) => p.x2)
    .filter((x) => qatorlar.every((q) => q.slice(0, -1).some((p) => Math.abs(p.x2 - x) <= tol)));
  if (!chegara.length) return b;
  // farqli joylarni tepa (past = true — eng pastki) qatorga tekislash; juftlar izoh.juft ga (savol uchun)
  const yx = (x) => Math.round(x * 10) / 10, oxir = qatorlar[qatorlar.length - 1];
  const nishon = chegara.map((x) => (past ? oxir.find((p) => Math.abs(p.x2 - x) <= tol).x2 : x));
  const juft = chegara.map((x, j) => ({ tepa: yx(x), past: yx(oxir.find((p) => Math.abs(p.x2 - x) <= tol).x2) }));
  for (const q of qatorlar) for (const p of q) chegara.forEach((x, j) => {
    if (Math.abs(p.x2 - x) <= tol) p.x2 = nishon[j];
    if (Math.abs(p.x1 - x) <= tol) p.x1 = nishon[j];
  });
  if (juft.some((j) => j.tepa !== j.past)) {
    izoh.push(`Tik impost butun boʻyga qoʻyildi; pastki qatordagi joyi tepadagidan farq qilgan — ${past ? "pastdagisi" : "tepadagisi"} olindi, tekshiring.`);
    (izoh.juft = izoh.juft || []).push(...juft.filter((j) => j.tepa !== j.past));
  }
  const chet = [0, ...nishon, W];
  const ustunlar = chet.slice(0, -1).map((x1, j) => {
    const x2 = chet[j + 1];
    const bolaklar = qatorlar.map((q, r) => {
      const ichi = q.filter((p) => p.x1 >= x1 - 0.01 && p.x2 <= x2 + 0.01);
      if (ichi.length === 1) return ichi[0].d;
      const asl = b.bolaklar[r], { tur, yonalish, olchamlar, bolaklar: _, ...qolgan } = asl;
      return { tur: "bolinish", yonalish: "vertikal", ...qolgan,
        olchamlar: ichi.every((p) => p.bosh) ? ichi.map(() => null) : ichi.map((p, i) => (i === ichi.length - 1 ? null : yx(p.x2 - p.x1))),
        bolaklar: ichi.map((p) => p.d) };
    });
    return { tur: "bolinish", yonalish: "gorizontal", olchamlar: [...b.olchamlar], bolaklar };
  });
  const { tur, yonalish, olchamlar, bolaklar, ...qolgan } = b;
  return { tur: "bolinish", yonalish: "vertikal", ...qolgan, olchamlar: ustunlar.map((_, j) => (j === ustunlar.length - 1 ? null : yx(chet[j + 1] - chet[j]))), bolaklar: ustunlar };
}

// Ildiz tik impostlari joyi (sm, chapdan) — 2 ramaga boʻlish variantlari uchun
function ildizChegaralar(b, L) {
  if (!b || b.tur !== "bolinish" || b.yonalish !== "vertikal" || b.lapsha) return [];
  const ol = b.olchamlar || [], ber = ol.reduce((m, q) => m + (q == null ? 0 : Number(q)), 0), bosh = ol.filter((q) => q == null).length;
  let x = 0;
  return b.bolaklar.slice(0, -1).map((_, i) => Math.round((x += ol[i] == null ? (L - ber) / Math.max(bosh, 1) : Number(ol[i])) * 100) / 100);
}
// Detal hivichdan uzun (foydalanuvchi, 2026-11-15): rama ildizdagi i-tik impost joyidan 2 ga boʻlinadi —
// Aldoksda shu chiziq Chift Quloq 109 (kosa boʻlinadi), boshqa seriyada H702 lapsha bilan 2 alohida rama (oraliq 0,5).
function ramaBol(b, L, i, aldoks) {
  const x = ildizChegaralar(b, L)[i];
  if (x == null) return null;
  const yangi = JSON.parse(JSON.stringify(b)), n = yangi.bolaklar.length, yx = (v) => Math.round(v * 100) / 100;
  if (aldoks) {
    const m = Array.isArray(yangi.chift) ? yangi.chift.slice() : Array(n - 1).fill(!!yangi.chift);
    m[i] = true;
    yangi.chift = m.every(Boolean) ? true : m;
    return yangi;
  }
  const chet = [0, ...ildizChegaralar(b, L), L];
  const guruh = (a, z, chapKam) => {
    if (z - a === 1) return yangi.bolaklar[a];
    const en = [];
    for (let j = a; j < z; j++) en.push(j === z - 1 ? null : yx(chet[j + 1] - chet[j] - (j === a && chapKam ? 0.25 : 0)));
    return { tur: "bolinish", yonalish: "vertikal", olchamlar: en, bolaklar: yangi.bolaklar.slice(a, z) };
  };
  return { tur: "bolinish", lapsha: true, yonalish: "vertikal", olchamlar: [yx(x - 0.25), null], bolaklar: [guruh(0, i + 1, false), guruh(i + 1, n, true)] };
}
// AI variant oʻzgarishi: konstruksiya ichida yol (kalitlar va indekslar) boʻyicha qiymat qoʻyish
function yolQoy(k, yol, qiymat) {
  if (!Array.isArray(yol) || !yol.length) return false;
  const yomon = (x) => typeof x !== "string" && !Number.isInteger(x) || ["__proto__", "constructor", "prototype"].includes(x);
  if (yol.some(yomon) || !["L", "H", "bolak", "arka", "soni", "tanlov", "nom"].includes(yol[0])) return false;
  let o = k;
  for (const x of yol.slice(0, -1)) { if (o == null || typeof o !== "object" || !(x in o)) return false; o = o[x]; }
  if (o == null || typeof o !== "object") return false;
  o[yol[yol.length - 1]] = JSON.parse(JSON.stringify(qiymat));
  return true;
}

if (typeof module !== "undefined") module.exports = { FASONLAR, FASON_TABLAR, fasonRasm, fasonYasa, tikBirinchi, ildizChegaralar, ramaBol, yolQoy };
