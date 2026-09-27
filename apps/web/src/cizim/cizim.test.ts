import { describe, expect, it } from 'vitest';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import { rastgele } from './rastgele';
import { ciz, kutu, sabitKutu, yansitici, zemineGeri } from './uc';
import { YERLESIM_KADEMELERI, yerlesimModeli, yerlesimNoktasi, yerlesimYuzdesi } from './yerlesim';

const sayilar = (n: string) => n.split(/[ ,]/).map(Number);

describe('3B motor', () => {
  it('kamera bir küpün tam üç yüzünü görüyor (üst, +x, +y)', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    expect(c.cokgenler).toHaveLength(3);
  });

  it('ışık: üst yüz en açık, +y yüzü en koyu', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    const parlak = c.cokgenler.map((p) => parseInt(p.renk.slice(1, 3), 16)).sort((a, b) => a - b);
    expect(new Set(parlak).size).toBe(3);
  });

  it('zemine geri yansıtma, yansıtmanın tersi', () => {
    const e = yansitici();
    const g = zemineGeri();
    for (const [x, y] of [
      [3, 4],
      [-7, 2],
      [0, 0],
    ] as [number, number][]) {
      const [sx, sy] = e([x, y, 0]);
      const [gx, gy] = g(sx, sy);
      expect(gx).toBeCloseTo(x, 6);
      expect(gy).toBeCloseTo(y, 6);
    }
  });

  it('sabit kutu hacmin bütün köşelerini içeriyor', () => {
    const [x, y, w, h] = sabitKutu([0, 0, 0], [10, 10, 10]);
    const e = yansitici();
    for (const q of [
      [0, 0, 0],
      [10, 10, 10],
      [10, 0, 10],
      [0, 10, 0],
    ] as [number, number, number][]) {
      const [px, py] = e(q);
      expect(px).toBeGreaterThanOrEqual(x);
      expect(px).toBeLessThanOrEqual(x + w);
      expect(py).toBeGreaterThanOrEqual(y);
      expect(py).toBeLessThanOrEqual(y + h);
    }
  });

  it('tohumlu rastgele: aynı anahtar aynı dizi', () => {
    const a = rastgele('kisla_3');
    const b = rastgele('kisla_3');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('bina çizimleri', () => {
  it.each(BINA_ADLARI)('%s: NaN yok, çerçeveye sığıyor, boş değil', (ad) => {
    const c = ciz(binaModeli(ad));
    expect(c.cokgenler.length).toBeGreaterThan(20);
    const [x, y, w, h] = BINA_KUTUSU;
    for (const p of c.cokgenler) {
      const s = sayilar(p.n);
      expect(s.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < s.length; i += 2) {
        expect(s[i]!).toBeGreaterThanOrEqual(x - 0.01);
        expect(s[i]!).toBeLessThanOrEqual(x + w + 0.01);
        expect(s[i + 1]!).toBeGreaterThanOrEqual(y - 0.01);
        expect(s[i + 1]!).toBeLessThanOrEqual(y + h + 0.01);
      }
    }
  });
});

describe('yerleşim zeminleri', () => {
  it.each(YERLESIM_KADEMELERI)('%s: NaN yok', (k) => {
    const c = ciz(yerlesimModeli(k));
    expect(c.cokgenler.length).toBeGreaterThan(50);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('binanın ekran yüzdesi dünyaya ve geri aynı yüzdeye dönüyor', () => {
    const [x, y] = yerlesimNoktasi(51, 53);
    const [px, py] = yerlesimYuzdesi(x, y);
    expect(px).toBeCloseTo(51, 6);
    expect(py).toBeCloseTo(53, 6);
  });
});
