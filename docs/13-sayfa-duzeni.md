# 13. Sayfa düzeni: belgeden panoya

Oyun bir **belge** gibi kurulmuştu — üst üste yığılmış kartlardan oluşan
uzun bir sayfa — oysa bir **nöbet** gibi oynanıyor: aç, bak, bir şey yap,
kapat. Ölçüm bunu açıkça söylüyordu (390×844 telefon, ilerlemiş hesap):

| ekran    | yükseklik | kaç ekran | kart | düğme |
| -------- | --------- | --------- | ---- | ----- |
| Şehir    | 1915 px   | 2,3       | 12   | 30    |
| Ordu     | 2244 px   | 2,7       | 7    | 32    |
| Lord     | 1951 px   | 2,3       | 9    | 25    |
| Sıralama | 1915 px   | 2,3       | 37   | 60    |
| Dünya    | 1128 px   | 1,3       | 3    | —     |

Dünya haritası tek ekrana yaklaşan tek ekran ve tesadüfen oyunun en iyi
çalışan yeri.

## 13.1 Şehir'de aynı kapılar iki kere duruyordu

Yerleşim haritası zaten bir kapı: yapıya dokununca içine giriyorsun.
Altında ayrıca 13 satırlık, tam genişlikte bir yapı listesi vardı — aynı
hedefler ikinci kez, 962 pikselde. Sayfanın 1915 pikselinin yarısı buydu.

Listeyi silmedim, çünkü **gerçek bir iş yapıyordu**: hangi yapının kaçıncı
seviyede olduğunu tek bakışta görmek. O iş haritada iyi yapılmıyor —
etiketler birbirine giriyor, kenarda kırpılıyor.

Liste ızgaraya döndü: dörtlü satırlar, ikon + ad + seviye rozeti. Aynı
bilgi ~200 pikselde ve **hepsi aynı anda** görünür. Her satırın taşıdığı
özet cümlesi ("Ekipman döver", "Yaralıları tedavi eder") yapının kendi
paneline kaldı — ilk seferde öğrenilen, yüzüncü seferde okunmayan bir
cümle her açılışta 13 kez yazılmamalı.

**Şehir 1915 → 1225 piksel.**

## 13.2 Omurga her ekranda: 500 piksellik kart, 56 piksellik şerit

"Şimdi ne yapmalısın" oyunun en değerli parçası — bekleme üzerine kurulu
bir oyunda "sırada ne var" sorusunun tek cevabı. Ama yalnız ŞEHİR
ekranındaydı ve 500 piksellik bir kart olarak duruyordu. Oyuncu
Ordu'dayken, Dünya'dayken ya da Lord'dayken cevabı göremiyordu.

Şerit alt gezinmenin hemen üstünde, **beş sekmenin beşinde de** duruyor.
Kapalıyken tek satır: ne yapılacağı, "sonra:" satırı ve düğmesi.
Dokununca tam kart açılıyor — cümlesi, rozetleri, geri sayımıyla.

Açılan panel `Omurga`nın kendisini çiziyor. İki ayrı çizim iki ayrı
doğruluk demekti: kart düzelir, şerit eski kalırdı.

## 13.3 Taşımanın açtığı üç kusur

Omurgayı taşımak, üzerine kurulu üç şeyi kırdı ve üçü de gerçek kusurdu —
testler yakaladı:

**Şerit, alttan açılan panellerin tıklamasını yutuyordu.** Bölge kartı,
kapı panelleri: hepsi `fixed bottom-0`. Şerit 56 piksellik alt şeridi
kapatıyor, oradaki düğmeler görünüyor ama basılamıyordu. Şeridin katmanı
perdenin (z-40) ALTINA indi: panel açıkken şerit hem soluyor hem
tıklamayı yutmuyor. Oyuncu bir karara girdiğinde "şimdi ne yapmalısın"
zaten beklemeli. Kendi paneli açıkken durum tersine dönüyor — o zaman
şerit panelin kapatma düğmesi.

**Rehber ışığı basılamayan bir düğmeyi gösteriyordu.** Işığın "güvenli
şerit" hesabındaki `ALT_PAY = 96` elle yazılmış bir sayıydı ve yalnız
gezinme çubuğuna (68px) göre seçilmişti. Şerit gelince alt krom 124
piksele çıktı: aradaki kuşakta duran bir düğme "güvenli" sayılıyor ama
gerçekte şeridin altında kalıyordu. Sayı artık CSS değişkenlerinden
türüyor (`--alt-bar` + `--omurga-serit`), elle tutulmuyor.

**Şeridin düğmesi hiçbir şey yapmıyordu.** `useOmurgaAdimi` adımı BOŞ
işleyicilerle kuruyordu (`onGit: () => {}`) — App onu yalnız "hangi
sekmeye altın nokta konsun" diye kullanıyordu. Şerit ise adımı
ÇALIŞTIRIYOR. Düğme çiziliyor, basılıyor, hiçbir şey olmuyordu: `git`
vardı ama içi boştu, yani "düğme var mı" denetimi geçiyor, iş
yapılmıyordu. Kanca artık işleyicileri isteğe bağlı alıyor.

## 13.4 Hap grameri: şekil anlam taşısın

Kışla ekranında tek bakışta 30 hap vardı ve beş ayrı anlam
taşıyorlardı: `+65/sa` gelir, `1.850` maliyet, `37 Köylü Milis daha`
şart, `31/90` kapasite, `27dk 45sn` süre. Hepsi aynı yuvarlak
dikdörtgen. Şekil hiçbir şey söylemediği için oyuncu her birini **okumak**
zorundaydı; göz listeyi tarayamıyordu.

En büyük küme maliyetti: altın, demir ve erzak üç ayrı hap olarak yan yana
duruyordu. Oysa onlar üç şey değil **bir** şey — bir fiyat etiketi.

İki yeni tür (`components/ui.tsx`):

- **`Maliyet`** — üç kaynak tek çerçevede. Göz "fiyat" diye tek bir nesne
  görüyor, içindeki sayıları ancak gerekince okuyor. Yetmeyen kalem
  kırmızı: karar renkte, cümlede değil. Sıfır olan kaynak hiç yazılmıyor.
- **`Sure`** — çerçevesiz, soluk, saatli. Süre ödediğin bir şey değil,
  ödedikten sonra beklediğin şey; fiyatın yanında hap olarak durunca "bu
  da mı ödenecek" diye okunuyordu.

Kışla, Şehir'in yapı kartı ve Harita'nın bölge kartı aynı gramere geçti.
**Kışla'da hap sayısı 30 → 13.**

Ölçüm bir şeyi de düzeltti: ilk sayımda "30 hap, beş anlam" derken
Malikâne'dekileri de maliyet sanmıştım — onlar GELİR (`+X/sa`), Demirhane
ise zaten hap kullanmıyordu. Sorun sandığımdan dardı; gramer yine de
kuruldu, çünkü dar olması yanlış olmasını engellemiyor.

## 13.5 Sıralama: 37 kart, bir liste

Sıralama ekranı bir liste için 37 kart çiziyordu — her satırın kendi
kenarlığı, kendi zemini, kendi köşe yuvarlaması. Kart **resmi ve kararı**
olan şey içindir: bir bölge, bir bina, bir hedef. Göz gezdirilen şey satır
ister. Otuz yedi kart otuz yedi ayrı nesne gibi okunuyor ve aralarındaki
tek anlamlı fark olan SIRA kayboluyordu.

Satırlar tek bir çerçevenin içinde, aralarında saç teli kalınlığında
ayraçla duruyor. Kendi satırın hâlâ ayrı — ama kart olarak değil, zemin ve
kenar vurgusuyla. **37 → 11 kart.**

## 13.6 Üst çubuk: çubuk ancak karara dönüşünce

Üç kaynağın üç doluluk çubuğu her ekranın tepesinde duruyordu ve çoğu
zaman hiçbir şey söylemiyordu: oyuncu "%93 dolu" ile "%70 dolu" arasında
farklı bir şey yapamıyor. Daha kötüsü, sürekli çizilen bir çubuk UYARI
hâlini de sıradanlaştırıyordu — kritik durumda kızaran çubuk, yanındaki
iki dolu çubuğun içinde kayboluyordu.

Çubuk artık yalnız doluluk bir karara dönüşünce çiziliyor: %75 üstü ya da
eksiye giden erzak. O zaman da tek başına duruyor, yani gerçekten
görülüyor.

## 13.7 Lord kartında iki rütbe, hangisi ne söylemiyordu

Sol üstte `ÇAYLAK`, dört santim aşağıda adın altında `ŞÖVALYE`. İki rütbe
sözcüğü yan yana ve hangisinin ne ölçtüğünü söyleyen hiçbir şey yok.
İkisi gerçekten ayrı şey — biri kuşanılan ekipmanın kademesi, öteki
şöhret unvanı — ama oyuncu bunu bilemez, çelişki sanır.

İkisi de artık neyin karşılığı olduğunu söylüyor: "Kuşam Çaylak",
"Unvan Şövalye".

## 13.8 Sayılar

| ekran    | önce    | sonra   | kart        | hap         |
| -------- | ------- | ------- | ----------- | ----------- |
| Şehir    | 1915 px | 1225 px | 12 → 11     | 1 → 0       |
| Ordu     | 2244 px | 2260 px | 7 → 7       | **30 → 13** |
| Sıralama | —       | —       | **37 → 11** | 1 → 0       |

Ordu'nun yüksekliği 16 piksel arttı: omurga şeridi için içeriğe eklenen
dolgu. Aynı şerit Şehir'den 500 piksellik kartı kaldırdığı için orada
kazanç net.

## 13.9 Yerleşim haritasında adlar kırpılıyordu

Yapı adı, binanın kutusunun altına (`top-full`) çiziliyordu ve iki kusuru
vardı:

1. **Kırpılıyordu.** Haritanın alt sırasındaki yapıların etiketi kabın
   dışına taşıyor, `overflow-hidden` onu kesiyordu — "Pazar" yazısının
   alt yarısı yoktu.
2. **Komşunun altında kalıyordu.** Her bina düğmesi kendi `zIndex`ini
   kuruyor (derinlik sırası y'den geliyor), yani kendi **yığın bağlamını**
   açıyor. İçindeki etiket o bağlamdan çıkamıyor: aşağıdaki bir binanın
   çizimi, yukarıdaki binanın adını örtüyordu.

İkisi de tek bir şeyden geliyordu — etiket, ait olduğu düğmenin içindeydi.
Adlar artık binaların üstünde ayrı bir katmanda; katman kabın içinde
kaldığı için kırpılma, bütün binaların üstünde olduğu için örtülme
kendiliğinden bitiyor. Alt sıradaki yapıda etiket yapının **üstüne**
geçiyor: aşağı sığmıyorsa yukarı sığar.

## 13.10 Ordu: beş kart, tek karar

Beş birim kartı 1318 piksel tutuyordu — Ordu ekranının içeriğinin
**%65'i.** Oysa oyuncu tek seferde **tek** birim eğitiyor: beş adet
düğmesi, beş maliyet, beş "Detay" satırı, hepsi bir karar için.

Aynı anda tek kart açık. Kapalı satır karşılaştırmaya yetecek kadarını
taşıyor: kim, kaç tane var, birimi neye mal oluyor. Omurganın işaret
ettiği birim **hazır açık** geliyor, yani rehberli oyuncu fazladan hiçbir
şeye dokunmuyor.

**Ordu 2244 → 1420 piksel**, birim kartları 1318 → 508, hap 30 → 9.

Bir hata yapıldı ve ölçüm yakaladı: `useState` erken dönüşün (`<Iskelet/>`)
**altına** konmuştu. Hook koşullu çağrılınca React ağacı hiç çizilmiyor ve
ekran bomboş kalıyor — ölçüm aracı `main` bulamayınca ortaya çıktı.

Testler oyuncunun yaptığını yapıyor: `lib/birim.mjs` birimin kartını
açıyor, sonra eğitim düğmesine basılıyor.

Bu arada bir test kırılganlığı da çıktı: lord adları
`Date.now().toString(36)`nın son üç karakterinden türüyordu ve o dizi ~47
saniyede bir tekrar ediyor. Süiti üst üste koşturunca "Bu lord adı
alınmış" (409) ile düşüyordu; adlara rastgelelik eklendi.

## 13.11 Kalanlar

Lord (2007 px) ve Akın (1757 px) hâlâ iki ekrandan uzun. Lord'da yer
tutan şey 190 piksellik portre kartı ve boş ordu sahnesi; Akın'da beş
diyar kapağı. İkisi de aynı ilkeyle küçültülebilir — tek karar, tek kart —
ama ikisinde de asıl soru "kaç piksel" değil, "bu ekranın tek işi ne".

## 13.12 Bölge sahnesi: afiş yerine bileşen (pilot)

Oyuncunun sorusu: _"şehir köy vs görsellerini stok kullanmak yerine
bileşenleri tespit edip kendimiz üretsek?"_

Cevabın yarısı depoda zaten yazılıydı: **şehir ekranı bugün de böyle
çalışıyor.** Yerleşim zemini boş bir arazi, 34 bina sprite'ı
`binalar.json`'daki x/y ile üstüne konuyor. Yöntem denendi ve tuttu —
bedeli de biliniyor (docs/12 §3.6, §9.1):

- Tek tek üretilen varlıklar bir araya gelmiyor: 24 bina 24 ayrı çağrıyla
  üretilmişti ve her birinin kendi kamerası, kendi güneşi çıkmıştı.
  Çözüm sayfa + plaka: bir karede üretilen varlıklar zaten tutarlı.
- Zeminin **boşaltılması** gerekti; zeminin kendi boyalı binaları
  sprite'larla yarışınca sprite yapıştırılmış duruyor.
- Sprite'lar tabana hizalandı (`sprite-hizala.py`) ve iki gölge eklendi
  (ortam + temas), yoksa binalar havada duruyordu.

Yani kompozisyon üç şartla çalışıyor: **tek kamera, tek güneş, boş
zemin.**

### Neden afişin kendisi bileşenleştirilmedi

Geriye kalan tek "stok" görsel bölge afişleri (16 dosya) ve onlar 3:2
**manzara** — ufuk, derinlik, atmosfer. Kompozisyonun en zayıf olduğu yer
orası. Bu yüzden afişi parçalara ayırmak yerine **ne gösterdiği**
değişti: bölge kartı artık boyalı bir kartpostal değil, şehir ekranıyla
aynı yöntemle kurulmuş bir sahne.

İki kazanç:

- **Yeni bölge türü = 0 görsel çağrısı.** Bugün 3 çağrı (seviye 1/3/5).
  Tür artık sanat değil, `data/bolge-sahne.json` içinde bir yerleşim
  listesi.
- **Sahne bilgi taşıyor.** Seviye arttıkça yapı sayısı ve cinsi
  değişiyor: tarla 1'de ambar ve saman, 5'te tahıl ambarı, değirmen,
  ikinci ambar ve öküz arabası. Boyalı resim bunu yapamaz.

### Pilotun durumu

Kod tamam ve ölçüldü: sahne kutusu 390×260, yapılar tabanlarından
çakılıyor, derinlik y'den geliyor, eritme ve üst yazı afiş yolundakiyle
aynı. Mekanizma **geçici sprite'larla** doğrulandı — malikâne ve pazar
tezgâhı tarla zeminine kondu ve yapıştırılmış durmadı, çünkü ikisi de
aynı plakadan geliyor.

### Pilot sonucu: geçti

Tarla **iki çağrıyla** üretildi (bir zemin + beş yapının tek sayfası) ve
açıldı. Sonuç dürüstçe:

**Tutan taraf.** Kompozisyon dağılmıyor — ambar, tahıl ambarı, değirmen,
saman yığınları ve öküz arabası aynı kamerayı ve aynı güneşi taşıyor,
zemine oturuyorlar, kolaj hissi yok. Ve asıl kazanç görünüyor:
**seviye ilerlemesi ekranda okunuyor.** Sv1 bir ambar ve bir saman
yığını; sv5'te tahıl ambarı, değirmen, ikinci ambar, iki saman ve bir
araba. Boyalı afiş bunu asla yapamaz — üç seviye üç ayrı resimdi ve
hiçbiri "şu an ne durumdayım" sorusunu cevaplamıyordu.

**Boyalı afişin hâlâ kazandığı taraf.** `tarla_5` daha zengin bir RESİM:
ırmak kıyısında surlu bir kasaba, teraslı tarlalar. Ama tam da bu yüzden
konusu YANLIŞ — bir tarla bölgesi için kale-kasaba çiziyor. Güzel ama
başka bir şeyin resmi.

**İlk yerleşim düzeltildi.** Yapıların hepsi y≥70'teydi: sahnenin üst
%40'ı boş kalıyor, yapılar tarlanın içinde değil kenarında duruyordu.
Yerleşim derinliğe yayıldı (y 50–90) ve uzaktaki yapının ölçeği düşürüldü
— aynı ölçekte iki yapı, biri uzakta biri yakında durunca perspektif
bozuluyor. Bu düzeltme **veriyle** yapıldı, yeni çağrı harcanmadı; kurgunun
asıl vaadi de buydu.

`etkin` bayrağı duruyor: görseli olmayan tür eski afişine düşüyor.
`gorsel-denetim.mjs` bayrağı iki yönde de tutuyor — etkin ama dosya yok,
ya da dosya var ama etkin değil.

İki gölge artık ortak bileşende (`ZemineGolgesi`): aynı iş iki yerde
yapılıyor ve iki kopya, bir gün birinin düzelip ötekinin düzelmemesi
demek.
