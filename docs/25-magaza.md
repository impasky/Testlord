# 25 — Mağaza: zaman satılır, güç satılmaz (P2S)

Elmas paketi satışı (Google Play Faturalandırma) ve ödüllü reklam (AdMob).
İkisi de yalnız **Android uygulamasında** (`apps/mobil`, Capacitor); web
sürümünde Mağaza yalnız bilgi gösteriyor.

## 0. Karar

Oyunun sahibi 2026-10-16'da mağazayı **pay-to-skip** olarak istedi: ödeme
Google Play Faturalandırma, reklam AdMob. Bu, `docs/09` §3.1 ve §5.1'deki
"zaman atlatma satılmaz" kuralını değiştiriyor. Yeni kural:

> **Güç satılmaz. Yalnız kendi gelişim işlerinin ZAMANI satılır.**
> Oyuncular arası hiçbir yürüyüş hızlanmaz; kaynak, asker, kalkan,
> ekipman satılmaz.

Dürüst değerlendirme: zaman satmak dolaylı bir güçtür — erken biten
araştırma erken gelen güç demek. Frenler bunun için var:

1. **Kaynak satılmıyor.** Her işin bedeli (altın, odun, taş…) yine
   oynayarak kazanılıyor. Elmas yalnız bekleyişi siliyor; kaynağı yetmeyen
   oyuncu elmasla bir şey başlatamıyor.
2. **Saldırı, dönüş, takviye, keşif ve sevkiyat hızlanmıyor.** Başka bir
   lorda değen her şey beklenerek oluyor. `validateBalance` bu türleri
   `magaza.hizlandirilabilir` listesinde görürse oyunu açmıyor.
3. **Elmas oynayarak da geliyor** (günlük görev, şef kampı, başarım) ve
   reklam herkese bedava süre veriyor.
4. **Elmas pazarda yok** (`docs/19`): satın alınan elmas ekipmana
   dönüşemiyor.

## 1. Kurallar ve sayılar

Hepsi `data/balance.json` → `magaza` ve `elmas.kuyruk_hizlandirma`
altında; saf mantık `packages/shared/src/magaza.ts`.

### 1.1 Hızlandırma

Hızlanabilen işler: `bina`, `research`, `train`, `craft`, `upgrade_item`,
`upgrade_gear`, `upgrade_region`. Yaralı iyileştirme ve akın beklemesi
kendi düğmelerini ve tarifelerini koruyor (`elmas.ts`).

Fiyat **sunucuda** hesaplanıyor; istemcinin gösterdiği fiyata bakılmıyor:

    bedel = max(asgari, ceil(katsayi × kalan_dakika ^ us))   (1, 0.8, 1)

| Kalan | 1 dk | 10 dk | 30 dk | 1 sa | 3 sa | 8 sa | 1 gün | 3 gün |
| ----- | ---- | ----- | ----- | ---- | ---- | ---- | ----- | ----- |
| Elmas | 1    | 7     | 16    | 27   | 64   | 140  | 337   | 810   |

Üs 1'den küçük: doğrusal fiyatla bir günlük bekleyiş binlerce elmas
ederdi ve satın alınamayan bir ürün hiç satılmayan bir üründür. Elmasla
iş **tamamen** bitiyor; hızlanan iş beklenerek bitenle aynı yoldan
(`gecikmisIsleriCoz`) çözülüyor.

### 1.2 Paketler

| Ürün kimliği (Play) | Ad            | Elmas | Ek  | Toplam |
| ------------------- | ------------- | ----- | --- | ------ |
| `elmas_100`         | Avuç Elmas    | 100   | 0   | 100    |
| `elmas_550`         | Elmas Kesesi  | 500   | 50  | 550    |
| `elmas_1200`        | Elmas Sandığı | 1000  | 200 | 1200   |
| `elmas_2600`        | Hazine        | 2000  | 600 | 2600   |

**Fiyat burada değil**, Play Console'da (yerel para, vergi dahil).
Sunucu yalnız ürün → elmas eşlemesini biliyor.

### 1.3 Ödüllü reklam

| Ayar                 | Değer | Neden                                          |
| -------------------- | ----- | ---------------------------------------------- |
| `odul_dakika`        | 15    | Ödül ELMAS DEĞİL, süre                         |
| `gunluk_tavan`       | 5     | Günde 75 dk: bekleyişin küçük bir parçası      |
| `bekleme_sn`         | 90    | Art arda reklam ya hata ya kötüye kullanım     |
| `banka_tavan_dakika` | 120   | Biriken süre tavanı                            |
| `oturum_omru_dk`     | 60    | Bundan eski oturuma gelen ödül yok sayılıyor   |
| `kisisellestirilmis` | false | Kişiselleştirilmemiş reklam (npa)              |
| `saklama_gun`        | 30    | Reklam oturumları bu kadar gün sonra siliniyor |

Ödül elmas değil çünkü (a) Google ödüllü reklamın ödülünün parasal bir
değeri olmamasını istiyor ve elmas parayla satılıyor, (b) reklamla elmas
biriktirmek satışı anlamsızlaştırırdı.

Bir işin yanındaki **Hızlandır**'dan izlenen reklam süresini o işe
veriyor; iş o arada bittiyse ya da ödül kalandan büyükse artan süre
**bankaya** gidiyor ve sonra herhangi bir işte kullanılıyor. Mağazadan
izlenen reklam doğrudan bankaya.

## 2. Akışlar

### 2.1 Elmasla ya da bankadan hızlandırma

`POST /api/kuyruk/:id/hizlandir {yontem: 'elmas' | 'banka'}` — lord
kilidi altında: iş hâlâ hızlandırılabilir mi, bedel, düşüm, kuyruğun
`finishAt`'i. Hatalar: `KUYRUK_YOK` 404, `HIZLANDIRILAMAZ`, `BEKLEME_YOK`,
`YETERSIZ_ELMAS`, `BANKA_BOS`.

### 2.2 Google Play satın alma

1. Uygulama `GET /api/magaza` → `play.acik`, `play.hesapEtiketi`.
   Etiket = `HMAC(JWT_SECRET'ten türetilmiş anahtar, lordId)`'nin ilk 40
   onaltılık hanesi: geri çevrilemez, e-posta ya da ad içermiyor.
2. Uygulama Play'i açar (`@capgo/native-purchases`): tek seferlik ürün,
   `appAccountToken = etiket`, **otomatik onay kapalı**.
3. Uygulama jetonu yollar: `POST /api/magaza/play/dogrula {urun, jeton}`.
4. Sunucu (`services/satinAlma.ts`):
   - `purchases.products.get` → `purchaseState` 0 değilse: 2 ise
     `bekliyor` (ödeme sürüyor), diğerleri `SATIN_ALMA_IPTAL`.
   - `obfuscatedExternalAccountId` etikete eşit değilse `BASKA_HESAP` 403.
   - `consumptionState` 1 ise `TUKETILMIS`.
   - Elmas **önce** veriliyor (işlem içinde, `jeton` benzersiz; aynı anda
     gelen iki istekten biri `P2002`'ye düşüp ilkinin sonucunu okuyor),
     **sonra** `:consume`. Tüketme başarısızsa worker 10 dakikada bir
     yeniden deniyor — onaylanmayan satın almayı Play üç gün sonra iade
     ediyor, o yüzden bu adım atlanamaz.
5. Yarım kalan ya da bekleyen ödeme (`bekliyor`): uygulama her açılışta
   ve Mağaza her açıldığında Play'in cihazda kalan satın almalarını
   yeniden doğrulatıyor (`lib/yarimSatinAlma.ts`); ödeme tamamlanınca
   elmas geliyor. Yalnız Mağaza'ya bırakılmadı: o sürede Mağaza'ya
   girmeyen oyuncunun satın alması üç gün sonra iade olurdu.
6. **İade:** worker `voidedpurchases` listesini son 7 gün için okuyor;
   iade edilen satın almanın elması düşülüyor. Elmas harcanmışsa bakiye
   **eksiye** iniyor; sonra kazanılan elmas önce açığı kapatıyor. Bu
   bilinçli: aksi hâlde "al, harca, iade et" bedava elmas olurdu.

Test satın almaları (`purchaseType` 0, lisans test hesapları) `test`
işaretiyle kaydediliyor.

### 2.3 Ödüllü reklam

1. `POST /api/reklam/oturum {hedefKuyrukId?}` — tavan (`REKLAM_TAVAN` 429) ve bekleme (`REKLAM_BEKLE` 429) burada; hedef iş şimdi geçerli
   olmalı. Dönen: `oturumId`, `kullanici` (etiket).
2. Uygulama UMP onayını (gerekiyorsa) alır, reklamı
   `ssv: {userId: etiket, customData: oturumId}` ile gösterir.
3. Google sunucumuzu imzalı çağırır: `GET /api/reklam/ssv?…&signature=…&key_id=…`.
   Kimlik istemiyor; kimlik imza (`services/admob.ts`):
   - İmzalanan içerik `&signature=`'dan önceki kısım, yüzde kodlaması
     çözülmüş; imza base64url DER ECDSA P-256 / SHA-256.
   - Anahtarlar `https://www.gstatic.com/admob/reward/verifier-keys.json`
     (12 saat önbellek; bilinmeyen `key_id` gelince en sık dakikada bir
     yeniden).
   - Anahtar sunucusuna ulaşılamazsa 503 (Google yeniden dener); imza
     tutmazsa 400.
4. `ssvIsle`: birim bizim mi, oturum var mı ve `bekliyor` mu, ömrü geçmiş
   mi, `user_id` oturumun lordunun etiketi mi; `transaction_id` benzersiz.
   Ödül koşullu yazımla bir kez veriliyor; Google'a her durumda 200.
5. Uygulama `GET /api/reklam/oturum/:id`'yi yokluyor (en çok 30 sn).

## 3. Güvenlik özeti

| Saldırı                                   | Engel                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| İstemci fiyatı ya da miktarı uydurur      | Fiyat ve miktar sunucuda; istemci yalnız ürün kimliği |
| Aynı jetonu iki kez yollar (aynı anda)    | `jeton` benzersiz; ikinci yazım `P2002` → `zaten`     |
| Başkasının jetonunu kendi hesabına yollar | `obfuscatedExternalAccountId` ≠ etiket → 403          |
| Elmas harcar, iade ister                  | İade düşülüyor, bakiye eksiye inebiliyor              |
| "İzledim" der ama izlemez                 | Ödülü yalnız Google'ın imzalı çağrısı veriyor         |
| Google çağrısını tekrar oynatır           | `transaction_id` benzersiz, oturum koşullu            |
| Başkasının oturum kimliğini kullanır      | `user_id` oturumun lordunun etiketi olmalı            |
| Eski bir oturumu sonradan ödüllendirir    | `oturum_omru_dk`                                      |
| Bozuk servis hesabı oyunu düşürür         | Okunamazsa satın alma kapalı; yayın kontrolü söylüyor |

Geliştirmede (`NODE_ENV ≠ production`) Play API'si ve SSV imzacısı yerel
taklit (`routes/devMagaza.ts`, `key_id=gelistirme`): uçtan uca test gerçek
kod yolunu koşuyor. Üretimde adresler sabit Google adresleri; taklit
yüklenmiyor (`tools/uretim-korumalari-testi.mjs`).

## 4. Kurulum — hesap sahibinin işi

### 4.1 Play Console

1. Uygulamayı oluştur. Paket adı **`com.lordlarcagi.oyun`** — ilk
   yüklemeden sonra **değişmez**. Başka bir ad istiyorsan ilk yüklemeden
   önce `apps/mobil/capacitor.config.json`, `android/app/build.gradle`
   (`namespace`, `applicationId`) ve Java paket dizinini birlikte değiştir.
2. Ödeme profilini (satıcı hesabı) bağla; ücretli ürün onsuz açılmıyor.
3. Önce bir **dahili test** derlemesi yükle (Play, faturalandırma izni
   taşıyan bir derleme görmeden ürün açtırmıyor).
4. Para kazanma → Uygulama içi ürünler: §1.2'deki dört kimlikle tek
   seferlik ürün aç ve fiyatlarını gir.
5. Ayarlar → Lisans testi: kendi Google hesabını ekle (gerçek para
   çekilmeden test satın alması).

### 4.2 Servis hesabı (sunucunun Play'e sorması için)

1. Google Cloud'da bir proje aç, **Google Play Android Developer API**'yi
   etkinleştir.
2. Bir servis hesabı oluştur, **JSON anahtarını** indir.
3. Play Console → Kullanıcılar ve izinler → servis hesabının e-postasını
   davet et. İzinler: **Finansal verileri görüntüleme** (Purchases API
   bunu istiyor) ve **Siparişleri ve abonelikleri yönetme** (iade
   listesi ve tüketme için). Yönetici (Admin) verme. İznin işlemesi
   saatler sürebilir.
4. Sunucu ayarlarında (DigitalOcean: uygulama → Settings → Environment
   Variables): `PLAY_PAKET_ADI=com.lordlarcagi.oyun`,
   `PLAY_SERVIS_HESABI=<JSON ya da base64 JSON>`. **Anahtarı depoya ya da
   bir sohbete yapıştırma.**

### 4.3 AdMob

1. AdMob'da Android uygulamasını ekle. Uygulama kimliği
   (`ca-app-pub-…~…`) derlemede `ADMOB_UYGULAMA_KIMLIGI`.
2. Bir **ödüllü** reklam birimi aç. Ödül miktarını ne yazarsan yaz sunucu
   `balance.json`'u kullanıyor; tutarlı olsun diye "15 dakika" yaz.
   Birimin **sunucu tarafı doğrulama** adresine
   `https://<alan adın>/api/reklam/ssv` gir ve "Doğrula"ya bas.
3. Sunucu ayarlarında: `ADMOB_ODUL_BIRIMI=ca-app-pub-…/…`,
   `ADMOB_YAYINCI_KIMLIGI=pub-…` (aynı hesaptan; yayın kontrolü
   uyuşmazlığı yakalıyor).
4. **app-ads.txt:** sunucu `/app-ads.txt`'yi kendisi yayımlıyor. Play
   listesindeki geliştirici web sitesi oyunun alan adı olmalı (AdMob
   dosyayı o alan adının kökünde arıyor; doğrulama bir gün sürebilir).
5. Gizlilik ve mesajlaşma → **GDPR onay mesajı** oluştur ve yayımla.
   Uygulama UMP ile ilk reklamdan önce onu gösteriyor; oyuncu kararını
   Hesap → "Reklam gizlilik seçenekleri"nden değiştiriyor.
6. Kendi reklamına tıklama: AdMob hesabı kapatılabilir. Denemeyi
   geliştirme derlemesiyle (Google'ın test birimi) ya da cihazını test
   cihazı olarak ekleyip yap.

### 4.4 Android derlemesi

**Bilgisayarsız (önerilen):** GitHub Actions → "Android yayın paketi" →
Run workflow (`.github/workflows/android-yayin.yml`). Gizli değişkenler,
yükleme anahtarının bir kez üretilmesi ve Play'e yükleme: `docs/26` §5.
Sürüm kodu koşu numarasından kendiliğinden artıyor.

**Kendi bilgisayarında:**

```sh
OYUN_ADRESI=https://alan.adin node apps/mobil/derle.mjs   # arayüz + cap sync
cd apps/mobil/android
SURUM_KODU=1 SURUM_ADI=1.0.0 \
ADMOB_UYGULAMA_KIMLIGI=ca-app-pub-…~… \
IMZA_DOSYASI=/yol/yukleme.jks IMZA_PAROLASI=… IMZA_TAKMA_ADI=… IMZA_ANAHTAR_PAROLASI=… \
./gradlew bundleRelease          # → app/build/outputs/bundle/release/app-release.aab
```

- Sürüm derlemesi `ADMOB_UYGULAMA_KIMLIGI` ya da imza olmadan **durur**:
  test reklam kimliğiyle ya da imzasız bir paket sessizce çıkmasın.
- **Play Uygulama İmzalama** kullan; yükleme anahtarını yedekle.
  `SURUM_KODU` her yüklemede bir artmalı.
- CI'daki `android` işi her gönderimde hata ayıklama APK'sı derliyor ve
  yapıt olarak bırakıyor (cihaza kurup denemek için). Aynı iş sürüm
  derlemesinin ayarsız durduğunu ve tek kullanımlık bir anahtarla imzalı
  AAB çıktığını da sınıyor.
- Play Console formlarının (mağaza girişi, veri güvenliği, içerik
  derecelendirmesi, ürünler) hazır cevapları: `docs/26`.

**Play'siz: telefona doğrudan kurulan APK.** Arkadaşlarla denemek için
GitHub Actions → "Android APK (indir, kur, oyna)" → Run workflow →
sunucunun adresini yaz (`.github/workflows/android-apk.yml`). APK deponun
Releases sayfasına sabit bir bağlantıyla konuyor:

```text
https://github.com/<sahip>/<depo>/releases/download/deneme-apk/lordlar-cagi-deneme.apk
```

- Derleme türü `deneme` (build.gradle): paket adı `com.lordlarcagi.oyun.deneme`,
  adı "Lordlar Çağı (Deneme)" — Play sürümüyle aynı telefonda yan yana
  duruyor. Hata ayıklanamıyor; reklamlar Google'ın test reklamları.
- Sunucu adresi APK'nın içine gömülüyor; sunucu değişince yeni APK gerekir.
  Settings → Variables'ta `OYUN_ADRESI` varsa girdi boş bırakılabiliyor ve
  daldaki her arayüz değişikliğinde APK kendiliğinden yenileniyor.
- `IMZA_*` gizlileri varsa APK yükleme anahtarıyla imzalı ve her yeni sürüm
  eskisinin üstüne kuruluyor. Yoksa her derleme yeni bir geçici anahtar
  alıyor: yeni APK'dan önce eskisi kaldırılmalı (oyun verisi sunucuda).
- **Elmas satın alma bu APK'da çalışmaz**: Google Play Faturalandırma yalnız
  Play'den kurulan uygulamada açılıyor.
- CI'daki `android` işi her gönderimde `assembleDeneme`i de derleyip imzayı,
  paket adını ve hata ayıklanamadığını denetliyor.

### 4.5 Yayın kontrolü

Yönetici panosu ve `pnpm yayin-kontrolu`: `PLAY_SERVIS_HESABI` (kapalı /
yarım / bozuk / açık) ve `ADMOB_*` (kapalı / app-ads.txt yok / yayıncı
uyuşmuyor / açık). Mağaza isteğe bağlı: hiç girilmemişse yalnız uyarı.

### 4.6 Elle denenecek

1. Lisans test hesabıyla bir paket al → elmas geliyor; Mağaza'da
   "Satın almaların"da görünüyor.
2. Play Console → Siparişler → o siparişi iade et → en geç 10 dakika
   sonra elmas düşüyor.
3. Ödemeyi "yavaş kart" ile başlat (bekleyen ödeme) → uygulama
   "Ödeme bekleniyor" diyor, ödeme tamamlanınca elmas geliyor.
4. Bir işin yanında "Reklam izle" → reklam biter → iş 15 dk kısalıyor.
5. AB'den bir test cihazıyla (ya da UMP hata ayıklama coğrafyasıyla) onay
   formu çıkıyor.

## 5. Neden böyle

- **v1 `purchases.products`**, v2 değil: alanları belgede tam ve kararlı;
  değişirse yalnız `services/play.ts` değişir.
- **SDK yok.** Google kütüphanesi üç HTTP çağrısı için 60 MB; JWT RS256
  ve jeton alma 40 satır.
- **Önce elmas, sonra tüketme.** Tersi, tüketme ile veritabanı yazımı
  arasında bir çöküşte oyuncuya parasını ödediği elması vermezdi; böylesi
  en kötü ihtimalle tüketmeyi geciktiriyor (worker tamamlıyor).
- **Kişiselleştirilmemiş reklam.** Gelir daha düşük ama reklam kimliğiyle
  profil çıkarılmıyor; KVKK/GDPR riski en az. Açmak gizlilik metnini ve
  onay akışını da değiştirmeyi gerektirir.
- **Web'de satış yok.** Play'deki uygulama ödeme için uygulama dışına
  yönlendiremiyor; web için ayrı bir ödeme sağlayıcısı başka bir iş ve
  aynı elmasın iki fiyatı olurdu.

## 6. Testler

- `packages/shared/src/magaza.test.ts` — fiyat eğrisi, reklam hakkı,
  ödülün kuyruk/banka bölüşümü.
- `packages/shared/src/yayin.test.ts` — Play/AdMob yayın kontrolü.
- `apps/api/src/services/admob.test.ts` — SSV ayrıştırma ve imza.
- `tools/magaza-testi.mjs` (e2e) — elmasla hızlandırma; Play: tekrar,
  eşzamanlı, başka hesap, bekleyen, iptal, yanlış ürün, tüketme hatası +
  worker, Play kesintisi 503, iade → eksi bakiye; reklam: kuyruğa ödül,
  tekrar, bekleme, bozuk imza, başka etiket, banka, günlük tavan;
  app-ads.txt; tarayıcıda Hızlandır penceresi ve Mağaza.

## 7. Kaynaklar

- [purchases.products.get](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get) ·
  [consume](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/consume) ·
  [voidedpurchases.list](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases/list)
- [Play Console izinleri](https://support.google.com/googleplay/android-developer/answer/9844686)
- [AdMob ödüllü reklam SSV](https://developers.google.com/admob/android/ssv)
- [AdMob Play veri beyanı](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [app-ads.txt](https://support.google.com/admob/answer/9363762)
- [@capgo/native-purchases](https://github.com/Cap-go/capacitor-native-purchases) ·
  [@capacitor-community/admob](https://github.com/capacitor-community/admob)
