#!/usr/bin/env python3
"""
DÜNYA ZEMİNİ — tek kareyi karolara böler ve her karoyu ayrı üretir.

── Sorun ────────────────────────────────────────────────────────────

`harita/dunya.webp` tek bir 1024x1024 kare. Dünya haritası ekranı ×2,4
yakınlaştırmayla AÇILIYOR ve ×3,2'ye kadar çıkıyor. 390 CSS piksellik
bir telefonda 3× ekran demek 1170 aygıt pikseli; ×3,2'de 3744. Yani o
tek kare en yakınında 3,7 kat geriliyor — kıyı çizgileri eriyor, dağlar
bulanık bir lekeye dönüyor. Oyunun en çok bakılan ekranı bu.

Model bir çağrıda en fazla 1024x1024 veriyor; daha büyük bir zemin tek
çağrıyla ALINAMIYOR. Çözüm haritayı 3x3 bölüp her parçayı AYRI çağrıda
yeniden çizdirmek: aynı bütçeyle 2592x2592, yani 2,5 kat gerçek piksel.

── Neden sıfırdan değil, mevcut zeminden ────────────────────────────

İşaretçilerin yeri `data/regions.json`daki x/y ile sabit ve o koordinatlar
mevcut zemine göre yerleşmiş: ırmak kenarındaki bölge ırmağın üstünde,
liman bölgesi kıyıda duruyor. Sıfırdan çizilen bir harita bu ilişkiyi
bozar ve 121 işaretçinin hepsi elle yeniden yerleştirilmeyi ister.
O yüzden her karo MEVCUT zeminin o parçası girdi verilerek üretiliyor:
"aynı kıyı, aynı ırmak, aynı yerde — yalnız daha ayrıntılı."

── Neden paylaşma payı (BINDIRME) var ───────────────────────────────

Dokuz karo dokuz ayrı çağrı, yani dokuz ayrı yorum. Karo sınırında iki
yorum yan yana gelince dikiş görünür. Her karo kendi alanından biraz
TAŞARAK üretiliyor ve taşan şeritler birleştirmede yumuşak geçişle
karıştırılıyor: sert bir çizgi yerine birkaç yüz pikselde eriyen bir
geçiş kalıyor. Elle çizilmiş bir atlasta bu görünmüyor.

Birleştirme TEK tuvalde yapılıp sonra dilimleniyor. Karoları doğrudan
modelden alıp yan yana koysaydık dikiş kalırdı; tuvali dilimlemek
dikişsizliği KURULUŞ GEREĞİ garantiliyor.

── Ham çıktılar saklanıyor ──────────────────────────────────────────

Model çağrısı kotadan düşüyor. Ham karolar `tools/stil/` altına yazılıyor
ve varsa yeniden istenmiyor; birleştirme ayarını değiştirip tekrar
çalıştırmak bedava.

Kullanım:
  GEMINI_API_KEY=... python3 tools/dunya-karo.py            # eksikleri üret + birleştir
  GEMINI_API_KEY=... python3 tools/dunya-karo.py 0,0 1,0    # yalnız bu karolar
  python3 tools/dunya-karo.py --birlestir                   # çağrı yok, yalnız birleştir
"""
import importlib.util
import os
import sys
from pathlib import Path

from PIL import Image

KOK = Path(__file__).resolve().parent.parent
ZEMIN = KOK / "apps/web/public/gorseller/harita/dunya.webp"
HAM = KOK / "tools/stil"
CIKTI = KOK / "apps/web/public/gorseller/harita"

BOLME = 3          # 3x3 karo
MODEL_BOYU = 1024  # modelin verdiği kare
PAY = 0.10         # karo kenarından taşan pay (karo genişliğinin oranı)
KARO_BOYU = 864    # nihai karo kenarı -> 3*864 = 2592 toplam
KALITE = 72        # q55'e inmek yalnız %10 kazandırıyor (mürekkep çizgisi
                   # sıkışmıyor); kazanmadığın yer için keskinlik verilmez.
ONIZLEME = 320     # ilk karede görünen bulanık zemin

ISTEM = (
    "This image is one section of a hand drawn fantasy world map, enlarged "
    "from a smaller original, so it looks soft and blurry. Redraw this exact "
    "section at high detail. Keep the SAME coastlines, the SAME rivers, the "
    "SAME mountain ranges, forests, marshes and islands, in exactly the SAME "
    "places and at exactly the SAME scale, running off the edges in exactly "
    "the same way. Do not move, add or remove any landmass, river, lake or "
    "mountain range. Do not zoom in and do not zoom out. Do not re-compose. "
    "Only sharpen and add fine detail: crisp inked coastlines, individual "
    "trees in the forests, ridge lines and hatching on the mountains, field "
    "texture on the plains, reed texture in the marsh. Keep the old parchment "
    "atlas style, the same muted palette and the same paper tone as the input. "
    "No text, no labels, no letters, no numbers, no border, no frame, no torn "
    "parchment edge, no compass rose, no grid, no hexagons. The map fills the "
    "entire square frame edge to edge and runs off all four edges."
)


def _uret_modulu():
    """`gorsel-uret.py`nin model seçimi ve yeniden deneme mantığı ödünç alınıyor."""
    spec = importlib.util.spec_from_file_location("gorsel_uret", KOK / "tools/gorsel-uret.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def kirpma_kutusu(c: int, r: int, en: int, boy: int) -> tuple[int, int, int, int]:
    """
    (c,r) karosunun PAYLI kırpma kutusu, kaynak görselin pikselinde.

    Kenardaki karolarda pay dışarı taşamıyor: kutu görselin içine
    sıkıştırılıyor. Bu, kenar karolarının biraz daha az bindirmesi
    demek — sorun değil, orada karıştırılacak komşu zaten yok.
    """
    kw, kh = en / BOLME, boy / BOLME
    p = kw * PAY
    return (
        int(round(max(0, c * kw - p))),
        int(round(max(0, r * kh - p))),
        int(round(min(en, (c + 1) * kw + p))),
        int(round(min(boy, (r + 1) * kh + p))),
    )


def karolari_uret(hedefler: list[tuple[int, int]], anahtar: str) -> int:
    uret = _uret_modulu()
    kaynak = Image.open(ZEMIN).convert("RGB")
    en, boy = kaynak.size
    gecici = KOK / "tools/stil/.karo-girdi.webp"
    uretilen = 0

    for c, r in hedefler:
        hedef = HAM / f"dunya-karo-{c}{r}.webp"
        if hedef.exists():
            print(f"  [{c},{r}] duruyor, atlanıyor")
            continue
        kutu = kirpma_kutusu(c, r, en, boy)
        # Model kare istiyor ve kare veriyor; payli kutu da kare (PAY her
        # yanda esit) — kenar karolarinda kirpilinca kare bozuluyor, o
        # yuzden ACIKCA kareye getiriliyor: bozuk oranli girdi, modelin
        # kompozisyonu esnetmesi demek.
        parca = kaynak.crop(kutu).resize((MODEL_BOYU, MODEL_BOYU), Image.LANCZOS)
        parca.save(gecici, "WEBP", quality=95)
        print(f"  [{c},{r}] üretiliyor — kutu {kutu} ...", flush=True)
        ham = uret.istek_at(ISTEM, anahtar, [gecici])
        Image.open(__import__("io").BytesIO(ham)).convert("RGB").save(
            hedef, "WEBP", quality=95, method=6
        )
        print(f"      yazıldı {hedef.stat().st_size / 1024:.0f} KB")
        uretilen += 1
    gecici.unlink(missing_ok=True)
    return uretilen


def birlestir() -> int:
    """
    Dokuz karoyu TEK tuvale yumuşak geçişle yerleştirir, sonra dilimler.

    Ağırlık, karonun PAYLI kutusunun kendi alanı dışında kalan şeritlerde
    doğrusal olarak sıfıra iniyor; komşu karo da aynı şeritte sıfırdan
    yükseliyor. Toplam ağırlığa bölünce geçiş sürekli oluyor.
    """
    import numpy as np

    kaynak = Image.open(ZEMIN)
    en, boy = kaynak.size
    olcek = (KARO_BOYU * BOLME) / en
    tuval_en = KARO_BOYU * BOLME

    toplam = np.zeros((tuval_en, tuval_en, 3), dtype=np.float64)
    agirlik = np.zeros((tuval_en, tuval_en, 1), dtype=np.float64)
    eksik = []

    for r in range(BOLME):
        for c in range(BOLME):
            yol = HAM / f"dunya-karo-{c}{r}.webp"
            if not yol.exists():
                eksik.append(f"{c},{r}")
                continue
            k0, u0, k1, u1 = kirpma_kutusu(c, r, en, boy)
            # Karonun tuvaldeki yeri: kaynak kutusunun ölçeklenmiş hâli.
            tk0, tu0 = int(round(k0 * olcek)), int(round(u0 * olcek))
            tk1, tu1 = int(round(k1 * olcek)), int(round(u1 * olcek))
            w, h = tk1 - tk0, tu1 - tu0
            im = np.asarray(Image.open(yol).convert("RGB").resize((w, h), Image.LANCZOS), float)

            # Ağırlık: karonun KENDİ alanı 1, payın içinde 0'a iniyor.
            kw, kh = en / BOLME, boy / BOLME
            oz0, oz1 = int(round(c * kw * olcek)), int(round((c + 1) * kw * olcek))
            od0, od1 = int(round(r * kh * olcek)), int(round((r + 1) * kh * olcek))
            ax = np.ones(w)
            if tk0 < oz0:
                n = oz0 - tk0
                ax[:n] = np.linspace(0.0, 1.0, n, endpoint=False)
            if tk1 > oz1:
                n = tk1 - oz1
                ax[w - n :] = np.linspace(1.0, 0.0, n)
            ay = np.ones(h)
            if tu0 < od0:
                n = od0 - tu0
                ay[:n] = np.linspace(0.0, 1.0, n, endpoint=False)
            if tu1 > od1:
                n = tu1 - od1
                ay[h - n :] = np.linspace(1.0, 0.0, n)
            a = (ay[:, None] * ax[None, :])[:, :, None]
            # Uçta tamamen sıfır ağırlık, o şeridi kimsesiz bırakabilir.
            a = np.maximum(a, 1e-6)

            toplam[tu0:tu1, tk0:tk1] += im * a
            agirlik[tu0:tu1, tk0:tk1] += a

    if eksik:
        print(f"  EKSİK karo: {', '.join(eksik)} — birleştirme yapılmadı", file=sys.stderr)
        return 1

    tuval = Image.fromarray(np.clip(toplam / agirlik, 0, 255).astype("uint8"), "RGB")
    # Tuvalin kendisi oyuna GİRMİYOR: 950 KB'lık tek dosyayı indirtmek
    # karolara bölmenin bütün anlamını siler. Ham sayfaların yanında,
    # dikişe bakmak için duruyor.
    tam = HAM / "dunya-tam.webp"
    tuval.save(tam, "WEBP", quality=KALITE, method=6)
    print(f"  tuval {tuval.size[0]}x{tuval.size[1]} — {tam.stat().st_size / 1024:.0f} KB (ham)")

    # Önizleme: dokuz karo sırayla düşerken harita yapboz gibi kurulmasın.
    # Bulanık zemin ilk karede geliyor, karolar üstüne netleşiyor.
    onz = CIKTI / "dunya-onizleme.webp"
    tuval.resize((ONIZLEME, ONIZLEME), Image.LANCZOS).save(
        onz, "WEBP", quality=58, method=6
    )
    print(f"  önizleme {ONIZLEME}x{ONIZLEME} — {onz.stat().st_size / 1024:.0f} KB")

    toplam_kb = 0
    for r in range(BOLME):
        for c in range(BOLME):
            karo = tuval.crop(
                (c * KARO_BOYU, r * KARO_BOYU, (c + 1) * KARO_BOYU, (r + 1) * KARO_BOYU)
            )
            yol = CIKTI / f"dunya-{c}{r}.webp"
            karo.save(yol, "WEBP", quality=KALITE, method=6)
            toplam_kb += yol.stat().st_size / 1024
    print(f"  9 karo {KARO_BOYU}x{KARO_BOYU} — toplam {toplam_kb:.0f} KB")
    return 0


def main(argv: list[str]) -> int:
    if "--birlestir" in argv:
        return birlestir()

    hedefler = []
    for a in argv:
        if "," in a:
            c, r = a.split(",")
            hedefler.append((int(c), int(r)))
    if not hedefler:
        hedefler = [(c, r) for r in range(BOLME) for c in range(BOLME)]

    anahtar = os.environ.get("GEMINI_API_KEY", "")
    if not anahtar:
        print("GEMINI_API_KEY yok.", file=sys.stderr)
        return 2

    print(f"{len(hedefler)} karo")
    karolari_uret(hedefler, anahtar)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
