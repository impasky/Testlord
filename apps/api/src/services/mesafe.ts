/**
 * "Bu bölge bana ne kadar uzak?" — tek yerden.
 *
 * Mesafe artık malikâneden değil, oyuncunun EN YAKIN TOPRAĞINDAN ölçülüyor
 * (docs/11 §1.2 H1). Sekiz ayrı uç aynı soruyu soruyor; hesabı sekiz yere
 * kopyalamak, bir gün birinin unutulup haritanın kendi içinde tutarsız
 * olması demekti — bölge listesinde "2 hex" yazan yerin saldırı ekranında
 * "5 hex" çıkması.
 *
 * Ölçer bir kez kuruluyor ve istek boyunca kullanılıyor: lordun toprakları
 * bir istek içinde değişmiyor.
 */
import { yakinlikMesafesi, type HexCoord } from '@lordlar/shared';
import { prisma } from '../db.js';

export type Mesafeci = (hedef: HexCoord) => number;

type Istemci = Pick<typeof prisma, 'lord' | 'region'>;

export async function mesafeOlcer(lordId: string, tx: Istemci = prisma): Promise<Mesafeci> {
  const [lord, topraklar] = await Promise.all([
    tx.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { homeQ: true, homeR: true },
    }),
    tx.region.findMany({ where: { ownerLordId: lordId }, select: { q: true, r: true } }),
  ]);
  const ev = { q: lord.homeQ, r: lord.homeR };
  return (hedef) => yakinlikMesafesi(ev, topraklar, hedef);
}

/**
 * Ev ve topraklar zaten elde olduğunda sorgusuz kurulan ölçer.
 *
 * Harita listesi zaten TÜM bölgeleri çekiyor; oradan sahiplerine bakıp
 * ikinci bir sorgu açmak boşuna.
 */
export function mesafeOlcerHazir(ev: HexCoord, topraklar: readonly HexCoord[]): Mesafeci {
  return (hedef) => yakinlikMesafesi(ev, topraklar, hedef);
}
