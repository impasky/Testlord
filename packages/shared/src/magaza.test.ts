/**
 * Mağaza kuralları: neyin hızlandığı, ne kadara, reklamın sınırı.
 *
 * İki yönlü yanılgı da pahalı: PvP'ye dokunan bir kuyruğun hızlanması
 * oyunu öde-kazana çevirir; satın alınamayacak kadar pahalı bir fiyat
 * hiç satılmayan bir ürün demek.
 */
import { describe, expect, it } from 'vitest';
import {
  ELMAS_PAKETLERI,
  HIZLANDIRILABILIR,
  REKLAM,
  bankadanHarca,
  elmasPaketi,
  hizlandirilabilirMi,
  hizlandirmaBedeli,
  reklamHakki,
  reklamOdulunuDagit,
} from './magaza.js';

describe('hızlandırma', () => {
  it('yalnız kendi gelişim kuyrukları; PvP hiçbir zaman', () => {
    for (const k of ['bina', 'research', 'train', 'craft', 'upgrade_item']) {
      expect(hizlandirilabilirMi(k)).toBe(true);
    }
    for (const k of ['attack', 'return', 'takviye', 'kesif', 'sevkiyat', 'iyilestir']) {
      expect(hizlandirilabilirMi(k)).toBe(false);
    }
    expect(HIZLANDIRILABILIR.length).toBeGreaterThan(0);
  });

  it('bedel artıyor ama dakika fiyatı azalıyor', () => {
    const dk = (n: number) => hizlandirmaBedeli(n * 60);
    expect(hizlandirmaBedeli(0)).toBe(0);
    expect(hizlandirmaBedeli(-5)).toBe(0);
    expect(dk(0.1)).toBe(1); // asgari
    expect(dk(60)).toBeGreaterThan(dk(10));
    expect(dk(1440)).toBeGreaterThan(dk(60));
    // Dakika başına: uzun bekleyiş daha ucuz.
    expect(dk(1440) / 1440).toBeLessThan(dk(60) / 60);
    // Bir gün satın alınabilir bir sayı: en büyük paketin altında.
    const enBuyuk = Math.max(...ELMAS_PAKETLERI.map((p) => p.toplam));
    expect(dk(1440)).toBeLessThan(enBuyuk);
  });
});

describe('paketler', () => {
  it('toplam = elmas + ek; kimlikle bulunuyor; uydurma kimlik yok', () => {
    for (const p of ELMAS_PAKETLERI) {
      expect(p.toplam).toBe(p.elmas + p.ek);
      expect(elmasPaketi(p.urun)).toEqual(p);
    }
    expect(elmasPaketi('elmas_999999')).toBeUndefined();
  });

  it('büyük paket elmas başına daha cömert', () => {
    const oran = ELMAS_PAKETLERI.map((p) => p.toplam / p.elmas);
    for (let i = 1; i < oran.length; i++) expect(oran[i]).toBeGreaterThanOrEqual(oran[i - 1]!);
  });
});

describe('ödüllü reklam', () => {
  const simdi = new Date('2026-10-20T12:00:00Z');

  it('tavan ve bekleme', () => {
    expect(reklamHakki(0, null, simdi)).toMatchObject({ izinli: true, kalan: REKLAM.gunlukTavan });
    expect(reklamHakki(REKLAM.gunlukTavan, null, simdi)).toMatchObject({
      izinli: false,
      engel: 'tavan',
    });
    const az = new Date(simdi.getTime() - 10_000);
    expect(reklamHakki(1, az, simdi)).toMatchObject({
      izinli: false,
      engel: 'bekleme',
      beklemeSn: REKLAM.beklemeSn - 10,
    });
    const coktan = new Date(simdi.getTime() - REKLAM.beklemeSn * 1000);
    expect(reklamHakki(1, coktan, simdi).izinli).toBe(true);
  });

  it('ödül kuyruğa, artanı bankaya; banka tavanı aşılmıyor', () => {
    const odul = REKLAM.odulDakika;
    expect(reklamOdulunuDagit(3600, 0)).toEqual({ kuyrukSaniye: odul * 60, bankayaDakika: 0 });
    expect(reklamOdulunuDagit(5 * 60, 0)).toEqual({ kuyrukSaniye: 300, bankayaDakika: odul - 5 });
    expect(reklamOdulunuDagit(0, 0)).toEqual({ kuyrukSaniye: 0, bankayaDakika: odul });
    expect(reklamOdulunuDagit(0, REKLAM.bankaTavanDakika - 3)).toEqual({
      kuyrukSaniye: 0,
      bankayaDakika: 3,
    });
    expect(reklamOdulunuDagit(0, REKLAM.bankaTavanDakika).bankayaDakika).toBe(0);
  });

  it('bankadan harcama kalanı aşmıyor', () => {
    expect(bankadanHarca(90, 10)).toEqual({ harcananDakika: 2, kuyrukSaniye: 90 });
    expect(bankadanHarca(3600, 10)).toEqual({ harcananDakika: 10, kuyrukSaniye: 600 });
    expect(bankadanHarca(0, 10)).toEqual({ harcananDakika: 0, kuyrukSaniye: 0 });
    expect(bankadanHarca(100, 0)).toEqual({ harcananDakika: 0, kuyrukSaniye: 0 });
  });
});
