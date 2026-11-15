"""Zakaz tannarxini Sheetsʼsiz hisoblaydi (telefon ilovasi va buyruq qatori uchun).

Natija zakaz varagʻi ("Z-00N") bilan bir xil qoidada: miqdor 1 dona uchun × soni,
profil narxi hivich : 6,5 m, otxod raskroy boʻyicha, steklopaket soʻmda : kurs,
butun tannarxga +3% straxovka.

Ishga tushirish: python tannarx.py zakaz.json [kurs]
"""
import json
import sys
from pathlib import Path

from hisob import HisobXato, hivich_metr, narx_kaliti, profil_narxi
from hisobot import ARKA_OYNA, LAPSHA_SAMOREZ, MEDVED_SAMOREZ, narxlarni_oqi
from zakaz import hisobla_zakaz


OYNA_20_ARZON = 5000  # soʻm / m²


def _narx(kalit, narxlar, kurs):
    """Material qatori narxi, $ (bizning birlikda). Narx yoʻq boʻlsa None."""
    bolim, artikul, izoh, _ = kalit
    if bolim in ("Profil", "Profil otxod"):
        profil = narx_kaliti(artikul)
        hivich = profil_narxi(narxlar, profil, izoh)
        return None if hivich is None else hivich / hivich_metr(profil, narxlar["hivich_m"])
    if bolim == "Oyna":
        tur = narxlar.get("steklopaket_som", {}).get(artikul, {})
        som = tur.get(str(izoh))
        if som is None and str(izoh) == "20" and tur.get("24"):
            # Aldoks 20 mm paket = 24 mm narxidan 5 000 soʻm arzon (foydalanuvchi, 2026-11-11)
            som = tur["24"] - OYNA_20_ARZON
        return None if not som else som / kurs
    if artikul == "01.553":
        komp = narxlar["narx"].get("Soedinitel Urta 19 ugl")
        return None if komp is None else komp / 4
    if artikul in (ARKA_OYNA, LAPSHA_SAMOREZ, MEDVED_SAMOREZ):
        som = narxlar["narx"].get(artikul)
        return None if som is None else som / kurs
    if artikul == "K188":
        return narxlar["k188_tuba_narx"] / narxlar["k188_tuba_g"]
    return narxlar["narx"].get(artikul)


# Yolgʻiz otxod keshi (ilovada Pyodide xotirasida qoladi): konstruktor bir konstruksiyani hisoblaganda
# yozadi, zakaz hisobi qayta ishlatadi — bitta konstruksiya ikki marta kesib koʻrilmaydi.
_YOLGIZ_KESH = {}
_KESH_CHEGARA = 500


def _yolgiz_otxod(umumiy, k, otxod_usuli, sklad, sklad_kalit):
    """Konstruksiya (oʻz soni bilan) yolgʻiz zakaz boʻlsa: {"Profil otxod" kaliti: metr, 1 dona uchun}."""
    kalit = json.dumps([umumiy, {a: b for a, b in k.items() if a != "nom"}, otxod_usuli, sklad_kalit],
                       sort_keys=True, ensure_ascii=False)
    if kalit not in _YOLGIZ_KESH:
        if len(_YOLGIZ_KESH) >= _KESH_CHEGARA:
            _YOLGIZ_KESH.clear()
        _, _, miq, _ = hisobla_zakaz({"umumiy": umumiy, "konstruksiyalar": [k]}, otxod_usuli, sklad)
        _YOLGIZ_KESH[kalit] = {q: u[0] for q, u in miq.items() if q[0] == "Profil otxod"}
    return _YOLGIZ_KESH[kalit]


def _yolgiz_bolish(zakaz, faol, miqdorlar, narxlar, kurs, otxod_usuli, sklad):
    """Otxod boʻlish C qoidasi (foydalanuvchi, 2026-11-15): zakazdagi jami otxod ($) konstruksiyalarga
    ularning yolgʻiz hisobdagi otxodiga mutanosib — har konstruksiya otxodi = yolgʻiz otxodi × c,
    c = zakaz otxodi / Σ yolgʻiz otxod (soni bilan). Jami oʻzgarmaydi; birga kesish otxodni
    kamaytirsa (c ≤ 1) hech bir konstruksiya yolgʻizdagidan qimmat chiqmaydi.
    "Profil otxod" qatorlari konstruksiyalarga yolgʻiz tuzilishi × c bilan qayta yoziladi
    (profil qatori jami haqiqiy kesishdan biroz farq qilishi mumkin — qabul qilingan)."""
    umumiy = zakaz.get("umumiy", {})
    sklad_kalit = json.dumps(sklad, sort_keys=True, ensure_ascii=False) if sklad else None
    yol = [_yolgiz_otxod(umumiy, k, otxod_usuli, sklad, sklad_kalit) for k in faol]
    sonlar = [k.get("soni", 1) for k in faol]
    narx = {}
    for q in set(q for q in miqdorlar if q[0] == "Profil otxod").union(*[set(y) for y in yol]):
        narx[q] = _narx(q, narxlar, kurs) or 0
    zakazda = sum(narx[q] * sum(m * s for m, s in zip(miqdorlar.get(q, []), sonlar)) for q in narx)
    yolgiz = sum(narx[q] * y.get(q, 0) * s for y, s in zip(yol, sonlar) for q in narx)
    if yolgiz <= 0 or zakazda < 0:  # otxodsiz usul yoki sklad_tekin manfiy otxodi: metr boʻyicha qoladi
        return
    c = zakazda / yolgiz
    for q in narx:
        miqdorlar[q] = [round(y.get(q, 0) * c, 6) for y in yol]


def tannarx(zakaz, narxlar=None, kurs=None, otxod_usuli=None, sklad=None, otxod_bolish="metr"):
    """Zakazni hisoblaydi. soni = 0 boʻlgan konstruksiya hisobga kirmaydi.

    otxod_usuli: raskroy.OTXOD_USULLARI kaliti (standart "chegara"); sklad: sklad varagʻi qatorlari (sklad usullari uchun).
    otxod_bolish: "metr" — har profil otxodi ishlatilgan metrga mutanosib (Sheets zakaz varagʻi qoidasi);
    "yolgiz" — C qoida, ilova (konstruktor va zakaz kartasi) ishlatadi, qarang `_yolgiz_bolish`.
    """
    from raskroy import OTXOD_USULLARI, STANDART_USUL, STRAXOVKA

    otxod_usuli = otxod_usuli or STANDART_USUL
    ogoh_usul = []
    if otxod_usuli.startswith("sklad") and not sklad:
        ogoh_usul.append("Sklad yuklanmagan: otxod chegara usulida hisoblandi")
        otxod_usuli = STANDART_USUL

    narxlar = narxlar or narxlarni_oqi()
    kurs = float(kurs or narxlar.get("kurs") or 0)
    if kurs <= 0:
        raise HisobXato("Kurs kiritilmagan")
    hammasi = zakaz.get("konstruksiyalar") or []
    faol = [k for k in hammasi if k.get("soni", 1) != 0]
    if not faol:
        raise HisobXato("Hisoblanadigan konstruksiya yoʻq (hammasining soni 0)")
    konstruksiyalar, oynalar, miqdorlar, otxod = hisobla_zakaz({**zakaz, "konstruksiyalar": faol}, otxod_usuli, sklad)
    if otxod_bolish == "yolgiz" and len(faol) > 1:
        _yolgiz_bolish(zakaz, faol, miqdorlar, narxlar, kurs, otxod_usuli, sklad)
    elif otxod_bolish not in ("metr", "yolgiz"):
        raise HisobXato(f"Otxod boʻlish usuli notoʻgʻri: {otxod_bolish}")
    n = len(konstruksiyalar)

    materiallar, bir_dona, narx_yoq = [], [0.0] * n, []
    for kalit, ustun in miqdorlar.items():
        narx = _narx(kalit, narxlar, kurs)
        jami = sum(m * k["soni"] for m, k in zip(ustun, konstruksiyalar))
        if narx is None:
            narx_yoq.append(f"{kalit[1]} {kalit[2]}".strip())
        else:
            for i, m in enumerate(ustun):
                bir_dona[i] += m * narx
        materiallar.append({
            "bolim": kalit[0], "artikul": kalit[1], "izoh": kalit[2], "birlik": kalit[3],
            "jami": round(jami, 6), "narx": narx,
            "summa": None if narx is None else round(jami * narx, 6),
            "bir_dona": ustun,
        })
    royxat = []
    for k, b in zip(konstruksiyalar, bir_dona):
        dona = b * (1 + STRAXOVKA)
        royxat.append({**k, "bir_dona_usd": round(dona, 2), "jami_usd": round(dona * k["soni"], 2)})
    mat = sum(m["summa"] for m in materiallar if m["summa"] is not None)
    jami_usd = round(mat * (1 + STRAXOVKA), 2)
    return {
        "konstruksiyalar": royxat,
        "olib_tashlangan": [k.get("nom") for k in hammasi if k.get("soni", 1) == 0],
        "oynalar": oynalar,
        "oyna_m2": round(sum(o["en"] * o["boy"] * o["soni"] * k["soni"] / 10000
                             for o in oynalar for k in [konstruksiyalar[o["i"]]]), 3),
        "materiallar": materiallar,
        "otxod": otxod,
        "materiallar_usd": round(mat, 2),
        "straxovka_usd": round(mat * STRAXOVKA, 2),
        "jami_usd": jami_usd,
        "kurs": kurs,
        "jami_som": round(mat * (1 + STRAXOVKA) * kurs),
        "narx_yoq": narx_yoq,
        "otxod_usuli": otxod_usuli,
        "otxod_usuli_nomi": OTXOD_USULLARI[otxod_usuli],
        "ogohlantirish": ogoh_usul + [f"{k['nom']}: {k['izoh']}" for k in konstruksiyalar if k["izoh"]] + [
            f"{o['profil']}: otxod chegarasi yoʻq" for o in otxod if o["chegara_yoq"]] + [
            f"{o['profil']}: rangi belgilanmagan konstruksiya, sklad ishlatilmadi"
            for o in otxod if otxod_usuli.startswith("sklad") and not o.get("sklad_rang")],
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) not in (2, 3):
        sys.exit("Ishlatish: python tannarx.py zakaz.json [kurs]")
    try:
        natija = tannarx(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")),
                         kurs=sys.argv[2] if len(sys.argv) == 3 else None)
    except HisobXato as e:
        sys.exit(f"Xato: {e}")
    for k in natija["konstruksiyalar"]:
        print(f"{k['nom']}: {k['L']} × {k['H']}, {k['soni']} dona, 1 dona {k['bir_dona_usd']} $, jami {k['jami_usd']} $")
    print(f"Materiallar {natija['materiallar_usd']} $ + straxovka {natija['straxovka_usd']} $")
    print(f"JAMI {natija['jami_usd']} $ / {natija['jami_som']:,} soʻm".replace(",", " "))
    if natija["narx_yoq"]:
        print("Narxi yoʻq:", ", ".join(natija["narx_yoq"]))
