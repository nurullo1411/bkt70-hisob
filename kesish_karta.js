// Kesish kartalari (foydalanuvchi, 2026-11-15; docs/dizayn.md "Kesish kartalari") — sof funksiyalar.
// Hisob raskroy.py da; bu yerda faqat koʻrinish uchun guruhlash. Uzunliklar sm, solishtirish 0,01 sm butun sonda.
const sm100 = (x) => Math.round(Number(x) * 100);
const kkSon = (x) => Number(Number(x).toFixed(2)).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
// Qoldiq butun boʻlakmi: profil otxod chegarasidan (raskroy.OTXOD_CHEGARA) katta yoki teng. Chegara yoʻq — otxod.
const butunmi = (q, ch) => ch != null && Number(q) >= Number(ch);
// Konstruksiya raqami: ① … ⑳, keyin (21)
const doiraRaqam = (r) => (r >= 1 && r <= 20 ? String.fromCharCode(0x245F + r) : `(${r})`);

// Bitta hivich boʻlaklari [[d100, raqam]] → karta guruhi kaliti va boʻlaklar [[d, n, [raqam]]].
// Raqamlari har xil hivichlar alohida kartada (foydalanuvchi, 2026-11-15): boʻlak (uzunlik, raqam) juftligi boʻyicha.
function hivichGuruh(juft) {
  const n = new Map();
  for (const [d, r] of juft) {
    const k = d + "|" + (r == null || r === "" ? "" : r);
    n.set(k, (n.get(k) || 0) + 1);
  }
  const bolaklar = [...n].map(([k, c]) => { const [d, r] = k.split("|"); return [Number(d) / 100, c, r === "" ? [] : [isNaN(r) ? r : Number(r)]]; })
    .sort((x, y) => y[0] - x[0] || (x[2][0] ?? 0) - (y[2][0] ?? 0));
  return { kalit: bolaklar.map((x) => `${sm100(x[0])}:${x[1]}:${x[2].join()}`).join(","), bolaklar };
}
// Kartalarga yigʻish: bir xil kalit + qoldiq — bitta karta (soni++). tartib: chaqiruvchi beradi.
function yigKartalar(hivichlar) {
  const g = new Map();
  for (const h of hivichlar) {
    const { kalit, bolaklar } = hivichGuruh(h.juft), k = h.manba + "|" + sm100(h.L) + "|" + kalit + "|" + sm100(h.qoldiq);
    if (g.has(k)) g.get(k).soni++;
    else g.set(k, { manba: h.manba, L: h.L, soni: 1, qoldiq: h.qoldiq, bolaklar });
  }
  return [...g.values()];
}

// Skladsiz: kesish_chizmasi hivichlari [{bolaklar: [{uzunlik, k}], qoldiq}] → kartalar (qoldiq oʻsishi tartibida).
// raqam(k) — boʻlak egasining raqami (null — yoʻq).
function hivichKartalar(hivichlar, L, raqam) {
  return yigKartalar((hivichlar || []).map((h) => ({ manba: "YANGI", L, qoldiq: h.qoldiq,
    juft: h.bolaklar.map((b) => [sm100(b.uzunlik), raqam ? raqam(b.k) : null]) })))
    .sort((a, b) => sm100(a.qoldiq) - sm100(b.qoldiq));
}

// Sklad rejasi: sklad_rejasi kartalari [{manba, L, soni, qoldiq, bolaklar: [[d, n]]}] → har hivichga raqam
// (har uzunlikka konstruksiyalar detallaridan navbat, kesish_chizmasi dagi egalari.pop kabi), keyin qayta yigʻiladi.
// Kartalar tartibi (SKLAD → YANGI) saqlanadi. konstruksiyalar: [{raqam, detallar: [{uzunlik, soni}]}]
function skladKartalar(kartalar, konstruksiyalar) {
  const navbat = new Map();
  for (const c of konstruksiyalar || []) {
    for (const d of c.detallar || []) {
      const q = navbat.get(sm100(d.uzunlik)) || [];
      for (let i = 0; i < d.soni; i++) q.push(c.raqam);
      navbat.set(sm100(d.uzunlik), q);
    }
  }
  const natija = [];
  for (const k of kartalar || []) {
    const hiv = [];
    for (let i = 0; i < k.soni; i++) {
      const juft = [];
      for (const [d, n] of k.bolaklar) for (let j = 0; j < n; j++) { const q = navbat.get(sm100(d)); juft.push([sm100(d), q && q.length ? q.pop() : null]); }
      hiv.push({ manba: k.manba, L: k.L, qoldiq: k.qoldiq, juft });
    }
    natija.push(...yigKartalar(hiv));
  }
  return natija;
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

if (typeof module !== "undefined") module.exports = { hivichGuruh, sm100, kkSon, butunmi, doiraRaqam, hivichKartalar, skladKartalar, kartaJami, jamiMatn };
