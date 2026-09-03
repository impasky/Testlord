/**
 * Günlük görevler ve giriş serisi.
 *
 * Ayrı bir uç, `/me`'ye eklenmiş bir alan değil. Sebep: görev ilerlemesi
 * üç ayrı sayım sorgusu gerektiriyor ve `/me` sık yoklanıyor. Malikâne'deki
 * kart bunu bir kez çekiyor.
 *
 * Seri BURADA güncelleniyor, çünkü oyuncunun "bugün girdiği" an bu ucun
 * çağrıldığı andır. `/me` de çağrılıyor ama o polling ile de geliyor;
 * seriyi orada güncellemek, açık sekmesi olan oyuncunun serisini gece
 * yarısı kendiliğinden artırırdı. (docs/09 K4)
 */
import { gunNumarasi, gunlukGorevler, seriGuncelle } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { findLordByUser } from '../services/lord.js';

/** Bugünün UTC başlangıcı — sayımların alt sınırı. */
function gunBasi(simdi: Date): Date {
  return new Date(gunNumarasi(simdi) * 86_400_000);
}

export async function gunlukRoutes(app: FastifyInstance): Promise<void> {
  app.get('/gunluk', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const bugun = gunBasi(simdi);

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { girisSerisi: true, girisSerisiGunu: true },
    });

    const seri = seriGuncelle(lord.girisSerisi, lord.girisSerisiGunu, simdi);
    if (seri.bugunIlk) {
      await prisma.lord.update({
        where: { id: lordId },
        data: { girisSerisi: seri.seri, girisSerisiGunu: simdi },
      });
    }

    // Üç sayım: hepsi var olan kayıtlardan. Yeni sayaç tutmuyoruz —
    // tutsak gerçekle sapardı.
    const [saldiri, egitim, imar] = await Promise.all([
      prisma.battle.count({
        where: { attackerLordId: lordId, createdAt: { gte: bugun } },
      }),
      prisma.queue.count({
        where: { lordId, kind: 'train', startedAt: { gte: bugun } },
      }),
      prisma.queue.count({
        where: {
          lordId,
          kind: { in: ['craft', 'upgrade_item', 'upgrade_gear', 'upgrade_region'] },
          startedAt: { gte: bugun },
        },
      }),
    ]);

    return {
      gorevler: gunlukGorevler({ saldiri, egitim, imar }),
      seri: seri.seri,
      bugunIlk: seri.bugunIlk,
    };
  });
}
