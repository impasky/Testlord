# 24 — Kodla çizim

Oyundaki her resim kodla çiziliyor. Binalar, yerleşim kademeleri, bölge
sahneleri, birlikler, düşmanlar, ekipman, generaller, lord, profil
portreleri, akın diyarları, ekran zeminleri ve dünya haritasının arazisi
`apps/web/src/cizim/` altında birkaç ilkel parçadan kuruluyor. Tarayıcıda
WebGL2 varsa GPU'da (piksel başına ışık, gölge, kenar yumuşatma), yoksa SVG
olarak çiziliyor. Depoda oyun için tek bir resim dosyası yok.

## Neden

Önceki dönemde görseller tek tek üretilip ayıklanıyordu (docs/11, docs/12
§9). Her dosyanın kendi kamerası, kendi güneşi, kendi fırçası vardı. Stil
plakası ve sayfa düzeni bunu azalttı ama bitirmedi: yan yana duran iki
resim hâlâ iki ayrı elden çıkmış gibi görünüyordu. Üstüne her dosyanın
arkasında filigran silme, dama ayıklama, hizalama ve kırpma işleri vardı.

Kodla çizimde tutarlılık kendiliğinden geliyor. Tek bir kamera, tek bir
ışık ve tek bir palet var. Bir bina, bir asker ve bir kılıç aynı
fonksiyonlardan geçtiği için aynı dünyanın parçası gibi duruyor. Bir
çizimi değiştirmek bir tarifi değiştirmek demek; dosya yeniden üretilmiyor.

## Motor (`uc.ts`)

Küçük bir 3B motor. Yöntem "low-poly" oyunlarınki:

- **Model** bir yüz listesi (`Yuz[]`). Her yüz düz, tek renk; köşeleri
  dışarıdan bakınca saat yönünün tersine sıralı.
- **İlkeller:** `kutu`, `prizma`, `silindir`, `koni`, `kure`, `kirmaCati`,
  `besikCati`, `mazgal`, `levha`. `parca.ts` bunlardan daha büyük
  parçalar kuruyor: `cubuk`, `uzuv`, `teker`, `kubbe`, ağaç, çam, bayrak,
  çadır, fıçı, duman.
- **Dönüşümler:** `tasi`, `olcekle`, `dondur`, `boya`, `katmanla`,
  `birlestir`.
- **Kamera:** `IZOMETRIK` (yön π/4, eğim π/6), ortografik. Eksenler: x ve
  y yer düzlemi, z yukarı. Kamera +x +y tarafından bakıyor.
- **Işık:** tek yönlü ışık, `ORTAM 0.46 + YAYGIN 0.58 · (n·L)`. Kendi
  ışığı olan yüzler (`isima`: ateş, pencere, büyü) gölgeden etkilenmez.
- **Sıralama:** önce `katman`, sonra derinlik (ressam algoritması). Arka
  yüzler atılıyor; bayrak, yaprak gibi ince şeyler `ciftYuz` ile iki
  taraftan çiziliyor.
- **Katmanlar:** arazi `-2`, yere yatık yol ve döşeme `-1.x`, nesneler
  `0`. Dev bir zemin yüzünün ortası sahnenin ortasında kaldığı için
  katman olmadan arkadaki duvarlar onun altında kalıyordu.
- **Pürüzsüzlük:** geometri low-poly kalıyor, pürüz almıyor.
  - Arazi ışığı her üçgenin kendi normalinden değil, köşe normallerinin
    ortalamasından (`gn`, gölgeleme normali) alıyor. Yamaç yüzden yüze
    sıçramadan aydınlanıyor; dünya haritası da aynı yolu izliyor.
  - Eğri yüzeylerin dilimleri (`yumusak`: silindir yanı, koni, küre,
    uzuv, kubbe) belli belirsiz bir kenarla çiziliyor; koyu kenar her
    dilimde yinelenince kule ve kafa tel kafes gibi okunuyordu.
  - Tariflerde 5 ve üstü dilim 1,5 katına çıkıyor (`dilim`); 4 ve altı
    bilerek köşeli (kare çatı, dört köşeli kule) kalıyor. Tohumlu bozulmalı
    kürenin (ağaç tacı, kaya) dilimi değişmiyor: bilerek topaklı, ve dizinin
    uzunluğu değişse sahnedeki ağaçların yeri kayardı.
  - Arazi rengindeki eşikler (`dikse kaya`) yumuşak geçişle (`gecis`)
    yazılıyor; sert eşikte her üçgen iki paletten birine düşüp yamaç yama
    yama görünüyordu.

`renk.ts` ortak paleti (`P`) ve `isikla` / `karistir` yardımcılarını
taşıyor. Renkler arayüzle aynı sıcaklıkta: koyu zemin, altın vurgu.

## GPU çizimi (`gl*.ts`)

SVG her yüzü tek düz renkle boyuyor; ne kadar dilim eklense yüzler
seçiliyor. WebGL2 varsa aynı model GPU'da çiziliyor ve sonuç aynı SVG'nin
içine resim olarak konuyor. Kamera, ışık ve palet aynı; yan yana duran iki
yol aynı dünyanın parçası. Model de aynı: GPU'nun istediği ek bilgi
yüzün üstünde, SVG onu okumuyor.

**Köşe verisi (`Yuz`).** Yalnız GPU okuyor.

- `vn`: köşe normalleri. Silindir, koni, küre, uzuv ve kubbe eğri
  yüzeyin gerçek normalini, arazi komşu köşelerden hesaplananı veriyor.
  Işık yüzün içinde piksel piksel ara değerleniyor; kule, kafa ve yamaç
  dilimsiz görünüyor.
- `vr`: köşe renkleri. Arazi rengi köşede hesaplanıyor; renk üçgenden
  üçgene sıçramıyor, akıyor.
- `su`: köşenin su seviyesine uzaklığı (kum şeridi biriminden), su rengi
  ve kıyı rengi. Kıyı çizgisi ve kum şeridi üçgen kenarına değil, bu
  uzaklığın sıfır eğrisine oturuyor: komşu üçgenlerde kesintisiz, sivri
  uçsuz, bir piksel genişliğinde yumuşak. Suyun kıyıya değdiği yerde ince
  bir köpük şeridi var.
- `parlak`: malzeme parlaklığı (0 mat, 1 cilalı). `parlat(model, p)` bir
  parçanın bütün yüzlerini işaretliyor; figürlerde kılıç ağzı, mızrak ve
  balta başı, miğfer, plaka/şerit/zincir zırh, kalkan kenarı, at zırhı ve
  altın süsler parlak. Ten, bez, deri ve ahşap mat.
- Dönüşümler (`olcekle`, `dondur`) bunları da taşıyor; aynalamada köşe
  sırasıyla birlikte dönüyorlar.

**Ağ (`glAg.ts`).** Modelden üçgen tamponu; saf, node'da test ediliyor.
Görünürlük ve `ciftYuz` çevirmesi SVG ile aynı karar. Yer katmanları
(`katman < 0`) ressam sırasıyla tek tampon, nesneler derinlik tamponuna,
saydam yüzler en sona. İki geçiş: önce hangi yüz nereye, sonra doğrudan
`Float32Array`'e yazım (dünya zemininin elli bin üçgeninde ara dizi
çöpü ana iş parçacığını dolduruyordu).

**Çizici (`glCizici.ts`).** DOM'a dokunmuyor; işçide de ana iş
parçacığında da aynı koşuyor. Üç geçiş:

1. Gölge haritası (2048²): yalnız nesneler (bina, ağaç, figür), iki
   yüzlü. Araziye ve birbirine gölge düşürüyorlar; 5×5 yüzdeli süzgeç
   gölge kenarını yumuşatıyor.
2. Ana geçiş, dört hedefe birden: renk, normal + çizgi koyuluğu, taban
   renk ve bir "ek" hedef (iki kanala paketlenmiş derinlik, ışıma, ortam
   gölgesi payı). Işık:
   - Ortam ışığı gökyüzü/zemin karışımı: üste bakan yüz göğün serinliğini,
     alta ve yana bakan yerden yansıyan sıcaklığı alıyor. Gölgeler hafif
     mavi, güneşli yüzler hafif sıcak. Ortalama parlaklık SVG ile aynı.
   - Güneş `YAYGIN · (n·L)`; gölgedeki yüz yaygın ışığın %38'ini alıyor.
   - Parlak yüz (`parlak`): yansıyan bakış yönü göğe dönükse yüz açılıyor,
     yere dönükse koyulaşıyor, ufkun güneş yanına dönükse parlıyor. Düz
     yüzlü modelde bu yüzden yüze sert bir ayrım veriyor; metali mat
     boyadan ayıran bu. Üstüne güneşin yansıması (Blinn–Phong; yüzler iri
     olduğu için tepe geniş).
   - Su: yüzeyinde yönlü, yumuşak dalgalar (gürültüden normal); güneşi yer
     yer yansıtıyor. Dalga boyu dünya biriminde sabit, çıktı boyundan
     bağımsız.
3. Çözme: her çıktı pikseli 2×2 örneğin ortalaması (süper örnekleme) ve
   her örnek kendi kenarını buluyor. Çizgi yalnız siluette (komşu boş ya
   da belirgin arkada) ve keskin kırılımda ya da renk değişiminde; yuvarlak
   yüzeyin içinde çizgi yok. Kalınlık ekran pikselinde sabit (~0,7 CSS
   pikseli). 1400 pikselden büyük çıktı (dünya zemini) tek örnekle
   çiziliyor; 2×2'si bellek sınırını aşıyor. Aynı geçişte:
   - Ortam gölgesi (SSAO): her örnek derinlikten görüş uzayı konumunu
     kuruyor, çevresinde 12 noktayı (altın açıyla dağılmış, piksel başına
     döndürülmüş) yoklayıp yüzeyin ~17°'den dik üstünde kalanları sayıyor.
     Duvar dibi, mazgal arası, kule ve ağaç altı kararıyor. Yalnız ortam
     ışığının payı kadar işliyor: güneşli yüzde az, gölgede çok.
     - Yüzeyin düzlemi köşe normalinden değil derinlikten (iki yandaki
       farkın kısası): arazinin köşe normali yumuşak, üçgenleri düz; eğik
       üçgende komşular yumuşak normalin düzleminin üstünde kalıyor ve
       üçgen toptan kararıyordu.
     - Yer yeri örtmüyor: yol ve tarla araziye oturan düz plakalar, üst
       üste bindikleri yerde halka halka kararıyordu. Yer (`katman < 0`)
       yalnız üstündeki nesneden gölge alıyor.
     - Su ve ışıyan yüz hiç kararmıyor (kıyının eğimli üçgenleri suyun
       ortasına çizgi çekiyordu).
     - Yarıçap görüş kutusunun %1,2'si; istek `ao` ile değişir, `ao: 0`
       kapatır (dünya zemini düz, tutunacak girinti yok).
   - Işıma haresi: ışıyan yüzler (pencere, meşale, büyü taşı) 24 örnekli
     yumuşak bir hare yayıyor; saydam zeminde de görünüyor (harenin
     kendisi saydamlık da ekliyor). Güç `hare` ile, `hare: 0` kapatır.

Bellek yetmezse (ya da hedef doku kurulamazsa) iş `null` dönüyor ve o
çizim SVG'ye düşüyor. Sıra boşalınca büyük hedef dokular dört saniye sonra
bırakılıyor; telefonda tam ekran bir afişin dokuları onlarca MB tutuyordu.

**Sıra ve işçi (`gl.ts`, `glIsci.ts`).** Çizim bir işçide (Web Worker +
OffscreenCanvas) koşuyor. GPU sürücüsü yazılımsa (donanım hızlandırması
yok) bir sahne yüzlerce milisaniye sürebiliyor; ana iş parçacığında bu
kaydırmayı ve dokunmayı donduruyordu (dünya haritasında 661 ms'lik tek bir
görev ölçüldü, işçiyle 70 ms). Ana iş parçacığında yalnız modelden ağ
kuruluyor ve tamponlar kopyasız aktarılıyor. İşçi açılamazsa ya da WebGL2
orada yoksa aynı çizici ana iş parçacığında; o da yoksa SVG. İşler tek tek,
aralarında nefes payıyla; aynı istek (anahtar + görüş kutusu + boy) bir kez
çiziliyor.

**Yalnız donanımda.** GPU yolu donanım hızlandırmalı WebGL2 istiyor.
Sürücü yazılımsa (SwiftShader, llvmpipe, Windows'un temel sürücüsü)
`glVarMi` ilk çağrıda sürücünün adına bakıp "yok" diyor ve her şey SVG
çiziliyor: işlemcide öykünülen 2×2 örnekleme ve gölge haritası bütün
çekirdekleri alıp ana iş parçacığını ve CSS geçişlerini aç bırakıyordu
(CI'da öğreticinin 150 ms'lik ilerleme geçişi 450 ms'de bitmedi).
Başsız tarayıcıda WebGL hep yazılım; görsel denetim ve ekran görüntüleri
GPU yolunu `localStorage['gl-yazilim'] = '1'` ile zorluyor. Oyuncuya bir
ayar değil.

**Sahne (`Sahne.tsx`).** Önce SVG çokgenleri görünüyor (ertelenen büyük
şeritlerde GPU varsa hiç hesaplanmıyor), GPU resmi hazır olunca aynı
SVG'nin içine `<image>` olarak oturuyor: yer değişmiyor, erişilebilir ad
aynı, `data-gl` imzası ekleniyor. Resim öğenin ekrandaki boyu × piksel
yoğunluğu kadar çiziliyor (en çok 3×, 1400 piksel); boy 1,25'in
kuvvetlerine yuvarlanıyor, öğe büyürken her pikselde yeniden çizilmesin.

**Dünya zemini (`dunya.ts`, `dunyaAgi.ts`, `dunyaIsci.ts`).** Aynı
arazi, iki çıktı. `dunyaUcgenleri` düz renkli üçgenler (2D tuval, WebGL
yoksa); `dunyaModeli` GPU için: iki kat sık ızgara (köşe rengi doruklarda
yıldız gibi dilimlenmesin), ışık ve renk köşede, kıyı `KARA_YOLU`na
işaretli uzaklıktan. Toprak hücreleri de aynı yolla kırpıldığı için zemin
ve hücreler aynı kıyıyı paylaşıyor. Ağaçlar iki çıktıda da aynı yerde
(rastgele dizi 2D ızgaranın tükettiği kadar atlanıyor). Ağ ayrı bir
işçide kuruluyor; zemin 2048 piksel çizilip tuvale yumuşakça geliyor.
Kıyı ve kara sorguları kenar şeritleri ve hücreleriyle hızlandırıldı:
her köşe yüzlerce kenarı değil, yalnız kendi şeridini tarıyor.

## Dosyalar

| Dosya                         | Ne çiziyor                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `uc.ts`                       | Motor: ilkeller, dönüşümler, kamera, ışık, sıralama                                                                           |
| `renk.ts`                     | Palet ve renk yardımcıları                                                                                                    |
| `rastgele.ts`                 | Tohumlu rastgele (FNV-1a + mulberry32)                                                                                        |
| `parca.ts`                    | Ortak parçalar: ağaç, çam, bayrak, çadır, fıçı, duman, uzuv, teker, kubbe                                                     |
| `arazi.ts`                    | Yükseklik alanından arazi, su, kıyı, nehir yatağı, yol ve parsel izleri, düzleme                                              |
| `binalar.ts`                  | Şehir binaları, her biri üç aşama; arsa, görev panosu, haberci kulesi, onur meydanı                                           |
| `yerlesim.ts`                 | Şehir sayfasının altındaki altı yerleşim kademesi (kamp → metropol)                                                           |
| `kir.ts`                      | Kır, maden, kale ve saray parçaları: ev, ambar, değirmen, köprü, maden ağzı, sur, kule, teras, köşk                           |
| `bolgeler.ts`                 | Altı bölge türü × üç aşama; aynı türün aşamaları aynı araziyi paylaşıyor                                                      |
| `figur.ts`                    | İnsan figürü (zırh, başlık, eşya, poz), at, mancınık, kalkan, kılıç                                                           |
| `birlikler.ts`                | Beş birlik, on düşman, altı yuva × beş kademe ekipman                                                                         |
| `kisiler.ts`                  | On iki general, beş lord, profil portreleri                                                                                   |
| `diyarlar.ts`                 | Beş akın diyarı: kapak sahnesi ve tepeden yol haritası                                                                        |
| `zeminler.ts`                 | Sekmelerin tepesindeki manzara şeritleri; her biri o ekranın binası ve insanlarıyla                                           |
| `dunya.ts`                    | Dünya haritasının arazisi, tepeden; kara sınırı `kara.ts`teki `KARA_YOLU`. 2D üçgenler ve GPU modeli                          |
| `dunyaAgi.ts`, `dunyaIsci.ts` | Dünya zemininin GPU ağı, işçide (açılamazsa ana iş parçacığında)                                                              |
| `glAg.ts`                     | Modelden GPU üçgen tamponu (saf)                                                                                              |
| `glCizici.ts`                 | WebGL2 çizici: gölge haritası, ana geçiş, kenar + süper örnekleme                                                             |
| `gl.ts`, `glIsci.ts`          | GPU sırası, önbellek ve çizim işçisi; yedekler                                                                                |
| `Sahne.tsx`                   | Modeli çizen bileşen: SVG, GPU resmi hazır olunca onun yerine; `kutu`, `kirp` (doldur, taşanı kırp), `kare` (kareye tamamla)  |
| `Cizimler.tsx`                | Ekranların kullandığı bileşenler: `BinaCizimi`, `BolgeCizimi`, `NesneCizimi`, `PortreCizimi`, `DiyarCizimi`, `ZeminCizimi`, … |
| `Galeri.tsx`                  | Geliştirme galerisi                                                                                                           |

Dünya haritasının arazisi bir kez bir tuvale çiziliyor (GPU'da 2048, 2D
yedekte 1600 piksel) ve modül düzeyinde saklanıyor. Harita her açıldığında
aynı tuval yeniden bağlanıyor. SVG'de yirmi bin üçgen yakınlaştırma ve
kaydırmada her karede yeniden taranıyordu; tuval tek bir resim gibi
ölçekleniyor.

## Galeri

Geliştirme sunucusunda `http://localhost:5173/#/cizim-galerisi` bütün
çizimleri bölüm bölüm tek sayfada gösteriyor: binalar, yerleşim, birlikler,
düşmanlar, ekipman, generaller, lord, portreler, diyarlar, bölgeler, ekran
zeminleri, dünya. Aynı ışık, aynı palet ve aynı ölçek tutuyor mu, burada
bakılıyor. Galeri üretim derlemesine girmiyor (`main.tsx`,
`import.meta.env.DEV`).

## Yeni bir çizim eklemek

1. Tarifi ilgili dosyaya yaz. Bir general için `kisiler.ts`teki
   `GENERAL` tablosuna bir satır; bir bina için `binalar.ts`teki tabloya
   üç aşama. Mümkünse var olan parçalardan kur (`insan`, `ev`, `kule`,
   `agac`); yeni bir parça birden çok yerde işe yarıyorsa `parca.ts` ya da
   `kir.ts`e koy.
2. Adı dışa açılan listeye ekle (`GENERAL_ADLARI`, `BINA_ADLARI`,
   `ZEMIN_ADLARI` …). Bileşenler (`Cizimler.tsx`) ve denetimler bu
   listelere bakıyor.
3. Galeride aç ve yanındakilerle karşılaştır.
4. `npx vitest run apps/web/src/cizim` ve `CIKTI=… node
tools/gorsel-denetim.mjs` koş.

### Kurallar

- **Belirlenimci.** Aynı ad her zaman aynı çizimi vermeli: oyuncu sayfayı
  her açtığında köyü farklı görmemeli. Rastgelelik yalnız
  `rastgele('anahtar')` ile; `Math.random` yasak. `kure` gibi rastgele
  alan ilkellerin varsayılanı sabit. Testler her çizimi iki kez üretip
  karşılaştırıyor.
- **Ekranda metin yok.** Çizim kodundaki dizgeler anahtar; Türkçe harf
  ya da boşluk içeren bir dizge metin çıkarıcısına (`tools/metin-cikar.mjs`)
  çevrilecek cümle gibi görünür. JSX özniteliğindeki boşluklu değerler
  (`xMidYMid slice`) sabite taşınıyor. `Galeri.tsx` çevrilmeyen dosyalar
  listesinde.
- **Önbellek.** `Sahne` çizimi `anahtar`a göre saklıyor. Aynı anahtar iki
  farklı modele verilmemeli.
- **Katman.** Yere yatık her şey (yol, parsel, gölge levhası) eksi katmanda;
  yoksa önündeki nesnenin üstüne çiziliyor.
- **İki yol, bir model.** Köşe verisi (`vn`, `vr`, `su`) SVG'yi
  değiştirmiyor; SVG yedeği her zaman aynı modelden. GPU'ya özel bir şey
  eklenirken SVG'nin de düzgün çizdiği denetlenmeli (galeriyi WebGL
  kapalıyken de aç).

## Testler ve denetimler

- `apps/web/src/cizim/cizim.test.ts`: motorun kendisi (görünen yüzler,
  ışık, yansıtma); her ailenin her üyesi boş olmayan, sonlu koordinatlı,
  çerçevesine sığan bir çizim veriyor; çizimler belirlenimci; oyunun
  verisindeki birlikler, diyar düşmanları ve seçilebilen hazır portreler
  çiziliyor; bilinmeyen ad `null` dönüyor.
- `apps/web/src/cizim/gl.test.ts`: GPU ağı (görünen yüzler, gölgeye
  girenler, ince levha çevirmesi, katman sırası, köşe normali/rengi/suyu
  ve aynalamada dönmeleri, parlaklığın köşeye yazılıp dönüşümden sağ
  çıktığı, figürde metalin parlak, ten/bez/derinin mat olduğu), GPU ile
  SVG'nin aynı izdüşümü kullandığı
  (izometrik ve tepeden), arazinin köşe su verisi, dünya GPU modelinin
  yüzlerinin kameraya dönük, kıyı uzaklığının sınırlı, ağaçlarının 2D
  çizimle aynı yerde olduğu.
- `tools/gorsel-denetim.mjs`: ekranları gerçek tarayıcıda gezip çizimlerin
  yerinde olduğunu ve taşma olmadığını ölçüyor. WebGL2 varken sahnelerin
  (`svg[data-gl]`) ve dünya zemininin (`canvas[data-gl]`) gerçekten
  GPU'dan geldiğini de ölçüyor; sessizce SVG'ye düşmek gözle yakalanması
  en zor gerileme. Sürücü yazılımsa önce uygulamanın SVG çizdiğini, sonra
  zorlama bayrağıyla GPU yolunu ölçüyor. Ayrıca kaynak dosyaları
  okuyor: veride olup çizimi olmayan bina aşaması, bölge türü, düşman,
  diyar ya da ekranda kullanılıp `ZEMIN_ADLARI`nda olmayan zemin kalmamalı.
- `tools/generate_map.py`: her bölge işaretçisi karada mı, `kara.ts`teki
  `KARA_YOLU` üzerinden denetleniyor. Eskiden zemin resminin pikselleri
  okunuyordu; artık kara sınırının kaynağı kod.

## Kaldırılanlar

- `apps/web/public/gorseller/` altındaki bütün resimler. Profil resmi
  testinin kullandığı altı dosya `tools/fiksturler/`e taşındı; onlar oyunun
  resmi değil, yükleme denetiminin girdisi.
- Üretim ve ayıklama araçları (`gorsel-uret`, `comfy-uret`, `gorsel-koy`,
  `gorsel-ayikla`, `dama-sil`, `sprite-hizala`, `filigran-sil`,
  `portre-kirp`, `dunya-karo`, `harita-*`) ve `tools/stil/` plakaları.
- `docs/GORSEL-ISTEMLERI.md`, `GORSEL-REHBERI.md`, `GORSEL-TESLIM.md` ve
  CI'daki "Görsel istemleri yeniden üretilebiliyor" adımı.

Uygulama simgeleri (`simge-*.png`) kalıyor. Onları da `tools/simge-uret.py`
kodla çiziyor; tarayıcının ve telefonun ana ekranı dosya istiyor.

Eski belgeler (docs/08, 09, 11, 12, 13) o dönemin kararlarını anlatıyor.
Oradaki görsel dosya adları ve araç adları tarihî kayıt; güncel olan bu
belge.
