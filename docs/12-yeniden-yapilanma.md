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

| Soru | Karar |
|---|---|
| Şehir sayfası ↔ bölge ilişkisi | **Başkentini taşırsın** |
| Harita çizim tekniği | **Karma**: dünya/sefer tek resim + kod etiketi, yerleşim zemin + sprite |
| NPC seferleri | **Gerçek sefer, kısa süre** — savaş motoru, dizilim, taktik aynen |
| Alt çubuk | **Şehir · Ordu · Sefer · Dünya · Lord** |
| Başkent kaybı | **Düşürülür**, elindeki en iyi bölgeye taşınırsın; hiç kalmazsa kampa |
| Mevcut dünyalar | Sıfırlanacaktı; **göç yazıldı** — bkz. §1.4 |
| Sefer grupları | **Yenilenme süresi** ile geri döner |
| Şehirdeki binalar | **Görünür ama inşa edilmemiş**, kaynakla dikilir |
| Bina seviyesi | **Var** (1–5) |
| Başkent taşınınca binalar | **Seninle taşınır** |

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

| Başkent | Kademe | Görünüm |
|---|---|---|
| yok | **Kamp** | Bir ateş, birkaç çadır, talim direği |
| `koy` | **Köy** | Çamurlu yol, ahşap evler, palisad |
| `sehir` sv. 1–2 | **Kasaba** | Taş meydan, ilk sur, çarşı |
| `sehir` sv. 3–5 | **Şehir** | Forum, su kemeri, tapınak |
| `kale` | **Kale-şehir** | Surlar hâkim, askerî yerleşim |
| `taht` | **Metropol** | Vangionum ölçeği |

### 2.2 Taşınma

Başkent olabilen bir bölgeyi fethedince "başkentini buraya taşı" teklifi
gelir. Kabul edersen:

- Şehir sayfası yeni yerleşimi gösterir, kademe yükselir.
- **Binaların seninle gelir.** Seviyeleri korunur.
- Eski başkent normal bir bölgen olarak kalır.

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

| Bina | Kapı | Seviye ne veriyor | Bugün nereden geliyor |
|---|---|---|---|
| Malikâne | malikane | Depo kapasitesi tabanı | `storageCapacity(lordLevel)` |
| Kışla | kisla | Eş zamanlı eğitim kuyruğu | sabit |
| Demirhane | demirhane | Dövülebilir en yüksek tier | `canCraftTier(lordLevel, …)` |
| Karargâh | generaller | General slotu tavanı | `generalSlots(liderlik)` |
| Kütüphane | arastirma | Eş zamanlı araştırma | sabit (1) |
| Hastane | (ordu) | Eş zamanlı tedavi kafilesi | yok, tek kuyruk |
| Pazar | (pazar) | Günlük takas tavanı | `gunlukTavan(lordSeviyesi)` |
| Liman | (ticaret) | Sevkiyat tavanı ve hızı | sabit |
| Elçilik | ittifak | Pakt sayısı tavanı | sabit |
| Surlar | — | Başkent tahkimatı | bölge türünden |

### 3.2 Seviyesiz yapılar (3)

Görev panosu (günlük görevler) · Haberci kulesi (olaylar) · Onur meydanı
(sıralama). Bunlar bilgi gösteriyor, kapasite vermiyor; seviye vermek
anlamsız olurdu.

### 3.3 Kademe, bina seviyesini kısıtlar

| Yerleşim | Bina seviye tavanı |
|---|---|
| Kamp | — (yalnız çadır ve talimgah, sabit) |
| Köy | 2 |
| Kasaba | 3 |
| Şehir | 4 |
| Kale-şehir | 4 (Surlar 5) |
| Metropol | 5 |

Fethin karşılığı budur: **T5 ekipman dövmek için gerçek bir şehir
gerekir.** Yerleşim kademesi böylece dekor olmaktan çıkıp bir tavan
oluyor.

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

## 6. Sefer haritaları (5 NPC)

| Harita | Düşman | Ağırlıklı ödül | Açılış |
|---|---|---|---|
| Kırık Sahil | Deniz haydutları | Altın, ganimet | baştan |
| Solgun Bataklık | Kaçak lejyonerler | Demir | sv. 5 |
| Kuzey Buzulu | Barbar klanları | Erzak | sv. 10 |
| Küller Vadisi | Dağ eşkıyaları | Demir, ekipman | sv. 15 |
| Unutulmuş Nekropol | Mezar kültü | En iyi ekipman | sv. 20 |

Her haritada **10 grup**, 1'den 10'a zorlaşır. Onuncu grup **şef**:
garnizonu ağır, düşürdüğü ekipman kademesi yüksek.

- Sefer **gerçek**: ordu yola çıkar, kayıp verir, yaralılar hastaneye
  döner. Dizilim ve taktik aynen işler.
- Süre kısa: PvP yürüyüşünün küçük bir katı.
- Vurulan grup **yenilenme süresi** sonunda geri döner (normal 4 saat,
  şef 12 saat). O sürede hedef gri durur.
- Ödül: kaynak kesin, ekipman şansa bağlı. Ekipman tier'i grubun
  zorluğuna bağlı — Nekropol'ün şefi en iyi kaynak.

Sefer bölgesi **fethedilmez**: burası kaynak ve ekipman kapısı,
toprak kapısı değil. Toprak dünya haritasından alınır.

## 7. Gezinme

| Sekme | İçerik |
|---|---|
| **Şehir** | Ana sayfa. Yerleşim haritası ve bütün kapılar. |
| **Ordu** | Kışla, hastane, dizilim, komuta. |
| **Sefer** | 5 NPC haritası. |
| **Dünya** | PvP haritası. |
| **Lord** | Karakter, nitelikler, başarımlar, unvan, hesap. |

Lord ekranı **kapı ızgarası olmaktan çıkıyor**, bir karakter sayfasına
dönüyor. Günlük görevler şehirdeki görev panosuna taşınıyor.

## 8. Yeni açılış — hikâyesel

1. **Kayıt → Kamp.** Ordun yok, bölgen yok, gelirin bir çadır kadar.
   (Malikâne taban geliri kampta da akar: oyundan atılmama garantisi
   korunuyor, sadece küçülüyor.)
2. **Talimgahta ilk askerini eğit.** Beş saniyelik ilk eğitim kısayolu
   duruyor.
3. **İlk seferine çık.** Kırık Sahil'in birinci grubu. İlk demirini
   savaşarak kazanırsın.
4. **İlk köyünü al.** Dünya haritasında bir köy. Alınca başkentin olur,
   şehir sayfası kampdan köye döner.
5. **Şehrini kur.** Demirhane dik, ekipman kuşan, general kirala,
   araştırma başlat.
6. Rehber biter.

Şu anki akıştan farkı: oyuncuya hiçbir şey **verilmiyor**. Ordu, demir,
toprak ve bina — dördü de kazanılıyor.

## 9. Görsel bütçesi — 100

| Ne | Adet |
|---|---|
| Yerleşim zeminleri (kamp, köy, kasaba, şehir, kale-şehir, metropol) | 6 |
| Bina görselleri (12 × 2 durum: temel / gelişmiş) | 24 |
| Boş arsa (paylaşılan) | 1 |
| Dünya haritası zemini | 1 |
| Dünya bölge işaretçileri (köy, tarla, maden, şehir, kale, taht) | 6 |
| Sefer haritası zeminleri | 5 |
| Düşman fraksiyon amblemleri | 10 |
| Sefer hedef işaretçisi (normal / şef) | 2 |
| **Alt toplam** | **55** |
| Yeniden deneme ve varyant payı | 45 |
| **Toplam** | **100** |

**Kural: resimde yazı yok.** Bütün etiketler DOM'da. Görsel modeli
okunabilir metin üretemiyor ve bölge adları veriden gelmek zorunda.

**Üretim sırası:** zeminler önce kilitlenir, bina ve işaretçi
koordinatları ondan sonra yerleştirilir. Zemin yeniden üretilirse o
haritanın bütün koordinatları elden geçer.

## 10. Aşamalar

Her aşama sonunda oyun **oynanabilir** durumda kalır.

| # | İş |
|---|---|
| **Y1** ✅ | Veri modeli: komşuluk grafiği, köy türü, başkent, bina alanı. Göç ve testler. |
| **Y2** ✅ | Dünya haritası arayüzü: resimli zemin, kaydırma/yakınlaştırma, işaretçiler. |
| **Y3** | Şehir sayfası: yerleşim zemini, bina yerleşimi, inşa ve yükseltme kuyruğu. |
| **Y4** | Bina seviyesi etkileri: lord seviyesinden binaya taşınan sayılar. |
| **Y5** | Gezinme: 5 sekme, Lord ekranının karakter sayfasına dönüşü. |
| **Y6** | Sefer sistemi: 5 harita, 50 grup, yenilenme, ödül ve ekipman düşürme. |
| **Y7** | Yeni açılış: kamp, başkent taşınması, öğretici ve rehberin yeniden yazımı. |
| **Y8** | Görsel üretimi (100 sınırı), denge, test ve temizlik. |

## 11. Emekliye ayrılanlar

- `HexHarita.tsx` (828 satır) — yerine `DunyaHaritasi.tsx`.
- `hexDistance`, `yakinlikMesafesi` — yerine grafik mesafesi.
- `Region.q/r/ring` — yerine `x/y/komsular`.
- Lord ekranının kapı ızgarası — kapılar şehre taşınıyor.
- `ANA_SEKME = 'lord'` — artık `'sehir'`.
- Mevcut dünya kayıtları — sıfırlanıyor (karar).

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
