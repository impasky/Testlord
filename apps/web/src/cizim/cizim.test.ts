import { describe, expect, it } from 'vitest';
import { AKIN_HARITALARI, B, HAZIR_PORTRELER } from '@lordlar/shared';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import { GENERAL_ADLARI, PORTRE_ADLARI, generalModeli, lordModeli, portreModeli } from './kisiler';
import {
  BIRLIK_ADLARI,
  DUSMAN_ADLARI,
  EKIPMAN_ADLARI,
  birlikModeli,
  dusmanModeli,
  ekipmanModeli,
} from './birlikler';
import { BOLGE_SAHNELERI, bolgeAdiCoz, bolgeModeli } from './bolgeler';
import { rastgele } from './rastgele';
import { ciz, kutu, sabitKutu, yansitici, zemineGeri } from './uc';
import { YERLESIM_KADEMELERI, yerlesimModeli, yerlesimNoktasi, yerlesimYuzdesi } from './yerlesim';

const sayilar = (n: string) => n.split(/[ ,]/).map(Number);

describe('3B motor', () => {
  it('kamera bir küpün tam üç yüzünü görüyor (üst, +x, +y)', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    expect(c.cokgenler).toHaveLength(3);
  });

  it('ışık: üst yüz en açık, +y yüzü en koyu', () => {
    const c = ciz(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    const parlak = c.cokgenler.map((p) => parseInt(p.renk.slice(1, 3), 16)).sort((a, b) => a - b);
    expect(new Set(parlak).size).toBe(3);
  });

  it('zemine geri yansıtma, yansıtmanın tersi', () => {
    const e = yansitici();
    const g = zemineGeri();
    for (const [x, y] of [
      [3, 4],
      [-7, 2],
      [0, 0],
    ] as [number, number][]) {
      const [sx, sy] = e([x, y, 0]);
      const [gx, gy] = g(sx, sy);
      expect(gx).toBeCloseTo(x, 6);
      expect(gy).toBeCloseTo(y, 6);
    }
  });

  it('sabit kutu hacmin bütün köşelerini içeriyor', () => {
    const [x, y, w, h] = sabitKutu([0, 0, 0], [10, 10, 10]);
    const e = yansitici();
    for (const q of [
      [0, 0, 0],
      [10, 10, 10],
      [10, 0, 10],
      [0, 10, 0],
    ] as [number, number, number][]) {
      const [px, py] = e(q);
      expect(px).toBeGreaterThanOrEqual(x);
      expect(px).toBeLessThanOrEqual(x + w);
      expect(py).toBeGreaterThanOrEqual(y);
      expect(py).toBeLessThanOrEqual(y + h);
    }
  });

  it('tohumlu rastgele: aynı anahtar aynı dizi', () => {
    const a = rastgele('kisla_3');
    const b = rastgele('kisla_3');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('bina çizimleri', () => {
  it.each(BINA_ADLARI)('%s: NaN yok, çerçeveye sığıyor, boş değil', (ad) => {
    const c = ciz(binaModeli(ad));
    expect(c.cokgenler.length).toBeGreaterThan(20);
    const [x, y, w, h] = BINA_KUTUSU;
    for (const p of c.cokgenler) {
      const s = sayilar(p.n);
      expect(s.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < s.length; i += 2) {
        expect(s[i]!).toBeGreaterThanOrEqual(x - 0.01);
        expect(s[i]!).toBeLessThanOrEqual(x + w + 0.01);
        expect(s[i + 1]!).toBeGreaterThanOrEqual(y - 0.01);
        expect(s[i + 1]!).toBeLessThanOrEqual(y + h + 0.01);
      }
    }
  });
});

describe('yerleşim zeminleri', () => {
  it.each(YERLESIM_KADEMELERI)('%s: NaN yok', (k) => {
    const c = ciz(yerlesimModeli(k));
    expect(c.cokgenler.length).toBeGreaterThan(50);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('binanın ekran yüzdesi dünyaya ve geri aynı yüzdeye dönüyor', () => {
    const [x, y] = yerlesimNoktasi(51, 53);
    const [px, py] = yerlesimYuzdesi(x, y);
    expect(px).toBeCloseTo(51, 6);
    expect(py).toBeCloseTo(53, 6);
  });
});

describe('bölge sahneleri', () => {
  it.each(BOLGE_SAHNELERI)('%s: NaN yok, dolu', (ad) => {
    const c = ciz(bolgeModeli(ad));
    expect(c.cokgenler.length).toBeGreaterThan(400);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });

  it('aşama adı çözülüyor; bilinmeyen tür null', () => {
    expect(bolgeAdiCoz('tarla_3')).toEqual(['tarla', 3]);
    expect(bolgeAdiCoz('kale')).toEqual(['kale', 1]);
    expect(bolgeAdiCoz('ejderha')).toBeNull();
  });

  it('aynı türün aşamaları aynı araziyi paylaşıyor', () => {
    const arazi = (ad: string) =>
      bolgeModeli(ad)
        .filter((y) => y.katman === -2)
        .map((y) => y.p.flat().join(','))
        .slice(0, 50)
        .join('|');
    expect(arazi('koy_3')).toBe(arazi('koy'));
  });
});

describe('birlik, düşman, ekipman', () => {
  it('oyundaki her birlik çiziliyor', () => {
    for (const b of Object.keys(B.birimler)) expect(BIRLIK_ADLARI).toContain(b);
  });
  it('her diyarın düşmanı er ve şef olarak çiziliyor', () => {
    for (const h of AKIN_HARITALARI) {
      expect(DUSMAN_ADLARI).toContain(h.dusman_key);
      expect(DUSMAN_ADLARI).toContain(h.dusman_key + '_sef');
    }
  });
  it('her ekipman yuvasının beş kademesi çiziliyor', () => {
    for (const y of B.ekipman.slotlar)
      for (let t = 1; t <= 5; t++) expect(EKIPMAN_ADLARI).toContain(`${y}_t${t}`);
  });
  it.each([
    ...BIRLIK_ADLARI.map((a) => [a, birlikModeli] as const),
    ...DUSMAN_ADLARI.map((a) => [a, dusmanModeli] as const),
    ...EKIPMAN_ADLARI.map((a) => [a, ekipmanModeli] as const),
  ])('%s: NaN yok', (ad, uret) => {
    const c = ciz(uret(ad)!);
    expect(c.cokgenler.length).toBeGreaterThan(8);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });
  it('bilinmeyen ad null', () => {
    expect(birlikModeli('ejderha')).toBeNull();
    expect(ekipmanModeli('silah_t9')).toBeNull();
  });
});

describe('generaller, lord, portreler', () => {
  it('seçilebilen her hazır portrenin çizimi var', () => {
    for (const p of HAZIR_PORTRELER) expect(PORTRE_ADLARI).toContain(p.key);
  });
  it('lordun beş kuşam aşaması çiziliyor', () => {
    for (let i = 1; i <= 5; i++) expect(lordModeli(`lord_${i}`)).not.toBeNull();
    expect(lordModeli('lord_6')).toBeNull();
  });
  it.each(PORTRE_ADLARI)('%s: NaN yok', (ad) => {
    const c = ciz(portreModeli(ad)!);
    expect(c.cokgenler.length).toBeGreaterThan(80);
    for (const p of c.cokgenler) expect(sayilar(p.n).every(Number.isFinite)).toBe(true);
  });
  it('general tam boy = portre (aynı kişi)', () => {
    for (const g of GENERAL_ADLARI) expect(portreModeli(g)).toEqual(generalModeli(g));
  });
});

describe('belirlenimcilik', () => {
  // Çizim her açılışta aynı olmalı: Math.random'a düşen bir parça (kürk
  // yakasında oldu) aynı generalin iki ekranda farklı görünmesi demek.
  it.each([
    ...BINA_ADLARI.map((a) => [a, () => binaModeli(a)] as const),
    ...BIRLIK_ADLARI.map((a) => [a, () => birlikModeli(a)] as const),
    ...DUSMAN_ADLARI.map((a) => [a, () => dusmanModeli(a)] as const),
    ...EKIPMAN_ADLARI.map((a) => [a, () => ekipmanModeli(a)] as const),
    ...PORTRE_ADLARI.map((a) => [a, () => portreModeli(a)] as const),
    ['koy_5', () => bolgeModeli('koy_5')] as const,
  ])('%s iki kez aynı çiziliyor', (_, uret) => {
    expect(ciz(uret()!).cokgenler).toEqual(ciz(uret()!).cokgenler);
  });
});
