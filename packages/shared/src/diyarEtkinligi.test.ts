/**
 * Hafta sonu diyar seferi: pencere, tema, hedef ve ödül kararı.
 *
 * Tarih aritmetiği elle yazıldığı her yerde sessizce yanlış olur: bir gün
 * kayan pencere cumartesi akşamı açılan, pazar öğlen kapanan bir etkinlik
 * demek ve kimse fark etmez.
 */
import { describe, expect, it } from 'vitest';
import {
  ETKINLIKLER,
  aktifPenceresi,
  diyarEtkinligi,
  etkinlikHakki,
  etkinlikHedefi,
} from './diyarEtkinligi.js';
import { gunNumarasi } from './gunluk.js';

// 2026-10-17 bir cumartesi.
const CUMARTESI = Date.UTC(2026, 9, 17);
const an = (gunKaydir: number, saat = 12) =>
  new Date(CUMARTESI + gunKaydir * 86_400_000 + saat * 3_600_000);

describe('diyar etkinliği', () => {
  it('cumartesi ve pazar açık, pencere cumartesi 00:00 – pazartesi 00:00', () => {
    for (const k of [0, 1]) {
      const e = diyarEtkinligi(an(k));
      expect(e.durum).toBe('acik');
      expect(e.bas.getTime()).toBe(CUMARTESI);
      expect(e.son.getTime()).toBe(CUMARTESI + 2 * 86_400_000);
    }
    expect(diyarEtkinligi(new Date(CUMARTESI)).durum).toBe('acik');
  });

  it('pazartesi önceki hafta sonunun ödül günü', () => {
    const e = diyarEtkinligi(an(2));
    expect(e.durum).toBe('odul');
    expect(e.bas.getTime()).toBe(CUMARTESI);
    expect(e.odulSonu.getTime()).toBe(CUMARTESI + 3 * 86_400_000);
  });

  it('salı–cuma bu hafta sonunun etkinliği yaklaşıyor, tema belli', () => {
    for (const k of [-4, -3, -2, -1]) {
      const e = diyarEtkinligi(an(k));
      expect(e.durum).toBe('yaklasiyor');
      expect(e.bas.getTime()).toBe(CUMARTESI);
      expect(e.tanim.key).toBe(diyarEtkinligi(an(0)).tanim.key);
    }
    // Salı ise bir SONRAKİ hafta sonu.
    expect(diyarEtkinligi(an(3)).bas.getTime()).toBe(CUMARTESI + 7 * 86_400_000);
  });

  it('tema her hafta sonu dönüyor, bütün temalar sırayla geliyor', () => {
    const temalar = Array.from(
      { length: ETKINLIKLER.length },
      (_, i) => diyarEtkinligi(an(i * 7)).tanim.key,
    );
    expect(new Set(temalar).size).toBe(ETKINLIKLER.length);
  });

  it('aktif nüfus etkinlikten önceki yedi günden', () => {
    const p = aktifPenceresi(new Date(CUMARTESI));
    expect(p.sonGun).toBe(gunNumarasi(new Date(CUMARTESI)) - 1);
    expect(p.sonGun - p.ilkGun).toBe(6);
  });

  it('hedef nüfusla büyüyor ama tabanın altına inmiyor', () => {
    const t = ETKINLIKLER[0]!;
    expect(etkinlikHedefi(t, 0)).toBe(t.taban);
    expect(etkinlikHedefi(t, 1000)).toBe(Math.ceil(1000 * t.kisi_basi));
  });

  it('ödül: hedef tutmalı, katkı olmalı, bir kez; hafta içi kapalı', () => {
    const acik = diyarEtkinligi(an(0));
    expect(etkinlikHakki(acik, 10, 12, 3, null)).toMatchObject({
      hakEdildi: false,
      engel: 'hedef',
    });
    expect(etkinlikHakki(acik, 12, 12, 0, null)).toMatchObject({
      hakEdildi: false,
      engel: 'katki',
    });
    expect(etkinlikHakki(acik, 12, 12, 1, null)).toMatchObject({ hakEdildi: true, engel: null });
    expect(etkinlikHakki(acik, 12, 12, 1, acik.bas)).toMatchObject({
      alindi: true,
      engel: 'alindi',
    });
    // Geçen haftanın alımı bu haftayı kapatmıyor.
    const gecen = new Date(acik.bas.getTime() - 7 * 86_400_000);
    expect(etkinlikHakki(acik, 12, 12, 1, gecen).alindi).toBe(false);
    const yakin = diyarEtkinligi(an(-1));
    expect(etkinlikHakki(yakin, 99, 12, 5, null)).toMatchObject({
      hakEdildi: false,
      engel: 'kapali',
    });
  });
});
