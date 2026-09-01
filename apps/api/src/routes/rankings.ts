/**
 * Üç sıralama (docs/01 §8).
 *
 * Üç ayrı liste, çünkü tek sıralama tek oyun tarzını ödüllendirir. Özellikle
 * Kılıç sıralaması önemli: bölge tutamayan oyuncunun da tırmanacağı bir
 * merdiven olur, böylece kaybeden oyuncu oyundan çıkmaz.
 */
import { conquestScore } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser } from '../services/lord.js';

const SAYFA = 25;

type Board = 'fame' | 'conquest' | 'elo';

interface Satir {
  sira: number;
  lordId: string;
  name: string;
  level: number;
  deger: number;
  bolgeSayisi: number;
  tahtSahibi: boolean;
}

/** Fetih puanı bölgelerden hesaplandığı için SQL'de sıralanamaz; bellekte yapılır. */
async function fetihSiralamasi(worldId: string): Promise<Satir[]> {
  const lords = await prisma.lord.findMany({
    where: { worldId },
    select: {
      id: true,
      name: true,
      level: true,
      regions: { select: { type: true, level: true } },
    },
  });
  return lords
    .map((l) => ({
      sira: 0,
      lordId: l.id,
      name: l.name,
      level: l.level,
      deger: conquestScore(l.regions),
      bolgeSayisi: l.regions.filter((r) => r.type !== 'taht').length,
      tahtSahibi: l.regions.some((r) => r.type === 'taht'),
    }))
    .sort((a, b) => b.deger - a.deger)
    .map((r, i) => ({ ...r, sira: i + 1 }));
}

async function basitSiralama(worldId: string, alan: 'fame' | 'elo'): Promise<Satir[]> {
  const lords = await prisma.lord.findMany({
    where: { worldId },
    orderBy: { [alan]: 'desc' },
    select: {
      id: true,
      name: true,
      level: true,
      fame: true,
      elo: true,
      regions: { select: { type: true } },
    },
  });
  return lords.map((l, i) => ({
    sira: i + 1,
    lordId: l.id,
    name: l.name,
    level: l.level,
    deger: alan === 'fame' ? l.fame : l.elo,
    bolgeSayisi: l.regions.filter((r) => r.type !== 'taht').length,
    tahtSahibi: l.regions.some((r) => r.type === 'taht'),
  }));
}

export async function rankingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/rankings/:board', { preHandler: requireAuth }, async (req) => {
    const { board } = z
      .object({ board: z.enum(['fame', 'conquest', 'elo']) })
      .parse(req.params);
    const { page } = z.object({ page: z.coerce.number().int().min(0).default(0) }).parse(req.query);

    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });

    const tum: Satir[] =
      board === 'conquest'
        ? await fetihSiralamasi(me.worldId)
        : await basitSiralama(me.worldId, board as 'fame' | 'elo');

    const benim = tum.find((r) => r.lordId === lordId) ?? null;

    return {
      board: board as Board,
      toplam: tum.length,
      sayfa: page,
      sayfaBoyu: SAYFA,
      satirlar: tum.slice(page * SAYFA, page * SAYFA + SAYFA),
      benim,
    };
  });

  /**
   * Bir lordu şikâyet eder.
   *
   * Şikâyet edilen lorda hiçbir şey OLMUYOR: kayıt tutuluyor, kararı insan
   * veriyor. Otomatik ceza, kalabalığın birini oyundan atmasına yarayan bir
   * silaha dönerdi.
   */
  app.post('/rapor/:lordId', { preHandler: requireAuth }, async (req) => {
    const { lordId: hedefId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const { sebep } = z
      .object({ sebep: z.string().min(3, 'Sebebi kısaca yaz.').max(300) })
      .parse(req.body);

    const benim = await findLordByUser(req.user.userId);
    if (benim === hedefId) {
      throw new GameError('Kendini şikâyet edemezsin.', 400, 'GECERSIZ_ISTEK');
    }
    if (!(await prisma.lord.findUnique({ where: { id: hedefId }, select: { id: true } }))) {
      throw hata.bulunamadi('Lord');
    }

    // Aynı kişiyi tekrar tekrar şikâyet etmek sayıyı şişirmesin: tek kayıt,
    // sebebi güncellenir.
    await prisma.report.upsert({
      where: { reporterId_targetId: { reporterId: benim, targetId: hedefId } },
      create: { reporterId: benim, targetId: hedefId, reason: sebep },
      update: { reason: sebep, createdAt: new Date() },
    });

    return { alindi: true };
  });
}
