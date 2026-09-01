# 08 — İlk Oturum Onarımı

> Bu doküman `docs/07`'nin **önüne** geçer. `docs/07`'deki M10–M16 iptal değil,
> ertelendi: bu dokümandaki işler bitmeden hiçbiri başlamaz.

---

## Neden bu doküman var

`docs/07`, benim yazdığım eleştiriye cevaptı. O eleştiri **tahmindi** ve 2.
haftayı konu alıyordu: sosyal katman yok, sıralama donuyor, geri dönüş kancası
yok.

Sonra oyun ilk kez gerçek bir oyuncu tarafından oynandı. Oyuncu **2. dakikada**
çıktı. Verdiği rapor aynen şu:

> "karman çorman hissettiriyor sanki her şey iç içe gibi, bir şeyler yapıyorum
> ama ne yaptığımı anlamıyorum. asker ürettim bir yere saldırıya gönderdim, eee
> ne oldu şimdi, ne işe yarayacak bu saldırı. bir de harita niye bu kadar küçük,
> tek oyunculu bir oyun mu bu. demirhanede silahlar var da ne işe yarıyor,
> gücümü en yüksek olanı kuşan dedim gücüm arttı, eee ne oldu şimdi, ne işe
> yaradı. ne saçma oyun deyip çıktım."

Ve değerlendirme yöntemini de söyledi: **bir oyuna girdiğinde ilk oturumda karar
verir; ilgi çekici gelmezse kapatır ve siler.**

Bu, kapsamı belirleyen tek kısıt hâline geliyor. 2. hafta tutundurmasını
tasarlamanın anlamı yok — kimse 2. haftaya varmıyor.

---

## Teşhis: tek bir hastalık

Oyun **durum değişikliğini** bildiriyor, **sonucu** bildirmiyor.

| Oyun ne diyor | Oyuncu ne duymak zorunda |
|---|---|
| "Güç 340 → 512" | "Demirkapı saldırında kaybın 340 asker değil 180 asker olur" |
| "Yürüyüş başladı, 4s 12dk" | "Kazanırsan Demirkapı senin: saatte +200 altın, sıralaman 41 → 28" |
| "5 mızrakçı eğitiliyor" | "Bu 5 mızrakçıyla Demirkapı'yı alabilirsin — şu an alamıyorsun" |
| "Şöhret 1.240" | "Şöhrette 41. sıradasın. 28. sıradaki Vardar'ın 1.640 şöhreti var" |

Sol sütun bir muhasebe defteri. Sağ sütun bir oyun. Şu an sadece sol sütun var.

Bunun üç ayrı belirtisi çıkıyor ve oyuncu üçünü de ayrı ayrı söyledi.

### Belirti 1 — "eee ne oldu şimdi" (amaç ve sonuç yok)

Kodda doğrulandı:

- `Harita.tsx:589` — saldırı önizlemesi **ZAFER/YENİLGİ ve kayıp sayısı**
  gösteriyor. Kazanınca ne kazanılacağı (gelir, şöhret, sıralama) hiçbir yerde
  yok.
- `Demirhane.tsx:125` — `GucFarki` bileşeni **+172** gibi çıplak bir sayı
  gösteriyor. `balance.json`'da bu sayı `lord_savas_katkisi = güç*3 +
  ekipman_gücü*0.8` formülüne giriyor, ama oyuncu bu formülü hiçbir ekranda
  görmüyor. Ekipman, savaşla hiçbir yerde ilişkilendirilmemiş.
- Savaş raporu var ve iyi — ama **saldırıdan saatler sonra** açılıyor. İlk
  oturumda hiç görülmüyor.

### Belirti 2 — "karman çorman, her şey iç içe"

7 ekran, hepsi alt çubukta eşit seviyede duruyor. Hiyerarşi yok, sıra yok.
Oyuncu döngüyü kendi kurmak zorunda: *kaynak → asker → saldırı → bölge → gelir →
daha çok asker.* Bu döngü tasarımda var, arayüzde hiçbir yerde yazmıyor.

`IlkAdimlar.tsx` var ama bir **kontrol listesi bileşeni**, omurga değil. Yanında
duruyor, yönlendirmiyor.

### Belirti 3 — "harita niye bu kadar küçük, tek oyunculu mu"

İki ayrı sorun, tek cümlede:

1. **Harita insansız görünüyor.** Hexlerin üstünde sahip adı yok. Dünyada kaç
   lord olduğu yazmıyor. Kimin ne zaman ne yaptığı görünmüyor. 119 diğer oyuncu
   arayüzde hiçbir yerde mevcut değil — sadece `Sıralama` ekranında bir liste
   olarak.
2. **61 hex telefon ekranında gerçekten küçük duruyor.** Dünyanın 120 kişilik
   olduğu bilgisi hiçbir yerde geçmiyor, dolayısıyla oyuncu gördüğü 61 hexi
   "oyunun tamamı" sanıyor.

---

## Kapsam: M9.5 — "Eee ne oldu şimdi?"

Yedi iş. Hiçbiri yeni içerik değil; hepsi **var olanı görünür kılmak.**
Toplam **~6 iş günü**.

---

### İ1 — Her eylem, karşılığını önceden söyler · 1.5 gün
#### Cevap verdiği: "ne işe yarayacak bu saldırı"

Her eylem onayının üstünde iki satır: **kazanırsan ne olur, kaybedersen ne
olur.** Tahmin değil, motordan hesaplanan gerçek sayı.

**Saldırı önizlemesi (`Harita.tsx`)**

```
KAZANIRSAN
  Demirkapı senin olur      saatte +200 altın
  Şöhret                    1.240 → 1.640
  Şöhret sıralaması         41. → ~28.
KAYBEDERSEN
  Ordu kaybın               ~340 asker  (yeniden eğitmek 4.200 altın, 35 dk)
  Geçen süre                4s 12dk gidiş + 4s 12dk dönüş
```

Aynı biçim: asker eğitimi, ekipman üretimi, ekipman yükseltme, bölge yükseltme.

**Kural:** hiçbir onay butonu, bastıktan sonra ne olacağını söylemeden
basılabilir olmayacak.

**Not:** sıralama tahmini (`41. → ~28.`) yaklaşık; sunucuda mevcut sıralama
tablosundan hesaplanır, `~` işareti korunur.

---

### İ2 — Her sonuç, öncesi/sonrası olarak gösterilir · 1 gün
#### Cevap verdiği: "gücüm arttı, eee ne oldu şimdi"

Sonuç ekranı **çıplak sayı göstermez, fark gösterir.**

**Savaş raporunun ilk bloğu** (şu an tur tur güç çubuklarıyla başlıyor —
onlar aşağı iner):

```
DEMİRKAPI ALINDI
  Şöhret        1.240 → 1.640    (+400)
  Sıralama      41.   → 28.      (13 sıra yukarı)
  Saatlik gelir +200 altın       (toplam 540 altın/saat)
  Bölge         1     → 2        (limit 4)
```

**Ekipman kuşanma (`Demirhane.tsx`)** — `GucFarki`'nin çıplak `+172`'si yerine:

```
Kadim Kılıç kuşanıldı
  Savaş katkın            340 → 512
  Demirkapı saldırısında  ~340 kayıp → ~180 kayıp
  Şöhret                  1.240 → 1.343
```

İkinci satır kritik: **ekipmanı haritadaki gerçek bir hedefe bağlar.** "Güç"
soyut bir sayı; "180 daha az asker ölür" bir sonuç. Hedef olarak oyuncunun
son incelediği ya da en yakın ele geçirilebilir bölge kullanılır.

---

### İ3 — İlk saldırı dakikalarda biter, saatlerde değil · 1 gün
#### Cevap verdiği: "asker ürettim, saldırıya gönderdim, eee ne oldu şimdi"

Bu, "ne oldu şimdi" sorusunun **cevabının olmamasının** asıl sebebi. Gerçekten
hiçbir şey olmuyor — 6 saat boyunca.

- **Doğuş garantisi:** her lord, doğduğu yerin **1 hex komşuluğunda**, kendi
  başlangıç ordusunun rahat kazanacağı bir NPC bölgesiyle başlar. 1 hex = 12
  dakika (`yuruyus.dakika_hex_basina`).
- **İlk yürüyüş hızlandırması:** oyuncunun **ilk saldırı yürüyüşü** için süre
  `yuruyus.ilk_saldiri_dakika` ile sabitlenir (öneri: **2 dakika**). Sadece bir
  kez, `balance.json`'dan. Tek amacı: oyuncunun ilk oturumda savaş raporunu
  görmesi.
- Bu iki madde birlikte şunu garantiler: **kayıt olduktan ~5 dakika sonra
  oyuncu bir savaş kazanmış, bir bölge almış ve gelirinin arttığını görmüş
  olur.**

Denge etkisi yok: hızlandırma sadece ilk yürüyüşe, sadece NPC bölgesine ve
oyuncu başına bir kez uygulanır. PvP'yi ve sonraki hiçbir şeyi etkilemez.

---

### İ4 — Tek omurga: "şimdi ne yapmalıyım" · 1 gün
#### Cevap verdiği: "karman çorman, her şey iç içe, ne yaptığımı anlamıyorum"

Malikâne ekranının en üstü **komuta bloğu** olur. Her an **tek bir birincil
eylem** gösterir ve o eylemi ekran adıyla değil, **karşılığıyla** adlandırır:

```
ŞİMDİ NE YAPMALISIN
┌────────────────────────────────────────┐
│ DEMİRKAPI'YA SALDIR                    │
│ Kazanırsan saatte +200 altın           │
│ Ordun yeterli · 2 dk yürüyüş           │
│                            [ SALDIR ]  │
└────────────────────────────────────────┘
sonra: Demirhane'de kılıç üret → savaş katkın artar
```

- Eylem **oyun durumundan türetilir** (`IlkAdimlar` gibi — ayrı durum tablosu
  yok, hile yüzeyi yok).
- Buton doğrudan ilgili ekranın doğru yerini açar; oyuncu sekmelerde hedef
  aramaz.
- Altındaki tek satır **bir sonraki adımı** söyler, böylece döngü görünür olur.

`IlkAdimlar.tsx` bu bloğun içine taşınır; ayrı bir kontrol listesi kalmaz.

---

### İ5 — Harita insanlı görünsün · 1 gün
#### Cevap verdiği: "harita niye bu kadar küçük, tek oyunculu bir oyun mu bu"

- **Hexlerin üstünde sahip adı.** Sahipli her bölgede lord adı yazar. Harita
  bir tahta değil, bir komşuluk hâline gelir.
- **Dünya başlığı:** `Kuzey Diyarı · 120 lorddan 47'si aktif · Taht: Vardar`.
  Oyuncu gördüğü şeyin bir dünyanın parçası olduğunu ilk bakışta anlar.
- **Canlı akış şeridi** (harita üstünde, kayan tek satır):
  `Vardar 2 saat önce Demirkapı'yı aldı · Sarpkaya, Boruk'a saldırıyor · ...`
  Veri zaten `Battle` tablosunda; yeni model gerekmez.
- **Hexten profile:** bir bölgeye dokununca sahibinin adı tıklanabilir olur,
  sıralamadaki yerini ve ordusunun tahmini gücünü gösterir.

`SEED_DEMO_LORDS` bu iş için yeterli değil — demo lordlar hareketsiz. Boş
dünyada akış şeridi **son savaşlar yoksa gizlenir**, sahte veri üretilmez.

---

### İ6 — Oyun ne olduğunu 30 saniyede söyler · 0.5 gün
#### Cevap verdiği: "ne saçma oyun deyip çıktım"

Oyun şu an **kazanma koşulunu hiçbir yerde yazmıyor.** Taht Kalesi kodda var,
oyuncuya hiç tanıtılmıyor.

- Kayıttan hemen sonra tek ekran, üç cümle: *Bu diyarda 120 lord var. Ortadaki
  Taht Kalesi'ni tutan kişi Diyarın Lordu olur. Sen 41. sıradasın.*
- Ardından doğrudan İ4'teki komuta bloğuna düşer — metin ekranı zinciri yok.
- Taht Kalesi haritada **ilk andan itibaren görünür ve işaretli** olur; oyuncu
  neye doğru oynadığını görür.

---

### İ7 — Ölçüm · 0.5 gün
#### Cevap verdiği: bir sonraki eleştirinin de tahmin olmaması

`docs/07`'nin başarı kriterlerindeki son madde buraya taşınıyor, çünkü asıl
ihtiyaç burada:

- Kayıt → ilk savaş raporu arasındaki süre (**hedef: < 6 dakika**)
- İlk oturumda oyuncunun tamamladığı eylem sayısı
- İlk oturumda çıkış noktası: hangi ekranda kapattı
- 1. gün geri dönüş oranı

Bu dört sayı olmadan bir sonraki turda yine tahmin ederiz.

---

## Sıra ve durum

| # | İş | Durum |
|---|---|---|
| İ3 | İlk saldırı dakikalarda bitsin | ✅ bitti |
| İ1 | Eylem karşılığını önceden söylesin | ✅ bitti |
| İ2 | Sonuç öncesi/sonrası gösterilsin | ✅ bitti |
| İ4 | Tek omurga | ✅ bitti |
| İ6 | 30 saniyelik amaç | ✅ bitti |
| İ5 | Harita insanlı görünsün | ✅ bitti |
| İ7 | Ölçüm | ✅ bitti |

---

## Uygulanırken çıkanlar

Kapsamı yazarken bilmediğim, ancak kod ve ekran görüntüsü üzerinde
görülebilen şeyler. Hepsi düzeltildi; buraya not düşülüyor çünkü her biri
aynı hastalığın başka bir yüzüydü: **oyunun oyuncuya tutamayacağı sözler
vermesi.**

**Bölge, savaşı kazanmakla el değiştirmiyor.** `balance.json`'da fetih
eşiği var: `R ≥ 0,60`, kabaca 1,5 kat güç. Dar zaferde yalnızca yağma
alınıyor. Ne öneri ne önizleme bunu biliyordu; ikisi de "ordun yetiyor"
deyip bölgeyi vermiyordu. Artık "kazanır" fetih demek, dar zafer ayrıca
söyleniyor.

**Aynı savaş için üç ayrı tohum vardı.** Öneri, önizleme ve ekipman
karşılaştırması ayrı tohumlarla ayrı simülasyonlar çalıştırıyordu; aynı
ekranda "ordun yetiyor" ile "bölge el değiştirmez" yan yana çıkabiliyordu.
Üçü tek tohum tabanını ve **dokuz savaşlık örneklemeyi** kullanıyor. Savaşta
tur başına ±%7 varyans var — tek simülasyon bir tahmin değil, bir kura
sonucu. Önizleme artık kesinlik değil ihtimal söylüyor.

**"Daha fazla asker eğit" bir tavsiye değil, bilmeceydi.** Ne kadar
gerektiğini oyuncu bilmiyordu ve deneyerek öğrenmenin bedeli bir yürüyüş ve
bir orduydu. Cevap artık somut ve motorun kendi savaşından ikili aramayla
çıkıyor: hangi birimden kaç tane, kaç altına. Üç kez düzeltildi:

- önce yalnızca en ucuz birime bakıyordu (57 milis) — oysa okçu altın
  başına daha çok saldırı gücü veriyor (15 okçu);
- sonra kaynağı hesaba katmıyordu — "57 milis" derken kesede 56'lık altın
  vardı;
- sonra güvenlik payı komuta kapasitesine sığmayınca sessizce kırpılıyordu,
  yani pay tam gerektiği yerde yok oluyordu.

**Öneri, oyuncunun harcadığı altına göre kayıyordu.** "Şu bölge için 27 okçu
eğit" deyip, okçular eğitilince başka bir bölge gösteriyordu. Planı
uygularken hedefin altından kayması, düzeltmeye çalıştığımız duygunun ta
kendisiydi. Seçim artık kaynaktan bağımsız.

**Yakınlık ile zorluk karıştırılıyordu.** Ring 4'teki bir kale ile bir tarla
aynı 37 birimi barındırıyor ama kalenin tahkimatı onu 1. seviye lorda
imkânsız kılıyor. Kale hex'inde doğan oyuncuya hiçbir orduyla alamayacağı
hedef gösteriliyordu. Artık savunma gücüne bakılıyor ve en yakın adaylarda
"kapasiten dolsa alır mıydın" sorusu gerçekten soruluyor.

**Ordusu yoldayken oyuncuya "yeni ordu kur" deniyordu.** Ordusu vardı,
sadece evde değildi.

**`pnpm typecheck` ilk pakette duruyordu** ve `apps/api` hiç
denetlenmiyordu. `--no-bail` eklendi; bu sayede yakalanan gerçek bir hata da
düzeltildi.

---

## Ölçüm nasıl okunur

```
OLCUM_ANAHTARI=<değer> pnpm olcum
```

ya da telefondan: `https://<adres>/api/olcum?anahtar=<değer>`

Anahtar tanımlı değilse uç **hiç yüklenmez**. Oyuncu verisi değil, yalnızca
toplamlar döner.

Asıl bakılacak sayı **"ilk 30 dakika içinde savaşan oranı"**: kayıt olup
hiçbir sonuç görmeden çıkanları doğrudan gösterir. "Oyunun bırakıldığı
ekran" ise bir sonraki turda nereye bakılacağını söyler.

---

## Başarı kriteri

Tek ölçüt var ve `docs/07`'ninkinden farklı:

> **Oyunu ilk kez açan biri, 6 dakika içinde bir savaş kazanmış, bir bölge
> almış, gelirinin arttığını görmüş ve bir sonraki hedefinin ne olduğunu
> biliyor olmalı.**

Yan koşullar:

- [ ] Hiçbir onay butonu, sonucunu söylemeden basılabilir değil
- [ ] Hiçbir sonuç ekranı çıplak sayı göstermiyor; hepsi öncesi/sonrası
- [ ] Ekipman gücü, haritadaki gerçek bir hedefe bağlı olarak açıklanıyor
- [ ] Haritada en az bir başka lordun adı ve en az bir olay görünüyor
- [ ] Oyuncu "kazanmak ne demek" sorusunun cevabını ilk 30 saniyede duyuyor

---

## `docs/07` ne olacak

İptal değil, **sıraya alındı.** M10 (İttifak) hâlâ oyunun en büyük mekanik
eksiği ve 2. hafta için hâlâ doğru cevap. Ama bir oyuncu 2. dakikada
çıkıyorsa ittifak sistemi boş bir odaya kurulmuş olur.

Sıra: **M9.5 (bu doküman) → M10 → M11 → ...**

---

## İ8 — Görsel yoğunluğu kırma

İlk yedi iş bittikten sonra oyuncu tekrar oynadı: *"genel olarak daha iyi ama
hâlâ karmaşık hissettiriyor"* — ve referans olarak birkaç mobil RPG ekran
görüntüsü gönderdi.

Referansların ortak dili net ve benimkinin tam tersiydi:

| Referans | Bendeki |
|---|---|
| Kart başına **tek eylem, tek büyük düğme** | Kışla kartında 18 öğe: 6 istatistik ikonu, 5 adet düğmesi, 3 maliyet, açıklama cümlesi |
| Sayılar **rozet içinde** ("1/4", "0/2") | Sayılar cümlenin içine gömülü: "27 Okçu daha gerekiyor (4.050 altın)" |
| Kalın çerçeve, geniş yuvarlama, **fiziksel** görünüm | 1px kenar, 16px yuvarlama — on kart tek bir gri duvar |
| Bölüm başlığı **tabela** | Küçük gri büyük harf etiket |
| Kırmızı nokta **nereye gideceğini söylüyor** | Alt çubukta hiçbir işaret yok |

Yapılanlar:

- **Görsel dil kalınlaştı.** Kart kenarı 2px, yuvarlama 20px, altında
  kalınlık gölgesi. Bölüm başlıkları plaka. Düğmeler büyüdü ve basılınca
  gerçekten çöküyor (`.dugme-3d`).
- **Sayılar cümleden çıktı.** Yeni `Hap` bileşeni: omurga, hedef şeridi,
  Kışla kartları ve Malikâne özeti artık rozet kullanıyor.
- **Kışla kartı 18 öğeden 8'e indi.** Rol açıklaması ve altı istatistik
  "Detay"ın altına alındı — bilgi silinmedi, öne çıkarılmadı.
- **Dört istatistik kartı tek rozet satırı oldu** (Malikâne ve Kışla).
  Kartlar ekranın yarısını kaplıyordu ve hepsi aynı ağırlıktaydı; yeni
  oyuncu "KOMUTA 0/90" ile "GÜNLÜK SALDIRI 0/12" arasında hangisinin
  önemli olduğunu ayırt edemiyordu.
- **Hedef şeridi omurgayı tekrar etmiyor.** Aynı bilgi iki ekranda farklı
  kelimelerle anlatılıyordu; şerit artık ad + rozetler + düğme.
- **Omurga ile Kışla birbirine bağlandı.** Omurga "28 Okçu eğit" diyorsa
  Kışla o kartı en üste alıyor, altın çerçeveyle işaretliyor ve adedi hazır
  getiriyor. Oyuncu sayıyı elle yazmıyor.
- **Alt çubukta altın nokta.** Omurganın işaret ettiği sekmede duruyor;
  hem kart hem çubuk aynı hesabı okuyor (`useOmurgaAdimi`), böylece ikisi
  ayrışamıyor.
