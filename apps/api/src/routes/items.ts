/** Ekipman: üretim, kuşanma, yükseltme, satış. */
import {
  B,
  EQUIP_SLOTS,
  canCraftTier,
  canUpgrade,
  craftPrice,
  itemPower,
  sellValue,
  tierUnlockLevel,
  upgradeCost,
  upgradeSuccessChance,
  type EquipSlot,
  type Rarity,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { ekipmanEtkisi } from '../services/hedef.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { assertQueueSlot, enqueue, spendResources } from '../services/queue.js';

const craftSchema = z.object({
  tier: z.number().int().min(1).max(5),
  slot: z.enum(EQUIP_SLOTS as unknown as [EquipSlot, ...EquipSlot[]]),
});

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/items', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const [items, lord] = await Promise.all([
      prisma.item.findMany({ where: { lordId }, orderBy: { createdAt: 'desc' } }),
      prisma.lord.findUniqueOrThrow({ where: { id: lordId }, select: { level: true } }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        power: Math.round(itemPower({ tier: i.tier, rarity: i.rarity as Rarity, upgradeLevel: i.upgradeLevel })),
        upgradeCost: canUpgrade(i.upgradeLevel) ? upgradeCost(i.tier, i.upgradeLevel) : null,
        upgradeChance: canUpgrade(i.upgradeLevel) ? upgradeSuccessChance(i.upgradeLevel) : null,
        sellValue: sellValue({
          slot: i.slot as EquipSlot,
          tier: i.tier,
          rarity: i.rarity as Rarity,
          upgradeLevel: i.upgradeLevel,
        }),
      })),
      tiers: [1, 2, 3, 4, 5].map((t) => ({
        tier: t,
        unlockLevel: tierUnlockLevel(t),
        unlocked: canCraftTier(lord.level, t),
        ...craftPrice(t),
        rarityTable: (B.ekipman.uretim_nadirlik_tablosu as Record<string, unknown>)[String(t)],
      })),
    };
  });

  app.post('/items/craft', { preHandler: requireAuth }, async (req) => {
    const { tier, slot } = craftSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { level: true },
      });
      if (!canCraftTier(lord.level, tier)) {
        throw new GameError(
          `T${tier} ekipman için seviye ${tierUnlockLevel(tier)} gerekiyor.`,
          400,
          'SEVIYE_YETERSIZ',
        );
      }
      await assertQueueSlot(lordId, 'craft', tx);
      const { cost, durationSec } = craftPrice(tier);
      await spendResources(lordId, cost, tx);
      const q = await enqueue(lordId, 'craft', { tier, slot }, durationSec, tx);
      return { queued: true, finishAt: q.finishAt };
    });
  });

  app.post('/items/:id/equip', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    const { equipped, onceki } = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item || item.lordId !== lordId) throw hata.bulunamadi('Eşya');
      // Değişiklikten ÖNCEKİ dizilim: karşılaştırma bunun üstünden yapılır.
      const oncekiEsyalar = await tx.item.findMany({ where: { lordId } });

      if (item.equipped) {
        await tx.item.update({ where: { id }, data: { equipped: false } });
        return { equipped: false, onceki: oncekiEsyalar };
      }
      // Aynı slottaki eşyayı çıkar
      await tx.item.updateMany({
        where: { lordId, slot: item.slot, equipped: true },
        data: { equipped: false },
      });
      await tx.item.update({ where: { id }, data: { equipped: true } });
      return { equipped: true, onceki: oncekiEsyalar };
    });

    // İşlemin DIŞINDA: savaş simülasyonu saf ama ucuz değil, veritabanı
    // kilitlerini onun için tutmanın anlamı yok.
    const sonraki = await prisma.item.findMany({ where: { lordId } });
    const etki = await ekipmanEtkisi(lordId, onceki, sonraki);
    return { equipped, etki };
  });

  app.post('/items/:id/upgrade', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item || item.lordId !== lordId) throw hata.bulunamadi('Eşya');
      if (!canUpgrade(item.upgradeLevel)) {
        throw new GameError('Bu eşya zaten en üst seviyede.', 400, 'MAKS_SEVIYE');
      }
      await assertQueueSlot(lordId, 'upgrade_item', tx);
      await spendResources(lordId, upgradeCost(item.tier, item.upgradeLevel), tx);
      // Yükseltme süresi: tier ve seviyeyle artar
      const durationSec = 60 * (item.tier + item.upgradeLevel);
      const q = await enqueue(lordId, 'upgrade_item', { itemId: id }, durationSec, tx);
      return {
        queued: true,
        finishAt: q.finishAt,
        chance: upgradeSuccessChance(item.upgradeLevel),
      };
    });
  });

  app.post('/items/:id/sell', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item || item.lordId !== lordId) throw hata.bulunamadi('Eşya');
      if (item.equipped) throw new GameError('Kuşandığın eşyayı satamazsın.', 400, 'KUSANIK');
      const value = sellValue({
        slot: item.slot as EquipSlot,
        tier: item.tier,
        rarity: item.rarity as Rarity,
        upgradeLevel: item.upgradeLevel,
      });
      await tickLord(lordId, new Date(), tx);
      await tx.item.delete({ where: { id } });
      await tx.lord.update({ where: { id: lordId }, data: { altin: { increment: value } } });
      return { sold: true, gold: value };
    });
  });
}
