/**
 * Savaş motoru testleri.
 *
 * docs/02 §5'teki senaryo tablosu bu testlerin kabul kriteridir.
 * Motor değişirse önce burası kırılmalı.
 */
import { describe, expect, it } from 'vitest';
import { simulateBattle, armyCount, calculateLoot } from './combat.js';
import type { Army, Side } from './types.js';
import { bosGeneralBonus } from './types.js';
import { createRng } from './rng.js';
import { B } from './balance.js';

function side(units: Army, opts: Partial<Side> = {}): Side {
  return {
    units,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: 0,
    isDefender: false,
    ...opts,
  };
}

const ctx = {
  defenderStore: { altin: 10000, demir: 5000, erzak: 5000 },
  attackerCunning: 0,
  canCapture: true,
};

describe('determinizm', () => {
  it('aynı seed aynı sonucu verir', () => {
    const a = side({ mizrakci: 100, okcu: 80 });
    const d = side({ mizrakci: 60, okcu: 40 }, { isDefender: true });
    const r1 = simulateBattle(a, d, 'seed-abc', ctx);
    const r2 = simulateBattle(a, d, 'seed-abc', ctx);
    expect(r1).toEqual(r2);
  });

  it('farklı seed farklı güç değerleri üretir', () => {
    const a = side({ mizrakci: 100 });
    const d = side({ mizrakci: 100 }, { isDefender: true });
    const r1 = simulateBattle(a, d, 'seed-1', ctx);
    const r2 = simulateBattle(a, d, 'seed-2', ctx);
    expect(r1.rounds[0]!.saldiranGuc).not.toBe(r2.rounds[0]!.saldiranGuc);
  });

  it('Math.random kullanmaz — sonuç seed dışında hiçbir şeye bağlı değil', () => {
    const a = side({ suvari: 50 });
    const d = side({ okcu: 100 }, { isDefender: true });
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(simulateBattle(a, d, 'sabit', ctx)));
    }
    expect(results.size).toBe(1);
  });
});

describe('kayıp bandı (docs/02 §5)', () => {
  it('ezici üstünlükte bile kazanan kayıp verir', () => {
    const a = side({ mizrakci: 1000 });
    const d = side({ mizrakci: 50 }, { isDefender: true });
    const r = simulateBattle(a, d, 'ezici', ctx);
    expect(r.winner).toBe('attacker');
    expect(armyCount(r.attackerLosses)).toBeGreaterThan(0);
  });

  it('kazananın kaybı üst sınırı aşmaz', () => {
    const a = side({ mizrakci: 100 });
    const d = side({ mizrakci: 99 }, { isDefender: true });
    const r = simulateBattle(a, d, 'basabas', ctx);
    const winnerLosses = r.winner === 'attacker' ? r.attackerLosses : r.defenderLosses;
    const winnerStart = r.winner === 'attacker' ? 100 : 99;
    expect(armyCount(winnerLosses) / winnerStart).toBeLessThanOrEqual(
      B.savas.kayip.kazanan_max + 0.01,
    );
  });

  it('kaybeden her zaman kazanandan fazla kaybeder', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const a = side({ mizrakci: 200, okcu: 100 });
      const d = side({ mizrakci: 80, okcu: 40 }, { isDefender: true });
      const r = simulateBattle(a, d, seed, ctx);
      const attackerRate = armyCount(r.attackerLosses) / 300;
      const defenderRate = armyCount(r.defenderLosses) / 120;
      if (r.winner === 'attacker') expect(defenderRate).toBeGreaterThan(attackerRate);
      else expect(attackerRate).toBeGreaterThan(defenderRate);
    }
  });

  it('kaybedenin kaybı %90 üst sınırını aşmaz', () => {
    const a = side({ suvari: 500 });
    const d = side({ milis: 10 }, { isDefender: true });
    const r = simulateBattle(a, d, 'katliam', ctx);
    expect(armyCount(r.defenderLosses) / 10).toBeLessThanOrEqual(B.savas.kayip.kaybeden_max + 0.01);
  });
});

describe('karşı üçgeni', () => {
  it('mızrakçı süvariye karşı savunmada üstün', () => {
    const suvari = side({ suvari: 30 });
    const vsMizrakci = simulateBattle(
      suvari,
      side({ mizrakci: 90 }, { isDefender: true }),
      's1',
      ctx,
    );
    const vsOkcu = simulateBattle(suvari, side({ okcu: 90 }, { isDefender: true }), 's1', ctx);
    // Aynı sayıda savunucuya karşı mızrakçı daha çok direnir
    expect(vsMizrakci.rounds[0]!.savunanGuc).toBeGreaterThan(vsOkcu.rounds[0]!.savunanGuc);
  });

  it('okçu mızrakçıya karşı saldırıda üstün', () => {
    const def = side({ mizrakci: 100 }, { isDefender: true });
    const okcuAtk = simulateBattle(side({ okcu: 100 }), def, 's2', ctx);
    const milisAtk = simulateBattle(side({ milis: 100 }), def, 's2', ctx);
    expect(okcuAtk.rounds[0]!.saldiranGuc).toBeGreaterThan(milisAtk.rounds[0]!.saldiranGuc);
  });
});

describe('mancınık ve tahkimat', () => {
  it('mancınık tahkimatsız hedefe karşı zayıf, kaleye karşı güçlü', () => {
    const atk = side({ kusatma: 20 });
    const acik = simulateBattle(atk, side({ mizrakci: 50 }, { isDefender: true }), 'k1', ctx);
    const kale = simulateBattle(
      atk,
      side({ mizrakci: 50 }, { isDefender: true, fortressBonus: B.bolgeler.kale_savunma_bonusu.taht }),
      'k1',
      ctx,
    );
    expect(kale.rounds[0]!.saldiranGuc).toBeGreaterThan(acik.rounds[0]!.saldiranGuc);
  });

  it('tahkimat savunanı güçlendirir', () => {
    const atk = side({ mizrakci: 100 });
    const acik = simulateBattle(atk, side({ mizrakci: 50 }, { isDefender: true }), 'f1', ctx);
    const kale = simulateBattle(
      atk,
      side({ mizrakci: 50 }, { isDefender: true, fortressBonus: 0.3 }),
      'f1',
      ctx,
    );
    expect(kale.rounds[0]!.savunanGuc).toBeGreaterThan(acik.rounds[0]!.savunanGuc);
  });
});

describe('kayıp dağıtımı', () => {
  it('ucuz birimler orantısal olarak daha çok ölür (et kalkanı)', () => {
    const a = side({ milis: 100, suvari: 100 });
    const d = side({ mizrakci: 200 }, { isDefender: true });
    const r = simulateBattle(a, d, 'kalkan', ctx);
    const milisOran = (r.attackerLosses.milis ?? 0) / 100;
    const suvariOran = (r.attackerLosses.suvari ?? 0) / 100;
    expect(milisOran).toBeGreaterThan(suvariOran);
  });

  it('kayıp hiçbir zaman mevcut birim sayısını aşmaz', () => {
    const a = side({ milis: 5 });
    const d = side({ suvari: 200 }, { isDefender: true });
    const r = simulateBattle(a, d, 'ezil', ctx);
    expect(r.attackerLosses.milis ?? 0).toBeLessThanOrEqual(5);
    expect(armyCount(r.attackerSurvivors)).toBeGreaterThanOrEqual(0);
  });
});

describe('bölge ele geçirme', () => {
  it('1.5 kat güçle saldıran bölgeyi alır', () => {
    const r = simulateBattle(
      side({ mizrakci: 300 }),
      side({ mizrakci: 50 }, { isDefender: true }),
      'fetih',
      ctx,
    );
    expect(r.winner).toBe('attacker');
    expect(r.captured).toBe(true);
  });

  it('dar zaferde bölge el değiştirmez, sadece yağma alınır', () => {
    const r = simulateBattle(
      side({ mizrakci: 100 }),
      side({ mizrakci: 95 }, { isDefender: true }),
      'dar',
      ctx,
    );
    if (r.winner === 'attacker') {
      expect(r.captured).toBe(false);
      expect(r.loot.altin).toBeGreaterThan(0);
    }
  });

  it('canCapture kapalıysa asla ele geçiremez', () => {
    const r = simulateBattle(
      side({ mizrakci: 500 }),
      side({ mizrakci: 10 }, { isDefender: true }),
      'akin',
      { ...ctx, canCapture: false },
    );
    expect(r.captured).toBe(false);
  });
});

describe('yağma', () => {
  it('taşıma kapasitesini aşmaz', () => {
    const survivors: Army = { milis: 1 };
    const loot = calculateLoot({ altin: 1_000_000, demir: 0, erzak: 0 }, survivors, 0, 0);
    expect(loot.altin).toBeLessThanOrEqual(B.savas.tasima_kapasitesi_birim_basina.milis);
  });

  it('Kurnazlık yağmayı artırır (depo sınırlıyken)', () => {
    const s: Army = { suvari: 100 };
    const store = { altin: 5000, demir: 0, erzak: 0 };
    expect(calculateLoot(store, s, 50, 0).altin).toBeGreaterThan(
      calculateLoot(store, s, 0, 0).altin,
    );
  });

  it('Kurnazlık taşıma kapasitesi sınırlıyken de işe yarar', () => {
    // Kapasite tavana vurduğunda bonus etkisiz kalmamalı: taşımayı da artırır.
    const s: Army = { suvari: 100 };
    const store = { altin: 1_000_000, demir: 0, erzak: 0 };
    expect(calculateLoot(store, s, 50, 0).altin).toBeGreaterThan(
      calculateLoot(store, s, 0, 0).altin,
    );
  });

  it('Casus Leyla bonusu da kapasite sınırlıyken işe yarar', () => {
    const s: Army = { suvari: 100 };
    const store = { altin: 1_000_000, demir: 0, erzak: 0 };
    expect(calculateLoot(store, s, 0, 0.25).altin).toBeGreaterThan(
      calculateLoot(store, s, 0, 0).altin,
    );
  });

  it('kaybeden saldırgan yağma alamaz', () => {
    const r = simulateBattle(
      side({ milis: 10 }),
      side({ suvari: 200 }, { isDefender: true }),
      'yenilgi',
      ctx,
    );
    expect(r.winner).toBe('defender');
    expect(r.loot).toEqual({ altin: 0, demir: 0, erzak: 0 });
  });
});

describe('lord ve ekipman katkısı', () => {
  it('güçlü lord savaşın sonucunu değiştirebilir', () => {
    const d = side({ mizrakci: 100 }, { isDefender: true });
    const zayifLord = simulateBattle(side({ mizrakci: 90 }), d, 'lord', ctx);
    const gucluLord = simulateBattle(
      side({ mizrakci: 90 }, { lordContribution: 3000 }),
      d,
      'lord',
      ctx,
    );
    expect(gucluLord.rounds[0]!.saldiranGuc).toBeGreaterThan(zayifLord.rounds[0]!.saldiranGuc);
  });
});

describe('rng', () => {
  it('pick ağırlıklara uyar', () => {
    const rng = createRng('dagilim');
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) counts[rng.pick({ a: 0.9, b: 0.1 })]!++;
    expect(counts.a!).toBeGreaterThan(counts.b! * 5);
  });

  it('variance belirtilen bandın içinde kalır', () => {
    const rng = createRng('varyans');
    for (let i = 0; i < 1000; i++) {
      const v = rng.variance(0.07);
      expect(v).toBeGreaterThanOrEqual(0.93);
      expect(v).toBeLessThanOrEqual(1.07);
    }
  });
});
