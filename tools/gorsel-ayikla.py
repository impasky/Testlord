#!/usr/bin/env python3
"""
Lordlar Cagi - Sayfa halindeki gorselleri tek tek varliklara ayirir.

Gorsel ureten araclar istenen 5 gorseli cogu zaman tek bir "sayfa" olarak
dondurur. Bu script sayfayi alir, figurleri bulur, her birini kendi dosyasina
512x512 saydam zeminli WebP olarak yazar.

Neden dikdortgen kesim degil de baglantili bilesen:
  Figurler dikey bir cizgiyle ayrilmiyor - suvarinin mizragi mancinigin sol
  ayaginin ustunden geciyor. Kesim kutusu her iki nesneden de parca tasirdi.
  Bilesen maskesi her pikseli sahibine baglar, komsunun kutusuna tasan
  parcalari zemine boyar.

Ayrica modeller bos zemine kopuk parcalar serpistiriyor (havada duran bir
mizrak ucu gibi). Kucuk ve hicbir figure degmeyen bilesenler atilir.

KULLANIM:
  python3 tools/gorsel-ayikla.py sayfa.png birimler milis mizrakci okcu suvari kusatma
  python3 tools/gorsel-ayikla.py sayfa.png --onizleme      # yazmadan, kontak sayfasi uret
  python3 tools/gorsel-ayikla.py sayfa.png --pano bolgeler tarla maden sehir kale taht
  python3 tools/gorsel-ayikla.py sayfa.png --onizleme --esik 45

Isimler okuma sirasinda verilir: once ustten alta satirlar, her satirda
soldan saga. Script bulduklarini sayip isim sayisiyla karsilastirir;
tutmuyorsa hicbir sey yazmaz, ne buldugunu soyler.

IKI KIP:
  varsayilan  Figurler icin. Zemin saydam birakilir, figur kare tuvale
              ortalanir. Birimler ve generaller boyle.
  --pano      Dikdortgen illustrasyonlar icin. Bolgeler cerceveyi dolduran
              manzaralar; saydamligin anlami yok, karta bosluk birakmadan
              oturmalari gerekiyor. Kutu panonun gercek dikdortgenine
              oturtulur ve kareye KIRPILIR (doldurulmaz).

Cikti: apps/web/public/gorseller/<klasor>/<ad>.webp
"""
from __future__ import annotations

import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "apps" / "web" / "public" / "gorseller"

ESIK = 30          # figurleri BIRBIRINDEN ayirmak icin: yuksek tutulur
ESIK_ALFA = 10     # figurun KENDI sinirini bulmak icin: dusuk tutulur
BUYUME = 30        # dusuk esige dogru en fazla bu kadar piksel buyunur
MAX_DELIK = 400    # bu piksel sayisindan kucuk ic delikler kapatilir
MIN_ALAN = 0.005   # bu orandan kucuk bilesenler figur degil (golge, toz, kopuk parca)
YAPISMA = 25       # bir figure bu kadar yakin kucuk parca ona aittir
MARJ = 0.04        # kare tuvalde kenar boslugu
BOYUT = 512


def _zemin_rengi(a):
    import numpy as np
    kenar = np.concatenate([
        a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
        a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3),
    ])
    return np.median(kenar, axis=0)


def _kucuk_delikleri_kapat(m):
    """
    Figurun icindeki ignedeligi boyutundaki bosluklari kapatir, gercek
    delikleri birakir.

    binary_fill_holes burada kullanilamaz: yayin ici, mancinigin ucgen
    cerceve bosluklari ve atin bacaklari arasi da "delik" sayilir ve koyu
    lekelerle dolar. Acik bir zemine kondugunda bu hemen goze carpiyor.
    Bu yuzden sadece MAX_DELIK'ten kucuk kapali bosluklar doldurulur.
    """
    import numpy as np
    from scipy import ndimage

    bos = ~m
    etiket, adet = ndimage.label(bos)
    if adet == 0:
        return m
    # Kenara degen bosluk = disaridaki zemin, asla doldurulmaz
    kenar = set(etiket[0]) | set(etiket[-1]) | set(etiket[:, 0]) | set(etiket[:, -1])
    alanlar = ndimage.sum(bos, etiket, range(1, adet + 1))
    doldur = [i + 1 for i, al in enumerate(alanlar)
              if al < MAX_DELIK and (i + 1) not in kenar]
    if doldur:
        m = m | np.isin(etiket, doldur)
    return m


def bilesenleri_bul(a, esik: int):
    """Sayfadaki figurleri bulur; her figur icin (kutu, maske) doner."""
    import numpy as np
    from scipy import ndimage

    zemin = _zemin_rengi(a)
    dolu = np.abs(a - zemin).sum(axis=2) > esik
    dolu = ndimage.binary_closing(dolu, structure=np.ones((5, 5)))

    etiket, adet = ndimage.label(dolu)
    alanlar = ndimage.sum(dolu, etiket, range(1, adet + 1))
    esik_alan = a.shape[0] * a.shape[1] * MIN_ALAN

    buyuk = [i + 1 for i, al in enumerate(alanlar) if al >= esik_alan]
    kucuk = [i + 1 for i, al in enumerate(alanlar) if al < esik_alan]

    # Her figuru kendi maskesiyle basla, sonra degen kucuk parcalari topla
    maskeler = {i: (etiket == i) for i in buyuk}
    komsu = {i: ndimage.binary_dilation(m, iterations=YAPISMA)
             for i, m in maskeler.items()}
    for k in kucuk:
        km = etiket == k
        for i in buyuk:
            if (km & komsu[i]).any():
                maskeler[i] = maskeler[i] | km
                break
        # hicbirine degmiyorsa: kopuk parca, atilir

    # Iki esik gerekiyor, cunku tek esik iki isi birden yapamiyor:
    #
    #   Yuksek esik figurleri birbirinden ayirir ama figurun kendi koyu
    #   bolgelerini (cizmeler, at bacaklari, golgede kalan kumas) disarida
    #   birakir - acik zeminde bakinca siluetin alti kemirilmis gorunur.
    #   Dusuk esik sinirlari dogru bulur ama komsu figurleri birbirine
    #   yapistirir.
    #
    # Cozum: kimlik yuksek esikten, sinir dusuk esikten. Her figur kendi
    # maskesinden baslayip dusuk esik icinde sinirli sayida adim buyur;
    # komsularin pikselleri buyumeye kapatilir ki tasma olmasin.
    dusuk = np.abs(a - zemin).sum(axis=2) > ESIK_ALFA
    buyumus = {}
    for i, mk in maskeler.items():
        baskasi = np.zeros_like(mk)
        for j, mj in maskeler.items():
            if j != i:
                baskasi |= mj
        izin = dusuk & ~ndimage.binary_dilation(baskasi, iterations=2)
        b = ndimage.binary_dilation(mk, mask=izin | mk, iterations=BUYUME)
        buyumus[i] = _kucuk_delikleri_kapat(b)

    sonuc = []
    for i, mk in buyumus.items():
        ys, xs = np.where(mk)
        sonuc.append(((int(xs.min()), int(ys.min()),
                       int(xs.max()) + 1, int(ys.max()) + 1), mk))
    return sonuc, zemin


def pano_kutusu(maske, kutu):
    """
    Dikdortgen panonun gercek sinirini bulur.

    Bilesen kutusu panodan tasan seyleri de iceriyor: uretici araclarin
    kose filigrani panonun disina sarkiyor ve kutuyu birkac piksel
    buyutuyor. Pano dolu bir dikdortgen oldugu icin, satir ve sutunlarin
    en az %80'i dolu olanlari tutmak tasmayi kesiyor.
    """
    import numpy as np

    x0, y0, x1, y1 = kutu
    m = maske[y0:y1, x0:x1]
    sat = m.sum(axis=1) >= 0.8 * m.shape[1]
    sut = m.sum(axis=0) >= 0.8 * m.shape[0]
    ys, xs = np.nonzero(sat)[0], np.nonzero(sut)[0]
    if not len(ys) or not len(xs):
        return kutu
    return (x0 + int(xs[0]), y0 + int(ys[0]),
            x0 + int(xs[-1]) + 1, y0 + int(ys[-1]) + 1)


def pano_yap(a, kutu, maske):
    """Panoyu kesip kare olacak sekilde ortadan kirpar, opak birakir."""
    from PIL import Image

    x0, y0, x1, y1 = pano_kutusu(maske, kutu)
    im = Image.fromarray(a[y0:y1, x0:x1].astype("uint8"))
    g, y = im.size
    k = min(g, y)
    im = im.crop(((g - k) // 2, (y - k) // 2, (g + k) // 2, (y + k) // 2))
    return im.resize((BOYUT, BOYUT), Image.LANCZOS)


def okuma_sirasi(bilesenler):
    """Ustten alta satirlara ayirir, her satiri soldan saga sirlar."""
    kalan = sorted(bilesenler, key=lambda b: b[0][1])
    satirlar = []
    for b in kalan:
        (x0, y0, x1, y1) = b[0]
        for s in satirlar:
            sy0 = min(k[0][1] for k in s)
            sy1 = max(k[0][3] for k in s)
            ortak = min(y1, sy1) - max(y0, sy0)
            if ortak > 0.5 * min(y1 - y0, sy1 - sy0):
                s.append(b)
                break
        else:
            satirlar.append([b])
    sirali = []
    for s in satirlar:
        sirali += sorted(s, key=lambda b: b[0][0])
    return sirali


def kare_yap(a, kutu, maske, zemin):
    """
    Figuru kesip saydam zeminli kare bir tuvale oturtur.

    Zemin neden saydam: birim madalyonu kartin icinde oyuk bir cukur olarak
    cizilmis. Opak koyu bir kare o dokuyu tamamen ortuyor ve sayfanin
    koyusuyla birebir tutmadigi icin cerceve gibi duruyordu.

    Alfa, esikten degil bilesen maskesinden uretilir - esikten uretilse
    figurun kendi koyu bolgeleri (cizmeler, golgeler) de saydam olurdu.
    Maske kenari 1.2 pikselle yumusatilir; sert kesim, boyanmis bir
    illustrasyonun yaninda makasla kesilmis gibi duruyor.

    Saydam piksellerin RGB'si zemin rengi olarak birakilir: kucultmede
    olusabilecek halo, sayfanin koyusuyla ayni tonda kalir.
    """
    import numpy as np
    from PIL import Image, ImageFilter
    from scipy import ndimage

    x0, y0, x1, y1 = kutu
    parca = a[y0:y1, x0:x1].copy()
    ait = ndimage.binary_dilation(maske[y0:y1, x0:x1], iterations=3)
    parca[~ait] = zemin                     # komsu figurlerin tasan parcalari

    alfa = Image.fromarray((ait * 255).astype("uint8"))
    alfa = alfa.filter(ImageFilter.GaussianBlur(1.2))

    g, y = x1 - x0, y1 - y0
    kenar = int(max(g, y) * (1 + 2 * MARJ))
    ust = Image.fromarray(parca.astype("uint8")).convert("RGBA")
    ust.putalpha(alfa)

    tuval = Image.new("RGBA", (kenar, kenar),
                      tuple(int(v) for v in zemin) + (0,))
    tuval.paste(ust, ((kenar - g) // 2, (kenar - y) // 2), ust)
    return tuval.resize((BOYUT, BOYUT), Image.LANCZOS)


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2

    import numpy as np
    from PIL import Image

    sayfa = Path(argv[0])
    onizleme = "--onizleme" in argv
    pano = "--pano" in argv
    esik = ESIK
    if "--esik" in argv:
        esik = int(argv[argv.index("--esik") + 1])
    kalan = [x for x in argv[1:] if not x.startswith("--") and not x.isdigit()]
    klasor = kalan[0] if kalan and not onizleme else None
    adlar = kalan[1:] if klasor else []

    if not sayfa.exists():
        print(f"Sayfa bulunamadi: {sayfa}", file=sys.stderr)
        return 2

    a = np.asarray(Image.open(sayfa).convert("RGB")).astype(int)
    bilesenler, zemin = bilesenleri_bul(a, esik)
    bilesenler = okuma_sirasi(bilesenler)
    print(f"{len(bilesenler)} figur bulundu (esik {esik}):")
    for i, (kutu, _) in enumerate(bilesenler):
        print(f"  {i+1}. x{kutu[0]}-{kutu[2]} y{kutu[1]}-{kutu[3]}")

    if onizleme:
        N = 360
        yan = Image.new("RGB", (N * len(bilesenler), N), (70, 30, 30))
        for i, (kutu, mk) in enumerate(bilesenler):
            if pano:
                yan.paste(pano_yap(a, kutu, mk).resize((N, N)), (i * N, 0))
            else:
                kare = kare_yap(a, kutu, mk, zemin).resize((N, N))
                yan.paste(kare, (i * N, 0), kare)
        yol = sayfa.parent / "onizleme.png"
        yan.save(yol)
        print(f"\nOnizleme: {yol}")
        return 0

    if len(adlar) != len(bilesenler):
        print(f"\n{len(bilesenler)} figur bulundu ama {len(adlar)} isim verildi.",
              file=sys.stderr)
        print("Isimler okuma sirasinda olmali: ustten alta, her satirda soldan saga.",
              file=sys.stderr)
        print("Esigi --esik ile degistirmeyi dene, ya da --onizleme ile bak.",
              file=sys.stderr)
        return 1

    (CIKTI / klasor).mkdir(parents=True, exist_ok=True)
    for (kutu, mk), ad in zip(bilesenler, adlar):
        yol = CIKTI / klasor / f"{ad}.webp"
        gorsel = pano_yap(a, kutu, mk) if pano else kare_yap(a, kutu, mk, zemin)
        gorsel.save(yol, "WEBP", quality=82, method=6)
        print(f"  yazildi: {klasor}/{ad}.webp  ({yol.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
