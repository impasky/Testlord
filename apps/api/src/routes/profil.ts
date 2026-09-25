/**
 * Profil uçları: profil kartı, profil resmi seçme ve yükleme.
 *
 * Denetimin ayrıntısı services/resimDenetimi.ts'te; kararın eşikleri
 * shared `resimKarari`'nda. Burada akış var:
 *
 *   yükle → hazırla (kırp, üstveriyi sil, yeniden kodla) → sınıflandır →
 *     red:      baytlar SAKLANMIYOR, oyuncuya sebebi söyleniyor
 *     inceleme: saklanıyor, yalnız yükleyen ve yönetici görüyor
 *     onay:     saklanıyor ve hemen profile konuyor
 */
import {
  PROFIL_RESMI,
  hazirPortreVarMi,
  profilResmiCoz,
  profilResmiSutunu,
  resimKarari,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { dogrulamaKontrol } from '../services/epostaDogrulama.js';
import { findLordByUser } from '../services/lord.js';
import { profilKarti } from '../services/profil.js';
import { resmiHazirla, resmiSiniflandir, testTahmini } from '../services/resimDenetimi.js';

/** Kimlik yükleme başına benzersiz: aynı adreste başka bir resim hiç durmuyor. */
const ONBELLEK = 'public, max-age=31536000, immutable';

/** Base64 gövde: en büyük dosya × 4/3 + pay. */
const YUKLEME_GOVDE_SINIRI = Math.ceil(PROFIL_RESMI.enFazlaKb * 1024 * 1.4) + 4096;

export async function profilRoutes(app: FastifyInstance): Promise<void> {
  app.get('/lord/:lordId/profil', { preHandler: requireAuth }, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const benim = await findLordByUser(req.user.userId);
    return profilKarti(lordId, benim);
  });

  /**
   * Oyuncunun kendi resim durumu: seçili olan, yüklemeleri ve bugün kaç
   * yükleme hakkı kaldığı.
   *
   * İncelemedeki resmin önizlemesi YALNIZ burada, yalnız sahibine gidiyor
   * — herkese açık resim adresi onaylanmamış resmi vermiyor.
   */
  app.get('/profil/resim', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const [lord, yuklemeler, bugun] = await Promise.all([
      prisma.lord.findUniqueOrThrow({ where: { id: lordId }, select: { profilResmi: true } }),
      prisma.profilResmi.findMany({
        where: { lordId, durum: { in: ['onayli', 'inceleme'] }, veri: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, durum: true, createdAt: true, veri: true },
      }),
      gunlukYuklemeSayisi(lordId),
    ]);
    return {
      secili: profilResmiCoz(lord.profilResmi),
      yuklemeler: yuklemeler.map((y) => ({
        id: y.id,
        durum: y.durum as 'onayli' | 'inceleme',
        an: y.createdAt,
        adres: `data:image/webp;base64,${Buffer.from(y.veri!).toString('base64')}`,
      })),
      kalanYukleme: Math.max(0, PROFIL_RESMI.gunlukYukleme - bugun),
    };
  });

  /**
   * Profil resmini seç: arma, hazır portre ya da daha önce yüklenip
   * ONAYLANMIŞ kendi resmi. İncelemedeki ya da başkasının resmi
   * seçilemiyor — denetimin arkasından dolanmanın yolu olmamalı.
   */
  app.put('/profil/resim', { preHandler: requireAuth }, async (req) => {
    const secim = z
      .discriminatedUnion('tur', [
        z.object({ tur: z.literal('arma') }),
        z.object({ tur: z.literal('hazir'), key: z.string().min(1).max(64) }),
        z.object({ tur: z.literal('yuklenen'), id: z.string().min(1).max(64) }),
      ])
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    if (secim.tur === 'hazir' && !hazirPortreVarMi(secim.key)) {
      throw new GameError('Böyle bir portre yok.', 400, 'GECERSIZ_ISTEK');
    }
    if (secim.tur === 'yuklenen') {
      const r = await prisma.profilResmi.findUnique({
        where: { id: secim.id },
        select: { lordId: true, durum: true },
      });
      if (!r || r.lordId !== lordId) throw hata.bulunamadi('Resim');
      if (r.durum !== 'onayli') {
        throw new GameError('Bu resim henüz onaylanmadı.', 400, 'RESIM_ONAYSIZ');
      }
    }
    await prisma.lord.update({
      where: { id: lordId },
      data: { profilResmi: profilResmiSutunu(secim) },
    });
    return { secili: secim };
  });

  app.post(
    '/profil/resim/yukle',
    { preHandler: requireAuth, bodyLimit: YUKLEME_GOVDE_SINIRI },
    async (req) => {
      const { veri: gelen } = z.object({ veri: z.string().min(16) }).parse(req.body);
      // Yüklenen resim herkese görünecek bir içerik: sohbetle aynı kapı.
      await dogrulamaKontrol(req.user.userId, 'profil_resmi');
      const lordId = await findLordByUser(req.user.userId);

      if ((await gunlukYuklemeSayisi(lordId)) >= PROFIL_RESMI.gunlukYukleme) {
        throw new GameError(
          `Bugünlük yükleme hakkın bitti (${PROFIL_RESMI.gunlukYukleme}). Yarın yeniden dene.`,
          400,
          'YUKLEME_SINIRI',
        );
      }

      const { veri, rgb } = await resmiHazirla(gelen);
      const tahmin = testTahmini(lordId) ?? (await resmiSiniflandir(rgb));
      const d = resimKarari(tahmin);

      const satir = await prisma.profilResmi.create({
        data: {
          lordId,
          // Reddedilen resmin baytları hiç yazılmıyor (bkz. şema).
          veri: d.karar === 'red' ? null : new Uint8Array(veri),
          durum: d.karar === 'red' ? 'red' : d.karar === 'onay' ? 'onayli' : 'inceleme',
          tahmin: tahmin ? { ...tahmin } : undefined,
        },
        select: { id: true },
      });
      if (d.karar === 'onay') {
        await prisma.lord.update({
          where: { id: lordId },
          data: { profilResmi: `yuklenen:${satir.id}` },
        });
      }
      return {
        id: d.karar === 'red' ? null : satir.id,
        durum: d.karar,
        metin: d.metin,
      };
    },
  );

  /**
   * Onaylı bir profil resmini sunar — HERKESE AÇIK, jetonsuz.
   *
   * `<img>` etiketi Authorization başlığı gönderemiyor; onaylı resim
   * zaten herkese görünecek bir içerik. Onaylı olmayan resim için uç YOK
   * gibi davranıyor (404): incelemedeki ya da kaldırılmış bir resmin
   * varlığı da bir bilgi.
   *
   * Önbellek uzun: kimlik yükleme başına benzersiz, aynı adreste başka
   * bir resim hiç durmuyor. Kaldırılan resmin adresini artık hiçbir
   * yanıt taşımıyor.
   */
  app.get(
    '/profil-resmi/:id',
    // Sohbette altmış mesajın her yazarı bir istek: oturum kotasını
    // resimler yemesin (resimler zaten önbellekte kalıyor).
    { config: { rateLimit: false } },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().min(1).max(64) }).parse(req.params);
      const r = await prisma.profilResmi.findUnique({
        where: { id },
        select: { veri: true, durum: true },
      });
      if (!r || r.durum !== 'onayli' || !r.veri) throw hata.bulunamadi('Resim');
      return reply
        .header('Content-Type', 'image/webp')
        .header('Cache-Control', ONBELLEK)
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(Buffer.from(r.veri));
    },
  );
}

/** Son 24 saatteki yükleme sayısı — reddedilenler de sayılıyor. */
function gunlukYuklemeSayisi(lordId: string): Promise<number> {
  return prisma.profilResmi.count({
    where: { lordId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
  });
}
