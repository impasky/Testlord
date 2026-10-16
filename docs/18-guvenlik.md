# 18 — Güvenlik denetimi

## Neden yazıldı

Oyun yayına yaklaşırken bütün API baştan sona denetlendi: kimlik, yetki,
girdi doğrulama, eşzamanlı istekler, gizli bilgi, bağımlılıklar. En ağır
bulgu ölçülerek doğrulandı ve kapatıldı; her düzeltmenin bir testi var.

Bu belge iki şey için duruyor: yeni kod yazarken uyulması gereken
**kurallar** (aşağıda "Kural" başlıklı yerler) ve bilerek kabul edilmiş
**kalan riskler**.

## 1. Çift harcama — KRİTİK, kapatıldı

**Ne oluyordu.** İşlemler lordu okuyup kaynağı kontrol ediyor, sonra
düşüyordu; arada kilit yoktu. Postgres'in varsayılan yalıtımında (READ
COMMITTED) aynı anda gelen iki istek aynı eski bakiyeyi okuyor ve ikisi de
"yetiyor" diyordu. Üstüne `tickLord` bakiyeyi MUTLAK değer olarak geri
yazıyordu; geç kalan işlem öncekinin düşümünü eziyordu.

**Ölçüm** (aynı anda on istek, kaynak yalnız birine yetiyor):

| Yol                                      | Önce                | Sonra      |
| ---------------------------------------- | ------------------- | ---------- |
| Eğitim                                   | 4/10 geçti          | 1/10       |
| Pazar takası                             | 9/10 geçti          | 1/10       |
| Stat puanı                               | 9/10, puan **−200** | 1/10, 0    |
| Harcamayla aynı anda gelen `/me` okuması | harcamayı geri aldı | bozulmuyor |

Aynı kalıp elması, günlük hakları (ittifak bağışı), kuyruk sınırını ve
ordu birimlerini de açıyordu: yoktan kaynak, bedava asker, sınırsız stat.

**Çözüm: satır kilidi** (`apps/api/src/services/kilit.ts`). İşlem lordun
satırını `SELECT … FOR UPDATE` ile kilitleyerek başlıyor; ikinci işlem
birincisi bitene kadar bekliyor ve sonra taze bakiyeyi okuyor. Kilit yalnız
AYNI lordun işlemlerini sıraya diziyor.

`Serializable` yalıtım da kapatırdı ama çakışan işlemi öldürerek; her uca
yeniden deneme döngüsü gerekirdi. Kilit bekletiyor, öldürmüyor — eşzamanlı
25 istekte bile sunucu hatası sıfır.

> **Kural.** Bir lordun kaynağına, ordusuna ya da sayaçlarına dokunan her
> işlem `lordIslemi(lordId, async (tx) => …)` ile açılır, çıplak
> `prisma.$transaction` ile değil. Kilit işlemin İLK adımı olmalı: kilitten
> önce yapılan bir okuma ("bugün kaç bağış yaptım") eski veriyi görür ve
> sınırı aşmaya açık kalır.
>
> **Kural.** Kilitli bir işlemin içinde `tx` yerine global `prisma` ile
> AYNI lorda yazılmaz: işlem kendi kilidini bekler ve beş saniyelik zaman
> aşımına kadar takılı kalır.
>
> **Kural.** Birden çok lordun paylaştığı bir satır (medeniyet çekirdeği
> gibi) mutlak değerle yazılıyorsa o satır da kilitlenir
> (`routes/medeniyet.ts` bağış ucundaki örnek).

`tickLord` kendini kilitliyor: işlem verilirse onun içinde, verilmezse kendi
kısa işlemini açarak. Kilitsiz bir `/me` okuması da harcamayı ezebiliyordu.

> **Kural.** İKİ lorda dokunan işlem (eşya pazarı) lordları **kimlik
> sırasıyla** kilitler (`lordlariKilitle`), "önce ben, sonra karşı taraf"
> diye değil — yoksa A ile B aynı anda birbirine satarken ikisi birbirini
> bekler. Pazarda bundan da önce grubun fiyat satırı kilitleniyor; ayrıntı
> ve eşzamanlılık ölçümleri [`docs/19 §9`](19-esya-pazari.md).

Test: `tools/yaris-testi.mjs` (e2e zincirinde). Düzeltme geri alınınca dört
kontrolü kalıyor — test açığı gerçekten görüyor.

## 2. Kimlik

**Parola değişince eski oturumlar ölüyor.** Jeton yedi gün geçerliydi ve
geri alınamıyordu: parolası çalınan oyuncu parolasını sıfırlasa bile
saldırgan yedi gün içeride kalıyordu. Artık her jeton `User.oturumSurumu`
sayısını taşıyor (`sv`); parola sıfırlanınca ya da değişince sayı artıyor ve
eski jetonlar `requireAuth`ta `OTURUM_BITTI` ile düşüyor. Parolayı değiştiren
cihaz yeni jetonla oturumda kalıyor. Alanı olmayan eski jetonlar 0 sayılıyor
— bu değişiklik kimseyi oturumdan atmadı.

**Sıfırlama postası frenli.** Uç giriş istemiyor; frensizken herhangi
birinin adresine dakikada onlarca posta yağdırılabiliyordu. Doğrulama
postasıyla aynı fren (`gonderilebilirMi`: iki gönderim arası 60 sn, günde 5).
Frene takılan istek AYNI cevabı alıyor — "çok hızlı" demek adresin kayıtlı
olduğunu söylerdi.

**Sıfırlama jetonu gerçekten tek kullanımlık.** Aynı bağlantıya aynı anda
iki kez basılınca iki parola değişikliği geçiyordu; artık koşullu yazma
yalnız birine izin veriyor.

**Giriş adres başına frenli** (`services/girisFreni.ts`). Tek fren IP
başınaydı (dakikada 60 → tek hesaba günde 86 bin tahmin). Artık 15 dakikada
10 hatalı denemeden sonra o adrese giriş, doğru parolayla bile, kapalı.
Kilitlenen oyuncunun yolu parola sıfırlama. Kayıtsız adres de aynı
sayılıyor; yoksa kilit, adresin kayıtlı olduğunu söylerdi. Sayaç bellekte —
tek servisli dağıtımda yeterli, birden çok sunucuya bölünürse veritabanına
taşınmalı.

**Oran sınırı kovası doğrulanmış kullanıcı.** Eskiden `Authorization`
başlığının ham metni anahtardı: her istekte uydurma başlık gönderen, her
seferinde boş bir kova açıp sınırdan tamamen kaçıyordu.

**Lord adı veritabanında benzersiz** (eskiden "kalan riskler"deydi). Ad
yalnız kayıtta soruluyordu ve aynı anda gelen iki kayıt ikisi de "boş"
cevabını alıp aynı adı alabiliyordu; "Yunus" varken "YUNUS" da
alınabiliyordu — sıralamada ve savaş raporunda biri ötekinin kılığına
girebiliyordu. Artık `Lord.adAnahtari` benzersiz: büyük/küçük harf, Türkçe
I'lar ve fazla boşluk duyarsız (`lordAdiAnahtari`, `services/adDenetimi.ts`;
göçteki SQL aynı kural). Yarışı kaybeden kayıt sunucu hatası değil "Bu lord
adı alınmış" alıyor; aynı adresle yarışan da "Bu e-posta zaten kayıtlı"
(`benzersizlikIhlali`), işlem bütünüyle geri alındığı için yarım hesap
kalmıyor. Göç var olan çakışmaları çözüyor: en eski lord adını koruyor,
sonrakilerin adına kimliğinin son dört hanesi ekleniyor. Kısıtın önündeki
engel demo tohumlamaydı: ad doluysa demo lord artık "Sungur Bey II", "III"…
oluyor (`bosLordAdi`) ve tohumlandı mı sorusu ada değil demo hesabına
bakıyor. Test: `tools/lord-adi-testi.mjs` (aynı adla sekiz, aynı adresle beş
eşzamanlı kayıt).

## 3. Push aboneliği — SSRF, kapatıldı

Sunucu her bildirimde, istemcinin verdiği adrese POST atıyor. Denetimsizken
`http://169.254.169.254/…` (bulut üst verisi) ya da `http://127.0.0.1:5432`
abone yapılabiliyor, sunucu kendi iç ağına istek atan bir araca
dönüşüyordu. Artık yalnız HTTPS ve bilinen dört push servisi
(`pushAdresiGecerli`); `.test` yalnız geliştirmede. Lord başına en fazla on
abonelik — sınırsızken tek bildirim binlerce isteğe çevrilebiliyordu.

## 4. Başlıklar ve günlük

- **CSP** yalnız kendi adresimizden betik çalıştırıyor. Oturum jetonu
  tarayıcı deposunda; oraya uzanabilen tek şey sayfada çalışan bir betik.
  Yazı tipi paketin içinde olduğu için hiçbir dış adrese izin gerekmiyor.
  Üretim modunda bütün ekranlar gezildi: ihlal sıfır.
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (tıklama tuzağı),
  `nosniff`, `Referrer-Policy: no-referrer`, üretimde HSTS.
- Günlüğe istek adresi **sorgu dizgisiz** yazılıyor: `/api/olcum?anahtar=…`
  her çağrıda anahtarı günlüğe düşürüyordu. Anahtar karşılaştırması da sabit
  sürede.
- Günlüğe **istemcinin IP'si yazılmıyor.** Üretimde her istek satırı
  `remoteAddress` taşıyordu (ölçüldü) ve gizlilik metni "IP yalnız istek
  anında kullanılıyor" diyordu; Render günlüğü günlerce tutuyor.

### İstemcinin adresi vekil arkasında — KRİTİK, kapatıldı

Fastify'a vekile güvenmesi söylenmemişti; Render'da `req.ip` her istekte
VEKİLİN adresiydi. Kayıt ve giriş sınırı (adres başına dakikada 60) bu
yüzden bütün oyunculara TEK kovaydı: açılış günü dakikada 60 kayıttan sonra
herkes 429 alırdı, parola deneyen tek bir saldırgan da herkesin girişini
kilitlerdi. Hiçbir test bunu göremezdi — geliştirmede vekil yok.

Adres artık tek kapıdan okunuyor (`apps/api/src/istemciIp.ts`):

- **`ISTEMCI_IP_BASLIGI`** — vekilin yazdığı ve istemcinin ezemediği başlık.
  Render'da `cf-connecting-ip` (önündeki Cloudflare her istekte kendisi
  yazıyor; render.yaml'da ayarlı). Geçerli IP olmayan değer yok sayılıyor.
- **`VEKIL_SAYISI`** — kendi Caddy/nginx'in için: X-Forwarded-For'un sondan
  o kadar adımı. Baştaki adreslere güvenilmiyor; istemci onları yazabilir.
- `X-Forwarded-For`'un başı **hiçbir yolda** kendiliğinden güvenilmiyor:
  Render istemcinin yolladığını silmeden ona ekliyor.
- Başlık ayarlı ama bir vekilden geçmiş istekte yoksa (ad yanlış, vekil
  değişmiş) günlüğe bir kez yazılıyor; Render'ın sağlık denetimi gibi
  vekilsiz iç istekler susuyor. **Yayın kontrolü** yöneticinin kendi
  isteğine bakıp ayarın gerçekten tuttuğunu panoda söylüyor; Render'da
  ayar yoksa açılış günlüğü de "eksik" diyor.
- Geliştirmede `x-test-ip` başlığı adresi seçiyor (çoklu hesap testi);
  üretimde yok sayılıyor.

`tools/uretim-korumalari-testi.mjs` üretim kipinde ölçüyor: başlığa göre
ayrı kovalar, uydurma `x-test-ip`/`X-Forwarded-For`'un kovayı değiştirmemesi,
eksik başlık uyarısının bir kez basılması ve günlükte adres olmaması.
`VEKIL_SAYISI=1` elle sınandı: baştaki uydurma adresler kovayı değiştirmedi.

## 5. Diğerleri

- Bölge ayrıntısı ve savaş önizlemesi başka diyarın bölgesini göstermiyor
  (garnizon gücü önizlemeyle ölçülebiliyordu).
- `@fastify/jwt` 9 → 10: altındaki `fast-jwt` için üç kritik uyarı vardı
  (algoritma karışıklığı, önbellek karışıklığı, boş HMAC anahtarı). Bizim
  kurulumumuz (sabit, 32+ karakter HMAC anahtarı, önbellek kapalı) bunların
  koşullarını taşımıyordu; yine de oturum kütüphanesi bilinen açıkla
  bırakılmaz.

## Denetlenip SAĞLAM bulunanlar

- **Yetki (IDOR):** incelenen kimlik alan uçların hepsinde (akın, eşya,
  bölge, yürüyüş, savaş raporu, ittifak başvurusu, pakt) sahiplik denetimi var;
  ittifak rütbeleri tek yardımcıdan (`rutbemi`) geçiyor; yönetici uçlarının
  hepsi `requireYonetici` arkasında ve yetki her istekte veritabanından.
- **Girdi:** miktar alanlarının hepsi tam sayı ve negatif değil.
- **SQL:** ham sorgu yalnız parametreli etiketli şablonla (`$queryRaw`);
  `$queryRawUnsafe` yok.
- **XSS:** üç `dangerouslySetInnerHTML` de paketle gelen sabit ikon verisini
  basıyor, oyuncu metnini değil.
- **Gizli bilgi:** izlenen dosyalarda ve git geçmişinin tamamında anahtar
  yok; `.env` hiç işlenmemiş.
- **Günlük ve ödüller:** günlük ve sefer ödülleri zaten koşullu yazmayla
  alınıyordu — iki kez alınamıyor.

## Kalan riskler — bilerek kabul edilenler

| Risk                                           | Neden kabul                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Kayıt "bu e-posta zaten kayıtlı" diyor         | Adresin kayıtlı olduğunu söylüyor, ama oyuncuya "zaten hesabın var" demek kayıt akışının kendisi. Giriş ve sıfırlama sızdırmıyor. |
| `deepmerge-ts` uyarısı (Prisma yapılandırması) | Yalnız Prisma'nın kendi yapılandırma dosyası birleştirilirken çalışıyor; oyuncu girdisi oraya ulaşmıyor.                          |
| Giriş freni sayacı bellekte                    | Tek servisli dağıtımda doğru. Birden çok sunucuda tavan sunucu sayısıyla çarpılır.                                                |

## Kod nerede

| Konu                    | Dosya                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Satır kilidi            | `apps/api/src/services/kilit.ts`, `services/lord.ts`                               |
| İki lordlu kilit sırası | `apps/api/src/services/esyaPazari.ts`                                              |
| Oturum sürümü           | `apps/api/src/auth.ts`, `routes/auth.ts`, `routes/me.ts`                           |
| Giriş freni             | `apps/api/src/services/girisFreni.ts` (+ birim testi)                              |
| Push adres kuralı       | `apps/api/src/services/pushPolitika.ts` (+ birim testi)                            |
| Başlıklar, günlük, kova | `apps/api/src/index.ts`                                                            |
| Testler                 | `tools/yaris-testi.mjs`, `tools/guvenlik-testi.mjs`, `tools/esya-pazari-testi.mjs` |
