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
import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { GameError } from '../errors.js';
import { AKTIF_GUN } from '../services/world.js';
import { okuArastirmalar } from '../services/lord.js';
import { olcumPanosu } from '../services/olcumPanosu.js';
import { GRUPLAR, arastirmaIlerlemesi, grupSecenekleri, grupSecimi } from '@lordlar/shared';

/** İlk oturum sayılan pencere. */
const ILK_OTURUM_DK = 30;

function ortanca(sayilar: number[]): number | null {
  if (sayilar.length === 0) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Ölçümün ülke bölümüne giren lord alanları. */
interface OlcumLordu {
  id: string;
  ulke: string | null;
  lastSeenAt: Date;
}

/** En büyük payın toplam içindeki oranı. */
function enBuyukPay(sayilar: number[]): number | null {
  const toplam = sayilar.reduce((t, n) => t + n, 0);
  if (toplam <= 0) return null;
  return Math.max(...sayilar) / toplam;
}

/**
 * ÜLKE VE TOPRAK ÖLÇÜMÜ (docs/27).
 *
 * | Soru                         | Sayı                                       |
 * | ---------------------------- | ------------------------------------------ |
 * | Oyuncular nereye yığılıyor   | en kalabalık ülkenin aktif nüfus payı      |
 * | Kim ülkesini seçmedi         | ülkesiz lord (göçten sonra seçim bekleyen) |
 * | Harita ne kadar dolu         | lordların tuttuğu şehir payı               |
 * | Toprak üstünde asker var mı  | garnizon tutan lord oranı                  |
 *
 * `paylasilanBolge`: iki lordun birden durduğu şehir — ittifak
 * takviyesinin gelir payına dönüştüğü yer. Sıfırsa takviye payı tiyatro.
 */
async function ulkeOlcusu(lordlar: OlcumLordu[]): Promise<unknown> {
  const aktifSiniri = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  const [tutulanBolge, toplamBolge, garnizonlar] = await Promise.all([
    prisma.region.count({ where: { ownerLordId: { not: null } } }),
    prisma.region.count(),
    // Garnizonların tamamı TEK sorguda.
    prisma.armyUnit.findMany({
      where: { locationType: 'region' },
      select: { lordId: true, locationId: true },
    }),
  ]);

  const ulkeler = new Map<string, { kod: string; lord: number; aktifLord: number }>();
  for (const l of lordlar) {
    if (!l.ulke) continue;
    const u = ulkeler.get(l.ulke) ?? { kod: l.ulke, lord: 0, aktifLord: 0 };
    u.lord++;
    if (l.lastSeenAt >= aktifSiniri) u.aktifLord++;
    ulkeler.set(l.ulke, u);
  }
  const liste = [...ulkeler.values()].sort((a, b) => b.aktifLord - a.aktifLord || b.lord - a.lord);

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

  return {
    aktifGun: AKTIF_GUN,
    /** En kalabalık on ülke. */
    ulkeler: liste.slice(0, 10),
    ulkeSayisi: liste.length,
    ulkesizLord: lordlar.filter((l) => !l.ulke).length,
    enKalabalikAktifPay: enBuyukPay(liste.map((u) => u.aktifLord)),
    toprak: {
      tutulanBolge,
      toplamBolge,
      tutulanPay: toplamBolge === 0 ? null : tutulanBolge / toplamBolge,
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

/**
 * Anahtar SABİT SÜREDE karşılaştırılıyor. Düz `!==` ilk farklı karakterde
 * dönüyor ve yanıt süresi, anahtarın baştan kaç karakterinin tuttuğunu
 * ölçmeye izin veriyor. Özetler karşılaştırılıyor ki uzunluk da sızmasın.
 */
function anahtarUyar(verilen: string | undefined, gercek: string): boolean {
  if (!verilen) return false;
  const a = createHash('sha256').update(verilen).digest();
  const b = createHash('sha256').update(gercek).digest();
  return timingSafeEqual(a, b);
}

/**
 * Eşya pazarı (docs/19 §13): kullanılıyor mu, ve kötüye kullanılıyor mu?
 *
 * `enSikCiftPayi` altın taşımanın izi: pazar anonim ve eşleşmeyi kural
 * yapıyor, yani aynı satıcı-alıcı çiftinin işlemlerin büyük payını
 * tutması kendiliğinden olmaz. Kasadaki altın da izleniyor: kasa depo
 * tavanına bağlı değil ve yağmalanmıyor — büyürse bir banka olmuş demektir.
 */
/**
 * Araştırma ağacının büyük seçimleri (docs/20 §8): her yolu kaç lord
 * seçmiş, en çok seçilenin payı ne ve son 7 günde kaç lord bırakmış.
 * Bir öğreti herkesi topluyorsa denge bozuk demektir; `enCokSecilenPayi`
 * onu ilk gösteren sayı.
 *
 * `arastirmaDegisim` grup başına yalnız SON bırakma anını tutuyor: aynı
 * lord bir haftada iki kez bıraktıysa bir sayılıyor. Alanın adı o yüzden
 * "değiştiren lord", "değişim sayısı" değil.
 */
function arastirmaOlcusu(lordlar: { arastirmalar: unknown; arastirmaDegisim: unknown }[]) {
  const yediGunOnce = Date.now() - 7 * 86_400_000;
  const tamamlananlar = lordlar.map((l) => okuArastirmalar(l.arastirmalar));
  const gruplar = GRUPLAR.map((g) => {
    const yollar: Record<string, number> = Object.fromEntries(
      grupSecenekleri(g.key).map((d) => [d.yol!, 0]),
    );
    let secmeyen = 0;
    let son7GunDegistiren = 0;
    lordlar.forEach((l, i) => {
      const yol = grupSecimi(tamamlananlar[i]!, g.key);
      if (yol) yollar[yol] = (yollar[yol] ?? 0) + 1;
      else secmeyen++;
      const degisim = l.arastirmaDegisim as Record<string, unknown> | null;
      const son = degisim && typeof degisim === 'object' ? degisim[g.key] : undefined;
      if (typeof son === 'string' && new Date(son).getTime() >= yediGunOnce) son7GunDegistiren++;
    });
    const secen = lordlar.length - secmeyen;
    return [
      g.key,
      {
        yollar,
        secmeyen,
        enCokSecilenPayi: secen === 0 ? null : Math.max(...Object.values(yollar)) / secen,
        son7GunDegistiren,
      },
    ] as const;
  });
  return {
    ortancaBiten: ortanca(tamamlananlar.map((t) => arastirmaIlerlemesi(t).biten)),
    gruplar: Object.fromEntries(gruplar),
  };
}

async function esyaPazariOlcusu(): Promise<unknown> {
  const simdi = Date.now();
  const hafta = new Date(simdi - 7 * 86_400_000);
  const dun = new Date(simdi - 86_400_000);
  const [acikIlan, siparis, islemler, kasa] = await Promise.all([
    prisma.esyaIlani.count(),
    prisma.onSiparis.aggregate({ _count: { _all: true }, _sum: { fiyat: true } }),
    prisma.esyaIslemi.findMany({
      where: { createdAt: { gte: hafta } },
      select: { saticiId: true, aliciId: true, vergi: true, kura: true, createdAt: true },
    }),
    prisma.lord.aggregate({ _sum: { pazarKasasi: true } }),
  ]);
  const ciftler = new Map<string, number>();
  const tuccarlar = new Set<string>();
  for (const i of islemler) {
    const k = `${i.saticiId}>${i.aliciId}`;
    ciftler.set(k, (ciftler.get(k) ?? 0) + 1);
    tuccarlar.add(i.saticiId).add(i.aliciId);
  }
  const enSik = Math.max(0, ...ciftler.values());
  return {
    acikIlan,
    acikSiparis: siparis._count._all,
    emanettekiAltin: siparis._sum.fiyat ?? 0,
    kasadakiAltin: kasa._sum.pazarKasasi ?? 0,
    islemSon24Saat: islemler.filter((i) => i.createdAt >= dun).length,
    islemSon7Gun: islemler.length,
    kuraSon7Gun: islemler.filter((i) => i.kura).length,
    vergiSon7Gun: islemler.reduce((t, i) => t + i.vergi, 0),
    tuccarSon7Gun: tuccarlar.size,
    enSikCiftPayi: islemler.length === 0 ? null : enSik / islemler.length,
  };
}

export async function olcumRoutes(app: FastifyInstance): Promise<void> {
  app.get('/olcum', async (req) => {
    const { anahtar } = z.object({ anahtar: z.string().optional() }).parse(req.query);
    if (!env.olcumAnahtari || !anahtarUyar(anahtar, env.olcumAnahtari)) {
      throw new GameError('Geçersiz anahtar.', 403, 'YETKISIZ');
    }

    const tumLordlar = await prisma.lord.findMany({
      select: {
        id: true,
        isNpc: true,
        createdAt: true,
        lastSeenAt: true,
        lastScreen: true,
        // Ülke bölümü de bu satırlardan besleniyor: ayrı bir sorgu
        // aynı lordları ikinci kez çekerdi.
        ulke: true,
        arastirmalar: true,
        arastirmaDegisim: true,
      },
    });
    // İlk oturum ve geri dönüş yalnız OYUNCULARIN: NPC lord `/me`
    // çağırmıyor, son görülmesi kayıt anında kalıyor ve her biri "dönmedi"
    // sayılıp oranı aşağı çekiyordu. Ülke nüfusu ise NPC'yi de sayıyor
    // (haritada toprak tutan onlar da).
    const lordlar = tumLordlar.filter((l) => !l.isNpc);
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

    /*
     * Geri dönüş: kayıttan en az N gün sonra tekrar görülmüş olmak.
     * Yalnızca N günden eski hesaplar paydaya giriyor; dün kaydolmuş
     * birinin "dönmedi" sayılması ölçümü yalancı çıkarırdı.
     *
     * İKİ EŞİK: ertesi gün ve 7. gün. `docs/07` başarı kriterlerinin en
     * önemlisi olarak 7. gün tutundurmasını işaretlemişti ("v2'nin işe
     * yarayıp yaramadığını tahminle değil sayıyla bilmemiz gerekiyor")
     * ve uzun süre yalnız ertesi gün ölçülüyordu. Ertesi gün ilk
     * oturumun, yedinci gün OYUNUN sınavı: bir oyuncu bir hafta sonra
     * hâlâ dönüyorsa oyun tutmuş demektir.
     */
    const gun = 86_400_000;
    const donusOrani = (esikGun: number) => {
      const esik = esikGun * gun;
      const olgunlar = lordlar.filter((l) => Date.now() - l.createdAt.getTime() >= esik);
      const donenler = olgunlar.filter(
        (l) => l.lastSeenAt.getTime() - l.createdAt.getTime() >= esik,
      );
      return {
        olgunLordSayisi: olgunlar.length,
        donen: donenler.length,
        oran: olgunlar.length === 0 ? null : donenler.length / olgunlar.length,
      };
    };

    const ulke = await ulkeOlcusu(tumLordlar);

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

      /**
       * KABA dönüş: kayıttan en az N gün sonra BİR KEZ görülmüş. Üç hafta
       * sonra bir kez dönen de sayılıyor. Kesin günlük sayılar `pano`da
       * (GunlukAktiflik); bu ikisi o tablodan önceki hesaplar için duruyor.
       */
      ertesiGunDonus: donusOrani(1),
      /** 7. gün tutundurma — docs/07'nin en önemli başarı ölçütü. */
      yedinciGunDonus: donusOrani(7),

      /** Günlük aktif ve kohort tutundurması — yönetici panosunun aynısı. */
      pano: await olcumPanosu(),

      /** Ülkeler, toprak ve garnizon (docs/27). */
      ulke,

      /** Eşya pazarı: kullanım ve kötüye kullanım izi (docs/19 §13). */
      esyaPazari: await esyaPazariOlcusu(),

      /** Araştırma: büyük seçimlerin dağılımı ve yol bırakma (docs/20 §8). */
      arastirma: arastirmaOlcusu(lordlar),
    };
  });
}
