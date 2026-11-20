// Server (Supabase) mijozi (foydalanuvchi, 2026-11-20; docs/server.md): kutubxonasiz fetch.
// Kirish — telefon + parol (ichida soxta email, SMS yoʻq). Sklad nusxasi telefonda (localStorage "sklad_server"),
// oʻqish internetsiz ham; yozish — RPC orqali (b-qadamda faqat onlayn; oflayn navbat c-qadamda).
"use strict";

// Ochiq maʼlumot: Project URL va anon kalit (RLS bilan himoyalangan; service_role hech qachon bu yerda emas)
const SB_URL = "https://nrcrxfymmqavqauvsdiw.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY3J4ZnltbXFhdnFhdXZzZGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODg3MzYsImV4cCI6MjExMDc2NDczNn0.po0INfze95ykrDqhmqJDcfyEv6zfRi0W47Otz3gYT24";
const SB_EMAIL_DOMEN = "tel.bkt70.app";
const SB_BLOK = 50;
// Parol unutilsa — ilova egasi tiklaydi (asbob/parol_tikla.py; foydalanuvchi, 2026-11-20)
const SB_YORDAM_TEL = "+998 91 143-14-11";

// ---------- sof funksiyalar (node testi: test_baza/test_server.js) ----------
// "+998 90 123-45-67", "901234567", "998901234567" → "998901234567"; boshqasi null
function sbTelefon(s) {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return /^998\d{9}$/.test(d) ? d : null;
}
const sbEmail = (tel) => `${tel}@${SB_EMAIL_DOMEN}`;
const sbChiroyli = (tel) => tel ? `+${tel.slice(0, 3)} ${tel.slice(3, 5)} ${tel.slice(5, 8)}-${tel.slice(8, 10)}-${tel.slice(10)}` : "";

function sbBoshNusxa() {
  return { gacha: 0, firma: null, men: null, azolar: [], seriyalar: [], profillar: [], bolaklar: [], butunlar: [], bloklar: [] };
}
// ozgarishlar(gacha) javobini nusxaga qoʻshadi: id boʻyicha almashtiriladi (butun — profil + rang)
function sbBirlashtir(n, j) {
  const almash = (eski, yangi, kalit) => {
    const m = new Map(eski.map((x) => [kalit(x), x]));
    for (const x of yangi || []) m.set(kalit(x), x);
    return [...m.values()];
  };
  const id = (x) => x.id;
  n.seriyalar = almash(n.seriyalar, j.seriyalar, id).sort((a, b) => a.tartib - b.tartib || String(a.nom).localeCompare(b.nom));
  n.profillar = almash(n.profillar, [...(j.profillar || [])].sort((a, b) => (Number(a.ozgarish) || 0) - (Number(b.ozgarish) || 0)), id);  // mavjudi joyida qoladi
  n.bolaklar = almash(n.bolaklar, j.bolaklar, id);
  n.butunlar = almash(n.butunlar, j.butunlar, (x) => x.profil_id + "|" + x.rang);
  n.firma = j.firma || n.firma;
  n.men = j.men || n.men;
  n.azolar = j.azolar || n.azolar;
  n.bloklar = j.bloklar || n.bloklar;
  n.gacha = Math.max(Number(n.gacha) || 0, Number(j.gacha) || 0);
  return n;
}
// Server nusxasi → sklad.js shakli (skGuruhlar, skJami, skRaskroyQatorlari oʻzgarmaydi). Faqat holat = bor boʻlaklar.
function skServerBaza(n) {
  const num = (x) => x == null ? null : Number(x);
  // profil tartibi — nusxadagi tartib (birinchi kelgan joyida; tahrir oxiriga surmaydi)
  const profillar = n.profillar.map((p) => ({ id: p.id, seriya: p.seriya_id, nom: p.nom, narx: num(p.narx), kod: p.raskroy_kod || null, versiya: p.versiya }));
  return {
    versiya: 1, server: true,
    seriyalar: n.seriyalar.map((s) => ({ id: s.id, nom: s.nom, hivich_sm: num(s.hivich_sm), versiya: s.versiya })),
    profillar,
    bolaklar: n.bolaklar.filter((x) => x.holat === "bor").map((x) => ({ id: x.id, raqam: x.raqam, profil: x.profil_id, rang: x.rang, sm: num(x.sm),
      sana: x.sana, manba: x.manba, holat: x.holat, versiya: x.versiya, ...(x.kutish ? { kutish: true } : {}) })),
    butunlar: n.butunlar.filter((x) => x.soni > 0).map((x) => ({ profil: x.profil_id, rang: x.rang, soni: x.soni })),
    keyingi_raqam: null, keyingi_id: null, ozgardi: null, jurnal: [],
  };
}
// Shu qurilma bloklaridan n ta boʻsh raqam (band — firmadagi hamma boʻlak raqami). Yetmasa null.
function sbRaqamlar(n, qurilma, kerak, qoshimcha) {
  const band = new Set([...n.bolaklar.map((x) => x.raqam), ...(qoshimcha || [])]);
  const r = [];
  const bloklar = n.bloklar.filter((b) => b.qurilma === qurilma).sort((a, b) => a.dan - b.dan);
  for (const b of bloklar) for (let i = b.dan; i <= b.gacha && r.length < kerak; i++) if (!band.has(i)) r.push(i);
  return r.length >= kerak ? r : null;
}
// Navbatdagi (hali serverga yetmagan) amallarni nusxa ustiga qoʻllash — koʻrinish uchun; nusxa oʻzi oʻzgarmaydi.
// Server qoidalari kabi: bir xil nomli seriya/profil — mavjudiga bogʻlanadi (keyingi amallar ham), butun 0 dan pastga tushmaydi.
function sbQollash(n, navbat) {
  const v = { ...n, seriyalar: n.seriyalar.map((x) => ({ ...x })), profillar: n.profillar.map((x) => ({ ...x })),
    bolaklar: n.bolaklar.map((x) => ({ ...x })), butunlar: n.butunlar.map((x) => ({ ...x })) };
  const ozid = new Map();  // navbatdagi id → mavjud id (birlashish)
  const id = (x) => ozid.get(x) || x;
  const bugun = new Date().toISOString().slice(0, 10);
  let oz = 1e15;
  for (const o of navbat || []) {
    const a = o.args || {};
    if (o.nom === "seriya_qosh") {
      const bor = v.seriyalar.find((s) => s.nom.toLowerCase() === String(a.p_nom).toLowerCase());
      if (bor) ozid.set(a.p_id, bor.id);
      else v.seriyalar.push({ id: a.p_id, nom: a.p_nom, hivich_sm: a.p_hivich, tartib: Math.max(0, ...v.seriyalar.map((s) => s.tartib || 0)) + 1, versiya: 1, kutish: true });
    } else if (o.nom === "seriya_tahrir") {
      const s = v.seriyalar.find((x) => x.id === id(a.p_id));
      if (s) { s.nom = a.p_nom; s.hivich_sm = a.p_hivich; s.versiya = (s.versiya || 1) + 1; }
    } else if (o.nom === "profil_qosh") {
      const sid = id(a.p_seriya);
      const bor = v.profillar.find((p) => p.seriya_id === sid && p.nom.toLowerCase() === String(a.p_nom).toLowerCase());
      if (bor) ozid.set(a.p_id, bor.id);
      else v.profillar.push({ id: a.p_id, seriya_id: sid, nom: a.p_nom, narx: a.p_narx, raskroy_kod: a.p_kod || null, versiya: 1, ozgarish: ++oz, kutish: true });
    } else if (o.nom === "profil_tahrir") {
      const p = v.profillar.find((x) => x.id === id(a.p_id));
      if (p) { p.nom = a.p_nom; p.narx = a.p_narx; p.raskroy_kod = a.p_kod || null; p.versiya = (p.versiya || 1) + 1; }
    } else if (o.nom === "bolak_qosh") {
      if ((a.p_idlar || []).some((x) => v.bolaklar.some((b) => b.id === x))) continue;  // server yozgan (javobi kelmagan) — ikki marta emas
      (a.p_raqamlar || []).forEach((r, i) => v.bolaklar.push({ id: a.p_idlar[i], raqam: r, profil_id: id(a.p_profil), rang: a.p_rang, sm: a.p_sm,
        holat: "bor", manba: "qoʻlda", sana: bugun, versiya: 1, kutish: true }));
    } else if (o.nom === "bolak_tahrir" || o.nom === "bolak_ochir" || o.nom === "bolak_qaytar") {
      const b = v.bolaklar.find((x) => x.id === a.p_id);
      if (!b) continue;
      if (o.nom === "bolak_tahrir") { b.sm = a.p_sm; b.rang = a.p_rang; }
      else b.holat = o.nom === "bolak_ochir" ? "ochirildi" : "bor";
      b.versiya = (b.versiya || 1) + 1; b.kutish = true;
    } else if (o.nom === "butun") {
      const pid = id(a.p_profil);
      let u = v.butunlar.find((x) => x.profil_id === pid && x.rang === a.p_rang);
      if (!u) { u = { profil_id: pid, rang: a.p_rang, soni: 0 }; v.butunlar.push(u); }
      u.soni = Math.max(0, u.soni + a.p_delta);
    }
  }
  return v;
}
// Yiqilgan amalga bogʻliq navbat amallari (u yaratgan yoki u tegadigan id ga tegadigan; zanjir boʻyicha)
function sbBogliq(qolgan, o) {
  const a = o.args || {};
  const yarat = (x) => x.nom === "bolak_qosh" ? x.args.p_idlar || [] : /^(seriya|profil)_qosh$/.test(x.nom) ? [x.args.p_id] : [];
  const yaratilgan = new Set(yarat(o));            // yaratilmagan obyekt — unga tegadigan hamma amal bogʻliq
  const tegilgan = new Set(a.p_id && !yaratilgan.size ? [a.p_id] : []);  // yiqilgan tahrir — faqat shu obyektning keyingi tahrirlari
  const bogliq = [], qol = [];
  for (const x of qolgan) {
    const b = x.args || {};
    if ([b.p_id, b.p_seriya, b.p_profil].some((y) => y && yaratilgan.has(y)) || (b.p_id && tegilgan.has(b.p_id) && !/_qosh$/.test(x.nom))) {
      bogliq.push(x);
      yarat(x).forEach((y) => yaratilgan.add(y));
    } else qol.push(x);
  }
  return { bogliq, qolgan: qol };
}
// Ziddiyat hal qilingach amallarni qayta navbatga: boʻlak versiyasi asosdan ketma-ket (tahrir/oʻchirish +1, qaytarish +1)
function sbVersiyala(ops, asos) {
  const v = { ...asos };
  return ops.map((o) => {
    const a = { ...o.args };
    if (a.p_id in v) {
      if (o.nom === "bolak_tahrir" || o.nom === "bolak_ochir" || o.nom === "profil_tahrir" || o.nom === "seriya_tahrir") a.p_versiya = v[a.p_id];
      v[a.p_id]++;
    }
    return { ...o, args: a };
  });
}
// Server mavjudiga bogʻlagan (birlashdi) id — navbatning qolgan qismida almashtiriladi
function sbZanjir(navbat, eski, yangi) {
  const K = ["p_id", "p_seriya", "p_profil"];
  return navbat.map((o) => {
    const a = { ...o.args };
    let v = false;
    for (const k of K) if (a[k] === eski && !(k === "p_id" && /_qosh$/.test(o.nom))) { a[k] = yangi; v = v || (k === "p_id" && /_tahrir$/.test(o.nom)); }
    return v ? { ...o, args: a, versiyaYangila: true } : { ...o, args: a };
  });
}

// Lokal sklad (sklad.js shakli) → kochir() yuki. uuid — yangi id beruvchi funksiya.
function skKochirYuk(b, uuid) {
  const sid = new Map(b.seriyalar.map((s) => [s.id, uuid()]));
  const pid = new Map(b.profillar.map((p) => [p.id, uuid()]));
  return {
    keyingi_raqam: b.keyingi_raqam,
    seriyalar: b.seriyalar.map((s) => ({ id: sid.get(s.id), nom: s.nom, hivich_sm: s.hivich_sm,
      profillar: b.profillar.filter((p) => p.seriya === s.id).map((p) => ({ id: pid.get(p.id), nom: p.nom, narx: p.narx, kod: p.kod || "",
        bolaklar: b.bolaklar.filter((x) => x.profil === p.id).map((x) => [uuid(), x.raqam, x.rang, x.sm, x.sana]),
        butunlar: b.butunlar.filter((x) => x.profil === p.id).map((x) => [x.rang, x.soni]) })) })),
  };
}
// Server xatosi / ziddiyat → odam tushunadigan matn (docs/server.md "Ziddiyatlar")
function sbZiddiyatMatn(z, raqam) {
  const S = raqam ? `S-${raqam}` : "Bu yozuv";
  const kim = z.kim && z.kim.kim ? ` (${z.kim.kim})` : "";
  switch (z.tur) {
    case "versiya": return z.narx !== undefined ? `Narxni boshqa odam ${z.narx} $ qilgan${kim} — sahifa yangilandi, qayta tekshiring`
      : `${S} ni boshqa odam oʻzgartirgan${kim} — sahifa yangilandi, qayta tekshiring`;
    case "holat": return `${S} hozir: ${z.holat === "ochirildi" ? "oʻchirilgan" : z.holat === "ishlatildi" ? "ishlatilgan" : z.holat}${z.kim ? ` (${z.kim})` : ""}`;
    case "butun": return `Butun hivich ${z.soni} ta qolgan — yozilmadi`;
    case "uzun_bolak": return `S-${z.raqam} yangi hivichdan uzun — avval uni tuzating`;
    case "nom_band": return `“${z.nom}” nomi band`;
    case "raqam_band": return "Raqam band — qayta urinib koʻring";
    default: return "Ziddiyat: " + JSON.stringify(z);
  }
}

if (typeof module !== "undefined") module.exports = { sbTelefon, sbEmail, sbChiroyli, sbBoshNusxa, sbBirlashtir, skServerBaza, sbRaqamlar, skKochirYuk, sbZiddiyatMatn, sbQollash, sbZanjir, sbBogliq, sbVersiyala };

// ======================= brauzerda =======================
if (typeof window !== "undefined") (function () {
  const ok = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const oz = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const uuid = () => crypto.randomUUID();
  // Sinov: faqat localhost da boshqa server (soxta_server.mjs)
  const sinov = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && ok("sb_sinov_url");
  const URLB = sinov || SB_URL;
  const ANON = sinov ? "sinov" : SB_ANON;

  class SbXato extends Error { constructor(m, st, kod) { super(m); this.st = st; this.kod = kod; } }
  const sessiya = () => { try { return JSON.parse(ok("sb_sessiya") || "null"); } catch (e) { return null; } };
  // Muddat telefon soatidan: expires_in (server soati notoʻgʻri boʻlsa ham har soʻrovda yangilanmasin)
  const sessiyaSaqla = (s, eski) => oz("sb_sessiya", s ? JSON.stringify({ access: s.access_token, refresh: s.refresh_token,
    tugash: Math.floor(Date.now() / 1000) + (Number(s.expires_in) || 3600), tel: (eski && eski.tel) || s.tel,
    uid: (s.user && s.user.id) || (eski && eski.uid) }) : null);
  function qurilma() {
    let q = ok("sb_qurilma");
    if (!q) { q = uuid(); oz("sb_qurilma", q); }
    return q;
  }

  async function sorov(yol, body, token) {
    let r;
    try {
      r = await fetch(URLB + yol, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json",
        Authorization: "Bearer " + (token || ANON) }, body: JSON.stringify(body || {}) });
    } catch (e) { throw new SbXato("Internet yoʻq", 0, "tarmoq"); }
    let t;
    try { t = await r.text(); } catch (e) { throw new SbXato("Internet uzildi", 0, "tarmoq"); }  // javob yarmida uzildi
    let j = null;
    try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new SbXato((j && (j.message || j.msg || j.error_description)) || `Server xatosi ${r.status}`, r.status, j && (j.error_code || j.code || j.error));
    return j;
  }
  const nomalum = (e) => !e.st || e.st >= 500 || [404, 408, 425, 429].includes(e.st) || /PGRST2/.test(e.kod || e.message || "");  // javob kelmadi — server yozgan-yozmagani nomaʼlum
  function authMatn(e) {
    const k = e.kod || "";
    if (k === "invalid_credentials" || k === "invalid_grant" || /Invalid login/i.test(e.message)) return "Telefon yoki parol notoʻgʻri";
    if (k === "user_already_exists" || /already registered/i.test(e.message)) return "Bu raqam roʻyxatdan oʻtgan — “Kirish” ni bosing";
    if (k === "weak_password" || /Password should/i.test(e.message)) return "Parol kamida 6 belgi";
    if (k === "over_request_rate_limit" || e.st === 429) return "Urinish koʻp — biroz kutib qayta urining";
    if (!e.st) return "Internet yoʻq";
    return e.message;
  }
  async function kirish(tel, parol, yangi) {
    const t = sbTelefon(tel);
    if (!t) throw new SbXato("Telefon raqam: +998 va 9 raqam");
    if (String(parol || "").length < 6) throw new SbXato("Parol kamida 6 belgi");
    let s;
    try {
      s = await sorov(yangi ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password", { email: sbEmail(t), password: parol });
    } catch (e) { throw new SbXato(authMatn(e), e.st, e.kod); }
    if (!s || !s.access_token) throw new SbXato("Roʻyxatdan oʻtib boʻlmadi (server email tasdiqlashni soʻrayapti)");
    s.tel = t;
    const eskiUid = ok("sb_oxirgi_uid");
    sessiyaSaqla(s);
    // boshqa hisob kirdi — oldingi nusxa va javobsiz amal qolmasin
    if (eskiUid !== sessiya().uid) { oz("sklad_server", null); oz("sb_kutish", null); }
    oz("sb_oxirgi_uid", sessiya().uid);
    oz("sb_bir_kirgan", "1");
    return t;
  }
  let yangilanish = null;
  function yangila() {
    if (!yangilanish) yangilanish = (async () => {
      const s = sessiya();
      if (!s) throw new SbXato("Kirish kerak", 401);
      try {
        const j = await sorov("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh });
        sessiyaSaqla(j, s);
      } catch (e) {
        if (e.st === 400 || e.st === 401 || e.st === 403) { sessiyaSaqla(null); throw new SbXato("Sessiya tugadi — qayta kiring", 401); }
        throw e;  // internet yoʻq — sessiya qoladi
      }
    })().finally(() => { yangilanish = null; });
    return yangilanish;
  }
  async function rpc(nom, args) {
    let s = sessiya();
    if (!s) throw new SbXato("Kirish kerak", 401);
    if (s.tugash - 60 < Date.now() / 1000) { await yangila(); s = sessiya(); }
    try { return await sorov("/rest/v1/rpc/" + nom, args, s.access); }
    catch (e) {
      if (e.st !== 401) throw e;
      await yangila();
      return sorov("/rest/v1/rpc/" + nom, args, sessiya().access);
    }
  }
  function chiq() {
    const s = sessiya();
    if (s) sorov("/auth/v1/logout", {}, s.access).catch(() => {});
    sessiyaSaqla(null); tozala();  // navbat oʻchmaydi: shu hisob qayta kirsa yuboriladi
  }

  // ---------- sklad nusxasi (hisob va firmaga bogʻlangan) ----------
  const nusxa = () => {
    try {
      const n = JSON.parse(ok("sklad_server") || "null"), s = sessiya();
      return n && s && n.men && n.men.user_id === s.uid ? n : null;
    } catch (e) { return null; }
  };
  const nusxaSaqla = (n) => { if (!oz("sklad_server", JSON.stringify(n))) throw new SbXato("Telefon xotirasi toʻldi"); };
  function tozala() { oz("sklad_server", null); }
  // Navbat yuborilayotganda serverdan tortish kutadi (javobi kelmagan amal ikki marta koʻrinmasin)
  async function torting() {
    if (sinxronda) await sinxronda.catch(() => {});
    return tortingQulfsiz();
  }
  async function tortingQulfsiz() {
    let n = nusxa() || sbBoshNusxa();
    let j = await rpc("ozgarishlar", { p_dan: n.gacha });
    if (n.firma && (!j.firma || j.firma.id !== n.firma.id)) {  // firma almashgan — boshidan
      n = sbBoshNusxa();
      j = await rpc("ozgarishlar", { p_dan: 0 });
    }
    sbBirlashtir(n, j);
    nusxaSaqla(n);
    return n;
  }

  // ---------- yozish: oflayn navbat (c-qadam, docs/server.md "Navbat") ----------
  // Har amal avval "sb_navbat" ga yoziladi (op_id bilan), keyin sinxron() yuboradi. Server bir op_id ni ikki marta yozmaydi.
  // Koʻrinish = server nusxasi + navbat (sbQollash). Ziddiyat → "sb_ziddiyat" (oyna bilan hal qilinadi).
  const NAVBAT_AMAL = new Set(["bolak_qosh", "bolak_tahrir", "bolak_ochir", "bolak_qaytar", "butun", "seriya_qosh", "seriya_tahrir", "profil_qosh", "profil_tahrir"]);
  const oqiJ = (k) => { try { return JSON.parse(ok(k) || "[]"); } catch (e) { return []; } };
  const meniki = (x) => { const s = sessiya(); return !!s && x.uid === s.uid; };
  const navbat = () => oqiJ("sb_navbat").filter(meniki);
  const ziddiyatlar = () => oqiJ("sb_ziddiyat").filter(meniki);
  const yuborilmadi = () => oqiJ("sb_yuborilmadi").filter(meniki);
  function royxatSaqla(k, mening) {  // boshqa hisoblarning yozuvlari tegilmaydi
    const boshqa = oqiJ(k).filter((x) => !meniki(x));
    if (!oz(k, JSON.stringify([...boshqa, ...mening]))) throw new SbXato("Telefon xotirasi toʻldi — amal saqlanmadi");
  }
  // b-qadamdagi "sb_kutish" — navbat boshiga
  (function () {
    const k = (() => { try { return JSON.parse(ok("sb_kutish") || "null"); } catch (e) { return null; } })();
    if (k && k.args && NAVBAT_AMAL.has(k.nom)) {
      const hamma = oqiJ("sb_navbat");
      if (!hamma.some((x) => x.op === k.args.p_op)) oz("sb_navbat", JSON.stringify([{ op: k.args.p_op, nom: k.nom, args: k.args, uid: k.uid, vaqt: k.vaqt }, ...hamma]));
    }
    oz("sb_kutish", null);
  })();

  // Markerda yozilgan boʻlishi mumkin boʻlgan hamma raqam — hech qachon qayta berilmaydi (ziddiyat yoki yuborilmagan boʻlsa ham)
  function ishlatilgan() { const n = nusxa(); const m = (() => { try { return JSON.parse(ok("sb_raqam_ishlatilgan") || "{}"); } catch (e) { return {}; } })(); return (n && n.firma && m[n.firma.id]) || []; }
  function ishlatildi(r) {
    const n = nusxa(); if (!n || !n.firma) return;
    let m = {}; try { m = JSON.parse(ok("sb_raqam_ishlatilgan") || "{}"); } catch (e) {}
    m[n.firma.id] = [...new Set([...(m[n.firma.id] || []), ...r])];
    oz("sb_raqam_ishlatilgan", JSON.stringify(m));
  }
  const bandQosh = () => [...ishlatilgan(), ...ziddiyatlar().concat(yuborilmadi()).flatMap((z) => [z, ...(z.bogliq || [])]).filter((x) => x.nom === "bolak_qosh").flatMap((x) => x.args.p_raqamlar)];
  let kuzatuvchi = () => {};
  const xabarla = () => { try { kuzatuvchi(); } catch (e) {} };
  // Amal matni (roʻyxat va ziddiyat oynasi uchun)
  function amalMatn(o, b) {
    const a = o.args, bol = b && a.p_id && b.bolaklar.find((x) => x.id === a.p_id);
    const S = bol ? `S-${bol.raqam}` : "";
    switch (o.nom) {
      case "bolak_qosh": return `Qoʻshish ${a.p_raqamlar.map((r) => "S-" + r).join(", ")} · ${a.p_sm} sm · ${a.p_rang}`;
      case "bolak_tahrir": return `${S || "Boʻlak"} → ${a.p_sm} sm · ${a.p_rang}`;
      case "bolak_ochir": return `${S || "Boʻlak"} oʻchirish`;
      case "bolak_qaytar": return `${S || "Boʻlak"} qaytarish`;
      case "butun": return `Butun hivich ${a.p_delta > 0 ? "+" : ""}${a.p_delta} · ${a.p_rang}`;
      case "profil_qosh": return `Profil “${a.p_nom}”`;
      case "profil_tahrir": return `Profil “${a.p_nom}” · ${a.p_narx == null ? "narxsiz" : a.p_narx + " $"}`;
      case "seriya_qosh": return `Seriya “${a.p_nom}”`;
      case "seriya_tahrir": return `Seriya “${a.p_nom}” · hivich ${a.p_hivich}`;
      default: return o.nom;
    }
  }
  // Server mavjudiga bogʻlagan id lar (eski → yangi): keyingi amallar va ekran shu xarita orqali
  const birlashgan = () => { try { return JSON.parse(ok("sb_birlashgan") || "{}"); } catch (e) { return {}; } };
  const idX = (x) => { const m = birlashgan(); let i = 0; while (x && m[x] && i++ < 10) x = m[x]; return x; };
  function qosh(nom, args) {
    const s = sessiya();
    if (!s) throw new SbXato("Kirish kerak", 401);
    args = { ...args };
    for (const k of ["p_seriya", "p_profil", "p_id"]) if (args[k] && !(k === "p_id" && /_qosh$/.test(nom))) args[k] = idX(args[k]);
    const o = { op: uuid(), nom, args: { p_op: null, ...args }, uid: s.uid, vaqt: Date.now() };
    o.args.p_op = o.op;
    royxatSaqla("sb_navbat", [...navbat(), o]);
    xabarla();
    return o;
  }
  const onlayn = () => typeof navigator === "undefined" || navigator.onLine !== false;
  let sinxronda = null, holat = "";  // "" | "oflayn" | "kirish"
  // Navbatni ketma-ket yuboradi. Qaytaradi: {yuborildi, qoldi, ziddiyat}
  function sinxron() {
    if (!sinxronda) sinxronda = (async () => {
      let yuborildi = 0, ziddiyat = 0;
      try {
        for (;;) {
          const nb = navbat();
          if (!nb.length) break;
          let o = nb[0];
          if (o.versiyaYangila) {  // birlashgan obyekt: versiya serverdagi
            const n = nusxa(), t = n && [...n.seriyalar, ...n.profillar].find((x) => x.id === o.args.p_id);
            o = { ...o, versiyaYangila: false, args: { ...o.args, p_versiya: t ? t.versiya : o.args.p_versiya } };
            royxatSaqla("sb_navbat", navbat().map((x) => x.op === o.op ? o : x));
          }
          let j;
          try { j = await rpc(o.nom, o.args); }
          catch (e) {
            if (nomalum(e)) { holat = "oflayn"; break; }
            if (e.st === 401) { holat = "kirish"; break; }
            if (e.st === 403 && /aʼzosi emas/.test(e.message)) {  // chiqarilgan: hamma navbat yuborilmadi
              royxatSaqla("sb_yuborilmadi", [...yuborilmadi(), ...nb.map((x) => ({ ...x, xato: e.message }))]);
              royxatSaqla("sb_navbat", []);
              tozala(); holat = ""; break;
            }
            if (/blokingizda emas/.test(e.message) && o.nom === "bolak_qosh" && !o.blokQayta) {  // eski blok — yangi raqamlar
              await yangiRaqam(o, nb, "blok"); continue;
            }
            j = { xato: e.message };  // boshqa 4xx — ziddiyat roʻyxatiga matn bilan
          }
          holat = "";
          let qolgan = navbat().filter((x) => x.op !== o.op);
          if (j && j.ziddiyat && j.ziddiyat.tur === "raqam_band" && o.nom === "bolak_qosh") { await yangiRaqam(o, navbat(), "band"); continue; }
          if (j && (j.ziddiyat || j.xato)) {  // bogʻliq amallar ham toʻxtaydi va shu oynada hal qilinadi
            const bq = sbBogliq(qolgan, o);
            qolgan = bq.qolgan;
            royxatSaqla("sb_ziddiyat", [...ziddiyatlar(), { ...o, javob: j, bogliq: bq.bogliq }]);
            ziddiyat++;
          } else {
            yuborildi++;
            if (j && j.birlashdi && j.id && j.id !== o.args.p_id) {  // server mavjudiga bogʻladi — zanjir
              qolgan = sbZanjir(qolgan, o.args.p_id, j.id);
              oz("sb_birlashgan", JSON.stringify({ ...birlashgan(), [o.args.p_id]: j.id }));
              await tortingQulfsiz().catch(() => {});
              if (/^(seriya|profil)_qosh$/.test(o.nom)) royxatSaqla("sb_ziddiyat", [...ziddiyatlar(), { ...o, javob: { malumot: `“${o.args.p_nom}” bor edi — shunga bogʻlandi` } }]);
            }
          }
          royxatSaqla("sb_navbat", qolgan);
          xabarla();
        }
        if (holat !== "oflayn" && holat !== "kirish") { await tortingQulfsiz().catch(() => {}); await blokTayyorla().catch(() => {}); }
      } finally { sinxronda = null; xabarla(); }
      return { yuborildi, qoldi: navbat().length, ziddiyat };
    })();
    return sinxronda;
  }
  // band yoki eski blok raqami — yangi raqamlar (S-raqam markerda yozilgan boʻlishi mumkin: ogohlantiriladi)
  async function yangiRaqam(o, nb, sabab) {
    const eski = o.args.p_raqamlar;
    const v = sbQollash(nusxa() || sbBoshNusxa(), nb.filter((x) => x.op !== o.op));
    const band = [...bandQosh(), ...eski];
    let r = sbRaqamlar(v, qurilma(), eski.length, band);
    if (!r) { await rpc("raqam_zaxira", { p_n: Math.max(SB_BLOK, eski.length), p_qurilma: qurilma() }); await tortingQulfsiz(); r = sbRaqamlar(sbQollash(nusxa(), nb.filter((x) => x.op !== o.op)), qurilma(), eski.length, band); }
    if (!r) throw new SbXato("Raqam bloki olinmadi");
    ishlatildi(r);
    const yangi = { ...o, op: uuid(), blokQayta: true, args: { ...o.args, p_raqamlar: r } };
    yangi.args.p_op = yangi.op;
    royxatSaqla("sb_navbat", navbat().map((x) => x.op === o.op ? yangi : x));
    royxatSaqla("sb_ziddiyat", [...ziddiyatlar(), { ...yangi, javob: { malumot: `${eski.map((x) => "S-" + x).join(", ")} raqami ${sabab === "band" ? "band edi" : "eskirgan edi"} — boʻlakka ${r.map((x) => "S-" + x).join(", ")} deb yozing` } }]);
  }
  // Oflayn qoʻshish uchun: shu qurilmada boʻsh raqam kam boʻlsa — oldindan blok
  async function blokTayyorla() {
    const n = nusxa();
    if (!n || !n.firma || !n.seriyalar.length || !onlayn()) return;  // koʻchirishgacha blok olinmaydi (kochir bloklarni oʻchiradi)
    if (!sbRaqamlar(sbQollash(n, navbat()), qurilma(), 30, bandQosh())) { await rpc("raqam_zaxira", { p_n: SB_BLOK, p_qurilma: qurilma() }); await tortingQulfsiz(); }
  }
  // Yozish: navbatga + darhol yuborishga urinish. Qaytaradi: server javobi yoki {navbatda: true}
  async function yoz(nom, args) {
    const o = qosh(nom, args);
    await sinxron().catch(() => {});
    return natija(o);
  }
  function natija(o) {
    if (navbat().some((x) => x.op === o.op)) return { navbatda: true };
    const z = ziddiyatlar().find((x) => (x.op === o.op && (x.javob.ziddiyat || x.javob.xato)) || (x.bogliq || []).some((y) => y.op === o.op));
    if (z && z.op !== o.op) throw new SbXato(`${amalMatn(o, null)} — yozilmadi: oldingi amal ziddiyatda (${amalMatn(z, null)})`, 409, "ziddiyat");
    if (z) throw new SbXato(z.javob.xato || sbZiddiyatMatn(z.javob.ziddiyat), 409, "ziddiyat");
    return { ok: true };
  }
  async function bolakQosh(profil, rang, sm, soni) {
    const v = sbQollash(nusxa() || sbBoshNusxa(), navbat());
    let r = sbRaqamlar(v, qurilma(), soni, bandQosh());
    if (!r) {
      if (!onlayn()) throw new SbXato("Raqam tugadi — internetga ulaning (yangi raqamlar serverdan olinadi)");
      await rpc("raqam_zaxira", { p_n: Math.max(SB_BLOK, soni), p_qurilma: qurilma() });
      await torting();
      r = sbRaqamlar(sbQollash(nusxa(), navbat()), qurilma(), soni, bandQosh());
      if (!r) throw new SbXato("Raqam bloki olinmadi");
    }
    ishlatildi(r);
    const o = qosh("bolak_qosh", { p_profil: profil, p_rang: rang, p_sm: sm, p_raqamlar: r, p_idlar: r.map(() => uuid()) });
    await sinxron().catch(() => {});
    // band boʻlib yangi raqam berilgan boʻlsa — yangisini qaytaramiz
    const q = navbat().find((x) => x.op === o.op) || null;
    const zb = ziddiyatlar().find((x) => x.args && x.args.p_idlar && x.args.p_idlar[0] === o.args.p_idlar[0] && x.javob.malumot);
    const raq = (zb && zb.args.p_raqamlar) || (q && q.args.p_raqamlar) || r;
    natija(o);
    return { raqamlar: raq, navbatda: !!q };
  }
  // Navbatga tushmaydigan amallar (koʻchirish, namuna): onlayn, op_id bilan
  async function togri(nom, args) {
    const j = await rpc(nom, { p_op: uuid(), ...args });
    await torting().catch(() => {});
    await blokTayyorla().catch(() => {});  // oflayn qoʻshish uchun raqamlar oldindan
    if (j && j.ziddiyat) throw new SbXato(sbZiddiyatMatn(j.ziddiyat), 409, "ziddiyat");
    return j;
  }
  // Ziddiyatni hal qilish. tanlov: "ok" | "uniki" | "meniki" | "qaytar" | "bekor"
  async function hal(op, tanlov) {
    const z = ziddiyatlar().find((x) => x.op === op);
    if (!z) return;
    const zd = (z.javob && z.javob.ziddiyat) || {};
    const serverV = zd.bolak ? zd.bolak.versiya : zd.versiya;
    const id = z.args.p_id;
    let yangi = [];
    if (tanlov === "meniki") yangi = sbVersiyala([z, ...(z.bogliq || [])], { [id]: serverV });
    else if (tanlov === "qaytar") yangi = sbVersiyala([{ nom: "bolak_qaytar", args: { p_id: id }, uid: z.uid }, z, ...(z.bogliq || [])], { [id]: serverV });
    // "uniki" / "ok" / "bekor": bogʻliqlari ham yozilmaydi (oynada koʻrsatilgan)
    yangi = yangi.map((x) => { const o = { ...x, op: uuid(), vaqt: Date.now(), versiyaYangila: false }; o.args = { ...x.args, p_op: o.op }; return o; });
    royxatSaqla("sb_navbat", [...yangi, ...navbat()]);
    ziddiyatOchir(op);
    if (yangi.length) await sinxron().catch(() => {});
  }
  // Boshqa hisobning shu telefonda qolgan yuborilmagan amallari (oʻchirilmaydi)
  const boshqaNavbat = () => oqiJ("sb_navbat").filter((x) => !meniki(x));
  function ziddiyatOchir(op) { royxatSaqla("sb_ziddiyat", ziddiyatlar().filter((x) => x.op !== op)); xabarla(); }
  function yuborilmadiTozala() { royxatSaqla("sb_yuborilmadi", []); xabarla(); }
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => { if (sessiya()) sinxron().catch(() => {}); });
    setInterval(() => { if (sessiya() && onlayn() && navbat().length && !document.hidden) sinxron().catch(() => {}); }, 30000);
  }

  window.SB = {
    SbXato, sessiya, kirish, chiq, rpc, torting, yoz, nusxa, tozala, bolakQosh, qurilma, authMatn,
    navbat, ziddiyatlar, yuborilmadi, sinxron, qosh, amalMatn, ziddiyatOchir, yuborilmadiTozala, togri, hal, boshqaNavbat,
    holat: () => holat, onlayn, id: idX,
    kuzat: (fn) => { kuzatuvchi = fn; },
    baza: () => { const n = nusxa(); return n && n.firma ? skServerBaza(sbQollash(n, navbat())) : null; },
    kirgan: () => !!sessiya(),
    birKirgan: () => ok("sb_bir_kirgan") === "1",
  };
})();
