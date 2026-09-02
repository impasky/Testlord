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
`tools/gorsel-ayikla.py` sayfayı parçalara ayırıp 512×512 WebP olarak yazar.
Kaynak sayfalar depoya konmaz — depoda oyunun kullandığı kesilmiş dosyalar
durur.

Bazı araçlar çıktının bir köşesine kendi işaretini koyuyor. Oyunun içinde
başka bir ürünün işareti taşınmasın diye bunlar `tools/filigran-sil.py` ile
temizleniyor; hangi dosyada yapıldığı aşağıdaki tabloda yazıyor.

| Dosya | Durum |
|---|---|
| `birimler/milis.webp` | eklendi |
| `birimler/mizrakci.webp` | eklendi |
| `birimler/okcu.webp` | eklendi |
| `birimler/suvari.webp` | eklendi |
| `birimler/kusatma.webp` | eklendi |
| `bolgeler/tarla.webp` | eklendi |
| `bolgeler/maden.webp` | eklendi |
| `bolgeler/sehir.webp` | eklendi |
| `bolgeler/kale.webp` | eklendi |
| `bolgeler/taht.webp` | eklendi (köşe filigranı silindi) |
| `generaller/*` (12 dosya) | eklendi |
| `zeminler/malikane.webp` | eklendi (işaret silindi) |
| `zeminler/kisla.webp` | eklendi (işaret silindi) |
| `zeminler/demirhane.webp` | eklendi (işaret silindi) |
| `zeminler/generaller.webp` | eklendi (işaret silindi) |
| `zeminler/siralama.webp` | eklendi (işaret silindi, tam ayna) |
| `zeminler/giris.webp` | eklendi (işaret silindi) |
| `ekipman/silah_t1..t5.webp` | eklendi (zemin ayıklandı, saydam) |
| `ekipman/kalkan_t1..t5.webp` | eklendi (zemin ayıklandı, saydam) |
| `ekipman/zirh_t1..t5.webp` | eklendi (T2–T5 işaret silindi, zemin ayıklandı) |
| `ekipman/migfer_t1..t5.webp` | eklendi (işaret silindi, zemin ayıklandı) |

Ekipman ikonlarında filigran yoktu; onlarda yapılan iş zemin ayıklama.
Yirmisinde de eşik 8 ölçüldü. Silinen zemin kılıçlarda %81–87,
kalkanlarda %50–57, zırhlarda %48–57, miğferlerde %60–67 — aradaki fark
nesnenin biçimi: çapraz bir kılıç ince, kalkan ve zırh kareyi dolduruyor,
miğfer ikisinin arasında.

Kapalı boşluklar korundu: zırhlarda yakanın içindeki karanlık oyuk,
miğferlerde göz yarıkları ve T1'in çene kayışındaki halka. Hepsi zemin
tonuna yakın ama görüntü kenarına bağlı değil — ayıklamanın bağlılık
şartı tam da bunun için. Envanterde otuz ikon yan yana dizildiği için zeminin
üreticiye göre değişmesi ızgarayı yamalı gösteriyordu; saydam olunca
arayüzün kendi oyuğu görünüyor.

Ekran zeminlerindeki işaret köşeye yapışık değil, kenardan bir tutam
içerideydi; `filigran-sil.py`'nin köşe kutusu onu ancak yarım yakalıyordu.
Araca `--kutu` eklendi ve altısı `tools/gorsel-koy.py` ile aynı işlemden
geçirildi. Sıralama'da yerel yansıma taş basamakta ters V bırakıyordu,
salon simetrik olduğu için `--tam-ayna` dikişsiz sonuç verdi.

O aşamadaki 22 görselin tamamı eklendi. game-icons ikonları arayüzde kullanılmaya devam
ediyor (kaynak sayaçları, stat satırları, gezinme, harita hex'leri), o yüzden
yukarıdaki künye geçerliliğini koruyor.

Generaller 4×4 grid olarak geldi: 16 kare, 12 general. Fazlalıklar
`gorsel-ayikla.py`'ye isim yerine `-` verilerek atlandı; silmek yerine yerinde
atlamak kalan isimlerin sırasını bozmuyor.
