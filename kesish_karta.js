// Kesish varoqlari (foydalanuvchi, 2026-11-15; docs/dizayn.md "Kesish varoqlari") — sof funksiyalar.
// Hisob raskroy.py da; bu yerda faqat koʻrinish uchun guruhlash.
// Sexda uzunlik 1 kasr (mm), yarim yuqoriga: 142,24 → 142,2; 142,25 → 142,3 (docs/raskroy-narx.md). Hisob qiymati oʻzgarmaydi.
const mm = (x) => Math.round(Number(x) * 10 + 1e-7);           // butun mm (solishtirish kaliti)
const sexSon = (x) => Math.round(Number(x) * 10 + 1e-7) / 10;  // sm, 1 kasr
const kkSon = (x) => sexSon(x).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
// Qoldiq — pastga (mm): sex bor uzunlikdan oshirmaydi; "butun boʻlak" tekshiruvi xom qiymat bilan (butunmi)
const qoldiqMm = (x) => Math.floor(Number(x) * 10 + 1e-7);
const qoldiqSon = (x) => (qoldiqMm(x) / 10).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const sm100 = (x) => Math.round(Number(x) * 100);
// Qoldiq butun boʻlakmi: profil otxod chegarasidan (raskroy.OTXOD_CHEGARA) katta yoki teng. Chegara yoʻq — otxod.
const butunmi = (q, ch) => ch != null && Number(q) >= Number(ch);
// Konstruksiya raqami: ① … ⑳, keyin (21)
const doiraRaqam = (r) => (r >= 1 && r <= 20 ? String.fromCharCode(0x245F + r) : `(${r})`);
// "① ×4 ② ×4"; bitta raqam — "①"
// jami (raqamsiz boʻlak bor boʻlsa — "raqamsiz ×n", jami — boʻlaklar soni)
function raqamMatn(rq, jami) {
  const qolgan = jami == null ? 0 : jami - rq.reduce((a, x) => a + x[1], 0);
  if (rq.length === 1 && !qolgan) return doiraRaqam(rq[0][0]);
  return rq.map(([r, n]) => `${doiraRaqam(r)} ×${n}`).concat(qolgan > 0 ? [`raqamsiz ×${qolgan}`] : []).join(" ");
}
// Tab uchun qisqa nom: qavs ichi olib tashlanadi ("Kosa (Sredniy) F702" → "Kosa F702")
// (qavs ichidagi "90°" qoladi: "Qanot (impost, 90°) 181" → "Qanot 90° 181")
const qisqaNom = (nom) => String(nom).replace(/\s*\(([^)]*)\)/g, (m, ich) => (/90°/.test(ich) ? " 90°" : "")).replace(/\s+/g, " ").trim();

// Hivichlar [{manba, L, qoldiq, juft: [[uzunlik, raqam]]}] → kartalar. Bir xil boʻlaklar toʻplami (sexdagi oʻlcham — mm) +
// qoldiq + manba + L — bitta karta, raqamidan qatʼi nazar (foydalanuvchi, 2026-11-15).
// Boʻlak qatori [d, har hivichda soni, [[raqam, jami soni]]].
function yigKartalar(hivichlar) {
  const g = new Map();
  for (const h of hivichlar) {
    const uz = h.juft.map(([d]) => mm(d)).sort((a, b) => b - a);
    const k = `${h.manba}|${sm100(h.L)}|${uz.join(",")}|${qoldiqMm(h.qoldiq)}`;
    let c = g.get(k);
    if (!c) {
      const n = new Map();
      for (const d of uz) n.set(d, (n.get(d) || 0) + 1);
      c = { manba: h.manba, L: h.L, soni: 0, qoldiq: h.qoldiq, n, r: new Map() };
      g.set(k, c);
    }
    c.soni++;
    for (const [d, r] of h.juft) {
      const key = mm(d);
      if (!c.r.has(key)) c.r.set(key, new Map());
      if (r != null && r !== "") c.r.get(key).set(r, (c.r.get(key).get(r) || 0) + 1);
    }
  }
  return [...g.values()].map((c) => ({
    manba: c.manba, L: c.L, soni: c.soni, qoldiq: c.qoldiq,
    bolaklar: [...c.n].map(([d, n]) => [d / 10, n, [...c.r.get(d)].sort((a, b) => a[0] - b[0])]),
  }));
}

// Skladsiz: kesish_chizmasi hivichlari [{bolaklar: [{uzunlik, k}], qoldiq}] → kartalar (qoldiq oʻsishi tartibida).
// raqam(k) — boʻlak egasining raqami (null — yoʻq).
function hivichKartalar(hivichlar, L, raqam) {
  return yigKartalar((hivichlar || []).map((h) => ({ manba: "YANGI", L, qoldiq: h.qoldiq,
    juft: h.bolaklar.map((b) => [b.uzunlik, raqam ? raqam(b.k) : null]) })))
    .sort((a, b) => sm100(a.qoldiq) - sm100(b.qoldiq));
}

// Sklad rejasi: sklad_rejasi kartalari [{manba, L, soni, qoldiq, bolaklar: [[d, n]]}] (allaqachon birlashgan) → raqamlar.
// Har uzunlikka konstruksiyalar detallaridan navbat (kesish_chizmasi dagi egalari.pop kabi) — har boʻlak aniq egasiga,
// raqamlar karta boʻyicha sanaladi. Kartalar tartibi (SKLAD → YANGI) saqlanadi. konstruksiyalar: [{raqam, detallar: [{uzunlik, soni}]}]
function skladKartalar(kartalar, konstruksiyalar) {
  const navbat = new Map();
  for (const c of konstruksiyalar || []) {
    for (const d of c.detallar || []) {
      const q = navbat.get(sm100(d.uzunlik)) || [];
      for (let i = 0; i < d.soni; i++) q.push(c.raqam);
      navbat.set(sm100(d.uzunlik), q);
    }
  }
  return (kartalar || []).map((k) => {
    const g = new Map();  // sexda 1 kasr: 75,18 va 75,22 — bitta "75,2" qatori
    for (const [d, n] of k.bolaklar) {
      const q = navbat.get(sm100(d)) || [], x = g.get(mm(d)) || { n: 0, m: new Map() };
      x.n += n;
      for (let i = 0; i < n * k.soni && q.length; i++) { const r = q.pop(); if (r != null && r !== "") x.m.set(r, (x.m.get(r) || 0) + 1); }
      g.set(mm(d), x);
    }
    return { ...k, bolaklar: [...g].sort((a, b) => b[0] - a[0]).map(([d, x]) => [d / 10, x.n, [...x.m].sort((a, b) => a[0] - b[0])]) };
  });
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
    if (butunmi(k.qoldiq, chegara)) butun.set(qoldiqMm(k.qoldiq), (butun.get(qoldiqMm(k.qoldiq)) || 0) + k.soni);
  }
  return { yangi, skladSm, skladSoni, qoldiq, kesim, hivich: yangi + skladSoni, samaradorlik: uzun ? detal / uzun * 100 : 0,
    butun: [...butun].sort((a, b) => b[0] - a[0]).map(([q, n]) => [q / 10, n]) };
}
function jamiMatn(j, hivich) {
  const q = j.yangi ? [`Jami yangi ${kkSon(hivich)} sm: ${j.yangi} dona`] : ["Jami: yangi profil kerak emas"];
  if (j.skladSm > 0) q.push(`skladdan ${kkSon(j.skladSm)} sm ishlatildi`);
  if (j.butun.length) q.push(j.butun.map(([x, n]) => `${qoldiqSon(x)} sm lik ${n} ta`).join(", ") + " butun boʻlak qoladi");
  return q.join(" · ");
}
// Kesish turi qisqa (varoq sarlavhasi): "45°", "45°, aylantirib", "90°"
function kesimQisqa(kesim) {
  const t = String(kesim || "");
  if (/90°/.test(t)) return "90°";
  return /aylantirib/.test(t) ? "45°, aylantirib" : "45°";
}
// Kesildi belgisi imzosi: reja oʻzgarsa (boʻlaklar, qoldiq, soni) belgi eskiradi
const imzo = (kartalar) => kartalar.map((k) => `${k.manba}${sm100(k.L)}x${k.soni}q${sm100(k.qoldiq)}:${k.bolaklar.map(([d, n, rq]) => sm100(d) + "*" + n + (rq || []).map((x) => "r" + x.join("x")).join("")).join(",")}`).join(";");

if (typeof module !== "undefined") module.exports = { mm, sexSon, kkSon, qoldiqSon, sm100, butunmi, doiraRaqam, raqamMatn, qisqaNom, yigKartalar,
  qoldiqMm, hivichKartalar, skladKartalar, kartaJami, jamiMatn, kesimQisqa, imzo };
