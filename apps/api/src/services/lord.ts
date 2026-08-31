/**
 * Lord durumunun yüklenmesi ve "lazy accrual" tick'i.
 *
 * Sunucu periyodik gelir tick'i çalıştırmaz. Lorda her dokunuşta
 * lastTickAt'ten bu yana geçen sürenin üretimi uygulanır. (docs/02 §1)
 */
import {
  GEAR_LINES,
  UNIT_TYPES,
  accrue,
  aggregateGeneralBonus,
  applyDesertion,
  armyPower,
  armySlots,
  bosGeneralBonus,
  calculateFame,
  commandCapacity,
  generalSlots,
  statPointsForLevelUp,
  xpForLevel,
  lordContribution,
  malikaneIncome,
  maxRegions,
  regionIncome,
  storageCapacity,
  totalEquipmentPower,
  upkeepPerHour,
  hasAbility,
  type Army,
  type EquipSlot,
  type EquippedGeneral,
  type EquippedItem,
  type GearLineKey,
  type GeneralBonus,
  type Rarity,
  type Resources,
  type UnitType,
} from '@lordlar/shared';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { B } from '@lordlar/shared';

const MAX_LORD_LEVEL = B.lord.max_seviye;
import { hata } from '../errors.js';

export interface LordState {
  id: string;
  worldId: string;
  name: string;
  level: number;
  xp: number;
  xpForNext: number;
  stats: { guc: number; dayaniklilik: number; liderlik: number; kurnazlik: number };
  statPoints: number;
  resources: Resources;
  storageCapacity: number;
  hourlyIncome: Resources;
  upkeepPerHour: number;
  netErzakPerHour: number;
  starving: boolean;
  fame: number;
  elo: number;
  pvpWins: number;
  pvpLosses: number;
  homeArmy: Army;
  commandCapacity: number;
  usedSlots: number;
  maxRegions: number;
  regionCount: number;
  ownsThrone: boolean;
  generalSlots: number;
  generalBonus: GeneralBonus;
  equippedItems: EquippedItem[];
  equipmentPower: number;
  lordContribution: number;
  gearLines: Record<GearLineKey, number>;
  gearBonus: { saldiri: number; savunma: number; can: number };
  woundedUntil: Date | null;
  protectionUntil: Date | null;
  dailyAttacks: number;
}

type LordWithRelations = Prisma.LordGetPayload<{
  include: { regions: true; units: true; items: true; gearLines: true; generals: true };
}>;

const lordInclude = {
  regions: true,
  units: true,
  items: true,
  gearLines: true,
  generals: true,
} as const;

/** Bir lordun tüm birimlerini (ev + garnizon + yürüyüş) tek orduya toplar. */
function collectAllUnits(units: { unitType: string; count: number }[]): Army {
  const army: Army = {};
  for (const u of units) {
    const t = u.unitType as UnitType;
    if (!UNIT_TYPES.includes(t)) continue;
    army[t] = (army[t] ?? 0) + u.count;
  }
  return army;
}

function collectUnitsAt(
  units: { unitType: string; count: number; locationType: string; locationId: string | null }[],
  locationType: string,
  locationId: string | null = null,
): Army {
  return collectAllUnits(
    units.filter((u) => u.locationType === locationType && u.locationId === locationId),
  );
}

export function equippedGenerals(
  generals: { generalKey: string; level: number; slotIndex: number | null; restUntil: Date | null }[],
  now: Date,
): EquippedGeneral[] {
  return generals
    .filter((g) => g.slotIndex !== null && (!g.restUntil || g.restUntil <= now))
    .map((g) => ({ key: g.generalKey, level: g.level }));
}

export function gearBonusFrom(
  lines: { line: string; level: number }[],
): { saldiri: number; savunma: number; can: number } {
  const map = new Map(lines.map((l) => [l.line, l.level]));
  const per = 0.03;
  return {
    saldiri: (map.get('silahlik') ?? 0) * per,
    savunma: (map.get('zirhhane') ?? 0) * per,
    can: (map.get('nalbant') ?? 0) * per,
  };
}

/**
 * Lordun saatlik brüt geliri: malikâne + sahip olunan bölgeler.
 * Bölgelerin kendi depoları ayrı işler (yağmalanabilir kısım orada birikir).
 */
export function calcHourlyIncome(
  level: number,
  regions: { type: string; level: number; incomeMult: number }[],
  bonus: GeneralBonus,
): { income: Resources; famePerHour: number } {
  const income = malikaneIncome(level);
  let famePerHour = 0;
  for (const r of regions) {
    const ri = regionIncome(r.type, r.level, r.incomeMult, bonus);
    income.altin += ri.altin;
    income.demir += ri.demir;
    income.erzak += ri.erzak;
    famePerHour += ri.sohret;
  }
  return { income, famePerHour };
}

/**
 * Lorda tick uygular ve tam durumunu döner.
 * Aynı transaction içinde çağrılabilir; çağrılmazsa kendi transaction'ını açar.
 */
export async function tickLord(lordId: string, now = new Date(), tx?: Tx): Promise<LordState> {
  const client = tx ?? prisma;
  const lord = (await client.lord.findUnique({
    where: { id: lordId },
    include: lordInclude,
  })) as LordWithRelations | null;
  if (!lord) throw hata.bulunamadi('Lord');

  const generals = equippedGenerals(lord.generals, now);
  const bonus = generals.length > 0 ? aggregateGeneralBonus(generals) : bosGeneralBonus();

  const { income, famePerHour } = calcHourlyIncome(
    lord.level,
    lord.regions.map((r) => ({ type: r.type, level: r.level, incomeMult: r.incomeMult })),
    bonus,
  );

  // Bakım: tüm birimler. Meryem yürüyüştekini, Sarya garnizondakini muaf tutar.
  const marchExempt = hasAbility(generals, 'yuruyusteki_ordu_bakimsiz');
  const garrisonExempt = hasAbility(generals, 'garnizon_bakimsiz');
  const payingUnits = lord.units.filter((u) => {
    if (marchExempt && u.locationType === 'march') return false;
    if (garrisonExempt && u.locationType === 'region') return false;
    return true;
  });
  const upkeep = upkeepPerHour(collectAllUnits(payingUnits), bonus);

  const result = accrue({
    current: { altin: lord.altin, demir: lord.demir, erzak: lord.erzak },
    lordLevel: lord.level,
    hourlyIncome: income,
    upkeepPerHour: upkeep,
    lastTickAt: lord.lastTickAt,
    now,
  });

  const accruedFame = Math.floor(lord.fortressFameAccrued + famePerHour * result.hoursElapsed);

  // Açlık firarı: sadece evdeki ve garnizondaki birimler kaçar, yürüyüştekiler değil.
  if (result.desertionRate > 0) {
    for (const u of lord.units) {
      if (u.locationType === 'march') continue;
      const after = applyDesertion({ [u.unitType as UnitType]: u.count }, result.desertionRate);
      const remaining = after[u.unitType as UnitType] ?? 0;
      if (remaining !== u.count) {
        await client.armyUnit.update({ where: { id: u.id }, data: { count: remaining } });
        u.count = remaining;
      }
    }
  }

  const items = lord.items
    .filter((i) => i.equipped)
    .map((i) => ({
      slot: i.slot as EquipSlot,
      tier: i.tier,
      rarity: i.rarity as Rarity,
      upgradeLevel: i.upgradeLevel,
    }));

  const homeArmy = collectUnitsAt(lord.units, 'home');
  const allUnits = collectAllUnits(lord.units);
  const ownsThrone = lord.regions.some((r) => r.type === 'taht');

  const fame = calculateFame({
    lordLevel: lord.level,
    regions: lord.regions.map((r) => ({ type: r.type, level: r.level })),
    totalEquipmentPower: totalEquipmentPower(items),
    army: allUnits,
    pvpWins: lord.pvpWins,
    fortressFameAccrued: accruedFame,
    ownsThrone,
  });

  // Günlük saldırı sayacını sıfırla
  const dailyReset = now.getTime() - lord.dailyResetAt.getTime() >= 86_400_000;

  await client.lord.update({
    where: { id: lordId },
    data: {
      altin: result.resources.altin,
      demir: result.resources.demir,
      erzak: result.resources.erzak,
      fortressFameAccrued: accruedFame,
      fame,
      lastTickAt: now,
      ...(dailyReset ? { dailyAttacks: 0, dailyResetAt: now } : {}),
    },
  });

  const gearBonus = gearBonusFrom(lord.gearLines);
  const gearLevels = Object.fromEntries(
    GEAR_LINES.map((l) => [l, lord.gearLines.find((g) => g.line === l)?.level ?? 0]),
  ) as Record<GearLineKey, number>;

  return {
    id: lord.id,
    worldId: lord.worldId,
    name: lord.name,
    level: lord.level,
    xp: lord.xp,
    xpForNext: xpForLevel(lord.level),
    stats: {
      guc: lord.guc,
      dayaniklilik: lord.dayaniklilik,
      liderlik: lord.liderlik,
      kurnazlik: lord.kurnazlik,
    },
    statPoints: lord.statPoints,
    resources: result.resources,
    storageCapacity: storageCapacity(lord.level),
    hourlyIncome: income,
    upkeepPerHour: upkeep,
    netErzakPerHour: income.erzak - upkeep,
    starving: result.starving,
    fame,
    elo: lord.elo,
    pvpWins: lord.pvpWins,
    pvpLosses: lord.pvpLosses,
    homeArmy,
    commandCapacity: commandCapacity(lord.liderlik, bonus),
    usedSlots: armySlots(allUnits),
    maxRegions: maxRegions(lord.level),
    regionCount: lord.regions.filter((r) => r.type !== 'taht').length,
    ownsThrone,
    generalSlots: generalSlots(lord.liderlik),
    generalBonus: bonus,
    equippedItems: items,
    equipmentPower: totalEquipmentPower(items),
    lordContribution: lordContribution(lord.guc, items),
    gearLines: gearLevels,
    gearBonus,
    woundedUntil: lord.woundedUntil,
    protectionUntil: lord.protectionUntil,
    dailyAttacks: dailyReset ? 0 : lord.dailyAttacks,
  };
}

/** Oturum sahibinin bu dünyadaki lordunu bulur. */
export async function findLordByUser(userId: string): Promise<string> {
  const lord = await prisma.lord.findFirst({ where: { userId }, select: { id: true } });
  if (!lord) throw hata.bulunamadi('Lord');
  return lord.id;
}

export { armyPower, collectAllUnits, collectUnitsAt };

/**
 * XP verir ve gereken kadar seviye atlatır.
 * `xp` alanı MEVCUT SEVİYEDEKİ ilerlemedir, toplam XP değil.
 */
export async function grantXp(
  lordId: string,
  amount: number,
  tx?: Tx,
): Promise<{ level: number; leveledUp: number }> {
  const client = tx ?? prisma;
  const lord = await client.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { level: true, xp: true, statPoints: true },
  });

  let level = lord.level;
  let xp = lord.xp + Math.max(0, Math.round(amount));
  let gainedLevels = 0;

  while (level < MAX_LORD_LEVEL) {
    const need = xpForLevel(level);
    if (xp < need) break;
    xp -= need;
    level++;
    gainedLevels++;
  }
  if (level >= MAX_LORD_LEVEL) xp = 0;

  await client.lord.update({
    where: { id: lordId },
    data: {
      level,
      xp,
      statPoints: lord.statPoints + statPointsForLevelUp(lord.level, level),
    },
  });

  return { level, leveledUp: gainedLevels };
}

/** Oyuncuya gösterilecek olay kaydı. */
export async function pushEvent(
  lordId: string,
  kind: string,
  payload: Record<string, unknown>,
  tx?: Tx,
): Promise<void> {
  const client = tx ?? prisma;
  await client.event.create({ data: { lordId, kind, payload: payload as object } });
}
