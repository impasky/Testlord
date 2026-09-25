import { describe, expect, it } from 'vitest';
import {
  HAZIR_PORTRELER,
  ayniSozMu,
  profilResmiCoz,
  profilResmiSutunu,
  resimKarari,
  type ResimTahmini,
} from './profil.js';
import { B } from './balance.js';

const t = (p: Partial<ResimTahmini>): ResimTahmini => ({
  Porn: 0,
  Hentai: 0,
  Sexy: 0,
  Neutral: 0,
  Drawing: 0,
  ...p,
});

describe('profil resmi — otomatik denetim', () => {
  it('açık cinsel içerik anında reddediliyor', () => {
    expect(resimKarari(t({ Porn: 0.9 })).karar).toBe('red');
    expect(resimKarari(t({ Hentai: 0.8 })).karar).toBe('red');
    // İkisinin TOPLAMI sayılıyor: 0,4 + 0,4 fotoğraf mı çizim mi
    // kararsız ama açık içerik.
    expect(resimKarari(t({ Porn: 0.4, Hentai: 0.4 })).karar).toBe('red');
  });

  it('çok açık (Sexy) içerik de reddediliyor', () => {
    expect(resimKarari(t({ Sexy: 0.9 })).karar).toBe('red');
  });

  it('temiz resim hemen onaylanıyor', () => {
    expect(resimKarari(t({ Neutral: 0.95, Drawing: 0.05 })).karar).toBe('onay');
    expect(resimKarari(t({ Drawing: 0.97, Hentai: 0.02 })).karar).toBe('onay');
  });

  /**
   * Oyunun kendi okçubaşı portresi sınıflandırıcıdan Hentai 0,46 aldı.
   * Ne reddedilmeli ne de sorgusuz geçmeli: bir insana gitmeli.
   */
  it('kararsız bölge yöneticiye gidiyor — ölçülen gerçek örnek', () => {
    const okcubasi = t({ Drawing: 0.528, Hentai: 0.458, Neutral: 0.011, Porn: 0.002 });
    expect(resimKarari(okcubasi).karar).toBe('inceleme');
    expect(resimKarari(t({ Sexy: 0.3, Neutral: 0.7 })).karar).toBe('inceleme');
  });

  it('sınıflandırıcı çalışmadıysa resim onaylanmıyor, incelemeye gidiyor', () => {
    expect(resimKarari(null).karar).toBe('inceleme');
  });

  it('eşikler tutarlı: onay eşiği ret eşiğinin altında', () => {
    const P = B.profil_resmi;
    expect(P.onay_esigi).toBeLessThan(P.red_esigi);
    expect(P.red_esigi).toBeLessThanOrEqual(1);
    expect(P.gunluk_yukleme).toBeGreaterThan(0);
  });

  it('red ve inceleme oyuncuya ne olacağını söylüyor', () => {
    expect(resimKarari(t({ Porn: 1 })).metin).toMatch(/kullanılamaz/);
    expect(resimKarari(null).metin).toMatch(/onay/);
  });
});

describe('profil resmi — sütun', () => {
  it('boş sütun arma demek', () => {
    expect(profilResmiCoz(null)).toEqual({ tur: 'arma' });
    expect(profilResmiCoz('')).toEqual({ tur: 'arma' });
  });

  it('hazır portre ve yüklenen resim gidip geliyor', () => {
    for (const r of [
      { tur: 'hazir', key: 'casus_leyla' },
      { tur: 'yuklenen', id: 'ck123' },
      { tur: 'arma' },
    ] as const) {
      expect(profilResmiCoz(profilResmiSutunu(r))).toEqual(r);
    }
  });

  /** Listeden çıkarılan bir portre, onu seçmiş oyuncunun sohbetini kırmamalı. */
  it('tanınmayan değer armaya düşüyor', () => {
    expect(profilResmiCoz('hazir:olmayan')).toEqual({ tur: 'arma' });
    expect(profilResmiCoz('baska:x')).toEqual({ tur: 'arma' });
    expect(profilResmiCoz('yuklenen:')).toEqual({ tur: 'arma' });
  });

  // Her portrenin görseli gerçekten var mı: tools/profil-testi.mjs her
  // birini sunucudan istiyor (burada dosya sistemine erişim yok).
  it('portre anahtarları benzersiz', () => {
    expect(new Set(HAZIR_PORTRELER.map((p) => p.key)).size).toBe(HAZIR_PORTRELER.length);
  });
});

describe('genel sohbet — aynı söz', () => {
  it('büyük harf, boşluk ve noktalama farkı aynı söz sayılıyor', () => {
    expect(ayniSozMu('SELAM!!!', 'selam')).toBe(true);
    expect(ayniSozMu('ittifak arıyorum', 'İttifak  arıyorum.')).toBe(true);
  });

  it('farklı sözler ayrı', () => {
    expect(ayniSozMu('selam', 'merhaba')).toBe(false);
    expect(ayniSozMu('!!!', '???')).toBe(false);
  });
});
