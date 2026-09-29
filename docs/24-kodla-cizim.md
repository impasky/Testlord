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
  taraftan çiziliyor. Bir yüzeye oturan küçük parça (göz, kaş, burun, saç
  kabuğu) altındaki iri yüzle aynı derinlikte kalıp arkasına düşüyordu;
  `oneAl(model, d)` (`Yuz.onde`) onu sırada `d` birim öne alıyor. Yalnız
  SVG okuyor (GPU derinlik tamponuyla çiziyor); küçük tutulmalı, öndeki
  başka bir nesneyi aşmamalı.
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

**İnsan figürü (`figur.ts`).** Baş çeneden şakağa iki kesik koni ve bir
kapak; 12 dilim, bir dilim tam öne bakıyor (düz alın).

- Yüz (`yuz`): göz akı ve gözbebeği, kaş (erkekte iç ucu aşağı, kadında
  dış ucu), üçgen burun, ağız, kulak. Her öğe önde kurulup başın ekseni
  etrafında çevriliyor ve dilimin düz yüzüne oturuyor. Kapalı miğfer ve
  maske yüzü örtüyor; sakal ağzı, kukuleta kulağı. Eski yüz iki siyah
  kare ve kutu burundu; portrede maske gibi duruyordu.
- Saç başın dışında bir kabuk: alın açık, erkekte şakaktan aşağısı kesik
  (kulak görünüyor), kadında iki yandan iniyor. Eski saç küresi başla aynı
  boydaydı, başın içinde kalıyordu; figürler kel görünüyordu.
- El: top değil yumruk. Ön kolun doğrultusunda kare avuç, öne çıkan
  başparmak, giyinik kolda bilekte koyu yen ağzı. Plaka zırhlının eli
  parlak demir eldiven.

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
  balta başı, miğfer, plaka/şerit/zincir zırh (halkaları ve zırhlının
  omuzluğu dahil), kalkan kenarı, at zırhı ve
  altın süsler parlak. Ten, bez, deri ve ahşap mat.
- `doku`: yüzey malzemesi — `tas` (derzli taş örgü), `doseme` (yer
  döşemesi), `kiremit`, `arduvaz`, `saman`, `tahta` (yatay kaplama).
  Verilmezse `glAg.dokuBul` renkten ve eğimden çıkarıyor:
  - Paletteki taş rengi (`P.tas`, `koyuTas`, `acikTas`, `kumTasi`) dik
    yüzde örgü, yatayda döşeme.
  - Çatı rengi (`P.kiremit`, `arduvaz`, `saman`) eğik yüzde çatı.
  - Renk BİREBİR aynı olmalı: kaya, kemik, kırmızı bez yakın renkte ama
    taş ya da kiremit değil. `isikla` ile türetilmiş ayrıntı (taç, süs
    taşı) da düz kalıyor.
  - Tahta yalnız açıkça (`dokula(model, 'tahta')`): aynı ahşap rengi
    sandıkta, çitte, ağaç gövdesinde de var. Tahta katlı yapılar ve kır
    evleri ile ambarlar işaretli.
  - `doku: null` deseni kapatır.
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
   - Dik metalin parıltı bandı (stilize): kamera tepeden baktığı için dik
     yüz (gövde zırhı) güneşi fizik gereği hiç yansıtmıyor, zırh mat boya
     gibi duruyordu. Yalnız bu terimde normal göğe doğru bükülüyor
     (`ZIRH_BUKUM`); yuvarlak zırhın güneşe ve bakana dönük yanında dikey
     bir parlak şerit çıkıyor, öbür yanı koyu kalıyor. Güç `ZIRH_PARILTI`,
     yalnız dik yüzde tam (yatay yüz zaten yukarıdaki yansımayı alıyor).
   - Su: yüzeyinde yönlü, yumuşak dalgalar (gürültüden normal); güneşi yer
     yer yansıtıyor. Dalga boyu dünya biriminde sabit, çıktı boyundan
     bağımsız.
   - Malzeme (`doku`): desen gölgelendiricide, dünya biriminde (1 birim ≈
     yarım metre). Ağ her köşeye yüzey koordinatı yazıyor: u yatay (yüz
     boyunca), v eğim boyunca yukarı, `v = z / sin(eğim)`. Aynı eğimdeki
     yüzlerde (konik çatının dilimleri, beşik çatının iki yanı) sıralar aynı
     yükseklikte hizalı; yatay yüzde u = x, v = y. Her desen rengi çarpıyor
     ve normali eğiyor (kabartma), ışık da ona göre düşüyor:
     - Taş: 1,25 × 0,6 birim taşlar, sıra sıra kaydırmalı, taş başına ton;
       derz koyu ve gömük, taş kenarı derze doğru pahlı. Döşeme aynı,
       taşlar iri.
     - Kiremit: sütun sütun yuvarlak (alaturka) kiremit, aralarında oluk;
       her sıranın alt dudağı alttakinin tepesine gölge düşürüyor.
     - Arduvaz: yarım kaydırmalı ince levhalar, aralarında yarık.
     - Saman: eğim boyunca lifler, kat kat.
     - Tahta: yatay tahtalar, ince yarık, arada bir ek yeri, bindirme.
     - Desen piksele sığmayacak kadar küçülünce (şehir haritasındaki
       minik bina) yavaşça düz renge dönüyor; titreşmiyor.
     - Kenar bulucu desensiz rengi ve normali görüyor: derzde, kiremit
       sırasında çizgi çekmiyor.
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
   - Renk düzenlemesi (her çizimde): hafif S eğrisi (orta ton yerinde,
     uçlar açılıyor), az doygun renge biraz canlılık, gölgede serin ışıkta
     sıcak ton. Önceden çarpılmamış renge uygulanıyor, saydam figürün kenarı
     kararmıyor. Güç `ton` ile (0 kapalı).
4. Tilt-shift (yalnız isteyen çizimde, `tilt`): çözülmüş resim bir ara
   dokuya yazılıyor; son geçişte odak bandı (`tilt`: yarı yüksekliği,
   boya oran; merkezi `TILT_ODAK`, ortanın biraz üstü) keskin, bandın
   dışında bulanıklık kenara doğru yumuşakça büyüyor (en çok çıktı eninin
   `TILT_YARICAP` katı; 24 örnekli disk, piksel başına döndürülmüş).
   İzometrik sahne yakından çekilmiş bir minyatür gibi okunuyor. Yalnız
   geniş sahneler istiyor: bölge afişi ve diyar kapağı (bant 0,18), ekran
   zemini (0,24; uzun şeritte kule tepesi bulanıklaşmasın). Figür, portre,
   bina simgesi, yerleşim ve dünya haritası keskin.
5. Hareket katmanları (yalnız hareketli sahnede, `hareket`): ana resimden
   sonra aynı hedeflerden, aynı kırpım ve bulanıklıkla iki PNG daha. Ana
   geçiş suyu `o_ek.a`ya işaretliyor (1 su; ortam gölgesi ağırlığı 0–0,9'a
   sıkışıyor).
   - Su maskesi: pikselin ne kadarı su (beyaz, saydamlıkla). Önündeki
     köprü, kayık ve ağaç derinlikle zaten örtüyor.
   - Işık: ışıyan yüzlerin rengi ve ana resimdekinden iki kat geniş hare
     (`KATMAN_HARE_YARICAP`, `KATMAN_HARE_GUC`).
     Sahnede su ya da ışıyan yüz yoksa o katman hiç çizilmiyor. Ağ
     `dumansiz` kuruluyor: duman yüzleri (`Yuz.duman`) GPU resminde yok.
6. Salınan parçaların atlası (bayrak, sancak, ağaç; hareketli sahnede):
   ağ `bayraksiz` kuruluyor, parçalar ana resimde yok (ayrı tamponda,
   `Ag.bez`), gölgeleri var. Her parçanın bir turdaki 12 anı
   (`bayrakAni.bayrakKareleri`, ana iş parçacığında). Bayrağın dalgası
   normali de değiştirdiği için her karede yeniden kuruluyor (bayrak az);
   sancak ve ağaçta ağ bir kez kuruluyor, her karede yalnız köşeler
   kayıyor (salınım iki sabit biçimin toplamı; `agYap` `kaynak`: her
   köşenin modeldeki yeri). 92 ağaçlı tarla afişinde hazırlık ~60 ms.
   - Kare başına tek geçiş: bütün parçalar ana hedeflerde çakışmayan
     hücrelere kaydırılarak çiziliyor (sayfa, `sayfalaraYerlestir`;
     hücreler arasında ortam gölgesi ve bulanıklık kadar boşluk). Sahnenin
     önündekiler (kule, çatı, yamaç, zemin) ana geçişin ek dokusunun
     kopyasıyla örtüyor; parçanın kendi içi donanım derinliğiyle.
   - Sayfa bir kez çözülüyor (kenar ve ortam gölgesi parçanın kendi
     derinliğinden, renk düzenlemesi; hare yok), tilt-shift parçanın
     gerçek yerine göre; hücreler doğrudan GPU'daki atlasa yazılıyor
     (raflı: her parçanın kareleri yan yana bir blok). Atlas en sonda bir
     kez okunuyor.
   - Kare başına üç hedef değişimi, parça sayısından bağımsız: telefonun
     döşemeli GPU'sunda her hedef değişimi bütün hedefi yükleyip
     yazabiliyor; parça parça çizim yüzlerce değişim demekti.
   - Atlas kurulamazsa (doku sınırı, bellek) parçalar ana resme durağan
     çiziliyor: hiçbir şey kaybolmuyor.

Bellek yetmezse (ya da hedef doku kurulamazsa) iş `null` dönüyor ve o
çizim SVG'ye düşüyor. Sıra boşalınca büyük hedef dokular dört saniye sonra
bırakılıyor; telefonda tam ekran bir afişin dokuları onlarca MB tutuyordu.

**Sıra ve işçi (`gl.ts`, `glIsci.ts`).** Çizim bir işçide (Web Worker +
OffscreenCanvas) koşuyor. GPU sürücüsü yazılımsa (donanım hızlandırması
yok) bir sahne yüzlerce milisaniye sürebiliyor; ana iş parçacığında bu
kaydırmayı ve dokunmayı donduruyordu (dünya haritasında 661 ms'lik tek bir
görev ölçüldü, işçiyle 70 ms). İşçi açılamazsa ya da WebGL2 orada yoksa
aynı çizici ana iş parçacığında; o da yoksa SVG. İşler tek tek, aralarında
nefes payıyla; aynı istek (anahtar + görüş kutusu + boy) bir kez çiziliyor.

**Tarif (`tarif.ts`).** Oyunun her çizimi bir anahtarla adlı (`zemin:kisla`,
`bina:kisla_3`, `birimler:okcu`, `diyar:…:kapak`) ve model yalnız o
anahtardan kuruluyor. Bu yüzden model, ağ, salınan parçaların kareleri ve
duman kaynakları İŞÇİDE kuruluyor; ana iş parçacığına bir dizge düşüyor.
Önceden bunlar ana iş parçacığındaydı ve telefon düzeyinde (işlemci 4 kat
yavaş) ölçüldü: Kışla'ya girerken 1,9 sn, Akın'da 2,4 sn tek parça
kilitlenme; tarifle 0,4 sn ve 0,07 sn. `Cizimler.tsx` SVG yedeğinin
modelini de aynı işlevden alıyor. Tarifi olmayan çizim (galerideki
denemeler) eskisi gibi modelini yolluyor.

**Yalnız donanımda.** GPU yolu donanım hızlandırmalı WebGL2 istiyor.
Sürücü yazılımsa (SwiftShader, llvmpipe, Windows'un temel sürücüsü)
`glVarMi` ilk çağrıda sürücünün adına bakıp "yok" diyor ve her şey SVG
çiziliyor: işlemcide öykünülen 2×2 örnekleme ve gölge haritası bütün
çekirdekleri alıp ana iş parçacığını ve CSS geçişlerini aç bırakıyordu
(CI'da öğreticinin 150 ms'lik ilerleme geçişi 450 ms'de bitmedi).
Başsız tarayıcıda WebGL hep yazılım; görsel denetim ve ekran görüntüleri
GPU yolunu `localStorage['gl-yazilim'] = '1'` ile zorluyor. Oyuncuya bir
ayar değil.

**Sahne (`Sahne.tsx`).** GPU varken tarifli sahnede çokgen hiç
hesaplanmıyor: kare resim gelene kadar boş, resim aynı SVG'nin içine
`<image>` olarak oturuyor (yer değişmiyor, erişilebilir ad aynı, `data-gl`
imzası ekleniyor). Kendi çerçevesine oturan çizim (birlik, eşya) yalnız
kutusunu hesaplıyor (`uc.kutusu`, çokgenlerin kutusuyla aynı). Önceden her
sahne önce SVG çokgenleriyle çiziliyordu: Akın ekranında 6.400 çokgen, onları
ölçen yerleşim hesabı ve çöp toplama sayfayı donduruyordu. GPU yoksa (ya da
düşerse) çokgenler eskisi gibi. Resim öğenin ekrandaki boyu × piksel
yoğunluğu kadar çiziliyor (en çok 3×, 1400 piksel); boy 1,25'in
kuvvetlerine yuvarlanıyor, öğe büyürken her pikselde yeniden çizilmesin.
`tilt` verilirse istek tilt-shift'li; önbellek anahtarına da giriyor.

**Hareket (`Sahne.hareket`).** Geniş sahneler canlı: bölge afişi, ekran
zemini, diyar kapağı (küçük karoda, kilitli diyar penceresinde yok). GPU
resmi bir kez çiziliyor; hareket onun üstünde CSS katmanları. Yalnız
dönüşüm ve saydamlık oynuyor, tarayıcı katmanları yeniden boyamadan
kaydırıyor.

- Su parıltısı: iki dikişsiz ışık çizgisi karosu (tuvalde bir kez, tohumlu)
  ayrı yönde, ayrı hızda kayıyor; su maskesiyle (`mask-image`) örtülü.
- Işık titremesi: ışık katmanı "ekran" karışımıyla resmin üstünde,
  saydamlığı düzensiz bir ritimle açılıp kısılıyor. İki kopya, tümleyen iki
  leke deseniyle örtülü ve ayrı ritimde: yan yana iki ateş aynı anda
  sönüp parlamıyor.
- Duman: GPU resminde duman yok; her kaynaktan (`Yuz.duman`: baca ağzı,
  dönüşümlerle birlikte taşınıyor) dört yumuşak yumru sırayla çıkıp
  rüzgârla kayarak yükseliyor, büyüyüp sönüyor. Kaynaklar ayrı evrede.
  Kaynağın ekrandaki yeri modelden bir kez hesaplanıyor.
- Bayrak: her bayrak kendi kutusunda; atlastaki satırı `steps(12)` ile
  kare kare kayıyor (1,2 sn'de bir dalga turu). Kayan katman yalnız o
  parçanın kare şeridi kadar (atlas arka plan olarak şeridin yerinden
  gösteriliyor): önceden her parça atlasın tamamı boyunda bir katmandı,
  ağaçlı bir zeminde ~74 megapiksel katman telefonun GPU belleğini
  tüketiyordu (şimdi ~2,6). Ekranda olmayan sahnenin katmanları duruyor
  (`IntersectionObserver`). Bayraklar ayrı evrede.
  Kumaş dilimli ve dinlenik hâlini taşıyor (`Yuz.bez`: düz hâli ve her
  köşenin direkten uca oranı; dönüşümler onu da taşıyor). Dalga
  (`parca.bezAni`) direkten uca büyüyüp uca doğru yürüyor, direk kenarı
  yerinde; köşe normali dalganın eğiminden, kumaş kıvrımlı gölgeleniyor.
  Durağan bayrak (SVG, hareketsiz sahne) dalganın ilk anı.
- Sancak (duvara asılı): aynı hat, `Yuz.bez.yon` ile. Kumaş dört kat ve
  ucu; askı çubuğu yerinde, üst kenar bağlı, uç duvar boyunca sarkaç gibi
  salınıyor (kumaş boyunun ~%9'u), üstüne hafif bir kıvrım. Duvara dik ve
  düşey yönde kıpırdamıyor: duvarın içine girmiyor. `yon` bir yer
  değiştirme: ölçek ve dönme onu da taşıyor. Tur 3,2 sn (bayrakta 1,2);
  süre bayrak başına atlastan geliyor.
- Ağaç (`agac`, `cam`): aynı sarkaç salınımı; kök yerinde, yükseldikçe
  daha çok, tepe rüzgâr yönünde (dünyada sabit, varsayılan kamerada
  ekranda yatay) boyunun ~%5'i kadar. Tur 4,4 sn. Gövde ve taç aynı
  parça (`bez.kok`). Parçalar sayfada uzaktan yakına dizili: iç içe
  ağaçlarda yakındaki üstte.
- Asker (her `insan`): duruş salınımı; ayaklar yerinde, gövde ağırlığını
  bir yandan öbürüne verir gibi kendi sağ-sol ekseninde boyunun ~%4'ü
  kadar yana, silah ve kalkan elde. Tur 3,6 sn. Kıvrım yok
  (`bez.kivrim` 0): durağan figür (liste simgesi, portre, SVG) birebir
  aynı. Zemindeki altın heykel kıpırdamıyor.

Kutu bir ızgara sarmalayıcısına geçiyor: resim ve katmanlar aynı hücrede
üst üste, çağıranın sınıfları sarmalayıcıda. Katman dikdörtgeni ölçülüyor
(`kirp`: doldur ve kırp; değilse sığdır), GPU resmiyle aynı yere oturuyor.
Hareket kısıtlıysa (`prefers-reduced-motion`) hiçbiri yok ve duman durağan
çiziliyor; CSS'te de katman gizli (ikinci savunma hattı). GPU yoksa (SVG)
hareket yok. Katman ilk boyamadan önce ölçülüyor: kumaş ana resimde
olmadığı için bir kare bile bayraksız direk görünmesin.

**Dünya zemini (`dunya.ts`, `dunyaAgi.ts`, `dunyaIsci.ts`).** Aynı
arazi, iki çıktı. `dunyaUcgenleri` düz renkli üçgenler (2D tuval, WebGL
yoksa); `dunyaModeli` GPU için: iki kat sık ızgara (köşe rengi doruklarda
yıldız gibi dilimlenmesin), ışık ve renk köşede, kıyı `KARA_YOLU`na
işaretli uzaklıktan. Toprak hücreleri de aynı yolla kırpıldığı için zemin
ve hücreler aynı kıyıyı paylaşıyor. Ağaçlar iki çıktıda da aynı yerde
(rastgele dizi 2D ızgaranın tükettiği kadar atlanıyor). Ağ ayrı bir
işçide kuruluyor; zemin 2048 piksellik bir resim olarak yumuşakça geliyor
(tuvale kopyalanmıyor: `drawImage` telefonda ana iş parçacığında yüzlerce
milisaniyeydi).
Kıyı ve kara sorguları kenar şeritleri ve hücreleriyle hızlandırıldı:
her köşe yüzlerce kenarı değil, yalnız kendi şeridini tarıyor.

## Dosyalar

| Dosya                         | Ne çiziyor                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `uc.ts`                       | Motor: ilkeller, dönüşümler, kamera, ışık, sıralama                                                                                     |
| `renk.ts`                     | Palet ve renk yardımcıları                                                                                                              |
| `rastgele.ts`                 | Tohumlu rastgele (FNV-1a + mulberry32)                                                                                                  |
| `parca.ts`                    | Ortak parçalar: ağaç, çam, bayrak (dalgası `bezAni`), çadır, fıçı, duman, uzuv, teker, kubbe                                            |
| `bayrakAni.ts`                | Salınan parçaların (bayrak, sancak, ağaç) kareleri, GPU için; parçalar uzaktan yakına                                                   |
| `tarif.ts`                    | Çizim anahtarından model (`zemin:kisla` → `zeminModeli`): GPU işçisi modeli kendisi kuruyor                                             |
| `duman.ts`                    | Canlı dumanın kaynakları (saf; işçide hesaplanıyor)                                                                                     |
| `arazi.ts`                    | Yükseklik alanından arazi, su, kıyı, nehir yatağı, yol ve parsel izleri, düzleme                                                        |
| `binalar.ts`                  | Şehir binaları, her biri üç aşama; arsa, görev panosu, haberci kulesi, onur meydanı                                                     |
| `yerlesim.ts`                 | Şehir sayfasının altındaki altı yerleşim kademesi (kamp → metropol)                                                                     |
| `kir.ts`                      | Kır, maden, kale ve saray parçaları: ev, ambar, değirmen, köprü, maden ağzı, sur, kule, teras, köşk                                     |
| `bolgeler.ts`                 | Altı bölge türü × üç aşama; aynı türün aşamaları aynı araziyi paylaşıyor                                                                |
| `figur.ts`                    | İnsan figürü (zırh, başlık, eşya, poz), at, mancınık, kalkan, kılıç                                                                     |
| `birlikler.ts`                | Beş birlik, on düşman, altı yuva × beş kademe ekipman                                                                                   |
| `kisiler.ts`                  | On iki general, beş lord, profil portreleri                                                                                             |
| `diyarlar.ts`                 | Beş akın diyarı: kapak sahnesi ve tepeden yol haritası                                                                                  |
| `zeminler.ts`                 | Sekmelerin tepesindeki manzara şeritleri; her biri o ekranın binası ve insanlarıyla                                                     |
| `dunya.ts`                    | Dünya haritasının arazisi, tepeden; kara sınırı `kara.ts`teki `KARA_YOLU`. 2D üçgenler ve GPU modeli                                    |
| `dunyaAgi.ts`, `dunyaIsci.ts` | Dünya zemininin GPU ağı, işçide (açılamazsa ana iş parçacığında)                                                                        |
| `glAg.ts`                     | Modelden GPU üçgen tamponu (saf)                                                                                                        |
| `glCizici.ts`                 | WebGL2 çizici: gölge haritası, ana geçiş, kenar + süper örnekleme                                                                       |
| `gl.ts`, `glIsci.ts`          | GPU sırası, önbellek ve çizim işçisi; yedekler                                                                                          |
| `Sahne.tsx`                   | Modeli çizen bileşen: SVG, GPU resmi hazır olunca onun yerine; `kutu`, `kirp` (doldur, taşanı kırp), `kare` (kareye tamamla), `hareket` |
| `Cizimler.tsx`                | Ekranların kullandığı bileşenler: `BinaCizimi`, `BolgeCizimi`, `NesneCizimi`, `PortreCizimi`, `DiyarCizimi`, `ZeminCizimi`, …           |
| `Galeri.tsx`                  | Geliştirme galerisi                                                                                                                     |

Dünya haritasının arazisi bir kez çiziliyor (GPU'da 2048 piksellik resim,
2D yedekte 1600 piksellik tuval) ve modül düzeyinde saklanıyor. Harita her açıldığında
aynı tuval yeniden bağlanıyor. SVG'de yirmi bin üçgen yakınlaştırma ve
kaydırmada her karede yeniden taranıyordu; tuval tek bir resim gibi
ölçekleniyor.

## Galeri

Geliştirme sunucusunda `http://localhost:5173/#/cizim-galerisi` bütün
çizimleri bölüm bölüm tek sayfada gösteriyor: binalar, yerleşim, birlikler,
düşmanlar, ekipman, generaller, lord, portreler, diyarlar, bölgeler, ekran
zeminleri, canlı sahneler (hareketiyle), dünya. Aynı ışık, aynı palet ve aynı ölçek tutuyor mu, burada
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
- **Malzeme paletten.** Taş duvar ve çatı rengini paletten doğrudan
  kullan (`P.tas`, `P.kiremit`…); türetilmiş renk desen almaz. Tahta
  duvara `dokula(…, 'tahta')`.
- **İki yol, bir model.** Köşe verisi (`vn`, `vr`, `su`, `doku`) SVG'yi
  değiştirmiyor; SVG yedeği her zaman aynı modelden. GPU'ya özel bir şey
  eklenirken SVG'nin de düzgün çizdiği denetlenmeli (galeriyi WebGL
  kapalıyken de aç).

## Testler ve denetimler

- `apps/web/src/cizim/cizim.test.ts`: motorun kendisi (görünen yüzler,
  ışık, yansıtma, öne almanın yalnız sırayı değiştirdiği); figürün yüzü
  (göz, ağız; kapalı miğferde, maskede, sakalda gizlenmesi), plaka
  zırhlının eldiveni, saç kabuğunun öne alınması; her ailenin her üyesi
  boş olmayan, sonlu koordinatlı, çerçevesine sığan bir çizim veriyor;
  çizimler belirlenimci; oyunun verisindeki birlikler, diyar düşmanları ve
  seçilebilen hazır portreler çiziliyor; bilinmeyen ad `null` dönüyor.
- `apps/web/src/cizim/gl.test.ts`: GPU ağı (görünen yüzler, gölgeye
  girenler, ince levha çevirmesi, katman sırası, köşe normali/rengi/suyu
  ve aynalamada dönmeleri, parlaklığın köşeye yazılıp dönüşümden sağ
  çıktığı, figürde metalin parlak, ten/bez/derinin mat olduğu; malzemenin
  renkten ve eğimden bulunduğu, yakın renkteki kaya/kemik/bezin düz
  kaldığı, taş kutuda v'nin yükseklik, üstte döşemenin x/y olduğu, konik
  çatının dilimlerinde sıraların hizalı olduğu), GPU ile
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
