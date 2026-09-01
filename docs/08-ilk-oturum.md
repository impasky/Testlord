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

## Sıra

| # | İş | Gün | Neden bu sırada |
|---|---|---|---|
| İ3 | İlk saldırı dakikalarda bitsin | 1 | "Ne oldu şimdi"nin cevabı yoksa diğerlerinin anlatacağı sonuç da yok |
| İ1 | Eylem karşılığını önceden söylesin | 1.5 | Oyuncu neden bastığını bilmeden basıyor |
| İ2 | Sonuç öncesi/sonrası gösterilsin | 1 | İ1'in vaadinin karşılığı; ikisi bir çift |
| İ4 | Tek omurga | 1 | Yukarıdakiler yerine oturmadan omurga boş bir kutu olur |
| İ6 | 30 saniyelik amaç | 0.5 | Omurga varken anlamlı; öncesinde havada kalır |
| İ5 | Harita insanlı görünsün | 1 | Bağımsız; sona alınabilir |
| İ7 | Ölçüm | 0.5 | Son, çünkü ölçülecek şeyin var olması gerekiyor |

**Toplam ~6.5 iş günü.**

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
