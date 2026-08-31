/** Ordu: birim eğitimi, terhis, ordu donanım hatları. */
import {
  B,
  GEAR_LINES,
  UNIT_TYPES,
  armySlots,
  commandCapacity,
  unit,
  type GearLineKey,
  type UnitType,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { collectAllUnits, findLordByUser, tickLord } from '../services/lord.js';
import { addUnitsHome, assertQueueSlot, enqueue, spendResources } from '../services/queue.js';

const trainSchema = z.object({
  unitType: z.enum(UNIT_TYPES as unknown as [UnitType, ...UnitType[]]),
  count: z.number().int().min(1).max(5000),
});

const disbandSchema = trainSchema;

/** Ordu donanım hattının bir sonraki seviyesinin maliyeti ve süresi. */
function gearUpgradeCost(level: number): { altin: number; demir: number; erzak: number; sec: number } {
  const g = B.ordu_donanimi;
  const n = level + 1;
  return {
    altin: Math.round(g.maliyet_taban.altin * Math.pow(g.maliyet_us, n - 1)),
    demir: Math.round(g.maliyet_taban.demir * Math.pow(g.maliyet_us, n - 1)),
    erzak: 0,
    sec: Math.round(3600 * Math.pow(g.sure_us, n - 1)),
  };
}

export async function armyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/army', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const state = await tickLord(lordId);
    const units = await prisma.armyUnit.findMany({ where: { lordId } });

    return {
      home: state.homeArmy,
      byLocation: units.map((u) => ({
        unitType: u.unitType,
        count: u.count,
        locationType: u.locationType,
        locationId: u.locationId,
      })),
      commandCapacity: state.commandCapacity,
      usedSlots: state.usedSlots,
      upkeepPerHour: state.upkeepPerHour,
      netErzakPerHour: state.netErzakPerHour,
      units: UNIT_TYPES.map((t) => ({ type: t, ...unit(t) })),
    };
  });

  app.post('/army/train', { preHandler: requireAuth }, async (req) => {
    const { unitType, count } = trainSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const u = unit(unitType);

    return prisma.$transaction(async (tx) => {
      const state = await tickLord(lordId, new Date(), tx);

      // Kuyruktakiler de yer tutar; oyuncu kapasitesini aşan eğitim veremez.
      const kuyruktakiler = await tx.queue.findMany({
        where: { lordId, kind: 'train', resolved: false },
      });
      const kuyrukYeri = kuyruktakiler.reduce((s, q) => {
        const p = q.payload as { unitType?: string; count?: number };
        const t = p.unitType as UnitType | undefined;
        return s + (t && UNIT_TYPES.includes(t) ? unit(t).yer * (p.count ?? 0) : 0);
      }, 0);

      const yeniYer = u.yer * count;
      if (state.usedSlots + kuyrukYeri + yeniYer > state.commandCapacity) {
        const bos = state.commandCapacity - state.usedSlots - kuyrukYeri;
        throw new GameError(
          `Komuta kapasiten yetmiyor. Boş yer: ${Math.max(0, bos)}, gereken: ${yeniYer}. ` +
            'Liderlik statını artır ya da daha az birim eğit.',
          400,
          'KAPASITE_YETERSIZ',
        );
      }

      await assertQueueSlot(lordId, 'train', tx);
      await spendResources(
        lordId,
        {
          altin: u.maliyet.altin * count,
          demir: u.maliyet.demir * count,
          erzak: u.maliyet.erzak * count,
        },
        tx,
      );
      const q = await enqueue(lordId, 'train', { unitType, count }, u.egitim_sn * count, tx);
      return { queued: true, finishAt: q.finishAt };
    });
  });

  app.post('/army/disband', { preHandler: requireAuth }, async (req) => {
    const { unitType, count } = disbandSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const row = await tx.armyUnit.findFirst({
        where: { lordId, unitType, locationType: 'home', locationId: null },
      });
      if (!row || row.count < count) {
        throw new GameError('Evde o kadar birimin yok.', 400, 'BIRIM_YOK');
      }
      await addUnitsHome(lordId, unitType, -count, tx);
      return { disbanded: count };
    });
  });

  app.get('/gear', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lines = await prisma.gearLine.findMany({ where: { lordId } });
    const map = new Map(lines.map((l) => [l.line, l.level]));
    const cfg = B.ordu_donanimi.hatlar as Record<string, { ad: string; etki: string; max_seviye: number }>;

    return GEAR_LINES.map((line) => {
      const level = map.get(line) ?? 0;
      const c = cfg[line]!;
      return {
        line,
        ad: c.ad,
        etki: c.etki,
        level,
        maxLevel: c.max_seviye,
        bonus: level * B.ordu_donanimi.hatlar.silahlik.seviye_basina,
        nextCost: level < c.max_seviye ? gearUpgradeCost(level) : null,
      };
    });
  });

  app.post('/gear/:line/upgrade', { preHandler: requireAuth }, async (req) => {
    const { line } = z
      .object({ line: z.enum(GEAR_LINES as unknown as [GearLineKey, ...GearLineKey[]]) })
      .parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const gl = await tx.gearLine.findUnique({ where: { lordId_line: { lordId, line } } });
      if (!gl) throw hata.bulunamadi('Donanım hattı');
      const max = (B.ordu_donanimi.hatlar as Record<string, { max_seviye: number }>)[line]!.max_seviye;
      if (gl.level >= max) throw new GameError('Bu hat zaten en üst seviyede.', 400, 'MAKS_SEVIYE');

      await assertQueueSlot(lordId, 'upgrade_gear', tx);
      const c = gearUpgradeCost(gl.level);
      await spendResources(lordId, { altin: c.altin, demir: c.demir, erzak: 0 }, tx);
      const q = await enqueue(lordId, 'upgrade_gear', { line }, c.sec, tx);
      return { queued: true, finishAt: q.finishAt, level: gl.level + 1 };
    });
  });
}

export { armySlots, collectAllUnits, commandCapacity };
