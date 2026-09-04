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
  azamiUye,
  ittifakAdiDenetle,
  ittifakEtiketiDenetle,
  ittifakaGirebilirMi,
  kurmaMaliyeti,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { adiDenetle } from '../services/adDenetimi.js';
import { mesajDenetle } from '../services/mesajDenetimi.js';
import { findLordByUser, pushEvent, tickLord } from '../services/lord.js';

const uyeSecimi = {
  id: true,
  name: true,
  level: true,
  fame: true,
  elo: true,
} as const;

/** İttifak + üyeleri, arayüzün beklediği şekilde. */
async function ittifakOzeti(allianceId: string) {
  const a = await prisma.alliance.findUnique({
    where: { id: allianceId },
    include: {
      members: { select: uyeSecimi, orderBy: { fame: 'desc' } },
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
        lider: u.id === a.leaderLordId,
      }))
      .sort((x, y) => (x.lider ? -1 : y.lider ? 1 : y.sohret - x.sohret)),
    toplamSohret: a.members.reduce((t, u) => t + u.fame, 0),
    azamiUye: azamiUye(),
  };
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
    if (!icerik.uygun) throw new GameError(icerik.sebep ?? 'Bu ad kullanılamaz.', 400, 'AD_UYGUNSUZ');

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
    const body = z
      .object({ metin: z.string().min(1).max(k.mesaj_en_fazla_harf) })
      .parse(req.body);
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
}

export { ayniIttifaktaMi };
