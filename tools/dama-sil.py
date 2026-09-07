#!/usr/bin/env python3
"""
Lordlar Cagi - Modelin CIZDIGI dama desenini siler, gercek saydamliga cevirir.

SORUN: bina ikonlari "isolated on a fully transparent background" istenerek
uretildi. Model saydamligi anlamadi, ONU CIZDI: gelen goruntude alfa kanali
yok; onun yerine goruntu duzenleyicilerin saydamlik dama deseni (iki tonlu
gri kareler) gercek piksel olarak boyanmis. Ekranda bina, gri bir dama
karesinin uzerinde duruyor.

gorsel-ayikla.py bunu cozemiyor ve cozmemeli:
  - Orasi bir SAYFA BOLUCU: cok figurlu bir tuvali baglantili bilesenlere
    ayirir. Buradaki dosyalarda tek figur var.
  - Zemini kenar MEDYANI ile buluyor. Dama tek renk degil: iki ton ve medyan
    ikisinin ARASINA dusuyor, yani her iki ton da medyandan esik kadar uzak
    kaliyor ve dama "figur" sayiliyor. Esigi buyutmek kurtarmaz: o zaman
    binanin acik gri tas duvarlari da zemin olur.

NEDEN DUZ ESIK YETMIYOR: bir pikselin "iki tondan birine yakin gri" olmasi
zemin oldugunu GOSTERMEZ. arsa.webp'in tonlari 49/96; binanin koyu ahsabi da
tam o araliga dusuyor. Duz esikle bina delik desik oldu, tam ortasindan
yendi.

AYIRT EDICI OLCUT DESEN: dama yerel olarak IKI TONLUDUR. Bir karelik
pencerede alt yuzdelik koyu tona, ust yuzdelik acik tona oturur. Duz bir
yuzey -- rengi ne olursa olsun -- bu testi gecemez, cunku penceresinde tek
ton vardir. Ortalama degil YUZDELIK kullaniliyor: en kucuk/en buyuk piksel,
sikistirma gurultusunun tek bir aykiri degerine takiliyordu (demirhane_1'de
tonlar 68/112 iken pencere en az 60 / en cok 121 veriyordu ve hicbir yer
desen sayilmiyordu).

Sonra desenden BANT icinde SINIRLI yayilma: pencere, binanin cevresinde
yarim kare kalinliginda bir serit birakir (orada pencere binaya degdigi icin
desen testi kalir). O serit iki ton bandi icinde ve desenden sayili adim
uzaklikta doldurulur. Sinirsiz yayilma binanin gri parcalarini ortasina
kadar yerdi.

Tonlar KENAR SERIDINDEN degil DORT KOSEDEN okunuyor: bina ortada duruyor,
koseler damaya kaliyor. Kenar seridi liman_5'te iskeleye denk geldi ve
tonlari 106/142 yerine 104/150 gosterdi -- gercek dama zaten dusuk
karsitliktaydi (aradaki fark 16), o kadar sapma butun bandi kaydirmaya
yetiyordu.

KULLANIM:
  python3 tools/dama-sil.py apps/web/public/gorseller/binalar/*.webp
  python3 tools/dama-sil.py --onizleme apps/web/public/gorseller/binalar/*.webp

--onizleme yazmadan bir kontak sayfasi uretir (/tmp/dama-onizleme.png):
her gorselin ustte magenta zeminli hali (artan dama da yenen parca da ayni
anda gorunur), altta alfa maskesi. Dosyalarin uzerine yazmadan once
BAKILMASI gereken sey bu.
"""
from __future__ import annotations

import sys
from pathlib import Path

GRI_ESIK = 14      # R-G-B yayilimi bundan buyukse piksel renkli: dama degil
KOSE = 32          # ton olcumu icin kose karesinin boyu
EN_KISA, EN_UZUN = 4, 20   # aranan dama periyodu araligi (piksel)
MIN_TON_ARASI = 10 # iki ton bundan yakinsa desen okunamaz, dosya atlanir
MAX_DELIK = 400    # binanin icinde bu kadar kucuk saydam adacik kapatilir
MIN_PARCA = 150    # bu kadar kucuk kopuk on-plan parcalari atilir
YUMUSAK = 1.0      # alfa kenarinin bulanikligi (piksel)


def _tonlar(a):
    """
    (koyu, acik, kullanilan kose sayisi). Bina ortada, koseler damada.

    Kose yerine butun kenar seridi kullanilsaydi binanin cerceveye degdigi
    yerler olcume karisirdi. Bir kose de binaya denk gelebilir; gri olmayan
    ya da karsitligi olmayan kareler eleniyor, kalanlarin medyani aliniyor.
    """
    import numpy as np

    kareler = [a[:KOSE, :KOSE], a[:KOSE, -KOSE:], a[-KOSE:, :KOSE], a[-KOSE:, -KOSE:]]
    alt, ust = [], []
    for kare in kareler:
        g = kare.reshape(-1, 3)
        gri = (g.max(axis=1) - g.min(axis=1)) <= GRI_ESIK
        if gri.mean() < 0.9:
            continue
        v = g[gri].mean(axis=1)
        a10, a90 = np.percentile(v, 10), np.percentile(v, 90)
        if a90 - a10 < MIN_TON_ARASI:
            continue
        alt.append(a10)
        ust.append(a90)
    if not alt:
        return None
    return float(np.median(alt)), float(np.median(ust)), len(alt)


def _periyot(a) -> int:
    """
    Damanin periyodunu (iki kare) olcer.

    Kenar cizgilerinin kendileriyle kaydirmali farki alinir; desen kendi
    periyodu kadar kaydiginda fark dibe vurur. Serit degil TEK CIZGI
    okunuyor: dort satirin ortalamasi, kare boyu dorde yakin oldugunda iki
    fazi birbirine goturup duz bir iz birakiyordu (liman_5'te desen hic
    gorunmedi). EN KUCUK dip aliniyor, en derini degil: periyodun kati da
    ayni derinlikte dip verir ve pencereyi gereksiz buyutur.
    """
    import numpy as np

    v = a.mean(axis=2)
    puanlar = []
    for f in (v[1], v[-2], v[:, 1], v[:, -2]):
        f = f - f.mean()
        if np.abs(f).mean() < 3:      # duz cizgi: desen bilgisi tasimiyor
            continue
        d = np.array([np.abs(f[:-p] - f[p:]).mean() for p in range(EN_KISA, EN_UZUN)])
        puanlar.append(d / np.abs(f).mean())
    if not puanlar:
        return 12
    d = np.mean(puanlar, axis=0)
    return EN_KISA + int(np.argmax(d <= d.min() * 1.3))


def maske_uret(a):
    """(bina maskesi, tonlar, periyot). Maske None ise dosyada dama yok."""
    import numpy as np
    from scipy import ndimage

    olculen = _tonlar(a)
    if olculen is None:
        return None, None, 0
    koyu, acik, _ = olculen
    p = _periyot(a)
    pen = p + 3
    # Tolerans tonlarin arasina gore: liman_5'in damasi 16 basamak, malikane_5'inki
    # 59. Sabit tolerans, dusuk karsitlikli damada butun binayi bandin icine alir.
    tol = float(np.clip(0.4 * (acik - koyu), 8, 18))

    v = a.mean(axis=2)
    gri = (a.max(axis=2) - a.min(axis=2)) <= GRI_ESIK
    alt = ndimage.percentile_filter(v, 15, size=pen)
    ust = ndimage.percentile_filter(v, 85, size=pen)

    desen = gri & (np.abs(alt - koyu) <= tol) & (np.abs(ust - acik) <= tol)
    if not desen.any():
        return None, (koyu, acik), p
    bant = gri & (v >= koyu - tol) & (v <= acik + tol)
    zemin = ndimage.binary_dilation(desen, mask=bant, iterations=pen // 2 + 2)

    maske = ~zemin

    # Binanin ICINDE kalan kucuk saydam adaciklar kapatilir; kemere ya da
    # pencereye denk gelen GERCEK delikler (cerceveye kadar uzanan ya da
    # buyuk olanlar) birakilir.
    etiket, adet = ndimage.label(zemin)
    if adet:
        cerceve = set(etiket[0]) | set(etiket[-1]) | set(etiket[:, 0]) | set(etiket[:, -1])
        alanlar = ndimage.sum(zemin, etiket, range(1, adet + 1))
        kapat = [i + 1 for i, al in enumerate(alanlar)
                 if al < MAX_DELIK and (i + 1) not in cerceve]
        if kapat:
            maske |= np.isin(etiket, kapat)

    # Zeminde asili kalan kucuk parcalar (modelin serpistirdigi lekeler).
    etiket, adet = ndimage.label(maske)
    if adet:
        alanlar = ndimage.sum(maske, etiket, range(1, adet + 1))
        esik = max(MIN_PARCA, 0.02 * max(alanlar))
        at = [i + 1 for i, al in enumerate(alanlar) if al < esik]
        if at:
            maske &= ~np.isin(etiket, at)

    return maske, (koyu, acik), p


def zaten_saydam(yol: Path) -> bool:
    """
    Dosya daha once ayiklandi mi?

    Bu kontrol sart: alfa aciliyor ama DAMA RGB'DE DURUYOR (saydam
    piksellerin altindaki renk silinmiyor, kucultmedeki hale gri kalsin
    diye). convert("RGB") alfayi atinca dama geri gelir, arac desenini
    yeniden bulur ve ikinci bir maske uretir -- ikinci calistirmada
    malikane_5 %45'ten %83'e cikti, yani temiz cikti bozuldu.
    """
    from PIL import Image

    im = Image.open(yol)
    if im.mode not in ("RGBA", "LA", "P"):
        return False
    alfa = im.convert("RGBA").getchannel("A")
    return alfa.getextrema()[0] < 250


def isle(yol: Path):
    """(RGBA gorsel, bina piksel orani, tonlar, periyot); dama yoksa None."""
    import numpy as np
    from PIL import Image, ImageFilter

    ham = Image.open(yol).convert("RGB")
    a = np.asarray(ham).astype(int)
    maske, tonlar, p = maske_uret(a)
    if maske is None:
        return None, 0.0, tonlar, p

    # Sert kesim, boyanmis bir illustrasyonun yaninda makasla kesilmis duruyor.
    alfa = Image.fromarray((maske * 255).astype("uint8"))
    alfa = alfa.filter(ImageFilter.GaussianBlur(YUMUSAK))
    im = ham.convert("RGBA")
    im.putalpha(alfa)
    return im, float(maske.mean()), tonlar, p


def onizleme(sonuclar, yol: Path):
    from PIL import Image

    N, sut = 200, 6
    sat = (len(sonuclar) + sut - 1) // sut
    yan = Image.new("RGB", (N * sut, N * 2 * sat), (255, 0, 255))
    for i, (_, im) in enumerate(sonuclar):
        k = im.resize((N, N), Image.LANCZOS)
        x, y = (i % sut) * N, (i // sut) * N * 2
        yan.paste(k, (x, y), k)
        yan.paste(k.getchannel("A").convert("RGB"), (x, y + N))
    yan.save(yol)
    return yol


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2

    bak = "--onizleme" in argv
    dosyalar = [Path(x) for x in argv if not x.startswith("--")]
    if not dosyalar:
        print("Dosya verilmedi.", file=sys.stderr)
        return 2

    sonuclar, atlanan = [], 0
    for yol in dosyalar:
        if not yol.exists():
            print(f"  yok: {yol}", file=sys.stderr)
            return 2
        if zaten_saydam(yol):
            print(f"  atlandi, zaten saydam: {yol.name}")
            atlanan += 1
            continue
        im, oran, tonlar, p = isle(yol)
        if im is None:
            ton = f" (tonlar {tonlar[0]:.0f}/{tonlar[1]:.0f})" if tonlar else ""
            print(f"  atlandi, dama bulunamadi: {yol.name}{ton}")
            atlanan += 1
            continue
        if bak:
            sonuclar.append((yol.name, im))
        else:
            im.save(yol, "WEBP", quality=82, method=6)
        print(f"  {yol.name:22s} ton {tonlar[0]:3.0f}/{tonlar[1]:3.0f}  "
              f"periyot {p:2d}  -> bina %{oran * 100:.0f}")

    if bak and sonuclar:
        print(f"\nOnizleme: {onizleme(sonuclar, Path('/tmp/dama-onizleme.png'))}")
    if atlanan:
        print(f"\n{atlanan} dosya atlandi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
