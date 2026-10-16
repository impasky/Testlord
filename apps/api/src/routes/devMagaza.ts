/**
 * Mağaza için geliştirme taklitleri (docs/25) — ÜRETİMDE YÜKLENMEZ.
 *
 * Gerçek kod yolu bunlara konuşuyor: `services/play.ts` imzalı JWT ile
 * jeton alıp Play API'sinin birebir yollarını çağırıyor; `admob.ts` imzalı
 * SSV çağrısını aynı doğrulamadan geçiriyor. Taklit yalnız Google'ın
 * yerini tutuyor, bizim kodumuzun hiçbir parçasını atlamıyor.
 *
 *   /test/play/token                      OAuth jetonu (JWT imzası doğrulanıyor)
 *   /test/play/androidpublisher/v3/…       products.get, :consume, voidedpurchases
 *   /test/play/satin-al                   Play'de satın alma yapılmış gibi jeton üret
 *   /test/play/iade                       satın almayı iade et
 *   /test/play/kesinti                    Google'a ulaşılamıyor gibi davran
 *   /test/play-tara                       worker'ın tüketme + iade taramasını koştur
 *   /test/reklam/izle                     Google'ın imzalı SSV çağrısını yap
 *   /test/reklam/bekleme-gecir            iki reklam arası beklemeyi geçmiş say
 */
import { REKLAM } from '@lordlar/shared';
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { gelistirmeSsvSorgusu, odulBirimi } from '../services/admob.js';
import { findLordByUser } from '../services/lord.js';
import { hesapEtiketi, playAyari } from '../services/play.js';
import { eskiReklamOturumlariniSil } from '../services/reklam.js';
import { iadeleriIsle, tuketilmeyenleriTuket } from '../services/satinAlma.js';

interface TaklitSatinAlma {
  urun: string;
  hesap?: string;
  /** 0 satın alındı, 1 iptal, 2 bekliyor */
  durum: number;
  tuketildi: boolean;
  test: boolean;
  iade: boolean;
  siparis: string;
}

const satinAlmalar = new Map<string, TaklitSatinAlma>();
/** yok | hepsi (Google'a ulaşılamıyor) | tuketme (yalnız :consume başarısız) */
let kesinti: 'yok' | 'hepsi' | 'tuketme' = 'yok';
const verilenJetonlar = new Set<string>();

function googleHatasi(reply: FastifyReply, kod: number, reason: string) {
  return reply.code(kod).send({ error: { code: kod, message: reason, errors: [{ reason }] } });
}

/** Play API çağrısının taklit jetonu taşıdığını denetler. */
function yetkili(req: FastifyRequest): boolean {
  const b = req.headers.authorization ?? '';
  return b.startsWith('Bearer ') && verilenJetonlar.has(b.slice(7));
}

export async function devMagazaRoutes(app: FastifyInstance): Promise<void> {
  const kok = '/test/play/androidpublisher/v3/applications/:paket/purchases';
  // Google'ın jeton ucu form gövdesi alıyor; Fastify onu kendiliğinden
  // çözmüyor. Ayrıştırıcı yalnız bu eklentinin kapsamında.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, govde, bitti) => bitti(null, Object.fromEntries(new URLSearchParams(String(govde)))),
  );

  app.post('/test/play/token', async (req, reply) => {
    if (kesinti === 'hepsi') return reply.code(503).send({ error: 'kesinti' });
    const { assertion } = z.object({ assertion: z.string() }).parse(req.body);
    const [b, g, i] = assertion.split('.');
    const ayar = playAyari();
    if (!b || !g || !i || !ayar) return reply.code(400).send({ error: 'invalid_grant' });
    // İmza gerçekten servis hesabının anahtarıyla mı — JWT kodunu sınıyor.
    const acik = createPublicKey(ayar.hesap.private_key);
    const dogru = verify('RSA-SHA256', Buffer.from(`${b}.${g}`), acik, Buffer.from(i, 'base64url'));
    const govde = JSON.parse(Buffer.from(g, 'base64url').toString()) as { scope?: string };
    if (!dogru || !govde.scope?.includes('androidpublisher')) {
      return reply.code(400).send({ error: 'invalid_grant' });
    }
    const jeton = `taklit-${randomBytes(12).toString('hex')}`;
    verilenJetonlar.add(jeton);
    return { access_token: jeton, expires_in: 3600, token_type: 'Bearer' };
  });

  app.get(`${kok}/products/:urun/tokens/:jeton`, async (req, reply) => {
    if (kesinti === 'hepsi') return googleHatasi(reply, 503, 'backendError');
    if (!yetkili(req)) return googleHatasi(reply, 401, 'authError');
    const { urun, jeton } = req.params as { urun: string; jeton: string };
    const s = satinAlmalar.get(jeton);
    if (!s) return googleHatasi(reply, 400, 'invalid');
    if (s.urun !== urun) return googleHatasi(reply, 400, 'purchaseTokenMismatch');
    return {
      kind: 'androidpublisher#productPurchase',
      purchaseState: s.iade ? 1 : s.durum,
      consumptionState: s.tuketildi ? 1 : 0,
      acknowledgementState: s.tuketildi ? 1 : 0,
      orderId: s.siparis,
      productId: s.urun,
      ...(s.test ? { purchaseType: 0 } : {}),
      ...(s.hesap ? { obfuscatedExternalAccountId: s.hesap } : {}),
    };
  });

  // Google'ın yolu `…/tokens/{jeton}:consume`; ":consume" parametrenin sonunda.
  app.post(`${kok}/products/:urun/tokens/:jetonVeIs`, async (req, reply) => {
    if (kesinti !== 'yok') return googleHatasi(reply, 503, 'backendError');
    if (!yetkili(req)) return googleHatasi(reply, 401, 'authError');
    const { jetonVeIs } = req.params as { jetonVeIs: string };
    if (!jetonVeIs.endsWith(':consume')) return googleHatasi(reply, 404, 'notFound');
    const s = satinAlmalar.get(jetonVeIs.slice(0, -':consume'.length));
    if (!s || s.durum !== 0) return googleHatasi(reply, 400, 'invalid');
    s.tuketildi = true;
    return reply.code(200).send('');
  });

  app.get(`${kok}/voidedpurchases`, async (req, reply) => {
    if (kesinti === 'hepsi') return googleHatasi(reply, 503, 'backendError');
    if (!yetkili(req)) return googleHatasi(reply, 401, 'authError');
    return {
      voidedPurchases: [...satinAlmalar.entries()]
        .filter(([, s]) => s.iade)
        .map(([purchaseToken, s]) => ({
          purchaseToken,
          orderId: s.siparis,
          voidedTimeMillis: String(Date.now()),
          voidedReason: 1,
          voidedSource: 0,
        })),
    };
  });

  /**
   * Play'de satın alınmış gibi bir jeton üretir. `hesapEtiketi` verilmezse
   * çağıranın etiketi (uygulama ne koyuyorsa); `durum` bekleyen ve iptal
   * edilmiş satın almaları da sınamak için.
   */
  app.post('/test/play/satin-al', { preHandler: requireAuth }, async (req) => {
    const g = z
      .object({
        urun: z.string(),
        hesapEtiketi: z.string().nullish(),
        durum: z.enum(['satin', 'bekliyor', 'iptal']).default('satin'),
        test: z.boolean().default(false),
      })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const jeton = `taklit.${randomBytes(24).toString('base64url')}`;
    satinAlmalar.set(jeton, {
      urun: g.urun,
      hesap: g.hesapEtiketi === null ? undefined : (g.hesapEtiketi ?? hesapEtiketi(lordId)),
      durum: { satin: 0, iptal: 1, bekliyor: 2 }[g.durum],
      tuketildi: false,
      test: g.test,
      iade: false,
      siparis: `GPA.${randomBytes(4).toString('hex')}-${Date.now()}`,
    });
    return { jeton };
  });

  app.post('/test/play/iade', async (req) => {
    const { jeton } = z.object({ jeton: z.string() }).parse(req.body);
    const s = satinAlmalar.get(jeton);
    if (s) s.iade = true;
    return { iade: Boolean(s) };
  });

  app.get('/test/play/durum', async (req) => {
    const { jeton } = z.object({ jeton: z.string() }).parse(req.query);
    const s = satinAlmalar.get(jeton);
    return { var: Boolean(s), tuketildi: s?.tuketildi ?? false };
  });

  app.post('/test/play/kesinti', async (req) => {
    kesinti = z.object({ kip: z.enum(['yok', 'hepsi', 'tuketme']) }).parse(req.body).kip;
    return { kesinti };
  });

  app.post('/test/play-tara', async () => ({
    tuketilen: await tuketilmeyenleriTuket(new Date(Date.now() + 120_000)),
    iade: await iadeleriIsle(),
  }));

  /**
   * Çağıranın reklam oturumu için Google'ın imzalı SSV çağrısını yapar —
   * gerçek uca, gerçek doğrulamadan. `kurcala`: imzalandıktan sonra ödül
   * miktarını değiştir (reddedilmeli). `islemNo`: aynı Google işlemini
   * tekrar göndermek için.
   */
  app.post('/test/reklam/izle', { preHandler: requireAuth }, async (req) => {
    const g = z
      .object({
        oturumId: z.string(),
        kurcala: z.boolean().default(false),
        islemNo: z.string().optional(),
        kullanici: z.string().optional(),
      })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const islemNo = g.islemNo ?? randomBytes(8).toString('hex');
    let q = gelistirmeSsvSorgusu({
      ad_network: '5450213213286189855',
      ad_unit: (odulBirimi() ?? 'x/0').split('/')[1]!,
      custom_data: g.oturumId,
      reward_amount: String(REKLAM.odulDakika),
      reward_item: 'dakika',
      timestamp: String(Date.now()),
      transaction_id: islemNo,
      user_id: g.kullanici ?? hesapEtiketi(lordId),
    });
    if (g.kurcala) q = q.replace(/reward_amount=\d+/, 'reward_amount=999');
    const r = await fetch(`http://127.0.0.1:${env.PORT}/api/reklam/ssv?${q}`);
    return { kod: r.status, govde: await r.json().catch(() => null), islemNo };
  });

  app.post('/test/reklam/bekleme-gecir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const son = await prisma.reklamOturumu.findFirst({
      where: { lordId },
      orderBy: { createdAt: 'desc' },
    });
    if (!son) return { kaydirildi: 0 };
    const kay = (REKLAM.beklemeSn + 1) * 1000;
    // Yalnız beklemeyi geçmiş say; gün değiştirmesin (tavan aynı günde).
    await prisma.reklamOturumu.update({
      where: { id: son.id },
      data: { createdAt: new Date(son.createdAt.getTime() - kay) },
    });
    return { kaydirildi: 1 };
  });

  /**
   * Saklama süresi: çağıranın en eski oturumunu süresinin bir gün ötesine
   * iter ve GERÇEK temizliği şimdiki zamanla koşar. Yeni oturumlar kalmalı.
   */
  app.post('/test/reklam/saklama', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const once = await prisma.reklamOturumu.count({ where: { lordId } });
    const eski = await prisma.reklamOturumu.findFirst({
      where: { lordId },
      orderBy: { createdAt: 'asc' },
    });
    if (eski) {
      await prisma.reklamOturumu.update({
        where: { id: eski.id },
        data: { createdAt: new Date(Date.now() - (REKLAM.saklamaGun + 1) * 86_400_000) },
      });
    }
    const silinen = await eskiReklamOturumlariniSil();
    const sonra = await prisma.reklamOturumu.count({ where: { lordId } });
    const eskiKaldi = eski
      ? Boolean(await prisma.reklamOturumu.findUnique({ where: { id: eski.id } }))
      : false;
    return { once, silinen, sonra, eskiKaldi };
  });
}
