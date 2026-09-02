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

---

## İ9 — Harita bir yer olsun

Oyuncu: *"harita çok kötü, neyin ne olduğu anlaşılmıyor; bir zemin üstüne
oturtulmuş olsa daha iyi olur; şu an bir dikdörtgende sağa sola gidiyormuşum
gibi ham hissettiriyor."*

Haklıydı. Önceki hâl boşlukta duran düz renkli altıgenlerden oluşan bir
ızgaraydı — bir tablo, bir yer değil.

- **Zemin var.** Altıgenler denizin üstünde bir kara parçası oluşturuyor;
  kıyı şeridi ve deniz gerçekten çiziliyor. Harita artık bir dikdörtgen
  değil, kenarları olan bir ada. (Teknik: genişletilmiş altıgenler üst üste
  binerek tek bir kütle veriyor; kıyı ve kara iki katman hâlinde çizilince
  aradaki fark sahil şeridi bırakıyor.)
- **Arazi görselle anlatılıyor.** Her altıgen kendi bölge illüstrasyonuyla
  dolduruluyor. Görsel 2,6 kat yakınlaştırılıp ortasından kırpılıyor: 512
  piksellik bir sahne 41 piksellik altıgende okunmuyor, okunan şey doku —
  buğday başağı, kaya, kiremit.
- **Bölgelerin adı var.** İsimsiz altıgenler "neyin ne olduğu anlaşılmıyor"
  duygusunun doğrudan sebebiydi. Tip ikonu da geri geldi: küçük ölçekte
  "burası maden mi tarla mı" sorusuna cevap veren şey doku değil siluet.
- **Seviye yalnızca yükseltilmişse yazılıyor.** 61 altıgende "Sv1" görmek
  haritayı yine bir sayı duvarına çeviriyordu.

---

## İ10 — Bölge bir yer olsun

Oyuncu: *"bir bölge ele geçirdiğimde neden orayı yönetip yükseltmeler yapıp
şehri ya da tarlayı geliştiremiyorum, neden ele geçirdiğim bölgede değilim
diye düşündürtüyor."*

İki ayrı şey vardı burada ve ikisini de dürüstçe ayırmak gerekiyor:

**Yönetip geliştirmek zaten mümkündü.** Bölge seviyesi 1–5, maliyeti, süresi
ve gelir etkisi baştan beri motorda. Ama arayüz oyuncuya *"Seviye 2'ye
yükselt"* diyordu — bir tabloda satır artırmak gibi. Bir yeri geliştirmek, o
yerin **ad değiştirmesiyle** hissedilir:

- `balance.json` → `bolgeler.gelisim_adlari`: her bölge tipine beş aşama adı.
  Kasaba → Pazar Şehri → Ticaret Şehri → Büyük Şehir → Diyarın Başkenti.
  Taş Ocağı → Demir Madeni → Derin Ocak → Cevher Yatağı → Kadim Damar.
- Geliştirme kartı artık aşama geçişini ve gelir farkını gösteriyor:
  *"KASABA → PAZAR ŞEHRİ · Saatlik altın 200 → 250 (+50)"*, düğmesi
  *"Pazar Şehri yap"*.

**"Orada değilim" duygusu bir sunum sorunuydu.** İllüstrasyon vardı ama
başlığın üstünde bir dekor şeridiydi. Şimdi bölgenin adı ve aşaması
görselin ÜSTÜNE biniyor: illüstrasyon bölgenin portresi oluyor. Geliştirme
kartı da en üste alındı — oyuncunun oraya gelme sebebi o.

**Yapılmayan:** bölgeye ayrı ayrı bina dikmek (ambar, sur, kışla) yeni bir
sistem; bu turda yapılmadı. Var olan tek eksen — bölge aşaması — dürüstçe
adlandırıldı ve görünür kılındı.

---

## İ11 — Görsel katman: tek bir üretim hattı

Oyuncu: *"elimde bu tarz kullanabileceğin görseller var, ayrıca bana bu
oyunda kullanmak için gereken tüm görsellerin promptlarını ver — t1 silah,
t2 silah, t5 sancak, t3 kalkan gibi. Görsel olarak güçlendirip bakalım."*

İ8'de yapılan şey biçimdi (rakamları hapa aldık), İ9–İ10'da yerdi (harita
ada oldu, bölge portre kazandı). Geriye kalan tek eksik, o yerleri dolduran
görsellerin **kendisi**. Bu bölüm iki iş yapıyor: istem listesini üretmek ve
kodu o dosyaları bekleyecek hâle getirmek.

### İstemler tek kaynaktan üretilir

`tools/gorsel-uret.py` içinde artık iki katman var:

- **`TABAN_USLUP`** — her görselde aynı: palet, ışık, render, "no text /
  no border". Tutarlılık buradan gelir.
- **`KATEGORI[...]['kompozisyon']`** — kategoriye göre değişir. Bir kılıç
  ikonuyla bir ekran zemini aynı çerçeveyi paylaşamaz: biri düz koyu zeminde
  ortalanmış tek nesne, diğeri alt üçte biri arayüze bırakılmış geniş manzara.

Toplam **72 görsel**: 5 birim, 12 general, 13 bölge sahnesi (5 taban + 8
gelişim aşaması), 30 ekipman, 6 harita karosu, 6 ekran zemini.

Ekipmanın 30'u tek tek yazılmıyor: 4 metal yuva (silah/kalkan/zırh/miğfer)
ortak bir tier merdiveniyle çarpılıyor, at ve sancak kendi merdivenlerini
kullanıyor. Sebebi bakım: "T3 kalkan neden T4 miğferden gösterişli" gibi
tutarsızlıklar merdiven tek yerde durduğu sürece oluşmuyor.

**Nadirlik için ayrı görsel yok.** Sıradan/usta/nadir/efsanevi/kadim ayrımı
arayüzde çerçeve ve renkle yapılıyor; tek görsel değişkeni tier. Aksi hâlde
30 değil 150 görsel gerekirdi ve aradaki fark ekranda okunmazdı.

`docs/GORSEL-ISTEMLERI.md` bu tanımlardan **üretilir**, elle yazılmaz:

```bash
python3 tools/gorsel-uret.py --istemler > docs/GORSEL-ISTEMLERI.md
```

`docs/GORSEL-REHBERI.md` içindeki elle yazılmış eski istem tablosu silindi ve
üretilen dosyaya bağlandı. İki kopya tutmanın tek sonucu, üslup değiştiğinde
birinin eskimesi olurdu.

### Kod dosyaları bekliyor

Yeni bir görsel eklemek hâlâ kod değişikliği gerektirmiyor — dosyayı doğru
adla klasöre koymak yetiyor. Bu turda bekleyen yerler eklendi:

- **`zeminler/*.webp` → `Zemin`.** Malikâne, Kışla, Demirhane, Generaller ve
  Sıralama ekranlarının tepesinde tam genişlikte bir manzara şeridi; alt
  kenarı sayfaya eritiliyor, ekranın adı ve tek satırlık "burası neresi"
  cümlesi üstüne biniyor. Giriş ekranında ise `TamZemin`: şerit değil, tüm
  ekranı kaplayan manzara — orada arayüz sadece ortadaki tek kart.
  Görsel yoksa hiçbir şey çizilmiyor, ekran bugünkü haliyle kalıyor.
- **`bolgeler/<tip>_3|_5.webp` → `bolgeGorselAdi()`.** Bölge afişi artık
  seviyeye göre görsel seçiyor: 1–2 taban, 3–4 `_3`, 5 `_5`. Aşama görseli
  yoksa tabana düşüyor. Geliştirmenin karşılığını **görünür** kılan tek şey
  bu: "Kasabam Pazar Şehri oldu" cümlesinin bir resmi olmalı.
- **`harita/<tip>.webp` → hex dolgusu.** Karolar bölge sahnelerinden ayrı:
  sahneler üç çeyrek açıdan bakan tablolar, karolar tam tepeden bakan arazi
  dokuları. Sahneyi karo olarak kullanmak haritayı bulanık bir kolaja
  çeviriyordu; şimdi karo varsa o, yoksa sahne, o da yoksa düz renk.
- **`ekipman/<yuva>_t<tier>.webp` → Demirhane kartları.** Yoksa nadirlik
  rengiyle boyanmış bir `T{tier}` rozeti kalıyor.

### Öncelik

`docs/GORSEL-ISTEMLERI.md` başında bir sıra var ve keyfi değil:

1. **Ekran zeminleri (6)** — oyunun gösterge paneli değil bir yer gibi
   hissetmesi en çok buna bağlı.
2. **Ekipman (30)** — Demirhane şu an tamamen sayıdan ibaret.
3. **Harita karoları (6)** — haritanın okunurluğu.
4. **Bölge aşamaları (8)** — geliştirmenin görünmesi.

Altısı geldiğinde oyunun beş ekranı birden değişir; otuz ekipman görseli
gelmeden de oyun tutarlı çalışmaya devam eder.

### Altı ekran zemini geldi — ve iki hata çıkardı

Oyuncu istemleri kullanıp altı zemini üretip gönderdi. Görseller yerine
konunca iki hata ortaya çıktı; ikisi de görselsiz hâlde görünmüyordu.

**1. Giriş zemini hiç görünmedi.** `TamZemin` görseli `-z-10` ile arkaya
atıyordu. Boyama sırasında negatif z katmanı kök öğenin arka planının
üstünde ama `body`nin arka planının ALTINDA kalıyor; `styles.css` `body`ye
de opak bir zemin verdiği için görsel tamamen örtülüyordu. `z-0` konumlanmış
öğeleri blok arka planlarından sonra boyatıyor — karşılığı içeriğin
`relative z-10` olması.

**2. Başlıkla afiş arasında karanlık bir bant.** `--ust-bar` elle yazılmış
bir sabitti: 108px. Ölçülen başlık yüksekliği 87px. Yani her ekranın
tepesinde 21px ölü boşluk vardı ve kimse fark etmemişti — kartlarda nefes
payı gibi duruyor, manzara şeridi gelince afişi havada asılı bırakan bir
bant oluyordu.

Sabiti düzeltmek yerine ölçtürdük: `MobilKabuk` başlığa bir `ResizeObserver`
takıp `--ust-bar`ı gerçek yükseklikten yazıyor. Tahmin etmekten ayrıca
sağlam — uzun lord adı, sistem yazı tipi büyütmesi ya da çentik dolgusu
başlığı büyütürse içerik altına kaymıyor. `styles.css`teki değer artık
sadece ilk karenin başlangıcı. (`--alt-bar` tersine kaynak: gezinme
çubuğunun yüksekliği ondan geliyor, ölçülmüyor.)

**Filigran.** Üretim aracı işaretini köşeye yapıştırmıyor, kenardan bir
tutam içeride bırakıyor; `filigran-sil.py`'nin köşe kutusu onu ancak yarım
yakalıyordu. Araca `--kutu sol,ust,sag,alt` eklendi. `tools/gorsel-koy.py`
adımları (işaret temizliği → orana kırpma → WebP) tek yerde topluyor ve
kırpma/kayıt kısmını `gorsel-uret.py`den ödünç alıyor, kopyalamıyor:
kategori boyutu değişirse elle eklenen görseller de uyar.

**Açık kalan:** Demirhane zemini diğer beşten farklı bir üslupta geldi —
ötekiler çizgi konturlu, o daha fotoğrafımsı. Tek başına iyi ama sette
yamalı duruyor. Aynı istemle yeniden üretilirse set tamamlanır.

### Ekipman görselleri: zemin ayıklama

Ekipman, zeminlerden farklı bir sorun getiriyor. Birim ve general
görselleri arayüzde çerçeveli birer **portre**; koyu düz zemin orada doğru
duruyor ve hepsi aynı oturumda üretildiği için aynı zemini paylaşıyorlar.

Ekipman öyle değil: envanterde otuz ikon **yan yana** diziliyor ve her biri
ayrı üretiliyor. Üretici her seferinde biraz başka bir zemin veriyor —
biri yeşilimsi, biri neredeyse siyah, biri sıcak kahve. Otuz kutucukta bu
yamalı bir ızgara olarak göze batıyor. Zemin ayıklanınca arayüzün kendi
oyuğu görünüyor ve otuzu da aynı kutuda duruyor.

`tools/gorsel-koy.py`, `zemin-ekle.py`nin yerini aldı: aynı ardışık düzen,
ama kategori parametresiyle. İkinci bir neredeyse-aynı script yazmak,
kırpma/kayıt/filigran mantığının iki kopyasını tutmak demekti.

**Eşik ölçülüyor, verilmiyor.** İlk hâli sabit bir eşik kullanıyordu (38) ve
kötü biçimde başarısız oldu: zemininden 9 birim uzaktaki koyu bir ağız da
"zemine yakın" sayılıyor, gerçek zemine bitişik olduğu için aynı bağlı
bileşene giriyor ve kılıcın tamamı siliniyordu — kenara bağlılık şartı bu
durumda korumuyor. Şimdi eşik görüntünün dış çerçevesinden ölçülüyor:
orası tanımı gereği zemin, oradaki uzaklıkların dağılımı zeminin ne kadar
dalgalı olduğunu doğrudan söylüyor.

Yayılım ölçüsü 99. yüzdelik değil **75.**: konu kenara değiyorsa (kabza,
topuz) çerçeveye birkaç parlak piksel karışıyor ve yüksek yüzdelik onlarla
birlikte tavana zıplayıp eşiği anlamsızca genişletiyor.

**Güvenlik freni:** silinen alan %93'ü aşarsa ayıklama başarısız sayılıyor
ve görsel olduğu gibi bırakılıyor. Bir envanter ikonunda konu görüntünün
anlamlı bir kısmını kaplar; sessizce boş bir görsel yazmaktansa zemini
korumak doğru. Beş sentetik durumla sınandı — düz zemin, konunun kenara
taştığı zemin, vinyetli zemin, gürültülü zemin ve ayıklanması imkânsız
olan (ağız zeminle aynı tonda) durum.

### Duruş kuralı: istem söylemiyorsa üretici karar veriyor

İlk ekipman turunda aynı istemden kimi dikey kimi çapraz kılıç geldi.
Sebep istemin kendisiydi: `three-quarter view` **bakış açısını** söylüyor
ama karedeki **yönelimi** söylemiyor. Tek bir görselde fark etmez; otuz
ikon envanterde yan yana dizildiği için ızgarada göze batıyor.

Duruş artık kategori kompozisyonunda açıkça yazılı ve kural iki kollu,
çünkü tek kollusu olmuyor: kılıç ve sancak gibi uzun nesnelerde çapraz
kareyi köşeden köşeye dolduruyor, miğfer ve kalkan gibi toplu nesnelerde
çapraz sadece eğri durur. Yuva tarifindeki `blade pointing up` kaldırıldı —
iki yerden duruş söylemek, ikisinin çelişmesi demekti.

Zemin tarifi de sıkılaştırıldı: `no gradient, no vignette, no texture` ve
`crisp silhouette separation`. Bu doğrudan `gorsel-koy.py`nin zemin
ayıklamasına hizmet ediyor — orası zemini tek renk olarak modelliyor ve
dalgalı bir zeminin uzak ucu eşiğin dışında kalıyor. Zemin yine de KOYU
isteniyor: ayıklama başarısız olup fren devreye girerse geriye kalan
zeminin arayüzle uyumlu olması gerekiyor.

### Gölge yasağı ve teslim yolu

Üçüncü kılıç turunda duruş kuralı tuttu: beşi de çapraz, beşinin zemini de
düz koyu geldi. Kalan tek pürüz zemine düşen **gölge** oldu.

Gölge süs değil, ayıklama için özel bir sorun: nesneye BİTİŞİK bir zemin
parçası. Ayıklama ya onu da siler ve nesnenin altı oyulur, ya da bırakır ve
saydam ikonun altında koyu bir leke kalır. İkisi de yanlış; kaynakta hiç
olmaması doğru. İsteme `no cast shadow falling on the background` eklendi.

**Teslim yolu değişti.** Sohbete eklenen görseller üç turdur diske
yazılmıyor — görüntü görünüyor, dosya yok. Aynı sohbette altı ekran zemini
sorunsuz inmişti, yani dosya türü ya da boyutla ilgili değil. Kalan ~60
görsel için `docs/GORSEL-TESLIM.md`: ham görseller `gorsel-gelen` adlı
geçici bir dala yükleniyor, Claude oradan alıyor, işlenmiş WebP'ler
çalışma dalına giriyor. Ham dosyalar çalışma dalının geçmişine hiç
girmiyor — 72 görsellik bir set ~100 MB eder ve silmek geçmişten
temizlemiyor.

### Kuşanılan ekipman da bir vitrin olsun

Oyuncu: *"oyuncunun kendi kısmında ekipmanlar görünmüyor."* Haklıydı:
illüstrasyonu Demirhane'nin envanter kartlarına bağlamıştım, Lord
ekranındaki kuşanma yuvalarına değil. Envanterde gördüğün kılıcı
kuşanınca kaybediyordun.

Bu, ilk oturum şikâyetinin tam da kalbindeki nokta: *"gücümü en yüksek
olanı kuşan dedim, gücüm arttı, eee ne oldu şimdi."* Sayının arttığını
görmek, bir şey kuşandığını görmekle aynı şey değil. Yuva artık bir
vitrin: illüstrasyon kareyi dolduruyor, nadirlik rengi üst şeritte, yuva
adı ve tier alttaki şeritte görselin üstüne biniyor.

Şerit görselin ALTINDA ayrı bir satır değil ÜSTÜNE binen bir bant: kare
zaten küçük (üç sütun, telefonda ~115px) ve altına ayrı satır koymak
illüstrasyona kalan yeri yarıya indiriyordu.

### Filigran silmenin doğru yolu, zemin ayıklamaya bağlı

Atlarda ilk geçiş ikonun köşesinde küçük lekeler bıraktı. Sebep, iki
temizliğin birbirini bozmasıydı:

`filigran-sil.py` kutuyu **komşu şeridin aynasıyla** yamalıyor. O şerit
zemin değilse — atın kuyruğu, gölgesi, T5'in nalından çıkan kıvılcım —
aynalanan içerik zemin renginde olmuyor, ve zemin ayıklama onu *koruyor*.
Ölçüldü: T1'de 156, T4'te 105 opak piksel kalmıştı.

Zemin ayıklanacaksa doğru işlem yamalamak değil, kutuyu **çevresindeki
zemin rengiyle doldurmak**: o zaman kutu zeminin bir parçası oluyor ve
ayıklamayla birlikte tamamen gidiyor. `gorsel-koy.py` artık buna kendisi
karar veriyor; ayna, zemin ayıklanmayan kategoriler (ekran zeminleri)
için doğru olan yöntem olarak duruyor.

Zırh ve miğferde bu sorun çıkmamıştı çünkü onların işaretinin çevresi düz
zemindi — ayna zemin taşımıştı. Yani hata sessizdi ve ancak komşuluk
değişince göründü. Yeniden tarandılar, ikisi de temiz.

### Otuz ikon aynı boyda olsun

Otuz ekipman görseli tamamlanınca ızgarada bir tutarsızlık göründü:
konunun kareyi doldurma oranı %79 ile %96 arasında oynuyordu. Tek başına
bakınca fark edilmiyor ama envanterde alt alta dizilince bazı eşyalar
diğerlerinden küçük duruyor — oyuncuya nadirlik ya da tier farkıymış gibi
gelen, aslında sadece üreticinin kadrajından gelen bir fark.

Zemin ayıklandıktan sonra alfa elde olduğu için bu ölçülebilir bir şey:
`gorsel-koy.py` artık saydam payları atıp konuyu kareye oturtuyor ve
doldurma oranını %94'e sabitliyor. Kutu **kare** olarak büyütülüyor,
konunun kendi oranı korunuyor — ince bir sancağı kareye germek onu
bozardı.

Kırpma zemin ayıklamaya bağlı, çünkü alfası olmayan bir görselde
sınırlayıcı kutu tüm kare olur ve işlem hiçbir şey yapmaz.
