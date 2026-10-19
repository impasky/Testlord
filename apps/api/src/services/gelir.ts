/**
 * GARNİZON PAYI — bölge geliri orada DURANIN (docs/16 §6, docs/27).
 *
 * Kural tek cümle: "bölgede kimin askeri varsa, gelir onların —
 * bıraktıkları YER oranında". Toprak kâğıt üstünde tutulan bir şey değil,
 * üstünde asker bulundurmayı gerektiren bir şey. Ordusunu eve çeken lord
 * bölgeyi kaybetmiyor ama gelirini kaybediyor.
 *
 * PAY ALABİLEN: bölgenin SAHİBİ ve sahibin İTTİFAK üyeleri (takviye).
 * Herkes kendi adına oynuyor (docs/27); ittifak ortağının toprağına
 * asker gönderen o toprağın gelirine ortak oluyor, başkası olamıyor.
 *
 * FORMÜL BURADA DEĞİL: bölüşüm `packages/shared/src/garnizon.ts`.
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
 * DÖRT SORGU, bölge başına değil: lordun garnizonları, o bölgelerin
 * satırları, o bölgelerdeki BÜTÜN garnizonlar ve ilgili lordların
 * ittifakı. Bölge başına sorgu atan bir hâl, on bölgeli bir lordda her
 * tick'te otuz sorgu demekti ve `tickLord` her `/me` isteğinde koşuyor.
 *
 * BAŞKASININ TOPRAĞINDA DURAN ASKER GELİR TOPLAMIYOR (sahibin ittifak
 * üyesi değilse): orada kuşatma altında duruyor.
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

  const bolgeler = await client.region.findMany({
    where: { id: { in: sayilar } },
    select: {
      id: true,
      type: true,
      level: true,
      incomeMult: true,
      province: true,
      ownerLordId: true,
    },
  });

  const tumGarnizonlar = await client.armyUnit.findMany({
    where: { locationType: 'region', locationId: { in: bolgeler.map((b) => String(b.id)) } },
    select: { lordId: true, locationId: true, unitType: true, count: true },
  });

  /*
   * PAYDA YALNIZ PAY ALABİLENLERDEN oluşuyor: kuşatan asker bölgenin
   * gelirini seyreltmez. İlk hâlde bölünme BÜTÜN garnizonlara bakıyordu
   * ve gelirin bir kısmı hiç kimseye gitmeden yok oluyordu.
   */
  const ilgili = [
    ...new Set([
      ...tumGarnizonlar.map((g) => g.lordId),
      ...bolgeler.map((b) => b.ownerLordId).filter((x): x is string => !!x),
    ]),
  ];
  const ittifak = new Map(
    (
      await client.lord.findMany({
        where: { id: { in: ilgili } },
        select: { id: true, allianceId: true },
      })
    ).map((l) => [l.id, l.allianceId]),
  );
  /** Bu lord bu bölgeden pay alabilir mi: sahibi ya da sahibin ittifak üyesi. */
  const payAlabilir = (sahip: string | null, lordId: string): boolean => {
    if (sahip === null) return false;
    if (sahip === lordId) return true;
    const a = ittifak.get(sahip) ?? null;
    return a !== null && a === (ittifak.get(lordId) ?? null);
  };
  const gecerli = bolgeler.filter((b) => payAlabilir(b.ownerLordId, lordId));
  if (gecerli.length === 0) return [];

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
        .filter(([id]) => payAlabilir(b.ownerLordId, id))
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
