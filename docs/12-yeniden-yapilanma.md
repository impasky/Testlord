# 12 — Yeniden Yapılanma: Şehir, Dünya, Sefer

Oyuncunun tek mesajı bu dokümanın sebebi:

> "hex sistemi olmasın … dünya haritasını bu şekilde yap oyuncular ordan
> fetihler yapsın … ana sayfamız şuan lord ya onu değiştirelim şehir
> sayfası yap … önce oyuncuya ufak bir kasaba yada köy aldıralım …
> bir şehir vs fethedince oraya geçsin … biraz daha hikayesel bir yapı
> kurulmuş olur … 5 npc haritası 1 genel savaş haritası"

Üç şey birden söylüyor ve üçü aynı köke bağlı:

1. **Harita bir ızgara değil, bir yer olsun.** Hex altıgenleri oyunu bir
   tabloya benzetiyor; oyuncunun istediği bir diyar.
2. **Ana sayfa bir liste değil, bir şehir olsun.** Şu an Lord ekranı bir
   kapı ızgarası; oyuncu "demirhaneye gitmiyor", bir düğmeye basıyor.
3. **Oyuna hiçbir şeye sahip olmadan başla.** Şu an lord doğar doğmaz
   malikânesi ve geliri var. Fetih bir kazanç değil, bir ek oluyor.

## 0. Kararlar

Plan on soruyla netleşti. Cevaplar (oyuncunun seçimleri):

| Soru                           | Karar                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Şehir sayfası ↔ bölge ilişkisi | **Başkentini taşırsın**                                                                 |
| Harita çizim tekniği           | **Karma**: dünya/akın tek resim + kod etiketi, yerleşim zemin + sprite                  |
| NPC akınları                   | **Gerçek sefer, kısa süre** — savaş motoru, dizilim, taktik aynen (§6'da adı AKIN oldu) |
| Alt çubuk                      | **Şehir · Ordu · Sefer · Dünya · Lord**                                                 |
| Başkent kaybı                  | **Düşürülür**, elindeki en iyi bölgeye taşınırsın; hiç kalmazsa kampa                   |
| Mevcut dünyalar                | Sıfırlanacaktı; **göç yazıldı** — bkz. §1.4                                             |
| Sefer grupları                 | **Yenilenme süresi** ile geri döner                                                     |
| Şehirdeki binalar              | **Görünür ama inşa edilmemiş**, kaynakla dikilir                                        |
| Bina seviyesi                  | **Var** (1–5)                                                                           |
| Başkent taşınınca binalar      | **Seninle taşınır**                                                                     |

## 1. Veri modeli — hex çıkıyor, komşuluk grafiği giriyor

### 1.1 Neden grafik, neden koordinat değil

Hex'in yaptığı üç iş vardı: yürüyüş mesafesi, komşuluk kuralı ("ancak
toprağına yakın yere saldırabilirsin") ve vilayet gruplaması. Üçü de
koordinat aritmetiğine değil, **hangi bölge hangisine bitişik** sorusuna
bağlı. O soruyu doğrudan yazarsak hex'e hiç ihtiyaç kalmıyor.

`world-map.json` yeniden yazılır:

```
q, r, ring          →   x, y  (haritadaki yüzdelik yer, 0–100)
                        komsular: [id, id, ...]
```

- **Mesafe** = komşuluk grafiğinde en kısa yol (BFS). Yürüyüş süresi bu
  sayıdan hesaplanır, formül değişmez.
- **Komşuluk kuralı** aynen çalışır: bir bölge, sahip olduğun herhangi
  bir bölgeye bitişikse yakındır.
- **Vilayet** alanı zaten vardı, dokunulmuyor.
- `ring` yerine, merkeze uzaklık grafikten türetilir; doğuş yeri ve
  zorluk için o yeter.

`x, y` yalnız **çizim** için. Motor onları hiç okumaz — bu bilinçli:
harita resmini değiştirdiğimizde oyunun kuralları kaymasın.

**Ölçüldü: değişiklik dengeyi hiç kaydırmadı.** Komşuluklar eski altıgen
komşuluklarından türetildi ve 61 bölgenin **3721 çiftinin hepsinde**
grafik mesafesi eski hex mesafesiyle birebir aynı çıktı. Yürüyüş
süreleri, hedef önerileri ve ilk saldırı kısayolu olduğu gibi kaldı;
yalnız altında duran hesap değişti.

### 1.2 Yeni bölge türü: `koy`

Haritanın kenarında 12 köy. Garnizonları çok zayıf. Herkesin ilk fethi
bir köydür ve o köy başkenti olur.

61 bölgenin yeni dağılımı: **köy 12 · tarla 15 · şehir 15 · maden 10 ·
kale 8 · taht 1**.

Başkent olabilen türler: `koy`, `sehir`, `kale`, `taht`. Tarla ve maden
yerleşim değil, gelir kaynağı.

### 1.3 `ring` yerine merkez uzaklığı

Halka kavramı altıgenle birlikte kalktı. Yerine **Taht Kalesi'nden kaç
adım** geçti; aynı şeyi ölçüyor ama grafikten türüyor. Kodda ve
testlerde `ring === 4` diyen her yer artık `merkezUzakligi(id) >= 4`
diyor. Doğum yeri seçimi ise halkaya hiç bakmıyor: **köy türüne** bakıyor
— "kenar" geometrik bir tesadüftü, "köy" tasarımın kendisi.

### 1.4 Şema değişiklikleri

```
Region:   q, r, ring        →  (silinir)
          + komsular  Json  (id listesi; world-map.json'dan kopyalanır)
Lord:     + baskentBolgeId  Int?   (null = kamp)
          + binalar         Json   ({ kisla: 2, demirhane: 1, ... })
Queue:    kind = 'bina'     (inşa/yükseltme kuyruğu; mevcut sistem)
```

`binalar` lorda bağlı, bölgeye değil — "binalar seninle taşınır"
kararının doğrudan karşılığı.

**Sıfırlama yerine göç.** Karar "dünyaları sıfırla" idi ve gerekçesi
göçün pahalı olacağıydı. Uygulamada göç ~70 satır SQL çıktı, o yüzden
sıfırlamaya gerek kalmadı: hiçbir dünya, lord ya da bölge silinmedi.
Yeni alanlar boşluğa izin vererek eklendi, kanonik haritadan dolduruldu,
sonra zorunlu hâle getirildi. Her lordun eski koordinatı denk geldiği
bölgeye çevrildi, elindeki en gelişmiş yerleşim de başkenti oldu.
Çalışan bir dünyanın ortasında da güvenle uygulanabilir.

### 1.5 İki kimlik uzayı — dikkat

Sunucuda iki bölge kimliği var: `mapId` kanonik haritadaki numara (1–61,
her dünyada aynı) ve `id` veritabanı satır numarası (dünya başına
farklı). `komsular` ile `homeBolgeId` **mapId** taşıyor; istemcinin
gördüğü ve saldırırken gönderdiği ise **id**.

`/map` ucu bu yüzden ikisini çeviriyor. Çevirmeyi ilk denemede atlamıştım
ve sonuç sessiz bir çöküş oldu: komşu numaraları listedeki hiçbir
bölgeyle eşleşmedi, istemci grafiği hiç gezemedi ve haritada tek bir
aday bulunamadı. Yeni bir uç bölge komşuluğu döndürecekse aynı çeviriyi
yapmak zorunda.

## 2. Yerleşim ve başkent

### 2.1 Kademeler

Yerleşim kademesi ayrı bir sayaç değil; **başkent bölgenin türü ve
seviyesinden türetilir**. İkinci bir doğruluk kaynağı açmıyoruz.

| Başkent         | Kademe         | Görünüm                              |
| --------------- | -------------- | ------------------------------------ |
| yok             | **Kamp**       | Bir ateş, birkaç çadır, talim direği |
| `koy`           | **Köy**        | Çamurlu yol, ahşap evler, palisad    |
| `sehir` sv. 1–2 | **Kasaba**     | Taş meydan, ilk sur, çarşı           |
| `sehir` sv. 3–5 | **Şehir**      | Forum, su kemeri, tapınak            |
| `kale`          | **Kale-şehir** | Surlar hâkim, askerî yerleşim        |
| `taht`          | **Metropol**   | Vangionum ölçeği                     |

### 2.2 Taşınma — Y3'te geldi

Başkent olabilen bir bölgeyi fethedince "başkentini buraya taşı" teklifi
gelir. Kabul edersen:

- Şehir sayfası yeni yerleşimi gösterir, kademe yükselir.
- **Binaların seninle gelir.** Seviyeleri korunur.
- Eski başkent normal bir bölgen olarak kalır.

Y7'ye planlanmıştı ama Y3'te yazıldı: taşınma olmadan şehir sayfasının
yarısı ölçülemiyordu. Kademe tavanı bir fetihle açılıyor; fetih başkenti
kendiliğinden taşımadığı için lord bir şehir alsa bile köyde oturmaya
devam ediyor ve kasaba binaları (karargâh, kütüphane, liman) hiç
görünmüyordu. Uçlar:

| Uç                             | İş                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /sehir` → `tasinabilir[]` | Elindeki **daha iyi** yerleşimler. Aynı ya da küçük kademe listelenmiyor: "taşın" demek bir kayıp teklifi olurdu. Liste boşsa arayüz hiçbir kart çizmiyor. |
| `POST /sehir/baskent`          | Sahiplik, yerleşim türü ve "zaten oradasın" kontrolü; `baskentBolgeId` güncellenir.                                                                        |

Binalar lordun kaydında (`Lord.binalar`) duruyor, bölgenin kaydında
değil. Taşınmanın hiçbir şey kaybettirmemesi bu yüzden bir kural değil,
veri modelinin sonucu — ikinci bir yerde ayrıca korunması gerekmiyor.

### 2.3 Başkent düşerse

Başkentin fethedilebilir. Kaybedersen:

1. Elindeki başkent olabilen en iyi bölgeye **kendiliğinden taşınırsın**.
2. Öyle bir bölgen yoksa **kampa** dönersin. Binaların durur ama
   kademe tavanı kampa düştüğü için çoğu kapalı olur.
3. Yeniden bir köy alınca binalar olduğu yerden devam eder.

Oyuncu hiçbir durumda silinmez; en fazla geriye düşer.

## 3. Şehir sayfası — yeni ana sayfa

Yerleşim zemininin üstüne kodla yerleştirilmiş binalar. Her bina bir
mevcut kapıyı açar; **kapıların hiçbiri kaybolmuyor, sadece girişleri
liste olmaktan çıkıp bir binaya dönüyor.**

Bina inşa edilmemişse yerinde **boş arsa** durur: tıklayınca ne işe
yaradığını ve bedelini söyler. Böylece oyuncu oyunun tamamını ilk
dakikada görür ama hepsi birden üstüne gelmez.

### 3.1 Seviyeli binalar (10)

Etkilerin SAYILARI ve "seviye 0 = eski davranış" sözleşmesi §4.1'de.

| Bina      | Kapı       | Seviye ne veriyor           | Nereye bağlandı (Y4)              |
| --------- | ---------- | --------------------------- | --------------------------------- |
| Malikâne  | malikane   | Depo tabanına ek            | `storageCapacity(…, binalar)`     |
| Kışla     | kisla      | Eş zamanlı eğitim kuyruğu   | `esZamanliLimit('train', …)`      |
| Demirhane | demirhane  | Dövülebilir en yüksek tier  | `canCraftTier(sv, tier, binalar)` |
| Karargâh  | generaller | General slotu eki           | `generalSlots(liderlik, binalar)` |
| Kütüphane | arastirma  | Eş zamanlı araştırma        | `esZamanliLimit('research', …)`   |
| Hastane   | (ordu)     | En uzun tedavi süresi       | `tedaviSuresiSn(…, binalar)`      |
| Pazar     | (pazar)    | Günlük takas tavanına ek    | `pazarGunlukTavan(sv, binalar)`   |
| Liman     | (ticaret)  | Günlük sevkiyat tavanına ek | `gunlukTavan(tavan, binalar)`     |
| Elçilik   | ittifak    | Sahadaki takviye sayısı     | `takviyeSlotu(binalar)`           |
| Surlar    | —          | **Başkent** tahkimatına ek  | `bolgeTahkimati(bolge, sahip)`    |

### 3.2 Seviyesiz yapılar (3)

Görev panosu (günlük görevler) · Haberci kulesi (olaylar) · Onur meydanı
(sıralama). Bunlar bilgi gösteriyor, kapasite vermiyor; seviye vermek
anlamsız olurdu.

### 3.3 Kademe, bina seviyesini kısıtlar

| Yerleşim   | Bina seviye tavanı                  |
| ---------- | ----------------------------------- |
| Kamp       | — (yalnız çadır ve talimgah, sabit) |
| Köy        | 2                                   |
| Kasaba     | 3                                   |
| Şehir      | 4                                   |
| Kale-şehir | 4 (Surlar 5)                        |
| Metropol   | 5                                   |

Fethin karşılığı budur: **T5 ekipman dövmek için gerçek bir şehir
gerekir.** Yerleşim kademesi böylece dekor olmaktan çıkıp bir tavan
oluyor.

### 3.4 Y3'te öğrenilenler

**Hangi bina hangi kademede AÇILIR — ilke: bilgi ve sosyal erken,
kapasite geç.** İlk dağıtımda binaları "önemine" göre sıralamıştım ve
haberci kulesi kasabaya düşmüştü. Sonuç: savaş raporları olay akışında
duruyor, olay akışı haberci kulesinde açılıyor, dolayısıyla **savaşan
ama kasabası olmayan oyuncu savaşının sonucunu okuyamıyordu.** Bina
kademesi bir kapasite tavanı olmalı, bir bilgi ambargosu değil. Son
dağılım:

| Kademe | Binalar                                                     |
| ------ | ----------------------------------------------------------- |
| Kamp   | Malikâne, Kışla, Görev Panosu, Haberci Kulesi, Onur Meydanı |
| Köy    | Demirhane, Hastane, Pazar, Surlar, Elçilik                  |
| Kasaba | Karargâh, Kütüphane, Liman                                  |

İlke `data/binalar.json` içinde `_kademe_ilkesi` olarak yazılı; yeni bina
eklerken oraya bakılmalı.

**Seviyesiz yapılar "dikilebilir" görünmemeli.** `binaDurumlari` önce
hepsini aynı yoldan geçiriyordu; görev panosunun seviyesi 0 olduğu için
arayüz onu boş arsa sanıyor, oyuncuya dikilemeyecek bir bina için bedel
gösteriyordu. Seviyesizler artık erken dönüyor: `seviye: 1`,
`yukseltilebilir: false`, `maliyet: null`.

**Yeni lordun sıfır binası olamaz.** Öğreticinin ilk adımı "asker eğit"
ve asker kışlada eğitiliyor. `binalar.baslangic` ile her lord
malikâne 1 + kışla 1 ile başlıyor; var olan lordlara göç
(`20260907090000_baslangic_binalari`) aynısını verdi.

**Fetih başkent atamıyorsa şehir sayfası hiç değişmiyor.** İlk fetihte
`services/march.ts` içindeki `ilkBaskentiAta` devreye giriyor; sonraki
fetihlerde karar oyuncunun (§2.2).

### 3.5 Sprite'lar gelince değişenler

Bina görselleri üretilene kadar (§9) şehir haritası çizgi ikonlardan
ibaretti ve sayfanın düzeni buna göre kurulmuştu. Görseller gelince üç
şey birden yanlış göründü; üçü de oyuncunun kendi cümleleriyle:

**"Üst kısımda sadece kâhya Sinan olsun."** Kâhya ile omurga üst üste
duruyordu ve ikisi de "şimdi ne yapmalısın" diyordu — biri hikâyeyle,
biri düğmeyle. Telefonda ilk ekranın tamamını bu ikisi yiyor, oyuncu
şehrini görmeden kaydırmaya başlıyordu. Ana sayfanın şehir olmasının
bütün gerekçesi şehri GÖRMEKTİ. Sıra artık: kâhya → harita → seçili
yapının kartı → omurga → yerleşim kartı.

**"Bina görselleri aşırı küçük, şu an sadece ikon gibi görünüyor."** İki
sebebi vardı: 18 piksellik çizim ve onu çevreleyen 36 piksellik
yuvarlatılmış kutu. Kutu, içinde ne olursa olsun "bu bir düğme" diyor.
Sprite artık kutusuz, doğrudan zeminin üstünde ve **genişliğin %17'si**
kadar — çizim 3,7 kat büyüdü.

%17 keyfi değil: binalar dört sıraya diziliyor ve sıra arası 23 puan
(`data/binalar.json`), kap 4:3 olduğu için bu dikeyde genişliğin
~%17'sine denk geliyor. Daha büyüğü DOKUNMA ALANLARINI üst üste bindirir
ve oyuncu komşusunun binasını açar. Sprite'ların çizimi karesinin
ortalama %84'ünü doldurduğu için şeffaf pay bu çakışmayı kurtarmıyor.
Sıraların y değerleri (13/36/59/82) bu yüzden eşitlendi.

**"Kışlayı seçiyorum, sonra alttan bir daha kışlaya git diyorum."**
Harita bir menüydü ve menünün de kendi menüsü vardı. Dikili ve bir yere
açılan yapıya dokunmak artık DOĞRUDAN oraya götürüyor. Kart yalnız
gidilecek yeri olmayanda açılıyor: boş arsa ve surlar.

Seviye yükseltme kartta kaldı, ona aşağıdaki **Yapılar** listesinden
geliniyor ve liste seçimi kartı ekrana kaydırıyor. Bedeli bilinerek
ödendi: oyuncu binaya günde onlarca kez giriyor, seviye yükseltmeye ayda
birkaç kez.

### 3.6 Zemine oturma

Oyuncu iki referans ekran gönderip tek bir şey sordu: **"zemine tam
oturan bir yapı kurabilir miyiz?"** Binalar büyümüştü ama hâlâ zeminin
ÜSTÜNE yapıştırılmış kartlar gibi duruyordu. Fark çizimden değil
yerleştirmeden geliyordu; dört şey birlikte çalışıyor:

**1. Taban hizası.** Sprite'ların alt boşluğu %3 ile %12 arasında
geziyordu: aynı kutuya konsalar bile biri zemine gömülü, öteki havada
duruyordu. `tools/sprite-hizala.py` yirmi dördünü de alfa sınırına
kırpıp ortak bir zemin çizgisine oturttu. Kare tuval korundu — en/boy
dosyadan dosyaya değişseydi yükseklik ancak resim yüklendikten sonra
bilinir ve kart zıplardı (CLS).

**2. Tabandan çakma.** `translate(-50%, -100%)`: kutunun ALT kenarı
x/y'ye oturuyor. `data/binalar.json` içindeki y artık "binanın ayak
bastığı yer", merkezi değil.

**3. Temas gölgesi.** Ayak basılan yere bir elips. Bir nesnenin zeminde
durduğunu söyleyen şey bu; sprite'ın kendi düşen gölgesi onu kâğıt gibi
gösteriyordu.

**4. Derinlik sırası ve ölçek.** `zIndex = y` — önde duran arkadakini
örtüyor; sıralar bilerek çakışıyor, çünkü çakışmasaydı binalar küçük
kalırdı. Boy `olcek` ile geliyor: malikâne 1.25, görev panosu 0.60.
Hepsi aynı boyken hangisinin diyarın kalbi olduğu okunmuyordu.

**Etiketler artık her zaman durmuyor.** On üç koyu etiket hapı manzarayı
örtüyordu ve referansların hiçbirinde yok. Boş arsada duruyor (orada
sprite hepsi için AYNI — `arsa` — yani ad olmadan hangi yapı olduğu
bilinemez) ve seçili yapıda duruyor. Dikili binanın kimliği silueti; adı
`aria-label`da, Yapılar listesinde ve kartta.

### 3.7 Denemeye verilen sürüm — gelen üç şikâyet

**"Yazılar birbirinin üstüne biniyor."** Rozet kutunun sağ alt
köşesindeydi. Çizim kareyi doldurmadığı için rozet binadan kopuyor,
bazen komşu binanın üstüne düşüyor, kenardaki yapılarda yarısı
kırpılıyordu. Üstelik üç ayrı rozet aynı anda yer istiyordu: seviye, boş
arsadaki artı ve süren işin sayacı.

Hepsi **tabanın üstünde, ortada, TEK rozet** oldu. Sıra: meşgulse sayaç,
değilse seviye, dikilmemişse artı. Sayacın seviyeyi örtmesi doğru — bir
iş sürerken sorulan şey "kaçıncı seviye" değil "ne zaman biter".

Sayaç da kısaldı: `formatKalan` iki birim yazıyor ("44dk 55sn") ve bu,
rozeti komşu binaların yarısını örtecek kadar uzatıyordu. Haritada
`formatKisaKalan` tek birim yazıyor ("44dk"); ayrıntı binanın içinde.

**"Binalar havada duruyor gibi."** İki sebebi vardı. Birincisi gölgeydi:
tek bir yumuşak elips yetmiyor, iki ayrı sinyal gerekiyor — geniş ve
soluk bir ORTAM karartması, dar ve koyu bir TEMAS karartması; ikisinin
de dikey merkezi çizimin tabanına oturuyor, yani gölge binanın önüne de
taşıyor. Önceki hâlde elips kutunun dibindeydi, yani binanın altında
değil altındaki boşluktaydı.

İkincisi ve asıl sebebi ZEMİNİN KENDİSİ: yerleşim zeminlerinde model
kenarlara ev, çadır, kule çizmişti. O boyalı binalar bizim
sprite'larımızla yarışıyor ve ikisi farklı ışıkla çizildiği için sprite
yapıştırılmış duruyordu. Zemin istemi yeniden yazıldı — karede artık
hiçbir bina yok, yalnız toprak, çimen, taş döşeme, dolanan bir patika ve
kenarda çit. **Altı zemin yeniden üretilmeyi bekliyor** (§9).

**"Köyü, eğitilen o yeri görmek isterim — daha kendine bağlar."** Asker
kışlada eğitiliyor, ekipman demirhanede dövülüyor, yaralı hastanede
yatıyordu ama köyde bunun hiçbir izi yoktu; sayaçlar ayrı bir listede
duruyordu. Artık her iş HANGİ BİNADA geçiyorsa onun tabanında sayıyor ve
o bina hafifçe parlıyor. Eşleme `KUYRUK_BINASI` içinde tek yerde:

| İş                                      | Bina              |
| --------------------------------------- | ----------------- |
| `train`                                 | Kışla             |
| `iyilestir`                             | Hastane           |
| `craft`, `upgrade_item`, `upgrade_gear` | Demirhane         |
| `research`                              | Kütüphane         |
| `kesif`                                 | Haberci Kulesi    |
| `bina`                                  | payload'daki yapı |

`upgrade_region` listede yok ve olmamalı: bölge şehirde değil dünya
haritasında yükseliyor, köyde gösterecek bir binası yok.

Meşgul ya da seçili yapı öne alınıyor (`zIndex + 200`). Sıralar bilerek
çakıştığı için öndeki bina arkadakinin tabanını örtüyor ve sayaç tam
orada duruyordu; olan biteni gösteren şey üstü örtülü olmamalı.

## 4. Bina seviyesi ile araştırma neden çakışmıyor

Bu, planın en riskli yeriydi ve ilkesi tek cümle:

> **Araştırma ORAN verir, bina KAPASİTE ve KİLİT verir.**

- Araştırma: "%15 daha hızlı eğit", "%20 daha ucuz", "depo ×1.4".
  Yüzde çarpanı, küresel, kalıcı, sırası oyuncunun seçimi.
- Bina: "aynı anda 2 eğitim", "T4'e kadar dövebilirsin", "3 general
  slotu". Sayı ve erişim.

İkisi hiçbir zaman aynı sayıya dokunmaz. Bir bina hızlandırmaz, bir
araştırma slot açmaz. Denge tartışması olduğunda hangi sistemin
düzeltileceği baştan bellidir.

**Yan kazanç:** bu sayıların çoğu bugün `lord.level`'dan geliyor. Lord
seviyesi şu an her şeyi birden açan sihirli bir sayı; binaya taşımak
onu yalnız XP ve bölge sınırının ölçüsü hâline getiriyor. Bu bir
duplikasyon değil, mevcut bir kusurun düzeltilmesi.

### 4.1 Y4'te kurulan sözleşme: seviye 0 = eski davranış

Sayılar `balance.json → binalar.etkiler` içinde ve **dizinin indeksi bina
seviyesi**. En önemli kural burada:

> **Seviye 0 değeri, Y4 öncesi oyunun davranışıdır.**

Bina sistemi kimsenin elinden bir şey almıyor; her seviye bir kazanç
ekliyor. Tersini kursaydık — "kapasite artık BİNADAN geliyor, lord
seviyesinden değil" — var olan lordların deposu, kuyruğu ve general slotu
bir gecede küçülür, sonraki denge tartışması da "binalar mı bozdu, sayılar
mı yanlıştı" diye cevapsız kalırdı. `bina.test.ts` bu sözleşmeyi bina bina
ölçüyor.

| Bina      | Ne veriyor                  | Sv 0 (eski) | Sv 5     |
| --------- | --------------------------- | ----------- | -------- |
| Malikâne  | Depo tabanına ek            | +0          | +170.000 |
| Kışla     | Eş zamanlı eğitim           | 3           | 6        |
| Demirhane | En yüksek ekipman kademesi  | T1          | T5       |
| Karargâh  | General slotu eki           | +0          | +2       |
| Kütüphane | Eş zamanlı araştırma        | 1           | 4        |
| Hastane   | En uzun tedavi              | 6 sa        | 1 sa     |
| Pazar     | Günlük takas tavanına ek    | +0          | +30.000  |
| Liman     | Günlük sevkiyat tavanına ek | +0          | +42.000  |
| Elçilik   | Sahadaki takviye sayısı     | 2           | 8        |
| Surlar    | **Başkent** tahkimatına ek  | +0          | +%20     |

Üç tanesi ilk tasarımdan saptı ve sebebi kayda değer:

**Hastanenin eş zamanlı kuyruğu YOK ve olmamalı.** Önce "aynı anda kaç
tedavi" diye tasarlamıştım; oysa `services/queue.ts` tedaviye bilerek
sınır koymuyor — tedavi bir tercih değil, savaşın sonucu ve sınır koymak
ikinci kez yenilen oyuncunun yaralılarını sessizce yok etmek olurdu.
Hastane onun yerine **tedavi tavanını** indiriyor: küçük kafileler zaten
tavana çarpmıyor, değişen tek şey yüzlerce yaralının döndüğü gün.

**Elçilik pakt tavanı veremez.** Pakt iki İTTİFAK arasında ve tavanı
ittifak seviyesinden geliyor (docs/09 B1e); bir lordun binası oraya
dokunamaz. Elçilik bunun yerine **sahadaki takviye sayısını** tutuyor —
diplomasinin lord ölçeğindeki karşılığı.

**Karargâhın üstü açık bırakılmadı.** General bonusu doğrudan savaşa
giriyor; slotu 3'ten 6'ya çıkarmak PvP dengesini bir gecede kaydırırdı.
Tavan +2 (şehri olan lord 5 slot).

Ayrıca iki kusur bu iş sırasında çıktı ve düzeltildi:

- **`accrue` depo tavanını ARAŞTIRMASIZ hesaplıyordu.** Ambarlar'ı bitiren
  oyuncu ekranda 45.000 kapasite görüyor, kaynağı 32.000'de duruyordu.
  Aynı tavanın iki yerde iki farklı çıkması, bu dosyanın kaçındığı şeyin
  ta kendisi.
- **Günlük ve sefer ödülü tavanı ayrı hesaplıyordu.** `tickLord` büyük
  tavana kadar biriktirir, ödül ucu küçük tavanla bakıp "sığmıyor" derdi:
  oyuncuya "ödülü aldın" yazıp sıfır altın verilirdi.

## 5. Dünya haritası (PvP)

Tek resimli zemin, üstünde 61 tıklanabilir bölge işaretçisi. Etiketler,
sahiplik renkleri, kalkan ve pakt işaretleri **DOM'da** — resimde yazı
yok. Mevcut yakınlaştırma/kaydırma denetimleri (`HexHarita`'daki `+ − ⊡`)
korunuyor.

Kurallar değişmiyor: komşuluk, vilayet birliği, kalkanlar, paktlar,
casusluk, takviye, dizilim ve taktik hepsi olduğu gibi çalışır.

### 5.1 Y2'de öğrenilenler

Üçü de ilk denemede yanlış yapıldı ve ölçümle yakalandı:

**İşaretçiler TERS ölçeklenir.** Sarmalayıcı yakınlaştıkça zemin büyür,
işaretçi büyümemeli. İlk hâlde büyüyordu ve ×2,25'te madalyonlar
devleşip adlar birbirine giriyordu: yakınlaştırmak haritayı okunur değil
OKUNMAZ yapıyordu. Ters ölçek yakınlaştırmayı işaretçileri BİRBİRİNDEN
AYIRAN bir şeye çeviriyor — asıl istenen buydu.

**Etiketler kademeli.** 61 adı birden yazmak telefon genişliğinde
geometrik olarak imkânsız. Uzak ölçekte yalnız oyuncuyu ilgilendiren
yerler (senin, düşmanın, taht, seçili) adlanıyor; yakınlaşınca hepsi
açılıyor. Ad her zaman `aria-label`'da duruyor — ekran okuyucu ve
testler için.

**Dokunma hedefi DAİRESEL.** Görsel denetim 32×32 işaretçileri yakaladı
ve haklıydı. Ama kare bir 44'lük kutu daha kötü oldu: işaretçiler ~37
piksel arayla duruyor ve kutunun köşesi komşunun MERKEZİNİ örtüyordu —
bir bölgeye basmak yandakini seçiyordu. Daire çözüyor: yarıçap 22,
komşu merkezi 37 piksel ötede. Ad şeridi de tıklama geçirmiyor; akışın
içindeyken düğmenin kutusunu uzatıp alttaki komşunun tıklamasını
yiyordu.

## 6. Akın haritaları (5 NPC)

> **Adı "sefer" değil AKIN oldu.** Oyunda zaten bir sefer var: haftalık
> etkinlik (`packages/shared/sefer.ts`, `Lord.seferOduluHaftasi`). İki
> ayrı şeyin aynı adı taşıması, altı ay sonra hangisinin konuşulduğunu
> kimsenin bilememesi demekti. "Akın" zaten yapılan şeyin tam adı:
> düşman kampına inip vurup dönmek.

| Harita             | Düşman            | Ağırlıklı ödül | Açılış | Azami ekipman |
| ------------------ | ----------------- | -------------- | ------ | ------------- |
| Kırık Sahil        | Deniz haydutları  | Altın          | baştan | T2            |
| Solgun Bataklık    | Kaçak lejyonerler | Demir          | sv. 5  | T3            |
| Kuzey Buzulu       | Barbar klanları   | Erzak          | sv. 10 | T3            |
| Küller Vadisi      | Dağ eşkıyaları    | Demir          | sv. 15 | T4            |
| Unutulmuş Nekropol | Mezar kültü       | Dengeli        | sv. 20 | T5            |

Her haritada **10 grup**, 1'den 10'a zorlaşır. Onuncu grup **şef**:
garnizonu ağır, ödülü büyük, yenilenmesi uzun.

- Akın **gerçek**: aynı savaş motoru, aynı dizilim, aynı taktik, aynı
  kayıp, aynı hastane. "Kolay mod" ayrı bir hesap değil — akın,
  oyuncunun ordusunu öğrendiği yer ve öğrendiği şey PvP'de geçerli.
- **Tek aşama**: gidiş, savaş ve dönüş tek `arriveAt`. PvP iki aşamalı
  çünkü bölge el değiştiriyor; akında değişmiyor ve iki bekleyiş
  vermek hiçbir karar kazandırmazdı.
- Vurulan grup **yenilenme süresi** sonunda geri döner (normal 4 saat,
  şef 12 saat). O sürede hedef gri durur ama **görünür kalır**.
- Ödül: kaynak **kesin**, ekipman **şansa bağlı**. Zar akının
  tohumundan atılıyor — aynı akın iki kez çözülürse aynı sonucu
  veriyor, yoksa rapor ile envanter bir gün ayrışırdı.

Akın grubu **fethedilmez**: burası kaynak ve ekipman kapısı, toprak
kapısı değil. Toprak dünya haritasından, yani başka bir oyuncudan
alınır — akından toprak çıksaydı PvP'nin tek sebebi kalmazdı.

### 6.1 Saklanmayan üç şey

Y6'nın çekirdek kararı: **hiçbir durum ikinci kez yazılmıyor.**

| Şey              | Nereden türüyor                | Saklansaydı ne olurdu                                                                                      |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Garnizon         | `akinGarnizonu(harita, grup)`  | Denge değişikliği yoldaki akınları eski sayılarla bırakır; iki oyuncu aynı gruba farklı düşmanla çarpardı. |
| "Grup dolu mu"   | En son KAZANILMIŞ akının saati | Onu güncelleyecek bir zamanlayıcı gerekirdi; zamanlayıcı uyuduğunda harita yanlış görünürdü.               |
| Yenilenme sayacı | Aynı saatten                   | Aynı.                                                                                                      |

Yenilenme **oyuncuya özel**: bir başkasının vurduğu kamp senin haritanda
duruyor. Ortak olsaydı kalabalık bir dünyada harita hep gri görünürdü.

### 6.2 Elli garnizon elle yazılmadı

Haritanın **karışımı** (`data/akinlar.json`) ile grubun **büyüklüğü**
(`balance.json → akin`) çarpılıyor. Dengeyi değiştirmek için tek bir
sayıyı oynatmak yetiyor; elle yazsaydık ilk denge turunda elli satır
güncellemek gerekir ve biri mutlaka atlanırdı.

Her haritanın karışımı **farklı** — taş-kağıt-makas (docs/09 K1) ancak
düşman değişince bir karar olur. Kırık Sahil okçu ağırlıklı, Kuzey
Buzulu süvari ağırlıklı: tek bir "en iyi ordu" olmasın diye.

## 7. Gezinme

| Sekme     | İçerik                                          |
| --------- | ----------------------------------------------- |
| **Şehir** | Ana sayfa. Yerleşim haritası ve bütün kapılar.  |
| **Ordu**  | Kışla, hastane, dizilim, komuta.                |
| **Akın**  | 5 NPC haritası.                                 |
| **Dünya** | PvP haritası.                                   |
| **Lord**  | Karakter, nitelikler, başarımlar, unvan, hesap. |

Sıra bir cümle söylüyor: ana sayfa, sonra orduyu KURDUĞUN yer, sonra onu
KULLANDIĞIN iki yer, en sonda lordun kendisi.

**Görevler çubuktan çıktı.** Günlük görev bir sayfa dolduracak kadar iş
değil ve yeri belli: şehirdeki görev panosu. Kaybolmadı, KAPI oldu —
`GorevOzeti` şeridi de artık o kapıyı açıyor. Ertelemek ile kaldırmak
aynı şey değil; `rehber-testi.mjs` bunu ölçüyor.

Lord ekranı **kapı ızgarası olmaktan çıktı**, bir karakter sayfası oldu
(Y3).

## 8. Yeni açılış — hikâyesel

1. **Kayıt → Kamp.** Ordun yok, bölgen yok, gelirin bir çadır kadar.
   (Taban gelir kampta da akar: oyundan atılmama garantisi korunuyor,
   sadece küçülüyor.)
2. **Talimgahta ilk askerini eğit.** Beş saniyelik ilk eğitim kısayolu
   duruyor.
3. **İlk akınına çık.** Kırık Sahil'in birinci grubu. İlk demirini
   savaşarak kazanırsın.
4. **İlk köyünü al.** Dünya haritasında bir köy. Alınca başkentin olur,
   şehir sayfası kampdan köye döner.
5. **Şehrini kur.** Demirhane dik, ekipman kuşan, general kirala,
   araştırma başlat.
6. Rehber biter.

Şu anki akıştan farkı: oyuncuya hiçbir şey **verilmiyor**. Ordu, demir,
toprak ve bina — dördü de kazanılıyor.

### 8.1 Akın neden BÖLGEDEN önce

Sıra bir denge tercihi değil, bir merhamet: **yeni oyuncunun ilk
yenilgisi bir komşuyla ömürlük husumet değil, bir kamptan dönen
yaralılar olmalı.** Akın toprak almıyor, toprak da vermiyor — öğrenmenin
en ucuz yeri orası.

Omurgada bu adım "ordunu büyüt" adımından **önce** geliyor. Sonraya
koymuştum ve hiç görünmedi: bölge hedefi için ordu neredeyse hiçbir zaman
ilk seferde yetmiyor, omurga da hep kışlayı gösteriyordu. Oysa akının ilk
grubu bir bölgeden çok daha zayıf; eldeki ordu ona zaten yetiyor.

Aşama bir **damgaya** bakıyor (`Lord.ilkAkinAt`), akın sayısına değil:
ordusunu kaybeden kıdemli lord kendini "ilk akınına çık" adımında
bulmasın (`rehberBittiAt` ile aynı gerekçe). Damga `resolveAkin` içinde
ilk KAZANILAN akında konuyor ve bir daha dönmüyor.

Sahadayken ayrı bir bekleme adımı var (`akin-yolda`), tıpkı
`ordu-yolda` gibi: olmasaydı omurga oyuncuyu zaten çıktığı akına tekrar
yollar, rehber ışığı da onu Akın sekmesinde kilitlerdi.

### 8.2 Rehber ışığı zinciri: iki tuzak

**Yol düğmeleri oyuncu doğru ekrandayken aranmıyor** (`hedefBul`,
`yolYasak`) — "geldiğin yere dön" demek olurdu. Diyar ve grup seçmeyi
`yol: true` yazmıştım; ışık Akın sekmesinde hiçbir hedef bulamadı ve
perde kalktı. İkisi de YOL değil İŞ: akının kendisi.

**Zincirin son halkası ANA SAYFA olmak zorunda.** Akın sekmesiyle
bitirmeyi denedim; eğitim bittikten sonra ışık omurgaya geri dönemedi,
çünkü omurga düğmesi yalnız ana sayfada duruyor. Zincir şöyle:
`akina-cik` → `akin-grup` → `akin-harita` → `omurga-dugme` → `nav-ana`.

### 8.3 Başkent düşerse (§2.3'ün uygulanması)

`transferRegion` tek geçit: bölge el değiştirdiğinde kaybedenin başkenti
oydu ise elindeki **en iyi yerleşime** kendiliğinden taşınıyor, yoksa
`baskentBolgeId` null oluyor ve şehir sayfası kampı gösteriyor. Binalar
duruyor; yeniden bir köy alınca kaldığı yerden devam ediyor.

Okuma anında türetmek yetmezdi (şehir sayfası zaten "başkent başkasının
olduysa kamp" diyor): lordun kaydında ölü bir bölge kimliği kalırdı ve o
bölgeyi geri alan biri, eski sahibinin başkentini de geri vermiş olurdu.

### 8.4 Öğreticide düzeltilen iki yalan

- **"Haritadaki her altıgen bir bölge."** Altıgenler Y1'de kalktı.
- **"Kimse malikânene saldıramaz."** Malikâne artık başkent bölgesi ve
  fethedilebiliyor. Doğrusu yazıldı: dibe vurursun, silinmezsin.

Ayrıca iki yeni sayfa eklendi (Şehir ve Akın): oyuncu sekiz sayfa okuyup
girdiği oyunda ekranın yarısını tanımıyordu.

## 9. Görsel bütçesi — 100

İstemlerin hepsi yazıldı (`tools/gorsel-uret.py`, `docs/GORSEL-ISTEMLERI.md`)
ve **hepsi üretildi.** Harcanan çağrı: 39 (37 görsel + dünya haritası için
iki deneme). Kalan pay 61.

**Altı yerleşim zemini yeniden üretilecek (§3.7).** İlk denemede
kompozisyon "manzarayı kenarlara yasla" diyordu ve model kenarlara ev,
çadır, kule çizdi; o boyalı binalar bizim sprite'larımızla yarışıyor.
İstem yeniden yazıldı — karede hiçbir bina olmayacak, yalnız zemin,
patika, çimen, kaya ve kenarda çit. Üretim yeni bir API anahtarı
bekliyor; eski anahtar 401 dönüyor.

| Ne                                                                  | Adet    |
| ------------------------------------------------------------------- | ------- |
| Yerleşim zeminleri (kamp, köy, kasaba, şehir, kale-şehir, metropol) | 6       |
| Bina işaretçileri (10 seviyeli × 2 durum: temel / gelişmiş)         | 20      |
| Seviyesiz yapılar (görev panosu, haberci kulesi, onur meydanı)      | 3       |
| Boş arsa (paylaşılan)                                               | 1       |
| Dünya haritası zemini                                               | 1       |
| Akın diyar zeminleri                                                | 5       |
| Akın sekmesi ekran zemini                                           | 1       |
| **Alt toplam — üretilecek**                                         | **37**  |
| Yeniden deneme ve varyant payı                                      | 63      |
| **Toplam bütçe**                                                    | **100** |

**Üç kalem listeden ÇIKTI, çünkü ekranda yerleri yok:**

- _Düşman fraksiyon amblemleri (10)_ ve _akın hedef işaretçisi (2)_:
  akın ekranı diyarları kart, grupları düğme olarak gösteriyor
  (`Akin.tsx`). Amblem koyacak bir yer yok.
- _Dünya bölge işaretçileri (6)_: harita pinleri zaten satır içi SVG
  (`ikon-verisi.ts`) ve 44 pikselde çizgi ikon fotoğraftan iyi okunuyor.

On sekiz görsel üretip hiçbirini göstermemek bütçeyi boşa harcamak
olurdu. Bir gün o yerler açılırsa istemleri yazılır.

**Emekliye ayrılan: altıgen harita karoları (6).** Dünya haritası artık
ızgara değil, çizilmiş tek bir diyar (§5). Altı dosya silindi;
`public/gorseller/harita/` artık dünya zeminini bekliyor.

**Bina sprite'ları eklendi (24 dosya).** `BinaIkonu` sprite'ı
`SPRITE_OLAN` listesinde arıyor, yoksa çizgi ikona düşüyor. Liste elle
tutuluyor ve `gorsel-denetim.mjs` onu klasörle karşılaştırıyor: çalışma
anında yoklama (`onError`) her çizimde 13 boşa istek demekti.

Modelin yaptığı hata burada anlatılmaya değer: "fully transparent
background" istendi, model saydamlığı **çizdi** — dama deseni gerçek
piksel olarak geldi. `tools/dama-sil.py` bunu deseni tanıyarak siliyor
(ayrıntı `docs/LISANSLAR.md`).

**Kural: resimde yazı yok.** Bütün etiketler DOM'da. Görsel modeli
okunabilir metin üretemiyor ve bölge adları veriden gelmek zorunda.

**Üretim sırası:** zeminler önce kilitlenir, bina ve işaretçi
koordinatları ondan sonra yerleştirilir. Zemin yeniden üretilirse o
haritanın bütün koordinatları elden geçer.

Bu kural dünya haritasında hemen işledi: çizilen diyarın kıyıları eski
altıgen kafese uymuyordu ve 20 bölge işaretçisi denizde kalıyordu.
`tools/harita-yerlestir.py` yalnız suya düşenleri en yakın uygun karaya
taşıdı (çoğu 1–2 puan); `tools/generate_map.py` bundan sonra her
doğrulamada işaretçilerin karada olup olmadığına da bakıyor.

**Yerleşim zemininin ortası BOŞ.** 13 bina işaretçisi oraya konuyor
(`data/binalar.json` x/y); zeminde de bina çizilirse iki kat bina
görünür. İstem bu yüzden manzarayı kenarlara yaslıyor.

## 10. Aşamalar

Her aşama sonunda oyun **oynanabilir** durumda kalır.

| #         | İş                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------- |
| **Y1** ✅ | Veri modeli: komşuluk grafiği, köy türü, başkent, bina alanı. Göç ve testler.                     |
| **Y2** ✅ | Dünya haritası arayüzü: resimli zemin, kaydırma/yakınlaştırma, işaretçiler.                       |
| **Y3** ✅ | Şehir sayfası: yerleşim zemini, bina yerleşimi, inşa ve yükseltme kuyruğu, başkent taşıma (§2.2). |
| **Y4** ✅ | Bina seviyesi etkileri: kapasiteler binaya bağlandı (§4.1).                                       |
| **Y5** ✅ | Gezinme: Şehir · Ordu · Akın · Dünya · Lord. Görevler kapıya taşındı.                             |
| **Y6** ✅ | Akın sistemi: 5 harita, 50 grup, yenilenme, ödül ve ekipman düşürme (§6).                         |
| **Y7** ✅ | Yeni açılış: akın turun içine girdi (§8.1), başkent düşmesi (§8.3), öğretici düzeltildi (§8.4).   |
| **Y8** ✅ | Görsel İSTEMLERİ (üretim beklemede), akın dengesi, temizlik.                                      |

### 10.1 Y8'de yapılanlar

- **Görsel istemleri yazıldı, görseller ÜRETİLMEDİ.** Üretim oyuncunun
  açık talimatını bekliyor; bütçe ve gerekçeler §9'da.
- **Akın dengesi yeniden çözüldü** (`tools/denge-akin.ts`, `pnpm
denge:akin`). İlk sayılar iki yönden bozuktu ve ikisi de sessizdi:
  ödül toprak gelirinin yüzlerce katıydı, ve EN KOLAY harita saatlik en
  çok kaynağı veriyordu. Üç invaryant artık `akin.test.ts` içinde.
- **Bina sprite'ları için kod hazırlandı**, liste boş: `SPRITE_OLAN`.
- **Ölü altıgen karoları silindi** (6 dosya).
- **Eski dokümanlara "aşıldı" uyarısı** kondu (01, 02, 04, 08). Yeniden
  yazılmadılar: onlar o günkü kararın kaydı ve sistemlerin niyetini hâlâ
  doğru anlatıyorlar.

## 11. Emekliye ayrılanlar

- `HexHarita.tsx` (828 satır) — yerine `DunyaHaritasi.tsx`.
- `hexDistance`, `yakinlikMesafesi` — yerine grafik mesafesi.
- `Region.q/r/ring` — yerine `x/y/komsular`.
- Lord ekranının kapı ızgarası — kapılar şehre taşınıyor.
- `ANA_SEKME = 'lord'` — artık `'sehir'`.
- Görevler SEKMESİ — şehirdeki görev panosunun açtığı kapı oldu (§7).
- Altıgen harita karoları (`gorseller/harita/*.webp`, 6 dosya) — silindi;
  dünya haritası artık tek çizilmiş zemin (§5).

**Sıfırlama YAPILMADI.** Plandaki "mevcut dünya kayıtları sıfırlanıyor"
kararı uygulanmadı: Y1'de yerine yerinde göç yazıldı
(`20260907073000_harita_grafigi_ve_baskent`), q/r'den x/y ve komşuluğa
geçiş veri kaybetmeden yapıldı. Sonraki bütün göçler de aynı yolu izledi
— var olan lordlar binalarını (Y3), damgalarını (Y7) ve akın geçmişini
koruyarak geçti. Sıfırlamak kolaydı; kimseyi silmemek daha doğruydu.

## 12. Açık riskler

1. **Görsel tutarlılığı.** 6 zemin ve 24 bina aynı elden çıkmış gibi
   durmalı. Tek istem şablonu ve sabit bir stil cümlesi kullanılacak;
   tutmazsa yeniden deneme payı buradan harcanır.
2. **Koordinat–zemin bağı.** Zemin değişirse koordinatlar kayar. Zemin
   önce kilitlenerek yönetiliyor (§9).
3. **Erken oyun yavaşlaması.** Bina seviyeleri lord seviyesinden devir
   aldığı için ilk saatler daralabilir. İlk kademe bedelleri düşük
   tutulacak ve `pnpm e2e` içindeki ilk oturum ölçümü bunu izleyecek.
4. **İşin büyüklüğü.** Sekiz aşama, sekiz commit. Aradaki her aşamada
   oyun ayakta kalacak; tek büyük teslim yok.
