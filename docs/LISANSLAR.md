# Üçüncü Taraf Varlıklar ve Lisanslar

## İkonlar — game-icons.net

Oyundaki birim, kaynak ve bölge ikonları **game-icons.net** koleksiyonundan
alınmıştır.

- **Lisans:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Kaynak:** https://game-icons.net
- **Paket:** `@iconify-json/game-icons` (npm, devDependency)

CC BY 3.0 eser sahibinin belirtilmesini şart koşar. Kullanılan ikonların
çizerleri:

| İkon | Kullanım | Çizer |
|---|---|---|
| `pitchfork` | Köylü Milis | Delapouite |
| `spears` | Mızrakçı | Lorc |
| `archer` | Okçu | Delapouite |
| `cavalry` | Süvari | Delapouite |
| `catapult` | Mancınık | Delapouite |
| `broadsword` | Saldırı | Lorc |
| `shield` | Savunma | Lorc |
| `health-normal` | Can | Lorc |
| `wingfoot` | Hız | Lorc |
| `flying-flag` | Komuta yeri | Lorc |
| `two-coins` | Altın | Lorc |
| `metal-bar` | Demir | Delapouite |
| `wheat` | Erzak, Tarla | Lorc |
| `hourglass` | Süre | Lorc |
| `hazard-sign` | Uyarı | Lorc |
| `gold-mine` | Maden | Delapouite |
| `village` | Şehir | Delapouite |
| `castle` | Kale | Delapouite |
| `throne-king` | Taht Kalesi | Delapouite |

Bu künye oyunun arayüzünde de gösterilir (giriş ekranı altbilgisi).

### Neden bu koleksiyon

İkonlar önce elle çizilmişti; "atıf yükü olmasın" gerekçesiyle hazır
koleksiyonlar elenmişti. Yanlış bir dengeydi: atıf bu dosyadan ibaret,
karşılığında tek elden çıkmış, tutarlı ve gerçekten çizilmiş 4134 görsel var.
Elle çizilen çizgi ikonlar birimin ne olduğunu anlatıyordu ama oyunu oyun gibi
hissettirmiyordu.

## Yazı tipi — Cinzel

Başlıklarda kullanılır. [SIL Open Font License 1.1](https://openfontlicense.org/),
Google Fonts üzerinden yüklenir. Künye şartı yoktur.

## Üretilen görseller

`apps/web/public/gorseller/` altındaki illüstrasyonlar `tools/gorsel-uret.py`
ile Google Generative Language API üzerinden üretilir. Üretilen görsellerin
kullanım hakları sağlayıcının şartlarına tabidir; ticari kullanım öncesinde
Google'ın o anki kullanım koşullarını doğrula.

Hazır paketten görsel eklersen paketin adını, kaynağını ve lisansını buraya
yaz — hem ticari kullanıma hem yeniden dağıtıma izin verdiğini önceden
doğrula.

## Oyunun kendi içeriği

Harita, denge verisi, general kadrosu, metinler ve kod bu projeye aittir.

---

## İllüstrasyonlar — proje sahibi tarafından üretildi

`apps/web/public/gorseller/` altındaki boyalı görseller oyunun sahibi
tarafından, `docs/GORSEL-ISTEMLERI.md` içindeki istemlerle üretilmiştir.
Üçüncü taraf bir eserden alınmadıkları için künye zorunluluğu yoktur.

Üreten araç görselleri çoğu zaman tek bir sayfa olarak veriyor;
`tools/gorsel-ayikla.py` sayfayı figürlere ayırıp saydam zeminli 512×512
WebP olarak yazar. Kaynak sayfalar depoya konmaz — depoda oyunun kullandığı
kesilmiş dosyalar durur.

| Dosya | Durum |
|---|---|
| `birimler/milis.webp` | eklendi |
| `birimler/mizrakci.webp` | eklendi |
| `birimler/okcu.webp` | eklendi |
| `birimler/suvari.webp` | eklendi |
| `birimler/kusatma.webp` | eklendi |
| `bolgeler/*` (5) | bekliyor — siluet gösteriliyor |
| `generaller/*` (12) | bekliyor — siluet gösteriliyor |

İllüstrasyonu olmayan varlıklarda game-icons silueti görünmeye devam eder,
yani künye yukarıdaki tabloyla birlikte geçerliliğini korur.
