"""Dillerga roʻyxat va oyna roʻyxati (foydalanuvchi, 2026-11-07).

Dillerga roʻyxat — AKFA nakladnoyiga oʻxshash: diller nomi + soni, vazn va narxsiz, butun zakaz boʻyicha guruhlab.
- Profil: sklad qoldigʻi ishlatilgandan keyin yetmagan yangi 6,5 m hivichlar soni (sklad berilmasa — hammasi yangi).
- Rezina: kg da (1 metr vazni foydalanuvchidan keladi; berilmaguncha metrda).
- Poliamid tij: butun metrga yuqoriga (5,5 → 6).
- Yozilmaydi, pastda qizil eslatma: samorez, K188 kley, podokonnik (qopqogʻi bilan), pena.
- Steklopaket alohida: oyna_royxati.

Oyna oʻlchami 0,5 sm ga pastga yaxlitlanadi (55,2 → 55; 55,6 → 55,5). Yaxlitlangan oyna ichki razmerdan
tabaqada 2 sm dan, gluxoy va fortochkada 1,5 sm dan koʻp kichik boʻlsa — yuqoriga (foydalanuvchi, 2026-11-07).
"""

from math import ceil, floor

from hisob import ALDOKS, ALDOKS_PROFILLARI, ENGELBERG, ENGELBERG_PROFILLARI, SERIYA_RAMA, HisobXato, asl_profil, oyna_qalinligi

# Diller roʻyxatidagi nom ("Diller narx" A → B, 04.11.2026)
DILLER_NOMI = {
    "4,2×45 YHB": "(C) Samarez 4.2 x 45 YHB (250) (12sht) (Uz)",  # Engelberg eshik petlyasi (2026-11-11)
    "4,8×60 YSB": "(A) Samarez 4.8 x 60 YSB (200) (12sht) (Uz)",
    "Rezina EPDM (Champ 01.18.30)": "Rezina EPDM (Champ 01.18.30) (15kg)",  # Aldoks (2026-11-11)  # Engelberg shtulpi (2026-11-11)
    "Zamok Dver (3147) (Otvetka) (Tr)": "Zamok Dver (3147) (Otvetka) (Tr)",
    "TERMO Zamok Dvernoy GIESSE": "TERMO Zamok Dvernoy Giesse+Otvetka 85/35 (Tr)",
    "Serdtsevina 101 mm (DWG)": "Serdtsevina 101 mm (DWG) (Tr)",
    "Ruchka Dver (1076.92.28) (Qora)": "Ruchka Dver (1076.92.28) (Qora) (Tr)",
    "(A8060) 2SK TERMO Petlya (Uz)": "(A8060) 2SK TERMO Petlya (9005) (Uz)",
    "(A8060) 2SK TERMO Petlya (Tr)": "(A8060) 2SK TERMO Petlya (9005) (Tr)",
    "(A9211.3) 2SK TERMO Petlya (Tr)": "(A9211.3) 2SK TERMO Petlya (9005) (Tr)",
    "(A6004) Ruchka CREMONE": "(A6004) Ruchka CREMONE (9005) (Tr)",
    "(A6401.1) Ruchka Konnektor": "(A6401.1) Ruchka Konnektor (Tr)",
    "(A2010.2) Poliamid Tij (Qora)": "(A2010.2) Poliamid Tij (Qora) (Tr)",
    "A4514.23": "(A4514.23) Ruchag Shtulpovogo Shpingaleta (Tr)",
    "Stublina 1177": "Ruchka Dver (1177.85.28) (Oq) (Tr)",
    "Stublina 1177 (Uz)": "Ruchka Dver (1177.85.28) (2894) (Uz)",
    "Komfort dver ruchka": "Ruchka Dvernaya COMFORT (1076.92.28) (9005) (Uz)",
    "A3520.32": "(A3520.32) Zapor Povorotnogo Okna Na Rolikax (Tr)",
    "Termo Zatsep (4207)": "(A4207.1) Zapor Povorotnogo Okna Na Rolikax (Tr)",
    "A4202": "(A4202.1) Otvetnaya Planka Zamok (Tr)",
    "BKT70 EPD001": "Rezina Krishka EPDM001 (BKT 70) (Uz)",
    "Takos Regulirovichniy (32mm)": "Takos Regulirovichniy (32mm) (Tr)",
    "CT 203": "Takos PVH (10sht) (Uz)",
    "01.553": "TERMO Soed. Ugl. 19mm (01.553) (Tr)",
    "263 W02": "BKT 70 Soed. W 02 (1=26.3) (Uz)",
    "108 W02": "BKT 70 Soed. W 02 (1=10.8) (Uz)",
    "263 W03": "BKT 70 Soed. W 03 (1=26.3) (Uz)",
    "108 W03": "BKT 70 Soed. W 03 (1=10.8) (Uz)",
    "184 W02": "BKT 70 Soed. W 02 (1=18.4) (Uz)",
    "078 W02": "BKT 70 Soed. W 02 (1=7.8) (Uz)",
    "184 M535": "BKT 78 Soed. (M11535-18.4mm) (Uz)",
    "078 M535": "BKT 78 Soed. (M11535-7.8mm) (Uz)",
    "A10-001": "BKT 70 Soed. List (A10-001)(Uz)",
    "A10-002": "BKT 70 Soed. List (A10-002)(Uz)",
    "A10-003": "BKT 70 Soed. List (A10-003)(Uz)",
    "236 J01": "BKT 70 Soed. Impost (J01-23.6mm)(Uz)",
    "236 J05": "BKT 70 Soed. Impost (J05-23.6mm)(Uz)",
    "(A6011.10) Ruchka COMFORT Okon Dv. Otk": "(A6011.10) Ruchka COMFORT Okon Dv. Otk (9005) (Tr)",
    "(A3420F.1) Dv. Otk 160kg": "(A3420F.1) Dv. Otk 160kg (9005) (Tr)",
    "(A3400.21) Nojnitsa Sredniy": "(A3400.21) Nojnitsa Sredniy (Tr)",
    "(A3400.22) Nojnitsa Dlinniy": "(A3400.22) Nojnitsa Dlinniy (Tr)",
    "(A1501.5) Chit-Chit": "(A1501.5) Chit-Chit (Qora) (Tr)",
    "(A1115.1) Ogranichitel": "(A1115.1) Ogranichitel (Tr)",
    "(A1115.2) Ogranichitel": "(A1115.2) Ogranichitel (Tr)",
}

# Profil nomi diller roʻyxatida: laminatsiya "T LAM (<rang>) <nom> BKT 70 <kod> (6.5m)", qolgani "TERMO BKT 70 <kod> <nom> (<rang>) (6.5m)"
LAM_NOM = {"F702": "Kosa", "F703": "Kosa Shirokiya", "V707": "Balkon Urta", "V708": "Balkon Kanot", "M702": "Urta",
           "V702": "Kanot", "A701": "Shtulp", "G24": "Shtapik", "G24-R": "Shtapik", "G32": "Shtapik",
           "G32-R": "Shtapik", "H702": "Lapsha"}
TERMO_NOM = {**LAM_NOM, "V708": "Balkon Qanot", "V702": "Qanot"}
# Sklad rangi → diller rangi (ichki rang kodi yozilmaydi; foydalanuvchi, 2026-11-07)
DILLER_RANGI = {"grey": "Anthrazit Grey LL", "z/d": "Zol Dub", "d/m": "Dub Mokko", "sh/d": "Sheffal Dub LL",
                "alux": "Alyuks LL", "306g": "SW306G", "oq": "Oq"}

# Rezina 1 metri vazni, kg (foydalanuvchi oʻlchab beradi; boʻsh boʻlsa metrda yoziladi)
# 1 metr vazni, kg (foydalanuvchi oʻlchagan, 2026-11-08); dillerga kg da yoziladi
REZINA_KG_M = {"A01-002": 0.064, "A01-003": 0.036, "EPDM Rezina Ю": 0.046, "A01-005": 0.180,
               "EPDM 5025": 0.050, "EPDM 5108": 0.092,  # Engelberg (foydalanuvchi, 2026-11-10)
               "Rezina EPDM (Champ 01.18.30)": 0.040}  # Aldoks (foydalanuvchi, 2026-11-11)
# Aldoks "Qishki Bosma" pachka (100 m) bilan sotiladi — dillerga metrda
REZINALAR = ("A01-005", "A01-003", "A01-002", "EPDM Rezina Ю", "EPDM 5108", "EPDM 5025",
             "Rezina EPDM (Champ 01.18.30)", "Rezina Profil P (Bosma) (Qishki)")

# Dillerdan olinmaydi — eslatma (qizil)
ESLATMA = {"3,9×19 YHBM": "Samorez 3,9×19", "4,8×19 YSBM": "Samorez 4,8×19", "Zaklepka 4×12": "Zaklepka 4×12", "3,9×16 YSBM": "Samorez 3,9×16 (IDEAL YHB)", "Lapsha samorez soʻm": "Samorez (lapsha)", "Medved samorez soʻm": "Medved samorez (montaj)", "K188": "Kley K188 (Saudal)", "MK 01": "Pena"}
TASHLANADI = {"Oyna", "Arka", "Profil", "Profil otxod"}


def _son(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


# Engelberg 7000 diller nomlari (AKFA roʻyxati 04.11.2026). Laminat: sklad rangi → diller rangi
ENG_LAM_RANGI = {"grey": "7011-Anthrazit Grey", "alux": "7011-Alyuks", "sh/d": "7011-Sheffal Dub",
                 "z/d": "Zol Dub", "d/m": "Dub Mokko"}
ENG_OQ_NOM = {"7051": "7000 ENG Kosa (Oq) (N)", "7052": "7000 ENG Kanot (Oq) (N)", "7053": "7000 ENG Urta (Oq) (N)",
              "7054": "7000 ENG Balkon Urta (Oq) (N)", "7055": "7000 ENG Balkon Kanot (Oq) (N)",
              "7058": "7000 ENG Adaptor Bez Imposta (Shtulp) (Oq) (N)",
              "7056": "7000 ENG Shtapik Dv. Steklo (Oq) (24mm) (N)", "7057": "7000 ENG Shtapik Tr. Steklo (Oq) (32mm) (N)"}
ENG_LAM_NOM = {"7051": "Kosa", "7052": "Kanot", "7053": "Urta", "7054": "Balkon Urta", "7055": "Balkon Kanot",
               "7058": "Adaptor Bez Impost (Shtulp)", "7056": "Shtapik (TPV) (24mm)", "7057": "Shtapik (TPV) (32mm)"}
ENG_METALL_NOM = {"0702-2": "Metall Vst. BALKON QANOT 7000 (2mm)", "0701": "Metall Vst. KOSA QANOT 7000 (1.5mm)", "0701-2": "Metall Vst. KOSA QANOT 7000 (2mm)",
                  "0703": "Metall Vst. URTA 7000 (1.5mm)", "0703-2": "Metall Vst. URTA 7000 (2mm)"}


def eng_profil_nomi(profil, rang):
    if profil in ENG_METALL_NOM:
        return ENG_METALL_NOM[profil]
    if rang in (None, "oq") and profil in ENG_OQ_NOM:
        return ENG_OQ_NOM[profil]
    r = ENG_LAM_RANGI.get(rang or "", "rangi?")
    ll = "LAM LL" if r.startswith("7011") else "LAM"
    return f"ENG 7000 ({r}) {ENG_LAM_NOM.get(profil, profil)} {ll} (N)"


# PVX lambri diller nomi sklad rangi boʻyicha (foydalanuvchi, 2026-11-10): laminatda ichi oq variant (11,70);
# grey (ichi oq varianti yoʻq), 306g va anod ga alux antrazit
_LAMBRI_ALUX = "TRIO 6000 (Alyuks-Oq) Lambri New LAM LL (N)"
LAMBRI_NOM = {"oq": "Lambri II (N)", "grey": _LAMBRI_ALUX, "alux": _LAMBRI_ALUX, "306g": _LAMBRI_ALUX,
              "anod": _LAMBRI_ALUX,
              "sh/d": "TRIO 6000 (Sheffal Dub-Oq) Lambri LAM LL (N)",
              "z/d": "TRIO 6000 (Zol Dub-Oq) Lambri LAM (N)", "d/m": "TRIO 6000 (Dub Mokko-Oq) Lambri LAM (N)"}


# Aldoks (AKFA roʻyxati 04.11.2026): ADT / (N) / NEO — oʻlcham bir xil, nomi boshqa (tanlov.ald_tur)
ALD_NOM = {"183": "Kosa", "181": "Qanot", "182": "Urta", "105": "Shtapik P", "185": "Balkon Urta", "198": "Balkon Qanot",
           "109": "Chift Quloq"}
ALD_NEO_KOD = {"183": "F0022", "181": "V0022", "182": "M0022", "105": "G0001", "185": "V0008", "198": "V0007"}
ALD_N_NOM = {"185": "Balkon Urta New", "198": "Balkon Qanot New", "109": "Chift Quloq New"}  # (N) turida eshik profili "New"
ALD_LAM_NOM = {"198": "Balkon Kanot", "109": "Chift (Uzkiy)"}  # laminat Chift Quloq — "Chift (Uzkiy)"  # laminat roʻyxatida "Kanot" deb yozilgan
ALD_TURLARI = ("ADT", "N", "NEO")


# Laminat: "LAM (7011-Anthrazit Grey LL) Kosa Alum"; 306g: "(A) Kosa (SW306G)"; NEO rangli: "(A) NEO ADC50 F0022 Kosa (V Zol Dub)"
ALD_LAM_RANGI = {"grey": "7011-Anthrazit Grey LL", "alux": "7011-Alyuks LL", "sh/d": "7011-Sheffal Dub LL",
                 "d/m": "8017-Dub Mokko", "z/d": "8001-Zol Dub"}
ALD_NEO_RANGI = {"z/d": "V Zol Dub", "d/m": "V Dub Mokko", "306g": "SW306G"}


def ald_profil_nomi(profil, rang, tur="ADT"):
    nom = ALD_NOM.get(profil, profil)
    neo = f"(A) NEO ADC50 {ALD_NEO_KOD.get(profil, profil)} {nom}"
    if rang in (None, "oq"):
        if tur == "NEO":
            return f"{neo} (Oq)"
        if tur == "N":
            return f"{profil} {ALD_N_NOM.get(profil, nom)} (Oq) (R) (N)"
        return f"{profil} {nom} (Oq) (Adt)"
    if tur == "NEO":
        # sotuvda faqat V Zol Dub, V Dub Mokko, SW306G; boshqa rang zakazga keladi, narxi bir xil (foydalanuvchi, 2026-11-11)
        r = ALD_NEO_RANGI.get(rang) or f"{ALD_LAM_RANGI.get(rang, 'rangi?')}) (zakaz"
        return f"{neo} ({r})"
    if rang == "306g":
        return f"(A) {nom} (SW306G)"
    return f"LAM ({ALD_LAM_RANGI.get(rang, 'rangi?')}) {ALD_LAM_NOM.get(profil, nom)} Alum"


def profil_nomi(profil, rang, ald_tur="ADT"):
    """Diller roʻyxatidagi hivich nomi. rang — sklad rangi (grey, z/d, …, 306g, oq, anod) yoki None."""
    profil = asl_profil(profil)
    kod = profil.replace("-", "")
    if profil in ALDOKS_PROFILLARI:
        return ald_profil_nomi(profil, rang, ald_tur)
    if profil in ENGELBERG_PROFILLARI:
        return eng_profil_nomi(profil, rang)
    if profil == "LII":  # PVX lambri 10 sm, 6 m (foydalanuvchi, 2026-11-09)
        return LAMBRI_NOM.get(rang or "", "Lambri II (N) — rangi?")
    if rang in ("oq", "306g", "anod"):
        r = DILLER_RANGI.get(rang, "anod rangi?")
        return f"TERMO BKT 70 {kod} {TERMO_NOM.get(profil, '')} ({r}) (6.5m)".replace("  ", " ")
    r = DILLER_RANGI.get(rang or "", "rangi?")
    return f"T LAM ({r}) {LAM_NOM.get(profil, '')} BKT 70 {kod} (6.5m)".replace("  ", " ")


def _profil_qatorlari(zakaz, sklad):
    from raskroy import rang_guruhlari, sklad_rejasi

    qatorlar, izohlar = [], []
    ald_tur = ((zakaz.get("umumiy") or {}).get("tanlov") or {}).get("ald_tur") or "ADT"
    for g in rang_guruhlari(zakaz):
        rang = g["rang"]
        if rang is None:
            izohlar.append(f"Laminatsiya rangi tanlanmagan ({', '.join(g['konstruksiyalar'])}): nomda rang yoʻq")
        reja = sklad_rejasi(zakaz, sklad or [], rang or "grey", g)
        for r in reja["rejalar"]:
            if r["yangi_soni"]:
                nomi = profil_nomi(r["profil"], rang, ald_tur)
                bor = next((q for q in qatorlar if q["nomi"] == nomi), None)  # 181 va 181□ — bitta hivich nomi
                if bor:
                    bor["soni"] += r["yangi_soni"]
                    bor["sklad"] += r["sklad_soni"]
                else:
                    qatorlar.append({"nomi": nomi, "soni": r["yangi_soni"], "birlik": "hivich", "sklad": r["sklad_soni"]})
        izohlar += reja.get("izohlar") or []
    return qatorlar, izohlar


def diller_royxati(zakaz, narxlar=None, sklad=None):
    """{"qatorlar": [{nomi, soni, birlik}], "eslatmalar": [matn], "izohlar": [matn]}."""
    from tannarx import tannarx

    t = tannarx(zakaz, narxlar, kurs=(narxlar or {}).get("kurs") or 1)
    qatorlar, izohlar = _profil_qatorlari(zakaz, sklad)
    eslatma, rezina = {}, []
    for m in t["materiallar"]:
        bolim, art, birlik, jami = m["bolim"], m["artikul"], m["birlik"], m["jami"]
        if bolim in TASHLANADI or not jami:
            continue
        if bolim == "Podokonnik" or art in ESLATMA:
            nom = ESLATMA.get(art) or ("Podokonnik qopqogʻi" if art.startswith("Krishka") else art.replace(" | ", ", "))
            if birlik == "dona":
                jami = ceil(jami - 1e-9)
            eslatma[nom] = eslatma.get(nom, 0) + jami
            eslatma[nom + "\0"] = birlik
            continue
        if art in REZINALAR:
            kg = REZINA_KG_M.get(art)
            if kg:
                qatorlar.append({"nomi": art, "soni": round(jami * kg, 2), "birlik": "kg"})
                rezina.append({"nomi": art, "kg": round(jami * kg, 2), "metr": round(jami, 1)})
            else:
                qatorlar.append({"nomi": art, "soni": round(jami, 2), "birlik": "m", "izoh": "kg — 1 metr vazni kiritilmagan"})
            continue
        if birlik == "m":  # poliamid tij: butun metr
            qatorlar.append({"nomi": DILLER_NOMI.get(art, art), "soni": ceil(jami - 1e-9), "birlik": "m"})
            continue
        qatorlar.append({"nomi": DILLER_NOMI.get(art, art), "soni": ceil(jami - 1e-9), "birlik": birlik})
    eslatmalar = [f"{nom} — {_son(v)} {eslatma[nom + chr(0)]}" for nom, v in eslatma.items() if not nom.endswith("\0")]
    # Rezina kilosi eslatmada ham (foydalanuvchi, 2026-11-08): diller karobka (5/10/15 kg) bilan beradi
    return {"qatorlar": qatorlar, "eslatmalar": eslatmalar, "izohlar": izohlar, "rezina": rezina,
            "rezina_jami": round(sum(r["kg"] for r in rezina), 2)}


# ---------- oyna ----------
OYNA_CHEGARA_TABAQA = 2.0    # rom va eshik tabaqasi: oyna ichki razmerdan koʻpi bilan shuncha kichik
OYNA_CHEGARA_GLUXOY = 1.5    # gluxoy va fortochka


def _ayirma_chegara(joy, pvx=False):
    if pvx or joy.startswith("Gluxoy") or joy.startswith("Fortochka"):  # Engelberg: hamma oyna ichki − 1,5
        return 1.5, OYNA_CHEGARA_GLUXOY
    return 2.0, OYNA_CHEGARA_TABAQA


def oyna_yaxlit(x, joy, pvx=False):
    """Oyna oʻlchami 0,5 sm ga: avval pastga; ichki razmerdan farq chegaradan oshsa — yuqoriga."""
    ayirma, chegara = _ayirma_chegara(joy, pvx)
    ichki = x + ayirma
    past = floor(x * 2 + 1e-9) / 2
    if ichki - past <= chegara + 1e-9:
        return past
    return ceil(x * 2 - 1e-9) / 2


def oyna_royxati(zakaz, narxlar=None):
    """Oynalar turi va yaxlitlangan oʻlcham boʻyicha guruhlab: [{tur, qalinlik, en, boy, soni, m2, konstruksiyalar}]."""
    from tannarx import tannarx

    t = tannarx(zakaz, narxlar, kurs=(narxlar or {}).get("kurs") or 1)
    faol = [k for k in zakaz.get("konstruksiyalar") or [] if k.get("soni", 1) != 0]
    umumiy = zakaz.get("umumiy") or {}
    guruh = {}
    for o in t["oynalar"]:
        k = t["konstruksiyalar"][o["i"]]
        qal = oyna_qalinligi(faol[o["i"]], umumiy)
        pvx = SERIYA_RAMA.get(faol[o["i"]].get("rama") or umumiy.get("rama")) is ENGELBERG
        en, boy = oyna_yaxlit(o["en"], o["joy"], pvx), oyna_yaxlit(o["boy"], o["joy"], pvx)
        kalit = (o.get("tur") or "", qal, en, boy)
        g = guruh.setdefault(kalit, {"tur": kalit[0], "qalinlik": qal, "en": en, "boy": boy, "soni": 0,
                                     "konstruksiyalar": []})
        g["soni"] += o["soni"] * k["soni"]
        if k["nom"] not in g["konstruksiyalar"]:
            g["konstruksiyalar"].append(k["nom"])
    royxat = sorted(guruh.values(), key=lambda g: (g["tur"], g["qalinlik"], -g["boy"], -g["en"]))
    for g in royxat:
        g["m2"] = round(g["en"] * g["boy"] * g["soni"] / 10000, 3)
    return royxat


if __name__ == "__main__":
    import json
    import sys

    z = json.load(open(sys.argv[1], encoding="utf-8"))
    d = diller_royxati(z)
    for i, q in enumerate(d["qatorlar"], 1):
        print(f"{i:2d}. {q['nomi']} — {_son(q['soni'])} {q['birlik']}")
    for e in d["eslatmalar"]:
        print("!", e)
    for r in d["rezina"]:
        print(f"! Rezina {r['nomi']} — {_son(r['kg'])} kg ({_son(r['metr'])} m)")
    for o in oyna_royxati(z):
        print(f"{o['tur']} {o['qalinlik']} mm  {_son(o['en'])} × {_son(o['boy'])}  × {o['soni']}  {o['m2']} m²")
    if not d["qatorlar"]:
        raise HisobXato("Roʻyxat boʻsh")
