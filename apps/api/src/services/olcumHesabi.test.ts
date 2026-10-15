/**
 * Ölçüm panosu hesabı: günlük aktif ve kohort tutundurması.
 *
 * Tarih aritmetiği sessizce yanlış olan türden: bir gün kaymış bir
 * pencere, yarım günü sayan bir oran ya da boş kohortu sıfır sayan bir
 * ortalama hiçbir hata vermeden yanlış karar aldırır.
 */
import { describe, expect, it } from 'vitest';
import { PANO_GUN, panoHesapla } from './olcumHesabi.js';

const BUGUN = 20_000;

describe('ölçüm panosu', () => {
  it('günlük seri 30 gün, eskiden yeniye, bugün dahil', () => {
    const p = panoHesapla({ lordlar: [], aktiflik: [], bugun: BUGUN });
    expect(p.gunluk).toHaveLength(PANO_GUN);
    expect(p.gunluk[0]!.gun).toBe(BUGUN - PANO_GUN + 1);
    expect(p.gunluk.at(-1)!.gun).toBe(BUGUN);
    expect(p.tutundurma.d1.oran).toBeNull();
    expect(p.ozet.yapiskanlik).toBeNull();
  });

  it('günlük aktif tekil lord sayıyor, yeni kayıtlar ayrı', () => {
    const p = panoHesapla({
      lordlar: [
        { id: 'a', kayitGunu: BUGUN - 1 },
        { id: 'b', kayitGunu: BUGUN - 1 },
      ],
      aktiflik: [
        { gun: BUGUN - 1, lordId: 'a' },
        { gun: BUGUN - 1, lordId: 'b' },
        { gun: BUGUN - 1, lordId: 'c' },
        { gun: BUGUN, lordId: 'a' },
      ],
      bugun: BUGUN,
    });
    const dun = p.gunluk.find((g) => g.gun === BUGUN - 1)!;
    expect(dun).toEqual({ gun: BUGUN - 1, aktif: 3, yeni: 2 });
    expect(p.ozet.bugunAktif).toBe(1);
    expect(p.ozet.dunAktif).toBe(3);
    expect(p.ozet.haftalikAktif).toBe(3);
    expect(p.ozet.aylikAktif).toBe(3);
    expect(p.ozet.yapiskanlik).toBe(1);
  });

  it('1. gün: ertesi gün açanların oranı; gün bitmeden yazılmıyor', () => {
    const lordlar = [
      { id: 'a', kayitGunu: BUGUN - 3 },
      { id: 'b', kayitGunu: BUGUN - 3 },
      { id: 'c', kayitGunu: BUGUN - 3 },
      { id: 'd', kayitGunu: BUGUN - 3 },
      // Dün kaydolan: ertesi günü BUGÜN, henüz bitmedi.
      { id: 'e', kayitGunu: BUGUN - 1 },
    ];
    const aktiflik = [
      ...lordlar.map((l) => ({ gun: l.kayitGunu, lordId: l.id })),
      { gun: BUGUN - 2, lordId: 'a' },
      // c ertesi gün değil, iki gün sonra döndü: 1. gün sayılmaz.
      { gun: BUGUN - 1, lordId: 'c' },
      { gun: BUGUN, lordId: 'e' },
    ];
    const p = panoHesapla({ lordlar, aktiflik, bugun: BUGUN });
    const k3 = p.kohortlar.find((k) => k.gun === BUGUN - 3)!;
    expect(k3).toEqual({ gun: BUGUN - 3, kayit: 4, d1: 0.25, d7: null });
    const k1 = p.kohortlar.find((k) => k.gun === BUGUN - 1)!;
    expect(k1.d1).toBeNull();
    expect(p.tutundurma.d1).toEqual({ oran: 0.25, kohort: 4, donen: 1 });
  });

  it('7. gün tam yedinci günü sayıyor; ortalama kayıt sayısıyla ağırlıklı', () => {
    const lordlar = [
      { id: 'a', kayitGunu: BUGUN - 10 },
      { id: 'b', kayitGunu: BUGUN - 10 },
      { id: 'c', kayitGunu: BUGUN - 9 },
      // Tam 7 gün önce: yedinci günü BUGÜN, henüz olgun değil.
      { id: 'd', kayitGunu: BUGUN - 7 },
    ];
    const aktiflik = [
      { gun: BUGUN - 3, lordId: 'a' }, // a: 7. gün
      { gun: BUGUN - 4, lordId: 'b' }, // b: 6. gün — sayılmaz
      { gun: BUGUN - 2, lordId: 'c' }, // c: 7. gün
      { gun: BUGUN, lordId: 'd' },
    ];
    const p = panoHesapla({ lordlar, aktiflik, bugun: BUGUN });
    expect(p.kohortlar.find((k) => k.gun === BUGUN - 10)!.d7).toBe(0.5);
    expect(p.kohortlar.find((k) => k.gun === BUGUN - 9)!.d7).toBe(1);
    expect(p.kohortlar.find((k) => k.gun === BUGUN - 7)!.d7).toBeNull();
    // Kohort ortalaması (0,5 + 1) / 2 = 0,75 olurdu; doğrusu 2/3.
    expect(p.tutundurma.d7).toEqual({ oran: 2 / 3, kohort: 3, donen: 2 });
  });

  it('boş kohort ortalamayı bozmuyor', () => {
    const p = panoHesapla({
      lordlar: [{ id: 'a', kayitGunu: BUGUN - 5 }],
      aktiflik: [{ gun: BUGUN - 4, lordId: 'a' }],
      bugun: BUGUN,
    });
    expect(p.kohortlar.filter((k) => k.kayit === 0).every((k) => k.d1 === null)).toBe(true);
    expect(p.tutundurma.d1.oran).toBe(1);
  });

  it('pencere dışındaki satırlar seriye girmiyor', () => {
    const p = panoHesapla({
      lordlar: [],
      aktiflik: [{ gun: BUGUN - PANO_GUN, lordId: 'eski' }],
      bugun: BUGUN,
    });
    expect(p.ozet.aylikAktif).toBe(0);
    expect(p.gunluk.every((g) => g.aktif === 0)).toBe(true);
  });
});
