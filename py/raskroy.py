"""Zakazdagi hamma konstruksiya detallarini profil boʻyicha jamlab, sklad qoldigʻidan boshlab kesish rejasini tuzadi.

Ishga tushirish:
  python raskroy.py zakaz.json sklad.json "alux" natija.pdf
sklad.json: Dodorom_sklad "BKT 70" varagʻi qatorlari, [[nom, rang, soni, oʻlcham_metr], ...]
Oʻlchamlar sm da. Sklad jadvaliga bu dastur yozmaydi.
"""
import json
import sys
from collections import Counter
from math import ceil
from pathlib import Path

from hisob import HisobXato, hisobla
from zakaz import _birlashtir

HIVICH = 650
ARRA = 0.4
QOLDIQ_CHEGARA = 10
# BKT 70 da hamma profil aylantirmasdan kesiladi (foydalanuvchi, 2026-11-03).
# Boshqa tizimga kerak boʻlsa: {"profil": qoʻshiladigan sm}.
AYLANTIRISH = {}
# Bu profillarda sklad boʻlagi qoldigʻi 10 sm dan oshsa ham olinadi:
# A701 ning 190 sm dan kichigi baribir ishlatilmaydi (foydalanuvchi, 2026-11-03).
CHEGARASIZ = {"A701"}
TOGRI_KESIM = {"M702", "A701", "H702"}  # 90°
SKLAD_NOMI = {
    "F702": "Kosa F702", "F703": "Kosa F703", "M702": "O'rta M702", "V702": "Qanot V702",
    "V707": "Balkon o'rta V707", "V708": "Balkon qanot V708", "A701": "Shtulp A701", "H702": "Lapsha lam",
}
TARTIB = ["F702", "F703", "V702", "V707", "V708", "M702", "A701", "H702", "G24", "G24-R", "G32", "G32-R"]


def _b(x):
    """sm → butun yuzdan bir sm (kasr xatosiz hisob uchun)."""
    return int(round(float(x) * 100))


def _k(x):
    return f"{x / 100:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def detallarni_yig(zakaz):
    """(konstruksiya roʻyxati, {profil: Counter({uzunlik_b: soni})})."""
    umumiy = zakaz.get("umumiy", {})
    royxat, jami = [], {}
    for i, el in enumerate(zakaz.get("konstruksiyalar") or []):
        nom = el.get("nom") or f"K{i + 1}"
        soni = el.get("soni", 1)
        k = _birlashtir(umumiy, {a: b for a, b in el.items() if a not in ("nom", "soni")})
        try:
            n = hisobla(k)
        except (HisobXato, KeyError) as e:
            raise HisobXato(f"{nom}: {e}") from e
        royxat.append({"nom": nom, "soni": soni, "L": k["L"], "H": k["H"], "detallar": n["profillar"]})
        for d in n["profillar"]:
            jami.setdefault(d["profil"], Counter())[_b(d["uzunlik"])] += d["soni"] * soni
    if not royxat:
        raise HisobXato("Zakazda konstruksiya yoʻq")
    return royxat, jami


def _sklad_nom(nom):
    """Skladdagi nomni umumiy shaklga keltiradi: rang nomdan olib tashlanadi, u alohida ustunda turadi."""
    nom = str(nom).strip()
    if nom.lower() == "kosa 702 oq":
        return "Kosa F702"
    return nom[:-5].strip() if nom.lower().endswith(" 306g") else nom


def sklad_bolaklari(qatorlar, profil, rang):
    """Shu profil va rangdagi boʻlaklar (sm_b) va hisobga olinmagan qatorlar haqida izoh."""
    nom = SKLAD_NOMI.get(profil)
    bolak, izoh = [], []
    if nom is None:
        return bolak, izoh
    for q in qatorlar:
        q = list(q) + [""] * (4 - len(q))
        if _sklad_nom(q[0]) != nom or str(q[1]).strip().lower() != rang.strip().lower():
            continue
        try:
            soni = int(float(str(q[2]).replace(",", ".")))
        except ValueError:
            continue
        matn = str(q[3]).replace(",", ".").strip()
        if not matn:
            izoh.append(f"{nom} ({q[1]}) × {soni}: oʻlchami yozilmagan, olinmadi")
            continue
        metr = float(matn)
        if metr * 100 > HIVICH:
            izoh.append(f"{nom} ({q[1]}) × {soni}: {matn} m hivichdan uzun, xato boʻlishi mumkin, olinmadi")
            continue
        bolak.extend([_b(metr * 100)] * soni)
    return sorted(bolak), izoh


def _vazn(d, profil):
    o = AYLANTIRISH.get(profil)
    return d - _b(o) if o else d + _b(ARRA)


def _sigim(L, profil):
    o = AYLANTIRISH.get(profil)
    return L - _b(o) if o else L


def _eng_toliq(qolgan, profil, L):
    """Boʻlakni eng toʻliq toʻldiradigan toʻplam: {uzunlik: soni}."""
    sigim = _sigim(L, profil)
    turlar = sorted(((d, _vazn(d, profil), n) for d, n in qolgan.items() if n > 0), key=lambda t: -t[1])
    eng = {"yuk": 0, "t": {}}
    tugun = [0]

    def izla(i, yuk, tanlov):
        if yuk > eng["yuk"]:
            eng["yuk"], eng["t"] = yuk, dict(tanlov)
        tugun[0] += 1
        if i == len(turlar) or tugun[0] > 200000 or eng["yuk"] == sigim:
            return
        d, v, n = turlar[i]
        for s in range(min(n, (sigim - yuk) // v), -1, -1):
            if s:
                tanlov[d] = s
            else:
                tanlov.pop(d, None)
            izla(i + 1, yuk + s * v, tanlov)
        tanlov.pop(d, None)

    izla(0, 0, {})
    return eng["t"]


def _ffd(qolgan, profil, L):
    bins = []
    for d in sorted(qolgan, reverse=True):
        for _ in range(qolgan[d]):
            v = _vazn(d, profil)
            for b in bins:
                if b["yuk"] + v <= _sigim(L, profil):
                    b["yuk"] += v
                    b["t"][d] = b["t"].get(d, 0) + 1
                    break
            else:
                bins.append({"yuk": v, "t": {d: 1}})
    return [b["t"] for b in bins]


def _aniq(qolgan, profil, L, k, chegara=300000):
    """Detallarni aynan k ta hivichga joylab koʻradi; topilmasa None."""
    sigim = _sigim(L, profil)
    detal = sorted(qolgan.elements(), reverse=True)
    bins = [{"yuk": 0, "t": {}} for _ in range(k)]
    tugun = [0]

    def joyla(i):
        if i == len(detal):
            return True
        tugun[0] += 1
        if tugun[0] > chegara:
            return False
        d, v = detal[i], _vazn(detal[i], profil)
        korilgan = set()
        for b in bins:
            if b["yuk"] in korilgan or b["yuk"] + v > sigim:
                continue
            korilgan.add(b["yuk"])
            b["yuk"] += v
            b["t"][d] = b["t"].get(d, 0) + 1
            if joyla(i + 1):
                return True
            b["yuk"] -= v
            b["t"][d] -= 1
            if not b["t"][d]:
                del b["t"][d]
        return False

    return [b["t"] for b in bins if b["t"]] if joyla(0) else None


def _yangi_variantlar(qolgan, profil):
    """Faqat yangi hivichdan kesish variantlari: ochkoʻz, FFD va eng kam hivichli aniq joylash."""
    L = HIVICH * 100
    greedy, q2 = [], Counter(qolgan)
    while sum(q2.values()):
        t = _eng_toliq(q2, profil, L)
        q2.subtract(t)
        q2 = Counter({d: n for d, n in q2.items() if n > 0})
        greedy.append(t)
    variantlar = [greedy, _ffd(qolgan, profil, L)]
    past = ceil(sum(_vazn(d, profil) * n for d, n in qolgan.items()) / _sigim(L, profil))
    for k in range(past, min(len(v) for v in variantlar)):
        topildi = _aniq(qolgan, profil, L, k)
        if topildi:
            variantlar.append(topildi)
            break
    return variantlar


# Narx uchun: qoldiq shu uzunlikdan (sm) kichik boʻlsa otxod, rasxotga qoʻshiladi (foydalanuvchi, 2026-11-03)
OTXOD_CHEGARA = {
    "A701": 190, "V702": 60, "F702": 70, "F703": 70, "V707": 65, "V708": 65,
    "G24": 40, "G24-R": 180, "M702": 100, "H702": 220,
    "G32": 60, "G32-R": 180,  # foydalanuvchi, 2026-11-04
}
STRAXOVKA = 0.03  # butun tannarxga: ish xatosi va kutilmagan rasxot uchun (foydalanuvchi, 2026-11-03)


def otxod_hisobi(profil, kerak):
    """Skladsiz raskroy: sarflangan uzunlik = hivichlar − ishlatsa boʻladigan qoldiqlar (sm_b)."""
    qolgan = Counter({d: n for d, n in kerak.items() if n > 0})
    if max(qolgan) > HIVICH * 100:
        raise HisobXato(f"{profil}: {_k(max(qolgan))} sm detal hivichdan uzun")
    chegara = OTXOD_CHEGARA.get(profil)
    chegara_b = HIVICH * 100 if chegara is None else _b(chegara)
    L = HIVICH * 100

    def sarf(v):
        return sum(L - q if q >= chegara_b else L for q in (_qoldiq(L, t, profil) for t in v))

    eng = min(_yangi_variantlar(qolgan, profil), key=lambda v: (sarf(v), len(v)))
    return {
        "profil": profil,
        "hivich": len(eng),
        "ishlatilgan": sum(d * n for d, n in qolgan.items()),
        "sarf": sarf(eng),
        "qoldiqlar": sorted(_qoldiq(L, t, profil) for t in eng),
        "chegara_yoq": chegara is None,
    }


def _qoldiq(L, t, profil):
    return L - sum(_vazn(d, profil) * n for d, n in t.items())


def profil_rejasi(profil, kerak, sklad=()):
    """Bitta profil rejasi: sklad boʻlaklari kichigidan, keyin yangi hivichlar."""
    qolgan = Counter(kerak)
    kartalar, ishlatilmagan = [], []
    for L in sorted(sklad):
        t = _eng_toliq(qolgan, profil, L) if sum(qolgan.values()) else {}
        if not t:
            ishlatilmagan.append((L, "sigʻadigan detal yoʻq"))
            continue
        q = _qoldiq(L, t, profil)
        if q > _b(QOLDIQ_CHEGARA) and profil not in CHEGARASIZ:
            ishlatilmagan.append((L, f"qoldiq {_k(q)} sm chiqadi, 10 dan katta"))
            continue
        qolgan.subtract(t)
        kartalar.append({"manba": "SKLAD", "L": L, "t": t, "qoldiq": q})

    qolgan = Counter({d: n for d, n in qolgan.items() if n > 0})
    if qolgan and max(qolgan) > HIVICH * 100:
        raise HisobXato(f"{profil}: {_k(max(qolgan))} sm detal hivichdan uzun")
    yangi = min(_yangi_variantlar(qolgan, profil), key=len) if qolgan else []
    for t in yangi:
        kartalar.append({"manba": "YANGI", "L": HIVICH * 100, "t": t, "qoldiq": _qoldiq(HIVICH * 100, t, profil)})

    kesilgan = Counter()
    for k in kartalar:
        kesilgan.update(k["t"])
    assert kesilgan == Counter(kerak), (profil, kesilgan, kerak)
    yuk = sum(_vazn(d, profil) * n for d, n in qolgan.items())
    return {
        "profil": profil,
        "kartalar": _birlashtir_karta(kartalar),
        "yangi_soni": len(yangi),
        "pastki_chegara": ceil(yuk / _sigim(HIVICH * 100, profil)) if yuk else 0,
        "ishlatilmagan": ishlatilmagan,
    }


def _birlashtir_karta(kartalar):
    guruh = {}
    for k in kartalar:
        kalit = (k["manba"], k["L"], tuple(sorted(k["t"].items(), reverse=True)))
        guruh.setdefault(kalit, {**k, "soni": 0})["soni"] += 1
    return sorted(guruh.values(), key=lambda k: (k["manba"] != "SKLAD", k["L"] if k["manba"] == "SKLAD" else k["qoldiq"]))


# Sklad rangi → narx turkumi (foydalanuvchi, 2026-11-03): oq alohida, 306g svetnoy, qolgani laminatsiya.
SKLAD_TURKUM = {"oq": "Oq", "306g": "Svetnoy (kraska)"}


def rang_turkumi(sklad_rangi):
    return SKLAD_TURKUM.get(sklad_rangi.strip().lower(), "Laminatsiya")


def sklad_rangini_aniqla(rang, zakaz_rangi=None):
    """Turkum nomi berilsa sklad rangiga oʻgiradi; zakaz turkumi bilan mos kelmasa xato."""
    r = rang.strip()
    teskari = {v.lower(): k for k, v in SKLAD_TURKUM.items()}
    teskari["svetnoy"] = "306g"
    if r.lower() in teskari:
        r = teskari[r.lower()]
    elif r.lower() == "laminatsiya":
        raise HisobXato("Laminatsiyaning qaysi rangi? Sklad rangini yozing (z/d, d/m, sh/d, grey, alux …)")
    if zakaz_rangi and zakaz_rangi != rang_turkumi(r):
        raise HisobXato(f"Sklad rangi {r} — {rang_turkumi(r)}, zakaz esa {zakaz_rangi}")
    return r


def toliq_reja(zakaz, sklad_qatorlari, rang):
    rang = sklad_rangini_aniqla(rang, zakaz.get("umumiy", {}).get("tanlov", {}).get("rang"))
    royxat, jami = detallarni_yig(zakaz)
    rejalar, izohlar = [], []
    for p in sorted(jami, key=lambda x: TARTIB.index(x) if x in TARTIB else 99):
        bolak, izoh = sklad_bolaklari(sklad_qatorlari, p, rang)
        izohlar.extend(izoh)
        rejalar.append(profil_rejasi(p, jami[p], bolak))
    return {"rang": rang, "konstruksiyalar": royxat, "rejalar": rejalar, "izohlar": izohlar}


def _kesim_matni(profil):
    if profil in AYLANTIRISH:
        return f"45°, aylantirib: har detalga +{_k(_b(AYLANTIRISH[profil]))} sm"
    if profil in TOGRI_KESIM:
        return f"□ Toʻgʻri (90°) · Arra {_k(_b(ARRA))} sm"
    return f"45°, aylantirilmaydi · Arra {_k(_b(ARRA))} sm"


# Diller roʻyxatidagi nom (TREMO Bkt 70.jpg, 10.02.2026)
PROFIL_NOMI = {
    "F702": "Kosa (Sredniy)", "F703": "Kosa Shirokaya", "V707": "Balkon Urta", "V708": "Balkon Kanot",
    "M702": "Urta", "V702": "Kanot", "G24": "Shtapik", "G24-R": "Shtapik", "G32": "Shtapik", "G32-R": "Shtapik",
    "A701": "Shtulp", "H702": "Lapsha", "A703": "90-Gradus", "H701": "Usilitel",
}


def toliq_nom(profil):
    """'Kosa (Sredniy) F702' — nomi kodi oldida."""
    nom = PROFIL_NOMI.get(profil)
    return f"{nom} {profil}" if nom else profil


def fayl_nomi(profil):
    toza = "".join(ch if ch.isalnum() or ch == "-" else " " for ch in toliq_nom(profil))
    return "_".join(toza.split())


def pdflar_yoz(reja, papka, oldi):
    """Har profilga alohida PDF: <papka>/<oldi>_<profil>.pdf. Yaratilgan yoʻllar roʻyxatini qaytaradi."""
    papka = Path(papka)
    papka.mkdir(parents=True, exist_ok=True)
    yollar = []
    for r in reja["rejalar"]:
        yol = papka / f"{oldi}_{r['profil']}_{fayl_nomi(r['profil']).replace('_' + r['profil'], '')}.pdf"
        pdf_yoz(reja, r, yol, oldi.replace("_", " "))
        yollar.append(yol)
    return yollar


def pdf_yoz(reja, r, yol, sarlavha):
    """Bitta profil uchun kesish rejasi (ishchiga alohida varaq)."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    pdfmetrics.registerFont(TTFont("A", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("AB", "C:/Windows/Fonts/arialbd.ttf"))
    koʻk, sariq, kulrang = HexColor("#0D47A1"), HexColor("#E65100"), HexColor("#5F6368")
    W, H = A4
    M = 40
    c = canvas.Canvas(str(yol), pagesize=A4)

    def fon():
        c.setFillColor(HexColor("#EEF0F4"))
        c.rect(0, 0, W, H, stroke=0, fill=1)

    fon()
    y = [H - M]

    def joy(kerak):
        if y[0] - kerak < M:
            c.showPage()
            fon()
            y[0] = H - M

    def matn(t, shrift="A", olcham=11, rang=None, x=M):
        c.setFillColor(rang or HexColor("#202124"))
        c.setFont(shrift, olcham)
        c.drawString(x, y[0] - olcham, t)
        y[0] -= olcham + 5

    matn(f"{toliq_nom(r['profil'])} — kesish rejasi", "AB", 20, koʻk)
    matn(f"Zakaz: {sarlavha} · Rang: {reja['rang']} · Hivich {HIVICH / 100:g} m", olcham=11)
    belgi_izoh = " · □ — gradusga kesilmaydi (90°)" if r["profil"] in TOGRI_KESIM else ""
    matn(_kesim_matni(r["profil"]) + belgi_izoh, olcham=10, rang=kulrang)
    y[0] -= 6

    ustun_w = (W - 2 * M - 12) / 2
    for r in [r]:
        y[0] -= 2
        ustun, boshi = 0, y[0]
        pasti = y[0]
        for k in r["kartalar"]:
            qator = sorted(k["t"].items(), reverse=True)
            bal = 48 + 16 * len(qator)
            if ustun == 0 and y[0] - bal < M:
                c.showPage()
                fon()
                y[0] = H - M
                boshi = pasti = y[0]
            x = M + ustun * (ustun_w + 12)
            yuq = boshi
            if ustun == 1 and yuq - bal < M:
                c.showPage()
                fon()
                y[0] = H - M
                boshi = pasti = y[0]
                ustun, x, yuq = 0, M, boshi
            c.setFillColor(HexColor("#FFFFFF"))
            c.setStrokeColor(HexColor("#D5D8DE"))
            c.roundRect(x, yuq - bal, ustun_w, bal, 10, stroke=1, fill=1)
            y[0] = yuq - 8
            nom = f"YANGI {k['L'] / 100:g} sm hivich × {k['soni']} dona" if k["manba"] == "YANGI" \
                else f"SKLAD QOLDIQ {_k(k['L'])} sm × {k['soni']} dona"
            matn(nom, "AB", 12, koʻk, x + 10)
            belgi = "□ " if r["profil"] in TOGRI_KESIM else ""
            for d, n in qator:
                matn(f"{belgi}{_k(d)} × {n}", olcham=11, x=x + 10)
            matn(f"qoldiq: {_k(k['qoldiq'])} sm", "AB", 11, sariq, x + 10)
            pasti = min(pasti, yuq - bal)
            if ustun == 1:
                boshi, ustun = pasti - 10, 0
                pasti = boshi
            else:
                ustun = 1
        y[0] = (pasti if ustun == 1 else boshi) - 12

    joy(80)
    sklad = [k for k in r["kartalar"] if k["manba"] == "SKLAD"]
    jami_detal = sum(n * k["soni"] for k in r["kartalar"] for n in k["t"].values())
    c.setFillColor(HexColor("#E3F2FD"))
    c.roundRect(M, y[0] - 62, W - 2 * M, 62, 10, stroke=0, fill=1)
    y[0] -= 10
    matn(f"Jami yangi {HIVICH / 100:g} m hivich: {r['yangi_soni']} dona", "AB", 13, koʻk, M + 12)
    matn(f"Skladdan: {sum(k['soni'] for k in sklad)} boʻlak · Jami detal: {jami_detal} dona", olcham=11, x=M + 12)
    y[0] -= 18

    belgi = "□ " if r["profil"] in TOGRI_KESIM else ""
    joy(60)
    matn("Qaysi konstruksiyaga", "AB", 15, koʻk)
    for k in reja["konstruksiyalar"]:
        bu = [d for d in k["detallar"] if d["profil"] == r["profil"]]
        if not bu:
            continue
        joy(20 + 15 * len(bu))
        matn(f"{k['nom']}: {k['L']} × {k['H']} sm, {k['soni']} dona", "AB", 11)
        for d in bu:
            matn(f"{belgi}{d['nomi']}: {_k(_b(d['uzunlik']))} × {d['soni'] * k['soni']}", olcham=10, x=M + 10)
    c.save()


def hisobot_matni(reja):
    q = []
    for r in reja["rejalar"]:
        sklad = [k for k in r["kartalar"] if k["manba"] == "SKLAD"]
        q.append(f"{r['profil']}: yangi {r['yangi_soni']} (kamida {r['pastki_chegara']}), skladdan {sum(k['soni'] for k in sklad)}")
        for k in r["kartalar"]:
            bol = ", ".join(f"{_k(d)}×{n}" for d, n in sorted(k["t"].items(), reverse=True))
            q.append(f"  {k['manba']} {_k(k['L'])} × {k['soni']}: {bol}; qoldiq {_k(k['qoldiq'])}")
        for L, sabab in r["ishlatilmagan"]:
            q.append(f"  ishlatilmadi {_k(L)}: {sabab}")
    q.extend("IZOH: " + x for x in reja["izohlar"])
    return "\n".join(q)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 6:
        sys.exit('Ishlatish: python raskroy.py zakaz.json sklad.json "rang" papka "Z-001_Mijoz"')
    try:
        natija = toliq_reja(
            json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")),
            json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")),
            sys.argv[3],
        )
        yollar = pdflar_yoz(natija, sys.argv[4], sys.argv[5])
    except HisobXato as e:
        sys.exit(f"Xato: {e}")
    print(hisobot_matni(natija))
    print("PDF:", *yollar, sep="\n  ")
