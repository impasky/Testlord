# Görsel Rehberi

Oyunun 72 görseli var: 5 birim, 12 general, 13 bölge sahnesi (5 taban +
8 gelişim aşaması), 30 ekipman (6 yuva × 5 tier), 6 harita karosu ve
6 ekran zemini. Üç yoldan eklenebilir. **Birincisi tercih edilendir:
Claude hepsini kendisi üretir.**

Sayılar burada da tutuluyor ama tek kaynak `tools/gorsel-uret.py`;
güncel dökümü `python3 tools/gorsel-uret.py --liste` verir.

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
> bağlamak şart**; o andan itibaren anahtar ücret doğurabilir. 72 görsellik set
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
python3 tools/gorsel-uret.py            # eksik olan görsellerin hepsini üretir
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
söyler — 72 görsel için sırayla boşuna beklemez.

## Yol 2 — Sen üret, sohbete ekle (bedava)

Anahtar ya da ödeme istemiyorsan: görselleri istediğin yerde üret (Claude uygulaması,
Midjourney, ne olursa) ve Claude'a ulaştır. Claude dosyaları alıp kırpar,
dönüştürür, doğru adla depoya koyar (`tools/gorsel-koy.py`). Hangi görselin
hangi dosya olduğunu söylemen yeterli.

**Nasıl ulaştıracağın önemli:** sohbete eklemek her zaman çalışmıyor —
görüntü görünüyor ama dosya diske inmiyor ve işlenemiyor. Güvenilir yol
**[docs/GORSEL-TESLIM.md](GORSEL-TESLIM.md)**: ham görselleri geçici bir
dala yükle, Claude oradan alsın.

72 istemin kopyala-yapıştır hali: **[docs/GORSEL-ISTEMLERI.md](GORSEL-ISTEMLERI.md)** —
öncelik sırasıyla birlikte (önce ekran zeminleri, sonra ekipman).

Araçlar görselleri çoğu zaman **tek sayfada** veriyor; sorun değil, ayıklanır:

```bash
# Figürler (birimler, generaller) — saydam zemin
python3 tools/gorsel-ayikla.py sayfa.png birimler milis mizrakci okcu suvari kusatma

# Dikdörtgen illüstrasyonlar (bölgeler) — opak, kareye kırpılır
python3 tools/gorsel-ayikla.py sayfa.png --pano bolgeler tarla maden sehir kale taht

# Ne bulduğunu yazmadan göster
python3 tools/gorsel-ayikla.py sayfa.png --onizleme
```

İsimler okuma sırasında verilir: üstten alta satırlar, her satırda soldan
sağa. Bulunan parça sayısı isim sayısıyla tutmuyorsa hiçbir şey yazılmaz.

Bazı araçlar köşeye kendi işaretini koyuyor:

```bash
python3 tools/filigran-sil.py <dosya>              # yerel yansıma
python3 tools/filigran-sil.py <dosya> --tam-ayna   # simetrik sahnelerde
python3 tools/filigran-sil.py <dosya> --onizleme   # yazmadan karşılaştır
```
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
                tarla_3.webp  ...  tarla_5.webp  ...   (gelişim aşamaları)
  ekipman/      silah_t1.webp ... sancak_t5.webp        (6 yuva × 5 tier)
  harita/       tarla.webp  maden.webp  sehir.webp  kale.webp  taht.webp  deniz.webp
  zeminler/     malikane.webp  kisla.webp  demirhane.webp
                generaller.webp  siralama.webp  giris.webp
```

Bölge aşama görselleri (`_3`, `_5`) seviye 3 ve 5'te devreye girer; yoksa
taban görsel kullanılmaya devam eder. Harita karoları bölge sahnelerinden
ayrıdır: sahneler üç çeyrek açıdan bakan tablolar, karolar tam tepeden
bakan arazi dokularıdır — sahneyi karo olarak kullanmak haritayı bulanık
bir kolaja çeviriyor.

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

İstemleri buraya kopyalamıyoruz. Tek kaynak **[docs/GORSEL-ISTEMLERI.md](GORSEL-ISTEMLERI.md)**:
72 görselin tamamı, kategori kompozisyonlarıyla ve ortak taban üslupla
birlikte, kopyala-yapıştır hâlinde orada. O dosya elle düzenlenmez;
`tools/gorsel-uret.py` içindeki `ISTEKLER` + `KATEGORI` + `TABAN_USLUP`
değiştikten sonra yeniden üretilir:

```bash
python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md
```

Buraya ikinci bir kopya koymanın tek sonucu, üslup değiştiğinde birinin
eskimesi olurdu.

Aynı oturumda ve aynı araçla üretmek tutarlılığı ciddi artırır.

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
