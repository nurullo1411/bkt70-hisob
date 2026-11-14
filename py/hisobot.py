"""Konstruksiyadan aksessuar roʻyxati, tannarx va qisqa hisobot chiqaradi.

Ishga tushirish: python hisobot.py konstruksiya.json [narxlar.json]
"""
import json
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from hisob import (ARMATURA_SAMOREZ, REZINA_CHET, REZINA_QANOT, D, HisobXato, hisobla, hivich_metr, narx_kaliti,
                   oyna_qalinligi, profil_narxi)

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
ARKA_EGISH_PVX = "Arka egish PVX"  # PVX 4,2 $ / m (foydalanuvchi, 2026-11-11)
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
# (= kesish − 4,9) 25 dan kichik — 20, 30 dan — 25, 35 dan — 30, aks holda 35. Kin Long (foydalanuvchi, 2026-11-11):
# fortochka qanoti boʻyi (kesish) 50 gacha — 12, 60 gacha — 14, kattasi — 16; juft sotiladi, 1 dona.
ENG_OGRANICHITEL = {"Uz": "Ogranichitel Dlya Fortochki gradus {} sm (Uz)", "Kinglong": "Ogranichitel Dlya Fortochki {} (Kin Long)"}


def eng_ogranichitel(tur, boy_kesish):
    if tur == "Kinglong":
        b = D(str(boy_kesish))
        return ENG_OGRANICHITEL[tur].format(12 if b <= 50 else 14 if b <= 60 else 16)
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
# Aldoks ogranichiteli: fortochkada Petlya 100 mm bilan, 1 dona, samorez 3,9×25 × 4 (foydalanuvchi, 2026-11-10)
ENG_OGRANICHITEL_ALDOKS = {"Oq": "Ogranichitel (Oq) (500sht) (Uz)", "Laminatsiya": "(9005) Ogranichitel (Uz)"}
ENG_OGRANICHITEL_ALDOKS_SAMOREZ = 4
# Framujniy petlya komplekti: har komplektga samorez 3,9×38 × 6 (foydalanuvchi, 2026-11-10).
# Fortochkada ISHLATILMAYDI; Prostoe Otkr bilan, "(13) Sredniy Prijim Skritiy (FORNAX)" OʻRNIGA (foydalanuvchi, 2026-11-10).
ENG_FRAMUGA_PETLYA = "Komplekt Petel Dlya Framujnoe Okna 13mm (Uz)"
ENG_FRAMUGA_PETLYA_SAMOREZ = 6


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


# Roto dvaynoy (foydalanuvchi, 2026-11-11; ProfOkna "Akfa 7000 пов.-откидная створка (Roto)", AKFA "Pvc. Dvoy.Otk.
# ROTO", komplekt yoʻq — dona boʻyicha). Oʻlcham = kesish − 4,9 sm (mm), Fornaxdagidek; oraliqlar ustma-ust — kichigi.
ROTO_DV_ISPANILET = [(621, 800, 12), (801, 1200, 14), (1201, 1600, 14), (1601, 2000, 14), (2001, 2400, 14)]
ROTO_DV_ISPANILET_NOM = {1201: "1200-1600"}
ROTO_DV_NOJNITSA = [(290, 410), (411, 600), (601, 800), (801, 1000)]
ROTO_DV_PETLYA_NOJ = {290: "290-410", 411: "411-600", 601: "600-800", 801: "800-1400"}
ROTO_DV_KENG = (701, 950)   # tabaqa tayyor eni (mm) shu oraliqda: + oʻrta zamok 400, + katta zatsep × 2
ROTO_DV_ZATSEP = 5
ROTO_DV_DONA = ["Blokirator Na Rame (ROTO)", "Blokirator Na Stvorke (ROTO)", "Verhnyaya Petlya Na Rame (ROTO)",
                "Nijnaya Petlya Na Rame (ROTO)", "Nijnaya Petlya Na Stvorke (ROTO)", "Zamok Sredniy 600 (ROTO)",
                "Uglovaya Peredacha (Zam.Sred) (ROTO)"]


# Petlya qopqoqlari (foydalanuvchi, 2026-11-11): 5 boʻlak, ruchka rangida; (01) Oq, (02) Bronza, (03) Seriy, (04) Mahagon
ROTO_KRISHKA_QISMLARI = ["Nakladka", "Nij. Rama", "Nij. Stvorka", "Verh. Bol.", "Verh. Mal."]
ROTO_KRISHKA_RANG = {"Oq": "(01) {} (Oq)", "Bronza": "(02) {} (Bronza)", "Seriy": "(03) {} (Seriy)",
                     "Mahagon": "(04) {} (Mahagon)", "Tem Kor": "(04) {} (Mahagon)"}


def roto_krishkalar(ruchka):
    shablon = ROTO_KRISHKA_RANG.get(eng_krishka_rangi(ruchka), ROTO_KRISHKA_RANG["Oq"])
    return [f"NX Krishka Petlya {shablon.format(q)} (ROTO)" for q in ROTO_KRISHKA_QISMLARI]


def _eng_dvaynoy_roto(dvaynoylar, tomonlar, r, ruchka=""):
    if not dvaynoylar:
        return 0
    samorez, zatsep, katta = 0, 0, 0
    for i, (en, boy) in enumerate(dvaynoylar):
        b = (boy - D("4.9")) * 10
        e = (en - D("4.9")) * 10
        isp = next(((a, g, sam) for a, g, sam in ROTO_DV_ISPANILET if a <= b <= g + D("0.99")), None)
        noj = next(((a, g) for a, g in ROTO_DV_NOJNITSA if a <= e <= g + D("0.99")), None)
        if isp is None:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa boʻyi {b} mm — Roto ispaniletlari 621–2400 mm")
        if noj is None:
            raise HisobXato(f"Dvaynoy qoʻyib boʻlmaydi: tabaqa eni {e} mm — Roto nojnitsalari 290–1000 mm")
        a, g, sam = isp
        oraliq = ROTO_DV_ISPANILET_NOM.get(a, f"{a}-{g}")
        r.qosh("Furnitura", f"Ispanilet {oraliq} (ROTO)", 1, "dona")
        chap = (tomonlar[i] if i < len(tomonlar) else "chap") != "ong"
        r.qosh("Furnitura", f"Nojnitsi {noj[0]}-{noj[1]} (ROTO)", 1, "dona")
        r.qosh("Furnitura", f"(13) Petlya Noj {ROTO_DV_PETLYA_NOJ[noj[0]]} {'Leviy' if chap else 'Praviy'} (ROTO)", 1, "dona")
        r.qosh("Furnitura", f"Povorotnaya Planka {'Levaya' if chap else 'Pravaya'} (ROTO)", 1, "dona")
        samorez += sam
        zatsep += ROTO_DV_ZATSEP
        tayyor = (en - D("0.5")) * 10
        if ROTO_DV_KENG[0] <= tayyor <= ROTO_DV_KENG[1]:
            katta += 1
    soni = len(dvaynoylar)
    for nom in ROTO_DV_DONA:
        r.qosh("Furnitura", nom, soni, "dona")
    r.qosh("Furnitura", "Uglovaya Peredacha (ROTO)", 2 * soni, "dona")
    for nom in roto_krishkalar(ruchka):
        r.qosh("Furnitura", nom, soni, "dona")
    if katta:
        r.qosh("Furnitura", "Zamok Sredniy 400 (ROTO)", katta, "dona")
        r.qosh("Furnitura", "Zatsepka Bolshaya (ROTO)", 2 * katta, "dona")
    r.qosh("Furnitura", "Zatsepka (ROTO)", zatsep, "dona")
    r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_DV_PETLYA_SAMOREZ_SONI * soni, "dona")
    return samorez


# Engelberg eshigi (foydalanuvchi, 2026-11-11; ProfOkna "Akfa 7000 дверная T/Z створка"): zamok tanlanadi
# (Fornax / Roto / GU), oʻlchami aktiv qanot tayyor boʻyiga (kesish − 0,5, mm): 1840 gacha 1600, 2070 gacha 1800,
# 2400 gacha 2000; zatsep "Zatsepka 7000" 3 / 3 / 4; zamokka samorez 3,9×25 × 12. Petlya tanlanadi, har qanotga 3,
# qanot tayyor boʻyi 200–235 va eni 70–105 boʻlsa 4 (ProfOkna), har petlyaga samorez 4,2×45 × 7. Passiv qanotga
# "Shpingalet PVH (Oq) (Tr)" × 2 (+ samorez 3,9×25 × 4), shtulp qopqogʻi × 2, shtulpga samorez 4,8×60 × 5.
ENG_ESHIK_ZAMOKLAR = ("fornax", "roto", "gu")
ENG_ESHIK_ZAMOK_NOM = {"fornax": "FORNAX", "roto": "ROTO", "gu": "GU"}
ENG_ESHIK_ZAMOK_OLCHAM = [(1840, 1600, 3), (2070, 1800, 3), (2400, 2000, 4)]
ENG_ESHIK_ZATSEP = "Zatsepka 7000 (750sht) (Uz)"
ENG_ESHIK_RUCHKALAR = ["Ruchka Dvernaya PVH (Oq) (Uz)", "Ruchka Dvernaya PVH (2894) (Uz)",
                       "Ruchka Dver (ROTO) (Oq) (Tr)", "Ruchka Dver (ROTO) (Bronza) (Tr)", "Ruchka Dver (ROTO) (Tem Kor) (Tr)"]
ENG_ESHIK_PETLYALAR = ["Petlya Dvernaya PVH (Oq) (40sht) (Uz)", "Petlya Dvernaya PVH (2894) (Uz)",
                       "Petlya Dvernaya PVH (Zol Dub) (Uz)", "Petlya Dvernaya 3D (Oq) (Uz)",
                       "Petlya Dver JOCKER (17.5mm) (Oq) (Uz)"]
ENG_ESHIK_PETLYA_SAMOREZ = ("4,2×45 YHB", 7)
ENG_SHPINGALET = "Shpingalet PVH (Oq) (Tr)"
ENG_SHTULP_KRISHKA = "Krishka Shtulp Dlya Adap 7000 (Oq) (Uz)"
ENG_SHTULP_SAMOREZ = ("4,8×60 YSB", 5)  # "(A) Samarez 4.8 x 60 YSB (200)" (foydalanuvchi, 2026-11-11)


def eng_eshik_zamok(boy_kesish, tur):
    mm = (D(str(boy_kesish)) - D("0.5")) * 10
    for gacha, olcham, zatsep in ENG_ESHIK_ZAMOK_OLCHAM:
        if mm <= gacha:
            return f"Zamok Dvernoy ({ENG_ESHIK_ZAMOK_NOM[tur]}) {olcham} (Tr)", zatsep
    raise HisobXato(f"Eshik zamogʻi 2400 mm gacha: qanot {mm} mm")


def _eng_eshik(s, tanlov, r, qoida_yoq):
    eshiklar = s.get("eshiklar") or []
    if not eshiklar:
        return 0
    qanotlar = [(D(str(e)), D(str(b))) for e, b in s.get("eshik_qanotlari", [])]
    r.qosh("Furnitura", tanlov.get("eng_eshik_ruchka") or ENG_ESHIK_RUCHKALAR[0], len(eshiklar), "dona")
    zamok = tanlov.get("eng_eshik_zamok") or "fornax"  # standart Fornax (foydalanuvchi, 2026-11-11)
    if zamok not in ENG_ESHIK_ZAMOKLAR:
        raise HisobXato(f"Eshik zamogʻi faqat {', '.join(ENG_ESHIK_ZAMOKLAR)}: {zamok}")
    samorez, zatsep = 0, 0
    it = iter(qanotlar)
    for e in eshiklar:
        _, boy = next(it)  # aktiv qanot
        for _ in range(e - 1):
            next(it)
        nom, z = eng_eshik_zamok(boy, zamok)
        zatsep += z
        r.qosh("Furnitura", nom, 1, "dona")
        samorez += 12
    r.qosh("Furnitura", ENG_ESHIK_ZATSEP, zatsep, "dona")
    petlya = sum(4 if 200 <= b - D("0.5") <= 235 and 70 <= e - D("0.5") <= 105 else 3 for e, b in qanotlar)
    r.qosh("Furnitura", tanlov.get("eng_eshik_petlya") or ENG_ESHIK_PETLYALAR[0], petlya, "dona")
    r.qosh("Furnitura", ENG_ESHIK_PETLYA_SAMOREZ[0], ENG_ESHIK_PETLYA_SAMOREZ[1] * petlya, "dona")
    passiv = sum(1 for e in eshiklar if e == 2)
    if passiv:
        r.qosh("Furnitura", ENG_SHPINGALET, 2 * passiv, "dona")
        samorez += 4 * passiv
        r.qosh("Aksessuar", ENG_SHTULP_KRISHKA, 2 * passiv, "dona")
        r.qosh("Aksessuar", ENG_SHTULP_SAMOREZ[0], ENG_SHTULP_SAMOREZ[1] * passiv, "dona")
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
        return 0
    mexanizm = tanlov.get("eng_mexanizm") or "fornax"
    if mexanizm not in ENG_ISPANILET:
        raise HisobXato(f"Mexanizm faqat fornax yoki roto: {mexanizm}")
    petlya = tanlov.get("eng_petlya") or "prostoe"
    if petlya not in ("prostoe", "100"):
        raise HisobXato(f"Petlya faqat prostoe yoki 100: {petlya}")
    soni = len(boylar)
    ruchka = tanlov.get("eng_ruchka") or ENG_RUCHKALAR[0]
    r.qosh("Furnitura", ruchka, soni + len(fortochkalar) + len(dvaynoylar), "dona")
    samorez = (_eng_dvaynoy(dvaynoylar, ruchka, r) if mexanizm == "fornax"
               else _eng_dvaynoy_roto(dvaynoylar, s.get("dvaynoy_tomonlari") or [], r, ruchka))
    if not soni:
        pass
    elif petlya == "prostoe":
        r.qosh("Furnitura", ENG_PETLYA_PROSTOE, soni, "komplekt")
        # har komplektga samorez 3,9×38 × 11 va 3,9×25 × 4 (foydalanuvchi, 2026-11-10; ProfOknada yozilmagan)
        samorez += ENG_PROSTOE_SAMOREZ[1] * soni
        # framujniy petlya komplekti (Sredniy Prijim oʻrniga; foydalanuvchi, 2026-11-10): Prostoe Otkr bilan,
        # qanot (kesish) 100 sm dan baland boʻlsa (foydalanuvchi tasdiqladi, 2026-11-10), har biriga samorez 3,9×38 × 6
        framuj = sum(1 for b in boylar if b > 100)
        if framuj:
            r.qosh("Furnitura", ENG_FRAMUGA_PETLYA, framuj, "komplekt")
        r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_PROSTOE_SAMOREZ[0] * soni + ENG_FRAMUGA_PETLYA_SAMOREZ * framuj, "dona")
    else:
        # 100 sm dan baland tabaqaga 3 ta, qolganiga 2 ta (foydalanuvchi)
        p100 = sum(3 if b > 100 else 2 for b in boylar)
        r.qosh("Furnitura", ENG_PETLYA_100.get(tanlov.get("rang"), ENG_PETLYA_100["Laminatsiya"]), p100, "dona")
        r.qosh("Furnitura", ENG_PETLYA_SAMOREZ, ENG_PETLYA_100_SAMOREZ * p100, "dona")
    if fortochkalar:
        # fortochka (foydalanuvchi, 2026-11-08): har biriga Ogranichitel Dlya Fortochki (Uz / Kinglong);
        # "100" tanlansa Petlya 100 mm × 2 (+ samorez 8 tadan) va Aldoks ogranichiteli. Blokirator yoʻq.
        # Framujniy petlya komplekti fortochkada ishlamaydi (foydalanuvchi, 2026-11-10); eski "komplekt" — ogranichitel.
        fp = tanlov.get("eng_fortochka_petlya") or "ogranichitel"
        if fp == "komplekt":
            fp = "ogranichitel"
        og = tanlov.get("eng_ogranichitel") or "Uz"
        if fp not in ("ogranichitel", "100") or og not in ENG_OGRANICHITEL:
            raise HisobXato(f"Fortochka petlyasi notoʻgʻri: {fp} / {og}")
        if fp == "100":
            # Petlya 100 mm bilan Uz/Kinglong emas, Aldoks ogranichiteli × 1 + samorez 3,9×25 × 4 (foydalanuvchi, 2026-11-10)
            r.qosh("Furnitura", ENG_OGRANICHITEL_ALDOKS.get(tanlov.get("rang"), ENG_OGRANICHITEL_ALDOKS["Laminatsiya"]),
                   len(fortochkalar), "dona")
            samorez += ENG_OGRANICHITEL_ALDOKS_SAMOREZ * len(fortochkalar)
        else:
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
    if mexanizm == "fornax":
        zatsep += ENG_DV_ZATSEP * len(dvaynoylar)  # Roto dvaynoy zatsepi _eng_dvaynoy_roto da
    if zatsep:
        r.qosh("Furnitura", ENG_ZATSEP[mexanizm], zatsep, "dona")
    # blokirator: oddiy tabaqa va fortochkada yoʻq (komplekt ichida), dvaynoyda bor (_eng_dvaynoy)
    return samorez


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


# ---------- Aldoks rom (foydalanuvchi, 2026-11-11; katalog "ALDOX System") ----------
# Rezina: oyna shtapik tomoniga EPDM Ю, oyna profil tomoniga "Rezina Profil P (Bosma) (Qishki)" (100 m pachka),
# ikkalasi oyna perimetri + har tomonga 2 sm; oyna tegmaydigan joyga (qanot prileganiesi) EPDM 01.18.30 =
# qanot perimetri × 2 (qanot labida va kosa/impost labida), 1 metri 40 g. Kley yoʻq.
ALD_REZINA_YU = "EPDM Rezina Ю"
ALD_REZINA_QISHKI = "Rezina Profil P (Bosma) (Qishki)"
ALD_REZINA_BOSMA = "Rezina EPDM (Champ 01.18.30)"
# Burchak (kosa va qanot): "Soedinitel Chovush (4sm) (300sht) (Uz)" har burchakka 1 + samorez 3,9×16 × 8;
# impostning har uchiga "Soedinitel (Bolshoy) (15sht) (Uz)" 1 + samorez 3,9×16 × 7.
ALD_CHOVUSH = "Soedinitel Chovush (4sm) (300sht) (Uz)"
ALD_BURCHAK_SAMOREZ = 8
ALD_BOLSHOY = "Soedinitel (Bolshoy) (15sht) (Uz)"
ALD_IMPOST_SAMOREZ = 7
# Furnitura (har rom tabaqasiga): ruchka Delfin (oq romga oq, boshqasiga 9005), petlya "Petlya Aldoks (Oq) (Uz)"
# 2 ta + qanot eni 65–100 boʻlsa 1 + boʻyi 120–200 boʻlsa 1 (ProfOkna), har petlyaga samorez 4,8×19 × 4;
# tij 639/640 komplekt = qanot boʻyi − 25 sm (hivich 6 m), zaklepka 4×12 × 3; zatsep "Otvetniy Plast." × 2,
# har biriga samorez 3,9×19 × 4. Petlya (foydalanuvchi, 2026-11-14): romda ham fortochkada ham petlya tomoni
# 200 dan oshmasa 2 ta, oshsa 3 ta; oʻlcham chegarasi yoʻq.
ALD_RUCHKA = {"Oq": "Ruchka DELFIN (Oq) (120sht) (Uz)", "*": "(9005) Ruchka DELFIN (Uz)"}
ALD_PETLYA = "Petlya Aldoks (Oq) (Uz)"
ALD_PETLYA_SAMOREZ = ("4,8×19 YSBM", 4)
ALD_TIJ = "640/639 Tij (Komplekt) (Oq) (Adt)"
ALD_TIJ_HIVICH = D(6)
ALD_ZAKLEPKA = ("Zaklepka 4×12", 3)
ALD_ZATSEP = {"Oq": "Otvetniy Plast. (Oq) (200sht) (Uz)", "*": "Otvetniy Plast. (9005) (200sht) (Uz)"}
ALD_ZATSEP_SAMOREZ = ("3,9×19 YHBM", 4)
ALD_PETLYA_CHEGARA = D(200)
# Fortochka (foydalanuvchi, 2026-11-14; ProfOkna "Akfa откидная створка"): ogranichitel × 1 va chit-chit × 1
# (har biriga 3,9×19 × 4), rangi rom rangida (Oq / 9005 / SW306G); ruchka tanlansa chit-chit oʻrniga
# Delfin + tij (eni − 25 sm, tepada) + zaklepka × 3 + Otvetniy Plast. × 2 (romdagidek).
ALD_OGRANICHITEL = {"Oq": "Ogranichitel (Oq) (500sht) (Uz)", "9005": "(9005) Ogranichitel (Uz)",
                    "SW306G": "(SW306G) Ogranichitel (Uz)"}
ALD_CHIT = {"Oq": "Chit-Chit (Oq) (500sht) (Uz)", "9005": "(9005) Chit-Chit (Uz)",
            "SW306G": "(SW306G) Chit-Chit (New) (Uz)"}


def _ald_petlya(tomon):
    return 2 if D(str(tomon)) <= ALD_PETLYA_CHEGARA else 3
# Seriyaga qarab aksessuar nomlari (hozir faqat Aldoks; NEO olib tashlandi, foydalanuvchi 2026-11-14)
ALD_TUR = {
    "Aldoks": {"chovush": ALD_CHOVUSH, "bolshoy": ALD_BOLSHOY, "tij": ALD_TIJ,
               "balkon_chovush": "190 Balkon Chovush (Nekr) (Adt) Metr", "balkon": ("185", "198")},
}


# Eshik (foydalanuvchi, 2026-11-14). Zamok: balkon qanotida (185/198) "153/23/35", Urta/Qanotdan yasalganda 153/23/25;
# 155/23/20 ishlatilmaydi; serdtsevina alohida qoʻshilmaydi. Otvetka 153 ruchka rangida. Ruchka standart Comfort 1077.
# Zamok va ruchka: samorez 3,9×19 × 2 + zaklepka 4×12 × 6. Petlya standart rom petlyasi (Petlya Aldoks), tanlansa
# dvernaya; 3 ta + qanot eni 75–110 boʻlsa 1 + boʻyi 200–240 boʻlsa 1, har petlyaga 4,8×19 × 4. Passiv qanot:
# Shpingalet ALD × 2 (petlya rangida) + 3,9×19 × 6; shtulp oʻrnidagi Urta 182 passivga 4,8×60 YSB × 3 bilan.
ALD_ESHIK_ZAMOKLAR = ("Zamok S Tsilindrom 153/23/35 (Tr)", "Zamok S Tsilindrom 153/23/25 (Tr)",
                      "Zamok S Tsilindrom 153/23/35 Rolik (DWG) (Tr)", "Zamok S Tsilindrom 153/23/25 Rolik (DWG) (Tr)")
ALD_ESHIK_RUCHKALAR = ("Comfort 1077", "Stublina 1177", "Hi-Tech", "Fornax")
ALD_RUCHKA_NOMI = {
    "Comfort 1077": {"Oq": "Ruchka Dvernaya COMFORT (1077.85.28) (Oq) (Uz)",
                     "9005": "Ruchka Dvernaya COMFORT (1077.85.28) (9005) (Uz)",
                     "SW306G": "Ruchka Dvernaya COMFORT (1077.85.28) (SW306G) (Uz)"},
    "Stublina 1177": {"Oq": "Ruchka Dver (1177.85.28) (Oq) (Uz)", "SW306G": "Ruchka Dver (1177.85.28) (SW306G) (Uz)"},
    "Hi-Tech": {"Oq": "Ruchka Dvernaya Hi-Tech (28mm) (Oq) (Uz)"},
    "Fornax": {"Oq": "Ruchka Dvernaya FORNAX (Oq) (Tr)"},
}
ALD_OTVETKA = {"Oq": "Otvetka 153 (Oq) (500sht) (Uz)", "9005": "(9005) Otvetka 153 (Uz)", "SW306G": "(SW306G) Otvetka 153 (Uz)"}
ALD_ESHIK_PETLYALAR = ("rom", "dvernaya")
ALD_DVERNAYA = {"Oq": "Petlya Dvernaya Alyumin. (Oq) (Uz)", "9005": "(9005) Petlya Dvernaya Alyumin (Uz)",
                "SW306G": "(SW306G) Petlya Dvernaya Alyumin (Uz)"}
ALD_SHPINGALET = {"Oq": "Shpingalet ALD (Oq) (300sht) (Uz)", "9005": "(9005) Shpingalet ALD (Uz)",
                  "SW306G": "(SW306G) Shpingalet ALD (Uz)"}
ALD_ESHIK_MAX = (D(110), D(240))  # qanot eni, boʻyi
ALD_BALKON_CHOVUSH = "190 Balkon Chovush (Nekr) (Adt) Metr"


def _ald_rang(rang):
    """Furnitura rangi: oq romga Oq, laminatga 9005, 306g ga SW306G (foydalanuvchi, 2026-11-14)."""
    return {"Oq": "Oq", "Laminatsiya": "9005"}.get(rang, "SW306G")


def _ald_eshik(s, tanlov, rang, r):
    eshiklar = s.get("eshiklar") or []
    if not eshiklar:
        return
    qanotlar = [(D(str(e)), D(str(b))) for e, b in s.get("eshik_qanotlari", [])]
    for e, b in qanotlar:
        if e > ALD_ESHIK_MAX[0] or b > ALD_ESHIK_MAX[1]:
            raise HisobXato(f"Aldoks eshik qanoti eni 110 dan, boʻyi 240 dan oshmaydi: {e} × {b}")
    rk = _ald_rang(rang)
    # yengil eshik (Qanot/Urtadan) standart zamogʻi 153/23/25 (foydalanuvchi, 2026-11-14)
    zamok = tanlov.get("ald_eshik_zamok") or ALD_ESHIK_ZAMOKLAR[1 if tanlov.get("eshik_tur") == "yengil" else 0]
    if zamok not in ALD_ESHIK_ZAMOKLAR:
        raise HisobXato(f"Aldoks eshik zamogʻi notoʻgʻri: {zamok}")
    ruchka = tanlov.get("ald_eshik_ruchka") or ALD_ESHIK_RUCHKALAR[0]
    if ruchka not in ALD_RUCHKA_NOMI:
        raise HisobXato(f"Aldoks eshik ruchkasi notoʻgʻri: {ruchka}")
    n = len(eshiklar)
    nomlar = ALD_RUCHKA_NOMI[ruchka]
    r.qosh("Furnitura", nomlar.get(rk) or nomlar["Oq"], n, "dona")
    r.qosh("Furnitura", zamok, n, "dona")
    r.qosh("Furnitura", ALD_OTVETKA[rk], n, "dona")
    samorez = 2 * n  # 3,9×19: zamok va ruchkaga 2, passiv shpingaletiga 6
    r.qosh("Furnitura", "Zaklepka 4×12", 6 * n, "dona")
    petlya_tur = tanlov.get("ald_eshik_petlya") or "rom"
    if petlya_tur not in ALD_ESHIK_PETLYALAR:
        raise HisobXato(f"Aldoks eshik petlyasi faqat rom yoki dvernaya: {petlya_tur}")
    petlya = sum(3 + (75 <= e <= 110) + (200 <= b <= 240) for e, b in qanotlar)
    pr = "Oq" if petlya_tur == "rom" else rk  # Petlya Aldoks faqat oq
    r.qosh("Furnitura", ALD_PETLYA if petlya_tur == "rom" else ALD_DVERNAYA[pr], petlya, "dona")
    r.qosh("Furnitura", ALD_PETLYA_SAMOREZ[0], petlya * ALD_PETLYA_SAMOREZ[1], "dona")
    passiv = sum(1 for e in eshiklar if e == 2)
    if passiv:
        r.qosh("Furnitura", ALD_SHPINGALET[pr], 2 * passiv, "dona")
        samorez += 6 * passiv
        r.qosh("Aksessuar", "4,8×60 YSB", 3 * passiv, "dona")
    r.qosh("Furnitura", "3,9×19 YHBM", samorez, "dona")


def _ald_hisobot(s, rang, r, tanlov=None, seriya="Aldoks"):
    t = ALD_TUR[seriya]
    fort = s.get("fortochkalar") or []
    qanot = [*(s.get("rom_qanotlari") or []), *(s.get("eshik_qanotlari") or []), *((e, b) for e, b, _ in fort)]
    perimetr = sum((2 * (D(str(e)) + D(str(b))) for e, b in qanot), D(0)) / 100
    oyna = D(s["oyna_rezinasi"]) / 100
    r.qosh("Rezina", ALD_REZINA_YU, oyna, "m")
    r.qosh("Rezina", ALD_REZINA_QISHKI, oyna, "m")
    if perimetr:
        r.qosh("Rezina", ALD_REZINA_BOSMA, perimetr * 2, "m")
    # balkon qanoti (185/198) burchagiga "190 Balkon Chovush" 4,2 sm × 1, metrga (foydalanuvchi, 2026-11-14);
    # Qanot/Urtadan yengil eshikda — romdagidek Chovush (4sm) (151)
    balkon = 4 * sum(v for p, v in s["tabaqalar"].items() if p in t["balkon"])
    if balkon:
        r.qosh("Aksessuar", t["balkon_chovush"], D(balkon) * D("4.2") / 100, "m")
    burchak = 4 * (sum(s["ramalar"].values()) + sum(v for p, v in s["tabaqalar"].items() if p not in t["balkon"]))
    samorez = (burchak + balkon) * ALD_BURCHAK_SAMOREZ  # 190 Chovushga ham 3,9×16 × 8 (foydalanuvchi, 2026-11-14)
    r.qosh("Aksessuar", t["chovush"], burchak, "dona")
    if s["impost_soni"]:
        uch = 2 * s["impost_soni"]
        r.qosh("Aksessuar", t["bolshoy"], uch, "dona")
        samorez += uch * ALD_IMPOST_SAMOREZ
    r.qosh("Aksessuar", ARMATURA_SAMOREZ, samorez, "dona")
    # Aldoksda tabaqa oynasiga Takos (24mm) kerak emas, faqat gluxoyga CT 203 (foydalanuvchi, 2026-11-14)
    if s["gluxoy_oyna_soni"]:
        r.qosh("Aksessuar", "CT 203", s["gluxoy_oyna_soni"] * 2, "dona")
    _ald_eshik(s, tanlov or {}, rang, r)
    qanotlar = s.get("rom_qanotlari") or []
    rk = "Oq" if rang == "Oq" else "*"
    fr = _ald_rang(rang)
    ruchkali = [(e, b) for e, b, ru in fort if ru]
    chit = len(fort) - len(ruchkali)
    if fort:
        r.qosh("Furnitura", ALD_OGRANICHITEL[fr], len(fort), "dona")
        if chit:
            r.qosh("Furnitura", ALD_CHIT[fr], chit, "dona")
    samorez_19 = (len(fort) + chit) * ALD_ZATSEP_SAMOREZ[1]  # ogranichitel va chit-chitga 3,9×19 × 4
    if not qanotlar and not fort:
        return
    # rom tabaqasida petlya boʻyida, fortochkada enida
    petlya = sum(_ald_petlya(b) for _, b in qanotlar) + sum(_ald_petlya(e) for e, _, _ in fort)
    r.qosh("Furnitura", ALD_PETLYA, petlya, "dona")
    r.qosh("Furnitura", ALD_PETLYA_SAMOREZ[0], petlya * ALD_PETLYA_SAMOREZ[1], "dona")
    soni = len(qanotlar) + len(ruchkali)
    if not soni:
        r.qosh("Furnitura", ALD_ZATSEP_SAMOREZ[0], samorez_19, "dona")
        return
    r.qosh("Furnitura", ALD_RUCHKA[rk], soni, "dona")
    tij = (sum((D(str(b)) - TIJ_AYIRMA for _, b in qanotlar), D(0))
           + sum((D(str(e)) - TIJ_AYIRMA for e, _ in ruchkali), D(0))) / 100
    r.qosh("Furnitura", t["tij"], tij, "m")
    r.qosh("Furnitura", ALD_ZAKLEPKA[0], soni * ALD_ZAKLEPKA[1], "dona")
    r.qosh("Furnitura", ALD_ZATSEP[rk], soni * 2, "dona")
    r.qosh("Furnitura", ALD_ZATSEP_SAMOREZ[0], samorez_19 + soni * 2 * ALD_ZATSEP_SAMOREZ[1], "dona")


def hisobot(k, narxlar):
    tanlov = k.get("tanlov", {})
    rang = _kerak(tanlov, "rang", "Rang")
    oyna_turi = _kerak(tanlov, "oyna_turi", "Oyna turi")
    kurs = D(_kerak(tanlov, "kurs", "Kurs"))
    n = hisobla(k)
    s = n["sanoq"]
    r = Royxat(narxlar["narx"])

    _profillar(n, rang, narxlar, r)
    if n.get("seriya") in ALD_TUR:
        _ald_hisobot(s, rang, r, tanlov, n["seriya"])
    elif n.get("seriya", "Termo 70") == "Termo 70":
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
        samorez = _eng_furnitura(s, tanlov, r) + _eng_eshik(s, tanlov, r, n["qoida_yoq"])
        if samorez:
            r.qosh("Furnitura", ENG_ISPANILET_SAMOREZ, samorez, "dona")
    if s.get("armatura_samorez"):
        # Engelberg 7000: armatura samorezi; rezina, aksessuar, furnitura hali oʻrgatilmagan — hisob.qoida_yoq da
        r.qosh("Aksessuar", ARMATURA_SAMOREZ, s["armatura_samorez"], "dona")

    qalinlik = str(oyna_qalinligi(k))
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
        egish = ARKA_EGISH if n.get("seriya", "Termo 70") == "Termo 70" else ARKA_EGISH_PVX
        r.qosh("Arka", egish, D(str(s["arka_metr"])), "m")
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
    seriya = h["n"].get("seriya") or "Termo 70"
    q = [f"{'BKT 70' if seriya == 'Termo 70' else seriya}, {h['rang']}, {h['L']} × {h['H']} sm", "", "OʻLCHAMLAR"]
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
