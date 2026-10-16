import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Virgülle ayrılmış liste. localhost ve 127.0.0.1 FARKLI origin sayılır —
  // ikisi de olmazsa tarayıcı isteği CORS'ta düşer.
  WEB_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  /** true ise worker döngüsü API sürecinin içinde çalışır (tek servisli dağıtım). */
  RUN_WORKER: z.enum(['true', 'false']).default('false'),
  /** true ise derlenmiş arayüz aynı sunucudan servis edilir. */
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
  /** Açılışta migration + bölge tohumlaması yapılsın mı. */
  AUTO_MIGRATE: z.enum(['true', 'false']).default('false'),
  /** İlk açılışta dünyaya rakip lordlar eklensin mi (test dağıtımı için). */
  SEED_DEMO_LORDS: z.enum(['true', 'false']).default('false'),
  /** Oturum başına dakikalık istek tavanı. Yük testinde yükseltilir. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /** Kayıt/giriş için IP başına dakikalık tavan. Kaba kuvveti burası durdurur. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  /*
   * İSTEMCİNİN IP'Sİ NEREDEN OKUNACAK (bkz. istemciIp.ts).
   *
   * Sunucu bir vekilin (Render, Caddy, nginx) arkasındaysa bağlantının
   * adresi VEKİLİN adresi: hiçbiri verilmezse giriş sınırı bütün
   * oyunculara tek kova olur. İkisinden biri:
   *
   *   ISTEMCI_IP_BASLIGI  Vekilin istemci adresini yazdığı ve istemcinin
   *                       EZEMEDİĞİ başlık. Render'da `cf-connecting-ip`
   *                       (önündeki Cloudflare yazıyor).
   *   VEKIL_SAYISI        X-Forwarded-For'da güvenilecek vekil sayısı
   *                       (kendi Caddy/nginx'in için 1).
   */
  ISTEMCI_IP_BASLIGI: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9-]+$/, 'başlık adı yalnız harf, rakam ve tire'))
    .optional(),
  VEKIL_SAYISI: z.coerce.number().int().min(0).max(5).default(0),

  /*
   * MAĞAZA (docs/25) — Google Play ve AdMob, yalnız Android uygulamasında.
   *
   * Hiçbiri verilmezse mağaza "bilgi" kipinde: paketler görünür, satın
   * alma ve reklam kapalı. Geliştirmede (NODE_ENV ≠ production) ikisi de
   * yerel taklide bağlanıyor (routes/devMagaza.ts) ki uçtan uca test
   * gerçek kod yolunu koşsun.
   */
  /** Uygulamanın paket adı (Play Console'daki), ör. com.lordlarcagi.oyun. */
  PLAY_PAKET_ADI: z
    .string()
    .regex(/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/, 'paket adı biçimi: com.ornek.oyun')
    .optional(),
  /**
   * Play Developer API'ye erişen servis hesabının JSON anahtarı — düz JSON
   * ya da base64. GİZLİ: depoya yazılmaz, yalnız barındırma panelinde.
   */
  PLAY_SERVIS_HESABI: z.string().optional(),
  /** Geliştirmede Play API'si yerine taklit (üretimde yok sayılır). */
  PLAY_API_ADRESI: z.string().url().optional(),
  /** Ödüllü reklam biriminin kimliği, ör. ca-app-pub-123/456. Herkese açık. */
  ADMOB_ODUL_BIRIMI: z
    .string()
    .regex(/^ca-app-pub-\d+\/\d+$/, 'ca-app-pub-<yayıncı>/<birim> biçiminde olmalı')
    .optional(),
  /** AdMob yayıncı kimliği (pub-…): /app-ads.txt bundan yazılıyor. */
  ADMOB_YAYINCI_KIMLIGI: z
    .string()
    .regex(/^pub-\d+$/, 'pub-<rakamlar> biçiminde olmalı')
    .optional(),
  /** Geliştirmede SSV anahtar sunucusu yerine taklit (üretimde yok sayılır). */
  ADMOB_ANAHTAR_ADRESI: z.string().url().optional(),
  /**
   * Android uygulamasının kökeni (Capacitor'ın yerel sunucusu). CORS bu
   * kökene de izin veriyor; uygulama arayüzü paketin içinden sunuyor.
   */
  MOBIL_KOKEN: z.string().default('https://localhost'),
  /**
   * Veritabanı bağlantı havuzu (db.ts). `DATABASE_URL` kendi
   * `connection_limit`ini taşıyorsa o geçerli; bu ikisi de yoksa 10.
   */
  DB_HAVUZU: z.coerce.number().int().positive().max(100).optional(),
  /** Boşsa hata izleme kapalıdır ve dışarıya hiçbir şey gönderilmez. */
  /**
   * İlk oturum ölçüm ucunun (/api/olcum) anahtarı. Boşsa uç hiç yüklenmez.
   * Uç oyuncu verisi değil yalnızca toplamlar döner; yine de herkese açık
   * olmasının bir sebebi yok.
   */
  OLCUM_ANAHTARI: z.string().optional(),
  SENTRY_DSN: z.string().default(''),
  /** İzleme örneklemesi. Ücretsiz katmanda kota var, varsayılan düşük. */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.05),
  /** E-posta taşıyıcısı. log = sadece sunucu log'una yaz, dışarı gitmez. */
  EPOSTA_TASIYICI: z.enum(['log', 'resend']).default('log'),
  /** resend taşıyıcısı için API anahtarı. */
  EPOSTA_ANAHTAR: z.string().default(''),
  /** Gönderen adresi. Alan adının doğrulanmış olması gerekir. */
  EPOSTA_GONDEREN: z.string().default('Lordlar Çağı <bildirim@localhost>'),
  /**
   * Oyuncunun ulaşabileceği destek adresi — Kullanım Koşulları ve
   * Aydınlatma Metni'nde yayınlanıyor.
   *
   * Mağazalar (App Store 1.2, Google Play geliştirici iletişimi) herkese
   * açık bir iletişim yolu istiyor. Koda gömülmedi: adresi yalnız hesabın
   * sahibi seçebilir. Boşsa sayfalar iletişim satırını çizmiyor.
   */
  DESTEK_EPOSTA: z.string().email().optional(),
  /**
   * Parola sıfırlama bağlantısının tabanı (arayüzün herkese açık adresi).
   *
   * Verilmezse Render'ın kendi verdiği dış adres kullanılır. Bu yedek
   * olmadan üretimde varsayılan localhost kalıyordu ve sıfırlama
   * e-postaları kırık bağlantı taşıyordu.
   */
  UYGULAMA_URL: z.string().optional(),
  /** Render otomatik olarak veriyor; başka ortamlarda boştur. */
  RENDER_EXTERNAL_URL: z.string().optional(),
  /**
   * Profil resmi sınıflandırıcısı (+18 denetimi). `kapali` ise yüklenen
   * her resim doğrudan yönetici onayına gidiyor — sınıflandırıcı ~100 MB
   * bellek istiyor ve çok küçük bir sunucuda kapatmak gerekebilir. Kapalı
   * olması resmi ONAYLAMAZ, yalnız kararı insana bırakır.
   */
  RESIM_SINIFLANDIRICI: z.enum(['acik', 'kapali']).default('acik'),
  /** pino seviyesi: fatal|error|warn|info|debug|trace */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /*
   * PUSH BİLDİRİMİ (VAPID).
   *
   * Anahtar çifti YEREL üretiliyor (`pnpm push-anahtari`), dış bir
   * servise kaydolmak gerekmiyor: VAPID tarayıcının push sunucusuna
   * "bu bildirimi gönderen benim" demenin standart yolu.
   *
   * İkisi de boşsa push tamamen KAPALI ve uçlar bunu açıkça söylüyor.
   * Yarı yapılandırılmış bir push'tan (açık görünüp sessizce hiçbir şey
   * göndermeyen) daha iyisi, kapalı olduğunu bilmek.
   */
  VAPID_ACIK_ANAHTAR: z.string().default(''),
  VAPID_GIZLI_ANAHTAR: z.string().default(''),
  /** Push servislerinin sorun çıkınca ulaşacağı adres. */
  VAPID_ILETISIM: z.string().default('mailto:bildirim@lordlarcagi.local'),
});

/*
 * BOŞ değer = verilmemiş.
 *
 * Barındırma panelleri boş bırakılan alanı çoğu zaman "" olarak geçiriyor
 * (render.yaml'daki `sync: false` alanları gibi). Zod'un varsayılanı yalnız
 * `undefined`'da devreye giriyor; "" ise varsayılanı ezip geçiyordu:
 * `UYGULAMA_URL ?? RENDER_EXTERNAL_URL` boş dizeyi seçip parola sıfırlama
 * bağlantılarını kırıyor, boş `VAPID_ILETISIM` push'u açılışta düşürüyordu.
 */
const verilenler = Object.fromEntries(
  Object.entries(process.env).filter(([, deger]) => deger !== undefined && deger.trim() !== ''),
);
const parsed = schema.safeParse(verilenler);
if (!parsed.success) {
  console.error('Ortam değişkenleri geçersiz:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  uygulamaUrl:
    parsed.data.UYGULAMA_URL ?? parsed.data.RENDER_EXTERNAL_URL ?? 'http://localhost:5173',
  /** Boşsa /olcum ucu hiç yüklenmez. */
  olcumAnahtari: parsed.data.OLCUM_ANAHTARI ?? '',
  runWorker: parsed.data.RUN_WORKER === 'true',
  serveWeb: parsed.data.SERVE_WEB === 'true',
  autoMigrate: parsed.data.AUTO_MIGRATE === 'true',
  seedDemoLords: parsed.data.SEED_DEMO_LORDS === 'true',
  webOrigins: parsed.data.WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** Push açık mı — iki anahtar da varsa. */
  pushAcik: Boolean(parsed.data.VAPID_ACIK_ANAHTAR && parsed.data.VAPID_GIZLI_ANAHTAR),
};
