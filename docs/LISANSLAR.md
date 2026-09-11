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

Görsellerin bir kısmı elle (sohbet arayüzlerinden), bir kısmı proje
sahibinin Google AI Studio anahtarıyla `tools/gorsel-uret.py` üzerinden
üretildi. İkisi de aynı istem dosyasını kullanıyor, o yüzden üslup tek.
`zeminler/arastirma.webp` ikinci yolla üretilen ilk görsel
(`gemini-3.1-flash-image`).

Üreten araç görselleri çoğu zaman tek bir sayfa olarak veriyor;
`tools/gorsel-ayikla.py` sayfayı parçalara ayırıp 512×512 WebP olarak yazar.
Kaynak sayfalar depoya konmaz — depoda oyunun kullandığı kesilmiş dosyalar
durur.

Bazı araçlar çıktının bir köşesine kendi işaretini koyuyor. Oyunun içinde
başka bir ürünün işareti taşınmasın diye bunlar `tools/filigran-sil.py` ile
temizleniyor; hangi dosyada yapıldığı aşağıdaki tabloda yazıyor.

| Dosya                          | Durum                                             |
| ------------------------------ | ------------------------------------------------- |
| `birimler/milis.webp`          | eklendi                                           |
| `birimler/mizrakci.webp`       | eklendi                                           |
| `birimler/okcu.webp`           | eklendi                                           |
| `birimler/suvari.webp`         | eklendi                                           |
| `birimler/kusatma.webp`        | eklendi                                           |
| `bolgeler/tarla.webp`          | eklendi                                           |
| `bolgeler/maden.webp`          | eklendi                                           |
| `bolgeler/sehir.webp`          | eklendi                                           |
| `bolgeler/kale.webp`           | eklendi                                           |
| `bolgeler/taht.webp`           | eklendi (köşe filigranı silindi)                  |
| `generaller/*` (12 dosya)      | eklendi                                           |
| `zeminler/malikane.webp`       | eklendi (işaret silindi)                          |
| `zeminler/kisla.webp`          | eklendi (işaret silindi)                          |
| `zeminler/demirhane.webp`      | eklendi (işaret silindi)                          |
| `zeminler/generaller.webp`     | eklendi (işaret silindi)                          |
| `zeminler/siralama.webp`       | eklendi (işaret silindi, tam ayna)                |
| `zeminler/giris.webp`          | eklendi (işaret silindi)                          |
| `ekipman/silah_t1..t5.webp`    | eklendi (zemin ayıklandı, saydam)                 |
| `ekipman/kalkan_t1..t5.webp`   | eklendi (zemin ayıklandı, saydam)                 |
| `ekipman/zirh_t1..t5.webp`     | eklendi (T2–T5 işaret silindi, zemin ayıklandı)   |
| `ekipman/migfer_t1..t5.webp`   | eklendi (işaret silindi, zemin ayıklandı)         |
| `ekipman/at_t1..t5.webp`       | eklendi (işaret zeminlendi, zemin ayıklandı)      |
| `ekipman/sancak_t1..t5.webp`   | eklendi (işaret zeminlendi, zemin ayıklandı)      |
| `lord/lord_1..5.webp`          | eklendi (zincirleme düzenleme, zemin ayıklandı)   |
| `yerlesim/*.webp` (6 dosya)    | eklendi (filigran çıkmadı)                        |
| `binalar/*.webp` (24 dosya)    | eklendi (çizilmiş dama silindi, saydam)           |
| `harita/dunya.webp`            | eklendi (kare, çerçevesiz — ikinci deneme)        |
| `akin/*.webp` (5 dosya)        | eklendi (filigran çıkmadı)                        |
| `zeminler/akin.webp`           | eklendi (filigran çıkmadı)                        |
| `akin_harita/*.webp` (5 dosya) | eklendi (plakadan, kampsız)                       |
| `dusmanlar/*.webp` (10 dosya)  | eklendi (iki beşerli sayfa, plakadan)             |
| ~~`harita/*.webp` (6 dosya)~~  | **silindi** — altıgen karolar emekli (docs/12 §5) |
| `birimler/*.webp` (5 dosya)    | **yenilendi** (tek sayfa, plakadan)               |
| `generaller/*.webp` (8 dosya)  | **yenilendi** (iki dörtlü sayfa, plakadan)        |
| `ekipman/*.webp` (30 dosya)    | **yenilendi** (yuva başına bir sayfa, plakadan)   |
| `bolgeler/*.webp` (13 dosya)   | **yenilendi** (bölge başına bir pano sayfası)     |

Lord figürleri zincirleme düzenlemeyle üretildi: `lord_1` metinden,
sonrakiler bir öncekini girdi alarak. Beşinde de işaret aynı yerdeydi ama
`lord_4`te **pelerinin üstüne** düşmüştü — orada zemin rengiyle doldurmak
pelerinde delik açardı, komşu şeridin aynası kullanıldı. Diğer dördü düz
zemindeydi, doldurma yeterliydi.

**Yerleşim zeminleri (kamp, köy, kasaba, şehir, kale, metropol).** Şehir
sayfasının altındaki resim; kademe yükseldikçe değişiyor. Altısında da
filigran çıkmadı, düzeltme gerekmedi.

Bu altısının istemi bir kural taşıyor: **manzara kenarlara, orta alan
boş.** Binalar zeminin ÜSTÜNE DOM olarak konuyor (`data/binalar.json`
x/y yüzdeleri); zeminde de bina çizilseydi iki kat bina görünürdü.
Modelden gelen altı görselde de kural tuttu.

Altıgen harita karoları (`harita/*.webp`) **silindi**: dünya haritası
artık ızgara değil, çizilmiş tek bir zemin. Dosyalar duruyordu ama
hiçbir ekran onları çağırmıyordu.

Ekipman ikonlarında filigran yoktu; onlarda yapılan iş zemin ayıklama.
Otuzunda da eşik 8 ölçüldü. Silinen zemin %48 ile %87 arasında; aradaki
fark nesnenin biçimi — çapraz bir kılıç ya da ince bir sancak az yer
kaplıyor, kalkan ve zırh kareyi dolduruyor.

Otuzu da içeriğe kırpıldı ve konunun kareyi doldurma oranı %94'e
sabitlendi. Kırpmadan önce bu oran %79 ile %96 arasında oynuyordu:
tek başına bakınca fark edilmiyor ama envanterde alt alta dizilince bazı
eşyalar diğerlerinden küçük görünüyordu — nadirlik ya da tier farkıymış
gibi, ki değil.

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

**Bina işaretçileri ve yerleşim zeminleri YENİDEN ÜRETİLDİ — sayfa
düzeniyle.** Aşağıdaki tek tek üretim hikâyesi tarihe karıştı; neden
karıştığı docs/12 §9.1'de. Özeti: 24 bina 24 ayrı çağrıyla üretilmişti ve
her birinin kendi kamerası, kendi güneşi vardı. Şimdi bir stil plakası
var, binalar dörtlü sayfalar hâlinde ve her sayfa o plakadan üretiliyor.

Akın diyarları (5), akın ekran zemini ve dünya haritası da aynı plakadan
geçti: oyuncu ard arda üç ekran geziyor ve şehir toparlanınca geri kalanı
ondan kopuk kalmıştı. Kamera devralınmıyor — plaka izometrik bir bina,
diyar geniş bir manzara, harita tepeden bir parşömen; ortak olan ışık,
palet ve fırça.

Zemin saydam değil DÜZ MAGENTA isteniyor; ayıklama `gorsel-ayikla.py`de
gerçek bir chroma anahtarıyla yapılıyor (kromatiklik + despill). Model
her binanın altına gölge çizdi: parlaklığa bakan bir eşik onları figür
sayıp sprite'ın altında pembe leke bırakıyordu, kromatiklik ise gölgeyi
kendiliğinden ayıklıyor — koyu magenta yine magenta. Kenarda kalan iz de
despill ile nötrleniyor.

**Aşağısı ESKİ yöntemin kaydı (tek tek üretim).**

**Bina işaretçileri (24 dosya) — model saydamlığı ÇİZDİ.** İstem "isolated
on a fully transparent background" diyordu; gelen dosyalarda alfa kanalı
yoktu, onun yerine düzenleyicilerin saydamlık dama deseni gerçek piksel
olarak boyanmıştı. Yirmi dördünde de aynı hata.

`gorsel-ayikla.py` bunu çözemedi ve çözmemeli: orası çok figürlü bir sayfayı
bölen araç ve zemini kenar MEDYANI ile buluyor. Dama tek renk değil; medyan
iki tonun arasına düşüyor ve her iki ton da eşiğin dışında kalıyor, yani
dama "figür" sayılıyor. Bunun için `tools/dama-sil.py` yazıldı.

Ayırt edici ölçüt DESEN: dama yerel olarak iki tonludur — bir karelik
pencerede alt yüzdelik koyu tona, üst yüzdelik açık tona oturur. Düz bir
yüzey, rengi ne olursa olsun, bu testi geçemez. Bu gerekli çıktı: ilk
denemede "iki tondan birine yakın gri" eşiği kullanıldı ve `arsa.webp`in
koyu ahşabı tam o aralığa düştüğü için bina ortasından yendi.

Araç aynı dosyaya ikinci kez uygulanmaz: alfa açılıyor ama dama RGB'de
duruyor (küçültmedeki hale gri kalsın diye), yani alfası atılınca desen geri
gelir. `zaten_saydam` kontrolü bu yüzden var.

Sprite'lar sonradan bir hizalama pasosundan geçti
(`tools/sprite-hizala.py`): alfa sınırına kırpılıp ortak bir zemin
çizgisine oturtuldular. Ölçüldüğünde alt boşlukları %3 ile %12 arasında
geziyordu — aynı kutuya konsalar bile binaların tabanı aynı yere denk
gelmiyordu. Kare tuval korundu; kırpma dosyaların üstüne yazıldı.

**Dünya haritası iki kez üretildi.** İlki 4:3'tü ve parşömen çerçevesi
vardı; kap `aspect-square` + `object-cover` olduğu için yanları kırpılıyor
ve 61 işaretçinin en dıştakileri kırpılan şeride düşüyordu. İkincisi kare,
çerçevesiz ve kara çerçeveyi dolduruyor.

Zemin kilitlendikten sonra işaretçiler ona oturtuldu (docs/12 §9 üretim
sırası): eski düzen altıgen ızgaradan kalma düzgün bir kafesti ve 20
işaretçi suya düşüyordu. `tools/harita-yerlestir.py` yalnız suya düşenleri
en yakın uygun karaya taşıdı; taşımaların çoğu 1–2 puan. Denetimi
`tools/generate_map.py` yapıyor.

Generaller 4×4 grid olarak geldi: 16 kare, 12 general. Fazlalıklar
`gorsel-ayikla.py`'ye isim yerine `-` verilerek atlandı; silmek yerine yerinde
atlamak kalan isimlerin sırasını bozmuyor.

**Eski çağdan kalan aileler de sayfaya geçti (docs/12 §9.2).** Birimler,
generaller, ekipman ve bölge sahneleri tek tek üretilmişti; şimdi hepsi
plakadan gelen sayfalarla üretiliyor. Sayfa düzeni üçe ayrıldı: zemine
basan figür alta oturtuluyor, ikon ve portre ORTALANIYOR (çapraz duran
bir kılıcın tabanı yok), bölge panoları ise kırpılıp opak bırakılıyor.

Üç sayfa bu turda **kullanılmadı** ve eski görselleri yerinde bırakıldı:

- `lord` (5 figür) ve `general-2` (4 portre) **bina döndü.** Sebep
  istemde: stil sözleşmesi "isometric game BUILDING asset" diye
  başlıyordu ve plakayı iliştiren cümle "Only the buildings change"
  diyordu — plaka da bir bina plakası. Model tutarlı davrandı, istem
  yanlıştı. Sözleşme öznesizleştirildi, özne klasör başına ayrı bir
  alana (`SAYFA_KONUSU`) taşındı ve istemin başına alındı.
- `bolge-kale` üç aşama yerine **tek sürekli kale** çizdi; üçe bölününce
  aynı yerin üç kırpıntısı kaldı. Pano tarifi artık panoların
  birbirinin devamı olmamasını açıkça istiyor.

Üçü düzeltilmiş istemle yeniden üretilecek (3 çağrı).

Miğfer sayfası beş yerine altı nesne döndürdü; fazlalık, istemdeki
tanıma bakılarak seçildi (T4 yaldızlı ve taşlı, T5 göktaşı ve rün) ve
`-` ile atlandı. Düşman sayfalarında da aynısı oldu: ikisinde de
dördüncü sırada ikinci bir barbar vardı.
