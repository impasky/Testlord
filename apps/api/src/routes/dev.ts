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
import { GameError, hata } from '../errors.js';
import { findLordByUser, grantXp, tickLord } from '../services/lord.js';
import { resolveMarch } from '../services/march.js';
import { resolveQueueItem } from '../services/queue.js';
import { sevkiyatCoz } from '../services/ticaret.js';

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

  /**
   * Çağıranın dünyasındaki tüm kalkanları kaldırır: bölge fetih korumaları ve
   * lordların yeni oyuncu korumaları. Demo dünyası kurulduktan sonra her şeyin
   * hemen saldırılabilir olması için.
   */
  app.post('/test/kalkanlari-kaldir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });
    const b = await prisma.region.updateMany({ where: { worldId }, data: { shieldUntil: null } });
    const l = await prisma.lord.updateMany({
      where: { worldId, id: { not: lordId } },
      data: { protectionUntil: null },
    });
    return { bolgeKalkani: b.count, lordKalkani: l.count };
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

  /** Bekleyen sevkiyatları hemen vardırır. */
  app.post('/test/sevkiyatlari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const sevk = await prisma.shipment.findMany({
      where: { resolved: false, OR: [{ fromLordId: lordId }, { toLordId: lordId }] },
    });
    await prisma.shipment.updateMany({
      where: { resolved: false, OR: [{ fromLordId: lordId }, { toLordId: lordId }] },
      data: { arriveAt: new Date() },
    });
    let n = 0;
    for (const s of sevk) if (await sevkiyatCoz(s.id)) n++;
    return { cozulen: n };
  });

  /**
   * Fesih ihbarı süren paktların bitiş anını geçmişe alır.
   *
   * İhbar süresi 24 saat: testin gerçekten beklemesi mümkün değil. Zamanı
   * ileri almak yerine BİTİŞİ geriye alıyoruz — böylece test paktın
   * gerçekten sona erdiğini, yani üretimde çalışan aynı `paktKoruyorMu`
   * kararını ölçüyor; ayrı bir "test modu" dalı açmıyoruz.
   */
  app.post('/test/paktlari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) return { bitirilen: 0 };
    const sonuc = await prisma.pakt.updateMany({
      where: {
        durum: 'feshediliyor',
        OR: [{ aId: lord.allianceId }, { bId: lord.allianceId }],
      },
      data: { biterAt: new Date(Date.now() - 1000), durum: 'bitti' },
    });
    return { bitirilen: sonuc.count };
  });

  /**
   * İttifaka doğrudan XP verir: seviye atlama ANINI test etmek için.
   *
   * Neden gerekli: bir seviye ~25.000 XP, bir bağış ~420. Testin 60 bağış
   * yapması hem yavaş hem imkânsız (günlük hak 5). XP'yi iteliyoruz ama
   * SEVİYE yine gerçek fonksiyondan türüyor — ayrı bir "test modu" dalı
   * açmıyoruz.
   */
  app.post('/test/ittifak-xp', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) return { verildi: 0 };
    const miktar = Number((req.body as { miktar?: number })?.miktar ?? 100000);
    const a = await prisma.alliance.update({
      where: { id: lord.allianceId },
      data: { xp: { increment: miktar } },
      select: { xp: true },
    });
    return { verildi: miktar, xp: a.xp };
  });

  /**
   * Bir generalin seviyesini/XP'sini kurar: seviye atlama ANINI test etmek için.
   *
   * Neden gerekli: bir general tek savaşta seviye atlamaya çoğu zaman yetmez
   * (bir PvP savaşı ~176 XP, Sv1→Sv2 için 200 gerekiyor). Testin savaşı
   * defalarca tekrarlaması hem yavaş hem kırılgan olurdu; bunun yerine
   * general eşiğin hemen altına kurulup TEK savaşla atlaması sağlanıyor —
   * ölçülen yol yine gerçek savaş yolu.
   */
  app.post('/test/general-xp', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const b = (req.body ?? {}) as { key?: string; level?: number; xp?: number };
    if (!b.key) throw new GameError('key gerekli.', 400, 'EKSIK_ALAN');
    const kayit = await prisma.lordGeneral.findUnique({
      where: { lordId_generalKey: { lordId, generalKey: b.key } },
    });
    if (!kayit) throw hata.bulunamadi('General');
    return prisma.lordGeneral.update({
      where: { id: kayit.id },
      data: { level: Math.max(1, b.level ?? kayit.level), xp: Math.max(0, b.xp ?? kayit.xp) },
      select: { generalKey: true, level: true, xp: true },
    });
  });

  /**
   * Çağıran lordun dünyasındaki TÜM bölgeleri başlangıç durumuna döndürür:
   * sahiplik bırakılır, garnizonlar silinir, NPC garnizonu tabana çekilir,
   * seviye ve kalkan sıfırlanır.
   *
   * Testler arası izolasyon için şart: sıfırlama olmadan her koşu haritadan
   * bir bölge daha kapatır ve bir süre sonra saldırılacak boş hedef kalmaz.
   */
  app.post('/test/bolgeleri-sifirla', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });

    const bolgeler = await prisma.region.findMany({ where: { worldId } });
    const taban = new Map(WORLD_MAP.regions.map((r) => [r.id, r]));

    for (const b of bolgeler) {
      const t = taban.get(b.mapId);
      if (!t) continue;
      // Bölgeye yerleştirilmiş garnizonları sil
      await prisma.armyUnit.deleteMany({
        where: { locationType: 'region', locationId: String(b.id) },
      });
      await prisma.region.update({
        where: { id: b.id },
        data: {
          ownerLordId: null,
          npcGarrison: t.npc_garrison as object,
          level: t.level,
          shieldUntil: null,
          storeAltin: 0,
          storeDemir: 0,
          storeErzak: 0,
        },
      });
    }
    return { sifirlanan: bolgeler.length };
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
