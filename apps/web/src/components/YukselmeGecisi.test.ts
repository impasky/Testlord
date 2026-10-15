import { describe, expect, it } from 'vitest';
import { yukselenleriBul } from './YukselmeGecisi';

const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe('yükseltme geçişi', () => {
  it('ilk açılışta kutlanacak bir şey yok', () => {
    expect(yukselenleriBul(null, m({ kisla: 3 }))).toEqual([]);
  });

  it('seviyesi artan yapılar, yeni seviyeleriyle', () => {
    expect(yukselenleriBul(m({ kisla: 1, pazar: 2 }), m({ kisla: 2, pazar: 2 }))).toEqual([
      ['kisla', 2],
    ]);
  });

  it('arsada dikilen yapı da sayılıyor (0 → 1)', () => {
    expect(yukselenleriBul(m({ hastane: 0 }), m({ hastane: 1 }))).toEqual([['hastane', 1]]);
    // Önceki listede hiç yoktu (kademe açıldı, yapı dikildi).
    expect(yukselenleriBul(m({}), m({ hastane: 1 }))).toEqual([['hastane', 1]]);
  });

  it('düşen ya da aynı kalan seviye kutlanmıyor; yeni boş arsa da', () => {
    expect(yukselenleriBul(m({ kisla: 3 }), m({ kisla: 2 }))).toEqual([]);
    expect(yukselenleriBul(m({ kisla: 3 }), m({ kisla: 3, hastane: 0 }))).toEqual([]);
  });
});
