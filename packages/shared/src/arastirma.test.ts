import { describe, expect, it } from 'vitest';
import {
  ARASTIRMALAR,
  etkiCumlesi,
  arastirmaBonusu,
  arastirmaDugumleri,
  arastirmaDugumu,
  arastirmaDurumlari,
  arastirmaIlerlemesi,
  arastirmaMaliyeti,
  arastirmaOnkosulu,
  arastirmaSuresiSn,
  bosArastirmaBonusu,
} from './arastirma.js';
import { commandCapacity, malikaneIncome, storageCapacity, upkeepPerHour } from './index.js';
import { egitimSuresiSn, marchDurationSec } from './march.js';
import { simulateBattle } from './combat.js';
import { B } from './balance.js';
import type { Army, Side } from './types.js';
import { bosGeneralBonus } from './types.js';

describe('ağaç verisi tutarlı', () => {
  it('üç dal, her dalda beş kademe', () => {
    expect(ARASTIRMALAR).toHaveLength(3);
    for (const dal of ARASTIRMALAR) {
      const kademeler = dal.dugumler.map((d) => d.kademe).sort((a, b) => a - b);
      expect(kademeler).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('düğüm anahtarları benzersiz', () => {
    const anahtarlar = arastirmaDugumleri().map((d) => d.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it('her düğümün en az bir etkisi var ve etkisi motora bağlı', () => {
    // Motorda karşılığı olmayan bir etki, oyuncudan alınmış kaynak
    // demek: araştırma biter, hiçbir şey değişmez.
    const bos = bosArastirmaBonusu();
    for (const d of arastirmaDugumleri()) {
      expect(Object.keys(d.etki).length).toBeGreaterThan(0);
      const b = arastirmaBonusu([d.key]);
      const degisen = (Object.keys(bos) as (keyof typeof bos)[]).filter((k) => b[k] !== bos[k]);
      expect(degisen.length).toBeGreaterThan(0);
    }
  });

  it('her düğümün okunur bir açıklaması var', () => {
    for (const d of arastirmaDugumleri()) {
      expect(d.aciklama.length).toBeGreaterThan(40);
      expect(d.ad.length).toBeGreaterThan(3);
    }
  });

  it('üst kademe daha pahalı ve daha uzun', () => {
    for (let k = 2; k <= 5; k++) {
      expect(arastirmaMaliyeti(k).altin).toBeGreaterThan(arastirmaMaliyeti(k - 1).altin);
      expect(arastirmaSuresiSn(k)).toBeGreaterThan(arastirmaSuresiSn(k - 1));
    }
  });

  it('lord seviyesi şartı kademeyle birlikte artıyor', () => {
    for (const dal of ARASTIRMALAR) {
      const sirali = [...dal.dugumler].sort((a, b) => a.kademe - b.kademe);
      for (let i = 1; i < sirali.length; i++) {
        expect(sirali[i]!.lord_seviyesi).toBeGreaterThan(sirali[i - 1]!.lord_seviyesi);
      }
    }
  });
});

describe('etkiler okunur cümleye çevriliyor', () => {
  // Oyuncunun şikâyeti: "araştırma kısmında oranlar ve sayısal değerler
  // yok, depo kapasitesi ne kadar artacak belli değil." Yüz binlerce
  // kaynak bedeli olan bir karar, ne kazandıracağını söylemeden verilemez.
  it('her düğümün her etkisi bir cümleye dönüyor', () => {
    for (const d of arastirmaDurumlari([], 99)) {
      expect(d.etkiSatirlari.length).toBe(Object.keys(d.etki).length);
      for (const satir of d.etkiSatirlari) expect(satir.length).toBeGreaterThan(5);
    }
  });

  it('hiçbir etki "anahtar: sayı" ham hâline düşmüyor', () => {
    // Veri dosyasına yeni bir etki eklenip etkiCumlesi'ne satır
    // yazılmazsa cümle ham anahtarı basıyor. Bu test onu yakalar.
    for (const d of arastirmaDurumlari([], 99)) {
      for (const satir of d.etkiSatirlari) {
        expect(satir).not.toMatch(/^[a-z_]+: /);
      }
    }
  });

  it('cümleler sayıyı içeriyor', () => {
    expect(etkiCumlesi('depo_carpani', 0.5)).toContain('%50');
    expect(etkiCumlesi('komuta_kapasitesi', 40)).toContain('40');
    expect(etkiCumlesi('gunluk_saldiri', 1)).toContain('1');
  });

  it('indirimler eksi işaretiyle değil "azalıyor" diliyle yazılıyor', () => {
    // egitim_maliyeti veri dosyasında NEGATİF; oyuncuya "−%12" diye
    // gösterilmeli, "+%-12" diye değil.
    const c = etkiCumlesi('egitim_maliyeti', -0.12);
    expect(c).toContain('%12');
    expect(c).not.toContain('-12');
    expect(c).not.toContain('+%');
  });
});

describe('önkoşul zinciri', () => {
  it('1. kademenin önkoşulu yok, sonrakiler bir öncekine bağlı', () => {
    for (const dal of ARASTIRMALAR) {
      for (const d of dal.dugumler) {
        const on = arastirmaOnkosulu(d.key);
        if (d.kademe === 1) expect(on).toBeNull();
        else expect(on?.kademe).toBe(d.kademe - 1);
      }
    }
  });

  it('kilitli düğüm sebebini yazıyor', () => {
    const durumlar = arastirmaDurumlari([], 1);
    const kilitli = durumlar.filter((d) => !d.acik && !d.tamamlandi);
    expect(kilitli.length).toBeGreaterThan(0);
    for (const d of kilitli) expect((d.engel ?? '').length).toBeGreaterThan(10);
  });

  it('önkoşul bitince üst kademe açılıyor', () => {
    const ilk = ARASTIRMALAR[0]!.dugumler.find((d) => d.kademe === 1)!;
    const ikinci = ARASTIRMALAR[0]!.dugumler.find((d) => d.kademe === 2)!;
    const once = arastirmaDurumlari([], 99).find((d) => d.key === ikinci.key);
    const sonra = arastirmaDurumlari([ilk.key], 99).find((d) => d.key === ikinci.key);
    expect(once?.acik).toBe(false);
    expect(sonra?.acik).toBe(true);
  });

  it('seviyesi yetmeyen açılmıyor', () => {
    const ilk = ARASTIRMALAR[0]!.dugumler.find((d) => d.kademe === 1)!;
    const d = arastirmaDurumlari([], 1).find((x) => x.key === ilk.key);
    expect(d?.acik).toBe(false);
    expect(d?.engel).toContain('seviyesi');
  });

  it('tamamlanan düğüm tekrar açılmıyor', () => {
    const ilk = ARASTIRMALAR[0]!.dugumler.find((d) => d.kademe === 1)!;
    const d = arastirmaDurumlari([ilk.key], 99).find((x) => x.key === ilk.key);
    expect(d?.tamamlandi).toBe(true);
    expect(d?.acik).toBe(false);
  });

  it('bilinmeyen anahtar ilerlemeyi şişirmiyor', () => {
    const i = arastirmaIlerlemesi(['ejderha_terbiyesi', 'ambarlar']);
    expect(i.biten).toBe(1);
    expect(i.toplam).toBe(arastirmaDugumleri().length);
  });
});

describe('etkiler motorda gerçekten işliyor', () => {
  it('Ambarlar depoyu büyütüyor', () => {
    const once = storageCapacity(10);
    const sonra = storageCapacity(10, arastirmaBonusu(['ambarlar']));
    expect(sonra).toBeGreaterThan(once);
  });

  it('Değirmenler malikâne gelirini artırıyor', () => {
    const once = malikaneIncome(10);
    const sonra = malikaneIncome(10, arastirmaBonusu(['degirmenler']));
    expect(sonra.altin).toBeGreaterThan(once.altin);
  });

  it('Tahıl Ambarları bakımı ucuzlatıyor', () => {
    const ordu: Army = { mizrakci: 100 };
    const once = upkeepPerHour(ordu);
    const sonra = upkeepPerHour(ordu, undefined, arastirmaBonusu(['tahil_ambarlari']));
    expect(sonra).toBeLessThan(once);
  });

  it('Sancak Beyliği komuta kapasitesini büyütüyor', () => {
    const once = commandCapacity(10);
    const sonra = commandCapacity(10, undefined, arastirmaBonusu(['sancak_beyligi']));
    expect(sonra).toBeGreaterThan(once);
  });

  it('Talim Meydanı eğitimi kısaltıyor ama sıfırlamıyor', () => {
    const once = egitimSuresiSn(100, 10);
    const sonra = egitimSuresiSn(100, 10, false, arastirmaBonusu(['talim_meydani']));
    expect(sonra).toBeLessThan(once);
    expect(sonra).toBeGreaterThan(0);
  });

  it('Seferî Ordu yürüyüşü kısaltıyor', () => {
    const ordu: Army = { mizrakci: 10 };
    const once = marchDurationSec(5, ordu);
    const sonra = marchDurationSec(5, ordu, undefined, undefined, arastirmaBonusu(['seferi_ordu']));
    expect(sonra).toBeLessThanOrEqual(once);
  });

  it('Zırh Atölyesi ve Ok Atölyesi savaşta güç değiştiriyor', () => {
    const taraf = (arastirma: Side['arastirma']): Side => ({
      units: { mizrakci: 100 },
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: 0,
      isDefender: false,
      arastirma,
    });
    const dusman: Side = { ...taraf(null), isDefender: true };
    const ctx = {
      defenderStore: { altin: 0, demir: 0, erzak: 0 },
      attackerCunning: 0,
      canCapture: true,
    };
    const b = arastirmaBonusu(['zirh_atolyesi', 'ok_atolyesi']);
    const dus = simulateBattle(taraf(null), dusman, 'tohum', ctx);
    const guclu = simulateBattle(
      taraf({ orduSaldiri: b.orduSaldiri, orduSavunma: b.orduSavunma, kaleSavunmasi: 0, yagma: 0 }),
      dusman,
      'tohum',
      ctx,
    );
    expect(guclu.rounds[0]!.saldiranGuc).toBeGreaterThan(dus.rounds[0]!.saldiranGuc);
  });

  it('Sur Ustalığı yalnız SAVUNANIN tahkimatını büyütüyor', () => {
    const yap = (isDefender: boolean, arastirma: Side['arastirma']): Side => ({
      units: { mizrakci: 100 },
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: isDefender ? 0.3 : 0,
      isDefender,
      arastirma,
    });
    const b = arastirmaBonusu(['sur_ustaligi']);
    const etki = { orduSaldiri: 0, orduSavunma: 0, kaleSavunmasi: b.kaleSavunmasi, yagma: 0 };
    const ctx = {
      defenderStore: { altin: 0, demir: 0, erzak: 0 },
      attackerCunning: 0,
      canCapture: true,
    };
    const dus = simulateBattle(yap(false, null), yap(true, null), 'tohum', ctx);
    const surlu = simulateBattle(yap(false, null), yap(true, etki), 'tohum', ctx);
    expect(surlu.rounds[0]!.savunanGuc).toBeGreaterThan(dus.rounds[0]!.savunanGuc);
  });

  it('araştırmasız oyuncu hiçbir yerde ceza almıyor', () => {
    const bos = arastirmaBonusu([]);
    expect(storageCapacity(10, bos)).toBe(storageCapacity(10));
    expect(malikaneIncome(10, bos)).toEqual(malikaneIncome(10));
    expect(commandCapacity(10, undefined, bos)).toBe(commandCapacity(10));
    expect(upkeepPerHour({ mizrakci: 10 }, undefined, bos)).toBe(upkeepPerHour({ mizrakci: 10 }));
  });
});

describe('maliyet eğrisi anlamlı', () => {
  it('ilk kademe erken erişilebilir, son kademe uzun soluklu', () => {
    // Kalıcı dünyada araştırma "tavana gelen ne yapacak" sorusunun
    // cevabı: on beş düğümün tamamı günlerce süren bir iş olmalı.
    const toplamSaat =
      ARASTIRMALAR.reduce(
        (s, dal) => s + dal.dugumler.reduce((x, d) => x + arastirmaSuresiSn(d.kademe), 0),
        0,
      ) / 3600;
    expect(arastirmaSuresiSn(1)).toBeLessThanOrEqual(3600);
    expect(toplamSaat).toBeGreaterThan(48);
  });

  it('maliyet formülü balance.json’dan geliyor', () => {
    const beklenen = Math.round(
      B.arastirma.maliyet_taban.altin * Math.pow(3, B.arastirma.maliyet_us),
    );
    expect(arastirmaMaliyeti(3).altin).toBe(beklenen);
  });
});

describe('düğüm arama', () => {
  it('var olmayan anahtar null dönüyor, çökmüyor', () => {
    expect(arastirmaDugumu('yok_boyle_bir_sey')).toBeNull();
    expect(arastirmaBonusu(['yok_boyle_bir_sey'])).toEqual(bosArastirmaBonusu());
  });
});
