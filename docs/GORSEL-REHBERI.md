# Görsel Rehberi — gerçek illüstrasyon nasıl eklenir

Oyun şu an **game-icons.net siluetleri** kullanıyor. Bunlar bedava, tutarlı ve
her şeyi kapsıyor ama boyalı illüstrasyon değil. Gerçek çizim eklemek için kod
değiştirmen gerekmiyor: **dosyayı doğru klasöre doğru adla koy, yeter.**

Dosya varsa illüstrasyon görünür, yoksa siluet görünmeye devam eder. Yani
yarısı çizilmişken de oyun tutarlı durur; birim birim ilerleyebilirsin.

## Nereye koyulacak

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
| Arka plan | **Saydam** — madalyon zaten dairesel çerçeve çiziyor |
| Dosya boyutu | Tane başına 80 KB altı hedefle |
| Kadraj | Nesne kareyi doldursun, kenarlarda %8 boşluk bırak |

PNG'den WebP'ye çevirmek için: `cwebp -q 82 girdi.png -o cikti.webp`

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
