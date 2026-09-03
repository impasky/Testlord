/**
 * Tasarım garantilerinin testi.
 *
 * docs/02 §7'deki kontrollerden SAVAŞ MOTORUNA BAĞLI olanlar burada koşar,
 * çünkü sadece gerçek motor tahkimatı, karşı çarpanlarını ve kayıp dağıtımını
 * doğru hesaplar. Saf aritmetik kontroller tools/check_balance.py'de kalır.
 */
import { describe, expect, it } from 'vitest';
import {
  B,
  WORLD_MAP,
  accrue,
  armySlots,
  bosGeneralBonus,
  commandCapacity,
  fortressBonus,
  itemPower,
  karsiIpuclari,
  kusamSeviyesi,
  kusatmaCarpanlari,
  kusatmaDurumu,
  lordContribution,
  malikaneIncome,
  maxRegions,
  simulateBattle,
  upkeepPerHour,
  xpForLevel,
} from './index.js';
import type { Army, EquippedItem, Side } from './types.js';

const ctx = { defenderStore: { altin: 0, demir: 0, erzak: 0 }, attackerCunning: 0, canCapture: true };

function side(units: Army, isDefender: boolean, fort = 0, leadership = 5): Side {
  return {
    units,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership,
    fortressBonus: fort,
    isDefender,
  };
}

const RING4_NPC = WORLD_MAP.regions.find((r) => r.ring === 4)!.npc_garrison as unknown as Army;
const BASLANGIC_ORDUSU: Army = { mizrakci: 20, okcu: 15 };

describe('ilk gün deneyimi', () => {
  it('yeni oyuncu 1. günün ordusuyla tahkimatsız bir ring-4 bölgesini ALABİLİR', () => {
    for (const tip of ['tarla', 'maden'] as const) {
      const r = simulateBattle(
        side(BASLANGIC_ORDUSU, false),
        side(RING4_NPC, true, fortressBonus(tip, 1)),
        `ilk-fetih-${tip}`,
        ctx,
      );
      expect(r.winner, `${tip} kazanılmalı`).toBe('attacker');
      expect(r.captured, `${tip} ele geçirilmeli`).toBe(true);
    }
  });

  it('başlangıç ordusunun maliyeti 1 günlük bütçeyi aşmaz', () => {
    const maliyet =
      20 * B.birimler.mizrakci.maliyet.altin + 15 * B.birimler.okcu.maliyet.altin;
    const butce = B.lord.baslangic_kaynaklari.altin + malikaneIncome(1).altin * 24;
    expect(maliyet).toBeLessThanOrEqual(butce);
  });

  it('KALE aynı orduyla alınamaz — kenar bölgeler arasında bile zorluk farkı var', () => {
    const r = simulateBattle(
      side(BASLANGIC_ORDUSU, false),
      side(RING4_NPC, true, fortressBonus('kale', 1)),
      'ilk-fetih-kale',
      ctx,
    );
    expect(r.captured).toBe(false);
  });

  it('başlangıç ordusu komuta kapasitesine sığar', () => {
    const kapasite = commandCapacity(B.lord.baslangic_statlari.liderlik);
    expect(armySlots(BASLANGIC_ORDUSU)).toBeLessThanOrEqual(kapasite);
  });
});

describe('ekonomi dengesi', () => {
  it('Lv1 oyuncusu başlangıç ordusunu besleyebilir (açlık yok)', () => {
    const gelir = malikaneIncome(1).erzak;
    expect(gelir).toBeGreaterThanOrEqual(upkeepPerHour(BASLANGIC_ORDUSU));
  });

  it('Lv60 oyuncusu büyük orduyu ancak tarlalarla besleyebilir', () => {
    const endgame: Army = { mizrakci: 150, okcu: 120, suvari: 150, kusatma: 20 };
    const bakim = upkeepPerHour(endgame);
    const sadeceMalikane = malikaneIncome(60).erzak;
    const ucTarlaIle = sadeceMalikane + 3 * B.bolgeler.taban_gelir_saatlik.tarla.erzak * 1.5 * 2.0;

    expect(sadeceMalikane, 'tarlasız yetmemeli').toBeLessThan(bakim);
    expect(ucTarlaIle, 'üç tarlayla yetmeli').toBeGreaterThanOrEqual(bakim);
  });

  it('depo tavanı aşılamaz', () => {
    const r = accrue({
      current: { altin: 0, demir: 0, erzak: 0 },
      lordLevel: 1,
      hourlyIncome: malikaneIncome(1),
      upkeepPerHour: 0,
      lastTickAt: new Date(Date.now() - 10_000 * 3_600_000),
      now: new Date(),
    });
    const cap = B.kaynaklar.depo_kapasitesi.taban + B.kaynaklar.depo_kapasitesi.lord_seviye_basina;
    expect(r.resources.altin).toBeLessThanOrEqual(cap);
  });

  it('erzak biterse açlık bayrağı kalkar ve firar başlar', () => {
    const r = accrue({
      current: { altin: 0, demir: 0, erzak: 10 },
      lordLevel: 1,
      hourlyIncome: { altin: 0, demir: 0, erzak: 0 },
      upkeepPerHour: 100,
      lastTickAt: new Date(Date.now() - 5 * 3_600_000),
      now: new Date(),
    });
    expect(r.starving).toBe(true);
    expect(r.desertionRate).toBeGreaterThan(0);
  });
});

describe('ilerleme temposu', () => {
  it('Lv60 hedeflenen aralıkta (100-130 gün, günde 6 savaş)', () => {
    let gun = 0;
    for (let n = 1; n < B.lord.max_seviye; n++) {
      let birikmis = 0;
      const gerekli = xpForLevel(n);
      while (birikmis < gerekli) {
        birikmis += 80 * n * 6 + 2000;
        gun++;
      }
    }
    expect(gun).toBeGreaterThanOrEqual(100);
    expect(gun).toBeLessThanOrEqual(130);
  });

  it('bölge limiti seviyeyle büyür ve Lv60\'ta 5 olur', () => {
    expect(maxRegions(1)).toBe(1);
    expect(maxRegions(60)).toBe(5);
  });
});

describe('güç dağılımı', () => {
  it('tam donanımlı lord toplam savaş gücünün %15-25\'ini taşır', () => {
    const tamSet: EquippedItem[] = B.ekipman.slotlar.map((slot) => ({
      slot: slot as EquippedItem['slot'],
      tier: 5,
      rarity: 'kadim' as const,
      upgradeLevel: 10,
    }));
    const lord = lordContribution(100, tamSet);

    const ordu: Army = { suvari: 280 };
    const a = side(ordu, false, 0, 100);
    a.gearBonus = { saldiri: 0.3, savunma: 0.3, can: 0.3 };
    const bos = simulateBattle(a, side({ mizrakci: 1 }, true), 'guc-ordu', ctx);
    const orduGucu = bos.rounds[0]!.saldiranGuc;

    const pay = (lord / (lord + orduGucu)) * 100;
    expect(pay).toBeGreaterThanOrEqual(15);
    expect(pay).toBeLessThanOrEqual(25);
  });

  it('tek eşyanın gücü tavanı aşmaz', () => {
    const max = itemPower({ tier: 5, rarity: 'kadim', upgradeLevel: 10 });
    expect(max).toBeCloseTo(220 * 2.8 * 1.8, 0);
  });
});

describe('savaş sonuç bandı', () => {
  it('kazanan her zaman kayıp verir, kaybeden her zaman daha çok kaybeder', () => {
    const senaryolar: [string, Army, Army][] = [
      ['ezici', { mizrakci: 300 }, { mizrakci: 50 }],
      ['belirgin', { mizrakci: 150 }, { mizrakci: 100 }],
      ['başabaş', { mizrakci: 100 }, { mizrakci: 98 }],
      ['zayıf saldırı', { mizrakci: 60 }, { mizrakci: 100 }],
    ];
    for (const [ad, atk, def] of senaryolar) {
      const r = simulateBattle(side(atk, false), side(def, true), `band-${ad}`, ctx);
      const atkToplam = Object.values(atk).reduce((s, n) => s + n, 0);
      const defToplam = Object.values(def).reduce((s, n) => s + n, 0);
      const atkOran = (r.attackerLosses.mizrakci ?? 0) / atkToplam;
      const defOran = (r.defenderLosses.mizrakci ?? 0) / defToplam;

      if (r.winner === 'attacker') {
        expect(atkOran, `${ad}: kazanan kayıp vermeli`).toBeGreaterThan(0);
        expect(defOran, `${ad}: kaybeden daha çok kaybetmeli`).toBeGreaterThan(atkOran);
      } else {
        expect(defOran, `${ad}: kazanan kayıp vermeli`).toBeGreaterThan(0);
        expect(atkOran, `${ad}: kaybeden daha çok kaybetmeli`).toBeGreaterThan(defOran);
      }
    }
  });
});

describe('harita', () => {
  it('bölge kıtlığı korunur — oyuncu başına 0.75\'ten az bölge', () => {
    const eldeEdilebilir = WORLD_MAP.region_count - 1; // Taht Kalesi hariç
    expect(eldeEdilebilir / B.dunya.oyuncu_kapasitesi).toBeLessThan(0.75);
  });

  it('Taht Kalesi dünyada tektir ve en güçlü garnizona sahiptir', () => {
    const taht = WORLD_MAP.regions.filter((r) => r.type === 'taht');
    expect(taht).toHaveLength(1);
    const tahtGuc = Object.values(taht[0]!.npc_garrison).reduce((s, n) => s + n, 0);
    for (const r of WORLD_MAP.regions.filter((x) => x.type !== 'taht')) {
      const g = Object.values(r.npc_garrison).reduce((s, n) => s + n, 0);
      expect(tahtGuc).toBeGreaterThan(g);
    }
  });

  it('merkeze yaklaştıkça gelir çarpanı artar', () => {
    const ring = (n: number) => WORLD_MAP.regions.find((r) => r.ring === n)!.income_mult;
    expect(ring(1)).toBeGreaterThan(ring(2));
    expect(ring(2)).toBeGreaterThan(ring(3));
    expect(ring(3)).toBeGreaterThan(ring(4));
  });
});

describe('kuşam seviyesi', () => {
  const esya = (tier: number) => ({ tier });

  it('hiç ekipman yokken en alt seviyede kalır', () => {
    expect(kusamSeviyesi([])).toBe(1);
  });

  it('tek bir efsanevi parça lordu efsanevi göstermez', () => {
    // Altı yuvanın beşi boşken bir T5 kılıç, figürü zirveye taşımamalı.
    expect(kusamSeviyesi([esya(5)])).toBe(1);
  });

  it('altı yuva da doluysa ortalamayı verir', () => {
    expect(kusamSeviyesi([3, 3, 3, 3, 3, 3].map(esya))).toBe(3);
  });

  it('aşağı yuvarlar — yarım kalan kuşam üst kademede görünmez', () => {
    // Üç T5 + üç boş = 15/6 = 2.5 -> 2
    expect(kusamSeviyesi([5, 5, 5].map(esya))).toBe(2);
  });

  it('tam takım T5 zirveyi verir ve orada durur', () => {
    expect(kusamSeviyesi([5, 5, 5, 5, 5, 5].map(esya))).toBe(5);
  });
});

describe('karşı-birim ipuçları', () => {
  it('ordulardan biri boşsa ipucu yok', () => {
    expect(karsiIpuclari({ okcu: 10 }, {})).toEqual([]);
    expect(karsiIpuclari({}, { suvari: 10 })).toEqual([]);
  });

  it('lehte eşleşmeyi bulur', () => {
    const i = karsiIpuclari({ mizrakci: 20 }, { suvari: 10 });
    expect(i).toHaveLength(1);
    expect(i[0]).toMatchObject({ yon: 'guclu', benim: 'mizrakci', onun: 'suvari', carpan: 1.5 });
  });

  it('aleyhte eşleşmeyi de bulur — oyuncu neyi göndermemesi gerektiğini de öğrenmeli', () => {
    const i = karsiIpuclari({ okcu: 20 }, { suvari: 10 });
    expect(i).toHaveLength(1);
    expect(i[0]).toMatchObject({ yon: 'zayif', benim: 'okcu', onun: 'suvari', carpan: 1.5 });
  });

  it('savaşı belirleyen eşleşmeyi öne, alakasızı sona koyar', () => {
    // 100 mızrakçı + 1 okçu, karşıda 100 süvari + 1 mızrakçı.
    // Savaşı belirleyen: mızrakçılarım süvarilerini kırıyor (ağırlık ~0.98).
    // Alakasız: tek okçum tek mızrakçısını kırıyor (ağırlık ~0.0001).
    const i = karsiIpuclari({ mizrakci: 100, okcu: 1 }, { suvari: 100, mizrakci: 1 }, 3);
    expect(i).toHaveLength(3);
    expect(i[0]).toMatchObject({ yon: 'guclu', benim: 'mizrakci', onun: 'suvari' });
    expect(i[2]).toMatchObject({ yon: 'guclu', benim: 'okcu', onun: 'mizrakci' });
    expect(i[0]!.agirlik).toBeGreaterThan(i[2]!.agirlik * 100);
  });

  it('sıralama kararlı: aynı girdi aynı sırayı verir', () => {
    const a = { mizrakci: 10, okcu: 10, suvari: 10 };
    const b = { mizrakci: 10, okcu: 10, suvari: 10 };
    expect(karsiIpuclari(a, b, 6)).toEqual(karsiIpuclari(a, b, 6));
  });

  it('mancınık tuzağı: tahkimat varsa iyi, canlı orduya karşı boşa', () => {
    expect(kusatmaDurumu({ kusatma: 3 }, { milis: 50 }, 0.4)).toBe('kaleye_iyi');
    expect(kusatmaDurumu({ kusatma: 3 }, { milis: 50 }, 0)).toBe('bosa_gidiyor');
    expect(kusatmaDurumu({ okcu: 3 }, { milis: 50 }, 0)).toBeNull();
    // Boş hedefte uyarı yok: yağmalanacak bir şey varsa mancınık zarar etmiyor.
    expect(kusatmaDurumu({ kusatma: 3 }, {}, 0)).toBeNull();
  });

  it('mancınık çarpanları balance.json ile aynı', () => {
    const c = kusatmaCarpanlari();
    expect(c.kale).toBe(2.0);
    expect(c.birim).toBe(0.5);
  });
});
