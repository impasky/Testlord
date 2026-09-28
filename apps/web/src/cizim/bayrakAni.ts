/**
 * Dalgalanan bayrak (docs/24 "Hareket"): kumaşın bir tur dalgası, GPU için.
 *
 * Bayrak kumaşı dinlenik hâlini taşıyor (`Yuz.bez`); her kare aynı
 * kumaşın dalganın bir sonraki evresindeki hâli (`parca.bezAni`). İlk kare
 * durağan bayrakla aynı: hareketsiz sahnedeki bayrak buradan başlıyor.
 * Kareler bayrak bayrak ardışık: çizici her bayrağın kutusunu ayrı buluyor.
 */
import { KOSE, agYap } from './glAg';
import type { BayrakKareleri } from './glCizici';
import { BAYRAK_FAZ, bezAni } from './parca';
import { kameraTabani, type Kamera, type Model, type Yuz } from './uc';

/** Bir dalga turundaki kare sayısı. */
export const BAYRAK_KARE = 12;

/** Kumaş yüzlerini bayrak bayrak toplar: dinlenik köşesini paylaşan yüzler aynı bayrak. */
export function bayrakGruplari(model: Model): Yuz[][] {
  const yuzler = model.filter((y) => y.bez);
  const ata = yuzler.map((_, i) => i);
  const kok = (i: number): number => (ata[i] === i ? i : (ata[i] = kok(ata[i]!)));
  const sahip = new Map<string, number>();
  yuzler.forEach((y, i) => {
    for (const q of y.bez!.dinlenik) {
      const a = q.map((v) => v.toFixed(4)).join(',');
      const j = sahip.get(a);
      if (j === undefined) sahip.set(a, i);
      else ata[kok(i)] = kok(j);
    }
  });
  const gruplar = new Map<number, Yuz[]>();
  yuzler.forEach((y, i) => {
    const g = kok(i);
    if (!gruplar.has(g)) gruplar.set(g, []);
    gruplar.get(g)!.push(y);
  });
  return [...gruplar.values()];
}

/** Modeldeki bayrakların kareleri; bayrak yoksa `undefined`. */
export function bayrakKareleri(model: Model, kamera?: Kamera): BayrakKareleri | undefined {
  const gruplar = bayrakGruplari(model);
  if (!gruplar.length) return undefined;
  const { c } = kameraTabani(kamera);
  const derinlik = (y: Yuz) => y.p.reduce((t, q) => t + q[0] * c[0] + q[1] * c[1] + q[2] * c[2], 0);
  const kareler: Float32Array[] = [];
  let sayilar: number[] = [];
  for (let f = 0; f < BAYRAK_KARE; f++) {
    const faz = BAYRAK_FAZ + (2 * Math.PI * f) / BAYRAK_KARE;
    const parcalar = gruplar.map((g) => {
      // Uzaktan yakına: kumaş derinliğe yazmadan çiziliyor, kıvrım üst
      // üste binince yakın olan üstte kalsın.
      const yuzler = g.map((y) => bezAni(y, faz)).sort((a, b) => derinlik(a) - derinlik(b));
      return agYap(yuzler, kamera).nesne;
    });
    if (f === 0) sayilar = parcalar.map((p) => p.length / KOSE);
    const toplam = new Float32Array(parcalar.reduce((t, p) => t + p.length, 0));
    let bas = 0;
    for (const p of parcalar) {
      toplam.set(p, bas);
      bas += p.length;
    }
    kareler.push(toplam);
  }
  return { kareler, gruplar: sayilar };
}
