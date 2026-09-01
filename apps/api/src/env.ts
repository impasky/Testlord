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
  /** Boşsa hata izleme kapalıdır ve dışarıya hiçbir şey gönderilmez. */
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
   * Parola sıfırlama bağlantısının tabanı (arayüzün herkese açık adresi).
   *
   * Verilmezse Render'ın kendi verdiği dış adres kullanılır. Bu yedek
   * olmadan üretimde varsayılan localhost kalıyordu ve sıfırlama
   * e-postaları kırık bağlantı taşıyordu.
   */
  UYGULAMA_URL: z.string().optional(),
  /** Render otomatik olarak veriyor; başka ortamlarda boştur. */
  RENDER_EXTERNAL_URL: z.string().optional(),
  /** pino seviyesi: fatal|error|warn|info|debug|trace */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);
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
  runWorker: parsed.data.RUN_WORKER === 'true',
  serveWeb: parsed.data.SERVE_WEB === 'true',
  autoMigrate: parsed.data.AUTO_MIGRATE === 'true',
  seedDemoLords: parsed.data.SEED_DEMO_LORDS === 'true',
  webOrigins: parsed.data.WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
