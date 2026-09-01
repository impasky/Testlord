/**
 * İlk oturum ölçümü.
 *
 * docs/07'nin başarı kriterlerindeki son madde buraya taşındı, çünkü asıl
 * ihtiyaç burada: bugüne kadarki bütün analizler tahmindi ve ilk gerçek
 * oyuncu testi hepsini yanlışladı. Bu dört sayı olmadan bir sonraki
 * iyileştirme de tahmin olur. (docs/08 İ7)
 *
 *   1. Kayıttan ilk savaş raporuna geçen süre   (hedef: 6 dakikanın altı)
 *   2. İlk oturumda tamamlanan eylem sayısı
 *   3. Oyuncuların oyunu bıraktığı ekran
 *   4. Ertesi gün geri dönme oranı
 *
 * Hiçbiri için ayrı bir olay tablosu tutulmuyor: üçü zaten var olan
 * kayıtlardan türetiliyor, yalnızca "son ekran" için tek bir sütun eklendi.
 *
 * Erişim OLCUM_ANAHTARI ortam değişkeniyle korunuyor; değişken boşsa uç hiç
 * yüklenmiyor. Oyuncu verisi dönmüyor, yalnızca toplamlar.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { GameError } from '../errors.js';

/** İlk oturum sayılan pencere. */
const ILK_OTURUM_DK = 30;

function ortanca(sayilar: number[]): number | null {
  if (sayilar.length === 0) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export async function olcumRoutes(app: FastifyInstance): Promise<void> {
  app.get('/olcum', async (req) => {
    const { anahtar } = z.object({ anahtar: z.string().optional() }).parse(req.query);
    if (!env.olcumAnahtari || anahtar !== env.olcumAnahtari) {
      throw new GameError('Geçersiz anahtar.', 403, 'YETKISIZ');
    }

    const lordlar = await prisma.lord.findMany({
      select: { id: true, createdAt: true, lastSeenAt: true, lastScreen: true },
    });
    if (lordlar.length === 0) return { lordSayisi: 0, not: 'Henüz oyuncu yok.' };

    const ilkSavaslar = await prisma.battle.groupBy({
      by: ['attackerLordId'],
      _min: { createdAt: true },
    });
    const ilkSavas = new Map(ilkSavaslar.map((b) => [b.attackerLordId, b._min.createdAt]));

    const pencereSonu = (l: { createdAt: Date }) =>
      new Date(l.createdAt.getTime() + ILK_OTURUM_DK * 60_000);

    // Eylem = başlatılan kuyruk + yola çıkarılan ordu. İkisi de oyuncunun
    // bilerek yaptığı bir şey; olay akışı ise çoğu zaman ona OLAN şeyler.
    const [kuyruklar, yuruyusler] = await Promise.all([
      prisma.queue.findMany({ select: { lordId: true, startedAt: true } }),
      prisma.march.findMany({ select: { lordId: true, departAt: true } }),
    ]);
    const eylemSayaci = new Map<string, number>();
    for (const l of lordlar) {
      const son = pencereSonu(l);
      const sayi =
        kuyruklar.filter((k) => k.lordId === l.id && k.startedAt <= son).length +
        yuruyusler.filter((y) => y.lordId === l.id && y.departAt <= son).length;
      eylemSayaci.set(l.id, sayi);
    }

    const savasSureleri: number[] = [];
    let ilkOturumdaSavasan = 0;
    for (const l of lordlar) {
      const s = ilkSavas.get(l.id);
      if (!s) continue;
      const sn = Math.round((s.getTime() - l.createdAt.getTime()) / 1000);
      savasSureleri.push(sn);
      if (sn <= ILK_OTURUM_DK * 60) ilkOturumdaSavasan++;
    }

    // Geri dönüş: kayıttan en az 24 saat sonra tekrar görülmüş olmak.
    // Yalnızca 24 saatten eski hesaplar paydaya giriyor; dün kaydolmuş
    // birinin "dönmedi" sayılması ölçümü yalancı çıkarırdı.
    const gun = 86_400_000;
    const olgun = lordlar.filter((l) => Date.now() - l.createdAt.getTime() >= gun);
    const donen = olgun.filter((l) => l.lastSeenAt.getTime() - l.createdAt.getTime() >= gun);

    const ekranlar = new Map<string, number>();
    for (const l of lordlar) {
      const e = l.lastScreen ?? 'bilinmiyor';
      ekranlar.set(e, (ekranlar.get(e) ?? 0) + 1);
    }

    return {
      lordSayisi: lordlar.length,
      ilkOturumPenceresiDk: ILK_OTURUM_DK,

      ilkSavasaKadar: {
        olcuLordSayisi: savasSureleri.length,
        hicSavasmayan: lordlar.length - savasSureleri.length,
        ortancaSaniye: ortanca(savasSureleri),
        altiDakikaAltiOran:
          savasSureleri.length === 0
            ? null
            : savasSureleri.filter((s) => s <= 360).length / savasSureleri.length,
        ilkOturumdaSavasanOran: ilkOturumdaSavasan / lordlar.length,
      },

      ilkOturumEylemi: {
        ortanca: ortanca([...eylemSayaci.values()]),
        hicEylemYapmayan: [...eylemSayaci.values()].filter((n) => n === 0).length,
      },

      birakilanEkran: Object.fromEntries(
        [...ekranlar.entries()].sort((a, b) => b[1] - a[1]),
      ),

      ertesiGunDonus: {
        olgunLordSayisi: olgun.length,
        donen: donen.length,
        oran: olgun.length === 0 ? null : donen.length / olgun.length,
      },
    };
  });
}
