# Oyun Keyfi — Araştırma ve Yol Haritası

Bu doküman iki soruya cevap veriyor:

1. **Bizim türdeki oyunlar neyi iyi yapıyor?** Hangilerini alabiliriz?
2. **Neyde zayıf kalıyorlar?** Biz o yerleri nasıl güçlendiririz?

Sonunda önceliklendirilmiş bir iş listesi var: bugün yapılabilenler, sanat
gelince yapılabilenler, ve daha sonrası.

`docs/08` ilk oturumu (oyuncunun oyunu anlaması) çözdü. Bu doküman ikinci
soruyu soruyor: **oyuncu neden yarın geri gelsin?**

---

## 1. Tür ve rakipler

Bizim tür: **tarayıcı/mobil kalıcı dünya strateji** — Travian, Tribal Wars,
Grepolis, Ikariam soyu; mobil tarafta Rise of Kingdoms, Lords Mobile, Evony,
Total Battle.

Ortak iskelet: kaynak üret → asker eğit → komşuya saldır → bölge al →
sıralamada yüksel. Bizde de bu var. Fark detayda ve **sosyal katmanda**.

---

## 2. Güçlü yönleri — neyi almalıyız

### 2.1 İttifak ve diplomasi (en büyük kaldıraç)

Travian'ın kendi belgeleri oyunu *"işbirliği ve diplomasi üzerine kurulu"*
diye tanımlıyor; ittifak üyeliği koordineli saldırı, savunma ve kaynak
paylaşımı sağlıyor ve **oyun sonu bunlara bağlı**. Grepolis'te on yıldan
uzun süredir birlikte oynayan ittifaklar var.

Diplomasi üretimden daha önemli hâle geliyor: oyuncular ittifaka *korunmak
için* katılıyor, anlaşma yapıyor, bazılarını tutuyor, koşullar değişince
sessizce bozuyor. Konfederasyon ve saldırmazlık paktları bu katmanın resmî
araçları.

**Bizde durum:** yok. 61 bölge, tek taht, herkes tek başına. Taht iyi bir
hedef ama **birleşme yolu yok**. Bu, elimizdeki en büyük eksik.

**Ne alalım:** ittifak (5–10 kişi), takviye gönderme, ortak hedef işaretleme,
saldırmazlık paktı. Sıralamaya ittifak tablosu.

### 2.2 Sezon / sunucu döngüsü

Travian sunucuları birkaç ayda bir sıfırlıyor ve bu **döngüsel topluluklar**
yaratıyor: her tur aynı insanlar yeniden buluşuyor. Uzun vadeli bağlılığı
sağlayan şey bu.

**Bizde durum:** dünya kalıcı. Sonuç: geç katılan oyuncu doğmuş bitmiş bir
haritaya giriyor, önde olan da bir yere varamıyor — kazanmak diye bir şey yok.

**Ne alalım:** sezon. 4–6 hafta, sonunda tahtı tutan kazanır, dünya
sıfırlanır, kazananın adı kalıcı bir onur listesine yazılır.

### 2.3 Adı olan komutanlar

Rise of Kingdoms'ın en sevilen sistemi komutanlar: topla, seviye atlat,
eşleştir. Oyuncunun "benim" dediği şey.

**Bizde durum:** 12 general var, adları ve karakterleri var. Her birinin
özel bir yeteneği var ve Liderlik'e göre 3'e kadar general birlikte
gidebiliyor — yani "eşleştirme" ve "özel yetenek" zaten vardı.

Seviye de vardı: motor XP veriyor, seviye hesaplıyor, pasifi +%2/seviye
güçlendiriyordu. Eksik olan seviyenin kendisi değil, **görünmesiydi**.

**K8 ile yapıldı:** seviye atlayış artık olay akışına düşüyor ve o savaşın
raporunda generalin altında "Sv 3 → Sv 4" olarak duruyor; general ekranı
sonraki seviyenin ne vereceğini yazıyor. Ayrıca XP eğrisi kodda ikinci kez
tanımlanmıştı (api içinde `200 * n^1.4`) — XP eklerken bir eğri, seviye
okurken başka bir eğri kullanılabilirdi. Tek kaynağa indirildi ve test
kilitledi.

**Sırada ne var:** generallere hikâye (kısa bir paragraf, nereden geldiği)
ve generale bağlı küçük bir görev zinciri.

### 2.4 Okunası savaş raporları

Tribal Wars'ın rapor ekranı efsanevi: ne gitti, ne öldü, ne kaldı, ne
yağmalandı — hepsi bir bakışta.

**Bizde durum:** rapor var, öncesi/sonrası var (docs/08 İ2). Ama **neden**
kazandığını söylemiyor.

**Ne alalım:** sebep cümleleri. "Mızrakçıların süvarilerini kırdı" /
"Kalenin tahkimatı +%40, ordun yetmedi."

### 2.5 Günlük görev ve seri

Ucuz ve etkili: her gün üç iş, bir de giriş serisi. Oyuncuya "bugün ne
yapayım" cevabı veriyor.

**Bizde durum:** omurga (docs/08 İ4) "şimdi ne yapmalısın" diyor ama günlük
bir çerçeve yok.

### 2.6 Süreli etkinlik ve turnuva

Bir haftalık hedef + tablo + ödül. Boş zamanı doldurmuyor, **sebep**
yaratıyor.

---

## 3. Zayıf yönleri — burada ayrışacağız

Bu bölüm bizim asıl fırsatımız. Türün hastalıkları belli ve çoğu tasarım
tercihi, teknik zorunluluk değil.

### 3.1 Öde-kazan (pay to win)

Ölçülmüş: **oyuncuların %80'i üç ay içinde bırakıyor**, en büyük sebep
ücretli oyuncuya karşı kaybetmek. Oyunlar 14 gün bekleme ya da 15 sterlin
diye seçim sunuyor; sadece parayla alınan güçlü birimler satıyor. Beceri
anlamını yitirince oyuncu gidiyor.

Alternatifi türün kendi içinde tanımlı: **yatay kazanç** — para oyunun
adaletini bozmayan şeyler alır.

**Bizim duruşumuz (kural olarak yazılsın):** oyunda satılabilecek şeyler
yalnızca görünüştür. Sancak arması, lord kıyafeti, bölge adı hakkı, profil
çerçevesi. **Asla:** güç, zaman atlatma, özel birim, ekstra saldırı hakkı.
Bu bir pazarlama cümlesi değil, `balance.json`'a dokunan hiçbir şeyin
satılmaması demek.

### 3.2 Sonu gelmeyen bekleme

Şikâyet net: *"Rise of Kingdoms'ta saatlerce grind yapıp minimum ilerleme
görmekten yoruldum."* Evony'de her yükseltmede bekleme süresi artıyor ve
oyuncular *sırf bekleme sürelerini kırmak için* yağma yapıyor.

**Bizde durum:** ilk saldırı 2 dakikaya indirildi (docs/08 İ3) — doğru yönde
bir adım.

**Ne yapalım:** kuralı genelleştir — **her oturumda oyuncunun yapabileceği
bir şey olsun.** Kuyruklar doluysa ekran "bekle" demesin, yapılabilecek başka
bir işi göstersin. Ölçülebilir hedef: hiçbir ekran, hiçbir durumda "şu an
yapacak bir şey yok" demesin.

### 3.3 Strateji yok, tek baskın kurulum var

Türe getirilen en yaygın eleştiri: kısıtlı harita, sınırlı takım dinamiği,
**"pek de strateji değil"**.

**Bizde durum — ve en kolay kazanç:** taş-kağıt-makas **motorda zaten var**
(`birim_kars_carpanlari`: mızrakçı→süvari 1.5, okçu→mızrakçı 1.5,
süvari→okçu 1.5, kuşatma→kale 2.0 ama birime 0.5). Oyuncu bunu **hiçbir
yerde görmüyor.** Görünmeyen bir strateji, olmayan bir stratejidir.

### 3.4 Kartopu: güçlü daha da güçlenir

Lider öne geçtikten sonra fark kapanmıyor, oyun bitmeden ölüyor.

**Ne yapalım:** zirvedeki lorda saldırana ek şöhret (lider avı), çok bölge
tutan lordda azalan verim, geride kalana telafi.

### 3.5 Ölü sunucu

Kimse yoksa strateji de yok. Bizim dünyada 61 bölge / hedef 120 oyuncu var
ve NPC garnizonları boşluğu dolduruyor — ama gerçek oyuncu yoksa taht
yarışı anlamsız.

**Ne yapalım:** sezon (dolu bir dünyayla başlamak), shard doldurma (var),
ve "diyarda neler oluyor" şeridi (var) — insan varlığını görünür kılmak.

### 3.6 Uyurken vurulmak

Sabah kalkınca ordusu yok olmuş oyuncu geri gelmiyor.

**Bizde durum:** yeni oyuncu 72 saat korumalı, bölge alındıktan sonra 6 saat,
aynı saldırgan 12 saat bekliyor, günlük 12 saldırı limiti var. İskelet iyi.
**K6 ile kapatıldı:** yağma akınından sonra (saldıran kazandı ama bölgeyi
ALMADI) oyuncu bölgesine 2 saat kalkan konuyor. Gerçek boşluk buydu — aynı
saldırgan beklerken farklı saldırganlar zincirleyebiliyordu. Savunanın olay
mesajı kalkanı da söylüyor: "elinde kaldı, 2 saat korumalı, garnizonu
tazele" — koruma görünmezse rahatlatmıyor.

**Neden kayıp tavanı DEĞİL:** tek saldırıda ordunun en fazla %X'i kuralı
sorunu çözmüyor; %90'lık üç vuruş yine ordunun binde birini bırakıyor.
Sorun tek savaşın şiddeti değil, savaşların **arka arkaya** gelmesiydi.

**Ne ekleyebiliriz:** savunmada kaybedilen askerin bir kısmının **yaralı**
dönmesi (henüz yok).

### 3.7 Anlaşılmayan savaş matematiği

Oyuncu neden kaybettiğini bilmiyorsa öğrenemiyor, öğrenemiyorsa oyun
kumar oluyor.

**Bizde durum:** önizleme + 9 örnekli dağılım var (docs/08 İ1). Türün
çoğundan iyiyiz. Eksik olan raporun kendisi (3.4 üstü).

### 3.8 Oyun sonu yok

Sonsuz koşu bandı. Kazanmak diye bir şey olmayınca bırakmak da bedava.

**Bizde durum:** taht var — yarısı hazır. Eksik olan **sezonun sonu.**

---

## 4. İş listesi

Sıra keyfi değil: **oyuncunun hissettiği fark / harcanan emek** oranına göre.

### 4.1 Bugün yapılabilir (sanat gerekmez, dış servis gerekmez)

| # | İş | Neden | Maliyet |
|---|---|---|---|
| K1 | **Karşı-birim ipuçları** | Motorda duran stratejiyi görünür kılar. Türün en büyük eleştirisine tek dosyayla cevap. | küçük |
| K2 | **Rapor neden kazandığını söylesin** | Oyuncu öğrenmeye başlar. Veri zaten elde. | küçük |
| K3 | **Başarımlar** | "İlk fetih", "on bölge", "tam takım" — kilometre taşları hissedilir olur. | orta |
| K4 | **Günlük görevler + giriş serisi + ödül** | Yarın geri gelme sebebi. Ödül malikâne gelirinden türüyor, seri çarpanı tavanlı. | orta |
| K5 | **Lider avı + azalan verim** | Kartopunu kırar, oyunu canlı tutar. | orta |
| K6 | **Yağma sonrası kalkan** | Bir gecede silinen oyuncu geri gelmiyor. Zinciri kesen kalkan; kayıp tavanı çözmüyordu (§3.6). | küçük |
| K7 | **"Yapacak bir şey yok" ekranı olmasın** | Her ekranın boş hâli bir sonraki işi göstersin. | küçük |
| K8 | **General seviyesi görünsün** | Motor zaten seviye atlatıyordu, oyuncu görmüyordu. Rapor + olay + sonraki seviye. | orta |


### 4.1b Ölçerken çıkanlar

Yol haritasında olmayan ama ölçüm sırasında ortaya çıkan işler. Buraya
yazılıyorlar çünkü hiçbirini "tasarım" bulmadı — hepsi sayıya bakınca
göründü.

| # | İş | Nasıl bulundu | Durum |
|---|---|---|---|
| K9 | **İlk hedef her doğum yerinde yapılabilir olsun** | 24 doğum yerinin 6'sında (kale çapaları) oyuna göre 35 okçu gerekiyordu, başlangıç altını 33 okçuya yetiyordu | yapıldı |
| K9b | Öneri motoru eğitim kuyruğunu görmüyordu — ne parasını ne yerini | K9'un açtığı omurga testi kaldığında | yapıldı |
| K5b | Yağmada oran 1'i geçebiliyordu | lider avı testi yazarken | yapıldı |
| K8b | General XP eğrisi kodda ikinci kez tanımlıydı | K8 sırasında | yapıldı |

Ortak ders: **tek örnekli test yanıltıyor.** ilk-oturum-testi tek bir
oyuncuyla çalışıyor ve %25'lik bir bozukluğu görmüyordu; doğum yerleri
sayılı ve sıralı olduğu için tam tarama mümkündü ve hatayı ancak o gösterdi.

### 4.2 Sanat gelince

| # | İş | Gereken |
|---|---|---|
| G1 | Bölge gelişim aşamaları | 8 görsel (`tarla_3` … `kale_5`) — istemler hazır |
| G2 | Lord figürü (geri gelirse) | 5 görsel var, sahne kodu hazır, oyuncu beğenmedi |
| G3 | Birim illüstrasyonlarını yenile | 5 görsel; eskiler diğer setten farklı üslupta |
| G4 | Savaş sahnesi | Rapor ekranına iki ordunun karşılaştığı tek kare |
| G5 | Sancak arması (yatay kazanç) | 10–20 arma parçası; oyuncunun kendi sancağı |
| G6 | Bölge tipi çeşitliliği | Aynı tipin 2–3 varyantı; harita tekrar etmesin |

### 4.3 Daha sonra (büyük sistemler)

| # | İş | Not |
|---|---|---|
| B1 | **İttifak** | Türün en büyük kaldıracı. 5–10 kişi, takviye, ortak hedef, pakt. DB + yeni ekran. |
| B2 | **Sezon** | 4–6 hafta, taht sahibi kazanır, dünya sıfırlanır, onur listesi kalır. |
| B3 | **Sohbet** | Sosyal tutkalın kendisi. Moderasyon yükü getirir; ittifak sohbetiyle başlanmalı. |
| B4 | ~~**Süreli etkinlik**~~ **yapıldı** | Haftalık sefer: tema hafta numarasından türüyor (sunucu bir şey saklamıyor), hedef herkes için aynı. **Tablo YOK** — sıralamalı etkinlik zaten önde olanı ilerletirdi (§3.4). |
| B5 | ~~**Casusluk**~~ **yapıldı** | Kuyruk tabanlı keşif, yakalanma riski Kurnazlık'a bağlı, rapor bir fotoğraf (docs/01 §6b). Beklenenden küçük çıktı: yeni motor gerekmedi, mevcut kuyruk makinesi yetti. |
| B6 | **Ticaret** | Kaynak takası. İttifak olmadan sömürüye açık. |
| B7 | **Yatay kazanç** | Görünüş satışı. Mağaza işi **açıkça beklemede** (docs/06). |

---

## 5. Değişmeyecek kurallar

Bu doküman büyürken kolayca çiğnenebilecek şeyler:

1. **Satılan hiçbir şey `balance.json`'a dokunmaz.** Güç, zaman, birim, hak
   satılmaz. Sadece görünüş.
2. **Her sayı `balance.json`'dan gelir.** Yeni sistem yeni sabit demek değil;
   yeni anahtar demek.
3. **Oyun mantığı `packages/shared`'da, saf fonksiyon olarak.** Sunucu
   yetkili, istemci aynı fonksiyonla önizleme yapar.
4. **Hiçbir ekran "bekle" demez.** Boş hâl bir sonraki işi gösterir.
5. **Oyuncu neden kaybettiğini her zaman öğrenebilir.**

---

## Kaynaklar

- [H1 2026: 4X Strategy's UA Reckoning — Naavik](https://naavik.co/f2p-mobile/h1-2026-4x-strategys-ua-reckoning/)
- [Is Pay To Win In Mobile Games Unavoidable Or Are There Fair Alternatives](https://www.alibaba.com/product-insights/is-pay-to-win-in-mobile-games-unavoidable-or-are-there-fair-alternatives.html)
- [Alliance, Confed & NAP — Travian: Legends](https://support.travian.com/en/articles/84-alliance-confed-and-nap)
- [Diplomacy — Travian Strategy Guide](https://www.travian-strategy-guide.com/alliance-strategies/diplomacy)
- [10 Best Games like Grepolis, Travian and Ikariam](https://championsofgods.com/games-like-grepolis-travian-and-ikariam/)
- [Best PBBG Games: Old-School Browser Games Still Alive Today](https://bestclassicpcgames.com/best-persistent-browser-based-games/)
- [Rise of Kingdoms — Wikipedia](https://en.wikipedia.org/wiki/Rise_of_Kingdoms)
- [Evony guide — Pocket Tactics](https://www.pockettactics.com/evony/guide)
