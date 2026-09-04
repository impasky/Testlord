/**
 * İttifak: kur, katıl, ayrıl, üye çıkar.
 *
 * docs/09 §2.1'e göre türün en büyük kaldıracı ve bizim en büyük
 * eksiğimizdi: oyuncu 60 bölgelik bir diyarda tek başına oynuyordu.
 *
 * Kapsam kasten dar tutuldu — davet, rol, takviye, ortak hedef ve sohbet
 * yok. Onlar bu çekirdeğin üstüne gelir. Şu an tek zorunlu kural
 * "birbirine saldıramamak" ve o tek başına değerli: sırtını
 * dönebileceğin bir sınır.
 */
import {
  B,
  ayniIttifaktaMi,
  azamiPakt,
  fesihIhbarSaat,
  paktBitisi,
  paktKoruyorMu,
  paktTaraflari,
  paktTeklifDenetle,
  azamiUye,
  ittifakAdiDenetle,
  ittifakEtiketiDenetle,
  ittifakaGirebilirMi,
  kurmaMaliyeti,
  unvan,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { adiDenetle } from '../services/adDenetimi.js';
import { mesajDenetle } from '../services/mesajDenetimi.js';
import { findLordByUser, lordArmasi, pushEvent, tickLord } from '../services/lord.js';
import { yururlukteMi } from '../services/pakt.js';
import type { Prisma } from '@prisma/client';

const uyeSecimi = {
  id: true,
  name: true,
  level: true,
  fame: true,
  elo: true,
  armaKalkan: true,
  armaDesen: true,
  armaRenk1: true,
  armaRenk2: true,
  armaSembol: true,
} as const;

/** İttifak + üyeleri, arayüzün beklediği şekilde. */
async function ittifakOzeti(allianceId: string) {
  const a = await prisma.alliance.findUnique({
    where: { id: allianceId },
    include: {
      members: { select: uyeSecimi, orderBy: { fame: 'desc' } },
      target: { select: { id: true, name: true, type: true, level: true, ownerLordId: true } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    ad: a.name,
    etiket: a.tag,
    liderId: a.leaderLordId,
    kurulus: a.createdAt,
    // Lider HER ZAMAN başta. Yalnız şöhrete göre sıralamak, eşit şöhretli
    // iki üyede lideri ikinci sıraya düşürüyordu; listeye bakan kimin
    // lider olduğunu rozetten anlıyor ama sıra da bunu söylemeli.
    uyeler: a.members
      .map((u) => ({
        id: u.id,
        ad: u.name,
        seviye: u.level,
        sohret: u.fame,
        elo: u.elo,
        arma: lordArmasi(u),
        unvan: unvan(u.fame).ad,
        lider: u.id === a.leaderLordId,
      }))
      .sort((x, y) => (x.lider ? -1 : y.lider ? 1 : y.sohret - x.sohret)),
    toplamSohret: a.members.reduce((t, u) => t + u.fame, 0),
    azamiUye: azamiUye(),
    hedef: a.target
      ? {
          regionId: a.target.id,
          ad: a.target.name,
          tip: a.target.type,
          seviye: a.target.level,
          sahipsiz: a.target.ownerLordId === null,
          not: a.targetNote,
          an: a.targetSetAt,
        }
      : null,
  };
}

/**
 * Paktın iki tarafını okur ve isteyenin YETKİLİ olduğunu doğrular.
 *
 * Üç uç aynı üç şeyi yapıyordu: paktı bul, hangi taraf benim olduğunu
 * çöz, liderliği doğrula. Kopyalamak, bir gün birinde liderlik
 * kontrolünün unutulması demekti — o da her üyenin ittifakın paktını
 * feshedebilmesi.
 */
async function paktTaraflariniOku(tx: Prisma.TransactionClient, paktId: string, lordId: string) {
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { allianceId: true },
  });
  if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

  const pakt = await tx.pakt.findUnique({
    where: { id: paktId },
    include: {
      a: { select: { id: true, name: true, leaderLordId: true } },
      b: { select: { id: true, name: true, leaderLordId: true } },
    },
  });
  if (!pakt) throw hata.bulunamadi('Pakt');
  if (pakt.aId !== lord.allianceId && pakt.bId !== lord.allianceId) throw hata.yetkisiz();

  const benim = pakt.aId === lord.allianceId ? pakt.a : pakt.b;
  const oteki = pakt.aId === lord.allianceId ? pakt.b : pakt.a;
  if (benim.leaderLordId !== lordId) throw hata.yetkisiz();
  return { pakt, benim, oteki };
}

/** Kabul: iki tarafın liderine de haber gider. */
async function paktiKabulEt(
  tx: Prisma.TransactionClient,
  paktId: string,
  benimId: string,
  otekiId: string,
) {
  const pakt = await tx.pakt.update({
    where: { id: paktId },
    data: {
      durum: 'yururlukte',
      kabulAt: new Date(),
      fesihAt: null,
      biterAt: null,
      fesihEdenId: null,
    },
    include: {
      a: { select: { id: true, name: true, leaderLordId: true } },
      b: { select: { id: true, name: true, leaderLordId: true } },
    },
  });
  const benim = pakt.aId === benimId ? pakt.a : pakt.b;
  const oteki = pakt.aId === otekiId ? pakt.a : pakt.b;
  for (const [kime, kimle] of [
    [benim.leaderLordId, oteki.name],
    [oteki.leaderLordId, benim.name],
  ] as const) {
    await pushEvent(
      kime,
      'pakt_kuruldu',
      { mesaj: `${kimle} ile saldırmazlık paktı yürürlükte.`, paktId: pakt.id },
      tx,
    );
  }
  return { id: pakt.id, durum: pakt.durum, oteki: oteki.name };
}

export async function ittifakRoutes(app: FastifyInstance): Promise<void> {
  /** Kendi durumu + dünyadaki ittifaklar. */
  app.get('/ittifak', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, allianceId: true, allianceLeftAt: true, altin: true },
    });

    const [benimki, hepsi] = await Promise.all([
      lord.allianceId ? ittifakOzeti(lord.allianceId) : Promise.resolve(null),
      prisma.alliance.findMany({
        where: { worldId: lord.worldId },
        include: { members: { select: { fame: true } } },
      }),
    ]);

    // Sıralama toplam şöhrete göre: ittifakın gücünü tek sayıda anlatan
    // şey o ve zaten lord sıralamasının da ölçüsü — iki ayrı ölçü,
    // oyuncunun kafasında iki ayrı "güç" fikri yaratırdı.
    const liste = hepsi
      .map((a) => ({
        id: a.id,
        ad: a.name,
        etiket: a.tag,
        uyeSayisi: a.members.length,
        toplamSohret: a.members.reduce((t, u) => t + u.fame, 0),
        benimki: a.id === lord.allianceId,
      }))
      .sort((x, y) => y.toplamSohret - x.toplamSohret);

    const bekleme = ittifakaGirebilirMi(lord.allianceLeftAt, new Date());
    return {
      ittifakim: benimki,
      liste,
      altin: Math.floor(lord.altin),
      kurmaMaliyeti: kurmaMaliyeti(),
      azamiUye: azamiUye(),
      bekleme: bekleme.girebilir ? null : { kalanSn: bekleme.kalanSn },
    };
  });

  app.post('/ittifak/kur', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ ad: z.string(), etiket: z.string() }).parse(req.body);
    const ad = body.ad.trim();
    const etiket = body.etiket.trim().toUpperCase();
    const lordId = await findLordByUser(req.user.userId);

    for (const sonuc of [ittifakAdiDenetle(ad), ittifakEtiketiDenetle(etiket)]) {
      if (!sonuc.uygun) throw new GameError(sonuc.sebep!, 400, 'AD_UYGUNSUZ');
    }
    // Uygunsuz içerik denetimi lord adıyla AYNI süzgeçten geçiyor: iki
    // ayrı kelime listesi tutmak ikisinin birbirinden sapması demekti.
    const icerik = adiDenetle(ad);
    if (!icerik.uygun)
      throw new GameError(icerik.sebep ?? 'Bu ad kullanılamaz.', 400, 'AD_UYGUNSUZ');

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { worldId: true, allianceId: true },
      });
      if (lord.allianceId) {
        throw new GameError('Zaten bir ittifaktasın.', 400, 'ZATEN_ITTIFAKTA');
      }

      const state = await tickLord(lordId, new Date(), tx);
      const maliyet = kurmaMaliyeti();
      if (state.resources.altin < maliyet) {
        throw new GameError(
          `İttifak kurmak ${maliyet.toLocaleString('tr-TR')} altın tutuyor, ` +
            `${Math.floor(state.resources.altin).toLocaleString('tr-TR')} altının var.`,
          400,
          'YETERSIZ_KAYNAK',
        );
      }

      const cakisma = await tx.alliance.findFirst({
        where: {
          worldId: lord.worldId,
          OR: [{ name: ad }, { tag: etiket }],
        },
        select: { name: true, tag: true },
      });
      if (cakisma) {
        throw new GameError(
          cakisma.name === ad ? 'Bu ittifak adı alınmış.' : 'Bu etiket alınmış.',
          409,
          'AD_ALINMIS',
        );
      }

      await tx.lord.update({
        where: { id: lordId },
        data: { altin: { decrement: maliyet } },
      });
      const a = await tx.alliance.create({
        data: { worldId: lord.worldId, name: ad, tag: etiket, leaderLordId: lordId },
      });
      // Kurucunun kendisi de üye: lider ayrı bir alan ama üyelikten muaf
      // değil. Muaf olsa üye sayımı ve "aynı ittifakta mı" kontrolü
      // liderde yanlış çalışırdı.
      await tx.lord.update({ where: { id: lordId }, data: { allianceId: a.id } });
      return { id: a.id, ad: a.name, etiket: a.tag };
    });
  });

  app.post('/ittifak/:id/katil', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { worldId: true, allianceId: true, allianceLeftAt: true, name: true },
      });
      if (lord.allianceId) throw new GameError('Zaten bir ittifaktasın.', 400, 'ZATEN_ITTIFAKTA');

      const bekleme = ittifakaGirebilirMi(lord.allianceLeftAt, new Date());
      if (!bekleme.girebilir) {
        throw new GameError(
          `İttifaktan yeni ayrıldın. ${Math.ceil(bekleme.kalanSn / 3600)} saat sonra ` +
            'yeni bir ittifağa girebilirsin.',
          400,
          'ITTIFAK_BEKLEME',
        );
      }

      const a = await tx.alliance.findUnique({
        where: { id },
        include: { members: { select: { id: true } } },
      });
      if (!a || a.worldId !== lord.worldId) throw hata.bulunamadi('İttifak');
      if (a.members.length >= azamiUye()) {
        throw new GameError(`İttifak dolu (${azamiUye()} üye).`, 400, 'ITTIFAK_DOLU');
      }

      await tx.lord.update({ where: { id: lordId }, data: { allianceId: a.id } });
      // Lidere haber: kimin katıldığını bilmeli, yoksa ittifak bir liste
      // olur, bir topluluk olmaz.
      await pushEvent(
        a.leaderLordId,
        'ittifak_katilim',
        { mesaj: `${lord.name} ittifakına katıldı.` },
        tx,
      );
      return { katildi: a.id, ad: a.name };
    });
  });

  app.post('/ittifak/ayril', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { allianceId: true, name: true },
      });
      if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

      const a = await tx.alliance.findUniqueOrThrow({
        where: { id: lord.allianceId },
        include: { members: { select: { id: true, fame: true } } },
      });

      const simdi = new Date();
      await tx.lord.update({
        where: { id: lordId },
        data: { allianceId: null, allianceLeftAt: simdi },
      });

      if (a.leaderLordId === lordId) {
        // Lider ayrılırsa ittifak dağılmıyor, liderlik devrediliyor:
        // dağıtmak, liderin bir tıkla herkesin ittifağını silmesi
        // demekti. En yüksek şöhretli kalan üye devralıyor.
        const kalanlar = a.members.filter((m) => m.id !== lordId);
        if (kalanlar.length === 0) {
          await tx.alliance.delete({ where: { id: a.id } });
          return { ayrildi: true, dagildi: true };
        }
        const yeniLider = kalanlar.sort((x, y) => y.fame - x.fame)[0]!;
        await tx.alliance.update({
          where: { id: a.id },
          data: { leaderLordId: yeniLider.id },
        });
        await pushEvent(
          yeniLider.id,
          'ittifak_lider',
          { mesaj: `${a.name} ittifakının liderliği sana geçti.` },
          tx,
        );
        return { ayrildi: true, dagildi: false, yeniLiderId: yeniLider.id };
      }

      await pushEvent(
        a.leaderLordId,
        'ittifak_ayrilma',
        { mesaj: `${lord.name} ittifakından ayrıldı.` },
        tx,
      );
      return { ayrildi: true, dagildi: false };
    });
  });

  /**
   * İttifak sohbeti — son mesajlar.
   *
   * Sadece üyeler okuyabiliyor. Kapalı bir gruba (en fazla 8 kişi) yazmak,
   * herkese açık bir kanala yazmaktan bambaşka bir sorumluluk: zarar
   * yüzeyi küçük ve yazan kime yazdığını biliyor (docs/09 B3).
   */
  app.get('/ittifak/sohbet', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

    const k = B.ittifak.sohbet;
    const satirlar = await prisma.allianceMessage.findMany({
      where: { allianceId: lord.allianceId },
      orderBy: { createdAt: 'desc' },
      take: k.gosterilen_mesaj,
      include: { lord: { select: { id: true, name: true } } },
    });

    // Sunucu en yeniden eskiye çekiyor (indeks o yönde), arayüz eskiden
    // yeniye gösteriyor: sohbet aşağı doğru akar.
    return {
      mesajlar: satirlar.reverse().map((m) => ({
        id: m.id,
        lordId: m.lord.id,
        ad: m.lord.name,
        metin: m.text,
        an: m.createdAt,
      })),
      enFazlaHarf: k.mesaj_en_fazla_harf,
    };
  });

  app.post('/ittifak/sohbet', { preHandler: requireAuth }, async (req) => {
    const k = B.ittifak.sohbet;
    const body = z.object({ metin: z.string().min(1).max(k.mesaj_en_fazla_harf) }).parse(req.body);
    const metin = body.metin.trim();
    const lordId = await findLordByUser(req.user.userId);

    const denetim = mesajDenetle(metin);
    if (!denetim.uygun) {
      throw new GameError(denetim.sebep ?? 'Mesaj gönderilemez.', 400, 'MESAJ_UYGUNSUZ');
    }

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

    // Spam freni. Dakikada 20 mesaj bir sohbeti kullanılmaz hâle
    // getirmeye yeter; birkaç saniye normal konuşmayı hiç engellemiyor.
    const sonuncu = await prisma.allianceMessage.findFirst({
      where: { lordId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (sonuncu) {
      const gecen = (Date.now() - sonuncu.createdAt.getTime()) / 1000;
      if (gecen < k.iki_mesaj_arasi_sn) {
        throw new GameError(
          `Çok hızlı yazıyorsun. ${Math.ceil(k.iki_mesaj_arasi_sn - gecen)} saniye bekle.`,
          400,
          'COK_HIZLI',
        );
      }
    }

    const m = await prisma.allianceMessage.create({
      data: { allianceId: lord.allianceId, lordId, text: metin },
    });
    return { id: m.id, an: m.createdAt };
  });

  /**
   * Ortak hedef işaretler (lider).
   *
   * İttifak başına TEK hedef, bilerek: beş işaretli hedef koordinasyon
   * değil gürültüdür. Tek hedef bir karardır, karar da tartışılır — yani
   * sohbetin konusu olur. Sistemin işi kararı almak değil, alınan kararı
   * herkesin gördüğü bir yere yazmak.
   */
  app.post('/ittifak/hedef', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({ regionId: z.number().int().nullable(), not: z.string().max(120).optional() })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { allianceId: true, worldId: true, name: true },
      });
      if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

      const a = await tx.alliance.findUniqueOrThrow({
        where: { id: lord.allianceId },
        include: { members: { select: { id: true } } },
      });
      if (a.leaderLordId !== lordId) throw hata.yetkisiz();

      if (body.regionId === null) {
        await tx.alliance.update({
          where: { id: a.id },
          data: { targetRegionId: null, targetSetAt: null, targetNote: null },
        });
        return { hedef: null };
      }

      const bolge = await tx.region.findUnique({ where: { id: body.regionId } });
      if (!bolge || bolge.worldId !== lord.worldId) throw hata.bulunamadi('Bölge');
      // Kendi üyesinin bölgesini hedef göstermek anlamsız: zaten
      // saldırılamıyor.
      if (bolge.ownerLordId) {
        const sahip = await tx.lord.findUnique({
          where: { id: bolge.ownerLordId },
          select: { allianceId: true },
        });
        if (ayniIttifaktaMi(lord.allianceId, sahip?.allianceId ?? null)) {
          throw new GameError('Kendi üyenizin bölgesi hedef olamaz.', 400, 'ITTIFAK_UYESI');
        }
      }

      await tx.alliance.update({
        where: { id: a.id },
        data: {
          targetRegionId: bolge.id,
          targetSetAt: new Date(),
          targetNote: body.not?.trim() || null,
        },
      });

      // Herkese haber: işaretlenmiş ama kimsenin görmediği hedef,
      // işaretlenmemiş hedefle aynı şeydir.
      for (const u of a.members) {
        if (u.id === lordId) continue;
        await pushEvent(
          u.id,
          'ittifak_hedef',
          {
            mesaj: `${lord.name} ittifakın hedefini ${bolge.name} olarak işaretledi.`,
            regionId: bolge.id,
          },
          tx,
        );
      }
      return { hedef: { regionId: bolge.id, ad: bolge.name } };
    });
  });

  /** Lider bir üyeyi çıkarır. */
  app.post('/ittifak/uye-cikar', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ lordId: z.string() }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { allianceId: true },
      });
      if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

      const a = await tx.alliance.findUniqueOrThrow({ where: { id: lord.allianceId } });
      if (a.leaderLordId !== lordId) throw hata.yetkisiz();
      if (body.lordId === lordId) {
        throw new GameError('Kendini çıkaramazsın; ayrılmak için "Ayrıl" kullan.', 400, 'KENDINI');
      }

      const hedef = await tx.lord.findUnique({
        where: { id: body.lordId },
        select: { allianceId: true, name: true },
      });
      if (!hedef || hedef.allianceId !== a.id) throw hata.bulunamadi('Üye');

      const simdi = new Date();
      await tx.lord.update({
        where: { id: body.lordId },
        data: { allianceId: null, allianceLeftAt: simdi },
      });
      await pushEvent(
        body.lordId,
        'ittifak_cikarildin',
        { mesaj: `${a.name} ittifakından çıkarıldın.` },
        tx,
      );
      return { cikarildi: body.lordId };
    });
  });

  /* ------------------------------------------------------------------ *
   *  Saldırmazlık paktı (docs/09 B1d)
   * ------------------------------------------------------------------ */

  /**
   * Paktlarım: yürürlüktekiler, gelen teklifler, gönderdiğim teklifler.
   *
   * Üçü ayrı listede dönüyor çünkü üçünde oyuncunun yapacağı iş farklı:
   * yürürlüktekini feshedebilir, geleni kabul/ret edebilir, gönderdiğini
   * geri çekebilir. Tek liste dönüp arayüze ayırtsaydık aynı ayrım orada
   * yeniden yazılırdı.
   */
  app.get('/ittifak/paktlar', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true, worldId: true },
    });
    if (!lord.allianceId) {
      return {
        ittifakim: null,
        yururlukte: [],
        gelen: [],
        giden: [],
        azami: azamiPakt(),
        ihbarSaat: fesihIhbarSaat(),
        liderMiyim: false,
      };
    }

    const [a, satirlar] = await Promise.all([
      prisma.alliance.findUniqueOrThrow({
        where: { id: lord.allianceId },
        select: { leaderLordId: true },
      }),
      prisma.pakt.findMany({
        where: { OR: [{ aId: lord.allianceId }, { bId: lord.allianceId }] },
        include: {
          a: { select: { id: true, name: true, tag: true } },
          b: { select: { id: true, name: true, tag: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const simdi = new Date();
    const bicim = (p: (typeof satirlar)[number]) => {
      const oteki = p.aId === lord.allianceId ? p.b : p.a;
      return {
        id: p.id,
        ittifakId: oteki.id,
        ad: oteki.name,
        etiket: oteki.tag,
        durum: p.durum,
        // Fesih sürerken kaç saniye kaldığı: paktın HÂLÂ koruduğu süre.
        kalanSn:
          p.biterAt && p.biterAt > simdi
            ? Math.floor((p.biterAt.getTime() - simdi.getTime()) / 1000)
            : null,
        benMiFeshettim: p.fesihEdenId === lord.allianceId,
      };
    };

    return {
      ittifakim: lord.allianceId,
      yururlukte: satirlar
        .filter((p) => paktKoruyorMu({ durum: p.durum as never, biterAt: p.biterAt }, simdi))
        .map(bicim),
      gelen: satirlar
        .filter((p) => p.durum === 'teklif' && p.teklifEdenId !== lord.allianceId)
        .map(bicim),
      giden: satirlar
        .filter((p) => p.durum === 'teklif' && p.teklifEdenId === lord.allianceId)
        .map(bicim),
      azami: azamiPakt(),
      ihbarSaat: fesihIhbarSaat(),
      liderMiyim: a.leaderLordId === lordId,
    };
  });

  /** Pakt teklif et. Yalnız lider. */
  app.post('/ittifak/pakt', { preHandler: requireAuth }, async (req) => {
    const { ittifakId } = z.object({ ittifakId: z.string().min(1) }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { allianceId: true, worldId: true },
      });
      if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');
      const benim = await tx.alliance.findUniqueOrThrow({
        where: { id: lord.allianceId },
        select: { id: true, name: true, leaderLordId: true },
      });
      if (benim.leaderLordId !== lordId) throw hata.yetkisiz();

      const hedef = await tx.alliance.findUnique({
        where: { id: ittifakId },
        select: { id: true, name: true, worldId: true, leaderLordId: true },
      });
      if (!hedef || hedef.worldId !== lord.worldId) throw hata.bulunamadi('İttifak');

      const [benimSayi, hedefSayi] = await Promise.all([
        yururlukteMi(benim.id, tx),
        yururlukteMi(hedef.id, tx),
      ]);
      const denetim = paktTeklifDenetle(benim.id, hedef.id, benimSayi, hedefSayi);
      if (!denetim.uygun) {
        throw new GameError(denetim.sebep!, 400, denetim.kod ?? 'PAKT_REDDEDILDI');
      }

      const [x, y] = paktTaraflari(benim.id, hedef.id);
      const mevcut = await tx.pakt.findUnique({ where: { aId_bId: { aId: x, bId: y } } });

      // Karşı taraf ZATEN teklif etmişse ikinci bir teklif açmıyoruz,
      // onunkini kabul ediyoruz. İki tarafın aynı anda teklif etmesi
      // "ikimiz de istiyoruz" demek; bunu çakışma sayıp reddetmek saçma
      // olurdu.
      if (mevcut?.durum === 'teklif' && mevcut.teklifEdenId !== benim.id) {
        return paktiKabulEt(tx, mevcut.id, benim.id, hedef.id);
      }
      if (mevcut && paktKoruyorMu({ durum: mevcut.durum as never, biterAt: mevcut.biterAt })) {
        throw new GameError('Bu ittifakla zaten paktın var.', 400, 'PAKT_VAR');
      }
      if (mevcut?.durum === 'teklif') {
        throw new GameError('Teklifin zaten gönderildi.', 400, 'TEKLIF_VAR');
      }

      // Biten bir pakt varsa aynı satırı yeniden kullanıyoruz: benzersizlik
      // kısıtı ikinci satıra izin vermiyor ve vermemeli.
      const veri = {
        worldId: lord.worldId,
        aId: x,
        bId: y,
        teklifEdenId: benim.id,
        durum: 'teklif',
        kabulAt: null,
        fesihAt: null,
        biterAt: null,
        fesihEdenId: null,
        createdAt: new Date(),
      };
      const pakt = mevcut
        ? await tx.pakt.update({ where: { id: mevcut.id }, data: veri })
        : await tx.pakt.create({ data: veri });

      await pushEvent(
        hedef.leaderLordId,
        'pakt_teklifi',
        { mesaj: `${benim.name} saldırmazlık paktı teklif etti.`, paktId: pakt.id },
        tx,
      );
      return { id: pakt.id, durum: pakt.durum, hedef: hedef.name };
    });
  });

  /** Gelen teklifi kabul et. Yalnız teklif EDİLEN tarafın lideri. */
  app.post('/ittifak/pakt/:id/kabul', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { pakt, benim, oteki } = await paktTaraflariniOku(tx, id, lordId);
      if (pakt.durum !== 'teklif') {
        throw new GameError('Bu teklif artık açık değil.', 400, 'TEKLIF_YOK');
      }
      // Kendi teklifini kabul etmek tek taraflı pakt demekti.
      if (pakt.teklifEdenId === benim.id) {
        throw new GameError('Kendi teklifini kabul edemezsin.', 400, 'KENDI_TEKLIFIN');
      }
      const [benimSayi, otekiSayi] = await Promise.all([
        yururlukteMi(benim.id, tx),
        yururlukteMi(oteki.id, tx),
      ]);
      const denetim = paktTeklifDenetle(benim.id, oteki.id, benimSayi, otekiSayi);
      if (!denetim.uygun) {
        throw new GameError(denetim.sebep!, 400, denetim.kod ?? 'PAKT_REDDEDILDI');
      }
      return paktiKabulEt(tx, pakt.id, benim.id, oteki.id);
    });
  });

  /**
   * Teklifi reddet (gelen) ya da geri çek (giden).
   *
   * Tek uç, çünkü ikisi de "bu teklif artık yok" demek ve iki ayrı uç
   * arayüzde iki ayrı düğme yolu açardı.
   */
  app.post('/ittifak/pakt/:id/reddet', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { pakt, benim, oteki } = await paktTaraflariniOku(tx, id, lordId);
      if (pakt.durum !== 'teklif') {
        throw new GameError('Bu teklif artık açık değil.', 400, 'TEKLIF_YOK');
      }
      await tx.pakt.update({ where: { id: pakt.id }, data: { durum: 'bitti' } });
      await pushEvent(
        oteki.leaderLordId,
        'pakt_reddedildi',
        { mesaj: `${benim.name} pakt teklifini kapattı.` },
        tx,
      );
      return { reddedildi: true };
    });
  });

  /**
   * Paktı feshet — ANINDA DEĞİL, ihbarlı.
   *
   * Mekaniğin bütün değeri bu satırda: fesih anında geçerli olsaydı pakt
   * bir kalkana dönerdi (zayıfken paktla, saldıracağın gün feshet, aynı
   * saat saldır). İhbar süresi boyunca pakt HÂLÂ koruyor ve karşı taraf
   * hazırlanmak için zaman kazanıyor.
   */
  app.post('/ittifak/pakt/:id/fesih', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { pakt, benim, oteki } = await paktTaraflariniOku(tx, id, lordId);
      if (pakt.durum !== 'yururlukte') {
        throw new GameError(
          pakt.durum === 'feshediliyor'
            ? 'Bu pakt zaten feshediliyor.'
            : 'Yürürlükte olmayan pakt feshedilemez.',
          400,
          'PAKT_YURURLUKTE_DEGIL',
        );
      }
      const simdi = new Date();
      const biter = paktBitisi(simdi);
      await tx.pakt.update({
        where: { id: pakt.id },
        data: { durum: 'feshediliyor', fesihAt: simdi, biterAt: biter, fesihEdenId: benim.id },
      });
      await pushEvent(
        oteki.leaderLordId,
        'pakt_feshi',
        {
          mesaj: `${benim.name} paktı feshetti. Pakt ${fesihIhbarSaat()} saat sonra sona eriyor.`,
          biterAt: biter.toISOString(),
        },
        tx,
      );
      return { feshediliyor: true, biterAt: biter, ihbarSaat: fesihIhbarSaat() };
    });
  });
}

export { ayniIttifaktaMi };
