import { describe, expect, it } from 'vitest';
import { EN_YAKIN, enUzak, gorunenOran, gorunumOku } from './yerleskeYakinligi';

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

  it('saklı görünüm: geçerli değer okunuyor; bozuk, eksik ya da sınır dışı olan yok sayılıyor', () => {
    expect(gorunumOku(JSON.stringify({ z: 2.25, merkez: [0.4, 0.6] }))).toEqual({
      z: 2.25,
      merkez: [0.4, 0.6],
    });
    expect(gorunumOku(null)).toBeNull();
    expect(gorunumOku('{bozuk')).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: 2 }))).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: 'iki', merkez: [0.5, 0.5] }))).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: EN_YAKIN + 1, merkez: [0.5, 0.5] }))).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: 0, merkez: [0.5, 0.5] }))).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: 1, merkez: [1.5, 0.5] }))).toBeNull();
    expect(gorunumOku(JSON.stringify({ z: 1, merkez: [0.5, null] }))).toBeNull();
  });
});
