import { describe, expect, it } from 'vitest';
import {
  DILLER,
  VARSAYILAN_DIL,
  anahtar,
  cevir,
  cevirSunucu,
  cogulSec,
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

describe('cogulSec', () => {
  it('İngilizcede 1 tekil, gerisi çoğul', () => {
    const k = '{0} battle|{0} battles';
    expect(cogulSec(k, [1], 'en')).toBe('{0} battle');
    expect(cogulSec(k, [0], 'en')).toBe('{0} battles');
    expect(cogulSec(k, [2], 'en')).toBe('{0} battles');
  });

  it('BİÇİMLENMİŞ dizgeden de sayıyı okuyor', () => {
    // Çağıranların çoğu `formatSayi()` çıktısını veriyor: "1.234".
    expect(cogulSec('{0} unit|{0} units', ['1'], 'en')).toBe('{0} unit');
    expect(cogulSec('{0} unit|{0} units', ['1.234'], 'en')).toBe('{0} units');
  });

  it('boru işareti yoksa kalıp olduğu gibi dönüyor', () => {
    expect(cogulSec('{0} savaş', [1], 'tr')).toBe('{0} savaş');
  });

  it('sayı yoksa çoğula düşüyor', () => {
    expect(cogulSec('{0} battle|{0} battles', [], 'en')).toBe('{0} battles');
    expect(cogulSec('{0} battle|{0} battles', ['Kara Yusuf'], 'en')).toBe('{0} battles');
  });

  it('Türkçede tek biçim: iki biçim verilse bile 1 tekili seçiyor', () => {
    // Türkçe kaynakta boru işareti hiç yok; yine de kural tutarlı olmalı.
    expect(cogulSec('{0} gün|{0} gün', [3], 'tr')).toBe('{0} gün');
  });
});

describe('cevir — çoğul', () => {
  const sozluk: Sozluk = {
    [anahtar('{0} savaş')]: '{0} battle|{0} battles',
    [anahtar('{0} gün')]: '{0} day|{0} days',
  };

  it('tekil ve çoğul doğru yerleşiyor', () => {
    expect(cevir(sozluk, '{0} savaş', 1)).toBe('1 battle');
    expect(cevir(sozluk, '{0} savaş', 5)).toBe('5 battles');
  });

  it('çeviri yokken TÜRKÇE bölünmüyor', () => {
    // Kaynakta boru işareti geçseydi ikiye kırılmamalı.
    expect(cevir(null, 'Şehir | Ordu | Akın', 1)).toBe('Şehir | Ordu | Akın');
  });
});

describe('cevirSunucu — çoğul', () => {
  const kaynaklar = {
    [anahtar('{0} birim {1} garnizonunda kaldı.')]: '{0} birim {1} garnizonunda kaldı.',
  };
  const sozluk: Sozluk = {
    [anahtar('{0} birim {1} garnizonunda kaldı.')]:
      '{0} unit remained in the {1} garrison.|{0} units remained in the {1} garrison.',
  };
  const kaliplar = sunucuKaliplari(sozluk, kaynaklar);

  it('sunucudan gelen YERLEŞTİRİLMİŞ mesajda da tekil seçiliyor', () => {
    expect(cevirSunucu(sozluk, kaliplar, '1 birim Akpazar garnizonunda kaldı.')).toBe(
      '1 unit remained in the Akpazar garrison.',
    );
    expect(cevirSunucu(sozluk, kaliplar, '7 birim Akpazar garnizonunda kaldı.')).toBe(
      '7 units remained in the Akpazar garrison.',
    );
  });
});

describe('cogulSec — köşeli gruplar', () => {
  const k = '{0} [lord|lords] played in the last {1} [day|days]';

  it('her grup KENDİ sayısına bağlanıyor', () => {
    expect(cogulSec(k, [1, 7], 'en')).toBe('{0} lord played in the last {1} days');
    expect(cogulSec(k, [9, 1], 'en')).toBe('{0} lords played in the last {1} day');
    expect(cogulSec(k, [1, 1], 'en')).toBe('{0} lord played in the last {1} day');
    expect(cogulSec(k, [4, 7], 'en')).toBe('{0} lords played in the last {1} days');
  });

  it('argüman eksikse genel hâl (çoğul)', () => {
    expect(cogulSec(k, [1], 'en')).toBe('{0} lord played in the last {1} days');
    expect(cogulSec(k, [], 'en')).toBe('{0} lords played in the last {1} days');
  });

  it('solunda yer tutucu olmayan grup çoğula düşüyor', () => {
    expect(cogulSec('Maximum [pact|pacts]: {0}', [1], 'en')).toBe('Maximum pacts: {0}');
  });

  it('köşeli grup yokken eski davranış sürüyor', () => {
    expect(cogulSec('{0} battle|{0} battles', [1], 'en')).toBe('{0} battle');
  });

  it('cevir() içinden uçtan uca', () => {
    const sozluk: Sozluk = {
      [anahtar('{0} lord son {1} günde oynadı')]:
        '{0} [lord|lords] played in the last {1} [day|days]',
    };
    expect(cevir(sozluk, '{0} lord son {1} günde oynadı', 1, 7)).toBe(
      '1 lord played in the last 7 days',
    );
    expect(cevir(sozluk, '{0} lord son {1} günde oynadı', 12, 1)).toBe(
      '12 lords played in the last 1 day',
    );
  });
});
