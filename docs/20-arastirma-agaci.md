# 20 — Araştırma ağacı (HOI4 tarzı)

> **Tez:** Araştırma, iki lordu birbirinden ayıran tek katman olmalı.
> On beş düğümlük üç düz zincirde herkes aynı yolu yürüyordu; ayıran tek
> şey sıraydı.

## Neden yazıldı

İlk ağaç (docs/12, S4) üç dal × beş kademeydi: her düğüm bir öncekini
istiyor, her dal tek bir çizgi. Seçim yalnız "önce hangisi"ydi ve Sv 40'ta
bütün ağaç bitiyordu — lord seviyesi 60'a gidiyor ve aktif bir oyuncu oraya
110-130 günde varıyor (balance.json → `lord.hedef_tempo`). Son yirmi seviye
için araştırmada hiçbir şey yoktu.

Oyuncu Hearts of Iron 4'ün araştırma ekranını istedi. HOI4'ü HOI4 yapan beş
şey var; hepsi bu oyuna çevrildi, hiçbiri kopyalanmadı:

| HOI4                                   | Lordlar Çağı                                                             |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Sekmeler (piyade, zırh, doktrin…)      | Dört sekme: İmar, Ordu, Doktrin, Diyar                                   |
| Yıl ekseni (1936 → 1945)               | Altı **çağ**; çağ lord seviyesine bağlı                                  |
| Dallanan ağaç, oklar                   | Çoklu önkoşul; bir düğüm birkaçını açıyor, birkaçı birini açıyor         |
| Birbirini dışlayan doktrinler          | **Gruplar**: üç savaş öğretisinden biri, üç ekonomiden biri, iki yönetim |
| "Zamanından önce" cezası               | **Erken araştırma**: çağından beş seviye önce, seviye başına +%15 süre   |
| Araştırma yuvaları                     | Kütüphane binası (1–4) + iki araştırma (+1, +1)                          |
| Ekipman teknolojisi birimi güçlendirir | Birime özel saldırı/savunma (okçu, süvari…)                              |
| Doktrin taktikleri güçlendirir         | **Taktik ustalığı**: seçilen öğreti kendi taktiklerini büyütür           |

Alınmayanlar: HOI4'te doktrin seçimi kalıcı. Burada **bedelle
değiştirilebiliyor** (§5) — HOI4 tek oyunluk bir kampanya, bu oyun aylarca
oynanıyor ve yanlış bir seçimle aylarca yaşamak oyunu bıraktırır. Oyuncunun
kararı. "Araştırma bonusu" (odaklardan gelen tek seferlik hızlandırma)
alınmadı: bu oyunda odak ağacı yok ve bonusun geleceği bir kaynak
uydurmak ağaca bir sistem daha eklemek olurdu.

---

## 1. Yapı

**Sekme** (HOI4'teki sekmeler): İmar, Ordu, Doktrin, Diyar. Her sekmenin
**sütunları** var — HOI4'teki "hat"lar (piyade silahları, destek…). İmar'ın
sütunları Ambar, Üretim, Bilgi, Zanaat; bir düğümün yeri `sekme + sütun +
çağ`. Yer yalnız görünüş için: kuralı önkoşullar koyuyor.

**Çağ** (HOI4'teki yıllar): altı satır, yukarıdan aşağı.

| Çağ | Ad       | Seviye |
| --- | -------- | ------ |
| I   | Kuruluş  | 1      |
| II  | Yükseliş | 8      |
| III | Beylik   | 15     |
| IV  | Sancak   | 24     |
| V   | Devlet   | 34     |
| VI  | Cihan    | 45     |

Çağ düğümün **bedelini** belirliyor (`kademe`, eski formül aynen:
`taban × çağ^2,1`, süre `45 dk × çağ^1,8`). Kapıyı ise düğümün kendi
`lord_seviyesi` koyuyor; çağın satırındaki seviyeden erken olamaz (test).

**Önkoşul** birden fazla olabilir ve HEPSİ gerekir. Eski ağaçta önkoşul
"aynı daldaki bir önceki kademe" diye TÜRETİLİYORDU; artık her düğüm kendi
listesini taşıyor. Türetmek dallanmayı imkânsız kılıyordu.

**Grup** (dışlayan seçim): bir grubun **seçenek** düğümlerinden yalnız biri
araştırılabilir. Seçenek bir **yolun** başı; yolun geri kalan düğümleri de
o yolun parçası (Akıncı öğretisinin beş düğümü `yol: akinci`). Biri
seçilince öbür seçenekler ve yolları "kapalı" olur.

Üç grup:

- **Savaş öğretisi** (Doktrin): Akıncı · Menzil · Kale — her biri beş düğüm.
- **Ekonomi** (İmar): Bereketli Topraklar · Derin Madenler · Ticaret Yolları —
  biri seçilen kaynağın üretimini +%20 artırır. HOI4'teki "dağınık ya da
  yoğun sanayi" çatalının karşılığı; pazar (docs/19) sayesinde uzmanlaşma
  anlamlı: fazla demiri satıp eksik erzağı alabilirsin.
- **Yönetim** (Diyar): Merkezî Divan · Uç Beylikleri.

Kural: yolu olmayan hiçbir düğüm bir yola bağlanamaz (test). Yoksa yol
değiştirmek, yol dışındaki bir düğümü de askıda bırakırdı.

## 2. Süre

```
süre = 45 dk × çağ^1,8 × erken/geride çarpanı ÷ (1 + araştırma hızı)
```

**Erken araştırma** (HOI4'ün "ahead of time penalty"si): düğüm, kapısından
en çok **5 seviye önce** başlatılabilir; her seviye için süre **+%15**.
Sv 40'taki bir lord Sv 45'lik Cihan düğümünü %75 uzun sürede araştırabilir.
Kapı kalkmıyor, yumuşuyor: acelesi olan bedelini zamanla öder.

**Geride kalma**: lord düğümün kapısını **5 seviyeden fazla** geçmişse her
fazla seviye için süre **−%3**, en çok **−%30**. Geç başlayan ya da seviye
atlayan oyuncu eski çağları hızla kapatır; yeni çağdaki kararlar yine
yavaş ve ağır kalır.

**Araştırma hızı**: Kâtipler +%10, Rasathane +%15.

Ön izlemede görünen süre ile kuyruktaki süre AYNI fonksiyondan geliyor
(`arastirmaSuresiSn`); oyuncuya "5sa" deyip 6 saat sürdürmemek için.

## 3. Yuvalar

HOI4'teki araştırma yuvaları zaten vardı: Kütüphane binası (docs/12 §Y3)
seviyesine göre 1-4 yuva. Üstüne iki araştırma: **Medrese** (Çağ III) ve
**Beytülhikme** (Çağ VI), +1'er. En çok 6. Yuva sayısı tek yerde:
`esZamanliLimit('research', binalar, arastirma)`; hem kuyruk motoru hem ekran
oradan okuyor.

## 4. Etkiler

Eski on beş etki aynen duruyor. Yeniler:

| Etki                          | Nereye bağlı                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `arastirma_hizi`              | Araştırma süresi                                            |
| `arastirma_yuvasi`            | Eş zamanlı araştırma                                        |
| `bina_hizi`                   | Bina yükseltme süresi (Şehir)                               |
| `altin_/demir_/erzak_geliri`  | Saatlik gelirin o kaynağı (malikâne + bölgeler)             |
| `<birim>_saldiri`, `_savunma` | Savaş motoru; generallerin birime özel bonusuyla TOPLANIYOR |
| `taktik_<key>`                | Taktik ustalığı: taktiğin artıları ×(1+x), eksileri ×(1−x)  |

**Taktik ustalığı neden eksileri de hafifletiyor:** taktiklerin kozları
küresel tavana (`taktik.azami_etki`, %30) zaten yakın — Ok Yağmuru'nun ilk
tur saldırısı %28. Yalnız artıları büyütmek tavana çarpıp boşa giderdi.
Ustalık hem kozu büyütüyor hem bedelini küçültüyor; tavan yine en son
uygulanıyor, yani ustalık tavanı delemiyor.

Birime özel bonuslar generallerle aynı adları kullanıyor (`okcu_saldiri`
Okçubaşı Elif'te de var) ve aynı yere, toplanarak giriyor: iki kaynak
çarpılsaydı general ve araştırma birlikte beklenenden fazla büyürdü.

### Toplamlar (bir öğreti, bir ekonomi, bir yönetim seçilmiş en dolu lord)

| Etki                 | Eski  | Yeni (azami) |
| -------------------- | ----- | ------------ |
| Ordu saldırısı       | +%8   | +%11 … +%17  |
| Ordu savunması       | +%8   | +%11 … +%24  |
| Birim başına saldırı | —     | ~+%20 … +%41 |
| Tahkimat             | +%15  | +%25 … +%53  |
| Yürüyüş hızı         | +%20  | +%28 … +%40  |
| Depo                 | +%100 | +%130        |
| Araştırma hızı       | —     | +%25         |
| Yuva                 | 1-4   | 1-6          |

Aralıklar öğretiye göre: Kale savunmayı ve tahkimatı, Akıncı yürüyüşü ve
süvariyi, Menzil okçuyu ve kuşatmayı büyütüyor. Her etkinin azami toplamı
`balance.json → arastirma.etki_tavani` içinde yazılı ve bir test ağacın bu
tavanları aşmadığını doğruluyor: yeni bir düğüm eklenip denge sessizce
kaymasın.

## 5. Yol değiştirme

Oyuncunun seçimi: **bedelle değişir**.

- Bir grupta seçili yol **bırakılabilir**. O yolun bütün tamamlanmış
  düğümleri silinir, etkileri gider.
- Silinen düğümlerin kaynak bedelinin **yarısı geri verilir**, yarısı yanar.
  Harcanan ZAMAN geri gelmez — asıl bedel o.
- Aynı grup **3 günde bir** değiştirilebilir. Bekleme olmasaydı oyuncu her
  savaştan önce öğreti değiştirirdi ve seçim bir ayara dönerdi.
- O yolun bir düğümü araştırılırken bırakılamaz; önce araştırma bitmeli ya
  da iptal edilmeli (iptal zaten yarısını iade ediyor).
- Bırakınca aynı grubun başka bir seçeneği hemen başlatılabilir; yeni yol
  baştan araştırılır.

Bekleme `Lord.arastirmaDegisim` alanında (grup → son değişim anı) tutuluyor.
İade depoyu aşarsa fazlası pazar kasasına değil, tavana kırpılarak
yazılıyor — iptal iadesiyle aynı kural.

## 6. Göç

Eski on beş düğümün **anahtarı, etkisi ve kapısı aynı**. Tamamlanmış
araştırmalar olduğu gibi geçerli. Bazılarının önkoşulu değişti (Lonca
Düzeni artık Taş Ocakları'nı da istiyor); tamamlanmış bir düğümün önkoşulu
geriye dönük sorulmuyor. Süren bir araştırmanın anahtarı da geçerli.

Hiçbir eski düğüm bir gruba girmedi: göçte kimse "seçmediği bir yolu
seçmiş" olamaz.

Şemaya tek sütun eklendi: `Lord.arastirmaDegisim` (JSONB, boş olabilir;
grup → son bırakma anı). Boş değer "hiç bırakmadı" demek, yani mevcut
lordlar için doldurulacak bir şey yok (`20260923091427_arastirma_yol_degisim`).

## 7. Arayüz

Telefon genişliğinde HOI4 ekranı (`apps/web/src/screens/Arastirma.tsx`):

- **Yuva çubuğu** üstte, ilerleme çubuğuyla aynı kartta: yuvalar yan
  yana ÇİP. Süren çip adı, kalan süreyi ve alt kenarında `startedAt` →
  `finishAt` ilerlemesini taşıyor; dokununca düğümün sayfası açılıyor ve
  İptal orada. Boş yuva kesikli çip. Altında tek satır: yuvaların kaynağı
  ("kütüphaneden N, araştırmadan M") ve nereden artar.
- **Sekmeler** altında: İmar · Ordu · Doktrin · Diyar; her sekmede o an
  başlatılabilir düğüm sayısı. Varsayılan sekme süren araştırmanınki,
  yoksa ilk açık düğümünki.
- **Tuval**: solda çağ oluğu (I-VI ve seviye kapısı), üstte sütun (hat)
  başlıkları, onların da üstünde lejant. Düğümler 72 px'lik kutular;
  aralarında SVG çizgiler.
  Çizgi üç türlü: ebeveyn tamamlandıysa dolu altın, ebeveyn açıksa ya da
  sürüyorsa soluk, kilitliyse kesikli. Çocuğun ucunda küçük bir nokta
  yönü söylüyor.
- **Çağ atlayan çizgiler** aradaki bir kutunun ARKASINDAN geçmesin diye
  üç rotadan ilki boş olanı seçiliyor: ebeveynin sütunundan in, çocuğun
  sütunundan in, ya da iki kutunun arasındaki sınır çizgisinden in.
  Arkadan geçen çizgi olmayan bir zincir okuturdu ("Lonca → Ticaret
  Yolları → Mimar Ocağı").
- **"Yalnız biri"**: bir grubun seçenekleri aynı çağda yan yana; kırmızı
  kesikli bir çerçevenin içinde ve köşesinde "yalnız biri" yazıyor.
  (Önce seçenekler arasına kesikli bir bağ düşünülmüştü; kutular arası 6
  piksellik boşlukta görünmüyordu.)
- **Lordun çağı** vurgulu: satır boyu hafif altın şerit, oluktaki rakam
  altın ve altında "şimdi". HOI4'teki "bugünün yılı" çizgisi.
- **Seviyesi yetmeyen çağ** (erken araştırma penceresinin de ötesinde,
  o satırda hiçbir kutu başlatılamaz): satır taralı, oluğunda kilit.
  Yalnız görünüş; hangi kutunun açık olduğunu yine sunucu söylüyor.
- **Etki rozeti** her kutunun altında: simge + sayı (kalkan "+%10", sancak "+40").
  Birim etkisinde birimin simgesi, köşesinde küçük kılıç ya da kalkan.
  Kutu yalnız İLK etkiyi taşıyor; hepsi detay sayfasında. Eşleme
  `components/arastirmaRozeti.ts` içinde ve bir test her düğümün bir
  rozeti olduğunu, simgesinin ikon setinde bulunduğunu denetliyor —
  yeni bir etki anahtarı eklenip eşlemesi unutulursa test düşüyor.
- Düğüme dokununca **alttan detay** (sabit yükseklik — kısa içerikte
  Başlat alt çubuğun hizasına, rehber ışığının güvenli şeridinin dışına
  düşerdi): etkiler, bedel ve süre (erken/geride notuyla), grup uyarısı,
  Başlat, önkoşullar (tik ya da kilit), açıklama.
- Bir grubun seçeneğini başlatmak **iki dokunuş**: ilki "Bu yolu seç",
  uyarı kırmızılaşıyor ("Bunu seçersen Menzil ve Kale kapanır…, %50,
  3 gün"), ikincisi "Eminim — … seçilsin".
- Grubu olan sekmede ağacın ALTINDA **seçim kartı**: grubun adı, tek
  cümle açıklaması, seçili yol, "Yolu bırak" ya da beklemenin kalan
  süresi. Ağacın üstündeyken ilk ekranı kaplıyordu; seçenekleri zaten
  ağaçtaki kırmızı çerçeve gösteriyor. Kapalı bir yolun düğümünden de aynı
  bırakma sayfasına kısayol var: oyuncu kapalı yolu tam o düğümde merak
  ediyor.
- **Bırakma sayfası** silinecek düğümleri, geri gelecek kaynağı ve
  bekleme süresini sayıyla söylüyor. İade depo tavanını aşacaksa uyarı
  çıkıyor: taşan kısım bir sonraki hesapta kırpılıyor (iptalle aynı
  kural) ve oyuncu bunu SONRA değil ŞİMDİ öğrenmeli.

Durum dili:

| Hâl            | Kutu                              | Köşe simgesi            | Rozet |
| -------------- | --------------------------------- | ----------------------- | ----- |
| tamamlandı     | yeşil zemin                       | tik                     | yeşil |
| sürüyor        | altın kenar, alt kenarda ilerleme | kum saati               | altın |
| başlatılabilir | KALIN altın kenar + parıltı       | yanıp sönen altın nokta | altın |
| erken          | başlatılabilir gibi               | turuncu kum saati       | altın |
| kilitli        | koyu zemin, ince kenar            | kilit                   | soluk |
| kapalı         | kesikli kırmızı kenar             | çarpı                   | sönük |

"Başlatılabilir" ile "kilitli" eskiden yalnız kenar tonuyla ayrılıyordu
(ikisi de koyu zemin, ikisi de ince kenar) ve ekran görüntüsünde ayırt
edilmiyordu; oyuncunun şimdi yapabileceği tek şey başlatılabilir kutu,
en çok o bağırmalı. Opaklık YOK — denetim opak metni kontrast hatası
sayıyor.

Kutu adları telefonda ~60 piksele sığmıyor ("Değirmenler",
"Mühendisliği"). Tarayıcının `hyphens: auto`'su Türkçe sözlük taşımıyor
ve kelimeyi harfin ortasından tiresiz kesiyordu; adlar hece sınırlarına
yumuşak tire alıyor (`heceTireli`, `components/ekler.ts`), satır
uçlarında en az üç harf kalacak şekilde.

Rehber ışığı (docs/08) iki adımlı: önce açık sekmedeki ilk açık düğümün
kutusu (`arastirma-dugum`), detay açılınca Başlat (`arastirma-baslat`).

## 8. Ölçüm

`/api/olcum` → `arastirma`:

- `ortancaBiten`: lordların tamamladığı düğüm sayısının ortancası.
- `gruplar.<grup>.yollar`: her yolu seçen (tamamlamış) lord sayısı.
- `gruplar.<grup>.enCokSecilenPayi`: en çok seçilen yolun seçenler
  içindeki payı. Üç yollu grupta 1/3 kusursuz denge; 1'e yaklaşıyorsa
  bir öğreti herkesi topluyor ve denge bozuk demektir.
- `gruplar.<grup>.son7GunDegistiren`: son 7 günde o seçimi bırakan lord
  sayısı. `arastirmaDegisim` grup başına yalnız SON anı tuttuğu için bir
  haftada iki kez bırakan bir kez sayılıyor; alanın adı "değişim" değil
  "değiştiren".

`tools/olcum-testi.mjs` sayıların ARTTIĞINI sınıyor: seçen lord yolun
sayısını, bırakan lord değiştiren sayısını bir artırmalı.

## 9. Düğümler

Tam liste `data/arastirma.json` içinde; sayılar orada, kurallar
`packages/shared/src/arastirma.ts` içinde. Özet:

| Sekme   | Düğüm | Eski | Grup                   |
| ------- | ----- | ---- | ---------------------- |
| İmar    | 16    | 5    | Ekonomi (3 seçenek)    |
| Ordu    | 17    | 5    | —                      |
| Doktrin | 16    | 0    | Savaş öğretisi (3 × 5) |
| Diyar   | 11    | 5    | Yönetim (2 seçenek)    |

Toplam 60; bir lordun araştırabileceği en fazla 47.
