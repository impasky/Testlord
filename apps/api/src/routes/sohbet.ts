/**
 * Genel sohbet — bütün oyuncuların tek kanalı.
 *
 * Oyuncunun isteği: "Tüm oyuncuların sohbet edebileceği genel sohbet yap
 * ve buna her sayfadan erişilebilsin."
 *
 * docs/09 B3 sohbete ittifakla başlamayı söylüyordu, çünkü herkese açık
 * bir kanal moderasyon yükü getirir. O yük artık taşınabiliyor: süzgeç
 * (mesajDenetimi), şikâyet ve otomatik gizleme, susturma, engel ve bir
 * yönetici kuyruğu var. Genel sohbet bunların hepsini ittifak sohbetiyle
 * ORTAK kullanıyor — iki kanal iki ayrı kural dili konuşmuyor.
 *
 * Frenler daha sıkı çünkü zarar yüzeyi büyük: yazan kime yazdığını
 * bilmiyor. Mesaj daha kısa, iki mesaj arası daha uzun, aynı söz üst üste
 * yazılamıyor (balance.json → genel_sohbet).
 *
 * TEK KANAL, BÜTÜN DİYARLAR. "Tüm oyuncular" dendi; lord adları zaten
 * bütün diyarlarda benzersiz (auth.ts), yani aynı adı taşıyan iki kişi
 * karışmıyor. Profil kartı hangi diyarda olduğunu söylüyor.
 */
import { GENEL_SOHBET, GIZLI_MESAJ, SILINMIS_MESAJ, ayniSozMu } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { dogrulamaKontrol } from '../services/epostaDogrulama.js';
import { findLordByUser } from '../services/lord.js';
import { mesajDenetle } from '../services/mesajDenetimi.js';
import { susturmaKontrol } from '../services/moderasyon.js';
import { YAZAR_SEC, yazarGorunumu } from '../services/profil.js';

export async function sohbetRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sohbet/genel', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    // Engellediği lordların mesajları bu oyuncuya HİÇ gelmiyor — metni
    // gönderip arayüzde gizlemek, gizlemek olmazdı. Engel geriye dönük de
    // işliyor: eski mesajlar da kayboluyor.
    const engelliler = (
      await prisma.lordEngel.findMany({ where: { lordId }, select: { engellenenId: true } })
    ).map((e) => e.engellenenId);

    const satirlar = await prisma.genelMesaj.findMany({
      where: engelliler.length ? { lordId: { notIn: engelliler } } : {},
      orderBy: { createdAt: 'desc' },
      take: GENEL_SOHBET.gosterilenMesaj,
      include: { lord: { select: { ...YAZAR_SEC, alliance: { select: { tag: true } } } } },
    });

    return {
      mesajlar: satirlar.reverse().map((m) => ({
        id: m.id,
        ...yazarGorunumu(m.lord),
        ittifak: m.lord.alliance?.tag ?? null,
        // Kaldırılan ya da şikâyet eşiğini aşan mesajın METNİ SUNUCUDAN
        // HİÇ ÇIKMIYOR (ittifak sohbetiyle aynı kural).
        metin: m.silindiAn ? SILINMIS_MESAJ : m.gizli ? GIZLI_MESAJ : m.text,
        kaldirildi: m.silindiAn !== null || m.gizli,
        an: m.createdAt,
        benim: m.lordId === lordId,
      })),
      enFazlaHarf: GENEL_SOHBET.enFazlaHarf,
      ikiMesajArasiSn: GENEL_SOHBET.ikiMesajArasiSn,
    };
  });

  /**
   * En son mesajın anı — üst çubuktaki "yeni mesaj" noktası için.
   *
   * Sohbet kapalıyken bütün listeyi otuz saniyede bir çekmek gereksiz; tek
   * bir tarih yetiyor. Engellenenlerin mesajı bu noktayı da yakmıyor.
   */
  app.get('/sohbet/genel/son', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const engelliler = (
      await prisma.lordEngel.findMany({ where: { lordId }, select: { engellenenId: true } })
    ).map((e) => e.engellenenId);
    const son = await prisma.genelMesaj.findFirst({
      where: { lordId: { notIn: [...engelliler, lordId] }, silindiAn: null, gizli: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return { son: son?.createdAt ?? null };
  });

  app.post('/sohbet/genel', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({ metin: z.string().min(1).max(GENEL_SOHBET.enFazlaHarf) })
      .parse(req.body);
    const metin = body.metin.trim();
    if (!metin) throw new GameError('Boş mesaj gönderilemez.', 400, 'MESAJ_UYGUNSUZ');

    // Sıra ittifak sohbetiyle aynı: doğrulama → susturma → süzgeç → fren.
    await dogrulamaKontrol(req.user.userId, 'genel_sohbet');
    const lordId = await findLordByUser(req.user.userId);
    await susturmaKontrol(lordId);

    const denetim = mesajDenetle(metin);
    if (!denetim.uygun) {
      throw new GameError(denetim.sebep ?? 'Mesaj gönderilemez.', 400, 'MESAJ_UYGUNSUZ');
    }

    const sonuncu = await prisma.genelMesaj.findFirst({
      where: { lordId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, text: true },
    });
    if (sonuncu) {
      const gecen = (Date.now() - sonuncu.createdAt.getTime()) / 1000;
      if (gecen < GENEL_SOHBET.ikiMesajArasiSn) {
        throw new GameError(
          `Çok hızlı yazıyorsun. ${Math.ceil(GENEL_SOHBET.ikiMesajArasiSn - gecen)} saniye bekle.`,
          400,
          'COK_HIZLI',
        );
      }
      if (gecen < GENEL_SOHBET.ayniMesajTekrarSn && ayniSozMu(sonuncu.text, metin)) {
        throw new GameError(
          'Aynı mesajı üst üste gönderemezsin. Herkes ilkini gördü.',
          400,
          'AYNI_MESAJ',
        );
      }
    }

    const m = await prisma.genelMesaj.create({ data: { lordId, text: metin } });
    return { id: m.id, an: m.createdAt };
  });
}
