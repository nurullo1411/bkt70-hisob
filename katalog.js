// Katalog (foydalanuvchi, 2026-11-09, Romchi kabi): papkalar — Oynalar (1-bosqich), Akfa (keyin).
// Maʼlumot Sheets "bkt 70 hisoblash" Narxlar varagʻida; ilova faqat rahbar kaliti bilan yozadi (Apps Script doPost).
// Oʻchirish yoʻq — yashiriladi: tanlovda chiqmaydi, eski zakazlarda nomi va narxi qoladi.

// Rahbar havolasi: …/#y=<kalit>. Kalit telefonda qoladi, havoladan oʻchiriladi.
(function () {
  const m = location.hash.match(/y=([0-9a-f]{32,})/);
  if (!m) return;
  try { localStorage.setItem("katalog_kalit", m[1]); } catch (e) {}
  history.replaceState(null, "", location.pathname);
})();

const katalogYozadi = () => !!ol("katalog_kalit");
let katalogPapka = "oyna", katalogForma = null, katalogTasdiq = null;

function katalogNarxlar() { try { return JSON.parse(ol("narxlar")) || {}; } catch (e) { return {}; } }
function katalogQalinliklar(n) {
  const s = new Set();
  for (const t of Object.values(n.steklopaket_m2 || {})) Object.keys(t).forEach((q) => s.add(q));
  for (const t of Object.values(n.steklopaket_som || {})) Object.keys(t).forEach((q) => s.add(q));
  return [...s].sort((a, b) => a - b);
}

async function katalogYoz(d) {
  const url = await shifrliOch("sklad.enc");
  if (!url) throw new Error("Sheets ulanmagan (narx havolasi ochilmagan)");
  const c = new AbortController(), t = setTimeout(() => c.abort(), 30000);
  try {
    const j = await fetch(url.split("?")[0], { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...d, y: ol("katalog_kalit") }), signal: c.signal }).then((r) => r.json());
    if (!j || j.xato) throw new Error(j && j.xato === "nomaʼlum amal" ? "Skript eski versiyada — yangisini joylashtiring" : (j && j.xato) || "javob yoʻq");
    return j;
  } catch (e) {
    if (e.name === "AbortError" || e instanceof TypeError) throw new Error("Sheets ga ulanib boʻlmadi: internetni tekshiring");
    throw e;
  } finally { clearTimeout(t); }
}

function katalogChiz() {
  const n = katalogNarxlar(), q = katalogQalinliklar(n), yash = new Set(n.oyna_yashirin || []);
  const turlar = Object.keys(n.steklopaket_som || {});
  const papka = (id, nom, son_) => `<button data-kp="${id}" class="${katalogPapka === id ? "faol" : ""}">${nom}${son_ != null ? ` <span class="xira">${son_}</span>` : ""}</button>`;
  let s = `<div class="seg">${papka("oyna", "🪟 Oynalar", turlar.length - yash.size)}${papka("akfa", "🧱 Akfa")}</div>`;
  if (katalogPapka === "akfa") {
    $("katalog-ich").innerHTML = s + `<section class="karta"><p class="xira">Akfa papkasi keyingi bosqichda: profillar, aksessuar, furnitura va rezina narxlari shu yerda koʻrinadi.</p></section>`;
    return;
  }
  const narxMatn = (t) => q.filter((x) => n.steklopaket_som[t][x] != null).map((x) => `<span class="nowrap">${x} mm: <b>${som(n.steklopaket_som[t][x])}</b></span>`).join(" · ") || "narx yoʻq";
  const gul = (o) => (o.toLowerCase().includes("gul") ? ";background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 7px)" : "");
  const qator = (t, y) => `<div class="kt-qator${y ? " yashirin" : ""}"><span class="namuna" style="background:${oynaRangi(t)}${gul(t)}"></span>
      <div class="kt-nom"><b>${esc(t)}</b><small>${narxMatn(t)} · 1 m²</small></div>
      ${katalogYozadi() ? (y ? `<button class="kichik-t" data-kt="qaytar" data-nom="${esc(t)}">Qaytarish</button>`
        : `<button class="kichik-t" data-kt="tahrir" data-nom="${esc(t)}" aria-label="Narxni oʻzgartirish">✏️</button><button class="kichik-t${katalogTasdiq === t ? " xavf" : ""}" data-kt="yashir" data-nom="${esc(t)}">${katalogTasdiq === t ? "Yashirilsinmi?" : "Yashirish"}</button>`) : ""}</div>`;
  s += `<section class="karta"><h2>Oyna turlari</h2><p class="xira">1 m² narxi soʻmda, qalinlik boʻyicha. Narx Sheets (Narxlar) dan; oʻzgarsa hamma zakazda yangilanadi.</p>
    ${turlar.filter((t) => !yash.has(t)).map((t) => qator(t, false)).join("") || '<p class="xira">Roʻyxat boʻsh</p>'}`;
  if (katalogYozadi()) {
    if (katalogForma) {
      const f = katalogForma, eski = f.yangi ? {} : n.steklopaket_som[f.nom] || {};
      s += `<div class="kt-forma"><div class="sarlavha">${f.yangi ? "Yangi oyna turi" : "Narxni oʻzgartirish: " + esc(f.nom)}</div>
        ${f.yangi ? `<label>Nomi<input id="kt-nom" type="text" maxlength="40" placeholder="masalan Oq+bronza"></label>` : ""}
        ${q.map((x) => `<label>${x} mm, 1 m² (soʻm)<input data-kt-narx="${x}" type="number" inputmode="numeric" min="0" step="1000" value="${eski[x] ?? ""}" placeholder="boʻsh — bu qalinlik yoʻq"></label>`).join("")}
        <div class="tugmalar"><button class="tugma" data-kt="bekor">Bekor</button><button class="tugma asosiy" data-kt="saqla">Saqlash</button></div></div>`;
    } else s += `<button class="tugma asosiy" data-kt="yangi">+ Oyna turi qoʻshish</button>`;
  } else s += `<p class="xira">Oʻzgartirish faqat rahbar telefonida (katalog havolasi bilan).</p>`;
  s += `</section>`;
  if (yash.size) s += `<details class="karta"><summary>Yashirilgan (${yash.size}) — tanlovda chiqmaydi, eski zakazlarda qoladi</summary>${[...yash].filter((t) => turlar.includes(t)).map((t) => qator(t, true)).join("")}</details>`;
  $("katalog-ich").innerHTML = s;
}

async function katalogAmal(d, xabarMatn) {
  holat("Sheets ga yozilmoqda…");
  try {
    await katalogYoz(d);
    await jonliNarx(true);
    katalogForma = null; katalogTasdiq = null;
    holat(xabarMatn);
  } catch (e) { holat("Tayyor"); xato(e.message); }
  katalogChiz();
}

$("katalog-ich").addEventListener("click", (e) => {
  const kp = e.target.closest("[data-kp]");
  if (kp) { katalogPapka = kp.dataset.kp; katalogChiz(); return; }
  const b = e.target.closest("[data-kt]");
  if (!b) return;
  const amal = b.dataset.kt, nom = b.dataset.nom;
  if (amal === "yangi") { katalogForma = { yangi: true }; katalogChiz(); $("kt-nom").focus(); return; }
  if (amal === "tahrir") { katalogForma = { nom }; katalogChiz(); return; }
  if (amal === "bekor") { katalogForma = null; katalogChiz(); return; }
  if (amal === "yashir") {
    if (katalogTasdiq !== nom) { katalogTasdiq = nom; katalogChiz(); setTimeout(() => { if (katalogTasdiq === nom) { katalogTasdiq = null; katalogChiz(); } }, 4000); return; }
    katalogAmal({ amal: "oyna_yashir", nom }, `${nom} yashirildi`);
    return;
  }
  if (amal === "qaytar") { katalogAmal({ amal: "oyna_yashir", nom, yashir: false }, `${nom} qaytarildi`); return; }
  if (amal === "saqla") {
    const n = katalogNarxlar();
    const ism = katalogForma.yangi ? $("kt-nom").value.trim().replace(/\s+/g, "") : katalogForma.nom;
    if (!ism) { xato("Oyna nomini yozing"); return; }
    if (katalogForma.yangi && Object.keys(n.steklopaket_som || {}).some((t) => t.toLowerCase() === ism.toLowerCase()))
      { xato(`"${ism}" allaqachon bor${(n.oyna_yashirin || []).includes(ism) ? " (yashirilgan — pastda Qaytarish)" : ""}`); return; }
    const narx = {};
    let bor = false;
    for (const el of document.querySelectorAll("[data-kt-narx]")) {
      const v = el.value.trim();
      if (v && !(Number(v) > 0)) { xato("Narx musbat son boʻlishi kerak"); return; }
      narx[el.dataset.ktNarx] = v ? Number(v) : null;
      if (v) bor = true;
    }
    if (!bor) { xato("Kamida bitta qalinlik narxini yozing"); return; }
    katalogAmal({ amal: "oyna_yoz", nom: ism, narx }, katalogForma.yangi ? `${ism} qoʻshildi` : `${ism} narxi yangilandi`);
  }
});
$("katalog-och").addEventListener("click", () => { katalogForma = null; katalogTasdiq = null; ekran("katalog"); });
