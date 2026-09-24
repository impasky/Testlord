/**
 * Moderasyon uçları.
 *
 * Neden var: otomatik süzgeç (adDenetimi/mesajDenetimi) bariz olanı
 * kesiyor, kalanı bir insanın görmesi gerekiyordu. `Report` tablosu
 * vardı ama OKUYAN yoktu — şikâyetler kara deliğe düşüyordu. Kuyruk
 * bu deliği kapatıyor.
 *
 * Yetki sınırı: kuyruk ve karar uçları yalnız `User.yonetici` olan
 * hesaplara açık, ve yetkisiz için uç HİÇ YOK gibi davranıyor (404,
 * 403 değil) — kuyruğun varlığı da bir bilgidir.
 */
import {
  GIZLI_MESAJ,
  KUYRUK_SAYFA_BOYU,
  SIKAYET_ARASI_SN,
  SIKAYET_SEBEPLERI,
  SIKAYET_SEBEP_ANAHTARLARI as SEBEP_ANAHTARLARI,
  SILINMIS_MESAJ,
  SUSTURMA_GECMIS_SAYISI,
  SUSTURMA_SURELERI,
  dogrulamaDurumu,
  otomatikGizlenir,
  kararMetni,
  karariDenetle,
  sikayetSatiri,
  sikayetiDenetle,
  susturmaBitisi,
  susturmaDurumu,
  susturmaSuresiMetni,
  type ModerasyonKarari,
  type SikayetTuru,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, pushEvent } from '../services/lord.js';
import { kararKaydet, requireYonetici } from '../services/moderasyon.js';

export async function moderasyonRoutes(app: FastifyInstance): Promise<void> {
  /*
   * ENGEL — kötüye kullanan oyuncuyu kendi ekranından silmek.
   *
   * Mağazaların kullanıcı içeriği için istediği üç şeyin üçüncüsü (App
   * Store 1.2, Google Play UGC): süzgeç ve şikâyet vardı, engel yoktu.
   * Şikâyet bir yöneticinin kararını bekliyor; engel oyuncunun elinde ve
   * anında. Tek yönlü ve sessiz: engellenen haberdar olmuyor.
   */
  app.get('/engel', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const satirlar = await prisma.lordEngel.findMany({
      where: { lordId },
      orderBy: { createdAt: 'desc' },
      include: { engellenen: { select: { id: true, name: true } } },
    });
    return {
      engelliler: satirlar.map((e) => ({
        lordId: e.engellenen.id,
        ad: e.engellenen.name,
        an: e.createdAt,
      })),
    };
  });

  app.post('/engel/:lordId', { preHandler: requireAuth }, async (req) => {
    const { lordId: hedefId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    if (hedefId === lordId) throw new GameError('Kendini engelleyemezsin.', 400, 'KENDINI_ENGEL');
    const hedef = await prisma.lord.findUnique({ where: { id: hedefId }, select: { name: true } });
    if (!hedef) throw hata.bulunamadi('Lord');
    // Aynı lordu iki kez engellemek hata değil: düğmeye iki kez basılabilir.
    await prisma.lordEngel.upsert({
      where: { lordId_engellenenId: { lordId, engellenenId: hedefId } },
      create: { lordId, engellenenId: hedefId },
      update: {},
    });
    return { engellendi: true, ad: hedef.name };
  });

  app.delete('/engel/:lordId', { preHandler: requireAuth }, async (req) => {
    const { lordId: hedefId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    await prisma.lordEngel.deleteMany({ where: { lordId, engellenenId: hedefId } });
    return { kaldirildi: true };
  });

  /**
   * Şikâyet formunun içeriği. Sebepleri arayüze gömmek yerine buradan
   * vermek, listeyi tek yerde tutuyor.
   */
  app.get('/moderasyon/sebepler', { preHandler: requireAuth }, async () => ({
    sebepler: SIKAYET_SEBEPLERI,
  }));

  /**
   * Oyuncunun kendi durumu: yönetici mi, susturulmuş mu.
   *
   * İki soru tek uçta çünkü ikisi de "ben kimim" sorusunun parçası ve
   * arayüz ikisini de açılışta soruyor.
   */
  app.get('/moderasyon/durum', { preHandler: requireAuth }, async (req) => {
    const [u, lordId] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { yonetici: true, epostaDogrulandi: true, createdAt: true },
      }),
      findLordByUser(req.user.userId),
    ]);
    const l = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { susturmaBitis: true, susturmaSebebi: true },
    });
    const s = susturmaDurumu(l.susturmaBitis, l.susturmaSebebi, new Date());

    // Bekleyen sayısı yalnız yöneticiye: sayı da bir bilgi.
    const bekleyen = u?.yonetici ? await prisma.report.count({ where: { durum: 'acik' } }) : 0;

    /*
     * Doğrulama hâli BU UÇTA, ayrı bir uçta değil.
     *
     * Hesap ekranı zaten bunu çağırıyor; doğrulama için ikinci bir istek
     * açmak aynı ekranda iki bekleme demekti.
     */
    const d = dogrulamaDurumu(u?.epostaDogrulandi, u?.createdAt ?? new Date(), new Date());

    return {
      yonetici: u?.yonetici === true,
      bekleyen,
      susturulmus: s.susturulmus,
      susturmaMetni: s.metin,
      epostaDogrulandi: d.dogrulandi,
      dogrulamaMetni: d.metin,
      dogrulamaKalanGun: d.kalanGun,
    };
  });

  /**
   * Bir sohbet mesajını şikâyet eder.
   *
   * Şikâyet edene ve edilene hiçbir şey OLMUYOR — tek yaptığı bir
   * yöneticinin bakmasını istemek. Tek istisna otomatik gizleme ve o da
   * ceza değil: yönetici "yok say" derse mesaj geri geliyor.
   */
  app.post('/rapor/mesaj/:mesajId', { preHandler: requireAuth }, async (req) => {
    const { mesajId } = z.object({ mesajId: z.string().min(1) }).parse(req.params);
    const { sebep, aciklama } = z
      .object({
        sebep: z.enum(SEBEP_ANAHTARLARI),
        aciklama: z.string().max(1000).default(''),
      })
      .parse(req.body);

    const denetim = sikayetiDenetle(sebep, aciklama);
    if (!denetim.uygun)
      throw new GameError(denetim.sebep ?? 'Şikâyet gönderilemedi.', 400, 'GECERSIZ_ISTEK');

    const benim = await findLordByUser(req.user.userId);
    const mesaj = await prisma.allianceMessage.findUnique({
      where: { id: mesajId },
      select: { id: true, lordId: true, allianceId: true },
    });
    if (!mesaj) throw hata.bulunamadi('Mesaj');

    // Görmediğin bir mesajı şikâyet edemezsin: şikâyet uçları başka
    // ittifakların sohbetini yoklamanın yolu olmamalı.
    const ben = await prisma.lord.findUniqueOrThrow({
      where: { id: benim },
      select: { allianceId: true },
    });
    if (ben.allianceId !== mesaj.allianceId) throw hata.bulunamadi('Mesaj');
    if (mesaj.lordId === benim) {
      throw new GameError('Kendi mesajını şikâyet edemezsin.', 400, 'GECERSIZ_ISTEK');
    }

    // Şikâyet de spam edilebilir. Fren, kuyruğu bir kişinin tek başına
    // doldurmasını engelliyor; gerçek bir şikâyeti hiç engellemiyor.
    const sonuncu = await prisma.report.findFirst({
      where: { reporterId: benim },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (sonuncu) {
      const gecen = (Date.now() - sonuncu.createdAt.getTime()) / 1000;
      if (gecen < SIKAYET_ARASI_SN) {
        throw new GameError(
          `Çok hızlı şikâyet ediyorsun. ${Math.ceil(SIKAYET_ARASI_SN - gecen)} saniye bekle.`,
          400,
          'COK_HIZLI',
        );
      }
    }

    await prisma.report.upsert({
      where: {
        reporterId_targetId_mesajId: { reporterId: benim, targetId: mesaj.lordId, mesajId },
      },
      create: {
        reporterId: benim,
        targetId: mesaj.lordId,
        mesajId,
        tur: 'mesaj',
        reason: sikayetSatiri(sebep, aciklama),
      },
      update: { reason: sikayetSatiri(sebep, aciklama), durum: 'acik', createdAt: new Date() },
    });

    // Eşiği FARKLI şikâyetçi sayısı belirliyor: aynı kişinin beş kez
    // basması bir mesajı gizlemeye yetmemeli.
    const farkli = await prisma.report.count({ where: { mesajId } });
    if (otomatikGizlenir(farkli)) {
      await prisma.allianceMessage.update({ where: { id: mesajId }, data: { gizli: true } });
    }

    return { alindi: true, gizlendi: otomatikGizlenir(farkli) };
  });

  /* ---------------------------------------------------------------- */
  /* Yönetici                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Şikâyet kuyruğu.
   *
   * Aynı hedefe gelen şikâyetler TEK SATIRDA toplanmıyor — bilerek.
   * Yönetici kaç kişinin rahatsız olduğunu görmeli, ve her şikâyetin
   * kendi sebebi var. Bunun yerine satır, hedefin geçmişini yanında
   * taşıyor: "bu kaçıncı" sorusu karar anında cevaplanabilsin.
   */
  app.get('/moderasyon/kuyruk', { preHandler: [requireAuth, requireYonetici] }, async (req) => {
    const { durum, sayfa } = z
      .object({
        durum: z.enum(['acik', 'kapali']).default('acik'),
        sayfa: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const [toplam, satirlar] = await Promise.all([
      prisma.report.count({ where: { durum } }),
      prisma.report.findMany({
        where: { durum },
        orderBy: { createdAt: 'desc' },
        skip: sayfa * KUYRUK_SAYFA_BOYU,
        take: KUYRUK_SAYFA_BOYU,
      }),
    ]);

    // Lordlar ve mesajlar tek seferde çekiliyor: satır başına sorgu
    // atmak otuz satırlık bir sayfada altmış sorgu demekti.
    const lordIdleri = [...new Set(satirlar.flatMap((r) => [r.reporterId, r.targetId]))];
    const mesajIdleri = satirlar.map((r) => r.mesajId).filter(Boolean);

    const [lordlar, mesajlar, gecmis] = await Promise.all([
      prisma.lord.findMany({
        where: { id: { in: lordIdleri } },
        select: { id: true, name: true, susturmaBitis: true, susturmaSebebi: true },
      }),
      mesajIdleri.length
        ? prisma.allianceMessage.findMany({
            where: { id: { in: mesajIdleri } },
            select: { id: true, text: true, createdAt: true, silindiAn: true, gizli: true },
          })
        : Promise.resolve([]),
      prisma.moderasyonKaydi.findMany({
        where: { lordId: { in: satirlar.map((r) => r.targetId) } },
        orderBy: { createdAt: 'desc' },
        take: SUSTURMA_GECMIS_SAYISI * KUYRUK_SAYFA_BOYU,
        select: { lordId: true, ozet: true, createdAt: true },
      }),
    ]);

    const lordHarita = new Map(lordlar.map((l) => [l.id, l]));
    const mesajHarita = new Map(mesajlar.map((m) => [m.id, m]));
    const simdi = new Date();

    return {
      toplam,
      sayfa,
      sayfaBoyu: KUYRUK_SAYFA_BOYU,
      sureler: SUSTURMA_SURELERI.map((s) => ({ saat: s, metin: susturmaSuresiMetni(s) })),
      satirlar: satirlar.map((r) => {
        const hedef = lordHarita.get(r.targetId);
        const mesaj = r.mesajId ? mesajHarita.get(r.mesajId) : undefined;
        const s = susturmaDurumu(hedef?.susturmaBitis, hedef?.susturmaSebebi, simdi);
        return {
          id: r.id,
          tur: r.tur as SikayetTuru,
          an: r.createdAt,
          sebep: r.reason,
          durum: r.durum,
          karar: r.karar,
          sikayetEden: lordHarita.get(r.reporterId)?.name ?? '(silinmiş)',
          hedefId: r.targetId,
          hedef: hedef?.name ?? '(silinmiş)',
          hedefSusturulmus: s.susturulmus,
          mesaj: mesaj
            ? {
                id: mesaj.id,
                metin: mesaj.text,
                an: mesaj.createdAt,
                silinmis: mesaj.silindiAn !== null,
                gizli: mesaj.gizli,
              }
            : null,
          // "Bu kaçıncı" — karar geçmişe bakmadan verilemez.
          gecmis: gecmis
            .filter((g) => g.lordId === r.targetId)
            .slice(0, SUSTURMA_GECMIS_SAYISI)
            .map((g) => ({ ozet: g.ozet, an: g.createdAt })),
        };
      }),
    };
  });

  /**
   * Karar verir ve şikâyeti kapatır.
   *
   * Üç karar var ve üçü de geri alınabilir bir iz bırakıyor: mesaj
   * siliniyor ama metni duruyor, susturma bitiş tarihiyle duruyor,
   * yok sayma da kayda geçiyor. Yöneticinin de denetlenebilir olması
   * gerekiyor.
   */
  app.post('/moderasyon/karar', { preHandler: [requireAuth, requireYonetici] }, async (req) => {
    const { raporId, karar, saat } = z
      .object({
        raporId: z.string().min(1),
        karar: z.enum(['yok_say', 'mesaj_sil', 'sustur']),
        saat: z.coerce.number().int().positive().nullable().default(null),
      })
      .parse(req.body);

    const rapor = await prisma.report.findUnique({ where: { id: raporId } });
    if (!rapor) throw hata.bulunamadi('Şikâyet');
    if (rapor.durum !== 'acik') {
      throw new GameError('Bu şikâyet zaten karara bağlanmış.', 400, 'GECERSIZ_ISTEK');
    }

    const tur = rapor.tur as SikayetTuru;
    const d = karariDenetle(karar, tur, saat);
    if (!d.uygun) throw new GameError(d.sebep ?? 'Karar uygulanamaz.', 400, 'GECERSIZ_ISTEK');

    const k = karar as ModerasyonKarari;
    const simdi = new Date();

    if (k === 'mesaj_sil') {
      // Yumuşak silme: metin kalıyor, görünürlük gidiyor. Silinen
      // metin, şikâyeti sonradan inceleyenin tek kanıtı.
      await prisma.allianceMessage.update({
        where: { id: rapor.mesajId },
        data: { silindiAn: simdi, silenId: req.user.userId, gizli: false },
      });
    }

    if (k === 'sustur') {
      await prisma.lord.update({
        where: { id: rapor.targetId },
        data: { susturmaBitis: susturmaBitisi(saat ?? 0, simdi), susturmaSebebi: rapor.reason },
      });
      // Susturulan oyuncu bunu sohbete yazmaya çalışınca değil, HEMEN
      // öğrenmeli: sebebini bilmeyen davranışını değiştiremez.
      await pushEvent(rapor.targetId, 'moderasyon', {
        mesaj: `İttifak sohbetinde ${susturmaSuresiMetni(saat ?? 0)} susturuldun. Sebep: ${rapor.reason}`,
      });
    }

    if (k === 'yok_say' && rapor.mesajId) {
      // Yok sayma gizlemeyi de kaldırıyor: eşiği aşan şikâyet haksızsa
      // mesaj geri gelmeli, yoksa gizleme sessiz bir cezaya dönüşür.
      await prisma.allianceMessage.updateMany({
        where: { id: rapor.mesajId, silindiAn: null },
        data: { gizli: false },
      });
    }

    await prisma.report.update({
      where: { id: raporId },
      data: {
        durum: 'kapali',
        karar: kararMetni(k, saat),
        bakanId: req.user.userId,
        bakildiAn: simdi,
      },
    });

    // Aynı mesaja gelen ÖTEKİ şikâyetler de kapanıyor: bir mesaj bir
    // kez incelenir, aynı iş otuz kez kuyruğa düşmez.
    if (rapor.mesajId) {
      await prisma.report.updateMany({
        where: { mesajId: rapor.mesajId, durum: 'acik' },
        data: {
          durum: 'kapali',
          karar: kararMetni(k, saat),
          bakanId: req.user.userId,
          bakildiAn: simdi,
        },
      });
    }

    await kararKaydet({
      lordId: rapor.targetId,
      yoneticiId: req.user.userId,
      raporId,
      karar: k,
      saat: k === 'sustur' ? saat : null,
    });

    return { tamam: true, karar: kararMetni(k, saat) };
  });

  /**
   * Bir lordun susturmasını erken kaldırır.
   *
   * Yanlış karar geri alınabilmeli. Alınamayan bir karar, yöneticiyi
   * karar vermekten korkutur.
   */
  app.post(
    '/moderasyon/susturma-kaldir',
    { preHandler: [requireAuth, requireYonetici] },
    async (req) => {
      const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.body);
      await prisma.lord.update({
        where: { id: lordId },
        data: { susturmaBitis: null, susturmaSebebi: null },
      });
      await kararKaydet({
        lordId,
        yoneticiId: req.user.userId,
        raporId: null,
        karar: 'yok_say',
        saat: null,
      });
      await pushEvent(lordId, 'moderasyon', {
        mesaj: 'Susturman kaldırıldı. İttifak sohbetine yeniden yazabilirsin.',
      });
      return { tamam: true };
    },
  );
}

export { GIZLI_MESAJ, SILINMIS_MESAJ };
