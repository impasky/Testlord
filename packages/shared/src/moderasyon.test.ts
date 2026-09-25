import { describe, expect, it } from 'vitest';
import {
  GIZLEME_ESIGI,
  SIKAYET_SEBEPLERI,
  SUSTURMA_SURELERI,
  YASAK_SURELERI,
  islemMetni,
  kararMetni,
  karariDenetle,
  otomatikGizlenir,
  sebepMetni,
  sikayetSatiri,
  sikayetiDenetle,
  susturmaBitisi,
  susturmaDurumu,
  susturmaSuresiGecerli,
  susturmaSuresiMetni,
  yasagiDenetle,
  yasakDurumu,
  yasakSuresiGecerli,
} from './moderasyon.js';

const AN = new Date('2026-09-14T12:00:00Z');

describe('şikâyet denetimi', () => {
  it('bilinmeyen sebep reddediliyor', () => {
    expect(sikayetiDenetle('uydurma', 'bir şey').uygun).toBe(false);
  });

  it('hazır sebep açıklamasız geçiyor', () => {
    expect(sikayetiDenetle('hakaret', '').uygun).toBe(true);
  });

  it('"diğer" açıklamasız geçmiyor', () => {
    const s = sikayetiDenetle('diger', '');
    expect(s.uygun).toBe(false);
    expect(s.sebep).toContain('açıkla');
  });

  it('"diğer" açıklamayla geçiyor', () => {
    expect(sikayetiDenetle('diger', 'Sürekli aynı şeyi yazıyor.').uygun).toBe(true);
  });

  it('çok uzun açıklama reddediliyor', () => {
    expect(sikayetiDenetle('hakaret', 'a'.repeat(5000)).uygun).toBe(false);
  });

  it('her sebebin okunur bir metni var', () => {
    for (const s of SIKAYET_SEBEPLERI) {
      expect(sebepMetni(s.anahtar).length).toBeGreaterThan(3);
    }
  });

  it('kayıt satırı sebebi ve açıklamayı birleştiriyor', () => {
    expect(sikayetSatiri('hakaret', ' küfür etti ')).toBe('Hakaret veya küfür — küfür etti');
    expect(sikayetSatiri('hakaret', '')).toBe('Hakaret veya küfür');
  });
});

describe('otomatik gizleme', () => {
  it('eşiğin altında gizlenmiyor', () => {
    expect(otomatikGizlenir(GIZLEME_ESIGI - 1)).toBe(false);
  });

  it('eşikte gizleniyor', () => {
    expect(otomatikGizlenir(GIZLEME_ESIGI)).toBe(true);
  });

  it('eşik iki kişiyle aşılamıyor — iki kişi anlaşabilir', () => {
    expect(GIZLEME_ESIGI).toBeGreaterThan(2);
  });
});

describe('susturma', () => {
  it('yalnız listedeki süreler geçerli', () => {
    for (const s of SUSTURMA_SURELERI) expect(susturmaSuresiGecerli(s)).toBe(true);
    expect(susturmaSuresiGecerli(9999)).toBe(false);
  });

  it('kalıcı susturma yok', () => {
    for (const s of SUSTURMA_SURELERI) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeLessThanOrEqual(24 * 30);
    }
  });

  it('süre metni saat ve günü ayırıyor', () => {
    expect(susturmaSuresiMetni(1)).toBe('1 saat');
    expect(susturmaSuresiMetni(24)).toBe('1 gün');
    expect(susturmaSuresiMetni(168)).toBe('7 gün');
  });

  it('kayıt yokken susturulmuş değil', () => {
    expect(susturmaDurumu(null, null, AN).susturulmus).toBe(false);
  });

  it('süresi geçmiş kayıt susturmuyor', () => {
    const gecmis = new Date(AN.getTime() - 1000);
    expect(susturmaDurumu(gecmis, 'hakaret', AN).susturulmus).toBe(false);
  });

  it('süren susturma sebebini ve kalan süreyi söylüyor', () => {
    const bitis = susturmaBitisi(24, AN);
    const d = susturmaDurumu(bitis, 'Hakaret veya küfür', AN);
    expect(d.susturulmus).toBe(true);
    expect(d.metin).toContain('1 gün');
    expect(d.metin).toContain('Hakaret veya küfür');
  });

  it('son dakikalar dakika olarak söyleniyor', () => {
    const bitis = new Date(AN.getTime() + 5 * 60_000);
    expect(susturmaDurumu(bitis, null, AN).metin).toContain('5 dakika');
  });

  it('bitiş anı tam olarak süre kadar ileride', () => {
    expect(susturmaBitisi(1, AN).getTime() - AN.getTime()).toBe(3600_000);
  });
});

describe('karar denetimi', () => {
  it('bilinmeyen karar reddediliyor', () => {
    expect(karariDenetle('banla', 'mesaj', null).uygun).toBe(false);
  });

  it('lord şikâyetinde mesaj silinemiyor', () => {
    const s = karariDenetle('mesaj_sil', 'lord', null);
    expect(s.uygun).toBe(false);
    expect(s.sebep).toContain('silinecek bir mesaj yok');
  });

  it('mesaj şikâyetinde mesaj silinebiliyor — ittifak da genel sohbet de', () => {
    expect(karariDenetle('mesaj_sil', 'mesaj', null).uygun).toBe(true);
    expect(karariDenetle('mesaj_sil', 'genel', null).uygun).toBe(true);
  });

  it('resim şikâyetinde mesaj silinemiyor, resim kaldırılabiliyor', () => {
    expect(karariDenetle('mesaj_sil', 'resim', null).uygun).toBe(false);
    expect(karariDenetle('resim_kaldir', 'resim', null).uygun).toBe(true);
  });

  it('resim kaldırma yalnız resim şikâyetinde', () => {
    for (const tur of ['lord', 'mesaj', 'genel'] as const) {
      const s = karariDenetle('resim_kaldir', tur, null);
      expect(s.uygun).toBe(false);
      expect(s.sebep).toContain('resim yok');
    }
  });

  it('susturma süresiz kabul edilmiyor', () => {
    expect(karariDenetle('sustur', 'mesaj', null).uygun).toBe(false);
  });

  it('susturma listede olmayan süreyle kabul edilmiyor', () => {
    expect(karariDenetle('sustur', 'mesaj', 3).uygun).toBe(false);
  });

  it('susturma geçerli süreyle kabul ediliyor', () => {
    for (const s of SUSTURMA_SURELERI) {
      expect(karariDenetle('sustur', 'lord', s).uygun).toBe(true);
    }
  });

  it('yok say her tür için geçerli', () => {
    expect(karariDenetle('yok_say', 'lord', null).uygun).toBe(true);
    expect(karariDenetle('yok_say', 'mesaj', null).uygun).toBe(true);
  });

  it('karar metni süreyi içeriyor', () => {
    expect(kararMetni('sustur', 24)).toContain('1 gün');
    expect(kararMetni('yok_say')).toContain('yok sayıldı');
    expect(kararMetni('resim_kaldir')).toContain('Profil resmi');
  });
});

/* ------------------------------------------------------------------ */
/* Hesap yasağı (docs/14 — yönetici paneli)                            */
/* ------------------------------------------------------------------ */

describe('yasak', () => {
  const simdi = new Date('2026-09-20T12:00:00Z');

  it('kalıcı yasak süre beklemiyor', () => {
    const y = yasakDurumu(true, null, 'bot hesabı', simdi);
    expect(y.yasakli).toBe(true);
    expect(y.kalici).toBe(true);
    expect(y.metin).toContain('kalıcı');
    expect(y.metin).toContain('bot hesabı');
  });

  it('süreli yasak bitince KENDİLİĞİNDEN düşüyor', () => {
    const bitis = new Date(simdi.getTime() + 3600_000);
    expect(yasakDurumu(false, bitis, 'küfür', simdi).yasakli).toBe(true);
    // Kayıt duruyor ama süre geçti: "aktif mi" sorusu tarihe bakıyor.
    const sonra = new Date(bitis.getTime() + 1000);
    expect(yasakDurumu(false, bitis, 'küfür', sonra).yasakli).toBe(false);
  });

  it('yasağı olmayan hesap yasaklı değil', () => {
    expect(yasakDurumu(false, null, null, simdi).yasakli).toBe(false);
    expect(yasakDurumu(false, null, null, simdi).metin).toBeNull();
  });

  it('sebep ZORUNLU — sebepsiz yasak oyuncuya hiçbir şey söylemiyor', () => {
    expect(yagiDenetleKisa(YASAK_SURELERI[0] ?? 24, '')).toBe(false);
    expect(yagiDenetleKisa(YASAK_SURELERI[0] ?? 24, 'ab')).toBe(false);
    expect(yagiDenetleKisa(YASAK_SURELERI[0] ?? 24, 'bot')).toBe(true);
  });

  it('süre dengeden geliyor; uydurma süre geçmiyor', () => {
    expect(yasakSuresiGecerli(YASAK_SURELERI[0] ?? 24)).toBe(true);
    expect(yasakSuresiGecerli(7)).toBe(false);
    // null = kalıcı, ve kalıcı yasak açık.
    expect(yasakSuresiGecerli(null)).toBe(true);
  });

  it('işlem metni kayda ne yazacağını söylüyor', () => {
    expect(islemMetni('yasakla', null)).toContain('KALICI');
    expect(islemMetni('yasakla', 24)).toContain('1 gün');
    expect(islemMetni('yasak_kaldir')).toBe('Yasak kaldırıldı');
    expect(islemMetni('susturma_kaldir')).toBe('Susturma kaldırıldı');
    // Eski ad yeni işlevi çağırıyor: kuyruk kararları aynı satırı yazıyor.
    expect(kararMetni('sustur', 1)).toBe(islemMetni('sustur', 1));
  });
});

function yagiDenetleKisa(saat: number | null, sebep: string): boolean {
  return yasagiDenetle(saat, sebep).uygun;
}
