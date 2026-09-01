import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
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
import { armyRoutes } from './routes/army.js';
import { authRoutes } from './routes/auth.js';
import { devRoutes } from './routes/dev.js';
import { generalRoutes } from './routes/generals.js';
import { itemRoutes } from './routes/items.js';
import { mapRoutes } from './routes/map.js';
import { meRoutes } from './routes/me.js';
import { rankingRoutes } from './routes/rankings.js';
import { seedDemoLords } from './services/demoWorld.js';
import { createWorld } from './services/world.js';
import { startWorker } from './worker.js';

// Bozuk denge verisiyle ayağa kalkmaktansa hemen ölmek iyidir.
validateBalance();

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? { level: 'warn' } : true,
  });

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
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers.authorization ?? `ip:${req.ip}`,
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
    app.log.error(err);
    return reply.code(500).send({ error: 'Sunucu hatası.', code: 'SUNUCU_HATASI' });
  });

  app.get('/health', async () => ({ ok: true, time: new Date().toISOString() }));

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
  await app.register(generalRoutes, { prefix: '/api' });
  await app.register(rankingRoutes, { prefix: '/api' });

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
          `Veritabanına ${azamiSaniye} saniyedir ulaşılamıyor.\n` +
            'En sık sebep: veritabanı ile sunucu FARKLI BÖLGEDE. Render iç ağ\n' +
            'adresi (dpg-xxxxx-a) yalnızca aynı bölgeden çözülür. render.yaml\n' +
            'içinde databases[].region ile services[].region aynı olmalı.',
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
