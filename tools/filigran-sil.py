#!/usr/bin/env python3
"""
Lordlar Cagi - Kose filigranini siler.

Bazi gorsel ureten araclar ciktinin bir kosesine kendi isaretini koyuyor
(Gemini'nin dort kollu yildizi gibi). Oyunun icinde baska bir urunun
isaretini tasimak istemiyoruz.

IKI YONTEM:
  varsayilan   Yerel yansima: kutu, hemen yanindaki ayni boydaki seridin
               yatay aynasiyla degistirilir. Simetri gerektirmez, portrelerde
               calisir. Duzenli devam eden yuzeylerde (basamak, zemin cizgisi)
               dikis birakabilir - yansima cizgiyi geri dondurur ve ters V
               olusur.
  --tam-ayna   Tum goruntunun yatay aynasindan yamalar. Sahne simetrikse
               (taht salonu, sutunlu ic mekan) dikissiz sonuc verir; simetrik
               olmayan sahnede yanlis icerik tasir.

Hangisinin dogru oldugu goruntuye bagli - ikisini de --onizleme ile dene.

Bu bir "sihirli temizleme" degil: kucuk, kosede, arka planin duzenli
oldugu filigranlar icin uygundur. Sonucu her zaman gozle kontrol et.

KULLANIM:
  python3 tools/filigran-sil.py apps/web/public/gorseller/bolgeler/taht.webp
  python3 tools/filigran-sil.py <dosya> --kose sol-alt
  python3 tools/filigran-sil.py <dosya> --oran 0.15      # kutuyu buyut
  python3 tools/filigran-sil.py <dosya> --tam-ayna       # simetrik sahnelerde
  python3 tools/filigran-sil.py <dosya> --onizleme       # yazmadan yan yana goster
  python3 tools/filigran-sil.py <dosya> --kutu 0.88,0.81,0.94,0.90

--kutu: filigran koseye YAPISIK degilse. Dort sayi: sol,ust,sag,alt.
Hepsi 1'den kucukse oran, degilse piksel sayilir. Bazi araclar isaretini
kenardan bir tutam iceride birakiyor; kose kutusu onu sadece kismen
yakalayip yarim bir iz birakiyor.
"""
from __future__ import annotations

import sys
from pathlib import Path

ORAN = 0.12   # kutunun kenar uzunluguna orani
YUM = 7       # kenar yumusatma yaricapi

KOSELER = ("sag-alt", "sol-alt", "sag-ust", "sol-ust")


def kutu_hesapla(g: int, y: int, kose: str, oran: float):
    kg, ky = int(g * oran), int(y * oran)
    sag = "sag" in kose
    alt = "alt" in kose
    x0 = g - kg if sag else 0
    y0 = y - ky if alt else 0
    return (x0, y0, x0 + kg, y0 + ky), sag


def kutu_coz(metin: str, g: int, y: int):
    """"sol,ust,sag,alt" metnini piksel kutusuna cevirir (oran ya da piksel)."""
    sayilar = [float(p) for p in metin.split(",")]
    if len(sayilar) != 4:
        raise ValueError("--kutu dort sayi ister: sol,ust,sag,alt")
    if all(s <= 1 for s in sayilar):
        sayilar = [sayilar[0] * g, sayilar[1] * y, sayilar[2] * g, sayilar[3] * y]
    x0, y0, x1, y1 = (int(round(s)) for s in sayilar)
    if x1 <= x0 or y1 <= y0:
        raise ValueError("--kutu bos: sag > sol ve alt > ust olmali")
    return x0, y0, x1, y1


def sil_kutu(im, kutu, tam_ayna: bool = False):
    """
    Verilen kutuyu komsu seridin yatay aynasiyla degistirir.

    Yansima yonu kutunun goruntudeki yerine gore secilir: sag yaridaysa
    solundaki serit, sol yaridaysa sagindaki serit tasinir. Boylece yama
    her zaman goruntunun ICINDEN gelir, kenar disina tasmaz.
    """
    from PIL import Image, ImageDraw, ImageFilter

    g, y = im.size
    x0, y0, x1, y1 = kutu
    en = x1 - x0

    if tam_ayna:
        yamali = im.transpose(Image.FLIP_LEFT_RIGHT)
    else:
        sag = (x0 + x1) / 2 > g / 2
        # Serit goruntu disina tasarsa ters yone don
        if sag and x0 - en < 0:
            sag = False
        if not sag and x1 + en > g:
            sag = True
        komsu = im.crop((x0 - en, y0, x0, y1) if sag else (x1, y0, x1 + en, y1))
        komsu = komsu.transpose(Image.FLIP_LEFT_RIGHT)
        yamali = im.copy()
        yamali.paste(komsu, (x0, y0))

    maske = Image.new("L", (g, y), 0)
    ImageDraw.Draw(maske).rectangle((x0, y0, x1, y1), fill=255)
    maske = maske.filter(ImageFilter.GaussianBlur(YUM))

    sonuc = im.copy()
    sonuc.paste(yamali, (0, 0), maske)
    return sonuc


def sil(im, kose: str, oran: float, tam_ayna: bool = False):
    g, y = im.size
    kutu, _ = kutu_hesapla(g, y, kose, oran)
    return sil_kutu(im, kutu, tam_ayna)


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2

    from PIL import Image

    yol = Path(argv[0])
    if not yol.exists():
        print(f"Dosya bulunamadi: {yol}", file=sys.stderr)
        return 2

    kose = "sag-alt"
    if "--kose" in argv:
        kose = argv[argv.index("--kose") + 1]
        if kose not in KOSELER:
            print(f"Kose sunlardan biri olmali: {', '.join(KOSELER)}", file=sys.stderr)
            return 2
    oran = float(argv[argv.index("--oran") + 1]) if "--oran" in argv else ORAN

    im = Image.open(yol).convert("RGB")
    tam_ayna = "--tam-ayna" in argv
    if "--kutu" in argv:
        try:
            kutu = kutu_coz(argv[argv.index("--kutu") + 1], *im.size)
        except (IndexError, ValueError) as e:
            print(f"--kutu okunamadi: {e}", file=sys.stderr)
            return 2
        sonuc = sil_kutu(im, kutu, tam_ayna)
    else:
        sonuc = sil(im, kose, oran, tam_ayna)

    if "--onizleme" in argv:
        g, y = im.size
        yan = Image.new("RGB", (g * 2 + 20, y), (60, 30, 30))
        yan.paste(im, (0, 0))
        yan.paste(sonuc, (g + 20, 0))
        cikti = yol.parent / f"{yol.stem}-onizleme.png"
        yan.save(cikti)
        print(f"Onizleme (sol ozgun, sag yamali): {cikti}")
        return 0

    sonuc.save(yol, "WEBP", quality=82, method=6)
    print(f"{yol.name}: {kose} kosesi yamalandi ({yol.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
