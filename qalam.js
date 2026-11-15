// Qoʻlda chizish (foydalanuvchi, 2026-11-15): barmoq yoki ruchka bilan chizilgan chiziqni tanib, tekis konstruksiyaga
// aylantiradi. Faqat shakl taniladi (sof funksiya, node bilan test qilinadi: test_baza/test_qalam.js).
//   tik chiziq  → tik impost (chiziq joyida, 0,5 sm ga yaxlitlanadi)
//   yotiq chiziq → yotiq impost
//   ">" → tabaqa, petlya chapda (uchi — ruchka tomoni);  "<" → petlya oʻngda
//   "Λ" → fortochka (petlya pastda);  "V" → fortochka, petlya tepada
//   "O" (yopiq aylana) → gluxoy (oddiy oyna)
// Nuqtalar chizma koordinatasida (sm, y pastga). Natija: {tur, x, y} yoki {tur: null, sabab}.
function qalamTani(pts, olcham) {
  if (!pts || pts.length < 2) return { tur: null, sabab: "chiziq juda qisqa" };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, uz = 0;
  pts.forEach((p, i) => {
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
    if (i) uz += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
  });
  const w = x2 - x1, h = y2 - y1, diag = Math.hypot(w, h);
  const a = pts[0], b = pts[pts.length - 1], chord = Math.hypot(b.x - a.x, b.y - a.y);
  const min = Math.max(8, (olcham || 100) * 0.08);  // juda kichik chiziq — tasodifiy tegish
  if (diag < min) return { tur: null, sabab: "chiziq juda qisqa" };
  const markaz = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

  // yopiq shakl: boshi va oxiri yaqin, yoʻl uzun — "O"
  if (chord < diag * 0.3 && uz > diag * 2) return { tur: "gluxoy", ...markaz };

  // chord dan eng uzoq nuqta (burchak uchi)
  let uzoq = 0, uch = a;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const p of pts) {
    const d = chord ? Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / chord : Math.hypot(p.x - a.x, p.y - a.y);
    if (d > uzoq) { uzoq = d; uch = p; }
  }

  // toʻgʻri chiziq: chord dan chetlanish kichik
  if (uzoq < Math.max(chord * 0.12, min * 0.25)) {
    if (Math.abs(dx) < Math.abs(dy) * 0.35) return { tur: "tik", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (Math.abs(dy) < Math.abs(dx) * 0.35) return { tur: "yotiq", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { tur: null, sabab: "chiziq qiya — tik yoki yotiq chizing" };
  }

  // burchak (> < Λ V): uch chord oʻrtasidan qaysi tomonda
  if (uzoq > chord * 0.25) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vx = uch.x - mx, vy = uch.y - my;
    if (Math.abs(vx) > Math.abs(vy) * 1.2) return { tur: vx > 0 ? "tab_chap" : "tab_ong", ...markaz };
    if (Math.abs(vy) > Math.abs(vx) * 1.2) return { tur: vy < 0 ? "fortochka" : "fortochka_tepa", ...markaz };
  }
  return { tur: null, sabab: "tanilmadi" };
}

if (typeof module !== "undefined") module.exports = { qalamTani };
