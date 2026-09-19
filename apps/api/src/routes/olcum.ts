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
 * MEDENİYET KATMANI da buradan ölçülüyor (docs/16 §10 + §15). §14 "veri
 * gelene kadar park" derken bir söz vermişti; §15 kararı değiştirirken o
 * sözün yönünü değiştirdi: ölçüm artık "yapılsın mı" sorusunu değil
 * "yapılan iş tutuyor mu" sorusunu cevaplıyor. Aynı uç, aynı anahtar.
 *
 * Erişim OLCUM_ANAHTARI ortam değişkeniyle korunuyor; değişken boşsa uç hiç
 * yüklenmiyor. Oyuncu verisi dönmüyor, yalnızca toplamlar.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { GameError } from '../errors.js';
import { AKTIF_GUN } from '../services/world.js';

/** İlk oturum sayılan pencere. */
const ILK_OTURUM_DK = 30;

function ortanca(sayilar: number[]): number | null {
  if (sayilar.length === 0) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Ölçümün medeniyet bölümüne giren lord alanları. */
interface OlcumLordu {
  id: string;
  medeniyetId: string | null;
  faydaPuani: number;
  lastSeenAt: Date;
}

/** En büyük payın toplam içindeki oranı. Dört eşit taraf için 0,25. */
function enBuyukPay(sayilar: number[]): number | null {
  const toplam = sayilar.reduce((t, n) => t + n, 0);
  if (toplam <= 0) return null;
  return Math.max(...sayilar) / toplam;
}

/**
 * MEDENİYET ÖLÇÜMÜ — docs/16 §10'un dört riski, dört sayı.
 *
 * | Risk                | Sayı                                            |
 * | ------------------- | ----------------------------------------------- |
 * | Nüfus dengesizliği  | en kalabalık tarafın aktif nüfus payı           |
 * | Fraksiyon kartopu   | en geniş tarafın toprak payı                    |
 * | Bedavacılık         | puanlı lord oranı + üst ondalığın puan payı     |
 * | Etkisizlik hissi    | garnizon tutan lord oranı                       |
 *
 * Beşinci sayı riskin değil SİSTEMİN kendi sınaması: `paylasilanBolge`.
 * "Bölge bölünemez, bölgedeki PAY bölünür" cümlesi ancak gerçekten
 * paylaşılan bölge varsa doğru. Hiçbir bölgede iki lord birden
 * durmuyorsa garnizon payı tiyatro demektir ve bunu ancak bu sayı
 * söyler.
 *
 * Medeniyetler DİYAR BAŞINA satır tutuyor ama ölçüm ANAHTARA göre
 * toplanıyor: iki diyarda iki "Demir Ocağı" satırı var ve ikisi aynı
 * medeniyet. Anahtara toplamayan bir ölçüm dört tarafı sekiz gösterirdi.
 */
async function medeniyetOlcusu(lordlar: OlcumLordu[]): Promise<unknown> {
  const medeniyetler = await prisma.medeniyet.findMany({ select: { id: true, key: true } });
  if (medeniyetler.length === 0) return null;

  const aktifSiniri = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  const [bolgeSayilari, toplamBolge, cekirdekler, garnizonlar] = await Promise.all([
    prisma.region.groupBy({ by: ['ownerMedeniyetId'], _count: { _all: true } }),
    prisma.region.count(),
    prisma.cekirdekYatirim.groupBy({ by: ['medeniyetId'], _sum: { seviye: true } }),
    // Garnizonların tamamı TEK sorguda: bölge başına sorgu atan bir hâl,
    // 121 bölgede 121 gidiş dönüş demekti.
    prisma.armyUnit.findMany({
      where: { locationType: 'region' },
      select: { lordId: true, locationId: true },
    }),
  ]);

  const bolgeBasina = new Map(bolgeSayilari.map((b) => [b.ownerMedeniyetId, b._count._all]));
  const cekirdekBasina = new Map(cekirdekler.map((c) => [c.medeniyetId, c._sum.seviye ?? 0]));

  const taraflar = new Map<
    string,
    { key: string; lord: number; aktifLord: number; bolge: number; cekirdekSeviyesi: number }
  >();
  for (const m of medeniyetler) {
    const t = taraflar.get(m.key) ?? {
      key: m.key,
      lord: 0,
      aktifLord: 0,
      bolge: 0,
      cekirdekSeviyesi: 0,
    };
    const uyeler = lordlar.filter((l) => l.medeniyetId === m.id);
    t.lord += uyeler.length;
    t.aktifLord += uyeler.filter((l) => l.lastSeenAt >= aktifSiniri).length;
    t.bolge += bolgeBasina.get(m.id) ?? 0;
    t.cekirdekSeviyesi += cekirdekBasina.get(m.id) ?? 0;
    taraflar.set(m.key, t);
  }
  const liste = [...taraflar.values()];

  /* Garnizon: bölge → orada duran lordlar, lord → tuttuğu bölgeler. */
  const bolgeninLordlari = new Map<string, Set<string>>();
  const lordunBolgeleri = new Map<string, Set<string>>();
  for (const g of garnizonlar) {
    if (!g.locationId) continue;
    const lordlarSeti = bolgeninLordlari.get(g.locationId) ?? new Set<string>();
    lordlarSeti.add(g.lordId);
    bolgeninLordlari.set(g.locationId, lordlarSeti);
    const bolgeler = lordunBolgeleri.get(g.lordId) ?? new Set<string>();
    bolgeler.add(g.locationId);
    lordunBolgeleri.set(g.lordId, bolgeler);
  }
  const paylasilan = [...bolgeninLordlari.values()].filter((s) => s.size >= 2).length;

  /* Fayda puanı yoğunluğu: üst ondalık toplamın ne kadarını tutuyor. */
  const puanlar = lordlar.map((l) => l.faydaPuani).sort((a, b) => b - a);
  const puanToplami = puanlar.reduce((t, n) => t + n, 0);
  const ustDilim = puanlar.slice(0, Math.max(1, Math.ceil(puanlar.length * 0.1)));
  const puanliLord = puanlar.filter((p) => p > 0).length;

  return {
    aktifGun: AKTIF_GUN,
    taraflar: liste,

    nufusDengesizligi: {
      // Dört eşit taraf 0,25 verir; 1'e yaklaşması "herkes aynı tarafa
      // yazıldı" demek ve §10'un birinci panzehiri çalışmıyor demektir.
      enKalabalikAktifPay: enBuyukPay(liste.map((t) => t.aktifLord)),
      enKalabalik: liste.reduce((a, b) => (b.aktifLord > a.aktifLord ? b : a)).key,
    },

    kartopu: {
      // Toprak payı nüfus payından belirgin biçimde büyükse fraksiyon
      // kartopu dönüyor demektir: büyüyen taraf daha çok kazanıyor.
      enGenisToprakPayi: enBuyukPay(liste.map((t) => t.bolge)),
      tutulanBolge: liste.reduce((t, x) => t + x.bolge, 0),
      toplamBolge,
    },

    bedavacilik: {
      puanliLord,
      puanliLordOrani: lordlar.length === 0 ? null : puanliLord / lordlar.length,
      ortancaPuan: ortanca(lordlar.map((l) => l.faydaPuani)),
      ustOndalikPayi: puanToplami <= 0 ? null : ustDilim.reduce((t, n) => t + n, 0) / puanToplami,
    },

    garnizonKatilimi: {
      garnizonTutanLord: lordunBolgeleri.size,
      garnizonTutanLordOrani: lordlar.length === 0 ? null : lordunBolgeleri.size / lordlar.length,
      ortancaBolge: ortanca(lordlar.map((l) => lordunBolgeleri.get(l.id)?.size ?? 0)),
      garnizonluBolge: bolgeninLordlari.size,
      /** İki ya da daha çok lordun aynı bölgede durduğu yer sayısı. */
      paylasilanBolge: paylasilan,
      paylasilanBolgeOrani: bolgeninLordlari.size === 0 ? null : paylasilan / bolgeninLordlari.size,
    },
  };
}

export async function olcumRoutes(app: FastifyInstance): Promise<void> {
  app.get('/olcum', async (req) => {
    const { anahtar } = z.object({ anahtar: z.string().optional() }).parse(req.query);
    if (!env.olcumAnahtari || anahtar !== env.olcumAnahtari) {
      throw new GameError('Geçersiz anahtar.', 403, 'YETKISIZ');
    }

    const lordlar = await prisma.lord.findMany({
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        lastScreen: true,
        // Medeniyet bölümü de bu satırlardan besleniyor: ayrı bir sorgu
        // aynı lordları ikinci kez çekerdi.
        medeniyetId: true,
        faydaPuani: true,
      },
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

    const medeniyet = await medeniyetOlcusu(lordlar);

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

      birakilanEkran: Object.fromEntries([...ekranlar.entries()].sort((a, b) => b[1] - a[1])),

      ertesiGunDonus: {
        olgunLordSayisi: olgun.length,
        donen: donen.length,
        oran: olgun.length === 0 ? null : donen.length / olgun.length,
      },

      /** Medeniyet katmanı; sistem hiç kurulmamışsa null (docs/16 §15). */
      medeniyet,
    };
  });
}
