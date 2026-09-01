# Dağıtım ve İşletme

Oyunu yayına almak ve ayakta tutmak için gereken her şey. `docs/04` M9'un
karşılığıdır.

---

## 1. Ortam değişkenleri

| Değişken | Zorunlu | Varsayılan | Ne işe yarar |
|---|---|---|---|
| `DATABASE_URL` | evet | — | PostgreSQL bağlantısı |
| `JWT_SECRET` | evet | — | Oturum imzası. **En az 32 karakter.** Değiştirilirse herkes çıkış yapar |
| `PORT` | hayır | 3000 | Dinlenecek port |
| `NODE_ENV` | hayır | development | `production` olmadan CORS gevşek kalır ve test uçları açılır |
| `WEB_ORIGIN` | hayır | localhost:5173 | Üretimde izinli origin listesi. Tek servisli kurulumda kullanılmaz |
| `SERVE_WEB` | hayır | false | Arayüzü API ile aynı sunucudan sunar |
| `RUN_WORKER` | hayır | false | Worker'ı API sürecinin içinde çalıştırır |
| `AUTO_MIGRATE` | hayır | false | Açılışta migration uygular, dünya yoksa açar |
| `SEED_DEMO_LORDS` | hayır | false | İlk açılışta 6 rakip lord ekler |
| `RATE_LIMIT_MAX` | hayır | 300 | Oturum başına dakikalık istek tavanı |
| `AUTH_RATE_LIMIT_MAX` | hayır | 60 | Kayıt/giriş için IP başına dakikalık tavan |
| `SENTRY_DSN` | hayır | boş | Boşsa hata izleme kapalıdır, dışarıya hiçbir şey gitmez |
| `SENTRY_TRACES_SAMPLE_RATE` | hayır | 0.05 | İzleme örneklemesi. Ücretsiz katmanda kota var |
| `LOG_LEVEL` | hayır | info | `fatal\|error\|warn\|info\|debug\|trace` |
| `EPOSTA_TASIYICI` | hayır | log | `log` dışarı göndermez; `resend` gerçek posta atar |
| `EPOSTA_ANAHTAR` | resend ise | — | Resend API anahtarı |
| `EPOSTA_GONDEREN` | resend ise | — | Gönderen adresi; alan adı doğrulanmış olmalı |
| `UYGULAMA_URL` | evet* | localhost:5173 | Sıfırlama bağlantısının tabanı. *Üretimde şart |

**`/health`** kimlik istemez ve `{ ok, time, izleme }` döner. `izleme` alanı
Sentry'nin gerçekten açık olup olmadığını söyler — DSN'i girip de yazım hatası
yaptıysan burada görürsün.

---

## 2. Render (en kolay yol, telefondan yapılabilir)

`render.yaml` bir Blueprint'tir: render.com → New → Blueprint → depoyu seç.
Render hem sunucuyu hem PostgreSQL'i kurar.

**Tek servis:** API hem oyunu hem arayüzü sunar ve worker'ı kendi içinde
çalıştırır. Ücretsiz katmanda ayrı worker süreci yok; ayrıca tek origin
olduğu için CORS hiç devreye girmiyor.

**Bilinmesi gerekenler:**

- **Veritabanı ve servis aynı bölgede olmalı.** Render'ın iç ağ adresi
  (`dpg-xxxxx-a`) yalnızca aynı bölgedeki servislerden çözülür. Farklı
  bölgede kalırsa Prisma `P1001` verir. `render.yaml`'da ikisi de
  `frankfurt`.
- **Ücretsiz servis uyur.** Bir süre istek gelmezse durur, ilk açılış 30–60
  saniye sürer. Hata değil, katmanın davranışı.
- **Ücretsiz veritabanının ömrü sınırlıdır.** Render ücretsiz PostgreSQL'i
  belli bir süre sonra siler. Gerçek oyuncu almadan önce ücretli katmana
  geç ya da yedeği başka yerde tut (bkz. bölüm 4).
- **Ücretsiz katmanda cron yok.** Yedekleme zamanlaması dışarıdan yapılmalı.

---

## 3. Kendi sunucun (VPS + Docker)

`docker-compose.yml` PostgreSQL ve API'yi ayağa kaldırır.

```bash
cp .env.example apps/api/.env          # değerleri doldur
docker compose up -d
pnpm db:setup                          # migration + tohumlama
```

Önüne bir ters vekil (Caddy/nginx) koyup TLS'i orada bitir. Node'u doğrudan
443'e açma.

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

**Geri yükleme:**

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" yedek/lordlar-....dump
```

Üç kural:

1. **Yedeği veritabanıyla aynı diskte tutmak yedek değildir.** Makine gidince
   ikisi birden gider.
2. **Denenmemiş yedek yedek değildir.** Ayda bir boş bir veritabanına geri
   yükle ve satır say. Script'in kendisi de 10 KB altındaki dump için uyarır —
   boş bir dump sessizce başarılı görünür.
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
pnpm yuk-testi                                # 120 oyuncu
```

Ayrıca:

- [ ] `JWT_SECRET` üretimde rastgele ve en az 32 karakter
- [ ] `NODE_ENV=production` (yoksa `/api/test/*` uçları açık kalır)
- [ ] `SEED_DEMO_LORDS=false` (gerçek oyuncular gelecekse)
- [ ] Yedek alınıyor **ve** bir kez geri yüklenerek denendi
- [ ] `SENTRY_DSN` girildi, `/health` `izleme: acik` diyor
