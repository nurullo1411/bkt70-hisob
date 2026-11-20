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
      sana: x.sana, manba: x.manba, holat: x.holat, versiya: x.versiya })),
    butunlar: n.butunlar.filter((x) => x.soni > 0).map((x) => ({ profil: x.profil_id, rang: x.rang, soni: x.soni })),
    keyingi_raqam: null, keyingi_id: null, ozgardi: null, jurnal: [],
  };
}
// Shu qurilma bloklaridan n ta boʻsh raqam (band — firmadagi hamma boʻlak raqami). Yetmasa null.
function sbRaqamlar(n, qurilma, kerak) {
  const band = new Set(n.bolaklar.map((x) => x.raqam));
  const r = [];
  const bloklar = n.bloklar.filter((b) => b.qurilma === qurilma).sort((a, b) => a.dan - b.dan);
  for (const b of bloklar) for (let i = b.dan; i <= b.gacha && r.length < kerak; i++) if (!band.has(i)) r.push(i);
  return r.length >= kerak ? r : null;
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

if (typeof module !== "undefined") module.exports = { sbTelefon, sbEmail, sbChiroyli, sbBoshNusxa, sbBirlashtir, skServerBaza, sbRaqamlar, skKochirYuk, sbZiddiyatMatn };

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
  const nomalum = (e) => !e.st || e.st >= 500;  // javob kelmadi — server yozgan-yozmagani nomaʼlum
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
    sessiyaSaqla(null); tozala(); oz("sb_kutish", null);
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
  async function torting() {
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

  // ---------- yozish ----------
  // Javobi kelmagan amal "sb_kutish" da qoladi va xuddi shu op_id bilan qayta yuboriladi (server ikkinchi marta yozmaydi).
  // Shunday amal bor ekan, yangi yozish boshlanmaydi — usta qayta bosib ikkinchi boʻlak yaratmasin.
  const kutish = () => { try { const k = JSON.parse(ok("sb_kutish") || "null"); return k && sessiya() && k.uid === sessiya().uid ? k : null; } catch (e) { return null; } };
  async function yubor(nom, args) {
    const k = { uid: sessiya() && sessiya().uid, nom, args, vaqt: Date.now() };
    oz("sb_kutish", JSON.stringify(k));
    try {
      const j = await rpc(nom, args);
      oz("sb_kutish", null);
      return j;
    } catch (e) {
      if (!nomalum(e)) oz("sb_kutish", null);
      else throw new SbXato("Internet yoʻq — amal javobsiz qoldi. Internet kelganda “Yangilash” ni bosing, oʻzi tekshiriladi", 0, "kutish");
      throw e;
    }
  }
  // Javobsiz amalni qayta yuborish. Qaytaradi: {nom, javob} yoki null
  async function kutganiniYubor() {
    const k = kutish();
    if (!k) { oz("sb_kutish", null); return null; }
    const j = await yubor(k.nom, k.args);
    return { nom: k.nom, javob: j, args: k.args };
  }
  // Javobsiz amal bor: avval u yuboriladi va yangi amal BOSHLANMAYDI (usta qayta bosgan boʻlishi mumkin — ikkinchi boʻlak boʻlmasin)
  function kutishMatn(k) {
    if (!k) return "Oldingi amal tekshirildi";
    const j = k.javob || {};
    if (j.ziddiyat) return "Oldingi (javobsiz qolgan) amal yozilmadi: " + sbZiddiyatMatn(j.ziddiyat);
    if (k.nom === "bolak_qosh") return `Oldingi amal saqlandi: ${k.args.p_raqamlar.map((r) => "S-" + r).join(", ")} — boʻlakka markerda yozing`;
    return "Oldingi (javobsiz qolgan) amal saqlandi";
  }
  async function oldin() {
    if (!kutish()) return;
    const k = await kutganiniYubor();
    await torting().catch(() => {});
    throw new SbXato(kutishMatn(k) + " — yangi amal bajarilmadi, kerak boʻlsa qayta bosing", 409, "oldingi");
  }
  async function yoz(nom, args, raqam) {
    await oldin();
    const j = await yubor(nom, { p_op: uuid(), ...args });
    await torting().catch(() => {});
    if (j && j.ziddiyat) throw new SbXato(sbZiddiyatMatn(j.ziddiyat, raqam), 409, "ziddiyat");
    return j;
  }
  async function raqamOl(kerak, yangiBlok) {
    let n = nusxa() || await torting();
    let r = yangiBlok ? null : sbRaqamlar(n, qurilma(), kerak);
    if (!r) {
      await rpc("raqam_zaxira", { p_n: Math.max(SB_BLOK, kerak), p_qurilma: qurilma() });
      n = await torting();
      r = sbRaqamlar(n, qurilma(), kerak);
    }
    if (!r) throw new SbXato("Raqam bloki olinmadi");
    return r;
  }
  async function bolakQosh(profil, rang, sm, soni) {
    await oldin();
    await torting().catch(() => {});  // band raqamlar yangi boʻlsin
    for (let urinish = 0; urinish < 2; urinish++) {
      const raqamlar = await raqamOl(soni, urinish > 0);
      let j;
      try {
        j = await yubor("bolak_qosh", { p_op: uuid(), p_profil: profil, p_rang: rang, p_sm: sm, p_raqamlar: raqamlar, p_idlar: raqamlar.map(() => uuid()) });
      } catch (e) {
        if (!urinish && /blokingizda emas/.test(e.message)) { await torting().catch(() => {}); continue; }  // eski blok (koʻchirishda oʻchgan)
        throw e;
      }
      await torting().catch(() => {});
      if (j && j.ziddiyat && j.ziddiyat.tur === "raqam_band" && !urinish) continue;
      if (j && j.ziddiyat) throw new SbXato(sbZiddiyatMatn(j.ziddiyat), 409, "ziddiyat");
      return raqamlar;
    }
    throw new SbXato("Raqam band — qayta urinib koʻring");
  }

  window.SB = {
    SbXato, sessiya, kirish, chiq, rpc, kutishMatn, torting, yoz, nusxa, tozala, bolakQosh, qurilma, authMatn, kutish, kutganiniYubor,
    baza: () => { const n = nusxa(); return n && n.firma ? skServerBaza(n) : null; },
    kirgan: () => !!sessiya(),
    birKirgan: () => ok("sb_bir_kirgan") === "1",
  };
})();
