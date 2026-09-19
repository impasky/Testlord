# 16 — Medeniyetler: haritayı bireysel fetihten çıkarmak

**Bu bir ÖNERİ, karar değil.** `docs/09` kararları kaydeder; bu belge
henüz verilmemiş bir kararın gerekçesini ve sayılarını taşıyor. Karar
verilirse özeti `docs/09`a düşer.

---

## 1. Hangi sorunu çözüyor

Oyun bugün **shard** ile çalışıyor: her diyar kendi 121 bölgelik
haritasına sahip, kapasitesi 240 oyuncu. Bu, iki sorunu peşinden
getiriyor ve ikisini de tam çözemiyoruz:

1. **Bölünme.** Oyuncular ayrı diyarlara düşüyor; arkadaşıyla oynamak,
   tek bir ekonomi, tek bir sıralama — hepsi parçalanıyor. Diyar seçimi
   (`20b7eb1`) ve birleşme (`4bdbf8b`) bunu hafifletiyor, kaldırmıyor.
2. **Hedefsizlik.** Yeni oyuncu büyük oyuncuları görmüyor. "Ben de o
   olacağım" diyebileceği bir vitrin yok.

"Herkes tek dünyada olsun" fikri bu ikisini de çözer ama **bireysel
mülkiyet duvarına çarpar**:

|                                | Sayı        |
| ------------------------------ | ----------- |
| Haritadaki bölge               | 121 (sabit) |
| Lord başına azami bölge        | 5 (Lv60)    |
| 5 bölge tutabilecek azami lord | ~24         |
| 10.000 oyuncuda bölge/oyuncu   | **0.012**   |

Ve toprağı olmayan oyuncu kampta kalıyor: `baskentBolgeId = null` →
şehir sayfası yok, bina yok. `balance.json` kendi notunda yazıyor:
_"köyü olan oyuncu şehir sayfasına, bina dikmeye ve oyunun geri
kalanına kavuşuyor."_ Tek dünyada oyuncuların %99'u oyunun yarısını hiç
göremez.

---

## 2. Kilidi açan fikir

> **Bölge bölünemez, bölgedeki PAY bölünür.**

121 bölgeyi on bin kişiye bölemezsin. Ama bir bölgeye ortak olmayı
sonsuza kadar bölebilirsin. Toprak **medeniyetin** olur; oyuncu oraya
**garnizon** gönderir ve gönderdiği kadar gelir alır.

Mülkiyet sonlu, ortaklık sonsuz. Tek dünyanın matematiği böyle
çözülüyor.

---

## 3. Oyun bunun için beklenenden hazır

Kodda üç şey şaşırtıcı biçimde uygun:

| Zaten böyle                                                   | Anlamı                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Lord.binalar` — binalar **lorda** bağlı, bölgeye değil       | Oyuncunun ekonomisi zaten kişisel ve taşınabilir                   |
| `Lord.homeBolgeId` — kamp çıpası, _"kimse buraya saldıramaz"_ | Dokunulmaz kişisel üs **zaten var**                                |
| `ArmyUnit { locationType: 'region', locationId }`             | Garnizon zaten lord bazında tutuluyor — pay hesabının verisi hazır |

Yani "oyuncunun kendine ait, güvenli, geliştirilebilir bir yeri" zaten
haritadan bağımsız. Fetih katmanını kolektifleştirmek oyuncudan bir şey
almıyor — sadece **kavgayı** kolektifleştiriyor.

---

## 4. Neden medeniyet, neden klan değil

İki varyant tartışıldı. Klan varyantı (oyuncular klana girer, klan
haritada savaşır) ucuz görünüyor çünkü ittifak sistemi zaten yazılı.
Üç yerden çatlıyor:

- **İttifak üye tavanı 8.** Toprak tutacak klan 50-200 kişi olmalı.
  Tavanı büyütmek `balance.test.ts`'deki korumayı kırıyor: _"bir ittifak
  - paktlıları dünyanın yarısından az olmalı, yoksa dokunulmaz bir blok
    haritayı dondurur."_
- **İlk gün klanı yok.** Yeni oyuncu başvurur, bekler, belki reddedilir
  — ve bu oyunun en kırılgan anı. Mevcut sorunu derinleştiriyor.
- **Klanlar eşitsiz ve akışkan.** Harita iki üç mega klanın olur, geri
  kalan herkes kiracı olur.

Medeniyet varyantı pahalı ama yapısal olarak doğru: **ilk dakikadan
aidiyet**, kararlı sınırlar, ve sınırsız oyuncu emen ortak bir ilerleme
havuzu.

**Öneri: ikisi birden, katmanlı.**

- **Medeniyet** = harita katmanı. Dört taraf, çekirdek + çekişmeli bölge.
- **İttifak** = medeniyet _içindeki_ müfreze katmanı. Zaten yazılı:
  ittifak, pakt, bağış, seviye, sohbet, moderasyon. 8 kişilik tavan bir
  müfreze için doğru sayı.

Yazılan hiçbir şey çöpe gitmiyor; hepsi bir üst katmanın altına giriyor.

---

## 5. Harita: coğrafya zaten dört köşeli

`world-map.json` yedi vilayete bölünmüş ve bölünme tesadüfen dört
medeniyet için neredeyse hazır:

| Vilayet       | Bölge | Merkez (x,y) | Rol                               |
| ------------- | ----- | ------------ | --------------------------------- |
| **demirvadi** | 17    | (17,23)      | kuzeybatı — medeniyet 1 yurdu     |
| **kuzeymark** | 18    | (70,19)      | kuzeydoğu — medeniyet 2 yurdu     |
| **karaorman** | 21    | (20,73)      | güneybatı — medeniyet 3 yurdu     |
| **tasgecit**  | 21    | (76,57)      | doğu — medeniyet 4 yurdu          |
| gunbati       | 24    | (42,41)      | **çekişmeli orta**                |
| aksu          | 19    | (54,75)      | **çekişmeli güney**               |
| taht          | 1     | (50,50)      | **Taht Kalesi — herkesin hedefi** |

Dört yurt + iki çekişmeli vilayet + taht. Yeni harita çizmeye gerek yok.

### Çekirdek / çekişmeli ayrımı

Her yurdun **merkeze en yakın 5 bölgesi çekirdek**: ele geçirilemez,
yalnız geliştirilir. Kalan her şey çekişmeli.

|                  | Bölge | Oran |
| ---------------- | ----- | ---- |
| Çekirdek (4 × 5) | 20    | %17  |
| Çekişmeli        | 100   | %83  |
| Taht             | 1     | %1   |

Çekirdek bilerek küçük: harita doğduğu gün karara bağlanmasın. Ama
sıfır da değil — **kaybeden medeniyet ölmez**, evine çekilir ve geri
döner. `docs/09` kural 6'nın ("hiçbir oyuncunun ilerlemesi sıfırlanmaz")
fraksiyon ölçeğindeki karşılığı bu.

Çekirdek adayları haritadan hesaplandı (vilayet merkezine en yakın beş):

- **demirvadi:** Akçakavak Köyü, Sarıçam Köyü, Karakaya, Buğdaylı, Çelikkapı
- **kuzeymark:** Eğrigürgen Köyü, Demirtaş, Verimli, Tellallar, Taşbaşı
- **karaorman:** Menzilhan, Sazlıdere Köyü, Boyacılar, Fenerbaşı, Samanlık
- **tasgecit:** Pancarlı, Buğdayova, Handibi, Tozlukoru Köyü, Demirliman

---

## 6. Garnizon payı — formül

Çekişmeli bir bölge, tutan medeniyete saatlik gelir üretiyor. Gelir, o
bölgede **garnizonu olan lordlar arasında yer (slot) oranında**
bölünüyor:

```
pay_i = bölge_geliri × (yer_i / toplam_yer)
```

Tavan yok ve bilerek yok. Tavan koymak "kim önce doldurursa" yarışı
yaratır; oransal bölüşüm ise kendi kendini dengeliyor: kalabalık bölgede
yer başına kazanç düşüyor, oyuncu boş bölgeye kayıyor. Bu, garnizonu
haritaya kendiliğinden yayan bir **pazar**.

### Örnek

Seviye 1 şehir = 200 altın/saat.

| Durum                                  | Sonuç                           |
| -------------------------------------- | ------------------------------- |
| 10 lord × 20 yer (toplam 200)          | her biri **20 altın/saat**      |
| 1 lord 100 yer + 9 lord × 20 yer (280) | balina **71**, diğerleri **14** |
| tek lord, 20 yer                       | **200** (tamamı)                |

Balina tek bölgede çok kazanmıyor — yer başına verimi düşüyor. Ölçeklemek
istiyorsa **yayılmak** zorunda, yani haritanın her yerinde savaşa
katılmak zorunda. İstediğimiz davranış tam olarak bu.

### Kalibrasyon

- Bir mızrakçı: 1 yer, 30 savunma, 120 altın. Yer başına savunmada en
  verimli birim (süvari 8.3, kuşatma 1.0) — garnizon doğal olarak
  mızrakçı ağırlıklı olur, bu da savunma kimliğiyle tutarlı.
- Yukarıdaki 20 altın/saat, 120 altınlık mızrakçıyı ~6 saatte
  amortize eder. Garnizon **destek gelir**, ana ekonomi değil: bölge
  geliri kişisel bina ve fetih gelirinin yerine geçmemeli.
- Harita toplamı (hepsi sv1): 10.360 altın + 2.900 demir + 7.036
  erzak/saat. Dört medeniyete bölününce taraf başına ~2.600 altın/saat —
  yüzlerce oyuncuya yayılan anlamlı ama baskın olmayan bir akış.

---

## 7. Çekirdek yatırımı

Oyuncular çekirdek bölgelere kaynak bağışlıyor; bölge seviye atlıyor;
**bonus o medeniyetteki herkese** işliyor.

Her yurdun beş çekirdeğinden dördü ayrı bir bonus taşıyor (beşincisi
başkent, bkz. §8):

| Çekirdek | Bonus              |
| -------- | ------------------ |
| Ambar    | Depo kapasitesi    |
| Talimgâh | Eğitim hızı        |
| Sur      | Garnizon savunması |
| Ocak     | Bölge geliri       |

Hangisinin önce büyüyeceğine **oyuncular** karar veriyor. Medeniyet
kimliği tasarımcı tablosundan değil, o medeniyetin oyuncularının
seçiminden doğuyor — dört tarafın dördü de farklı büyür ve bu fark
onların hikâyesi olur.

### Maliyet ÜYE SAYISIYLA ölçekleniyor

```
seviye_maliyeti = taban × 2^(N-1) × aktif_üye
```

Bu, önerinin en önemli tek satırı. Sabit maliyet olsaydı kalabalık
medeniyet çekirdeğini hızlı büyütür, daha çok kazanır, daha çok oyuncu
çeker — **kartopu fraksiyon ölçeğinde**. Üyeyle ölçeklenen maliyet,
büyük medeniyeti daha hızlı değil sadece daha kalabalık yapıyor: küçük
medeniyet de kendi hızında ilerliyor.

---

## 8. Oyuncunun kendine ait olanı

Tek dünyanın en büyük tuzağı **etkisizlik hissi**: _"medeniyetim
kaybetti, benim hiçbir etkim yoktu."_ Panzehiri, oyuncunun tartışmasız
kendine ait olan şeyin güçlü kalması. İyi ki bunlar zaten kişisel:

- Lord seviyesi, statları, generalleri, ekipmanı, araştırması
- **Başkent ve binalar** (`Lord.binalar` — zaten lorda bağlı)
- Kamp çıpası (`homeBolgeId` — zaten dokunulmaz)
- Ordusu

Öneri: her oyuncunun başkenti kendi medeniyetinin yurdunda, **kimsenin
alamayacağı** bir yer olur. Fetih artık "yerimi kaybederim" değil,
"payımı kaybederim" demek. Risk azalmıyor, sadece oyuncunun varlığını
yok etmekten çıkıyor.

---

## 9. Fayda puanı

Kolektif eylemin kişisel karşılığı.

**Kazanım:** çekişmeli bölgede garnizon tutmak (saatlik, yer oranında),
başarılı bir fetihe katılmak, saldırıya uğrayan bölgeyi savunmak,
çekirdeğe bağış yapmak.

**Harcama — ve tek katı kural:**

> **Fayda puanı GÜÇ SATIN ALMAZ.**

Puan kimlik (unvan, arma, sancak), kolaylık ve **içerik erişimi** alır:
medeniyete özel akın diyarları, özel görevler, kozmetik. Güç yalnız
çekirdek yatırımından gelir ve o herkese eşit işler.

Sebebi: puanla güç satılırsa çok oynayan daha güçlü olur, daha çok puan
kazanır, kartopu bireysel ölçekte geri döner — üstelik bu kez freni
olmadan.

---

## 10. Dört risk ve panzehirleri

| Risk                                                              | Panzehir                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Nüfus dengesizliği** — herkes kazanan tarafa yazılır            | Kayıtta serbest seçim yok: aktif nüfusu ortalamanın üstünde olan medeniyet kapalı. Kendi kendini düzeltir.                            |
| **Bedavacılık** — 10.000 kişi 200 kişinin yatırımından faydalanır | Fayda puanı kazanılır, dağıtılmaz. Çekirdek bonusu herkese, puan yalnız katkı verene.                                                 |
| **Etkisizlik hissi**                                              | §8 — kişisel olan güçlü kalıyor                                                                                                       |
| **Fraksiyon kartopu**                                             | §7 üyeyle ölçeklenen maliyet + mevcut `liderAvi` freninin fraksiyon sürümü: en çok bölge tutan medeniyet yağmalanırken daha çok verir |

---

## 11. Neyin taşındığı, neyin yeniden yazıldığı

**Olduğu gibi kalıyor:** savaş motoru, dizilim, taktik, karşı halkası,
lord ilerlemesi, generaller, ekipman, araştırma, binalar, hastane,
pazar, akın (PvE), günlük görev, başarım, öğretici iskeleti, moderasyon,
dil sistemi.

**İttifak katmanı korunuyor**, medeniyet içine giriyor: ittifak, pakt,
bağış, seviye, sohbet.

**Yeniden yazılıyor:**

| Şu an                                           | Sonra                                    |
| ----------------------------------------------- | ---------------------------------------- |
| `Region.ownerLordId` (tek lord)                 | `ownerMedeniyet` + garnizon payı tablosu |
| Gelir bölgenin deposunda birikir, sahibi toplar | Gelir garnizon payına bölünür            |
| `maxRegions` (1 + seviye/15)                    | Anlamsızlaşır, kalkar                    |
| `baskentBolgeId` fetihle gelir                  | Başkent kişisel, fetihten bağımsız       |
| Taht Kalesi = tek lordun unvanı                 | Medeniyet hedefi                         |
| Harita rengi = sahiplik                         | Harita rengi = medeniyet                 |

**Park ediliyor (silinmiyor):** diyar seçimi ve birleşme. İkisi de
shard'a hizmet ediyor; tek dünyada gerekmezler ama kod duruyor ve karar
geri alınırsa yerindeler.

---

## 12. Maliyet ve sıra

Bu, oyunun **türünü** değiştiren bir karar: bireysel 4X'ten fraksiyon
savaşına. Yapılan işin çoğu korunuyor ama harita, gelir ve fetih
yeniden tasarlanıyor.

Kabaca sıra:

1. `packages/shared/src/medeniyet.ts` — saf katman: dört medeniyet,
   çekirdek/çekişmeli ayrımı, garnizon payı formülü, çekirdek maliyet
   eğrisi. Birim sınamalarıyla. **Kod yazmadan önce sayılar burada
   doğrulanır.**
2. Şema: `Medeniyet`, `Region.ownerMedeniyetId`, `CekirdekYatirim`,
   `FaydaPuani`.
3. Gelir dağıtımı (`accrueRegionStores` yerine garnizon payı).
4. Fetih: saldırı hedefi bölge değil, bölgedeki garnizon.
5. Arayüz: harita renklendirmesi, medeniyet ekranı, çekirdek yatırım
   ekranı, fayda puanı.
6. Öğretici ve rehber: "bölgen" değil "medeniyetin".

### Şimdi ucuz, sonra pahalı

Oyunun henüz gerçek oyuncusu yok — geliştirme veritabanındaki her şey
test verisi. **Bu değişiklik bugün temiz bir kesme, yayından sonra bir
göç ameliyatı.** Karar verilecekse şimdi verilmeli.

---

## 13. Karar bekleyen sorular

1. Dört medeniyetin **kimlikleri** ne? (ad, renk, sancak, birim eğilimi)
2. Medeniyet seçimi kayıtta mı, öğretici sonunda mı?
3. Medeniyet değiştirilebilir mi? (öneri: hayır ya da çok pahalı)
4. Çekişmeli bölge fethi kime açık — herkese mi, yalnız yakındaki
   garnizona mı?
5. Taht Kalesi'ni tutan medeniyet ne kazanır?
6. Mevcut shard'lar ne olur — kapanır mı, "eski diyarlar" olarak kalır mı?

---

## 14. KARAR: veri gelene kadar park

`2026-09-18` — öneri yazıldıktan sonra veritabanına bakıldı. Sonuç
öneriyi de, ondan önceki iki mimariyi de askıya alıyor.

| Ölçüm                            | Sayı                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Kayıtlı hesap                    | 14.465                                                                                   |
| Bunların **gerçek** oyuncu olanı | **0** (hepsi `@lordlar.dev`, `@l.dev`, `@test.local`, `@ornek.test`, `@t.dev`, `@x.dev`) |
| Oyuncu lordu                     | 14.433                                                                                   |
| **Ertesi gün geri dönen**        | **1**                                                                                    |
| En uzun giriş serisi             | **1 gün**                                                                                |

Bir günden uzun oynamış tek bir insan yok. Bu, şu ana kadar verilen
bütün mimari tartışmalarının — shard, birleşme, tek dünya, medeniyet —
**tamamen tahmin** üzerine kurulduğu anlamına geliyor.

Projenin kendi kodu bunu zaten söylüyor. `routes/olcum.ts` başlığı:

> _"bugüne kadarki bütün analizler tahmindi ve ilk gerçek oyuncu testi
> hepsini yanlışladı."_

Ders bir kez öğrenilmiş; ikinci kez öğrenmeye gerek yok.

### Neden şimdi yapmak YANLIŞ olur

- Bu öneri **10.000 oyuncu** için tasarlandı. 10 oyuncuda dört medeniyet,
  taraf başına 2-3 kişi demek — bugünkünden kötü.
- Birleşme **çürüyen diyar** için tasarlandı. Hiçbir diyar gerçek
  oyuncuyla çürümedi.
- §6'daki garnizon payı sayıları `balance.json`dan türetildi,
  DAVRANIŞTAN değil. "20 altın/saat doğru mu" sorusunun cevabı ancak
  gerçek bir oyuncunun garnizon bırakıp bırakmadığına bakarak verilir.

Yanlış olan fikir değil, **sırası**. Oyunun tür değiştirmesi geri
alınamaz bir karar ve onu sıfır veriyle vermek, bugüne kadarki en pahalı
tahmin olurdu.

### Kararı hangi sayı verecek

Öneri, aşağıdakilerden biri gerçekleşince yeniden açılır:

| Eşik                                      | Ne yapılır                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Aynı anda **< 50** aktif oyuncu           | Hiçbir şey. Mevcut shard + diyar seçimi yeter; harita zaten bir kişiye bol.           |
| **50-200** aktif                          | Tek dünyaya geç, toprak bireysel kalsın. 121 bölge bu sayıya yetiyor (oran 0.60-2.4). |
| **200+** aktif ve bölge/oyuncu **< 0.30** | Medeniyet önerisi açılır — bireysel mülkiyet gerçekten tıkanmış demektir.             |
| Ertesi gün dönüş **< %20**                | Mimari değil, İLK OTURUM sorunu var. `/olcum` hangi ekranda bırakıldığını söylüyor.   |

Ölçüm altyapısı zaten yazılı (`/api/olcum`, `OLCUM_ANAHTARI` ile
korumalı): kayıttan ilk savaş raporuna süre, ilk oturumdaki eylem
sayısı, bırakılan ekran, ertesi gün dönüş oranı.

### Bunun yerine yapılan

Gerçek oyuncunun önündeki **yasal engel** kaldırıldı: veri toplanan bir
oyunu Türkiye'de yayına almak için aydınlatma metni zorunlu ve yoktu
(bkz. `apps/web/src/screens/Gizlilik.tsx`). Oyuncu olmadan veri yok,
veri olmadan bu belgedeki hiçbir sayı sınanamaz.

---

## 15. KARAR DEĞİŞTİ: yapılıyor

`2026-09-18` — §14 yazıldıktan sonra sahibi kararı tersine çevirdi:
_"Irk sistemini yap."_ Karar onun ve uygulanıyor. Bu bölüm §14'ü
silmiyor; oradaki ölçümler doğru ve gerekçe hâlâ okunmaya değer. Değişen
tek şey, sırayı kimin belirlediği.

§14'ün itirazı **"fikir yanlış"** değil, **"sırası yanlış"**tı. O
itirazın bugün hangi kısmı geçerli:

| §14'ün endişesi                                     | Bugünkü durum                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| "10 oyuncuda dört medeniyet, taraf başına 2-3 kişi" | Geçerli. Az oyuncuyla dört fraksiyon seyrek görünecek. Karşılığı: harita ilk günden anlamlı — boş bir dünya yerine dört yurt ve çekişmeli bir orta. |
| "Garnizon payı sayıları davranıştan değil"          | Geçerli. Sayılar `balance.json`da ve tek yerde: veri gelince kod değil o dosya değişecek.                                                           |
| "Geri alınamaz karar"                               | **Bugün geçerli değil.** Gerçek oyuncu yok, dolayısıyla göç de yok. §12'nin dediği gibi: bugün temiz bir kesme, yayından sonra ameliyat.            |

Üçüncü satır kararı taşıyan satır. §14 "veri gelene kadar bekle"
diyordu; ama beklemenin kendisi de bedelsiz değil — geçen her gün bu
değişikliği daha pahalı yapıyor. Sıfır oyuncuyla yapılan kesme bir
`deleteMany`; bin oyuncuyla yapılan kesme bir göç planı.

### Ölçüm sözü duruyor

§14'ün eşik tablosu iptal edilmiyor, **yönü değişiyor**: artık "yapılsın
mı" sorusunu değil, "yapılan işe ne kadar yaklaşıldı" sorusunu ölçüyor.
Aynı `/api/olcum` altyapısı, aynı sayılar. Medeniyet sistemi gerçek
oyuncuyla yanlışlanırsa geri alınır; §14'ün asıl dersi buydu ve o ders
duruyor.

---

## 16. Uygulama notu: fetih garnizonu bırakıyor

`2026-09-19` — §12 adım 3 (gelir dağıtımı) yazılırken çıkan ve sahibin
karara bağladığı tek soru: gelir "garnizon bırakmak" karşılığı olunca,
fetihten sonra sağ kalan ordu ne yapsın?

**Karar: bölgede kalır.** Sağlam asker fethettiği bölgenin garnizonu
oluyor; yaralılar ve yağma eve dönüyor (yaralının yeri hastane,
yağmanın yeri hazine). Ordusunu geri isteyen oyuncu `/map/:id/garrison`
ile anında çekiyor.

Alternatif — ordu eve döner, garnizonu oyuncu ayrıca koyar — tasarım
olarak daha saf bir "varlık = gelir" kuralıydı ama her fetihten sonra
ikinci bir işlem gerektiriyordu ve öğreticiyi bugünden yeniden yazmayı
zorunlu kılıyordu.

Bu, §12'nin 4. adımının ("fetih: hedef bölge değil garnizon") yarısını 3. adıma taşıyor. Sebebi basit: gelir garnizona bağlandığı an, ordusu
eve dönen bir fatih aldığı yerden hiçbir şey kazanmaz — yani 3. adım
tek başına oynanabilir bir oyun bırakmıyordu.

### Bu adımda çıkan iki gerçek hata

1. **Kuşatan asker payı seyreltiyordu.** İlk hâlde bölünme o bölgedeki
   BÜTÜN garnizonlara bakıyordu. Rakip medeniyetten bir lord takviye
   gönderince sahibin payı yarıya düşüyor, gönderen de pay alamıyordu:
   gelirin yarısı kimseye gitmeden yok oluyordu. Payda artık yalnız pay
   ALABİLENLERDEN oluşuyor.
2. **Bölge kartı payı görmüyordu.** `pay` yalnız liste ucuna (`/map`)
   eklenmişti; kart verisini detay ucundan (`/map/:id`) alıyor ve payı
   0 sanıp iki bölgesi olan oyuncuya "tek bölgen" yazıyordu. Aynı
   türetilmiş alan iki uçta da bulunmalı.

---

## 17. Uygulama notu: fetih kuralları (§12 adım 4)

`2026-09-19` — üç kural koda girdi:

1. **Çekirdek ele geçirilemez.** 20 çekirdeğin hiçbirine saldırılamıyor;
   oyuncu ucunda da (`assertCanAttack`), NPC hedef seçiminde de, öneri
   motorunda da. Üçü ayrı yerde çünkü NPC ve öneri o uçtan geçmiyor.
2. **Yoldaşının toprağına saldıramazsın.** Aynı medeniyetten bir lordun
   tuttuğu bölgeye saldırı yok — ittifak içi saldırı yasağının fraksiyon
   ölçeğindeki karşılığı.
3. **Fetih toprağı medeniyete yazıyor.** Alınan bölgenin
   `ownerMedeniyetId`'si fatihin medeniyeti oluyor; harita böylece renk
   değiştiriyor ve aynı medeniyetten yoldaşlar orada pay alabiliyor.

### Kuralın ikinci yarısı: sahipsiz yurt SERBEST

İlk hâlde kural "kendi medeniyetinin toprağına saldıramazsın"dı ve
oyunun en önemli sözünü kırdı. Kamp kendi yurdunda kuruluyor (§8), yani
yeni oyuncunun **çevresindeki her şey kendi medeniyetinin**. Hepsi
kapalı olunca ilk hedef 5-8 adım öteye kaydı ve "ilk saldırı dakikalar
içinde biter" sözü (`docs/08` İ3) **2 dakikadan 1,6 saate** çıktı.
`ilk-oturum-testi` bunu ölçüp kaldı.

Doğrusu: medeniyetin tuttuğu ama **hiçbir lordun almadığı** bölge
serbest. Orada karşındaki yoldaşın değil, bölgenin NPC garnizonu;
yurdunu şenlendirmek fetihle oluyor. Ölçülen sonuç: ilk saldırı yine
**120 saniye**.

### Ertelenen: `Region.ownerLordId`

§12 adım 4 "sahiplik medeniyete geçsin" diyordu; sütun hâlâ duruyor ve
bilerek duruyor. Başkent (`docs/12` §2.3), bölge tavanı (`maxRegions`),
şöhret ve bölge bırakma hep o sütundan okuyor. İkisi bir arada
yaşıyor: **toprak medeniyetin, kayıt lordun.** Sütunun kalkması arayüz
adımıyla (§12.5) birlikte, o ekranlar medeniyet üzerinden yeniden
kurulduğunda anlamlı olur.
