/**
 * Mağaza uçları (docs/25): durum, hızlandırma, Play satın alma, ödüllü reklam.
 *
 * Kural ve fiyat shared `magaza.ts`te; doğrulama `services/play.ts`,
 * `services/admob.ts`; elmasın verildiği tek yer `services/satinAlma.ts`.
 */
import {
  ELMAS_PAKETLERI,
  HIZLANDIRILABILIR,
  REKLAM,
  bankadanHarca,
  hizlandirmaBedeli,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { odulBirimi, ssvDogrula } from '../services/admob.js';
import { hizlandirilacakKuyruk, kuyruguKisalt } from '../services/hizlandirma.js';
import { lordIslemi } from '../services/kilit.js';
import { findLordByUser } from '../services/lord.js';
import { hesapEtiketi, playAyari } from '../services/play.js';
import { gecikmisIsleriCoz } from '../services/queue.js';
import { oturumAc, reklamGecmisi, ssvIsle } from '../services/reklam.js';
import { satinAlmayiDogrula } from '../services/satinAlma.js';

export async function magazaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/magaza', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const [lord, kuyruklar, gecmis, hak] = await Promise.all([
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { elmas: true, reklamDakikasi: true },
      }),
      prisma.queue.findMany({
        where: {
          lordId,
          resolved: false,
          finishAt: { gt: simdi },
          kind: { in: [...HIZLANDIRILABILIR] },
        },
        orderBy: { finishAt: 'asc' },
        select: { id: true, kind: true, payload: true, startedAt: true, finishAt: true },
      }),
      prisma.satinAlma.findMany({
        where: { lordId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { urun: true, elmas: true, durum: true, createdAt: true },
      }),
      reklamGecmisi(lordId, simdi),
    ]);
    const play = playAyari();
    const birim = odulBirimi();
    return {
      elmas: lord.elmas,
      reklamDakikasi: lord.reklamDakikasi,
      paketler: ELMAS_PAKETLERI,
      play: { acik: Boolean(play), paket: play?.paket ?? null, hesapEtiketi: hesapEtiketi(lordId) },
      reklam: {
        acik: Boolean(birim),
        birim,
        kisisellestirilmis: REKLAM.kisisellestirilmis,
        odulDakika: REKLAM.odulDakika,
        bankaTavanDakika: REKLAM.bankaTavanDakika,
        hak,
      },
      kuyruklar: kuyruklar.map((q) => {
        const kalanSaniye = Math.ceil((q.finishAt.getTime() - simdi.getTime()) / 1000);
        return { ...q, kalanSaniye, bedel: hizlandirmaBedeli(kalanSaniye) };
      }),
      gecmis,
    };
  });

  /**
   * Bir kuyruğu hızlandırır: elmasla TAMAMEN bitirir ya da biriken
   * reklam süresini kullanır. Bedel sunucuda; istemcinin fiyatına
   * bakılmıyor.
   */
  app.post('/kuyruk/:id/hizlandir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { yontem } = z.object({ yontem: z.enum(['elmas', 'banka']) }).parse(req.body);
    const simdi = new Date();
    const sonuc = await lordIslemi(lordId, async (tx) => {
      const k = await hizlandirilacakKuyruk(tx, lordId, id, simdi);
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { elmas: true, reklamDakikasi: true },
      });
      if (yontem === 'elmas') {
        const bedel = hizlandirmaBedeli(k.kalanSaniye);
        if (lord.elmas < bedel) {
          throw new GameError(
            `Bu işi hemen bitirmek ${bedel} elmas. Sende ${Math.max(0, lord.elmas)} var.`,
            400,
            'YETERSIZ_ELMAS',
          );
        }
        await tx.lord.update({ where: { id: lordId }, data: { elmas: { decrement: bedel } } });
        await kuyruguKisalt(tx, k, k.kalanSaniye, simdi);
        return { harcananElmas: bedel, kalanElmas: lord.elmas - bedel, kalanSaniye: 0 };
      }
      const h = bankadanHarca(k.kalanSaniye, lord.reklamDakikasi);
      if (h.harcananDakika === 0) {
        throw new GameError('Biriken reklam süren yok.', 400, 'BANKA_BOS');
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { reklamDakikasi: { decrement: h.harcananDakika } },
      });
      const kalan = await kuyruguKisalt(tx, k, h.kuyrukSaniye, simdi);
      return {
        harcananDakika: h.harcananDakika,
        kalanBanka: lord.reklamDakikasi - h.harcananDakika,
        kalanSaniye: kalan,
      };
    });
    // Biten iş beklenerek bitenle aynı yoldan çözülüyor.
    await gecikmisIsleriCoz(lordId);
    return sonuc;
  });

  /** Uygulamanın Play'den aldığı satın alma jetonu → doğrula, elmas ver. */
  app.post('/magaza/play/dogrula', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { urun, jeton } = z
      .object({ urun: z.string().min(1).max(100), jeton: z.string().min(10).max(4000) })
      .parse(req.body);
    return satinAlmayiDogrula(lordId, urun, jeton);
  });

  /** Reklamdan ÖNCE: tavan/bekleme denetimi, ödülün gideceği kuyruk. */
  app.post('/reklam/oturum', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    if (!odulBirimi()) throw new GameError('Reklam şu an kapalı.', 503, 'REKLAM_KAPALI');
    const { hedefKuyrukId } = z
      .object({ hedefKuyrukId: z.string().min(1).nullish() })
      .parse(req.body ?? {});
    return oturumAc(lordId, hedefKuyrukId ?? null);
  });

  /** Uygulama ödülün gelip gelmediğini buradan yokluyor. */
  app.get('/reklam/oturum/:id', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const o = await prisma.reklamOturumu.findFirst({
      where: { id, lordId },
      select: { durum: true, kuyrukSaniye: true, bankaDakika: true },
    });
    if (!o) throw new GameError('Böyle bir reklam oturumu yok.', 404, 'OTURUM_YOK');
    return o;
  });

  /*
   * Google'ın imzalı ödül çağrısı (SSV). KİMLİK İSTEMİYOR — kimlik imza.
   * Çağrılar az sayıda Google adresinden geliyor; genel IP sınırı (300/dk)
   * yoğun bir akşamda onları keserdi. Sınır yüksek, imzasız çağrı ucuz
   * bir doğrulamada düşüyor.
   */
  app.get(
    '/reklam/ssv',
    { config: { rateLimit: { max: 5000, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const ham = req.raw.url?.split('?')[1] ?? '';
      let alanlar;
      try {
        alanlar = await ssvDogrula(ham);
      } catch (e) {
        // Anahtar sunucusuna ulaşılamadı: 5xx, Google yeniden denesin.
        req.log.error({ err: e }, 'SSV anahtarları alınamadı');
        return reply.code(503).send({ ok: false });
      }
      if (!alanlar) return reply.code(400).send({ ok: false });
      const sonuc = await ssvIsle(alanlar);
      return { ok: true, sonuc };
    },
  );
}
