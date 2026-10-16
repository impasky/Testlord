import { describe, expect, it } from 'vitest';
import { HAVA_DILIMI_SAAT, havaDilimSonu, havaDurumu, type Hava } from './hava';

const DILIM = HAVA_DILIMI_SAAT * 3_600_000;

/** Bir yılın bütün dilimleri, verilen ay(lar) için. */
function say(aylar: number[]): Record<Hava, number> {
  const n: Record<Hava, number> = { acik: 0, yagmur: 0, sis: 0, kar: 0 };
  const bas = Date.UTC(2026, 0, 1);
  for (let t = bas; t < Date.UTC(2027, 0, 1); t += DILIM) {
    const an = new Date(t);
    if (aylar.includes(an.getUTCMonth())) n[havaDurumu(an)]++;
  }
  return n;
}

describe('hava', () => {
  it('aynı dilimde herkese aynı hava, dilim içinde zıplamıyor', () => {
    const bas = Math.floor(Date.UTC(2026, 9, 16, 7) / DILIM) * DILIM;
    const h = havaDurumu(new Date(bas));
    expect(havaDurumu(new Date(bas + DILIM / 2))).toBe(h);
    expect(havaDurumu(new Date(bas + DILIM - 1))).toBe(h);
    expect(havaDilimSonu(new Date(bas + 5))).toBe(bas + DILIM);
  });

  it('çoğu dilim açık; yağışlı hava istisna', () => {
    const yaz = say([5, 6, 7]);
    const toplam = Object.values(yaz).reduce((a, b) => a + b, 0);
    expect(yaz.acik / toplam).toBeGreaterThan(0.7);
    expect(yaz.yagmur).toBeGreaterThan(0);
    expect(yaz.sis).toBeGreaterThan(0);
  });

  it('kar yalnız kışın', () => {
    expect(say([3, 4, 5, 6, 7, 8, 9]).kar).toBe(0);
    expect(say([11, 0, 1]).kar).toBeGreaterThan(0);
  });
});
