/**
 * "Bu bölge bana ne kadar uzak?" — tek yerden.
 *
 * Mesafe artık malikâneden değil, oyuncunun EN YAKIN TOPRAĞINDAN ölçülüyor
 * (docs/11 §1.2 H1). Sekiz ayrı uç aynı soruyu soruyor; hesabı sekiz yere
 * kopyalamak, bir gün birinin unutulup haritanın kendi içinde tutarsız
 * olması demekti — bölge listesinde "2 adım" yazan yerin saldırı ekranında
 * "5 adım" çıkması.
 *
 * Ölçer bir kez kuruluyor ve istek boyunca kullanılıyor: lordun toprakları
 * bir istek içinde değişmiyor.
 */
import { yakinlikMesafesi } from '@lordlar/shared';
import { prisma } from '../db.js';

/**
 * Ölçer artık bölge KİMLİĞİ alıyor, koordinat değil: altıgen ızgara
 * kalktı ve mesafe komşuluk grafiğinde en kısa yol (docs/12 §1).
 * Kimlik, kanonik haritadaki `mapId` — veritabanı satır numarası değil.
 */
export type Mesafeci = (hedefMapId: number) => number;

type Istemci = Pick<typeof prisma, 'lord' | 'region'>;

export async function mesafeOlcer(lordId: string, tx: Istemci = prisma): Promise<Mesafeci> {
  const [lord, topraklar] = await Promise.all([
    tx.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { homeBolgeId: true },
    }),
    tx.region.findMany({ where: { ownerLordId: lordId }, select: { mapId: true } }),
  ]);
  const topraklarim = topraklar.map((t) => t.mapId);
  return (hedef) => yakinlikMesafesi(lord.homeBolgeId, topraklarim, hedef);
}

/**
 * Ev ve topraklar zaten elde olduğunda sorgusuz kurulan ölçer.
 *
 * Harita listesi zaten TÜM bölgeleri çekiyor; oradan sahiplerine bakıp
 * ikinci bir sorgu açmak boşuna.
 */
export function mesafeOlcerHazir(evMapId: number, topraklar: readonly number[]): Mesafeci {
  return (hedef) => yakinlikMesafesi(evMapId, topraklar, hedef);
}
