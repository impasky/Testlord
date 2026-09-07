/**
 * Şehir (yerleşim) uçları.
 *
 * Kurallar — hangi bina hangi kademede görünür, tavanı ne, bedeli ne —
 * tamamen `packages/shared/bina.ts` içinde. Burada yalnız kaynak düşme,
 * kuyruğa yazma ve okuma var; kuralı ikinci kez yazmak ikisinin er ya da
 * geç ayrışması demek.
 */
import {
  B,
  BASKENT_TURLERI,
  BINALAR,
  KADEMELER,
  KADEME_ADI,
  KADEME_OZETI,
  binaDurumlari,
  binaMaliyeti,
  binaSuresiSn,
  kademeTavani,
  yerlesimKademesi,
  type RegionType,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { gecikmisleriKapat } from '../services/gecikmis.js';
import { assertQueueSlot, enqueue, spendResources } from '../services/queue.js';

const insaSchema = z.object({ key: z.string().min(1) });
const baskentSchema = z.object({ bolgeId: z.number().int() });

/** Kademe sıralaması: "daha büyüğüne taşın" karşılaştırması için. */
const KADEME_SIRASI = (k: string): number => KADEMELER.indexOf(k as never);

/**
 * Lordun yerleşim durumu: başkent bölgesi, kademesi, binaları.
 *
 * Başkent `null` olabilir ve bu geçerli bir durum: lord kamptadır
 * (docs/12 §2.3). Hata değil, oyunun bir hâli.
 */
async function yerlesimOku(lordId: string) {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: {
      worldId: true,
      baskentBolgeId: true,
      binalar: true,
      altin: true,
      demir: true,
      erzak: true,
    },
  });
  const baskent = lord.baskentBolgeId
    ? await prisma.region.findFirst({
        where: { worldId: lord.worldId, mapId: lord.baskentBolgeId },
        select: { id: true, mapId: true, name: true, type: true, level: true, ownerLordId: true },
      })
    : null;

  /*
   * Başkent BAŞKASININ olduysa lord kampa düşüyor.
   *
   * Damgayı silmeyi worker'a bırakmıyoruz: oyuncu ekranı açtığında
   * gerçeği görmeli. Fetihte alanın tarafında bir güncelleme var ama
   * kaybedenin kaydına dokunmak orada ikinci bir yazma demekti; burada
   * TÜRETİYORUZ ve tek kaynak bölgenin sahibi.
   */
  const benimMi = baskent?.ownerLordId === lordId;
  const kademe = yerlesimKademesi(
    benimMi ? (baskent!.type as RegionType) : null,
    baskent?.level ?? 1,
  );
  return {
    lord,
    baskent: benimMi ? baskent : null,
    kademe,
    binalar: (lord.binalar ?? {}) as Record<string, number>,
  };
}

export async function sehirRoutes(app: FastifyInstance) {
  app.get('/sehir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    // Biten inşaat kuyrukta bekliyor olabilir: worker uykudaysa oyuncu
    // ekranı açtığında hâlâ "inşa ediliyor" görürdü.
    await gecikmisleriKapat(lordId);
    await tickLord(lordId);
    const { lord, baskent, kademe, binalar } = await yerlesimOku(lordId);

    const kuyruk = await prisma.queue.findMany({
      where: { lordId, kind: 'bina', resolved: false },
      orderBy: { finishAt: 'asc' },
    });
    const insaattakiler = kuyruk.map((q) => String((q.payload as { key?: string }).key ?? ''));

    return {
      yerlesim: {
        kademe,
        ad: KADEME_ADI[kademe],
        ozet: KADEME_OZETI[kademe],
        baskent: baskent
          ? { id: baskent.id, ad: baskent.name, tur: baskent.type, seviye: baskent.level }
          : null,
        /** Bu kademede binaların çıkabileceği en yüksek seviye. */
        binaTavani: kademeTavani(kademe),
      },
      binalar: binaDurumlari(
        binalar,
        kademe,
        { altin: lord.altin, demir: lord.demir, erzak: lord.erzak },
        insaattakiler,
      ),
      /*
       * Taşınabileceğin yerleşimler.
       *
       * Yalnız DAHA İYİSİ listeleniyor: aynı kademeye ya da daha küçüğüne
       * taşınmak bir seçenek değil, bir hata olurdu. Liste boşsa oyuncu
       * zaten en iyi yerinde oturuyor demektir ve arayüz hiçbir şey
       * göstermiyor — "yapılacak bir şey yok" kartı olmasın (docs/09 K7).
       */
      tasinabilir: (
        await prisma.region.findMany({
          where: {
            ownerLordId: lordId,
            type: { in: [...BASKENT_TURLERI] },
            NOT: { mapId: lord.baskentBolgeId ?? -1 },
          },
          select: { mapId: true, name: true, type: true, level: true },
          orderBy: [{ level: 'desc' }, { mapId: 'asc' }],
        })
      )
        .map((r) => ({
          bolgeId: r.mapId,
          ad: r.name,
          tur: r.type,
          seviye: r.level,
          kademe: yerlesimKademesi(r.type as RegionType, r.level),
        }))
        .filter((r) => KADEME_SIRASI(r.kademe) > KADEME_SIRASI(kademe))
        .map((r) => ({ ...r, kademeAdi: KADEME_ADI[r.kademe], binaTavani: kademeTavani(r.kademe) })),
      esZamanli: B.kuyruklar.es_zamanli.bina,
      insaat: kuyruk.map((q) => {
        const key = String((q.payload as { key?: string }).key ?? '');
        return {
          id: q.id,
          key,
          ad: BINALAR.find((b) => b.key === key)?.ad ?? key,
          finishAt: q.finishAt,
        };
      }),
    };
  });

  /** Bir binayı dik ya da bir seviye yükselt. */
  app.post('/sehir/bina', { preHandler: requireAuth }, async (req) => {
    const { key } = insaSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    await gecikmisleriKapat(lordId);
    await tickLord(lordId);

    const tanim = BINALAR.find((b) => b.key === key);
    if (!tanim) throw new GameError('Böyle bir bina yok.', 400, 'BINA_YOK');
    if (!tanim.seviyeli) {
      throw new GameError(`${tanim.ad} inşa gerektirmiyor.`, 400, 'BINA_SEVIYESIZ');
    }

    return prisma.$transaction(async (tx) => {
      await assertQueueSlot(lordId, 'bina', tx);
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { worldId: true, baskentBolgeId: true, binalar: true },
      });
      const baskent = lord.baskentBolgeId
        ? await tx.region.findFirst({
            where: { worldId: lord.worldId, mapId: lord.baskentBolgeId },
            select: { type: true, level: true, ownerLordId: true },
          })
        : null;
      const kademe = yerlesimKademesi(
        baskent?.ownerLordId === lordId ? (baskent.type as RegionType) : null,
        baskent?.level ?? 1,
      );

      const binalar = (lord.binalar ?? {}) as Record<string, number>;
      const hedef = (binalar[key] ?? 0) + 1;
      const tavan = kademeTavani(kademe, key);
      if (hedef > tavan) {
        throw new GameError(
          `${tanim.ad} bu yerleşimde en fazla ${tavan}. seviye olabilir. Daha büyük bir başkent gerekiyor.`,
          400,
          'KADEME_TAVANI',
        );
      }

      await spendResources(lordId, binaMaliyeti(key, hedef), tx);
      const q = await enqueue(lordId, 'bina', { key }, binaSuresiSn(hedef), tx);
      return { queued: true, key, hedefSeviye: hedef, finishAt: q.finishAt };
    });
  });

  /**
   * Başkenti taşı.
   *
   * Oyuncunun tarifi: "bir şehir vs fethedince oraya geçsin." İlk fetih
   * başkenti KENDİLİĞİNDEN atıyor (services/march.ts) çünkü orada seçecek
   * bir şey yok; sonrakiler oyuncunun kararı — daha büyük bir yerleşim
   * daha yüksek bina tavanı demek ve bu bir kazanç, sürpriz değil.
   *
   * BİNALAR TAŞINIYOR. Lorda bağlılar, bölgeye değil (docs/12 §2.2):
   * fetih hep bir kazanç olmalı, taşınmak bir ceza değil. Değişen tek şey
   * yerleşim kademesi — yani bina TAVANI.
   */
  app.post('/sehir/baskent', { preHandler: requireAuth }, async (req) => {
    const { bolgeId } = baskentSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, baskentBolgeId: true },
    });
    const bolge = await prisma.region.findFirst({
      where: { worldId: lord.worldId, mapId: bolgeId },
      select: { mapId: true, name: true, type: true, level: true, ownerLordId: true },
    });
    if (!bolge || bolge.ownerLordId !== lordId) {
      throw new GameError('Burası senin değil.', 400, 'BOLGE_SENIN_DEGIL');
    }
    if (!BASKENT_TURLERI.includes(bolge.type)) {
      throw new GameError(
        'Burası bir yerleşim değil. Başkentin bir köy, şehir ya da kale olabilir.',
        400,
        'BASKENT_OLAMAZ',
      );
    }
    if (lord.baskentBolgeId === bolge.mapId) {
      throw new GameError('Zaten burada oturuyorsun.', 400, 'ZATEN_BASKENT');
    }

    await prisma.lord.update({ where: { id: lordId }, data: { baskentBolgeId: bolge.mapId } });
    const kademe = yerlesimKademesi(bolge.type as RegionType, bolge.level);
    return {
      tasindi: true,
      baskent: { ad: bolge.name, tur: bolge.type, seviye: bolge.level },
      kademe,
      kademeAdi: KADEME_ADI[kademe],
      binaTavani: kademeTavani(kademe),
    };
  });

  /** İnşaatı iptal et; harcamanın yarısı geri gelir. */
  app.delete('/sehir/bina/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const q = await tx.queue.findFirst({
        where: { id, lordId, kind: 'bina', resolved: false },
      });
      if (!q) throw new GameError('Böyle bir inşaat yok.', 404, 'INSAAT_YOK');

      const key = String((q.payload as { key?: string }).key ?? '');
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { binalar: true },
      });
      const binalar = (lord.binalar ?? {}) as Record<string, number>;
      const maliyet = binaMaliyeti(key, (binalar[key] ?? 0) + 1);
      const oran = B.binalar.iptal_iadesi;

      await tx.queue.delete({ where: { id } });
      await tx.lord.update({
        where: { id: lordId },
        data: {
          altin: { increment: Math.floor(maliyet.altin * oran) },
          demir: { increment: Math.floor(maliyet.demir * oran) },
          erzak: { increment: Math.floor(maliyet.erzak * oran) },
        },
      });
      return { iptal: true, iade: Math.floor(maliyet.altin * oran) };
    });
  });
}
