/** Lord seviyesi, XP, komuta kapasitesi, şöhret. */
import { B, GENERAL_SLOT_RULE, fameTypeMultiplier, unit } from './balance.js';
import { generalSlotuEki } from './bina.js';
import type { ArastirmaBonusu } from './arastirma.js';
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
export function commandCapacity(
  liderlik: number,
  generalBonus?: GeneralBonus,
  arastirma?: ArastirmaBonusu,
): number {
  return (
    B.komuta.taban +
    liderlik * B.komuta.liderlik_carpani +
    (generalBonus?.komutaKapasitesi ?? 0) +
    (arastirma?.komutaKapasitesi ?? 0)
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

/**
 * General slotu sayısı: liderlik + KARARGÂH.
 *
 * Liderlik tavanı (`slot_kurali.max`) duruyor ve karargâh onun ÜSTÜNE
 * ekliyor — karargâhsız lord Y4 öncesiyle aynı slot sayısını görüyor.
 * Statı yükselterek açılan slot bir puan harcamasının, karargâhla açılan
 * ise bir fethin karşılığı; ikisi ayrı yoldan geldiği için üst üste
 * binmeleri sorun değil, amaç.
 */
export function generalSlots(liderlik: number, binalar?: Record<string, number>): number {
  const stattan = Math.min(
    GENERAL_SLOT_RULE.max,
    1 + Math.floor(liderlik / GENERAL_SLOT_RULE.bolen),
  );
  return stattan + generalSlotuEki(binalar ?? {});
}

/**
 * Oyunda mümkün olan EN YÜKSEK general slotu sayısı.
 *
 * Uç doğrulaması ve dizilim ızgarası bunu okuyor. Eskiden `max(0).max(2)`
 * diye elle yazılıydı; karargâh geldiğinde slot 5'e çıktı ama doğrulama
 * 2'de kaldığı için sunucu kendi verdiği slotu reddediyordu.
 */
export function azamiGeneralSlotu(): number {
  const tablo = (B.binalar.etkiler as unknown as Record<string, number[]>)
    .karargah_general_slotu_ek;
  return GENERAL_SLOT_RULE.max + Math.max(...(tablo ?? [0]));
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
  /**
   * Tahtı tutan medeniyet BENİM medeniyetim mi (docs/16 §13 soru 5).
   *
   * ZORUNLU alan ve bilerek: şöhret beş ayrı yerde hesaplanıyor (tick,
   * iki fetih önizlemesi, ekipman önizlemesi, demo tohumu) ve isteğe
   * bağlı bir alan bunların birinde sessizce `false` kalırdı — önizleme
   * ile gerçeğin ayrışması bu projenin en çok tekrarlayan hatası. Alan
   * zorunlu olunca derleyici çağıranların hepsini tek tek gösteriyor.
   */
  medeniyetTahti: boolean;
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
  /*
   * İKİ ÇARPAN ÜST ÜSTE BİNEBİLİR ve binmesi doğru: tahtı bizzat tutan
   * lord hem "Diyarın Lordu" hem de tahtı tutan medeniyetin üyesidir.
   * Şahsi unvan büyük (%20), medeniyetinki küçük (%5) — biri bir kişiye,
   * öbürü binlerce kişiye işliyor.
   */
  if (input.ownsThrone) fame *= 1 + B.taht_kalesi.unvan_sohret_bonusu;
  if (input.medeniyetTahti) fame *= 1 + B.taht_kalesi.medeniyet_sohret_bonusu;
  return Math.round(fame);
}

/** Fetih sıralaması puanı. */
export function conquestScore(regions: { type: string; level: number }[]): number {
  return Math.round(regions.reduce((s, r) => s + r.level * fameTypeMultiplier(r.type) * 100, 0));
}

/** PvP sonrası ELO. */
export function updateElo(myElo: number, oppElo: number, won: boolean): number {
  const k = B.siralamalar.kilic.elo_k;
  const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  return Math.round(myElo + k * ((won ? 1 : 0) - expected));
}

/** Savaştan kazanılan XP. */
export function battleXp(opponentLevel: number, won: boolean): number {
  const o = B.lord.xp_odulleri;
  return Math.round((won ? o.savas_galibiyet : o.savas_maglubiyet) * Math.max(1, opponentLevel));
}

/**
 * Bölge fethinden kazanılan XP.
 *
 * TABAN 1500'DEN 250'YE İNDİ. Ölçüldü: tek bölge fethi lordu 1.
 * seviyeden 4.'ye çıkarıyordu (+15 nitelik puanı). Sebep basit — seviye
 * 1→2 eşiği 120, fetih ise 1500 veriyordu: eşiğin 12,5 katı. Öğretici
 * oyuncuyu ilk fethe götürdüğü için HERKES oyunun ilk dakikasında üç
 * seviye atlıyordu ve seviye atlamak hiçbir şey ifade etmiyordu.
 *
 * Bilinen sınır: ödül `incomeMult` ile ölçekleniyor ama seviye eşiği
 * n^1.55 ile büyüyor, yani fetih XP'si oyun ilerledikçe önemsizleşiyor.
 * Bu ayrı bir mesele ve oyuncunun şikâyeti değildi; gerçek oyuncu
 * verisi olmadan eğriyi yeniden şekillendirmek yine tahmin olurdu.
 */
export function captureXp(ringMultiplier: number): number {
  return Math.round(B.lord.xp_odulleri.fetih_taban * ringMultiplier);
}

export function npcClearXp(npcUnits: number): number {
  return Math.round(B.lord.xp_odulleri.npc_birim_basina * npcUnits);
}

export function statTotal(stats: LordStats): number {
  return stats.guc + stats.dayaniklilik + stats.liderlik + stats.kurnazlik;
}

export function unitTypeOrThrow(value: string): UnitType {
  if (!UNIT_TYPES.includes(value as UnitType)) throw new Error(`Bilinmeyen birim: ${value}`);
  return value as UnitType;
}
