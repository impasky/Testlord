import { describe, expect, it } from 'vitest';
import { EN_YAKIN, enUzak, gorunenOran } from './yerleskeYakinligi';

describe('yerleşke yakınlığı', () => {
  it('en uzak: kabı dolduruyor, kenardan öte boşluk yok; 1’den büyük değil', () => {
    // Telefon: dar ve uzun kap; boy belirliyor.
    expect(enUzak(393, 615, 768, 800)).toBeCloseTo(615 / 800);
    expect(768 * enUzak(393, 615, 768, 800)).toBeGreaterThanOrEqual(393);
    // Geniş kap: en belirliyor.
    expect(enUzak(700, 300, 768, 800)).toBeCloseTo(700 / 768);
    // Kap sahneden büyükse 1 (küçültülmüyor).
    expect(enUzak(1200, 1000, 768, 800)).toBe(1);
    expect(EN_YAKIN).toBeGreaterThan(1);
  });

  it('görünen bölge sahnenin oranı; yakınlaşınca küçülüyor, en çok 1', () => {
    const bir = gorunenOran(0, 0, 393, 615, 768, 800, 1);
    expect(bir[2]).toBeCloseTo(393 / 768);
    expect(bir[3]).toBeCloseTo(615 / 800);
    const iki = gorunenOran(768, 800, 393, 615, 768, 800, 2);
    expect(iki[0]).toBeCloseTo(0.5);
    expect(iki[1]).toBeCloseTo(0.5);
    expect(iki[2]).toBeCloseTo(bir[2] / 2);
    expect(gorunenOran(0, 0, 2000, 2000, 768, 800, 1).slice(2)).toEqual([1, 1]);
  });
});
