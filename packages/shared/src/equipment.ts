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
import { EQUIP_SLOTS } from './types.js';
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

/**
 * Lordun kuşam seviyesi: 1–5.
 *
 * ŞU AN ÇAĞIRAN YOK. Lord figürü sahneye kondu, oyuncu beğenmedi ve geri
 * alındı (docs/08 İ13). Bu fonksiyon ve testleri duruyor çünkü figür geri
 * gelirse gereken karar burada: hangi görselin gösterileceği. Silinip
 * yeniden yazılsa aynı tuzağa düşülür — aşağıdaki "boş yuvaları da say"
 * kuralı bariz değil.
 *
 * Lord figürü altı yuvayı ayrı ayrı gösteremiyor — bunun için her parçanın
 * aynı gövdeye kayıtlı çizilmiş olması gerekirdi (bkz. docs/08 İ13). Onun
 * yerine tek bir sayı: lordun ne kadar güçlü GÖRÜNDÜĞÜ. Beş görsel, beş
 * seviye.
 *
 * Ölçü, kuşanılan parçaların tier ORTALAMASI değil, boş yuvaları da sayan
 * ortalaması. Sebep: tek bir T5 kılıcı olan ama başka hiçbir şeyi olmayan
 * bir lord efsanevi görünmemeli. Altı yuvanın beşi boşsa ortalama düşük
 * kalıyor ve figür de öyle.
 *
 * Yuvarlama aşağı: seviye 4 görselini görmek için altı yuvanın toplamının
 * gerçekten oraya ulaşması gerekiyor. Yukarı yuvarlamak, tek parça takan
 * oyuncuyu bir üst kademede gösterirdi.
 */
export function kusamSeviyesi(items: Pick<EquippedItem, 'tier'>[]): number {
  const yuvaSayisi = EQUIP_SLOTS.length;
  const toplam = items.reduce((s, i) => s + i.tier, 0);
  return Math.min(5, Math.max(1, Math.floor(toplam / yuvaSayisi)));
}
