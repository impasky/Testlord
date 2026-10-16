/**
 * Elmas satın alma — doğrulama, verme, tüketme, iade (docs/25).
 *
 * ELMASIN VERİLDİĞİ TEK YER. Akış:
 *
 *   1. Uygulama Play'den satın alıyor ve jetonu sunucuya yolluyor.
 *   2. Sunucu Play'e soruyor: satın alındı mı, hangi hesaba bağlı,
 *      tüketilmiş mi. İstemcinin söylediği miktara hiç bakılmıyor —
 *      ürün kimliğinden `balance.json` paketine gidiliyor.
 *   3. Elmas ve `SatinAlma` satırı TEK işlemde yazılıyor; jeton tekil,
 *      aynı satın alma ikinci kez elmas vermiyor (aynı anda gelen iki
 *      istek de: veritabanı kısıtı).
 *   4. Ancak SONRA Play'de tüketiliyor (tüketme onayı da içeriyor). Önce
 *      tüketip sonra yazsaydık arada bir çökme parayı alıp elması
 *      vermemek olurdu; tersinde en kötü ihtimal tüketme gecikir ve
 *      worker tamamlar. Üç gün tüketilmeyen satın almayı Play iade ediyor.
 *
 * İade: worker Play'in iade listesini tarıyor; iade edilen satın almanın
 * elması geri alınıyor — harcanmışsa bakiye EKSİYE düşüyor.
 */
import { elmasPaketi } from '@lordlar/shared';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import {
  PlayHatasi,
  hesapEtiketi,
  iadeler,
  jetonIzi,
  playAyari,
  satinAlmaGetir,
  tuket,
} from './play.js';

export type DogrulamaSonucu =
  { durum: 'verildi' | 'zaten'; elmas: number; bakiye: number } | { durum: 'bekliyor' };

function benzersizIhlali(e: unknown): boolean {
  return (e as { code?: string }).code === 'P2002';
}

export async function satinAlmayiDogrula(
  lordId: string,
  urun: string,
  jeton: string,
): Promise<DogrulamaSonucu> {
  const paket = elmasPaketi(urun);
  if (!paket) throw new GameError('Böyle bir ürün yok.', 400, 'URUN_YOK');
  if (!playAyari()) {
    throw new GameError('Mağaza şu an kapalı.', 503, 'MAGAZA_KAPALI');
  }

  const onceki = await prisma.satinAlma.findUnique({ where: { jeton } });
  if (onceki) return dahaOnceIslenmis(onceki, lordId);

  let p;
  try {
    p = await satinAlmaGetir(urun, jeton);
  } catch (e) {
    if (e instanceof PlayHatasi && e.durum >= 400 && e.durum < 500) {
      // purchaseTokenMismatch, productNotOwnedByUser, geçersiz jeton…
      throw new GameError('Satın alma doğrulanamadı.', 400, 'GECERSIZ_SATIN_ALMA');
    }
    throw new GameError(
      'Google Play şu an cevap vermiyor; birazdan yeniden dene.',
      503,
      'PLAY_ULASILAMIYOR',
    );
  }

  if (p.purchaseState === 2) return { durum: 'bekliyor' };
  if (p.purchaseState !== 0) {
    throw new GameError('Bu satın alma iptal edilmiş.', 400, 'SATIN_ALMA_IPTAL');
  }
  // Uygulama her satın almaya lordun etiketini koyuyor. Başka bir
  // hesabın etiketiyle gelen jeton başkasının satın alması.
  if (p.obfuscatedExternalAccountId && p.obfuscatedExternalAccountId !== hesapEtiketi(lordId)) {
    throw new GameError('Bu satın alma başka bir hesaba ait.', 403, 'BASKA_HESAP');
  }
  // Tüketme yalnız elmas yazıldıktan SONRA yapılıyor: kaydı olmayan
  // tüketilmiş bir satın alma bizim tükettiğimiz bir şey değil.
  if (p.consumptionState === 1) {
    throw new GameError('Bu satın alma zaten kullanılmış.', 400, 'TUKETILMIS');
  }

  let bakiye: number;
  try {
    bakiye = await prisma.$transaction(async (tx) => {
      await tx.satinAlma.create({
        data: {
          lordId,
          jeton,
          siparisNo: p.orderId ?? null,
          urun,
          elmas: paket.toplam,
          test: p.purchaseType === 0,
        },
      });
      const l = await tx.lord.update({
        where: { id: lordId },
        data: { elmas: { increment: paket.toplam } },
        select: { elmas: true },
      });
      return l.elmas;
    });
  } catch (e) {
    if (!benzersizIhlali(e)) throw e;
    // Aynı jeton aynı anda iki istekle geldi; ötekisi yazdı.
    const yazan = await prisma.satinAlma.findUniqueOrThrow({ where: { jeton } });
    return dahaOnceIslenmis(yazan, lordId);
  }

  await tuketmeyiDene(urun, jeton);
  return { durum: 'verildi', elmas: paket.toplam, bakiye };
}

async function dahaOnceIslenmis(
  s: {
    lordId: string;
    elmas: number;
    urun: string;
    jeton: string;
    tuketildi: boolean;
    durum: string;
  },
  lordId: string,
): Promise<DogrulamaSonucu> {
  if (s.lordId !== lordId) {
    throw new GameError('Bu satın alma başka bir hesaba ait.', 409, 'BASKA_HESAP');
  }
  if (s.durum === 'iade') {
    throw new GameError('Bu satın alma iade edilmiş.', 400, 'SATIN_ALMA_IPTAL');
  }
  if (!s.tuketildi) await tuketmeyiDene(s.urun, s.jeton);
  const l = await prisma.lord.findUniqueOrThrow({ where: { id: lordId }, select: { elmas: true } });
  return { durum: 'zaten', elmas: s.elmas, bakiye: l.elmas };
}

/** Play'de tüketir; başarısızsa worker sonra yeniden dener. */
async function tuketmeyiDene(urun: string, jeton: string): Promise<boolean> {
  try {
    await tuket(urun, jeton);
    await prisma.satinAlma.updateMany({ where: { jeton }, data: { tuketildi: true } });
    return true;
  } catch (e) {
    console.error(`Play tüketme başarısız (${jetonIzi(jeton)}):`, (e as Error).message);
    return false;
  }
}

/** Worker: elması verilmiş ama Play'de tüketilememiş satın almalar. */
export async function tuketilmeyenleriTuket(simdi = new Date()): Promise<number> {
  if (!playAyari()) return 0;
  const bekleyen = await prisma.satinAlma.findMany({
    where: {
      tuketildi: false,
      durum: 'verildi',
      createdAt: { lte: new Date(simdi.getTime() - 60_000) },
    },
    select: { urun: true, jeton: true },
    take: 50,
  });
  let n = 0;
  for (const s of bekleyen) if (await tuketmeyiDene(s.urun, s.jeton)) n++;
  return n;
}

/**
 * Worker: Play'in iade listesindeki satın almaların elmasını geri al.
 *
 * Son 7 gün taranıyor (Play 30 günü veriyor); işlem durum alanıyla
 * koşullu, aynı iade iki kez düşülmüyor.
 */
export async function iadeleriIsle(simdi = new Date()): Promise<number> {
  if (!playAyari()) return 0;
  const liste = await iadeler(new Date(simdi.getTime() - 7 * 86_400_000));
  let n = 0;
  for (const i of liste) {
    const s = await prisma.satinAlma.findUnique({
      where: { jeton: i.purchaseToken },
      select: { id: true, lordId: true, elmas: true, durum: true },
    });
    if (!s || s.durum !== 'verildi') continue;
    const dustu = await prisma.$transaction(async (tx) => {
      const k = await tx.satinAlma.updateMany({
        where: { id: s.id, durum: 'verildi' },
        data: { durum: 'iade', iadeAt: simdi },
      });
      if (k.count === 0) return false;
      await tx.lord.update({ where: { id: s.lordId }, data: { elmas: { decrement: s.elmas } } });
      return true;
    });
    if (dustu) n++;
  }
  return n;
}
