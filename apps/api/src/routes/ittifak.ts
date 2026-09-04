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
  azamiYasli,
  bagisMaliyeti,
  bagisOdulu,
  bagisXp,
  duyuruEnFazlaHarf,
  gunlukBagisHakki,
  ittifakAyricaliklari,
  ittifakSeviyesi,
  haftalikKatki,
  yonetebilirMi,
  type IttifakRutbe,
  azamiPakt,
  fesihIhbarSaat,
  paktBitisi,
  paktKoruyorMu,
  paktTaraflari,
  paktTeklifDenetle,
  azamiUye,
  asgariSeviyeDenetle,
  azamiAsgariSeviye,
  azamiBekleyenBasvuru,
  basvurabilirMi,
  basvuruMesajiDenetle,
  basvuruMesajiEnFazla,
  type KatilimTuru,
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
import { findLordByUser, grantXp, lordArmasi, pushEvent, tickLord } from '../services/lord.js';
import { spendResources } from '../services/queue.js';
import { yururlukteMi } from '../services/pakt.js';
import { ittifakAyricaligi } from '../services/ittifakSeviye.js';
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
  ittifakRutbe: true,
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

  /**
   * Haftalık katkı TÜRETİLİYOR: bağış, gönderilen sevkiyat ve gönderilen
   * takviye zaten kayıtlı. Yeni bir sayaç tutmuyoruz — tutsaydık bir gün
   * kayıtlarla sayacın birbirini tutmadığı bir hâl çıkardı.
   *
   * Üç sorgu, üye başına değil TOPLU: 8 üye için 24 sorgu açmak yerine
   * üçünü gruplayıp haritaya çeviriyoruz.
   */
  const haftaBasi = new Date(Date.now() - 7 * 24 * 3_600_000);
  const uyeIdler = a.members.map((u) => u.id);
  const [bagislar, sevkiyatlar, takviyeler] = await Promise.all([
    prisma.allianceDonation.groupBy({
      by: ['lordId'],
      where: { allianceId, createdAt: { gte: haftaBasi } },
      _count: { _all: true },
    }),
    prisma.shipment.groupBy({
      by: ['fromLordId'],
      where: { fromLordId: { in: uyeIdler }, departAt: { gte: haftaBasi } },
      _count: { _all: true },
    }),
    prisma.march.groupBy({
      by: ['lordId'],
      where: { lordId: { in: uyeIdler }, kind: 'takviye', departAt: { gte: haftaBasi } },
      _count: { _all: true },
    }),
  ]);
  const bagisSayisi = new Map(bagislar.map((r) => [r.lordId, r._count._all]));
  const sevkSayisi = new Map(sevkiyatlar.map((r) => [r.fromLordId, r._count._all]));
  const takviyeSayisi = new Map(takviyeler.map((r) => [r.lordId, r._count._all]));
  const katki = new Map(
    uyeIdler.map((id) => [
      id,
      haftalikKatki({
        bagis: bagisSayisi.get(id) ?? 0,
        sevkiyat: sevkSayisi.get(id) ?? 0,
        takviye: takviyeSayisi.get(id) ?? 0,
      }),
    ]),
  );

  // Bekleyen başvuru sayısı özete giriyor çünkü liderin ekranındaki tek
  // "yapılacak iş" sayacı bu: kimse başvurmadıysa sayı görünmüyor,
  // başvuran varsa rozet oluyor.
  const bekleyenBasvuru = await prisma.allianceBasvuru.count({
    where: { allianceId, durum: 'bekliyor' },
  });

  const durum = ittifakSeviyesi(a.xp);
  return {
    seviye: durum,
    katilim: a.katilim as KatilimTuru,
    asgariSeviye: a.asgariSeviye,
    bekleyenBasvuru,
    ayricaliklar: ittifakAyricaliklari(durum.seviye),
    duyuru: a.duyuru,
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
        rutbe: (u.id === a.leaderLordId
          ? 'lider'
          : u.ittifakRutbe === 'yasli'
            ? 'yasli'
            : 'uye') as IttifakRutbe,
        /** Bu hafta ittifaka ne kattı — "kim taşıyor, kim taşınıyor". */
        haftalikKatki: katki.get(u.id) ?? 0,
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

/** Günün başlangıcı (UTC). Bağış hakkı gün başında sıfırlanıyor. */
function gunBasi(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/**
 * "Bu ittifakta rütbem ne?"
 *
 * Üç uç aynı üç şeyi soruyordu: ittifakta mıyım, lider miyim, yaşlı
 * mıyım. Kopyalamak, bir gün birinde yetki kontrolünün unutulması
 * demekti — o da her üyenin duyuruyu değiştirebilmesi.
 */
async function rutbemi(tx: Prisma.TransactionClient, lordId: string) {
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { allianceId: true, ittifakRutbe: true },
  });
  if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');
  const a = await tx.alliance.findUniqueOrThrow({
    where: { id: lord.allianceId },
    select: { leaderLordId: true },
  });
  const lider = a.leaderLordId === lordId;
  const rutbe: IttifakRutbe = lider ? 'lider' : lord.ittifakRutbe === 'yasli' ? 'yasli' : 'uye';
  return { allianceId: lord.allianceId, rutbe, lider };
}

/**
 * Bir ittifağa giren lordun DİĞER bekleyen başvurularını düşürür.
 *
 * Bırakılsaydı başka bir liderin başvuru kuyruğunda, artık kabul
 * edilemeyecek bir satır dururdu: lider "kabul" der, işlem "zaten bir
 * ittifakta" diye düşerdi. Kuyruğu temiz tutmak liderin işi olmamalı.
 */
async function bekleyenleriDusur(tx: Prisma.TransactionClient, lordId: string): Promise<void> {
  await tx.allianceBasvuru.updateMany({
    where: { lordId, durum: 'bekliyor' },
    data: { durum: 'geri_cekildi', kararAt: new Date() },
  });
}

export async function ittifakRoutes(app: FastifyInstance): Promise<void> {
  /** Kendi durumu + dünyadaki ittifaklar. */
  app.get('/ittifak', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, allianceId: true, allianceLeftAt: true, altin: true },
    });

    const [benimki, hepsi, basvurularim] = await Promise.all([
      lord.allianceId ? ittifakOzeti(lord.allianceId) : Promise.resolve(null),
      prisma.alliance.findMany({
        where: { worldId: lord.worldId },
        include: { members: { select: { fame: true } } },
      }),
      // Kendi başvurularım listeyle birlikte dönüyor: arayüz her satırda
      // "Katıl" mı "Başvur" mu "Başvuruldu" mu yazacağına karar verirken
      // ikinci bir istek atmak zorunda kalmasın.
      prisma.allianceBasvuru.findMany({
        where: { lordId, durum: 'bekliyor' },
        select: { id: true, allianceId: true, createdAt: true },
      }),
    ]);
    const basvurdugum = new Map(basvurularim.map((b) => [b.allianceId, b]));

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
        // Seviye listede de görünüyor: katılacağı ya da pakt yapacağı
        // ittifağı seçen oyuncunun baktığı ilk şey, o ittifakın birlikte
        // ne kadar yol aldığı.
        seviye: ittifakSeviyesi(a.xp).seviye,
        benimki: a.id === lord.allianceId,
        // Kapı açık mı, kapalı mı ve kime açık: oyuncu listeye bakarken
        // görmeli, "Katıl"a basıp reddedilerek öğrenmemeli.
        katilim: a.katilim as KatilimTuru,
        asgariSeviye: a.asgariSeviye,
        basvurumId: basvurdugum.get(a.id)?.id ?? null,
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
      basvuru: {
        acik: basvurularim.length,
        azami: azamiBekleyenBasvuru(),
        mesajEnFazla: basvuruMesajiEnFazla(),
        azamiAsgariSeviye: azamiAsgariSeviye(),
      },
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
        select: {
          worldId: true,
          allianceId: true,
          allianceLeftAt: true,
          name: true,
          level: true,
        },
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
      // Kapı: bu uç eskiden herkese açıktı ve liderin söz hakkı yoktu.
      // Başvurulu ittifağa doğrudan girilmiyor.
      if (a.katilim === 'basvuru') {
        throw new GameError(
          'Bu ittifak başvuruyla üye alıyor. Başvurup liderin onayını beklemelisin.',
          400,
          'BASVURU_GEREKLI',
        );
      }
      if (a.members.length >= azamiUye()) {
        throw new GameError(`İttifak dolu (${azamiUye()} üye).`, 400, 'ITTIFAK_DOLU');
      }
      // Seviye eşiği AÇIK ittifakta da geçerli. Yalnız başvuruya bağlasaydık
      // lider "kapımı herkese açayım ama Lv10 altı gelmesin" diyemezdi ve
      // eşik, kapıyı kapatmanın yan etkisi olurdu.
      if (lord.level < a.asgariSeviye) {
        throw new GameError(
          `Bu ittifak en az Sv${a.asgariSeviye} istiyor. Sen Sv${lord.level}'sin.`,
          400,
          'SEVIYE_YETERSIZ',
        );
      }

      await tx.lord.update({ where: { id: lordId }, data: { allianceId: a.id } });
      await bekleyenleriDusur(tx, lordId);
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
   *  Başvuru (docs/09 §2.1 "Sırada")
   *
   *  Katılım liderin kararı olsun diye. Kapı iki katmanlı: seviye eşiği
   *  lider bakmadan süzüyor, başvuru kalanı insana taşıyor.
   * ------------------------------------------------------------------ */

  /**
   * Katılım ayarları: kapı açık mı, kime açık?
   *
   * Tek uçta ikisi birden çünkü ikisi tek bir karar: "kimi alıyorum".
   * Ayrı uçlar olsaydı arayüz iki isteği sıraya dizer, biri düşerse
   * ittifak yarı ayarlanmış kalırdı.
   */
  app.post('/ittifak/ayarlar', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({
        katilim: z.enum(['acik', 'basvuru']).optional(),
        asgariSeviye: z.number().int().optional(),
      })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { allianceId, lider } = await rutbemi(tx, lordId);
      if (!lider) throw hata.yetkisiz();

      if (body.asgariSeviye !== undefined) {
        const d = asgariSeviyeDenetle(body.asgariSeviye);
        if (!d.olur) throw new GameError(d.sebep!, 400, 'SEVIYE_ESIGI');
      }

      const a = await tx.alliance.update({
        where: { id: allianceId },
        data: {
          ...(body.katilim !== undefined ? { katilim: body.katilim } : {}),
          ...(body.asgariSeviye !== undefined ? { asgariSeviye: body.asgariSeviye } : {}),
        },
        select: { katilim: true, asgariSeviye: true },
      });

      /**
       * Kapı açılınca bekleyen başvurular ORTADA KALMIYOR.
       *
       * Açık ittifağa başvuru diye bir şey yok; satırları bıraksaydık
       * lider onları hiçbir ekranda göremeyecek, başvuranlar da sonsuza
       * kadar "cevap bekleniyor" görecekti. Geri çekilmiş sayılıyorlar ve
       * artık doğrudan katılabilirler.
       */
      if (body.katilim === 'acik') {
        await tx.allianceBasvuru.updateMany({
          where: { allianceId, durum: 'bekliyor' },
          data: { durum: 'geri_cekildi', kararAt: new Date() },
        });
      }
      return { katilim: a.katilim, asgariSeviye: a.asgariSeviye };
    });
  });

  /** Bir ittifağa başvur. */
  app.post('/ittifak/:id/basvur', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { mesaj = '' } = z.object({ mesaj: z.string().optional() }).parse(req.body ?? {});
    const lordId = await findLordByUser(req.user.userId);

    const notu = mesaj.trim();
    const md = basvuruMesajiDenetle(notu);
    if (!md.olur) throw new GameError(md.sebep!, 400, 'NOT_UZUN');
    // Not herkese değil ama ittifağın yönetimine görünüyor: sohbet
    // mesajlarıyla aynı süzgeçten geçiyor, iki ayrı liste tutmuyoruz.
    if (notu) {
      const t = mesajDenetle(notu);
      if (!t.uygun) throw new GameError(t.sebep!, 400, 'NOT_UYGUNSUZ');
    }

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: {
          worldId: true,
          allianceId: true,
          allianceLeftAt: true,
          name: true,
          level: true,
        },
      });

      const a = await tx.alliance.findUnique({
        where: { id },
        include: { members: { select: { id: true } } },
      });
      if (!a || a.worldId !== lord.worldId) throw hata.bulunamadi('İttifak');

      /**
       * Ayrılma beklemesi başvuru ANINDA da bakılıyor, yalnız kabulde
       * değil. Yalnız kabulde baksaydık lider "kabul" der, işlem düşer ve
       * hatayı gören liderin yapabileceği bir şey olmazdı — engel
       * başvuranın tarafında.
       */
      const bekleme = ittifakaGirebilirMi(lord.allianceLeftAt, new Date());
      if (!bekleme.girebilir) {
        throw new GameError(
          `İttifaktan yeni ayrıldın. ${Math.ceil(bekleme.kalanSn / 3600)} saat sonra ` +
            'yeni bir ittifağa başvurabilirsin.',
          400,
          'ITTIFAK_BEKLEME',
        );
      }

      const onceki = await tx.allianceBasvuru.findUnique({
        where: { allianceId_lordId: { allianceId: id, lordId } },
      });
      const bekleyen = await tx.allianceBasvuru.count({
        where: { lordId, durum: 'bekliyor', allianceId: { not: id } },
      });

      const karar = basvurabilirMi({
        lordSeviye: lord.level,
        ittifaktaMi: lord.allianceId !== null,
        katilim: a.katilim as KatilimTuru,
        asgariSeviye: a.asgariSeviye,
        uyeSayisi: a.members.length,
        bekleyenSayisi: bekleyen,
        oncekiDurum: onceki?.durum as 'bekliyor' | 'kabul' | 'ret' | 'geri_cekildi' | undefined,
        oncekiKararAt: onceki?.kararAt ?? null,
        simdi: new Date(),
      });
      if (!karar.olur) throw new GameError(karar.sebep!, 400, 'BASVURU_OLMAZ');

      // Tek satır: yeni başvuru eskisini yeniden açıyor. Her denemeye satır
      // açsaydık tablo reddedilen her denemeyle büyürdü ve "bu lord bu
      // ittifağa başvurdu mu" sorusu bir tarama olurdu.
      const b = await tx.allianceBasvuru.upsert({
        where: { allianceId_lordId: { allianceId: id, lordId } },
        create: { allianceId: id, lordId, mesaj: notu || null },
        update: { durum: 'bekliyor', mesaj: notu || null, kararAt: null, kararVerenId: null },
      });

      // Yönetimin hepsine haber: yalnız lidere gitseydi yaşlıların
      // karar yetkisi olur ama haberi olmazdı.
      const yonetim = await tx.lord.findMany({
        where: { allianceId: id, OR: [{ id: a.leaderLordId }, { ittifakRutbe: 'yasli' }] },
        select: { id: true },
      });
      for (const y of yonetim) {
        await pushEvent(
          y.id,
          'ittifak_basvuru',
          { mesaj: `${lord.name} (Sv${lord.level}) ittifağınıza başvurdu.` },
          tx,
        );
      }
      return { basvuruId: b.id, ad: a.name };
    });
  });

  /** Başvuruyu geri çek. */
  app.post('/ittifak/basvuru/:id/geri-cek', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    // Koşullu updateMany: satır bu lorda ait DEĞİLSE ya da artık bekleyen
    // değilse hiçbir şey güncellenmiyor. Önce okuyup sonra yazsaydık
    // araya giren bir kabul kararı ezilebilirdi.
    const sonuc = await prisma.allianceBasvuru.updateMany({
      where: { id, lordId, durum: 'bekliyor' },
      data: { durum: 'geri_cekildi', kararAt: new Date() },
    });
    if (sonuc.count === 0) throw hata.bulunamadi('Başvuru');
    return { geriCekildi: id };
  });

  /** Bekleyen başvurular — yalnız ittifağın yönetimi görür. */
  app.get('/ittifak/basvurular', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true, ittifakRutbe: true },
    });
    if (!lord.allianceId) return { basvurular: [], yonetebilir: false };

    const a = await prisma.alliance.findUniqueOrThrow({
      where: { id: lord.allianceId },
      select: { leaderLordId: true, katilim: true, asgariSeviye: true, members: { select: { id: true } } },
    });
    const rutbe: IttifakRutbe =
      a.leaderLordId === lordId ? 'lider' : lord.ittifakRutbe === 'yasli' ? 'yasli' : 'uye';
    const yonetebilir = yonetebilirMi(rutbe);
    if (!yonetebilir) return { basvurular: [], yonetebilir: false };

    const satirlar = await prisma.allianceBasvuru.findMany({
      where: { allianceId: lord.allianceId, durum: 'bekliyor' },
      orderBy: { createdAt: 'asc' },
      include: { lord: { select: uyeSecimi } },
    });

    return {
      yonetebilir,
      lider: rutbe === 'lider',
      katilim: a.katilim as KatilimTuru,
      asgariSeviye: a.asgariSeviye,
      // Doluysa kabul düğmesi anlamsız; arayüz bunu sebebiyle söylüyor.
      bosYer: azamiUye() - a.members.length,
      azamiAsgariSeviye: azamiAsgariSeviye(),
      basvurular: satirlar.map((b) => ({
        id: b.id,
        mesaj: b.mesaj,
        createdAt: b.createdAt,
        lord: {
          id: b.lord.id,
          ad: b.lord.name,
          seviye: b.lord.level,
          sohret: b.lord.fame,
          arma: lordArmasi(b.lord),
        },
      })),
    };
  });

  /** Başvuruyu kabul et ya da reddet. */
  app.post('/ittifak/basvuru/:id/karar', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { kabul } = z.object({ kabul: z.boolean() }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { allianceId, rutbe } = await rutbemi(tx, lordId);
      if (!yonetebilirMi(rutbe)) throw hata.yetkisiz();

      const b = await tx.allianceBasvuru.findUnique({
        where: { id },
        include: { lord: { select: { id: true, name: true, level: true, allianceId: true, allianceLeftAt: true } } },
      });
      if (!b || b.allianceId !== allianceId) throw hata.bulunamadi('Başvuru');
      if (b.durum !== 'bekliyor') {
        throw new GameError('Bu başvuru zaten karara bağlanmış.', 400, 'BASVURU_KAPALI');
      }

      const simdi = new Date();
      if (!kabul) {
        await tx.allianceBasvuru.update({
          where: { id },
          data: { durum: 'ret', kararAt: simdi, kararVerenId: lordId },
        });
        await pushEvent(
          b.lordId,
          'ittifak_basvuru_ret',
          { mesaj: 'İttifak başvurun kabul edilmedi.' },
          tx,
        );
        return { karar: 'ret' as const, lordId: b.lordId };
      }

      /**
       * Kabul anında koşullar YENİDEN bakılıyor.
       *
       * Başvuru ile karar arasında saatler geçebiliyor: aday bu arada
       * başka bir ittifağa girmiş, ittifak dolmuş ya da adayın ayrılma
       * beklemesi başlamış olabilir. Başvuru anındaki kontrole güvenmek,
       * bu üç durumdan birinde bozuk bir üyelik yazmak demekti.
       */
      const a = await tx.alliance.findUniqueOrThrow({
        where: { id: allianceId },
        select: { name: true, asgariSeviye: true, members: { select: { id: true } } },
      });
      if (b.lord.allianceId) {
        throw new GameError(
          `${b.lord.name} bu arada başka bir ittifağa katılmış.`,
          400,
          'ADAY_ITTIFAKTA',
        );
      }
      if (a.members.length >= azamiUye()) {
        throw new GameError(`İttifak dolu (${azamiUye()} üye).`, 400, 'ITTIFAK_DOLU');
      }
      const bekleme = ittifakaGirebilirMi(b.lord.allianceLeftAt, simdi);
      if (!bekleme.girebilir) {
        throw new GameError(
          `${b.lord.name} ittifaktan yeni ayrılmış, ${Math.ceil(bekleme.kalanSn / 3600)} ` +
            'saat daha giremez.',
          400,
          'ITTIFAK_BEKLEME',
        );
      }

      await tx.lord.update({ where: { id: b.lordId }, data: { allianceId } });
      await tx.allianceBasvuru.update({
        where: { id },
        data: { durum: 'kabul', kararAt: simdi, kararVerenId: lordId },
      });
      await bekleyenleriDusur(tx, b.lordId);
      await pushEvent(
        b.lordId,
        'ittifak_basvuru_kabul',
        { mesaj: `${a.name} ittifakına kabul edildin.` },
        tx,
      );
      return { karar: 'kabul' as const, lordId: b.lordId, ad: b.lord.name };
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
      azami: (await ittifakAyricaligi(lord.allianceId)).paktSlotu,
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

      const [benimSayi, hedefSayi, benimAyr, hedefAyr] = await Promise.all([
        yururlukteMi(benim.id, tx),
        yururlukteMi(hedef.id, tx),
        ittifakAyricaligi(benim.id, tx),
        ittifakAyricaligi(hedef.id, tx),
      ]);
      const denetim = paktTeklifDenetle(benim.id, hedef.id, benimSayi, hedefSayi, {
        benim: benimAyr.paktSlotu,
        hedef: hedefAyr.paktSlotu,
      });
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
      const [benimSayi, otekiSayi, benimAyr, otekiAyr] = await Promise.all([
        yururlukteMi(benim.id, tx),
        yururlukteMi(oteki.id, tx),
        ittifakAyricaligi(benim.id, tx),
        ittifakAyricaligi(oteki.id, tx),
      ]);
      const denetim = paktTeklifDenetle(benim.id, oteki.id, benimSayi, otekiSayi, {
        benim: benimAyr.paktSlotu,
        hedef: otekiAyr.paktSlotu,
      });
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

  /* ------------------------------------------------------------------ *
   *  İttifak seviyesi ve bağış (docs/09 B1e)
   * ------------------------------------------------------------------ */

  /** Bağış ekranı: maliyet, kalan hak, seviyenin getirdikleri. */
  app.get('/ittifak/bagis', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true, level: true, altin: true, demir: true, erzak: true },
    });
    if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

    const [a, bugun] = await Promise.all([
      prisma.alliance.findUniqueOrThrow({
        where: { id: lord.allianceId },
        select: { xp: true },
      }),
      prisma.allianceDonation.count({
        where: { lordId, createdAt: { gte: gunBasi() } },
      }),
    ]);
    const durum = ittifakSeviyesi(a.xp);
    return {
      maliyet: bagisMaliyeti(lord.level),
      kazandiracakXp: bagisXp(lord.level),
      odul: bagisOdulu(),
      gunlukHak: gunlukBagisHakki(),
      kalanHak: Math.max(0, gunlukBagisHakki() - bugun),
      kaynaklarim: {
        altin: Math.floor(lord.altin),
        demir: Math.floor(lord.demir),
        erzak: Math.floor(lord.erzak),
      },
      seviye: durum,
      ayricaliklar: ittifakAyricaliklari(durum.seviye),
      sonrakiAyricaliklar:
        durum.sonrakiEsik === null ? null : ittifakAyricaliklari(durum.seviye + 1),
    };
  });

  /**
   * Bağış yap.
   *
   * Günlük hak SAYILARAK uygulanıyor (sayaç tutmuyoruz): bugünkü bağış
   * satırlarını sayıyoruz. İşlem içinde sayıp işlem içinde yazdığımız
   * için iki eş zamanlı istek hakkı aşamıyor.
   */
  app.post('/ittifak/bagis', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { allianceId: true, level: true, name: true },
      });
      if (!lord.allianceId) throw new GameError('Bir ittifakta değilsin.', 400, 'ITTIFAK_YOK');

      const bugun = await tx.allianceDonation.count({
        where: { lordId, createdAt: { gte: gunBasi() } },
      });
      if (bugun >= gunlukBagisHakki()) {
        throw new GameError(
          `Bugünlük bağış hakkın bitti (${gunlukBagisHakki()}). Yarın tekrar.`,
          400,
          'HAK_BITTI',
        );
      }

      const maliyet = bagisMaliyeti(lord.level);
      await spendResources(lordId, maliyet, tx);

      const xp = bagisXp(lord.level);
      const oncekiSeviye = ittifakSeviyesi(
        (
          await tx.alliance.findUniqueOrThrow({
            where: { id: lord.allianceId },
            select: { xp: true },
          })
        ).xp,
      ).seviye;

      await tx.allianceDonation.create({
        data: {
          allianceId: lord.allianceId,
          lordId,
          xp,
          altin: maliyet.altin,
          demir: maliyet.demir,
          erzak: maliyet.erzak,
        },
      });
      const a = await tx.alliance.update({
        where: { id: lord.allianceId },
        data: { xp: { increment: xp } },
        select: { xp: true, name: true, members: { select: { id: true } } },
      });

      // Bağış yapan da bir şey almalı, yoksa bağış "ittifak için
      // fedakârlık" olur ve kimse yapmaz. Ödül LORD XP — şöhret DEĞİL:
      // şöhret türetilen bir değer (calculateFame) ve kaynakla doğrudan
      // şöhret satın almak, savaşmadan sıralamada yükselmek olurdu.
      const odul = bagisOdulu();
      await grantXp(lordId, odul.xp, tx);

      const durum = ittifakSeviyesi(a.xp);
      // Seviye atladıysa HERKES duysun: ortak emeğin karşılığını görmek
      // bir sonraki bağışın sebebi.
      if (durum.seviye > oncekiSeviye) {
        for (const u of a.members) {
          await pushEvent(
            u.id,
            'ittifak_seviye',
            {
              mesaj: `${a.name} ${durum.seviye}. seviyeye çıktı.`,
              seviye: durum.seviye,
            },
            tx,
          );
        }
      }

      return {
        bagislandi: true,
        xp,
        odul,
        seviye: durum,
        seviyeAtladi: durum.seviye > oncekiSeviye,
        kalanHak: Math.max(0, gunlukBagisHakki() - bugun - 1),
      };
    });
  });

  /**
   * Duyuru yaz. Lider ve yaşlı.
   *
   * Sohbetten farkı akıp gitmemesi: "günde 5 bağış yapın" her yeni üyenin
   * görmesi gereken bir kural, sohbette üçüncü mesajda kayboluyor.
   */
  app.post('/ittifak/duyuru', { preHandler: requireAuth }, async (req) => {
    const { metin } = z.object({ metin: z.string().max(duyuruEnFazlaHarf()) }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { rutbe, allianceId } = await rutbemi(tx, lordId);
      if (!yonetebilirMi(rutbe)) throw hata.yetkisiz();

      const temiz = metin.trim();
      if (temiz.length > 0) {
        const d = mesajDenetle(temiz);
        if (!d.uygun) throw new GameError(d.sebep!, 400, 'MESAJ_UYGUNSUZ');
      }
      await tx.alliance.update({
        where: { id: allianceId },
        data: { duyuru: temiz.length ? temiz : null },
      });
      return { duyuru: temiz.length ? temiz : null };
    });
  });

  /**
   * Rütbe ver / al. Yalnız LİDER.
   *
   * Yaşlı sayısı sınırlı: rütbe ancak nadirse bir şey ifade eder.
   */
  app.post('/ittifak/rutbe', { preHandler: requireAuth }, async (req) => {
    const { lordId: hedefId, rutbe } = z
      .object({ lordId: z.string().min(1), rutbe: z.enum(['yasli', 'uye']) })
      .parse(req.body);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const { allianceId, lider } = await rutbemi(tx, lordId);
      if (!lider) throw hata.yetkisiz();
      if (hedefId === lordId) {
        throw new GameError('Kendi rütbeni değiştiremezsin.', 400, 'KENDI_RUTBEN');
      }

      const hedef = await tx.lord.findUnique({
        where: { id: hedefId },
        select: { allianceId: true, name: true, ittifakRutbe: true },
      });
      if (!hedef || hedef.allianceId !== allianceId) throw hata.bulunamadi('Üye');

      if (rutbe === 'yasli') {
        const mevcut = await tx.lord.count({ where: { allianceId, ittifakRutbe: 'yasli' } });
        if (mevcut >= azamiYasli()) {
          throw new GameError(
            `En fazla ${azamiYasli()} yaşlı olabilir. Önce birinin rütbesini almalısın.`,
            400,
            'YASLI_LIMITI',
          );
        }
      }

      await tx.lord.update({
        where: { id: hedefId },
        data: { ittifakRutbe: rutbe === 'yasli' ? 'yasli' : null },
      });
      await pushEvent(
        hedefId,
        'ittifak_rutbe',
        {
          mesaj:
            rutbe === 'yasli' ? 'İttifakında Yaşlı oldun.' : 'İttifakındaki Yaşlı rütben alındı.',
        },
        tx,
      );
      return { lordId: hedefId, ad: hedef.name, rutbe };
    });
  });
}

export { ayniIttifaktaMi };
