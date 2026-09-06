import { describe, expect, it } from 'vitest';
import { kafileTedaviSuresiSn, tedaviSuresiSn, yaraliVarMi } from './hastane.js';
import { B, unit } from './balance.js';
import { UNIT_TYPES } from './types.js';

describe('tedavi süresi', () => {
  it('yaralısı olmayan yığın sıfır süre', () => {
    expect(tedaviSuresiSn('milis', 0)).toBe(0);
    expect(kafileTedaviSuresiSn({})).toBe(0);
  });

  it('tedavi HİÇBİR durumda sıfırdan eğitmekten uzun değil', () => {
    // Bu bir ayar değil garanti: uzun olsaydı yaralıyı beklemek yerine
    // yenisini eğitmek her zaman daha mantıklı olur ve hastane ölü bir
    // ekran olarak kalırdı. İlk hesapta 5 milis için tedavi 7,3 dakika,
    // eğitim 3,8 dakika çıkmıştı — kural sessizce çiğneniyordu.
    for (const t of UNIT_TYPES) {
      for (const adet of [1, 3, 5, 17, 50, 200, 1000]) {
        expect(tedaviSuresiSn(t, adet)).toBeLessThanOrEqual(unit(t).egitim_sn * adet);
      }
    }
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
