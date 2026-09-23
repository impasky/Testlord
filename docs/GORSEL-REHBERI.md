# Görsel Rehberi

Oyunun 77 görseli var: 5 birim, 12 general, 13 bölge sahnesi (5 taban +
8 gelişim aşaması), 30 ekipman (6 yuva × 5 tier), 6 harita karosu, 6 ekran zemini ve
5 lord figürü. Dört yoldan eklenebilir. **Birincisi en az emek isteyendir:
Claude hepsini kendisi üretir** — ama ücretli. Bedava olanlar Yol 2 (elle)
ve Yol 3 (kendi bilgisayarında, ComfyUI).

Sayılar burada da tutuluyor ama tek kaynak `tools/gorsel-uret.py`;
güncel dökümü `python3 tools/gorsel-uret.py --liste` verir.

Oyun şu an **game-icons.net siluetleri** kullanıyor. Bunlar bedava, tutarlı ve
her şeyi kapsıyor ama boyalı illüstrasyon değil. Görsel eklemek için kod
değiştirmek gerekmiyor: **dosya doğru klasörde doğru adla varsa görünür**,
yoksa siluet kalır. Yani yarısı hazırken de oyun tutarlı durur.

---

## Yol 1 — Claude üretsin (önerilen)

Bu ortamda dışarıya çıkış kısıtlı. **Ölçüldü, tahmin değil** — on beş görsel
ucu tek tek yoklandı ve yalnız Google'ınkiler açık çıktı:

| Kapalı (CONNECT reddi)                                                                                                                 | Açık                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| OpenAI, Stability, Replicate, fal, HuggingFace, Together, Fireworks, Novita, SiliconFlow, getimg, BFL, **Pollinations**, **DeepInfra** | `generativelanguage.googleapis.com`, `aiplatform.googleapis.com` |

Yani "anahtar istemeyen bedava servis" diye bir çıkış yolu yok: anahtarsız
servislerin hepsi ağ politikasıyla kapalı. Claude'un kendi başına görsel
üretebilmesinin **tek yolu** bu bölümdeki anahtar.

Bunun anlamı şu: anahtar bir kez ortam değişkenlerine eklendiğinde Claude
görsel için bir daha sana ihtiyaç duymaz — istemi de kendisi yazar, üretir,
doğru boyutta WebP olarak yerine koyar. Anahtar yoksa görselleri sen
üretip sohbete eklemek zorundasın (Yol 2).

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
söyler — 77 görsel için sırayla boşuna beklemez.

## Yol 2 — Sen üret, sohbete ekle (bedava)

Anahtar ya da ödeme istemiyorsan: görselleri istediğin yerde üret (Claude uygulaması,
Midjourney, ne olursa) ve Claude'a ulaştır. Claude dosyaları alıp kırpar,
dönüştürür, doğru adla depoya koyar (`tools/gorsel-koy.py`). Hangi görselin
hangi dosya olduğunu söylemen yeterli.

**Nasıl ulaştıracağın önemli:** sohbete eklemek her zaman çalışmıyor —
görüntü görünüyor ama dosya diske inmiyor ve işlenemiyor. Güvenilir yol
**[docs/GORSEL-TESLIM.md](GORSEL-TESLIM.md)**: ham görselleri geçici bir
dala yükle, Claude oradan alsın.

77 istemin kopyala-yapıştır hali: **[docs/GORSEL-ISTEMLERI.md](GORSEL-ISTEMLERI.md)** —
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

## Yol 3 — Kendi bilgisayarında üret: ComfyUI (bedava)

Ekran kartın varsa görseller hiçbir servise para ödemeden, kendi
bilgisayarında üretilebilir. `tools/comfy-uret.py` açık bir ComfyUI'ye
bağlanır ve **aynı istemleri** (`gorsel-uret.py`) **aynı işlemeden**
(magenta anahtarı, saydam kesim, tabana hizalama, WebP) geçirir. Yani
yerelde üretilen kılıç, Gemini'nin ürettiği kılıçla aynı kalıptan çıkar.

Bu yolun Claude'un ortamında çalışmadığını bil: oradan senin bilgisayarına
erişim yok. Script senin bilgisayarında, ComfyUI açıkken çalışır.

### Kurulum (tek seferlik)

1. **ComfyUI** kur ve aç. Masaüstü uygulaması da olur, taşınabilir sürüm de;
   script ikisini de kendisi bulur (8188 ve 8000 portları).
2. **Deponun bir kopyası** bilgisayarında olsun (GitHub Desktop ile
   "Clone" ya da `git clone`).
3. **Python** (python.org, kurarken "Add to PATH" işaretli) ve kütüphaneler:
   ```bash
   pip install pillow numpy scipy
   ```
4. **Model**: ne indireceğini ekran kartına bakıp script söyler:
   ```bash
   python tools/comfy-uret.py --durum
   ```
   İndirdiğin dosyayı `ComfyUI/models/checkpoints/` içine koy, ComfyUI'yi yenile.

| Ekran kartı belleği | Model                                                                         | Lisans                                 |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| 12 GB ve üstü       | **FLUX.1 schnell** — `Comfy-Org/flux1-schnell` → `flux1-schnell-fp8` (~17 GB) | Apache-2.0, ticari kullanım serbest    |
| 6–12 GB             | **SDXL 1.0** — `stabilityai/stable-diffusion-xl-base-1.0` (~7 GB)             | Open RAIL++-M, ticari kullanım serbest |
| 8 GB + 32 GB RAM    | FLUX.1 schnell yine denenebilir: daha yavaş, genelde daha iyi                 |                                        |
| 6 GB altı           | Pratik değil; önemli görseller için Yol 2                                     |                                        |

**FLUX.1 dev kullanma**: lisansı ticari kullanımı yasaklıyor ve bu ticari
bir oyun. İnternetteki "ince ayarlı" modellerin (Juggernaut vb.) lisansı da
tek tek farklı; indirdiğin sayfadan ticari kullanıma izin verdiğini doğrula.

### Kullanım

```bash
python tools/comfy-uret.py zeminler/pazar            # 4 aday üretir
python tools/comfy-uret.py ekipman/silah_t3 --aday 8 # daha çok aday
python tools/comfy-uret.py ekipman-silah             # beş kılıç tek karede (sayfa)
python tools/comfy-uret.py birimler/okcu --rotus     # oyundakini üstünden yeniden boya
python tools/comfy-uret.py --liste                   # ne üretilebilir
```

Script **aday** üretir, oyuna dokunmaz. Adaylar `tools/comfy-aday/` altına
yazılır (depoya girmez) ve yanlarına numaralı bir kontak sayfası konur
(`_zeminler__pazar.jpg`). Yerel modelin isabeti Gemini'ninkinden düşük ama
üretmek bedava, o yüzden doğru iş akışı "dört üret, en iyisini seç".

**Beğendiğini Claude'a ulaştır** — dosyayı olduğu gibi `gorsel-gelen`
dalının `gelen/` klasörüne yükle ([GORSEL-TESLIM.md](GORSEL-TESLIM.md)).
Dosya adı (`zeminler__pazar__3.png`) neyin ne olduğunu zaten söylüyor;
Claude şunu çalıştırıp oyuna koyar:

```bash
python3 tools/comfy-uret.py --koy gelen/zeminler__pazar__3.png
```

İstersen `--koy`'u kendin de çalıştırabilirsin; ama o zaman çalışma dalına
senin bilgisayarından da yazılır ve iki taraf aynı dala yazarken çakışma
çıkabilir. Yüklemek daha sade.

### Hangi yol, ne zaman

Script adı görünce işleme yolunu kendisi seçer:

- **Ekran zemini, yerleşim, akın, harita** gibi sahneler olduğu gibi kırpılır.
- **Bina, birim, ekipman, general, lord** gibi sprite'lar magenta zeminde
  tek figür olarak çizdirilir ve saydam 512×512'ye kesilir. **Bir tanesini**
  yeniliyorsan tek başına üretim (`ekipman/silah_t3`) her zaman temiz
  bölünür. **Bir aileyi** birden yeniliyorsan sayfa (`ekipman-silah`) beşini
  aynı karede çizdirir ve birbirinin akrabası yapar; ama yerel modeller
  "tam beş ayrı nesne" talimatını her seferinde tutturamıyor, tutturamazsa
  bölücü hiçbir şey yazmaz, başka adayı dene. Sayfa işi için FLUX, SDXL'den
  belirgin iyi.
- **Bölge afişleri** (`bolgeler/tarla`) 1152×768 tek sahne olarak üretilir.

`--rotus` oyundaki görseli girdi alır ve **kompozisyonunu koruyarak**
yeniden boyar; `--guc` (0–1, varsayılan 0.45) ne kadar uzaklaşacağını
söyler. Duruşu beğenip işçiliğini beğenmediğin bir görsel için doğru araç.
Aynı `--tohum` aynı resmi verir; beğendiğin bir adayın tohumunu çıktıdan
okuyup ayarla oynayabilirsin.

ComfyUI arayüzünde elle çalışmak istersen akışı dosyaya yazdır ve pencereye
sürükle: `python tools/comfy-uret.py zeminler/pazar --akis > akis.json`

## Yol 4 — Hazır paket satın al

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

|              |                                                    |
| ------------ | -------------------------------------------------- |
| Biçim        | **WebP** (PNG'den ~%30 küçük, saydamlık destekler) |
| Boyut        | **512×512** kare                                   |
| Arka plan    | **Koyu düz zemin** — saydam değil                  |
| Dosya boyutu | Tane başına 80 KB altı hedefle                     |
| Kadraj       | Nesne kareyi doldursun, kenarlarda %8 boşluk bırak |

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
