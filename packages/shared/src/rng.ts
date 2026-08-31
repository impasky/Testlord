/**
 * Seed'li deterministik rastgelelik.
 *
 * Savaş sonuçlarının yeniden üretilebilir olması buna bağlıdır: aynı seed +
 * aynı girdi her zaman aynı sonucu verir. Math.random() OYUN MANTIĞINDA YASAKTIR.
 */

/** 32-bit string hash (FNV-1a benzeri, cnv). */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — küçük, hızlı, iyi dağılımlı PRNG. */
export function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** [0,1) */
  next(): number;
  /** [min,max] aralığında tam sayı */
  int(min: number, max: number): number;
  /** merkez etrafında ±band oranında çarpan, örn. band=0.07 -> [0.93, 1.07] */
  variance(band: number): number;
  /** ağırlıklı seçim */
  pick<T extends string>(weights: Record<T, number>): T;
}

export function createRng(seed: string): Rng {
  const rand = mulberry32(hashSeed(seed));
  return {
    next: rand,
    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    },
    variance(band) {
      return 1 + (rand() * 2 - 1) * band;
    },
    pick<T extends string>(weights: Record<T, number>): T {
      const entries = Object.entries(weights) as [T, number][];
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let roll = rand() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
      }
      return entries[entries.length - 1]![0];
    },
  };
}

/** Kriptografik olmayan ama çakışmayan savaş seed'i üretir. */
export function newSeed(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}
