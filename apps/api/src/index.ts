import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
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

// Bozuk denge verisiyle ayağa kalkmaktansa hemen ölmek iyidir.
validateBalance();

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? { level: 'warn' } : true,
  });

  await app.register(cors, { origin: env.webOrigins, credentials: true });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: '7d' } });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  // Gövde istemeyen POST uçları (kuşan, sat, yükselt, kirala) Content-Type
  // application/json ile boş gövde alabilir. Fastify bunu varsayılan olarak
  // 400 ile reddeder; boş gövdeyi {} saymak tüm istemciler için doğru davranış.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body: string, done) => {
      if (!body || body.trim() === '') return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch {
        done(new GameError('Geçersiz JSON gövdesi.', 400, 'GECERSIZ_JSON'), undefined);
      }
    },
  );

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

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Lordlar Çağı API çalışıyor: http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}
