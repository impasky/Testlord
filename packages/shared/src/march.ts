/** Harita mesafesi ve yürüyüş süresi. */
import { B, unit } from './balance.js';
import type { Army, GeneralBonus } from './types.js';
import { UNIT_TYPES } from './types.js';

export interface HexCoord {
  q: number;
  r: number;
}

/** İki altıgen arasındaki mesafe (aksiyel koordinat). */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Ordunun en yavaş biriminin hızı — yürüyüşü o belirler. */
export function slowestSpeed(army: Army): number {
  let slowest = Infinity;
  for (const t of UNIT_TYPES) {
    if ((army[t] ?? 0) > 0) slowest = Math.min(slowest, unit(t).hiz);
  }
  return Number.isFinite(slowest) ? slowest : B.yuruyus.hiz_referansi;
}

/**
 * Yürüyüş süresi (saniye).
 * Sadece süvari = hızlı baskın; mancınık katarsan ordu ağırlaşır.
 */
export function marchDurationSec(
  distance: number,
  army: Army,
  generalBonus?: GeneralBonus,
): number {
  const speed = slowestSpeed(army);
  const raw = distance * B.yuruyus.dakika_hex_basina * (B.yuruyus.hiz_referansi / speed);
  const withBonus = raw * (1 + (generalBonus?.yuruyusSuresi ?? 0));
  const clamped = Math.min(B.yuruyus.max_dakika, Math.max(B.yuruyus.min_dakika, withBonus));
  return Math.round(clamped * 60);
}

/** Yürüyüş geri çağrılabilir mi? İlk %25 içindeyse evet. */
export function canRecallMarch(departAt: Date, arriveAt: Date, now: Date): boolean {
  const total = arriveAt.getTime() - departAt.getTime();
  if (total <= 0) return false;
  const elapsed = now.getTime() - departAt.getTime();
  return elapsed >= 0 && elapsed / total <= 0.25;
}
