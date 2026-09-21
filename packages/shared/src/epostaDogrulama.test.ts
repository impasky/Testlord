import { describe, expect, it } from 'vitest';
import {
  GUNLUK_GONDERIM_TAVANI,
  SERBEST_GUN,
  YENIDEN_GONDER_BEKLEME_SN,
  dogrulamaDurumu,
  gonderilebilirMi,
  jetonBitisi,
  jetonGecerli,
} from './epostaDogrulama.js';

const simdi = new Date('2026-09-21T12:00:00Z');
const gunOnce = (g: number) => new Date(simdi.getTime() - g * 86_400_000);

describe('dogrulamaDurumu', () => {
  it('doğrulanmış hesaba hiçbir kapı kapanmıyor', () => {
    const d = dogrulamaDurumu(gunOnce(30), gunOnce(60), simdi);
    expect(d.dogrulandi).toBe(true);
    expect(d.girisKapali).toBe(false);
    expect(d.metin).toBeNull();
  });

  it('ilk gün serbest — yeni oyuncu posta kutusuna gönderilmiyor', () => {
    const d = dogrulamaDurumu(null, simdi, simdi);
    expect(d.girisKapali).toBe(false);
    expect(d.kalanGun).toBe(SERBEST_GUN);
    expect(d.metin).toContain('doğrulanmadı');
  });

  it('serbest süre dolunca giriş doğrulama istiyor', () => {
    const d = dogrulamaDurumu(null, gunOnce(SERBEST_GUN + 1), simdi);
    expect(d.girisKapali).toBe(true);
    expect(d.kalanGun).toBe(0);
  });

  it('son günde hâlâ girilebiliyor — sınır kapsayıcı', () => {
    const d = dogrulamaDurumu(null, gunOnce(SERBEST_GUN - 0.5), simdi);
    expect(d.girisKapali).toBe(false);
    expect(d.kalanGun).toBe(1);
  });
});

describe('gonderilebilirMi', () => {
  it('ilk gönderim serbest', () => {
    expect(gonderilebilirMi(null, 0, simdi).uygun).toBe(true);
  });

  it('bir dakika dolmadan yeniden gönderilemiyor', () => {
    const az = new Date(simdi.getTime() - (YENIDEN_GONDER_BEKLEME_SN - 10) * 1000);
    const r = gonderilebilirMi(az, 1, simdi);
    expect(r.uygun).toBe(false);
    expect(r.sebep).toContain('bekle');
  });

  it('bir dakika geçince gönderilebiliyor', () => {
    const yeterli = new Date(simdi.getTime() - (YENIDEN_GONDER_BEKLEME_SN + 1) * 1000);
    expect(gonderilebilirMi(yeterli, 1, simdi).uygun).toBe(true);
  });

  it('günlük tavan sabırlı olanı da durduruyor', () => {
    const eski = new Date(simdi.getTime() - 3600_000);
    expect(gonderilebilirMi(eski, GUNLUK_GONDERIM_TAVANI, simdi).uygun).toBe(false);
  });
});

describe('jetonGecerli', () => {
  it('süresi dolmamış ve kullanılmamış jeton geçerli', () => {
    expect(jetonGecerli(jetonBitisi(simdi), null, simdi)).toBe(true);
  });

  it('kullanılmış jeton İKİNCİ kez geçmiyor', () => {
    expect(jetonGecerli(jetonBitisi(simdi), simdi, simdi)).toBe(false);
  });

  it('süresi dolmuş jeton geçmiyor', () => {
    const bitis = new Date(simdi.getTime() - 1000);
    expect(jetonGecerli(bitis, null, simdi)).toBe(false);
  });
});
