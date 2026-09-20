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

> **Sonradan karara bağlandı (§24): sütun KALIYOR.** Garnizon payı
> geldikten sonra "bu bölgeyi kim tutuyor" sorusunun garnizondan türeyen
> bir cevabı kalmadı — aynı bölgede beş lordun askeri durabiliyor.

---

## 18. Uygulama notu: çekirdek yatırımı ve arayüz (§12 adım 5)

`2026-09-19` — dört bonus artık gerçekten işliyor:

| Çekirdek | Ne yapıyor         | Nerede uygulanıyor         |
| -------- | ------------------ | -------------------------- |
| Ambar    | Depo tavanı        | `storageCapacity`          |
| Talimgâh | Eğitim hızı        | `egitimSuresiSn`           |
| Sur      | Garnizon savunması | `bolgeTahkimati` (6 çağrı) |
| Ocak     | Bölge geliri       | `regionIncome`             |

Her seviye +%5, azami 10 seviye → tam geliştirilmiş çekirdek +%50.
Sayılar `balance.json` → `medeniyetler.cekirdek_yatirim.seviye_basina`.

Sur oranı `medeniyetBonuslari(worldId)` ile TEK yerden okunuyor. Altı
çağrı noktası var (harita listesi, bölge kartı, savaş önizlemesi, akın
çözümü, savaşın kendisi, NPC değerlendirmesi) ve her biri kendi
sorgusunu atsaydı er ya da geç biri unutulur, **önizleme ile savaş ayrı
sayı gösterirdi** — bu projenin en çok tekrarlayan hatası.

### Bağış: kasa biriktiriyor, hiçbir şey yanmıyor

Seviye atlaması ayrı bir "yükselt" düğmesinde değil, bağışın kendisinde:
ortak bir kasada "son vuruşu kim yapacak" yarışı yaratmak bağışı kumara
çevirirdi. Artan bağış kasada duruyor.

Maliyet üye sayısıyla ölçeklendiği için **tek kişi tek hamlede çekirdek
büyütemiyor** ve büyütmemeli: on üyeli bir medeniyette ilk seviye 40.000
altın, bir lordun depo tavanı ise o mertebede değil. Kasadaki birikim
tam olarak bunun için var.

### Medeniyet paneli Dünya ekranında

Ana sayfa kapılarının tavanı dokuz ve bu bir sayı değil bir kural: ızgara
tek bakışta taranabilmeli. Medeniyet paneli onuncu taş olmak yerine
Dünya ekranından açılıyor — zaten anlamı orada, haritanın rengi onun
rengi.

Harita halkası artık üç şeyi sırayla söylüyor: senin bölgen (altın), bir
lordun (kırmızı), hangi medeniyetin (o medeniyetin rengi). Çekirdek ayrı
bir işaret taşıyor — renk körü için renkten bağımsız.

### Okunurluk denetiminin yakaladığı

Çekirdek işaretini önce 9 piksellik bir glifle yapmıştım; denetim yirmi
metni birden yakaladı (11px tabanı). Kural haklıydı — rozetin işi
okunmak değil "farklı" demek. Glif yerine çizilmiş bir eşkenar dörtgen.

---

## 19. Uygulama notu: öğretici ve rehber (§12 adım 6)

`2026-09-19` — sistemin son adımı, ve en sessiz tehlikelisi: mekanik
bitti ama oyuncu hâlâ eski oyunu anlatan bir metin okuyorsa, sistem
onun için yok demektir. Daha kötüsü, öğretici **yanlış** bir plan
kurdurur: "bölge al, geliri aksın" diyen bir cümle artık yalan.

### Öğreticiye bir sayfa girdi, üç sayfa düzeldi

Yeni sayfa **ikinci sırada** (`medeniyet`): oyuncu "neredeyim"i okuduktan
hemen sonra "kimim"i okuyor. Altı madde — dört medeniyetin tanıtımı,
atamanın neden seçim olmadığı, garnizon payı, çekirdeklerin
dokunulmazlığı, dört bonusun herkese işlemesi ve fayda puanının güç
satın almaması.

Düzelen üç cümle:

| Sayfa    | Eskiden                              | Şimdi                                                          |
| -------- | ------------------------------------ | -------------------------------------------------------------- |
| `kaynak` | (gelirin nereden geldiği yazmıyordu) | "Gelir garnizondan gelir" — asker bırakmayan pay almaz         |
| `savas`  | "bölge senin olur"                   | "bölge medeniyetine yazılır, sağ kalanlar orada garnizon olur" |
| `buyume` | "kimse elinden almaya kalkışmaz"     | "garnizonunun payı da aynı oranda büyür"                       |

Sayfanın her sayısı motordan: medeniyet sayısı `MEDENIYETLER`den,
çekirdek sayısı listelerin kendisinden sayılıyor, bonus oranları
`medeniyetBonusu()` çağrılarak, fayda puanı `garnizonFaydaPuani()`
çağrılarak. `balance.test.ts` bağı kilitliyor ve iki şeyi ayrıca
sınıyor: dört çekirdek listesinin **eşit uzunlukta** olduğunu ("her
yurdun beş çekirdeği" cümlesi ancak öyleyse doğru) ve dört bonusun
**aynı hızda** büyüdüğünü (tek bir "+%5" cümlesi ancak öyleyse doğru).

### Öğretici geçilebilir, rehber geçilemez

Bu ayrım burada önem kazandı: tarafını yalnız öğretici söyleseydi,
"Öğreticiyi geç"e basan oyuncu hangi medeniyetten olduğunu hiç
öğrenmeden oynardı. Bu yüzden medeniyetin adı artık **kâhyanın
kartında**, ilerleme sayacının yanında duruyor — zorunlu turun her
adımında ekranda.

Ad rengiyle değil, yanındaki **nokta** rengiyle işaretli. İki sebep:
haritadaki medeniyet şeridiyle aynı biçim, ve dört medeniyet renginin
dördünün birden koyu zeminde AA kontrastı tutturması gerekmiyor.

Kâhyanın iki sözü de değişti: ilk fethin ardından "bir bölgen oldu"
yerine "ilk toprağını medeniyetine kattın; ordun orada kaldı ve payın o
garnizondan geliyor", saldırı düğmesinin gerekçesinde de "bu bölge senin
olur" yerine aynı doğru.

### Ölçümün yakaladığı: kart kendi adını kaybetti

Medeniyet adını kâhyanın adıyla **aynı etikete** koymuştum. Kartın
metni "Kâhya Sinan · Demir Ocağı" oldu ve `rehber-testi` kartı adıyla
arayan dokuz kontrolü birden düşürdü. Ad kendi etiketinde kaldı.

Ders tanıdık: bir metni "sadece biraz" zenginleştirmek, o metni **kimlik
olarak kullanan** her yeri kırar.

---

## 20. Uygulama notu: ölçüm (§15'in sözü)

`2026-09-19` — §14 mimariyi parklarken bir söz vermişti: karar sayıyla
verilecek. §15 kararı değiştirirken sözü iptal etmedi, **yönünü**
değiştirdi — artık "yapılsın mı" değil "yapılan iş tutuyor mu"
sorusunu ölçüyor. Söz bugün yerine geldi: `/api/olcum` medeniyet
katmanını da ölçüyor.

### Dört risk, dört sayı

§10'un tablosu artık ölçülebilir:

| Risk               | Sayı                                        | Denge |
| ------------------ | ------------------------------------------- | ----- |
| Nüfus dengesizliği | en kalabalık tarafın **aktif nüfus payı**   | %25   |
| Fraksiyon kartopu  | en geniş tarafın **toprak payı**            | %25   |
| Bedavacılık        | puanlı lord oranı + üst ondalığın puan payı | —     |
| Etkisizlik hissi   | garnizon tutan lord oranı                   | —     |

İlk iki satırın dengesi matematikten geliyor: dört eşit taraf %25 eder.
Sapma tek bakışta görünsün diye `tools/olcum.mjs` hedefi sayının yanına
yazıyor; "bu iyi mi kötü mü" diye sordurmayan bir ölçüm, okunan bir
ölçümdür.

### Beşinci sayı: sistem kendini yanlışlayabiliyor mu

`paylasilanBolge` — **iki ya da daha çok lordun aynı anda garnizon
tuttuğu bölge sayısı.** Sistemin tek cümlesi "bölge bölünemez, bölgedeki
PAY bölünür" ve bu sayı sıfırsa o cümle sahada yaşanmıyor demektir:
garnizon payı çalışıyor ama kimse paylaşmıyorsa mekanik tiyatrodur.
Başka hiçbir sayı bunu söylemiyor — gelir doğru bölünür, harita renk
değiştirir, testler geçer.

Bugünkü geliştirme veritabanında bu sayı **0**, ve bu doğru: her uçtan
uca sınama kendi diyarında kendi lordlarıyla koşuyor, kimse kimseyle
aynı bölgede durmuyor. Sayının işi bugün cevap vermek değil, gerçek
oyuncu geldiğinde cevabı hazır tutmak.

### Ölçümün kendisi ölçülüyor

`tools/olcum-testi.mjs` alanları okumakla yetinmiyor: aynı medeniyetten
iki lord kuruyor, biri bir bölge fethediyor, öbürü oraya takviye
gönderiyor ve `paylasilanBolge`'nin **arttığını** görüyor (0 → 1).
Sabit sıfır dönen ölü bir alan da "geçer" görünürdü — bu projede aynı
tuzağa bir kez düşüldü (`kontrol(..., true)` yazan, hiçbir şey ölçmeyen
bir savaş raporu kontrolü).

Uç `OLCUM_ANAHTARI` ile korunuyor; anahtar yoksa sınama kendini
atlıyor, çünkü anahtarsız sunucuda uç hiç yüklenmiyor.

---

## 21. Uygulama notu: kartopu freni (§10'un eksik yarısı)

`2026-09-19` — §10 fraksiyon kartopunun panzehirini **iki parça** olarak
yazmıştı:

> §7 üyeyle ölçeklenen maliyet + mevcut `liderAvi` freninin fraksiyon
> sürümü: en çok bölge tutan medeniyet yağmalanırken daha çok verir

Birinci parça §12 adım 5'te yazıldı. **İkincisi hiç yazılmamıştı** ve bu
sessiz bir eksiklikti: §20'nin ölçümü kartopunu görüyor
(`enGenisToprakPayi`) ama hiçbir şey frene basmıyordu. Bir riskin
panzehiri belgede duruyor olması, kodda durduğu anlamına gelmiyor.

### Ölçüt şöhret değil TOPRAK PAYI

Bireysel lider avı tek bir lorda bakıyor: diyarın en şöhretlisi. Medeniyet
ölçeğinde kartopu "bir lord zirvede" değil **"bir taraf haritayı
yutuyor"** demek, ve onu şöhret değil toprak gösteriyor.

| Sayı            | Değer | Neden                                                                     |
| --------------- | ----- | ------------------------------------------------------------------------- |
| `onde_esik`     | 0,35  | Dört eşit taraf 0,25; açılışta en büyük yurdun payı **0,273** (21 bölge)  |
| `yagma_bonusu`  | 0,30  | Bireysel avdan (0,5) küçük — ikisi üst üste binebiliyor                   |
| `en_az_tutulan` | 20    | İki bölgenin birini tutan taraf %50 pay gösterir; o "önde giden" değildir |

Eşik açılış dağılımının üstünde seçildi ve bu tesadüf değil: **fren ilk
gün kapalı başlamalı.** Açık başlasaydı hiçbir şey yapmamış bir medeniyet
doğuştan hedef olurdu. Sınama bunu ayrıca ölçüyor.

Beraberlikte fren **açılmıyor**: iki taraf eşit öndeyse ortada kartopu
değil denge var.

### Bonus yalnız yağma, asla güç

Önde giden medeniyetin savaş gücüne dokunulmuyor. Nerf zirveye çıkmayı
anlamsızlaştırır ve oyuncuyu cezalandırır; ödül ise herkese bir hedef
verir — önde giden taraf da bunu bilerek savunma kurar. Bireysel lider
avının gerekçesinin aynısı (`docs/09` §3.4), fraksiyon ölçeğinde.

### Bu adımda çıkan gerçek hata: önizleme yağma bonuslarını HİÇ saymıyordu

`/battle/preview` savaş bağlamını kurarken `liderAvi` bayrağını
geçirmiyordu — yani **lidere saldıran oyuncuya vaat edilenden fazla
ganimet çıkıyordu.** Fazlası az olmasından daha az zararlı ama sorun sayı
değil: lider avı "şu bölgeye saldır" diye kurulmuş bir teşvik ve oyuncunun
kararı verdiği ekranda görünmüyorsa hiç yok sayılır.

İkisi de artık aynı işlevlerden okunuyor (`liderAviGecerli`,
`kartopuDurumu`); önizleme için ikinci bir kopya yazmak aynı hatayı bir
kez daha kurardı. `kartopuDurumu` altı çağrı noktasının tamamına tek
yerden cevap veriyor — `surOrani` ile aynı gerekçe (§18).

### Anahtar mı, satır kimliği mi

Harita "bu bölge önde gidenin mi" sorusunu bölge kartındaki
`medeniyet.id` ile karşılaştırarak cevaplıyor ve o alan **denge
anahtarını** taşıyor (`demirocagi`). `/dunya` ilk hâlinde satır kimliğini
gönderiyordu: karşılaştırma hiçbir zaman tutmaz, hap hiç görünmez,
hiçbir hata da çıkmazdı. Uç artık anahtarı gönderiyor.

### Ölçüm ve sınama

`/api/olcum` artık frenin eşiğini ve durumunu da yazıyor. Uçtan uca
sınama (`tools/kartopu-testi.mjs`) dört şeyi ölçüyor: doğuşta fren
kapalı, eşik geçilince açılıyor, **önizleme bonusu tam olarak
`×1,3` büyütüyor**, ve gerçek savaş önizlemeyle aynı yağmayı veriyor.

Sınama haritayı **doğduğu güne döndürerek** başlıyor ve bitirirken
temizliyor: uçtan uca araçlar aynı diyarı paylaşıyor ve toprak veren bir
sınama, kendinden sonraki lordu kendi medeniyetinin yuttuğu bir haritaya
doğururdu — "yoldaşına saldıramazsın" kuralı onun ilk hedefini kapatır ve
ilk oturum sözü (`docs/08` İ3) oradan kırılırdı.

### Yanında giden küçük iş: 7. gün tutundurması

`docs/07` başarı kriterlerinin **en önemlisi** olarak 7. gün
tutundurmasını işaretlemişti ("v2'nin işe yarayıp yaramadığını tahminle
değil sayıyla bilmemiz gerekiyor") ve `/olcum` uzun süre yalnız ertesi
günü ölçüyordu. İkisi artık yan yana: **ertesi gün ilk oturumun sınavı,
yedinci gün oyunun.**

---

## 22. KARAR: tahtı tutan medeniyet ne kazanır (§13 soru 5)

`2026-09-19` — §13'ün beşinci sorusu açık kalmıştı ve boşluk gerçekti:
oyun fraksiyon oyununa döndü, ama haritanın en çok kavga edilen karesi
hâlâ yalnız bir LORDA bir şey veriyordu. Tahtı alan taraf için taht,
sıradan bir bölgeden farksızdı.

### Karar: ŞÖHRET, güç değil

Tahtı tutan medeniyetin **her üyesi** küçük bir şöhret çarpanı alıyor.

| Kim                      | Çarpan | Kaç kişiye      |
| ------------------------ | ------ | --------------- |
| Tahtı tutan lord (unvan) | +%20   | bir kişiye      |
| O lordun medeniyeti      | +%5    | binlerce kişiye |

İkisi üst üste biniyor ve binmesi doğru: tahtı bizzat tutan lord hem
Diyarın Lordu, hem de tahtı tutan medeniyetin üyesi.

**Neden güç değil.** Tahtın üstüne bir de güç (gelir, savunma, eğitim
hızı) koymak §10'un dördüncü riskini beslerdi: önde giden taraf daha çok
kazanır, daha çok kazandığı için daha çok önde gider. Taht zaten
haritanın ödülü; ödülün üstüne bir de hızlandırıcı koymak kartopunu
büyütmek olurdu. Fraksiyon gücünün tek kaynağı çekirdek yatırımı olarak
kalıyor ve o dört tarafa da açık.

**Neden bu kadar küçük.** %5, bireysel unvanın dörtte biri. Sebep
ölçek: bu çarpan bir kişiye değil, o medeniyetteki herkese birden
işliyor. Büyük olsaydı sıralamayı topluca kaydırır, "tahtı alan tarafın
tamamı listenin başına çıkar" gibi bir sonuç doğururdu.

### Kendi kendini dengeleyen taraf

Üyelerin şöhreti artınca, o medeniyetten birinin **diyarın en şöhretli
lordu** olma ihtimali de artıyor — yani bireysel lider avı (`lider_avi`)
tahtı tutan tarafı hedef gösteriyor. Taht seni görünür yapıyor,
dokunulmaz değil. Fren eklemedik; zaten duruyordu.

### Zorunlu alan, isteğe bağlı değil

`FameInput.medeniyetTahti` **zorunlu** yazıldı. Şöhret beş ayrı yerde
hesaplanıyor: `tickLord`, iki fetih önizlemesi, ekipman önizlemesi ve
demo tohumu. İsteğe bağlı bir alan bunların birinde sessizce `false`
kalırdı ve önizleme ile gerçek ayrışırdı — bu projenin en çok
tekrarlayan hatası, bir önceki bölümde (§21) tam olarak bu şekilde
yakalanmıştı. Alan zorunlu olunca derleyici beş çağıranı da tek tek
gösterdi.

Yan kazanç: tahtı ALMAK artık önizlemede iki çarpanı birden açıyor.
Oyuncu haritanın en büyük ödülünü olduğu gibi görüyor.

### Nerede görünüyor

- **Dünya şeridi:** tahtı tutan medeniyetin adı, rengi ve payı.
- **Öğretici (`diyar` sayfası):** "Oyunun ucu burası — ve tek başına
  değil, tarafınla kazanılıyor."
- **`taht-testi`:** ucun tahtı tutan medeniyeti söylediğini ve sayının
  dengeden geldiğini sınıyor.

### §13'ün kalan sorusu

Soru 3 (medeniyet değiştirilebilir mi) hâlâ açık ve bugünkü cevap
"hayır" — ama **sessiz** bir hayır: mekanizma yok, oyuncuya da hiçbir
yerde söylenmiyor. Bilinçli bir karara bağlanması gerekiyor.

---

## 23. KARAR: medeniyet değiştirme (§13 soru 3) ve fayda puanının karşılığı

`2026-09-19` — oyunun SSS'i yazılırken üç boşluk çıktı ve üçü de aynı
cinstendi: mekanik vardı ama oyuncuya söylenmiyordu, ya da sayı vardı ama
karşılığı yoktu.

### Taraf değiştirme: sessiz hayır yerine açık kural

§13 soru 3'ün cevabı "hayır"dı ama **sessiz** bir hayırdı: mekanizma
yoktu, oyuncuya da hiçbir yerde söylenmiyordu. Söylenmeyen kural,
oyuncunun kafasında "belki vardır"ı sonsuza kadar yaşatır.

Karar: **değiştirilebilir, üç kapıdan geçerek.**

| Kapı                        | Neden                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| Yalnız **nüfusu az** tarafa | Kazanan tarafa geçiş imkânsız — değişim kartopunu büyütemez, dengeler    |
| **30 gün** bekleme          | Taraf değiştirmek kimlik kararı, taktik değil                            |
| **Fayda puanı sıfırlanır**  | Puan eski tarafa verilen hizmetin kaydı; taşınsaydı rütbe bedavaya gelir |

Birinci kapı en önemlisi ve kayıttaki kuralın **aynısı**
(`acikMedeniyetler`): serbest seçimi engelleyen mantık, serbest geçişi de
engelliyor. İkinci bir kural yazmadık — aynı işlevi iki yerden çağırdık.

**Toprak ve kamp lordla birlikte taşınıyor.** Taşınmasaydı lord kendi
bölgesinden pay alamaz (`payAlabilir` bölgenin medeniyetine bakıyor) ve
kendi toprağına saldıramazdı: düzeltmesi olmayan bir hâl. Toprağın büyük
taraftan küçüğe akması da kartopuna karşı çalışıyor.

**Yoldaki ordu varken değişim yok:** kamp taşınınca mesafeler değişiyor
ve yoldaki ordunun dönüşü anlamsızlaşırdı.

### Fayda puanı: dükkân değil RÜTBE

Puan birikiyordu ama hiçbir şey yapmıyordu — biriken ve işe yaramayan bir
sayı, zamanla oyuncunun güvenini yiyor.

Bir dükkân açmadık. Puan **harcanmıyor**, birikiyor ve rütbeye dönüşüyor:
Yeminli → Nöbetçi → Sancaktar → Ocak Ustası → Medeniyetin Kılıcı. Böylece
§9'un katı kuralı ("fayda puanı güç satın almaz") kendiliğinden
korunuyor, çünkü **rütbenin dokunacağı bir sayı yok.** Karşılık "ne
aldın" değil "ne yaptın".

Yapı bilerek `unvan()`ın aynısı: şöhret nasıl unvana dönüşüyorsa fayda
puanı da rütbeye dönüşüyor. İkinci bir sayaç, ikinci bir tablo yok.

Arma bu listede YOK ve olmamalı: `arma.json` "kimlik satılmaz, arma
bedavadır" diye yazıyor. Rütbe kazanılıyor, arma herkesin.

### Şöhret: ne işe yaradığı artık yazıyor

Şöhret üç şey yapıyordu — unvanı belirliyor, sıralamadaki yeri
belirliyor, diyarın en şöhretlisini **hedef** yapıyor (lider avı) — ve
Lord ekranı bunlardan yalnız birincisini söylüyordu. Oyuncunun haklı
sorusu ("şöhretim arttı, eee?") cevapsızdı.

Kart artık üçünü de söylüyor, "şöhret harcanmaz, biriktirilir" satırı
dahil. Yeni mekanik eklemedik: var olanı görünür yaptık.

---

## 24. İki karar: çekişmeli fetih ve `Region.ownerLordId`

`2026-09-20` — §13'ün son açık sorusu kapandı, bir de uzun süredir
"ertelendi" diye duran bir madde karara bağlandı.

### §13 soru 4: çekişmeli bölge fethi HERKESE açık

Karar sahibin: **herkese açık kalıyor.** Yakınlık şartı yok.

Bugün zaten böyle çalışıyordu ama bir karar olarak yazılı değildi — ve
yazılı olmayan kural, bir sonraki okuyucunun "acaba kısıtlamalı mıydı"
diye geri dönmesi demek.

Freni mesafe zaten koyuyor: yürüyüş süresi adım başına hesaplanıyor
(`yuruyus.dakika_adim_basina`), yani uzaktaki bir bölgeye saldırmak
saatler sürüyor ve ordu o süre boyunca evde değil. Buna kalkanlar,
günlük saldırı limiti ve seviye farkı kilidi ekleniyor. "Yalnız yakındaki
garnizon" kuralı bunların üstüne bir kural daha koyardı ve haritanın
ortasını — oyunun kavga etmesi için tasarlanmış 43 bölgesini — yalnız
komşularına açardı.

### `Region.ownerLordId` KALIYOR — erteleme değil, karar

§17 bu sütunu "ertelendi" diye bırakmıştı: sahiplik medeniyete geçtiğine
göre lord sütunu bir gün kalkacaktı. **Kalkmıyor, ve sebebi garnizon
payının kendisi.**

Garnizon payı geldikten sonra "bu bölgeyi kim tutuyor" sorusunun
garnizondan türeyen bir cevabı YOK: aynı bölgede beş lordun askeri
durabiliyor ve hiçbiri ötekinden daha "sahip" değil. Oysa oyunun dört
ayrı yeri bu soruya kesin bir cevap istiyor:

| Nerede           | Ne soruyor                             |
| ---------------- | -------------------------------------- |
| Başkent          | "bu bölge senin mi" (docs/12 §2.3)     |
| Bölge tavanı     | "kaç bölgen var" (`maxRegions`)        |
| Şöhret           | hangi bölgeler şöhretine sayılıyor     |
| Bölge bırakma    | kim bırakabilir                        |
| Taraf değiştirme | hangi topraklar lordla taşınacak (§23) |

Sütunu kaldırmak bu cevabı bir sezgiyle (en çok askeri olan? ilk gelen?)
değiştirmek olurdu — kesin bir olguyu bir tahminle takas etmek. İki
katman bir arada yaşıyor ve ikisi ayrı şey soruyor:

> **Toprak medeniyetin, kayıt lordun.**

Bu cümle artık geçici bir hâlin tarifi değil, tasarımın kendisi.
