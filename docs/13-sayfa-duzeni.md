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

**Sonra (iPhone 13, yerleşmiş lord):**

| Ekran | Önce    | Sonra   | Ne değişti                                                                             |
| ----- | ------- | ------- | -------------------------------------------------------------------------------------- |
| Akın  | 1808 px | 1119 px | Kilitli diyar tam kapak değil tek satır: küçük gri pencere, ad, seviye, kilidin sebebi |
| Lord  | 1649 px | 1611 px | "Şöhretin ne yapıyor" kartı lord kartına, unvanın altına taşındı                       |

Akın'ın tek işi açık diyarı seçmek; dört kilitli kapak o kararı iki ekran
aşağıya itiyordu. Lord'da kalan boy portre (190 px) ve ordu sahnesi: ikisi
de bilinçli (ekipmanın görünür karşılığı ve "ordum nerede"). Daha kısası
ordu sahnesini bu ekrandan çıkarmayı gerektirir; o bir tasarım kararı.

## 13.12 Bölge sahnesi denendi ve GERİ ALINDI

Oyuncunun sorusu: _"şehir köy vs görsellerini stok kullanmak yerine
bileşenleri tespit edip kendimiz üretsek?"_

Fikir sağlamdı ve yarısı zaten uygulanmıştı — **şehir ekranı bugün de
böyle çalışıyor**: yerleşim zemini boş bir arazi, 34 bina sprite'ı
`binalar.json`'daki x/y ile üstüne konuyor. O yüzden denemeye değerdi.

Denendi. Tarla için iki çağrı harcandı (boş bir tarla zemini + beş
yapının tek sayfası), sprite'lar tabanlarına hizalandı, sahne bölge
kartına bağlandı ve üç seviye için yerleşim yazıldı.

**Karar: eski boyalı afişler daha iyi.** Oyuncu yan yana gördü ve öyle
dedi. Sahne, afişin yerini almadı; kod, veri ve varlıklar geri alındı.

### Ne öğrenildi

Bunu bir başarısızlık gibi yazmak yanlış olur, çünkü teknik taraf tuttu:

- **Kompozisyon dağılmıyor.** Beş yapı tek sayfada üretildiği için aynı
  kamerayı ve aynı güneşi taşıyordu; zemine oturdular, kolaj hissi
  vermediler. Yani "bileşenden kurmak imkânsız" değil.
- **İlerleme gerçekten görünüyordu.** Sv1 bir ambar, sv5'te tahıl
  ambarı + değirmen + ikinci ambar + arabalar. Boyalı afiş bunu yapamaz.
- **Ama afiş daha iyi bir RESİM.** Sahne bilgi taşıyor, afiş atmosfer
  taşıyor ve bölge kartında ağır basan şey atmosfermiş. 3:2 bir manzara,
  kompozisyonun en zayıf olduğu yer — bu baştan söylenmişti, pilot da
  onu doğruladı.

Not: `tarla_5` afişi konusu bakımından hâlâ tuhaf — bir tarla bölgesi
için ırmak kıyısında surlu bir kasaba çiziyor. Bu ayrı bir iş ve çözümü
sahne değil, o afişin yeniden üretilmesi. İstem artık düzeltilmiş durumda
(`farmland only, no castle, no city walls…`, `docs/GORSEL-ISTEMLERI.md`);
kalan tek iş görseli o istemle yeniden üretip `gorsel-koy.py` ile koymak.

### Geriye ne kaldı

`ZemineGolgesi`. İki gölge (geniş "ortam" + dar "temas") şehir ekranında
satır içindeydi ve sahne için ikinci bir kopya çıkacaktı; ortak bileşene
alındı ve pilot geri alınınca da kaldı. İki kopya, bir gün birinin
düzelip ötekinin düzelmemesi demek.

Sahne kurgusunun tamamı git geçmişinde duruyor (`a0700a4`): bir gün
tekrar istenirse üretilmiş sprite'lar dahil oradan alınır, yeni çağrı
gerekmez.
