#!/usr/bin/env python3
"""
Lordlar Cagi - Bina sprite'larini ORTAK BIR ZEMIN CIZGISINE hizalar.

SORUN: sprite'lar tek tek uretildi ve her birinin cercevesindeki bosluk
farkli. Olculdugunde alt bosluk %3 ile %12 arasinda geziyordu. Sonuc:
hepsi ayni kutuya konsa bile binalarin TABANI ayni yere denk gelmiyor --
biri zemine gomulmus, oteki havada duruyor gorunuyor. Oyuncunun
"haritaya tam oturan bir yapi" istegi once bu yuzden karsilanamiyor.

NE YAPIYOR: her sprite'i alfa sinirina kirpar, karesinin %96'sini
dolduracak sekilde olcekler, YATAYDA ORTALAR ve DIKEYDE TABANA OTURTUR
(altta %2 pay kalir). Boylece:

  - her sprite'in alt kenari binanin TABANIDIR,
  - arayuz sprite'i tabanindan cakabilir (`translate(-50%, -100%)`),
    yani x/y "binanin ayak bastigi yer" anlamina gelir,
  - temas golgesi tam o noktaya konabilir.

Kare tuval korunuyor: en/boy orani dosyadan dosyaya degisseydi arayuzde
yukseklik ancak resim yuklendikten sonra bilinirdi ve kart zıplardi
(CLS). Kare sabit, icindeki cizim kendi oranini koruyor -- kule ince ve
uzun, sur genis ve alcak kaliyor.

Islem TEKRARLANABILIR: zaten hizali bir dosya ayni kalir.

KULLANIM:
  python3 tools/sprite-hizala.py apps/web/public/gorseller/binalar/*.webp
  python3 tools/sprite-hizala.py --onizleme apps/web/public/gorseller/binalar/*.webp
  python3 tools/sprite-hizala.py --orta apps/web/public/gorseller/ekipman/*.webp
"""
from __future__ import annotations

import sys
from pathlib import Path

ALFA_ESIK = 40   # bundan saydam pikseller "yok" sayilir (kenar yumusatmasi)
DOLULUK = 0.96   # cizim karenin bu kadarini doldurur
ALT_PAY = 0.02   # tabanin altinda kalan pay


def hizala(yol: Path, taban: bool = True):
    """
    (hizalanmis gorsel, tasinan piksel) — alfa yoksa None.

    `taban=True`  cizim ALT kenara oturur. Zemine basan her sey boyle:
                  bina, dusman, birim, lord. Arayuz onlari tabanindan
                  cakiyor ve tam oraya temas golgesi koyuyor.
    `taban=False` cizim ORTALANIR. Envanter ikonlari ve portreler boyle:
                  capraz duran bir kilicin "tabani" yok, kutuya ortalanmasi
                  gerekiyor -- otuz ikon alt alta dizildiginde biri asagi
                  biri yukari kaymis gorunmesin diye.
    """
    import numpy as np
    from PIL import Image

    im = Image.open(yol).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    dolu = a > ALFA_ESIK
    if not dolu.any():
        return None, 0
    ys, xs = np.where(dolu)
    kutu = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)

    boy = im.size[0]  # kare tuval korunuyor
    cizim = im.crop(kutu)
    g, y = cizim.size
    olcek = (boy * DOLULUK) / max(g, y)
    yeni = (max(1, round(g * olcek)), max(1, round(y * olcek)))
    cizim = cizim.resize(yeni, Image.LANCZOS)

    tuval = Image.new("RGBA", (boy, boy), (0, 0, 0, 0))
    sol = (boy - yeni[0]) // 2
    ust = boy - round(boy * ALT_PAY) - yeni[1] if taban else (boy - yeni[1]) // 2
    tuval.paste(cizim, (sol, ust))

    # Ne kadar oynadi: taban zaten yerindeyse sifira yakin cikar.
    eski_taban = kutu[3]
    yeni_taban = ust + yeni[1]
    return tuval, yeni_taban - eski_taban


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2

    bak = "--onizleme" in argv
    taban = "--orta" not in argv
    dosyalar = [Path(x) for x in argv if not x.startswith("--")]
    if not dosyalar:
        print("Dosya verilmedi.", file=sys.stderr)
        return 2

    sonuclar = []
    for yol in dosyalar:
        if not yol.exists():
            print(f"  yok: {yol}", file=sys.stderr)
            return 2
        im, kayma = hizala(yol, taban)
        if im is None:
            print(f"  atlandi, saydam degil: {yol.name}")
            continue
        if bak:
            sonuclar.append((yol.name, im))
        else:
            im.save(yol, "WEBP", quality=82, method=6)
        print(f"  {yol.name:22s} taban {kayma:+4d} piksel")

    if bak and sonuclar:
        from PIL import Image

        N, sut = 180, 6
        sat = (len(sonuclar) + sut - 1) // sut
        yan = Image.new("RGB", (N * sut, N * sat), (46, 74, 40))
        for i, (_, im) in enumerate(sonuclar):
            k = im.resize((N, N), Image.LANCZOS)
            yan.paste(k, ((i % sut) * N, (i // sut) * N), k)
        # Zemin cizgisi: tabanlar ayni yerde mi, bir bakista gorunsun.
        from PIL import ImageDraw

        d = ImageDraw.Draw(yan)
        for s in range(sat):
            y = s * N + round(N * (1 - ALT_PAY))
            d.line((0, y, yan.size[0], y), fill=(255, 80, 80), width=1)
        yol = Path("/tmp/sprite-hizalama.png")
        yan.save(yol)
        print(f"\nOnizleme: {yol}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
