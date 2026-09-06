#!/usr/bin/env python3
"""
PWA simgelerini üretir.

Neden kodla, elle çizilmiş bir dosyayla değil: simge, `index.html`
içindeki satır içi SVG favicon'un ta kendisi — aynı kalkan ve aynı çatı
işareti. İkisini ayrı ayrı çizmek, birini değiştirip diğerini unutmaya
açık kapı bırakırdı. Bu betik tek kaynaktan üçünü de basıyor.

Maskeli sürüm ayrı: Android simgeyi daire, kare ya da damla şeklinde
kırpıyor ve işaret kenara yakınsa kesiliyor. Maskelide işaret %60'a
küçültülüp ortalanıyor (güvenli alan kuralı).

    python3 tools/simge-uret.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

CIKTI = Path("apps/web/public")

# index.html'deki favicon ile AYNI renkler.
ZEMIN = (23, 16, 12, 255)   # #17100c
ISARET = (212, 162, 76, 255)  # #d4a24c


def cizim(boy: int, oran: float) -> Image.Image:
    """Kalkan zemini + çatı işareti. `oran`: işaretin kapladığı pay."""
    g = Image.new("RGBA", (boy, boy), ZEMIN)
    d = ImageDraw.Draw(g)

    # Köşeleri yuvarlat: maskesiz kullanımda kare bir blok gibi durmasın.
    if oran > 0.75:
        yari = Image.new("L", (boy, boy), 0)
        ImageDraw.Draw(yari).rounded_rectangle(
            [0, 0, boy - 1, boy - 1], radius=int(boy * 0.19), fill=255
        )
        g.putalpha(yari)
        d = ImageDraw.Draw(g)

    # Çatı/kale işareti: index.html'deki path'in aynısı, ölçeklenmiş.
    # Orijinal 32x32 kutuda: M6 12l4 3 6-8 6 8 4-3v11H6z
    b = boy * oran
    ox = (boy - b) / 2
    oy = (boy - b) / 2
    n = lambda x, y: (ox + b * x / 32, oy + b * y / 32)  # noqa: E731
    d.polygon(
        [n(6, 12), n(10, 15), n(16, 7), n(22, 15), n(26, 12), n(26, 25), n(6, 25)],
        fill=ISARET,
    )
    return g


def main() -> None:
    CIKTI.mkdir(parents=True, exist_ok=True)
    isler = [
        ("simge-192.png", 192, 0.92),
        ("simge-512.png", 512, 0.92),
        # Maskeli: Android kırpması işaretin kenarını yemesin.
        ("simge-maskeli-512.png", 512, 0.60),
    ]
    for ad, boy, oran in isler:
        cizim(boy, oran).save(CIKTI / ad)
        print(f"  {ad}  {boy}x{boy}")
    print(f"{len(isler)} simge yazıldı: {CIKTI}")


if __name__ == "__main__":
    main()
