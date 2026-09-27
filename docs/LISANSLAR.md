# Üçüncü Taraf Varlıklar ve Lisanslar

## İkonlar — game-icons.net

Oyundaki birim, kaynak ve bölge ikonları **game-icons.net** koleksiyonundan
alınmıştır.

- **Lisans:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Kaynak:** https://game-icons.net
- **Paket:** `@iconify-json/game-icons` (npm, devDependency)

CC BY 3.0 eser sahibinin belirtilmesini şart koşar. Kullanılan ikonların
çizerleri:

| İkon            | Kullanım     | Çizer      |
| --------------- | ------------ | ---------- |
| `pitchfork`     | Köylü Milis  | Delapouite |
| `spears`        | Mızrakçı     | Lorc       |
| `archer`        | Okçu         | Delapouite |
| `cavalry`       | Süvari       | Delapouite |
| `catapult`      | Mancınık     | Delapouite |
| `broadsword`    | Saldırı      | Lorc       |
| `shield`        | Savunma      | Lorc       |
| `health-normal` | Can          | Lorc       |
| `wingfoot`      | Hız          | Lorc       |
| `flying-flag`   | Komuta yeri  | Lorc       |
| `two-coins`     | Altın        | Lorc       |
| `metal-bar`     | Demir        | Delapouite |
| `wheat`         | Erzak, Tarla | Lorc       |
| `hourglass`     | Süre         | Lorc       |
| `hazard-sign`   | Uyarı        | Lorc       |
| `gold-mine`     | Maden        | Delapouite |
| `village`       | Şehir        | Delapouite |
| `castle`        | Kale         | Delapouite |
| `throne-king`   | Taht Kalesi  | Delapouite |

Bu künye oyunun arayüzünde de gösterilir (giriş ekranı altbilgisi).

### Neden bu koleksiyon

İkonlar önce elle çizilmişti; "atıf yükü olmasın" gerekçesiyle hazır
koleksiyonlar elenmişti. Yanlış bir dengeydi: atıf bu dosyadan ibaret,
karşılığında tek elden çıkmış, tutarlı ve gerçekten çizilmiş 4134 görsel var.
Elle çizilen çizgi ikonlar birimin ne olduğunu anlatıyordu ama oyunu oyun gibi
hissettirmiyordu.

## Yazı tipi — Rubik

Bütün arayüzde kullanılır. [SIL Open Font License 1.1](https://openfontlicense.org/),
© The Rubik Project Authors. Künye şartı yoktur; yazı tipini tek başına
satmak yasak, bir oyunla birlikte dağıtmak serbest.

Google Fonts'tan ÇEKİLMİYOR: `@fontsource-variable/rubik` paketiyle oyunun
kendi dosyalarına gömülü (`apps/web/src/main.tsx`). Oyuncunun IP'si her
açılışta üçüncü bir tarafa gitmesin diye — sebebi `apps/web/src/styles.css`
başında.

## Görseller — kodla çiziliyor

Oyundaki her resim — binalar, bölge sahneleri, birlikler, düşmanlar,
ekipman, generaller, lord, portreler, akın diyarları, ekran zeminleri ve
dünya haritasının arazisi — `apps/web/src/cizim/` altındaki kodla,
tarayıcıda SVG olarak çiziliyor. Hazır bir paketten, üçüncü taraf bir
eserden ya da bir görsel üretim modelinden gelen dosya yok; künye
zorunluluğu da yok. Nasıl çizildiği `docs/24-kodla-cizim.md`de.

Önceki dönemin boyalı görselleri, onları üreten ve ayıklayan araçlar ve
istem dosyaları depodan kaldırıldı. Uygulama simgeleri (`simge-*.png`)
ayrı: `tools/simge-uret.py` onları da kodla çiziyor.

## Oyunun kendi içeriği

Harita, denge verisi, general kadrosu, metinler ve kod bu projeye aittir.
