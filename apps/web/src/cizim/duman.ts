/**
 * Canlı dumanın kaynakları (docs/24 "Hareket"): hareketli GPU resminde duman
 * yok; sayfada CSS yumruları olarak yükseliyor. Kaynakları modelden
 * (`Yuz.duman`) çıkarmak ana iş parçacığına düşmesin diye burada, saf: GPU
 * işçisi resimle birlikte bunları da yolluyor.
 */
import { yansitici, type Kamera, type Model } from './uc';

/**
 * Canlı dumanın kaynağı (görüş kutusu biriminde): baca ağzı, yükselişin
 * ekrandaki yönü ve boyu, rengi.
 */
export interface DumanKaynagi {
  x: number;
  y: number;
  dx: number;
  dy: number;
  renk: string;
}

/**
 * Bir duman yumrusunun yolu (dünya birimi): durağan dumanın ilk küresinin
 * biraz altından (baca ağzı) çıkıp rüzgârla kayarak yükseliyor
 * (`parca.duman`la aynı yön).
 */
const DUMAN_ALT = 0.8;
const DUMAN_YOLU: [number, number, number] = [1.4, -0.9, 5];

export function dumanKaynaklari(model: Model, kamera?: Kamera): DumanKaynagi[] {
  const e = yansitici(kamera);
  const kaynaklar = new Map<string, DumanKaynagi>();
  for (const y of model) {
    const d = y.duman;
    if (!d) continue;
    const ad = d.join(',');
    if (kaynaklar.has(ad)) continue;
    const [x, sy] = e([d[0], d[1], d[2] - DUMAN_ALT]);
    const [ux, uy] = e([
      d[0] + DUMAN_YOLU[0],
      d[1] + DUMAN_YOLU[1],
      d[2] - DUMAN_ALT + DUMAN_YOLU[2],
    ]);
    kaynaklar.set(ad, { x, y: sy, dx: ux - x, dy: uy - sy, renk: y.renk });
  }
  return [...kaynaklar.values()];
}
