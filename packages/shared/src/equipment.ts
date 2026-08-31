/** Ekipman gücü, üretim, yükseltme. */
import {
  B,
  craftCost,
  craftRarityTable,
  rarityMultiplier,
  tierBasePower,
  tierUnlockLevel,
  upgradeSuccessChance,
} from './balance.js';
import type { EquippedItem, Rarity, Resources } from './types.js';
import type { Rng } from './rng.js';

/** ItemPower = tier tabanı × nadirlik × (1 + 0.08 × yükseltme) */
export function itemPower(item: Pick<EquippedItem, 'tier' | 'rarity' | 'upgradeLevel'>): number {
  return (
    tierBasePower(item.tier) *
    rarityMultiplier(item.rarity) *
    (1 + B.ekipman.yukseltme_basina_bonus * item.upgradeLevel)
  );
}

export function totalEquipmentPower(items: EquippedItem[]): number {
  return items.reduce((s, i) => s + itemPower(i), 0);
}

/** Lordun savaşa kattığı ham güç. */
export function lordContribution(guc: number, equippedItems: EquippedItem[]): number {
  return guc * 3 + totalEquipmentPower(equippedItems) * B.ekipman.ekipman_katsayi;
}

export function canCraftTier(lordLevel: number, tier: number): boolean {
  return lordLevel >= tierUnlockLevel(tier);
}

export function craftPrice(tier: number): { cost: Resources; durationSec: number } {
  const c = craftCost(tier);
  return {
    cost: { altin: c.altin, demir: c.demir, erzak: 0 },
    durationSec: c.sure_dk * 60,
  };
}

/** Üretim çekilişi — seed'li, yeniden üretilebilir. */
export function rollCraftRarity(tier: number, rng: Rng): Rarity {
  return rng.pick(craftRarityTable(tier));
}

/** +N -> +N+1 maliyeti. */
export function upgradeCost(tier: number, currentLevel: number): Resources {
  const tierMult = Math.pow(tier, 1.5);
  const growth = Math.pow(B.ekipman.yukseltme_us, currentLevel);
  return {
    altin: Math.round(B.ekipman.yukseltme_taban.altin * growth * tierMult),
    demir: Math.round(B.ekipman.yukseltme_taban.demir * growth * tierMult),
    erzak: 0,
  };
}

export function canUpgrade(currentLevel: number): boolean {
  return currentLevel < B.ekipman.max_yukseltme;
}

/**
 * Yükseltme denemesi. Başarısızlıkta SADECE malzeme gider —
 * eşya kırılmaz, seviye düşmez. (Tasarım kararı: docs/01 §2)
 */
export function rollUpgrade(currentLevel: number, rng: Rng): { success: boolean; chance: number } {
  const chance = upgradeSuccessChance(currentLevel);
  return { success: rng.next() < chance, chance };
}

/** Eşyanın satış değeri — güç başına sabit altın. */
export function sellValue(item: EquippedItem): number {
  return Math.round(itemPower(item) * 4);
}
