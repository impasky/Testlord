import { describe, expect, it } from 'vitest';
import {
  DILLER,
  VARSAYILAN_DIL,
  anahtar,
  cevir,
  cevirSunucu,
  dilGecerli,
  sunucuKaliplari,
  yerlestir,
  type Sozluk,
} from './dil.js';

describe('anahtar', () => {
  it('çıkarıcıyla aynı FNV-1a değerini üretiyor', () => {
    // Bu değer tools/metin-cikar.mjs'nin ürettiğiyle aynı olmak ZORUNDA:
    // ayrışırsa bütün çeviriler sessizce bulunamaz olur.
    expect(anahtar('Ordu')).toMatch(/^t[0-9a-f]{8}$/);
    expect(anahtar('Ordu')).toBe(anahtar('Ordu'));
    expect(anahtar('Ordu')).not.toBe(anahtar('Ordular'));
  });

  it('boş metin de anahtar üretiyor', () => {
    expect(anahtar('')).toMatch(/^t[0-9a-f]{8}$/);
  });
});

describe('diller', () => {
  it('varsayılan dil listede', () => {
    expect(DILLER.some((d) => d.kod === VARSAYILAN_DIL)).toBe(true);
  });

  it('bilinmeyen kod reddediliyor', () => {
    expect(dilGecerli('tr')).toBe(true);
    expect(dilGecerli('klingon')).toBe(false);
  });
});

describe('yerleştirme', () => {
  it('sırayla koyuyor', () => {
    expect(yerlestir('{0} bölge, {1} lord', [3, 'Ayşe'])).toBe('3 bölge, Ayşe lord');
  });

  it('SIRA DEĞİŞEBİLİR — İngilizcede sözcük düzeni başka', () => {
    expect(yerlestir('{1} regions of {0}', ['Bolu', 5])).toBe('5 regions of Bolu');
  });

  it('aynı yer tutucu iki kez kullanılabiliyor', () => {
    expect(yerlestir('{0} ve yine {0}', ['x'])).toBe('x ve yine x');
  });

  it('argüman yoksa kalıp bozulmuyor', () => {
    expect(yerlestir('{0} bölge', [])).toBe('{0} bölge');
  });
});

describe('çeviri', () => {
  const sozluk: Sozluk = {
    [anahtar('Ordun yetiyor.')]: 'Your army is enough.',
    [anahtar('{0} bölge')]: '{0} regions',
  };

  it('sözlükteki metni döndürüyor', () => {
    expect(cevir(sozluk, 'Ordun yetiyor.')).toBe('Your army is enough.');
  });

  it('YOKSA TÜRKÇE DÖNÜYOR — yarım çeviri oyunu kırmıyor', () => {
    expect(cevir(sozluk, 'Bilinmeyen cümle.')).toBe('Bilinmeyen cümle.');
  });

  it('sözlük null iken Türkçe dönüyor', () => {
    expect(cevir(null, 'Ordun yetiyor.')).toBe('Ordun yetiyor.');
  });

  it('yer tutucuyu çeviriye yerleştiriyor', () => {
    expect(cevir(sozluk, '{0} bölge', 7)).toBe('7 regions');
  });

  it('çevirisi olmayan kalıba da yerleştiriyor', () => {
    expect(cevir(sozluk, '{0} şey', 2)).toBe('2 şey');
  });
});

describe('sunucu mesajı', () => {
  const kaynaklar = {
    [anahtar('Bu lord adı alınmış.')]: 'Bu lord adı alınmış.',
    [anahtar('Bu bölgeye {0} saat içinde tekrar saldıramazsın.')]:
      'Bu bölgeye {0} saat içinde tekrar saldıramazsın.',
    [anahtar('{0} altın')]: '{0} altın',
    [anahtar('{0} lord, {1} bölge')]: '{0} lord, {1} bölge',
  };
  const sozluk: Sozluk = {
    [anahtar('Bu lord adı alınmış.')]: 'This lord name is taken.',
    [anahtar('Bu bölgeye {0} saat içinde tekrar saldıramazsın.')]:
      'You cannot attack this region again within {0} hours.',
    [anahtar('{0} altın')]: '{0} gold',
    [anahtar('{0} lord, {1} bölge')]: '{1} regions, {0} lords',
  };
  const kaliplar = sunucuKaliplari(sozluk, kaynaklar);

  it('yer tutucusuz mesaj doğrudan bulunuyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, 'Bu lord adı alınmış.')).toBe('This lord name is taken.');
  });

  it('YERLEŞTİRİLMİŞ mesaj kalıba uyup çevriliyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, 'Bu bölgeye 12 saat içinde tekrar saldıramazsın.')).toBe(
      'You cannot attack this region again within 12 hours.',
    );
  });

  it('yakalanan parça çevirideki YENİ sıraya göre yerleşiyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, '3 lord, 8 bölge')).toBe('8 regions, 3 lords');
  });

  it('zayıf kalıp belirgin kalıbı çalmıyor', () => {
    // "{0} altın" her şeye uyabilirdi; sabit metni uzun olan önce denenir.
    expect(cevirSunucu(sozluk, kaliplar, '250 altın')).toBe('250 gold');
  });

  it('tanınmayan mesaj olduğu gibi dönüyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, 'Hiç bilmediğim bir hata.')).toBe(
      'Hiç bilmediğim bir hata.',
    );
  });

  it('boş metin boş dönüyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, '')).toBe('');
  });

  it('sözlük yokken metin dokunulmadan dönüyor', () => {
    expect(cevirSunucu(null, kaliplar, 'Bu lord adı alınmış.')).toBe('Bu lord adı alınmış.');
  });

  it('düzenli ifade karakterleri kalıbı bozmuyor', () => {
    const k2 = { [anahtar('Bölge limitin dolu ({0}/{1}).')]: 'Bölge limitin dolu ({0}/{1}).' };
    const s2: Sozluk = {
      [anahtar('Bölge limitin dolu ({0}/{1}).')]: 'Your region limit is full ({0}/{1}).',
    };
    const kl = sunucuKaliplari(s2, k2);
    expect(cevirSunucu(s2, kl, 'Bölge limitin dolu (3/5).')).toBe(
      'Your region limit is full (3/5).',
    );
  });
});
