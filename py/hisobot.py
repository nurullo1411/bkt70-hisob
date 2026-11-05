"""Konstruksiyadan aksessuar roʻyxati, tannarx va qisqa hisobot chiqaradi.

Ishga tushirish: python hisobot.py konstruksiya.json [narxlar.json]
"""
import json
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from hisob import D, HisobXato, hisobla

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
DVAYNOY_PRIJIM = "Dvaynoy uchun Prijiim (zatsepi bilan)"
DVAYNOY_PRIJIM_BOY = D(120)
# Burchak soedineli, katalog "Установка угловых соединителей": har burchakka bittadan
RAMA_BURCHAGI = {"F702": ["263 W02", "108 W02"], "F703": ["263 W03", "108 W03"]}
TABAQA_BURCHAGI = {"V702": ["184 W02", "078 W02"], "V707": ["184 M535", "078 M535"], "V708": ["184 M535", "078 M535"]}
IMPOST_UGOL = "ugol"  # asosiy: 01.553 (19 mm ugol soedinitel), har uchiga 2 ta
IMPOST_J = "J01+J05"  # tanlov: katalog 9-12
TIJ_AYIRMA_ESHIK ={"Stublina 1177": D(50), "Stublina 1177 (Uz)": D(50)}  # foydalanuvchi tasdiqlagan, 2026-11-02


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
        artikul = f"BKT70 {p['profil']}"
        jami_metr[artikul] = jami_metr.get(artikul, D(0)) + D(p["uzunlik"]) * p["soni"] / 100
    for artikul, metr in jami_metr.items():
        hivich = narxlar["profil_hivich"].get(artikul, {}).get(rang)
        summa = None if hivich is None else metr * D(hivich) / D(narxlar["hivich_m"])
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
            r.qosh("Aksessuar", "3,9×19 YHBM", soedinitel * 2, "dona")
        elif tur == IMPOST_J:
            # Katalog 9-12: M702 uchiga 236 J01 + 236 J05, bittadan
            r.qosh("Aksessuar", "236 J01", 2 * s["impost_soni"], "dona")
            r.qosh("Aksessuar", "236 J05", 2 * s["impost_soni"], "dona")
            # impostning bir uchiga 2 ta samorez (01.553 da 4 ta) (foydalanuvchi, 2026-11-04)
            r.qosh("Aksessuar", "3,9×19 YHBM", 2 * s["impost_soni"] * 2, "dona")
        else:
            raise HisobXato(f"Impost soedineli notoʻgʻri: {tur} ({IMPOST_UGOL} yoki {IMPOST_J})")
    if s["tabaqa_oyna_soni"]:
        r.qosh("Aksessuar", "Takos Regulirovichniy (32mm)", s["tabaqa_oyna_soni"] * 2, "dona")
    if s["gluxoy_oyna_soni"]:
        r.qosh("Aksessuar", "CT 203", s["gluxoy_oyna_soni"] * 2, "dona")


def _rom_furnitura(s, tanlov, r):
    """Rom tabaqasi: ProfOkna "Akfa TERMO 70 распашная створка" roʻyxati."""
    boylar = [D(b) for b in s.get("rom_tabaqa_boylari", [])]
    if not boylar:
        return
    soni = len(boylar)
    r.qosh("Furnitura", tanlov.get("rom_ruchka", ROM_RUCHKA), soni, "dona")
    r.qosh("Furnitura", ROM_KONNEKTOR, soni, "dona")
    r.qosh("Furnitura", "A3520.32", sum(3 if 150 < b <= 210 else 2 for b in boylar), "dona")
    r.qosh("Furnitura", ROM_PETLYA, sum(3 if b >= 90 else 2 for b in boylar), "dona")
    if any(b <= TIJ_AYIRMA for b in boylar):
        raise HisobXato(f"Rom tabaqasi juda past, poliamid tij sigʻmaydi: {min(boylar)} sm")
    r.qosh("Furnitura", ROM_TIJ, sum(b - TIJ_AYIRMA for b in boylar) / 100, "m")


def _dvaynoy_furnitura(s, r):
    """ProfOkna "Akfa TERMO 70 поворотно-откидная створка", dona boʻyicha. Tij formulasi ProfOknadan, tasdiqlanmagan."""
    tabaqalar = [(D(e), D(b)) for e, b in s.get("dvaynoylar", [])]
    if not tabaqalar:
        return
    soni = len(tabaqalar)
    r.qosh("Furnitura", DVAYNOY_RUCHKA, soni, "dona")
    r.qosh("Furnitura", DVAYNOY_MEXANIZM, soni, "dona")
    sredniy = sum(1 for en, _ in tabaqalar if en <= NOJNITSA_CHEGARA)
    if sredniy:
        r.qosh("Furnitura", NOJNITSA_SREDNIY, sredniy, "dona")
    if soni - sredniy:
        r.qosh("Furnitura", NOJNITSA_DLINNIY, soni - sredniy, "dona")
    prijim = sum(1 for _, b in tabaqalar if b >= DVAYNOY_PRIJIM_BOY)
    if prijim:
        r.qosh("Furnitura", DVAYNOY_PRIJIM, prijim, "dona")
    # Prijim qoʻshilsa, rolik-zatsep komplektidan yana bittasi (foydalanuvchi, 2026-11-02)
    r.qosh("Furnitura", "A3520.32", len(tabaqalar) * 3 + prijim, "dona")
    tij = D(0)
    for en, boy in tabaqalar:
        if en <= TIJ_AYIRMA:
            raise HisobXato(f"Dvaynoy tabaqa juda tor, poliamid tij sigʻmaydi: {en} sm")
        tij += (boy - 10) + (en - TIJ_AYIRMA)
        if boy >= DVAYNOY_PRIJIM_BOY:
            tij += (boy - 10) / 2
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
        r.qosh("Furnitura", "A3520.32", soni * 2, "dona")
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
    _rezina(s, r)
    _aksessuar(s, narxlar, r, tanlov)
    _furnitura(s, tanlov, r)
    _rom_furnitura(s, tanlov, r)
    _dvaynoy_furnitura(s, r)

    qalinlik = str(k.get("oyna_qalinligi", 24))
    m2 = D(n["oyna_m2"])
    if oyna_turi not in narxlar["steklopaket_m2"]:
        raise HisobXato(f"Nomaʼlum oyna turi: {oyna_turi}")
    m2_narx = narxlar["steklopaket_m2"][oyna_turi].get(qalinlik)
    r.summa_bilan(
        "Oyna", f"Steklopaket {oyna_turi} {qalinlik} mm", m2, "m²",
        None if m2_narx is None else m2 * D(m2_narx), f"Steklopaket {oyna_turi} {qalinlik} mm",
    )
    if tanlov.get("montaj"):
        r.qosh("Montaj", "MK 01", D(s["rama_perimetri"]) / 100 * PENA_METRGA, "ballon")

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
