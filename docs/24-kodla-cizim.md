# 24 — Kodla çizim

Oyundaki her resim kodla çiziliyor. Binalar, yerleşim kademeleri, bölge
sahneleri, birlikler, düşmanlar, ekipman, generaller, lord, profil
portreleri, akın diyarları, ekran zeminleri ve dünya haritasının arazisi
`apps/web/src/cizim/` altında birkaç ilkel parçadan kuruluyor ve tarayıcıda
SVG olarak çiziliyor. Depoda oyun için tek bir resim dosyası yok.

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

`renk.ts` ortak paleti (`P`) ve `isikla` / `karistir` yardımcılarını
taşıyor. Renkler arayüzle aynı sıcaklıkta: koyu zemin, altın vurgu.

## Dosyalar

| Dosya          | Ne çiziyor                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `uc.ts`        | Motor: ilkeller, dönüşümler, kamera, ışık, sıralama                                                                           |
| `renk.ts`      | Palet ve renk yardımcıları                                                                                                    |
| `rastgele.ts`  | Tohumlu rastgele (FNV-1a + mulberry32)                                                                                        |
| `parca.ts`     | Ortak parçalar: ağaç, çam, bayrak, çadır, fıçı, duman, uzuv, teker, kubbe                                                     |
| `arazi.ts`     | Yükseklik alanından arazi, su, kıyı, nehir yatağı, yol ve parsel izleri, düzleme                                              |
| `binalar.ts`   | Şehir binaları, her biri üç aşama; arsa, görev panosu, haberci kulesi, onur meydanı                                           |
| `yerlesim.ts`  | Şehir sayfasının altındaki altı yerleşim kademesi (kamp → metropol)                                                           |
| `kir.ts`       | Kır, maden, kale ve saray parçaları: ev, ambar, değirmen, köprü, maden ağzı, sur, kule, teras, köşk                           |
| `bolgeler.ts`  | Altı bölge türü × üç aşama; aynı türün aşamaları aynı araziyi paylaşıyor                                                      |
| `figur.ts`     | İnsan figürü (zırh, başlık, eşya, poz), at, mancınık, kalkan, kılıç                                                           |
| `birlikler.ts` | Beş birlik, on düşman, altı yuva × beş kademe ekipman                                                                         |
| `kisiler.ts`   | On iki general, beş lord, profil portreleri                                                                                   |
| `diyarlar.ts`  | Beş akın diyarı: kapak sahnesi ve tepeden yol haritası                                                                        |
| `zeminler.ts`  | Sekmelerin tepesindeki manzara şeritleri; her biri o ekranın binası ve insanlarıyla                                           |
| `dunya.ts`     | Dünya haritasının arazisi, tepeden; kara sınırı `kara.ts`teki `KARA_YOLU`                                                     |
| `Sahne.tsx`    | Modeli SVG'ye çizen bileşen; `kutu`, `kirp` (doldur, taşanı kırp), `kare` (kareye tamamla)                                    |
| `Cizimler.tsx` | Ekranların kullandığı bileşenler: `BinaCizimi`, `BolgeCizimi`, `NesneCizimi`, `PortreCizimi`, `DiyarCizimi`, `ZeminCizimi`, … |
| `Galeri.tsx`   | Geliştirme galerisi                                                                                                           |

Dünya haritasının arazisi bir kez, 1600 piksellik bir tuvale çiziliyor ve
modül düzeyinde saklanıyor. Harita her açıldığında aynı tuval yeniden
bağlanıyor. SVG'de yirmi bin üçgen yakınlaştırma ve kaydırmada her karede
yeniden taranıyordu; tuval tek bir resim gibi ölçekleniyor.

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

## Testler ve denetimler

- `apps/web/src/cizim/cizim.test.ts`: motorun kendisi (görünen yüzler,
  ışık, yansıtma); her ailenin her üyesi boş olmayan, sonlu koordinatlı,
  çerçevesine sığan bir çizim veriyor; çizimler belirlenimci; oyunun
  verisindeki birlikler, diyar düşmanları ve seçilebilen hazır portreler
  çiziliyor; bilinmeyen ad `null` dönüyor.
- `tools/gorsel-denetim.mjs`: ekranları gerçek tarayıcıda gezip çizimlerin
  yerinde olduğunu ve taşma olmadığını ölçüyor. Ayrıca kaynak dosyaları
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
