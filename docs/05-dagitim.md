# Dağıtım ve İşletme

Oyunu yayına almak ve ayakta tutmak için gereken her şey. `docs/04` M9'un
karşılığıdır.

---

## 1. Ortam değişkenleri

| Değişken                    | Zorunlu    | Varsayılan           | Ne işe yarar                                                                                                                                         |
| --------------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | evet       | —                    | PostgreSQL bağlantısı                                                                                                                                |
| `JWT_SECRET`                | evet       | —                    | Oturum imzası. **En az 32 karakter.** Değiştirilirse herkes çıkış yapar                                                                              |
| `PORT`                      | hayır      | 3000                 | Dinlenecek port                                                                                                                                      |
| `NODE_ENV`                  | hayır      | development          | `production` olmadan CORS gevşek kalır ve test uçları açılır                                                                                         |
| `WEB_ORIGIN`                | hayır      | localhost:5173       | Üretimde izinli origin listesi. Tek servisli kurulumda kullanılmaz                                                                                   |
| `SERVE_WEB`                 | hayır      | false                | Arayüzü API ile aynı sunucudan sunar                                                                                                                 |
| `RUN_WORKER`                | hayır      | false                | Worker'ı API sürecinin içinde çalıştırır                                                                                                             |
| `AUTO_MIGRATE`              | hayır      | false                | Açılışta migration uygular, dünya yoksa açar                                                                                                         |
| `SEED_DEMO_LORDS`           | hayır      | false                | İlk açılışta 6 rakip lord ekler                                                                                                                      |
| `RATE_LIMIT_MAX`            | hayır      | 300                  | Oturum başına dakikalık istek tavanı                                                                                                                 |
| `AUTH_RATE_LIMIT_MAX`       | hayır      | 60                   | Kayıt/giriş için IP başına dakikalık tavan                                                                                                           |
| `ISTEMCI_IP_BASLIGI`        | vekil ise  | boş                  | İstemcinin IP'sini yazan, istemcinin ezemediği vekil başlığı. **DigitalOcean'da `do-connecting-ip`** (şablonda ayarlı), Render'da `cf-connecting-ip` |
| `VEKIL_SAYISI`              | hayır      | 0                    | Kendi Caddy/nginx'in için X-Forwarded-For'da güvenilen adım sayısı (genelde 1). İkisi de yoksa adres bağlantıdan                                     |
| `DB_HAVUZU`                 | hayır      | 10                   | Veritabanı bağlantı havuzu. `DATABASE_URL` kendi `connection_limit`ini taşıyorsa o geçerli (§8)                                                      |
| `SENTRY_DSN`                | hayır      | boş                  | Boşsa hata izleme kapalıdır, dışarıya hiçbir şey gitmez                                                                                              |
| `SENTRY_TRACES_SAMPLE_RATE` | hayır      | 0.05                 | İzleme örneklemesi. Ücretsiz katmanda kota var                                                                                                       |
| `LOG_LEVEL`                 | hayır      | info                 | `fatal\|error\|warn\|info\|debug\|trace`                                                                                                             |
| `EPOSTA_TASIYICI`           | hayır      | log                  | `log` dışarı göndermez; `resend` gerçek posta atar                                                                                                   |
| `EPOSTA_ANAHTAR`            | resend ise | —                    | Resend API anahtarı                                                                                                                                  |
| `EPOSTA_GONDEREN`           | resend ise | —                    | Gönderen adresi; alan adı doğrulanmış olmalı                                                                                                         |
| `EPOSTA_DOGRULAMA`          | hayır      | acik                 | `kapali` ise kimse doğrulama istemez (kısıtlı eylemler açık, 7 gün sonra giriş kapanmaz). Yalnız posta göndermeyen deneme sunucusu için (§2b)        |
| `UYGULAMA_URL`              | hayır      | Render'ın dış adresi | Sıfırlama bağlantısının tabanı. DigitalOcean şablonunda `${APP_URL}` (birincil alan adını izliyor); Render'da verilmezse `RENDER_EXTERNAL_URL`       |
| `VAPID_ACIK_ANAHTAR`        | hayır      | boş                  | Push bildirimi. `pnpm push-anahtari` ile üret; ikisi de boşsa bildirim kapalı ve arayüzde düğme hiç çıkmaz                                           |
| `VAPID_GIZLI_ANAHTAR`       | push ise   | —                    | Aynı komutun ürettiği gizli yarısı. **Depoya yazma.** Değiştirmek bütün abonelikleri geçersiz kılar                                                  |
| `VAPID_ILETISIM`            | hayır      | mailto: yerel        | Push servislerinin sorun çıkınca ulaşacağı adres                                                                                                     |
| `PLAY_PAKET_ADI`            | satış ise  | boş                  | Android paket adı (`com.lordlarcagi.oyun`). Servis hesabıyla birlikte; biri boşsa satın alma kapalı (docs/25)                                        |
| `PLAY_SERVIS_HESABI`        | satış ise  | boş                  | Play Developer API servis hesabının JSON anahtarı (düz ya da base64). **Gizli, depoya yazma**                                                        |
| `ADMOB_ODUL_BIRIMI`         | reklam ise | boş                  | Ödüllü reklam birimi `ca-app-pub-…/…`. Boşsa uygulamada reklam düğmesi çıkmaz                                                                        |
| `ADMOB_YAYINCI_KIMLIGI`     | reklam ise | boş                  | `pub-…`; `/app-ads.txt` bundan yazılır. Birimle aynı AdMob hesabından olmalı                                                                         |
| `MOBIL_KOKEN`               | hayır      | https://localhost    | Android uygulamasının kökeni; üretimde CORS ona da izin veriyor                                                                                      |

**`/health`** kimlik istemez ve `{ ok, time, izleme }` döner. `izleme` alanı
Sentry'nin gerçekten açık olup olmadığını söyler — DSN'i girip de yazım hatası
yaptıysan burada görürsün. (Eskiden yazım hatalı DSN'de de `acik` diyordu:
Sentry istemciyi yine kuruyor ama hiçbir şey göndermiyor. Artık DSN'in
çözülmüş olmasına bakılıyor.)

---

## 2. DigitalOcean App Platform (seçilen yol, telefondan yapılabilir)

İmaj depodaki `Dockerfile`'dan derleniyor; kurulum tanımı
`.do/deploy.template.yaml`. **Tek servis:** imaj API'yi, arayüzü ve
worker'ı aynı süreçte çalıştırıyor. Tek köken: CORS devreye girmiyor.

**Maliyet** (DigitalOcean fiyat sayfası, 2026-10; paneldeki tutar geçerli):

| Ne         | Boyut                   | Kaynak                   | Aylık | Neden                                                        |
| ---------- | ----------------------- | ------------------------ | ----- | ------------------------------------------------------------ |
| Sunucu     | `apps-s-1vcpu-1gb`      | 1 paylaşımlı vCPU, 1 GiB | 12 $  | Uyumuyor. Bellek 300–430 MB + resim sınıflandırıcısı ~100 MB |
| PostgreSQL | en küçük yönetilen küme | 1 vCPU, 1 GiB            | ~15 $ | Kalıcı; günlük yedek ve geri dönüş noktaları DigitalOcean'da |

§8'deki ~250 aktif oyuncu ölçümü TAM bir CPU'daydı; paylaşımlı vCPU
yoğun saatte daha az taşıyabilir. Oyuncu arttıkça panelden bir üst boyuta
(adanmış CPU) geç — kod değişmiyor. **`instance_count` 1 kalmalı:** worker
sürecin içinde ve tek kopya için yazıldı.

### Kurulum — sırayla

1. **Veritabanı.** cloud.digitalocean.com → Databases → Create Database
   Cluster: PostgreSQL 16, bölge **Frankfurt (FRA1)**, en küçük boyut,
   ad **`lordlar-db`**. Hazır olunca Users & Databases → Add database:
   **`lordlar_cagi`**.
2. **Uygulama.** Bu bağlantıyı aç (Deploy to DigitalOcean):
   `https://cloud.digitalocean.com/apps/new?repo=https://github.com/impasky/Testlord/tree/claude/medieval-strategy-game-design-y08qr7`
   GitHub'a erişim izni iste. Ekran şablonu okuyup boş alanları soruyor;
   en az **`JWT_SECRET`** (parola yöneticisiyle üretilmiş 48+ rastgele
   karakter) ve **`DESTEK_EPOSTA`**'yı doldur, gerisi sonradan da girilir.
   _Düğme açılmazsa:_ Apps → Create App → GitHub → depo ve dal →
   Dockerfile algılanıyor → ortam değişkenlerini §1'deki tablodan gir →
   Add Resource → Database → mevcut `lordlar-db`.
3. **İlk dağıtım** 5–10 dakika: imaj derleniyor, açılışta migration'lar
   uygulanıyor ve ilk diyar açılıyor. Runtime Logs'ta
   `Lordlar Çağı API çalışıyor` satırı görünür.
4. **Alan adı.** Settings → Domains → Add Domain; DNS'te gösterilen CNAME'i
   ekle (ya da alan adını DigitalOcean'ın ad sunucularına taşı). Sertifika
   kendiliğinden. `UYGULAMA_URL` = `${APP_URL}` birincil alan adını izliyor.
   Mağaza için Play listesindeki web sitesi bu alan adı olmalı (docs/25 §4.3).
5. **Yönetici.** Oyuna kendi e-postanla kayıt ol, sonra uygulamanın
   **Console** sekmesinde: `pnpm yonetici ver <e-postan>`.
6. **Yayın kontrolü.** Oyunda Hesap → Yönetici paneli: eksik ayarları
   söylüyor ve `ISTEMCI_IP_BASLIGI`'nın tuttuğunu senin isteğinle ölçüyor.
7. **Otomatik dağıtım (önerilen).** DigitalOcean → API → Generate New Token
   (özel kapsamla yalnız uygulamalar: okuma ve güncelleme). GitHub → Settings → Secrets and
   variables → Actions → **`DIGITALOCEAN_ACCESS_TOKEN`**. Bundan sonra CI'ın
   bütün işleri yeşil olan commit kendiliğinden dağıtılıyor (`dagit` işi).
   Anahtar yoksa her sürümde panelde **Deploy**'a bas.

### Bilinmesi gerekenler

- **"Gönderince dağıt" bilerek kapalı.** Açık olsaydı CI kırmızıyken de
  yeni sürüm canlıya çıkardı. `dagit` işi ayrıca dalın ucunun hâlâ
  denetlenen commit olduğuna bakıyor: arada yeni bir commit geldiyse onun
  denetimini bekliyor.
- **Veritabanı ve uygulama aynı bölgede** (FRA). Uygulama veritabanını
  bileşen olarak ekleyince güvenilir kaynaklara kendiliğinden giriyor;
  ulaşamazsa açılış günlüğü sebepleri sayıyor.
- **Bağlantı TLS ile** (`sslmode=require`; adres DigitalOcean'dan geliyor).
- **Veritabanı kullanıcısı `doadmin`.** PostgreSQL 15+ `public` şemasında
  tablo açmayı veritabanı sahibine bırakıyor; panelden açılan ayrı bir
  kullanıcıyla ilk migration "permission denied" ile düşerdi.
- **İstemcinin IP'si `do-connecting-ip`den.** `X-Forwarded-For`'da
  DigitalOcean'ın kendi giriş sunucusu var; ayar olmadan kayıt/giriş sınırı
  bütün oyunculara tek kova olur (docs/18). Şablonda ayarlı.
- **Yedek:** yönetilen PostgreSQL'in kendi yedekleri var; yine de §4'teki
  betikle başka bir yerde de tut ve ayda bir tatbikat yap.
- **Uyarılar:** dağıtım ya da alan adı hatası hesabın e-postasına gidiyor
  (şablonda `alerts`).

## 2b. Render (şimdilik: ücretsiz deneme sunucusu)

`render.yaml` bir Blueprint'tir: render.com → New → Blueprint → depoyu seç.
Render hem sunucuyu hem PostgreSQL'i kurar ve imajı değil kendi Node
derleyicisini kullanır. Kalıcı yayın DigitalOcean'da (§2); Render şimdilik
oynanabilir bir deneme sunucusu.

**Planlar — render.yaml'da ücretsiz (2026-10-17):**

| Ne         | Plan   | Sınır                                                               |
| ---------- | ------ | ------------------------------------------------------------------- |
| Sunucu     | `free` | 15 dk istek gelmezse uyuyor, ilk açılış ~1 dk; 512 MB bellek        |
| PostgreSQL | `free` | **30 günde süresi doluyor, 14 gün sonra verisiyle siliniyor**; 1 GB |

Uyurken worker da duruyor; oyuncu dönünce birikmiş yürüyüşler ve kuyruklar
hemen çözülüyor, kayıp yok ama bildirim gecikiyor. 512 MB'a profil resmi
sınıflandırıcısı sığmıyor: `RESIM_SINIFLANDIRICI=kapali`, yüklenen resimler
yönetici onayına gidiyor. Posta gönderilmiyor (`EPOSTA_TASIYICI=log`),
bu yüzden e-posta doğrulaması da kapalı (`EPOSTA_DOGRULAMA=kapali`): açık
kalsaydı kimse doğrulayamaz, ittifak sohbeti, kaynak gönderme ve eşya pazarı
ilk günden kapalı olur, yedi gün sonra da giriş herkese kapanırdı.
Veritabanının süresi dolmadan DigitalOcean'a geç; içindeki oyuncuları taşımak
istersen §4'teki yedekle/geri yükle. Taşıdığın dünyada doğrulamayı AÇARSAN
yedi günü geçmiş, doğrulanmamış her hesap girişte durur: önce gerçek postayı
(`resend`) kur, oyunculara haber ver.

**Kalıcı Render istersen:** sunucuyu `standard` (1 CPU, 2 GB, 25 $),
veritabanını `basic-1gb` (19 $ + disk) yap; sınıflandırıcıyı aç. 500 aktif
oyuncuda `pro` ve `basic-4gb`. Fiyatlar paneldeki tutar.

**Eski veritabanı (`lordlar-db`).** 31 Ağustos'ta ücretsiz açılmıştı; 30
günlük süresi dolunca sunucu iç adresini çözemedi ("Can't reach database
server at dpg-…-a", 2026-10-16). render.yaml artık `lordlar-vt` adlı yeni
bir veritabanı istiyor. Render çalışma alanı başına TEK ücretsiz veritabanına
izin veriyor: panelde eski `lordlar-db` hâlâ duruyorsa önce onu sil, sonra
Blueprint → Manual Sync.

**Bilinmesi gerekenler:**

- **Veritabanı ve servis aynı bölgede olmalı.** Render'ın iç ağ adresi
  (`dpg-xxxxx-a`) yalnızca aynı bölgedeki ve aynı çalışma alanındaki
  servislerden çözülür. Farklı bölgede kalırsa Prisma `P1001` ("Can't
  reach database server") verir. `render.yaml`'da ikisi de `frankfurt`;
  ama servis ya da veritabanı daha önce başka bölgede açıldıysa Blueprint
  bölgeyi DEĞİŞTİREMİYOR — yanlış olanı silip yeniden uygula.
- **`Can't reach database server at dpg-…` görürsen** günlüğün kendi
  satırlarına bak: sunucu beklerken "adı çözülmüyor" (bölge/çalışma alanı
  farkı ya da veritabanı yok) ya da "bağlantıyı reddediyor / cevap
  vermiyor" (veritabanı açılıyor ya da durmuş) diye yazıyor; 5 dakika
  sonra vazgeçerken ne yapılacağını söylüyor. Ücretsiz veritabanı 30 gün
  sonra kapanıyor: panelde durumu "Available" değilse sebep o. Veritabanı
  sonradan hazır olduysa Manual Deploy → Deploy latest commit.
- **İstemcinin IP'si `cf-connecting-ip`den.** Render'da istek vekilden
  geçiyor; ayar olmadan kayıt/giriş sınırı bütün oyunculara tek kova olur
  (docs/18). render.yaml'da ayarlı; yönetici panosundaki yayın kontrolü
  senin isteğinle doğruluyor.
- **Blueprint'te `value` olan değişken paneldekini ezer.** `SEED_DEMO_LORDS`
  burada `false`; panelden değiştirirsen bir sonraki eşitlemede geri döner.
- **Yedek:** ücretsiz PostgreSQL'in yedeği YOK ve 30 günde siliniyor.
  Tutmak istediğin bir dünya varsa depodaki betikle (bölüm 4) yedek al;
  ücretli planda Render'ın kendi geri dönüş noktaları da var.

---

## 3. Kendi sunucun (Droplet / VPS + Docker)

Aynı imaj her yerde çalışıyor. Veritabanı ayrı (yönetilen PostgreSQL ya da
kendi kurduğun); `.env` dosyası sunucuda, imajda değil.

```bash
docker build -t lordlar .
docker run -d --name lordlar --restart unless-stopped \
  --env-file /srv/lordlar/.env -e SERVE_WEB=true -e RUN_WORKER=true -e AUTO_MIGRATE=true \
  -e VEKIL_SAYISI=1 -p 127.0.0.1:3000:3000 lordlar
docker exec -it lordlar pnpm yonetici ver <e-postan>
```

Önüne bir ters vekil (Caddy/nginx) koyup TLS'i orada bitir; Node'u
doğrudan 443'e açma. `VEKIL_SAYISI=1` o tek vekile güvenmek için.
(`docker-compose.yml` yalnız geliştirme veritabanı.)

---

## 4. Yedekleme

```bash
tools/yedekle.sh                    # yedek/ dizinine custom-format dump
SAKLA_GUN=14 tools/yedekle.sh       # 14 günden eskiyi sil
```

Günlük, trafiğin en düşük olduğu saatte:

```
17 3 * * *  cd /srv/lordlar && tools/yedekle.sh >> /var/log/lordlar-yedek.log 2>&1
```

**Geri yükleme** — `tools/geri-yukle.sh`:

```bash
HEDEF_URL=postgresql://.../bos_vt tools/geri-yukle.sh yedek/lordlar-....dump
HEDEF_URL=postgresql://.../canli tools/geri-yukle.sh yedek/lordlar-....dump --uzerine-yaz
```

Hedef **açıkça** veriliyor: betik `DATABASE_URL`i bilerek okumuyor, çünkü
yedek alan kabukta duran adres canlı veritabanıdır ve bir kopyala-yapıştır
hatası onun üstüne yazardı. Hedefte tablo varsa durur; üstüne yazmak
`--uzerine-yaz` ister (gerçek kurtarmada sıra: önce HEDEFİN kendisini
yedekle, sonra üstüne yaz). Yükleme tek işlem — yarıda kalırsa yarım bir
veritabanı bırakmıyor. Bitince tablo sayısını dump'la, son migration'ı ve
temel tabloların satırlarını yazıyor. Adres ekrana yalnız sunucu ve
veritabanı adı olarak çıkıyor.

**Tatbikat** — `pnpm yedek-tatbikati`: yedek al → boş, geçici bir
veritabanına yükle → tablo tablo satır sayılarını kaynakla karşılaştır →
şema koddakiyle birebir mi (`prisma migrate diff`) → derlenmiş sunucu
yüklenen veritabanıyla açılıp diyar listesini okuyabiliyor mu → betiğin
emniyetleri (hedefsiz, dolu hedef, bozuk dump) → bozulmuş bir veritabanının
`--uzerine-yaz` ile dump anına dönmesi → temizlik. Süreleri yazıyor:
geliştirme veritabanında (108 bin satır) yedek 0,6 sn, geri yükleme
1,3 sn. CI'daki üretim işi bunu her itişte, sunucunun kendi kurduğu ve az
önce oynanan veritabanında koşuyor.

Geçici veritabanı kaynakla aynı sunucuda açılıyor (`CREATE DATABASE`).
Yönetilen Postgres buna izin vermiyorsa `HEDEF_URL` ile boş bir hedef ver
(ör. kendi makinende bir Postgres): canlı veritabanında **ayda bir**
koşturmak, yayın listesindeki "denendi" kutusunun ta kendisi.

Üç kural:

1. **Yedeği veritabanıyla aynı diskte tutmak yedek değildir.** Makine gidince
   ikisi birden gider.
2. **Denenmemiş yedek yedek değildir.** Ayda bir `pnpm yedek-tatbikati`.
   `yedekle.sh` de 10 KB altındaki dump için uyarır — boş bir dump sessizce
   başarılı görünür.
3. **Yedek almadan migration çalıştırma.**

---

## 5. İzleme

**Hata izleme.** sentry.io'da ücretsiz proje aç, DSN'i `SENTRY_DSN` olarak
gir. Yalnızca 5xx ve yakalanmamış istisnalar gönderilir; 4xx'ler oyunun
normal işleyişidir ("altının yetmiyor", "kalkan var") ve gönderilseler
gerçek çökmeler gürültüde kaybolurdu.

**Log.** Üretimde pino JSON yazar. `authorization`, `cookie` ve parola
alanları maskelenir — bir kez sızan log satırı kalıcıdır: toplanır,
aktarılır, yedeklenir.

**Ne izlenmeli:** `/health` düşerse servis gitmiştir. Log'da `Sunucu hatası`
satırlarının artması ilk uyarıdır.

---

## 6. Yayın öncesi kontrol listesi

```bash
pnpm typecheck && pnpm test && pnpm balance   # statik + birim + denge
pnpm build                                    # üretim derlemesi
pnpm e2e                                      # tarayıcı akışları (API + web ayakta olmalı)
pnpm yuk-testi                                # 120 oyuncu, tur kipi
pnpm yuk-testi-500                            # 500 oyuncu, 3 dk oturum (§8)
```

İlk iki madde artık **otomatik denetleniyor**:
`tools/uretim-korumalari-testi.mjs` `pnpm e2e` zincirinde koşuyor, ayrı bir
sunucuyu `NODE_ENV=production` ile kaldırıp `dev.ts`teki bütün uçların 404
döndüğünü ve kısa bir `JWT_SECRET` ile sunucunun hiç açılmadığını
doğruluyor. Uç listesi elle tutulmuyor, `dev.ts`ten okunuyor — oraya yeni
bir uç eklenirse kendiliğinden kapsanır.

Derlenmiş tek servis de CI'da her itişte sınanıyor (`denetim.yml` →
`uretim` işi): boş bir veritabanına karşı `pnpm build`, bu belgedeki
değişkenlerle `node apps/api/dist/index.js` (migration'ı sunucunun kendisi
kuruyor), ardından `tools/uretim-testi.mjs` telefon boyutunda kayıt olup
oynuyor. Render'a giden yolun ta kendisi; yerelde denemek için komutlar o
dosyanın başında.

Onay kutusu yine de duruyor, çünkü test KODUN doğru davrandığını gösteriyor;
üretim ORTAMINDA değişkenin gerçekten öyle ayarlandığını göstermiyor.

**Yayın kontrolü — sunucu eksikleri kendisi söylüyor.** Aşağıdaki maddelerin
sunucunun görebildiği hepsi (`NODE_ENV`, imzanın rastgeleliği, yönetici
sayısı, Sentry'nin gerçekten açılması, e-posta taşıyıcısı ve gönderen,
VAPID çifti, uygulamanın adresi, `WEB_ORIGIN`, demo lordlar, destek adresi,
istek tavanları, günlük seviyesi, resim sınıflandırıcısı) üç yerde
okunuyor:

- **Açılış günlüğü.** Sunucu kurulmuş bir yerdeyse (`NODE_ENV=production`,
  Render ya da `SERVE_WEB`) dinlemeye başlayınca listeyi yazıyor; eksik
  varsa uyarı seviyesinde.
- **`pnpm yayin-kontrolu`** — sunucunun kabuğunda (Render → Shell). Eksik
  varsa çıkış kodu 1.
- **Yönetici paneli → "Yayın kontrolü"** (katlı; başlık eksik sayısını
  söylüyor).

Hiçbiri bir ayarın DEĞERİNİ göstermiyor: denetime yalnız evet/hayır ve
sayılar giriyor (`JWT_SECRET`in kendisi değil "rastgele görünüyor mu",
adresin kendisi değil "yerel mi, https mi"), çıkan da ad, durum ve sebep.
Kod: `packages/shared/src/yayin.ts` (saf denetim ve metinler),
`apps/api/src/services/yayin.ts` (girdiyi toplayan). Eksik bir kapı değil
uyarı: sunucu yine açılıyor, çünkü yarım ayarla açık bir oyun (ör. push
kapalı) kapalı bir oyundan iyidir.

Sunucunun bilemediği üç iş elle kalıyor ve kontrolün sonunda yazıyor:
yedeğin geri yüklenerek denenmesi, sıfırlama postasının gerçekten gelmesi,
"Deneme gönder"in telefona düşmesi.

- [ ] `JWT_SECRET` üretimde rastgele ve en az 32 karakter _(kod tarafı test
      ediliyor; kalan iş: değeri gerçekten rastgele üretmek)_
- [ ] `NODE_ENV=production` (yoksa `/api/test/*` uçları açık kalır) _(kod
      tarafı test ediliyor; kalan iş: değişkeni sunucuda ayarlamak)_
- [ ] `SEED_DEMO_LORDS=false` (gerçek oyuncular gelecekse)
- [ ] **En az bir yönetici hesabı atandı** (`pnpm yonetici ver <eposta>`) —
      yoksa şikâyetler kuyrukta birikir ve kimse bakamaz (docs/14)
- [ ] Yedek alınıyor **ve** canlı veritabanında bir kez `pnpm yedek-tatbikati`
      koştu (§4)
- [ ] `SENTRY_DSN` girildi, `/health` `izleme: acik` diyor
- [ ] Parola sıfırlama e-postası gerçekten gidiyor (`EPOSTA_TASIYICI=resend`)
- [ ] Push bildirimi açık (`pnpm push-anahtari` ile üretilmiş VAPID çifti) ve
      Hesap ekranındaki "Deneme gönder" gerçekten telefona düşüyor
      — `log` bırakılırsa akış çalışır ama posta gitmez, oyuncu bağlantıyı
      hiç görmez

---

## 7. Ölçüm panosu

Yayından sonra her karar ("öğretici kısalsın mı", "ilk akın kolay mı")
bir sayıya dayanmalı. **Yönetici paneli → "Ölçüm"** (katlı; başlık bugünkü
aktifi söylüyor) dört soruyu cevaplıyor:

| Soru                     | Sayı                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Bugün kaç kişi oynuyor?  | Bugün / dün / 7 gün / 30 gün tekil aktif oyuncu                         |
| Oyun alışkanlık mı?      | Yapışkanlık: dünkü aktif ÷ 30 günlük aktif                              |
| Yeni gelen dönüyor mu?   | **1. ve 7. gün tutundurma** — o gün kaydolanların kaçı N gün sonra açtı |
| Son günlerde değişti mi? | Son 30 günün sütunları (yeşil payı o gün kaydolan) ve kohort tablosu    |

**Kaynak: `GunlukAktiflik`** — lord başına, oyunu açtığı her gün için bir
satır (UTC gün numarası, shared `gunNumarasi`; giriş serisiyle aynı gün).
Kayıtta ve günün ilk `/me`sinde yazılıyor; aynı gün ikinci açılış bir şey
yazmıyor. Eskiden `lastSeenAt` yalnız SON anı tutuyordu: "dün kaç kişi
oynadı" sorusunun cevabı yoktu ve `/olcum`un "ertesi gün dönüş"ü üç hafta
sonra bir kez döneni de sayıyordu (o kaba sayı geçmiş kayıtlar için hâlâ
`/olcum`da, yanında kesin sayılar `pano` alanında).

Kurallar:

- **Gün bitmeden oran yok.** 1. gün oranı ancak ertesi gün tamamen
  geçince yazılıyor (`—`); yarım günün oranı hep düşük çıkar ve yanlış
  alarm verir.
- **Ortalama kayıt sayısıyla ağırlıklı.** Üç kişilik bir günün %100'ü ile
  otuz kişilik bir günün %20'si "%60" değil.
- **NPC lord sayılmıyor.** `/me` çağırmadıkları için her biri "dönmedi"
  sayılıp oranı aşağı çekiyordu (`/olcum` da artık onları dışarıda
  bırakıyor).
- **Oyuncu adı yok.** Pano yalnız toplam döndürüyor.

Geçiş, tablo yokken kaydolmuş lordlar için iki bilinen günü (kayıt ve son
görülme) yazıyor; aradaki günler bilinmiyor. Tablodan önceki kohortların
tutundurması bu yüzden eksik sayılabilir — yayından sonraki kohortlar
tam.

Kod: `apps/api/src/services/olcumHesabi.ts` (saf hesap, birim testi
yanında), `olcumPanosu.ts` (pencereyi okuyan). `tools/yonetici-testi.mjs`
kaydın ve `/me`nin satır yazdığını, panonun onları gördüğünü ve
yetkisize kapalı olduğunu ölçüyor.

---

## 8. Kapasite: 500 oyunculu yük testi

**`pnpm yuk-testi-500`** — 500 oyuncu kaydoluyor, 30 sn içinde oyuna
giriyor ve 3 dakika OYNUYOR: istemcinin kendi yoklamaları (`/me` 30 sn,
sohbet 30 sn, diyar 60 sn) ve arada ortalama 8 sn düşünme süresiyle bir
eylem karışımı (harita, şehir, ordu, sıralama, sohbet okuma/yazma, eğitim,
üretim, saldırı). Sonunda **savaş dalgası**: 500 oyuncu aynı saniyede
saldırıyor ve yürüyüşler anında çözülüyor. Yanında olay döngüsünün nabzı
(`/health` 2 sn'de bir) ve API sürecinin belleği/CPU'su ölçülüyor. Eski
"tur" kipi (`pnpm yuk-testi`) bir uçun en kötü hâlini bulmaya yarıyor ama
gerçek bir akşamı anlatmıyordu — 500 kişi aynı saniyede aynı düğmeye
basmıyor.

### Ölçülen (üretim derlemesi, worker süreç içinde — Render'daki gibi)

API `taskset` ile çekirdeğe sabitlendi; veritabanı ayrı çekirdeklerde
(Render'da ayrı makine).

| API'nin çekirdeği | Oyuncu | Debi     | Oturumda en yavaş uç (p95)             | CPU (oturum) | Bellek (oturum / dalga tepe) | Sonuç     |
| ----------------- | ------ | -------- | -------------------------------------- | ------------ | ---------------------------- | --------- |
| 4                 | 500    | 117 i/sn | kayıt 294 ms (en yavaş uç)             | %119         | — / 669 MB                   | geçti     |
| 2                 | 500    | 117 i/sn | kayıt 475 ms; `/map` 124, `/me` 101 ms | %97 (yarısı) | 350 / 572 MB                 | geçti     |
| 1                 | 500    | 105 i/sn | `/map` 5,3 sn; `/me` p50 1,8 sn        | doymuş       | 399 / 677 MB                 | **kaldı** |
| 1                 | 250    | 58 i/sn  | kayıt 958 ms; `/map` 110, `/me` 99 ms  | %49          | 308 / 432 MB                 | geçti     |

Savaş dalgası (500 oyuncu aynı saniyede eğitimi bitirip haritayı açıp
saldırıyor) 2 çekirdekte p95 ~11 sn, 4 çekirdekte ~8 sn sürüyor ve hiçbir
saldırı yolda kalmıyor. Bu kasten aşırı bir an; oyuncu eşiğine (1 sn)
tabi değil. Bellek dalgadan sonra kendiliğinden ~300 MB'a iniyor — sızıntı
yok, yük altında büyüyen yığın.

**Öneri ve seçilen.** Aynı anda **500** aktif oyuncu için **2 CPU, 1 GB**
bellekli bir sunucu. **1 CPU** ~250 aktif oyuncuyu rahat taşıyor — yayın
için seçilen bu (Render `standard`, §2). Ücretsiz plan (0,1 CPU, 512 MB)
ölçülmedi; doğrusal tahminle ~25 aktif oyuncu ve üstelik uyuyor — yalnız
deneme için. "Aktif" = o an uygulamayı açık tutan; kayıtlı oyuncu sayısı
bunun birkaç katı olabilir. Yükseltme zamanı yönetici ölçüm panosundan
(§7) okunuyor: günlük aktif ~2.000'i geçince `pro`ya bak.

İşin çoğu JS'te değil sorgu motorunda: CPU profilinde JS iş parçacığı
zamanın %79'unda boştu, uç başına ~20 SQL ifadesi var (`/me` 23, `/map`
25). Kapasiteyi artırmanın yolu sorgu sayısını azaltmak.

### Testin bulduğu ve düzeltilen hatalar

1. **Aynı bölgeye aynı anda varan saldırılar** garnizonu birlikte okuyup
   yazıyordu: oyuncu garnizonunda 500, NPC garnizonunda SESSİZ hata —
   ikinci savaş birincinin kaybını eziyor, savunan aynı askerle iki kez
   savaşıyordu (3/3 koşuda yeniden üretildi). Çözüm bölge kilidi
   (`services/march.ts`, `FOR UPDATE SKIP LOCKED`): bölge başka bir
   savaşın elindeyse yürüyüş sonraki tura kalıyor. Bekleyen kilit değil,
   çünkü her bekleyen bir veritabanı bağlantısı tutuyor ve aynı köye düşen
   onlarca savaş havuzu tüketiyordu. Postgres'in kilitlenme sezgisinin
   geri aldığı çözüm (40P01) de aynı yoldan yeniden deneniyor.
   `tools/yaris-testi.mjs` 5. senaryo: her savaş öncekinin bıraktığı
   garnizonla başlıyor.
2. **Diyar dolarken gelen kayıtlar** her biri kendi diyarını açıyordu:
   aynı saniyede 8 diyar, 6'sında tek lord; dört denemeyi aşan çakışma da
   500 dönüyordu. Çözüm danışma kilidi (`findOrOpenWorld`): kilidi alan
   açık diyarları yeniden okuyor, önündeki az önce açtıysa oraya
   katılıyor. Kilidin içindeki her okuma aynı işlemin bağlantısından —
   ikinci bağlantı istemek, kilidi bekleyenler havuzu doldurmuşken kilidi
   tutanı kilitliyordu.
3. **Bağlantı havuzu** Prisma'nın varsayılanıydı (`2 × çekirdek + 1`,
   1 çekirdekte 3 bağlantı). Artık `DB_HAVUZU` (varsayılan 10); işlem
   başlama beklemesi 2 sn'den 5 sn'ye.

Kayıt anındaki doluluk hâlâ yaklaşık: diyar 240 aktifte dolarken aynı
anda gelen kayıtlar onu birkaç kişi aşabiliyor (ölçülen 254). Kapasite
bir tasarım hedefi, sert bir sınır değil; bunu kapatmak her kaydı
sıraya dizmek demekti.
