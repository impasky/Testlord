/** Generaller: kadro, kiralama, slot atama. */
import {
  GENERALS,
  UZMANLIK_SEVIYESI,
  aggregateGeneralBonus,
  azamiGeneralSlotu,
  generalDef,
  generalLevelMultiplier,
  generalSlots,
  generalXpForLevel,
  uzmanlikAcikMi,
  uzmanlikDegistirmeBedeli,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { binalariOku, equippedGenerals, findLordByUser, tickLord } from '../services/lord.js';
import { lordIslemi } from '../services/kilit.js';

export async function generalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/generals', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const [lord, sahipOlunan] = await Promise.all([
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { liderlik: true, altin: true, binalar: true },
      }),
      prisma.lordGeneral.findMany({ where: { lordId } }),
    ]);
    const sahipMap = new Map(sahipOlunan.map((g) => [g.generalKey, g]));
    const now = new Date();

    return {
      slots: generalSlots(lord.liderlik, binalariOku(lord)),
      altin: lord.altin,
      kadro: GENERALS.map((g) => {
        const sahip = sahipMap.get(g.key);
        return {
          ...g,
          sahipMi: Boolean(sahip),
          level: sahip?.level ?? 0,
          xp: sahip?.xp ?? 0,
          xpForNext: sahip ? generalXpForLevel(sahip.level) : 0,
          slotIndex: sahip?.slotIndex ?? null,
          dinleniyor: sahip?.restUntil && sahip.restUntil > now ? sahip.restUntil : null,
          etkinDeger: sahip ? g.pasif.deger * generalLevelMultiplier(sahip.level) : g.pasif.deger,
          // Uzmanlık (docs/09 §2.3): seçilen yol, açık mı, değiştirmek ne tutar.
          uzmanlik: sahip?.uzmanlik ?? null,
          uzmanlikAcik: sahip ? uzmanlikAcikMi(sahip.level) : false,
          uzmanlikBedeli: uzmanlikDegistirmeBedeli(g.key),
        };
      }),
      toplamBonus: aggregateGeneralBonus(equippedGenerals(sahipOlunan, now)),
      uzmanlikSeviyesi: UZMANLIK_SEVIYESI,
    };
  });

  /**
   * Uzmanlık yolu seç ya da değiştir (docs/09 §2.3).
   *
   * İlk seçim bedava, değiştirmek generalin kiralama fiyatının yarısı:
   * karar ucuz olursa karar değildir, ama pahalı olursa oyuncu bir kere
   * yanlış seçtiği için generalini kaybetmiş sayılır. Seferdeki general
   * değişmiyor: savaşın sonucu yolda okunuyor ve yola çıkarken kurulan
   * önizleme ile varıştaki savaş ayrışırdı.
   */
  app.post('/generals/:key/uzmanlik', { preHandler: requireAuth }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const { uzmanlik } = z.object({ uzmanlik: z.string().min(1).max(40) }).parse(req.body);
    const def = generalDef(key);
    if (!def) throw hata.bulunamadi('General');
    const yol = def.uzmanliklar?.find((u) => u.key === uzmanlik);
    if (!yol) throw new GameError('Bu generalin böyle bir yolu yok.', 400, 'UZMANLIK_YOK');
    const lordId = await findLordByUser(req.user.userId);

    return lordIslemi(lordId, async (tx) => {
      const general = await tx.lordGeneral.findUnique({
        where: { lordId_generalKey: { lordId, generalKey: key } },
      });
      if (!general) throw new GameError('Bu general kadronda değil.', 400, 'KADRODA_YOK');
      if (!uzmanlikAcikMi(general.level)) {
        throw new GameError(
          `${def.ad} uzmanlığını ${UZMANLIK_SEVIYESI}. seviyede seçebilir.`,
          400,
          'SEVIYE_YETERSIZ',
        );
      }
      if (general.uzmanlik === uzmanlik) {
        throw new GameError('Bu yol zaten seçili.', 400, 'ZATEN_SECILI');
      }
      const [yuruyusler, akinlar] = await Promise.all([
        tx.march.findMany({ where: { lordId, resolved: false }, select: { generalIds: true } }),
        tx.akin.findMany({ where: { lordId, resolved: false }, select: { generalIds: true } }),
      ]);
      const seferde = [...yuruyusler, ...akinlar].some(
        (m) => Array.isArray(m.generalIds) && (m.generalIds as unknown[]).includes(key),
      );
      if (seferde) {
        throw new GameError(
          `${def.ad} seferde. Dönünce yolunu değiştirebilirsin.`,
          400,
          'GENERAL_SEFERDE',
        );
      }

      // İlk seçim bedava; değiştirmek bedelli.
      const bedel = general.uzmanlik ? uzmanlikDegistirmeBedeli(key) : 0;
      if (bedel > 0) {
        const state = await tickLord(lordId, new Date(), tx);
        if (state.resources.altin < bedel) {
          throw new GameError(
            `Yolu değiştirmek ${bedel.toLocaleString('tr-TR')} altın tutuyor, ${Math.floor(state.resources.altin).toLocaleString('tr-TR')} altının var.`,
            400,
            'YETERSIZ_KAYNAK',
          );
        }
        await tx.lord.update({ where: { id: lordId }, data: { altin: { decrement: bedel } } });
      }
      await tx.lordGeneral.update({ where: { id: general.id }, data: { uzmanlik } });
      return { uzmanlik, ad: yol.ad, bedel };
    });
  });

  app.post('/generals/:key/hire', { preHandler: requireAuth }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const def = generalDef(key);
    if (!def) throw hata.bulunamadi('General');
    const lordId = await findLordByUser(req.user.userId);

    return lordIslemi(lordId, async (tx) => {
      const zaten = await tx.lordGeneral.findUnique({
        where: { lordId_generalKey: { lordId, generalKey: key } },
      });
      if (zaten) throw new GameError('Bu general zaten kadronda.', 400, 'ZATEN_VAR');

      const state = await tickLord(lordId, new Date(), tx);
      if (state.resources.altin < def.maliyet_altin) {
        throw new GameError(
          `${def.ad} için ${def.maliyet_altin.toLocaleString('tr-TR')} altın gerekiyor, ${Math.floor(state.resources.altin).toLocaleString('tr-TR')} altının var.`,
          400,
          'YETERSIZ_KAYNAK',
        );
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { altin: { decrement: def.maliyet_altin } },
      });
      await tx.lordGeneral.create({
        data: { lordId, generalKey: key, level: 1, xp: 0, slotIndex: null },
      });
      return { hired: key, kalanAltin: Math.floor(state.resources.altin) - def.maliyet_altin };
    });
  });

  app.post('/generals/:key/assign', { preHandler: requireAuth }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const { slotIndex } = z
      .object({
        slotIndex: z
          .number()
          .int()
          .min(0)
          .max(azamiGeneralSlotu() - 1)
          .nullable(),
      })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return lordIslemi(lordId, async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { liderlik: true, binalar: true },
      });
      const general = await tx.lordGeneral.findUnique({
        where: { lordId_generalKey: { lordId, generalKey: key } },
      });
      if (!general) throw new GameError('Bu general kadronda değil.', 400, 'KADRODA_YOK');

      if (slotIndex === null) {
        await tx.lordGeneral.update({ where: { id: general.id }, data: { slotIndex: null } });
        return { slotIndex: null };
      }

      const slots = generalSlots(lord.liderlik, binalariOku(lord));
      if (slotIndex >= slots) {
        throw new GameError(
          `Sadece ${slots} general slotun var. Liderlik statını artır ya da Karargâh'ı yükselt.`,
          400,
          'SLOT_YOK',
        );
      }

      // O slotta başka general varsa çıkar
      await tx.lordGeneral.updateMany({
        where: { lordId, slotIndex },
        data: { slotIndex: null },
      });
      await tx.lordGeneral.update({ where: { id: general.id }, data: { slotIndex } });
      return { slotIndex };
    });
  });
}
