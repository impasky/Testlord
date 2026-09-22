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

| Risk                                                | Neden kabul                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kayıt "bu e-posta zaten kayıtlı" diyor              | Adresin kayıtlı olduğunu söylüyor, ama oyuncuya "zaten hesabın var" demek kayıt akışının kendisi. Giriş ve sıfırlama sızdırmıyor.                       |
| Lord adı benzersizliği kayıtta, veritabanında değil | İki kayıt aynı anda aynı adı alabilir. Kısıt eklemek, demo lordları tohumlayan açılışı çökertebilir; önce tohumlama ad çakışmasına dayanıklı yapılmalı. |
| `deepmerge-ts` uyarısı (Prisma yapılandırması)      | Yalnız Prisma'nın kendi yapılandırma dosyası birleştirilirken çalışıyor; oyuncu girdisi oraya ulaşmıyor.                                                |
| Giriş freni sayacı bellekte                         | Tek servisli dağıtımda doğru. Birden çok sunucuda tavan sunucu sayısıyla çarpılır.                                                                      |

## Kod nerede

| Konu                    | Dosya                                                    |
| ----------------------- | -------------------------------------------------------- |
| Satır kilidi            | `apps/api/src/services/kilit.ts`, `services/lord.ts`     |
| Oturum sürümü           | `apps/api/src/auth.ts`, `routes/auth.ts`, `routes/me.ts` |
| Giriş freni             | `apps/api/src/services/girisFreni.ts` (+ birim testi)    |
| Push adres kuralı       | `apps/api/src/services/pushPolitika.ts` (+ birim testi)  |
| Başlıklar, günlük, kova | `apps/api/src/index.ts`                                  |
| Testler                 | `tools/yaris-testi.mjs`, `tools/guvenlik-testi.mjs`      |
