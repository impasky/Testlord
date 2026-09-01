#!/usr/bin/env python3
"""
Elle uretilmis ekran zeminlerini oyuna alir.

Sohbete atilan gorseller ham geliyor: 16:10 degil, filigranli ve buyuk.
Bu script uc adimi tek yerde toplar ki her partide ayni islem elle
tekrarlanmasin (ve biri unutulmasin):

  1. Filigran temizligi  - araclarin kosesine koydugu isaret. Oyunun icinde
                           baska bir urunun isaretini tasimak istemiyoruz.
  2. Orana kirpma        - KATEGORI["zeminler"]["boyut"] neyse ona.
  3. WebP kaydi          - gorsel-uret.py'nin kaydet()'i ile, ayni kalitede.

Kirpma ve kayit gorsel-uret.py'den ODUNC ALINIYOR, kopyalanmiyor: kategori
boyutu degisirse elle eklenen gorseller de otomatik uyar.

KULLANIM:
  python3 tools/zemin-ekle.py <ad>=<dosya> [<ad>=<dosya> ...]
  python3 tools/zemin-ekle.py malikane=/yol/1.png kisla=/yol/2.png

  --filigran sol,ust,sag,alt   isaretin yeri (oran ya da piksel).
                               Varsayilan: hicbir sey silinmez.
  --filigran-yok               acikca atla (varsayilanla ayni, niyet belgesi)
  --tam-ayna                   yamayi tum goruntunun aynasindan al. Simetrik
                               sahnelerde (sutunlu salon, taht odasi) dikissiz.
                               Simetrik olmayan sahnede yanlis icerik tasir,
                               orada varsayilan yerel yansima dogru olan.
"""
from __future__ import annotations

import importlib.util
import sys
from io import BytesIO
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent


def _modul(ad: str):
    """tools/<ad>.py dosyasini modul olarak yukler (tire iceren adlar import edilemiyor)."""
    yol = KOK / "tools" / f"{ad}.py"
    spec = importlib.util.spec_from_file_location(ad.replace("-", "_"), yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


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
    if "--filigran-yok" in argv:
        argv.remove("--filigran-yok")
    tam_ayna = "--tam-ayna" in argv
    if tam_ayna:
        argv.remove("--tam-ayna")

    from PIL import Image

    uretici = _modul("gorsel-uret")
    fsil = _modul("filigran-sil")
    boyut = uretici.KATEGORI["zeminler"]["boyut"]
    bilinen = set(uretici.ISTEKLER["zeminler"])

    isler = []
    for arg in argv:
        if "=" not in arg:
            print(f"Beklenen bicim <ad>=<dosya>, gelen: {arg}", file=sys.stderr)
            return 2
        ad, kaynak = arg.split("=", 1)
        if ad not in bilinen:
            print(
                f"'{ad}' bir ekran zemini degil. Bilinenler: {', '.join(sorted(bilinen))}",
                file=sys.stderr,
            )
            return 2
        if not Path(kaynak).exists():
            print(f"Dosya bulunamadi: {kaynak}", file=sys.stderr)
            return 2
        isler.append((ad, Path(kaynak)))

    for ad, kaynak in isler:
        im = Image.open(kaynak).convert("RGB")
        if filigran:
            im = fsil.sil_kutu(im, fsil.kutu_coz(filigran, *im.size), tam_ayna)
        tampon = BytesIO()
        im.save(tampon, "PNG")
        hedef = uretici.CIKTI / "zeminler" / f"{ad}.webp"
        kb = uretici.kaydet(tampon.getvalue(), hedef, boyut) / 1024
        print(f"  zeminler/{ad}.webp  {boyut[0]}x{boyut[1]}  {kb:.0f} KB")

    print(f"\n{len(isler)} ekran zemini eklendi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
