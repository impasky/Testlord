# Proje haritası

> ÜRETİLİR — elle düzenleme. `pnpm harita` (tools/harita.mjs) yeniden yazar; CI güncel olmayanı reddeder.

## Nasıl kullanılır

- Bir dosyayı, fonksiyonu, bileşeni ya da API ucunu ararken önce BU dosyada ara (ör. `tickLord`, `GET /api/map`, `Kisla`, `e-posta`). Depoda dosya dosya tarama yapma.
- Konudan başlıyorsan aşağıdaki **Konu dizini**ne bak.
- Satır biçimi: `yol` — baştaki yorumun ilk cümlesi · dışa: dışa açılan adlar · uçlar: API uçları · (testi var) = yanında `*.test.*` dosyası var.

## Konu dizini

- **Sayılar ve denge (tek kaynak):** `data/balance.json`, `packages/shared/src/balance.ts`, `tools/check_balance.py`
- **Sunucu açılışı, eklentiler, statik dosyalar, migration:** `apps/api/src/index.ts`, `apps/api/src/migrationDurumu.ts`, `apps/api/src/vtYoklama.ts`
- **Ortam değişkenleri (sunucu ayarları):** `apps/api/src/env.ts`, `.env.example`
- **Oturum, kimlik, giriş/kayıt, parola sıfırlama:** `apps/api/src/auth.ts`, `apps/api/src/routes/auth.ts`, `apps/web/src/screens/Giris.tsx`
- **E-posta doğrulama:** `packages/shared/src/epostaDogrulama.ts`, `apps/api/src/services/epostaDogrulama.ts`, `apps/web/src/screens/EpostaDogrula.tsx`, `docs/17-eposta-dogrulama.md`
- **Lord durumu, tick (kaynak birikmesi), /me:** `apps/api/src/services/lord.ts`, `apps/api/src/routes/me.ts`, `apps/api/src/services/kilit.ts`
- **Aynı anda gelen okumalar (tek uçuş), vadesi gelenleri kapatma:** `apps/api/src/services/tekUcus.ts`, `apps/api/src/services/gecikmis.ts`
- **Kuyruk (inşa, eğitim, araştırma bitişi):** `apps/api/src/services/queue.ts`, `apps/api/src/worker.ts`
- **Ordu, kışla, eğitim:** `apps/api/src/routes/army.ts`, `apps/web/src/screens/Kisla.tsx`, `packages/shared/src/combat.ts`
- **Dünya haritası, yürüyüş, fetih, savaş:** `apps/api/src/routes/map.ts`, `apps/api/src/services/haritaDurumu.ts`, `apps/api/src/services/dunyaBolgeleri.ts`, `apps/api/src/services/march.ts`, `packages/shared/src/harita.ts`, `apps/web/src/screens/Harita.tsx`, `apps/web/src/components/harita/GercekHarita.tsx`, `apps/web/src/components/harita/dunyaGeometri.ts`
- **Gerçek dünya: ülkeler, sınır kuralı, ülke seçimi, göç:** `docs/27-gercek-dunya.md`, `tools/gercek-dunya-uret.mjs`, `packages/shared/src/kanonik.ts`, `packages/shared/src/ulkeler.ts`, `apps/api/src/services/ulke.ts`, `apps/api/src/routes/ulke.ts`, `apps/api/src/services/goc.ts`, `apps/web/src/screens/UlkeSecimi.tsx`, `apps/web/src/screens/Ulkem.tsx`
- **Akın (NPC haritaları):** `apps/api/src/routes/akin.ts`, `apps/api/src/services/akin.ts`, `packages/shared/src/akin.ts`, `apps/web/src/screens/Akin.tsx`
- **Şehir / Malikâne (yerleşke):** `apps/api/src/routes/sehir.ts`, `apps/web/src/screens/Sehir.tsx`
- **Garnizon payı (bölge geliri bölüşümü):** `packages/shared/src/garnizon.ts`, `apps/api/src/services/gelir.ts`
- **İttifak:** `apps/api/src/routes/ittifak.ts`
- **Sohbet ve moderasyon:** `apps/api/src/routes/sohbet.ts`, `apps/api/src/routes/moderasyon.ts`, `apps/web/src/screens/GenelSohbet.tsx`
- **Mağaza (P2S): elmas, hızlandırma, Google Play, AdMob:** `packages/shared/src/magaza.ts`, `apps/api/src/routes/magaza.ts`, `apps/api/src/services/play.ts`, `apps/api/src/services/reklam.ts`, `apps/web/src/screens/Magaza.tsx`, `docs/25-magaza.md`
- **Öğretici ve zorunlu rehber (kâhya ışığı, omurga):** `packages/shared/src/rehber.ts`, `apps/web/src/components/Ogretici.tsx`, `apps/web/src/components/RehberIsigi.tsx`, `apps/web/src/components/Rehber.tsx`
- **Çizim motoru (3B, GPU, kalıcı önbellek):** `apps/web/src/cizim/uc.ts`, `apps/web/src/cizim/Sahne.tsx`, `apps/web/src/cizim/gl.ts`, `apps/web/src/cizim/kalici.ts`
- **Akıcılık, kasma, canlı sahne (bayrak, duman, su, ışık, hava):** `apps/web/src/App.tsx`, `apps/web/src/lib/turOlayi.ts`, `apps/web/src/cizim/Sahne.tsx`, `apps/web/src/cizim/ortamIsci.ts`, `apps/web/src/styles.css`, `apps/web/src/components/HavaKatmani.tsx`, `apps/web/src/screens/yerleskeYakinligi.ts`
- **Arayüz kabuğu, alt gezinme, API istemcisi:** `apps/web/src/App.tsx`, `apps/web/src/components/MobilKabuk.tsx`, `apps/web/src/api/client.ts`
- **Çeviri (Türkçe → İngilizce):** `tools/metin-cikar.mjs`, `tools/ceviri-al.mjs`, `apps/web/vite-ceviri.mjs`, `packages/shared/src/dil.ts`
- **Yayın kontrolü (eksik sunucu ayarları):** `packages/shared/src/yayin.ts`, `apps/api/src/services/yayin.ts`
- **Dağıtım: Render, DigitalOcean, Docker:** `render.yaml`, `.do/deploy.template.yaml`, `Dockerfile`, `docs/05-dagitim.md`
- **Derleme, sıkıştırma, CI:** `apps/web/vite.config.ts`, `apps/web/vite-sikistir.mjs`, `.github/workflows/denetim.yml`
- **Android (Capacitor), APK ve Play paketi:** `apps/mobil/derle.mjs`, `apps/mobil/android/app/build.gradle`, `.github/workflows/android-apk.yml`, `.github/workflows/android-yayin.yml`
- **Veritabanı şeması:** `apps/api/prisma/schema.prisma`, `apps/api/src/db.ts`
- **Uçtan uca testler (zincir):** `package.json`, `tools/lib/kayit.mjs`, `tools/lib/tarayici.mjs`

## Dosyalar

### (kök) — Kök: proje ayarları, dağıtım tanımları

- `.dockerignore` — İmaja girmeyenler.
- `.env.example` — Sunucu ortam değişkenlerinin örneği; gerçek değerler `.env`te (depoda değil)
- `.gitignore` — Git’in yok saydıkları (bağımlılıklar, derleme çıktısı, .env, ekran görüntüleri)
- `.prettierignore` — Prettier’ın biçimlemediği dosyalar (biçimini üreten aracın belirledikleri)
- `.prettierrc` — Prettier ayarları
- `CLAUDE.md` — Claude için çalışma notları
- `Dockerfile` — Lordlar Çağı — tek servis imajı: API + arayüz + worker (docs/05 §3).
- `README.md` — Projeye giriş: kurulum, yerelde çalıştırma, dağıtım özeti
- `docker-compose.yml` — Yerel geliştirme için PostgreSQL (`docker compose up -d`)
- `eslint.config.mjs` — Kök lint yapılandırması.
- `package.json` — Kök betikler: `pnpm build`, `test`, `e2e` (uçtan uca zincir), `ceviri`, `harita`…
- `pnpm-lock.yaml` — pnpm kilit dosyası (üretilir)
- `pnpm-workspace.yaml` — pnpm çalışma alanı: apps/*, packages/*
- `render.yaml` — Render Blueprint — Lordlar Çağı
- `tsconfig.base.json` — Ortak TypeScript ayarları
- `vitest.config.ts` — Birim testlerinin ayarı: packages/** ve apps/** altındaki *.test.ts

### .do — DigitalOcean App Platform kurulum şablonu

- `.do/deploy.template.yaml` — DigitalOcean App Platform — Lordlar Çağı (docs/05 §2).

### .github/workflows — GitHub Actions: CI, Android APK ve Play paketi

- `.github/workflows/android-apk.yml` — Telefona doğrudan kurulan Android paketi (APK) — "indir, kur, oyna".
- `.github/workflows/android-yayin.yml` — Play'e yüklenecek imzalı Android paketi (AAB) — elle başlatılır.
- `.github/workflows/denetim.yml` — Lordlar Çağı — her itişte koşan denetim.

### apps/api — Sunucu paketi (Fastify + Prisma)

- `apps/api/package.json` — paket @lordlar/api
- `apps/api/resim-iscisi.mjs` — Profil resmi sınıflandırıcısı — AYRI BİR İŞ PARÇACIĞINDA.
- `apps/api/tsconfig.json` — Sunucunun TypeScript ayarları
- `apps/api/tsup.config.ts` — Sunucu paketleyicisi (tsup): `dist/` çıktısı

### apps/api/prisma — Veritabanı şeması

- `apps/api/prisma/schema.prisma` — Lordlar Çağı — veri şeması docs/03 §3'ün birebir uygulaması.

### apps/api/src — Sunucu çekirdeği: açılış, ortam, kimlik, worker, betikler

- `apps/api/src/auth.ts` — Parola özeti (argon2) ve `requireAuth`: jeton, yasak, oturum sürümü, e-posta doğrulama kapısı · dışa: JwtPayload, hashPassword, verifyPassword, requireAuth
- `apps/api/src/db.ts` — Prisma istemcisi: bağlantı havuzu ve işlem süreleri · dışa: havuzluAdres, prisma, Tx
- `apps/api/src/diyar-birlestir.ts` — Diyar birleşmesi — elle koşturma ve KURU KOŞU.
- `apps/api/src/dunya-temizle.ts` — Geliştirme veritabanındaki ÖLÜ dünyaları siler.
- `apps/api/src/env.ts` — Bütün sunucu ortam değişkenleri, varsayılanları ve doğrulaması (zod) · dışa: env · ayarlar: DATABASE_URL, JWT_SECRET, PORT, NODE_ENV, WEB_ORIGIN, RUN_WORKER, SERVE_WEB, AUTO_MIGRATE, SEED_DEMO_LORDS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX, VEKIL_SAYISI, PLAY_SERVIS_HESABI, PLAY_API_ADRESI, ADMOB_ANAHTAR_ADRESI, MOBIL_KOKEN, DB_HAVUZU, OLCUM_ANAHTARI, SENTRY_DSN, SENTRY_TRACES_SAMPLE_RATE, EPOSTA_TASIYICI, EPOSTA_ANAHTAR, EPOSTA_GONDEREN, EPOSTA_DOGRULAMA, DESTEK_EPOSTA, UYGULAMA_URL, RENDER_EXTERNAL_URL, RESIM_SINIFLANDIRICI, LOG_LEVEL, VAPID_ACIK_ANAHTAR, VAPID_GIZLI_ANAHTAR, VAPID_ILETISIM
- `apps/api/src/errors.ts` — Oyuncuya gösterilebilir, Türkçe mesajlı hata. · dışa: GameError, hata, benzersizlikIhlali
- `apps/api/src/index.ts` — Sunucunun girişi: eklentiler (sıkıştırma, CORS, JWT, güvenlik başlıkları, yazma sınırı), statik arayüz, uçların kaydı, açılış (veritabanı bekleme, migration, dünya) · dışa: buildServer · uçlar: GET /health
- `apps/api/src/istemciIp.ts` — İSTEMCİNİN IP'Sİ — tek kapı. · dışa: istemciIp, ipKaynagi, istekIzi
- `apps/api/src/izleme.ts` — Hata izleme ve yapılandırılmış log. · dışa: izlemeBaslat, izlemeAcikMi, hataBildir, surecHatalariniYakala
- `apps/api/src/migrationDurumu.ts` — Açılışta bekleyen migration var mı — Prisma CLI'yı başlatmadan. · dışa: MigrationKaydi, bekleyenMigrationlar, migrationKlasorleri · (testi var)
- `apps/api/src/push-anahtari.ts` — VAPID anahtar çifti üretir — push bildiriminin tek kurulum adımı.
- `apps/api/src/seed.ts` — İlk dünyayı açar ve bölgelerini yazar.
- `apps/api/src/vtYoklama.ts` — VERİTABANI YOKLAMASI — "neden ulaşılamıyor" sorusunun cevabı. · dışa: VtYoklama, vtHedefi, veritabaniniYokla, yoklamaOzeti, yoklamaAciklamasi · (testi var)
- `apps/api/src/worker.ts` — Arka plan işçisi. · dışa: tur, startWorker
- `apps/api/src/yayin-kontrolu.ts` — Yayın kontrolü, komut satırından (docs/05 §6).
- `apps/api/src/yonetici.ts` — Yönetici yetkisi ver / al.

### apps/api/src/routes — API uçları (hepsi /api altında)

- `apps/api/src/routes/akin.ts` — Akın uçları: beş NPC haritası, on grup, gerçek savaş (docs/12 §6). · dışa: akinRoutes · uçlar: GET /api/akin, POST /api/akin/onizleme, POST /api/akin, GET /api/akin/:id, POST /api/akin/:id/kisalt
- `apps/api/src/routes/appAds.ts` — /app-ads.txt — AdMob, yayıncının sitesinde bu dosyayı arıyor (Play kaydındaki web sitesinin kökünde, docs/25). · dışa: appAdsRoutes · uçlar: GET /api/app-ads.txt
- `apps/api/src/routes/arastirma.ts` — Araştırma ağacı uçları: durum, başlat, iptal · dışa: arastirmaRoutes · uçlar: GET /api/arastirma, POST /api/arastirma, DELETE /api/arastirma/:id, POST /api/arastirma/yol-birak
- `apps/api/src/routes/army.ts` — Ordu: birim eğitimi, terhis, ordu donanım hatları. · dışa: armyRoutes, armySlots, collectAllUnits, commandCapacity · uçlar: GET /api/army, POST /api/army/train, POST /api/army/disband, POST /api/army/hastane/kisalt, GET /api/gear, POST /api/gear/:line/upgrade
- `apps/api/src/routes/auth.ts` — Kayıt, giriş, parola sıfırlama ve e-posta doğrulama uçları · dışa: authRoutes · uçlar: POST /api/auth/register, POST /api/auth/dogrulama-gonder, POST /api/auth/dogrula, POST /api/auth/login, POST /api/auth/sifirlama-iste, POST /api/auth/sifirlama-yap
- `apps/api/src/routes/dev.ts` — Geliştirme yardımcıları — zamanı ileri sarar. · dışa: devRoutes · uçlar: POST /api/test/kuyruklari-bitir, POST /api/test/kuyruklari-vadesinde-birak, POST /api/test/yuruyusleri-bitir, POST /api/test/akinlari-bitir, POST /api/test/kalkanlari-kaldir, POST /api/test/saat-ilerlet, POST /api/test/npc-yap, POST /api/test/yonetici-yap, POST /api/test/dogrulama-jetonu, POST /api/test/dogrulanmis-yap, POST /api/test/resim-tahmini, POST /api/test/yuklemeleri-eskit, POST /api/test/hesabi-eskit, POST /api/test/lordu-eskit, POST /api/test/diyar-ac, POST /api/test/etkinlik-kayitlari, POST /api/test/npc-turu, POST /api/test/pazar-turu, POST /api/test/xp-ver, POST /api/test/sevkiyatlari-bitir, POST /api/test/ag-izi-gecmise, POST /api/test/ag-izi-temizle, POST /api/test/sevkiyatlari-eskit, POST /api/test/paktlari-bitir, POST /api/test/ittifak-xp, POST /api/test/general-xp, POST /api/test/bolge-sahipsizlestir, POST /api/test/bolgeleri-sifirla, POST /api/test/kaynak-ver
- `apps/api/src/routes/devMagaza.ts` — Mağaza için geliştirme taklitleri (docs/25) — ÜRETİMDE YÜKLENMEZ. · dışa: devMagazaRoutes · uçlar: POST /api/test/play/token, GET /api${kok}/products/:urun/tokens/:jeton, POST /api${kok}/products/:urun/tokens/:jetonVeIs, GET /api${kok}/voidedpurchases, POST /api/test/play/satin-al, POST /api/test/play/iade, GET /api/test/play/durum, POST /api/test/play/kesinti, POST /api/test/play-tara, POST /api/test/reklam/izle, POST /api/test/reklam/bekleme-gecir, POST /api/test/reklam/saklama
- `apps/api/src/routes/diyarEtkinligi.ts` — Hafta sonu diyar seferi (docs/09 §2.6) — ortak hedef, ortak ödül. · dışa: diyarEtkinligiRoutes · uçlar: GET /api/diyar-etkinligi, POST /api/diyar-etkinligi/odul
- `apps/api/src/routes/dunya.ts` — Dünya (shard) özeti. · dışa: dunyaRoutes · uçlar: GET /api/destek, GET /api/diyarlar, GET /api/dunya
- `apps/api/src/routes/esyaPazari.ts` — Eşya pazarı uçları (docs/19). · dışa: esyaPazariRoutes · uçlar: GET /api/esya-pazari, GET /api/esya-pazari/urun, POST /api/esya-pazari/ilan, POST /api/esya-pazari/ilan/:id/fiyat, POST /api/esya-pazari/ilan/:id/geri-cek, POST /api/esya-pazari/siparis, POST /api/esya-pazari/siparis/:id/fiyat, POST /api/esya-pazari/siparis/:id/iptal, POST /api/esya-pazari/kasa/al
- `apps/api/src/routes/generals.ts` — Generaller: kadro, kiralama, slot atama. · dışa: generalRoutes · uçlar: GET /api/generals, POST /api/generals/:key/uzmanlik, POST /api/generals/:key/hire, POST /api/generals/:key/assign
- `apps/api/src/routes/gunluk.ts` — Günlük görevler ve giriş serisi. · dışa: gunlukRoutes · uçlar: GET /api/gunluk, POST /api/gunluk/odul
- `apps/api/src/routes/items.ts` — Ekipman: üretim, kuşanma, yükseltme, satış. · dışa: itemRoutes · uçlar: GET /api/items, POST /api/items/craft, POST /api/items/:id/equip, POST /api/items/:id/upgrade, POST /api/items/:id/sell
- `apps/api/src/routes/ittifak.ts` — İttifak: kur, katıl, ayrıl, üye çıkar. · dışa: ittifakRoutes, ayniIttifaktaMi · uçlar: GET /api/ittifak, POST /api/ittifak/kur, POST /api/ittifak/:id/katil, POST /api/ittifak/ayril, GET /api/ittifak/sohbet, POST /api/ittifak/sohbet, POST /api/ittifak/sohbet/rapor, POST /api/ittifak/hedef, POST /api/ittifak/uye-cikar, POST /api/ittifak/arma, POST /api/ittifak/ayarlar, POST /api/ittifak/:id/basvur, POST /api/ittifak/basvuru/:id/geri-cek, GET /api/ittifak/basvurular, POST /api/ittifak/basvuru/:id/karar, GET /api/ittifak/kayit, GET /api/ittifak/:id/incele, GET /api/ittifak/paktlar, POST /api/ittifak/pakt, POST /api/ittifak/pakt/:id/kabul, POST /api/ittifak/pakt/:id/reddet, POST /api/ittifak/pakt/:id/fesih, GET /api/ittifak/bagis, POST /api/ittifak/bagis, POST /api/ittifak/duyuru, POST /api/ittifak/rutbe
- `apps/api/src/routes/magaza.ts` — Mağaza uçları (docs/25): durum, hızlandırma, Play satın alma, ödüllü reklam. · dışa: magazaRoutes · uçlar: GET /api/magaza, POST /api/kuyruk/:id/hizlandir, POST /api/magaza/play/dogrula, POST /api/reklam/oturum, GET /api/reklam/oturum/:id, GET /api/reklam/ssv
- `apps/api/src/routes/map.ts` — Harita, bölgeler, yürüyüş ve savaş. · dışa: mapRoutes · uçlar: GET /api/map, GET /api/harita, GET /api/harita/bolgeler/:worldId, GET /api/map/:id, POST /api/map/:id/upgrade, POST /api/map/:id/kesif, POST /api/map/:id/takviye, POST /api/map/:id/takviye-geri, POST /api/map/:id/garrison, POST /api/battle/preview, POST /api/march, DELETE /api/march/:id, POST /api/map/:id/birak, GET /api/marches, GET /api/battles, GET /api/battles/:id
- `apps/api/src/routes/me.ts` — Lordun durumu (`/me`), arma, istatistik puanı, öğretici/rehber bitişi, savunma düzeni · dışa: meRoutes · uçlar: GET /api/me, POST /api/me/arma, POST /api/me/stats, POST /api/me/ogretici-bitti, GET /api/me/savunma-duzeni, PUT /api/me/savunma-duzeni, POST /api/me/rehber-bitti, POST /api/me/ogretici-sifirla, POST /api/me/parola, DELETE /api/me
- `apps/api/src/routes/moderasyon.ts` — Moderasyon uçları. · dışa: moderasyonRoutes, GIZLI_MESAJ, SILINMIS_MESAJ · uçlar: GET /api/engel, POST /api/engel/:lordId, DELETE /api/engel/:lordId, GET /api/moderasyon/sebepler, GET /api/moderasyon/durum, POST /api/rapor/mesaj/:mesajId, POST /api/rapor/genel/:mesajId, POST /api/rapor/resim/:lordId, GET /api/moderasyon/kuyruk, POST /api/moderasyon/karar, GET /api/moderasyon/resimler, POST /api/moderasyon/resim/:id, POST /api/moderasyon/susturma-kaldir
- `apps/api/src/routes/olcum.ts` — İlk oturum ölçümü. · dışa: olcumRoutes · uçlar: GET /api/olcum
- `apps/api/src/routes/pazar.ts` — Malikâne pazarı: kaynak takası. · dışa: pazarRoutes · uçlar: GET /api/pazar, POST /api/pazar/takas
- `apps/api/src/routes/profil.ts` — Profil uçları: profil kartı, profil resmi seçme ve yükleme. · dışa: profilRoutes · uçlar: GET /api/lord/:lordId/profil, GET /api/profil/resim, PUT /api/profil/resim, POST /api/profil/resim/yukle, GET /api/profil-resmi/:id
- `apps/api/src/routes/push.ts` — Push bildirimi abonelikleri (docs/07 M14). · dışa: pushRoutes · uçlar: GET /api/push/anahtar, POST /api/push/abone, POST /api/push/cik, GET /api/push/tercih, PUT /api/push/tercih, POST /api/push/deneme
- `apps/api/src/routes/rankings.ts` — Üç sıralama (docs/01 §8). · dışa: rankingRoutes · uçlar: GET /api/rankings/:board, GET /api/rankings-ittifak, POST /api/rapor/:lordId
- `apps/api/src/routes/sefer.ts` — Haftalık sefer. · dışa: seferRoutes · uçlar: GET /api/sefer, POST /api/sefer/odul
- `apps/api/src/routes/sehir.ts` — Şehir (yerleşim) uçları. · dışa: sehirRoutes · uçlar: GET /api/sehir, POST /api/sehir/bina, POST /api/sehir/baskent, DELETE /api/sehir/bina/:id
- `apps/api/src/routes/sohbet.ts` — Genel sohbet — bütün oyuncuların tek kanalı. · dışa: sohbetRoutes · uçlar: GET /api/sohbet/genel, GET /api/sohbet/genel/son, POST /api/sohbet/genel
- `apps/api/src/routes/ticaret.ts` — İttifak içi kaynak gönderimi (docs/09 B6). · dışa: ticaretRoutes, yukAgirligi · uçlar: GET /api/ticaret, POST /api/ticaret/gonder
- `apps/api/src/routes/ulke.ts` — ÜLKE UÇLARI (docs/27): ülke listesi, ülkem, ülke seçimi. · dışa: ulkeRoutes · uçlar: GET /api/ulkeler, GET /api/ulke, POST /api/ulke/sec
- `apps/api/src/routes/yonetici.ts` — YÖNETİCİ PANELİ — şikâyet beklemeden oyuncuya bakmak. · dışa: yoneticiRoutes · uçlar: GET /api/yonetici/ayarlar, GET /api/yonetici/yayin-kontrolu, GET /api/yonetici/olcum, GET /api/yonetici/coklu-hesap, GET /api/yonetici/ara, GET /api/yonetici/oyuncu/:lordId, POST /api/yonetici/oyuncu/:lordId/sustur, POST /api/yonetici/oyuncu/:lordId/susturma-kaldir, POST /api/yonetici/oyuncu/:lordId/yasakla, POST /api/yonetici/oyuncu/:lordId/yasak-kaldir, POST /api/yonetici/mesaj/:mesajId/kaldir

### apps/api/src/services — Sunucu iş mantığı (uçların ve worker’ın kullandığı)

- `apps/api/src/services/adDenetimi.ts` — Lord adı denetimi. · dışa: normalize, YASAKLI, AdSonucu, adiDenetle, lordAdiAnahtari, bosLordAdi · (testi var)
- `apps/api/src/services/adaySirasi.ts` — Hedef adaylarının sıralaması — eşitlikte BELİRLİ. · dışa: SiralanabilirAday, puanaGore · (testi var)
- `apps/api/src/services/admob.ts` — AdMob ödüllü reklam — sunucu tarafı doğrulama (SSV, docs/25). · dışa: SsvAlanlari, ssvParcala, ssvDogrula, birimBizimMi, odulBirimi, GELISTIRME_KEY_ID, gelistirmeSsvSorgusu · (testi var)
- `apps/api/src/services/ag.ts` — Ağ adresi hesapları — SAF (ortam ayarı okumuyor, test edilebilir). · dışa: Basliklar, tekDeger, IpAyari, ipSec, agAnahtari, agOzeti · (testi var)
- `apps/api/src/services/agIzi.ts` — Ağ izi — çoklu hesap şüphesi için IP'nin gizli anahtarlı özeti. · dışa: agIziYaz, eskiAgIzleriniSil
- `apps/api/src/services/akin.ts` — Akın çözümü: NPC grubuna gidilir, savaşılır, dönülür — tek adımda. · dışa: resolveAkin, gecikmisAkinlariCoz, akinVuruslari, sahadakiAkinlar, akindakiOrdu
- `apps/api/src/services/birlesme.ts` — Diyar birleşmesi — planlama ve uygulama. · dışa: BirlesmeOzeti, birlesmeyiPlanla, vaktiGelenBirlesmeler, birlesmeyiUygula, bekleyenBirlesmeleriUygula
- `apps/api/src/services/demoWorld.ts` — Test dağıtımı için dünyaya rakip lordlar ekler. · dışa: seedDemoLords, toplamXp
- `apps/api/src/services/dunyaBolgeleri.ts` — Dünyanın DEĞİŞMEYEN bölge bilgisi — bellekte, dünya başına bir kez. · dışa: SabitBolge, DunyaBolgeleri, dunyaBolgeleri, dunyaBolgeleriniUnut, statikSikistirilmis
- `apps/api/src/services/eposta.ts` — E-posta gönderimi. · dışa: Posta, postaGonder
- `apps/api/src/services/epostaDogrulama.ts` — E-posta doğrulama — veritabanına ve postaya dokunan kısım. · dışa: ozet, hesapDogrulamaDurumu, dogrulamaGonder, dogrulamaKontrol
- `apps/api/src/services/esyaPazari.ts` — Eşya pazarının veritabanı tarafı (docs/19). · dışa: FiyatSatiri, grubu, urunu, zar, tl, grupKilitle, tabanOku, grubunBandi, lordlariKilitle, pazarDegisti, defterOku, emir, eslesebilirIlanlar, Takas, TakasSonucu, takasYap +5
- `apps/api/src/services/gecikmis.ts` — Vadesi gelmiş işleri okuma anında kapatan tek kapı. · dışa: gecikmisleriKapat
- `apps/api/src/services/gelir.ts` — GARNİZON PAYI — bölge geliri orada DURANIN (docs/16 §6, docs/27). · dışa: GelirPayiGirdisi, garnizonPayGirdileri
- `apps/api/src/services/girisFreni.ts` — Hesap başına giriş freni — parola tahminine karşı. · dışa: HATA_TAVANI, PENCERE_MS, girisFreniKur, girisFreni · (testi var)
- `apps/api/src/services/goc.ts` — GÖÇ — eski kuşak haritadaki dünyayı gerçek dünyaya taşır (docs/27). · dışa: GocOzeti, dunyayiGocur, eskiDunyalariGocur
- `apps/api/src/services/haritaDurumu.ts` — Haritanın oyuncuya göre DEĞİŞEN hâli — `/map` ve `/harita` aynı hesabı kullanıyor. · dışa: OzelBolge, HaritaDurumu, haritaDurumu
- `apps/api/src/services/hedef.ts` — "Şimdi neye saldırmalıyım?" · dışa: lordSide, HedefOnerisi, onerilenHedef, EksikOrdu, FetihOdulu, fetihOdulu, EkipmanEtkisi, ekipmanEtkisi, onizlemeTohumu, savasOrneklemesi, taramaSonucu, SavasOrneklemesi, TaramaSonucu
- `apps/api/src/services/hizlandirma.ts` — Kuyruk hızlandırma — elmasla, reklam bankasıyla ya da reklam ödülüyle (docs/25). · dışa: KuyrukDurumu, hizlandirilacakKuyruk, kuyruguKisalt
- `apps/api/src/services/ittifakSeviye.ts` — İttifak seviyesi ve ayrıcalıkları — tek okuma noktası. · dışa: ittifakAyricaligi, lordunAyricaligi
- `apps/api/src/services/kilit.ts` — Lord satırı kilidi — çift harcamaya karşı. · dışa: lordKilitle, lordIslemi
- `apps/api/src/services/lord.ts` — Lord durumunun yüklenmesi ve "lazy accrual" tick'i. · dışa: LordState, equippedGenerals, gearBonusFrom, okuArastirmalar, arastirmaBonusuOku, binalariOku, calcHourlyIncome, lordArmasi, tickLord, findLordByUser, grantXp, pushEvent, armyPower, collectAllUnits, collectUnitsAt
- `apps/api/src/services/march.ts` — Yürüyüş çözümü: saldırı savaşı ve dönüş. · dışa: buildSide, npcSide, liderAviGecerli, resolveMarch, saldiriBildirimi, gecikmisYuruyusleriCoz
- `apps/api/src/services/mesafe.ts` — "Bu bölge bana ne kadar uzak?" — tek yerden. · dışa: Mesafeci, dunyaGrafigi, grafigiUnut, mesafeOlcer, SinirOlcer, sinirOlcer, sinirOlcerHazir, mesafeOlcerHazir, lordlarArasiMesafe
- `apps/api/src/services/mesajDenetimi.ts` — Sohbet mesajı denetimi. · dışa: MesajSonucu, mesajDenetle
- `apps/api/src/services/moderasyon.ts` — Moderasyon yardımcıları: yetki, susturma kontrolü, karar kaydı. · dışa: requireYonetici, susturmaKontrol, kararKaydet, sikayetKaydet
- `apps/api/src/services/npc.ts` — RAKİP LORDLAR HAREKET EDİYOR. · dışa: NpcIsi, NpcTurSonucu, npcTuru, npcYap, npcYapVeOynat, npcAyarlari
- `apps/api/src/services/olcumHesabi.ts` — Yönetici ölçüm panosu (docs/05 §7): günlük aktif oyuncu ve 1./7. gün tutundurma. · dışa: PANO_GUN, PanoGirdisi, Kohort, OlcumPanosu, panoHesapla · (testi var)
- `apps/api/src/services/olcumPanosu.ts` — Yönetici ölçüm panosu — veritabanı tarafı. · dışa: olcumPanosu, aktiflikYaz, OlcumPanosu
- `apps/api/src/services/pakt.ts` — Pakt sorguları — "bu iki ittifak arasında yürürlükte bir pakt var mı". · dışa: paktVarMi, paktliIttifaklar, yururlukteMi
- `apps/api/src/services/play.ts` — Google Play Developer API — yalnız üç çağrı, SDK'sız (docs/25). · dışa: playAyari, playHesabiBozukMu, playAyariniUnut, jwtImzala, PlayHatasi, PlaySatinAlma, satinAlmaGetir, tuket, PlayIade, iadeler, hesapEtiketi, jetonIzi
- `apps/api/src/services/profil.ts` — Profil: oyuncunun öteki oyunculara görünen yüzü. · dışa: YAZAR_SEC, YazarGorunumu, yazarGorunumu, profilKarti, resmiOnayla, resmiKaldir
- `apps/api/src/services/push.ts` — PUSH BİLDİRİMİ — oyuncuyu geri çağıran tek kanal (docs/07 M14). · dışa: acikAnahtar, Abonelik, aboneOl, abonelikBirak, Bildirim, bildirimGonder, cihazSayisi
- `apps/api/src/services/pushPolitika.ts` — Push gönderimi başarısız olunca ne yapılır — SAF karar. · dışa: GonderimKarari, gonderimKarari, pushAdresiGecerli, AZAMI_ABONELIK · (testi var)
- `apps/api/src/services/queue.ts` — Kuyruk altyapısı: eğitim, üretim, yükseltme. · dışa: QueueKind, hastaneyeYatir, spendResources, addUnitsHome, evdenCikar, addUnitsRegion, enqueue, assertQueueSlot, resolveQueueItem, gecikmisIsleriCoz, craftPrice, upgradeCost
- `apps/api/src/services/region.ts` — Bölge geliri ve yağmalanabilir depo. · dışa: regionStoreCap, regionUpgradeCost, regionFortressBonus, bolgeTahkimati, regenerateNpcGarrison, accrueRegionStores, transferRegion, baskentiDusur
- `apps/api/src/services/reklam.ts` — Ödüllü reklam — oturum ve ödül (docs/25). · dışa: reklamGecmisi, oturumAc, eskiReklamOturumlariniSil, SsvSonucu, ssvIsle
- `apps/api/src/services/resimDenetimi.ts` — Profil resmi: hazırlama ve otomatik denetim. · dışa: HazirResim, resmiHazirla, resmiSiniflandir, testTahminiKoy, testTahmini
- `apps/api/src/services/satinAlma.ts` — Elmas satın alma — doğrulama, verme, tüketme, iade (docs/25). · dışa: DogrulamaSonucu, satinAlmayiDogrula, tuketilmeyenleriTuket, iadeleriIsle
- `apps/api/src/services/tekUcus.ts` — AYNI ANDA gelen okumaları TEK işe indirmek. · dışa: yazmaSiniri, tekUcus, ucustakiSayisi · (testi var)
- `apps/api/src/services/ticaret.ts` — Sevkiyat servisi: gönderilen kaynağın yolda geçen süresi ve varışı. · dışa: bugunGonderilen, sevkiyatOzeti, sevkiyatCoz
- `apps/api/src/services/ulke.ts` — ÜLKE SEÇİMİ (docs/27) — oyuncu bir ülke seçiyor, kampı orada kuruluyor. · dışa: kampYeri, ulkeDogrula, ulkeSec
- `apps/api/src/services/world.ts` — Dünya (shard) yönetimi. · dışa: haritaSatirlari, createWorld, diyarDoluMu, AcikDiyar, AKTIF_GUN, acikDiyarlar, findOrOpenWorld, TazelemeKarari, tazelemeKarari, refreshWorldRegions, eskiHaritaliDunyayiKapat
- `apps/api/src/services/yayin.ts` — Yayın kontrolünün sunucu yanı: girdiyi toplar (bkz. shared `yayin.ts`). · dışa: yayinKontrolu, kurulumMu, yayinRaporu

### apps/mobil — Android kabuğu (Capacitor)

- `apps/mobil/capacitor.config.json` — Capacitor: paket adı, web klasörü, https şeması
- `apps/mobil/derle.mjs` — Android paketini hazırlar: arayüzü oyun sunucusunun adresiyle derler ve Capacitor'a kopyalar (docs/25).
- `apps/mobil/package.json` — Android kabuğu (Capacitor): web arayüzünü paketin içinden sunar, Play Faturalandırma ve AdMob eklentilerini taşır (docs/25).

### apps/mobil/android/app

- `apps/mobil/android/app/build.gradle` — Android derlemesi: release (Play AAB), deneme (doğrudan APK), debug; imza ve AdMob kimliği ortamdan

### apps/mobil/android/app/src/deneme/res/values

- `apps/mobil/android/app/src/deneme/res/values/strings.xml` — Deneme APK'sının adı: Play sürümüyle aynı telefonda karışmasın (build.gradle → deneme).

### apps/mobil/android/app/src/main

- `apps/mobil/android/app/src/main/AndroidManifest.xml` — Android manifestosu: izinler, AdMob uygulama kimliği

### apps/web — Arayüz paketi (React + Vite)

- `apps/web/index.html` — Arayüzün HTML kabuğu
- `apps/web/package.json` — paket @lordlar/web
- `apps/web/tsconfig.json` — Arayüzün TypeScript ayarları
- `apps/web/vite-ceviri.mjs` — ÇEVİRİ EKLENTİSİ — derlerken metinleri `__t()` ile sarar. · dışa: ceviriEklentisi
- `apps/web/vite-cizim-surumu.mjs` — ÇİZİM SÜRÜMÜ — kalıcı çizim deposunun (`src/cizim/kalici.ts`) anahtarı. · dışa: cizimSurumu
- `apps/web/vite-sikistir.mjs` — DERLEMEDE SIKIŞTIRMA — her metin dosyasının yanına `.br` ve `.gz`. · dışa: derlemeSikistirma
- `apps/web/vite.config.ts` — Vite: çeviri ve çizim sürümü eklentileri, derlemede sıkıştırma

### apps/web/public — Olduğu gibi sunulan dosyalar (PWA, simgeler, push işçisi)

- `apps/web/public/manifest.webmanifest` — PWA manifestosu
- `apps/web/public/sw.js` — Lordlar Çağı — service worker.

### apps/web/src — Arayüz girişi

- `apps/web/src/App.tsx` — Arayüzün kökü: oturum, ekran yönlendirmesi, öğretici/rehber, sorgu ön yüklemesi · dışa: App
- `apps/web/src/main.tsx` — Arayüzün girişi: React kökü, sorgu istemcisi, yazı tipi, dil
- `apps/web/src/rehberDurumu.ts` — Rehberin aşamalarını kapatan oyun durumu. · dışa: useRehberDurumu
- `apps/web/src/styles.css` — Genel stiller: Tailwind, renk değişkenleri, animasyonlar

### apps/web/src/api — Sunucuyla konuşan istemci

- `apps/web/src/api/client.ts` — Tipli API istemcisi. · dışa: getToken, setToken, ApiError, LordState, QueueItem, GameEvent, MeResponse, YoklukOzeti, ItemDto, UrunDto, PazarBandiDto, PazarEmriDto, EsyaPazariDto, DefterSatiriDto, UrunDefteriDto, IlanSonucuDto +78

### apps/web/src/ceviri

- `apps/web/src/ceviri/en-kaliplar.json` — Arayüzün İngilizce kalıpları — {0} yer tutuculu cümleler (üretilir)
- `apps/web/src/ceviri/en.json` — Arayüzün İngilizce sözlüğü (üretilir)

### apps/web/src/cizim — Çizim motoru: 3B modeller, GPU, kalıcı resim önbelleği

- `apps/web/src/cizim/Cizimler.tsx` — Oyunun kullandığı çizim bileşenleri — ekranlar yalnız buradan alıyor (docs/24). · dışa: CIZILEN_BINALAR, BinaCizimi, YerlesimCizimi, CIZILEN_BOLGELER, BolgeCizimi, nesneCizimiVar, NesneCizimi, portreCizimiVar, PortreCizimi, YolCizimi, DiyarCizimi, DunyaKucuk, CIZILEN_ZEMINLER, ZeminCizimi, SavasCizimi
- `apps/web/src/cizim/Galeri.tsx` — Çizim galerisi: koddan çizilen her görsel tek sayfada (docs/24). · dışa: Galeri
- `apps/web/src/cizim/Sahne.tsx` — Bir 3B modeli SVG olarak çizer (docs/24). · dışa: cizimiAl, OnceKaba, Cokgenler, Sahne
- `apps/web/src/cizim/arazi.ts` — ARAZİ — düşük çokgenli yükseklik alanı (docs/24). · dışa: Yukseklik, Nokta, gurultu, yumusakAdim, gecis, tepe, cizgiyeUzaklik, nehirOy, Duzluk, duzle, yumusat, AraziAyari, arazi, yerYolu, parsel, ekrandanYere
- `apps/web/src/cizim/bayrakAni.ts` — Dalgalanan bayrak ve salınan sancak (docs/24 "Hareket"): kumaşın bir turu, GPU için. · dışa: BAYRAK_KARE, bayrakGruplari, bayrakKareleri, kareleriKur, AGAC_SURE, ASKER_SURE, BAYRAK_SURE, SANCAK_SURE
- `apps/web/src/cizim/binalar.ts` — ŞEHİR YAPILARI — 12 bina × 3 aşama + arsa, görev panosu, haberci kulesi, onur meydanı (docs/24). · dışa: BINA_KUTUSU, kukla, mizrakSehpasi, ates, ors, ocak, BINA_ADLARI, binaModeli, TABELA
- `apps/web/src/cizim/birlikler.ts` — BİRLİK, DÜŞMAN VE EKİPMAN ÇİZİMLERİ (docs/24). · dışa: Kademe, KADEME, BIRLIK_ADLARI, DUSMAN_ADLARI, EKIPMAN_ADLARI, birlikModeli, dusmanModeli, ekipmanModeli
- `apps/web/src/cizim/bolgeler.ts` — BÖLGE SAHNELERİ — köy, tarla, maden, şehir, kale, taht × 3 aşama (docs/24). · dışa: BolgeTipi, Asama, BOLGE_TIPLERI, BOLGE_SAHNELERI, BOLGE_KUTUSU, VARYANT_EKI, bolgeVaryanti, bolgeAdiCoz, bolgeModeli
- `apps/web/src/cizim/canli.ts` — Canlı yerleşke (docs/24 "Hareket"): talim alanında ok atan okçular, kuklaya mızrak saplayan mızrakçılar, iki uçtan birbirine at süren şövalyeler;… · dışa: canlandir, OKCU_KARE, OKCU_SURE, OKCU_MENZIL, okcuPoz, okHedefi, MIZRAK_KARE, MIZRAK_SURE, KUKLA_UZAK, mizrakciPoz, DUELLO_KARE, DUELLO_SURE, DUELLO_YARI, DUELLO_ARALIK, duelloPoz, duelloAlani +12
- `apps/web/src/cizim/cayir.ts` — ÇAYIR — yerleşkenin zemini ve otları (docs/24 "Çayır"). · dışa: cayirZemini, otlar, yolKenari
- `apps/web/src/cizim/cevre.ts` — YERLEŞKENİN ÇEVRESİ (docs/24): kasabayı saran köy hayatı ve doğa. · dışa: doluMu, evAyari, bostan, cevre
- `apps/web/src/cizim/cizim.test.ts`
- `apps/web/src/cizim/cizimOlcumu.ts` — Telefonda çizim ölçümü (docs/24 "Telefonda ölçüm"). · dışa: olcumAcik, olcumuKapat, olcumuAc, CizimKaydi, olcumKaydet, olcumKayitlari, temizlenmeAni, olcumuTemizle, olcumuDinle, olcerek, kisaAd, ozet, TakilmaKaydi, KARE_ESIGI, takilmaKaydet, takilmalar +9 · (testi var)
- `apps/web/src/cizim/diyarlar.ts` — AKIN DİYARLARI — beş diyarın kapağı (16:9) ve haritası (kare) (docs/24). · dışa: DIYAR_ADLARI, Diyar, Kadraj, KAPAK_KUTUSU, HARITA_KUTUSU, diyarModeli
- `apps/web/src/cizim/duman.ts` — Canlı dumanın kaynakları (docs/24 "Hareket"): hareketli GPU resminde duman yok; sayfada CSS yumruları olarak yükseliyor. · dışa: DumanKaynagi, dumanKaynaklari
- `apps/web/src/cizim/figur.ts` — FİGÜRLER — asker, düşman, at, mancınık (docs/24). · dışa: BaslikTipi, EsyaTipi, Esya, Insan, kalkan, kilicModeli, insan, AtAyari, at, mancinik
- `apps/web/src/cizim/gl.ts` — GPU çiziminin kapısı (docs/24): sıra, önbellek ve işçi. · dışa: GlIstek, Katmanlar, glKatmanlari, glVarMi, glKatmanBlobu, KismiAlan, glCiz, glOnceden, glBirak, seritKutusu, glSerit, glSeritKes, glKaydet, glKalici, glOnYukle, EN_BUYUK +3 · (testi var)
- `apps/web/src/cizim/glAg.ts` — Modelden GPU ağı (docs/24). · dışa: KOSE, DOKU_NO, dokuBul, Ag, agYap
- `apps/web/src/cizim/glCizici.ts` — GPU ÇİZİMİ (WebGL2) — aynı 3B model, tarayıcının izin verdiği en temiz hâliyle (docs/24). · dışa: EN_BUYUK, yazilimMi, sayfalaraYerlestir, goruntuMatrisi, CizimIstegi, KismiSonuc, KismiGonder, ornekSayisi, aoYaricapi, BayrakKareleri, BayrakAtlasi, CizimSonucu, atlasDuzeni, IsciIstegi, IsciCevabi, aktarilanlar +3
- `apps/web/src/cizim/glIsci.ts` — GPU çizim işçisi (docs/24): `glCizici`yi ana iş parçacığının dışında koşturuyor.
- `apps/web/src/cizim/hava.ts` — Hava (docs/24 "Hava") — yalnız görsel, ara sıra. · dışa: Hava, HAVALAR, HAVA_DILIMI_SAAT, havaDurumu, havaDilimSonu · (testi var)
- `apps/web/src/cizim/kalabalik.ts` — KALABALIK — yerleşkenin insanları ve evleri (docs/24 "Kalabalık"). · dışa: KalabalikAyari, kalabalik
- `apps/web/src/cizim/kalici.ts` — Kalıcı çizim deposu (docs/24 "Yakınlaştırma"): GPU resimleri cihazda, IndexedDB'de. · dışa: KaliciGrup, SINIR, KaliciKayit, kaliciOku, kaliciYaz, KaliciDurum, kaliciDurumu · (testi var)
- `apps/web/src/cizim/kir.ts` — KIR VE KALE PARÇALARI — bölge sahnelerinin ölçeğinde (docs/24). · dışa: EvAyari, ev, ambar, degirmen, balya, araba, kuyuKucuk, citKisa, tezgah, kilise, katedral, kopru, tahtaKopru, suDegirmeni, madenAgzi, kuyuKulesi +15
- `apps/web/src/cizim/kisiler.ts` — GENERALLER, LORD VE PORTRELER (docs/24). · dışa: GENERAL_ADLARI, LORD_ADLARI, PORTRE_ADLARI, generalModeli, giyimliLord, lordModeli, kusamAdiMi, portreModeli, PORTRE_KUTUSU
- `apps/web/src/cizim/ortam.ts` — Canlı sahnenin ortam katmanları (docs/24 "Hareket", "Ortam tuvali"): su parıltısı, çimende rüzgâr, ışık titremesi. · dışa: tohumlu, Ciz2B, leke, SU_KARO, suDeseni, RUZGAR_KARO, ruzgarDeseni, ISIK_KARO, isikLekeleri, SU_A, SU_B, SU_SAYDAM, RUZGAR, CIMEN_SAYDAM, ISIK_A, ISIK_B +7 · (testi var)
- `apps/web/src/cizim/ortamIsci.ts` — / <reference lib="webworker" />
- `apps/web/src/cizim/ortamTuvali.ts` — Ortam tuvalinin sayfa yanı (docs/24 "Ortam tuvali"): işçi (`ortamIsci.ts`) tek, tuvaller kimlikle. · dışa: OrtamTuvali, ortamTuvaliKur
- `apps/web/src/cizim/parca.ts` — MİMARİ VE DOĞA PARÇALARI (docs/24). · dışa: Yon, zeminPlakasi, doseme, yuzeyKutusu, ince, pencere, kapi, fener, Ikon, tabela, kirisler, tasDokusu, baca, duman, BAYRAK_FAZ, SANCAK_FAZ +28
- `apps/web/src/cizim/parmakizi.json` — Görsel bozulma testinin kayıtlı izleri
- `apps/web/src/cizim/parmakizi.ts` — ÇİZİMİN PARMAK İZİ — görsel bozulma testi (docs/24 "Görsel bozulma testi"). · dışa: ParmakIzi, parmakIzi, PAY, karsilastir · (testi var)
- `apps/web/src/cizim/rastgele.ts` — Tohumlu rastgele sayı: aynı anahtar her zaman aynı çizimi verir. · dışa: tohum, rastgele, aralik
- `apps/web/src/cizim/renk.ts` — Renk yardımcıları ve ortak palet (docs/24). · dışa: Rgb, rgb, hex, isikla, karistir, P
- `apps/web/src/cizim/savas.ts` — SAVAŞ SAHNESİ — raporun tepesinde iki ordunun karşılaştığı tek kare (docs/09 §4.2 G4, docs/24). · dışa: SAVAS_KUTUSU, SavasGirdisi, savasAnahtari, savasModeli · (testi var)
- `apps/web/src/cizim/tarif.ts` — Çizim tarifleri (docs/24): sahnenin anahtarından modeli. · dışa: tarifModeli
- `apps/web/src/cizim/uc.ts` — KÜÇÜK 3B MOTOR — bütün nesne çizimlerinin ortak dili (docs/24). · dışa: V3, Doku, Yuz, Model, normal, tasi, olcekle, dondur, parlat, dokula, oneAl, katmanla, boya, kutu, prizma, cember +24
- `apps/web/src/cizim/vakit.ts` — Günün saatine göre ışık (docs/24 "Günün saati") — yalnız görsel. · dışa: Vakit, VAKITLER, gununVakti, sonrakiVakit, sonrakiVakitAni, VakitIsigi, VAKIT_ISIGI, vakitAnahtari · (testi var)
- `apps/web/src/cizim/yerlesim.ts` — YERLEŞİM ZEMİNİ — kamp, köy, kasaba, şehir, kale, metropol (docs/24). · dışa: Kademe, KASABA_KUTUSU, YERLESIM_KUTUSU, BINA_YUVALARI, YERLESIM_KADEMELERI, YERLESIM_OLCEK, yerlesimModeli, BINA_TABAN_BOY, YerlesimBinasi, yerlesimAnahtari, yerlesimAnahtariCoz, sahneBinasi, YURUYEN, yerlesimMerkezi, ASAMA_BUYUME, yerlesimNoktasi +1
- `apps/web/src/cizim/zeminler.ts` — EKRAN ZEMİNLERİ — her sekmenin tepesindeki manzara şeridi (docs/24). · dışa: ZEMIN_ADLARI, ZeminAdi, ZEMIN_KUTUSU, zeminModeli

### apps/web/src/components — Ortak bileşenler

- `apps/web/src/components/Arma.tsx` — Arma: oyuncunun heraldik kimliği. · dışa: Arma, armaParcaAdi
- `apps/web/src/components/ArmaSecici.tsx` — Arma seçici. · dışa: ArmaSecici
- `apps/web/src/components/BaglantiDurumu.tsx` — Bağlantı durumu şeridi. · dışa: BaglantiDurumu
- `apps/web/src/components/Basarimlar.tsx` — Başarımlar kartı. · dışa: Basarimlar
- `apps/web/src/components/BildirimKarti.tsx` — BİLDİRİM KARTI — Hesap ekranındaki izin anahtarı. · dışa: BildirimKarti
- `apps/web/src/components/BildirimTercihleri.tsx` — Bildirim tercihleri (docs/12 §17): konu konu aç/kapat ve sessiz saatler. · dışa: BildirimTercihleri
- `apps/web/src/components/BosHal.tsx` — Boş hâl — "yapacak bir şey yok" demeyen ekran. · dışa: BosHalEylemi, BosHal
- `apps/web/src/components/CizimOlcumPaneli.tsx` — Telefonda çizim ölçümü panosu (`?olcum=1`, bkz. `cizim/cizimOlcumu.ts`). · dışa: CizimOlcumPaneli
- `apps/web/src/components/Cumle.tsx` — CÜMLE — vurgulu sözcük taşıyan bir cümleyi TEK metin olarak tutar. · dışa: Cumle
- `apps/web/src/components/DestekSatiri.tsx` — Destek adresi satırı — Kullanım Koşulları ve Aydınlatma Metni'nde. · dışa: DestekSatiri
- `apps/web/src/components/DiyarSeferiKart.tsx` — Hafta sonu diyar seferi kartı (docs/09 §2.6). · dışa: DiyarSeferiKart
- `apps/web/src/components/DizilimIzgarasi.tsx` — 4x4 savaş dizilimi — sürükle-bırak. · dışa: DizilimIzgarasi, DizilimKatlanir
- `apps/web/src/components/DizilimSemasi.tsx` — İdeal dizilim şeması — öğreticideki 4x4 dersi. · dışa: DizilimSemasi
- `apps/web/src/components/DunyaSeridi.tsx` — Dünya başlığı ve olay şeridi — haritayı yaşayan bir yer yapan iki parça. · dışa: DunyaBasligi, OlaySeridi
- `apps/web/src/components/GorevOzeti.tsx` — Görev özeti — Malikâne'de duran tek satırlık şerit. · dışa: GorevOzeti
- `apps/web/src/components/Gorsel.tsx` — Çizim varsa onu, yoksa ikonu gösterir. · dışa: GorselTuru, bolgeGorselAdi, Gorsel
- `apps/web/src/components/GunlukKart.tsx` — Günlük görevler ve giriş serisi kartı. · dışa: GunlukKart
- `apps/web/src/components/Hastane.tsx` — Hastane: savaştan yaralı dönen askerler. · dışa: Hastane
- `apps/web/src/components/HataSiniri.tsx` — Arayüz hata sınırı. · dışa: HataSiniri
- `apps/web/src/components/HavaKatmani.tsx` — Şehir'in üstündeki hava (docs/24 "Hava"): ara sıra hafif yağmur, sis ya da kar. · dışa: useHava, HavaKatmani
- `apps/web/src/components/Hizlandir.tsx` — Hızlandır — bir işin kalan süresini elmasla, biriken reklam süresiyle ya da (uygulamada) ödüllü reklamla kısaltmak (docs/25). · dışa: HizlanacakIs, IS_ADI, HizlandirDugmesi, HizlandirPenceresi
- `apps/web/src/components/Ikonlar.tsx` — İkon seti — game-icons.net (CC BY 3.0), künye: docs/LISANSLAR.md · dışa: Ikon, IkonMilis, IkonMizrakci, IkonOkcu, IkonSuvari, IkonKusatma, IkonSaldiri, IkonSavunma, IkonCan, IkonHiz, IkonYer, IkonAltin, IkonDemir, IkonErzak, IkonSure, IkonUyari +33
- `apps/web/src/components/IttifakBagis.tsx` — İttifak bağışı ve seviyesi (docs/09 B1e). · dışa: IttifakBagis
- `apps/web/src/components/IttifakBasvurular.tsx` — Başvuru kutusu: liderin "kimi alıyorum" ekranı. · dışa: IttifakBasvurular
- `apps/web/src/components/IttifakDuyuru.tsx` — İttifak duyurusu — panoya çakılı kural. · dışa: IttifakDuyuru
- `apps/web/src/components/IttifakIncele.tsx` — Başka bir ittifağı inceleme kartı. · dışa: IttifakIncele
- `apps/web/src/components/IttifakKayit.tsx` — İttifak kayıt defteri: "ben yokken ne oldu". · dışa: IttifakKayit
- `apps/web/src/components/IttifakSohbet.tsx` — İttifak sohbeti. · dışa: IttifakSohbet
- `apps/web/src/components/KapiPaneli.tsx` — Kapı paneli — konusunun içinde açılan pop-up sayfa. · dışa: KapiPaneli
- `apps/web/src/components/KarsiCemberi.tsx` — Taş-kağıt-makas çemberi — öğreticideki tek somut strateji dersi. · dışa: KarsiCemberi
- `apps/web/src/components/KarsiIpuclari.tsx` — Karşı-birim ipuçları kartı. · dışa: KarsiIpuclari
- `apps/web/src/components/KaynakGonder.tsx` — İttifak üyesine kaynak gönderme (docs/09 B6). · dışa: KaynakGonder
- `apps/web/src/components/MobilKabuk.tsx` — Mobil kabuk: sabit üst durum çubuğu + kaydırılan içerik + sabit alt gezinme. · dışa: Sekme, MobilKabuk
- `apps/web/src/components/Ogretici.tsx` — Öğretici — oyuncu ilk girdiğinde oyunun tamamını kabaca anlatan tam ekran tanıtım. · dışa: Ogretici
- `apps/web/src/components/Omurga.tsx` — Omurga — "şimdi ne yapmalısın". · dışa: OmurgaIslemleri, useOmurgaAdimi, Omurga, OmurgaSeridi, siradakiAdim
- `apps/web/src/components/OrduSahnesi.tsx` — Ordu sahnesi — lordun arkasındaki kalabalık. · dışa: DisaridakiOrdu, OrduSahnesi
- `apps/web/src/components/Paktlar.tsx` — Saldırmazlık paktları (docs/09 B1d). · dışa: Paktlar
- `apps/web/src/components/Pazar.tsx` — Malikâne pazarı: fazla kaynağı eksiğe çevirir. · dışa: Pazar
- `apps/web/src/components/ProfilGorseli.tsx` — Profil görseli — sohbette, profil kartında ve üst çubukta aynı daire. · dışa: profilGorselAdresi, ProfilGorseli
- `apps/web/src/components/ProfilKarti.tsx` — Profil kartı — sohbette bir ada ya da resme dokununca. · dışa: ProfilKarti
- `apps/web/src/components/ProfilResmiSecici.tsx` — Profil resmi seçici — Lord ekranından açılıyor. · dışa: ProfilResmiSecici
- `apps/web/src/components/Rehber.tsx` — Rehber kartı — ilk oturumda omurganın üstünde duran kâhya. · dışa: Rehber
- `apps/web/src/components/RehberIsigi.tsx` — Rehber ışığı — ekranı karartıp TEK düğmeyi açıkta bırakan perde. · dışa: RehberIsigi
- `apps/web/src/components/SaldiriOnizleme.tsx` — Saldırı önizlemesi: "kazanırsan ne olur, kaybedersen ne olur". · dışa: SaldiriOnizleme
- `apps/web/src/components/SavasRaporu.tsx` — Savaş raporu — alt sayfa olarak açılan modal. · dışa: SavasRaporu
- `apps/web/src/components/SavunmaDuzeni.tsx` — Savunma düzeni kartı — Malikâne'de. · dışa: SavunmaDuzeni
- `apps/web/src/components/SeferKart.tsx` — Haftalık sefer kartı. · dışa: SeferKart
- `apps/web/src/components/SeviyeKutlamasi.tsx` — Seviye atlama kutlaması. · dışa: SeviyeKutlamasi
- `apps/web/src/components/SikayetSayfasi.tsx` — Şikâyet sayfası — iki yerden açılan TEK kutu. · dışa: SikayetSayfasiProps, SikayetSayfasi
- `apps/web/src/components/SohbetMesajlari.tsx` — Sohbet mesajları — genel sohbet ve ittifak sohbeti AYNI listeyi çiziyor. · dışa: SohbetSatiri, SohbetMesajlari, EngelOnayi
- `apps/web/src/components/UygulamaKasasi.tsx` — Uygulama kasası — alt çubuğu yukarı çekince açılan, bütün sayfaların ızgarası. · dışa: KasaHedefi, UygulamaKasasi
- `apps/web/src/components/YakinlikDugmesi.tsx` — Yakınlaştırma düğmesi: dünya haritasında ve Şehir'in yerleşkesinde. · dışa: YakinlikDugmesi
- `apps/web/src/components/YukselmeGecisi.test.ts`
- `apps/web/src/components/YukselmeGecisi.tsx` — Bina yükseltmesi bitince geçiş (docs/13 "Yükseltme geçişi"). · dışa: GECIS_MS, yukselmeDurumunuSifirla, yukselenleriBul, useYukselenler, YukselmeGecisi
- `apps/web/src/components/Zemin.tsx` — Ekran zemini — her sekmenin tepesindeki manzara şeridi. · dışa: Zemin, TamZemin
- `apps/web/src/components/ZemineGolgesi.tsx` — ZEMİNE OTURTAN İKİ GÖLGE. · dışa: ZemineGolgesi
- `apps/web/src/components/arastirmaRozeti.ts` — Araştırma kutusunun ETKİ ROZETİ: kutu ne verdiğini okumadan söylesin. · dışa: RozetYonu, EtkiRozeti, etkiRozeti
- `apps/web/src/components/ekler.ts` — Türkçe ek getirme. · dışa: eYonelme, iBelirtme, inIlgi, heceTireli · (testi var)
- `apps/web/src/components/hisGeriBildirimi.ts` — Dokunsal ve işitsel geri bildirim. · dışa: hisOnay, hisAgir, hisZafer, hisRet
- `apps/web/src/components/ikon-verisi.ts` — ÜRETİLMİŞ DOSYA — elle düzenleme. · dışa: IkonVerisi, IKONLAR, IkonAnahtari
- `apps/web/src/components/omurga-depo.test.ts`
- `apps/web/src/components/ui.tsx` — Mobil arayüz parçaları. · dışa: GeriSayim, SureCubugu, Iskelet, SahneIskeleti, KuyrukSeridi, EngelNotu, kaynakEngeli, Fark, SonucSatiri, KazanKaybet, Nadirlik, NADIRLIK, nadirlikRengi, nadirlikParlamasi, Kart, Bolum +18

### apps/web/src/components/harita

- `apps/web/src/components/harita/BolgeListesi.tsx` — Dünya haritasının liste görünümü (docs/23 Faz 3). · dışa: BolgeListesi
- `apps/web/src/components/harita/GercekHarita.tsx` — Dünya haritası — GERÇEK DÜNYA (docs/27): 197 ülke, her şehir bir toprak. · dışa: Mercek, IttifakHedefi, GercekHarita
- `apps/web/src/components/harita/bolgeListesi.ts` — Dünya haritasının LİSTE görünümü — süzme ve sıralama (docs/23 Faz 3). · dışa: ListeSuzgeci, Rozet, LISTE_TAVANI, ListeSatiri, bolgeListesi, suzgecSayilari · (testi var)
- `apps/web/src/components/harita/dunyaGeo.json` — tools/gercek-dunya-uret.mjs uretiyor (docs/27).
- `apps/web/src/components/harita/dunyaGeometri.ts` — Gerçek dünya haritasının geometrisi (docs/27): `dunyaGeo.json`u ilk kullanımda ayrı bir paket olarak indirir ve tuvalde çizilecek yollara çevirir. · dışa: Kutu, Hucre, UlkeSekli, DunyaGeometrisi, dunyaGeometrisiYukle

### apps/web/src/lib — Arayüz yardımcıları

- `apps/web/src/lib/bildirim.ts` — BİLDİRİM İZNİ — tarayıcı tarafı. · dışa: BildirimDurumu, BildirimHali, bildirimHali, bildirimAc, bildirimKapat
- `apps/web/src/lib/dil.tsx` — Dil seçimi — arayüz tarafı. · dışa: kayitliDil, DilSaglayici, useDil, useT, t, ts
- `apps/web/src/lib/kapiIstegi.ts` — Ekranın derinindeki bir bileşenin bir kapıyı (paneli) açtırması. · dışa: kapiAcIstegi, kapiIstekleriniDinle
- `apps/web/src/lib/sohbetOkundu.ts` — Genel sohbetin en son okunduğu an — üst çubuktaki "yeni mesaj" noktası. · dışa: OKUNDU_ANAHTARI, okunduOku, okunduYaz
- `apps/web/src/lib/turOlayi.ts` — React kökünün "animationiteration" dinleyicisini kesiyor: Şehir'deki kasmanın asıl kaynağı buydu (docs/24 "Hareket"). · dışa: turOlayiniKes · (testi var)
- `apps/web/src/lib/yarimSatinAlma.ts` — Yarım kalmış Google Play satın almaları (docs/25 §2.2). · dışa: yarimSatinAlmalariTamamla, useYarimSatinAlmalar
- `apps/web/src/lib/yerel.ts` — Android uygulamasının yerel yetenekleri (docs/25): Google Play Faturalandırma ve AdMob ödüllü reklam. · dışa: uygulamadaMi, playFiyatlari, SatinAlmaSonucu, playSatinAl, bekleyenPlaySatinAlmalari, ReklamSonucu, reklamIzle, reklamGizlilikSecenekleri

### apps/web/src/screens — Ekranlar (alt gezinmenin ve kasanın sayfaları)

- `apps/web/src/screens/Akin.tsx` — Akın — beş NPC diyarı, her birinde on grup (docs/12 §6). · dışa: Akin
- `apps/web/src/screens/Arastirma.tsx` — Araştırma ağacı — HOI4 tarzı tuval (docs/20 §7). · dışa: Arastirma
- `apps/web/src/screens/Demirhane.tsx` — Demirhane — ekipman üretimi, envanter, ordu donanımı. · dışa: Demirhane
- `apps/web/src/screens/EpostaDogrula.tsx` — E-posta doğrulama ekranı. · dışa: EpostaDogrula
- `apps/web/src/screens/EsyaPazari.tsx` — Pazar kapısı (docs/19): eşya pazarı ve kaynak takası. · dışa: EsyaPazari
- `apps/web/src/screens/GenelSohbet.tsx` — Genel sohbet — bütün oyuncuların tek kanalı. · dışa: GenelSohbet
- `apps/web/src/screens/Generaller.tsx` — Generaller — 12 kişilik sabit kadro, kiralama, slot yerleşimi. · dışa: Generaller
- `apps/web/src/screens/Giris.tsx` — Giriş ve kayıt ekranı (diyar seçimi, parola sıfırlama isteği) · dışa: Giris
- `apps/web/src/screens/Gizlilik.tsx` — Aydınlatma metni — hangi veriyi neden tutuyoruz. · dışa: Gizlilik
- `apps/web/src/screens/Gorevler.tsx` — Görevler — "nereye gidiyorum" sayfası. · dışa: Gorevler
- `apps/web/src/screens/Harita.tsx` — Harita — 61 bölge, alt sayfada bölge detayı, garnizon ve saldırı. · dışa: Harita
- `apps/web/src/screens/Hesap.tsx` — Hesap — parola değiştirme ve hesap silme. · dışa: Hesap
- `apps/web/src/screens/Ittifak.tsx` — İttifak ekranı. · dışa: Ittifak
- `apps/web/src/screens/Kisla.tsx` — Kışla — birim eğitimi, komuta kapasitesi, ordu dağılımı. · dışa: Kisla
- `apps/web/src/screens/Kosullar.tsx` — Kullanım Koşulları — oyunun kuralları, oyunun dışındakiler. · dışa: Kosullar
- `apps/web/src/screens/LordEkrani.tsx` — Lord — karakter sayfası. · dışa: LordEkrani
- `apps/web/src/screens/Magaza.tsx` — Mağaza (docs/25) — öde, zamanı atla. · dışa: Magaza
- `apps/web/src/screens/Malikane.tsx` — Malikâne — DİYARIN kendisi: topraklar, koruma ve ipuçları. · dışa: Malikane
- `apps/web/src/screens/Moderasyon.tsx` — Şikâyet kuyruğu — yöneticinin ekranı. · dışa: Moderasyon
- `apps/web/src/screens/Olaylar.tsx` — Olaylar — "ne oldu" sayfası. · dışa: OLAY_RENGI, Olaylar
- `apps/web/src/screens/ParolaSifirla.tsx` — Parola sıfırlama ekranı. · dışa: ParolaSifirla
- `apps/web/src/screens/Sehir.tsx` — Şehir — oyunun yeni ana sayfası. · dışa: Sehir
- `apps/web/src/screens/Siralama.tsx` — Sıralama — üç liste, üç oyun tarzı. · dışa: Siralama
- `apps/web/src/screens/UlkeSecimi.tsx` — ÜLKE SEÇİMİ (docs/27) — oyuna başlarken bir kez. · dışa: UlkeSecimi
- `apps/web/src/screens/Ulkem.tsx` — ÜLKEM PANELİ (docs/27) — başladığın ülke: başkenti (tahtı), hükümdarı ve şehirlerin kaçının bir lordun elinde olduğu. · dışa: Ulkem
- `apps/web/src/screens/YoneticiPaneli.tsx` — YÖNETİCİ PANELİ — oyuncuyu ARAYIP bakmak. · dışa: YoneticiPaneli
- `apps/web/src/screens/yerleskeYakinligi.ts` — Şehir'in yerleşkesinde yakınlaştırma (docs/24 "Yakınlaştırma"). · dışa: EN_YAKIN, DUGME_ADIMI, Gorunum, gorunumAnahtari, gorunumOku, sonGorunum, enUzak, gorunenOran, useYerleskeYakinligi · (testi var)

### apps/web/test

- `apps/web/test/arastirmaRozeti.test.ts`
- `apps/web/test/renkler.test.ts` — Renk sınıfları TANIMLI renklerle yazılmalı.

### ceviri — Çeviri kataloğu ve çevirmen dosyaları (araçlar üretir)

- `ceviri/1-once-bunlar.txt` — LORDLAR ÇAĞI — ÇEVİRİ 1/3: OYUNU OYNANIR KILAN
- `ceviri/2-sonra-bunlar.txt` — LORDLAR ÇAĞI — ÇEVİRİ 2/3: DERINLIK
- `ceviri/3-en-son-bunlar.txt` — LORDLAR ÇAĞI — ÇEVİRİ 3/3: KUYRUK
- `ceviri/BENIOKU.md` — Çeviri — Lordlar Çağı
- `ceviri/cevrilmeyecekler.txt` — LORDLAR ÇAĞI — ÇEVİRİLMEYECEK METİNLER
- `ceviri/metinler.csv` — Çeviri kataloğunun tablo hâli (üretilir)
- `ceviri/metinler.json` — Bütün Türkçe metinler ve İngilizceleri (üretilir)
- `ceviri/numaralar.json` — Çevirmen dosyalarındaki satır numaraları (üretilir)

### data — Oyun verisi: denge, harita, birimler (sayıların tek kaynağı)

- `data/akinlar.json` — Akin haritalari: oyuncunun NPC gruplarina saldirdigi bes diyar.
- `data/arastirma.json` — Arastirma agaci (docs/20).
- `data/arma.json` — Heraldik: oyuncunun kendi armasi.
- `data/balance.json` — Bütün oyun sayıları (bina, birim, süre, ödül, mağaza…) — tek kaynak
- `data/basarimlar.json` — Basarim tanimlari.
- `data/binalar.json` — Sehir sayfasindaki binalar.
- `data/dunya-ozet.json` — tools/gercek-dunya-uret.mjs uretiyor (docs/27): world-map.json ozeti.
- `data/generals.json` — SABIT KADRO: 12 general.
- `data/seferler.json` — Haftalik seferler: her hafta bir tema, bir hedef, bir odul.
- `data/taktikler.json` — Savas taktikleri.
- `data/unvanlar.json` — Sohretten TURETILEN unvanlar.
- `data/world-map.json` — GERCEK DUNYA (docs/27).

### docs — Tasarım ve işletim belgeleri

- `docs/00-ozet-ve-kapsam.md` — 00 — Özet ve Kapsam Kilidi
- `docs/01-oyun-tasarimi.md` — 01 — Oyun Tasarımı
- `docs/02-denge-formulleri.md` — 02 — Denge ve Formüller
- `docs/03-teknik-mimari.md` — 03 — Teknik Mimari
- `docs/04-yol-haritasi.md` — 04 — Yol Haritası
- `docs/05-dagitim.md` — Dağıtım ve İşletme
- `docs/06-magaza-yayini.md` — 06 — Play Store ve App Store Yayını
- `docs/07-v2-kapsam.md` — 07 — v2 Kapsamı
- `docs/08-ilk-oturum.md` — 08 — İlk Oturum Onarımı
- `docs/09-oyun-keyfi.md` — Oyun Keyfi — Araştırma ve Yol Haritası
- `docs/10-ortacag-arastirmasi.md` — 10 — Ortaçağ Oyunlarında En Sevilen Şeyler
- `docs/11-harita-ve-gorsel.md` — Harita ve Görsel Yapı — Analiz ve Karar
- `docs/12-yeniden-yapilanma.md` — 12 — Yeniden Yapılanma: Şehir, Dünya, Sefer
- `docs/13-sayfa-duzeni.md` — 13. Sayfa düzeni: belgeden panoya
- `docs/14-moderasyon.md` — 14 — Moderasyon
- `docs/15-dil.md` — 15 — Dil
- `docs/16-medeniyetler.md` — 16 — Medeniyetler: haritayı bireysel fetihten çıkarmak
- `docs/17-eposta-dogrulama.md` — 17 — E-posta doğrulama
- `docs/18-guvenlik.md` — 18 — Güvenlik denetimi
- `docs/19-esya-pazari.md` — 19 — Eşya pazarı
- `docs/20-arastirma-agaci.md` — 20 — Araştırma ağacı (HOI4 tarzı)
- `docs/21-magaza-uyumu.md` — 21 — Mağaza uyumu: App Store ve Google Play (kod tarafı)
- `docs/22-genel-sohbet-ve-profil.md` — 22 — Genel sohbet, profil kartı, profil resmi ve uygulama kasası
- `docs/23-dunya-haritasi-yeniden.md` — 23 — Dünya haritası: noktalar yerine toprak
- `docs/24-kodla-cizim.md` — 24 — Kodla çizim
- `docs/25-magaza.md` — 25 — Mağaza: zaman satılır, güç satılmaz (P2S)
- `docs/26-play-listesi.md` — 26 — Play Console için hazır metinler
- `docs/27-gercek-dunya.md` — 27 — Gerçek dünya haritası
- `docs/LISANSLAR.md` — Üçüncü Taraf Varlıklar ve Lisanslar

### packages/shared

- `packages/shared/package.json` — paket @lordlar/shared
- `packages/shared/tsconfig.json` — Ortak paketin TypeScript ayarları

### packages/shared/src — Sunucu ve arayüzün ortak, saf mantığı

- `packages/shared/src/akin.ts` — Akın: beş NPC haritası, her birinde on düşman grubu (docs/12 §6). · dışa: AkinHarita, AKIN_YOLU, AKINLAR, AKIN_ANAHTARLARI, akinHaritasi, akinGrubuGecerliMi, sefMi, akinGarnizonu, akinGarnizonSayisi, akinSuresiSn, akinYenilenmeSn, akinOdulu, akinXp, akinEkipmanSansi, AkinGrupDurumu, AkinHaritaDurumu +6 · (testi var)
- `packages/shared/src/arastirma.ts` — Araştırma ağacı (docs/20). · dışa: ArastirmaDugumu, ArastirmaDali, ArastirmaCagi, ArastirmaGrubu, ArastirmaBonusu, bosArastirmaBonusu, etkiMotoraBagliMi, ARASTIRMALAR, CAGLAR, GRUPLAR, arastirmaDugumleri, arastirmaDugumu, arastirmaDali, arastirmaOnkosullari, yolDugumleri, grupSecenekleri +15 · (testi var)
- `packages/shared/src/balance.ts` — data/*.json dosyalarını tipli olarak yükler ve doğrular. · dışa: B, GENERALS, GENERAL_SLOT_RULE, BASARIM_KUMELERI, GENERAL_LEVEL, GENERAL_INJURY, GENERAL_UZMANLIK, SEFERLER, SEFER_ODUL, DIYAR_ETKINLIGI, ARASTIRMA_DALLARI, ARASTIRMA_CAGLARI, ARASTIRMA_GRUPLARI, TAKTIKLER, ARMA, UNVANLAR +24 · (testi var)
- `packages/shared/src/basarim.ts` — Başarımlar — kilometre taşlarını hissedilir kılar. · dışa: BasarimDurumu, BasarimKumesi, BasarimOlcutleri, basarimlar, basarimSayaci
- `packages/shared/src/bildirimTercihi.ts` — BİLDİRİM TERCİHLERİ (docs/12 §17 "Bildirim tercihleri"). · dışa: BILDIRIM_TURLERI, BildirimTuru, BildirimTercihi, VARSAYILAN_TERCIH, tercihiCoz, saatDilimiGecerli, yerelSaat, sessizMi, bildirimGitsinMi · (testi var)
- `packages/shared/src/bina.ts` — Şehir binaları — inşa, seviye ve yerleşim kademesi. · dışa: BASKENT_TURLERI, KADEMELER, Kademe, KADEME_ADI, KADEME_OZETI, yerlesimKademesi, kademeTavani, kademedeGorunur, binaMaliyeti, binaSuresiSn, binaSeviyesi, BinaDurumu, binaDurumlari, etkiDegeri, etkiBirimi, binaEtkisi +12 · (testi var)
- `packages/shared/src/birlesme.ts` — DİYAR BİRLEŞMESİ — yaşıt diyarlar tek haritada buluşuyor. · dışa: BirlesmeAdayi, BirlesmeEsi, BIRLESME, diyarYasiGun, birlesmeyeHazirMi, evSahibiSec, birlesmeEsleri, birlesmeAni, gelisKalkani, TasinacakBolge, BolgeKarari, bolgeKarari · (testi var)
- `packages/shared/src/bolge-adi.ts` — Bölge türünün OKUNUR adı. · dışa: BOLGE_ADI, bolgeAdi · (testi var)
- `packages/shared/src/casus.ts` — Casusluk: saldırmadan önce bilgi almak. · dışa: kesifSuresiSn, kesifMaliyetiAltin, kesifGecerlilikSn, yakalanmaIhtimali, KesifFotografi, KesifDurumu, kesifDurumu
- `packages/shared/src/cokluHesap.ts` — Çoklu hesap şüphesi — yöneticiye bir liste, oyuncuya hiçbir şey. · dışa: COKLU_HESAP, CokluHesapIsareti, CokluHesapGirdisi, CokluHesapBagi, ortakAgGunleri, cokluHesapBaglari · (testi var)
- `packages/shared/src/combat.ts` — Savaş simülatörü. · dışa: BattleContext, armyCount, cloneArmy, calculateLoot, simulateBattle · (testi var)
- `packages/shared/src/dil.ts` — Dil motoru. · dışa: DILLER, DilKodu, VARSAYILAN_DIL, dilGecerli, anahtar, Sozluk, yerlestir, cevir, cogulSec, SunucuKalibi, sunucuKaliplari, cevirSunucu, sozlukKur, aktifDil, yerel, aktifSozlukVar +4 · (testi var)
- `packages/shared/src/diyarEtkinligi.ts` — Hafta sonu diyar seferi (docs/09 §2.6): diyarın bütün lordları BİRLİKTE bir hedefe yürüyor. · dışa: EtkinlikOlcutu, EtkinlikTanimi, ETKINLIKLER, ETKINLIK_EN_AZ_KATKI, EtkinlikDurumu, EtkinlikPenceresi, diyarEtkinligi, aktifPenceresi, etkinlikHedefi, etkinlikOdulu, EtkinlikHakki, etkinlikHakki · (testi var)
- `packages/shared/src/duzen.ts` — Savaş öncesi düzen: 4x4 dizilim + tek taktik. · dışa: KARE_SAYISI, Dizilim, SavasDuzeni, DuzenEtkisi, kareSatiri, kareSutunu, kanattaMi, kareNo, bosDizilim, varsayilanDizilim, kareyeDusenAdet, birimKareleri, dizilimGecerliMi, dizilimEtkisi, TaktikDurumu, taktikEtkileri +4 · (testi var)
- `packages/shared/src/economy.ts` — Kaynak üretimi, depo, ordu bakımı. · dışa: bosKaynak, kaynakTopla, kaynakCikar, kaynakYeterli, kaynakCarp, malikaneIncome, regionIncome, vilayetCarpani, vilayetSayilari, vilayetCarpanlari, storageCapacity, upkeepPerHour, AccrualInput, AccrualResult, accrue, erzakTukenmesiSaat +3
- `packages/shared/src/elmas.ts` — ELMAS ve YENİ OYUNCU BONUSU — saf katman. · dışa: kisaltmaBedeli, tedaviKisaltmaBedeli, kisaltilabilirMi, ELMAS_KAZANIMI, YeniOyuncuDurumu, YENI_OYUNCU_SURE_SAAT, BASLANGIC_ELMASI, yeniOyuncuDurumu, bonusluSure · (testi var)
- `packages/shared/src/epostaDogrulama.ts` — E-POSTA DOĞRULAMA — adresin gerçekten o kişiye ait olduğunu ölçmek. · dışa: JETON_OMRU_SAAT, YENIDEN_GONDER_BEKLEME_SN, GUNLUK_GONDERIM_TAVANI, SERBEST_GUN, KISITLI_EYLEM_ADI, jetonBitisi, DogrulamaDurumu, dogrulamaDurumu, gonderilebilirMi, jetonGecerli · (testi var)
- `packages/shared/src/equipment.ts` — Ekipman gücü, üretim, yükseltme. · dışa: itemPower, totalEquipmentPower, lordContribution, canCraftTier, craftPrice, rollCraftRarity, upgradeCost, canUpgrade, rollUpgrade, sellValue, kusamSeviyesi, kusamKodu, KUSAM_KODU
- `packages/shared/src/esyaPazari.ts` — EŞYA PAZARI — oyuncular arası ekipman alım satımı (docs/19). · dışa: EsyaGrubu, Urun, YUVA_ADI, NADIRLIK_ADI, urunAdi, urunAnahtari, urunGecerli, basamakFiyati, basamakAltta, basamakUstte, formulDegeri, FiyatSinirlari, fiyatSinirlari, Bant, bantHesapla, bantta +18 · (testi var)
- `packages/shared/src/etki-adi.ts` — Pasif etkinin OKUNUR adı. · dışa: ETKI_ADI, etkiAdi · (testi var)
- `packages/shared/src/garnizon.ts` — GARNİZON PAYI — bölge geliri orada DURANLARIN, bıraktıkları YER oranında (docs/16 §6, docs/27). · dışa: orduYeri, GelirPayi, garnizonPaylari, payMiktari · (testi var)
- `packages/shared/src/generalUzmanlik.test.ts` — General uzmanlığı: hangi seviyede açılıyor, bonusa nasıl ekleniyor, değiştirmek ne tutuyor.
- `packages/shared/src/generals.ts` — General pasiflerini ve yeteneklerini tek bir bonus nesnesine toplar. · dışa: EquippedGeneral, UZMANLIK_SEVIYESI, uzmanlikAcikMi, uzmanlikTanimi, uzmanlikDegistirmeBedeli, generalLevelMultiplier, generalXpForLevel, generalLevelFromXp, generalToplamXp, generalSavasXp, generalYaralanma, GeneralSavasSonucu, GeneralYukselisi, generalSavasSonrasi, aggregateGeneralBonus, hasAbility +3
- `packages/shared/src/gunluk.ts` — Günlük görevler ve giriş serisi. · dışa: GunlukGorev, GunlukSayaclar, gunlukGorevler, gunlukOdul, seriCarpani, odulAlindiMi, gunlukSayaci, gunNumarasi, SeriSonucu, seriGuncelle
- `packages/shared/src/harita.ts` — Harita topolojisi — mesafe ve komşuluk. · dışa: satirKurucu, HaritaGrafi, haritaGrafi, yakinlikMesafesiGraf, sinirdanMi, HARITA_KUSAGI
- `packages/shared/src/hastane.ts` — Hastane: savaştan yaralı dönen askerlerin tedavisi. · dışa: tedaviSuresiSn, kafileTedaviSuresiSn, tedavidekiSayilirMi, yaraliVarMi · (testi var)
- `packages/shared/src/index.ts` — Ortak paketin dışa açtıkları: bütün modüller (dil.js en üstte, sıra önemli)
- `packages/shared/src/ipuclari.ts` — İpuçları — diyar ekranında dönen kısa bilgiler. · dışa: Ipucu, ipuclari, ipucuSec
- `packages/shared/src/ittifak.ts` — İttifak kuralları. · dışa: azamiUye, kurmaMaliyeti, AdDenetimi, ittifakAdiDenetle, ittifakEtiketiDenetle, ittifakBeklemeSn, ittifakaGirebilirMi, ayniIttifaktaMi
- `packages/shared/src/ittifakBasvuru.ts` — İttifağa başvuru: katılımın liderin kararı olması. · dışa: KatilimTuru, KATILIM_ADI, BasvuruDurumu, azamiBekleyenBasvuru, retBeklemeSn, basvuruMesajiEnFazla, azamiAsgariSeviye, BasvuruDurum, BasvuruKosullari, basvurabilirMi, KatilimKarari, katilabilirMi, asgariSeviyeDenetle, basvuruMesajiDenetle · (testi var)
- `packages/shared/src/ittifakSeviye.ts` — İttifak seviyesi, bağış ve haftalık katkı. · dışa: azamiIttifakSeviyesi, ittifakSeviyeXp, ittifakToplamXp, IttifakSeviyeDurumu, ittifakSeviyesi, bagisMaliyeti, bagisXp, gunlukBagisHakki, bagisOdulu, IttifakAyricaliklari, ittifakAyricaliklari, KatkiSayimlari, haftalikKatki, IttifakRutbe, RUTBE_ADI, azamiYasli +2
- `packages/shared/src/kanonik.ts` — KANONİK HARİTA — `data/world-map.json`un kendisi ve ondan türeyenler (docs/27). · dışa: WORLD_MAP, KOMSULUK, DENIZ_YOLLARI, denizYoluMu, BOLGE_IDLERI, enUzakMesafe, bolgeMesafesi, komsuMu, yakinlikMesafesi, KANONIK_GRAFIK, HARITA_SURUMU, haritayiDogrula
- `packages/shared/src/karsi.ts` — Karşı-birim ipuçları — motorda duran stratejiyi görünür kılar. · dışa: KarsiYon, KarsiIpucu, karsiIpuclari, KusatmaDurumu, kusatmaDurumu, kusatmaCarpanlari
- `packages/shared/src/kimlik.ts` — Kimlik: arma ve unvan. · dışa: Arma, varsayilanArma, armaDuzelt, armaRengi, addanArma, Unvan, addanPortre, unvan
- `packages/shared/src/kusam.test.ts`
- `packages/shared/src/liste.ts` — LİSTE BİRLEŞTİRME — "altın ve demir", "a, b ve c". · dışa: veListesi
- `packages/shared/src/magaza.ts` — MAĞAZA — öde, zamanı atla; öde, güç alma (docs/25). · dışa: HIZLANDIRILABILIR, hizlandirilabilirMi, hizlandirmaBedeli, ElmasPaketi, ELMAS_PAKETLERI, elmasPaketi, REKLAM, ReklamEngeli, ReklamHakki, reklamHakki, reklamOdulunuDagit, bankadanHarca · (testi var)
- `packages/shared/src/march.ts` — Yürüyüş süresi ve ilk saldırı kısayolu. · dışa: slowestSpeed, MarchOptions, ilkSaldiriMi, ilkEgitimMi, egitimSuresiSn, marchDurationSec, canRecallMarch
- `packages/shared/src/moderasyon.ts` — Moderasyon: şikâyetin insana taşınması. · dışa: SikayetTuru, mesajSikayetiMi, ModerasyonKarari, YoneticiIslemi, Denetim, SIKAYET_SEBEPLERI, SikayetSebebi, SIKAYET_SEBEP_ANAHTARLARI, sebepMetni, sikayetiDenetle, sikayetSatiri, otomatikGizlenir, GIZLEME_ESIGI, SUSTURMA_SURELERI, susturmaSuresiGecerli, saatMetni +22 · (testi var)
- `packages/shared/src/odul.ts` — "Bunu yaparsam ne kazanırım, ne kaybederim?" · dışa: altinKarsiligi, FetihKazanciGirdi, FetihKazanci, fetihKazanci, OrduBedeli, orduBedeli, orduBakimi, siraTahmini · (testi var)
- `packages/shared/src/ogretici.ts` — Öğretici içeriği — oyunu ilk girişte KABACA anlatan sayfalar. · dışa: OgreticiMadde, OgreticiSayfa, KarsiSatiri, karsiHalkasi, ogreticiSayfalari
- `packages/shared/src/pakt.ts` — Saldırmazlık paktı — ittifaklar ARASI tek kural. · dışa: PaktDurumu, azamiPakt, fesihIhbarSaat, paktTaraflari, PaktSatiri, paktKoruyorMu, PaktDenetimi, paktTeklifDenetle, paktBitisi
- `packages/shared/src/pazar.ts` — Malikâne pazarı: bir kaynağı diğerine çevirir. · dışa: KAYNAK_TURLERI, KaynakTuru, KAYNAK_ADI, TakasSonucu, birimKuru, pazarGunlukTavan, takasHesapla, TakasEngeli, takasEngeli, depoBosYer, siganEnFazla · (testi var)
- `packages/shared/src/profil.ts` — Profil: oyuncunun öteki oyunculara görünen yüzü. · dışa: GENEL_SOHBET, ayniSozMu, PROFIL_RESMI, HazirPortre, HAZIR_PORTRELER, hazirPortreVarMi, KUSAM_PORTRESI, kusamPortresi, kusamPortresiMi, ProfilResmi, profilResmiCoz, profilResmiSutunu, ResimTahmini, ResimKarari, ResimDenetimi, resimKarari +1 · (testi var)
- `packages/shared/src/progression.ts` — Lord seviyesi, XP, komuta kapasitesi, şöhret. · dışa: xpForLevel, levelFromTotalXp, statPointsForLevelUp, commandCapacity, armySlots, maxRegions, generalSlots, azamiGeneralSlotu, armyPower, FameInput, calculateFame, conquestScore, updateElo, battleXp, captureXp, npcClearXp +2
- `packages/shared/src/rehber.ts` — Rehber — ilk oturumda yanında duran kâhya. · dışa: REHBER, RehberSozu, rehberSozleri, rehberSozu, RehberAsamasi, REHBER_ASAMALARI, RehberDurumu, rehberAsamaDurumu, rehberIlerlemesi, rehberGorunsunMu, RehberIsaret, REHBER_ISIKLARI, KAPI_KAPAT, rehberIsigi, rehberIsaretSebebi, REHBER_BEKLEYISLERI +1 · (testi var)
- `packages/shared/src/rng.ts` — Seed'li deterministik rastgelelik. · dışa: hashSeed, mulberry32, Rng, createRng, newSeed
- `packages/shared/src/sebep.ts` — Savaş sebepleri — raporun "neden" sorusuna cevabı. · dışa: SebepTuru, SavasSebebi, SebepGirdisi, eleGecirmeEsigi, ortalamaGucPayi, savasSebepleri
- `packages/shared/src/sefer.ts` — Haftalık sefer: "bu hafta neden gireyim?" · dışa: SeferTanimi, SeferSayaclari, Sefer, haftaNumarasi, haftaninGunu, haftaninSeferi, seferDurumu, seferOdulu, seferOduluAlindiMi, haftaBasi
- `packages/shared/src/takviye.ts` — Takviye: bir bölgeyi başkasının askeriyle savunmak. · dışa: GarnizonPayi, garnizonToplami, kayipPaylastir, orduDus
- `packages/shared/src/tarama.ts` — ÖRNEKLEME — aynı savaşı birkaç kez çalıştırıp dağılımı okumak. · dışa: onizlemeTohumu, SavasOrneklemesi, savasOrneklemesi, TaramaSonucu, taramaSonucu · (testi var)
- `packages/shared/src/ticaret.ts` — İttifak içi kaynak gönderimi. · dışa: sevkiyatSuresiSn, gunlukTavan, enAzGonderim, yukAgirligi, SevkiyatDenetimi, sevkiyatDenetle
- `packages/shared/src/toprak.ts` — TOPRAK — dünya haritasının geometrisi (docs/23). · dışa: Nokta, ToprakGirdisi, Hucre, Kutu, topraklar, toprakYolu, hucredeMi, Sahiplik, SinirTuru, sinirTuru, SinirKenari, sinirKenarlari, Kume, kumeler, HedefEngeli, HedefDurumu +2 · (testi var)
- `packages/shared/src/types.ts` — Oyunun tüm ortak tipleri. · dışa: ResourceType, UnitType, EquipSlot, Rarity, RegionType, GearLineKey, StatKey, GeneralRarity, UNIT_TYPES, EQUIP_SLOTS, RARITIES, GEAR_LINES, STAT_KEYS, Resources, Army, UnitStats +19
- `packages/shared/src/ulkeler.ts` — ÜLKELER (docs/27) — telefonun ana paketine giren harita özeti. · dışa: UlkeDef, DUNYA_OZETI, SEHIR_SAYISI, ULKELER, ULKE_ADI
- `packages/shared/src/yayin.ts` — YAYIN KONTROLÜ — sunucu eksik ayarları kendisi söylüyor (docs/05 §6). · dışa: YayinDurumu, YayinGirdisi, YayinNedeni, YayinBulgusu, YAYIN_METNI, YAYIN_ELLE, HIZ_SINIRI_TAVANI, jwtGucluMu, adresSinifi, yayinDenetimi, yayinOzeti · (testi var)

### tools — Uçtan uca testler, denetimler ve bakım araçları

- `tools/akin-testi.mjs` — Akın testi — beş NPC haritası, on grup, gerçek savaş (docs/12 §6).
- `tools/arastirma-testi.mjs` — Araştırma ağacını uçtan uca sınar (docs/20).
- `tools/bildirim-testi.mjs` — PUSH BİLDİRİMİ — sunucu tarafının uçtan uca sınavı.
- `tools/birlesme-testi.mjs` — Diyar birleşmesi testi.
- `tools/casus-testi.mjs` — Casusluk testi (docs/09 B5).
- `tools/ceviri-al.mjs` — ÇEVİRİYİ GERİ AL — numaralı düz dosyadan sözlüğe.
- `tools/ceviri-liste.mjs` — ÇEVİRİ LİSTESİ — çevirmenin okuyacağı düz dosya.
- `tools/ceviri-paket.mjs` — ÇEVİRİ PAKETİ — sözlüğü arayüzün yükleyeceği hâle getirir.
- `tools/check_balance.py` — Lordlar Cagi - Denge dogrulayici.
- `tools/demo-lordlar.mjs` — Test için canlı bir dünya kurar: birkaç rakip lord yaratır, onlara bölge, ordu ve seviye verir, sonra tüm kalkanları kaldırır.
- `tools/denetim-testi.mjs` — Denetim testi: lord adı süzgeci, şikâyet, bölge bırakma, yürüyüş sınırı.
- `tools/denge-akin.ts` — Akın denge tablosu — sayıları DEĞİŞTİRMEZ, gösterir.
- `tools/dil-testi.mjs` — Dil testi.
- `tools/diyar-secimi-testi.mjs` — Diyar (sunucu) seçimi testi.
- `tools/diyar-seferi-testi.mjs` — Hafta sonu diyar seferi (docs/09 §2.6).
- `tools/dizilim-arayuz-testi.mjs` — Dizilim arayüzünü gerçek bir telefonda dolaşır.
- `tools/duzen-testi.mjs` — Savaş öncesi düzenin API tarafını uçtan uca sınar.
- `tools/elmas-testi.mjs` — Elmas ve yeni oyuncu bonusu — uçtan uca.
- `tools/eposta-dogrulama-testi.mjs` — E-posta doğrulama testi.
- `tools/erisim-denetim.mjs` — ERİŞİM DENETİMİ — ekran okuyucuyla ve klavyeyle oynanabilirlik.
- `tools/esya-pazari-testi.mjs` — Eşya pazarı (docs/19) — uçtan uca.
- `tools/gelir-payi-testi.mjs` — GARNİZON PAYI — uçtan uca (docs/16 §6).
- `tools/genel-sohbet-testi.mjs` — Genel sohbet, profil kartı ve uygulama kasası — uçtan uca.
- `tools/general-uzmanlik-testi.mjs` — General uzmanlığı (docs/09 §2.3).
- `tools/gercek-dunya-uret.mjs` — GERÇEK DÜNYA HARİTASI ÜRETİCİSİ (docs/27): Natural Earth verisinden oyunun dünyasını üretir — ülkeler, şehir toprakları, komşuluklar, deniz yolları.
- `tools/geri-yukle.sh` — Lordlar Çağı — yedekten geri yükleme (docs/05 §4).
- `tools/gerialma-testi.mjs` — Gövdesiz istekler: geri çağırma ve araştırma iptali.
- `tools/gorsel-bozulma-testi.mjs` — Görsel bozulma testi — GPU yolu, piksel piksel (docs/24 "Görsel bozulma testi").
- `tools/gorsel-denetim.mjs` — Görsel denetim: kayma, taşma ve örtüşme avı.
- `tools/gunluk-testi.mjs` — Günlük görev ve ödül testi (docs/09 K4, K4b).
- `tools/guvenlik-testi.mjs` — Güvenlik denetiminin kapattığı açıklar — geri gelmesinler diye.
- `tools/harita-bicim-testi.mjs` — HARİTA İKİ BİÇİMDE AYNI ŞEYİ SÖYLÜYOR — `/map` ile `/harita` (docs/27 §7).
- `tools/harita-dokunma-testi.mjs` — HARİTA DOKUNMA JESTLERİ — gerçek parmakla (docs/23).
- `tools/harita-surumu-testi.mjs` — HARİTA SÜRÜMLEMESİ — canlı dünya yeni haritadan etkilenmemeli.
- `tools/harita-testi.mjs` — Harita testi (docs/11).
- `tools/harita.mjs` — PROJE HARİTASI — `HARITA.md`yi üretir: hangi dosya ne yapıyor, ne dışa açıyor, hangi API uçlarını sunuyor. · uçlar: GET /yol
- `tools/hastane-testi.mjs` — Hastane: yaralı dönen askerlerin tedavisi.
- `tools/hesap-testi.mjs` — Hesap testi: parola değiştirme, parola sıfırlama ve hesap silme.
- `tools/ikon-uret.mjs` — Kullanılan game-icons ikonlarını tek bir TS dosyasına çıkarır. · dışa: IkonVerisi, IKONLAR, IkonAnahtari
- `tools/ilk-hedef-testi.mjs` — İlk hedef testi: oyunun yeni oyuncuya verdiği İLK talimat yapılabilir mi?
- `tools/ilk-oturum-testi.mjs` — İlk oturum testi (docs/08).
- `tools/ittifak-basvuru-testi.mjs` — İttifak başvuru testi (docs/09 §2.1 "Sırada").
- `tools/ittifak-seviye-testi.mjs` — İttifak seviyesi, bağış, rütbe ve duyuru testi (docs/09 B1e).
- `tools/ittifak-testi.mjs` — İttifak testi (docs/09 B1).
- `tools/kalkan-testi.mjs` — Kalkan testi: yağma akınından sonra bölgeye kalkan konuyor mu (docs/09 K6)?
- `tools/kimlik-testi.mjs` — Kimlik testi: arma ve unvan (docs/10).
- `tools/kuyruk-cozulme-testi.mjs` — Vadesi gelmiş işler OKUMA yolunda çözülüyor mu?
- `tools/lord-adi-testi.mjs` — Lord adı benzersizliği — veritabanında (docs/18).
- `tools/magaza-testi.mjs` — Mağaza — öde, zamanı atla (docs/25).
- `tools/metin-birlestir.mjs` — CÜMLEYİ TEK PARÇAYA İNDİRİR — `'A ' + 'B'` yerine `'A B'`.
- `tools/metin-cikar.mjs` — OYUN METİNLERİ — çeviri için tek dosyaya çıkarır.
- `tools/metin-kapsam.mjs` — ÇEVİRİ KAPSAMI — ekranda görünen her metin sözlükte var mı.
- `tools/moderasyon-testi.mjs` — Moderasyon testi.
- `tools/npc-testi.mjs` — RAKİP LORDLAR gerçekten hareket ediyor mu.
- `tools/ogretici-tam-testi.mjs` — Öğreticinin BAŞTAN SONA testi.
- `tools/ogretici-testi.mjs` — Öğretici testi: yeni lord ilk girdiğinde öğreticiyi GÖRÜYOR, geçince bir daha görmüyor, Hesap ekranından tekrar açabiliyor.
- `tools/okunurluk-denetim.mjs` — Okunurluk denetimi: kontrast ve yazı boyutu.
- `tools/olcum-testi.mjs` — ÖLÇÜMÜN KENDİSİNİ ÖLÇER (docs/16 §15).
- `tools/olcum.mjs` — İlk oturum ve ülke ölçümünü okunur biçimde yazdırır.
- `tools/omurga-testi.mjs` — Omurga testi — "şimdi ne yapmalısın" bloğunu uçtan uca dolaşır.
- `tools/oyun-dongusu-testi.mjs` — Tam oyun döngüsü entegrasyon testi (sunucu API'si üzerinden).
- `tools/pakt-testi.mjs` — Saldırmazlık paktı testi (docs/09 B1d).
- `tools/pazar-testi.mjs` — Pazar: kaynak takası.
- `tools/profil-resmi-testi.mjs` — Profil resmi — seçme, yükleme ve denetim, uçtan uca.
- `tools/pvp-testi.mjs` — PvP testi: bir oyuncunun BAŞKA BİR OYUNCUNUN bölgesine saldırması.
- `tools/pwa-testi.mjs` — PWA kabuğunu sınar: "ana ekrana ekle" gerçekten çalışır mı?
- `tools/rapor-paylasim-testi.mjs` — Savaş raporunu ittifak sohbetinde paylaşma (docs/09 B3).
- `tools/rehber-isigi-testi.mjs` — Rehber ışığı — "zorunlu tek düğme" testi.
- `tools/rehber-testi.mjs` — Rehberli ilk oturum testi (docs/09 T4).
- `tools/rehber-tur-testi.mjs` — Zorunlu rehber — BAŞTAN SONA, yalnız ışığa basarak.
- `tools/savas-raporu-testi.mjs` — Savaş raporu modalını uçtan uca dolaşır.
- `tools/sefer-testi.mjs` — Haftalık sefer testi (docs/09 B4).
- `tools/sehir-testi.mjs` — Şehir sayfası testi — yerleşim kademesi, boş arsa, inşa.
- `tools/shard-testi.mjs` — Shard testi: dünya dolduğunda kaydın kırılmadığını, yeni dünyanın kendiliğinden açıldığını doğrular.
- `tools/simge-uret.py` — PWA simgelerini üretir.
- `tools/smoke.mjs` — Uçtan uca duman testi: gerçek tarayıcıda kayıt -> Malikâne -> Lord akışı.
- `tools/taht-testi.mjs` — Taht testi: endgame'in kendine özgü kuralları.
- `tools/takviye-testi.mjs` — Takviye savaşı testi (docs/09 B1c).
- `tools/tarayici-tam-akis.mjs` — Yedi ekranın tamamını gerçek tarayıcıda, TELEFON boyutunda dolaşır.
- `tools/tum-dugmeler-testi.mjs` — BÜTÜN DÜĞMELER — her sekmede, her panelde, her alt sekmede görünen her düğmeye tek tek basan tarayıcı botu.
- `tools/ulke-testi.mjs` — ÜLKE ve SINIR — uçtan uca (docs/27).
- `tools/uretim-korumalari-testi.mjs` — ÜRETİM KORUMALARI: yayına çıkarken delik kalmasın.
- `tools/uretim-testi.mjs` — Üretim modu testi: tek servisli dağıtımın telefonda çalıştığını doğrular.
- `tools/worker-testi.mjs` — Worker testi: yürüyüşü worker'ın KENDİLİĞİNDEN çözdüğünü doğrular.
- `tools/yaris-testi.mjs` — Yarış testi: aynı anda gelen istekler aynı kaynağı iki kez harcayamaz.
- `tools/yedek-tatbikati.mjs` — Yedek tatbikatı (docs/05 §4): "denenmemiş yedek yedek değildir".
- `tools/yedekle.sh` — Lordlar Çağı — veritabanı yedeği.
- `tools/yerel-baslat.sh` — Yerel geliştirme yığınını ayağa kaldırır: PostgreSQL + API + worker + arayüz.
- `tools/yonetici-testi.mjs` — Yönetici paneli testi.
- `tools/yuk-testi.mjs` — 120 sanal oyuncuyla yük testi.

### tools/lib — Testlerin ortak yardımcıları

- `tools/lib/birim.mjs` — Kışladaki bir birimin kartını açar. · dışa: birimiAc
- `tools/lib/garnizon.mjs` — Evdeki orduyu bölgenin garnizonuna EKLER (üstüne yazmaz). · dışa: garnizonaEkle
- `tools/lib/gezin.mjs` — Test araçları için ekran gezinme. · dışa: CUBUK, ANA, KAPILAR, EKRANLAR, kapiyiKapat, ekrana, agSakinlesin, rehberiSustur, ulkeyiSec, kapida, bolgeyeDokun, bolgeyiSec
- `tools/lib/harita.mjs` — Harita yardımcıları — testler için. · dışa: HARITA, BOLGE_SAYISI, merkezUzakliklari, kenardakiSahipsizler
- `tools/lib/hedef.mjs` — "Bu bölge fethedilebilir mi" — sınamaların ortak süzgeci. · dışa: fethedilebilirMi
- `tools/lib/ilerlet.mjs` — Bir lordu İLK DÖNGÜNÜN ÖTESİNE taşır. · dışa: sehriKur, bolgeKazandir
- `tools/lib/kayit.mjs` — Test araçları için ortak lord kaydı. · dışa: benzersizAd, onerilenDiyar, kayitOl
- `tools/lib/koy.mjs` — Test araçları için: lorda gerçek bir yerleşim ve kurulmuş bir şehir. · dışa: yerlesimAl, koyAl, baskentiTasi, binalariDik
- `tools/lib/metin-kurallari.mjs` — ÇEVİRİ KURALLARI — "bu dizge ekrana çiziliyor mu". · dışa: KOD_KOKUSU, ATLANAN_OZELLIK, ATLANAN_NITELIK, METIN_NITELIGI, bicimListesiMi, metinKirintisi, metinMi, kesinMetin, sablonMetni, nitelikAdi, atlanirMi, OGEYE_OZGU_ATLANAN, ogeAdi, kapsayanNitelik, metinKabul
- `tools/lib/ogretici.mjs` — Tarayıcı testleri için: öğreticiyi geç. · dışa: ogreticiyiGec
- `tools/lib/tarayici.mjs` — Tarayıcının NEREDE olduğu — tek yerden. · dışa: tarayiciYolu, tarayiciAc

## Özetlenenler (tek tek listelenmiyor)

- `apps/api/prisma/migrations/` — 62 migration (SQL)
- `apps/mobil/android/` — 51 Capacitor/Gradle üretimi dosya (elle dokunulanlar ayrıca listede)
- `apps/web/public/` — 3 görsel/yazı tipi
- `docs/gorseller/` — 15 belge görseli
- `tools/fiksturler/` — 13 test fikstürü
