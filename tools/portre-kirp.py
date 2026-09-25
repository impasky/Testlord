#!/usr/bin/env python3
"""
Hazır profil resimleri: tam boy figürlerden baş-omuz kırpması.

Oyuncunun isteği: "profil resmi seçme ve yükleme olsun." Seçilecek
portreler zaten oyunda — lord, general ve düşman figürleri. Ama hepsi TAM
BOY ve şeffaf zeminli: sohbette 32 piksellik bir dairede tam boy bir figür
bir çizgiden ibaret. Bu araç her figürün başını bulup kare bir baş-omuz
kırpması çıkarıyor ve oyunun sıcak koyu zeminine oturtuyor.

BAŞ NASIL BULUNUYOR. En üstteki opak piksel baş değil: mızrakçının
mızrağı, şövalyenin sancağı, kültistin asası başın üstüne çıkıyor. Önce
gövdenin ortası bulunuyor (figür yüksekliğinin %30-50 bandındaki opak
piksellerin ortalaması), sonra YALNIZ o dar sütunda en üstteki opak satır
aranıyor. Silahlar gövdenin yanında taşındığı için banda girmiyor.

Kaynak: packages/shared/src/profil.ts `HAZIR_PORTRELER` — liste orada,
bu araç onu okumuyor, aynı klasörleri tarıyor. Yeni figür eklenince araç
yeniden çalıştırılır:

    python3 tools/portre-kirp.py

Çıktı: apps/web/public/gorseller/portre/<anahtar>.webp (160x160).
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

KOK = os.path.join(os.path.dirname(__file__), '..', 'apps', 'web', 'public', 'gorseller')
CIKTI = os.path.join(KOK, 'portre')
BOYUT = 160
KLASORLER = ['lord', 'generaller', 'dusmanlar']
# Düşmanların yalnız şefleri: sıradan eşkıya ile şefi aynı figürün iki
# hâli, seçimde ikisini yan yana görmek kalabalık.
DUSMAN_ONEKI = '_sef'

# Otomatik kırpmanın tutmadığı figürler için elle düzeltme: (x kayması,
# y kayması, ölçek) — kare kenarının oranı olarak.
DUZELTME: dict[str, tuple[float, float, float]] = {}


def zemin(boyut: int) -> Image.Image:
    """Lord ekranındaki sahnenin zemini: ortası sıcak, kenarı koyu."""
    z = Image.new('RGB', (boyut, boyut), (26, 18, 12))
    d = ImageDraw.Draw(z)
    merkez = boyut / 2
    for i in range(boyut // 2, 0, -1):
        t = i / (boyut / 2)
        r = int(58 * (1 - t) + 26 * t)
        g = int(43 * (1 - t) + 18 * t)
        b = int(27 * (1 - t) + 12 * t)
        d.ellipse([merkez - i * 1.25, merkez * 1.1 - i * 1.25, merkez + i * 1.25, merkez * 1.1 + i * 1.25], fill=(r, g, b))
    return z.convert('RGBA')


def bas_kirpmasi(im: Image.Image) -> tuple[int, int, int]:
    """(sol, üst, kenar) — figürün baş-omuz karesi."""
    a = im.getchannel('A')
    w, h = im.size
    px = a.load()
    opak = lambda x, y: px[x, y] > 40  # noqa: E731

    satirlar = [y for y in range(h) if any(opak(x, y) for x in range(0, w, 2))]
    if not satirlar:
        return 0, 0, min(w, h)
    ust, alt = satirlar[0], satirlar[-1]
    boy = alt - ust

    # Gövdenin ortası: figürün %30-50 bandı.
    xs = []
    for y in range(ust + int(boy * 0.30), ust + int(boy * 0.50)):
        xs.extend(x for x in range(0, w, 2) if opak(x, y))
    cx = sum(xs) / len(xs) if xs else w / 2

    # Başın tepesi: yalnız gövde sütununda.
    bant = int(w * 0.08)
    bas = ust
    for y in range(ust, alt):
        if any(opak(x, y) for x in range(max(0, int(cx) - bant), min(w, int(cx) + bant))):
            bas = y
            break

    kenar = int(boy * 0.40)
    sol = int(cx - kenar / 2)
    ust_k = int(bas - kenar * 0.06)
    return sol, ust_k, kenar


def kirp(yol: str, anahtar: str) -> None:
    im = Image.open(yol).convert('RGBA')
    sol, ust, kenar = bas_kirpmasi(im)
    dx, dy, olcek = DUZELTME.get(anahtar, (0.0, 0.0, 1.0))
    kenar = int(kenar * olcek)
    sol += int(dx * kenar)
    ust += int(dy * kenar)
    # Kare görselin dışına taşabilir (baş kenara yakınsa): şeffaf
    # tuvale yapıştırıp oradan kesmek, kırpmayı kaydırmaktan dürüst.
    tuval = Image.new('RGBA', (im.width + 2 * kenar, im.height + 2 * kenar), (0, 0, 0, 0))
    tuval.paste(im, (kenar, kenar))
    parca = tuval.crop((sol + kenar, ust + kenar, sol + 2 * kenar, ust + 2 * kenar)).resize(
        (BOYUT, BOYUT), Image.LANCZOS
    )
    sonuc = zemin(BOYUT)
    sonuc.alpha_composite(parca)
    sonuc.convert('RGB').save(os.path.join(CIKTI, f'{anahtar}.webp'), 'WEBP', quality=82, method=6)


def main() -> int:
    os.makedirs(CIKTI, exist_ok=True)
    n = 0
    for klasor in KLASORLER:
        for ad in sorted(os.listdir(os.path.join(KOK, klasor))):
            if not ad.endswith('.webp'):
                continue
            anahtar = ad[: -len('.webp')]
            if klasor == 'dusmanlar' and not anahtar.endswith(DUSMAN_ONEKI):
                continue
            kirp(os.path.join(KOK, klasor, ad), anahtar)
            n += 1
    print(f'{n} portre -> {os.path.relpath(CIKTI)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
