/**
 * Malikâne pazarı: kaynak takası.
 *
 * Kural motorda (`packages/shared/pazar.ts`); burada yalnız sayaç, kaynak
 * düşürme ve gün sıfırlaması var. Engel METİNLERİ de motordan geliyor:
 * arayüz düğmeyi kapatırken ve sunucu isteği reddederken aynı cümleyi
 * kullanıyor.
 */
import {
  B,
  KAYNAK_TURLERI,
  birimKuru,
  pazarGunlukTavan,
  takasEngeli,
  takasHesapla,
  type KaynakTuru,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { binalariOku, findLordByUser, tickLord } from '../services/lord.js';

const takasSchema = z.object({
  veren: z.enum(KAYNAK_TURLERI as unknown as [KaynakTuru, ...KaynakTuru[]]),
  alan: z.enum(KAYNAK_TURLERI as unknown as [KaynakTuru, ...KaynakTuru[]]),
  miktar: z.number().int().positive(),
});

/** Gün değiştiyse sayaç sıfır sayılır. Yazma yok: okuma anında karar. */
function bugunkuHacim(pazarHacmi: number, pazarGunu: Date | null, simdi: Date): number {
  if (!pazarGunu) return 0;
  const ayniGun = pazarGunu.toISOString().slice(0, 10) === simdi.toISOString().slice(0, 10);
  return ayniGun ? pazarHacmi : 0;
}

export async function pazarRoutes(app: FastifyInstance) {
  app.get('/pazar', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const durum = await tickLord(lordId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { level: true, binalar: true, pazarHacmi: true, pazarGunu: true },
    });
    const kullanilan = bugunkuHacim(lord.pazarHacmi, lord.pazarGunu, new Date());
    const tavan = pazarGunlukTavan(lord.level, binalariOku(lord));
    return {
      kaynaklar: durum.resources,
      komisyon: B.pazar.komisyon,
      enAzMiktar: B.pazar.en_az_miktar,
      kurlar: Object.fromEntries(KAYNAK_TURLERI.map((k) => [k, birimKuru(k)])),
      gunluk: { kullanilan, tavan, kalan: Math.max(0, tavan - kullanilan) },
    };
  });

  app.post('/pazar/takas', { preHandler: requireAuth }, async (req) => {
    const govde = takasSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      // Önce tick: takas edilecek kaynak birikmiş geliri de içersin.
      const durum = await tickLord(lordId, new Date(), tx);
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { level: true, binalar: true, pazarHacmi: true, pazarGunu: true },
      });
      const simdi = new Date();
      const kullanilan = bugunkuHacim(lord.pazarHacmi, lord.pazarGunu, simdi);

      const engel = takasEngeli({
        veren: govde.veren,
        alan: govde.alan,
        miktar: govde.miktar,
        eldeki: durum.resources,
        bugunkuHacim: kullanilan,
        gunlukTavan: pazarGunlukTavan(lord.level, binalariOku(lord)),
      });
      if (engel) throw new GameError(engel.mesaj, 400, engel.kod);

      const sonuc = takasHesapla(govde.veren, govde.alan, govde.miktar);
      await tx.lord.update({
        where: { id: lordId },
        data: {
          [govde.veren]: { decrement: sonuc.verilen },
          [govde.alan]: { increment: sonuc.alinan },
          pazarHacmi: Math.round(kullanilan + sonuc.hacim),
          pazarGunu: simdi,
        },
      });
      // Takas sonrası hâli tick'ten geçirip döndürüyoruz: depo tavanını
      // aşan bir takas sessizce buharlaşmasın, oyuncu sonucu görsün.
      const sonrasi = await tickLord(lordId, simdi, tx);
      return {
        verilen: sonuc.verilen,
        alinan: sonuc.alinan,
        kaynaklar: sonrasi.resources,
      };
    });
  });
}
