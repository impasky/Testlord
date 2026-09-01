#!/usr/bin/env python3
"""
Oyun görsellerini Google Generative Language API ile üretir.

Neden bu API: bu ortamda dışarıya çıkış proxy üzerinden kısıtlı. OpenAI,
Stability, Replicate ve fal kapalı; generativelanguage.googleapis.com AÇIK.
Dolayısıyla görselleri buradan üretebiliyoruz.

KURULUM (tek seferlik):
  1. https://aistudio.google.com/apikey adresinden ücretsiz bir anahtar al
  2. Claude Code ortam ayarlarına GEMINI_API_KEY olarak ekle
     (ya da tek seferlik: GEMINI_API_KEY=... python3 tools/gorsel-uret.py)

KULLANIM:
  python3 tools/gorsel-uret.py                 # eksik olan her şeyi üret
  python3 tools/gorsel-uret.py suvari kale     # sadece bunları
  python3 tools/gorsel-uret.py --zorla         # var olanların üstüne yaz
  python3 tools/gorsel-uret.py --liste         # ne üretilecek, üretmeden göster
  python3 tools/gorsel-uret.py --istemler      # istemleri markdown olarak dök (API'siz)

MALİYET (ölçüldü, tahmin değil):
  Görsel modellerinin ücretsiz katmanı YOK. Faturalandırma bağlı olmayan bir
  anahtarla denendiğinde API şunu döner:

    429 ... generate_content_free_tier_requests, limit: 0

  Yani anahtar geçerli olsa bile ücretsiz katmanda TEK görsel üretilemez;
  beklemek de işe yaramaz, çünkü limit sıfır. Üretim için projeye Google
  Cloud'dan faturalandırma bağlamak şart. Bunun karşılığı: anahtar artık
  ücret doğurabilir. 72 görsellik set kuruşlar mertebesinde (~1 dolar civarı)
  ama güncel fiyatı Google'ın kendi sayfasından doğrula.

  Faturalandırma açmak istemiyorsan: docs/GORSEL-REHBERI.md, Yol 2.

Çıktı: apps/web/public/gorseller/<kategori>/<ad>.webp
Kategoriler: birimler, generaller, bolgeler, ekipman, harita, zeminler.
Boyut kategoriye göre (KATEGORI['boyut']); WebP, ~%82 kalite.

Üslup tarifi tek yerde: TABAN_USLUP her görselde aynı, KATEGORI[...]['kompozisyon']
kategoriye göre değişir. Tutarlılığın anahtarı bu: tek tek "güzel" ama birbirini
tutmayan görseller, tutarlı ama sade olanlardan kötü görünür.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "apps" / "web" / "public" / "gorseller"

API = "https://generativelanguage.googleapis.com/v1beta/models"

# Model adları değişiyor ve eskiler kapatılıyor (gemini-2.5-flash-image için
# duyurulan kapanış: 2 Ekim 2026). Tek bir ada bağlanmak yerine sırayla
# deneyip çalışan ilkini kullanıyoruz; böylece bir model kapandığında script
# kendiliğinden bir sonrakine geçiyor.
#
# Liste, ListModels çıktısıyla doğrulandı: üçü de mevcut. Sıra ucuzdan
# pahalıya: flash bu iş için yeterli, pro yedek.
MODELLER = [
    m.strip()
    for m in os.environ.get(
        "GORSEL_MODEL",
        "gemini-3.1-flash-image,gemini-2.5-flash-image,gemini-3-pro-image",
    ).split(",")
    if m.strip()
]

# İlk başarılı model bulununca burada tutulur; kalan görseller için tekrar aranmaz.
_calisan_model: str | None = None

# --- Üslup ---
#
# İki katman: TABAN her görselde aynı (palet, ışık, render). KOMPOZISYON
# kategoriye göre değişir, çünkü bir kılıç ikonuyla bir ekran zemini aynı
# çerçeveyi paylaşamaz.
#
# Tutarlılığın anahtarı bu ayrım: tek tek "güzel" ama birbirini tutmayan
# görseller, tutarlı ama sade olanlardan kötü görünür.
TABAN_USLUP = (
    "medieval fantasy game asset, painted semi-realistic illustration, "
    "warm cel-shaded rendering with soft airbrushed volume, "
    "dark muted palette of deep browns and parchment cream with warm gold accents "
    "and crimson highlights, dramatic side lighting from the upper left, "
    "weathered and grounded, not glossy, not cartoonish, "
    "no text, no watermark, no border, no frame, no UI elements"
)

# Kategori başına kompozisyon kuralı + çıktı boyutu.
#   kompozisyon : TABAN_USLUP'a eklenen çerçeveleme tarifi
#   boyut       : (genişlik, yükseklik) — kaydederken bu orana kırpılır
KATEGORI = {
    "birimler": {
        "ad": "Birimler",
        "aciklama": "Kışlada ve savaş ekranlarında görünür.",
        "kompozisyon": "single character standing centered, full body, "
                       "plain flat dark background, square 1:1 composition",
        "boyut": (512, 512),
    },
    "generaller": {
        "ad": "Generaller",
        "aciklama": "General listesinde ve kartlarında görünür.",
        "kompozisyon": "waist-up character portrait facing the viewer, "
                       "plain flat dark background, square 1:1 composition",
        "boyut": (512, 512),
    },
    "bolgeler": {
        "ad": "Bölge sahneleri",
        "aciklama": (
            "Bölge sayfasının tepesinde tam genişlikte görünür — oyuncunun "
            "\"oradaymış\" gibi hissettiği yer burası. Aşama görselleri "
            "(`_3`, `_5`) bölge geliştikçe devreye girer; yoksa taban görsel "
            "kullanılmaya devam eder."
        ),
        "kompozisyon": "establishing scene from a low three-quarter aerial angle, "
                       "the subject fills the frame, atmospheric depth, "
                       "square 1:1 composition",
        "boyut": (512, 512),
    },
    "ekipman": {
        "ad": "Ekipman",
        "aciklama": (
            "Demirhane envanterinde ve Lord ekranındaki kuşanma yuvalarında "
            "görünür. **Nadirlik için ayrı görsel gerekmez**: sıradan/usta/"
            "nadir/efsanevi/kadim ayrımı arayüzde çerçeve ve renkle yapılıyor. "
            "Tek değişken tier."
        ),
        "kompozisyon": "a single object presented as a game inventory icon, "
                       "isolated and centered, three-quarter view, "
                       "no hands, no character, no background scenery, "
                       "plain flat dark background, square 1:1 composition",
        "boyut": (512, 512),
    },
    "harita": {
        "ad": "Harita karoları",
        "aciklama": (
            "Dünya haritasındaki altıgenlerin dolgusu. Bölge sahnelerinden "
            "AYRI: sahneler üç çeyrek açıdan bakan tablolar, karolar ise tam "
            "tepeden bakan arazi dokuları. Sahneyi karo olarak kullanmak "
            "haritayı bulanık bir kolaja çeviriyor."
        ),
        "kompozisyon": "top-down orthographic terrain tile seen straight from above, "
                       "flat even lighting with no strong shadows, "
                       "texture reads clearly when shrunk to thumbnail size, "
                       "edges continue naturally with no vignette and no border, "
                       "square 1:1 composition",
        "boyut": (512, 512),
    },
    "zeminler": {
        "ad": "Ekran zeminleri",
        "aciklama": (
            "Her ekranın tepesinde geniş bir şerit olarak durur ve alt kenarı "
            "arayüze eritilir. Oyunun \"gösterge paneli\" değil bir yer gibi "
            "hissettirmesi büyük ölçüde buna bağlı."
        ),
        "kompozisyon": "wide establishing shot, cinematic composition with the "
                       "focal subject slightly above center, deep atmospheric "
                       "perspective, empty darker area along the bottom third "
                       "where interface will overlay, 16:10 landscape composition",
        "boyut": (1024, 640),
    },
}

# --- Ekipman: 6 yuva x 5 tier = 30 görsel ---
#
# Tek tek yazmak yerine yuva tarifi ile tier merdiveni çarpılıyor. Sebep
# bakım: tier merdiveni değişince otuz istem birden düzeliyor ve "T3 kalkan
# neden T4 miğferden gösterişli" gibi tutarsızlıklar oluşmuyor.
EKIPMAN_YUVA = {
    "silah": "a straight double-edged arming sword, blade pointing up",
    "kalkan": "a heater shield seen from the front, slight three-quarter tilt",
    "zirh": "a torso cuirass and pauldrons displayed on an invisible stand",
    "migfer": "a knight helmet, visor down, three-quarter view",
}

# Metal parçalar için ortak tier merdiveni.
EKIPMAN_TIER = {
    1: "crude and plain, rough forged iron, plain leather grip and straps, "
       "nicked and dulled from use, no ornament at all",
    2: "well made steel, clean lines, a single etched groove, sturdy brass rivets, "
       "modest and functional",
    3: "masterwork, blued steel with brass fittings, engraved scrollwork along the edges, "
       "one small set gemstone",
    4: "heroic and rich, gilded surfaces deeply engraved with interlace, inlaid gems, "
       "silk wrapping, a faint warm glow along the edges",
    5: "ancient and mythic, dark meteoric metal veined with glowing golden runes, "
       "unearthly inner light, clearly the relic of a legend",
}

# At ve sancak metal merdivenine uymuyor; kendi merdivenleri var.
EKIPMAN_AT = {
    1: "a shaggy short farm horse in plain rope tack, no armor, standing in profile",
    2: "a sturdy riding horse with a simple leather saddle and a plain wool caparison",
    3: "a trained warhorse wearing a mail chamfron and a quartered cloth barding",
    4: "a magnificent destrier in gilded plate barding with a plumed chamfron and silk trappings",
    5: "a legendary black warhorse in rune-etched barding, golden light in its mane, "
       "embers rising from its hooves",
}
EKIPMAN_SANCAK = {
    1: "a plain undyed linen banner on a rough wooden pole, frayed along the edge",
    2: "a dyed wool banner bearing one simple heraldic charge, plain iron finial",
    3: "an embroidered banner with a bordered heraldic device, brass finial and tassels",
    4: "a richly embroidered silk banner with gold thread heraldry and a gilded eagle finial",
    5: "an ancient war standard of dark silk covered in glowing golden sigils, "
       "crowned finial, light spilling from the cloth",
}


def _ekipman_istekleri() -> dict[str, str]:
    """6 yuva x 5 tier = 30 istem üretir."""
    out: dict[str, str] = {}
    for yuva, tarif in EKIPMAN_YUVA.items():
        for tier, nitelik in EKIPMAN_TIER.items():
            out[f"{yuva}_t{tier}"] = f"{tarif}, {nitelik}"
    for tier, tarif in EKIPMAN_AT.items():
        out[f"at_t{tier}"] = tarif
    for tier, tarif in EKIPMAN_SANCAK.items():
        out[f"sancak_t{tier}"] = tarif
    return out


# --- Ne üretilecek: klasör -> dosya adı -> konu ---
ISTEKLER: dict[str, dict[str, str]] = {
    "birimler": {
        "milis": "a ragged peasant militiaman gripping a pitchfork, no armor, "
                 "patched linen tunic, wary expression",
        "mizrakci": "a footman in chainmail holding a long spear upright and a kite shield, "
                    "steady stance",
        "okcu": "an archer in leather armor drawing a longbow, quiver at the hip, "
                "focused aim",
        "suvari": "an armored knight on a barded warhorse with a couched lance, "
                  "charging pose",
        "kusatma": "a wooden catapult siege engine loaded with a boulder, "
                   "rope tension visible",
    },
    "bolgeler": {
        # Taban (aşama 1-2)
        "tarla": "golden wheat fields with a wooden barn and a windmill on the horizon",
        "maden": "a timbered mine entrance in a rocky hillside with ore carts and a lift",
        "sehir": "a walled medieval market town, tiled roofs and a market square",
        "kale": "a stone fortress with square towers on a rocky crag, banners flying",
        "taht": "a grand throne hall, golden throne on a stepped dais, "
                "tall columns and hanging banners",
        # Aşama 3-4: gelişmiş
        "tarla_3": "a prosperous farming estate, ordered green and gold fields, "
                   "a large stone granary, two windmills, laden ox carts on the lane",
        "maden_3": "a busy mining works cut into the hillside, timber headframe and "
                   "winch tower, several tunnel mouths, smoking ore furnaces",
        "sehir_3": "a thriving walled trade city, crowded market square with awnings, "
                   "guild halls, a river quay with moored barges",
        "kale_3": "a great castle with concentric curtain walls and a barbican gate, "
                  "many banners, a drilling yard inside the walls",
        # Aşama 5: zirve
        "tarla_5": "a vast breadbasket valley, terraced fields stretching to the horizon, "
                   "great stone granaries and grain barges on a canal",
        "maden_5": "a monumental mining complex carved into a mountain, "
                   "aqueducts and ore lifts, glowing forges, cliffside walkways",
        "sehir_5": "a grand capital city seen from above, cathedral and palace domes, "
                   "wide avenues, a great harbour crowded with ships",
        "kale_5": "an unassailable mountain citadel, towering walls and keeps stacked "
                  "up the crag, storm light, countless banners",
    },
    "generaller": {
        # Bronz — deneyimli ama sıradan komutanlar
        "demirci_yusuf": "a broad-shouldered blacksmith turned commander, "
                         "leather apron over mail, soot-marked face, hammer on his shoulder",
        "okcubasi_elif": "a sharp-eyed woman archer captain in leather armor, "
                         "longbow across her back, braided dark hair",
        "suvari_bora": "a young cavalry sergeant in light mail, riding cloak, "
                       "helmet under his arm, windblown",
        "erzakci_meryem": "a stern quartermaster woman in practical wool robes, "
                          "ledger and keys at her belt",
        "mizrakci_kadir": "a weathered spear captain in mail, "
                          "spear butt planted, scarred jaw",
        "kahya_sinan": "a shrewd steward in fine dark robes, "
                       "seal ring and rolled parchment, calculating look",
        # Gümüş — uzmanlar
        "kusatmaci_tarik": "a siege master in reinforced leather, "
                           "engineer tools and rope coils, calculating the walls",
        "casus_leyla": "a hooded woman spy in dark travel clothes, "
                       "half-lit face, daggers concealed",
        "sovalye_doruk": "a proud knight in polished plate armor holding a banner lance, "
                         "crimson surcoat",
        "vaiz_bertan": "an aging battlefield preacher in grey robes, "
                       "wooden icon in hand, calm weary eyes",
        # Altın — efsanevi
        "kumandan_alparslan": "a legendary supreme commander in ornate gilded armor, "
                              "fur-lined cloak, commanding gaze, greying beard",
        "kale_bekcisi_sarya": "a legendary woman castellan in heavy engraved plate armor, "
                              "tower shield, unyielding stance",
    },
    "ekipman": _ekipman_istekleri(),
    "harita": {
        "tarla": "ripe wheat farmland with hedgerows and a cart track, "
                 "a few thatched roofs at one edge",
        "maden": "grey rocky ground with open quarry cuts, spoil heaps, "
                 "timber props and a cart rail",
        "sehir": "densely packed tiled rooftops and narrow streets of a town district",
        "kale": "a fortress precinct, thick curtain walls and corner towers "
                "around a stone courtyard",
        "taht": "a royal citadel precinct, golden roofed keep at the centre ringed "
                "by walls and banner poles",
        "deniz": "deep open sea water with gentle swell and foam streaks",
    },
    "zeminler": {
        "malikane": "a fortified lord's manor and its courtyard at dusk, "
                    "warm lit windows, outbuildings and a walled garden, "
                    "rolling farmland beyond",
        "kisla": "a barracks training yard at dawn, racks of spears and shields, "
                 "straw targets, soldiers drilling in the distance",
        "demirhane": "a smithy interior lit by the forge, glowing anvil and coals, "
                     "hanging tongs and half-finished blades, sparks in the air",
        "generaller": "a war council chamber, great map table with carved markers, "
                      "hanging banners, candlelight",
        "siralama": "a long hall of honour lined with the banners of rival houses, "
                    "shafts of light from high windows",
        "giris": "a lord in a dark cloak standing on a ridge at dawn overlooking "
                 "a wide valley of fields, towns and a distant citadel",
    },
}

def tam_istem(klasor: str, konu: str) -> str:
    """Konu + kategori kompozisyonu + taban üslup. Tek birleştirme noktası."""
    return f"{konu}, {KATEGORI[klasor]['kompozisyon']}, {TABAN_USLUP}"


def _tek_model_dene(model: str, istem: str, anahtar: str) -> bytes:
    govde = json.dumps(
        {
            "contents": [{"parts": [{"text": istem}]}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }
    ).encode()

    r = urllib.request.Request(
        f"{API}/{model}:generateContent?key={anahtar}",
        data=govde,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=180) as y:
        veri = json.load(y)

    for aday in veri.get("candidates", []):
        for parca in aday.get("content", {}).get("parts", []):
            satir = parca.get("inlineData") or parca.get("inline_data")
            if satir and satir.get("data"):
                return base64.b64decode(satir["data"])
    raise RuntimeError(f"Yanıtta görsel yok: {json.dumps(veri)[:300]}")


def istek_at(istem: str, anahtar: str) -> bytes:
    """
    Görsel üretir. Çalışan model bir kez bulunur, sonrakilerde tekrar aranmaz.

    404/400 "model yok" hataları sıradaki modele geçmeyi tetikler; kota (429)
    ve sunucu hataları çağırana bırakılır, orada beklenip tekrar denenir.
    """
    global _calisan_model

    denenecek = [_calisan_model] if _calisan_model else MODELLER
    son_hata: Exception | None = None

    for model in denenecek:
        try:
            ham = _tek_model_dene(model, istem, anahtar)
            if _calisan_model != model:
                print(f"  model: {model}")
                _calisan_model = model
            return ham
        except urllib.error.HTTPError as e:
            # 404/400: model adı geçersiz ya da kapatılmış -> sıradakini dene
            if e.code in (400, 404) and not _calisan_model:
                son_hata = e
                continue
            raise
    raise son_hata or RuntimeError("Hiçbir model çalışmadı")


def istemleri_yaz() -> str:
    """
    Görselleri elle üretecek biri için istemleri markdown olarak döker.

    docs/GORSEL-ISTEMLERI.md bu çıktıdan üretilir:
      python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md

    Elle yazılmış ikinci bir istem listesi tutmuyoruz; tek kaynak yukarıdaki
    ISTEKLER ve USLUP. Üslup değişirse bu dosya yeniden üretilir, kopyası
    eskimez.
    """
    toplam = sum(len(v) for v in ISTEKLER.values())

    s = [
        "# Görsel İstemleri",
        "",
        f"Oyunun ihtiyacı olan **{toplam} görselin** kopyala-yapıştır istemleri.",
        "Her istem üç parçadan oluşur: **konu** + **kategori kompozisyonu** +",
        "**taban üslup**. Taban üslup hepsinde aynıdır; tutarlılık oradan gelir.",
        "",
        "**Bu dosya elle düzenlenmez.** Kaynağı `tools/gorsel-uret.py` içindeki",
        "`ISTEKLER`, `KATEGORI` ve `TABAN_USLUP`. Değişiklik oraya yapılır, sonra:",
        "",
        "```bash",
        "python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md",
        "```",
        "",
        "## Nasıl kullanılır",
        "",
        "1. İstemi kopyala, görsel üreten bir araca yapıştır (Gemini, ChatGPT,",
        "   Midjourney, Stable Diffusion — fark etmez).",
        "2. Çıkan görseli sohbete ekle ve **hangi başlığa ait olduğunu söyle**.",
        "3. Gerisi bende: kırpma, boyutlandırma, WebP dönüşümü, doğru adla depoya",
        "   koyma. Boyut ya da format ayarlamanla uğraşma, ham görsel yeter.",
        "",
        "Hepsini bir arada göndermen gerekmiyor; geldiği kadarı kullanılır,",
        "gelmeyenin yerinde siluet kalır ve oyun yine tutarlı durur.",
        "",
        "**İpucu:** mümkünse hepsini aynı araçta ve aynı oturumda üret. Araç",
        "değiştikçe üslup kayar ve otuz kılıç birbirinin akrabası olmaktan çıkar.",
        "",
        "## Öncelik sırası",
        "",
        "Hepsini birden yaptırmak gerekmiyor. Oyuna en çok katan sırayla:",
        "",
        "| Sıra | Kategori | Adet | Neden |",
        "|---|---|---|---|",
        "| 1 | Ekran zeminleri | 6 | Oyunun \"gösterge paneli\" değil bir yer gibi hissetmesi en çok buna bağlı |",
        "| 2 | Ekipman | 30 | Demirhane şu an tamamen sayıdan ibaret |",
        "| 3 | Harita karoları | 6 | Haritanın okunurluğu; sahne görselleri karo olarak bulanık kalıyor |",
        "| 4 | Bölge aşamaları | 8 | Geliştirmenin karşılığının GÖRÜNMESİ |",
        "| — | Birimler, generaller, bölge tabanları | 22 | Zaten var |",
        "",
        "## Taban üslup",
        "",
        "Her istemin sonunda bu var; ayrıca yapıştırmana gerek yok:",
        "",
        "```",
        TABAN_USLUP,
        "```",
        "",
    ]

    for klasor, kayitlar in ISTEKLER.items():
        k = KATEGORI[klasor]
        g, y = k["boyut"]
        s += [
            "---",
            "",
            f"## {k['ad']} — {len(kayitlar)} görsel",
            "",
            k["aciklama"],
            "",
            f"Çıktı: `apps/web/public/gorseller/{klasor}/<ad>.webp` · {g}×{y}",
            "",
            "Kompozisyon (her istemde var):",
            "",
            "```",
            k["kompozisyon"],
            "```",
            "",
        ]
        for ad, konu in kayitlar.items():
            s += [
                f"### `{klasor}/{ad}.webp`",
                "",
                "```",
                tam_istem(klasor, konu),
                "```",
                "",
            ]
    return "\n".join(s)


def _ucretsiz_katman_kapali(govde: str) -> bool:
    """
    429'un iki ayrı anlamı var, karıştırmamak gerekiyor:

      free_tier + "limit: 0"  -> ücretsiz katmanda görsel üretimi hiç açık
                                 değil. Beklemek işe yaramaz, faturalandırma
                                 açılana kadar tek görsel bile üretilmez.
      bunun dışındaki 429     -> gerçek hız sınırı; beklenip tekrar denenir.

    İlkini ikincisi sanmak, onlarca görselin her biri için 15 saniye boşuna
    beklemek demek - üstelik sonunda hepsi başarısız.
    """
    return "free_tier" in govde and "limit: 0" in govde


def kaydet(ham: bytes, yol: Path, boyut: tuple[int, int]) -> int:
    """
    Kategorinin boyutunda WebP kaydeder.

    Model her zaman istenen oranı vermiyor; gelen görsel hedef orana göre
    ORTADAN kırpılıyor. Ekran zeminleri 16:10, geri kalan her şey kare.
    """
    from PIL import Image

    hg, hy = boyut
    im = Image.open(BytesIO(ham)).convert("RGBA")
    g, y = im.size
    hedef = hg / hy
    mevcut = g / y
    if abs(mevcut - hedef) > 0.01:
        if mevcut > hedef:  # çok geniş: yanlardan kırp
            yeni_g = int(round(y * hedef))
            sol = (g - yeni_g) // 2
            im = im.crop((sol, 0, sol + yeni_g, y))
        else:  # çok uzun: üst/alttan kırp
            yeni_y = int(round(g / hedef))
            ust = (y - yeni_y) // 2
            im = im.crop((0, ust, g, ust + yeni_y))
    im = im.resize(boyut, Image.LANCZOS)
    yol.parent.mkdir(parents=True, exist_ok=True)
    im.save(yol, "WEBP", quality=82, method=6)
    return yol.stat().st_size


def main() -> int:
    argv = [a for a in sys.argv[1:]]
    zorla = "--zorla" in argv
    sadece_liste = "--liste" in argv
    secilenler = {a for a in argv if not a.startswith("--")}

    # Anahtar da ağ da gerektirmez: sadece istemleri yazar.
    if "--istemler" in argv:
        print(istemleri_yaz())
        return 0

    isler: list[tuple[str, str, str, Path]] = []
    for klasor, kayitlar in ISTEKLER.items():
        for ad, konu in kayitlar.items():
            if secilenler and ad not in secilenler:
                continue
            yol = CIKTI / klasor / f"{ad}.webp"
            if yol.exists() and not zorla:
                continue
            isler.append((klasor, ad, konu, yol))

    if not isler:
        print("Üretilecek bir şey yok. Hepsi mevcut (--zorla ile üstüne yazılır).")
        return 0

    print(f"{len(isler)} görsel üretilecek:")
    for klasor, ad, _, _ in isler:
        print(f"  {klasor}/{ad}.webp")
    if sadece_liste:
        return 0

    anahtar = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not anahtar:
        print(
            "\nGEMINI_API_KEY tanımlı değil.\n"
            "  1. https://aistudio.google.com/apikey adresinden ücretsiz anahtar al\n"
            "  2. Claude Code ortam değişkenlerine GEMINI_API_KEY olarak ekle\n"
            "     ya da: GEMINI_API_KEY=... python3 tools/gorsel-uret.py",
            file=sys.stderr,
        )
        return 2

    basarili, basarisiz = 0, []
    for i, (klasor, ad, konu, yol) in enumerate(isler, 1):
        print(f"\n[{i}/{len(isler)}] {klasor}/{ad} ...", flush=True)
        for deneme in range(3):
            try:
                ham = istek_at(tam_istem(klasor, konu), anahtar)
                bayt = kaydet(ham, yol, KATEGORI[klasor]["boyut"])
                print(f"  tamam — {bayt / 1024:.0f} KB")
                basarili += 1
                break
            except urllib.error.HTTPError as e:
                govde = e.read().decode("utf-8", "replace")[:600]
                if e.code == 429 and _ucretsiz_katman_kapali(govde):
                    print(
                        "\n  Ücretsiz katmanda görsel üretimi kapalı (kota limiti 0).\n"
                        "  Anahtar geçerli - sorun anahtarda değil, kotada: Google\n"
                        "  görsel modellerini ücretsiz katmana hiç açmıyor.\n"
                        "  Beklemenin faydası yok, bu yüzden burada duruyorum.\n\n"
                        "  Seçenekler:\n"
                        "    - Google Cloud'da projeye faturalandırma bağla (ücretli katman)\n"
                        "    - ya da görselleri başka yerde üretip sohbete ekle:\n"
                        "      docs/GORSEL-REHBERI.md, Yol 2",
                        file=sys.stderr,
                    )
                    return 3
                # 429/5xx geçici: bekleyip tekrar dene
                if e.code in (429, 500, 503) and deneme < 2:
                    bekle = 5 * (deneme + 1)
                    print(f"  HTTP {e.code}, {bekle} sn sonra tekrar...")
                    time.sleep(bekle)
                    continue
                print(f"  HATA HTTP {e.code}: {govde[:200]}")
                basarisiz.append(f"{klasor}/{ad}")
                break
            except Exception as e:  # noqa: BLE001
                if deneme < 2:
                    print(f"  {type(e).__name__}, tekrar deneniyor...")
                    time.sleep(4)
                    continue
                print(f"  HATA: {e}")
                basarisiz.append(f"{klasor}/{ad}")
                break
        time.sleep(1.5)  # hız sınırına saygı

    print(f"\n{basarili} görsel üretildi.")
    if basarisiz:
        print("Başarısız:", ", ".join(basarisiz))
    print("\nGörseller konulduğu anda oyunda görünür — kod değişikliği gerekmez.")
    print("Künyeyi docs/LISANSLAR.md dosyasına eklemeyi unutma.")
    return 1 if basarisiz else 0


if __name__ == "__main__":
    sys.exit(main())
