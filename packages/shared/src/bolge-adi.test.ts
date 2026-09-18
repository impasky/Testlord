/**
 * Haritadaki her bölge türünün okunur bir adı var mı.
 *
 * `etki-adi.test.ts` ile aynı sınama, aynı sebep: eşlemenin TAM
 * olduğunu değil, VERİYLE aynı olduğunu doğruluyor. Üç ekranın üç ayrı
 * kopyası tam da bu yüzden sessizce ayrışmıştı — `world-map.json`a köy
 * girdiğinde hiçbir şey kırılmadı, yalnız hedef şeridinde "koy" yazdı.
 *
 * Bu sınama o hatayı bir daha sessiz bırakmıyor: haritaya yeni bir tür
 * girerse burası kırmızı yanar.
 */
import { describe, expect, it } from 'vitest';
import { WORLD_MAP } from './balance.js';
import { BOLGE_ADI, bolgeAdi } from './bolge-adi.js';

describe('bolgeAdi', () => {
  it('world-map.json içindeki her bölge türünün adı var', () => {
    const turler = [...new Set(WORLD_MAP.regions.map((r) => r.type))].sort();
    expect(turler.length).toBeGreaterThan(0);
    for (const t of turler) expect(BOLGE_ADI[t as keyof typeof BOLGE_ADI], t).toBeTruthy();
  });

  it('köy adı var — hatanın kendisi buydu', () => {
    expect(bolgeAdi('koy')).toBe('Köy');
  });

  it('hiçbir ad ham anahtarla aynı değil', () => {
    // Ham anahtar döndüren bir kayıt, yedeğin sessizce devreye girmesiyle
    // aynı şey: ekranda "koy" yazar ve test bunu görmez.
    for (const [anahtar, ad] of Object.entries(BOLGE_ADI)) expect(ad).not.toBe(anahtar);
  });

  it('bilinmeyen anahtar ham hâliyle dönüyor', () => {
    expect(bolgeAdi('bilinmeyen_tur')).toBe('bilinmeyen_tur');
  });
});
