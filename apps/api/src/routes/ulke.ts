/** ÜLKE UÇLARI (docs/27): ülke listesi, ülkem, ülke seçimi. */
import { ULKELER } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { findLordByUser } from '../services/lord.js';
import { lordIslemi } from '../services/kilit.js';
import { ulkeSec } from '../services/ulke.js';

const secSchema = z.object({ ulke: z.string().min(2).max(4) });

export async function ulkeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Seçim ekranı için bütün ülkeler: ad, şehir sayısı, başkent ve bu
   * diyarda orada başlamış lord sayısı. Statik kısım paylaşılan
   * paketten değil buradan gidiyor: haritanın tamamı telefonun ana
   * paketine girmesin.
   */
  app.get('/ulkeler', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, ulke: true },
    });
    const [sehirler, lordlar, tahtlar] = await Promise.all([
      prisma.region.groupBy({
        by: ['province'],
        where: { worldId: me.worldId },
        _count: { _all: true },
      }),
      prisma.lord.groupBy({
        by: ['ulke'],
        where: { worldId: me.worldId, ulke: { not: null } },
        _count: { _all: true },
      }),
      prisma.region.findMany({
        where: { worldId: me.worldId, type: 'taht' },
        select: { province: true, name: true, owner: { select: { id: true, name: true } } },
      }),
    ]);
    const sehirSayisi = new Map(sehirler.map((s) => [s.province, s._count._all]));
    const lordSayisi = new Map(lordlar.map((l) => [l.ulke, l._count._all]));
    const taht = new Map(tahtlar.map((t) => [t.province, t]));
    return {
      ulkem: me.ulke,
      ulkeler: [...ULKELER.values()]
        .filter((u) => sehirSayisi.has(u.key))
        .map((u) => ({
          kod: u.key,
          ad: u.name,
          adEn: u.name_en,
          sehirSayisi: sehirSayisi.get(u.key) ?? 0,
          lordSayisi: lordSayisi.get(u.key) ?? 0,
          baskent: taht.get(u.key)?.name ?? null,
          hukumdar: taht.get(u.key)?.owner ?? null,
        })),
    };
  });

  /** Ülkem: başkent, hükümdar, şehirlerin kaçı kimde. */
  app.get('/ulke', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, ulke: true },
    });
    if (!me.ulke) return { ulke: null };
    const u = ULKELER.get(me.ulke);
    const [sehirler, lordSayisi] = await Promise.all([
      prisma.region.findMany({
        where: { worldId: me.worldId, province: me.ulke },
        select: {
          id: true,
          name: true,
          type: true,
          ownerLordId: true,
          owner: { select: { id: true, name: true, isNpc: true } },
        },
        orderBy: { mapId: 'asc' },
      }),
      prisma.lord.count({ where: { worldId: me.worldId, ulke: me.ulke } }),
    ]);
    const taht = sehirler.find((s) => s.type === 'taht') ?? null;
    return {
      ulke: {
        kod: me.ulke,
        ad: u?.name ?? me.ulke,
        sehirSayisi: sehirler.length,
        lordSayisi,
        baskent: taht ? { id: taht.id, ad: taht.name, hukumdar: taht.owner } : null,
        benim: sehirler.filter((s) => s.ownerLordId === lordId).length,
        lordlarda: sehirler.filter((s) => s.ownerLordId !== null).length,
      },
    };
  });

  /** Ülke seçimi — bir kez (services/ulke.ts). */
  app.post('/ulke/sec', { preHandler: requireAuth }, async (req) => {
    const { ulke } = secSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    return lordIslemi(lordId, (tx) => ulkeSec(lordId, ulke, tx));
  });
}
