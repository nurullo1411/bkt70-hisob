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

from hisob import ENGELBERG, ENGELBERG_PROFILLARI, SERIYA_RAMA, HisobXato

# Diller roʻyxatidagi nom ("Diller narx" A → B, 04.11.2026)
DILLER_NOMI = {
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
REZINA_KG_M = {"A01-002": 0.064, "A01-003": 0.036, "EPDM Rezina Ю": 0.046, "A01-005": 0.180}
REZINALAR = ("A01-005", "A01-003", "A01-002", "EPDM Rezina Ю")

# Dillerdan olinmaydi — eslatma (qizil)
ESLATMA = {"3,9×19 YHBM": "Samorez 3,9×19", "Lapsha samorez soʻm": "Samorez (lapsha)", "K188": "Kley K188 (Saudal)", "MK 01": "Pena"}
TASHLANADI = {"Oyna", "Arka", "Profil", "Profil otxod"}


def _son(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def profil_nomi(profil, rang):
    """Diller roʻyxatidagi hivich nomi. rang — sklad rangi (grey, z/d, …, 306g, oq, anod) yoki None."""
    kod = profil.replace("-", "")
    if profil in ENGELBERG_PROFILLARI:
        # Engelberg 7000: diller qogʻozidagi aniq nom hali olinmagan (2026-11-08)
        nom = {"7051": "Kosa", "7052": "Kanat", "7053": "Urta", "7056": "Shtapik 24", "7057": "Shtapik 32",
               "0701": "Armatura Kosa-Qanot", "0703": "Armatura Urta"}.get(profil, "")
        r = "Oq" if rang in (None, "oq") else DILLER_RANGI.get(rang, rang)
        return f"PVX Engelberg 7000 {nom} {kod} ({r}) (6m)".replace("  ", " ")
    if rang in ("oq", "306g", "anod"):
        r = DILLER_RANGI.get(rang, "anod rangi?")
        return f"TERMO BKT 70 {kod} {TERMO_NOM.get(profil, '')} ({r}) (6.5m)".replace("  ", " ")
    r = DILLER_RANGI.get(rang or "", "rangi?")
    return f"T LAM ({r}) {LAM_NOM.get(profil, '')} BKT 70 {kod} (6.5m)".replace("  ", " ")


def _profil_qatorlari(zakaz, sklad):
    from raskroy import rang_guruhlari, sklad_rejasi

    qatorlar, izohlar = [], []
    for g in rang_guruhlari(zakaz):
        rang = g["rang"]
        if rang is None:
            izohlar.append(f"Laminatsiya rangi tanlanmagan ({', '.join(g['konstruksiyalar'])}): nomda rang yoʻq")
        reja = sklad_rejasi(zakaz, sklad or [], rang or "grey", g)
        for r in reja["rejalar"]:
            if r["yangi_soni"]:
                qatorlar.append({"nomi": profil_nomi(r["profil"], rang), "soni": r["yangi_soni"], "birlik": "hivich",
                                 "sklad": r["sklad_soni"]})
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
        qal = int(faol[o["i"]].get("oyna_qalinligi") or umumiy.get("oyna_qalinligi") or 24)
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
