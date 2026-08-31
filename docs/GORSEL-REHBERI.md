# Görsel Rehberi

Oyunun 22 görseli var: 5 birim, 5 bölge tipi, 12 general. Üç yoldan
eklenebilir. **Birincisi tercih edilendir: Claude hepsini kendisi üretir.**

Oyun şu an **game-icons.net siluetleri** kullanıyor. Bunlar bedava, tutarlı ve
her şeyi kapsıyor ama boyalı illüstrasyon değil. Görsel eklemek için kod
değiştirmek gerekmiyor: **dosya doğru klasörde doğru adla varsa görünür**,
yoksa siluet kalır. Yani yarısı hazırken de oyun tutarlı durur.

---

## Yol 1 — Claude üretsin (önerilen)

Bu ortamda dışarıya çıkış kısıtlı: OpenAI, Stability, Replicate ve fal
kapalı. Ama **`generativelanguage.googleapis.com` açık** — Google'ın görüntü
üretme API'si buradan çalışıyor. Tek eksik bir anahtar.

> **Önce maliyeti bil — bu yol bedava değil.** Gemini'nin görsel modellerinde
> ücretsiz katman **yok**. Faturalandırma bağlı olmayan geçerli bir anahtarla
> denendi, API şunu döndü:
>
> ```
> 429 ... generate_content_free_tier_requests, limit: 0
> ```
>
> `limit: 0` — yani beklemekle geçecek bir hız sınırı değil, ücretsiz katmanda
> tek görsel bile üretilemiyor. Metin modelleri ücretsiz çalışıyor, görsel
> modelleri çalışmıyor. Üretmek için projeye Google Cloud'dan **faturalandırma
> bağlamak şart**; o andan itibaren anahtar ücret doğurabilir. 22 görsellik set
> kuruşlar mertebesinde (~1 dolar civarı) ama güncel fiyatı Google'ın kendi
> sayfasından doğrula. Ödeme istemiyorsan **Yol 2**'ye geç, sonuç aynı.

**Tek seferlik kurulum (telefondan da yapılabilir, ~2 dakika):**

1. https://aistudio.google.com/apikey → **Create API key**
2. Google Cloud Console'da o projeye faturalandırma hesabı bağla
   (bu adım atlanırsa script `limit: 0` deyip durur)
3. Anahtarı Claude Code ortam değişkenlerine **`GEMINI_API_KEY`** adıyla ekle
   (Claude Code web arayüzünde environment ayarları)

Anahtarı **sohbete yapıştırma** — sohbet kaydında kalır. Ortam değişkeni olarak
ver. Yapıştırdıysan AI Studio'dan o anahtarı sil ve yenisini oluştur.

Sonra tek komut:

```bash
python3 tools/gorsel-uret.py            # eksik olan 22 görselin hepsini üretir
python3 tools/gorsel-uret.py suvari     # sadece birini
python3 tools/gorsel-uret.py --zorla    # beğenmediklerini yeniden üret
python3 tools/gorsel-uret.py --liste    # ne üretilecek, üretmeden göster
```

Script her görseli üretir, kare kırpar, 512×512'ye ölçekler, WebP'ye çevirir
ve doğru klasöre yazar. Üslup tarifi dosyanın içinde **tek yerde** tutulur
(`USLUP` sabiti); tutarlılık buradan gelir ve tek satır değiştirerek tüm setin
havasını değiştirebilirsin.

Anahtar tanımlı değilse script hiçbir şey yapmaz, ne yapılması gerektiğini
söyler. Anahtar var ama faturalandırma yoksa ilk görselde durur ve sebebini
söyler — 22 görsel için sırayla boşuna beklemez.

## Yol 2 — Sen üret, sohbete ekle (bedava)

Anahtar ya da ödeme istemiyorsan: görselleri istediğin yerde üret (Claude uygulaması,
Midjourney, ne olursa) ve **bu sohbete ekle**. Claude dosyaları alıp kırpar,
dönüştürür, doğru adla depoya koyar. Hangi görselin hangi dosya olduğunu
söylemen yeterli.

22 istemin kopyala-yapıştır hali: **[docs/GORSEL-ISTEMLERI.md](GORSEL-ISTEMLERI.md)**.
O dosya elle yazılmaz, buradan üretilir:

```bash
python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md
```

## Yol 3 — Hazır paket satın al

Aşağıdaki "Hazır paket alıyorsan" bölümüne bak.

---

## Dosya yerleşimi

```
apps/web/public/gorseller/
  birimler/     milis.webp  mizrakci.webp  okcu.webp  suvari.webp  kusatma.webp
  generaller/   demirci_yusuf.webp  okcubasi_elif.webp  ...  (12 dosya)
  bolgeler/     tarla.webp  maden.webp  sehir.webp  kale.webp  taht.webp
```

General dosya adları `data/generals.json` içindeki `key` alanıyla birebir aynı
olmalı. Birim adları `data/balance.json` → `birimler` anahtarlarıyla aynı.

## Teknik gereksinimler

| | |
|---|---|
| Biçim | **WebP** (PNG'den ~%30 küçük, saydamlık destekler) |
| Boyut | **512×512** kare |
| Arka plan | **Koyu düz zemin** — saydam değil |
| Dosya boyutu | Tane başına 80 KB altı hedefle |
| Kadraj | Nesne kareyi doldursun, kenarlarda %8 boşluk bırak |

PNG'den WebP'ye çevirmek için: `cwebp -q 82 girdi.png -o cikti.webp`
(ya da `tools/gorsel-uret.py` içindeki `kaydet()` bunu zaten yapıyor.)

**Saydamlık neden değil:** görüntü üretme modelleri gerçek alfa kanalı
üretmez, "transparent background" istesen bile düz bir zemin çizer. Arayüz
zaten görseli yuvarlak köşeli, kenarlıklı bir kutuya oturtuyor — koyu düz
zemin orada çerçeveli portre gibi duruyor. Referans mobil oyunlar da bunu
yapıyor.

## Üslup — hepsi aynı dünyadan görünmeli

Oyunun paleti: koyu kahve zemin (`#14100c`), parşömen (`#e8dcc4`), altın
(`#d4a24c`), kan kırmızısı (`#a63d40`). İllüstrasyonlar bu paletle uyumlu
olmalı, yoksa yapıştırılmış gibi durur.

Tutarlılığın anahtarı: **hepsini aynı üslup tarifiyle üret.** Tek tek "güzel"
olan ama birbirini tutmayan görseller, tutarlı ama sade olanlardan daha kötü
görünür.

### Yapay zekâ ile üretiyorsan

Şu kalıbı kullan, sadece köşeli parantez içini değiştir:

```
[KONU], medieval fantasy game asset, painted illustration,
dark muted palette of deep browns and parchment cream with warm gold accents,
dramatic side lighting from the left, weathered and grounded — not shiny,
centered composition, full figure fills the frame,
transparent background, no text, no border, no frame,
consistent art style across a set, square 1:1
```

Konu örnekleri:

| Dosya | `[KONU]` |
|---|---|
| `birimler/milis.webp` | a ragged peasant militiaman holding a pitchfork, no armor |
| `birimler/mizrakci.webp` | a footman in chainmail with a long spear and kite shield |
| `birimler/okcu.webp` | an archer in leather armor drawing a longbow |
| `birimler/suvari.webp` | an armored knight on a warhorse with a couched lance |
| `birimler/kusatma.webp` | a wooden catapult siege engine, loaded |
| `bolgeler/tarla.webp` | golden wheat fields with a wooden barn |
| `bolgeler/maden.webp` | a mine entrance in a rocky hillside with ore carts |
| `bolgeler/sehir.webp` | a walled medieval market town from above |
| `bolgeler/kale.webp` | a stone fortress with towers on a crag |
| `bolgeler/taht.webp` | a grand throne hall, golden and imposing |

Generaller için portre: `a [bronz: seasoned/gümüş: veteran/altın: legendary]
medieval commander, [generalin karakteri], head and shoulders portrait`

Aynı oturumda ve aynı çekirdek (seed) ile üretmek tutarlılığı ciddi artırır.

### Hazır paket alıyorsan

Ortaçağ RPG paketleri için: **itch.io** (arama: "medieval RPG icons",
"fantasy unit portraits") ve **craftpix.net**. Çoğu 5–20 dolar, bazıları
ücretsiz. Tek bir çizerin paketini almak, farklı yerlerden toplamaktan
her zaman daha iyi sonuç verir.

**Lisansa dikkat:** paketin ticari kullanıma ve yeniden dağıtıma izin verdiğini
doğrula, sonra `docs/LISANSLAR.md` dosyasına künyeyi ekle.

### Kamu malı seçeneği

Met Museum ve Rijksmuseum açık erişim koleksiyonlarında ortaçağ gravürleri ve
minyatürleri var — telifsiz ve gerçekten dönemsel. Çok özgün bir görünüm verir
ama her birini kesip temizlemek gerekir; emek ister.

## Eklendikten sonra

Hiçbir şey. Sunucuyu yeniden başlatmaya bile gerek yok — `pnpm dev`
çalışıyorken dosyayı koyunca sayfayı yenilemen yeter.

Eklediğin görselleri `docs/LISANSLAR.md` dosyasına kaydetmeyi unutma.
