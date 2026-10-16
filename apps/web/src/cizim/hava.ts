/**
 * Hava (docs/24 "Hava") — yalnız görsel, ara sıra.
 *
 * Şehir'in üstünde zaman zaman hafif yağmur, sis ya da (kışın) kar.
 * Hiçbir oyun kuralı havaya bağlı değil: yağmur hasadı yavaşlatmıyor,
 * sis görüşü kısmıyor. Oyunu "yaşıyor" gösteren bir ayrıntı, karar
 * aldıran bir sistem değil.
 *
 * Hava ÜÇ SAATLİK dilimlerle ve dilimin numarasıyla tohumlu: aynı anda
 * oyunu açan herkes aynı havayı görüyor ("bizde yağmur var" dendiğinde
 * ötekinde de var) ve hava sayfa yenilenince zıplamıyor. Çoğu dilim açık;
 * yağışlı hava bir istisna olarak kalmalı, yoksa şehir hep gri görünür.
 *
 * Çizim yeniden yapılmıyor: hava sahnenin üstünde bir CSS katmanı
 * (`HavaKatmani`), yani ne GPU işi ne önbellek kaydı ekliyor.
 */
import { rastgele } from './rastgele';

export type Hava = 'acik' | 'yagmur' | 'sis' | 'kar';
export const HAVALAR: readonly Hava[] = ['acik', 'yagmur', 'sis', 'kar'];

/** Bir dilimin süresi. */
export const HAVA_DILIMI_SAAT = 3;

/**
 * Yağışlı havanın payları. Kar yalnız kışın (Aralık–Şubat); öbür aylarda
 * onun payı da açık havaya kalıyor.
 */
const PAY = { yagmur: 0.12, sis: 0.08, kar: 0.1 } as const;

const kisMi = (an: Date) => [11, 0, 1].includes(an.getUTCMonth());

export function havaDurumu(an: Date = new Date()): Hava {
  const dilim = Math.floor(an.getTime() / (HAVA_DILIMI_SAAT * 3_600_000));
  const r = rastgele(`hava:${dilim}`)();
  if (r < PAY.yagmur) return 'yagmur';
  if (r < PAY.yagmur + PAY.sis) return 'sis';
  if (kisMi(an) && r < PAY.yagmur + PAY.sis + PAY.kar) return 'kar';
  return 'acik';
}

/** Havanın bir sonraki değişebileceği an (dilim sonu). */
export function havaDilimSonu(an: Date = new Date()): number {
  const ms = HAVA_DILIMI_SAAT * 3_600_000;
  return (Math.floor(an.getTime() / ms) + 1) * ms;
}
