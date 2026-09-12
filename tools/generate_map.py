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

Isaretcilerin cizilmis zemine oturup oturmadigi da burada denetleniyor
(x/y yalniz cizim icin; kural docs/12 §9). Suya dusen isaretci varsa
duzeltmesi ayri bir arac: tools/harita-yerlestir.py
"""
import importlib.util
import json
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


def zemin_denetimi(bolgeler) -> tuple[list[str], str]:
    """
    Isaretciler cizilmis dunya zemininde KARAYA mi dusuyor?

    Bu denetim buraya ait: x/y yalniz cizim icin ve tek olcutu zemine
    oturmasi. Denizin ortasinda duran bir tarla, oyuncunun "burasi neresi"
    sorusuna verilebilecek en kotu cevap -- ve hicbir testte gorunmez,
    cunku oyunun mantigi `komsular` grafigine bakiyor.

    Kara maskesi tools/harita-yerlestir.py icinde tanimli; ikinci bir kopya
    yazmak, iki aracin "kara" tanimini zamanla ayirmak demekti. Zemin ya da
    Pillow/scipy yoksa denetim ATLANIYOR: bu script gorselsiz de calismali.
    """
    yol = os.path.join(os.path.dirname(os.path.abspath(__file__)), "harita-yerlestir.py")
    spec = importlib.util.spec_from_file_location("harita_yerlestir", yol)
    if spec is None or spec.loader is None:
        return [], "zemin denetimi atlandi (arac bulunamadi)"
    arac = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(arac)
        if not arac.ZEMIN.exists():
            return [], "zemin denetimi atlandi (dunya.webp yok)"
        kara = arac.kara_maskesi()
    except Exception as e:  # Pillow/scipy yok, ya da zemin okunamadi
        return [], f"zemin denetimi atlandi ({type(e).__name__})"

    yuk, gen = kara.shape
    oran, _, _ = arac.TURLAR[-1]     # en gevsek kademe: kiyi burnu da kara sayilir
    r = arac.YARICAP
    suda = []
    for b in bolgeler:
        px, py = int(b["x"] / 100 * gen), int(b["y"] / 100 * yuk)
        pencere = kara[max(0, py - r):py + r + 1, max(0, px - r):px + r + 1]
        if pencere.size == 0 or pencere.mean() <= oran:
            suda.append(f"{b['name']} ({b['x']}, {b['y']})")
    if suda:
        return [
            f"{len(suda)} isaretci zeminde suya dusuyor "
            f"(duzelt: python3 tools/harita-yerlestir.py --yaz): " + ", ".join(suda[:6])
            + ("..." if len(suda) > 6 else "")
        ], ""
    return [], f"{len(bolgeler)} isaretcinin hepsi karada"


def main() -> int:
    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    harita = yukle(kok)
    sorunlar = dogrula(harita)

    bolgeler = harita.get("regions", [])
    zemin_sorun, zemin_not = zemin_denetimi(bolgeler)
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
