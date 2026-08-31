/**
 * Geliştirme yardımcıları — zamanı ileri sarar.
 * ÜRETİMDE KAYITLI DEĞİL: index.ts bu rotaları sadece NODE_ENV !== 'production'
 * iken bağlar. Oyuncuya avantaj sağlayan hiçbir şey yapmaz, sadece bekleme
 * sürelerini atlar; testlerin dakikalarca beklememesi için.
 */
import { WORLD_MAP } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { findLordByUser, grantXp, tickLord } from '../services/lord.js';
import { resolveMarch } from '../services/march.js';
import { resolveQueueItem } from '../services/queue.js';

export async function devRoutes(app: FastifyInstance): Promise<void> {
  /** Bekleyen tüm kuyrukları hemen bitirir. */
  app.post('/test/kuyruklari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const queues = await prisma.queue.findMany({ where: { lordId, resolved: false } });
    await prisma.queue.updateMany({
      where: { lordId, resolved: false },
      data: { finishAt: new Date() },
    });
    let n = 0;
    for (const q of queues) if (await resolveQueueItem({ ...q, finishAt: new Date() })) n++;
    return { cozulen: n };
  });

  /** Bekleyen tüm yürüyüşleri hemen vardırır ve çözer. */
  app.post('/test/yuruyusleri-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const marches = await prisma.march.findMany({ where: { lordId, resolved: false } });
    await prisma.march.updateMany({
      where: { lordId, resolved: false },
      data: { arriveAt: new Date() },
    });
    let n = 0;
    for (const m of marches) if (await resolveMarch(m.id)) n++;
    return { cozulen: n };
  });

  /** Saati geriye alır: gelir birikimini test etmek için. */
  app.post('/test/saat-ilerlet', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const saat = Number((req.body as { saat?: number })?.saat ?? 1);
    const geri = new Date(Date.now() - saat * 3_600_000);
    await prisma.lord.update({ where: { id: lordId }, data: { lastTickAt: geri } });
    await prisma.region.updateMany({ where: { ownerLordId: lordId }, data: { lastTickAt: geri } });
    return tickLord(lordId);
  });

  /** XP verir: seviye bağımlı sistemleri test etmek için. */
  app.post('/test/xp-ver', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const miktar = Number((req.body as { miktar?: number })?.miktar ?? 1000);
    return grantXp(lordId, miktar);
  });

  /** NPC bölgelerini world-map.json'daki tabana döndürür (testler arası izolasyon). */
  app.post('/test/bolgeleri-sifirla', { preHandler: requireAuth }, async () => {
    let n = 0;
    for (const r of WORLD_MAP.regions) {
      const guncel = await prisma.region.findUnique({ where: { id: r.id } });
      if (!guncel || guncel.ownerLordId) continue;
      await prisma.region.update({
        where: { id: r.id },
        data: { npcGarrison: r.npc_garrison as object, level: r.level, shieldUntil: null },
      });
      n++;
    }
    return { sifirlanan: n };
  });

  /** Kaynak verir: pahalı sistemleri test etmek için. */
  app.post('/test/kaynak-ver', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const b = (req.body ?? {}) as { altin?: number; demir?: number; erzak?: number };
    await tickLord(lordId);
    return prisma.lord.update({
      where: { id: lordId },
      data: {
        altin: { increment: Math.round(b.altin ?? 0) },
        demir: { increment: Math.round(b.demir ?? 0) },
        erzak: { increment: Math.round(b.erzak ?? 0) },
      },
      select: { altin: true, demir: true, erzak: true },
    });
  });
}
