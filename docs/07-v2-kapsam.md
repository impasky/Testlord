# 07 — v2 Kapsamı

`docs/00`'daki v1 kapsamı **bilerek dondurulmuştu** ve o karar sayesinde oyun
hızlı bitti. Bu doküman o kararın bedelini kabul edip düzeltiyor.

> **Tez:** v1 makineyi kurdu, v2 geri gelme sebebini kuruyor.
>
> Tek ölçüt: **oyuncunun harcadığı her saat ya başka bir oyuncuyu içermeli ya
> da başka bir oyuncunun hissedeceği bir sonuç üretmeli.** Bu ölçütü
> geçmeyen hiçbir şey v2'ye girmez.

Her bölüm `docs/07-elestiri` niteliğindeki eleştirinin bir maddesine cevap
verir; hangi maddeye cevap verdiği başlıkta yazılıdır.

---

## Kabul: v1 kapsamı yanlış çizilmişti

İttifak, sohbet ve sezon "sonra eklenecek güzellikler" diye sınıflandırıldı.
Bu sınıflandırma yanlıştı. Bu türde ittifak bir özellik değil, **taşıyıcı
duvardır**; onsuz yapılan her cila batmakta olan bir geminin güvertesini
boyamaktır.

Bu yüzden v2 bir "sürüm" değil, **v1'in tamamlanması**.

---

## M10 — İttifak ve sohbet · 6 gün
### Eleştiri 1 (sosyal katman yok), 2 (bekleme boş), 4 (yeni oyuncu eleniyor)

Oyunun en büyük eksiği. Diğer her şeyden önce gelir; onsuz kalan maddelerin
değeri düşer.

**Yapı**
- İttifak: en fazla **15 üye**. 120 kişilik shard'da 8 ittifak eder — rekabet
  için yeterince çok, herkesin birbirini tanıması için yeterince az.
- Roller: lider, subay (davet/atma yetkisi), üye.
- Kalıcı sohbet, sayfalama, son 500 mesaj.
- İttifak üyeleri birbirinin garnizonunu görür. İstihbarat paylaşımı
  koordinasyonu gerçek kılar.

**Takviye — bu maddenin can damarı**

Bir üye, başka bir üyenin bölgesine ordu gönderebilir. Takviye orada garnizon
gibi savunur, 24 saat sonra kendiliğinden eve döner.

Neden en önemli mekanik bu:
- **Beklemeyi yardıma çevirir.** Altı saatlik yürüyüş, birinin bölgesini
  kurtarmak için yola çıkmışsa bekleyiş değil gerilimdir.
- **Bölgesiz oyuncuyu oyunda tutar.** 60 bölge / 120 oyuncu matematiğinde
  yarısı bölgesiz kalıyor. Takviye ile bölgesi olmayan oyuncu da orduyu
  büyütür, savaşa girer, ittifakına değer katar. Kıtlık artık dışlamıyor,
  rol dağıtıyor.
- **İttifakı mekanik yapar.** Sohbet odası olmaktan çıkarır.

**Denge riski:** takviye savunmayı fazla güçlendirebilir ve harita
donabilir. Karşı önlem: takviye eden lordun katkısı yarım sayılır (lord
orada değil), ve bir bölgede en fazla 2 takviye durabilir.

---

## M11 — Sezon · 5 gün
### Eleştiri 3 (endgame darboğaz), 4 (olgun shard yeni oyuncuyu eliyor)

`docs/01` Taht Kalesi için *"sezon sistemi yazmaya gerek yok"* diyordu.
Yanlıştı. Tek taht, **bir kazanan ve 119 seyirci** üretir; sıralama donduğu
an oyun ölür.

**Döngü: 8 hafta**
- Sezon sonunda sıralamalar dondurulur, şampiyon ittifak ve Diyarın Lordu
  kalıcı olarak kaydedilir.
- Harita sıfırlanır: bölgeler, ordular, ekipman, kaynaklar gider.
- **Taşınan:** lord seviyesi (yarısı), general seviyeleri, kazanılan
  unvanlar ve kozmetikler.

Neden kısmi taşıma: tam sıfırlama emeği çöpe atar ve oyuncuyu küstürür; tam
taşıma geç gelen için umutsuz bir duvar örer. **Kimliğin kalır, tahta
sıfırlanır.**

**Sezon puanı**

Şöhret/fetih/kılıç sıralamalarının üstünde, ittifak düzeyinde tek bir puan.
Bireysel başarı ittifakın puanına yazılır — böylece "benim sıram" yerine
"bizim sıramız" oluşur ve tek kişinin öne geçmesi diğerlerini
umutsuzlaştırmaz.

**Taht Kalesi'nin yeni rolü:** sezonun tek hedefi değil, sezon puanının en
büyük çarpanı. Elde tutulan her saat puan yazar. Böylece taht hem
kavga sebebi kalır hem de "alan bitirdi" olmaz.

---

## M12 — Savaşta karar · 4 gün
### Eleştiri 5 (oyuncunun savaşta kararı yok)

Savaş sunucuda çözülüyor ve oyuncunun içeride kararı yok. Async bir oyunda
canlı müdahale zaten olmayacak — ama **savaş öncesi karar** olabilir.

Üç dik eksen ekleniyor; hiçbiri yeni içerik değil, var olanı derinleştiriyor:

| Karar | Seçenekler | Ne değiştirir |
|---|---|---|
| **Duruş** | Saldırgan / Dengeli / Temkinli | Verilen hasar ↔ alınan kayıp dengesi |
| **Hedef önceliği** | Hangi düşman birimine yüklenilecek | Taş-kağıt-makası aramadan seçime çevirir |
| **Yetenek turu** | Generalin yeteneği 1., 2. ya da 3. turda | Zamanlama kararı |

5 birim × 3 duruş × 5 hedef × 3 tur = karar uzayı içerik eklemeden büyür.

**Kritik kural:** önizleme seçilen planın sonucunu gösterir. Savaş kumar
değil bulmaca olmalı — oyuncu kaybettiğinde şansı değil kendi planını
suçlayabilmeli.

---

## M13 — Dil ve erişim · 4 gün
### Eleştiri 6 (Türkçe-only), 8 (mağaza yok), 9 (bildirim yok)

- **i18n**: bütün metinler çıkarılır, TR + EN. Motor ve denge dosyaları
  zaten dilden bağımsız.
- **Native kabuk (Capacitor)**: mağaza varlığı ve **push bildirimi**.
  Push, e-postanın yerini alır — e-postayı kimse açmaz.
- **Önce Android.** iOS derlemesi Mac istiyor (`docs/06`), o kapı şimdilik
  kapalı ve bunu beklemek diğer her şeyi durdurur.

---

## M14 — Geri dönüş kancaları · 3 gün
### Eleştiri 9 (kanca yok), 2 (bekleme boş)

- **Push bildirimi**: saldırıya uğradın, ordun vardı, kuyruk bitti,
  ittifakında senden bahsedildi.
- **Günlük görev**: günde 3 görev, İlk Adımlar gibi **oyun durumundan
  türetilir** — ayrı bir durum tablosu yok, hile yüzeyi yok.
- **İttifak yükümlülüğü**: takviyen bitmek üzere, müttefikin saldırı
  altında. En güçlü kanca budur: insanı oyuna sokan şey görev değil, birinin
  ona ihtiyaç duymasıdır.

---

## M15 — Para modeli · 3 gün
### Eleştiri 7 (başarı bir gider)

Oyunun vaadi adil rekabet. Bu vaadi bozan hiçbir şey satılamaz.

**Satılabilir**
- Kozmetik: lord portresi, sancak deseni, bölge derisi, isim rengi
- Sezon geçişi: oynayarak ilerleyen kozmetik hat + küçük kolaylıklar

**Satılamaz**
- Kaynak, hızlandırma, ekipman, general, ordu, ekstra bölge
- Kısaca: **güç satılmaz.**

**Dürüst değerlendirme:** 120 kişilik shard'larda kozmetik satışı bir iş
kurmaz. Amaç zaten o değil — amaç **oyun tutarsa batmamak.** Sunucu ve
veritabanı faturasını karşılarsa görevini yapmış olur. Bunun ötesini
hedeflemek, oyunu bozan kararlara kapı açar.

---

## M16 — Kendi kendini yöneten canlı operasyon · 3 gün
### Eleştiri 8 (tek kişi, canlı operasyon kapasitesi yok)

Bu tür etkinlikle yaşar ve etkinlik bir ekibin tam zamanlı işidir. Burada
tek kişi var, üstelik bilgisayarsız. Çözüm daha çok çalışmak değil,
**elle yapılacak işi tasarımdan çıkarmak.**

- **Sezon döngüsü otomatik**: bitir, arşivle, sıfırla, yenisini aç — hepsi
  zamanlanmış görev. İnsan müdahalesi gerekmez.
- **Etkinlik = veri**: hafta sonu çarpanları `balance.json`'a yazılır, kod
  değişmez, dağıtım gerekmez.
- **Denetim kuyruğu**: şikâyetler tek bir listede, telefondan bakılabilir.

---

## v2'nin çözemeyeceği şeyler

Bunları kapsamla çözemem; dürüstçe yazıyorum:

- **Pazarlama bütçesi yok.** Bu türde kullanıcı edinme maliyeti mobilin en
  yükseklerinden. Oyun kendi kendine keşfedilmez.
- **iOS için Mac gerekiyor.** Bulut CI ile aşılır ama aylık ücreti var.
- **Pazar büyüklüğü.** İngilizce eklemek havuzu büyütür ama rakipler 15+
  dilde ve yıllardır oradalar.
- **Tek kişi.** M16 elle yapılacak işi azaltır, sıfırlamaz.

Bunlar oyunun kalitesiyle ilgili değil, koşullarla ilgili. Kapsam
kararlarıyla değil, ancak beklentiyi doğru kurarak yönetilir.

---

## Sıra ve gerekçe

| # | Taş | Gün | Neden bu sırada |
|---|---|---|---|
| M10 | İttifak ve sohbet | 6 | Taşıyıcı duvar. Diğer her şeyin değeri buna bağlı |
| M11 | Sezon | 5 | Ölü sıralama sorununu çözer; ittifak varken anlamlı |
| M14 | Geri dönüş kancaları | 3 | İttifak yükümlülüğü en güçlü kanca — M10 gerekli |
| M13 | Dil ve erişim | 4 | Push bildirimi M14'ü tamamlar; native kabuk gerekli |
| M12 | Savaşta karar | 4 | Derinlik, oyuncu kalmaya başladıktan sonra değerli |
| M16 | Canlı operasyon | 3 | Sezon otomasyonu M11'i gerektirir |
| M15 | Para modeli | 3 | En son: satacak bir topluluk oluşmadan satış anlamsız |

**Toplam ~28 iş günü.**

**Kesilirse ne olur:** M10 kesilirse v2 yapmanın anlamı yok. M11 kesilirse
oyun ilk sezonun sonunda ölür. Kalanlar ertelenebilir.

---

## Başarı kriteri

v1'in kriteri "oyun çalışıyor mu" idi. v2'ninki farklı olmalı:

- [ ] Bir oyuncu, ittifakındaki birinin bölgesini takviyeyle kurtarabiliyor
- [ ] Bölgesi olmayan bir oyuncunun ittifakına katkı verecek bir rolü var
- [ ] Sezon sonunda harita sıfırlanıyor ve yeni gelen boş haritaya giriyor
- [ ] Oyuncu savaşı kaybettiğinde şansı değil planını suçlayabiliyor
- [ ] Oyun dışındayken saldırıya uğradığını telefonundan öğreniyor
- [ ] 7. gün tutundurma ölçülebiliyor (şu an ölçüm bile yok)

Son madde en önemlisi: **v2'nin işe yarayıp yaramadığını tahminle değil
sayıyla bilmemiz gerekiyor.** Ölçüm olmadan bir sonraki eleştiri de tahmin
olur.
