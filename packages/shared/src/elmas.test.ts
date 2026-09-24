/**
 * Elmas ve yeni oyuncu bonusunun SAYILARI.
 *
 * Bir para biriminin yanlış fiyatlandığı, ancak oyuncular onu biriktirip
 * ekonomiyi bozduktan sonra anlaşılır. Buradaki sınamalar fonksiyonun
 * çalıştığını değil, KURALIN tuttuğunu ölçüyor.
 */
import { describe, expect, it } from 'vitest';
import {
  BASLANGIC_ELMASI,
  ELMAS_KAZANIMI,
  YENI_OYUNCU_SURE_SAAT,
  bonusluSure,
  kisaltilabilirMi,
  kisaltmaBedeli,
  tedaviKisaltmaBedeli,
  yeniOyuncuDurumu,
} from './elmas.js';
import { kafileTedaviSuresiSn } from './hastane.js';

describe('kisaltmaBedeli', () => {
  it('uzun bekleme daha pahalı — doğrusal', () => {
    const on = kisaltmaBedeli(10 * 60);
    const yirmi = kisaltmaBedeli(20 * 60);
    expect(yirmi).toBe(on * 2);
  });

  it('bitmiş yürüyüş bedava — ödenecek bekleme yok', () => {
    expect(kisaltmaBedeli(0)).toBe(0);
    expect(kisaltmaBedeli(-30)).toBe(0);
    expect(kisaltilabilirMi(0, 999)).toBe(false);
  });

  it('birkaç saniyelik kalan bile asgari bedeli ödüyor', () => {
    // Yoksa oyuncu son saniyede sıfır elmasa kısaltırdı.
    expect(kisaltmaBedeli(5)).toBeGreaterThanOrEqual(1);
  });

  it('yetersiz elmasla kısaltılamıyor', () => {
    const kalan = 30 * 60;
    const bedel = kisaltmaBedeli(kalan);
    expect(kisaltilabilirMi(kalan, bedel)).toBe(true);
    expect(kisaltilabilirMi(kalan, bedel - 1)).toBe(false);
  });

  it('kazanımların hepsi pozitif ve sınırlı', () => {
    for (const [ad, n] of Object.entries(ELMAS_KAZANIMI)) {
      expect(n, ad).toBeGreaterThan(0);
      // Tek seferde onlarca elmas veren bir musluk, para birimini
      // değersizleştirir ve kısaltmayı bedavaya çevirir.
      expect(n, ad).toBeLessThanOrEqual(25);
    }
  });
});

describe('tedaviKisaltmaBedeli', () => {
  it('doğrusal ve bitmiş tedavi bedava', () => {
    expect(tedaviKisaltmaBedeli(40 * 60)).toBe(tedaviKisaltmaBedeli(20 * 60) * 2);
    expect(tedaviKisaltmaBedeli(0)).toBe(0);
    expect(tedaviKisaltmaBedeli(3)).toBeGreaterThanOrEqual(1);
  });

  it('dakikası akınınkinden ucuz — tedavi onlarca dakika sürüyor', () => {
    expect(tedaviKisaltmaBedeli(60 * 60)).toBeLessThan(kisaltmaBedeli(60 * 60));
  });

  it('başlangıç kesesi tipik bir akın kafilesine yetiyor, sınırsız değil', () => {
    // Oyuncu elması ilk günden kullanabilmeli; ama birkaç kafile sonra
    // beklemeye dönmeli — yoksa hastane bir ekran olmaktan çıkar.
    const tipik = kafileTedaviSuresiSn({ okcu: 8 });
    expect(BASLANGIC_ELMASI).toBeGreaterThanOrEqual(tedaviKisaltmaBedeli(tipik));
    expect(BASLANGIC_ELMASI).toBeLessThan(tedaviKisaltmaBedeli(tipik) * 4);
  });
});

describe('yeni oyuncu bonusu', () => {
  const simdi = new Date('2026-06-01T12:00:00Z');

  it('kayıt anında etkin', () => {
    const d = yeniOyuncuDurumu(simdi, simdi);
    expect(d.etkin).toBe(true);
    expect(d.egitimHizlandirma).toBeGreaterThan(0);
    expect(d.kalanSaniye).toBe(YENI_OYUNCU_SURE_SAAT * 3600);
  });

  it('24 saat sonra bitmiş ve hızlandırma sıfır', () => {
    const eski = new Date(simdi.getTime() - (YENI_OYUNCU_SURE_SAAT + 1) * 3_600_000);
    const d = yeniOyuncuDurumu(eski, simdi);
    expect(d.etkin).toBe(false);
    expect(d.kalanSaniye).toBe(0);
    expect(d.egitimHizlandirma).toBe(0);
    expect(d.yuruyusHizlandirma).toBe(0);
  });

  it('tam sınırda bitmiş sayılıyor', () => {
    const tam = new Date(simdi.getTime() - YENI_OYUNCU_SURE_SAAT * 3_600_000);
    expect(yeniOyuncuDurumu(tam, simdi).etkin).toBe(false);
  });

  it('bonus KÜÇÜK: süreyi yarıya indirmiyor', () => {
    // Büyük bir bonus bittiğinde oyun yavaşlamış gibi görünür ve
    // bırakma sebebi olur. Kural: hiçbir hızlandırma %50'yi geçmesin.
    const d = yeniOyuncuDurumu(simdi, simdi);
    expect(d.egitimHizlandirma).toBeLessThan(0.5);
    expect(d.yuruyusHizlandirma).toBeLessThan(0.5);
  });

  it('başlangıç elması bir kısaltmaya yetiyor ama sınırsız değil', () => {
    expect(BASLANGIC_ELMASI).toBeGreaterThan(kisaltmaBedeli(5 * 60));
    expect(BASLANGIC_ELMASI).toBeLessThan(kisaltmaBedeli(60 * 60));
  });
});

describe('bonusluSure', () => {
  it('hızlandırma süreyi kısaltıyor', () => {
    expect(bonusluSure(100, 0.25)).toBe(80);
  });

  it('bonus yoksa süre aynı kalıyor', () => {
    expect(bonusluSure(100, 0)).toBe(100);
  });

  it('süre hiçbir zaman sıfıra düşmüyor', () => {
    // Bölme kullanılıyor, çıkarma değil: çıkarmada iki bonusun toplamı
    // %100'ü geçince süre sıfıra ya da eksiye inerdi.
    expect(bonusluSure(10, 5)).toBeGreaterThanOrEqual(1);
    expect(bonusluSure(1, 100)).toBeGreaterThanOrEqual(1);
  });
});
