/**
 * Günün saatine göre ışık (docs/24 "Günün saati") — yalnız görsel.
 *
 * Şehir'in yerleşkesi oyuncunun saatine göre üç ışıktan birini alıyor:
 *
 *   - SABAH (05–11): güneş doğudan ve alçak, ışık pembe-altın, gölgeler
 *     uzun ve öbür yana düşüyor.
 *   - ÖĞLE  (11–17): bugünkü görünüm. Işığı değişmediği için cihazdaki
 *     kayıtlar da aynen geçerli (anahtara bir şey eklenmiyor).
 *   - AKŞAM (17–05): güneş batıdan ve iyice alçak, turuncu; ortam ışığı
 *     azalıyor, gölge serinleşiyor; meşale ve pencere ışıkları daha parlak
 *     (Sahne'nin ışık katmanı, `data-vakit`).
 *
 * Gece ayrı bir ışık değil: oyun akşam ve gecede aynı "alacakaranlık"ı
 * gösteriyor — kapkara bir şehir oynanmaz, karanlık sahnede binalar
 * okunmaz.
 *
 * Her ışık ayrı bir resim, dolayısıyla ayrı bir kayıt: cihazdaki önbellek
 * yerleşke için en çok üç katına çıkıyor (sahne grubunun tavanı içinde).
 * Saat dilimi cihazın: ışık OYUNCUNUN gününü anlatıyor, sunucununkini
 * değil; hiçbir oyun kuralı ona bağlı değil.
 */
import { ISIK, type V3 } from './uc';

export type Vakit = 'sabah' | 'ogle' | 'aksam';
export const VAKITLER: readonly Vakit[] = ['sabah', 'ogle', 'aksam'];

/** Cihazın yerel saatine göre vakit. */
export function gununVakti(an: Date = new Date()): Vakit {
  const s = an.getHours();
  if (s >= 5 && s < 11) return 'sabah';
  if (s >= 11 && s < 17) return 'ogle';
  return 'aksam';
}

const birim = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface VakitIsigi {
  /** Işığın geldiği yön (dünya; z yukarı). */
  isik: V3;
  /** Güneşin rengi (doğrudan ışığın çarpanı). */
  gunes: V3;
  /** Ortam ışığının çarpanı. */
  ortam: number;
  /** Renk düzenlemesi: koyu tonların ve açık tonların çarpanı. */
  golgeTon: V3;
  acikTon: V3;
}

export const VAKIT_ISIGI: Record<Vakit, VakitIsigi> = {
  sabah: {
    isik: birim([-0.62, 0.42, 0.68]),
    gunes: [1.07, 0.97, 0.88],
    ortam: 0.97,
    golgeTon: [0.95, 0.98, 1.06],
    acikTon: [1.05, 1.0, 0.94],
  },
  ogle: {
    isik: ISIK,
    gunes: [1.05, 1.0, 0.92],
    ortam: 1,
    golgeTon: [1, 1, 1],
    acikTon: [1, 1, 1],
  },
  aksam: {
    isik: birim([0.9, 0.08, 0.5]),
    gunes: [1.32, 0.9, 0.58],
    ortam: 0.88,
    golgeTon: [0.86, 0.88, 1.1],
    acikTon: [1.17, 0.99, 0.8],
  },
};

/** Önbellek anahtarına eklenen parça: öğle boş (eski kayıtlar geçerli). */
export function vakitAnahtari(vakit: Vakit | undefined): string {
  return vakit && vakit !== 'ogle' ? `|v${vakit}` : '';
}
