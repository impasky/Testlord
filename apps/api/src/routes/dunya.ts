/**
 * Dünya (shard) özeti.
 *
 * Oyunun ilk gerçek testinde oyuncu iki şey sordu: "harita niye bu kadar
 * küçük, tek oyunculu bir oyun mu bu" ve — oyunu kapatırken — "ne saçma
 * oyun". İkisinin de kaynağı aynı: oyun kaç kişilik olduğunu, kazanmanın ne
 * demek olduğunu ve oyuncunun nerede durduğunu hiçbir yerde söylemiyordu.
 * Taht Kalesi kodda vardı, oyuncuya hiç tanıtılmıyordu.
 *
 * Bu uç o üç cümlenin verisini veriyor. (docs/08 İ5, İ6)
 */
import { B } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { findLordByUser } from '../services/lord.js';

/** "Aktif" sayılmak için son bu kadar gün içinde girmiş olmak gerekir. */
const AKTIF_GUN = 7;

export async function dunyaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dunya', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const ben = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, fame: true, name: true },
    });

    const aktifSinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);

    const [dunya, lordSayisi, aktif, ustumde, taht, sonSavaslar] = await Promise.all([
      prisma.world.findUniqueOrThrow({
        where: { id: ben.worldId },
        select: { name: true, playerCap: true },
      }),
      prisma.lord.count({ where: { worldId: ben.worldId } }),
      prisma.lord.count({ where: { worldId: ben.worldId, lastSeenAt: { gte: aktifSinir } } }),
      prisma.lord.count({
        where: { worldId: ben.worldId, id: { not: lordId }, fame: { gt: ben.fame } },
      }),
      prisma.region.findFirst({
        where: { worldId: ben.worldId, type: 'taht' },
        select: { id: true, name: true, owner: { select: { id: true, name: true } } },
      }),
      // Haritanın "yaşayan yer" hissi için son savaşlar. Veri zaten Battle
      // tablosunda; yeni model gerekmiyor. Sahte veri üretilmiyor — savaş
      // yoksa liste boş döner ve arayüz şeridi hiç göstermez.
      prisma.battle.findMany({
        where: { worldId: ben.worldId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          createdAt: true,
          captured: true,
          result: true,
          regionId: true,
          attacker: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
          log: true,
        },
      }),
    ]);

    return {
      ad: dunya.name,
      kapasite: dunya.playerCap,
      lordSayisi,
      aktifLord: aktif,
      aktifGun: AKTIF_GUN,
      bolgeSayisi: B.bolgeler.toplam,
      benimSiram: ustumde + 1,
      benimSohretim: ben.fame,
      taht: taht
        ? {
            regionId: taht.id,
            name: taht.name,
            sahip: taht.owner ? { id: taht.owner.id, name: taht.owner.name } : null,
            sohretBonusu: B.taht_kalesi.unvan_sohret_bonusu,
          }
        : null,
      olaylar: sonSavaslar.map((b) => {
        const log = b.log as { regionName?: string } | null;
        return {
          id: b.id,
          zaman: b.createdAt,
          bolgeId: b.regionId,
          bolge: log?.regionName ?? 'bilinmeyen bölge',
          saldiran: b.attacker.name,
          savunan: b.defender?.name ?? null,
          saldiranKazandi: b.result === 'attacker_win',
          eleGecti: b.captured,
        };
      }),
    };
  });
}
