/**
 * Garnizon payının SAYILARI (docs/16 §6, docs/27): bölüşüm adil mi,
 * yuvarlama bölgenin ürettiğinden fazlasını dağıtıyor mu.
 */
import { describe, expect, it } from 'vitest';
import { garnizonPaylari, orduYeri, payMiktari } from './garnizon.js';

describe('garnizon payı', () => {
  const mizrakci = (n: number) => ({ mizrakci: n });

  it('tek garnizon gelirin tamamını alıyor', () => {
    const p = garnizonPaylari([{ lordId: 'a', ordu: mizrakci(20) }]);
    expect(p).toHaveLength(1);
    expect(p[0]!.oran).toBeCloseTo(1);
    expect(payMiktari(200, p[0]!.oran)).toBe(200);
  });

  it('eşit garnizonlar eşit bölüşüyor — docs/16 §6 örneği', () => {
    const p = garnizonPaylari(
      Array.from({ length: 10 }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(20) })),
    );
    expect(p).toHaveLength(10);
    for (const x of p) expect(payMiktari(200, x.oran)).toBe(20);
  });

  it('BALİNA tek bölgede baskın olamıyor — yer başına verimi düşüyor', () => {
    // docs/16 §6: 1 lord 100 yer + 9 lord × 20 yer -> balina 71, diğerleri 14
    const p = garnizonPaylari([
      { lordId: 'balina', ordu: mizrakci(100) },
      ...Array.from({ length: 9 }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(20) })),
    ]);
    const balina = p.find((x) => x.lordId === 'balina')!;
    const kucuk = p.find((x) => x.lordId === 'l0')!;
    expect(payMiktari(200, balina.oran)).toBe(71);
    expect(payMiktari(200, kucuk.oran)).toBe(14);
    // Asıl iddia: balina 5 kat asker koydu ama 5 kat gelir ALMIYOR.
    const balinaVerim = (200 * balina.oran) / balina.yer;
    const kucukVerim = (200 * kucuk.oran) / kucuk.yer;
    expect(balinaVerim).toBeCloseTo(kucukVerim, 5);
  });

  it('paylar toplamı bölgenin ürettiğini AŞMIYOR', () => {
    // Yukarı yuvarlansaydı on kişilik bir bölge her saat yoktan altın üretirdi.
    for (const n of [3, 7, 10, 23]) {
      const p = garnizonPaylari(
        Array.from({ length: n }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(7) })),
      );
      const dagitilan = p.reduce((s, x) => s + payMiktari(199, x.oran), 0);
      expect(dagitilan, `${n} garnizon`).toBeLessThanOrEqual(199);
    }
  });

  it('boş garnizon pay almıyor', () => {
    expect(garnizonPaylari([{ lordId: 'a', ordu: {} }])).toHaveLength(0);
    const p = garnizonPaylari([
      { lordId: 'dolu', ordu: mizrakci(5) },
      { lordId: 'bos', ordu: {} },
    ]);
    expect(p.map((x) => x.lordId)).toEqual(['dolu']);
  });

  it('yer birim TÜRÜNE göre sayılıyor, adede göre değil', () => {
    // Süvari mızrakçıdan çok yer kaplıyor; pay da ona göre olmalı.
    expect(orduYeri({ mizrakci: 10 })).toBeLessThan(orduYeri({ suvari: 10 }));
  });
});
