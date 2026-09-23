import { describe, expect, it } from 'vitest';
import { puanaGore } from './adaySirasi';

const aday = (mapId: number, puan: number) => ({ r: { mapId }, puan });

describe('hedef adaylarının sıralaması', () => {
  it('büyük puan önde', () => {
    const liste = [aday(1, 5), aday(2, 9), aday(3, 7)];
    liste.sort(puanaGore((a) => a.puan));
    expect(liste.map((a) => a.r.mapId)).toEqual([2, 3, 1]);
  });

  /*
   * Asıl kural: eşit puanlı ikizlerin sırası GİRDİNİN sırasına bağlı
   * olmamalı. Girdi veritabanından sırasız geliyor; sonuç her çağrıda
   * aynı olmazsa öneri oyuncunun altından kayıyor (CI: Susamlık → Sarıova).
   */
  it('eşit puanda girdi sırası sonucu değiştirmiyor', () => {
    const bir = [aday(97, -1028), aday(84, -1028), aday(50, -2000)];
    const iki = [aday(84, -1028), aday(50, -2000), aday(97, -1028)];
    bir.sort(puanaGore((a) => a.puan));
    iki.sort(puanaGore((a) => a.puan));
    expect(bir.map((a) => a.r.mapId)).toEqual([84, 97, 50]);
    expect(iki.map((a) => a.r.mapId)).toEqual([84, 97, 50]);
  });

  it('sonsuz puanları da sıralıyor (taranmamış adaylar)', () => {
    const liste = [
      aday(3, Number.NEGATIVE_INFINITY),
      aday(1, 4),
      aday(2, Number.NEGATIVE_INFINITY),
    ];
    liste.sort(puanaGore((a) => a.puan));
    expect(liste.map((a) => a.r.mapId)).toEqual([1, 2, 3]);
  });
});
