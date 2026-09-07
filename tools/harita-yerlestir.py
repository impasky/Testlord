#!/usr/bin/env python3
"""
Lordlar Cagi - Bolge isaretcilerini cizilmis dunya zeminine oturtur.

NEDEN VAR: docs/12 §9 uretim sirasini soyluyor -- "zeminler once kilitlenir,
isaretci koordinatlari ondan sonra yerlestirilir". `data/world-map.json`
icindeki x/y bir YUZDE ve YALNIZ CIZIM ICIN: oyunun mantigi `komsular`
grafigine bakiyor, x/y'ye degil. Yani bir isaretciyi birkac puan oynatmak
dengeyi ya da komsulugu degistirmez, sadece nereye cizildigini degistirir.

SORUN: eski duzen duzgun bir kafesti (her isaretci komsusundan tam 11 puan
uzakta) ve altigen izgaradan kalmaydi. Cizilmis diyarin kiyilari o kafese
uymuyor; 18 isaretci denize dusuyordu. Denizin ortasinda duran bir tarla,
oyuncunun "burasi neresi" sorusuna verilebilecek en kotu cevap.

NE YAPIYOR: yalniz SUYA DUSEN isaretcileri, en yakin uygun karaya tasiyor.
Kisitlar:
  - kara olacak (isaretcinin oturdugu alanin cogu kara),
  - baska hicbir isaretciye MIN_ARA'dan yakin olmayacak (ust uste binen iki
    pin, dokunmatik ekranda tek hedef demek),
  - olabilecek EN KUCUK adim atilacak (duzen korunsun).
Karada duran isaretciye dokunulmuyor.

Kiyiya sikisan isaretci icin ikinci bir tur var: kara sarti ve aradaki
mesafe biraz gevsetiliyor. Alternatifi onu denizde birakmak.

KULLANIM:
  python3 tools/harita-yerlestir.py            # dene, yazma (varsayilan)
  python3 tools/harita-yerlestir.py --yaz      # data/world-map.json'a yaz

Zemin yeniden uretilirse bu yeniden calistirilir; `tools/generate_map.py`
isaretcilerin karada olup olmadigini zaten denetliyor.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
HARITA = KOK / "data" / "world-map.json"
ZEMIN = KOK / "apps" / "web" / "public" / "gorseller" / "harita" / "dunya.webp"

SICAK = 18        # R-B farki: kara sicak (kahve/yesil), su soguk (mavi/gri)
YARICAP = 6       # isaretcinin zeminde kapladigi yaricap (piksel)
MIN_ADA = 4000    # bundan kucuk kara parcasi ada degil, doku gurultusu
# (isaretcinin altindaki kara orani, isaretciler arasi en az mesafe, arama yaricapi)
#
# Kural kademe kademe gevsiyor: once "tam karada ve ferah", sonunda "kiyi
# burnu ya da ada, biraz sikisik". Uc kademe de gerekli -- diyarin kiyisi
# eski kafese uymuyor ve alt kademe olmadan iki isaretci (Sinirkule,
# Dortyol) haritanin obur ucuna atlamak zorunda kaliyordu.
TURLAR = (
    (0.70, 8.0, 16.0),
    (0.45, 7.0, 12.0),
    (0.25, 6.0, 10.0),
    (0.25, 5.0, 14.0),
)


def kara_maskesi():
    import numpy as np
    from PIL import Image
    from scipy import ndimage

    a = np.asarray(Image.open(ZEMIN).convert("RGB")).astype(int)
    sicak = a[:, :, 0] - a[:, :, 2]
    kara = ndimage.binary_opening(sicak >= SICAK, np.ones((7, 7)))
    kara = ndimage.binary_closing(kara, np.ones((7, 7)))
    etiket, adet = ndimage.label(kara)
    if adet:
        alanlar = ndimage.sum(kara, etiket, range(1, adet + 1))
        kara = np.isin(etiket, [i + 1 for i, al in enumerate(alanlar) if al > MIN_ADA])
    return kara


def yerlestir(bolgeler, kara, sessiz=False):
    """Suya dusen isaretcileri karaya tasir; tasinanlarin listesini doner."""
    import numpy as np

    yuk, gen = kara.shape

    def karada(x, y, oran):
        px, py = int(x / 100 * gen), int(y / 100 * yuk)
        if not (0 <= px < gen and 0 <= py < yuk):
            return False
        pencere = kara[max(0, py - YARICAP):py + YARICAP + 1,
                       max(0, px - YARICAP):px + YARICAP + 1]
        return bool(pencere.mean() > oran)

    noktalar = [[b["x"], b["y"]] for b in bolgeler]

    def uygun(i, x, y, oran, ara):
        if not (2 <= x <= 98 and 2 <= y <= 98):
            return False
        if not karada(x, y, oran):
            return False
        return all((x - ox) ** 2 + (y - oy) ** 2 >= ara ** 2
                   for j, (ox, oy) in enumerate(noktalar) if j != i)

    # Arama once YARICAPI buyutuyor, sonra kurali gevsetiyor. Tersi olsaydi
    # -- once butun turlar, sonra yaricap -- kiyiya sikisan isaretci yakinda
    # duran gevsek bir yer varken uzaktaki kusursuz yeri secerdi: Sinirkule
    # 15 puan atlayip komsularini haritanin obur ucunda birakti.
    tasinan = []
    for i, b in enumerate(bolgeler):
        if karada(b["x"], b["y"], TURLAR[0][0]):
            continue
        bulundu = None
        for r in np.arange(1.0, max(t[2] for t in TURLAR), 0.5):
            for oran, ara, azami in TURLAR:
                if r > azami:
                    continue
                for aci in np.arange(0, 360, 10):
                    x = round(b["x"] + r * float(np.cos(np.radians(aci))), 2)
                    y = round(b["y"] + r * float(np.sin(np.radians(aci))), 2)
                    if uygun(i, x, y, oran, ara):
                        bulundu = (x, y, float(r))
                        break
                if bulundu:
                    break
            if bulundu:
                break
        if not bulundu:
            print(f"  ÇÖZÜLEMEDİ: {b['name']} ({b['x']},{b['y']})")
            continue
        x, y, r = bulundu
        tasinan.append((b["name"], b["x"], b["y"], x, y, r))
        b["x"], b["y"] = x, y
        noktalar[i] = [x, y]
    return tasinan


def main() -> int:
    yaz = "--yaz" in sys.argv[1:]
    if not ZEMIN.exists():
        print(f"Zemin yok: {ZEMIN}", file=sys.stderr)
        return 2

    import numpy as np

    veri = json.loads(HARITA.read_text(encoding="utf-8"))
    bolgeler = veri["regions"]
    kara = kara_maskesi()
    print(f"Zemin: %{100 * kara.mean():.0f} kara")

    tasinan = yerlestir(bolgeler, kara)
    for ad, x0, y0, x1, y1, r in tasinan:
        print(f"  {ad:20s} ({x0:5.1f},{y0:5.1f}) -> ({x1:5.1f},{y1:5.1f})  {r:.1f} puan")

    P = np.array([[b["x"], b["y"]] for b in bolgeler])
    D = np.sqrt(((P[:, None, :] - P[None, :, :]) ** 2).sum(-1))
    np.fill_diagonal(D, 1e9)
    print(f"\n{len(tasinan)} isaretci tasindi. "
          f"En yakin iki isaretci arasi: {D.min():.1f} puan")

    if yaz:
        HARITA.write_text(json.dumps(veri, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
        print(f"Yazildi: {HARITA.relative_to(KOK)}")
    else:
        print("(Denendi, yazilmadi. Yazmak icin: --yaz)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
