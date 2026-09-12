#!/usr/bin/env python3
"""
Lordlar Cagi - Cizilmis dunya zemininden ARAZI okur.

NEDEN VAR: `data/world-map.json` icindeki bolgeler bir zamanlar altigen
izgaradan gelmisti ve izgara kalkinca bile izi kaldi -- 61 bolgenin yalniz
24 farkli y degeri vardi, yani isaretciler satir satir diziliydi. Resmedilmis
bir diyarin ustunde askeri bir sablon duruyordu ve goz bunu hemen yakaliyor.

Cozum, koordinati resimden TURETMEK. Bunun icin once resmin ne anlattigini
bilmek gerekiyor: nerede dag, nerede orman, nerede ova, nerede deniz.

YONTEM: uc olcu yetiyor ve ucu de tek bir gri resimden cikiyor.

  sicaklik (R-B)  kara mi deniz mi. Diyar sepya/kahve boyanmis, deniz soguk
                  mavi-yesil. `harita-yerlestir.py` bu olcuyu zaten
                  kullaniyordu ve 61 isaretciyi dogru oturtmustu.
  doku            15 piksellik pencerede parlakligin standart sapmasi.
                  DAG ve ORMAN cizgi cizgi bir doku; OVA duz. Olculdu:
                  ova 5-10, orman ~30, dag ~38-41. Ayirici olcu bu.
  bulanik parlak  dokusu yuksek olan ikisini birbirinden ayiriyor: dagin
                  tepeleri acik gri (80-107), ormanin kutlesi koyu (37-61).

Esikler goz karariyla degil, resmin uzerine boyanip BAKILARAK secildi
(`--onizleme`). Sonuc boyanan haritayla birebir ortusuyor: kuzeydeki sira
daglar, batidaki ormanlar, ortadaki ova, guneydogudaki delta.

KULLANIM:
  python3 tools/harita-arazi.py --onizleme cikti.png   # siniflandirmayi boya
  (kod olarak: `from harita_arazi import arazi_oku`)
"""
from __future__ import annotations

import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
ZEMIN = KOK / "apps" / "web" / "public" / "gorseller" / "harita" / "dunya.webp"

DENIZ, OVA, ORMAN, DAG = 0, 1, 2, 3
ARAZI_ADI = {DENIZ: "deniz", OVA: "ova", ORMAN: "orman", DAG: "dag"}

SICAK = 18        # R-B farki: kara sicak (kahve/yesil), su soguk
MIN_ADA = 4000    # bundan kucuk kara parcasi ada degil, doku gurultusu
DOKU_ORMAN = 19   # bunun ustu artik duz ova degil
DOKU_DAG = 24     # ... ve su parlaklikla birlikte dag
DAG_PARLAK = 70


def arazi_oku(yol: Path = ZEMIN):
    """
    (arazi, kara) dondurur. `arazi` 1024x1024 uint8, degerleri DENIZ/OVA/
    ORMAN/DAG; `kara` ayni boyutta bool.
    """
    import numpy as np
    from PIL import Image
    from scipy import ndimage

    a = np.asarray(Image.open(yol).convert("RGB")).astype(float)
    parlak = a.mean(2)
    sicak = a[:, :, 0] - a[:, :, 2]

    kara = ndimage.binary_opening(sicak >= SICAK, np.ones((7, 7)))
    kara = ndimage.binary_closing(kara, np.ones((7, 7)))
    etiket, adet = ndimage.label(kara)
    if adet:
        alanlar = ndimage.sum(kara, etiket, range(1, adet + 1))
        kara = np.isin(etiket, [i + 1 for i, al in enumerate(alanlar) if al > MIN_ADA])

    # Yerel standart sapma: E[x^2] - E[x]^2. Kutu suzgeciyle iki konvolusyon,
    # piksel basina dongu yok -- 1024x1024'te aninda biter.
    cekirdek = np.ones((15, 15)) / 225.0
    ort = ndimage.convolve(parlak, cekirdek, mode="nearest")
    ort2 = ndimage.convolve(parlak**2, cekirdek, mode="nearest")
    doku = np.sqrt(np.maximum(ort2 - ort**2, 0))
    # Ikinci bir yumusatma: tek bir firca darbesi "orman" sayilmasin, kutle
    # sayilsin. Bolge yerlestirmesi 10 puanlik olcekte calisiyor, bu yuzden
    # araziyi de o olcekte okumak dogru.
    doku = ndimage.uniform_filter(doku, 21)
    ort = ndimage.uniform_filter(ort, 21)

    arazi = np.zeros(kara.shape, np.uint8)
    arazi[kara] = OVA
    arazi[kara & (doku >= DOKU_ORMAN)] = ORMAN
    arazi[kara & (doku >= DOKU_DAG) & (ort >= DAG_PARLAK)] = DAG
    return arazi, kara


def deniz_uzakligi(kara):
    """Her kara pikselinin en yakin kiyiya uzakligi (piksel)."""
    from scipy import ndimage

    return ndimage.distance_transform_edt(kara)


def onizleme(hedef: Path):
    import numpy as np
    from PIL import Image

    arazi, _ = arazi_oku()
    renk = {DENIZ: (30, 45, 60), OVA: (196, 164, 96), ORMAN: (56, 92, 56), DAG: (150, 150, 155)}
    g = np.zeros((*arazi.shape, 3), np.uint8)
    for v, c in renk.items():
        g[arazi == v] = c
    Image.fromarray(g).save(hedef)
    print(f"yazildi: {hedef}")


if __name__ == "__main__":
    if "--onizleme" in sys.argv:
        i = sys.argv.index("--onizleme")
        onizleme(Path(sys.argv[i + 1]) if len(sys.argv) > i + 1 else KOK / "arazi.png")
    else:
        import numpy as np

        arazi, kara = arazi_oku()
        for v, ad in ARAZI_ADI.items():
            print(f"{ad:6s} %{100 * np.mean(arazi == v):5.1f}")
