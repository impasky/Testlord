/**
 * İttifak içi kaynak gönderimi (docs/09 B6).
 *
 * Yalnız ittifak üyelerine: B6'nın kendi tanımındaki not buydu — "ittifak
 * olmadan sömürüye açık". İttifak artık var, o yüzden açılabiliyor.
 *
 * Kaynak yolda: anında gönderim kuşatma altındaki oyuncuyu sınırsız
 * beslerdi. Varış worker'da çözülüyor, tıpkı yürüyüşler gibi.
 */
import {
  ayniIttifaktaMi,
  gunlukTavan,
  hexDistance,
  sevkiyatDenetle,
  sevkiyatSuresiSn,
  yukAgirligi,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { bugunGonderilen, sevkiyatOzeti } from '../services/ticaret.js';
import { lordunAyricaligi } from '../services/ittifakSeviye.js';

const yukSemasi = z.object({
  altin: z.coerce.number().int().min(0).default(0),
  demir: z.coerce.number().int().min(0).default(0),
  erzak: z.coerce.number().int().min(0).default(0),
});

export async function ticaretRoutes(app: FastifyInstance): Promise<void> {
  /** Yoldaki sevkiyatlar ve bugünkü tavan durumu. */
  app.get('/ticaret', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    return sevkiyatOzeti(lordId);
  });

  app.post('/ticaret/gonder', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ lordId: z.string().min(1), yuk: yukSemasi }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    if (body.lordId === lordId) {
      throw new GameError('Kendine kaynak gönderemezsin.', 400, 'KENDINE');
    }

    return prisma.$transaction(async (tx) => {
      const [ben, o] = await Promise.all([
        tx.lord.findUniqueOrThrow({
          where: { id: lordId },
          select: { worldId: true, homeQ: true, homeR: true, allianceId: true },
        }),
        tx.lord.findUnique({
          where: { id: body.lordId },
          select: { worldId: true, homeQ: true, homeR: true, allianceId: true, name: true },
        }),
      ]);
      if (!o || o.worldId !== ben.worldId) throw hata.bulunamadi('Lord');
      if (!ayniIttifaktaMi(ben.allianceId, o.allianceId)) {
        throw new GameError(
          'Kaynak yalnız ittifak üyelerine gönderilebilir.',
          400,
          'ITTIFAK_DEGIL',
        );
      }

      const denetim = sevkiyatDenetle(
        body.yuk,
        await bugunGonderilen(lordId, tx),
        // Tavan ittifak seviyesinden: seviye atlamanın somut
        // karşılıklarından biri (docs/09 B1e).
        (await lordunAyricaligi(lordId, tx)).ticaretTavani,
      );
      if (!denetim.uygun) {
        throw new GameError(denetim.sebep ?? 'Gönderilemez.', 400, 'GONDERIM_REDDEDILDI');
      }

      // Kaynak ÖNCE düşüyor: gönderdiği anda kesesinden çıkmalı, yoksa
      // aynı kaynağı üç kişiye birden gönderebilirdi.
      const durum = await tickLord(lordId, new Date(), tx);
      const r = durum.resources;
      if (r.altin < body.yuk.altin || r.demir < body.yuk.demir || r.erzak < body.yuk.erzak) {
        throw hata.yetersizKaynak();
      }
      await tx.lord.update({
        where: { id: lordId },
        data: {
          altin: { decrement: body.yuk.altin },
          demir: { decrement: body.yuk.demir },
          erzak: { decrement: body.yuk.erzak },
        },
      });

      const mesafe = hexDistance({ q: ben.homeQ, r: ben.homeR }, { q: o.homeQ, r: o.homeR });
      const sn = sevkiyatSuresiSn(mesafe);
      const simdi = new Date();
      const sevk = await tx.shipment.create({
        data: {
          worldId: ben.worldId,
          fromLordId: lordId,
          toLordId: body.lordId,
          altin: body.yuk.altin,
          demir: body.yuk.demir,
          erzak: body.yuk.erzak,
          departAt: simdi,
          arriveAt: new Date(simdi.getTime() + sn * 1000),
        },
      });

      return {
        id: sevk.id,
        arriveAt: sevk.arriveAt,
        durationSec: sn,
        mesafe,
        agirlik: denetim.agirlik,
        kalanTavan: gunlukTavan() - (await bugunGonderilen(lordId, tx)),
        alici: o.name,
      };
    });
  });
}

export { yukAgirligi };
