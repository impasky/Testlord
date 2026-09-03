# 01 — Oyun Tasarımı

Tüm sayısal değerler `data/balance.json` içindedir. Bu doküman **sistemleri ve
niyeti** anlatır; sayıyı oradan oku.

---

## 1. Lord (Karakter)

Oyuncu bir **lord**tur. Tek karakter, silinmez, sınıf seçimi yok — farklılaşma
stat dağıtımından ve ekipmandan gelir.

### Statlar

Her seviyede **5 serbest puan**. Dört stat, dört net rol:

| Stat | Ne yapar | Kime hitap eder |
|---|---|---|
| **Güç** | Lordun savaş katkısı (+3 saldırı/puan) | Ekipmanına yatırım yapan, bizzat savaşan |
| **Dayanıklılık** | Lord canı (+25/puan), yaralanma süresini kısaltır | Sık saldıran, ayakta kalmak isteyen |
| **Liderlik** | Komuta kapasitesi (+8 yer/puan), general slotu | Büyük ordu kuran, klasik stratejist |
| **Kurnazlık** | Yağma miktarı (+%1/puan), casusluk | Bölge almak yerine yağmalayarak zenginleşen |

**Neden serbest dağıtım:** Sınıf sistemi içerik ister (her sınıfa özel yetenek,
denge, ikonografi). Serbest puan aynı çeşitliliği sıfır ek içerikle verir.
Liderlik ağırlıklı oyuncu "ordu lordu", Güç ağırlıklı "şövalye lord" olur —
bunu biz yazmayız, oyuncu keşfeder.

### Seviye

Maks. **60**. XP savaştan, bölge fethinden ve bölge yükseltmeden gelir.
Hedef tempo: aktif oyuncu (günde ~6 savaş) **~110 günde** 60. seviye.
Seviye ayrıca **kaç bölge tutabileceğini** belirler — yani seviye sadece
sayı değil, haritadaki ayak izidir.

### Yaralanma

Savaşı kaybeden lord **4 saat yaralı** kalır: saldıramaz, savunmadaki katkısı
yarıya iner. Bölgeleri ve geliri etkilenmez.

**Neden:** Kaybetmenin bir bedeli olmalı ama bedel "ilerlemeni kaybettin"
olmamalı. Zaman cezası, kaynak cezasından çok daha az kırıcıdır ve oyuncuyu
oyundan atmaz. Dayanıklılık statı bu süreyi kısaltarak kendine bir amaç bulur.

---

## 2. Ekipman

### Slotlar

Altı slot, dondurulmuş: **Silah, Kalkan, Zırh, Miğfer, At, Sancak.**

### Üç eksenli güç

Bir eşyanın gücü üç şeyin çarpımıdır:

```
ItemPower = tier_taban_gücü  ×  nadirlik_çarpanı  ×  (1 + 0.08 × yükseltme)
              (T1..T5)         (Sıradan..Kadim)         (+0 .. +10)
```

Bu üç eksen üç ayrı ilerleme hissi verir:

- **Tier** seviyeye bağlı, garantili ilerleme. "Lv22'de T3 açılacak."
- **Nadirlik** şans. Üretim kumarı — heyecan buradan gelir.
- **Yükseltme** kaynak. Elindekini iyileştirme, sabırlı oyuncunun yolu.

Tek eksen olsaydı ilerleme düz olurdu. Üçü birlikte, aynı içerik miktarıyla
katlanarak daha uzun bir eğri üretir.

### Üretim (Demirhane)

Tier seçersin, altın + demir + süre harcarsın, **nadirlik rastgele gelir**.
Yüksek tier'da iyi nadirlik şansı artar ama Kadim hiçbir zaman garanti olmaz.

### Yükseltme

+0'dan +5'e kadar **başarı garantili**. +6'dan sonra risk başlar (+10'da %25).
Başarısızlıkta **sadece malzeme gider** — eşya kırılmaz, seviye düşmez.

**Neden kırılma yok:** Eşya kırılması kısa vadede "gerilim" gibi görünür, uzun
vadede oyuncuyu oyundan attırır. Malzeme kaybı yeterli bir bedeldir ve
oyuncunun elindeki ilerlemeye asla dokunmaz.

### Lordun savaştaki payı

Tam donanımlı endgame lordu, savaş gücünün **~%20'sini** taşır. Kasıtlı:

- %20 → ekipman gerçekten önemli, kuşanmak hissedilir.
- %20 → ama ordusu olmayan bir lord tek başına bölge alamaz.

Bu oran her iki pilar'ı da (ekipman gücü / ordu gücü) canlı tutar.

---

## 3. Ordu

### Beş birim, bir üçgen

| Birim | Rolü | Karakteri |
|---|---|---|
| **Köylü Milis** | Ucuz et kalkanı | Hızlı eğitilir, hiçbir şeyde iyi değil |
| **Mızrakçı** | Savunma omurgası | Süvariye karşı ×1.5 |
| **Okçu** | Ucuz hasar | Mızrakçıya karşı ×1.5 |
| **Süvari** | Vurucu güç, hız | Okçuya karşı ×1.5, yürüyüşü hızlandırır |
| **Mancınık** | Kale kırıcı | Kale savunmasına ×2.0, birime karşı ×0.5 |

İlk dördü klasik taş-kağıt-makas. Mancınık üçgenin dışında: birime karşı kötü,
duvara karşı şart. Bu, "ordumu neye göre kurayım?" sorusunu **hedefe** bağlar —
tarlaya saldırırken ve kaleye saldırırken farklı ordu istersin.

**Neden 5 birim:** Üçgen 3 birimle çalışır, 5'te zenginleşir, 8'de oyuncu ezber
tablosuna döner ve dengelemesi katlanarak zorlaşır. 5 tatlı noktadır.

### Komuta kapasitesi

`50 + Liderlik × 8`. Her birim yer tutar (Süvari 3, Mancınık 5). Ordunun
büyüklüğü kaynakla değil, **statla** sınırlıdır — böylece zengin oyuncu
sonsuz ordu yığamaz, Liderlik'e yatırım yapmak zorunda kalır.

### Bakım ve açlık

Her birim saatlik **erzak** yer. Erzak sıfıra düşerse ordu saatte **%5 firar**
eder. Bu oyunun tek "ceza döngüsü"dür ve amacı nettir: ordu bir varlık değil,
**bir gider kalemidir.** Sürekli beslemen gerekir, bu da tarla bölgelerini
değerli kılar.

Denge kontrolü yapıldı: malikâne geliri seviyeyle büyüdüğü için yeni oyuncu asla
açlığa düşmez; endgame oyuncusu ise tarla tutmadan büyük ordu besleyemez.

### Ordu donanımı (Demirhane'nin ikinci işi)

Üç hat, her biri 0-10 seviye, ordunun **tamamına** yüzde bonusu:

- **Silahlık** → ordu saldırısı, seviye başına +%3 (maks +%30)
- **Zırhhane** → ordu savunması, +%3 (maks +%30)
- **Nalbant** → ordu canı, +%3 (maks +%30)

Bu, kullanıcının istediği "orduya ekipman üretme" eksenidir ve bilinçli olarak
**birim başına envanter değil, ordu geneline çarpan** şeklinde tasarlandı:

- Birim başına ekipman = binlerce satır envanter yönetimi, korkunç arayüz.
- Ordu geneline çarpan = aynı stratejik karar, üç sayı, tek ekran.

Hatların maliyeti üstel: Lv10'a çıkmak yüz binlerce altın yer. Bu, oyunun ana
**altın deliğidir** — ekonomi geç oyunda bununla dengelenir.

---

## 4. Generaller

**12 sabit general**, üç nadirlikte (Bronz 6 / Gümüş 4 / Altın 2). Altınla
bir kez kiralanır, kalıcıdır. Slot sayısı Liderlik'e bağlı: **1 ile 3 arası.**

Her generalin bir **pasifi** (sürekli yüzde bonusu) ve bir **yeteneği**
(savaşta veya dışında özel etki) vardır. Savaşlardan XP kazanır, Lv20'de
pasifi ×1,38 olur.

Tasarım niyeti: generaller **oyun tarzını mühürler.** Kuşatmacı Tarık + Kumandan
Alparslan alan oyuncu saldırgan bir fatihtir; Kale Bekçisi Sarya + Mızrakçı
Kadir alan oyuncu turtacıdır. 3 slot / 12 general = 220 kombinasyon, sıfır ek
içerik.

Kaybedilen savaşta general %25 ihtimalle 6 saat dinlenmeye girer — general
kaybı yok, sadece geçici yokluk.

Tam kadro: `data/generals.json`.

---

## 5. Harita ve Bölgeler

### Yapı

Yarıçapı 4 olan altıgen harita: **1 merkez + 60 bölge = 61.**
Merkez etrafında 4 halka (ring), 6 vilayet.

```
        ring 4  ────  24 bölge   zayıf NPC, ×1.0 gelir   ← yeni oyuncu buradan başlar
        ring 3  ────  18 bölge   orta NPC,  ×1.2 gelir
        ring 2  ────  12 bölge   güçlü NPC, ×1.5 gelir
        ring 1  ────   6 bölge   çok güçlü, ×2.0 gelir
        ring 0  ────   1 bölge   TAHT KALESİ, ×3.0 gelir
```

**Merkeze yaklaştıkça değer ve direnç birlikte artar.** Harita böylece kendi
zorluk eğrisini taşır — ayrıca bir "bölge seviyesi" içeriği yazmaya gerek kalmaz.

### Dört bölge tipi

| Tip | Adet | Verir | Kale bonusu |
|---|---|---|---|
| Tarla | 18 | Erzak | %0 |
| Şehir | 18 | Altın | %10 |
| Maden | 12 | Demir | %5 |
| Kale | 12 | Altın + **saatlik Şöhret** | %30 |
| **Taht Kalesi** | 1 | Üçü birden + çok Şöhret | %50 |

Kale bölgeleri savunması en zor ama **doğrudan sıralama puanı basar** — yani
sıralamada yükselmek isteyen oyuncu en zor bölgeyi tutmak zorundadır. Rekabet
ekseni ile bölge ekseni burada birbirine düğümlenir.

### Sahiplik ve limit

Aynı anda tutabileceğin bölge sayısı: `1 + floor(seviye / 15)` → Lv60'ta **5.**
Taht Kalesi bu limite **dahil değildir.**

**Neden limit var:** Limitsiz olsa ilk 10 oyuncu haritayı yutar, kalan 110 oyuncu
oynayacak bir şey bulamaz ve dünya ölür. Limit, gücü haritada yaymaya zorlar ve
her zaman "alınabilecek bir bölge" bırakır.

### Bölge seviyesi

Her bölge 1-5 arası yükseltilir; her seviye geliri +%25 ve savunma bonusunu
+%5 artırır. Lv1→Lv5 geri ödemesi ~8,5 gün — yani yükseltme uzun vadeli bir
yatırımdır, hemen kâr etmez.

### Garnizon

Bir bölgeyi **sadece oraya bıraktığın ordu savunur.** Evdeki ordun bölgeyi
savunmaz. Bu, oyunun en önemli stratejik gerilimidir:

> Ordunu evde tutarsan saldırabilirsin ama bölgeni kaybedersin.
> Bölgelere dağıtırsan güvendesin ama fetih yapamazsın.

Bu tek kural sayesinde her oyuncu her gün gerçek bir karar verir.

### Taht Kalesi

Dünyada tek. Sahibi **"Diyarın Lordu"** unvanını ve **%20 şöhret bonusunu**
alır. Herkese haritada görünür, günlük saldırı limitine tabi değildir ve
kaybetme koruması sadece 2 saattir.

Bu, endgame'in tamamıdır: sürekli kavga edilen tek bir hedef. Sezon sistemi,
klan savaşı, dünya boss'u yazmaya gerek yok — 61 hex'in ortasındaki bir kare
aynı işi görüyor.

---

## 6. Savaş

### Akış

1. Saldırgan ordusunu ve generallerini seçer, hedefe **yürüyüş** emri verir.
2. Yürüyüş süresi mesafe ve **en yavaş birimin hızına** göre hesaplanır (10dk–6sa).
3. Varışta sunucu savaşı çözer. Saldırgan izlemek zorunda değildir.
4. Sağ kalanlar yağmayla birlikte geri döner (aynı süre).

Savaş **5 turda**, sunucuda, **seed'li deterministik RNG** ile çözülür.
Log kaydedilir ve seed sayesinde her zaman yeniden üretilebilir — yani
"hile yapıldı" tartışması teknik olarak imkânsızdır.

### Sonuç bandı

Güç oranı `R = saldırı / (saldırı + savunma)` üzerinden kayıplar hesaplanır.
Kritik tasarım kararı: **kazanan da her zaman kaybeder.**

| Durum | Kazananın kaybı | Kaybedenin kaybı |
|---|---|---|
| Ezici üstünlük (3×) | ~%18 | ~%75 |
| Belirgin üstünlük (1,5×) | ~%28 | ~%66 |
| Başabaş (1,05×) | ~%34 | ~%61 |

3 kat güçle saldırsan bile ordunun altıda birini gömersin. Bu yüzden hiç kimse
sonsuz saldıramaz; her savaş yeniden yatırım ister ve ekonomi savaşa bağlanır.

Her tura seed'li ±%7 varyans eklenir: sonuç kesin değildir ama güçlü taraf
~%95 kazanır. Yani ne "zar oyunu" ne de "hesap makinesi" olur.

### Bölge ele geçirme

Bölge el değiştirir ancak: **garnizonun tamamı yok edilir** ve saldırganın
en az bir birimi hayatta kalır. Kısmi zafer bölgeyi vermez — sadece yağma verir.

### Yağma

Savunanın deposunun **%25'i** (Kurnazlık ile artar), ordunun taşıma
kapasitesiyle sınırlı. Süvari en çok taşır. Bölge alamayan oyuncu için yağma
tam teşekküllü bir alternatif kariyerdir.

---

## 7. Korumalar (Anti-Snowball)

Sürekli dünyalı oyunların ölüm sebebi hep aynıdır: erken liderler zayıfları
ezer, zayıflar bırakır, dünya boşalır. Altı kural bunu engeller:

| Koruma | Değer | Neyi engeller |
|---|---|---|
| Yeni oyuncu kalkanı | 72 saat (ilk saldırında biter) | Doğar doğmaz ezilmeyi |
| Fetih sonrası kalkan | 6 saat | Bölgenin ping-pong olmasını |
| Yağma sonrası kalkan | 2 saat (yalnız oyuncu bölgesi) | Uykuda zincirleme akınla silinmeyi |
| Aynı saldırgan kilidi | 12 saat | Tek oyuncunun taciz etmesini |
| Seviye farkı kilidi | 8+ seviye alta saldırılamaz | Güçlünün kolay avlanmasını |
| Günlük saldırı limiti | 12 | Oyunu 7/24 oynayanın avantajını |

Yağma kalkanı ilk beşin arasındaki boşluğu kapatıyor: aynı saldırgan 12 saat
bekliyordu ama **farklı** saldırganlar sınırsız zincirleyebiliyordu, fetih
kalkanı da yalnız bölge el değiştirince kuruluyordu. Arada kalan hâl —
garnizonu kırılan ama bölgesi elinde kalan oyuncu — korumasızdı. Kalkan
bilerek fetih kalkanından kısa: fethetmek yağmalamaktan cezalı olmamalı.
NPC garnizonlarına konmuyor; orada korunacak kimse yok ve konsa erken
genişleme durur.

Taht Kalesi son iki kuraldan muaftır — orada kural yoktur, olay da odur.

---

## 8. Sıralamalar

Üç ayrı sıralama, çünkü tek sıralama tek oyun tarzını ödüllendirir:

| Sıralama | Ölçer | Kimi ödüllendirir |
|---|---|---|
| **Şöhret** | Genel toplam skor | Dengeli, uzun soluklu oyuncuyu |
| **Fetih** | Bölge seviyesi × tip çarpanı | Toprak sahibini |
| **Kılıç** | ELO (K=24) | Savaşçıyı — bölgesiz oyuncu da 1. olabilir |

Kılıç sıralaması özellikle önemli: bölge tutamayan oyuncunun da tırmanacak bir
merdiveni olur. Böylece kaybeden oyuncu oyundan çıkmaz.

Sıralamalar hem dünya (shard) hem global tutulur, 5 dakikada bir yenilenir.

---

## 9. Ekranlar

v1 için **7 ekran**, fazlası yok:

| # | Ekran | İçerik |
|---|---|---|
| 1 | **Malikâne** | Kaynak sayaçları, aktif kuyruklar, olay akışı, hızlı işlemler |
| 2 | **Lord** | Statlar, puan dağıtımı, 6 ekipman slotu, envanter |
| 3 | **Demirhane** | Ekipman üretimi, yükseltme, 3 ordu donanım hattı |
| 4 | **Kışla** | Birim eğitimi, ordu dağılımı, komuta kapasitesi çubuğu |
| 5 | **Harita** | 61 hex, sahiplik renkleri, bölge detay paneli, saldırı emri |
| 6 | **Generaller** | 12 generallik kadro, kiralama, slot yerleşimi |
| 7 | **Sıralama** | 3 sekme, ilk 100 + kendi sıran |

Savaş raporu ekran değil, **modal**: Harita ve Malikâne'den açılır.

### Arayüz ilkeleri

**Sadece mobil.** Masaüstü düzeni yok: tek sütun, sabit üst durum çubuğu,
sabit alt gezinme (4 sekme + menü), dokunmatik hedefleri en az 44px.
Bölge detayı yan panel değil alt sayfa olarak açılır.


- **Her ekranda kaynak çubuğu görünür.** Oyuncu "param yeter mi?"yi hiç sormamalı.
- **Her timer geri sayım gösterir**, bitiş saatini değil. ("18 dk" > "14:32'de")
- **Her savaş öncesi tahmin gösterilir.** Aynı simülasyon istemcide çalışır,
  oyuncu kör saldırmaz. (Sunucudaki sonuç yine de otoritedir.)
- **Renk körü güvenli sahiplik:** haritada renk + desen birlikte kullanılır.
