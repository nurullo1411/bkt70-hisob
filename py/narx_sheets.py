"""Google Sheets "bkt 70 hisoblash" qatorlaridan narxlar.json tuzadi (telefon ilovasi va kompyuter uchun bitta qoida).

Manba (Apps Script `?t=narx` javobi, koʻrinadigan qiymatlar, ru_RU formatida "0,97", "160 000,00"):
  Narxlar!A:P — B kalit, E narx ($); H:J steklopaket soʻmda (2-qator: qalinliklar); "K188 tuba ..." qatorlari.
  Malumot!I:M — profil hivichi narxi (1-qator: rang turkumlari), "Hivich uzunligi (m)".
  Hisob!F5 — kurs.
Kompyuterda yangilash: python narx_yangila.py
"""
import re
from datetime import datetime, timedelta

MANBA = "Google Sheets 'bkt 70 hisoblash' (Narxlar, Malumot, Hisob!F5)"


def son(x):
    """'1 234,50' / '280,' / '0,01234' → float; boʻsh yoki matn boʻlsa None."""
    s = re.sub(r"[\s  $]", "", str(x if x is not None else "")).replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _q(qator, i):
    return str(qator[i]).strip() if i < len(qator) and qator[i] is not None else ""


def _vaqt(iso):
    """UTC ISO vaqt → Toshkent (UTC+5) 'YYYY-MM-DD HH:MM'."""
    try:
        return (datetime.fromisoformat(str(iso).replace("Z", "+00:00")) + timedelta(hours=5)).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return "?"


def tuz(manba):
    """manba: {"Narxlar": [[...]], "Malumot": [[...]], "kurs": "12 000", "vaqt": "..."} → narxlar dict."""
    narxlar_q = manba.get("Narxlar") or []
    malumot_q = manba.get("Malumot") or []

    narx = {}
    for q in narxlar_q[2:]:
        kalit, qiymat = _q(q, 1), son(_q(q, 4))
        if kalit and qiymat is not None:
            narx[kalit] = qiymat

    sarlavha = narxlar_q[1] if len(narxlar_q) > 1 else []
    qalinlik = {j: str(int(son(_q(sarlavha, j)))) for j in (8, 9, 10, 11, 12, 13, 14) if son(_q(sarlavha, j))}
    stekl, k188_g, k188_narx, yashirin = {}, None, None, []
    for q in narxlar_q[2:]:
        nom = _q(q, 7)
        if not nom:
            continue
        if nom.lower().startswith("k188 tuba og"):
            k188_g = son(_q(q, 8))
        elif nom.lower().startswith("k188 tuba narx"):
            k188_narx = son(_q(q, 8))
        else:
            qiymatlar = {qal: int(round(son(_q(q, j)))) for j, qal in qalinlik.items() if son(_q(q, j)) is not None}
            if qiymatlar:
                stekl[nom] = qiymatlar
                if _q(q, 15).lower().startswith("yashirin"):
                    yashirin.append(nom)

    turkumlar = [_q(malumot_q[0], j) for j in range(1, 5)] if malumot_q else []
    profil, hivich_m = {}, None
    for q in malumot_q[1:]:
        nom = _q(q, 0)
        if nom.startswith("BKT70 "):
            profil[nom] = {t: son(_q(q, j + 1)) for j, t in enumerate(turkumlar) if t and son(_q(q, j + 1)) is not None}
        elif nom.lower().startswith("hivich uzunligi"):
            hivich_m = son(_q(q, 1))
    # Engelberg 7000 (2026-11-09): Narxlar dagi "ENG 7051 | Oq" (hivich 6 m narxi) qatorlari;
    # metall rangga bogʻliq emas: "ENG 0701 | *"
    for kalit, qiymat in narx.items():
        m = re.match(r"^(ENG \S+) \| (.+)$", kalit)
        if m:
            profil.setdefault(m.group(1), {})[m.group(2)] = qiymat

    xato = [n for n, v in (("narx", narx), ("profil", profil), ("steklopaket", stekl)) if not v]
    if xato or not hivich_m or not k188_g or not k188_narx:
        raise ValueError("Sheets narxlari toʻliq emas: " + ", ".join(xato or ["hivich/K188"]))
    return {
        "manba": f"{MANBA}, {_vaqt(manba.get('vaqt'))} dagi holat",
        "hivich_m": hivich_m,
        "k188_tuba_g": k188_g,
        "k188_tuba_narx": k188_narx,
        "profil_hivich": profil,
        "narx": narx,
        "kurs": son(manba.get("kurs")) or 12000,
        "steklopaket_som": stekl,
        # Katalogda yashirilgan oyna turlari (P ustuni): tanlovda chiqmaydi, eski zakazlar narxi bilan hisoblanadi
        "oyna_yashirin": yashirin,
        "steklopaket_m2": {t: {q: None for q in qalinlik.values()} for t in stekl},
    }


def farqlar(eski, yangi):
    """Oʻzgargan narxlar roʻyxati (matn), kompyuterda koʻrsatish uchun."""
    q = []
    for boʻlim in ("narx", "profil_hivich", "steklopaket_som"):
        a, b = eski.get(boʻlim) or {}, yangi.get(boʻlim) or {}
        for k in sorted(set(a) | set(b)):
            if a.get(k) != b.get(k):
                q.append(f"{boʻlim} · {k}: {a.get(k)} → {b.get(k)}")
    for k in ("hivich_m", "k188_tuba_g", "k188_tuba_narx", "kurs"):
        if eski.get(k) != yangi.get(k):
            q.append(f"{k}: {eski.get(k)} → {yangi.get(k)}")
    return q
