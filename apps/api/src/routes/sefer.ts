/**
 * Haftalık sefer.
 *
 * Günlük görevler yarını tutuyor (`gunluk.ts`), sefer haftayı. Ayrı bir uç
 * çünkü ayrı bir kart: sefer kartı görünmüyorsa üç sayım sorgusu da
 * yapılmıyor.
 *
 * Hangi seferin açık olduğu SAKLANMIYOR, hafta numarasından türetiliyor
 * (packages/shared/sefer.ts). Böylece "şu an hangi etkinlik açık" diye bir
 * tablo ve onu döndüren bir zamanlayıcı hiç doğmuyor; sunucu yeniden
 * başlasa da iki sunucu birden çalışsa da hepsi aynı haftayı görüyor.
 *
 * İlerleme de türetiliyor: saldırı/fetih `Battle`, eğitim/imar/keşif
 * `Queue` kayıtlarında zaten duruyor.
 */
import {
  UNIT_TYPES,
  haftaBasi,
  seferDurumu,
  seferOdulu,
  seferOduluAlindiMi,
  storageCapacity,
  type SeferSayaclari,
  type UnitType,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';

const IMAR_TURLERI = ['craft', 'upgrade_item', 'upgrade_gear', 'upgrade_region'];

/** Bu haftaki ilerleme — hepsi var olan kayıtlardan. */
async function haftalikSayaclar(lordId: string, hafta: Date): Promise<SeferSayaclari> {
  const [saldiri, kazanilan, fetih, egitimler, imar, kesif] = await Promise.all([
    prisma.battle.count({ where: { attackerLordId: lordId, createdAt: { gte: hafta } } }),
    prisma.battle.count({
      where: { attackerLordId: lordId, result: 'attacker_win', createdAt: { gte: hafta } },
    }),
    prisma.battle.count({
      where: { attackerLordId: lordId, captured: true, createdAt: { gte: hafta } },
    }),
    // Asker SAYISI lazım, kuyruk satırı sayısı değil: "150 asker eğit"
    // hedefini üç satırla da doldurabilmeli.
    prisma.queue.findMany({
      where: { lordId, kind: 'train', startedAt: { gte: hafta } },
      select: { payload: true },
    }),
    prisma.queue.count({
      where: { lordId, kind: { in: IMAR_TURLERI }, startedAt: { gte: hafta } },
    }),
    prisma.queue.count({ where: { lordId, kind: 'kesif', startedAt: { gte: hafta } } }),
  ]);

  const egitilenAsker = egitimler.reduce((t, q) => {
    const p = q.payload as { unitType?: string; count?: number };
    const tip = p.unitType as UnitType | undefined;
    if (!tip || !UNIT_TYPES.includes(tip)) return t;
    return t + Math.max(0, p.count ?? 0);
  }, 0);

  return {
    saldiri,
    kazanilan_savas: kazanilan,
    fetih,
    egitilen_asker: egitilenAsker,
    imar,
    kesif,
  };
}

export async function seferRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sefer', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const hafta = haftaBasi(simdi);

    const [lord, sayaclar] = await Promise.all([
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { level: true, seferOduluHaftasi: true },
      }),
      haftalikSayaclar(lordId, hafta),
    ]);

    const sefer = seferDurumu(sayaclar, simdi);
    return {
      sefer,
      odul: {
        // Ödül baştan görünüyor: oyuncu haftalık işi neyin için yaptığını
        // bilmeli. Kilitli bir ödül sebeptir, sonradan çıkan bir ödül
        // sürprizdir ve sürpriz kimseyi haftaya geri getirmez.
        kaynak: seferOdulu(lord.level),
        hakEdildi: sefer.tamam,
        alindi: seferOduluAlindiMi(lord.seferOduluHaftasi, simdi),
      },
    };
  });

  /**
   * Seferin ödülünü alır.
   *
   * Günlük ödülle aynı korumalar: iki kez alınamaz (koşullu updateMany,
   * kontrol edip sonra yazmak çift tıklamaya kaynak dağıtırdı) ve depo
   * tavanı ödüle de işler ama sessizce kırpmaz.
   */
  app.post('/sefer/odul', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const hafta = haftaBasi(simdi);

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { level: true, seferOduluHaftasi: true },
    });
    if (seferOduluAlindiMi(lord.seferOduluHaftasi, simdi)) {
      throw new GameError('Bu haftanın seferini zaten aldın.', 400, 'ODUL_ALINDI');
    }

    const sefer = seferDurumu(await haftalikSayaclar(lordId, hafta), simdi);
    if (!sefer.tamam) {
      throw new GameError(
        `${sefer.ad} henüz bitmedi (${sefer.simdi}/${sefer.hedef} ${sefer.birim}).`,
        400,
        'SEFER_EKSIK',
      );
    }

    const odul = seferOdulu(lord.level);
    const once = await tickLord(lordId, simdi);
    const tavan = storageCapacity(lord.level);
    const sigan = (istenen: number, mevcut: number): number =>
      Math.max(0, Math.min(istenen, tavan - mevcut));
    const verilen = {
      altin: sigan(odul.altin, once.resources.altin),
      demir: sigan(odul.demir, once.resources.demir),
      erzak: sigan(odul.erzak, once.resources.erzak),
    };

    const yazildi = await prisma.lord.updateMany({
      where: {
        id: lordId,
        OR: [{ seferOduluHaftasi: null }, { seferOduluHaftasi: { lt: hafta } }],
      },
      data: {
        seferOduluHaftasi: simdi,
        altin: { increment: verilen.altin },
        demir: { increment: verilen.demir },
        erzak: { increment: verilen.erzak },
      },
    });
    if (yazildi.count === 0) {
      throw new GameError('Bu haftanın seferini zaten aldın.', 400, 'ODUL_ALINDI');
    }

    const sonra = await tickLord(lordId, simdi);
    return {
      sefer,
      odul,
      verilen,
      kirpildi:
        verilen.altin < odul.altin ||
        verilen.demir < odul.demir ||
        verilen.erzak < odul.erzak,
      kaynaklar: sonra.resources,
    };
  });
}
