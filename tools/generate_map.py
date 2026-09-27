#!/usr/bin/env python3
"""
Lordlar Cagi - Dunya haritasi DOGRULAYICISI.

ESKIDEN URETICIYDI, ARTIK DEGIL.

Bu script bir zamanlar `data/world-map.json` dosyasini sifirdan uretiyordu:
yaricapi 4 olan bir altigen izgara, 1 merkez + 60 bolge. Y1'de altigenler
kalkti (docs/12 §1) ve harita bir KOMSULUK GRAFIGINE dondu; bolgeler
q/r/ring yerine x/y (yalniz cizim icin) ve `komsular` tutuyor. Ayrica
`koy` diye yeni bir tur girdi.

Script eski bicimi yazmaya devam ediyordu ve bu CANLI BIR TUZAKTI:
README'de "python3 tools/generate_map.py # haritayi yeniden uret" yaziyor,
calistiran kisi de dunyayi bozuyordu -- oyun x/y bekliyor, dosyada q/r
buluyordu.

Uretmek yerine DOGRULUYOR. Harita artik uretilen degil BAKILAN bir dosya:
61 bolgenin adi, turu ve komsulugu elle secildi. Onu bir formulden yeniden
turetmek, o secimleri silmek olurdu.

  python3 tools/generate_map.py        # dogrula

Isaretcilerin karaya oturup oturmadigi da burada denetleniyor (x/y yalniz
cizim icin; kural docs/12 §9). Kara, bolge hucrelerinin de kirpildigi kiyi
cizgisi: apps/web/src/components/harita/kara.ts (KARA_YOLU). Suya dusen
isaretci varsa x/y'si elle karaya alinir.
"""
import json
import math
import re
import os
import sys
from collections import Counter, deque

# Beklenen bolge sayisi KANONIK DOSYADAN okunuyor, elle yazilmiyor. Once
# 61 diye sabitti; dunya 121 bolgeye cikinca denetim, tasarimda hicbir sey
# bozulmadigi halde "121 var, 61 bekleniyordu" diye kaldi. Denetlenecek sey
# sayinin kendisi degil, dosyanin KENDI ICINDE tutarli olmasi.
# (Sayi artik `dogrula` icinde harita dosyasinin kendi region_count'undan
# okunuyor; burada bir sabit tutulmuyor.)
# Bolge turleri: ayni liste packages/shared/src/types.ts icinde de var.
GECERLI_TURLER = {"taht", "koy", "tarla", "maden", "sehir", "kale"}


def yukle(kok: str) -> dict:
    with open(os.path.join(kok, "data", "world-map.json"), encoding="utf-8") as f:
        return json.load(f)


def dogrula(harita: dict) -> list[str]:
    """Bulunan sorunlarin listesi; bos liste = temiz."""
    sorunlar: list[str] = []
    bolgeler = harita.get("regions", [])
    kimlikler = {b["id"] for b in bolgeler}

    beklenen = harita.get("region_count")
    if beklenen is None:
        sorunlar.append("region_count alani yok")
    elif len(bolgeler) != beklenen:
        sorunlar.append(f"{len(bolgeler)} bolge var, region_count {beklenen} diyor")
    if len(kimlikler) != len(bolgeler):
        sorunlar.append("bolge kimlikleri benzersiz degil")

    # --- Alanlar: eski bicim kalintisi kalmasin ---
    for b in bolgeler:
        for eski in ("q", "r", "ring"):
            if eski in b:
                sorunlar.append(f"bolge {b['id']} hala eski alan tasiyor: {eski}")
        for gerekli in ("x", "y", "komsular", "type", "name", "province"):
            if gerekli not in b:
                sorunlar.append(f"bolge {b['id']} eksik alan: {gerekli}")
        if b.get("type") not in GECERLI_TURLER:
            sorunlar.append(f"bolge {b['id']} bilinmeyen tur: {b.get('type')}")
        # x/y bir YUZDE: zeminin uzerine konuyor.
        for eksen in ("x", "y"):
            v = b.get(eksen)
            if not isinstance(v, (int, float)) or not (0 <= v <= 100):
                sorunlar.append(f"bolge {b['id']} {eksen} yuzde araliginda degil: {v}")

    # --- Komsuluk SIMETRIK olmali ---
    #
    # Tek yonlu bir komsuluk, oyuncunun gidebildigi ama geri donemedigi
    # bir bolge demek. Altigen izgarada bu imkansizdi (geometri simetriyi
    # garanti ediyordu); elle bakilan bir grafikte degil.
    komsu = {b["id"]: set(b.get("komsular", [])) for b in bolgeler}
    for kimlik, liste in komsu.items():
        for k in liste:
            if k not in kimlikler:
                sorunlar.append(f"bolge {kimlik} olmayan bir bolgeyi komsu gosteriyor: {k}")
            elif kimlik not in komsu.get(k, set()):
                sorunlar.append(f"komsuluk tek yonlu: {kimlik} -> {k}, ama {k} -> {kimlik} yok")
        if kimlik in liste:
            sorunlar.append(f"bolge {kimlik} kendini komsu gosteriyor")

    # --- Grafik BAGLI olmali ---
    #
    # Kopuk bir parca, oraya hicbir zaman yuruyemeyecegin bolgeler demek:
    # oyuncu haritada gorur, saldiramaz ve sebebini hicbir yerde bulamaz.
    if bolgeler:
        bas = bolgeler[0]["id"]
        gorulen = {bas}
        kuyruk = deque([bas])
        while kuyruk:
            n = kuyruk.popleft()
            for k in komsu.get(n, set()):
                if k not in gorulen:
                    gorulen.add(k)
                    kuyruk.append(k)
        if len(gorulen) != len(bolgeler):
            sorunlar.append(
                f"grafik BAGLI DEGIL: {len(gorulen)}/{len(bolgeler)} bolgeye ulasilabiliyor"
            )

    # --- Taht tek olmali ---
    taht = [b for b in bolgeler if b.get("type") == "taht"]
    if len(taht) != 1:
        sorunlar.append(f"{len(taht)} taht var, 1 olmaliydi")

    return sorunlar


# Kiyi payi (harita birimi, 0-100): isaretcinin bu kadar yakininda kara varsa
# karada sayiliyor.
YAKIN_KARA = 2.0


def kara_cokgenleri(kok: str) -> list[list[tuple[float, float]]]:
    """kara.ts icindeki KARA_YOLU'nu (M ... Z alt yollari) cokgenlere cevirir."""
    yol = os.path.join(kok, "apps", "web", "src", "components", "harita", "kara.ts")
    with open(yol, encoding="utf-8") as f:
        metin = f.read()
    # Yol birden fazla dizgenin `+` ile birlesimi: tanimdan noktali virgule
    # kadar butun tirnakli parcalar.
    m = re.search(r"KARA_YOLU\s*=([^;]+);", metin)
    if not m:
        return []
    yol_metni = "".join(re.findall(r"'([^']*)'", m.group(1)))
    cokgenler = []
    for parca in yol_metni.split("M"):
        sayilar = [float(t) for t in re.split(r"[\s,]+", parca.replace("Z", "").strip()) if t]
        if len(sayilar) >= 6:
            cokgenler.append(list(zip(sayilar[0::2], sayilar[1::2])))
    return cokgenler


def karada(x: float, y: float, cokgenler) -> bool:
    """Tek-cift kurali (SVG evenodd ile ayni): adalar ve goller dogru sayiliyor."""
    ic = False
    for c in cokgenler:
        j = len(c) - 1
        for i in range(len(c)):
            xi, yi = c[i]
            xj, yj = c[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                ic = not ic
            j = i
    return ic


def zemin_denetimi(bolgeler, kok: str) -> tuple[list[str], str]:
    """
    Isaretciler KARADA mi?

    Bu denetim buraya ait: x/y yalniz cizim icin ve tek olcutu karaya
    oturmasi. Denizin ortasinda duran bir tarla, oyuncunun "burasi neresi"
    sorusuna verilebilecek en kotu cevap -- ve hicbir testte gorunmez,
    cunku oyunun mantigi `komsular` grafigine bakiyor.

    Kara, bolge hucrelerinin kirpildigi ve dunya zemininin cizildigi AYNI
    kiyi cizgisi (kara.ts). Eskiden boyali dunya resminden bir maske
    okunuyordu; resim kalkinca (docs/24) kiyi tek yerde kaldi.
    """
    cokgenler = kara_cokgenleri(kok)
    if not cokgenler:
        return ["kara.ts okunamadi: KARA_YOLU yok"], ""
    # Kiyi burnu da kara sayiliyor (eski resim denetimindeki en gevsek
    # kademe gibi): isaretcinin YAKIN_KARA birim cevresinde kara varsa
    # tamam. Kiyidaki dort bolgenin isaretcisi cizginin bir tik disinda ve
    # hucreleri karaya kirpildigi icin oyuncu onlari karada goruyor.
    def kiyida(x: float, y: float) -> bool:
        if karada(x, y, cokgenler):
            return True
        for yaricap in (YAKIN_KARA / 2, YAKIN_KARA):
            for k in range(12):
                a = k / 12 * 6.283185307179586
                if karada(x + yaricap * math.cos(a), y + yaricap * math.sin(a), cokgenler):
                    return True
        return False

    suda = [f"{b['name']} ({b['x']}, {b['y']})" for b in bolgeler if not kiyida(b["x"], b["y"])]
    if suda:
        return [
            f"{len(suda)} isaretci denize dusuyor (x/y'yi karaya al): " + ", ".join(suda[:6])
            + ("..." if len(suda) > 6 else "")
        ], ""
    return [], f"{len(bolgeler)} isaretcinin hepsi karada"


def main() -> int:
    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    harita = yukle(kok)
    sorunlar = dogrula(harita)

    bolgeler = harita.get("regions", [])
    zemin_sorun, zemin_not = zemin_denetimi(bolgeler, kok)
    sorunlar += zemin_sorun
    tipler = Counter(b.get("type") for b in bolgeler)
    komsuSayilari = [len(b.get("komsular", [])) for b in bolgeler]

    print(f"{len(bolgeler)} bolge okundu -> data/world-map.json")
    print("Tip dagilimi:", dict(tipler))
    if komsuSayilari:
        print(
            "Komsu sayisi: en az",
            min(komsuSayilari),
            "| en cok",
            max(komsuSayilari),
            "| ortalama",
            round(sum(komsuSayilari) / len(komsuSayilari), 2),
        )
    if zemin_not:
        print("Zemin:", zemin_not)

    if sorunlar:
        print(f"\n{len(sorunlar)} SORUN:")
        for s in sorunlar:
            print("  -", s)
        return 1

    print("\nHARITA TEMIZ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
