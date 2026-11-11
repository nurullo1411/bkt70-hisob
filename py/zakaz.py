"""Bir zakazdagi koʻp konstruksiyani hisoblab, Google Sheets varagʻi uchun katakchalar tuzadi.

Miqdorlarni dastur hisoblaydi. Narx va kurs varaqda formula bilan olinadi, shuning uchun
Narxlar, Malumot yoki Hisob!F5 oʻzgarsa, zakaz summasi ham oʻzi yangilanadi.

Ishga tushirish: python zakaz.py zakaz.json "Z-001 Akmal"
Natija: JSON {"varaq", "qator_soni", "ustun_soni", "kataklar", "tekshiruv"}.
"""
import json
import sys
from collections import Counter
from pathlib import Path

from hisob import SERIYA_RAMA, HisobXato, narx_kaliti, oyna_qalinligi
from hisobot import ARKA_OYNA, hisobot, narxlarni_oqi

# Steklopaket narxi Narxlar jadvalida soʻmda, qolgan narxlar dollarda
KURS = "Hisob!$F$5"
NARX_VLOOKUP = 'IFERROR(1/(1/VLOOKUP({kalit};Narxlar!$B:$E;4;0)){boluvchi};"")'


def _ustun(i):
    """0 → A, 26 → AA."""
    natija = ""
    i += 1
    while i:
        i, q = divmod(i - 1, 26)
        natija = chr(65 + q) + natija
    return natija


def _birlashtir(umumiy, k):
    natija = {**umumiy, **k}
    natija["tanlov"] = {**umumiy.get("tanlov", {}), **k.get("tanlov", {})}
    return natija


def _qator_kaliti(t, k):
    """Material qatori: (boʻlim, artikul, izoh, birlik)."""
    if t["bolim"] == "Profil":
        return ("Profil", t["nomi"], k["tanlov"]["rang"], t["birlik"])
    if t["bolim"] == "Oyna":
        return ("Oyna", t.get("oyna_turi") or k["tanlov"]["oyna_turi"], oyna_qalinligi(k), t["birlik"])
    if t["nomi"] == "K188 kley":
        return (t["bolim"], "K188", "", t["birlik"])
    return (t["bolim"], t["nomi"], "", t["birlik"])


def _narx_formulasi(kalit, q):
    bolim, artikul, _, _ = kalit
    if bolim in ("Profil", "Profil otxod"):
        return (
            f'=IFERROR(1/(1/INDEX(Malumot!$J$2:$M$15;MATCH($B{q};Malumot!$I$2:$I$15;0);'
            f'MATCH($C{q};Malumot!$J$1:$M$1;0)))/Malumot!$J$16;"")'
        )
    if bolim == "Oyna":
        return (
            f'=IFERROR(1/(1/INDEX(Narxlar!$I$3:$O$8;MATCH($B{q};Narxlar!$H$3:$H$8;0);'
            f'MATCH($C{q};Narxlar!$I$2:$O$2;0)))/{KURS};"")'
        )
    if artikul == ARKA_OYNA:  # soʻmda, kursga boʻlinadi
        return "=" + NARX_VLOOKUP.format(kalit=f"$B{q}", boluvchi=f"/{KURS}")
    if artikul == "01.553":
        return "=" + NARX_VLOOKUP.format(kalit='"Soedinitel Urta 19 ugl"', boluvchi="/4")
    return "=" + NARX_VLOOKUP.format(kalit=f"$B{q}", boluvchi="")


def hisobla_zakaz(zakaz, otxod_usuli="chegara", sklad=None):
    from raskroy import _konstruksiya_rangi  # raskroy zakaz ni import qiladi: bu yerda, aylanma importsiz

    umumiy = zakaz.get("umumiy", {})
    royxat = zakaz.get("konstruksiyalar") or []
    if not royxat:
        raise HisobXato("Zakazda konstruksiya yoʻq")
    narxlar = narxlarni_oqi()
    # Narx bu yerda ishlatilmaydi: oyna turi varaqdagi jadvaldan tekshiriladi
    narxlar = {**narxlar, "steklopaket_m2": _HarQandayOyna()}

    konstruksiyalar, oynalar, miqdorlar, detallar = [], [], {}, {}
    for i, element in enumerate(royxat):
        nom = element.get("nom") or f"K{i + 1}"
        soni = element.get("soni", 1)
        if not isinstance(soni, int) or soni < 1:
            raise HisobXato(f"{nom}: soni musbat butun son boʻlishi kerak")
        k = _birlashtir(umumiy, {a: b for a, b in element.items() if a not in ("nom", "soni")})
        k["tanlov"].setdefault("kurs", 1)  # varaqda Hisob!F5 ishlatiladi
        try:
            h = hisobot(k, narxlar)
        except (HisobXato, KeyError) as e:
            raise HisobXato(f"{nom}: {e}") from e
        n = h["n"]
        sklad_rangi = _konstruksiya_rangi(umumiy.get("tanlov") or {}, element)[0]
        izoh = [f"Qoida yoʻq: {x}" for x in n["qoida_yoq"]] + n["ogohlantirishlar"]
        seriya = SERIYA_RAMA.get(k.get("rama"))
        konstruksiyalar.append({"nom": nom, "L": k["L"], "H": k["H"], "soni": soni, "izoh": "; ".join(izoh),
                                "seriya": seriya.nomi if seriya else ""})
        # Varaqda miqdor 1 dona uchun yoziladi, soni (D ustuni) bilan formula koʻpaytiradi
        for o in n["oynalar"]:
            oynalar.append({"nom": nom, "i": i, "joy": o["joy"], "en": o["en"], "boy": o["boy"], "soni": o["soni"],
                            "tur": o.get("tur") or k["tanlov"]["oyna_turi"]})
        for t in h["qatorlar"]:
            kalit = _qator_kaliti(t, k)
            miqdorlar.setdefault(kalit, [0.0] * len(royxat))
            miqdorlar[kalit][i] += round(float(t["miqdor"]), 6)
        for p in n["profillar"]:
            kalit = (p["profil"], k["tanlov"]["rang"])
            if otxod_usuli.startswith("sklad"):  # sklad rangi boʻyicha: grey va z/d bir hivichdan kesilmaydi
                kalit += (sklad_rangi,)
            guruh = detallar.setdefault(kalit, {"kerak": Counter(), "ulush": [0] * len(royxat)})
            uzun = int(round(float(p["uzunlik"]) * 100))
            guruh["kerak"][uzun] += p["soni"] * soni
            guruh["ulush"][i] += uzun * p["soni"] * soni
    otxod = _otxod_qatorlari(detallar, miqdorlar, [k["soni"] for k in konstruksiyalar], otxod_usuli, sklad)
    return konstruksiyalar, oynalar, miqdorlar, otxod


def _otxod_qatorlari(detallar, miqdorlar, sonlar, usul="chegara", sklad=None):
    """Raskroy boʻyicha otxod: har profilga 'Profil otxod' qatori (usul: raskroy.OTXOD_USULLARI).

    metrlik — otxod 0; chegara / butun — skladsiz raskroy; sklad_metr / sklad_tekin — sklad qoldigʻi
    avval (detallar kaliti 3-elementi sklad rangi, None boʻlsa sklad ishlatilmaydi). sklad_tekin da
    ortiqcha manfiy boʻlishi mumkin: skladdan olingan detal metrlik narxdan ayriladi.

    Ortiqcha metr konstruksiyalarga shu profildagi ulushiga qarab boʻlinadi va 1 donaga
    keltiriladi (varaqda soni bilan koʻpaytiriladi). Soni varaqda oʻzgartirilsa otxod
    qayta raskroy qilinmaydi, shu ulush bilan oʻzgaradi.
    Straxovka bu yerda emas, butun tannarxga varaqda qoʻshiladi.
    """
    from raskroy import OTXOD_USULLARI, otxod_hisobi, sklad_bolaklari, sklad_otxod_hisobi

    if usul not in OTXOD_USULLARI:
        raise HisobXato(f"Otxod usuli notoʻgʻri: {usul}")
    natija = []
    for kalit, g in detallar.items():
        profil, rang = kalit[0], kalit[1]
        sklad_rang = kalit[2] if len(kalit) > 2 else None
        if usul.startswith("sklad"):
            bolak = sklad_bolaklari(sklad or [], profil, sklad_rang)[0] if sklad_rang else []
            o = sklad_otxod_hisobi(profil, g["kerak"], bolak, usul)
        elif usul == "metrlik":
            o = {"hivich": None, "ishlatilgan": sum(d * n for d, n in g["kerak"].items()), "chegara_yoq": False}
            o["sarf"] = o["ishlatilgan"]
        else:
            o = otxod_hisobi(profil, g["kerak"], usul)
        ishlatilgan = o["ishlatilgan"] / 10000
        jami = o["sarf"] / 10000
        ortiqcha = jami - ishlatilgan
        miqdorlar[("Profil otxod", narx_kaliti(profil), rang, "m")] = [
            round(ortiqcha * u / o["ishlatilgan"] / s, 6) for u, s in zip(g["ulush"], sonlar)
        ]
        natija.append({
            "profil": profil, "rang": rang, "hivich": o["hivich"], "ishlatilgan_m": round(ishlatilgan, 3),
            "sarf_m": round(o["sarf"] / 10000, 3), "jami_m": round(jami, 3), "chegara_yoq": o["chegara_yoq"],
            "sklad_rang": sklad_rang, "sklad_bolak": o.get("sklad_bolak", 0), "sklad_m": round(o.get("sklad_m", 0), 3),
        })
    return natija


class _HarQandayOyna(dict):
    def __contains__(self, _):
        return True

    def __getitem__(self, _):
        return {}


def varaq_kataklari(zakaz, sarlavha):
    konstruksiyalar, oynalar, miqdorlar, otxod = hisobla_zakaz(zakaz)
    n = len(konstruksiyalar)
    birinchi_k = 7  # H ustunidan boshlab har konstruksiya miqdori
    ustunlar = birinchi_k + n
    q = []

    def qosh(*qiymat):
        q.append(list(qiymat) + [""] * (ustunlar - len(qiymat)))

    from raskroy import STRAXOVKA

    qosh(f"Zakaz {sarlavha}")
    qosh("Kurs (1 $ = soʻm)", f"={KURS}")
    qosh("Straxovka (tannarxga)", STRAXOVKA)
    bosh_k = len(q) + 2  # birinchi konstruksiya qatori
    qosh("№", "Nomi", "L × H, sm", "Soni", "1 dona, $", "Jami, $", "Jami, soʻm", "Izoh")
    bosh_m = bosh_k + n + 1 + len(oynalar) + 3 + 1
    oxir_m = bosh_m + len(miqdorlar) - 1
    for i, k in enumerate(konstruksiyalar):
        r = len(q) + 1
        u = _ustun(birinchi_k + i)
        qosh(
            i + 1, k["nom"], f"{k['L']} × {k['H']}", k["soni"],
            f"=SUMPRODUCT({u}${bosh_m}:{u}${oxir_m};$F${bosh_m}:$F${oxir_m})*(1+$B$3)",
            f"=E{r}*D{r}",
            f"=F{r}*$B$2",
            k["izoh"],
        )
    sonlar = f"$D${bosh_k}:$D${bosh_k + n - 1}"
    qosh()
    qosh("Oynalar", "Joyi", "Eni, sm", "Boʻyi, sm", "Soni", "m²")
    bosh_o = len(q) + 1
    for o in oynalar:
        r = len(q) + 1
        qosh(o["nom"], o["joy"], o["en"], o["boy"], f"={o['soni']}*$D${bosh_k + o['i']}",
             f"=C{r}*D{r}*E{r}/10000")
    r = len(q) + 1
    qosh("Jami oyna", "", "", "", f"=SUM(E{bosh_o}:E{r - 1})", f"=SUM(F{bosh_o}:F{r - 1})")
    qosh()
    qosh("Boʻlim", "Artikul", "Izoh", "Birlik", "Jami", "Narx, $", "Summa, $",
         *[k["nom"] + " (1 dona)" for k in konstruksiyalar])
    assert len(q) + 1 == bosh_m, (len(q) + 1, bosh_m)
    for kalit, ustun_qiymat in miqdorlar.items():
        r = len(q) + 1
        bolim, artikul, izoh, birlik = kalit
        u1, u2 = _ustun(birinchi_k), _ustun(birinchi_k + n - 1)
        korinish = "'" + artikul if artikul[:1].isdigit() else artikul
        qosh(
            bolim, korinish, izoh, birlik, f"=MMULT({u1}{r}:{u2}{r};{sonlar})",
            _narx_formulasi(kalit, r), f'=IF(F{r}="";"";E{r}*F{r})', *ustun_qiymat,
        )
    qosh()
    mat_r = len(q) + 1
    qosh("Materiallar, $", "", "", "", "", "", f"=SUM(G{bosh_m}:G{oxir_m})")
    qosh("Straxovka, $", "", "", "", "", "", f"=G{mat_r}*$B$3")
    jami_r = len(q) + 1
    qosh("JAMI TANNARX, $", "", "", "", "", "", f"=G{mat_r}+G{mat_r + 1}")
    qosh("JAMI TANNARX, soʻm", "", "", "", "", "", f"=G{jami_r}*$B$2")
    qosh(
        "Holat", f'=IF(COUNTBLANK(F{bosh_m}:F{oxir_m})>0;'
        f'"DIQQAT, tannarx toʻliq emas: "&COUNTBLANK(F{bosh_m}:F{oxir_m})&" ta materialda narx yoʻq";"Hamma narx bor")',
    )
    return {
        "varaq": sarlavha,
        "qator_soni": len(q),
        "ustun_soni": ustunlar,
        "kataklar": q,
        "tekshiruv": {
            "jami_usd": f"G{jami_r}",
            "jami_som": f"G{jami_r + 1}",
            "holat": f"B{jami_r + 2}",
            "konstruksiya_birinchi_qator": bosh_k,
            "material_birinchi_qator": bosh_m,
            "material_oxirgi_qator": oxir_m,
            "qoida_yoq_yoki_ogohlantirish": [k["nom"] + ": " + k["izoh"] for k in konstruksiyalar if k["izoh"]] + [
                f"{o['profil']}: otxod chegarasi yoʻq, butun qoldiq otxod deb olindi" for o in otxod if o["chegara_yoq"]
            ],
            "otxod": otxod,
        },
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3:
        sys.exit('Ishlatish: python zakaz.py zakaz.json "Z-001 Akmal"')
    try:
        natija = varaq_kataklari(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), sys.argv[2])
    except HisobXato as e:
        sys.exit(f"Xato: {e}")
    print(json.dumps(natija, ensure_ascii=False))
