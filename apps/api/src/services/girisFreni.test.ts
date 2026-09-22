import { describe, expect, it } from 'vitest';
import { HATA_TAVANI, PENCERE_MS, girisFreniKur } from './girisFreni.js';

describe('hesap başına giriş freni', () => {
  it('tavana kadar açık, tavanda kilitleniyor', () => {
    const f = girisFreniKur();
    for (let i = 0; i < HATA_TAVANI - 1; i++) f.hata('a@b.c', 1000);
    expect(f.durum('a@b.c', 1000).kilitli).toBe(false);
    f.hata('a@b.c', 1000);
    expect(f.durum('a@b.c', 1000)).toEqual({ kilitli: true, kalanDk: 15 });
  });

  it('pencere dolunca kilit kalkıyor', () => {
    const f = girisFreniKur();
    for (let i = 0; i < HATA_TAVANI; i++) f.hata('a@b.c', 0);
    expect(f.durum('a@b.c', PENCERE_MS - 1).kilitli).toBe(true);
    expect(f.durum('a@b.c', PENCERE_MS).kilitli).toBe(false);
  });

  it('adresler birbirini kilitlemiyor', () => {
    const f = girisFreniKur();
    for (let i = 0; i < HATA_TAVANI; i++) f.hata('saldirilan@b.c', 0);
    expect(f.durum('baskasi@b.c', 0).kilitli).toBe(false);
  });

  it('başarılı giriş sayacı sıfırlıyor', () => {
    const f = girisFreniKur();
    for (let i = 0; i < HATA_TAVANI - 1; i++) f.hata('a@b.c', 0);
    f.temizle('a@b.c');
    f.hata('a@b.c', 0);
    expect(f.durum('a@b.c', 0).kilitli).toBe(false);
  });
});
