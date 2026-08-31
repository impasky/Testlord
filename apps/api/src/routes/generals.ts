/** Generaller: kadro, kiralama, slot atama. */
import {
  GENERALS,
  aggregateGeneralBonus,
  generalDef,
  generalLevelMultiplier,
  generalSlots,
  generalXpForLevel,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { equippedGenerals, findLordByUser, tickLord } from '../services/lord.js';

export async function generalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/generals', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const [lord, sahipOlunan] = await Promise.all([
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { liderlik: true, altin: true },
      }),
      prisma.lordGeneral.findMany({ where: { lordId } }),
    ]);
    const sahipMap = new Map(sahipOlunan.map((g) => [g.generalKey, g]));
    const now = new Date();

    return {
      slots: generalSlots(lord.liderlik),
      altin: lord.altin,
      kadro: GENERALS.map((g) => {
        const sahip = sahipMap.get(g.key);
        return {
          ...g,
          sahipMi: Boolean(sahip),
          level: sahip?.level ?? 0,
          xp: sahip?.xp ?? 0,
          xpForNext: sahip ? generalXpForLevel(sahip.level) : 0,
          slotIndex: sahip?.slotIndex ?? null,
          dinleniyor: sahip?.restUntil && sahip.restUntil > now ? sahip.restUntil : null,
          etkinDeger: sahip ? g.pasif.deger * generalLevelMultiplier(sahip.level) : g.pasif.deger,
        };
      }),
      toplamBonus: aggregateGeneralBonus(equippedGenerals(sahipOlunan, now)),
    };
  });

  app.post('/generals/:key/hire', { preHandler: requireAuth }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const def = generalDef(key);
    if (!def) throw hata.bulunamadi('General');
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const zaten = await tx.lordGeneral.findUnique({
        where: { lordId_generalKey: { lordId, generalKey: key } },
      });
      if (zaten) throw new GameError('Bu general zaten kadronda.', 400, 'ZATEN_VAR');

      const state = await tickLord(lordId, new Date(), tx);
      if (state.resources.altin < def.maliyet_altin) {
        throw new GameError(
          `${def.ad} için ${def.maliyet_altin.toLocaleString('tr-TR')} altın gerekiyor, ` +
            `${Math.floor(state.resources.altin).toLocaleString('tr-TR')} altının var.`,
          400,
          'YETERSIZ_KAYNAK',
        );
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { altin: { decrement: def.maliyet_altin } },
      });
      await tx.lordGeneral.create({
        data: { lordId, generalKey: key, level: 1, xp: 0, slotIndex: null },
      });
      return { hired: key, kalanAltin: Math.floor(state.resources.altin) - def.maliyet_altin };
    });
  });

  app.post('/generals/:key/assign', { preHandler: requireAuth }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const { slotIndex } = z
      .object({ slotIndex: z.number().int().min(0).max(2).nullable() })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { liderlik: true },
      });
      const general = await tx.lordGeneral.findUnique({
        where: { lordId_generalKey: { lordId, generalKey: key } },
      });
      if (!general) throw new GameError('Bu general kadronda değil.', 400, 'KADRODA_YOK');

      if (slotIndex === null) {
        await tx.lordGeneral.update({ where: { id: general.id }, data: { slotIndex: null } });
        return { slotIndex: null };
      }

      const slots = generalSlots(lord.liderlik);
      if (slotIndex >= slots) {
        throw new GameError(
          `Sadece ${slots} general slotun var. Daha fazlası için Liderlik statını artır.`,
          400,
          'SLOT_YOK',
        );
      }

      // O slotta başka general varsa çıkar
      await tx.lordGeneral.updateMany({
        where: { lordId, slotIndex },
        data: { slotIndex: null },
      });
      await tx.lordGeneral.update({ where: { id: general.id }, data: { slotIndex } });
      return { slotIndex };
    });
  });
}
