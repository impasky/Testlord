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
  GENERAL_LEVEL,
  generalLevelFromXp,
  generalLevelMultiplier,
  generalSavasSonrasi,
  generalSavasXp,
  generalToplamXp,
  generalXpForLevel,
  generalYaralanma,
  basarimSayaci,
  calculateLoot,
  liderAviGecerliMi,
  liderAviYagmaBonusu,
  basarimlar,
  eleGecirmeEsigi,
  gunNumarasi,
  gunlukGorevler,
  gunlukOdul,
  gunlukSayaci,
  odulAlindiMi,
  seriCarpani,
  karsiIpuclari,
  kesifDurumu,
  kesifGecerlilikSn,
  kesifSuresiSn,
  kusamSeviyesi,
  kusatmaCarpanlari,
  kusatmaDurumu,
  ortalamaGucPayi,
  seriGuncelle,
  savasSebepleri,
  lordContribution,
  malikaneIncome,
  marchDurationSec,
  maxRegions,
  simulateBattle,
  upkeepPerHour,
  xpForLevel,
  yakalanmaIhtimali,
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

describe('savaş sebepleri', () => {
  const turlar = (a: number, d: number) =>
    Array.from({ length: 5 }, () => ({ saldiranGuc: a, savunanGuc: d }));

  it('ortalama güç payı: eşit güçte 0.5', () => {
    expect(ortalamaGucPayi(turlar(100, 100))).toBeCloseTo(0.5);
  });

  it('boş turlarda 0.5 döner, bölme hatası vermez', () => {
    expect(ortalamaGucPayi([{ saldiranGuc: 0, savunanGuc: 0 }])).toBe(0.5);
    expect(ortalamaGucPayi([])).toBe(0.5);
  });

  it('güç farkı belirginse sebep olarak yazılır', () => {
    const s = savasSebepleri({
      bakis: 'saldiran',
      saldiranOrdu: { milis: 100 },
      savunanOrdu: { milis: 20 },
      turlar: turlar(300, 100),
      saldiranKazandi: true,
      eleGecirdi: true,
      tahkimatBonusu: 0,
    });
    const guc = s.find((x) => x.tur === 'guc');
    expect(guc).toMatchObject({ lehte: true });
    expect(guc!.deger).toBeGreaterThan(2);
  });

  it('şansa kalmış savaşta güç sebebi yazılmaz', () => {
    // Tur başına ±%7 varyans var; 1.15'in altındaki fark sonucu açıklamıyor.
    const s = savasSebepleri({
      bakis: 'saldiran',
      saldiranOrdu: { milis: 100 },
      savunanOrdu: { milis: 95 },
      turlar: turlar(105, 100),
      saldiranKazandi: true,
      eleGecirdi: true,
      tahkimatBonusu: 0,
    });
    expect(s.find((x) => x.tur === 'guc')).toBeUndefined();
  });

  it('dar zafer: kazandı ama eşiği aşamadı', () => {
    const s = savasSebepleri({
      bakis: 'saldiran',
      saldiranOrdu: { milis: 100 },
      savunanOrdu: { milis: 90 },
      turlar: turlar(110, 100),
      saldiranKazandi: true,
      eleGecirdi: false,
      tahkimatBonusu: 0,
    });
    const dar = s.find((x) => x.tur === 'dar_zafer');
    expect(dar).toBeDefined();
    // Saldıranın aleyhine: kazandı ama bölgeyi alamadı.
    expect(dar!.lehte).toBe(false);
    expect(dar!.deger).toBe(eleGecirmeEsigi());
  });

  it('sebepler bakış açısına göre dönüyor', () => {
    const girdi = {
      saldiranOrdu: { okcu: 100 } as Army,
      savunanOrdu: { suvari: 100 } as Army,
      turlar: turlar(100, 300),
      saldiranKazandi: false,
      eleGecirdi: false,
      tahkimatBonusu: 0.3,
    };
    const saldiran = savasSebepleri({ ...girdi, bakis: 'saldiran' });
    const savunan = savasSebepleri({ ...girdi, bakis: 'savunan' });

    // Aynı savaş, ters işaret: saldıranın aleyhine olan savunanın lehine.
    expect(saldiran.find((x) => x.tur === 'guc')!.lehte).toBe(false);
    expect(savunan.find((x) => x.tur === 'guc')!.lehte).toBe(true);
    expect(saldiran.find((x) => x.tur === 'tahkimat')!.lehte).toBe(false);
    expect(savunan.find((x) => x.tur === 'tahkimat')!.lehte).toBe(true);

    // Eşleşme de ters: saldıranın okçusu süvariye yem, savunanın süvarisi
    // okçuyu kırıyor.
    expect(saldiran.find((x) => x.tur === 'karsi')).toMatchObject({
      lehte: false,
      benim: 'okcu',
      onun: 'suvari',
    });
    expect(savunan.find((x) => x.tur === 'karsi')).toMatchObject({
      lehte: true,
      benim: 'suvari',
      onun: 'okcu',
    });
  });

  it('en fazla dört sebep döner', () => {
    const s = savasSebepleri({
      bakis: 'saldiran',
      saldiranOrdu: { okcu: 50, mizrakci: 50, kusatma: 5 },
      savunanOrdu: { suvari: 50, mizrakci: 50 },
      turlar: turlar(400, 100),
      saldiranKazandi: true,
      eleGecirdi: false,
      tahkimatBonusu: 0.4,
    });
    expect(s.length).toBeLessThanOrEqual(4);
  });
});

describe('başarımlar', () => {
  const bos = {
    bolge: 0, taht: 0, pvp_galibiyet: 0, elo: 1200, komuta_orani: 0,
    birim_cesidi: 0, general_slot_orani: 0, kusanik: 0, en_yuksek_tier: 0,
    seviye: 1, en_yuksek_bolge_seviyesi: 0,
  };

  it('yeni oyuncuda hiçbiri tamam değil ama hepsi görünür', () => {
    const k = basarimlar(bos);
    const { tamam, toplam } = basarimSayaci(k);
    expect(tamam).toBe(0);
    expect(toplam).toBeGreaterThan(10);
    // Görünür olmaları önemli: kaybolan bir başarımın eksik olduğu
    // anlaşılmaz.
    expect(k.every((x) => x.basarimlar.length > 0)).toBe(true);
  });

  it('ölçüt hedefe ulaşınca tamamlanır', () => {
    const k = basarimlar({ ...bos, bolge: 5 });
    const hepsi = k.flatMap((x) => x.basarimlar);
    expect(hepsi.find((b) => b.key === 'ilk_fetih')!.tamam).toBe(true);
    expect(hepsi.find((b) => b.key === 'bes_bolge')!.tamam).toBe(true);
    expect(hepsi.find((b) => b.key === 'on_bolge')!.tamam).toBe(false);
  });

  it('hedefi aşan değer tamamlanmayı bozmaz', () => {
    const k = basarimlar({ ...bos, seviye: 60 });
    const hepsi = k.flatMap((x) => x.basarimlar);
    expect(hepsi.find((b) => b.key === 'seviye_10')!.tamam).toBe(true);
    expect(hepsi.find((b) => b.key === 'seviye_30')!.tamam).toBe(true);
  });

  it('her başarımın ölçütü tanımlı — sessizce sıfırda kalan yok', () => {
    // Bir ölçüt adı yanlış yazılırsa başarım hep 0 ilerlemede kalır ve
    // bu gözle fark edilmez. Test her ölçütün BasarimOlcutleri'nde
    // gerçekten var olduğunu doğruluyor.
    const dolu = {
      bolge: 99, taht: 1, pvp_galibiyet: 99, elo: 9999, komuta_orani: 100,
      birim_cesidi: 5, general_slot_orani: 100, kusanik: 6, en_yuksek_tier: 5,
      seviye: 99, en_yuksek_bolge_seviyesi: 5,
    };
    const k = basarimlar(dolu);
    const eksik = k.flatMap((x) => x.basarimlar).filter((b) => !b.tamam);
    expect(eksik).toEqual([]);
  });
});

describe('lider avı', () => {
  it('küçük dünyada av yok', () => {
    // İki kişilik bir dünyada "lider" anlamsız.
    expect(liderAviGecerliMi(1)).toBe(false);
    expect(liderAviGecerliMi(2)).toBe(false);
    expect(liderAviGecerliMi(3)).toBe(true);
    expect(liderAviGecerliMi(50)).toBe(true);
  });

  it('yağma bonusu balance.json ile aynı', () => {
    expect(liderAviYagmaBonusu()).toBe(0.5);
  });

  it('yağma bölgede duran kaynaktan fazla olamaz', () => {
    // Kritik: lider avı bonusu yağma ORANINI artırıyor. Oran 1'i geçerse
    // saldıran yoktan kaynak kazanır ve bölge deposu Math.max(0,...) ile
    // korunduğu için hata sessiz kalır.
    const depo = { altin: 1000, demir: 1000, erzak: 1000 };
    const ordu = { milis: 10_000 }; // taşıma kapasitesi sınırlamasın
    const yagma = calculateLoot(depo, ordu, 500, 5); // absürt bonuslar
    expect(yagma.altin).toBeLessThanOrEqual(depo.altin);
    expect(yagma.demir).toBeLessThanOrEqual(depo.demir);
    expect(yagma.erzak).toBeLessThanOrEqual(depo.erzak);
  });

  it('lider avı yağmayı artırıyor ama sınırın içinde', () => {
    const depo = { altin: 10_000, demir: 0, erzak: 0 };
    const ordu = { milis: 10_000 };
    const normal = calculateLoot(depo, ordu, 0, 0);
    const avli = calculateLoot(depo, ordu, 0, liderAviYagmaBonusu());
    expect(avli.altin).toBeGreaterThan(normal.altin);
    expect(avli.altin).toBeLessThanOrEqual(depo.altin);
  });
});

describe('general seviyesi', () => {
  it('toplam XP çevrimi seviye okumasının tersi', () => {
    // Kayıtta (level, xp) tutuluyor, generalLevelFromXp toplam XP bekliyor.
    // Çevrim kaymışsa XP eklerken bir eğri, seviye okurken başka bir eğri
    // kullanılır ve general sessizce yanlış seviyede kalır. api tarafında
    // eğrinin ikinci bir kopyası duruyordu; bu test onun geri gelmesini
    // yakalar.
    for (let lv = 1; lv <= GENERAL_LEVEL.max; lv++) {
      const geri = generalLevelFromXp(generalToplamXp(lv, 0));
      expect(geri.level).toBe(lv);
      expect(geri.xpIntoLevel).toBe(0);
    }
  });

  it('seviye içindeki ilerleme de korunuyor', () => {
    const toplam = generalToplamXp(5, 137);
    expect(generalLevelFromXp(toplam)).toEqual({ level: 5, xpIntoLevel: 137 });
  });

  it('savaş XP payı generals.json ile aynı', () => {
    expect(generalSavasXp(1000)).toBe(Math.round(1000 * GENERAL_LEVEL.xp_pay));
    expect(generalSavasXp(0)).toBe(0);
  });

  it('yeterli XP seviye atlatır ve atlanan sayısını söyler', () => {
    // Sv1'den atlamak için gereken XP, generalin savaşta kazandığının katı.
    const gerekli = generalXpForLevel(1);
    const s = generalSavasSonrasi(1, 0, gerekli / GENERAL_LEVEL.xp_pay);
    expect(s.level).toBe(2);
    expect(s.atlanan).toBe(1);
  });

  it('az XP seviye atlatmaz ama çubuğu doldurur', () => {
    const s = generalSavasSonrasi(3, 0, 10);
    expect(s.level).toBe(3);
    expect(s.atlanan).toBe(0);
    expect(s.xpIntoLevel).toBeGreaterThan(0);
  });

  it('tavanda XP birikmiyor, seviye taşmıyor', () => {
    // Tavanda xpIntoLevel 0 kalmalı: dolmayan bir çubuk göstermek
    // oyuncuya sonu olmayan bir ilerleme sözü verir.
    const s = generalSavasSonrasi(GENERAL_LEVEL.max, 0, 10_000_000);
    expect(s.level).toBe(GENERAL_LEVEL.max);
    expect(s.atlanan).toBe(0);
    expect(s.xpIntoLevel).toBe(0);
  });

  it('yaralanma sayıları veri dosyasından okunuyor', () => {
    const y = generalYaralanma();
    expect(y.ihtimal).toBeGreaterThan(0);
    expect(y.ihtimal).toBeLessThan(1);
    expect(y.saat).toBeGreaterThan(0);
  });

  it('seviye pasifi güçlendiriyor ama katlamıyor', () => {
    // Sv20 çarpanı 1.38 civarı: general savaşı tek başına kazanmamalı.
    expect(generalLevelMultiplier(1)).toBe(1);
    expect(generalLevelMultiplier(GENERAL_LEVEL.max)).toBeGreaterThan(1.3);
    expect(generalLevelMultiplier(GENERAL_LEVEL.max)).toBeLessThan(1.5);
  });
});

describe('casusluk', () => {
  it('keşif aynı mesafeye giden yürüyüşten hızlı', () => {
    // Yavaş olsaydı "önce keşfet sonra saldır" zincirinin toplam süresi
    // oyuncuyu keşiften vazgeçirirdi; casusluk ölü bir sistem olurdu.
    for (const mesafe of [1, 3, 6]) {
      const yuruyus = marchDurationSec(mesafe, { mizrakci: 10 });
      expect(kesifSuresiSn(mesafe)).toBeLessThan(yuruyus);
    }
  });

  it('keşif süresi mesafeyle artıyor', () => {
    expect(kesifSuresiSn(4)).toBeGreaterThan(kesifSuresiSn(1));
    expect(kesifSuresiSn(0)).toBeGreaterThan(0);
  });

  it('Kurnazlık yakalanma riskini düşürüyor', () => {
    expect(yakalanmaIhtimali(30)).toBeLessThan(yakalanmaIhtimali(5));
  });

  it('yakalanma riski hiç sıfırlanmıyor', () => {
    // "Artık hiç yakalanmam" noktası olsaydı casusluk yüksek Kurnazlıklı
    // oyuncu için bedava bilgiye dönerdi ve kararın gerilimi kaybolurdu.
    expect(yakalanmaIhtimali(9999)).toBe(B.casusluk.en_dusuk_yakalanma);
    expect(yakalanmaIhtimali(9999)).toBeGreaterThan(0);
  });

  it('yakalanma riski her zaman 0 ile 1 arasında', () => {
    for (const k of [0, 5, 20, 60, 1000]) {
      expect(yakalanmaIhtimali(k)).toBeGreaterThan(0);
      expect(yakalanmaIhtimali(k)).toBeLessThan(1);
    }
  });

  it('rapor süresi geçince silinmiyor, ESKİ oluyor', () => {
    const alindi = new Date('2026-09-03T00:00:00Z');
    const taze = kesifDurumu(alindi, new Date('2026-09-03T01:00:00Z'));
    expect(taze).toEqual({ var: true, eski: false, yasSn: 3600 });

    const gecmis = new Date(alindi.getTime() + (kesifGecerlilikSn() + 60) * 1000);
    const eski = kesifDurumu(alindi, gecmis);
    expect(eski.var).toBe(true);
    expect(eski.eski).toBe(true);
  });

  it('rapor yoksa durum boş', () => {
    expect(kesifDurumu(null, new Date())).toEqual({ var: false, eski: false, yasSn: 0 });
  });
});

describe('günlük ödül', () => {
  it('ödül malikâne gelirinden türüyor — sabit sayı yok', () => {
    // Tek kaynak kontrolü: malikâne gelirini değiştiren biri ödülü
    // düzeltmeyi unutamamalı, çünkü ödül ondan hesaplanıyor.
    const seviye = 1;
    const gelir = malikaneIncome(seviye);
    const o = gunlukOdul(seviye, 0);
    expect(o.altin).toBe(Math.round(gelir.altin * B.gunluk_odul.malikane_saati));
  });

  it('seviye büyüdükçe ödül de büyüyor — anlamını kaybetmiyor', () => {
    // Sabit ödül Lv60'ta harçlık kalırdı; oranı korumalı.
    const dusuk = gunlukOdul(1, 0);
    const yuksek = gunlukOdul(60, 0);
    expect(yuksek.altin).toBeGreaterThan(dusuk.altin * 3);
  });

  it('seri çarpanı tavanlı — uzun seri kartopu yapmıyor', () => {
    const k = B.gunluk_odul;
    expect(seriCarpani(0)).toBe(1);
    expect(seriCarpani(k.azami_seri_gunu)).toBeCloseTo(
      1 + k.azami_seri_gunu * k.seri_carpani_basina,
    );
    // Tavanın çok üstünde bir seri çarpanı büyütmemeli.
    expect(seriCarpani(1000)).toBe(seriCarpani(k.azami_seri_gunu));
    expect(seriCarpani(1000)).toBeLessThanOrEqual(2);
  });

  it('bozuk seri değeri çarpanı küçültmüyor', () => {
    expect(seriCarpani(-5)).toBe(1);
  });

  it('günlük ödül bir günlük gelirin altında kalıyor', () => {
    // Ödül bir ALIŞKANLIK aracı, gelir kaynağı değil: günlük görevleri
    // yapmak, oyunu hiç açmamaktan iyi olmalı ama gün boyu oynamanın
    // yerini tutmamalı.
    for (const seviye of [1, 20, 60]) {
      const gunluk = malikaneIncome(seviye).altin * 24;
      expect(gunlukOdul(seviye, 999).altin).toBeLessThan(gunluk);
    }
  });

  it('ödül günü aynı gün ise alınmış sayılıyor', () => {
    const simdi = new Date('2026-09-03T22:00:00Z');
    expect(odulAlindiMi(new Date('2026-09-03T01:00:00Z'), simdi)).toBe(true);
    expect(odulAlindiMi(new Date('2026-09-02T23:59:59Z'), simdi)).toBe(false);
    expect(odulAlindiMi(null, simdi)).toBe(false);
  });
});

describe('yağma sonrası kalkan', () => {
  it('kalkan var ve sıfır değil', () => {
    // Sıfır olursa farklı saldırganlar zinciri yeniden açılır (docs/09 §3.6).
    expect(B.korumalar.yagma_sonrasi_saat).toBeGreaterThan(0);
  });

  it('yağma kalkanı fetih kalkanından KISA', () => {
    // Tersi olursa dar zaferle kaybeden, bölgeyi kaptırandan daha uzun
    // korunur: saldıranın "az daha alıyordum" hâli savunana ödül olur ve
    // fethetmek yağmalamaktan cezalı hâle gelir.
    expect(B.korumalar.yagma_sonrasi_saat).toBeLessThan(
      B.korumalar.bolge_ele_gecirme_sonrasi_saat,
    );
  });

  it('kalkan aynı saldırganın bekleme süresini geçmiyor', () => {
    // Kalkan bu süreyi geçerse ikisinden kısası hiç işlemez; iki kuralın
    // biri ölü kural olur ve neyin koruduğu okunamaz hâle gelir.
    expect(B.korumalar.yagma_sonrasi_saat).toBeLessThan(
      B.korumalar.ayni_saldirgan_tekrar_saldiri_saat,
    );
  });

  it('bir günde art arda akın hâlâ mümkün — kalkan oyunu kilitlemiyor', () => {
    // Kalkan savunanı korurken haritayı da dondurmamalı: bir bölgeye bir
    // günde en az birkaç ayrı akın sığmalı, yoksa PvP durur.
    const gunde = 24 / B.korumalar.yagma_sonrasi_saat;
    expect(gunde).toBeGreaterThanOrEqual(4);
  });
});

describe('günlük görevler ve seri', () => {
  it('üç görev, sabit', () => {
    const g = gunlukGorevler({ saldiri: 0, egitim: 0, imar: 0 });
    expect(g).toHaveLength(3);
    expect(gunlukSayaci(g)).toEqual({ tamam: 0, toplam: 3 });
  });

  it('sayaç hedefe ulaşınca görev tamamlanır', () => {
    const g = gunlukGorevler({ saldiri: 2, egitim: 1, imar: 0 });
    expect(gunlukSayaci(g)).toEqual({ tamam: 2, toplam: 3 });
    expect(g.find((x) => x.key === 'imar')!.tamam).toBe(false);
  });

  it('ilk giriş seriyi 1 yapar', () => {
    expect(seriGuncelle(0, null, new Date('2026-09-03T10:00:00Z'))).toEqual({
      seri: 1,
      bugunIlk: true,
    });
  });

  it('aynı gün ikinci giriş seriyi artırmaz', () => {
    const r = seriGuncelle(4, new Date('2026-09-03T01:00:00Z'), new Date('2026-09-03T23:00:00Z'));
    expect(r).toEqual({ seri: 4, bugunIlk: false });
  });

  it('dün girdiyse seri artar', () => {
    const r = seriGuncelle(4, new Date('2026-09-02T23:00:00Z'), new Date('2026-09-03T00:30:00Z'));
    expect(r).toEqual({ seri: 5, bugunIlk: true });
  });

  it('bir gün atlayınca seri sıfırlanır', () => {
    const r = seriGuncelle(9, new Date('2026-09-01T12:00:00Z'), new Date('2026-09-03T12:00:00Z'));
    expect(r).toEqual({ seri: 1, bugunIlk: true });
  });

  it('gün UTC ile ölçülür — saat dilimi seriyi kopartmaz', () => {
    // Aynı UTC günü içindeki iki uzak saat aynı gün sayılmalı.
    expect(gunNumarasi(new Date('2026-09-03T00:00:01Z'))).toBe(
      gunNumarasi(new Date('2026-09-03T23:59:59Z')),
    );
    expect(gunNumarasi(new Date('2026-09-04T00:00:01Z'))).toBe(
      gunNumarasi(new Date('2026-09-03T00:00:01Z')) + 1,
    );
  });

  it('bozuk veriye dayanıklı: seri 0 kayıtlıysa 1e çıkar', () => {
    const r = seriGuncelle(0, new Date('2026-09-02T12:00:00Z'), new Date('2026-09-03T12:00:00Z'));
    expect(r.seri).toBe(2);
  });
});
