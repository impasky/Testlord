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

### 6.1 Diyar haritası — gruplar yazı ızgarasından çıktı

Oyuncu: **"Akın kısmında harita yap, 10 NPC karakteri de o haritaya ekle;
oyuncu o karaktere tıklayarak akın saldırısı yapsın."**

Önceden on grup iki sütunlu bir YAZI ızgarasıydı: on düğme, on isim,
hepsi aynı görünüyordu. Diyarın neresi olduğu, nereye kadar gelindiği ve
sonuncunun şef olduğu hiçbir yerde görünmüyordu.

Artık diyar açılınca **kare bir harita** geliyor: zemin o diyarın arazisi,
üstünde on düşman figürü, aralarında sırayı gösteren kesik bir iz.
Figüre dokunmak sefer kartını açıyor — akış değişmedi, görünen şey
değişti. Diyar kapağı yerinde duruyor (kapalı listede diyarı o tanıtıyor).

**Yol beş diyarda da AYNI** (`data/akinlar.json` → `yol`). İki sebep:
oyuncu bir kez öğreniyor ("1 sol altta, şef sağ üstte") ve bu her diyarda
geçerli oluyor; ayrıca zemin istemi tam bu yolu tarif ediyor ("sol alttan
sağ üste dolanan bir patika"), yani yol diyara göre değişseydi zeminle
koordine edilemezdi — zemin üretilirken hangi yolun geleceği bilinmiyor.
Diyarı ayıran şey zemin.

Aralıklar ölçüldü: kare haritada en yakın iki kamp 54 piksel, işaretçi
genişliği %14 (50 piksel) — çakışmıyorlar.

**Elli grubun elli çizimi yok ve olmamalı.** Her diyarın BİR askeri ve
BİR şefi var: asker 1-9. kamplarda, şef 10.'da (ve daha iri çiziliyor).
Oyuncunun sorduğu şey "burada tam olarak kim var" değil, "hangi
diyardayım ve sonuncu muyum". On figür iki sayfada üretildi — beş asker
bir karede, beş şef bir karede (§9.1).

Kamp durumu üç hâlde okunuyor: açık kamp renkli, kilitli kamp GRİ,
vurulmuş kamp solgun ve üstünde yenilenme sayacı. Diyar açılınca harita
kendiliğinden ekrana kaydırılıyor — kart sırası kapak → ad → özet →
harita ve telefonda harita ekranın altında kalıyordu.

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

### 9.1 Bütünlük: tek tek üretim BIRAKILDI

Oyuncu: **"Bu iş böyle olmayacak, bütünlük hissi yok."** Haklıydı ve
sebebi tek cümleyle söylenebilir: **24 bina 24 ayrı çağrıyla üretildi.**
Her çağrı modelin dağılımından bağımsız bir örnek — her binanın kendi
kamera açısı, kendi ışık yönü, kendi renk sıcaklığı, kendi ayrıntı
yoğunluğu var. Metinde "aynı üslup" yazmak bunu düzeltmiyor; CSS gölgesi
de düzeltmiyor, denendi (§3.6, §3.7).

Yeni akış iki kurala dayanıyor:

**1. Aynı karede üretilen varlıklar zaten tutarlıdır.** Model dört binayı
tek resimde çizerken dördüne de aynı kamerayı ve aynı güneşi uygulamak
zorunda. Binalar artık tek tek değil **dörtlü sayfalar** hâlinde
üretiliyor (`SAYFALAR`, 6 sayfa). Eşleştirme de anlamlı: her sayfada aynı
binanın iki hâli (`_1` ve `_5`) yan yana — ayrı üretildiklerinde malikâne
1 ile malikâne 5 akraba bile değildi.

**2. Sayfaları birbirine PLAKA bağlıyor.** İlk sayfa beğenilene kadar
yeniden denenir; oyunun bütün görünüşü o tek karede kararlaşır. Sonra her
sayfa ve her zemin o plaka **girdi verilerek** üretilir. Lord portreleri
zaten böyle üretilmişti ve beşi de aynı adam çıkmıştı.

```bash
python3 tools/gorsel-uret.py --plaka    # beğenene kadar tekrarla
python3 tools/gorsel-uret.py --sayfa    # kalan sayfalar + bölme + hizalama
```

Maliyet de düşüyor: 30 ayrı çağrı yerine **12** (6 sayfa + 6 zemin).

**Saydamlık artık istenmiyor, ANAHTAR RENK isteniyor.** Modelden "saydam
zemin" istendiğinde saydamlığı _çizmişti_ (dama desenini gerçek piksel
olarak, bkz. `tools/dama-sil.py`). Düz ve doygun bir magenta ise
güvenilir geliyor ve ayıklaması kesin. `gorsel-ayikla.py` zaten çok
figürlü bir sayfayı bileşenlere ayıran araç; tam bunun için yazılmıştı.

Ayıklamaya iki düzeltme gerekti ve ikisi de sahte bir magenta sayfayla
ölçülerek bulundu:

- **Kenar taşırma.** Saydam piksellerin RGB'si zemin rengiyle
  dolduruluyordu; koyu sayfada görünmeyen bu şey magenta zeminde
  binaların etrafında mor çerçeve bıraktı. Artık her boş piksel en yakın
  figür pikselinin rengini alıyor.
- **Gerçek anahtar çözümü.** Kenar pikselleri zeminle KARIŞMIŞ geliyor
  (P = a·C + (1−a)·K); "zemin mi değil mi" diye ikiye ayırmak imkânsız,
  çünkü yarısı zemin. Alfa artık anahtara uzaklıktan çıkarılıyor ve renk
  geri hesaplanıyor. Eşik taranarak seçildi: 150'de mor kenar kalıyor,
  400'de duvarlar yarı saydam oluyor — 300 ikisinin de olmadığı yer.

**Kent varlıkları yeniden üretildi (§9.1).** 24 bina + 6 zemin,
sayfa düzeniyle ve tek plakadan. Harcanan çağrı bu turda 14: 1 plaka +
5 sayfa + 6 zemin + 2 zemin yenilemesi (kamp ve metropolün kenarına
plakanın magentası bulaşmıştı; istemde "çerçeveyi baştan başa doldur,
hiçbir yerde magenta olmasın" satırı bu yüzden var). Toplam harcanan 53,
kalan 47.

Zeminler artık BİNASIZ. Eski istem "manzarayı kenarlara yasla" diyordu ve
model kenarlara ev, çadır, kule çizmişti; o boyalı binalar sprite'larla
yarışıyordu. Şimdi karede yalnız zemin, patika, çimen, kaya ve kenarda
çit var — ekrandaki her bina bizim.

**Akın diyarları ve dünya haritası da plakadan geçti** (6 görsel + 2
yenileme; toplam harcanan 61, kalan 39). Şehir ekranı toparlanınca geri
kalanı ondan kopuk kalmıştı — oyuncu ard arda üç ekran geziyor ve üçü
farklı fırçadan çıkmış görünüyordu.

Bu üçünde **kamera devralınmıyor ve devralınmamalı**: plaka izometrik bir
bina, akın diyarı geniş bir manzara, dünya haritası tam tepeden bir
parşömen. Her birinin çerçevelemesi kendi `kompozisyon` satırında;
plakadan gelen şey ışık, palet, çizgi kalınlığı ve boyama üslubu. İstem
bunu açıkça söylüyor ("Do NOT copy its camera angle or its subject").

**Magenta sızıntısı üç kez çıktı** (kamp, metropol, sonra kuzey buzulu ve
küller vadisi): plaka girdi olduğu için model onun zeminini kenarlara
taşıyor. Hem yerleşim hem akın kompozisyonunda artık "çerçeveyi baştan
başa doldur, hiçbir yerde magenta olmasın" satırı var.

**Harita yenilenince işaretçiler yeniden oturtuldu** — §9'un kendi kuralı:
zemin önce kilitlenir, koordinatlar sonra. Yeni kıyılara 7 işaretçi 1-2
puan oynadı (`harita-yerlestir.py`), `generate_map.py` temiz.

### 9.2 Eski çağdan kalan aileler de plakadan geçti

Şehir, akın ve dünya haritası plakadan geçince geride beş aile kaldı:
birimler (5), lord (5), generaller (12), ekipman (30), bölge sahneleri
(13). Hepsi tek tek üretilmişti — 65 ayrı çağrı, 65 ayrı kamera. Oyuncu
şehirden ordu ekranına geçtiğinde üslup değiştiği belli oluyordu.

Sayfa akışı bunlara olduğu gibi uymuyordu, iki şey eklendi:

- **`Duzen`** — sayfadaki varlığın ne olduğu. `zemin` zemine basan figür
  (bina, birim, düşman, lord): çizim kutunun ALTINA oturtulur, çünkü
  arayüz onu tabanından çakıyor (§3.6). `ikon` envanter ikonu ya da
  portre (ekipman, general): çizim ORTALANIR — çapraz duran bir kılıcın
  tabanı yok ve otuz ikon alt alta dizildiğinde biri aşağı biri yukarı
  kaymış görünmemeli. `pano` dikdörtgen sahne (bölgeler): kırpılır, opak
  bırakılır, hizalanmaz.
- **`sprite-hizala.py --orta`** ve **`_panolari_bol()`** — sırasıyla o iki
  yeni düzenin karşılığı.

Eşleştirme yine anlamlı: her ekipman sayfasında BİR yuvanın beş kademesi,
her bölge sayfasında BİR yerin üç aşaması, lord sayfasında aynı adamın
beş kuşamı. T1 ile T5'in akraba görünmesi ancak aynı karede çizilirse
oluyor.

**Stil sözleşmesi öznesizleşti.** İlk sayfalar "isometric game BUILDING
asset" diye başlayıp "no people" ile bitiyordu; bina sayfalarında
doğruydu ama sözleşme HER sayfaya ekleniyor. Üstüne plakayı iliştiren
cümle "Only the buildings change" diyordu ve plaka bir bina plakası.
Sonuç: lord sayfası beş bina, general-2 dört bina döndü — model doğru
olanı yaptı, biz yanlış şeyi istedik. Üç düzeltme:

- Sözleşmede özne yok; kamera, güneş, palet ve fırça var.
- Özne `SAYFA_KONUSU`'nda, klasör başına, ve istemin EN BAŞINDA. Olması
  gerekeni söylediği kadar olmaması gerekeni de söylüyor ("no buildings
  and no structures anywhere in the frame").
- Plaka artık yalnız üslup referansı: "Do NOT copy its subject… the
  reference shows buildings, but this page does not have to."

**Pano sayfasına ayrıklık şartı eklendi.** Kale sayfası üç aşama yerine
TEK sürekli kale çizdi; bölücü onu üçe böldüğünde elde kalan şey aynı
yerin üç kırpıntısıydı. İstem artık panoların birbirinin devamı
olmamasını açıkça istiyor (ufuk ve arazi boşlukta devam etmeyecek).

Bu turda harcanan 17, toplam 85, kalan 15. Lord, general-2 ve bölge-kale
sayfaları düzeltilmiş istemle yeniden üretilecek (3 çağrı); o üç ailenin
eski görselleri o zamana kadar yerinde duruyor — bina resmi lord diye
yayına gitmesin.

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

### 9.3 Baştan sona oynandı — üç hata çıktı

Oyun yeni bir lordla açılıştan ilk fethe kadar, sonra gelişmiş bir lordla
beş sekme ve sekiz kapının hepsinde oynandı. Çıkanlar:

**1. Dünya haritasında bölge adları üst üste biniyordu.** Kademe kuralı
("uzak ölçekte yalnız seni ilgilendirenler") doğruydu ama ölçütü
yanlıştı: `Boolean(r.owner)` dolu bir diyarda neredeyse her bölge için
doğru, yani kural pratikte "hepsini göster"e dönüşüyordu. Ölçüldü: 19
etiketten 8 çifti çakışıyordu. Çözüm haritacılığın kendi çözümü —
SEYRELTME. Etiketler önceliğe göre sıralanıp sırayla yerleştiriliyor,
yerleşmiş bir kutuya değen susturuluyor (seçili → taht → senin → düşman →
gerisi). Hesapla değil ÖLÇÜLEREK: etiketin genişliği metne bağlı ve
harita yakınlaştıkça işaretçiler ters ölçekleniyor. Susan ad kaybolmuyor;
madalyonu duruyor, yakınlaşınca yeri açıldığı an geri geliyor.
`gorsel-denetim.mjs` artık çakışma sayıyor (`harita-etiket`).

**2. "Evde asker yok. Önce Kışla'da asker eğit."** — 831 askeri dönüş
yolunda olan lorda söyleniyordu. Yanlış olmakla kalmıyor, pahalı: oyuncu
gereksiz asker yazdırıp erzağını yakıyor. Evdeki ordunun boş olması ile
ordunun olmaması ayrı şeyler; `usedSlots` yürüyüştekini de sayıyor.
Akın ve harita ekranlarında ordu sahadaysa artık "Ordun sahada,
döndüğünde…" yazıyor ve "Kışla'ya git" düğmesi çıkmıyor.

**3. General slotu cümlesi başlıkla çelişiyordu.** Başlık "0/4" diyor,
altındaki cümle "1 + Liderlik/30, en fazla 3". Cümle elle yazılmıştı ve
karargâhın kattığı slottan (`karargah_general_slotu_ek`) hiç söz
etmiyordu — yani saklanan şey tam da oynanacak kısımdı: o slotu açan bir
fetih. Cümle artık sayıyı `q.data.slots`ten ve kuralı
`GENERAL_SLOT_RULE`dan okuyor.

Bir de düzen kusuru: Pazar'daki "vereceğin" satırında üç kutu 390 pikseli
aşıyordu ve stok altı haneye çıkınca üçüncüsü kesiliyordu ("Erzak
103.51"). Miktar kendi satırına indi.

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

## 11. Dünya haritası — sıfırdan

### 11.1 Sorun: ızgara sökülmüştü, izi kalmıştı

§1'de altıgen ızgara kaldırıldı ama komşuluklar **eski altıgen
komşuluklarından türetilmişti**. Yani görüntüsü gitti, kafes kaldı.
Ölçüldü:

| Ne                  | Eski harita        |
| ------------------- | ------------------ |
| Tam 6 komşulu bölge | 37 / 61            |
| Tam 4 komşulu bölge | 18 / 61            |
| Farklı `y` değeri   | 24 (61 bölge için) |
| Derece dağılımı     | yalnız {3, 4, 6}   |

İşaretçiler satır satır diziliydi ve resmedilmiş bir diyarın üstünde
askeri bir şablon duruyordu. Mekanik sonucu daha ağırdı: **her yer
birbirine benziyordu.** Bir geçidi tutmakla ovanın ortasında oturmak
arasında fark yoktu, çünkü herkesin altı komşusu vardı. Harita bir karar
alanı değil, bir listeydi.

### 11.2 Yeni sıra: önce coğrafya, sonra siyaset, en son koordinat

Eski sıra resimle başlıyordu ve işaretçiler sonra ona oturtuluyordu
(`harita-yerlestir.py` 7 tanesini denizden karaya taşımak zorunda
kalmıştı). Yeni sıra `tools/harita-kur.py`de ve altı adım:

**1. Arazi resimden okunuyor** (`tools/harita-arazi.py`). Üç ölçü yetiyor
ve üçü de tek bir gri resimden çıkıyor: sıcaklık (R−B) karayı denizden,
**doku** (15 pikselde parlaklığın standart sapması) düz ovayı dağdan ve
ormandan, bulanık parlaklık da dağı ormandan ayırıyor. Ölçüldü: ova
5–10, orman ~30, dağ ~38–41. Eşikler göz kararıyla değil, resmin üstüne
boyanıp **bakılarak** seçildi (`--onizleme`).

**2. Bölgeler araziye serpiliyor**, ızgaraya değil. Mavi-gürültü örnekleme
(Mitchell'in "en iyi aday" yöntemi): her yeni nokta için altmış aday
atılıyor ve mevcutlara en uzak olan seçiliyor. Sonuç düzensiz ama dengeli
dağılmış bir serpinti. **En küçük aralık araziye göre değişiyor** ve bu
bir süslemenin değil oynanışın kararı: ovada 8,6 — dağda 11,2. Dağın az
bölgesi olması, dağı geçmenin az yolu olması demek.

**3. Komşuluk Delaunay'dan çıkıp budanıyor.** Deniz geçen kenar atılıyor
(kara yolu yok), çok uzun kenar atılıyor (uzaktan bakışan iki yer komşu
değildir), **dağ aşan kenar atılıyor** — sonra dağın arkasına ulaşmak
için yalnız **en kısaları** geri ekleniyor. Bunlar GEÇİT.

**4. Vilayetler grafikte büyüyor**, haritada değil: altı tohumdan dengeli
genişleme. Her vilayet bitişik bir siyasi blok, cetvelle çizilmiş bir
dilim değil. Adlar da karakterlerine göre dağılıyor — Demirvadi en dağlı
vilayete, Karaorman en ormanlısına, Aksu Ovası en ovalısına gidiyor.

**5. Tür arazi + stratejik rol.** Dağda maden, ovada tarla, kıyıda ve
kavşakta şehir, **geçidin ağzında kale**. Köy sınır bandında (Taht
Kalesi'ne 4+ adım) — bu bir tasarım kuralı: köy ilk fethin yeri ve
garnizonu buna göre zayıf.

**6. Denge mesafeden ve eskisinin aynısı.** Gelir çarpanı ve NPC
garnizonu hâlâ Taht Kalesi'ne kaç adım uzakta olduğunla belirleniyor.
Harita değişti, dengenin omurgası değişmedi.

### 11.3 Sonuç

| Ne                  | Eski      | Yeni               |
| ------------------- | --------- | ------------------ |
| Derece dağılımı     | {3, 4, 6} | {2, 3, 4, 5, 6, 7} |
| Tam 6 komşulu       | 37        | 5                  |
| İki komşulu (boğaz) | 0         | 18                 |
| Geçit               | yok       | 14                 |
| Farklı `y` değeri   | 24        | 61                 |
| Çap                 | 8         | 10                 |

**Geçit haritanın bütün meselesi.** Sıradağın öte yanına ancak birkaç
noktadan geçiliyor ve o noktaları tutan bölge — çoğu zaman bir kale —
arkasındaki her şeyi tutuyor. Motor için geçit ayrı bir kural değil
(komşuluk komşuluktur); ayrım arayüzde, çünkü dar boğazı görmeyen oyuncu
orayı tutmanın değerini anlayamaz.

**Harita ekranına yollar geldi.** Oyunun en önemli kuralı — saldırabildiğin
yer, toprağına BİTİŞİK olan yer — veride yazılıydı ama ekranda hiç
çizilmiyordu; oyuncu iki bölgenin komşu olup olmadığını ancak deneyerek
öğreniyordu. Artık her komşuluk soluk bir yol, her geçit turuncu kesik
çizgi ve göstergede kendi satırı var.

**Madalyon uzakta küçüldü** (32 → 24 piksel). Eşit kafeste 32 denk
düşüyordu; serpintide bitişikleri birbirine değiyor ve altındaki harita
hiç görünmüyordu — oyuncunun baktığı şey diyar değil bir rozet
kalabalığı oluyordu. Dokunma hedefi değişmedi (44 piksellik daire).

### 11.4 Denge testi iki şey yakaladı

**Köy iç halkaya düşmüştü.** İlk sürümde tür ataması mesafeyi bilmiyordu;
bir köy 3. halkaya düştü ve o halkanın 160 kişilik garnizonunu aldı —
yani oyunun en zayıf bölgesi en sert kapılarından biri oldu. Köy artık
yalnız sınır bandında.

**Testin kendisi de dosya sırasına bağlıydı.** `KENAR_NPC` "dosyadaki ilk
4-adım-uzaklıktaki köy olmayan bölge"nin garnizonunu alıp üç ayrı
tahkimatla sınıyordu. Harita yeniden kurulunca o sıra değişti ve test,
oyunun hiç sormadığı bir soruyu sormaya başladı: "bir KALE garnizonu bir
TARLA tahkimatının arkasında dursa alınır mı?" Öyle bir bölge yok. Artık
her tür kendi garnizonuyla ölçülüyor; tasarım cümlesi aynı kaldı.

### 11.5 Devasa dünya: 121 bölge, kaydırarak gezilen harita

Oyuncu: **"Haritayı devasa yapsak, gerçekten devasa olsa ve oyuncu
kaydırarak sağa sola yukarı aşağı gitse?"**

Doğru soru, çünkü bir dünyanın büyük hissettirmesi onu tek bakışta
GÖREMEMENDEN geliyor. Harita 61 bölgeyle tek karede duruyordu; dünya
değil bir tahta gibi okunuyordu.

**Dünya ikiye katlandı — her iki boyutta da.**

| Ne                    | Önce | Sonra |
| --------------------- | ---- | ----- |
| Bölge                 | 61   | 121   |
| Oyuncu kapasitesi     | 120  | 240   |
| Oyuncu başına bölge   | 0.50 | 0.50  |
| Geçit                 | 14   | 25    |
| Çap (en uzak iki yer) | 10   | 14    |
| Halka                 | 0–6  | 0–8   |

**Kapasite de ikiye katlandı ve bu şart.** Bölgeyi iki katına çıkarıp
lord sayısını sabit bırakmak herkese yer açmak, yani çatışmayı kaldırmak
olurdu. Kıtlık (oyuncu başına 0,50 bölge) oyunun gerilim kaynağı ve
`balance.test.ts` bunu 0,75 tavanıyla koruyor.

Çap 14, keyfî değil: yürüyüş süresi adım başına 12 dakika ve tavan 360
dakika. 14 adım = 168 dakika, yani en uzak köşe üç saatten kısa —
tavanın yarısı. Büyük dünya uzak demek, ulaşılmaz demek değil.

**Harita artık YAKIN açılıyor** (×2,4), oyuncunun kendi toprağının
üstünde. Dünyanın kenar uzunluğunun ~%42'si görünüyor: 121 bölgenin
yaklaşık 20'si. Yani ekran eskisinden SAKİN — dünya büyürken
kalabalıklaşmadı. Gerisi kaydırarak bulunuyor; "sığdır" düğmesi (⊡) bir
dokunuşta bütünü getiriyor.

Kaydırılan bir haritanın iki tane olmazsa olmazı var ve ikisi de eklendi:

- **Ekran dışı okları.** Yoldaki ordun, kampın ve toprakların ekranın
  dışında kaldığında kenarda küçük bir ok beliriyor; dokununca oraya
  götürüyor. En fazla dört tane ve öncelik sırası belli (önce ordular,
  sonra ev, sonra öteki topraklar) — yoksa kenar ok ormanına dönerdi.
- **Seçilen bölge ekrana geliyor.** Bölgeyi her zaman parmak seçmiyor:
  omurga "şuraya saldır" diyor, ittifak ortak hedef işaretliyor, olay
  şeridi bir savaşı gösteriyor. Seçim ekranın dışındaysa harita oraya
  kayıyor. Görünen bir bölge için kaymıyor — oyuncunun kurduğu görüntüyü
  sebepsiz bozmak olurdu.

Etiket kademeleri de kaydı (1,35 / 2,80): açılış artık ORTA kademe —
kısa adlar, sahip etiketi yok. Tam ayrıntı bir yakınlaştırma uzakta.

**Ölçüldü:** 121 işaretçiyle telefon profilinde 62 FPS, etiket çakışması
sıfır, konsol hatası sıfır.

**Testlerden dört sihirli sayı çıktı.** `61` üç ayrı yerde (oyun döngüsü,
shard testi, `generate_map.py`) ve `12` bir yerde (köy sayısı) elle
yazılmıştı. Dünya büyüyünce dördü de, tasarımda hiçbir şey bozulmadığı
hâlde kaldı. Hepsi kanonik dosyadan okunur oldu: ölçülen şey sayının
kendisi değil, dosyanın kendi içinde tutarlı olması.

### 11.6 Yapılmayan: parçalı zemin

Zemin hâlâ tek 1024×1024 WebP. Altı vilayeti ayrı ayrı üretmek hem
netlik kazandırırdı hem de bir vilayeti yeniden çizmeyi mümkün kılardı —
ama bu altı görsel üretimi demek ve o iş görsel bütçesine bağlı (§9).
Haritanın ilk sorunu zaten çözünürlük değildi, **topolojiydi.** Dünya iki
katına çıkınca çözünürlük daha çok önem kazandı: ×2,4'te 1024 piksellik
zemin telefonun 3× ekranında gerilerek çiziliyor. Boyalı üslup bunu
büyük ölçüde saklıyor ama parçalı zemin artık bir cila değil, sıradaki
iş.

## 12. Dokuz cila

Oyuncunun listesi. Üçüncü madde (harita ızgaradan çıksın) §11'de yapılmıştı;
kalan sekizi burada.

**1. Erzak uyarısı bir plan oldu.** Kaynak çubuğu "azalıyor" diyordu — bir
uyarı değil bir gözlem. Ne zaman biteceğini ve bitince ne olacağını
bilmeden karar verilemez. Artık "78 sa sonra biter" yazıyor, ipucunda
"sonra ordu saatte %5 firar verir" duruyor ve omurgaya BİTMEDEN ÖNCEKİ
adım eklendi (12 saat eşiği: bir oturumdan öbürüne geçen süre). Sayı
motordan geliyor (`erzakTukenmesiSaat`), arayüzde ikinci kez
hesaplanmıyor.

**2. Savaş raporuna akış geldi.** Rapor sabit şartları anlatıyordu
(gücüm azdı, surları vardı, okçum mızrakçısını yedi); söylemediği şey
savaşın AKIŞIydı. Yeni sebep `donum` beş turluk çubuk grafiğini tek
cümleye çeviriyor: "Makas 3. turda en çok açıldı: 1.240 güce karşı 890."
Uydurma yok — motor tur tur kayıp simüle etmiyor (`combat.ts` ortalama
alıyor), o yüzden "3. turda 40 mızrakçı düştü" DENMİYOR. Uydurulmuş bir
kayıp sayısı oyuncuya oyunun çalışmadığı bir kuralı öğretirdi.

**4. Sur seviyesi haritada görünüyor.** Tahkimat savaşın en büyük tek
kalemi olabiliyor ama 1. seviye tarlayla 5. seviye kale haritada aynı
duruyordu; oyuncu bunu ancak hedefini SEÇTİKTEN sonra görüyordu. Madalyon
artık taş renkli bir dış halka taşıyor, kalınlığı tahkimatla büyüyor.
Göstergede kendi satırı var ("surlu").

**5. Komşuyla ilk temas.** Diyar kalabalık ama sessizdi: başka bir lordun
varlığını ancak saldırıya uğrayınca hissediyordun. Artık biri toprağına
BAKTIĞINDA olay akışına düşüyor: "Falanca lord, Akpınar üzerine göz
dikti." Bedava — uç zaten çağrılıyor. Kısıtlar dar: NPC bölgesi değil,
kendi toprağın değil, müttefik değil ve aynı çift için GÜNDE BİR.

**6. Kuyruktaki bina iskele oldu.** Bekleme sayıyla anlatılıyordu ve
şehirde hiçbir izi yoktu: yükseltilmekte olan kışla, duran kışlayla
birebir aynıydı. Artık üstüne ahşap iskele çiziliyor. Çizim değil ÇİZGİ:
yeni görsel üretmiyoruz, bütün binalarda çalışıyor.

**7. Yoldaki ordu sancak taşıyor.** Önce düz bir daireydi; oyuncunun
gördüğü şey bir ordu değil bir imleçti. Sancak yönü de taşıyor — bez
gidiş yönüne bakıyor, dönüşte yeşil ve ters yöne.

**8. Lord ekranı portre oldu — ve figür KUŞAMDAN geliyor.** İki hata
vardı. Figür 56 pikseldi, yani oyunun adını taşıyan karakter bir avatar
kadardı. Daha ağırı: `lord_1..lord_5` görselleri beş ayrı adam değil AYNI
adamın beş kuşam hâli, ama arayüz onlardan birini ADIN HASH'İYLE
seçiyordu. Yani ekipman yükseltmenin görünür karşılığı hiç yoktu. Artık
altı yuvanın tier ortalaması figürü belirliyor (`kusamSeviyesi`) ve
üstünde neden değiştiğini söyleyen bir rozet duruyor: Çaylak → Efsanevi.

**9. Akın ganimeti dökülüyor.** Tek satır düz yazıydı ve en heyecanlı
kısım — "bir ekipman düştü" — envantere gidip aramayı gerektiren bir
dipnottu. Artık her kaynak kendi ikonuyla, düşen parça KENDİ GÖRSELİYLE
ve nadirlik renginde duruyor. Sunucu artık parçanın yuvasını ve tier'ını
da dönüyor (tek ek sorgu, beş akın için bir kez).

## 13. Emekliye ayrılanlar

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

## 14. Açık riskler

**Harita değişikliği CANLI dünyaları da değiştiriyor.** `world-map.json`
tek ve kanonik; `seed.ts` açılışta `refreshWorldRegions` ile bütün
dünyaların bölgelerini ona eşitliyor. Geliştirme sırasında doğru davranış
— ama yayında bir oyuncunun tuttuğu "Gölcük Köyü" bir gecede başka bir
yer olabilir. Bunun doğru cevabı harita SÜRÜMLEMESİ: her dünya hangi
harita sürümüyle açıldığını taşısın, yeni harita yalnız yeni dünyalara
uygulansın. Bugün yapılmadı çünkü oyun henüz yayında değil; yayına
çıkmadan önce yapılmalı.

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
