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
