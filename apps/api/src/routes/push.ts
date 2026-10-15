/** Push bildirimi abonelikleri (docs/07 M14). */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BILDIRIM_TURLERI, saatDilimiGecerli, tercihiCoz } from '@lordlar/shared';
import type { Prisma } from '@prisma/client';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser } from '../services/lord.js';
import {
  abonelikBirak,
  aboneOl,
  acikAnahtar,
  bildirimGonder,
  cihazSayisi,
} from '../services/push.js';
import { pushAdresiGecerli } from '../services/pushPolitika.js';
import { env } from '../env.js';

/**
 * Tarayıcının `PushSubscription.toJSON()` çıktısı.
 *
 * Şekli standart ve tarayıcı üretiyor; yine de doğruluyoruz — eksik bir
 * anahtarla kaydedilen abonelik sessizce hiçbir şey almaz ve bunu aylar
 * sonra fark edersin.
 */
const abonelikSemasi = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  cihaz: z.string().max(200).optional(),
});

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  /**
   * İstemcinin abone olmak için ihtiyaç duyduğu her şey.
   *
   * `acik: false` dönüyorsa arayüz bildirim düğmesini HİÇ göstermiyor —
   * çalışmayacak bir düğme, bozuk bir düğmeden beterdir.
   */
  app.get('/push/anahtar', { preHandler: requireAuth }, async (req) => {
    const anahtar = acikAnahtar();
    const lordId = await findLordByUser(req.user.userId);
    return {
      acik: anahtar !== null,
      anahtar,
      cihazSayisi: anahtar === null ? 0 : await cihazSayisi(lordId),
    };
  });

  app.post('/push/abone', { preHandler: requireAuth }, async (req, reply) => {
    if (acikAnahtar() === null) {
      return reply.code(503).send({
        error: 'Bildirimler bu sunucuda açık değil.',
        code: 'PUSH_KAPALI',
      });
    }
    const b = abonelikSemasi.parse(req.body);
    // Sunucu bu adrese POST atacak: iç ağa değil, yalnız push servislerine
    // (pushPolitika.ts → pushAdresiGecerli).
    if (!pushAdresiGecerli(b.endpoint, env.NODE_ENV === 'production')) {
      return reply.code(400).send({
        error: 'Bu bildirim adresi desteklenmiyor.',
        code: 'PUSH_ADRES',
      });
    }
    const lordId = await findLordByUser(req.user.userId);
    await aboneOl(lordId, {
      endpoint: b.endpoint,
      p256dh: b.keys.p256dh,
      auth: b.keys.auth,
      cihaz: b.cihaz ?? null,
    });
    return { abone: true, cihazSayisi: await cihazSayisi(lordId) };
  });

  app.post('/push/cik', { preHandler: requireAuth }, async (req) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const silinen = await abonelikBirak(lordId, endpoint);
    return { cikildi: silinen > 0, cihazSayisi: await cihazSayisi(lordId) };
  });

  /**
   * Bildirim tercihleri (docs/12 §17): hangi konular kapalı, sessiz saatler.
   * Saat dilimi tarayıcıdan geliyor; sessiz saat oyuncunun kendi saatinde.
   */
  app.get('/push/tercih', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const l = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { bildirimTercihi: true },
    });
    return tercihiCoz(l.bildirimTercihi);
  });

  app.put('/push/tercih', { preHandler: requireAuth }, async (req) => {
    const govde = z
      .object({
        kapali: z.array(z.string().max(16)).max(BILDIRIM_TURLERI.length),
        sessiz: z
          .object({
            bas: z.number().int().min(0).max(23),
            son: z.number().int().min(0).max(23),
            dilim: z.string().min(1).max(64),
          })
          .nullable(),
      })
      .parse(req.body);
    if (govde.sessiz && !saatDilimiGecerli(govde.sessiz.dilim)) {
      throw new GameError('Saat dilimi tanınmadı.', 400, 'GECERSIZ_ISTEK');
    }
    // `tercihiCoz`dan geçiriliyor: bilinmeyen konu sessizce düşüyor.
    const tercih = tercihiCoz(govde);
    const lordId = await findLordByUser(req.user.userId);
    await prisma.lord.update({
      where: { id: lordId },
      data: { bildirimTercihi: tercih as unknown as Prisma.InputJsonValue },
    });
    return tercih;
  });

  /**
   * Deneme bildirimi.
   *
   * İzni veren oyuncunun gördüğü ilk şey bu olmalı: "açtım ama çalışıyor
   * mu" sorusunun cevabı ilk savaşı beklemek olmamalı. Ayrıca uçtan uca
   * testin push borusunu uçtan uca ölçmesini sağlıyor.
   */
  app.post('/push/deneme', { preHandler: requireAuth }, async (req, reply) => {
    if (acikAnahtar() === null) {
      return reply.code(503).send({ error: 'Bildirimler açık değil.', code: 'PUSH_KAPALI' });
    }
    const lordId = await findLordByUser(req.user.userId);
    const ulasan = await bildirimGonder(lordId, {
      baslik: 'Lordlar Çağı',
      govde: 'Bildirimler açık. Ordun döndüğünde haberin olacak.',
      yol: '/',
      etiket: 'deneme',
    });
    return { gonderildi: ulasan };
  });
}
