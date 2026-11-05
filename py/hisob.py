"""BKT 70 hisob dasturi: konstruksiya tuzilmasidan detal, oyna va shtapik oʻlchamlarini chiqaradi.

Qoidalar CLAUDE.md dagi tasdiqlangan formulalardan olingan. Oʻlchamlar sm da.
Ishga tushirish: python hisob.py konstruksiya.json
"""
import json
import sys
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


def D(x):
    return Decimal(str(x))


RAMA_R = {"F702": D("3.8"), "F703": D("5.8")}
IMPOST_YARMI = {"M702": D("1.9")}
TABAQA_AYIRMA = {"V702": D("11.1"), "V707": D("18.4"), "V708": D("17.1")}
ESHIK_PROFILI = {"ichkariga": "V708", "tashqariga": "V707"}  # Balkon Qanot / Balkon Oʻrta
ROM_TABAQA_PROFILI = "V702"
SHTAPIK_TURLARI = {24, 32}
SHTAPIK_QALINLIGI = D("2.2")
LAPSHA_PROFILI = "H702"
LAPSHA_ENI = D("0.5")
ESHIK_MIN_TABAQA = D("65")


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

    @property
    def ichki_en(self):
        return self.en - self.chap - self.ong

    @property
    def ichki_boy(self):
        return self.boy - self.tepa - self.past


class Hisob:
    def __init__(self, oyna_qalinligi, vertikal_r=True):
        if oyna_qalinligi not in SHTAPIK_TURLARI:
            raise HisobXato(f"Oyna qalinligi uchun shtapik yoʻq: {oyna_qalinligi} mm (faqat 24 yoki 32)")
        self.qalinlik = oyna_qalinligi
        self.vertikal_r = vertikal_r  # False: boʻyiga ham oddiy G shtapik
        self.profillar = {}
        self.oynalar = {}
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
        self.eshiklar = []
        self.markaziy_rezina = D(0)
        self.oyna_rezinasi = D(0)
        self.tabaqa_oyna_soni = 0
        self.gluxoy_oyna_soni = 0

    def detal(self, nomi, profil, uzunlik, soni):
        if uzunlik <= 0:
            raise HisobXato(f"{nomi} uzunligi musbat emas: {uzunlik}")
        key = (nomi, profil, uzunlik)
        self.profillar[key] = self.profillar.get(key, 0) + soni

    def oyna(self, joy, ichki_en, ichki_boy, ayirma):
        en, boy = ichki_en - ayirma, ichki_boy - ayirma
        if en <= 0 or boy <= 0:
            raise HisobXato(f"{joy} oynasi uchun joy yetmaydi: {en} × {boy}")
        key = (joy, en, boy)
        self.oynalar[key] = self.oynalar.get(key, 0) + 1
        self.oyna_rezinasi += 2 * (en + boy) + 8
        if joy == "Gluxoy":
            self.gluxoy_oyna_soni += 1
        else:
            self.tabaqa_oyna_soni += 1
        g = self.qalinlik
        self.detal("Shtapik gorizontal", f"G{g}", ichki_en, 2)
        self.detal("Shtapik vertikal", f"G{g}-R" if self.vertikal_r else f"G{g}",
                   ichki_boy - 2 * SHTAPIK_QALINLIGI, 2)

    def tabaqa(self, joy, profil, en, boy, shtulp_yonida=False, rom=False, dvaynoy=False, fortochka=None):
        self.tabaqa_soni += 1
        self.tabaqalar[profil] = self.tabaqalar.get(profil, 0) + 1
        if fortochka is not None:
            self.fortochkalar.append((en, boy, fortochka))
        elif dvaynoy:
            self.dvaynoylar.append((en, boy))
        else:
            (self.rom_tabaqa_boylari if rom else self.tabaqa_boylari).append(boy)
        # Markaziy rezina: rama yoki impostga tegadigan tomonlar
        self.markaziy_rezina += 2 * en + (boy if shtulp_yonida else 2 * boy)
        self.detal("Tabaqa eni", profil, en, 2)
        self.detal("Tabaqa boʻyi", profil, boy, 2)
        ayirma = TABAQA_AYIRMA[profil]
        self.oyna(joy, en - ayirma, boy - ayirma, D(2))

    def rama(self, profil, en, boy):
        self.ramalar[profil] = self.ramalar.get(profil, 0) + 1
        self.rama_perimetri += 2 * (en + boy)
        self.detal("Rama eni", profil, en, 2)
        self.detal("Rama boʻyi", profil, boy, 2)

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
        if len(boshlar) == len(olchamlar):
            raise HisobXato("Kamida bitta boʻlak oʻlchami berilishi kerak")
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
    uzunlik = z.ichki_boy if vertikal else z.ichki_en
    h.detal(nomi, ctx["impost"], uzunlik, len(olchamlar) - 1)
    h.impost_soni += len(olchamlar) - 1
    ichki_ctx = {**ctx, "bolinish_ichida": True}
    for i, (olcham, bola) in enumerate(zip(olchamlar, b["bolaklar"])):
        boshi, oxiri = chetlar(i)
        if vertikal:
            yangi = Zona(olcham, z.boy, boshi, oxiri, z.tepa, z.past)
        else:
            yangi = Zona(z.en, olcham, z.chap, z.ong, boshi, oxiri)
        _bolak(bola, yangi, h, ichki_ctx)


def _eshik(b, z, h):
    ochilish = b.get("ochilish")
    if ochilish not in ESHIK_PROFILI:
        raise HisobXato("Eshik ochilishi 'ichkariga' yoki 'tashqariga' boʻlishi kerak")
    profil = ESHIK_PROFILI[ochilish]
    H1 = z.ichki_boy + D("1.2")
    soni = b.get("tabaqa_soni")
    if soni == 1:
        h.tabaqa("Eshik tabaqasi", profil, z.ichki_en + D("1.2"), H1)
        h.eshiklar.append(1)
    elif soni == 2:
        jami = z.ichki_en + D("0.5")
        L1 = jami / 2
        if L1 < ESHIK_MIN_TABAQA:
            L1 = ESHIK_MIN_TABAQA
        L2 = jami - L1
        if L2 <= 0:
            raise HisobXato(f"Ikki tabaqa uchun joy yetmaydi: eshik oʻrni {z.ichki_en}")
        h.tabaqa("Eshik tabaqasi L1", profil, L1, H1, shtulp_yonida=True)
        h.tabaqa("Eshik tabaqasi L2", profil, L2, H1, shtulp_yonida=True)
        h.markaziy_rezina += H1  # shtulp boʻyi bir marta
        h.detal("Shtulp", "A701", H1 - 7, 1)
        h.eshiklar.append(2)
    else:
        raise HisobXato("Eshik tabaqa soni 1 yoki 2 boʻlishi kerak")


def _bolak(b, z, h, ctx):
    if z.ichki_en <= 0 or z.ichki_boy <= 0:
        raise HisobXato(f"Boʻlak juda kichik: ichki {z.ichki_en} × {z.ichki_boy}")
    tur = b.get("tur")
    if tur == "gluxoy":
        h.oyna("Gluxoy", z.ichki_en, z.ichki_boy, D("1.5"))
    elif tur == "tabaqa" and b.get("fortochka"):
        # Fortochka (foydalanuvchi, 2026-11-05): qanot, shtapik, oyna rom tabaqasidagidek, faqat furnitura boshqa
        ruchka = bool(b.get("ruchka"))
        h.tabaqa("Fortochka", ROM_TABAQA_PROFILI, z.ichki_en + D("1.1"), z.ichki_boy + D("1.1"), rom=True,
                 fortochka=ruchka)
    elif tur == "tabaqa":
        h.tabaqa("Rom tabaqasi", ROM_TABAQA_PROFILI, z.ichki_en + D("1.1"), z.ichki_boy + D("1.1"), rom=True,
                 dvaynoy=bool(b.get("dvaynoy")))
    elif tur == "eshik":
        _eshik(b, z, h)
    elif tur == "bolinish":
        _bolinish(b, z, h, ctx)
    else:
        raise HisobXato(f"Nomaʼlum boʻlak turi: {tur}")


def _rama_hisobi(profil, impost, en, boy, bolak, h):
    r = RAMA_R[profil]
    h.rama(profil, en, boy)
    ctx = {"impost": impost, "yarmi": IMPOST_YARMI[impost], "bolinish_ichida": False}
    _bolak(bolak, Zona(en, boy, r, r, r, r), h, ctx)


def hisobla(k):
    """Konstruksiya lugʻatidan natija lugʻatini qaytaradi. Xato boʻlsa HisobXato chiqaradi."""
    profil, impost = k.get("rama"), k.get("impost", "M702")
    if profil not in RAMA_R:
        raise HisobXato(f"Nomaʼlum rama: {profil}")
    if impost not in IMPOST_YARMI:
        raise HisobXato(f"Nomaʼlum impost: {impost}")
    L, H = D(k["L"]), D(k["H"])
    if L <= 0 or H <= 0:
        raise HisobXato("L va H musbat boʻlishi kerak")
    vertikal = (k.get("tanlov") or {}).get("vertikal_shtapik", "R")
    if vertikal not in ("R", "oddiy"):
        raise HisobXato(f"vertikal_shtapik faqat R yoki oddiy: {vertikal}")
    h = Hisob(k.get("oyna_qalinligi", 24), vertikal_r=vertikal == "R")

    if k.get("tur") == "lapshali":
        yonlar = [D(k[t]) for t in ("chap", "ong") if k.get(t) is not None]
        if not yonlar or any(y <= 0 for y in yonlar):
            raise HisobXato("Lapshali vitrajda kamida bitta yon oyna eni kerak")
        eshik_eni = L - sum(yonlar) - LAPSHA_ENI * len(yonlar)
        if eshik_eni <= 0:
            raise HisobXato("Eshik ramasi uchun joy qolmadi")
        _rama_hisobi(profil, impost, eshik_eni, H, k["bolak"], h)
        for y in yonlar:
            _rama_hisobi(profil, impost, y, H, {"tur": "gluxoy"}, h)
        h.detal("Lapsha", LAPSHA_PROFILI, H, len(yonlar))
    else:
        _rama_hisobi(profil, impost, L, H, k["bolak"], h)

    m2 = sum((en * boy * n for (_, en, boy), n in h.oynalar.items()), D(0)) / 10000
    return {
        "profillar": [
            {"nomi": n, "profil": p, "uzunlik": float(u), "soni": s}
            for (n, p, u), s in h.profillar.items()
        ],
        "oynalar": [
            {"joy": j, "en": float(e), "boy": float(b), "soni": s}
            for (j, e, b), s in h.oynalar.items()
        ],
        "oyna_m2": float(m2),
        "ogohlantirishlar": h.ogohlantirishlar,
        "qoida_yoq": h.qoida_yoq,
        "sanoq": {
            "ramalar": h.ramalar,
            "rama_perimetri": float(h.rama_perimetri),
            "tabaqa_soni": h.tabaqa_soni,
            "tabaqalar": h.tabaqalar,
            "tabaqa_boylari": [float(b) for b in h.tabaqa_boylari],
            "rom_tabaqa_boylari": [float(b) for b in h.rom_tabaqa_boylari],
            "dvaynoylar": [[float(e), float(b)] for e, b in h.dvaynoylar],
            "fortochkalar": [[float(e), float(b), r] for e, b, r in h.fortochkalar],
            "impost_soni": h.impost_soni,
            "eshiklar": h.eshiklar,
            "markaziy_rezina": float(h.markaziy_rezina),
            "oyna_rezinasi": float(h.oyna_rezinasi),
            "tabaqa_oyna_soni": h.tabaqa_oyna_soni,
            "gluxoy_oyna_soni": h.gluxoy_oyna_soni,
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
