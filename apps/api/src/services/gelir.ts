/**
 * GARNİZON PAYI — bölge geliri artık sahibin değil, orada DURANIN
 * (docs/16 §6).
 *
 * Eski kural tek cümleydi: "bölge kimin ise geliri onun". Yeni kural da
 * tek cümle: "bölgede kimin askeri varsa, gelir onların — bıraktıkları
 * YER oranında". Aradaki fark oyunun türünü değiştiriyor: toprak artık
 * kâğıt üstünde tutulan bir şey değil, üstünde asker bulundurmayı
 * gerektiren bir şey. Ordusunu eve çeken lord bölgeyi kaybetmiyor ama
 * gelirini kaybediyor.
 *
 * FORMÜL BURADA DEĞİL. Bölüşüm `packages/shared/src/medeniyet.ts`
 * içindeki `garnizonPaylari`nda ve birim sınamaları orada. Burası
 * yalnız o formüle veriyi taşıyor: kimin nerede kaç yeri var.
 */
import { garnizonPaylari, type Army, type UnitType, UNIT_TYPES } from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';

/**
 * Lordun bir bölgeden aldığı payın, gelir hesabına giren hâli.
 *
 * `oran` dışındaki alanlar bölgenin kendi gelirini belirliyor;
 * `oran` o gelirin ne kadarının bu lorda düştüğünü.
 */
export interface GelirPayiGirdisi {
  /** Bölgenin veritabanı kimliği — arayüz payı bölgeyle eşlesin diye. */
  regionId: number;
  type: string;
  level: number;
  incomeMult: number;
  province: string;
  /** Bu lorda düşen pay (0-1). */
  oran: number;
  /** Bu lordun bölgedeki yeri — arayüzde "20/200 yer" diye gösterilecek. */
  yer: number;
  /** Bölgedeki toplam yer. */
  toplamYer: number;
}

function orduyaCevir(satirlar: { unitType: string; count: number }[]): Army {
  const ordu: Army = {};
  for (const s of satirlar) {
    const t = s.unitType as UnitType;
    if (!UNIT_TYPES.includes(t)) continue;
    ordu[t] = (ordu[t] ?? 0) + s.count;
  }
  return ordu;
}

/**
 * Bu lordun garnizon tuttuğu bölgelerdeki gelir payları.
 *
 * ÜÇ SORGU, bölge başına değil. Lordun garnizonları, o bölgelerin
 * satırları ve o bölgelerdeki BÜTÜN garnizonlar. Bölge başına sorgu
 * atan bir hâl, on bölgeli bir lordda her tick'te otuz sorgu demekti
 * ve `tickLord` her `/me` isteğinde koşuyor.
 *
 * RAKİP MEDENİYETİN TUTTUĞU BÖLGE SAYILMIYOR: orada duran asker gelir
 * toplamıyor, kuşatma altında duruyor. Bölgeyi hiçbir medeniyet
 * tutmuyorsa (çekişmeli orta) pay herkese açık — kavganın olacağı yer
 * zaten orası.
 */
export async function garnizonPayGirdileri(
  lordId: string,
  client: Tx = prisma,
): Promise<GelirPayiGirdisi[]> {
  const benimkiler = await client.armyUnit.findMany({
    where: { lordId, locationType: 'region' },
    select: { locationId: true, unitType: true, count: true },
  });
  if (benimkiler.length === 0) return [];

  const kimlikler = [
    ...new Set(benimkiler.map((u) => u.locationId).filter((x): x is string => !!x)),
  ];
  const sayilar = kimlikler.map(Number).filter((n) => Number.isFinite(n));
  if (sayilar.length === 0) return [];

  const [ben, bolgeler] = await Promise.all([
    client.lord.findUnique({ where: { id: lordId }, select: { medeniyetId: true } }),
    client.region.findMany({
      where: { id: { in: sayilar } },
      select: {
        id: true,
        type: true,
        level: true,
        incomeMult: true,
        province: true,
        ownerMedeniyetId: true,
      },
    }),
  ]);

  /**
   * Bu bölgede gelir PAYI ALABİLEN lord hangisi?
   *
   * Bölgeyi bir medeniyet tutuyorsa yalnız o medeniyetin üyeleri;
   * tutan yoksa (çekişmeli orta) orada duran herkes.
   */
  const payAlabilir = (bolgeMedeniyeti: string | null, lordMedeniyeti: string | null): boolean =>
    bolgeMedeniyeti === null || bolgeMedeniyeti === lordMedeniyeti;

  const gecerli = bolgeler.filter((b) => payAlabilir(b.ownerMedeniyetId, ben?.medeniyetId ?? null));
  if (gecerli.length === 0) return [];
  const gecerliKimlik = gecerli.map((b) => String(b.id));

  const tumGarnizonlar = await client.armyUnit.findMany({
    where: { locationType: 'region', locationId: { in: gecerliKimlik } },
    select: { lordId: true, locationId: true, unitType: true, count: true },
  });

  /*
   * PAYDA YALNIZ PAY ALABİLENLERDEN oluşuyor.
   *
   * İlk hâlde bölünme o bölgedeki BÜTÜN garnizonlara bakıyordu ve
   * uçtan uca sınama bunu hemen yakaladı: rakip medeniyetten bir lord
   * takviye gönderince sahibin payı yarıya düşüyor, takviye gönderen
   * de pay alamıyordu — gelirin yarısı hiç kimseye gitmeden yok
   * oluyordu. Kuşatan asker bölgenin gelirini seyreltmez; kuşatma
   * başka bir şey.
   */
  const garnizonLordlari = [...new Set(tumGarnizonlar.map((g) => g.lordId))];
  const medeniyetler = new Map(
    (
      await client.lord.findMany({
        where: { id: { in: garnizonLordlari } },
        select: { id: true, medeniyetId: true },
      })
    ).map((l) => [l.id, l.medeniyetId]),
  );

  // Bölge → lord → birim satırları
  const bolgeBasina = new Map<string, Map<string, { unitType: string; count: number }[]>>();
  for (const g of tumGarnizonlar) {
    if (!g.locationId) continue;
    const lordlar = bolgeBasina.get(g.locationId) ?? new Map();
    const satirlar = lordlar.get(g.lordId) ?? [];
    satirlar.push({ unitType: g.unitType, count: g.count });
    lordlar.set(g.lordId, satirlar);
    bolgeBasina.set(g.locationId, lordlar);
  }

  const sonuc: GelirPayiGirdisi[] = [];
  for (const b of gecerli) {
    const lordlar = bolgeBasina.get(String(b.id));
    if (!lordlar) continue;
    const paylar = garnizonPaylari(
      [...lordlar.entries()]
        .filter(([id]) => payAlabilir(b.ownerMedeniyetId, medeniyetler.get(id) ?? null))
        .map(([id, satirlar]) => ({ lordId: id, ordu: orduyaCevir(satirlar) })),
    );
    const benimPay = paylar.find((p) => p.lordId === lordId);
    if (!benimPay) continue;
    sonuc.push({
      regionId: b.id,
      type: b.type,
      level: b.level,
      incomeMult: b.incomeMult,
      province: b.province,
      oran: benimPay.oran,
      yer: benimPay.yer,
      toplamYer: paylar.reduce((s, p) => s + p.yer, 0),
    });
  }
  return sonuc;
}
