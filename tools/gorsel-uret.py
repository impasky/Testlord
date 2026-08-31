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

MALİYET (ölçüldü, tahmin değil):
  Görsel modellerinin ücretsiz katmanı YOK. Faturalandırma bağlı olmayan bir
  anahtarla denendiğinde API şunu döner:

    429 ... generate_content_free_tier_requests, limit: 0

  Yani anahtar geçerli olsa bile ücretsiz katmanda TEK görsel üretilemez;
  beklemek de işe yaramaz, çünkü limit sıfır. Üretim için projeye Google
  Cloud'dan faturalandırma bağlamak şart. Bunun karşılığı: anahtar artık
  ücret doğurabilir. 22 görsellik set kuruşlar mertebesinde (~1 dolar civarı)
  ama güncel fiyatı Google'ın kendi sayfasından doğrula.

  Faturalandırma açmak istemiyorsan: docs/GORSEL-REHBERI.md, Yol 2.

Çıktı: apps/web/public/gorseller/{birimler,generaller,bolgeler}/<ad>.webp
512x512, saydam zemin, ~%82 kalite.

Üslup tarifi tek yerde (USLUP). Tutarlılığın anahtarı bu: tek tek "güzel"
ama birbirini tutmayan görseller, tutarlı ama sade olanlardan kötü görünür.
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

# --- Üslup: her istemin sonuna eklenir. Tutarlılık buradan gelir. ---
USLUP = (
    "medieval fantasy game asset, painted semi-realistic illustration, "
    "warm cel-shaded rendering with soft airbrushed volume, "
    "dark muted palette of deep browns and parchment cream with warm gold accents "
    "and crimson highlights, dramatic side lighting from the upper left, "
    "weathered and grounded, not glossy, not cartoonish, "
    "centered composition filling the frame with a small margin, "
    "plain flat dark background, no text, no watermark, no border, no frame, "
    "square 1:1 composition"
)

# --- Ne üretilecek: klasör -> dosya adı -> konu ---
ISTEKLER: dict[str, dict[str, str]] = {
    "birimler": {
        "milis": "a ragged peasant militiaman gripping a pitchfork, no armor, "
                 "patched linen tunic, wary expression, full body",
        "mizrakci": "a footman in chainmail holding a long spear upright and a kite shield, "
                    "steady stance, full body",
        "okcu": "an archer in leather armor drawing a longbow, quiver at the hip, "
                "focused aim, full body",
        "suvari": "an armored knight on a barded warhorse with a couched lance, "
                  "charging pose, full body",
        "kusatma": "a wooden catapult siege engine loaded with a boulder, "
                   "rope tension visible, three-quarter view",
    },
    "bolgeler": {
        "tarla": "golden wheat fields with a wooden barn and a windmill on the horizon",
        "maden": "a timbered mine entrance in a rocky hillside with ore carts and a lift",
        "sehir": "a walled medieval market town seen from a low aerial angle, "
                 "tiled roofs and a market square",
        "kale": "a stone fortress with square towers on a rocky crag, banners flying",
        "taht": "a grand throne hall, golden throne on a stepped dais, "
                "tall columns and hanging banners",
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
}


def _tek_model_dene(model: str, konu: str, anahtar: str) -> bytes:
    govde = json.dumps(
        {
            "contents": [{"parts": [{"text": f"{konu}, {USLUP}"}]}],
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


def istek_at(konu: str, anahtar: str) -> bytes:
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
            ham = _tek_model_dene(model, konu, anahtar)
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


def _ucretsiz_katman_kapali(govde: str) -> bool:
    """
    429'un iki ayrı anlamı var, karıştırmamak gerekiyor:

      free_tier + "limit: 0"  -> ücretsiz katmanda görsel üretimi hiç açık
                                 değil. Beklemek işe yaramaz, faturalandırma
                                 açılana kadar tek görsel bile üretilmez.
      bunun dışındaki 429     -> gerçek hız sınırı; beklenip tekrar denenir.

    İlkini ikincisi sanmak, 22 görselin her biri için 15 saniye boşuna
    beklemek demek - üstelik sonunda hepsi başarısız.
    """
    return "free_tier" in govde and "limit: 0" in govde


def kaydet(ham: bytes, yol: Path) -> int:
    """512x512 WebP olarak kaydeder. Kare değilse ortadan kırpar."""
    from PIL import Image

    im = Image.open(BytesIO(ham)).convert("RGBA")
    g, y = im.size
    if g != y:
        k = min(g, y)
        im = im.crop(((g - k) // 2, (y - k) // 2, (g + k) // 2, (y + k) // 2))
    im = im.resize((512, 512), Image.LANCZOS)
    yol.parent.mkdir(parents=True, exist_ok=True)
    im.save(yol, "WEBP", quality=82, method=6)
    return yol.stat().st_size


def main() -> int:
    argv = [a for a in sys.argv[1:]]
    zorla = "--zorla" in argv
    sadece_liste = "--liste" in argv
    secilenler = {a for a in argv if not a.startswith("--")}

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
                ham = istek_at(konu, anahtar)
                boyut = kaydet(ham, yol)
                print(f"  tamam — {boyut / 1024:.0f} KB")
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
