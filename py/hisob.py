"""BKT 70 hisob dasturi: konstruksiya tuzilmasidan detal, oyna va shtapik oʻlchamlarini chiqaradi.

Qoidalar CLAUDE.md dagi tasdiqlangan formulalardan olingan. Oʻlchamlar sm da.
Ishga tushirish: python hisob.py konstruksiya.json
"""
import json
import math
import sys
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal


def D(x):
    return Decimal(str(x))


RAMA_R = {"F702": D("3.8"), "F703": D("5.8")}
IMPOST_YARMI = {"M702": D("1.9")}
TABAQA_AYIRMA = {"V702": D("11.1"), "V707": D("18.4"), "V708": D("17.1")}
# Tabaqa ichidagi impost (ProfOkna "Импост - Створка" T-ulanish, ikki uchi; foydalanuvchi, 2026-11-09):
# laminatsiz shu, laminatda +0,16 (TABAQA_AYIRMA bilan birga oʻzgaradi, farqi bir xil qoladi)
TABAQA_IMPOST_AYIRMA = {"V702": D("11.08"), "V707": D("18.08"), "V708": D("17.08")}
ESHIK_PROFILI = {"ichkariga": "V708", "tashqariga": "V707"}  # Balkon Qanot / Balkon Oʻrta
ROM_TABAQA_PROFILI = "V702"
SHTAPIK_TURLARI = {24, 32}
SHTAPIK_QALINLIGI = D("2.2")
# Laminatsiya plyonkasi: katalog oʻlchami laminatsiz (oq, 306g, anod); laminatsiyada har profil +0,08 sm,
# impost tanasiga nisbatan (yarmi +0,04), shtapik ham (foydalanuvchi, 2026-11-07)
LAMINAT_QOSHIMCHA = D("0.08")
LAPSHA_PROFILI = "H702"
LAPSHA_ENI = D("0.5")
ESHIK_MIN_TABAQA = D("65")
ARKA_ZAPAS = D("40")  # egiladigan profilga qoʻshiladi, termo (foydalanuvchi, 2026-11-06)

# ---------- PVX Engelberg 7000 (foydalanuvchi, 2026-11-08; ProfStroy seriya 6) ----------
# Seriya rama kodidan aniqlanadi: 7051 — Engelberg. Hozircha faqat rom: gluxoy, rom tabaqasi (qanot), impost.
# r = 5,4 (7053 + 7051 T-ulanish 54 mm); impost qalinligi 4,4 → yarmi 2,2; laminatda har profil +0,08 (yarmi +0,04).
# Kosa payvand uchun +0,5 kesiladi; impost payvandlanmaydi (ichki oʻlcham); qanot = ichki + 2,2 (payvand shu ichida),
# qanot ichki = qanot − 0,5 − r − r; oyna = ichki − 1,5 (gluxoy va qanot); shtapik 45°, eni va boʻyi ichki oʻlchamga teng.
RAMA_R["7051"] = D("5.4")
IMPOST_YARMI["7053"] = D("2.2")
TABAQA_AYIRMA["7052"] = D("0.5") + 2 * RAMA_R["7051"]   # qanot ichki = qanot − 0,5 − r − r (laminatda r + 0,08)
# qanot ichidagi impost 7053 (ProfOkna T-ulanish 62 mm, foydalanuvchi 2026-11-09): qanot tayyor (kesish − 0,5) − 2 × 6,2
TABAQA_IMPOST_AYIRMA["7052"] = D("0.5") + 2 * D("6.2")
# Eshik (foydalanuvchi, 2026-11-11; ProfOkna 7054/7055): T (tashqariga) 7054 "Balkon Urta", Z (ichkariga) 7055
# "Balkon Kanot". Qanot profili 120 mm (romniki 88) → qanot ichki = kesish − 0,5 − 8,6 − 8,6; ichidagi impost
# T-ulanishi 94 mm → impost = qanot tayyor − 2 × 9,4. Kesish: kosaga tegadigan har tomoniga + 1,3, impostga + 1,2.
for _p in ("7054", "7055"):
    TABAQA_AYIRMA[_p] = D("0.5") + 2 * D("8.6")
    TABAQA_IMPOST_AYIRMA[_p] = D("0.5") + 2 * D("9.4")

# ---------- Aldoks (alyumin; foydalanuvchi, 2026-11-11; katalog "ALDOX System - AKFA Group") ----------
# Rama 183 Kosa: r = 4,25 (korpus 42,5 mm); impost 182 Urta 90° kesiladi, uzunligi = H − r − r, yarmi 2,125.
# Qanot 181 kesish = ichki eni + 1,3, boʻyi + 1,5 (rom va eshikda); qanot ichki = kesish − 5,95 − 5,95;
# oyna (tabaqa va gluxoy) = ichki − 1. Shtapik 105 Termodagidek: gorizontal = ichki eni,
# vertikal = ichki boʻyi − 2 × 1,7. Laminatda har profil + 0,08 (Termodagidek). Hivich 6 m.
# ADT / (N) / NEO — profil kodi va oʻlchami bir xil, faqat diller nomi (tanlov.ald_tur).
RAMA_R["183"] = D("4.25")
IMPOST_YARMI["182"] = D("2.125")
# Chift Quloq 109 (katalog 1-4, 3-6..3-8): koʻrinadigan eni 42,5 — impostdek, yarmi 2,125 (foydalanuvchi, 2026-11-14)
IMPOST_YARMI["109"] = D("2.125")
TABAQA_AYIRMA["181"] = 2 * D("5.95")
# Tabaqa ichidagi impost 182 = qanot ichki = qanot − 5,95 − 5,95 (qanot yuzasi 5,95; foydalanuvchi, 2026-11-14);
# laminatda yana − 0,16. 182 qanot (yengil eshik tashqariga) ichiga impost hali yoʻq.
for _p in ("181", "185", "198"):
    TABAQA_IMPOST_AYIRMA[_p] = 2 * D("5.95")
# Eshik (foydalanuvchi, 2026-11-14): ichkariga 198 Balkon Qanot, tashqariga 185 Balkon Urta; qanot ichki = kesim − 5,95 − 5,95
for _p in ("198", "185", "182"):  # 182 — yengil eshik qanoti tashqariga (foydalanuvchi, 2026-11-14)
    TABAQA_AYIRMA[_p] = 2 * D("5.95")


@dataclass(frozen=True)
class Seriya:
    nomi: str
    impost: str            # standart impost
    rom_tabaqa: str        # rom tabaqasi (qanot) profili
    tabaqa_qoshimcha: D    # qanot = ichki + shu
    tabaqa_oyna: D         # qanot oynasi = qanot ichki − shu
    rama_payvand: D        # rama detaliga kesishda qoʻshiladi
    shtapik_45: bool       # True: shtapik eni ham, boʻyi ham ichki oʻlchamga teng, bitta profil
    shtapik: dict          # oyna qalinligi → shtapik profili
    eshik: bool            # eshik, portal, arka, egilgan impost bormi
    pvx: bool = False      # PVX: fortochkada doim ruchka, arka egish narxi PVX
    arka_zapas: D = D(40)  # egiladigan detalga qoʻshiladi
    eshik_profili: dict = field(default_factory=lambda: {"ichkariga": "V708", "tashqariga": "V707"})
    eshik_kosa: D = D("0.6")    # eshik qanoti kesishi: kosaga tegadigan har tomoniga
    eshik_impost: D = D("0.6")  # impostga tegadigan har tomoniga
    eshik_2_qoshimcha: D = D("0.5")  # 2 tabaqa: L1 + L2 = ichki eni + shu
    shtulp: str = "A701"
    shtulp_ayirma: D = D(7)    # shtulp = tabaqa boʻyi − shu
    tabaqa_qoshimcha_boy: D = None  # qanot boʻyi = ichki + shu (None — tabaqa_qoshimcha)
    gluxoy_oyna: D = D("1.5")       # gluxoy oynasi = ichki − shu
    shtapik_qalinligi: D = D("2.2")  # vertikal shtapik = ichki boʻyi − 2 × shu (shtapik_45 boʻlmasa)
    oyna_standart: int = 24         # oyna qalinligi berilmasa
    faqat_rom: bool = False         # hozircha faqat gluxoy, rom tabaqasi va impost
    rang_yoq: tuple = ()            # bu seriyada boʻlmaydigan rang turkumlari
    eshik_en_jami: D = None         # eshik qanoti eni = ichki + shu (None — eshik_kosa / eshik_impost har tomonga)
    eshik_boy_jami: D = None        # eshik qanoti boʻyi = ichki + shu
    eshik_profili_yengil: dict = None  # tanlov "eshik_tur" = "yengil" boʻlsa (Aldoks: Qanot / Urta)
    fortochka_oyna: D = D("1.5")    # fortochka oynasi = qanot ichki − shu
    arka_profilsiz: bool = False    # egiladigan profilni bukuvchi oʻzi beradi: profil hisobiga kirmaydi, faqat xizmat
    chift: str = None               # ramani boʻladigan profil (Aldoks: 109 Chift Quloq)


TERMO70 = Seriya("Termo 70", "M702", "V702", D("1.1"), D(2), D(0), False, {}, True)
# Engelberg eshigi (foydalanuvchi, 2026-11-11): 2 tabaqa — L1 = (kosa ichki eni + 1) : 2, 65 dan kam boʻlsa 65;
# shtulp 7058 (Adaptor Bez Imposta) passiv qanot boʻyi − 1,7. Arka: egiladigan detal = eni + chuqurlik + 20.
ENGELBERG = Seriya("Engelberg 7000", "7053", "7052", D("2.2"), D("1.5"), D("0.5"), True, {24: "7056", 32: "7057"}, True,
                   pvx=True, arka_zapas=D(20), eshik_profili={"ichkariga": "7055", "tashqariga": "7054"},
                   eshik_kosa=D("1.3"), eshik_impost=D("1.2"), eshik_2_qoshimcha=D(1), shtulp="7058",
                   shtulp_ayirma=D("1.7"))
ALDOKS = Seriya("Aldoks", "182", "181", D("1.3"), D(1), D(0), False, {20: "105"}, True,
                tabaqa_qoshimcha_boy=D("1.5"), gluxoy_oyna=D(1), shtapik_qalinligi=D("1.7"), oyna_standart=20,
                faqat_rom=True, rang_yoq=("Anod",),  # anod qoʻshilmaydi (foydalanuvchi, 2026-11-11)
                # eshik (foydalanuvchi, 2026-11-14): qanot ichki + 1,3 / + 1,5; 2 tabaqa L1 + L2 = ichki − 0,5;
                # shtulp oʻrnida Urta 182 = eshik ichki boʻyi − 0,3 (qanot boʻyi − 1,8)
                eshik_profili={"ichkariga": "198", "tashqariga": "185"}, eshik_en_jami=D("1.3"),
                eshik_profili_yengil={"ichkariga": "181", "tashqariga": "182"},
                eshik_boy_jami=D("1.5"), eshik_2_qoshimcha=D("-0.5"), shtulp="182", shtulp_ayirma=D("1.8"),
                fortochka_oyna=D(1),  # fortochka oynasi ham ichki − 1 (foydalanuvchi, 2026-11-14)
                # arka (foydalanuvchi, 2026-11-14): bukuvchi profilni AKFA dan oʻzi oladi va bukadi, metriga
                # toʻlanadi — egiladigan profil hisobdan chiqadi, "Arka bukish (Aldoks)" xizmati ichida
                arka_profilsiz=True, chift="109")
SERIYA_RAMA = {"F702": TERMO70, "F703": TERMO70, "7051": ENGELBERG, "183": ALDOKS}
ALDOKS_PROFILLARI = {"183", "181", "182", "105", "185", "198", "109"}
# Seriya impostidan ramasi (impost tanlovi tekshiruvi uchun)
IMPOST_RAMA = {"M702": "F702", "7053": "7051", "182": "183"}
ENGELBERG_PROFILLARI = {"7051", "7052", "7053", "7054", "7055", "7056", "7057", "7058", "0701", "0703", "0701-2", "0703-2", "0702-2"}
# Metall (armatura) qalinligi (foydalanuvchi, 2026-11-09, Romchi kabi tanlov): 1,5 mm (standart) yoki 2 mm.
# 2 mm armatura alohida kod bilan ("0701-2"): raskroy, diller roʻyxati va narx oʻzi ajraladi.
ENG_METALL = ("1.5", "2")
# Armatura (foydalanuvchi, 2026-11-08): hamma detalga; uzunlik = kesish uzunligi − ayirma (laminatda ham shu),
# 6 m hivichdan raskroy. Samorez 3,9×16: armatura uzunligi 70 dan kalta — 2 ta, aks holda uzunlik : 35 yuqoriga.
ARMATURA = {"7051": ("0701", D(13)), "7052": ("0701", D(13)), "7053": ("0703", D("0.5")),
            # eshik qanoti (foydalanuvchi, 2026-11-11): "Metall Vst. BALKON QANOT 7000 (2mm)", doim 2 mm, kesish − 13
            "7054": ("0702-2", D(13)), "7055": ("0702-2", D(13))}
ARMATURA_SAMOREZ = "3,9×16 YSBM"
ARMATURA_QADAM = D(35)
ARMATURA_KALTA = D(70)
# Rezina (foydalanuvchi, 2026-11-08): Termo 70 (ProfOkna) qoidasi, nomlari almashtirilgan:
# A01-005 → EPDM 5108 (qanot perimetri × 1), A01-003 → EPDM 5025 (× 2), A01-002 → EPDM 5025 (oyna perimetri
# + har tomonga 2 sm). EPDM Ю ishlatilmaydi — shtapikning oʻz rezinasi bor.
REZINA_CHET = "EPDM 5025"
REZINA_QANOT = "EPDM 5108"


# Lambri (foydalanuvchi, 2026-11-09): PVX lambri, tasma 10 sm, hivich 6 m (diller "Lambri II (N)", ProfOkna 1080
# "Lambri II"). Oyna oʻrniga, boʻlakka oyna_turi = "Lambri" berilsa. Tik teriladi: tasma soni = (ichki eni − 1) : 10
# yuqoriga, uzunligi = ichki boʻyi − 1. Shtapik, rezina, podstavka — hech narsa kerak emas.
LAMBRI = "Lambri"
LAMBRI_PROFIL = "LII"
LAMBRI_ENI = D(10)
LAMBRI_AYIRMA = D(1)
HIVICH_6 = {LAMBRI_PROFIL}


def oyna_qalinligi(k, umumiy=None):
    """Konstruksiya oyna qalinligi (mm): berilmasa seriya standarti (Termo, Engelberg 24; Aldoks 20)."""
    umumiy = umumiy or {}
    q = k.get("oyna_qalinligi") or umumiy.get("oyna_qalinligi")
    if q:
        return int(q)
    s = SERIYA_RAMA.get(k.get("rama") or umumiy.get("rama"))
    return s.oyna_standart if s else 24


def hivich_metr(kalit, standart):
    """Profil narxi qaysi hivich uzunligiga (m): Engelberg 6 m (foydalanuvchi, 2026-11-08), qolgani narxlardagi."""
    k = narx_kaliti(kalit)
    return 6 if k.startswith(("ENG ", "ALD ")) or k.split(" ")[-1] in HIVICH_6 else standart


def profil_narxi(narxlar, artikul, rang):
    """Hivich narxi: rang boʻyicha; armatura (metall) rangga bogʻliq emas — "*" kaliti."""
    d = narxlar["profil_hivich"].get(artikul, {})
    return d.get(rang, d.get("*"))


def narx_kaliti(profil):
    """Profil narx kaliti: "BKT70 F702", "ENG 7051"."""
    if profil.startswith(("BKT70 ", "ENG ", "ALD ")):
        return profil
    if profil in ALDOKS_PROFILLARI:
        return f"ALD {profil}"
    return f"ENG {profil}" if profil in ENGELBERG_PROFILLARI else f"BKT70 {profil}"


class Yoy:
    """Aylana yoyi (rama arkasi yoki egilgan impost): eni, chuqurligi, markazi cx, choʻqqisi y0 (tepadan), sm.

    Qoidalar (foydalanuvchi, 2026-11-06): egiladigan detal uzunligi = eni + chuqurlik + 40;
    tabaqa, shtapik va oyna toʻgʻri toʻrtburchak boʻyicha, faqat yoyga tegadigan detali egiladi.
    """

    def __init__(self, cx, en, chuqurlik, y0=0.0):
        self.en, self.a = float(en), float(chuqurlik)
        self.R = (self.en ** 2 / 4 + self.a ** 2) / (2 * self.a)
        self.cx, self.y0 = float(cx), float(y0)

    def y(self, x, ichkari=0.0):
        """x nuqtada yoy (ichkari > 0 — ostidagi, < 0 — ustidagi konsentrik yoy) tepadan qanchalik pastda."""
        r = self.R - ichkari
        return self.y0 + self.R - math.sqrt(max(0.0, r * r - (float(x) - self.cx) ** 2))

    def chuqurlik(self, x1, x2):
        x1, x2 = float(x1), float(x2)
        eng_baland = self.y(min(max(self.cx, x1), x2))
        return D(round(max(self.y(x1), self.y(x2)) - eng_baland, 2))

    def qiyalik(self, x, ichkari=0.0):
        """x nuqtada urinmaning gorizontalga qiyaligi, gradus."""
        r = self.R - float(ichkari)
        return math.degrees(math.asin(min(1.0, abs(float(x) - self.cx) / r)))

    def uch_qiyaligi(self):
        """Yoy uchida (choʻqqidan eni/2 da) urinmaning gorizontalga qiyaligi, gradus."""
        return math.degrees(math.asin(min(1.0, self.en / 2 / self.R)))

    def yarim_en(self, y, ichkari):
        """y balandlikda (tepadan) ichki yoyning markazdan yarim kengligi; yoy yoʻq boʻlsa None."""
        r = self.R - float(ichkari)
        q = r * r - (self.y0 + self.R - float(y)) ** 2
        return math.sqrt(q) if q > 0 else None


def Arka(L, a):
    """Rama arkasi: tepasi butun eni boʻyicha yoy, choʻqqisi rama tashqi chetida."""
    return Yoy(float(L) / 2, L, a)


class HisobXato(ValueError):
    """Kiritilgan konstruksiya notoʻgʻri yoki qoidalarga zid."""


@dataclass
class Zona:
    """Oʻlchanadigan boʻlak va uning har tomonidan ayiriladigan qiymatlar."""
    en: Decimal
    boy: Decimal
    chap: Decimal
    ong: Decimal
    tepa: Decimal
    past: Decimal
    x: Decimal = D(0)  # boʻlak tashqi chegarasining chap cheti (rama tashqi chetidan), arka uchun
    y: Decimal = D(0)  # tepa cheti
    tepa_yoy: object = None  # boʻlak tepasi yoy boʻlsa (rama arkasi yoki egilgan impost)
    past_yoy: object = None  # boʻlak pasti yoy boʻlsa (egilgan impost)

    @property
    def ichki_en(self):
        return self.en - self.chap - self.ong

    @property
    def ichki_boy(self):
        return self.boy - self.tepa - self.past


class Hisob:
    def __init__(self, oyna_qalinligi, vertikal_r=True, lam=D(0), seriya=None, metall="1.5"):
        self.seriya = seriya or TERMO70
        if metall not in ENG_METALL:
            raise HisobXato(f"Metall qalinligi notoʻgʻri: {metall} (1.5 yoki 2)")
        self.metall = metall
        self.lam = lam  # laminatsiyada 0,08, aks holda 0
        self.eshik_tur = "balkon"  # Aldoks: "yengil" — qanot 181 / urta 182 dan (foydalanuvchi, 2026-11-14)
        self.shtapik = self.seriya.shtapik_qalinligi + lam
        turlar = set(self.seriya.shtapik) or SHTAPIK_TURLARI
        if oyna_qalinligi not in turlar:
            raise HisobXato(f"Oyna qalinligi uchun shtapik yoʻq: {oyna_qalinligi} mm "
                            f"(faqat {' yoki '.join(map(str, sorted(turlar)))})")
        self.qalinlik = oyna_qalinligi
        self.vertikal_r = vertikal_r  # False: boʻyiga ham oddiy G shtapik
        self.profillar = {}
        self.oynalar = {}
        self.lambrilar = []  # (joy, en, boʻy, tasma soni)
        self.joriy_oyna = None  # boʻlakka berilgan oyna turi (None — konstruksiyaniki)
        self.ogohlantirishlar = []
        self.qoida_yoq = []
        self.ramalar = {}
        self.rama_perimetri = D(0)
        self.tabaqa_soni = 0
        self.tabaqalar = {}  # profil: soni (burchak soedineli uchun)
        self.tabaqa_boylari = []
        self.rom_tabaqa_boylari = []
        self.dvaynoylar = []
        self.rom_qanotlari = []  # (en, boʻy) oddiy rom tabaqasi kesimi (Aldoks petlya soni)
        self.dvaynoy_tomonlari = []  # petlya tomoni (chap / ong) — Roto nojnitsa petlyasi va planka
        self.fortochkalar = []  # (en, boʻy, ruchka bilanmi)
        self.impost_soni = 0
        self.armatura_samorez = 0
        self.lapsha_samorez = 0
        self.medved_samorez = 0
        self.r = D(0)  # joriy rama r (laminat bilan): eshik qanoti kosaga tegadimi
        self.eshik_qanotlari = []  # (en, boʻy) har eshik qanoti (kesish), furnitura uchun
        self.eshiklar = []
        self.markaziy_rezina = D(0)
        self.oyna_rezinasi = D(0)
        self.tabaqa_oyna_soni = 0
        self.gluxoy_oyna_soni = 0
        self.arka = None
        self.segment = False  # yarim aylana: yon devorsiz (arka balandligi = H)
        self.segment_ramalar = 0
        self.arka_metr = D(0)      # egiladigan profil (egish xizmati), sm
        self.burchaklar = {}       # (nomi, profil, uzunlik) → "tepa uchi 74,05°" (45/90 dan boshqasi)
        self.arka_oyna_m2 = D(0)   # arkali oyna yuzasi (ustama uchun)

    @staticmethod
    def yoy_chuqurligi(yoy, z):
        """Boʻlak tepasi yoki pasti yoyga tegsa — yoyning shu boʻlak ustidagi chuqurligi, aks holda 0."""
        return yoy.chuqurlik(z.x, z.x + z.en) if yoy else D(0)

    def burchak(self, nomi, profil, uzunlik, matn):
        """45° va 90° dan boshqa kesish burchagi (foydalanuvchi, 2026-11-14: faqat shular yoziladi)."""
        self.burchaklar[(nomi, profil, uzunlik)] = matn

    def rama_burchaklari(self):
        """Arka bilan yon devor (yoki yarim aylanada past) tutashgan uchdagi kesish burchagi, tashqi chet boʻyicha.

        Urinma gorizontalga α = arcsin(L/2 : R) qiya; yon devor bilan tutashuv 90° + α, past bilan α — har detal yarmida.
        """
        alfa = math.degrees(math.asin(min(1.0, self.arka.en / 2 / self.arka.R)))
        return (alfa / 2) if self.segment else (90 + alfa) / 2

    @staticmethod
    def gradus(b):
        """Kesish burchagi matni; 45° va 90° boʻlsa None (ustalar biladi)."""
        b = round(b, 2)
        if b in (45, 90, 0):
            return None
        return f"{b:.2f}".rstrip("0").rstrip(".").replace(".", ",") + "°"

    def burchak_qosh(self, nomi, profil, uzunlik, uch, b):
        m = self.gradus(b)
        if m:
            self.burchak(nomi, profil, uzunlik, f"{uch} {m}")

    def _arka_burchak(self, profil, en, a, yon):
        m = self.gradus(self.rama_burchaklari())
        if not m:
            return
        self.burchak(yon[0], profil, yon[1], f"{yon[2]} {m}")
        self.burchak("Rama arka", profil, en + a + self.seriya.arka_zapas, f"ikki uchi {m}")

    def egilgan(self, nomi, profil, en, chuqurlik, egish=True):
        uzunlik = en + chuqurlik + self.seriya.arka_zapas
        if egish and self.seriya.arka_profilsiz:
            self.arka_metr += uzunlik  # profil xizmat ichida (Aldoks)
            return
        # egiladigan detalga armatura qoʻyilmaydi (Engelberg, foydalanuvchi 2026-11-11)
        self.detal(nomi, profil, uzunlik, 1, armatura=False)
        if egish:
            self.arka_metr += uzunlik

    def detal(self, nomi, profil, uzunlik, soni, armatura=True):
        if uzunlik <= 0:
            raise HisobXato(f"{nomi} uzunligi musbat emas: {uzunlik}")
        key = (nomi, profil, uzunlik)
        self.profillar[key] = self.profillar.get(key, 0) + soni
        if armatura and profil in ARMATURA and self.seriya is ENGELBERG:
            arm, ayirma = ARMATURA[profil]
            u = uzunlik - ayirma
            if u <= 0:
                raise HisobXato(f"{nomi} juda kalta, armatura sigʻmaydi: {uzunlik}")
            if self.metall == "2" and not arm.endswith("-2"):
                arm += "-2"
            akey = (f"Armatura ({nomi.lower()})", arm, u)
            self.profillar[akey] = self.profillar.get(akey, 0) + soni
            bitta = 2 if u < ARMATURA_KALTA else math.ceil(u / ARMATURA_QADAM)
            self.armatura_samorez += int(bitta) * soni

    def oyna(self, joy, ichki_en, ichki_boy, ayirma, arka=D(0), past=D(0), yonlar=2):
        if self.joriy_oyna == LAMBRI:
            return self.lambri(joy, ichki_en, ichki_boy, arka or past)
        en, boy = ichki_en - ayirma, ichki_boy - ayirma
        if en <= 0 or boy <= 0:
            raise HisobXato(f"{joy} oynasi uchun joy yetmaydi: {en} × {boy}")
        key = (joy, en, boy, self.joriy_oyna)
        self.oynalar[key] = self.oynalar.get(key, 0) + 1
        # rezina arka tomonida tekis profil boʻyicha: eni + chuqurlik (foydalanuvchi, 2026-11-06)
        # yarim aylanada ramaga tegadigan tomonda yon yoʻq (yonlar: 0, 1 yoki 2)
        self.oyna_rezinasi += 2 * en + yonlar * boy + 8 + arka + past
        if arka or past:
            self.arka_oyna_m2 += en * boy / 10000
        if joy == "Gluxoy":
            self.gluxoy_oyna_soni += 1
        else:
            self.tabaqa_oyna_soni += 1
        # shtapik profil bilan birga egiladi, xizmati profil narxiga kirgan
        tekis = 2 - (arka > 0) - (past > 0)
        if tekis:
            self.detal("Shtapik gorizontal", self.sht_nomi(), ichki_en, tekis)
        for c in (arka, past):
            if c:
                self.egilgan("Shtapik arka", self.sht_nomi(), ichki_en, c, egish=False)
        if yonlar:
            self.detal("Shtapik vertikal", self.sht_nomi(True), ichki_boy - self.sht_ayirma(), yonlar)

    def sht_nomi(self, vertikal=False):
        """Termo: G24 (vertikal G24-R); Engelberg: 7056 / 7057 hamma tomonga (foydalanuvchi, 2026-11-08)."""
        g = self.qalinlik
        if self.seriya.shtapik:  # Engelberg 7056/7057, Aldoks 105 — hamma tomonga bitta profil
            return self.seriya.shtapik[g]
        return f"G{g}-R" if vertikal and self.vertikal_r else f"G{g}"

    def sht_ayirma(self):
        """Vertikal shtapik ichki boʻydan qancha kalta: Termo 2 × qalinlik, Engelberg 45° — 0."""
        return D(0) if self.seriya.shtapik_45 else 2 * self.shtapik

    def lambri(self, joy, ichki_en, ichki_boy, yoy=False):
        if yoy:
            raise HisobXato("Arkali boʻlakka lambri hozircha yoʻq")
        en, boy = ichki_en - LAMBRI_AYIRMA, ichki_boy - LAMBRI_AYIRMA
        if en <= 0 or boy <= 0:
            raise HisobXato(f"{joy} lambrisi uchun joy yetmaydi: {en} × {boy}")
        soni = int(math.ceil(en / LAMBRI_ENI))
        self.detal(f"Lambri ({joy.lower()})", LAMBRI_PROFIL, boy, soni)
        self.lambrilar.append((joy, en, boy, soni))

    def shakl_oyna(self, ichki_en, ichki_boy, tekis_gor, tekis_ver, yoylar):
        """Toʻrtburchak boʻlmagan gluxoy oyna (portal U oynasi): oʻlcham va narx eng katta eni × boʻyi boʻyicha.

        Shtapik har tomon boʻyicha: gorizontallari oʻz eni, vertikallari boʻyi − 2 × qalinlik, yoy tomoni egiladi.
        Rezina tomonlar yigʻindisi, yoy tomoni tekis profil boʻyicha (eni + chuqurlik), + 8. yoylar: [(eni, chuqurlik)].
        """
        if self.joriy_oyna == LAMBRI:
            raise HisobXato("Shakldor (portal) oynaga lambri hozircha yoʻq")
        en, boy = ichki_en - D("1.5"), ichki_boy - D("1.5")
        if en <= 0 or boy <= 0:
            raise HisobXato(f"Portal oynasi uchun joy yetmaydi: {en} × {boy}")
        key = ("Gluxoy (shakl)", en, boy, self.joriy_oyna)
        self.oynalar[key] = self.oynalar.get(key, 0) + 1
        self.gluxoy_oyna_soni += 1
        self.arka_oyna_m2 += en * boy / 10000
        rezina = D(8) + sum(e + c for e, c in yoylar)
        for u in tekis_gor:
            self.detal("Shtapik gorizontal", self.sht_nomi(), u, 1)
            rezina += u
        for u in tekis_ver:
            if u > self.sht_ayirma():
                self.detal("Shtapik vertikal", self.sht_nomi(True), u - self.sht_ayirma(), 1)
                rezina += u
        for e, c in yoylar:
            self.egilgan("Shtapik arka", self.sht_nomi(), e, c, egish=False)
        self.oyna_rezinasi += rezina

    def tabaqa(self, joy, profil, en, boy, shtulp_yonida=False, rom=False, dvaynoy=False, fortochka=None, arka=D(0), past=D(0),
               ichki_impost=None):
        self.tabaqa_soni += 1
        self.tabaqalar[profil] = self.tabaqalar.get(profil, 0) + 1
        if fortochka is not None:
            self.fortochkalar.append((en, boy, fortochka))
        elif dvaynoy:
            self.dvaynoylar.append((en, boy))
        else:
            (self.rom_tabaqa_boylari if rom else self.tabaqa_boylari).append(boy)
            if rom:
                self.rom_qanotlari.append((en, boy))
        # Markaziy rezina: rama yoki impostga tegadigan tomonlar
        self.markaziy_rezina += 2 * en + (boy if shtulp_yonida else 2 * boy) + arka + past
        tekis = 2 - (arka > 0) - (past > 0)
        if tekis:
            self.detal("Tabaqa eni", profil, en, tekis)
        for c in (arka, past):
            if c:
                self.egilgan("Tabaqa arka", profil, en, c)
        self.detal("Tabaqa boʻyi", profil, boy, 2)
        ayirma = TABAQA_AYIRMA[profil] + 2 * self.lam  # ikki tomon profili
        # fortochka oynasi qanot ichki − 1,5, boshqa tabaqalarda − 2 (foydalanuvchi, 2026-11-07); Engelberg − 1,5
        oyna_ayirma = self.seriya.fortochka_oyna if fortochka is not None else self.seriya.tabaqa_oyna
        if ichki_impost:
            if profil not in TABAQA_IMPOST_AYIRMA:
                raise HisobXato(f"{profil} qanoti ichiga impost hali yoʻq")
            # impost tabaqaga tegadigan har uchida ichki chetdan shuncha chuqur kiradi (V707 0,16; V708, V702 0,01)
            chuqur = (TABAQA_AYIRMA[profil] - TABAQA_IMPOST_AYIRMA[profil]) / 2
            self._tabaqa_ichi(joy, en - ayirma, boy - ayirma, oyna_ayirma, ichki_impost, arka or past,
                              chuqur, (True, True, True, True))
        else:
            self.oyna(joy, en - ayirma, boy - ayirma, oyna_ayirma, arka, past)

    def _tabaqa_ichi(self, joy, ichki_en, ichki_boy, oyna_ayirma, ii, yoy, chuqur=D(0), tabaqada=(True,) * 4):
        """Tabaqa ichidagi M702 impost (foydalanuvchi, 2026-11-09; eshik va rom tabaqasi).

        ii = {"yonalish", "olchamlar", "bolaklar"?}: olchamlar — har boʻlakning ichki oʻlchami (tabaqa ichki
        chetidan yoki impost chetidan impost chetigacha; tepadan / chapdan), null — qolgani teng. bolaklar[i]
        null boʻlsa oyna, aks holda shu boʻlak ichida yana impost (tik va yotiq aralash, ichma-ich).
        Impost uzunligi = boʻlak ichki eni (yotiq) yoki boʻyi (tik) + tabaqaga tegadigan har uchiga `chuqur`
        (ProfOkna ayirmasi, TABAQA_IMPOST_AYIRMA); impostga tegadigan uchi — chetigacha. tabaqada = (chap, oʻng,
        tepa, past) tomonlar tabaqa profilimi. Uchlariga 01.553 × 2 (impost_soni).
        Har boʻlak oynasi = ichki − oyna ayirmasi (tabaqada 2, fortochkada 1,5), shtapik va rezina har oynaga.
        """
        if yoy:
            raise HisobXato("Arkali tabaqa ichiga impost hozircha yoʻq")
        vertikal = ii.get("yonalish") == "vertikal"
        if not vertikal and ii.get("yonalish") != "gorizontal":
            raise HisobXato("Tabaqa ichi impost yoʻnalishi vertikal yoki gorizontal boʻlishi kerak")
        olch = list(ii.get("olchamlar") or [])
        if len(olch) < 2:
            raise HisobXato("Tabaqa ichi impostida kamida 2 boʻlak boʻladi")
        bolaklar = list(ii.get("bolaklar") or [None] * len(olch))
        if len(bolaklar) != len(olch):
            raise HisobXato("Tabaqa ichi: bolaklar va olchamlar soni bir xil boʻlishi kerak")
        impost = self.seriya.impost  # Termo M702, Engelberg 7053 (armatura detal() da)
        tana = 2 * (IMPOST_YARMI[impost] + self.lam / 2)
        jami = (ichki_en if vertikal else ichki_boy) - tana * (len(olch) - 1)
        berilgan = [D(str(x)) for x in olch if x is not None]
        boshlar = len(olch) - len(berilgan)
        qolgan = jami - sum(berilgan, D(0))
        if boshlar == 0 and qolgan != 0:
            raise HisobXato(f"Tabaqa ichi boʻlaklari jami {jami} boʻlishi kerak, {jami - qolgan} berilgan")
        teng = qolgan / boshlar if boshlar else D(0)
        olch = [D(str(x)) if x is not None else teng for x in olch]
        if any(x <= 0 for x in olch):
            raise HisobXato(f"Tabaqa ichiga impost sigʻmaydi: ichki {ichki_en} × {ichki_boy}")
        n = len(olch) - 1
        chap, ong, tepa, past = tabaqada
        uchlar = (tepa, past) if vertikal else (chap, ong)
        self.detal("Tabaqa ichi impost", impost, (ichki_boy if vertikal else ichki_en) + chuqur * sum(uchlar), n)
        self.impost_soni += n
        for i, (x, bola) in enumerate(zip(olch, bolaklar)):
            en, boy = (x, ichki_boy) if vertikal else (ichki_en, x)
            boshi, oxiri = i == 0, i == n
            yon = (chap and boshi, ong and oxiri, tepa, past) if vertikal else (chap, ong, tepa and boshi, past and oxiri)
            eski = self.joriy_oyna
            if bola and bola.get("oyna_turi"):
                self.joriy_oyna = bola["oyna_turi"]  # tabaqa ichi boʻlagiga ham oʻz oynasi / lambri
            try:
                if bola and bola.get("olchamlar"):
                    self._tabaqa_ichi(joy, en, boy, oyna_ayirma, bola, yoy, chuqur, yon)
                else:
                    self.oyna(joy, en, boy, oyna_ayirma)
            finally:
                self.joriy_oyna = eski

    def rama(self, profil, en, boy):
        self.medved_samorez += medved_soni(en, boy)
        if self.segment:
            # Yarim aylana (foydalanuvchi, 2026-11-07): past + arka, yon yoʻq; 2 burchakka ugl soedinitel
            a = D(str(self.arka.a))
            self.segment_ramalar += 1
            self.rama_perimetri += en + en + a
            self.detal("Rama eni", profil, en, 1)
            self.egilgan("Rama arka", profil, en, a)
            self._arka_burchak(profil, en, a, ("Rama eni", en, "ikki uchi"))
            return
        self.ramalar[profil] = self.ramalar.get(profil, 0) + 1
        if self.arka:
            a = D(str(self.arka.a))
            self.rama_perimetri += en + 2 * (boy - a) + en + a
            zapas = self.seriya.rama_payvand
            self.detal("Rama eni", profil, en + zapas, 1)
            self.detal("Rama boʻyi", profil, boy - a + zapas, 2)
            self.egilgan("Rama arka", profil, en, a)
            self._arka_burchak(profil, en, a, ("Rama boʻyi", boy - a + zapas, "tepa uchi"))
            return
        self.rama_perimetri += 2 * (en + boy)
        zapas = self.seriya.rama_payvand  # PVX: payvand uchun (foydalanuvchi, 2026-11-08)
        self.detal("Rama eni", profil, en + zapas, 2)
        self.detal("Rama boʻyi", profil, boy + zapas, 2)

    def eslatma(self, royxat, matn):
        if matn not in royxat:
            royxat.append(matn)


def _tashqari_eshik_bor(b):
    if b["tur"] == "eshik":
        return b.get("ochilish") == "tashqariga"
    return any(_tashqari_eshik_bor(x) for x in b.get("bolaklar", []))


def _olchamlar(b, jami, ayirmalar):
    """Boʻlak oʻlchamlarini aniqlaydi.

    Oʻlchami None boʻlgan boʻlaklar qolgan joyni oladi va ularning **ichki razmeri teng** boʻladi
    (foydalanuvchi qoidasi, 2026-11-04): ramaga tegadigan boʻlak impost orasidagidan r − 1,9 ga keng.
    ayirmalar[i] — i-boʻlakning tashqi oʻlchamidan ichkisiga ayiriladigan qism (ikki chetidagi).
    """
    olchamlar = b["olchamlar"]
    if len(olchamlar) != len(b["bolaklar"]) or len(olchamlar) < 2:
        raise HisobXato("Boʻlak va oʻlchamlar soni bir xil, kamida 2 ta boʻlishi kerak")
    berilgan = [D(x) for x in olchamlar if x is not None]
    if any(x <= 0 for x in berilgan):
        raise HisobXato("Boʻlak oʻlchami musbat boʻlishi kerak")
    qoldiq = jami - sum(berilgan)
    boshlar = [i for i, x in enumerate(olchamlar) if x is None]
    if boshlar:
        if qoldiq <= 0:
            raise HisobXato("Boʻlaklar konstruksiyadan katta")
        ichki = (qoldiq - sum(ayirmalar[i] for i in boshlar)) / len(boshlar)
        ichki = ichki.quantize(D("0.01"), rounding=ROUND_HALF_UP)
        natija = [None if x is None else D(x) for x in olchamlar]
        for i in boshlar[:-1]:
            natija[i] = ichki + ayirmalar[i]
        natija[boshlar[-1]] = qoldiq - sum(natija[i] for i in boshlar[:-1])
        return natija
    if qoldiq != 0:
        raise HisobXato(f"Boʻlaklar yigʻindisi {jami} ga teng emas")
    return [D(x) for x in olchamlar]


def _bolinish(b, z, h, ctx):
    vertikal = b["yonalish"] == "vertikal"
    if b["yonalish"] not in ("vertikal", "gorizontal"):
        raise HisobXato(f"Nomaʼlum yoʻnalish: {b['yonalish']}")
    if b.get("lapsha"):
        raise HisobXato("Lapsha faqat alohida ramalar orasida boʻladi (rama ichida — impost)")
    if b.get("egilgan") is not None:
        return _egilgan_bolinish(b, z, h, ctx)
    if any(_chift_mask(b)):
        return _chift_bolinish(b, z, h, ctx, vertikal)
    if vertikal and _tashqari_eshik_bor(b):
        raise HisobXato("Tashqariga ochiladigan eshik yonidagi oyna alohida ramada boʻladi: 'lapshali' turini ishlating")
    yarmi = ctx["yarmi"]
    oxirgi = len(b.get("olchamlar") or []) - 1

    def chetlar(i):
        boshi = yarmi if i > 0 else (z.chap if vertikal else z.tepa)
        oxiri = yarmi if i < oxirgi else (z.ong if vertikal else z.past)
        return boshi, oxiri

    olchamlar = _olchamlar(b, z.en if vertikal else z.boy, [sum(chetlar(i)) for i in range(oxirgi + 1)])
    nomi = "Impost vertikal" if vertikal else "Impost gorizontal"
    turlar = _impost_turlari(b, h, ctx)
    joy = D(0)
    for i, o in enumerate(olchamlar[:-1]):
        joy += o
        u = _impost_uzunligi(vertikal, joy, z, h)
        h.detal(nomi, turlar[i], u, 1)
        _impost_burchagi(nomi, turlar[i], u, vertikal, joy, z, h)
    h.impost_soni += len(olchamlar) - 1
    ichki_ctx = {**ctx, "bolinish_ichida": True}
    q = D(0)
    for i, (olcham, bola) in enumerate(zip(olchamlar, b["bolaklar"])):
        boshi, oxiri = chetlar(i)
        if vertikal:
            yangi = Zona(olcham, z.boy, boshi, oxiri, z.tepa, z.past, z.x + q, z.y, z.tepa_yoy, z.past_yoy)
        else:
            yangi = Zona(z.en, olcham, z.chap, z.ong, boshi, oxiri, z.x, z.y + q,
                         z.tepa_yoy if i == 0 else None, z.past_yoy if i == oxirgi else None)
        q += olcham
        _bolak(bola, yangi, h, ichki_ctx)


# Aldoksda impost oʻrnida boshqa profil (foydalanuvchi, 2026-11-14, Romchi kabi): Qanot 181, Balkon Qanot 198,
# Balkon Urta 185 — Urta 182 qoidasida (uzunlik H − 2r, yarmi 2,125, 90°, uchiga Bolshoy + 3,9×16 × 7)
IMPOST_TURLARI = {"183": {"182", "181", "198", "185"}}


def _impost_turlari(b, h, ctx):
    """Har boʻlinish chizigʻining impost profili: "impost_profil": [null | "181" | …] (null — standart)."""
    n = max(len(b.get("olchamlar") or []) - 1, 0)
    t = b.get("impost_profil")
    if not t:
        return [ctx["impost"]] * n
    if not isinstance(t, list) or len(t) != n:
        raise HisobXato("impost_profil roʻyxati impostlar soniga teng emas")
    ruxsat = IMPOST_TURLARI.get(ctx.get("rama"), set())
    for x in t:
        if x and x not in ruxsat:
            raise HisobXato(f"{h.seriya.nomi}da impost oʻrnida {x} boʻlmaydi")
    return [x or ctx["impost"] for x in t]


def _chift_mask(b):
    """Qaysi boʻlinish chizigʻi Chift Quloq: "chift": true — hammasi, roʻyxat — har chiziq alohida (Romchi kabi)."""
    n = max(len(b.get("olchamlar") or []) - 1, 0)
    c = b.get("chift")
    if isinstance(c, list):
        if len(c) != n:
            raise HisobXato("Chift Quloq roʻyxati impostlar soniga teng emas")
        return [bool(x) for x in c]
    return [bool(c)] * n


def _chift_bolinish(b, z, h, ctx, vertikal):
    """Chift Quloq (Aldoks 109; foydalanuvchi, 2026-11-14): impostdek, lekin ramani boʻlib qoʻyadi.

    Chift butun boʻyga (yotiqda — butun eniga) boradi, 90°. Unga tegadigan kosa (tepa/past yoki yonlar)
    chift oʻqidan 2,125 qolib tugaydi va har uchi Bolshoy soedinitel bilan ulanadi (impostdek).
    Boʻlaklar impost yonidagidek: chift tomonida oʻqdan − 2,125. Chift boʻlmagan chiziqlar — oddiy impost.
    """
    profil = h.seriya.chift
    if not profil:
        raise HisobXato(f"{h.seriya.nomi}da Chift Quloq yoʻq")
    if ctx.get("bolinish_ichida") or h.arka or h.segment:
        raise HisobXato("Chift Quloq faqat ramaning birinchi boʻlinishida (arkasiz) boʻladi")
    mask = _chift_mask(b)
    turlar = _impost_turlari(b, h, ctx)
    cy = IMPOST_YARMI[profil] + h.lam / 2
    iy = ctx["yarmi"]
    oxirgi = len(b.get("olchamlar") or []) - 1

    def chetlar(i):
        boshi = (cy if mask[i - 1] else iy) if i > 0 else (z.chap if vertikal else z.tepa)
        oxiri = (cy if mask[i] else iy) if i < oxirgi else (z.ong if vertikal else z.past)
        return boshi, oxiri

    olchamlar = _olchamlar(b, z.en if vertikal else z.boy, [sum(chetlar(i)) for i in range(oxirgi + 1)])
    rama = ctx["rama"]
    zapas = h.seriya.rama_payvand
    kalit = ("Rama eni" if vertikal else "Rama boʻyi", rama, (z.en if vertikal else z.boy) + zapas)
    h.profillar[kalit] -= 2
    if not h.profillar[kalit]:
        del h.profillar[kalit]
    joy = D(0)
    bosh = D(0)   # kosa boʻlagi boshlanishi (oxirgi chiftdan)
    for i, o in enumerate(olchamlar):
        joy += o
        if i == oxirgi or mask[i]:
            uz = joy - bosh + zapas - cy * ((bosh > 0) + (i < oxirgi))
            h.detal(kalit[0], rama, uz, 2)
            bosh = joy
        if i == oxirgi:
            break
        if mask[i]:
            h.detal("Chift Quloq vertikal" if vertikal else "Chift Quloq gorizontal", profil, z.boy if vertikal else z.en, 1)
            h.impost_soni += 2   # 4 kosa uchi — Bolshoy + samorez impost uchidagidek
        else:
            nomi = "Impost vertikal" if vertikal else "Impost gorizontal"
            h.detal(nomi, turlar[i], _impost_uzunligi(vertikal, joy, z, h), 1)
            h.impost_soni += 1
    ichki_ctx = {**ctx, "bolinish_ichida": True}
    q = D(0)
    for i, (olcham, bola) in enumerate(zip(olchamlar, b["bolaklar"])):
        boshi, oxiri = chetlar(i)
        if vertikal:
            yangi = Zona(olcham, z.boy, boshi, oxiri, z.tepa, z.past, z.x + q, z.y)
        else:
            yangi = Zona(z.en, olcham, z.chap, z.ong, boshi, oxiri, z.x, z.y + q)
        q += olcham
        _bolak(bola, yangi, h, ichki_ctx)


def _egilgan_bolinish(b, z, h, ctx):
    """Egilgan (yoy) impost: yotiq, 2 boʻlak (foydalanuvchi, 2026-11-06).

    olchamlar[0] — boʻlak tepasidan impost oʻqi choʻqqisigacha (oʻrtada). egilgan.chuqurlik — yoy chuqurligi;
    berilmasa tepadagi yoyga parallel (shu boʻlak ustidagi chuqurligi bilan bir xil, pastga surilgan).
    Impost uchlari yon chetlarda, choʻqqidan chuqurlik qadar pastda. Uzunligi eni + chuqurlik + 40.
    """
    if b.get("yonalish") != "gorizontal" or len(b.get("bolaklar") or []) != 2:
        raise HisobXato("Egilgan impost faqat yotiq, 2 boʻlakli boʻlinishda boʻladi")
    eg = b["egilgan"] or {}
    if eg.get("chuqurlik") is not None:
        c = D(eg["chuqurlik"])
    elif z.tepa_yoy:
        c = h.yoy_chuqurligi(z.tepa_yoy, z)
    else:
        raise HisobXato("Egilgan impost chuqurligi berilmagan (tepada arka yoʻq, parallel boʻlolmaydi)")
    yarmi = ctx["yarmi"]
    olchamlar = _olchamlar(b, z.boy, [z.tepa + yarmi, yarmi + z.past])
    tepa_ol = olchamlar[0]
    if c <= 0 or c > z.en / 2:
        raise HisobXato(f"Egilgan impost chuqurligi 0 dan katta va eni yarmidan katta boʻlmasligi kerak: {c}")
    if tepa_ol + c >= z.boy:
        raise HisobXato("Egilgan impost uchlari boʻlakdan pastga tushib ketdi: chuqurlik yoki oʻlcham katta")
    yoy = Yoy(z.x + z.en / 2, z.en, c, z.y + tepa_ol)
    h.egilgan("Impost egilgan", ctx["impost"], z.ichki_en, c)
    # uchlari tik chetga tiraladi: kesim 90° − α (foydalanuvchi, 2026-11-14)
    h.burchak_qosh("Impost egilgan", ctx["impost"], z.ichki_en + c + h.seriya.arka_zapas, "ikki uchi",
                   90 - Yoy(0, z.ichki_en, c).uch_qiyaligi())
    h.impost_soni += 1
    ichki_ctx = {**ctx, "bolinish_ichida": True}
    # Toʻgʻri toʻrtburchak boʻyicha: tepadagi boʻlak impost uchlarigacha, pastdagisi choʻqqidan
    _bolak(b["bolaklar"][0], Zona(z.en, tepa_ol + c, z.chap, z.ong, z.tepa, yarmi, z.x, z.y, z.tepa_yoy, yoy),
           h, ichki_ctx)
    _bolak(b["bolaklar"][1], Zona(z.en, z.boy - tepa_ol, z.chap, z.ong, yarmi, z.past, z.x, z.y + tepa_ol,
                                  yoy, z.past_yoy), h, ichki_ctx)


def _impost_burchagi(nomi, profil, u, vertikal, joy, z, h):
    """Arka ostidagi impost yoyga tiralgan uchining kesimi (45°/90° dan boshqasi; foydalanuvchi, 2026-11-14)."""
    if vertikal:
        for yoy, ichkari, uch in ((z.tepa_yoy, z.tepa, "tepa uchi"), (z.past_yoy, -z.past, "past uchi")):
            if yoy:
                h.burchak_qosh(nomi, profil, u, uch, 90 - yoy.qiyalik(z.x + joy, ichkari))
        return
    yoy = z.tepa_yoy
    y = float(z.y + joy)
    if not yoy or y >= max(yoy.y(z.x), yoy.y(z.x + z.en)):
        return
    yarim = yoy.yarim_en(y, float(z.tepa))
    uchlar = [x for x in (yoy.cx - yarim, yoy.cx + yarim) if float(z.x + z.chap) < x < float(z.x + z.en - z.ong)]
    if uchlar:
        b = yoy.qiyalik(uchlar[0], float(z.tepa))
        h.burchak_qosh(nomi, profil, u, "ikki uchi" if len(uchlar) == 2 else "yoyga tegadigan uchi", b)


def _impost_uzunligi(vertikal, joy, z, h):
    """Impost uzunligi; tepasi yoki pasti yoy boʻlsa yoy bilan kesiladi (konsentrik ichki yoy boʻyicha)."""
    if not z.tepa_yoy and not z.past_yoy:
        return z.ichki_boy if vertikal else z.ichki_en
    if vertikal:
        x = float(z.x + joy)
        tepa = z.tepa_yoy.y(x, float(z.tepa)) if z.tepa_yoy else float(z.y + z.tepa)
        past = z.past_yoy.y(x, -float(z.past)) if z.past_yoy else float(z.y + z.boy - z.past)
        uzunlik = D(round(past - tepa, 2))
    else:
        yoy = z.tepa_yoy
        y = float(z.y + joy)
        if not yoy or y >= max(yoy.y(z.x), yoy.y(z.x + z.en)):
            return z.ichki_en
        yarim = yoy.yarim_en(y, float(z.tepa))
        if yarim is None:
            raise HisobXato("Yotiq impost arkadan tashqarida qoldi")
        chap = max(float(z.x + z.chap), yoy.cx - yarim)
        ong = min(float(z.x + z.en - z.ong), yoy.cx + yarim)
        uzunlik = D(round(ong - chap, 2))
    if uzunlik <= 0:
        raise HisobXato("Impost arkadan tashqarida qoldi")
    return uzunlik


def _portal(b, z, h, ctx):
    """Portal (foydalanuvchi, 2026-11-06): boʻlak ichida arkali oʻrta va atrofida U shaklidagi bitta oyna.

    chap, ong — yon ustunlar eni (tashqi chetdan impost oʻqigacha); tepa — tepadan arka choʻqqisigacha (oʻqi);
    chuqurlik — arka chuqurligi (berilmasa yarim doira, oʻrta eni : 2); chap_boy, ong_boy — tepadan yon yotiq
    impost oʻqigacha (null — yotiq impost yoʻq, U oyna pastgacha tushadi).
    bolaklar: [U oyna (gluxoy), arka ostidagi boʻlak, chap pastki boʻlak yoki null, oʻng pastki boʻlak yoki null].
    Tik impostlar pastdan arka boshlanadigan joygacha, arka ularning ustida (egilgan impost qoidasi bilan).
    Toʻrtburchak boʻlmagan oyna: eng katta eni × eng katta boʻyi boʻyicha (+ arka ustamasi).
    """
    yarmi, impost = ctx["yarmi"], ctx["impost"]
    bol = b.get("bolaklar") or []
    if len(bol) != 4 or not bol[1] or not bol[0] or bol[0].get("tur") != "gluxoy":
        raise HisobXato("Portal: bolaklar [U oyna (gluxoy), arka ostidagi, chap pastki, oʻng pastki] boʻlishi kerak")
    if z.past_yoy:
        raise HisobXato("Portal ostida yoy boʻlmaydi")
    tY = z.tepa_yoy  # rama arkasi ostida boʻlsa (foydalanuvchi eskizi 2, 2026-11-06)
    # yon ustunlar: berilmasa uch teng boʻlak (oʻq boʻyicha), bittasi berilsa ikkinchisi unga teng (foydalanuvchi, 2026-11-06)
    chap = b.get("chap") if b.get("chap") is not None else b.get("ong")
    ong = b.get("ong") if b.get("ong") is not None else chap
    chap = D(chap) if chap is not None else z.en / 3
    ong = D(ong) if ong is not None else z.en / 3
    tepa = D(b["tepa"])
    orta = z.en - chap - ong
    c = D(b["chuqurlik"]) if b.get("chuqurlik") is not None else orta / 2
    if chap <= z.chap + yarmi or ong <= z.ong + yarmi or orta <= 2 * yarmi:
        raise HisobXato("Portal: yon ustunlar yoki oʻrta juda tor")
    if c <= 0 or c > orta / 2:
        raise HisobXato(f"Portal arkasi chuqurligi 0 dan katta, oʻrta eni yarmidan katta boʻlmasligi kerak: {c}")
    if tepa <= z.tepa + yarmi or tepa + c >= z.boy - z.past:
        raise HisobXato("Portal arkasi boʻlakka sigʻmaydi: tepa yoki chuqurlik notoʻgʻri")
    xa = z.x + chap
    yoy = Yoy(xa + orta / 2, orta, c, z.y + tepa)
    tepa_ichki = z.y + z.tepa
    cx = xa + orta / 2

    def ust(x):
        """x da U oyna tepasi (rama yoki arka ichki cheti)."""
        return D(round(tY.y(x, float(z.tepa)), 2)) if tY else tepa_ichki

    def ust_eng(x1, x2):
        """[x1, x2] oraligʻida U oyna tepasining eng baland nuqtasi."""
        return ust(min(max(D(str(tY.cx)), x1), x2)) if tY else tepa_ichki

    ys = z.y + tepa + c                 # arka boshlanadigan joy (tik impostlar shu yergacha)
    xb = z.x + z.en - ong
    if tY and (ust(xa) + yarmi >= ys or ust(xb) + yarmi >= ys or ust_eng(xa, xb) >= z.y + tepa - 2 * yarmi):
        raise HisobXato("Portal arkasi rama arkasiga tegib qoldi: tepa yoki yon ustunlarni oʻzgartiring")
    pastki = z.y + z.boy - z.past
    ichki_ctx = {**ctx, "bolinish_ichida": True}

    h.detal("Impost vertikal", impost, pastki - ys, 2)
    h.egilgan("Impost egilgan", impost, orta - 2 * yarmi, c)
    # portal arkasi tik impostlar ustiga oʻtiradi: uchi gorizontal tekislikka, kesim α (foydalanuvchi, 2026-11-14)
    h.burchak_qosh("Impost egilgan", impost, orta - 2 * yarmi + c + h.seriya.arka_zapas, "ikki uchi", yoy.uch_qiyaligi())
    h.impost_soni += 3

    oyoqlar = []  # (oyoq eni ichki, oyoq pasti y)
    for kalit, bola, x0, en, ichki_chap, ichki_ong, tashqi in (
        ("chap_boy", bol[2], z.x, chap, z.chap, yarmi, z.chap),
        ("ong_boy", bol[3], z.x + z.en - ong, ong, yarmi, z.ong, z.ong),
    ):
        eni = en - tashqi - yarmi
        if b.get(kalit) is None:
            if bola:
                raise HisobXato(f"Portal: {kalit} berilmagan, pastki boʻlak boʻlmaydi")
            oyoqlar.append((eni, pastki))
            continue
        yb = D(b[kalit])
        x_ichki = z.x + z.chap if kalit == "chap_boy" else z.x + z.en - z.ong
        if tY and z.y + yb - yarmi <= ust(x_ichki) + 2 * h.shtapik:
            raise HisobXato("Portal: yon yotiq impost rama arkasidan pastda boʻlishi kerak")
        if yb <= tepa + c or yb >= z.boy - z.past - yarmi:
            raise HisobXato("Portal: yon yotiq impost arka boshlanishidan pastda va boʻlak ichida boʻlishi kerak")
        if not bola:
            raise HisobXato(f"Portal: {kalit} bor, pastki boʻlak yoʻq")
        h.detal("Impost gorizontal", impost, eni, 1)
        h.impost_soni += 1
        _bolak(bola, Zona(en, z.boy - yb, ichki_chap, ichki_ong, yarmi, z.past, x0, z.y + yb), h, ichki_ctx)
        oyoqlar.append((eni, z.y + yb - yarmi))

    _bolak(bol[1], Zona(orta, z.boy - tepa, yarmi, yarmi, yarmi, z.past, xa, z.y + tepa, yoy, None), h, ichki_ctx)

    # U oyna: toʻrtburchak boʻyicha (eng katta eni × eng katta boʻyi)
    eski = h.joriy_oyna
    if bol[0].get("oyna_turi"):
        h.joriy_oyna = bol[0]["oyna_turi"]
    try:
        if b.get("tepa_impost", True):
            # tepada tik impost: ramadan arka choʻqqisigacha, U oynani ikkiga boʻladi (foydalanuvchi eskizi)
            # rama arkasi ostida: impost arka ichki chetidan, yarim oyna tepasi yoy (shtapik egiladi)
            ti = z.y + tepa - yarmi - ust(cx)
            h.detal("Impost vertikal", impost, ti, 1)
            h.impost_soni += 1
            for (eni, yb), (x1, x2, x_chet) in zip(oyoqlar, ((z.x, cx, z.x + z.chap), (cx, z.x + z.en, z.x + z.en - z.ong))):
                yarim_en = (cx - x_chet if x_chet < cx else x_chet - cx) - yarmi
                yoylar = [((orta - 2 * yarmi) / 2, c)]
                gor = [eni]
                if tY:
                    yoylar.append((yarim_en, tY.chuqurlik(x1, x2)))
                else:
                    gor.append(yarim_en)
                h.shakl_oyna(yarim_en, yb - ust_eng(x1, x2), tekis_gor=gor,
                             tekis_ver=[yb - ust(x_chet), yb - ys, ti], yoylar=yoylar)
        else:
            en_ichki = z.en - z.chap - z.ong
            yoylar = [(orta - 2 * yarmi, c)]
            gor = [e for e, _ in oyoqlar]
            if tY:
                yoylar.append((en_ichki, tY.chuqurlik(z.x, z.x + z.en)))
            else:
                gor.append(en_ichki)
            h.shakl_oyna(en_ichki, max(y for _, y in oyoqlar) - ust_eng(z.x, z.x + z.en), tekis_gor=gor,
                         tekis_ver=[oyoqlar[0][1] - ust(z.x + z.chap), oyoqlar[1][1] - ust(z.x + z.en - z.ong)]
                         + [y - ys for _, y in oyoqlar], yoylar=yoylar)
    finally:
        h.joriy_oyna = eski


def _eshik(b, z, h, arka=D(0)):
    ochilish = b.get("ochilish")
    sr = h.seriya
    if ochilish not in sr.eshik_profili:
        raise HisobXato("Eshik ochilishi 'ichkariga' yoki 'tashqariga' boʻlishi kerak")
    profil = sr.eshik_profili[ochilish]
    if h.eshik_tur == "yengil":
        if not sr.eshik_profili_yengil:
            raise HisobXato(f"{sr.nomi}da yengil eshik yoʻq")
        profil = sr.eshik_profili_yengil[ochilish]

    def ustma(*tomonlar):  # qanot kesishi ichki oʻlchamdan shuncha katta: kosa tomoni / impost tomoni
        return sum((sr.eshik_kosa if t == h.r else sr.eshik_impost) for t in tomonlar)

    if sr.eshik_boy_jami is not None:  # Aldoks: chetlariga qaramay jami qoʻshimcha
        H1 = z.ichki_boy + sr.eshik_boy_jami
    else:
        H1 = z.ichki_boy + ustma(z.tepa, z.past)
    ii = b.get("tabaqa_impost")  # tabaqa ichida impost; 2 tabaqada ikkalasiga bir xil
    soni = b.get("tabaqa_soni")
    if soni == 1:
        L1 = z.ichki_en + (sr.eshik_en_jami if sr.eshik_en_jami is not None else ustma(z.chap, z.ong))
        h.tabaqa("Eshik tabaqasi", profil, L1, H1, arka=arka, ichki_impost=ii)
        h.eshik_qanotlari.append((L1, H1))
        h.eshiklar.append(1)
    elif soni == 2:
        jami = z.ichki_en + sr.eshik_2_qoshimcha
        if b.get("L1") is not None:
            # ruchkali tabaqa eni qoʻlda berilgan (foydalanuvchi, 2026-11-08, Romchi kabi); L2 = qolgani
            L1 = D(str(b["L1"]))
            if L1 <= 0 or L1 >= jami:
                raise HisobXato(f"L1 = {L1} boʻlmaydi: ikki tabaqaga {jami} sm")
        else:
            L1 = jami / 2
            if L1 < ESHIK_MIN_TABAQA:
                L1 = ESHIK_MIN_TABAQA
        L2 = jami - L1
        if L2 <= 0:
            raise HisobXato(f"Ikki tabaqa uchun joy yetmaydi: eshik oʻrni {z.ichki_en}")
        # ikki tabaqada har birining ustidagi yoy chuqurligi alohida
        ch1 = z.tepa_yoy.chuqurlik(z.x + z.chap, z.x + z.chap + L1) if arka else D(0)
        ch2 = z.tepa_yoy.chuqurlik(z.x + z.chap + L1, z.x + z.en - z.ong) if arka else D(0)
        h.tabaqa("Eshik tabaqasi L1", profil, L1, H1, shtulp_yonida=True, arka=ch1, ichki_impost=ii)
        h.tabaqa("Eshik tabaqasi L2", profil, L2, H1, shtulp_yonida=True, arka=ch2, ichki_impost=ii)
        h.eshik_qanotlari.extend([(L1, H1), (L2, H1)])
        h.markaziy_rezina += H1  # shtulp boʻyi bir marta
        h.detal("Shtulp", sr.shtulp, H1 - sr.shtulp_ayirma, 1)
        h.eshiklar.append(2)
    else:
        raise HisobXato("Eshik tabaqa soni 1 yoki 2 boʻlishi kerak")


def _qoida_yoq(h, matn):
    if matn not in h.qoida_yoq:
        h.qoida_yoq.append(matn)


def _bolak(b, z, h, ctx):
    # Boʻlakka oʻz oyna turi berilsa, ichidagi hamma oynaga tegishli (foydalanuvchi, 2026-11-05)
    eski = h.joriy_oyna
    if b.get("oyna_turi"):
        h.joriy_oyna = b["oyna_turi"]
    try:
        _bolak_ichi(b, z, h, ctx)
    finally:
        h.joriy_oyna = eski


def _bolak_ichi(b, z, h, ctx):
    if z.ichki_en <= 0 or z.ichki_boy <= 0:
        raise HisobXato(f"Boʻlak juda kichik: ichki {z.ichki_en} × {z.ichki_boy}")
    tur = b.get("tur")
    if h.seriya.faqat_rom and (tur not in ("gluxoy", "tabaqa", "bolinish", "eshik", "portal")
                               or b.get("dvaynoy") or b.get("lapsha") or h.joriy_oyna == LAMBRI):
        raise HisobXato(f"{h.seriya.nomi}da hozircha: gluxoy, tabaqa, fortochka, eshik, impost, arka, portal "
                        "(dvaynoy, lapsha, lambri yoʻq)")
    if not h.seriya.eshik and (tur in ("eshik", "portal") or b.get("egilgan") is not None):
        raise HisobXato(f"{h.seriya.nomi}: hozircha faqat rom (gluxoy, tabaqa, fortochka, impost) hisoblanadi")
    arka = h.yoy_chuqurligi(z.tepa_yoy, z)  # 0 — boʻlak tepasi yoy emas
    past = h.yoy_chuqurligi(z.past_yoy, z)
    if tur == "gluxoy":
        # yarim aylanada ramaga (yon devori yoʻq) tegadigan tomonda vertikal shtapik va rezina yoʻq
        yonlar = 2
        if h.segment and z.tepa_yoy is h.arka:
            yonlar -= (z.x == 0) + (z.x + z.en == D(str(h.arka.en)))
        h.oyna("Gluxoy", z.ichki_en, z.ichki_boy, h.seriya.gluxoy_oyna, arka, past, yonlar=yonlar)
    elif tur == "tabaqa" and b.get("fortochka"):
        # Fortochka (foydalanuvchi, 2026-11-05): qanot, shtapik, oyna rom tabaqasidagidek, faqat furnitura boshqa
        ruchka = bool(b.get("ruchka")) or h.seriya.pvx  # Engelberg fortochkasida doim ruchka
        q = h.seriya.tabaqa_qoshimcha
        qb = h.seriya.tabaqa_qoshimcha_boy if h.seriya.tabaqa_qoshimcha_boy is not None else q  # Aldoks + 1,5
        h.tabaqa("Fortochka", h.seriya.rom_tabaqa, z.ichki_en + q, z.ichki_boy + qb, rom=True,
                 fortochka=ruchka, arka=arka, past=past, ichki_impost=b.get("tabaqa_impost"))
    elif tur == "tabaqa":
        q = h.seriya.tabaqa_qoshimcha
        qb = h.seriya.tabaqa_qoshimcha_boy if h.seriya.tabaqa_qoshimcha_boy is not None else q
        if b.get("dvaynoy"):
            h.dvaynoy_tomonlari.append(b.get("petlya_tomoni") or "chap")
        h.tabaqa("Rom tabaqasi", h.seriya.rom_tabaqa, z.ichki_en + q, z.ichki_boy + qb, rom=True,
                 dvaynoy=bool(b.get("dvaynoy")), arka=arka, past=past, ichki_impost=b.get("tabaqa_impost"))
    elif tur == "eshik":
        _eshik(b, z, h, arka)
    elif tur == "portal":
        _portal(b, z, h, ctx)
    elif tur == "bolinish":
        _bolinish(b, z, h, ctx)
    else:
        raise HisobXato(f"Nomaʼlum boʻlak turi: {tur}")


def _rama_hisobi(profil, impost, en, boy, bolak, h):
    r = RAMA_R[profil] + h.lam
    h.r = r
    h.rama(profil, en, boy)
    ctx = {"impost": impost, "yarmi": IMPOST_YARMI[impost] + h.lam / 2, "bolinish_ichida": False, "rama": profil}
    _bolak(bolak, Zona(en, boy, r, r, r, r, tepa_yoy=h.arka), h, ctx)


LAPSHA_SAMOREZ_QADAM = D(100)


def medved_soni(en, boy):
    """Montaj samorezi (medved), bitta rama uchun (foydalanuvchi, 2026-11-09): har tomoniga alohida.
    Yon (chap, oʻng): boʻyi 180 gacha — 2 ta, balandi — har metriga 1 ta (yuqoriga).
    Tepa va past: eni 160 dan kichik — urilmaydi, aks holda har metriga 1 ta (yuqoriga)."""
    yon = 2 if boy <= 180 else math.ceil(D(boy) / 100)
    tepa = 0 if en < 160 else math.ceil(D(en) / 100)
    return 2 * yon + 2 * tepa   # har metr lapshaga 1 samorez (foydalanuvchi, 2026-11-09)


def _lapshami(b):
    return isinstance(b, dict) and b.get("tur") == "bolinish" and bool(b.get("lapsha"))


def _ramalar_hisobi(profil, impost, en, boy, b, h):
    """Lapsha bilan ulangan ramalar (foydalanuvchi, 2026-11-09): istalgan konstruksiyalar yonma-yon (vertikal)
    yoki ustma-ust (gorizontal), oraligʻi H702 lapsha 0,5 sm. Har rama alohida hisoblanadi. Bola rama
    boshqasidan kalta boʻlishi mumkin: vertikalda "boy", gorizontalda "en". Lapsha = qoʻshni ikki ramaning
    qisqarogʻi; har metriga samorez 1 ta (yuqoriga). Tekislash ("tekislash") faqat chizma uchun."""
    if not _lapshami(b):
        _rama_hisobi(profil, impost, en, boy, b, h)
        return
    vertikal = b.get("yonalish") == "vertikal"
    if b.get("yonalish") not in ("vertikal", "gorizontal"):
        raise HisobXato(f"Nomaʼlum yoʻnalish: {b.get('yonalish')}")
    n = len(b.get("bolaklar") or [])
    jami = (en if vertikal else boy) - LAPSHA_ENI * (n - 1)
    olchamlar = _olchamlar(b, jami, [D(0)] * n)
    yon = []
    for i, bola in enumerate(b["bolaklar"]):
        kalit = "boy" if vertikal else "en"
        toliq = boy if vertikal else en
        ikkinchi = D(bola[kalit]) if isinstance(bola, dict) and bola.get(kalit) is not None else toliq
        if ikkinchi <= 0 or ikkinchi > toliq:
            raise HisobXato(f"Lapshali rama {'boʻyi' if vertikal else 'eni'} 0 dan katta va {toliq} dan oshmasligi kerak: {ikkinchi}")
        ichi = {k: v for k, v in bola.items() if k != kalit} if isinstance(bola, dict) else bola
        if vertikal:
            _ramalar_hisobi(profil, impost, olchamlar[i], ikkinchi, ichi, h)
        else:
            _ramalar_hisobi(profil, impost, ikkinchi, olchamlar[i], ichi, h)
        yon.append(ikkinchi)
    for a, c in zip(yon, yon[1:]):
        uz = min(a, c)
        h.detal("Lapsha", LAPSHA_PROFILI, uz, 1)
        h.lapsha_samorez += math.ceil(uz / LAPSHA_SAMOREZ_QADAM)


def hisobla(k):
    """Konstruksiya lugʻatidan natija lugʻatini qaytaradi. Xato boʻlsa HisobXato chiqaradi."""
    profil = k.get("rama")
    if profil not in RAMA_R:
        raise HisobXato(f"Nomaʼlum rama: {profil}")
    seriya = SERIYA_RAMA[profil]
    impost = k.get("impost") or seriya.impost
    if SERIYA_RAMA.get(IMPOST_RAMA.get(impost)) is not seriya:
        raise HisobXato(f"{impost} impost {profil} ramaga toʻgʻri kelmaydi")
    if impost not in IMPOST_YARMI:
        raise HisobXato(f"Nomaʼlum impost: {impost}")
    L, H = D(k["L"]), D(k["H"])
    if L <= 0 or H <= 0:
        raise HisobXato("L va H musbat boʻlishi kerak")
    vertikal = (k.get("tanlov") or {}).get("vertikal_shtapik", "R")
    if vertikal not in ("R", "oddiy"):
        raise HisobXato(f"vertikal_shtapik faqat R yoki oddiy: {vertikal}")
    rang = (k.get("tanlov") or {}).get("rang")
    if rang in seriya.rang_yoq:
        raise HisobXato(f"{seriya.nomi}da {rang} rangi yoʻq")
    lam = LAMINAT_QOSHIMCHA if rang == "Laminatsiya" else D(0)
    metall = str((k.get("tanlov") or {}).get("eng_metall") or "1.5")
    h = Hisob(k.get("oyna_qalinligi", seriya.oyna_standart), vertikal_r=vertikal == "R", lam=lam, seriya=seriya, metall=metall)
    h.eshik_tur = (k.get("tanlov") or {}).get("eshik_tur") or "balkon"
    if h.eshik_tur not in ("balkon", "yengil"):
        raise HisobXato(f"Eshik turi balkon yoki yengil boʻlishi kerak: {h.eshik_tur}")
    if not seriya.eshik and k.get("arka"):
        raise HisobXato(f"{seriya.nomi}: arka hozircha yoʻq")
    if seriya.faqat_rom and (k.get("tur") == "lapshali" or _lapshami(k.get("bolak"))):
        raise HisobXato(f"{seriya.nomi}da lapsha hozircha yoʻq")

    # Arka (foydalanuvchi, 2026-11-06): chuqurlik L/2 dan oshmaydi, radius chegarasi yoʻq
    arka = k.get("arka")
    if arka:
        a = D(arka.get("balandlik") or 0)
        if k.get("tur") == "lapshali" or _lapshami(k.get("bolak")):
            raise HisobXato("Lapshali konstruksiyada arka boʻlmaydi")
        if a <= 0 or a > L / 2 or a > H:
            raise HisobXato(f"Arka chuqurligi 0 dan katta, L/2 dan va H dan katta emas boʻlishi kerak: {a}")
        h.arka = Arka(L, a)
        h.segment = a == H  # yarim aylana, yon devorsiz

    bolak = k["bolak"]
    if k.get("tur") == "lapshali":
        # eski yozuv (chap / ong yon oyna) — lapsha daraxtiga oʻgiriladi
        yonlar = [t_ for t_ in ("chap", "ong") if k.get(t_) is not None]
        if not yonlar or any(D(k[t_]) <= 0 for t_ in yonlar):
            raise HisobXato("Lapshali vitrajda kamida bitta yon oyna eni kerak")
        if L - sum(D(k[t_]) for t_ in yonlar) - LAPSHA_ENI * len(yonlar) <= 0:
            raise HisobXato("Eshik ramasi uchun joy qolmadi")
        bolaklar, olchamlar = [bolak], [None]
        if k.get("chap") is not None:
            bolaklar.insert(0, {"tur": "gluxoy"}); olchamlar.insert(0, k["chap"])
        if k.get("ong") is not None:
            bolaklar.append({"tur": "gluxoy"}); olchamlar.append(k["ong"])
        bolak = {"tur": "bolinish", "yonalish": "vertikal", "lapsha": True, "olchamlar": olchamlar, "bolaklar": bolaklar}
    _ramalar_hisobi(profil, impost, L, H, bolak, h)

    m2 = sum((en * boy * n for (_, en, boy, _), n in h.oynalar.items()), D(0)) / 10000
    return {
        "seriya": seriya.nomi,
        "profillar": [
            {"nomi": n, "profil": p, "uzunlik": float(u), "soni": s,
             **({"burchak": h.burchaklar[(n, p, u)]} if (n, p, u) in h.burchaklar else {})}
            for (n, p, u), s in h.profillar.items()
        ],
        "oynalar": [
            {"joy": j, "en": float(e), "boy": float(b), "soni": s, **({"tur": t} if t else {})}
            for (j, e, b, t), s in h.oynalar.items()
        ],
        "oyna_m2": float(m2),
        "lambrilar": [{"joy": j, "en": float(e), "boy": float(b), "tasma": n} for j, e, b, n in h.lambrilar],
        "ogohlantirishlar": h.ogohlantirishlar,
        "qoida_yoq": h.qoida_yoq,
        "sanoq": {
            "ramalar": h.ramalar,
            "segment_ramalar": h.segment_ramalar,
            "rama_perimetri": float(h.rama_perimetri),
            "tabaqa_soni": h.tabaqa_soni,
            "tabaqalar": h.tabaqalar,
            "tabaqa_boylari": [float(b) for b in h.tabaqa_boylari],
            "rom_tabaqa_boylari": [float(b) for b in h.rom_tabaqa_boylari],
            "dvaynoylar": [[float(e), float(b)] for e, b in h.dvaynoylar],
            "rom_qanotlari": [[float(e), float(b)] for e, b in h.rom_qanotlari],
            "dvaynoy_tomonlari": h.dvaynoy_tomonlari,
            "fortochkalar": [[float(e), float(b), r] for e, b, r in h.fortochkalar],
            "impost_soni": h.impost_soni,
            "armatura_samorez": h.armatura_samorez,
            "lapsha_samorez": h.lapsha_samorez,
            "medved_samorez": h.medved_samorez,
            "eshiklar": h.eshiklar,
            "eshik_qanotlari": [[float(e), float(b)] for e, b in h.eshik_qanotlari],
            "markaziy_rezina": float(h.markaziy_rezina),
            "oyna_rezinasi": float(h.oyna_rezinasi),
            "tabaqa_oyna_soni": h.tabaqa_oyna_soni,
            "gluxoy_oyna_soni": h.gluxoy_oyna_soni,
            "arka_metr": float(h.arka_metr / 100),
            "arka_burchak": [{"nomi": n, "profil": p, "uzunlik": float(u), "burchak": m}
                             for (n, p, u), m in h.burchaklar.items() if (n, p, u) not in h.profillar],
            "arka_oyna_m2": float(h.arka_oyna_m2),
        },
    }


def matn(n):
    qator = ["PROFILLAR"]
    for p in n["profillar"]:
        qator.append(f"  {p['nomi']:<20} {p['profil']:<8} {p['uzunlik']:>8.2f} sm × {p['soni']}")
    qator.append("OYNALAR")
    for o in n["oynalar"]:
        qator.append(f"  {o['joy']:<20} {o['en']:.2f} × {o['boy']:.2f} × {o['soni']}")
    qator.append(f"  Jami: {n['oyna_m2']:.3f} m²")
    for sarlavha, kalit in (("OGOHLANTIRISH", "ogohlantirishlar"), ("QOIDA YOʻQ", "qoida_yoq")):
        if n[kalit]:
            qator.append(sarlavha)
            qator.extend(f"  {x}" for x in n[kalit])
    return "\n".join(qator)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        sys.exit("Ishlatish: python hisob.py konstruksiya.json")
    with open(sys.argv[1], encoding="utf-8") as f:
        konstruksiya = json.load(f)
    try:
        print(matn(hisobla(konstruksiya)))
    except HisobXato as e:
        sys.exit(f"Xato: {e}")
