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
   sonra aynı hedeflerden, aynı kırpım ve bulanıklıkla üç PNG'ye kadar. Ana
   geçiş suyu `o_ek.a`ya işaretliyor (1 su; ortam gölgesi ağırlığı 0–0,9'a
   sıkışıyor), yerdeki çimeni `o_taban.a`ya (0,625; yer 0,75, nesne 1;
   okuyanlar 0,5 ve 0,9 eşiğine bakıyor, davranış aynı).
   - Su maskesi: pikselin ne kadarı su (beyaz, saydamlıkla). Önündeki
     köprü, kayık ve ağaç derinlikle zaten örtüyor.
   - Işık: ışıyan yüzlerin rengi ve ana resimdekinden iki kat geniş hare
     (`KATMAN_HARE_YARICAP`, `KATMAN_HARE_GUC`).
   - Çimen maskesi: pikselin ne kadarı görünen çimen (yer, malzeme
     `cimen`). Yalın örtü: içine ot gürültüsü işlenince PNG sıkışmıyordu
     (1000×781'de 805 KB; yalın 99 KB). Dokuyu çayırın gerçek ot
     tutamları veriyor (yer geçişinde, maskenin içinde).
     Sahnede su, ışıyan yüz ya da yerde çimen yoksa o katman hiç çizilmiyor. Ağ
     `dumansiz` kuruluyor: duman yüzleri (`Yuz.duman`) GPU resminde yok.
6. Salınan ve canlı parçaların atlası (bayrak, sancak, ağaç; talimdeki
   okçu, koşan at; hareketli sahnede): ağ `bayraksiz` kuruluyor, parçalar
   ana resimde yok (ayrı tamponda, `Ag.bez`), gölgeleri var (canlı parça
   `golgesiz` ise yok: yerinden ayrılan atlının gölgesi yerde kalmasın).
   Her parçanın bir turdaki anları (`bayrakAni.bayrakKareleri`): salınan
   parçada 12, canlı parçada kendi sayısı (`kareSayilari`; okçu 24,
   düello 40). Kare tamponları en uzun tur kadar; turu biten parçanın yeri
   sonraki karelerde boş kalıyor, ne kuruluyor ne çiziliyor. Kareler
   TEMBEL (`kareAl`): çizici onları sırayla istiyor, her kare çizilmeden
   hemen önce kuruluyor ve sonra bırakılıyor. Yerleşkenin 40 karesi
   önceden kurulunca işçide ~195 MB tutuyordu; şimdi bellekte bir kare
   (~5 MB). Atlasın yerleşimi için parçanın bütün karelerdeki kapsamı
   (`kapsam`, kameranın düzleminde) önceden bulunuyor: canlı parçanın
   duruşları tek geçişte kuruluyor, kapsam onlardan; karede yalnız köşeler
   ve köşe normalleri değiştiği için (renk, malzeme, yüz sırası aynı) onlar
   sıkışık bir tampona yazılıyor, kare istenince ilk karenin yüzlerinden
   yeniden kuruluyor. Aynı duruş işlevini paylaşan aktörler (üç okçu)
   duruşu karede bir kez hesaplıyor; aktörün dönüşümleri (taşı, ölçekle,
   döndür) kareye yüz yüz değil bütün model olarak bir kez uygulanıyor.
   Yerleşkenin kareleri böyle ~4,5 sn'den ~3,5 sn'ye indi (geliştirme
   makinesi); telefonda yine saniyeler, bu yüzden yerleşke önce durağan
   geliyor (bkz. "Sıra ve işçi"). Bayrağın dalgası
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
     (raflı: her parçanın kareleri yan yana bir blok, `atlasDuzeni`).
     Rafa sığmayan uzun tur satır satır sarılıyor: sütun sayısı kare
     sayısının atlasa sığan en büyük böleni, blok dikdörtgen kalıyor.
     Atlas en sonda bir kez okunuyor.
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

Ağır canlı sahne önce DURAĞAN (`Sahne.onceDurgun`; Şehir'in yerleşkesi):
önce bütün parçaları içinde çizili durağan resim (hızlı), canlı resim ve
katmanları sonra. Canlı iş `glCiz` `sonra` ile sıraya giriyor: öncelikli
iş kalmayınca başlıyor ve başlamadan önce isteyen kalmadıysa (sayfadan
çıkıldı) hiç çizilmiyor, sonra yeniden istenebiliyor. Gelen canlı resim ve
katmanları çözülüp (`glOnYukle`) öyle yerine konuyor: canlı resimde
hareketli parçalar yok (atlasta), bir kare bile figürsüz görünmesin.
Böylece açılış canlı kareleri beklemiyor, Şehir'den hemen ayrılan
oyuncunun yeni ekranı da. Tembel kareler işlev olduğu için işçiye
gönderilemiyor: ana iş parçacığında kurulan (tarifsiz) sahnenin kareleri
önceden kuruluyor (`kareleriKur`); işçide WebGL2 yoksa ağ geri
gönderilmiyor, sahne tariften yeniden kuruluyor.

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
zemini, diyar kapağı (küçük karoda, kilitli diyar penceresinde yok),
Şehir sayfasının yerleşkesi. GPU
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
- Canlı yerleşke (`canli.ts`): talim alanında üç okçu ok atıyor (kılıftan
  al, kirişe tak, çek, bırak; ok uçup hedefe saplanıyor), üç mızrakçı
  kuklaya hamle yapıyor (kukla sarsılıyor), iki şövalye iki uçtan
  birbirine at sürüyor: çarpışmada kızıl olan atından düşüyor, kalkıp
  atına binerek kendi ucuna dönüyor. Tarlada öküz sabanı sürülüyor (uçta
  dönüyor), iki orakçı buğday biçiyor, bir kadın demeti yığına taşıyor.
  Her aktör bir turun duruşları (`poz(t)`), her karede AYNI yüzler (yalnız
  köşeler kayıyor): `canlandir` modelin ilk karesini veriyor, her yüz
  aktörün karelerini (`bez.canli.model(k)`, bütün yüzlerince paylaşılan)
  ve o karedeki sırasını tembelce taşıyor. SVG ve
  durağan resim ilk kareyi çiziyor; dönüşümler (taşı, ölçekle, döndür)
  karelere de gidiyor. Tur başa sarınca figür başladığı duruşta; yalnız
  elden çıkan nesne yerine dönüyor (hedefteki okun yerine kılıftan yenisi,
  yığına konan demetin yerine yerdeki). Uzun tur atlasta satır satır:
  CSS iki adımda oynatıyor, dış katman satırları (`hareket-satir`,
  `steps(satır)`), içteki şerit sütunları. Yerleşkenin ormanı salınmıyor:
  ekranı dolduran onlarca ağaç katmanı telefonun belleğini tüketiyordu.
- Yapılar sahnenin İÇİNDE (`yerlesim.sahneBinasi`): Şehir sayfası
  yerleşkeyi yapıların aşamalarıyla istiyor (tarif `yerlesim:koy|kisla_3@24,95,1.05|…`),
  her yapı kendi çiziminin sayfadaki kutusuna oturacak ölçek ve yerde.
  Önceden her yapı ayrı bir resimdi, kendi kalın toprak plakasının
  üstünde, kendi ışığı ve gölgesiyle yerleşkeye yapıştırılıyordu; gölgesi
  kendi plakasına düşüyor, yere hiç düşmüyordu ("binalar havada uçuyor").
  Sahnede plaka yok (çimen üstlü plaka atılıyor, toprak ya da taş olan
  avlu olarak zemine yapışıyor); gölge yerleşkenin toprağına düşüyor.
  Sayfadaki işaretler görünmez dokunma alanı, rozet, iskele ve seçim
  halkası. Yapı yükselince tarif değişiyor, sahne yeniden çiziliyor (eski
  resim yenisi gelene kadar duruyor).
- Çevre (`cevre.ts`): dere (su yüzü köşe başına derinlik ve renk taşıyor,
  GPU kıyıyı ve parıltıyı çiziyor), köprü, çarkı dönen su değirmeni ve
  kanatları dönen yel değirmeni (ikisi de az yüzlü canlı parça: simetrik
  çarkta bir tur bir kanat aralığı), gölet, bacası tüten köy evleri
  (kademe sayıyı ve dokuyu değiştiriyor), bostanlar, mera (koyun, inek,
  ahır), meyve bahçesi ve kovanlar, talim kampı ve atlı ahır, patikalar,
  serpinti (çalı, çiçek, kaya, kütük), orman. Yerler ekran biriminde
  yazılı; dolu yerler (`doluMu`) serpintiye ve ormana kapalı. Doğa
  durağan: canlılık su, duman, iki çark ve çimenin rüzgârından
  (yerleşkenin canlı katmanları ~9,5 megapiksel, çevreden önceki kadar).
- Çayır (`cayir.ts`): yerleşkenin zemini köşe renkli bir arazi ızgarası
  (`arazi`, düz: yapılar havada kalmasın). Geniş koyu ve açık çayır
  lekeleri, yer yer kuru ot, kasabanın göbeğinde çiğnenmiş açık yeşil,
  kenarlara doğru koyulaşan orman zemini; GPU köşe renklerini üçgenin
  içinde ara değerliyor. Üstünde öbek öbek ~3000 ot tutamı (dört ince
  yaprak, dipte zeminden koyu, uçta açık; köşe normalleri yukarı: dik
  yaprak yandan ışık alıp kapkara bir çizik gibi okunuyordu) ve seyrek
  kır çiçeği öbekleri. Yollar ve patikalar çimenle toprak arası bir
  kenar şeridinin üstünde, geniş toprak yolda silik tekerlek izi.
  Tutamın yeri model kurulduktan SONRA seçiliyor: çimen olmayan bütün
  yer yüzleri (yol, tarla, avlu, döşeme, su) bir ızgaraya dökülüyor,
  tutam (ve kenar payı) hiçbirinin içine düşmüyor; sonradan eklenen yer
  parçası kendiliğinden saygı görüyor. Bu ayrıntının hepsi yalnız GPU
  (`Yuz.gpu`): SVG yedeği altındaki düz plakayı ve eski yolları çiziyor,
  GPU'suz telefonun çokgen sayısı arttırılmadı (köyde ~13,6 bin). GPU'da
  köy ~49 bin yüz, model ~0,3 sn.
- Çimen rüzgârda: çayır, tutamlar ve çiçekler `doku: 'cimen'` (desen
  değil, işaret). GPU çimen maskesini çıkarıyor; sayfada maskenin
  üstünden rüzgâr karosu kayıyor: rüzgâra dik uzamış iri, çok yumuşak
  açık bantlar ve aralarında hafif gölge, dumanla aynı yönde (sola)
  12 sn'de bir karo. Dalga geçtiği yerde otlar ışığı yakalıyor. Tek
  katman, yalnız kayma; bina, ağaç, yol ve figür maskede yok
  (önündekiler örtüyor, canlı parçalar üstte). Salınan ağaç aynı eksende
  (ekranda yatay) gidip geliyor.
- Yapılar sahnede aşamaya göre büyüyor (`yerlesim.ASAMA_BUYUME`): birinci
  aşama yapı plakasının içinde alçak bir kulübeydi, yerleşkede köy değil
  dağınık barakalar okunuyordu. Yapı (avlu değil) plakanın ortası
  etrafında ×1,3 (birinci), ×1,15 (üçüncü, boş arsa) büyüyor; beşinci
  aşama olduğu gibi, yükseltmenin büyüme hissi duruyor. Liste simgesi
  (`binaModeli`) değişmiyor.
- Bina ayrıntısı (`binalar.yapi`, `parca`): oyuncu "binaları daha da
  detaylı yap" dedi. Ortak kurucu ve parçalar zenginleşti, bütün yapılar
  birden aldı:
  - Pencere: haç biçimli kayıt, denizlik; ahşap ve sıvalı duvarda iki
    yanda boyalı açık kepenk (yapıdan yapıya bir renk), zemin katta yer
    yer çiçeklik.
  - Kapı: lento, taş basamak, kanatta tahta aralıkları ve demir halka;
    yanında yanan bir fener, öbür yanında yapının tabelası.
  - Ahşap ve sıvalı zemin katın altında taş temel; taş duvarın görünen
    köşesinde açık renk köşe taşları.
  - Beşik çatıda mahya kirişi, görünen alında eğik alın tahtaları ve ışıklı
    küçük çatı penceresi.
  - Tabela (`parca.tabela`): duvardan çıkan dirsekte sallanan tahta,
    görünen yüzünde türün simgesi (malikâne kalkan, kışla kılıç, demirhane
    örs, hastane haç, pazar kese, karargâh sancak, kütüphane kitap, liman
    çapa, elçilik mektup). `binaModeli` simgeyi koyuyor, yapının ilk
    `yapi`sı alıyor; kurucuyu kullanmayan birinci aşamalarda direkli tabela.
  - Birinci aşamanın açık yapıları: demirhanede su teknesi, alet rafı,
    demir çubuk istifi, odun ve kömür; kışlada kalkan rafı, flama, ateş
    başında kütük oturaklar; pazarda ikinci tezgâh, dolu kasalar,
    çuvallar; limanda balık ağı, halat kangalı, fıçılar. Salınan parça
    (bayrak) eklenmedi: her biri ayrı canlı katman olurdu.
    Bu ince ayrıntının hepsi yalnız GPU (`Yuz.gpu`): SVG yedeği ve liste
    simgesi eskisi gibi; yerleşke GPU'da ~57 bin yüz (bütün yapılar), SVG
    yedeği ~16,8 bin çokgen.
- Boş arsa yapılmaya hazır bir inşaat yeri: zemini çayır (plaka yok),
  ortada sıkıştırılmış temel izi, köşe kazıkları arasında gerili ip, arka
  kenarlarda dizilmeye başlanmış temel taşları, önde kereste ve taş
  yığını, tabela. Önceden üç yanı çitli bir toprak plakaydı, çamurlu bir
  ağıl gibi okunuyordu.
- Kalabalık (`kalabalik.ts`): kilitli (kademesi henüz açmamış) arsalar boş
  çayır kalmıyor; plakanın ortasında kademenin duvarı ve çatısıyla bir köy
  evi, bostanı ve odunu (kampta çadırlar, sandıklar, taş ocak). Arsa
  açılınca ev kalkıyor, yerine inşaat yeri geliyor: köy büyüyüp yer
  açıyor. Kasabanın boş yerine ek evler (boş yer modelin kendisinden: çimen
  olmayan yer ve nesnelerin ayağı dolu, bütün arsalar kapalı). Kuyunun
  (kampta ateşin) başında sohbet eden üç köylü (durağan). Yolda gidip gelen
  köylüler (köyde 3, şehirde 4): çuval, sepet, kova taşıyor; yol ağının
  kendi eğrisini izliyor, uçta dönüyor (canlı parça, 32 kare; rota en çok
  13 birim, atlası o kadar). Kasabadaki insan figürün 0,42 katı: talim
  alanının ölçeğinde (0,55) köylü büyütülen yapıların kapısını aşıyordu.
- Sıcak hava (`Sahne.sicak`, `GlIstek.sicak`; yalnız yerleşke): renk
  düzenlemesinin üstüne biraz daha canlı renk, güneşte altın ışık,
  gölgede serin ton, orta tonlarda hafif kontrast. Canlı parçaların atlası
  aynı çözüm geçişiyle aynı ayarı alıyor; önbellek anahtarına giriyor.
  Öbür çizimler eskisi gibi.
- Yakınlaştırma (`screens/yerleskeYakinligi.ts`, `Sahne.yama`; aynı kanca
  Akın'ın diyar haritasında da; görünüm yuvasıyla saklanıyor: `sehir`,
  `diyar_<anahtar>` — her diyar kendi yakınlığında. Görünüm kaydırır
  kaydırmaz bellekte, cihaza hareket durunca; harita kapanırken bekleyen
  yazılıyor, yoksa kaydırıp hemen çıkanın son yeri kayboluyordu): yerleşke
  kıstırmayla, Ctrl + tekerlekle ve −/+ düğmeleriyle 3 kata kadar
  büyüyor, en uzakta kabı dolduruyor (kenarından öte boşluk yok).
  Gezinme yine tarayıcının kaydırması. Hareket sürerken React'e
  dokunulmuyor: kap düzende büyüyor (binaların dokunma alanları ve
  etiketler yüzdeyle, yazı aynı boyda), sahne aynı düzen boyunda CSS
  ölçeğiyle — resim yeniden çizilmiyor, hareket katmanları onunla büyüyor
  (katman ölçüsü bu yüzden düzen boyundan, dönüşümsüz). Ana resim
  `EN_BUYUK`la sınırlı, yakında bulanıklaşıyordu: hareket durunca görünen
  bölge her yanından %15 payla, ekrandaki boyunun piksel yoğunluğunda
  ayrıca çiziliyor ve ana resmin üstüne oturuyor (yakınlık yaması). Yama
  canlı resmin ana resmi gibi kuruluyor (`GlIstek.yama`: salınan parça,
  canlı figür, duman yok — atlasa giremeseler de durağan çizilmiyor; su,
  ışık, çimen katmanı ve duman sahneninki), ortam gölgesi bütün sahnenin
  yarıçapıyla (`aoYaricapi`), kenar çizgisi düzen pikselinde: dikişte ana
  resimle aynı. İki aşama: önce durağan yama (hızlı), sonra aynı bölge
  `hareket` ile — yamaya giren köylü, at, bayrak ve ağaçların kare atlası
  yamanın çözünürlüğünde (oyuncu: "köylüler ve bayraklar da yakında
  keskin olsun"). Sahnenin katmanı o parçaların kendi kopyasını gizliyor
  (aynı model, aynı sıra; kurulu kalıyor), yamanınki yamanın
  dikdörtgeninde oynuyor; taşan yer görünen bölgenin dışında. Karelerin
  evresi sayfanın saatinden: sahnedeki ve yamadaki kopya (ya da yerine
  gelen yeni yama) aynı karede, köylü sıçramıyor. Yama ancak ana resimden
  belirgin yoğunsa (1,25 kat) çiziliyor; bölge eldeki ya da yoldaki
  yamanın içinde kaldıkça yeniden istenmiyor, yenisi gelince eskisi
  bellekten bırakılıyor (`glBirak`). Sırası gelince isteyeni kalmayan iş
  çizilmiyor; aynı işi yeniden isteyen varsa eskisinin vazgeçişi onu
  düşürmüyor (her çağıran bir ilgi bırakıyor). SVG yedeğinde yama yok:
  çokgenler zaten vektör. Şehir'e dönünce yakınlık ve bakılan nokta
  korunuyor (`sonGorunum`; yakınlık kaba göre yeniden sınırlanıyor);
  cihazda da saklanıyor (`lordlar_sehir_gorunum`, haritanın merceği gibi):
  uygulama kapanıp açılınca da aynı yerde. Bozuk ya da sınır dışı değer
  yok sayılıyor (`gorunumOku`); depo kapalıysa (gizli sekme) sekme açık
  kaldıkça.
- Kalıcı çizim (`kalici.ts`, `Sahne.kalici`; yerleşke, Akın'ın diyar
  haritası ve kapakları, bölge afişleri): oyuncu "keskin görüntü de kalıcı
  olsun" dedi. Yerleşkenin durağan ve canlı
  resmi (su, ışık, çimen katmanı, canlı parçaların atlası, duman
  kaynaklarıyla) çizilince cihazda, IndexedDB'de saklanıyor; uygulama
  açılınca sıraya hiç girmeden oradan geliyor (`glCiz` `kalici`). Son yama
  sahnenin tek yuvasında (`glKaydet`/`glKalici`): uygulama arka plana
  geçince ve Şehir'den çıkılınca yazılıyor, açılışta görünen bölge
  bildirilmeden okunuyor (okunmadan yeni yama çizilmiyor; canlı resim
  beklenirken eldeki canlı yama korunuyor). Ölçüldü (yazılım GPU'su):
  yeniden açılışta ana resim 0,6 sn, canlı katman ve keskin yama 1 sn
  (ilk açılışta 24 + 14 sn). Anahtar çizimin kendisi (sahne, yapıların
  seviyesi, boy); sürüm çizim kodunun ve verinin içerik özeti
  (`vite-cizim-surumu.mjs`: `src/cizim`, `data`, `packages/shared`):
  biri değişince eski kayıt okunmuyor, siliniyor. Kayıtlar iki grupta,
  her grubun kendi sınırı; en uzun süredir kullanılmayan yalnız kendi
  grubundan atılıyor (bölgeden bölgeye gezenin afişleri yerleşkeyi
  atmasın). `sahne`: en çok on iki (yerleşke üç, dünya haritası iki, her
  diyar haritası iki — zemini ve yaması; yerleşke, dünya haritası ve üç
  diyar sığıyor). `afis`: en çok on altı — sonra oyuncu "kapakları ve
  afişleri de kalıcı yap" dedi: canlı diyar kapakları (beşi) ve bölge
  afişleri (giriş ekranının manzarası da); kilitli diyarın küçük gri
  penceresi ve afişin küçük karosu hareketsiz ve ucuz, kalıcı değil.
  Ölçüldü (yazılım GPU'su): yeniden açılışta kapak 18,5 sn yerine 0,1 sn,
  afiş 12,4 sn yerine 0,1 sn; telefon boyunda kapak ~0,9 MB, afiş ~2,3 MB
  (grup en çok ~35 MB). Depo biçimi değişince (sürüm 2: gruplar) eskisi
  atılıp yeniden kuruluyor — önbellek. Diyar haritası da aynı yolla
  (`DiyarCizimi`, harita kadrajı): ölçüldü, yeniden açılışta zemin 0,0 sn,
  ×3'teki keskin yama 0,1 sn (ilk açılışta 15 + 5 sn). Ana resim sahnenin düzen boyunda
  isteniyor (CSS dönüşümü hariç): yakında açılan harita ölçüsünü
  büyütülmüş kutudan alıp 1400'lük resmi baştan çiziyor, cihazdaki
  kaydı da tutturamıyordu — yakının keskinliği zaten yamada. Service worker'ın "önbellek yok"
  kuralıyla çelişmiyor: saklanan şey oyunun verisi değil, verinin
  çizilmiş hâli; anahtarı verinin kendisi. Sahne kapanınca son yama bırakılmıyor, bellekte
  sahne başına bir yuvada bekliyor (`SAKLI`, en çok üç sahne; aşınca en
  eskisi bırakılıyor): dönüşte yeniden çizilmeden hemen keskin — Şehir'le
  diyar haritası arasında gidip gelince ikisi de (ölçüldü: 0,0 sn; tek
  yuvayken biri ötekini siliyordu). Parçalı aşaması gelmeden kapandıysa
  durağanı önbellekten, parçalısı yeniden.

Kutu bir ızgara sarmalayıcısına geçiyor: resim ve katmanlar aynı hücrede
üst üste, çağıranın sınıfları sarmalayıcıda. Katman dikdörtgeni ölçülüyor
(`kirp`: doldur ve kırp; değilse sığdır), GPU resmiyle aynı yere oturuyor.
Hareket kısıtlıysa (`prefers-reduced-motion`) hiçbiri yok ve duman durağan
çiziliyor; CSS'te de katman gizli (ikinci savunma hattı). GPU yoksa (SVG)
hareket yok. Katman ilk boyamadan önce ölçülüyor: kumaş ana resimde
olmadığı için bir kare bile bayraksız direk görünmesin.

**Dünya zemini (`dunya.ts`).** Aynı
arazi, iki çıktı. `dunyaUcgenleri` düz renkli üçgenler (2D tuval, WebGL
yoksa); `dunyaModeli` GPU için: iki kat sık ızgara (köşe rengi doruklarda
yıldız gibi dilimlenmesin), ışık ve renk köşede, kıyı `KARA_YOLU`na
işaretli uzaklıktan. Toprak hücreleri de aynı yolla kırpıldığı için zemin
ve hücreler aynı kıyıyı paylaşıyor. Ağaçlar iki çıktıda da aynı yerde
(rastgele dizi 2D ızgaranın tükettiği kadar atlanıyor). Model ve ağ
GPU işçisinde tariften (`dunya:zemin`; işçide WebGL2 yoksa kurduğu ağı ana
iş parçacığına geri yolluyor); istek `dunyaZeminIstegi`, zemin 2048
piksellik bir resim olarak yumuşakça geliyor (tuvale kopyalanmıyor:
`drawImage` telefonda ana iş parçacığında yüzlerce milisaniyeydi). Zemin
kalıcı (oyuncu "haritayı da kalıcı sakla" dedi; `glCiz` `kalici`,
"Kalıcı çizim"): cihazda varsa ne model kuruluyor ne çiziliyor. Ölçüldü
(yazılım GPU'su): ilk açılışta 10,4 sn, yeniden açılışta 0,2 sn; kayıt
5,2 MB. Ayarları çizim kodunda (`dunya.ts`) olduğu için sürüm onları da
kapsıyor; dünya modelinin okuduğu kıyı yolu (`components/harita/kara.ts`)
da sürümde. Haritanın yakınlığı ve konumu da hatırlanıyor (oyuncu
"haritanın yakınlığını ve konumunu da hatırlasın" dedi;
`components/harita/haritaGorunumu.ts`): görünen alanın ortası ve yakınlık
hareket durunca cihaza (`lordlar_harita_gorunum`), açılışta oradan; ilk
açılışta yine oyuncunun toprağında ×1,8. Bu yüzden son yakınlık yaması da
bekliyor: başka sekmeye geçince bellekte (dönüşte 0,1 sn), uygulama arka
plana geçince ve harita kapanınca cihazdaki yuvada (yeniden açılışta zemin
0,3 sn, yama 0,3 sn); cihazdakine bakılmadan yeni yama çizilmiyor.
Kıyı ve kara sorguları kenar şeritleri ve hücreleriyle hızlandırıldı:
her köşe yüzlerce kenarı değil, yalnız kendi şeridini tarıyor.
Yakınlık yaması (`components/harita/zeminYamasi.ts`; oyuncu "haritaya da
yakınlık yaması ekle" dedi): harita 4,5 kata kadar büyüyor, 2048 piksellik
zemin yakında telefonun istediğinin yarısından azını veriyordu (orman
altıgenleri basamaklı). Yerleşkedeki gibi: harita durunca görünen bölge
%15 payla, ekranın piksel yoğunluğunda (en çok 2048) ayrıca çiziliyor ve
zeminin üstüne, aynı renk süzgecinin içinde, toprakların ve sınırların
altında oturuyor. Model işçide bir kez kuruluyor (tarif `dunya:zemin`);
ışık, ortam gölgesi (yok), kenar çizgisi ve hare dünya biriminde ana
zeminle aynı, dalgalar ana zeminin ölçüsünde (`dalgaBirimi`; yerleşkenin
yaması da öyle): dikiş görünmüyor. Ancak ana zeminden belirgin yoğunsa
çiziliyor; yoğunluk dünya birimine düşen piksel (yakınlıktan bağımsız:
ekran pikseline göre saklanınca yamanın içinde daha da yakınlaşınca eski
seyrek yama yeter sayılıyordu — yerleşkede de düzeltildi). Bölge eldeki ya
da yoldaki yamanın içinde kaldıkça yeniden istenmiyor, yenisi gelince
eskisi bırakılıyor. Zemin GPU'da değilse (düz üçgenler) yama yok.

## Dosyalar

| Dosya                                 | Ne çiziyor                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `uc.ts`                               | Motor: ilkeller, dönüşümler, kamera, ışık, sıralama                                                                                                                            |
| `renk.ts`                             | Palet ve renk yardımcıları                                                                                                                                                     |
| `rastgele.ts`                         | Tohumlu rastgele (FNV-1a + mulberry32)                                                                                                                                         |
| `parca.ts`                            | Ortak parçalar: ağaç, çam, bayrak (dalgası `bezAni`), çadır, fıçı, duman, uzuv, teker, kubbe                                                                                   |
| `bayrakAni.ts`                        | Salınan (bayrak, sancak, ağaç) ve canlı parçaların kareleri, GPU için; parçalar uzaktan yakına                                                                                 |
| `canli.ts`                            | Canlı yerleşke: okçu, mızrakçı, düello, saban, orakçı, demetçi; `canlandir` bir turun duruşlarını karelere çeviriyor                                                           |
| `tarif.ts`                            | Çizim anahtarından model (`zemin:kisla` → `zeminModeli`): GPU işçisi modeli kendisi kuruyor                                                                                    |
| `duman.ts`                            | Canlı dumanın kaynakları (saf; işçide hesaplanıyor)                                                                                                                            |
| `arazi.ts`                            | Yükseklik alanından arazi, su, kıyı, nehir yatağı, yol ve parsel izleri, düzleme                                                                                               |
| `binalar.ts`                          | Şehir binaları, her biri üç aşama; arsa, görev panosu, haberci kulesi, onur meydanı                                                                                            |
| `yerlesim.ts`                         | Şehir sayfasının tam ekran yerleşkesi, altı kademe (kamp → metropol): kasaba ve yapıları (sahnenin içinde), tarlalar, talim alanı                                              |
| `cayir.ts`                            | Yerleşkenin zemini: köşe renkli çayır, ot tutamları, kır çiçekleri, yol kenarı ve tekerlek izi (yalnız GPU)                                                                    |
| `kalabalik.ts`                        | Kasabanın insanları ve evleri: kilitli arsada köy evi (kampta çadır), ek evler, kuyu başında sohbet, yolda gidip gelen köylüler                                                |
| `kalici.ts`                           | Kalıcı çizim deposu (IndexedDB): yerleşkenin, dünya ve diyar haritalarının resimleri ve son yamaları, kapaklar ve afişler cihazda; çizim sürümüyle, gruba göre sınırlı         |
| `../components/harita/zeminYamasi.ts` | Dünya haritası zemininin yakınlık yaması: görünen bölge ekranın piksel yoğunluğunda                                                                                            |
| `cevre.ts`                            | Yerleşkenin çevresi: dere ve köprü, su ve yel değirmeni, gölet, köy evleri, mera, meyve bahçesi, talim kampı, patikalar, serpinti, orman                                       |
| `kir.ts`                              | Kır, maden, kale ve saray parçaları: ev, ambar, değirmen, köprü, maden ağzı, sur, kule, teras, köşk                                                                            |
| `bolgeler.ts`                         | Altı bölge türü × üç aşama; aynı türün aşamaları aynı araziyi paylaşıyor                                                                                                       |
| `figur.ts`                            | İnsan figürü (zırh, başlık, eşya, poz), at, mancınık, kalkan, kılıç                                                                                                            |
| `birlikler.ts`                        | Beş birlik, on düşman, altı yuva × beş kademe ekipman                                                                                                                          |
| `kisiler.ts`                          | On iki general, beş lord, profil portreleri                                                                                                                                    |
| `diyarlar.ts`                         | Beş akın diyarı: kapak sahnesi ve tepeden yol haritası                                                                                                                         |
| `zeminler.ts`                         | Sekmelerin tepesindeki manzara şeritleri; her biri o ekranın binası ve insanlarıyla                                                                                            |
| `dunya.ts`                            | Dünya haritasının arazisi, tepeden; kara sınırı `kara.ts`teki `KARA_YOLU`. 2D üçgenler ve GPU modeli                                                                           |
| `glAg.ts`                             | Modelden GPU üçgen tamponu (saf)                                                                                                                                               |
| `glCizici.ts`                         | WebGL2 çizici: gölge haritası, ana geçiş, kenar + süper örnekleme                                                                                                              |
| `gl.ts`, `glIsci.ts`                  | GPU sırası, önbellek ve çizim işçisi; yedekler                                                                                                                                 |
| `Sahne.tsx`                           | Modeli çizen bileşen: SVG, GPU resmi hazır olunca onun yerine; `kutu`, `kirp` (doldur, taşanı kırp), `kare` (kareye tamamla), `hareket`, `yama` (yakında görünen bölge keskin) |
| `Cizimler.tsx`                        | Ekranların kullandığı bileşenler: `BinaCizimi`, `BolgeCizimi`, `NesneCizimi`, `PortreCizimi`, `DiyarCizimi`, `ZeminCizimi`, …                                                  |
| `Galeri.tsx`                          | Geliştirme galerisi                                                                                                                                                            |

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
  Canlı yerleşke: her aktörün her karesi aynı yüzlerden, tur başa
  sarınca figür sıçramıyor (yalnız elden çıkan ok ve demet yerine
  dönüyor), `canlandir`ın k. karesi `poz(k/K)` ve dönüşümler karelere de
  gidiyor, turu biten parçanın yeri sonraki karelerde boş, `golgesiz`
  parça ana resme gölge bırakmıyor, her kademede on bir canlı aktör var.
- `apps/web/src/cizim/gl.test.ts`: GPU ağı (görünen yüzler, gölgeye
  girenler, ince levha çevirmesi, katman sırası, köşe normali/rengi/suyu
  ve aynalamada dönmeleri, parlaklığın köşeye yazılıp dönüşümden sağ
  çıktığı, figürde metalin parlak, ten/bez/derinin mat olduğu; malzemenin
  renkten ve eğimden bulunduğu, yakın renkteki kaya/kemik/bezin düz
  kaldığı, taş kutuda v'nin yükseklik, üstte döşemenin x/y olduğu, konik
  çatının dilimlerinde sıraların hizalı olduğu), GPU ile
  SVG'nin aynı izdüşümü kullandığı; atlasta her parçanın kendi kare
  sayısı, uzun turun satır satır sarıldığı ve blokların çakışmadığı
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
