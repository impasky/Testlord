/**
 * Veri dosyalarındaki her `etki` anahtarının okunur bir adı var mı.
 *
 * Bu sınama eşlemenin TAM olduğunu değil, VERİYLE aynı olduğunu
 * doğruluyor. Üç ekranın üç ayrı kopyası tam da bu yüzden sessizce
 * ayrışmıştı: generals.json'a yeni bir pasif girdiğinde hiçbir şey
 * kırılmıyor, yalnız ekranda ham anahtar yazıyordu.
 */
import { describe, expect, it } from 'vitest';
import generals from '../../../data/generals.json';
import balance from '../../../data/balance.json';
import { ETKI_ADI, etkiAdi } from './etki-adi.js';

function etkiAnahtarlari(kok: unknown): string[] {
  const bulunan: string[] = [];
  (function gez(o: unknown): void {
    if (Array.isArray(o)) return o.forEach(gez);
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'etki' && typeof v === 'string') bulunan.push(v);
      else gez(v);
    }
  })(kok);
  return [...new Set(bulunan)].sort();
}

describe('etkiAdi', () => {
  it('generals.json içindeki her pasif etkisinin adı var', () => {
    for (const k of etkiAnahtarlari(generals)) expect(ETKI_ADI[k], k).toBeTruthy();
  });

  it('ordu donanımı hatlarının etkilerinin adı var', () => {
    for (const k of etkiAnahtarlari(balance.ordu_donanimi)) expect(ETKI_ADI[k], k).toBeTruthy();
  });

  it('bilinmeyen anahtar ham hâliyle dönüyor', () => {
    expect(etkiAdi('bilinmeyen_etki')).toBe('bilinmeyen_etki');
  });
});
