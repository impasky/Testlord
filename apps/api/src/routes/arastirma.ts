/**
 * Araştırma ağacı uçları.
 *
 * Ağacın kuralları (önkoşul, seviye şartı, maliyet, süre) tamamen
 * `packages/shared/arastirma.ts` içinde. Burada yalnız kaynak düşme,
 * kuyruğa yazma ve okuma var — kuralı ikinci kez yazmak, ikisinin er ya
 * da geç ayrışması demek.
 */
import {
  arastirmaDurumlari,
  arastirmaIlerlemesi,
  arastirmaMaliyeti,
  arastirmaSuresiSn,
  B,
  arastirmaDugumu,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, okuArastirmalar, tickLord } from '../services/lord.js';
import { gecikmisleriKapat } from '../services/gecikmis.js';
import { assertQueueSlot, enqueue, spendResources } from '../services/queue.js';

const baslatSchema = z.object({ key: z.string().min(1) });

export async function arastirmaRoutes(app: FastifyInstance) {
  app.get('/arastirma', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    // Biten araştırma kuyrukta bekliyor olabilir: worker uykudaysa
    // oyuncu ekranı açtığında hâlâ "sürüyor" görürdü.
    await gecikmisleriKapat(lordId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { level: true, arastirmalar: true },
    });
    const tamamlanan = okuArastirmalar(lord.arastirmalar);
    const suren = await prisma.queue.findFirst({
      where: { lordId, kind: 'research', resolved: false },
      orderBy: { finishAt: 'asc' },
    });
    const surenKey = suren ? String((suren.payload as { key?: string }).key ?? '') : null;
    return {
      dallar: arastirmaDurumlari(tamamlanan, lord.level),
      tamamlanan,
      ilerleme: arastirmaIlerlemesi(tamamlanan),
      esZamanli: B.kuyruklar.es_zamanli.research,
      suren: suren
        ? {
            id: suren.id,
            key: surenKey,
            ad: surenKey ? (arastirmaDugumu(surenKey)?.ad ?? surenKey) : '',
            finishAt: suren.finishAt,
          }
        : null,
    };
  });

  app.post('/arastirma', { preHandler: requireAuth }, async (req) => {
    const { key } = baslatSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    await gecikmisleriKapat(lordId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { level: true, arastirmalar: true },
      });
      const tamamlanan = okuArastirmalar(lord.arastirmalar);
      const durum = arastirmaDurumlari(tamamlanan, lord.level).find((d) => d.key === key);
      if (!durum) throw new GameError('Böyle bir araştırma yok.', 404, 'ARASTIRMA_YOK');
      if (durum.tamamlandi)
        throw new GameError('Bu araştırma zaten tamamlandı.', 400, 'ARASTIRMA_BITTI');
      // Engel METNİ motordan geliyor: "neden başlatamıyorum" sorusunun
      // cevabını iki yerde yazmıyoruz.
      if (!durum.acik)
        throw new GameError(durum.engel ?? 'Henüz açılmadı.', 400, 'ARASTIRMA_KAPALI');

      await assertQueueSlot(lordId, 'research', tx);
      await spendResources(lordId, arastirmaMaliyeti(durum.kademe), tx);
      const kayit = await enqueue(lordId, 'research', { key }, arastirmaSuresiSn(durum.kademe), tx);
      return { id: kayit.id, finishAt: kayit.finishAt, ad: durum.ad };
    });
  });

  /**
   * Süren araştırmayı iptal et.
   *
   * Harcamanın yarısı geri veriliyor (balance.json → iptal_iadesi).
   * Tamamı geri verilseydi kuyruk bedava park yeri olurdu: oyuncu
   * araştırmayı başlatıp kaynağı "saklar", canı istediğinde geri alırdı.
   */
  app.delete('/arastirma/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const satir = await tx.queue.findUnique({ where: { id } });
      if (!satir || satir.lordId !== lordId || satir.kind !== 'research' || satir.resolved)
        throw new GameError('Böyle bir araştırma yok.', 404, 'ARASTIRMA_YOK');

      const key = String((satir.payload as { key?: string }).key ?? '');
      const dugum = arastirmaDugumu(key);
      const maliyet = dugum ? arastirmaMaliyeti(dugum.kademe) : { altin: 0, demir: 0, erzak: 0 };
      const oran = B.arastirma.iptal_iadesi;

      await tx.queue.delete({ where: { id } });
      // Önce tick, sonra iade: iade edilen kaynak aynı anda işleyen
      // gelirle çakışıp kaybolmasın.
      await tickLord(lordId, new Date(), tx);
      await tx.lord.update({
        where: { id: lordId },
        data: {
          altin: { increment: Math.floor(maliyet.altin * oran) },
          demir: { increment: Math.floor(maliyet.demir * oran) },
          erzak: { increment: Math.floor(maliyet.erzak * oran) },
        },
      });
      return { iptal: true, iade: oran };
    });
  });
}
