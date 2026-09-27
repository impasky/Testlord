/**
 * Tohumlu rastgele sayı: aynı anahtar her zaman aynı çizimi verir.
 *
 * Ağaçların yeri, dağın sivriliği, taşların dizilişi "rastgele" ama
 * SABİT olmalı — oyuncu sayfayı her açtığında köyü farklı görmemeli.
 */

/** Dizgeden 32 bitlik tohum (FNV-1a). */
export function tohum(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: küçük, hızlı, yeterince düzgün. [0, 1) döner. */
export function rastgele(t: number | string): () => number {
  let a = typeof t === 'string' ? tohum(t) : t >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** [a, b) aralığında. */
export const aralik = (r: () => number, a: number, b: number) => a + (b - a) * r();
