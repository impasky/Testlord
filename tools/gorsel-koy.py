#!/usr/bin/env python3
"""
Elle uretilmis gorselleri oyuna alir.

Sohbete atilan gorseller ham geliyor: orani tutmuyor, filigranli, buyuk ve
her biri baska bir zeminin ustunde. Bu script adimlari tek yerde toplar ki
her partide ayni islem elle tekrarlanmasin (ve biri unutulmasin):

  1. Filigran temizligi  - araclarin bir kosesine koydugu isaret. Oyunun
                           icinde baska bir urunun isaretini tasimiyoruz.
  2. Zemin ayiklama      - sadece ekipmanda, varsayilan acik. Asagiya bak.
  3. Orana kirpma        - KATEGORI[<kategori>]["boyut"] neyse ona.
  4. WebP kaydi          - gorsel-uret.py'nin kaydet()'i ile, ayni kalitede.

Kirpma ve kayit gorsel-uret.py'den ODUNC ALINIYOR, kopyalanmiyor: kategori
boyutu degisirse elle eklenen gorseller de otomatik uyar.

ZEMIN AYIKLAMA NEDEN SADECE EKIPMANDA
  Birim ve general gorselleri arayuzde cerceveli birer PORTRE; koyu duz
  zemin orada dogru duruyor ve zaten hepsi ayni oturumda uretildigi icin
  ayni zemini paylasiyor.
  Ekipman baska: envanterde otuz ikon YAN YANA diziliyor ve her biri ayri
  uretiliyor. Uretici her seferinde biraz baska bir zemin veriyor (biri
  yesilimsi, biri neredeyse siyah, biri sicak kahve) ve bu kutucuklarda
  yamali bir izgara olarak goze batiyor. Zemin ayiklaninca arayuzun kendi
  oyugu gorunuyor, otuzu da ayni kutuda duruyor.

  Ayiklama, olculen zemin rengine yakin VE goruntu kenarina BAGLI
  piksellerdir. Baglilik sarti onemli: koyu bir agzin icindeki daha da
  koyu oluk zemin rengine yakin ama kenara bagli degil, o yuzden kaliyor.

  SINIR: zemin tek bir renk olarak modelleniyor. Guclu bir vinyet ya da
  degisken bir gradyan varsa uzak ucu esigin disinda kalir ve zeminin bir
  kismi silinmeden durur. Uretilen ikon zeminleri neredeyse duz oldugu
  icin pratikte sorun cikarmiyor; ciktigi yerde --esik ile buyutmek ya da
  --zemin-tut ile hic dokunmamak dogru cevap. Sonucu her zaman gozle
  kontrol et - bu bir "sihirli temizleme" degil.

KULLANIM:
  python3 tools/gorsel-koy.py <kategori> <ad>=<dosya> [<ad>=<dosya> ...]
  python3 tools/gorsel-koy.py zeminler malikane=/yol/1.png kisla=/yol/2.png
  python3 tools/gorsel-koy.py ekipman silah_t1=/yol/a.png silah_t2=/yol/b.png

  --filigran sol,ust,sag,alt   isaretin yeri (oran ya da piksel).
                               Varsayilan: hicbir sey silinmez.
  --tam-ayna                   filigran yamasini tum goruntunun aynasindan
                               al. Simetrik sahnelerde (sutunlu salon)
                               dikissiz; simetrik olmayanda yanlis icerik
                               tasir, orada varsayilan yerel yansima dogru.
                               Zemin ayiklamayi da aynalamaya dondurur.

Filigran nasil siliniyor, zemin ayiklamaya bagli:
  zemin ayiklaniyorsa  kutu cevresindeki ZEMIN RENGIYLE doldurulur ve
                       ayiklamayla birlikte tamamen gider.
  ayiklanmiyorsa       komsu seridin yatay aynasiyla yamalanir.
  --zemin-sil / --zemin-tut    ayiklamayi acikca ac/kapat. Varsayilan:
                               ekipmanda acik, digerlerinde kapali.
  --esik <sayi>                zemin rengine uzaklik esigini elle ver.
                               Varsayilan: goruntunun dis cercevesinden
                               OLCULUR. Elle vermek sadece olcum yaniltiyorsa
                               gerekir (konu kenara degiyorsa gibi).
"""
from __future__ import annotations

import importlib.util
import sys
from io import BytesIO
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent

# Zemin esigi SABIT DEGIL, zeminin kendi degiskenliginden olculur.
#
# Sabit bir esik denendi ve kotu bicimde basarisiz oldu: 38 verildiginde
# zemininden 9 birim uzaktaki koyu bir agiz da "zemine yakin" sayiliyor,
# gercek zemine bitisik oldugu icin ayni bagli bilesene giriyor ve kilicin
# tamami siliniyordu. Kenara baglilik sarti bu durumda korumuyor.
#
# Bunun yerine goruntunun dis cercevesi olculuyor: orasi tanimi geregi
# zemin. Oradaki uzakliklarin yuksek yuzdeligi, zeminin ne kadar dalgali
# oldugunu (vinyet, doku, gurultu) dogrudan soyluyor. Esik onun biraz
# ustu: duz zeminde dar, dokulu zeminde genis.
# Yayilim olcusu 99. yuzdelik degil 75.: konu kenara degiyorsa (kabza,
# topuz, tasan bir kanat) cerceveye birkac parlak piksel karisiyor ve
# yuksek yuzdelik onlarla birlikte tavana ziplayarak esigi anlamsizca
# genisletiyor. 75. yuzdelik bu tasmadan etkilenmiyor; carpan onu gercek
# zemin araligina geri buyutuyor.
CERCEVE_ORANI = 0.03    # dis cerceve kalinligi (kisa kenarin orani)
ESIK_YUZDELIK = 75      # cerceve uzakliklarinin bu yuzdeligi
ESIK_PAYI = 2.5         # ve uzerine bu carpan
ESIK_TABAN = 8          # kusursuz duz zeminde bile bu kadar tolerans
ESIK_TAVAN = 60         # bu kadarindan fazlasi konuyu yemeye baslar

# Silinen alan bundan buyukse ayiklama basarisiz sayilir: bir envanter
# ikonunda konu goruntunun anlamli bir kismini kaplar. Sessizce bos bir
# gorsel yazmaktansa zemini oldugu gibi birakmak dogru.
AZAMI_SILINEN = 0.93
# Ayiklanan kenardan bu kadar piksel iceri girilir. Zemin renginin konunun
# cevresinde ince bir hale olarak kalmasini onler.
ASINDIRMA = 2
# Alfa kenarini yumusatma yaricapi. Sifir birakilirsa kucultulen ikonlarda
# testere disi gorunuyor.
YUMUSATMA = 1.2


def _modul(ad: str):
    """tools/<ad>.py dosyasini modul olarak yukler (tire iceren adlar import edilemiyor)."""
    yol = KOK / "tools" / f"{ad}.py"
    spec = importlib.util.spec_from_file_location(ad.replace("-", "_"), yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def filigran_zeminle(im, kutu):
    """
    Filigran kutusunu CEVRESINDEKI zemin rengiyle doldurur.

    Zemin ayiklanacaksa dogru islem bu, aynalamak degil. Ayna kutuya
    komsu seridi tasiyor; o serit zemin degilse (kuyruk ucu, golge, bir
    kivilcim) ayiklama onu KORUYOR ve ikonun kosesinde yuzen bir leke
    kaliyor. Olculdu: at ikonlarinda 156 ve 105 opak piksel kalmisti.

    Zemin rengiyle doldurulunca kutu zeminin bir parcasi oluyor ve
    ayiklamayla birlikte tamamen gidiyor. Ayna, zemin ayiklanmayan
    kategoriler icin (ekran zeminleri) dogru olan yontem olarak kaliyor.
    """
    import numpy as np
    from PIL import Image

    x0, y0, x1, y1 = kutu
    g, y = im.size
    pay = max(6, (x1 - x0) // 4)
    dis = im.crop((max(0, x0 - pay), max(0, y0 - pay), min(g, x1 + pay), min(y, y1 + pay)))
    ic_x0, ic_y0 = x0 - max(0, x0 - pay), y0 - max(0, y0 - pay)
    a = np.asarray(dis.convert("RGB")).astype(np.int16)
    maske = np.ones(a.shape[:2], bool)
    maske[ic_y0 : ic_y0 + (y1 - y0), ic_x0 : ic_x0 + (x1 - x0)] = False
    renk = tuple(int(v) for v in np.median(a[maske], axis=0))

    sonuc = im.copy()
    sonuc.paste(Image.new("RGB", (x1 - x0, y1 - y0), renk), (x0, y0))
    return sonuc


def zemin_ayikla(im, esik: int | None = None):
    """
    Duz zemini saydama cevirir; (goruntu, silinen_oran, kullanilan_esik)
    dondurur. Silinen oran AZAMI_SILINEN'i asarsa ayiklama yapilmaz ve
    silinen oran 0.0 dondurulur — cagiran bunu uyari olarak basar.

    Kenara bagli olmayan bolgeler korunur, boylece konunun icindeki zemin
    tonundaki alanlar (koyu bir oluk, golgede kalan bir kabza) silinmiyor.
    """
    import numpy as np
    from PIL import Image, ImageFilter
    from scipy import ndimage

    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    y, g = rgb.shape[:2]

    # Dis cerceve: tanimi geregi zemin. Sadece dort kose degil, cunku
    # vinyetli bir zeminde koseler en koyu yer; kenarlarin ortasi disarida
    # kalirsa zeminin gercek araligi olculmemis olur.
    kalinlik = max(4, int(min(g, y) * CERCEVE_ORANI))
    maske = np.zeros((y, g), bool)
    maske[:kalinlik], maske[-kalinlik:] = True, True
    maske[:, :kalinlik], maske[:, -kalinlik:] = True, True
    cerceve = rgb[maske]

    zemin = np.median(cerceve, axis=0)
    if esik is None:
        uzaklik = np.sqrt(((cerceve - zemin) ** 2).sum(axis=1))
        esik = float(np.percentile(uzaklik, ESIK_YUZDELIK) * ESIK_PAYI)
        esik = float(np.clip(esik, ESIK_TABAN, ESIK_TAVAN))

    yakin = np.sqrt(((rgb - zemin) ** 2).sum(axis=2)) < esik

    # Sadece kenara BAGLI olanlar zemindir.
    etiket, _ = ndimage.label(yakin)
    kenar = set(etiket[0].tolist()) | set(etiket[-1].tolist())
    kenar |= set(etiket[:, 0].tolist()) | set(etiket[:, -1].tolist())
    kenar.discard(0)
    if not kenar:
        return im.convert("RGBA"), 0.0, esik
    zemin_maskesi = np.isin(etiket, list(kenar))

    oran = float(zemin_maskesi.mean())
    if oran > AZAMI_SILINEN:
        return im.convert("RGBA"), 0.0, esik

    # Konunun cevresinde zemin renginde ince bir hale kalmasin.
    if ASINDIRMA:
        zemin_maskesi = ndimage.binary_dilation(zemin_maskesi, iterations=ASINDIRMA)

    alfa = Image.fromarray(((~zemin_maskesi) * 255).astype("uint8"), "L")
    if YUMUSATMA:
        alfa = alfa.filter(ImageFilter.GaussianBlur(YUMUSATMA))

    sonuc = im.convert("RGBA")
    sonuc.putalpha(alfa)
    return sonuc, oran, esik


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2

    filigran = None
    if "--filigran" in argv:
        i = argv.index("--filigran")
        filigran = argv[i + 1]
        del argv[i : i + 2]
    esik = None
    if "--esik" in argv:
        i = argv.index("--esik")
        esik = int(argv[i + 1])
        del argv[i : i + 2]
    tam_ayna = "--tam-ayna" in argv
    if tam_ayna:
        argv.remove("--tam-ayna")
    zemin_sil_istegi = None
    if "--zemin-sil" in argv:
        zemin_sil_istegi = True
        argv.remove("--zemin-sil")
    if "--zemin-tut" in argv:
        zemin_sil_istegi = False
        argv.remove("--zemin-tut")

    from PIL import Image

    uretici = _modul("gorsel-uret")
    fsil = _modul("filigran-sil")

    if not argv:
        print("Kategori verilmedi.", file=sys.stderr)
        return 2
    kategori, argv = argv[0], argv[1:]
    if kategori not in uretici.KATEGORI:
        print(
            f"'{kategori}' bilinmiyor. Kategoriler: {', '.join(uretici.KATEGORI)}",
            file=sys.stderr,
        )
        return 2

    boyut = uretici.KATEGORI[kategori]["boyut"]
    bilinen = set(uretici.ISTEKLER[kategori])
    # Ekipman ikonlari yan yana dizildigi icin zemin ayiklama orada varsayilan.
    zemin_sil = zemin_sil_istegi if zemin_sil_istegi is not None else kategori == "ekipman"

    isler = []
    for arg in argv:
        if "=" not in arg:
            print(f"Beklenen bicim <ad>=<dosya>, gelen: {arg}", file=sys.stderr)
            return 2
        ad, kaynak = arg.split("=", 1)
        if ad not in bilinen:
            yakinlar = sorted(a for a in bilinen if a.startswith(ad.split("_")[0]))
            print(
                f"'{ad}' {kategori} icinde yok."
                + (f" Bunu mu demek istedin: {', '.join(yakinlar)}" if yakinlar else ""),
                file=sys.stderr,
            )
            return 2
        if not Path(kaynak).exists():
            print(f"Dosya bulunamadi: {kaynak}", file=sys.stderr)
            return 2
        isler.append((ad, Path(kaynak)))

    for ad, kaynak in isler:
        im = Image.open(kaynak).convert("RGB")
        notlar = []
        if filigran:
            kutu = fsil.kutu_coz(filigran, *im.size)
            if zemin_sil and not tam_ayna:
                im = filigran_zeminle(im, kutu)
                notlar.append("filigran (zeminlendi)")
            else:
                im = fsil.sil_kutu(im, kutu, tam_ayna)
                notlar.append("filigran (aynalandi)")
        if zemin_sil:
            im, oran, kullanilan = zemin_ayikla(im, esik)
            if oran == 0.0:
                notlar.append(f"ZEMIN AYIKLANAMADI (esik {kullanilan:.0f})")
            else:
                notlar.append(f"zemin %{oran * 100:.0f} (esik {kullanilan:.0f})")
        tampon = BytesIO()
        im.save(tampon, "PNG")
        hedef = uretici.CIKTI / kategori / f"{ad}.webp"
        kb = uretici.kaydet(tampon.getvalue(), hedef, boyut) / 1024
        ek = f"  [{', '.join(notlar)}]" if notlar else ""
        print(f"  {kategori}/{ad}.webp  {boyut[0]}x{boyut[1]}  {kb:.0f} KB{ek}")

    print(f"\n{len(isler)} gorsel eklendi ({kategori}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
