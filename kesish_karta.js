// Kesish kartalari (foydalanuvchi, 2026-11-15; docs/dizayn.md "Kesish kartalari") — sof funksiyalar.
// Hisob raskroy.py da; bu yerda faqat koʻrinish uchun guruhlash. Uzunliklar sm, solishtirish 0,01 sm butun sonda.
const sm100 = (x) => Math.round(Number(x) * 100);
const kkSon = (x) => Number(Number(x).toFixed(2)).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
// Qoldiq butun boʻlakmi: profil otxod chegarasidan (raskroy.OTXOD_CHEGARA) katta yoki teng. Chegara yoʻq — otxod.
const butunmi = (q, ch) => ch != null && Number(q) >= Number(ch);
// Konstruksiya raqami: ① … ⑳, keyin (21)
const doiraRaqam = (r) => (r >= 1 && r <= 20 ? String.fromCharCode(0x245F + r) : `(${r})`);

// Skladsiz: kesish_chizmasi hivichlari [{bolaklar: [{uzunlik, k}], qoldiq}] → kartalar.
// Bir xil kesiladigan hivichlar (uzunliklar + qoldiq) bitta kartaga; raqam(k) — boʻlak egasining raqami (null — yoʻq).
function hivichKartalar(hivichlar, L, raqam) {
  const g = new Map();
  for (const h of hivichlar || []) {
    const uz = h.bolaklar.map((b) => sm100(b.uzunlik)).sort((a, b) => b - a);
    const kalit = uz.join(",") + "|" + sm100(h.qoldiq);
    let k = g.get(kalit);
    if (!k) {
      const n = new Map();
      for (const d of uz) n.set(d, (n.get(d) || 0) + 1);
      k = { manba: "YANGI", L, soni: 0, qoldiq: h.qoldiq, n, r: new Map() };
      g.set(kalit, k);
    }
    k.soni++;
    for (const b of h.bolaklar) {
      const d = sm100(b.uzunlik), r = raqam ? raqam(b.k) : null;
      if (!k.r.has(d)) k.r.set(d, new Set());
      if (r != null && r !== "") k.r.get(d).add(r);
    }
  }
  return [...g.values()].sort((a, b) => sm100(a.qoldiq) - sm100(b.qoldiq)).map((k) => ({
    manba: k.manba, L: k.L, soni: k.soni, qoldiq: k.qoldiq,
    bolaklar: [...k.n].map(([d, n]) => [d / 100, n, [...k.r.get(d)].sort((a, b) => a - b)]),
  }));
}

// Sklad rejasi: sklad_rejasi kartalari [{manba, L, soni, qoldiq, bolaklar: [[d, n]]}] ga raqamlar.
// Har uzunlikka konstruksiyalar detallaridan navbat (kesish_chizmasi dagi egalari.pop kabi) — boʻlak aniq egasiga.
// konstruksiyalar: [{raqam, detallar: [{uzunlik, soni}]}] (raqam null — topilmadi, yozilmaydi)
function skladKartalar(kartalar, konstruksiyalar) {
  const navbat = new Map();
  for (const c of konstruksiyalar || []) {
    for (const d of c.detallar || []) {
      const q = navbat.get(sm100(d.uzunlik)) || [];
      for (let i = 0; i < d.soni; i++) q.push(c.raqam);
      navbat.set(sm100(d.uzunlik), q);
    }
  }
  return (kartalar || []).map((k) => ({
    ...k,
    bolaklar: k.bolaklar.map(([d, n]) => {
      const s = new Set(), q = navbat.get(sm100(d)) || [];
      for (let i = 0; i < n * k.soni && q.length; i++) { const r = q.pop(); if (r != null && r !== "") s.add(r); }
      return [d, n, [...s].sort((a, b) => a - b)];
    }),
  }));
}

// Profil boʻyicha yigʻindi: yangi hivich soni, skladdan ishlatilgan sm, butun qoldiqlar, jami qoldiq, samaradorlik
// (samaradorlik — raskroy kabi: detallar uzunligi ÷ hivichlar uzunligi)
function kartaJami(kartalar, chegara) {
  let yangi = 0, skladSm = 0, skladSoni = 0, qoldiq = 0, detal = 0, uzun = 0, kesim = 0;
  const butun = new Map();
  for (const k of kartalar) {
    if (k.manba === "SKLAD") { skladSm += k.L * k.soni; skladSoni += k.soni; } else yangi += k.soni;
    qoldiq += k.qoldiq * k.soni;
    uzun += k.L * k.soni;
    for (const [d, n] of k.bolaklar) { detal += d * n * k.soni; kesim += n * k.soni; }
    if (butunmi(k.qoldiq, chegara)) butun.set(sm100(k.qoldiq), (butun.get(sm100(k.qoldiq)) || 0) + k.soni);
  }
  return { yangi, skladSm, skladSoni, qoldiq, kesim, samaradorlik: uzun ? detal / uzun * 100 : 0,
    butun: [...butun].sort((a, b) => b[0] - a[0]).map(([q, n]) => [q / 100, n]) };
}
function jamiMatn(j, hivich) {
  const q = j.yangi ? [`Jami yangi ${kkSon(hivich)} sm: ${j.yangi} dona`] : ["Jami: yangi profil kerak emas"];
  if (j.skladSm > 0) q.push(`skladdan ${kkSon(j.skladSm)} sm ishlatildi`);
  if (j.butun.length) q.push(j.butun.map(([x, n]) => `${kkSon(x)} sm lik ${n} ta`).join(", ") + " butun boʻlak qoladi");
  return q.join(" · ");
}

if (typeof module !== "undefined") module.exports = { sm100, kkSon, butunmi, doiraRaqam, hivichKartalar, skladKartalar, kartaJami, jamiMatn };
