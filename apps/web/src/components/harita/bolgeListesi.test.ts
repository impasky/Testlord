import { describe, expect, it } from 'vitest';
import type { RegionDto } from '../../api/client';
import { bolgeListesi, suzgecSayilari } from './bolgeListesi';

function bolge(id: number, ek: Partial<RegionDto> = {}): RegionDto {
  return {
    id,
    name: `Bölge ${id}`,
    type: 'koy',
    province: 'v',
    x: 0,
    y: 0,
    komsular: [],
    level: 1,
    incomeMult: 1,
    owner: null,
    isMine: false,
    pay: null,
    medeniyet: null,
    cekirdek: false,
    shielded: false,
    distance: 1,
    fortressBonus: 0,
    ...ek,
  };
}

const sahip = { id: 'l', name: 'Başkası', level: 3 };
const benimMed = { id: 'm1', ad: 'Bizimkiler', renk: '#fff' };

const dunya: RegionDto[] = [
  bolge(1, { isMine: true, distance: 0, pay: { oran: 1, yer: 1, toplamYer: 1 } }),
  bolge(2, { distance: 3, level: 2 }),
  bolge(3, { distance: 1, owner: sahip }),
  bolge(4, { distance: 1, shielded: true }),
  bolge(5, { distance: 2, owner: sahip, paktli: true }),
  bolge(6, { distance: 2, owner: sahip, medeniyet: benimMed }),
  bolge(7, { distance: 4, cekirdek: true }),
  bolge(8, { distance: 3, level: 5, type: 'taht' }),
  bolge(9, { distance: 2, owner: sahip, muttefik: true, pay: { oran: 0.3, yer: 1, toplamYer: 3 } }),
];

describe('bölge listesi', () => {
  it('Hedefler: yalnız saldırılabilir topraklar, yakından uzağa', () => {
    const l = bolgeListesi(dunya, 'hedef', 'm1');
    expect(l.map((s) => s.r.id)).toEqual([3, 8, 2]);
  });

  it('eşit uzaklıkta yüksek seviye önce', () => {
    const l = bolgeListesi(dunya, 'hedef', 'm1');
    // 8 (Sv 5) ile 2 (Sv 2) ikisi de 3 adım.
    expect(l.findIndex((s) => s.r.id === 8)).toBeLessThan(l.findIndex((s) => s.r.id === 2));
  });

  it('Toprağım: sahip olduğun ve garnizonunun durduğu bölgeler', () => {
    const l = bolgeListesi(dunya, 'benim', 'm1');
    expect(l.map((s) => s.r.id)).toEqual([1, 9]);
    expect(l[1]!.rozetler).toContain('garnizon');
    expect(l[0]!.rozetler).not.toContain('garnizon');
  });

  it('Hepsi: her bölge, saldırılamayanın sebebi rozetinde', () => {
    const l = bolgeListesi(dunya, 'hepsi', 'm1');
    expect(l).toHaveLength(dunya.length);
    const rozet = (id: number) => l.find((s) => s.r.id === id)!.rozetler;
    expect(rozet(4)).toEqual(['kalkan']);
    expect(rozet(5)).toEqual(['pakt']);
    expect(rozet(6)).toEqual(['yoldas']);
    expect(rozet(7)).toEqual(['cekirdek']);
    expect(rozet(8)).toEqual(['taht']);
    expect(rozet(9)).toEqual(['muttefik', 'garnizon']);
    expect(rozet(3)).toEqual([]);
  });

  it('medeniyetsiz oyuncu için aynı medeniyet kuralı işlemiyor', () => {
    const l = bolgeListesi(dunya, 'hedef', null);
    expect(l.map((s) => s.r.id)).toContain(6);
  });

  it('süzgeç sayıları listelerin boyuyla aynı', () => {
    const n = suzgecSayilari(dunya, 'm1');
    expect(n.hedef).toBe(bolgeListesi(dunya, 'hedef', 'm1').length);
    expect(n.benim).toBe(bolgeListesi(dunya, 'benim', 'm1').length);
    expect(n.hepsi).toBe(dunya.length);
  });
});
