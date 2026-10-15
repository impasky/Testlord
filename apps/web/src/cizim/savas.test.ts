import { describe, expect, it } from 'vitest';
import { savasAnahtari, savasModeli, type SavasGirdisi } from './savas';
import { tarifModeli } from './tarif';

const temel: SavasGirdisi = {
  tip: 'tarla',
  saldiran: { kalan: { mizrakci: 40, okcu: 25 }, kayip: { mizrakci: 10 } },
  savunan: { kalan: {}, kayip: { milis: 30 } },
  saldiranKazandi: true,
  tahkimat: false,
};

/** Anahtardaki bir tarafın toplam figürü (ayakta + düşen). */
function figurSayisi(taraf: string): { ayakta: number; dusen: number } {
  if (taraf === '0') return { ayakta: 0, dusen: 0 };
  return taraf.split('.').reduce(
    (a, p) => {
      const e = /^[a-z]{2}(\d+)(?:-(\d+))?$/.exec(p)!;
      return { ayakta: a.ayakta + Number(e[1]), dusen: a.dusen + Number(e[2] ?? 0) };
    },
    { ayakta: 0, dusen: 0 },
  );
}

describe('savaş sahnesi (docs/09 G4)', () => {
  it('anahtar raporun verisini taşıyor ve kararlı', () => {
    const a = savasAnahtari(temel);
    expect(a).toMatch(/^savas:tarla:[^:]+:[^:]+:s:0$/);
    expect(savasAnahtari({ ...temel })).toBe(a);
    expect(savasAnahtari({ ...temel, saldiranKazandi: false })).toMatch(/:d:0$/);
    expect(savasAnahtari({ ...temel, tahkimat: true })).toMatch(/:s:1$/);
  });

  it('bilinmeyen ya da eksik bölge türü tarlaya düşüyor', () => {
    expect(savasAnahtari({ ...temel, tip: null })).toMatch(/^savas:tarla:/);
    expect(savasAnahtari({ ...temel, tip: 'uzay' })).toMatch(/^savas:tarla:/);
    expect(savasAnahtari({ ...temel, tip: 'kale' })).toMatch(/^savas:kale:/);
  });

  it('ordu ne kadar büyük olursa olsun bir taraf dokuz figürü aşmıyor', () => {
    const dev = savasAnahtari({
      ...temel,
      saldiran: { kalan: { mizrakci: 50_000, okcu: 30_000, suvari: 20_000 }, kayip: {} },
    });
    const { ayakta, dusen } = figurSayisi(dev.split(':')[2]!);
    expect(ayakta + dusen).toBeLessThanOrEqual(9);
    expect(ayakta + dusen).toBeGreaterThan(5);
  });

  it('ordusu biten tarafın bütün figürleri düşmüş, kazananın en az biri ayakta', () => {
    const a = savasAnahtari(temel).split(':');
    expect(figurSayisi(a[3]!).ayakta).toBe(0);
    expect(figurSayisi(a[3]!).dusen).toBeGreaterThan(0);
    const agirKayip = savasAnahtari({
      ...temel,
      saldiran: { kalan: { mizrakci: 1 }, kayip: { mizrakci: 99 } },
    }).split(':');
    expect(figurSayisi(agirKayip[2]!).ayakta).toBeGreaterThanOrEqual(1);
  });

  it('boş garnizon: savunan tarafta figür yok', () => {
    const a = savasAnahtari({ ...temel, savunan: { kalan: {}, kayip: {} } });
    expect(a.split(':')[3]).toBe('0');
  });

  it('mancınık en çok bir figür', () => {
    const a = savasAnahtari({
      ...temel,
      saldiran: { kalan: { kusatma: 500, mizrakci: 10 }, kayip: {} },
    });
    expect(a).toMatch(/ku1(?!\d)/);
  });

  it('model anahtardan kuruluyor; tarif aynı modeli veriyor', () => {
    for (const tip of ['koy', 'tarla', 'maden', 'sehir', 'kale', 'taht']) {
      const a = savasAnahtari({ ...temel, tip, tahkimat: true });
      const m = savasModeli(a.slice('savas:'.length));
      expect(m?.length, tip).toBeGreaterThan(500);
      expect(tarifModeli(a)?.length).toBe(m?.length);
    }
  });
});
