/**
 * ÜLKE SEÇİMİ (docs/27) — oyuncu bir ülke seçiyor, kampı orada kuruluyor.
 *
 * Ülke bir takım değil, bir BAŞLANGIÇ YERİ: herkes kendi adına oynuyor ve
 * aynı ülkeden iki lord birbirine saldırabiliyor. Seçimin etkisi iki tane:
 * kamp o ülkede kuruluyor ve o ülkenin her şehri lorda açık (başka
 * ülkelere sınırdan geçiliyor, shared `sinirdanMi`).
 *
 * Seçim BİR KEZ. Ülke değiştirmek, kampı bir gecede dünyanın öbür ucuna
 * taşıyıp sınır kuralını boşa çıkarmak olurdu.
 */
import { BASKENT_TURLERI, ULKELER } from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { GameError } from '../errors.js';

/**
 * Kampın yeri: ülkenin EN ZAYIF şehirlerinden en az kalabalık olanının yanı.
 *
 * İlk hedef kampın yanındaki şehir oluyor ("ilk saldırı dakikalar içinde
 * biter", docs/08 İ3); garnizonu en küçük olan şehir o sözü tutuyor.
 * Sıra: sahipsiz şehir, sonra en küçük garnizon, eşitlikte YERLEŞİM (köy,
 * şehir, kale), en son en az kamp. Önce kalabalığa bakılıyordu ve ülke
 * dolunca yeni oyuncular güçlü şehirlerin (68 birlik) yanında doğuyordu:
 * ilk hedefe başlangıç kaynağı yetmiyordu (`ilk-hedef-testi`). Yerleşim
 * tercihi öneriyle aynı kural (`onerilenHedef`): başkenti olmayan lorda
 * önce yerleşim öneriliyor, kamp da o yerleşimin yanında kurulunca ilk
 * hedef kampın kendi şehri oluyor. Başkent (taht) yalnız ülkenin tek
 * şehriyse seçiliyor — tek şehirli bir ülkede başka yer yok.
 *
 * Adaylar DÜNYANIN KENDİ bölgelerinden okunuyor, kanonik dosyadan değil
 * (docs/12 §14): dünya kendi haritasını taşıyor.
 */
export async function kampYeri(
  worldId: string,
  ulke: string,
  client: Tx = prisma,
): Promise<number> {
  const sehirler = await client.region.findMany({
    where: { worldId, province: ulke },
    select: { mapId: true, type: true, npcGarrison: true, ownerLordId: true },
    orderBy: { mapId: 'asc' },
  });
  if (sehirler.length === 0) throw new GameError('Bu ülke bu diyarda yok.', 400, 'ULKE_YOK');
  const adaylar = sehirler.some((s) => s.type !== 'taht')
    ? sehirler.filter((s) => s.type !== 'taht')
    : sehirler;

  const yukler = await client.lord.groupBy({
    by: ['homeBolgeId'],
    where: { worldId, homeBolgeId: { in: adaylar.map((a) => a.mapId) } },
    _count: { _all: true },
  });
  const yuk = new Map(yukler.map((y) => [y.homeBolgeId, y._count._all]));
  const guc = (g: unknown) =>
    Object.values((g ?? {}) as Record<string, number>).reduce((t, n) => t + (n ?? 0), 0);

  const anahtar = (a: (typeof adaylar)[number]): [number, number, number, number] => [
    a.ownerLordId ? 1 : 0,
    guc(a.npcGarrison),
    BASKENT_TURLERI.includes(a.type) ? 0 : 1,
    yuk.get(a.mapId) ?? 0,
  ];
  let enIyi = adaylar[0]!;
  for (const a of adaylar) {
    const [x, e] = [anahtar(a), anahtar(enIyi)];
    const i = x.findIndex((v, j) => v !== e[j]);
    if (i >= 0 && x[i]! < e[i]!) enIyi = a;
  }
  return enIyi.mapId;
}

/** Ülke kodu geçerli mi — değilse oyuncuya anlaşılır bir hata. */
export function ulkeDogrula(ulke: string): string {
  const kod = ulke.trim().toUpperCase();
  if (!ULKELER.has(kod)) throw new GameError('Böyle bir ülke yok.', 400, 'ULKE_YOK');
  return kod;
}

/**
 * Lordun ülkesini seçer ve kampını o ülkeye kurar.
 *
 * Bir kez: ülkesi olan lord yeniden seçemiyor. Toprak ve başkent olduğu
 * gibi kalıyor; yalnız kampın çıpası (`homeBolgeId`) taşınıyor.
 */
export async function ulkeSec(
  lordId: string,
  ulke: string,
  tx: Tx,
): Promise<{ ulke: string; homeBolgeId: number }> {
  const kod = ulkeDogrula(ulke);
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { worldId: true, ulke: true },
  });
  if (lord.ulke) {
    throw new GameError('Ülkeni zaten seçtin; seçim bir kez yapılıyor.', 400, 'ULKE_SECILDI');
  }
  const homeBolgeId = await kampYeri(lord.worldId, kod, tx);
  await tx.lord.update({ where: { id: lordId }, data: { ulke: kod, homeBolgeId } });
  return { ulke: kod, homeBolgeId };
}
