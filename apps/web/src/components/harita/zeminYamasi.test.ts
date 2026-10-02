import { describe, expect, it } from 'vitest';
import { gorunenBolge } from './zeminYamasi';

describe('dünya zemininin görünen bölgesi', () => {
  it('tuvalin dönüşümünden dünya birimine (0–100); bir birimin ekran pikseli', () => {
    // 400 piksellik kutu, ×4 yakın, sol üst köşe dünyanın (25, 10) noktası.
    const g = gorunenBolge({ k: 4, tx: -400, ty: -160 }, 400, 600, 400);
    expect(g?.birim).toBeCloseTo(16);
    expect(g?.kutu[0]).toBeCloseTo(25);
    expect(g?.kutu[1]).toBeCloseTo(10);
    expect(g?.kutu[2]).toBeCloseTo(25);
    expect(g?.kutu[3]).toBeCloseTo(37.5);
  });

  it('dünyanın dışı kırpılıyor; hiç görünmüyorsa ya da boyut yoksa boş', () => {
    const g = gorunenBolge({ k: 1, tx: 50, ty: 0 }, 400, 600, 400);
    expect(g?.kutu).toEqual([0, 0, 87.5, 100]);
    expect(gorunenBolge({ k: 1, tx: 500, ty: 0 }, 400, 600, 400)).toBeNull();
    expect(gorunenBolge({ k: 1, tx: 0, ty: 0 }, 400, 600, 0)).toBeNull();
  });
});
