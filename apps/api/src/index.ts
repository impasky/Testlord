import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBalance } from '@lordlar/shared';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { prisma } from './db.js';
import { env } from './env.js';
import { GameError } from './errors.js';
import { hataBildir, izlemeAcikMi, izlemeBaslat, surecHatalariniYakala } from './izleme.js';
import { armyRoutes } from './routes/army.js';
import { authRoutes } from './routes/auth.js';
import { devRoutes } from './routes/dev.js';
import { dunyaRoutes } from './routes/dunya.js';
import { gunlukRoutes } from './routes/gunluk.js';
import { seferRoutes } from './routes/sefer.js';
import { ittifakRoutes } from './routes/ittifak.js';
import { arastirmaRoutes } from './routes/arastirma.js';
import { akinRoutes } from './routes/akin.js';
import { sehirRoutes } from './routes/sehir.js';
import { pazarRoutes } from './routes/pazar.js';
import { ticaretRoutes } from './routes/ticaret.js';
import { generalRoutes } from './routes/generals.js';
import { itemRoutes } from './routes/items.js';
import { mapRoutes } from './routes/map.js';
import { medeniyetRoutes } from './routes/medeniyet.js';
import { pushRoutes } from './routes/push.js';
import { meRoutes } from './routes/me.js';
import { olcumRoutes } from './routes/olcum.js';
import { rankingRoutes } from './routes/rankings.js';
import { moderasyonRoutes } from './routes/moderasyon.js';
import { yoneticiRoutes } from './routes/yonetici.js';
import { seedDemoLords } from './services/demoWorld.js';
import { createWorld } from './services/world.js';
import { startWorker } from './worker.js';

// Bozuk denge verisiyle ayağa kalkmaktansa hemen ölmek iyidir.
validateBalance();

// Sunucu kurulmadan önce: Sentry'nin otomatik araçlaması, izleyeceği
// kütüphaneler yüklenmeden önce başlatılmayı bekler.
izlemeBaslat();

/** Adresin sorgu dizgisiz hâli: günlüğe ve hata izlemeye giden tek biçim. */
function yolYalniz(url: string): string {
  return url.split('?')[0] ?? url;
}

export async function buildServer() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'warn' }
        : {
            level: env.LOG_LEVEL,
            // Log'a token ya da parola düşmesin. Bir kez sızan log satırı
            // kalıcıdır: toplanır, aktarılır, yedeklenir.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'res.headers["set-cookie"]',
              ],
              censor: '[gizlendi]',
            },
            /*
             * İstek satırı SORGU DİZGİSİZ yazılıyor. Varsayılan serileştirici
             * tam adresi basıyordu ve `/api/olcum?anahtar=…` her çağrıda
             * anahtarı günlüğe düşürüyordu. Günlük toplanır, aktarılır,
             * yedeklenir; sızan satır geri alınamaz.
             */
            serializers: {
              req: (req: { method: string; url: string; ip?: string }) => ({
                method: req.method,
                url: yolYalniz(req.url),
                remoteAddress: req.ip,
              }),
            },
          },
  });

  surecHatalariniYakala(app.log);

  /**
   * CORS.
   *
   * Üretimde SADECE WEB_ORIGIN listesindeki adresler.
   *
   * Geliştirmede her kaynağa izin verilir. Sebep: geliştirme sunucusuna
   * telefondan (LAN IP), Docker köprüsünden, VPN'den ya da tünelden
   * erişilebiliyor ve bu adresleri önceden bilmenin yolu yok. Özel IP
   * aralıklarını beyaz listeye almayı denedim; ağ topolojisine göre kırılıyor.
   *
   * Güvenlik açısından bir kayıp değil: CORS tarayıcı içi bir kısıttır, API'yi
   * korumaz. Geliştirme modunda zaten /api/test/* uçları açık, dolayısıyla
   * geliştirme sunucusu güvenilmeyen bir ağa açılmamalı — bu CORS'tan bağımsız.
   */
  /*
   * SIKIŞTIRMA — soğuk açılışın en pahalı kalemi buydu.
   *
   * Oyuncu: "sayfalar geç yükleniyor, uygulamayı ilk açtığımda oluyor."
   * Üretim derlemesi telefon koşullarında ölçüldü ve sunucunun yanıtları
   * HİÇ SIKIŞTIRMADIĞI çıktı: `Accept-Encoding: gzip` istense bile
   * `Content-Encoding` başlığı yok ve ana paket 409.610 baytın tamamıyla
   * gidiyordu. Vite derleme çıktısında "gzip: 194 kB" yazıyor ama o
   * sayı hiçbir zaman gerçekleşmiyordu — kimse sıkıştırmıyordu.
   *
   * Yavaş bir bağlantıda bu, oyuncunun boş ekrana bakma süresinin üç
   * katı demek. Eklenti tek satır; kazanç kodun tamamını bölmekten
   * büyük.
   *
   * `global: true`: yalnız statik dosyalar değil API yanıtları da
   * sıkıştırılıyor. Harita ve sıralama uçları yüzlerce satırlık JSON
   * döndürüyor ve onlar da aynı bağlantıdan geçiyor.
   */
  await app.register(compress, { global: true, encodings: ['br', 'gzip', 'deflate'] });
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? env.webOrigins : true,
    credentials: true,
  });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: '7d' } });
  // Sınır IP'ye değil oturuma bağlı. Mobil oyuncuların çoğu operatör NAT'ı
  // arkasında: aynı çıkış IP'sini paylaşan onlarca oyuncu, IP başına sayan
  // bir sınırda birbirini kilitler ve kimse hata yaptığını anlamaz.
  //
  // Anahtar için token'ın kendisi yeterli: burada yetkilendirme yapmıyoruz,
  // sadece kararlı bir kova anahtarı arıyoruz. Doğrulama zaten preHandler'da.
  // (rateLimit onRequest'te çalışır, yani req.user henüz dolmamıştır.)
  /*
   * Kova anahtarı DOĞRULANMIŞ jetonun kullanıcısı, jetonun metni değil.
   *
   * Eskiden başlığın ham metni anahtardı: her istekte uydurma bir
   * `Authorization` gönderen, her seferinde yeni ve boş bir kova açıp IP
   * sınırından tamamen kaçıyordu. Aynı kişinin birkaç geçerli jetonu da
   * birkaç ayrı kova demekti. Doğrulama ucuz (HMAC) ve geçersiz jeton IP
   * kovasına düşüyor.
   */
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const b = req.headers.authorization;
      if (b?.startsWith('Bearer ')) {
        try {
          return `u:${app.jwt.verify<{ userId: string }>(b.slice(7)).userId}`;
        } catch {
          /* geçersiz jeton: IP kovasına düşsün */
        }
      }
      return `ip:${req.ip}`;
    },
  });

  /*
   * GÜVENLİK BAŞLIKLARI — önceden hiçbiri yoktu.
   *
   * Oturum jetonu tarayıcı deposunda duruyor; oraya uzanabilen tek şey
   * sayfada çalışan bir betik. CSP yalnız kendi adresimizden betik
   * çalıştırıyor: bir gün bir metin kaçışı unutulsa bile enjekte edilen
   * betik çalışmaz. Yazı tipi de artık paketin içinde (styles.css başı),
   * o yüzden hiçbir dış adrese izin gerekmiyor.
   *
   * `style-src 'unsafe-inline'`: ikonlar SVG metni olarak basılıyor ve
   * içlerinde `style` öznitelikleri var. Stil enjeksiyonu betik
   * çalıştırmıyor; bedeli düşük.
   *
   * `frame-ancestors 'none'` + `X-Frame-Options`: oyun başka bir sayfanın
   * çerçevesine gömülüp oyuncuya görünmez tıklatılamasın.
   */
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('Content-Security-Policy', CSP);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    // Parola sıfırlama jetonu adresin # kısmında; yine de hiçbir adres dışarı sızmasın.
    reply.header('Referrer-Policy', 'no-referrer');
    if (env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    return payload;
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof GameError) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.code });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: err.issues[0]?.message ?? 'Geçersiz istek.',
        code: 'GECERSIZ_ISTEK',
        issues: err.issues,
      });
    }
    const asHttp = err as { statusCode?: number; message?: string };
    if (asHttp.statusCode && asHttp.statusCode < 500) {
      return reply
        .code(asHttp.statusCode)
        .send({ error: asHttp.message ?? 'İstek hatası.', code: 'ISTEK_HATASI' });
    }
    // Buraya düşen her şey gerçek bir sunucu hatası: yukarıdaki dallar
    // oyunun kendi kurallarını (4xx) çoktan ayıkladı.
    app.log.error(
      { err, yol: yolYalniz(_req.url), yontem: _req.method, istekId: _req.id },
      'Sunucu hatası',
    );
    hataBildir(err, {
      yol: yolYalniz(_req.url),
      yontem: _req.method,
      istekId: String(_req.id),
      lordId: (_req as { user?: { userId?: string } }).user?.userId,
    });
    return reply.code(500).send({ error: 'Sunucu hatası.', code: 'SUNUCU_HATASI' });
  });

  app.get('/health', async () => ({
    ok: true,
    time: new Date().toISOString(),
    izleme: izlemeAcikMi() ? 'acik' : 'kapali',
  }));

  /**
   * Tek servisli dağıtım: derlenmiş arayüzü aynı sunucudan sunar.
   * Aynı origin olduğu için CORS hiç devreye girmez ve dağıtım tek servise iner.
   */
  if (env.serveWeb) {
    const buraya = dirname(fileURLToPath(import.meta.url));
    const adaylar = [
      resolve(buraya, '../../web/dist'),
      resolve(buraya, '../../../apps/web/dist'),
      resolve(process.cwd(), 'apps/web/dist'),
    ];
    const webDist = adaylar.find((y) => existsSync(join(y, 'index.html')));

    if (!webDist) {
      app.log.error(`Arayüz bulunamadı. Bakılan yerler: ${adaylar.join(', ')}`);
    } else {
      await app.register(fastifyStatic, { root: webDist, wildcard: false });
      // Tek sayfalık uygulama: /api dışındaki tüm yollar index.html'e düşer
      app.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith('/api')) {
          return reply.code(404).send({ error: 'Böyle bir uç yok.', code: 'BULUNAMADI' });
        }
        return reply.sendFile('index.html');
      });
      app.log.info(`Arayüz sunuluyor: ${webDist}`);
    }
  }

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(meRoutes, { prefix: '/api' });
  await app.register(itemRoutes, { prefix: '/api' });
  await app.register(armyRoutes, { prefix: '/api' });
  await app.register(mapRoutes, { prefix: '/api' });
  await app.register(medeniyetRoutes, { prefix: '/api' });
  await app.register(pushRoutes, { prefix: '/api' });
  await app.register(generalRoutes, { prefix: '/api' });
  await app.register(rankingRoutes, { prefix: '/api' });
  await app.register(dunyaRoutes, { prefix: '/api' });
  await app.register(gunlukRoutes, { prefix: '/api' });
  await app.register(seferRoutes, { prefix: '/api' });
  await app.register(ittifakRoutes, { prefix: '/api' });
  await app.register(ticaretRoutes, { prefix: '/api' });
  await app.register(arastirmaRoutes, { prefix: '/api' });
  await app.register(pazarRoutes, { prefix: '/api' });
  await app.register(sehirRoutes, { prefix: '/api' });
  await app.register(akinRoutes, { prefix: '/api' });
  await app.register(moderasyonRoutes, { prefix: '/api' });
  await app.register(yoneticiRoutes, { prefix: '/api' });

  // Ölçüm ucu yalnızca anahtar tanımlıysa var olur: tanımsızken uç hiç
  // yoktur, yanlış yapılandırma ile açıkta kalamaz.
  if (env.olcumAnahtari) {
    await app.register(olcumRoutes, { prefix: '/api' });
    app.log.info('Ölçüm ucu açık: /api/olcum');
  }

  // Zaman ilerletme yardımcıları ÜRETİMDE hiç yüklenmez.
  if (env.NODE_ENV !== 'production') {
    await app.register(devRoutes, { prefix: '/api' });
    app.log.warn('Geliştirme test uçları açık (/api/test/*). Üretimde yüklenmez.');
  }

  return app;
}

/**
 * Dağıtımda açılış hazırlığı: migration'ları uygula, dünya yoksa aç,
 * istenmişse rakip lordları ekle. Hepsi tekrar çalıştırılabilir.
 */
async function veritabaniniBekle(azamiSaniye = 120): Promise<void> {
  const bitis = Date.now() + azamiSaniye * 1000;
  let deneme = 0;
  for (;;) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (deneme > 0) console.log(`Veritabanı ${deneme} denemede hazır oldu.`);
      return;
    } catch (e) {
      deneme++;
      if (Date.now() >= bitis) {
        console.error(
          `Veritabanına ${azamiSaniye} saniyedir ulaşılamıyor.\nEn sık sebep: veritabanı ile sunucu FARKLI BÖLGEDE. Render iç ağ
adresi (dpg-xxxxx-a) yalnızca aynı bölgeden çözülür. render.yaml
içinde databases[].region ile services[].region aynı olmalı.`,
        );
        throw e;
      }
      const bekle = Math.min(5000, 500 * deneme);
      if (deneme === 1) console.log('Veritabanı henüz hazır değil, bekleniyor...');
      await new Promise((r) => setTimeout(r, bekle));
    }
  }
}

async function acilisHazirligi(): Promise<void> {
  // Render'da veritabanı sunucudan sonra hazır olabiliyor; beklemeden
  // migration çalıştırmak servisi sonsuz yeniden başlatma döngüsüne sokar.
  await veritabaniniBekle();

  if (env.autoMigrate) {
    console.log('Migration uygulanıyor...');
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    });
  }

  let dunya = await prisma.world.findFirst({ where: { status: 'open' } });
  if (!dunya) {
    const id = await createWorld();
    dunya = await prisma.world.findUniqueOrThrow({ where: { id } });
    console.log(`Dünya açıldı: ${dunya.name}`);
  }

  if (env.seedDemoLords) await seedDemoLords(dunya.id);
}

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  await acilisHazirligi();
  const app = await buildServer();
  if (env.runWorker) startWorker();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Lordlar Çağı API çalışıyor: http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}
