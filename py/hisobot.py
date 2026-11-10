"""Konstruksiyadan aksessuar roʻyxati, tannarx va qisqa hisobot chiqaradi.

Ishga tushirish: python hisobot.py konstruksiya.json [narxlar.json]
"""
import json
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from hisob import (ARMATURA_SAMOREZ, REZINA_CHET, REZINA_QANOT, D, HisobXato, hisobla, hivich_metr, narx_kaliti,
                   profil_narxi)

PETLYA_CHEGARA = 260
K188_BURCHAKKA_G = 7
PENA_METRGA = D("0.1")
ASOSIY_PETLYA = "(A8060) 2SK TERMO Petlya (Tr)"
ASOSIY_SHPINGALET = "A4514.23"
ROM_RUCHKA = "(A6004) Ruchka CREMONE"
ROM_KONNEKTOR = "(A6401.1) Ruchka Konnektor"
ROM_PETLYA = "(A9211.3) 2SK TERMO Petlya (Tr)"
ROM_TIJ = "(A2010.2) Poliamid Tij (Qora)"
TIJ_AYIRMA = D(25)  # tij = tabaqa boʻyi − 25 sm (ProfOkna, A6004 li loyihalar)
# Dvaynoy (povorot-otkidnoy) dona boʻyicha (foydalanuvchi, 2026-11-05); komplekt ishlatilmaydi
DVAYNOY_RUCHKA = "(A6011.10) Ruchka COMFORT Okon Dv. Otk"
DVAYNOY_MEXANIZM = "(A3420F.1) Dv. Otk 160kg"
NOJNITSA_SREDNIY = "(A3400.21) Nojnitsa Sredniy"
NOJNITSA_DLINNIY = "(A3400.22) Nojnitsa Dlinniy"
NOJNITSA_CHEGARA = D(65)  # tabaqa eni 65 sm gacha — sredniy, kattasi — dlinniy (ProfOkna, tasdiqlangan)
# Master "Ween" T&T qogʻozi (foydalanuvchi, 2026-11-09): nojnitsa .21 37–65 (Masterda 37–45 uchun 3400.20, foydalanuvchi .21 oladi), .22 65,1–120 sm;
# prijim (3420F.31) boʻyi 140 dan baland; 3400F.32 boʻyi 220 dan baland; 120 dan keng — qoʻyib boʻlmaydi
DVAYNOY_EN_MIN, DVAYNOY_EN_MAX = D(37), D(120)
DVAYNOY_BOY_MIN, DVAYNOY_BOY_MAX = D(50), D(270)
DVAYNOY_BALAND_BOY = D(220)  # Master 3400F.32 = rolikli zapor 4207.1 (foydalanuvchi) → zatsep + 1
# Fortochka (foydalanuvchi, 2026-11-05; ProfOkna "откидная створка")
CHIT_CHIT = "(A1501.5) Chit-Chit"
OGRANICHITEL = {"kichik": "(A1115.2) Ogranichitel", "katta": "(A1115.1) Ogranichitel"}  # boʻyi 60 sm gacha / kattasi (ProfOkna)
# Termo zatsepi hamma joyda A4207.1 (foydalanuvchi, 2026-11-05; avval A3520.32 edi)
ZATSEP = "Termo Zatsep (4207)"
FORTOCHKA_ZATSEP = ZATSEP  # ruchkali fortochkada 2 ta
FORTOCHKA_PETLYA_EN = D(100)  # eni 1 m dan katta — 3 petlya, aks holda 2
DVAYNOY_PRIJIM = "Dvaynoy uchun Prijiim (zatsepi bilan)"
DVAYNOY_PRIJIM_BOY = D(140)  # Master: H > 1400 mm (avval ProfOkna 120)
# Burchak soedineli, katalog "Установка угловых соединителей": har burchakka bittadan
RAMA_BURCHAGI = {"F702": ["263 W02", "108 W02"], "F703": ["263 W03", "108 W03"]}
TABAQA_BURCHAGI = {"V702": ["184 W02", "078 W02"], "V707": ["184 M535", "078 M535"], "V708": ["184 M535", "078 M535"]}
IMPOST_UGOL = "ugol"  # asosiy: 01.553 (19 mm ugol soedinitel), har uchiga 2 ta
# Termo soedinitel (01.553, J01+J05) samorezi — armatura samorezi bilan bitta:
# "Samarez IDEAL 3.9*16mm YHB (1000) (Tr)" 3,33 (foydalanuvchi, 2026-11-10; avval 3,9×19)
SOEDINITEL_SAMOREZ = ARMATURA_SAMOREZ

IMPOST_J = "J01+J05"  # tanlov: katalog 9-12
TIJ_AYIRMA_ESHIK ={"Stublina 1177": D(50), "Stublina 1177 (Uz)": D(50)}  # foydalanuvchi tasdiqlagan, 2026-11-02


PODOKONNIK_ENLARI = (15, 20, 25, 30, 35, 40, 45)  # sm, Romchidagidek tanlov (foydalanuvchi, 2026-11-06)
PODOKONNIK_ZAPAS = D(15)                          # uzunlik = L + 15 sm
PODOKONNIK_KRISHKA = "Krishka Podokonnik"         # har podokonnikka 2 dona
ARKA_EGISH = "Arka egish"        # $ / m egiladigan profil
MEDVED_SAMOREZ = "Medved samorez soʻm"   # montaj samorezi, dona, soʻmda (foydalanuvchi, 2026-11-09: 1 300 soʻm)
LAPSHA_SAMOREZ = "Lapsha samorez soʻm"   # dona, soʻmda (foydalanuvchi, 2026-11-09: 300 soʻm), kursga boʻlinadi
ARKA_OYNA = "Arka oyna soʻm"     # soʻm / m² arkali oyna ustamasi (narx soʻmda, kursga boʻlinadi)


def _pul(x):
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class Royxat:
    def __init__(self, narx):
        self.narx = narx
        self.qatorlar = []
        self.narx_yoq = []
        self.jami = D(0)

    def _yoz(self, bolim, nomi, miqdor, birlik, summa, kalit):
        if summa is None:
            if kalit not in self.narx_yoq:
                self.narx_yoq.append(kalit)
        else:
            self.jami += summa
        self.qatorlar.append(
            {"bolim": bolim, "nomi": nomi, "miqdor": miqdor, "birlik": birlik, "summa": summa}
        )

    def qosh(self, bolim, nomi, miqdor, birlik, kalit=None, komplekt=1):
        """Narx kalit boʻyicha olinadi; komplekt: bir narxga nechta dona toʻgʻri keladi."""
        kalit = kalit or nomi
        narx = self.narx.get(kalit)
        summa = None if narx is None else D(miqdor) * D(narx) / komplekt
        self._yoz(bolim, nomi, D(miqdor), birlik, summa, kalit)

    def summa_bilan(self, bolim, nomi, miqdor, birlik, summa, kalit):
        self._yoz(bolim, nomi, D(miqdor), birlik, summa, kalit)


def _kerak(tanlov, kalit, nomi):
    qiymat = tanlov.get(kalit)
    if qiymat in (None, ""):
        raise HisobXato(f"{nomi} tanlanmagan")
    return qiymat




def _profillar(n, rang, narxlar, r):
    jami_metr = {}
    for p in n["profillar"]:
        artikul = narx_kaliti(p["profil"])
        jami_metr[artikul] = jami_metr.get(artikul, D(0)) + D(p["uzunlik"]) * p["soni"] / 100
    for artikul, metr in jami_metr.items():
        hivich = profil_narxi(narxlar, artikul, rang)
        summa = None if hivich is None else metr * D(hivich) / D(hivich_metr(artikul, narxlar["hivich_m"]))
        r.summa_bilan("Profil", artikul, metr, "m", summa, f"{artikul} ({rang})")


def _rezina(s, r):
    markaziy = D(s["markaziy_rezina"]) / 100
    oyna = D(s["oyna_rezinasi"]) / 100
    r.qosh("Rezina", "A01-005", markaziy, "m")
    r.qosh("Rezina", "A01-003", markaziy * 2, "m")
    r.qosh("Rezina", "A01-002", oyna, "m")
    r.qosh("Rezina", "EPDM Rezina Ю", oyna, "m")


def _aksessuar(s, narxlar, r, tanlov=None):
    tanlov = tanlov or {}
    # Burchak soedineli dona boʻyicha, katalog 9-1, 9-2, 9-4 (foydalanuvchi, 2026-11-04)
    burchaklar = {}
    for jadval, sanoq in ((RAMA_BURCHAGI, s["ramalar"]), (TABAQA_BURCHAGI, s["tabaqalar"])):
        for profil, soni in sanoq.items():
            if profil not in jadval:
                raise HisobXato(f"{profil} uchun burchak soedineli katalogdan kiritilmagan")
            for kod in jadval[profil]:
                burchaklar[kod] = burchaklar.get(kod, 0) + 4 * soni
    for kod, soni in burchaklar.items():
        r.qosh("Aksessuar", kod, soni, "dona")
    # Yarim aylana ramasi: har burchakka (2 ta) ugl soedinitel 01.553 bittadan (foydalanuvchi, 2026-11-07)
    seg = s.get("segment_ramalar", 0)
    if seg:
        r.qosh("Aksessuar", "01.553", 2 * seg, "dona", kalit="Soedinitel Urta 19 ugl", komplekt=4)
        r.qosh("Aksessuar", SOEDINITEL_SAMOREZ, 2 * seg * 2, "dona")
    rama_soni, tabaqa_soni = sum(s["ramalar"].values()), sum(s["tabaqalar"].values())
    r.qosh("Aksessuar", "A10-001", 4 * rama_soni, "dona")
    if tabaqa_soni:
        r.qosh("Aksessuar", "A10-002", 4 * tabaqa_soni, "dona")
        r.qosh("Aksessuar", "A10-003", 4 * tabaqa_soni, "dona")
    burchak = 4 * (rama_soni + tabaqa_soni)
    kley_g = D(burchak * K188_BURCHAKKA_G)
    kley_summa = kley_g * D(narxlar["k188_tuba_narx"]) / D(narxlar["k188_tuba_g"])
    r.summa_bilan("Aksessuar", "K188 kley", kley_g, "g", kley_summa, "K188")
    if s["impost_soni"]:
        tur = tanlov.get("impost_soedinitel") or IMPOST_UGOL
        if tur == IMPOST_UGOL:
            soedinitel = 4 * s["impost_soni"]  # har uchiga 2 ta
            r.qosh("Aksessuar", "01.553", soedinitel, "dona", kalit="Soedinitel Urta 19 ugl", komplekt=4)
            r.qosh("Aksessuar", SOEDINITEL_SAMOREZ, soedinitel * 2, "dona")
        elif tur == IMPOST_J:
            # Katalog 9-12: M702 uchiga 236 J01 + 236 J05, bittadan
            r.qosh("Aksessuar", "236 J01", 2 * s["impost_soni"], "dona")
            r.qosh("Aksessuar", "236 J05", 2 * s["impost_soni"], "dona")
            # impostning bir uchiga 2 ta samorez (01.553 da 4 ta) (foydalanuvchi, 2026-11-04)
            r.qosh("Aksessuar", SOEDINITEL_SAMOREZ, 2 * s["impost_soni"] * 2, "dona")
        else:
            raise HisobXato(f"Impost soedineli notoʻgʻri: {tur} ({IMPOST_UGOL} yoki {IMPOST_J})")
    if s["tabaqa_oyna_soni"]:
        r.qosh("Aksessuar", "Takos Regulirovichniy (32mm)", s["tabaqa_oyna_soni"] * 2, "dona")
    if s["gluxoy_oyna_soni"]:
        r.qosh("Aksessuar", "CT 203", s["gluxoy_oyna_soni"] * 2, "dona")


# Engelberg 7000 aksessuari (foydalanuvchi, 2026-11-08). Burchak payvand — soedinitel va kley yoʻq.
ENG_SOEDINITEL = "Soedinitel 7000 (150sht) (Uz)"   # ProfStroy OKT 7000, impostning har uchiga 1 ta
ENG_SOEDINITEL_SAMOREZ = "3,9×25 YHBM"              # har soedinitelga 8 ta
# drenaj qopqogʻi = "Probka Sliva" (foydalanuvchi, 2026-11-09), har oyna ostiga 1 ta; rangga qarab
ENG_DRENAJ = {"Oq": "Probka Sliva (Oq) (Uz)", "Laminatsiya": "Probka Sliva (7016) (Uz)"}


def _eng_aksessuar(s, k, r):
    if s["impost_soni"]:
        soed = 2 * s["impost_soni"]
        r.qosh("Aksessuar", ENG_SOEDINITEL, soed, "dona")  # narx bir donaga (foydalanuvchi, 2026-11-09)
        r.qosh("Aksessuar", ENG_SOEDINITEL_SAMOREZ, soed * 8, "dona")
    # podstavka Termo 70 dagidek: gluxoyga CT 203 × 2, tabaqa oynasiga Takos (paket qalinligi boʻyicha) × 2
    if s["gluxoy_oyna_soni"]:
        r.qosh("Aksessuar", "CT 203", s["gluxoy_oyna_soni"] * 2, "dona")
    if s["tabaqa_oyna_soni"]:
        r.qosh("Aksessuar", f"Takos Regulirovichniy ({k.get('oyna_qalinligi', 24)}mm)", s["tabaqa_oyna_soni"] * 2, "dona")
    oyna = s["gluxoy_oyna_soni"] + s["tabaqa_oyna_soni"]
    if oyna:
        r.qosh("Aksessuar", ENG_DRENAJ.get((k.get("tanlov") or {}).get("rang"), ENG_DRENAJ["Laminatsiya"]), oyna, "dona")


# Engelberg 7000 rom tabaqasi furniturasi (foydalanuvchi, 2026-11-08). Ispanilet va zatsep — ProfOkna
# toʻplamlaridan: "Akfa 7000 Eco распашная створка (Fornax 13)" va "Akfa 7000 распашная створка (Roto)".
# Oʻlcham = tayyor qanot boʻyi − 2 quloq (2 × 2,2) = qanot kesish − 0,5 − 4,4, mm da. Konnektor va tij yoʻq.
ENG_QULOQ = D("2.2")
ENG_ISPANILET = {
    "fornax": [  # (dan, gacha mm, kod, zatsep, samorez)
        (221, 320, "F 180", 2, 6), (321, 440, "F 280", 2, 7), (441, 640, "F 400", 2, 7), (641, 840, "F 600", 2, 7),
        (841, 1040, "F 800", 2, 8), (1041, 1140, "F 1000", 3, 8), (1141, 1240, "F 1100", 3, 8),
        (1241, 1440, "F 1200", 3, 12), (1441, 1640, "F 1400", 4, 14), (1641, 1840, "F 1600", 4, 12),
        (1841, 2040, "F 1800", 4, 12), (2041, 2200, "F 2000", 4, 12)],
    "roto": [
        (251, 540, "R 251-500", 2, 8), (541, 840, "R 501-800", 2, 8), (841, 1140, "R 801-1100", 3, 10),
        (1141, 1440, "R 1101-1400", 3, 12), (1441, 1840, "R 1401-1800", 3, 14), (1841, 2400, "R 1801-2400", 4, 14)],
}
# Fortochka (ProfOkna "откидная створка"): ispanilet tabaqa ENIGA qarab; F 180 da zatsep 1, Roto 291 dan
ENG_ISPANILET_FORT = {
    "fornax": [(a, b, k, 1 if k == "F 180" else z, s) for a, b, k, z, s in ENG_ISPANILET["fornax"] if a <= 1641],
    "roto": [(291 if k == "R 251-500" else a, b, k, z, 12 if k == "R 801-1100" else s)
             for a, b, k, z, s in ENG_ISPANILET["roto"] if a <= 1441],
}
# Ogranichitel (foydalanuvchi, 2026-11-09): Uz — "gradus <sm>" fortochka boʻyiga qarab: qanot tayyor boʻyi − 4,4
# (= kesish − 4,9) 25 dan kichik — 20, 30 dan — 25, 35 dan — 30, aks holda 35. Kin Long — hozircha 12 (soʻraladi).
ENG_OGRANICHITEL = {"Uz": "Ogranichitel Dlya Fortochki gradus {} sm (Uz)", "Kinglong": "Ogranichitel Dlya Fortochki 12 (Kin Long)"}


def eng_ogranichitel(tur, boy_kesish):
    o = D(str(boy_kesish)) - D("4.9")
    sm = 20 if o < 25 else 25 if o < 30 else 30 if o < 35 else 35
    return ENG_OGRANICHITEL[tur].format(sm)


# Fornax oddiy ispaniletining diller nomi (foydalanuvchi, 2026-11-09): AKFA "Povorotniy Privod <kod>, <oraliq> (Uz)",
# oʻlcham mm boʻyicha (qanot kesish − 4,9 sm); zatsep va samorez soni ProfOkna Fornax jadvalidan qoladi
ENG_PRIVOD = [(281, 400, 280), (401, 600, 400), (601, 800, 600), (801, 1000, 800), (1001, 1200, 1000),
              (1201, 1400, 1200), (1401, 1600, 1400), (1601, 1800, 1600), (1801, 2000, 1800), (2001, 2200, 2000)]


def eng_privod(mm):
    for dan, gacha, kod in ENG_PRIVOD:
        if mm <= gacha + D("0.99"):
            return f"Povorotniy Privod {kod}, {dan}-{gacha} (Uz)"  # 281 dan kalta ham 280 (eng kichigi)
    raise HisobXato(f"Povorotniy Privod 2200 mm gacha: {mm} mm")
ENG_ISPANILET_NOMI = {"fornax": "Ispanilet Fornax", "roto": "Ispanilet Roto"}
ENG_ZATSEP = {"fornax": "(13) Zatsepka (FORNAX)", "roto": "Zatsepka (ROTO)"}
# Ruchka diller nomi bilan, rangi qavsda; Roto Lux: oq, bronza, toʻq jigarrang (foydalanuvchi, 2026-11-09)
ENG_RUCHKALAR = ["Ruchka Okon (ROTO LUX) (Oq) (Uz)", "Ruchka Okon (ROTO LUX) (Oq) (Tr)",
                 "Ruchka Okon (ROTO LUX) (Bronza) (Tr)", "Ruchka Okon (ROTO LUX) (Tem Kor) (Tr)",
                 "Ruchka Okon HOPPE NY (Oq) (Tr)", "Ruchka Okon HOPPE NY (Seriy) (Tr)",
                 "Ruchka Okon HOPPE NY (Bronza) (Tr)", "Ruchka Okon HOPPE NY (Tem Kor) (Tr)"]
ENG_PETLYA_PROSTOE = "(Prostoe Otkr) Petli Komplekt (FORNAX)"
# Petlya 100 mm rangga qarab (foydalanuvchi, 2026-11-09): oq — (Oq) (120sht), qolgani — (Laminant)
# har Petlya 100 mm ga samorez 3,9×38 × 8 (foydalanuvchi, 2026-11-10)
ENG_PETLYA_100_SAMOREZ = 8
ENG_PETLYA_100 = {"Oq": "Petlya 100 mm (Oq) (120sht) (Uz)", "Laminatsiya": "Petlya 100 mm (Laminant) (Uz)"}
ENG_BLOKIRATOR = ["Blokirator Na Rame (ROTO)", "Blokirator Na Stvorke (ROTO)"]
ENG_ISPANILET_SAMOREZ = "3,9×25 YHB S"  # ProfOkna: har ispaniletga jadvaldagicha, prijimga 4
# (Prostoe Otkr) Petli Komplekt: (3,9×38 soni, 3,9×25 soni) har komplektga (foydalanuvchi, 2026-11-10)
ENG_PROSTOE_SAMOREZ = (11, 4)
# Fortochka ogranichiteli (Uz, Kinglong): har biriga samorez 3,9×25 × 16 (foydalanuvchi, 2026-11-10)
ENG_OGRANICHITEL_SAMOREZ = 16
# Framujniy petlya komplekti: har komplektga samorez 3,9×38 × 6 (foydalanuvchi, 2026-11-10).
# Fortochkada ISHLATILMAYDI (foydalanuvchi, 2026-11-10) — qayerga qoʻyilishi hali aytilmagan, hisobga kirmaydi.
ENG_FRAMUGA_PETLYA = "Komplekt Petel Dlya Framujnoe Okna 13mm (Uz)"
ENG_FRAMUGA_PETLYA_SAMOREZ = 6
ENG_PRIJIM = "(13) Sredniy Prijim Skritiy (FORNAX)"  # framujniy; Prostoe Otkr bilan, qanot 100 sm dan baland


# Dvaynoy Fornax 13 (foydalanuvchi, 2026-11-09, diller roʻyxati): komplekt + ispanilet (boʻyi) + nojnitsa (eni)
# + oʻrta zamok (boʻyi) + petlya qopqogʻi (ruchka rangida) + zatsepka 3 + blokirator (ramaga) 1. Oʻlcham = kesish
# − 4,9 sm (mm); oraliqlar ustma-ust tushsa kichigi. Jadvaldan tashqari — dvaynoy qoʻyib boʻlmaydi.
# Samorez soni ProfOkna Fornax 13 dvaynoyidan: zapor 1225 mm gacha 12, balandi 14 (3,9×25); petlya qismlariga
# (tepa va past opora, qanot past petlyasi) 8 ta — "Samarez IDEAL 3.9*38mm YHB (500) (Tr)" 4,65
# (foydalanuvchi, 2026-11-10; ProfOknada 4,2×38). Shu samorez Petlya 100 mm ga ham, har biriga 8 ta.
ENG_DV_KOMPLEKT = "(13) KOMPLEKT Dvoy. Otkr (FORNAX)"
ENG_DV_ISPANILET = [(885, 1300), (1185, 1600), (1385, 1800), (1585, 2000), (1985, 2400)]
ENG_DV_NOJNITSA = [(395, 600), (595, 800), (795, 1000)]
ENG_DV_ZAMOK = [(700, 1150), (1150, 1500), (1350, 1800), (1850, 2100)]
ENG_DV_ZATSEP = 3
ENG_DV_BLOKIRATOR = "(13) Blokirator Ruchki Na Rame (FORNAX)"
ENG_PETLYA_SAMOREZ = "3,9×38 YHB"
ENG_DV_PETLYA_SAMOREZ_SONI = 8
ENG_KRISHKA_RANGLARI = ["Oq", "Bronza", "Seriy", "Tem Kor", "Mahagon", "Zol Dub"]


def _oraliq(mm, jadval):
    for dan, gacha in jadval:  # dan boʻyicha tartibda — ustma-ust tushsa kichigi
        if dan <= mm <= gacha:
            return f"{dan}-{gacha}"
    return None


def eng_krishka_rangi(ruchka):
    for rang in ENG_KRISHKA_RANGLARI:
        if f"({rang})" in ruchka:
            return rang
    return "Oq"  # rangsiz eski nom ("ROTO LUX (Uz)") — oq


def _eng_dvaynoy(dvaynoylar, ruchka, r):
    if not dvaynoylar:
        return 0
    isp, noj, zam = {}, {}, {}
    samorez = 0
    for en, boy in dvaynoylar:
        b = (boy - D("4.9")) * 10
        e = (en - D("4.9")) * 10
        i, n, z = _oraliq(b, ENG_DV_ISPANILET), _oraliq(e, ENG_DV_NOJNITSA), _oraliq(b, ENG_DV_ZAMOK)
        if i is None:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa boʻyi {b} mm — Fornax ispaniletlari 885–2400 mm")
        if n is None:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa eni {e} mm — Fornax nojnitsalari 395–1000 mm")
        if z is None:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa boʻyi {b} mm — Fornax oʻrta zamogʻi 700–2100 mm")
        for d, k in ((isp, i), (noj, n), (zam, z)):
            d[k] = d.get(k, 0) + 1
        samorez += 12 if b <= 1225 else 14
    soni = len(dvaynoylar)
    r.qosh("Furnitura", ENG_DV_KOMPLEKT, soni, "komplekt")
    for k, n in isp.items():
        r.qosh("Furnitura", f"Ispanilet {k} (FORNAX)", n, "dona")
    for k, n in noj.items():
        r.qosh("Furnitura", f"Komplekt Nojnits Rami I Stvorki {k} (FORNAX)", n, "komplekt")
    for k, n in zam.items():
        r.qosh("Furnitura", f"Zamok Sredniy {k} (FORNAX)", n, "dona")
    r.qosh("Furnitura", f"Krishka Petlya ({eng_krishka_rangi(ruchka)}) (FORNAX)", soni, "dona")
    r.qosh("Furnitura", ENG_DV_BLOKIRATOR, soni, "dona")
    r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_DV_PETLYA_SAMOREZ_SONI * soni, "dona")
    return samorez


def eng_ispanilet(boy_kesish, mexanizm, jadval=None):
    """Qanot kesish boʻyi (fortochkada eni) sm → (ispanilet kodi, zatsep soni, samorez soni)."""
    mm = (D(str(boy_kesish)) - D("0.5") - 2 * ENG_QULOQ) * 10
    for dan, gacha, kod, zatsep, samorez in (jadval or ENG_ISPANILET)[mexanizm]:
        if dan <= mm <= gacha + D("0.99"):
            return kod, zatsep, samorez
    raise HisobXato(f"{mexanizm.title()} ispaniletiga mos oʻlcham yoʻq: tabaqa {boy_kesish} sm ({mm} mm)")


def _eng_furnitura(s, tanlov, r):
    boylar = [D(str(b)) for b in s.get("rom_tabaqa_boylari", [])]
    fortochkalar = [D(str(f[0])) for f in s.get("fortochkalar", [])]  # eni (kesish)
    fort_boylar = [D(str(f[1])) for f in s.get("fortochkalar", [])]
    dvaynoylar = [(D(str(e)), D(str(b))) for e, b in s.get("dvaynoylar", [])]
    if not boylar and not fortochkalar and not dvaynoylar:
        return
    mexanizm = tanlov.get("eng_mexanizm") or "fornax"
    if mexanizm not in ENG_ISPANILET:
        raise HisobXato(f"Mexanizm faqat fornax yoki roto: {mexanizm}")
    petlya = tanlov.get("eng_petlya") or "prostoe"
    if petlya not in ("prostoe", "100"):
        raise HisobXato(f"Petlya faqat prostoe yoki 100: {petlya}")
    if dvaynoylar and mexanizm != "fornax":
        raise HisobXato("Engelberg dvaynoy hozircha faqat Fornax mexanizmida (Roto hali oʻrgatilmagan)")
    soni = len(boylar)
    ruchka = tanlov.get("eng_ruchka") or ENG_RUCHKALAR[0]
    r.qosh("Furnitura", ruchka, soni + len(fortochkalar) + len(dvaynoylar), "dona")
    samorez = _eng_dvaynoy(dvaynoylar, ruchka, r)
    if not soni:
        pass
    elif petlya == "prostoe":
        r.qosh("Furnitura", ENG_PETLYA_PROSTOE, soni, "komplekt")
        # har komplektga samorez 3,9×38 × 11 va 3,9×25 × 4 (foydalanuvchi, 2026-11-10; ProfOknada yozilmagan)
        r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_PROSTOE_SAMOREZ[0] * soni, "dona")
        samorez += ENG_PROSTOE_SAMOREZ[1] * soni
        # framujniy prijim: Prostoe Otkr bilan, qanot 100 sm dan baland (foydalanuvchi, 2026-11-08)
        prijim = sum(1 for b in boylar if b > 100)
        if prijim:
            r.qosh("Furnitura", ENG_PRIJIM, prijim, "dona")
            samorez += 4 * prijim
    else:
        # 100 sm dan baland tabaqaga 3 ta, qolganiga 2 ta (foydalanuvchi)
        p100 = sum(3 if b > 100 else 2 for b in boylar)
        r.qosh("Furnitura", ENG_PETLYA_100.get(tanlov.get("rang"), ENG_PETLYA_100["Laminatsiya"]), p100, "dona")
        r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_PETLYA_100_SAMOREZ * p100, "dona")
    if fortochkalar:
        # fortochka (foydalanuvchi, 2026-11-08): har biriga Ogranichitel Dlya Fortochki (Uz / Kinglong);
        # "100" tanlansa ustiga Petlya 100 mm × 2 (+ samorez 8 tadan). Blokirator yoʻq.
        # Framujniy petlya komplekti fortochkada ishlamaydi (foydalanuvchi, 2026-11-10); eski "komplekt" — ogranichitel.
        fp = tanlov.get("eng_fortochka_petlya") or "ogranichitel"
        if fp == "komplekt":
            fp = "ogranichitel"
        og = tanlov.get("eng_ogranichitel") or "Uz"
        if fp not in ("ogranichitel", "100") or og not in ENG_OGRANICHITEL:
            raise HisobXato(f"Fortochka petlyasi notoʻgʻri: {fp} / {og}")
        for b in fort_boylar:
            r.qosh("Furnitura", eng_ogranichitel(og, b), 1, "dona")
        samorez += ENG_OGRANICHITEL_SAMOREZ * len(fort_boylar)
        if fp == "100":
            r.qosh("Furnitura", ENG_PETLYA_100.get(tanlov.get("rang"), ENG_PETLYA_100["Laminatsiya"]), 2 * len(fortochkalar), "dona")
            r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_PETLYA_100_SAMOREZ * 2 * len(fortochkalar), "dona")
    isp = {}
    zatsep = 0
    for o, jadval in [(b, None) for b in boylar] + [(e, ENG_ISPANILET_FORT) for e in fortochkalar]:
        kod, z, sam = eng_ispanilet(o, mexanizm, jadval)
        nom = (eng_privod((D(str(o)) - D("4.9")) * 10) if mexanizm == "fornax"
               else f"{ENG_ISPANILET_NOMI[mexanizm]} {kod}")
        isp[nom] = isp.get(nom, 0) + 1
        zatsep += z
        samorez += sam
    for nom, n in isp.items():
        r.qosh("Furnitura", nom, n, "dona")
    zatsep += ENG_DV_ZATSEP * len(dvaynoylar)
    r.qosh("Furnitura", ENG_ZATSEP[mexanizm], zatsep, "dona")
    # blokirator: oddiy tabaqa va fortochkada yoʻq (komplekt ichida), dvaynoyda bor (_eng_dvaynoy)
    r.qosh("Furnitura", ENG_ISPANILET_SAMOREZ, samorez, "dona")


def _rom_furnitura(s, tanlov, r):
    """Rom tabaqasi: ProfOkna "Akfa TERMO 70 распашная створка" roʻyxati."""
    boylar = [D(b) for b in s.get("rom_tabaqa_boylari", [])]
    if not boylar:
        return
    soni = len(boylar)
    r.qosh("Furnitura", tanlov.get("rom_ruchka", ROM_RUCHKA), soni, "dona")
    r.qosh("Furnitura", ROM_KONNEKTOR, soni, "dona")
    r.qosh("Furnitura", ZATSEP, sum(3 if 150 < b <= 210 else 2 for b in boylar), "dona")
    r.qosh("Furnitura", ROM_PETLYA, sum(3 if b >= 90 else 2 for b in boylar), "dona")
    if any(b <= TIJ_AYIRMA for b in boylar):
        raise HisobXato(f"Rom tabaqasi juda past, poliamid tij sigʻmaydi: {min(boylar)} sm")
    r.qosh("Furnitura", ROM_TIJ, sum(b - TIJ_AYIRMA for b in boylar) / 100, "m")


def _fortochka_furnitura(s, tanlov, r):
    """Fortochka: rom petlyasi eniga qarab, ogranichitel 1, chit-chit 1 (ruchka tanlansa — ruchka + konnektor)."""
    f = [(D(e), D(b), bool(ru)) for e, b, ru in s.get("fortochkalar", [])]
    if not f:
        return
    r.qosh("Furnitura", ROM_PETLYA, sum(3 if e > FORTOCHKA_PETLYA_EN else 2 for e, _, _ in f), "dona")
    for kalit in ("kichik", "katta"):
        n = sum(1 for _, b, _ in f if (b <= 60) == (kalit == "kichik"))
        if n:
            r.qosh("Furnitura", OGRANICHITEL[kalit], n, "dona")
    ruchkali = sum(1 for *_, ru in f if ru)
    if len(f) - ruchkali:
        r.qosh("Furnitura", CHIT_CHIT, len(f) - ruchkali, "dona")
    if ruchkali:
        # Ruchka (A6004) bilan: konnektor 1, A4207.1 × 2 (foydalanuvchi), tij tepada: eni − 25 sm
        # (ProfOkna "откидная створка": A2010.2 tomoni 3 = tepa, ayirma 250 mm; rom tabaqasida tomon 2, boʻyi − 25)
        r.qosh("Furnitura", tanlov.get("rom_ruchka", ROM_RUCHKA), ruchkali, "dona")
        r.qosh("Furnitura", ROM_KONNEKTOR, ruchkali, "dona")
        r.qosh("Furnitura", FORTOCHKA_ZATSEP, ruchkali * 2, "dona")
        enlar = [e for e, _, ru in f if ru]
        if any(e <= TIJ_AYIRMA for e in enlar):
            raise HisobXato(f"Fortochka juda tor, poliamid tij sigʻmaydi: {min(enlar)} sm")
        r.qosh("Furnitura", ROM_TIJ, sum(e - TIJ_AYIRMA for e in enlar) / 100, "m")


def _dvaynoy_furnitura(s, r):
    """ProfOkna "Akfa TERMO 70 поворотно-откидная створка", dona boʻyicha. Tij formulasi ProfOknadan, foydalanuvchi tasdiqlagan (2026-11-05)."""
    tabaqalar = [(D(e), D(b)) for e, b in s.get("dvaynoylar", [])]
    if not tabaqalar:
        return
    for en, boy in tabaqalar:
        if en < DVAYNOY_EN_MIN:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa eni {en} sm — Master furniturasida eng kalta nojnitsa {DVAYNOY_EN_MIN} sm dan")
        if en > DVAYNOY_EN_MAX:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa eni {en} sm — {DVAYNOY_EN_MAX} sm dan keng tabaqaga Master qoʻshimcha detal (3420F.31 + 3400.35) talab qiladi, dasturda yoʻq")
        if boy < DVAYNOY_BOY_MIN:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa boʻyi {boy} sm — Master jadvali {DVAYNOY_BOY_MIN} sm dan boshlanadi")
        if boy > DVAYNOY_BOY_MAX:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa boʻyi {boy} sm — Master jadvali {DVAYNOY_BOY_MAX} sm gacha")
    soni = len(tabaqalar)
    r.qosh("Furnitura", DVAYNOY_RUCHKA, soni, "dona")
    r.qosh("Furnitura", DVAYNOY_MEXANIZM, soni, "dona")
    sredniy = sum(1 for en, _ in tabaqalar if en <= NOJNITSA_CHEGARA)
    if sredniy:
        r.qosh("Furnitura", NOJNITSA_SREDNIY, sredniy, "dona")
    if soni - sredniy:
        r.qosh("Furnitura", NOJNITSA_DLINNIY, soni - sredniy, "dona")
    prijim = sum(1 for _, b in tabaqalar if b > DVAYNOY_PRIJIM_BOY)
    if prijim:
        r.qosh("Furnitura", DVAYNOY_PRIJIM, prijim, "dona")
    baland = sum(1 for _, b in tabaqalar if b > DVAYNOY_BALAND_BOY)
    # Prijim qoʻshilsa, rolik-zatsep komplektidan yana bittasi (foydalanuvchi, 2026-11-02);
    # boʻyi 220 dan baland — Master 3400F.32, bu ham 4207.1 zatsep (foydalanuvchi, 2026-11-09)
    r.qosh("Furnitura", ZATSEP, len(tabaqalar) * 3 + prijim + baland, "dona")
    tij = D(0)
    for en, boy in tabaqalar:
        if en <= TIJ_AYIRMA:
            raise HisobXato(f"Dvaynoy tabaqa juda tor, poliamid tij sigʻmaydi: {en} sm")
        tij += (boy - 10) + (en - TIJ_AYIRMA)
        if boy > DVAYNOY_PRIJIM_BOY:
            tij += (boy - 10) / 2
        if boy > DVAYNOY_BALAND_BOY:
            tij += boy / 2 - 40  # Master 3400F.32: H/2 − 400 mm (foydalanuvchi, 2026-11-09)
    r.qosh("Furnitura", ROM_TIJ, tij / 100, "m")


def _furnitura(s, tanlov, r):
    eshiklar = s["eshiklar"]
    if not eshiklar:
        return
    soni = len(eshiklar)
    r.qosh("Furnitura", _kerak(tanlov, "ruchka", "Ruchka"), soni, "dona")
    r.qosh("Furnitura", _kerak(tanlov, "zamok", "Zamok"), soni, "dona")
    if not tanlov.get("yangi_akfa_zamok"):
        r.qosh("Furnitura", "Serdtsevina 101 mm (DWG)", soni, "dona")
        r.qosh("Furnitura", ZATSEP, soni * 2, "dona")
    petlya = tanlov.get("petlya", ASOSIY_PETLYA)
    petlya_soni = sum(4 if b > PETLYA_CHEGARA else 3 for b in s["tabaqa_boylari"])
    r.qosh("Furnitura", petlya, petlya_soni, "dona")
    passiv = sum(1 for e in eshiklar if e == 2)
    if passiv:
        r.qosh("Furnitura", "BKT70 EPD001", passiv, "juft")
        r.qosh("Furnitura", "A4202", passiv * 2, "dona")
        r.qosh("Furnitura", tanlov.get("shpingalet", ASOSIY_SHPINGALET), passiv * 2, "dona")
    # Tij faqat aktiv tabaqaga: eshikka 1 dona, ikki tabaqalida boʻylar bir xil
    boylar = iter(s["tabaqa_boylari"])
    ayirma = TIJ_AYIRMA_ESHIK.get(tanlov["ruchka"], TIJ_AYIRMA)
    tij = D(0)
    for e in eshiklar:
        boy = D(next(boylar))
        for _ in range(e - 1):
            next(boylar)
        tij += boy - ayirma
    r.qosh("Furnitura", ROM_TIJ, tij / 100, "m")


def hisobot(k, narxlar):
    tanlov = k.get("tanlov", {})
    rang = _kerak(tanlov, "rang", "Rang")
    oyna_turi = _kerak(tanlov, "oyna_turi", "Oyna turi")
    kurs = D(_kerak(tanlov, "kurs", "Kurs"))
    n = hisobla(k)
    s = n["sanoq"]
    r = Royxat(narxlar["narx"])

    _profillar(n, rang, narxlar, r)
    if n.get("seriya", "Termo 70") == "Termo 70":
        _rezina(s, r)
        _aksessuar(s, narxlar, r, tanlov)
        _furnitura(s, tanlov, r)
        _rom_furnitura(s, tanlov, r)
        _dvaynoy_furnitura(s, r)
        _fortochka_furnitura(s, tanlov, r)
    else:
        markaziy = D(s["markaziy_rezina"]) / 100
        if markaziy:
            r.qosh("Rezina", REZINA_QANOT, markaziy, "m")
        r.qosh("Rezina", REZINA_CHET, markaziy * 2 + D(s["oyna_rezinasi"]) / 100, "m")
        _eng_aksessuar(s, k, r)
        _eng_furnitura(s, tanlov, r)
    if s.get("armatura_samorez"):
        # Engelberg 7000: armatura samorezi; rezina, aksessuar, furnitura hali oʻrgatilmagan — hisob.qoida_yoq da
        r.qosh("Aksessuar", ARMATURA_SAMOREZ, s["armatura_samorez"], "dona")

    qalinlik = str(k.get("oyna_qalinligi", 24))
    # Oyna turi boʻlakka alohida berilishi mumkin: har tur oʻz m² qatori
    turlar = {}
    for o in n["oynalar"]:
        t = o.get("tur") or oyna_turi
        turlar[t] = turlar.get(t, D(0)) + D(str(o["en"])) * D(str(o["boy"])) * o["soni"] / 10000
    if len(turlar) <= 1:
        turlar = {next(iter(turlar), oyna_turi): D(n["oyna_m2"])}
    for t, m2 in turlar.items():
        # Oyna turi narxlar roʻyxatidan olib tashlangan/nomi oʻzgargan boʻlsa — hisob toʻxtamaydi, narxsiz chiqadi
        if t not in narxlar["steklopaket_m2"]:
            n["ogohlantirishlar"].append(f"Oyna turi \"{t}\" narxlar roʻyxatida yoʻq — boshqasini tanlang")
        m2_narx = narxlar["steklopaket_m2"].get(t, {}).get(qalinlik)
        r.summa_bilan(
            "Oyna", f"Steklopaket {t} {qalinlik} mm", m2, "m²",
            None if m2_narx is None else m2 * D(m2_narx), f"Steklopaket {t} {qalinlik} mm",
        )
        r.qatorlar[-1]["oyna_turi"] = t
    # Arka (foydalanuvchi, 2026-11-06): egish 7,5 $ / m (shtapik ichida), arkali oyna m² ga soʻmda ustama
    if s.get("arka_metr"):
        r.qosh("Arka", ARKA_EGISH, D(str(s["arka_metr"])), "m")
    if s.get("lapsha_samorez"):
        dona = D(s["lapsha_samorez"])
        som = r.narx.get(LAPSHA_SAMOREZ)
        r.summa_bilan("Aksessuar", LAPSHA_SAMOREZ, dona, "dona", None if som is None else dona * D(som) / kurs, LAPSHA_SAMOREZ)
    if s.get("arka_oyna_m2"):
        m2 = D(str(s["arka_oyna_m2"]))
        som = r.narx.get(ARKA_OYNA)
        r.summa_bilan("Arka", ARKA_OYNA, m2, "m²", None if som is None else m2 * D(som) / kurs, ARKA_OYNA)
    # Podokonnik: L + 15 sm, metr narxi rom rangi turkumi boʻyicha (Narxlar: "Podokonnik 25 | Oq"), uchiga 2 qopqoq
    pod = tanlov.get("podokonnik")
    if pod:
        if int(pod) not in PODOKONNIK_ENLARI:
            raise HisobXato(f"Podokonnik eni {pod} sm boʻlmaydi: {', '.join(map(str, PODOKONNIK_ENLARI))}")
        metr = (D(str(k["L"])) + PODOKONNIK_ZAPAS) / 100
        r.qosh("Podokonnik", f"Podokonnik {int(pod)} | {rang}", metr, "m")  # nomi = narx kaliti (zakaz, tannarx)
        r.qosh("Podokonnik", PODOKONNIK_KRISHKA, 2, "dona")
    if tanlov.get("montaj"):
        # Montajli (foydalanuvchi, 2026-11-09): pena + medved samorez (1 300 soʻm), montajsizda ikkalasi ham yoʻq
        r.qosh("Montaj", "MK 01", D(s["rama_perimetri"]) / 100 * PENA_METRGA, "ballon")
        if s.get("medved_samorez"):
            dona = D(s["medved_samorez"])
            som = r.narx.get(MEDVED_SAMOREZ)
            r.summa_bilan("Montaj", MEDVED_SAMOREZ, dona, "dona", None if som is None else dona * D(som) / kurs, MEDVED_SAMOREZ)

    return {
        "n": n,
        "rang": rang,
        "oyna_turi": oyna_turi,
        "qalinlik": qalinlik,
        "qatorlar": r.qatorlar,
        "narx_yoq": r.narx_yoq,
        "jami_usd": _pul(r.jami),
        "jami_som": _pul(r.jami * kurs),
        "L": k["L"],
        "H": k["H"],
    }


def _son(x):
    return f"{x:,.2f}".replace(",", " ").replace(".", ",")


def _k(x):
    """Sonni vergulli koʻrinishda chiqaradi: 117.4 → 117,4."""
    return f"{x:g}".replace(".", ",")


def hisobot_matni(h):
    n = h["n"]
    q = [f"BKT 70, {h['rang']}, {h['L']} × {h['H']} sm", "", "OʻLCHAMLAR"]
    for p in n["profillar"]:
        q.append(f"  {p['nomi']} ({p['profil']}): {_k(p['uzunlik'])} sm × {p['soni']}")
    for o in n["oynalar"]:
        q.append(f"  Oyna, {o['joy']}: {_k(o['en'])} × {_k(o['boy'])} sm × {o['soni']}")
    q.extend(["", "AKSESSUARLAR"])
    for t in h["qatorlar"]:
        if t["bolim"] in ("Aksessuar", "Furnitura", "Rezina", "Montaj"):
            q.append(f"  {t['nomi']}: {_k(float(round(t['miqdor'], 3)))} {t['birlik']}")
    q.extend([
        "",
        f"STEKLOPAKET: {h['oyna_turi']}, {h['qalinlik']} mm, {_k(round(n['oyna_m2'], 3))} m²",
        "",
        f"JAMI TANNARX: {_son(h['jami_usd'])} $ / {_son(h['jami_som'])} soʻm",
    ])
    if h["narx_yoq"]:
        q.append("DIQQAT, tannarx toʻliq emas. Narxi yoʻq: " + "; ".join(h["narx_yoq"]))
    for sarlavha, royxat in (("Qoida yoʻq", n["qoida_yoq"]), ("Ogohlantirish", n["ogohlantirishlar"])):
        for x in royxat:
            q.append(f"{sarlavha}: {x}")
    return "\n".join(q)


def narxlarni_oqi(yol=None):
    yol = Path(yol) if yol else Path(__file__).with_name("narxlar.json")
    return json.loads(yol.read_text(encoding="utf-8"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) not in (2, 3):
        sys.exit("Ishlatish: python hisobot.py konstruksiya.json [narxlar.json]")
    konstruksiya = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    try:
        print(hisobot_matni(hisobot(konstruksiya, narxlarni_oqi(sys.argv[2] if len(sys.argv) == 3 else None))))
    except HisobXato as e:
        sys.exit(f"Xato: {e}")
