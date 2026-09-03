/**
 * Günlük görevler ve giriş serisi.
 *
 * Ayrı bir uç, `/me`'ye eklenmiş bir alan değil. Sebep: görev ilerlemesi
 * üç ayrı sayım sorgusu gerektiriyor ve `/me` sık yoklanıyor. Malikâne'deki
 * kart bunu bir kez çekiyor.
 *
 * Seri BURADA güncelleniyor, çünkü oyuncunun "bugün girdiği" an bu ucun
 * çağrıldığı andır. `/me` de çağrılıyor ama o polling ile de geliyor;
 * seriyi orada güncellemek, açık sekmesi olan oyuncunun serisini gece
 * yarısı kendiliğinden artırırdı. (docs/09 K4)
 */
import {
  gunNumarasi,
  gunlukGorevler,
  gunlukOdul,
  gunlukSayaci,
  odulAlindiMi,
  seriCarpani,
  seriGuncelle,
  storageCapacity,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findLordByUser, tickLord } from '../services/lord.js';

/** Bugünün UTC başlangıcı — sayımların alt sınırı. */
function gunBasi(simdi: Date): Date {
  return new Date(gunNumarasi(simdi) * 86_400_000);
}

export async function gunlukRoutes(app: FastifyInstance): Promise<void> {
  app.get('/gunluk', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const bugun = gunBasi(simdi);

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { girisSerisi: true, girisSerisiGunu: true, gunlukOdulGunu: true, level: true },
    });

    const seri = seriGuncelle(lord.girisSerisi, lord.girisSerisiGunu, simdi);
    if (seri.bugunIlk) {
      await prisma.lord.update({
        where: { id: lordId },
        data: { girisSerisi: seri.seri, girisSerisiGunu: simdi },
      });
    }

    // Üç sayım: hepsi var olan kayıtlardan. Yeni sayaç tutmuyoruz —
    // tutsak gerçekle sapardı.
    const [saldiri, egitim, imar] = await Promise.all([
      prisma.battle.count({
        where: { attackerLordId: lordId, createdAt: { gte: bugun } },
      }),
      prisma.queue.count({
        where: { lordId, kind: 'train', startedAt: { gte: bugun } },
      }),
      prisma.queue.count({
        where: {
          lordId,
          kind: { in: ['craft', 'upgrade_item', 'upgrade_gear', 'upgrade_region'] },
          startedAt: { gte: bugun },
        },
      }),
    ]);

    const gorevler = gunlukGorevler({ saldiri, egitim, imar });
    const sayac = gunlukSayaci(gorevler);

    return {
      gorevler,
      seri: seri.seri,
      bugunIlk: seri.bugunIlk,
      odul: {
        // Ödül HER ZAMAN gösteriliyor, sadece hak edilince değil: oyuncu
        // görevleri neyin için yaptığını baştan bilmeli. Kilitli bir ödül
        // sebep, alındıktan sonra görünen bir ödül sürprizdir — sürpriz
        // yarın geri getirmez.
        kaynak: gunlukOdul(lord.level, seri.seri),
        seriCarpani: seriCarpani(seri.seri),
        hakEdildi: sayac.tamam === sayac.toplam,
        alindi: odulAlindiMi(lord.gunlukOdulGunu, simdi),
      },
    };
  });

  /**
   * Günün ödülünü alır.
   *
   * Otomatik verilmiyor, oyuncu ALIYOR. Sebep his: kendiliğinden düşen
   * kaynak fark edilmez bile; "Al" düğmesine basmak günü bitiren küçük
   * bir tören. Karşılığı bir uç ve bir kolon.
   *
   * İki kez alınamaz: gün damgası koşullu updateMany ile yazılıyor, yani
   * aynı anda gelen iki istekten yalnız biri satırı alıyor. Kontrol edip
   * sonra yazmak, çift tıklamaya kaynak dağıtırdı.
   */
  app.post('/gunluk/odul', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const bugun = gunBasi(simdi);

    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { girisSerisi: true, gunlukOdulGunu: true, level: true },
    });
    if (odulAlindiMi(lord.gunlukOdulGunu, simdi)) {
      throw new GameError('Bugünün ödülünü zaten aldın.', 400, 'ODUL_ALINDI');
    }

    const [saldiri, egitim, imar] = await Promise.all([
      prisma.battle.count({ where: { attackerLordId: lordId, createdAt: { gte: bugun } } }),
      prisma.queue.count({ where: { lordId, kind: 'train', startedAt: { gte: bugun } } }),
      prisma.queue.count({
        where: {
          lordId,
          kind: { in: ['craft', 'upgrade_item', 'upgrade_gear', 'upgrade_region'] },
          startedAt: { gte: bugun },
        },
      }),
    ]);
    const gorevler = gunlukGorevler({ saldiri, egitim, imar });
    const sayac = gunlukSayaci(gorevler);
    if (sayac.tamam < sayac.toplam) {
      throw new GameError(
        `Önce üç görevi de bitir (${sayac.tamam}/${sayac.toplam}).`,
        400,
        'GOREV_EKSIK',
      );
    }

    const odul = gunlukOdul(lord.level, lord.girisSerisi);

    // Önce birikmiş gelir yazılsın: ödülü ekleyip sonra tick atmak, tick'in
    // depo tavanını uygularken ödülü de kırpmasına yol açardı ve oyuncuya
    // "aldın" denip verilmemiş olurdu.
    const once = await tickLord(lordId, simdi);
    const tavan = storageCapacity(lord.level);

    // Depo tavanı ödüle de işliyor. Bilerek: tavan oyunun kuralı, ödül
    // kuralın istisnası değil. Ama SESSİZ kırpılmıyor — ne verildiği
    // ayrıca dönüyor, arayüz "deponu boşalt" diyebilsin diye. Sessiz
    // kırpma, oyuncunun ekranda gördüğü sayıyla kesesindekinin
    // tutmamasıdır; oyuna güveni en hızlı bu bozar.
    const sigan = (istenen: number, mevcut: number): number =>
      Math.max(0, Math.min(istenen, tavan - mevcut));
    const verilen = {
      altin: sigan(odul.altin, once.resources.altin),
      demir: sigan(odul.demir, once.resources.demir),
      erzak: sigan(odul.erzak, once.resources.erzak),
    };

    const yazildi = await prisma.lord.updateMany({
      where: { id: lordId, OR: [{ gunlukOdulGunu: null }, { gunlukOdulGunu: { lt: bugun } }] },
      data: {
        gunlukOdulGunu: simdi,
        altin: { increment: verilen.altin },
        demir: { increment: verilen.demir },
        erzak: { increment: verilen.erzak },
      },
    });
    if (yazildi.count === 0) {
      throw new GameError('Bugünün ödülünü zaten aldın.', 400, 'ODUL_ALINDI');
    }

    const sonra = await tickLord(lordId, simdi);
    return {
      odul,
      verilen,
      kirpildi:
        verilen.altin < odul.altin ||
        verilen.demir < odul.demir ||
        verilen.erzak < odul.erzak,
      seri: lord.girisSerisi,
      kaynaklar: sonra.resources,
    };
  });
}
