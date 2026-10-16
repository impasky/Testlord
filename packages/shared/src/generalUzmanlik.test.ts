/**
 * General uzmanlığı: hangi seviyede açılıyor, bonusa nasıl ekleniyor,
 * değiştirmek ne tutuyor. Veri tutarlılığı ayrıca `dengeyiDogrula`da.
 */
import { describe, expect, it } from 'vitest';
import { GENERALS, generalDef } from './balance.js';
import {
  UZMANLIK_SEVIYESI,
  aggregateGeneralBonus,
  generalKatkilari,
  generalLevelMultiplier,
  uzmanlikAcikMi,
  uzmanlikDegistirmeBedeli,
  uzmanlikTanimi,
} from './generals.js';

describe('general uzmanlığı', () => {
  it('her generalin iki ayrı yolu var', () => {
    for (const g of GENERALS) {
      expect(g.uzmanliklar?.length, g.key).toBe(2);
      const [a, b] = g.uzmanliklar!;
      expect(a!.key).not.toBe(b!.key);
    }
  });

  it('uzmanlık seviyesinde açılıyor, altında etkisiz', () => {
    expect(uzmanlikAcikMi(UZMANLIK_SEVIYESI - 1)).toBe(false);
    expect(uzmanlikAcikMi(UZMANLIK_SEVIYESI)).toBe(true);
    const yol = generalDef('demirci_yusuf')!.uzmanliklar![1]!; // zırh ustası: ordu_can
    const alt = aggregateGeneralBonus([
      { key: 'demirci_yusuf', level: UZMANLIK_SEVIYESI - 1, uzmanlik: yol.key },
    ]);
    expect(alt.orduCan).toBe(0);
    const ust = aggregateGeneralBonus([
      { key: 'demirci_yusuf', level: UZMANLIK_SEVIYESI, uzmanlik: yol.key },
    ]);
    expect(ust.orduCan).toBeCloseTo(yol.deger * generalLevelMultiplier(UZMANLIK_SEVIYESI), 10);
  });

  it('derinleştiren yol pasifin üstüne ekleniyor', () => {
    const def = generalDef('demirci_yusuf')!;
    const yol = def.uzmanliklar![0]!; // kalkan duvarı: ordu_savunma
    expect(yol.etki).toBe(def.pasif.etki);
    const L = 12;
    const b = aggregateGeneralBonus([{ key: def.key, level: L, uzmanlik: yol.key }]);
    expect(b.orduSavunma).toBeCloseTo(
      (def.pasif.deger + yol.deger) * generalLevelMultiplier(L),
      10,
    );
  });

  it('bilinmeyen ya da başka generalin yolu sayılmıyor', () => {
    const b = aggregateGeneralBonus([
      { key: 'demirci_yusuf', level: 20, uzmanlik: 'keskin_nisanci' },
    ]);
    expect(b.birimSaldiri.okcu ?? 0).toBe(0);
    expect(uzmanlikTanimi('demirci_yusuf', 'yok_boyle')).toBeNull();
  });

  it('raporda uzmanlık görünüyor', () => {
    const yol = generalDef('okcubasi_elif')!.uzmanliklar![0]!;
    const [k] = generalKatkilari([{ key: 'okcubasi_elif', level: 15, uzmanlik: yol.key }]);
    expect(k!.uzmanlik?.ad).toBe(yol.ad);
    expect(generalKatkilari([{ key: 'okcubasi_elif', level: 15 }])[0]!.uzmanlik).toBeNull();
  });

  it('değiştirme bedeli kiralama fiyatının yarısı', () => {
    expect(uzmanlikDegistirmeBedeli('demirci_yusuf')).toBe(
      Math.round(generalDef('demirci_yusuf')!.maliyet_altin * 0.5),
    );
  });
});
