#!/usr/bin/env python3
"""
Lordlar Cagi - Dunya zemininden KARA CIZGISI uretir.

NEDEN VAR: dunya haritasi artik nokta degil TOPRAK haritasi (docs/23).
Her bolge bir Voronoi hucresi ve hucreler karaya KIRPILIYOR: denize
tasan bir toprak hem yanlis gorunuyor hem de denize dokunan parmak bir
kiyi bolgesini seciyordu. Kirpma cizgisi zeminin kendisinden cikiyor,
elle cizilmiyor -- zemin degisirse bu arac yeniden calistirilir.

YONTEM
  1. Kara maskesi `harita-arazi.py`den (sicaklik R-B).
  2. Deniz yalniz BUYUK su: gol, bataklik gozu ve koyu orman lekesi
     toprak delmesin. Kucuk su parcalari karaya katiliyor.
  3. Kontur PIKSEL KENARLARINDAN izleniyor (her kara pikselinin denize
     bakan kenari); kenarlar ucuca eklenip kapali halkalar oluyor.
  4. Merdiven basamaklari Douglas-Peucker ile sadelestiriliyor.
  5. Koordinatlar 0-100 uzayina cevriliyor -- bolgelerin x/y'siyle ayni.

Cikti uretilmis bir TS modulu: `apps/web/src/components/harita/kara.ts`.
Elle duzenlenmez; zemin degisince:

  python3 tools/harita-kara.py
  npx prettier --write apps/web/src/components/harita/kara.ts
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "apps" / "web" / "src" / "components" / "harita" / "kara.ts"

# Maske cozunurlugu. Kirpma cizgisi icin 512 yeterli: dunya ekranda en
# yakinda ~1250 CSS piksel, yani bir maske pikseli ~2,5 piksel -- ve
# sadelestirme zaten bundan kaba.
N = 512
# Douglas-Peucker toleransi (maske pikseli). 0,9: basamaklar gidiyor,
# kiyinin girintisi kaliyor.
TOLERANS = 0.9
# Bundan kucuk su parcasi DENIZ degil (dunya alaninin orani).
EN_KUCUK_DENIZ = 0.004
# Bundan kucuk kara parcasi cizilmiyor (ada degil, gurultu).
EN_KUCUK_ADA = 0.0006


def maske():
    import numpy as np
    from PIL import Image
    from scipy import ndimage

    spec = importlib.util.spec_from_file_location("arazi", KOK / "tools" / "harita-arazi.py")
    arazi = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(arazi)
    _, kara = arazi.arazi_oku()
    kara = np.asarray(Image.fromarray(kara.astype(np.uint8) * 255).resize((N, N), Image.NEAREST)) > 0

    su, n = ndimage.label(~kara)
    alan = ndimage.sum(np.ones_like(su), su, range(1, n + 1))
    deniz = np.isin(su, [i + 1 for i, a in enumerate(alan) if a > EN_KUCUK_DENIZ * N * N])
    kara = ndimage.binary_opening(~deniz, iterations=2)

    parca, n = ndimage.label(kara)
    alan = ndimage.sum(np.ones_like(parca), parca, range(1, n + 1))
    return np.isin(parca, [i + 1 for i, a in enumerate(alan) if a > EN_KUCUK_ADA * N * N])


def halkalar(kara):
    """
    Kara ile denizin arasindaki piksel kenarlarindan kapali halkalar.

    Her kenar YONLU: kara hep solda kaliyor. Bu sayede bir kosede iki
    kenar bulusunca (capraz dokunan iki piksel) hangisinin devam ettigi
    belli -- sola donen tercih ediliyor ve halka kendini kesmiyor.
    """
    import numpy as np

    h, w = kara.shape
    dolu = np.zeros((h + 2, w + 2), bool)
    dolu[1:-1, 1:-1] = kara
    cikis: dict[tuple[int, int], list[tuple[int, int]]] = {}

    def ekle(a, b):
        cikis.setdefault(a, []).append(b)

    ys, xs = np.nonzero(kara)
    for y, x in zip(ys.tolist(), xs.tolist()):
        yy, xx = y + 1, x + 1
        # Kose koordinatlari (x, y); kara solda kalacak yonde.
        if not dolu[yy - 1, xx]:
            ekle((x + 1, y), (x, y))  # ust kenar: saga-sola
        if not dolu[yy + 1, xx]:
            ekle((x, y + 1), (x + 1, y + 1))  # alt kenar
        if not dolu[yy, xx - 1]:
            ekle((x, y), (x, y + 1))  # sol kenar
        if not dolu[yy, xx + 1]:
            ekle((x + 1, y + 1), (x + 1, y))  # sag kenar

    sonuc = []
    while cikis:
        bas = next(iter(cikis))
        halka = [bas]
        onceki = None
        simdiki = bas
        while True:
            adaylar = cikis.get(simdiki)
            if not adaylar:
                break
            if len(adaylar) == 1 or onceki is None:
                sonraki = adaylar[0]
            else:
                # Sola donen: gelis yonune gore capraz carpim.
                gx, gy = simdiki[0] - onceki[0], simdiki[1] - onceki[1]
                sonraki = max(
                    adaylar,
                    key=lambda p: gx * (p[1] - simdiki[1]) - gy * (p[0] - simdiki[0]),
                )
            adaylar.remove(sonraki)
            if not adaylar:
                del cikis[simdiki]
            onceki, simdiki = simdiki, sonraki
            if simdiki == bas:
                break
            halka.append(simdiki)
        if len(halka) >= 8:
            sonuc.append(halka)
    return sonuc


def sadelestir(nokta, tolerans):
    """Douglas-Peucker, kapali halka icin: en uzak iki noktadan boluyor."""
    import numpy as np

    p = np.asarray(nokta, float)

    def dp(a):
        if len(a) < 3:
            return a
        bas, son = a[0], a[-1]
        d = son - bas
        uz = np.hypot(*d)
        if uz == 0:
            mes = np.hypot(*(a - bas).T)
        else:
            mes = np.abs(d[0] * (a[:, 1] - bas[1]) - d[1] * (a[:, 0] - bas[0])) / uz
        i = int(np.argmax(mes))
        if mes[i] <= tolerans:
            return np.array([bas, son])
        return np.vstack([dp(a[: i + 1])[:-1], dp(a[i:])])

    k = int(np.argmax(np.hypot(*(p - p[0]).T)))
    yari1 = dp(np.vstack([p[: k + 1]]))
    yari2 = dp(np.vstack([p[k:], p[:1]]))
    return np.vstack([yari1[:-1], yari2[:-1]])


def main() -> int:
    kara = maske()
    yollar = []
    nokta_sayisi = 0
    for halka in halkalar(kara):
        s = sadelestir(halka, TOLERANS)
        if len(s) < 4:
            continue
        nokta_sayisi += len(s)
        olc = 100 / N
        parca = " ".join(f"{x * olc:.2f} {y * olc:.2f}" for x, y in s)
        yollar.append(f"M{parca}Z")

    icerik = (
        "/**\n"
        " * KARA ÇİZGİSİ — ÜRETİLMİŞ DOSYA, elle düzenlenmez.\n"
        " *\n"
        " * `python3 tools/harita-kara.py` dünya zemininden (dunya.webp) çıkarıyor.\n"
        " * Toprak hücreleri bununla kırpılıyor: denize taşmıyor, denize dokunan\n"
        " * parmak bir kıyı bölgesini seçmiyor (docs/23). Koordinatlar bölgelerin\n"
        " * x/y'siyle aynı 0–100 uzayında.\n"
        " */\n"
        f"export const KARA_YOLU = {' + '.join(repr(y) for y in yollar) or repr('')};\n"
    )
    CIKTI.parent.mkdir(parents=True, exist_ok=True)
    CIKTI.write_text(icerik, encoding="utf-8")
    print(f"{len(yollar)} kara parçası, {nokta_sayisi} nokta, {len(icerik) // 1024} KB -> {CIKTI.relative_to(KOK)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
