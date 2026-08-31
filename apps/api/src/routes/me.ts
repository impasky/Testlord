import { STAT_KEYS, type StatKey } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';

const statsSchema = z.object({
  guc: z.number().int().min(0).default(0),
  dayaniklilik: z.number().int().min(0).default(0),
  liderlik: z.number().int().min(0).default(0),
  kurnazlik: z.number().int().min(0).default(0),
});

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const state = await tickLord(lordId);
    const [queues, events] = await Promise.all([
      prisma.queue.findMany({
        where: { lordId, resolved: false },
        orderBy: { finishAt: 'asc' },
      }),
      prisma.event.findMany({ where: { lordId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { lord: state, queues, events, serverTime: new Date().toISOString() };
  });

  app.post('/me/stats', { preHandler: requireAuth }, async (req) => {
    const body = statsSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const spend = STAT_KEYS.reduce((s, k) => s + body[k], 0);
    if (spend <= 0) throw new GameError('Dağıtılacak puan belirtmedin.', 400, 'GECERSIZ_ISTEK');

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { statPoints: true },
      });
      if (spend > lord.statPoints) {
        throw new GameError(
          `Sadece ${lord.statPoints} stat puanın var, ${spend} dağıtmaya çalıştın.`,
          400,
          'YETERSIZ_PUAN',
        );
      }
      const data: Record<string, { increment: number }> = {};
      for (const k of STAT_KEYS as readonly StatKey[]) {
        if (body[k] > 0) data[k] = { increment: body[k] };
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { ...data, statPoints: { decrement: spend } },
      });
      return tickLord(lordId, new Date(), tx);
    });
  });
}
