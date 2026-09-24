import { describe, expect, it } from 'vitest';
import { kafileTedaviSuresiSn, tedaviSuresiSn, yaraliVarMi } from './hastane.js';
import { B } from './balance.js';
import { UNIT_TYPES } from './types.js';

describe('tedavi süresi', () => {
  it('yaralısı olmayan yığın sıfır süre', () => {
    expect(tedaviSuresiSn('milis', 0)).toBe(0);
    expect(kafileTedaviSuresiSn({})).toBe(0);
  });

  it('tek yaralı bile TABAN kadar yatıyor — akından dönen asker hemen çıkmıyor', () => {
    // Oyuncunun kararı: "askerlere iyileşme süresini uzatalım." Akın bir
    // dakika ve normal gruplar sınırsız; aynı ordunun art arda kaç akın
    // yapabileceğini hastane belirliyor. Eskiden 2 milis 90 sn yatıyordu.
    for (const t of UNIT_TYPES) {
      expect(tedaviSuresiSn(t, 1)).toBeGreaterThanOrEqual(B.hastane.saniye_taban);
    }
    expect(tedaviSuresiSn('milis', 2)).toBeGreaterThanOrEqual(10 * 60);
  });

  it('küçük bir akın kafilesi saatlerce yatmıyor', () => {
    // Uzun ama oyundan koparan değil: bir akının tipik yaralısı (birkaç
    // ile yirmi arası) yarım saat civarında dönüyor.
    expect(kafileTedaviSuresiSn({ okcu: 8 })).toBeLessThan(30 * 60);
    expect(kafileTedaviSuresiSn({ mizrakci: 18 })).toBeLessThan(45 * 60);
  });

  it('tavanı aşmıyor: büyük yenilgi oyuncuyu günlerce dışarıda bırakmıyor', () => {
    for (const t of UNIT_TYPES) {
      expect(tedaviSuresiSn(t, 100000)).toBeLessThanOrEqual(B.hastane.azami_saniye);
    }
  });

  it('daha çok yaralı daha uzun sürüyor (tavana kadar)', () => {
    expect(tedaviSuresiSn('mizrakci', 50)).toBeGreaterThan(tedaviSuresiSn('mizrakci', 5));
  });

  it('pahalı birim daha uzun iyileşiyor', () => {
    expect(tedaviSuresiSn('kusatma', 20)).toBeGreaterThan(tedaviSuresiSn('milis', 20));
  });

  it('kafile TEK süre veriyor: en uzun süren birim belirliyor', () => {
    const kafile = { milis: 10, kusatma: 10 };
    expect(kafileTedaviSuresiSn(kafile)).toBe(
      Math.max(tedaviSuresiSn('milis', 10), tedaviSuresiSn('kusatma', 10)),
    );
  });
});

describe('yaralı var mı', () => {
  it('boş ve tanımsız yığınlar yaralı sayılmıyor', () => {
    expect(yaraliVarMi(null)).toBe(false);
    expect(yaraliVarMi(undefined)).toBe(false);
    expect(yaraliVarMi({})).toBe(false);
    expect(yaraliVarMi({ milis: 0 })).toBe(false);
  });

  it('bir asker bile varsa yaralı var', () => {
    expect(yaraliVarMi({ milis: 1 })).toBe(true);
  });
});

describe('tedavideki asker yük olmuyor', () => {
  it('bakım almıyor — yenilgi iki kez cezalandırılmıyor', () => {
    // Yenilen oyuncuyu hem kayıpla hem bakım gideriyle vurmak, dibe
    // vurmuş oyuncuyu daha da dibe iter.
    expect(B.hastane.bakim_alir).toBe(false);
  });
});
