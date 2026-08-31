/**
 * General pasiflerini ve yeteneklerini tek bir bonus nesnesine toplar.
 *
 * Tamamen veri güdümlü: generals.json'daki `pasif.etki` alanı hangi bonusa
 * yazılacağını belirler. Yeni bir etki eklemek = switch'e bir satır.
 */
import { GENERAL_LEVEL, generalDef } from './balance.js';
import type { GeneralBonus } from './types.js';
import { bosGeneralBonus } from './types.js';

export interface EquippedGeneral {
  key: string;
  level: number;
}

/** Seviye çarpanı: her seviye pasifi %2 güçlendirir (Lv20 -> ×1.38). */
export function generalLevelMultiplier(level: number): number {
  return 1 + 0.02 * Math.max(0, level - 1);
}

export function generalXpForLevel(level: number): number {
  if (level >= GENERAL_LEVEL.max) return Infinity;
  return Math.round(GENERAL_LEVEL.xp_katsayi * Math.pow(level, GENERAL_LEVEL.xp_us));
}

export function generalLevelFromXp(totalXp: number): { level: number; xpIntoLevel: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < GENERAL_LEVEL.max) {
    const need = generalXpForLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return { level, xpIntoLevel: level >= GENERAL_LEVEL.max ? 0 : remaining };
}

/** Sahadaki generallerin toplam etkisi. */
export function aggregateGeneralBonus(equipped: EquippedGeneral[]): GeneralBonus {
  const b = bosGeneralBonus();

  for (const g of equipped) {
    const def = generalDef(g.key);
    if (!def) continue;
    const mult = generalLevelMultiplier(g.level);
    const v = def.pasif.deger * mult;

    switch (def.pasif.etki) {
      case 'ordu_saldiri':
        b.orduSaldiri += v;
        break;
      case 'ordu_savunma':
        b.orduSavunma += v;
        break;
      case 'ordu_can':
        b.orduCan += v;
        break;
      case 'savunmada_ordu_savunma':
        b.savunmadaOrduSavunma += v;
        break;
      case 'okcu_saldiri':
        b.birimSaldiri.okcu = (b.birimSaldiri.okcu ?? 0) + v;
        break;
      case 'kusatma_saldiri':
        b.birimSaldiri.kusatma = (b.birimSaldiri.kusatma ?? 0) + v;
        break;
      case 'mizrakci_savunma':
        b.birimSavunma.mizrakci = (b.birimSavunma.mizrakci ?? 0) + v;
        break;
      case 'lord_savas_katkisi':
        b.lordSavasKatkisi += v;
        break;
      case 'yagma':
        b.yagma += v;
        break;
      case 'bolge_geliri':
        b.bolgeGeliri += v;
        break;
      case 'ordu_bakim_maliyeti':
        b.bakimMaliyeti += v;
        break;
      case 'yuruyus_suresi':
        b.yuruyusSuresi += v;
        break;
      case 'kayip_geri_donus':
        b.kayipGeriDonus += v;
        break;
    }

    // Yeteneklerin mekanik karşılıkları
    const ek = def.ek_etki as Record<string, number | boolean> | undefined;
    if (ek) {
      if (typeof ek.komuta_kapasitesi === 'number') b.komutaKapasitesi += ek.komuta_kapasitesi;
      if (typeof ek.kale_delme === 'number') b.kaleDelme += ek.kale_delme;
    }
  }

  return b;
}

/** Bir generalin belirli bir ek etkisi var mı? */
export function hasAbility(equipped: EquippedGeneral[], ability: string): boolean {
  return equipped.some((g) => {
    const ek = generalDef(g.key)?.ek_etki as Record<string, unknown> | undefined;
    return ek ? ek[ability] === true || typeof ek[ability] === 'number' : false;
  });
}

export function abilityValue(equipped: EquippedGeneral[], ability: string): number {
  let total = 0;
  for (const g of equipped) {
    const ek = generalDef(g.key)?.ek_etki as Record<string, unknown> | undefined;
    const v = ek?.[ability];
    if (typeof v === 'number') total += v;
  }
  return total;
}
