import { EKRANLAR, STAT_KEYS, armaDuzelt, type StatKey } from '@lordlar/shared';

// Sekme listesi packages/shared'da: istemcinin sekme tipi de oradan
// geliyor. Serbest metin kabul etmiyoruz (ölçüm alanı doğrulanmamış
// istemci verisiyle kirlenmesin) ama listeyi burada İKİNCİ KEZ tutmak,
// yeni bir ekran eklendiğinde /me'nin sessizce 400 dönmesi demekti.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, requireAuth, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { gecikmisIsleriCoz } from '../services/queue.js';
import { gecikmisYuruyusleriCoz } from '../services/march.js';

const parolaSchema = z.object({
  mevcut: z.string().min(1, 'Mevcut parolanı gir.'),
  yeni: z.string().min(8, 'Yeni parola en az 8 karakter olmalı.'),
});

const silmeSchema = z.object({
  parola: z.string().min(1, 'Silmek için parolanı gir.'),
  onay: z.literal('HESABIMI SIL', {
    errorMap: () => ({ message: 'Onay metnini birebir yazman gerekiyor.' }),
  }),
});

/** İstemcinin bildirdiği ekran adı; ölçüm dışında hiçbir işi yok. */
const ekranSchema = z.object({
  ekran: z.enum(EKRANLAR).optional(),
});

const statsSchema = z.object({
  guc: z.number().int().min(0).default(0),
  dayaniklilik: z.number().int().min(0).default(0),
  liderlik: z.number().int().min(0).default(0),
  kurnazlik: z.number().int().min(0).default(0),
});

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);

    /*
     * Gecikmiş işleri ÖNCE kapat, sonra durumu oku.
     *
     * Worker her 10 saniyede bir dönüyor ama tek servisli dağıtımda API
     * uykuya dalınca o da uyuyor. Bir oyuncu şu hâli yakaladı: "EĞİTİMDE
     * 26 — bitti" yazıyor, ama "Evde 0". Eğitim bitmiş, askerler orduya
     * katılmamıştı; omurga da haklı olarak "hâlâ asker eğit" diyordu ve
     * altın çoktan harcandığı için düğme kapalıydı. Oyuncu basacak düğme
     * bulamadığı bir ekranda kaldı.
     *
     * Sıra önemli: `tickLord` durumu hesaplıyor, dolayısıyla çözüm ondan
     * ÖNCE olmalı — yoksa oyuncu bir istek boyunca eski hâli görürdü.
     */
    await Promise.all([gecikmisIsleriCoz(lordId), gecikmisYuruyusleriCoz(lordId)]);

    const state = await tickLord(lordId);

    // Ekran adı /me'ye takılıyor: istemci zaten bu ucu düzenli çağırıyor,
    // ayrı bir ölçüm isteği açmak trafiği iki katına çıkarırdı. (docs/08 İ7)
    const { ekran } = ekranSchema.parse(req.query);

    const { lastSeenAt } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { lastSeenAt: true },
    });

    const [queues, events] = await Promise.all([
      prisma.queue.findMany({
        where: { lordId, resolved: false },
        orderBy: { finishAt: 'asc' },
      }),
      prisma.event.findMany({ where: { lordId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    /**
     * "Sen yokken ne oldu" özeti.
     *
     * Bekleme üzerine kurulu bir oyunda dönüş anı en önemli an: oyuncu
     * gelirin biriktiğini, kuyrukların bittiğini, bölgesinin saldırıya
     * uğradığını görmeli. Önceden olay akışını kendisi taramak zorundaydı.
     *
     * Eşik 10 dakika: sekme değiştiren ya da sayfayı yenileyen oyuncuya her
     * seferinde özet göstermek özeti değersizleştirirdi.
     */
    const ESIK_DK = 10;
    const yoklukMs = Date.now() - lastSeenAt.getTime();
    const yokluk =
      yoklukMs >= ESIK_DK * 60_000
        ? {
            baslangic: lastSeenAt.toISOString(),
            sureSaniye: Math.floor(yoklukMs / 1000),
            olaylar: events.filter((e) => e.createdAt > lastSeenAt).length,
            savaslar: await prisma.battle.count({
              where: {
                createdAt: { gt: lastSeenAt },
                OR: [{ attackerLordId: lordId }, { defenderLordId: lordId }],
              },
            }),
          }
        : null;

    // Damgayı okuduktan SONRA güncelliyoruz: aynı istekte güncelleseydik
    // özet her zaman boş çıkardı.
    await prisma.lord.update({
      where: { id: lordId },
      data: { lastSeenAt: new Date(), ...(ekran ? { lastScreen: ekran } : {}) },
    });

    return { lord: state, queues, events, yokluk, serverTime: new Date().toISOString() };
  });

  /**
   * Armayı değiştirir (docs/10 §2.1).
   *
   * Bedava ve istendiği kadar değiştirilebilir. Ortaçağda arma kalıcıydı
   * ama oyunda değiştirememek bir ceza olurdu; parayla satmak ise parası
   * olmayanı kimliksiz bırakırdı.
   *
   * Gelen değerler REDDEDİLMİYOR, düzeltiliyor: arma bir kimlik, hata
   * mesajı verilecek bir form değil.
   */
  app.post('/me/arma', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({
        kalkan: z.string(),
        desen: z.string(),
        renk1: z.string(),
        renk2: z.string(),
        sembol: z.string(),
      })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const arma = armaDuzelt(body);

    await prisma.lord.update({
      where: { id: lordId },
      data: {
        armaKalkan: arma.kalkan,
        armaDesen: arma.desen,
        armaRenk1: arma.renk1,
        armaRenk2: arma.renk2,
        armaSembol: arma.sembol,
      },
    });
    return { arma };
  });

  app.post('/me/stats', { preHandler: requireAuth }, async (req) => {
    const body = statsSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const spend = STAT_KEYS.reduce((s, k) => s + body[k], 0);
    if (spend <= 0) throw new GameError('Dağıtılacak puan belirtmedin.', 400, 'GECERSIZ_ISTEK');

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { statPoints: true },
      });
      if (spend > lord.statPoints) {
        throw new GameError(
          `Sadece ${lord.statPoints} stat puanın var, ${spend} dağıtmaya çalıştın.`,
          400,
          'YETERSIZ_PUAN',
        );
      }
      const data: Record<string, { increment: number }> = {};
      for (const k of STAT_KEYS as readonly StatKey[]) {
        if (body[k] > 0) data[k] = { increment: body[k] };
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { ...data, statPoints: { decrement: spend } },
      });
      return tickLord(lordId, new Date(), tx);
    });
  });

  /**
   * Öğreticiyi bitirdi (ya da geçti).
   *
   * `updateMany` + `ogreticiBittiAt: null` koşulu bilerek: oyuncu sayfalar
   * arasında ilerlerken ya da iki sekmede birden açıkken bu uç birkaç kez
   * çağrılabilir. Koşulsuz yazsaydık her çağrı damgayı ileri atardı ve
   * "öğreticiyi ne zaman bitirdi" sorusunun cevabı sürekli kayardı.
   */
  app.post('/me/ogretici-bitti', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const sonuc = await prisma.lord.updateMany({
      where: { id: lordId, ogreticiBittiAt: null },
      data: { ogreticiBittiAt: new Date() },
    });
    return { bitti: true, ilkKez: sonuc.count === 1 };
  });

  /**
   * Rehberi kapattı — kâhya kartı ve ekranı karartan rehber ışığı sussun.
   *
   * Öğreticininki gibi `updateMany` + `null` koşulu: kart ile ışık aynı
   * kararı paylaşıyor ve ikisi de bu ucu çağırabilir, damga kaymasın.
   */
  app.post('/me/rehber-bitti', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const sonuc = await prisma.lord.updateMany({
      where: { id: lordId, rehberBittiAt: null },
      data: { rehberBittiAt: new Date() },
    });
    return { bitti: true, ilkKez: sonuc.count === 1 };
  });

  /**
   * Öğreticiyi yeniden aç.
   *
   * Bir kere gösterilip bir daha açılamayan öğretici, unutulduğu anda
   * kaybolmuş demektir. Hesap ekranından tekrar okunabiliyor.
   */
  app.post('/me/ogretici-sifirla', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    // Rehber de sıfırlanıyor: "öğreticiyi tekrar aç" diyen oyuncu sekiz
    // sayfayı değil, ONBOARDING'İN TAMAMINI istiyor — asıl öğreten kısım
    // zaten kâhyanın elinden tutup yaptırdığı bölüm.
    await prisma.lord.update({
      where: { id: lordId },
      data: { ogreticiBittiAt: null, rehberBittiAt: null },
    });
    return { sifirlandi: true };
  });

  /** Giriş yapmışken parola değiştirme. Mevcut parola doğrulanır. */
  app.post('/me/parola', { preHandler: requireAuth }, async (req) => {
    const { mevcut, yeni } = parolaSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.userId } });

    if (!(await verifyPassword(user.passwordHash, mevcut))) {
      throw new GameError('Mevcut parola hatalı.', 400, 'PAROLA_HATALI');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(yeni) },
      }),
      // Açık sıfırlama jetonları da düşsün: parolayı bilerek değiştiren
      // biri, daha önce istediği sıfırlama bağlantısının hâlâ çalışmasını
      // istemez.
      prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { degistirildi: true };
  });

  /**
   * Hesabı ve ona bağlı her şeyi siler.
   *
   * Parola ve birebir yazılan bir onay metni isteniyor: geri alınamayan bir
   * işlem için tek dokunuş fazla kolay. Silme sırasında lordun bölgeleri
   * sahipsiz kalır — dünyadan bir bölgenin yok olması haritayı bozardı.
   */
  app.delete('/me', { preHandler: requireAuth }, async (req) => {
    const { parola } = silmeSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.userId } });

    if (!(await verifyPassword(user.passwordHash, parola))) {
      throw new GameError('Parola hatalı.', 400, 'PAROLA_HATALI');
    }

    await prisma.$transaction(async (tx) => {
      const lordlar = await tx.lord.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const idler = lordlar.map((l) => l.id);

      if (idler.length > 0) {
        // Bölgeler NPC'ye döner: garnizonu boş, kalkanı yok, yeniden
        // fethedilebilir.
        await tx.region.updateMany({
          where: { ownerLordId: { in: idler } },
          data: { ownerLordId: null, npcGarrison: {}, shieldUntil: null },
        });
        await tx.armyUnit.deleteMany({ where: { lordId: { in: idler } } });
      }

      // Lord ve altındakiler onDelete: Cascade ile gidiyor.
      await tx.user.delete({ where: { id: user.id } });
    });

    return { silindi: true };
  });
}
