import { describe, expect, it } from 'vitest';
import {
  KARE_SAYISI,
  kareyeDusenAdet,
  bosDizilim,
  dizilimEtkisi,
  dizilimGecerliMi,
  duzenEtkisi,
  kanattaMi,
  kareSatiri,
  kareSutunu,
  taktikDurumlari,
  taktikEtkisi,
  varsayilanDizilim,
} from './duzen.js';
import { simulateBattle } from './combat.js';
import { B, TAKTIKLER } from './balance.js';
import type { Army, Side, UnitType } from './types.js';
import { UNIT_TYPES, bosGeneralBonus } from './types.js';

/** Sade bir taraf; testler yalnız düzeni değiştirip farkı ölçüyor. */
function taraf(units: Army, ek: Partial<Side> = {}): Side {
  return {
    units,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: 0,
    isDefender: false,
    ...ek,
  };
}

/** Bir birimi verilen karelere koyan kısa yol (kare no 1 tabanlı). */
function koy(kareler: Partial<Record<number, UnitType>>) {
  const d = bosDizilim();
  for (const [no, t] of Object.entries(kareler)) d[Number(no) - 1] = t as UnitType;
  return d;
}

describe('ızgara geometrisi', () => {
  it('4x4 = 16 kare', () => {
    expect(KARE_SAYISI).toBe(16);
    expect(B.dizilim.satir * B.dizilim.sutun).toBe(KARE_SAYISI);
  });

  it('1. kare ön-sol, 16. kare arka-sağ', () => {
    expect(kareSatiri(0)).toBe(1);
    expect(kareSutunu(0)).toBe(1);
    expect(kareSatiri(15)).toBe(4);
    expect(kareSutunu(15)).toBe(4);
  });

  it('kanat yalnız 1. ve 4. sütun', () => {
    expect(kanattaMi(0)).toBe(true); // sütun 1
    expect(kanattaMi(1)).toBe(false); // sütun 2
    expect(kanattaMi(2)).toBe(false); // sütun 3
    expect(kanattaMi(3)).toBe(true); // sütun 4
  });
});

describe('dizilim doğrulama', () => {
  it('16 elemanlı ve yalnız bilinen birimlerden oluşan dizilim geçerli', () => {
    expect(dizilimGecerliMi(bosDizilim())).toBe(true);
    expect(dizilimGecerliMi(varsayilanDizilim({ milis: 10, okcu: 5 }))).toBe(true);
  });

  it('yanlış uzunluk ve uydurma birim reddedilir', () => {
    expect(dizilimGecerliMi(Array(15).fill(null))).toBe(false);
    expect(dizilimGecerliMi([...Array(15).fill(null), 'ejderha'])).toBe(false);
    expect(dizilimGecerliMi('dizilim')).toBe(false);
  });
});

describe('varsayılan dizilim cezalandırmaz', () => {
  // En önemli kural: dizilime dokunmayan oyuncu kaybetmemeli. Derinlik
  // isteyene seçenek vermek başka, ilgilenmeyeni cezalandırmak başka.
  it('her birim kendi ideal satırına düşüyor', () => {
    const ordu: Army = { milis: 50, mizrakci: 40, okcu: 30, suvari: 20, kusatma: 3 };
    const d = varsayilanDizilim(ordu);
    for (const t of UNIT_TYPES) {
      if ((ordu[t] ?? 0) <= 0) continue;
      const ideal = B.dizilim.birim_yerlesimi[t].ideal_satir;
      const kareler = d.map((k, i) => (k === t ? i : -1)).filter((i) => i >= 0);
      expect(kareler.length).toBeGreaterThan(0);
      for (const i of kareler) expect(kareSatiri(i)).toBe(ideal);
    }
  });

  it('varsayılanın etkisi negatif değil', () => {
    const ordu: Army = { milis: 50, mizrakci: 40, okcu: 30, suvari: 20, kusatma: 3 };
    const e = dizilimEtkisi(varsayilanDizilim(ordu), ordu);
    expect(e.saldiri).toBeGreaterThanOrEqual(0);
    expect(e.savunma).toBeGreaterThanOrEqual(0);
  });

  it('boş dizilim nötr: hiç ceza yok', () => {
    const ordu: Army = { milis: 50, okcu: 20 };
    const e = dizilimEtkisi(bosDizilim(), ordu);
    expect(e.saldiri).toBe(0);
    expect(e.savunma).toBe(0);
    expect(e.satirlar).toHaveLength(0);
  });
});

describe('mancınık en önde ceza alır', () => {
  // Oyuncunun kendi cümlesi: "mancınık en önde olması mantıklı değil,
  // ceza verilir, oyuncu savaş sonu raporda görür."
  it('ön hattaki mancınık gücü düşürür', () => {
    const ordu: Army = { kusatma: 10 };
    const on = dizilimEtkisi(koy({ 2: 'kusatma' }), ordu); // satır 1, merkez
    const arka = dizilimEtkisi(koy({ 14: 'kusatma' }), ordu); // satır 4, merkez
    expect(on.saldiri).toBeLessThan(0);
    expect(arka.saldiri).toBe(0);
    expect(on.saldiri).toBeLessThan(arka.saldiri);
  });

  it('arka köşe de bedava değil: mancınık kanatta açıkta kalır', () => {
    const ordu: Army = { kusatma: 10 };
    const merkez = dizilimEtkisi(koy({ 14: 'kusatma' }), ordu);
    const kose = dizilimEtkisi(koy({ 13: 'kusatma' }), ordu); // satır 4, sütun 1
    expect(kose.saldiri).toBeLessThan(merkez.saldiri);
  });

  it('ceza raporda cümle olarak görünür', () => {
    const e = dizilimEtkisi(koy({ 2: 'kusatma' }), { kusatma: 10 });
    expect(e.satirlar.length).toBeGreaterThan(0);
    const metin = e.satirlar.join(' ');
    expect(metin).toContain('Mancınık');
    expect(metin).toMatch(/%\d+/); // rakamı da söylüyor
  });

  it('mancınık cezası okçudan ağır: sapma cezaları farklı', () => {
    expect(B.dizilim.birim_yerlesimi.kusatma.satir_sapma_cezasi).toBeGreaterThan(
      B.dizilim.birim_yerlesimi.okcu.satir_sapma_cezasi,
    );
  });
});

describe('kanat ve açık cephe', () => {
  it('kanattaki süvari bonus alır, merkezdeki almaz', () => {
    const ordu: Army = { suvari: 20 };
    const kanat = dizilimEtkisi(koy({ 5: 'suvari' }), ordu); // satır 2 sütun 1
    const merkez = dizilimEtkisi(koy({ 6: 'suvari' }), ordu); // satır 2 sütun 2
    expect(kanat.saldiri).toBeGreaterThan(merkez.saldiri);
  });

  it('ön hatta yakın dövüş yokken savunma cezası yazılır', () => {
    const ordu: Army = { milis: 40, okcu: 40 };
    // Okçu önde, milis arkada saklı
    const e = dizilimEtkisi(koy({ 1: 'okcu', 13: 'milis' }), ordu);
    expect(e.savunma).toBeLessThan(e.saldiri);
    expect(e.satirlar.join(' ')).toContain('Ön hattın açıktı');
  });

  it('etki tavanları aşılmaz', () => {
    // Her şey yanlış yerde: hepsi ön hatta
    const ordu: Army = { kusatma: 100, okcu: 100 };
    const e = dizilimEtkisi(koy({ 1: 'kusatma', 2: 'okcu' }), ordu);
    expect(e.saldiri).toBeGreaterThanOrEqual(-B.dizilim.azami_ceza);
    expect(e.savunma).toBeGreaterThanOrEqual(-B.dizilim.azami_ceza);
  });
});

describe('kareye düşen asker sayısı', () => {
  // Oyuncunun raporu: "17 okçusu varsa ve ikiye bölerse 8'e 8 oluyor,
  // 1 okçu savaşa girmiyor." Motor 17'sini de sayıyordu; yalan söyleyen
  // ekrandı. Yine de sayıların TOPLAMI hiçbir bölünmede eksilmemeli.
  it('artan kaybolmuyor: parçaların toplamı hep tamı veriyor', () => {
    for (const toplam of [1, 7, 17, 100, 253]) {
      for (const kare of [1, 2, 3, 4, 5, 8]) {
        const parcalar = Array.from({ length: kare }, (_, i) => kareyeDusenAdet(toplam, kare, i));
        expect(parcalar.reduce((a, b) => a + b, 0)).toBe(toplam);
      }
    }
  });

  it('17 asker iki kareye 9 + 8 diye bölünüyor', () => {
    expect(kareyeDusenAdet(17, 2, 0)).toBe(9);
    expect(kareyeDusenAdet(17, 2, 1)).toBe(8);
  });

  it('parçalar birbirinden en fazla bir fark ediyor', () => {
    const parcalar = Array.from({ length: 5 }, (_, i) => kareyeDusenAdet(17, 5, i));
    expect(Math.max(...parcalar) - Math.min(...parcalar)).toBeLessThanOrEqual(1);
  });

  it('karesiz birim sıfır dönüyor, çökmüyor', () => {
    expect(kareyeDusenAdet(10, 0, 0)).toBe(0);
  });
});

describe('taktik koşulları', () => {
  it('her taktiğin adı, özeti ve açıklaması var', () => {
    for (const t of TAKTIKLER) {
      expect(t.ad.length).toBeGreaterThan(3);
      expect(t.ozet.length).toBeGreaterThan(5);
      expect(t.aciklama.length).toBeGreaterThan(40);
    }
  });

  it('koşulsuz taktik her orduyla seçilebilir', () => {
    const durumlar = taktikDurumlari({ milis: 1 }, bosDizilim());
    const temkinli = durumlar.find((d) => d.key === 'temkinli_ilerleyis');
    expect(temkinli?.uygun).toBe(true);
  });

  it('süvarisiz orduda Hilal seçilemez ve sebebi yazılı', () => {
    const d = taktikDurumlari({ milis: 100 }, bosDizilim()).find((x) => x.key === 'hilal');
    expect(d?.uygun).toBe(false);
    expect(d?.engel).toBeTruthy();
    expect(d!.engel!.length).toBeGreaterThan(10);
  });

  it('süvari kanattaysa Hilal açılır, merkezdeyse açılmaz', () => {
    const ordu: Army = { suvari: 50, milis: 50 };
    const kanat = koy({ 5: 'suvari', 1: 'milis' });
    const merkez = koy({ 6: 'suvari', 1: 'milis' });
    expect(taktikDurumlari(ordu, kanat).find((x) => x.key === 'hilal')?.uygun).toBe(true);
    expect(taktikDurumlari(ordu, merkez).find((x) => x.key === 'hilal')?.uygun).toBe(false);
  });

  it('mancınık ön hattaysa Kuşatma Düzeni kilitli kalır', () => {
    const ordu: Army = { kusatma: 5, milis: 20 };
    expect(
      taktikDurumlari(ordu, koy({ 13: 'kusatma' })).find((x) => x.key === 'kusatma_duzeni')?.uygun,
    ).toBe(true);
    expect(
      taktikDurumlari(ordu, koy({ 1: 'kusatma' })).find((x) => x.key === 'kusatma_duzeni')?.uygun,
    ).toBe(false);
  });
});

describe('taktik etkisi düşman bileşimine göre ölçekleniyor', () => {
  const ordu: Army = { mizrakci: 100 };
  const dizilim = koy({ 1: 'mizrakci' });

  it('Mızrak Seti süvari dolu düşmana karşı işler', () => {
    const e = taktikEtkisi('mizrak_seti', ordu, dizilim, { suvari: 100 });
    expect(e.saldiri).toBeGreaterThan(0);
  });

  it('süvarisiz düşmana karşı kozu boşa gider ve bunu söyler', () => {
    const e = taktikEtkisi('mizrak_seti', ordu, dizilim, { okcu: 100 });
    expect(e.saldiri).toBe(0);
    expect(e.satirlar.join(' ')).toContain('boşa gitti');
  });

  it('koşulu tutmayan taktik sunucuda sessizce düşer', () => {
    // İstemci uygun olmayan taktiği göndermeyi denese bile.
    const e = taktikEtkisi('hilal', { milis: 100 }, koy({ 1: 'milis' }), { milis: 10 });
    expect(e.saldiri).toBe(0);
    expect(e.savunma).toBe(0);
    expect(e.satirlar).toHaveLength(0);
  });

  it('bilinmeyen taktik anahtarı sessizce nötr', () => {
    const e = taktikEtkisi('ejderha_cagir', ordu, dizilim, { milis: 10 });
    expect(e).toEqual({ saldiri: 0, savunma: 0, ilkTurSaldiri: 0, kaleDelme: 0, satirlar: [] });
  });

  it('hiçbir taktik küresel tavanı aşamaz', () => {
    for (const t of TAKTIKLER) {
      for (const dusman of [{ suvari: 100 }, { okcu: 100 }, { milis: 100 }] as Army[]) {
        const e = taktikEtkisi(
          t.key,
          { suvari: 40, mizrakci: 40, okcu: 40, kusatma: 5 },
          koy({ 5: 'suvari', 1: 'mizrakci', 9: 'okcu', 13: 'kusatma' }),
          dusman,
        );
        expect(Math.abs(e.saldiri)).toBeLessThanOrEqual(B.taktik.azami_etki + 1e-9);
        expect(Math.abs(e.savunma)).toBeLessThanOrEqual(B.taktik.azami_etki + 1e-9);
      }
    }
  });
});

describe('savaşta gerçekten fark yaratıyor', () => {
  const ordu: Army = { milis: 60, mizrakci: 40, okcu: 30, kusatma: 4 };
  const dusman: Army = { milis: 60, mizrakci: 40, okcu: 30 };

  function savas(duzen: Side['duzen']) {
    return simulateBattle(
      taraf(ordu, { duzen }),
      taraf(dusman, { isDefender: true }),
      'sabit-tohum',
      { defenderStore: { altin: 0, demir: 0, erzak: 0 }, attackerCunning: 0, canCapture: true },
    );
  }

  it('iyi dizilim kötü dizilimden güçlü', () => {
    const iyi = savas({ dizilim: varsayilanDizilim(ordu), taktik: null });
    const kotu = savas({ dizilim: koy({ 1: 'kusatma', 2: 'okcu', 13: 'milis' }), taktik: null });
    const g = (r: ReturnType<typeof savas>) => r.rounds[0]!.saldiranGuc;
    expect(g(iyi)).toBeGreaterThan(g(kotu));
  });

  it('rapor düzen satırlarını taşıyor', () => {
    const r = savas({ dizilim: koy({ 1: 'kusatma' }), taktik: null });
    expect(r.duzenRaporu.saldiran.join(' ')).toContain('Mancınık');
  });

  it('düzensiz savaş hâlâ çalışıyor ve raporu boş', () => {
    const r = savas(null);
    expect(r.duzenRaporu.saldiran).toEqual([]);
    expect(r.rounds).toHaveLength(B.savas.tur_sayisi);
  });

  it('aynı tohum + aynı düzen = aynı sonuç (saflık korunuyor)', () => {
    const a = savas({ dizilim: varsayilanDizilim(ordu), taktik: 'temkinli_ilerleyis' });
    const b = savas({ dizilim: varsayilanDizilim(ordu), taktik: 'temkinli_ilerleyis' });
    expect(a).toEqual(b);
  });
});

describe('duzenEtkisi iki katmanı toplar', () => {
  it('dizilim ve taktik satırları birlikte dönüyor', () => {
    const ordu: Army = { suvari: 50, milis: 50 };
    const e = duzenEtkisi({ dizilim: koy({ 5: 'suvari', 1: 'milis' }), taktik: 'hilal' }, ordu, {
      okcu: 100,
    });
    const metin = e.satirlar.join(' ');
    expect(metin).toContain('kanatta'); // dizilim katmanı
    expect(metin).toContain('Hilal'); // taktik katmanı
    expect(e.saldiri).toBeGreaterThan(0);
  });

  it('düzen yoksa her şey sıfır', () => {
    expect(duzenEtkisi(null, { milis: 10 }, { milis: 10 })).toEqual({
      saldiri: 0,
      savunma: 0,
      ilkTurSaldiri: 0,
      kaleDelme: 0,
      satirlar: [],
    });
  });
});
