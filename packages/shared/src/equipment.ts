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
import { azamiTier } from './bina.js';
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

/**
 * Bu kademe dövülebilir mi: İKİ kapı birden.
 *
 * Lord seviyesi kapısı duruyor; demirhane ikincisi. T5 hem 50. seviye
 * hem 4. seviye demirhane istiyor, 4. seviye demirhane de bir şehir —
 * "fethin karşılığı" cümlesi burada bir sayıya dönüşüyor (docs/12 §3.3).
 *
 * Demirhanesi olmayan lord T1 dövebiliyor. Kapatmak, öğreticinin ilk
 * ekipman adımını kampta çıkmaza sokardı — savaş raporunu haberci
 * kulesine kilitleyip okunamaz hâle getirdiğim hatanın aynısı.
 */
export function canCraftTier(
  lordLevel: number,
  tier: number,
  binalar?: Record<string, number>,
): boolean {
  return lordLevel >= tierUnlockLevel(tier) && tier <= azamiTier(binalar ?? {});
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
 * Figür resimken altı yuvayı ayrı ayrı gösteremiyordu (docs/08 İ13); o
 * yüzden tek bir sayıydı: lordun ne kadar güçlü GÖRÜNDÜĞÜ. Figür artık
 * parçaları ayrı giyiyor (`kusamKodu`, aşağıda); bu sayı rozetin adı ve
 * figürün genel görünüşü (sakal, irilik) için kalıyor.
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

/**
 * KUŞAM KODU — figür altı yuvayı artık AYRI AYRI giyiyor (docs/24).
 *
 * Yukarıdaki not "lord figürü altı yuvayı ayrı ayrı gösteremiyor" diyordu:
 * figürler resimdi ve her parçanın aynı gövdeye kayıtlı çizilmesi
 * gerekirdi. Figür artık koddan çiziliyor ve parçalar aynı gövdenin
 * üstüne kuruluyor; kod da hangi parçanın giyileceğini söylüyor: altı
 * yuvanın kademesi, `EQUIP_SLOTS` sırasıyla ("302010" = T3 kılıç, kalkan
 * yok, T2 zırh…). Boş yuva 0. `kusamSeviyesi` kalıyor: rozetin adı ve
 * figürün genel görünüşü (sakal, irilik) hâlâ ondan.
 */
export function kusamKodu(items: readonly { slot: string; tier: number }[]): string {
  return EQUIP_SLOTS.map((s) => {
    const t = items.find((i) => i.slot === s)?.tier ?? 0;
    return String(Math.max(0, Math.min(5, Math.floor(t))));
  }).join('');
}

/** Geçerli bir kuşam kodu: altı hane, her biri 0–5. */
export const KUSAM_KODU = /^[0-5]{6}$/;
