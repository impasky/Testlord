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


def sil(im, kose: str, oran: float, tam_ayna: bool = False):
    from PIL import Image, ImageDraw, ImageFilter

    g, y = im.size
    (x0, y0, x1, y1), sag = kutu_hesapla(g, y, kose, oran)
    en = x1 - x0

    if tam_ayna:
        yamali = im.transpose(Image.FLIP_LEFT_RIGHT)
    else:
        # Kutunun ic tarafindaki komsu serit: sag kosede solundaki, sol kosede sagindaki
        if sag:
            komsu = im.crop((x0 - en, y0, x0, y1))
        else:
            komsu = im.crop((x1, y0, x1 + en, y1))
        komsu = komsu.transpose(Image.FLIP_LEFT_RIGHT)
        yamali = im.copy()
        yamali.paste(komsu, (x0, y0))

    maske = Image.new("L", (g, y), 0)
    ImageDraw.Draw(maske).rectangle((x0, y0, x1, y1), fill=255)
    maske = maske.filter(ImageFilter.GaussianBlur(YUM))

    sonuc = im.copy()
    sonuc.paste(yamali, (0, 0), maske)
    return sonuc


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
    sonuc = sil(im, kose, oran, tam_ayna="--tam-ayna" in argv)

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
