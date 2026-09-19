/**
 * MEDENİYET UÇLARI (docs/16 §7, §9).
 *
 * İki iş: medeniyetin durumunu okumak ve çekirdeğine bağış yapmak.
 *
 * Bağışın tasarımdaki yeri büyük: oyuncunun kişisel kasasından ORTAK
 * bir şeye kaynak akıtmasının tek yolu bu ve karşılığında aldığı şey
 * güç değil, PAY — bonus herkese işliyor. Bedavacılığı bonusu
 * kısıtlayarak değil fayda puanıyla çözüyoruz (§9): bonus herkese,
 * puan yalnız katkı verene.
 */
import { CEKIRDEK_AZAMI_SEVIYE, bagisFaydaPuani, cekirdekMaliyeti } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { cekirdekDurumlari, medeniyetBilgileri } from '../services/medeniyet.js';
import { AKTIF_GUN } from '../services/world.js';

const bagisSchema = z.object({
  altin: z.number().int().min(0).default(0),
  demir: z.number().int().min(0).default(0),
  erzak: z.number().int().min(0).default(0),
});

export async function medeniyetRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Lordun medeniyeti: kimlik, nüfus, toprak, çekirdekler, fayda puanı.
   */
  app.get('/medeniyet', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, medeniyetId: true, faydaPuani: true },
    });
    if (!lord.medeniyetId) return { medeniyet: null };

    const bilgiler = await medeniyetBilgileri(lord.worldId);
    const bilgi = bilgiler.get(lord.medeniyetId);
    if (!bilgi) return { medeniyet: null };

    const [uye, bolge, cekirdekler, hepsi] = await Promise.all([
      prisma.lord.count({ where: { medeniyetId: lord.medeniyetId } }),
      prisma.region.count({ where: { ownerMedeniyetId: lord.medeniyetId } }),
      cekirdekDurumlari(lord.medeniyetId),
      // Dört medeniyetin toprak sayısı: oyuncu kendi tarafının nerede
      // durduğunu ancak ÖTEKİLERE bakarak bilebilir.
      prisma.region.groupBy({
        by: ['ownerMedeniyetId'],
        where: { worldId: lord.worldId, ownerMedeniyetId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return {
      medeniyet: {
        ...bilgi,
        uyeSayisi: uye,
        bolgeSayisi: bolge,
        faydaPuanim: lord.faydaPuani,
        cekirdekler,
        // Sıralama: en çok toprak tutan önde.
        siralama: hepsi
          .map((g) => ({
            ...(bilgiler.get(g.ownerMedeniyetId!) ?? { id: '?', ad: '?', renk: '#888' }),
            bolge: g._count._all,
          }))
          .sort((a, b) => b.bolge - a.bolge),
      },
    };
  });

  /**
   * Çekirdeğe bağış. Biriken maliyeti karşılayınca seviye atlıyor.
   *
   * ATLAMA BURADA, ayrı bir "yükselt" düğmesinde değil: ortak bir kasada
   * "son vuruşu kim yapacak" yarışı yaratmak, bağışı kumara çevirirdi.
   * Artan bağış da duruyor — hiçbir koşulda yanmıyor.
   */
  app.post('/medeniyet/cekirdek/:mapId/bagis', { preHandler: requireAuth }, async (req) => {
    const { mapId } = z.object({ mapId: z.coerce.number().int() }).parse(req.params);
    const bagis = bagisSchema.parse(req.body);
    const toplam = bagis.altin + bagis.demir + bagis.erzak;
    if (toplam <= 0) throw new GameError('Bağış için kaynak seç.', 400, 'BAGIS_BOS');

    const lordId = await findLordByUser(req.user.userId);
    // Gelir önce işlensin: oyuncunun ekranda gördüğü kaynakla sunucunun
    // saydığı aynı olsun.
    await tickLord(lordId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { medeniyetId: true, altin: true, demir: true, erzak: true },
      });
      if (!lord.medeniyetId) throw new GameError('Medeniyetin yok.', 400, 'MEDENIYET_YOK');
      if (lord.altin < bagis.altin || lord.demir < bagis.demir || lord.erzak < bagis.erzak) {
        throw new GameError('Kaynağın yetmiyor.', 400, 'KAYNAK_YETERSIZ');
      }

      const yatirim = await tx.cekirdekYatirim.findFirst({
        where: { medeniyetId: lord.medeniyetId, mapId },
      });
      if (!yatirim) throw hata.bulunamadi('Çekirdek');

      const oncekiSeviye = yatirim.seviye;
      if (yatirim.seviye >= CEKIRDEK_AZAMI_SEVIYE) {
        throw new GameError('Bu çekirdek azami seviyede.', 400, 'AZAMI_SEVIYE');
      }

      /*
       * Maliyet SAF KATMANDAN, her seviye için yeniden hesaplanıyor —
       * veritabanına dönmeden. Döngü içinde `cekirdekDurumlari`
       * çağırmak, her seviye için üç sorgu demekti ve hepsi aynı
       * cevabı veren bir işlemin içindeydi.
       */
      const aktifUye = await tx.lord.count({
        where: {
          medeniyetId: lord.medeniyetId,
          lastSeenAt: { gte: new Date(Date.now() - AKTIF_GUN * 86_400_000) },
        },
      });

      let altin = yatirim.birikenAltin + bagis.altin;
      let demir = yatirim.birikenDemir + bagis.demir;
      let erzak = yatirim.birikenErzak + bagis.erzak;
      let seviye = yatirim.seviye;

      /*
       * BİR BAĞIŞ BİRDEN ÇOK SEVİYE ATLATABİLİR.
       *
       * Tek atlamayla yetinen bir `if`, büyük bir bağışın artanını
       * biriktirip orada bırakırdı ve oyuncu "neden atlamadı" diye
       * sorardı. Maliyet her seviyede iki katına çıktığı için döngü
       * kendiliğinden kısa.
       */
      for (;;) {
        const maliyet = cekirdekMaliyeti(seviye, aktifUye);
        if (!maliyet) break;
        if (altin < maliyet.altin || demir < maliyet.demir || erzak < maliyet.erzak) break;
        altin -= maliyet.altin;
        demir -= maliyet.demir;
        erzak -= maliyet.erzak;
        seviye++;
      }

      await tx.cekirdekYatirim.update({
        where: { id: yatirim.id },
        data: { seviye, birikenAltin: altin, birikenDemir: demir, birikenErzak: erzak },
      });

      const puan = bagisFaydaPuani(toplam);
      await tx.lord.update({
        where: { id: lordId },
        data: {
          altin: { decrement: bagis.altin },
          demir: { decrement: bagis.demir },
          erzak: { decrement: bagis.erzak },
          faydaPuani: { increment: puan },
        },
      });

      return {
        seviye,
        atladi: seviye > oncekiSeviye,
        biriken: { altin, demir, erzak },
        faydaPuani: puan,
      };
    });
  });
}
