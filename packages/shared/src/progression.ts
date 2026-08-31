/** Lord seviyesi, XP, komuta kapasitesi, şöhret. */
import { B, GENERAL_SLOT_RULE, fameTypeMultiplier, unit } from './balance.js';
import type { Army, GeneralBonus, LordStats, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

/** Bir seviyeden diğerine geçmek için gereken XP. */
export function xpForLevel(level: number): number {
  if (level < 1 || level >= B.lord.max_seviye) return Infinity;
  return Math.round(B.lord.xp_katsayi * Math.pow(level, B.lord.xp_us));
}

/** Toplam XP'den seviye ve kalan XP hesaplar. */
export function levelFromTotalXp(totalXp: number): { level: number; xpIntoLevel: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < B.lord.max_seviye) {
    const need = xpForLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return { level, xpIntoLevel: level >= B.lord.max_seviye ? 0 : remaining };
}

/** Seviye atlarken kazanılan serbest stat puanı. */
export function statPointsForLevelUp(fromLevel: number, toLevel: number): number {
  return Math.max(0, toLevel - fromLevel) * B.lord.seviye_basina_stat_puani;
}

/** Komuta kapasitesi: kaç "yer"lik ordu taşınabilir. */
export function commandCapacity(liderlik: number, generalBonus?: GeneralBonus): number {
  return (
    B.komuta.taban + liderlik * B.komuta.liderlik_carpani + (generalBonus?.komutaKapasitesi ?? 0)
  );
}

/** Bir ordunun kapladığı yer. */
export function armySlots(army: Army): number {
  return UNIT_TYPES.reduce((sum, t) => sum + (army[t] ?? 0) * unit(t).yer, 0);
}

/** Aynı anda tutulabilecek bölge sayısı (Taht Kalesi hariç). */
export function maxRegions(lordLevel: number): number {
  return B.bolgeler.max_taban + Math.floor(lordLevel / B.bolgeler.max_seviye_bolen);
}

/** General slotu sayısı. */
export function generalSlots(liderlik: number): number {
  return Math.min(
    GENERAL_SLOT_RULE.max,
    1 + Math.floor(liderlik / GENERAL_SLOT_RULE.bolen),
  );
}

/** Ordu gücü — şöhret hesabında kullanılır. */
export function armyPower(army: Army): number {
  return UNIT_TYPES.reduce((sum, t) => {
    const u = unit(t);
    return sum + (army[t] ?? 0) * (u.saldiri + u.savunma + u.can / 4);
  }, 0);
}

export interface FameInput {
  lordLevel: number;
  regions: { type: string; level: number }[];
  totalEquipmentPower: number;
  army: Army;
  pvpWins: number;
  fortressFameAccrued: number;
  ownsThrone: boolean;
}

/** Şöhret: genel sıralamanın puanı. */
export function calculateFame(input: FameInput): number {
  const S = B.sohret;
  let fame = input.lordLevel * S.lord_seviye_carpani;
  for (const r of input.regions) {
    fame += S.bolge_taban * r.level * fameTypeMultiplier(r.type);
  }
  fame += input.totalEquipmentPower * S.ekipman_carpani;
  fame += armyPower(input.army) * S.ordu_carpani;
  fame += input.pvpWins * S.pvp_galibiyet;
  fame += input.fortressFameAccrued;
  if (input.ownsThrone) fame *= 1 + B.taht_kalesi.unvan_sohret_bonusu;
  return Math.round(fame);
}

/** Fetih sıralaması puanı. */
export function conquestScore(regions: { type: string; level: number }[]): number {
  return Math.round(
    regions.reduce((s, r) => s + r.level * fameTypeMultiplier(r.type) * 100, 0),
  );
}

/** PvP sonrası ELO. */
export function updateElo(myElo: number, oppElo: number, won: boolean): number {
  const k = B.siralamalar.kilic.elo_k;
  const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  return Math.round(myElo + k * ((won ? 1 : 0) - expected));
}

/** Savaştan kazanılan XP. */
export function battleXp(opponentLevel: number, won: boolean): number {
  return Math.round((won ? 80 : 20) * Math.max(1, opponentLevel));
}

export function captureXp(ringMultiplier: number): number {
  return Math.round(1500 * ringMultiplier);
}

export function npcClearXp(npcUnits: number): number {
  return Math.round(4 * npcUnits);
}

export function statTotal(stats: LordStats): number {
  return stats.guc + stats.dayaniklilik + stats.liderlik + stats.kurnazlik;
}

export function unitTypeOrThrow(value: string): UnitType {
  if (!UNIT_TYPES.includes(value as UnitType)) throw new Error(`Bilinmeyen birim: ${value}`);
  return value as UnitType;
}
