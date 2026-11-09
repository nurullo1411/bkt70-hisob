"""BKT 70 hisob dasturi: konstruksiya tuzilmasidan detal, oyna va shtapik oʻlchamlarini chiqaradi.

Qoidalar CLAUDE.md dagi tasdiqlangan formulalardan olingan. Oʻlchamlar sm da.
Ishga tushirish: python hisob.py konstruksiya.json
"""
import json
import math
import sys
from dataclasses import dataclass
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
    eshik: bool            # eshik, fortochka, dvaynoy, portal, arka, lapsha bormi


TERMO70 = Seriya("Termo 70", "M702", "V702", D("1.1"), D(2), D(0), False, {}, True)
ENGELBERG = Seriya("Engelberg 7000", "7053", "7052", D("2.2"), D("1.5"), D("0.5"), True, {24: "7056", 32: "7057"}, False)
SERIYA_RAMA = {"F702": TERMO70, "F703": TERMO70, "7051": ENGELBERG}
ENGELBERG_PROFILLARI = {"7051", "7052", "7053", "7054", "7055", "7056", "7057", "7058", "0701", "0703", "0701-2", "0703-2"}
# Metall (armatura) qalinligi (foydalanuvchi, 2026-11-09, Romchi kabi tanlov): 1,5 mm (standart) yoki 2 mm.
# 2 mm armatura alohida kod bilan ("0701-2"): raskroy, diller roʻyxati va narx oʻzi ajraladi.
ENG_METALL = ("1.5", "2")
# Armatura (foydalanuvchi, 2026-11-08): hamma detalga; uzunlik = kesish uzunligi − ayirma (laminatda ham shu),
# 6 m hivichdan raskroy. Samorez 3,9×16: armatura uzunligi 70 dan kalta — 2 ta, aks holda uzunlik : 35 yuqoriga.
ARMATURA = {"7051": ("0701", D(13)), "7052": ("0701", D(13)), "7053": ("0703", D("0.5"))}
ARMATURA_SAMOREZ = "3,9×16 YSBM"
ARMATURA_QADAM = D(35)
ARMATURA_KALTA = D(70)
# Rezina (foydalanuvchi, 2026-11-08): Termo 70 (ProfOkna) qoidasi, nomlari almashtirilgan:
# A01-005 → EPDM 5108 (qanot perimetri × 1), A01-003 → EPDM 5025 (× 2), A01-002 → EPDM 5025 (oyna perimetri
# + har tomonga 2 sm). EPDM Ю ishlatilmaydi — shtapikning oʻz rezinasi bor.
REZINA_CHET = "EPDM 5025"
REZINA_QANOT = "EPDM 5108"


# Lambri (foydalanuvchi, 2026-11-09; ProfOkna "СТ Ламбри" Termo 20×86, "Вагонка"): oyna oʻrniga, boʻlakka
# oyna_turi = "Lambri" berilsa. Tik teriladi: tasma soni = (ichki eni − 1) : 8,6 yuqoriga, uzunligi = ichki boʻyi − 1.
# Shtapik, rezina, podstavka — hech narsa kerak emas. Hivich 6 m, diller "Lambri Termo 116".
LAMBRI = "Lambri"
LAMBRI_PROFIL = "L116"
LAMBRI_ENI = D("8.6")
LAMBRI_AYIRMA = D(1)
HIVICH_6 = {LAMBRI_PROFIL}


def hivich_metr(kalit, standart):
    """Profil narxi qaysi hivich uzunligiga (m): Engelberg 6 m (foydalanuvchi, 2026-11-08), qolgani narxlardagi."""
    k = narx_kaliti(kalit)
    return 6 if k.startswith("ENG ") or k.split(" ")[-1] in HIVICH_6 else standart


def profil_narxi(narxlar, artikul, rang):
    """Hivich narxi: rang boʻyicha; armatura (metall) rangga bogʻliq emas — "*" kaliti."""
    d = narxlar["profil_hivich"].get(artikul, {})
    return d.get(rang, d.get("*"))


def narx_kaliti(profil):
    """Profil narx kaliti: "BKT70 F702", "ENG 7051"."""
    if profil.startswith(("BKT70 ", "ENG ")):
        return profil
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
        self.shtapik = SHTAPIK_QALINLIGI + lam
        if oyna_qalinligi not in SHTAPIK_TURLARI:
            raise HisobXato(f"Oyna qalinligi uchun shtapik yoʻq: {oyna_qalinligi} mm (faqat 24 yoki 32)")
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
        self.fortochkalar = []  # (en, boʻy, ruchka bilanmi)
        self.impost_soni = 0
        self.armatura_samorez = 0
        self.lapsha_samorez = 0
        self.medved_samorez = 0
        self.eshiklar = []
        self.markaziy_rezina = D(0)
        self.oyna_rezinasi = D(0)
        self.tabaqa_oyna_soni = 0
        self.gluxoy_oyna_soni = 0
        self.arka = None
        self.segment = False  # yarim aylana: yon devorsiz (arka balandligi = H)
        self.segment_ramalar = 0
        self.arka_metr = D(0)      # egiladigan profil (egish xizmati), sm
        self.arka_oyna_m2 = D(0)   # arkali oyna yuzasi (ustama uchun)

    @staticmethod
    def yoy_chuqurligi(yoy, z):
        """Boʻlak tepasi yoki pasti yoyga tegsa — yoyning shu boʻlak ustidagi chuqurligi, aks holda 0."""
        return yoy.chuqurlik(z.x, z.x + z.en) if yoy else D(0)

    def egilgan(self, nomi, profil, en, chuqurlik, egish=True):
        uzunlik = en + chuqurlik + ARKA_ZAPAS
        self.detal(nomi, profil, uzunlik, 1)
        if egish:
            self.arka_metr += uzunlik

    def detal(self, nomi, profil, uzunlik, soni):
        if uzunlik <= 0:
            raise HisobXato(f"{nomi} uzunligi musbat emas: {uzunlik}")
        key = (nomi, profil, uzunlik)
        self.profillar[key] = self.profillar.get(key, 0) + soni
        if profil in ARMATURA and self.seriya is ENGELBERG:
            arm, ayirma = ARMATURA[profil]
            u = uzunlik - ayirma
            if u <= 0:
                raise HisobXato(f"{nomi} juda kalta, armatura sigʻmaydi: {uzunlik}")
            if self.metall == "2":
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
        g = self.qalinlik
        if self.seriya.shtapik_45:
            # Engelberg: 45° kesiladi, eni ham boʻyi ham ichki oʻlchamga teng (foydalanuvchi, 2026-11-08)
            sht = self.seriya.shtapik[g]
            self.detal("Shtapik gorizontal", sht, ichki_en, 2)
            self.detal("Shtapik vertikal", sht, ichki_boy, yonlar)
            return
        # shtapik profil bilan birga egiladi, xizmati profil narxiga kirgan
        tekis = 2 - (arka > 0) - (past > 0)
        if tekis:
            self.detal("Shtapik gorizontal", f"G{g}", ichki_en, tekis)
        for c in (arka, past):
            if c:
                self.egilgan("Shtapik arka", f"G{g}", ichki_en, c, egish=False)
        if yonlar:
            self.detal("Shtapik vertikal", f"G{g}-R" if self.vertikal_r else f"G{g}",
                       ichki_boy - 2 * self.shtapik, yonlar)

    def lambri(self, joy, ichki_en, ichki_boy, yoy=False):
        if self.seriya is not TERMO70:
            raise HisobXato(f"{self.seriya.nomi}: lambri hozircha yoʻq")
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
        g = self.qalinlik
        rezina = D(8) + sum(e + c for e, c in yoylar)
        for u in tekis_gor:
            self.detal("Shtapik gorizontal", f"G{g}", u, 1)
            rezina += u
        for u in tekis_ver:
            if u > 2 * self.shtapik:
                self.detal("Shtapik vertikal", f"G{g}-R" if self.vertikal_r else f"G{g}", u - 2 * self.shtapik, 1)
                rezina += u
        for e, c in yoylar:
            self.egilgan("Shtapik arka", f"G{g}", e, c, egish=False)
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
        oyna_ayirma = D("1.5") if fortochka is not None else self.seriya.tabaqa_oyna
        if ichki_impost:
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
            return
        self.ramalar[profil] = self.ramalar.get(profil, 0) + 1
        if self.arka:
            a = D(str(self.arka.a))
            self.rama_perimetri += en + 2 * (boy - a) + en + a
            self.detal("Rama eni", profil, en, 1)
            self.detal("Rama boʻyi", profil, boy - a, 2)
            self.egilgan("Rama arka", profil, en, a)
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
    joy = D(0)
    for o in olchamlar[:-1]:
        joy += o
        h.detal(nomi, ctx["impost"], _impost_uzunligi(vertikal, joy, z, h), 1)
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
    h.impost_soni += 1
    ichki_ctx = {**ctx, "bolinish_ichida": True}
    # Toʻgʻri toʻrtburchak boʻyicha: tepadagi boʻlak impost uchlarigacha, pastdagisi choʻqqidan
    _bolak(b["bolaklar"][0], Zona(z.en, tepa_ol + c, z.chap, z.ong, z.tepa, yarmi, z.x, z.y, z.tepa_yoy, yoy),
           h, ichki_ctx)
    _bolak(b["bolaklar"][1], Zona(z.en, z.boy - tepa_ol, z.chap, z.ong, yarmi, z.past, z.x, z.y + tepa_ol,
                                  yoy, z.past_yoy), h, ichki_ctx)


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
    if ochilish not in ESHIK_PROFILI:
        raise HisobXato("Eshik ochilishi 'ichkariga' yoki 'tashqariga' boʻlishi kerak")
    profil = ESHIK_PROFILI[ochilish]
    H1 = z.ichki_boy + D("1.2")
    ii = b.get("tabaqa_impost")  # tabaqa ichida M702 impost; 2 tabaqada ikkalasiga bir xil
    soni = b.get("tabaqa_soni")
    if soni == 1:
        h.tabaqa("Eshik tabaqasi", profil, z.ichki_en + D("1.2"), H1, arka=arka, ichki_impost=ii)
        h.eshiklar.append(1)
    elif soni == 2:
        jami = z.ichki_en + D("0.5")
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
        h.markaziy_rezina += H1  # shtulp boʻyi bir marta
        h.detal("Shtulp", "A701", H1 - 7, 1)
        h.eshiklar.append(2)
    else:
        raise HisobXato("Eshik tabaqa soni 1 yoki 2 boʻlishi kerak")


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
    if not h.seriya.eshik and (tur in ("eshik", "portal") or b.get("egilgan") is not None):
        raise HisobXato(f"{h.seriya.nomi}: hozircha faqat rom (gluxoy, tabaqa, fortochka, impost) hisoblanadi")
    arka = h.yoy_chuqurligi(z.tepa_yoy, z)  # 0 — boʻlak tepasi yoy emas
    past = h.yoy_chuqurligi(z.past_yoy, z)
    if tur == "gluxoy":
        # yarim aylanada ramaga (yon devori yoʻq) tegadigan tomonda vertikal shtapik va rezina yoʻq
        yonlar = 2
        if h.segment and z.tepa_yoy is h.arka:
            yonlar -= (z.x == 0) + (z.x + z.en == D(str(h.arka.en)))
        h.oyna("Gluxoy", z.ichki_en, z.ichki_boy, D("1.5"), arka, past, yonlar=yonlar)
    elif tur == "tabaqa" and b.get("fortochka"):
        # Fortochka (foydalanuvchi, 2026-11-05): qanot, shtapik, oyna rom tabaqasidagidek, faqat furnitura boshqa
        ruchka = bool(b.get("ruchka")) or not h.seriya.eshik  # Engelberg fortochkasida doim ruchka
        q = h.seriya.tabaqa_qoshimcha
        h.tabaqa("Fortochka", h.seriya.rom_tabaqa, z.ichki_en + q, z.ichki_boy + q, rom=True,
                 fortochka=ruchka, arka=arka, past=past, ichki_impost=b.get("tabaqa_impost"))
    elif tur == "tabaqa":
        q = h.seriya.tabaqa_qoshimcha
        h.tabaqa("Rom tabaqasi", h.seriya.rom_tabaqa, z.ichki_en + q, z.ichki_boy + q, rom=True,
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
    h.rama(profil, en, boy)
    ctx = {"impost": impost, "yarmi": IMPOST_YARMI[impost] + h.lam / 2, "bolinish_ichida": False}
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
    if SERIYA_RAMA.get({"M702": "F702", "7053": "7051"}.get(impost)) is not seriya:
        raise HisobXato(f"{impost} impost {profil} ramaga toʻgʻri kelmaydi")
    if impost not in IMPOST_YARMI:
        raise HisobXato(f"Nomaʼlum impost: {impost}")
    L, H = D(k["L"]), D(k["H"])
    if L <= 0 or H <= 0:
        raise HisobXato("L va H musbat boʻlishi kerak")
    vertikal = (k.get("tanlov") or {}).get("vertikal_shtapik", "R")
    if vertikal not in ("R", "oddiy"):
        raise HisobXato(f"vertikal_shtapik faqat R yoki oddiy: {vertikal}")
    lam = LAMINAT_QOSHIMCHA if (k.get("tanlov") or {}).get("rang") == "Laminatsiya" else D(0)
    metall = str((k.get("tanlov") or {}).get("eng_metall") or "1.5")
    h = Hisob(k.get("oyna_qalinligi", 24), vertikal_r=vertikal == "R", lam=lam, seriya=seriya, metall=metall)
    if seriya is ENGELBERG:
        pass  # Engelberg 7000: eshik, portal, egilgan impost hali yoʻq (_bolak_ichi da xato)
    if not seriya.eshik and k.get("arka"):
        raise HisobXato(f"{seriya.nomi}: arka hozircha yoʻq")

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
            {"nomi": n, "profil": p, "uzunlik": float(u), "soni": s}
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
            "fortochkalar": [[float(e), float(b), r] for e, b, r in h.fortochkalar],
            "impost_soni": h.impost_soni,
            "armatura_samorez": h.armatura_samorez,
            "lapsha_samorez": h.lapsha_samorez,
            "medved_samorez": h.medved_samorez,
            "eshiklar": h.eshiklar,
            "markaziy_rezina": float(h.markaziy_rezina),
            "oyna_rezinasi": float(h.oyna_rezinasi),
            "tabaqa_oyna_soni": h.tabaqa_oyna_soni,
            "gluxoy_oyna_soni": h.gluxoy_oyna_soni,
            "arka_metr": float(h.arka_metr / 100),
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
