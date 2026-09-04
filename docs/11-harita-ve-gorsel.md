# Harita ve Görsel Yapı — Analiz ve Karar

Oyuncunun iki cümlesi bu dokümanın sebebi:

> "oyunun görsel yapısını nasıl daha iyi hale getirebiliriz bunu analiz et"

> "harita mantığı ve görselliği içime sinmiyor, hex sistemi çok kısıtlayıcı
> hissettiriyor hem görsel olarak hem de mekanik olarak"

İkincisi daha ağır ve daha somut, o yüzden önce o.

---

## 1. Haritanın gerçek sorunu: hex bir SÖZ veriyor, tutmuyor

Altıgen ızgara oyuncuya bir şey vaat ediyor: **komşuluk**. Altıgen görürsün,
"şu altıgen benimkine bitişik, oraya yayılırım" diye düşünürsün. Türün
bütün haritalı oyunları bu vaadi kurar.

Bizde ızgara bu vaadi tutmuyordu. Kodda altıgen koordinatı yalnız **tek bir
sayı** üretiyordu: `hexDistance(malikâne, hedef)`. Yani:

- Komşuluk hiçbir işe yaramıyordu. Bölgenin **senin bölgene** bitişik olması
  ile haritanın öbür ucunda olması arasında fark yoktu; ikisi de malikâneden
  ölçülüyordu.
- Yayılma diye bir şey yoktu. İlk bölgeni aldıktan sonra harita bir milim
  bile açılmıyordu — hâlâ aynı tek noktadan, aynı yarıçapta bakıyordun.
- 61 altıgenin 60'ı çoğu oyuncu için ulaşılamaz kalıyordu. "Kısıtlayıcı"
  hissi tam olarak bu: **ızgaranın maliyetini ödüyorduk, faydasını
  almıyorduk.**

Ayrıca 7 **vilayet** (`world-map.json` → `provinces`) veride yıllardır
duruyordu ve hiçbir yerde görünmüyordu: ne haritada, ne mekanikte. Diyar
"Kuzeymark", "Demirvadi", "Karaorman" diye bölünmüştü ve oyuncunun bundan
haberi yoktu.

### 1.1 Ne yapmıyoruz: hex'i atmak

Akla gelen ilk çözüm ızgarayı kaldırmak (serbest yerleşim, listeler, "en
yakın 10 bölge"). Yapmıyoruz, üç sebeple:

1. Kısıtlayıcı olan ızgara değil, ızgaranın BOŞ olması. Aynı harita komşuluk
   çalıştığı anda genişliyor.
2. Serbest yerleşimde mesafe okunamaz hâle gelir; oyuncu "neden 40 dakika
   sürüyor" sorusuna bakacak bir şey bulamaz.
3. Altıgen, tutulan toprağın **şeklini** görünür kılan tek düzen. Sınır,
   cep, koridor gibi şeyler ancak ızgarada okunur.

### 1.2 Kararlar

**H1 — Mesafe en yakın TOPRAĞINDAN ölçülür.**
`hexDistance` artık malikâne ile hedef arasında değil, `min(malikâne, sahip
olduğun her bölge)` ile hedef arasında hesaplanıyor. Tek satırlık bir kural
ama oyunun şeklini değiştiriyor: aldığın her bölge haritayı biraz daha
açıyor. Yayılma yayılma gibi hissediliyor.

Denge tarafı: yürüyüş süresi mesafeye bağlı olduğu için toprak sahibi
avantajlanıyor — ki zaten olması gereken bu. Kartopu riski yok, çünkü bölge
sayısı seviyeyle sınırlı (`1 + floor(seviye/15)`); sınırsız yayılan bir
oyuncu yok.

**H2 — Vilayet birliği ödüllendiriliyor.**
Aynı vilayette birden fazla bölge tutmak gelir çarpanı veriyor. Böylece
"hangi bölge" sorusunun yanında "**nerede**" sorusu da doğuyor: dağınık üç
bölge ile bitişik üç bölge artık aynı şey değil.

**H3 — Vilayetler haritada görünüyor.**
Her vilayetin kendi rengi ve haritada okunan bir adı var. Tek başına bu
değişiklik haritayı tek tip bir petekten yedi parçalı bir diyara çeviriyor.

**H4 — Harita yakınlaştırılabiliyor.**
61 altıgen 390 piksellik bir ekrana sığdırıldığında altıgen başına ~48
piksel düşüyor: her isim kısaltılıyor, her ikon minicik kalıyor. Artık
haritaya iki parmakla yaklaşılabiliyor ve sürüklenebiliyor; yakınlaşınca
isimler tam yazılıyor.

**H5 — Kıyı şeridi düzensiz.**
Kara parçası kusursuz bir altıgendi — yani "ızgara" olduğunu ilan eden bir
siluet. Kıyı taşması artık her altıgende bölge kimliğinden türeyen küçük bir
oynamayla çiziliyor: aynı harita, kıyısı olan bir ada gibi duruyor.

---

## 2. Görsel yapı: neyin iyi olduğu, neyin olmadığı

Bütün ekranlar iPhone 13 ölçüsünde tek tek incelendi
(`tools/gorsel-denetim.mjs` + göz).

### 2.1 Çalışan şeyler — bunlara dokunulmuyor

- **Manzara şeritleri** (`Zemin`). Her ekranı bir MEKÂNA oturtuyorlar.
  Kışla bir talim avlusu, Demirhane ocağın başı. Oyunun görsel kimliğinin
  en güçlü parçası.
- **Tek vurgu kuralı.** Her ekranda tek bir altın düğme var ve o düğme
  "şimdi ne yapmalısın"ın cevabı. Göz nereye bakacağını biliyor.
- **Arma.** Sıralama bir isim listesi olmaktan çıkıp yüzler listesi oldu.
- **Renk dili tutarlı.** Altın = eylem/ödül, yeşil = kazanç, kırmızı =
  kayıp/tehlike. Hiçbir ekran bu sözlüğü bozmuyor.

### 2.2 Zayıf yönler

**G1 — Her şey aynı genişlikte, aynı ritimde.**
Ekranlar tek sütun, kart üstüne kart. Bilgi doğru ama sayfa monoton:
göz kaydırırken hiçbir şey "buraya bak" demiyor. Çare kart eklemek değil,
kartlar arasında HİYERARŞİ kurmak.

**G2 — Hap (pill) şeritleri düzensiz sarıyor.**
"0/2 bölge · 200/586 komuta · Sv 26 · 0/12 saldırı" dört hapı iki satıra
sarıyor ve dördüncüsü tek başına kalıyor. Tırtıklı bir kenar bırakıyor.

**G3 — Üst çubuk üç kaynağı eşit ağırlıkta gösteriyor.**
Altın, demir ve erzak aynı boyutta üç sütun. Oysa erzak NEGATİFE düşebilen
tek kaynak ve düştüğünde ordunun eriyor. Aynı vurguyu almamalılar.

**G4 — Boş hâller ve dolu hâller arasında görsel fark yok.**
Her şey aynı koyu kart. Bir ekranın "burada iş var" mı yoksa "burası
sakin" mi olduğu ancak okununca anlaşılıyor.

### 2.3 Kararlar

**G3 yapıldı.** Üst çubuktaki kaynak sütunu artık DURUM taşıyor: erzak
eksiye gidiyorsa sütun kırmızı çerçeveleniyor ve "azalıyor" yazıyor; depo
dolduğu için üretim boşa gidiyorsa turuncu çerçeveleniyor ve "depo dolu"
yazıyor. Önceden ikisi de 9 piksellik bir yazıya bırakılmıştı ve
görülmüyordu — oysa ikisi de oyuncunun HEMEN bir şey yapması gereken
durumlar.

**G2 yapıldı.** Sabit sayaç hapları artık `DurumSiridi` ile iki sütunlu bir
ızgarada duruyor. Önce `flex-wrap`tı ve dört haptan dördüncüsü tek başına
alt satıra düşüyordu; üstelik sarma noktası sayı uzunluğuna bağlı olduğu
için oyuncudan oyuncuya değişiyordu, yani düzen tesadüfe bağlıydı. Serbest
sayıdaki maliyet hapları (kışla, demirhane) `flex-wrap` kullanmaya devam
ediyor — orada sarma doğru davranış.

**G4 ve G1'in yarısı yapıldı: SAKİN ağırlık.** Artık üç kart ağırlığı var:

| Ağırlık | Nerede | Görünüş |
|---|---|---|
| Birincil | Omurga ("şimdi ne yapmalısın") | altın şerit + altın kenar |
| Normal | İçeriği olan her bölüm | dolu kart, kabartma |
| Sakin | Boş hâl, boş kuyruk, boş olay akışı, boş envanter | kesik kenar, kabartma yok, düz zemin |

Fark BAŞLIKTA da var (`plaka-sakin`): oyuncu ekranı kaydırırken gövdeleri
değil başlıkları tarıyor, sakin bölüm gövdesine bakmadan atlanabilmeli.
Görsel denetim artık yepyeni bir lordun malikânesini de ölçüyor ve boş
bölümlerin gerçekten sakin çizildiğini doğruluyor — bilgi kaybı yok,
değişen tek şey gözün onu atlayabilmesi.

**G1'in kalanı yapıldı: SAYFA SAYISI ARTTI.** Oyuncunun sözü net oldu —
*"sayfa sayısını arttır, şu an her şey iç içe karman çorman oldu."*

Ölçtük, tahmin etmedik. Her ekranın iPhone 13'te kaç ekran boyu olduğu:

| Ekran | Önce | Sonra |
|---|---|---|
| Generaller | 3,4 | **1,1** |
| Malikâne | 2,2 | **1,3** |
| Demirhane | 1,9 | **1,0** |
| Lord | 1,8 | 1,7 |
| İttifak | 1,5 (ve büyüyordu) | **1,0** |
| Sıralama | 2,6 | 2,6 |
| Kışla | 2,4 | 2,3 |

Sıralama ve Kışla'ya dokunmadık ve bu bilerek: **sorun uzunluk değil.**
Bir sıralama tablosu uzun OLMALI, bir birim listesi de öyle. Sorun tek
sayfada birbiriyle alâkasız işlerin toplanmasıydı — Malikâne aynı anda
sıradaki adımı, kuyrukları, günlük görevleri, haftalık seferi, başarımları
ve olay akışını taşıyordu.

Kural: **bir sayfa bir iş.** İki yolla uygulandı:

1. **Yeni sayfalar.** Görevler (günlük + sefer + başarımlar: hepsi "nereye
   gidiyorum") ve Olaylar (olay akışı + savaş raporları: "ne oldu")
   Malikâne'den çıkıp kendi sayfaları oldu. Malikâne'de birer KANCA
   kalıyor — görünmeyen bir "yarın geri gel" sebebi sebep değildir
   (docs/09 K4), o yüzden ödül hazırsa görev şeridi yeşilleniyor.
2. **Alt sekmeler** (`AltSekmeler`). Demirhane üretim/envanter/donanım,
   Generaller altın/gümüş/bronz, İttifak ittifakım/diplomasi/sohbet, Lord
   güç/görünüş. Aynı ekranda kalıyorlar ama aynı anda görünmüyorlar.
   Desen zaten Sıralama'nın içinde vardı; ortaklaştırıldı.

---

### 2.4 Açılış kayması (CLS)

Oyuncu ikinci kez "görsel kaymalar var" dediğinde denetim aracı TEMİZ
diyordu. Araç haklıydı ama ölçtüğü şey dardı: yatay taşma, örtüşme,
kesilen metin, küçük dokunma hedefi. **Sayfa yerleşirken içeriğin
zıplaması hiç ölçülmüyordu** — oysa "kayma" kelimesinin birebir karşılığı
o.

Ölçünce sebep tek satırdı: **manzara şeridi** görsel yüklenene kadar 12
piksel, yüklendikten sonra 150 piksel oluyordu. Sayfa her açılışta 138
piksel aşağı zıplıyor, parmağın bastığı yerde başka bir düğme oluyordu.
Şerit sekiz ekranda olduğu için sorun da sekiz ekrandaydı.

| | Önce | Sonra |
|---|---|---|
| Açılış CLS | **0,179** | **0,014** |

(Chrome'un "iyi" eşiği 0,1.)

İki düzeltme:

1. **Şeridin yüksekliği artık sabit.** Hangi ekranın zemin görseli olduğu
   DERLEME ZAMANI bilinen bir şey; çalışma anında "yükle, olmazsa küçült"
   yapmak zıplamanın kendisiydi. Görseli olan ekran 150 piksellik şeridi
   baştan ayırıyor, görseli olmayan ekran sade bir başlıkla açılıyor —
   ikisi de bekleyip boyut değiştirmiyor. Listeyle klasörün ayrışmasını
   görsel denetim yakalıyor.
2. **Görev özeti yer tutuyor.** Veri gelene kadar `null` dönüyordu; kart
   sonradan belirip altındaki her şeyi 80 piksel aşağı itiyordu. Boş kutu
   göstermek, sayfayı zıplatmaktan iyi.

Kalan 0,014, omurga cümlesinin veri gelince bir satır büyümesi. Sabit
yükseklik vermek ekranın en önemli kartına ölü boşluk eklerdi; eşiğin çok
altında olduğu için bırakıldı.

**Denetim artık bunu ölçüyor.** Gözcü sayfa yüklenmeden kuruluyor, çünkü
sekmeler arası geçiş kayma üretmiyor (React bütün alt ağacı birden
değiştiriyor) — yalnız sekme geçişini ölçen bir denetim hep 0 görür ve
hiçbir şey yakalamaz. İlk denemede tam olarak bu hataya düştüm: gözcüyü
her ekranda `buffered: true` ile kurunca on bir ekranın hepsi aynı sayıyı
(0,504) verdi. Ölçüm ekranı ayırt etmiyorsa ölçüm değildir.

---

## 3. Ölçüt

Bir sonraki turda "daha iyi oldu mu" sorusunun cevabı şunlar:

1. Bir bölge aldıktan sonra ulaşılabilir bölge sayısı ARTIYOR mu?
   (H1 çalışıyorsa artmalı; `tools/harita-testi.mjs` bunu ölçüyor.)
2. Haritaya bakan biri kaç vilayet olduğunu söyleyebiliyor mu?
3. Yakınlaştırınca bölge adları kısaltmasız okunuyor mu?
