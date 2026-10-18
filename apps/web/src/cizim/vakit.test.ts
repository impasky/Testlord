import { describe, expect, it } from 'vitest';
import { ISIK } from './uc';
import { VAKITLER, VAKIT_ISIGI, gununVakti, sonrakiVakit, vakitAnahtari } from './vakit';

const saat = (s: number, d = 0) => new Date(2026, 9, 16, s, d);

describe('günün vakti', () => {
  it('sınırlar: 05 sabah, 11 öğle, 17 akşam, gece akşam', () => {
    expect(gununVakti(saat(4, 59))).toBe('aksam');
    expect(gununVakti(saat(5))).toBe('sabah');
    expect(gununVakti(saat(10, 59))).toBe('sabah');
    expect(gununVakti(saat(11))).toBe('ogle');
    expect(gununVakti(saat(16, 59))).toBe('ogle');
    expect(gununVakti(saat(17))).toBe('aksam');
    expect(gununVakti(saat(23, 30))).toBe('aksam');
  });

  it('bir sonraki vakit: sabah → öğle → akşam → sabah, dilimin bittiği saatte gelen', () => {
    expect(sonrakiVakit('sabah')).toBe('ogle');
    expect(sonrakiVakit('ogle')).toBe('aksam');
    expect(sonrakiVakit('aksam')).toBe('sabah');
    // Önceden çizilen resim, dilim bitince istenen resim olmalı.
    for (const [s, d] of [
      [10, 59],
      [16, 59],
      [4, 59],
    ] as const)
      expect(sonrakiVakit(gununVakti(saat(s, d)))).toBe(gununVakti(saat(s + 1)));
  });

  it('öğle bugünkü ışık: anahtar değişmiyor, ton ve ortam birim', () => {
    // Öğlenin bir şeyi değiştirmesi, cihazdaki bütün yerleşke kayıtlarını
    // boşuna eskitirdi.
    expect(vakitAnahtari('ogle')).toBe('');
    expect(vakitAnahtari(undefined)).toBe('');
    const o = VAKIT_ISIGI.ogle;
    expect(o.isik).toBe(ISIK);
    expect(o.ortam).toBe(1);
    expect(o.golgeTon).toEqual([1, 1, 1]);
    expect(o.acikTon).toEqual([1, 1, 1]);
  });

  it('her vakit ayrı anahtar ve birim uzunlukta ışık yönü, güneş yukarıda', () => {
    const anahtarlar = new Set(VAKITLER.map(vakitAnahtari));
    expect(anahtarlar.size).toBe(VAKITLER.length);
    for (const v of VAKITLER) {
      const [x, y, z] = VAKIT_ISIGI[v].isik;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(z).toBeGreaterThan(0.4); // çok alçak güneş gölgeyi sahneden taşırıyor
    }
  });

  it('sabah ve akşam güneşi karşı yönlerden', () => {
    expect(Math.sign(VAKIT_ISIGI.sabah.isik[0])).toBe(-Math.sign(VAKIT_ISIGI.aksam.isik[0]));
  });

  it('akşam öğleden loş ve turuncu', () => {
    const a = VAKIT_ISIGI.aksam;
    expect(a.ortam).toBeLessThan(1);
    expect(a.gunes[0]).toBeGreaterThan(a.gunes[2]);
    expect(a.acikTon[0]).toBeGreaterThan(a.acikTon[2]);
  });
});
