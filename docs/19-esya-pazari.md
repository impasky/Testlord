# 19 — Eşya pazarı

> **Tez:** Dövme zarının attığı fazla eşya demirhanede birkaç altına
> gidiyordu. Başka bir lordun tam da onu aradığı hâlde.

## Neden yazıldı

Ekipman şansa bağlı: T5 dövmede kadim yüzde 4, efsanevi yüzde 14. Aradığı
nadirliği bulamayan oyuncu tekrar tekrar dövüyor, bulamadıklarını
demirhaneye güç × 4 altına satıyordu — bir T3 nadir kalkan 384 altın,
dövme bedeli 8.000. Aynı diyarda o kalkanı arayan biri olabilirdi; ikisini
buluşturan bir yol yoktu.

Model Black Desert Online'ın merkezî pazarı: oyuncular birbirini görmüyor,
emir veriyor; fiyat serbest değil, bir tabanın etrafında dar bir bantta.
Araştırma ve senaryo analizi (taban güncelleme kuralları, kayıt kuyruğu
ölçütleri) sohbette yapıldı; buradaki kararlar onun sonucu.

`docs/00`'ın kapsam listesinde "oyuncular arası ticaret, pazar yeri" v1
dışıydı. Oyuncunun açık isteğiyle kapsama alındı — dar hâliyle: yalnız
eşya, diyar içi, anonim, açık artırma yok.

---

## 1. Ne alınıp satılıyor

**Ürün** = yuva + kademe + nadirlik + yükseltme seviyesi.
`T3 Nadir Kalkan +2` bir ürün; kalkan arayana kılıç satılamaz.

**Fiyat grubu** = kademe + nadirlik + yükseltme. Yuva fiyatı etkilemiyor
(altı yuva aynı güçte), bu yüzden altı yuva aynı tabanı paylaşıyor.
İşlemler altı ayrı deftere bölünse küçük bir diyarda taban hiç
kıpırdamazdı.

Yalnız ekipman. Kaynak ve elmas pazarda yok: kaynağın kendi takası var
(Malikâne, komisyonlu), elmas ise satın alınmıyor ve güç satmıyor.

## 2. Fiyat

### Basamaklar

Fiyat altın olarak değil **basamak** olarak tutuluyor: `fiyat(k) = 1,01^k`.
Taban da bir basamak. Taban bir adım oynayınca bütün emirler yine bir
basamakta duruyor — defter "103, 104,6, 105" gibi yarım fiyatlara
bölünmüyor, iki fiyatı karşılaştırmak tam sayı karşılaştırması.

### Formül değeri

Eşyayı **elde etmenin** ortalama bedeli, altın karşılığı (demir 2 altın):

1. **Dövme:** kademenin üretim bedeli × (nadirlik çarpanı ÷ o kademenin
   ortalama çarpanı). Değer güce bağlı. Kıtlığa bağlasaydık (kadim yüzde
   4 → 25 kat) T1 efsanevi T3 sıradandan pahalı olurdu, daha zayıf olduğu
   hâlde. Kıtlığın fiyatını pazar kendisi buluyor.
2. **Yükseltme:** +N'ye kadar harcanan malzeme ÷ başarı ihtimali.

| Ürün        | +0      | +3      | +6      |
| ----------- | ------- | ------- | ------- |
| T1 Sıradan  | 702     | 5.656   | 24.099  |
| T1 Efsanevi | 1.474   | 6.428   | 24.871  |
| T3 Nadir    | 9.884   | 35.619  | 131.448 |
| T5 Sıradan  | 47.555  | 102.924 | 309.118 |
| T5 Kadim    | 133.155 | 188.524 | 394.718 |

Formül değeri ilk tabanı koyuyor ve uzun süre işlem görmeyen ürünün
döndüğü yer (çapa, §4). Fiyatı belirleyen o değil, işlemler.

### Bant ve sert sınırlar

- **Bant:** emir tabanın 7 basamak altı ile 7 basamak üstü arasında
  (yaklaşık ±%7). Dar bant fiyat sıçramasını, şişirilmiş fiyatla altın
  taşımayı ve tek bir oyuncunun defteri boşaltıp fiyatı birden yıkmasını
  engelliyor.
- **Üst sınır:** formül değerinin 3 katı. Kıtlık fiyatı yukarı itebilsin
  ama bir ürün sonsuza uçmasın.
- **Alt sınır:** NPC satış değeri (güç × 4), 100 altından az değil. Oraya
  düşen eşyayı pazarda satmanın anlamı yok, demirhane aynı parayı veriyor.
  Formülün bir kesri değil: T1 +10'a harcanan malzeme onu T5 sıradandan
  değerli yapmıyor, pazar gerçek değerini bulabilmeli. 100 altının altında
  yüzde 1 bir altından küçük ve iki komşu basamak aynı fiyata
  yuvarlanıyordu.

## 3. Eşleşme

| Gelen emir   | Karşısı                                              | İşlem fiyatı         |
| ------------ | ---------------------------------------------------- | -------------------- |
| İlan (satış) | En yüksek ön sipariş (fiyatı ≥ ilan)                 | **Siparişin** fiyatı |
| Ön sipariş   | En ucuz ilan (fiyatı ≤ sipariş), kayıt kuyruğu hariç | **İlanın** fiyatı    |

Bekleyen taraf fiyatı koymuştu; gelen taraf hiçbir zaman yazdığından
kötüsünü almıyor. Eşit fiyatta **ilk gelen** kazanıyor. Tek istisna
bandın tavanı: orada fiyat daha fazla yükselemediği için sıra bir yarışa
dönüyor ve kazananı **kura** seçiyor.

Bant dışına düşmüş emir eşleşmiyor (§4). Kendi emrinle eşleşme yok; aynı
ürünü hem satıp hem almak da yasak.

## 4. Taban nasıl kayıyor

Senaryo analizindeki dört kuralın en iyisi (D): işlem + saatlik baskı.

1. **Kenar işlemi:** bandın tavanında gerçekleşen işlem tabanı bir basamak
   yükseltiyor ("bu fiyata da alıcı var"), dibindeki düşürüyor. Ortadaki
   işlem fiyatın doğru yerde olduğunu söylüyor, dokunmuyor.
2. **Saatlik baskı:** bantta hiç ilan yokken tabanın üstünde en az bir
   saattir bekleyen bir ön sipariş tabanı bir basamak yükseltiyor; tersi
   düşürüyor. İki taraf da doluysa (makas) baskı yok. Bir saat şartı,
   fiyatını durmadan değiştirerek tabanı sürükleyen emri saymamak için.
   Bant dışındaki emir sayılmıyor.
3. **Çapa:** üç gün işlem görmeyen ürünün tabanı günde bir basamak formül
   değerine dönüyor. Ölü bir defterde bir kez yanlış yere gitmiş fiyat
   başka türlü hiç düzelmezdi.

Simülasyonda (değer %50 sıçradıktan sonra) kural D günde 50 işlemde 2,
günde 10 işlemde 6,5 günde yeni değere ulaştı; alıcıların %79'u eşyasını
aldı. Günde 2 işlemde hiçbir kural yetişemiyor — küçük diyarda fiyat
yavaş kayar, bu bilinen bir sınır (§14).

**Bant dışı emir silinmiyor.** Taban kayınca dışarıda kalan emrin sahibi
bir kez haber alıyor ve fiyatını tek dokunuşla bandın en yakın kenarına
alabiliyor. Taban geri dönerse o emirle bu arada verilmiş bir karşı emir
birbirine yetişmiş olabilir; her taban değişiminden sonra **defter
süpürmesi** onları eşleştiriyor (fiyat: önce verilmiş olanınki).

## 5. Emanet ve Pazar kasası

- **Ön sipariş:** altın verildiği anda düşülüyor. İptalde kesintisiz geri.
- **İlan:** eşya satıcının kaydında kalıyor ama iş göremiyor —
  envanterde görünmüyor, kuşanılamıyor, yükseltilemiyor, demirhaneye
  satılamıyor. Yükseltmesi süren eşya ilana konamıyor.
- **Pazar kasası:** satıştan gelen ve iptalden dönen altın önce kasaya
  giriyor. Doğrudan depoya yazılsaydı dolu depoda sessizce silinirdi —
  pazar takasının düzeltilen hatasının aynısı (docs/18). Oyuncu yer açınca
  "Depoya al"; ön sipariş verirken de **önce kasadan** ödeniyor.
- **Emanet tavanı:** bekleyen ön siparişlerdeki toplam altın depo tavanını
  aşamaz. Tavansız olsaydı ön sipariş sınırsız bir kasa olurdu: depoyu
  taşıracak altını siparişe bağla, işin bitince geri çek.

## 6. Kayıt kuyruğu

Efsanevi ve kadim (her kademede) ya da formül değeri 100.000'i geçen eşya
ilana girince hemen satılmıyor, **10 dakika** kuyrukta bekliyor. Süre
bitince uygun ön siparişlerin **en yüksek fiyatlıları arasından kura**
çekiliyor. Kimse yoksa ilan sıradan bir ilana dönüşüyor.

Kuyruk olmasa değerli eşyayı her seferinde en hızlı dokunan — ya da ilan
açıldığı anda sipariş veren bir bot — alırdı. Kuyruktaki ilan geri
çekilemiyor ve fiyatı değiştirilemiyor: satıcı kaç alıcının beklediğini
görüp çekebilseydi kura bir pazarlık aracına dönerdi.

## 7. Vergi

Satıcının eline geçenden **%20** (satıcıya kalan aşağı yuvarlanıyor).
Alıcı liste fiyatını ödüyor. Vergi olmasa aynı iki oyuncu eşyayı birbirine satıp tabanı
bedavaya kaydırabilirdi.

Pazar binası vergiyi düşürmüyor: binalar kapasite verir, oran vermez
(`binalar._ilke`, docs/12 §4). Bina pazarın kapısı.

## 8. Sınırlar

| Sınır                       | Değer                              |
| --------------------------- | ---------------------------------- |
| Aynı anda ilan / ön sipariş | 5 / 5                              |
| Günde yeni emir             | 20 (fiyat güncellemesi sayılmıyor) |
| Aynı ürüne aynı lordun emri | 1                                  |
| Alım                        | Seviyenin açtığı kademe            |
| Emir süresi                 | Dolmuyor                           |
| E-posta doğrulaması         | Gerekli (ilan ve ön sipariş)       |

**Kademe kapısı alımda, kuşanmada değil.** Görüşmede kuşanmanın seviyeye
bağlanması konuşulmuştu; yapılmadı, çünkü akın bilerek dövme kapısının
üstünde eşya veriyor (20. seviye haritası T5 düşürebiliyor) ve kuşanmayı
kapatmak oyuncunun bugün kullandığı ganimeti elinden almak olurdu. Pazar
ise dövülebilenden fazlasını açmıyor: T4 için 36. seviye.

**Doğrulama:** pazar başka oyuncuya dokunan bir eylem — satılan eşyanın ve
ödenen altının karşısında başka biri var (docs/17). İptal, geri çekme ve
kasadan alma doğrulama istemiyor: kimse kendi altınına kilitli kalmıyor.

## 9. Güvenlik: kilit sırası

Bir pazar işlemi iki lorda dokunuyor. Tek lordu kilitleyen `lordIslemi`
yetmiyor; iki lordu "önce ben, sonra karşı taraf" sırasıyla kilitlemek
kilitlenmeye açık (A ilan açarken B sipariş verirse ikisi birbirini bekler).

> **Kural.** Pazar işlemi önce **grubun fiyat satırını** (`grupKilitle`),
> sonra işleme girecek lordları **kimlik sırasıyla** (`lordlariKilitle`)
> kilitler. Önce plan (kim kiminle), sonra kilit, sonra doğrulama ve
> yazma. Lord kilidi hiçbir zaman grup kilidinden önce alınmaz; bir
> işlemin içinde ikinci grup kilitlenmez — defter süpürmesi ayrı işlem.

Aynı gruptaki bütün defter değişiklikleri (ilan, sipariş, iptal, eşleşme,
taban) grup kilidi arkasında sıraya giriyor. İptal de dahil: kilitsiz bir
iptal, eşleşmenin okuduğu siparişi silip eşyayı parasız teslim ettirebilirdi.

Ölçüldü (`tools/esya-pazari-testi.mjs`): tek siparişlik altınla on
eşzamanlı sipariş → biri geçti; aynı eşyayla on eşzamanlı ilan → tek ilan;
tek ilana iki eşzamanlı alıcı → biri aldı, öteki bekliyor, altın kuruşu
kuruşuna tutuyor; altı tur çapraz ilan-sipariş (iki grup, iki lord, ters
sıra) → 12/12 takas, sıfır sunucu hatası.

## 10. Birleşme ve hesap silme

- **Diyar birleşmesi:** konuk diyarın pazarı kapanıyor. İlandaki eşya
  envantere, siparişteki altın kasaya dönüyor; iki diyarın fiyatlarını
  birleştirmek hiçbir işlemin görmediği bir taban uydurmak olurdu. İşlem
  geçmişi ev sahibine taşınıyor.
- **Hesap silme:** emirler lordla birlikte gidiyor. İşlem geçmişi kalıyor
  (taraflar düz kimlik), fiyat geçmişi bozulmasın.

## 11. Ekran

Şehirdeki **Pazar binası** artık Malikâne'yi değil kendi kapısını açıyor:
Al · Sat · Emirlerim · Takas. Bina köyde açıldığı için kamptaki lordun
yolu Malikâne'deki "Eşya pazarı" bağlantısı. Kaynak takası iki yerde de
duruyor.

- **Al:** satıştaki ürünler (en ucuz fiyat, adet) ve ürün seçici.
- **Sat:** kuşanılmamış eşyalar; alıcısı bekleyenlerde "N alıcı bekliyor".
- **Ürün defteri:** bantın on beş basamağı, her birinde kaç satan kaç alan
  — kimin olduğu yok. Satıra dokunmak fiyatı seçiyor; düğme sonucu önceden
  söylüyor: "Hemen al — 903 altın", "İlana koy", "Kayıt kuyruğuna koy",
  kasana ne kadar düşeceği.
- **Emirlerim:** bekliyor / kayıt kuyruğu (geri sayım) / bant dışı
  ("Banda al" tek dokunuş).
- **Kasa:** her sekmenin üstünde; "Depoya al".

Satış ve alım karşı tarafa bildirim olarak gidiyor (karşı taraf çoğu
zaman oyunda değil). İşlemi yapan oyuncuya bildirim gitmiyor — sonucu
ekranında görüyor.

## 12. Görüşmeden sapmalar

| Konuşulan                         | Yapılan             | Neden                                                                                                |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Yükseltme bandı (+0–5, +6, … +10) | Tam seviye          | +0→+5 T5'te dövme bedelinin iki katı; +5'i +0 fiyatına satmak emek verilmiş eşyayı pazardan silerdi. |
| Pazar binası vergiyi düşürsün     | Düz %20             | Binalar kapasite verir, oran vermez (`binalar._ilke`); binanın tek etkisi zaten takas tavanı.        |
| Kuşanma seviyeye bağlansın        | Alım seviyeye bağlı | Akın bilerek üst kademe veriyor; kuşanmayı kapatmak var olan ganimeti geri almak olurdu.             |

## 13. Ölçüm

`/api/olcum` → `esyaPazari`: açık ilan ve sipariş, emanetteki ve
kasadaki altın, son 24 saat / 7 gün işlem, kura, vergi, tüccar sayısı ve
**en sık satıcı-alıcı çiftinin payı**. Pazar anonim ve eşleşmeyi kural
yapıyor; aynı çiftin işlemlerin büyük payını tutması kendiliğinden olmaz —
altın taşımanın izi o.

## 14. Kalan riskler

| Risk                                              | Neden kabul / ne izleniyor                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| İnce defter: fiyat yavaş kayar                    | 240 kişilik diyarda çoğu ürün günde birkaç işlem görecek. Simülasyon bunu gösterdi; bant ve çapa yüzünden fiyat en azından formül değerinin yakınında kalıyor.                              |
| Kasa bir banka olabilir                           | Kasa yağmalanmıyor ve depo tavanına bağlı değil; ama yalnız satışla ve iptalle doluyor, emanet de depo tavanıyla sınırlı. `kasadakiAltin` izleniyor.                                        |
| Çok hesapla altın taşıma                          | Bant ve %20 vergi taşımayı pahalı ve sınırlı kılıyor; eşleşme karşı tarafı seçtirmiyor. `enSikCiftPayi` izleniyor.                                                                          |
| Yüksek seviyeli T5 eşya alınamayacak kadar pahalı | T5 sıradan +8'in formül değeri 846.000; en büyük depo (60. seviye, 5. seviye malikâne, ambarlar) ~574.000. Alıcı yoksa baskı tabanı indiriyor, ama ancak satıcı ilanını yeniden fiyatlarsa. |
| Savaş çözümü iki lordu sırasız kilitlerse         | Pazar kimlik sırasıyla kilitliyor; başka bir yol ters sırayla kilitlerse Postgres kilitlenmeyi yakalar ve işlemlerden birini geri alır (hata, veri kaybı değil).                            |

## Kod nerede

| Konu                                   | Dosya                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Kural (bant, eşleşme, taban, engeller) | `packages/shared/src/esyaPazari.ts` (+ birim testi)                      |
| Kilit, takas, süpürme, işçi işleri     | `apps/api/src/services/esyaPazari.ts`                                    |
| Uçlar                                  | `apps/api/src/routes/esyaPazari.ts`                                      |
| Pazardaki eşyanın kilidi               | `apps/api/src/routes/items.ts`                                           |
| Şema                                   | `EsyaFiyati`, `EsyaIlani`, `OnSiparis`, `EsyaIslemi`, `Lord.pazarKasasi` |
| Ekran                                  | `apps/web/src/screens/EsyaPazari.tsx`                                    |
| Sayılar                                | `data/balance.json → esya_pazari`                                        |
| Test                                   | `tools/esya-pazari-testi.mjs` (e2e zincirinde)                           |
