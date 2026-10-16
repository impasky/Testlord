/**
 * /app-ads.txt — AdMob, yayıncının sitesinde bu dosyayı arıyor (Play
 * kaydındaki web sitesinin kökünde, docs/25). Yayıncı kimliği verilmemişse
 * yok. Oyuncuya görünen bir metin değil; AdMob'un tarayıcısı okuyor.
 */
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

export async function appAdsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/app-ads.txt', async (_req, reply) => {
    if (!env.ADMOB_YAYINCI_KIMLIGI) return reply.code(404).send('');
    return reply
      .type('text/plain; charset=utf-8')
      .send(`google.com, ${env.ADMOB_YAYINCI_KIMLIGI}, DIRECT, f08c47fec0942fa0\n`);
  });
}
