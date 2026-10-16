/**
 * Çoklu hesap şüphesi: hangi bağ listeye girer, hangisi girmez.
 *
 * İki yönlü yanılgı da pahalı: meşru yardımı listeye dökmek yöneticinin
 * gözünü kör eder, beslemeyi kaçırmak listeyi anlamsız kılar.
 */
import { describe, expect, it } from 'vitest';
import { COKLU_HESAP, cokluHesapBaglari } from './cokluHesap.js';

const bos = { sevkiyatlar: [], takviyeler: [], pazar: [] };
const E = COKLU_HESAP.sevkiyatEsigi;

describe('çoklu hesap bağları', () => {
  it('tek yönlü büyük sevkiyat işaretleniyor, besleyen veren taraf', () => {
    const b = cokluHesapBaglari({
      ...bos,
      sevkiyatlar: [
        { from: 'alt', to: 'ana', agirlik: E / 2 },
        { from: 'alt', to: 'ana', agirlik: E / 2 },
      ],
    });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ besleyen: 'alt', alan: 'ana', sevkiyat: E, geriSevkiyat: 0 });
    expect(b[0]!.isaretler).toEqual(['sevkiyat']);
  });

  it('iki yönlü yardım (karşılıklı ticaret) işaretlenmiyor', () => {
    const b = cokluHesapBaglari({
      ...bos,
      sevkiyatlar: [
        { from: 'a', to: 'b', agirlik: E },
        { from: 'b', to: 'a', agirlik: E * COKLU_HESAP.tekYonOrani },
      ],
    });
    expect(b).toEqual([]);
  });

  it('eşiğin altındaki sevkiyat işaretlenmiyor', () => {
    expect(
      cokluHesapBaglari({ ...bos, sevkiyatlar: [{ from: 'a', to: 'b', agirlik: E - 1 }] }),
    ).toEqual([]);
  });

  it('takviye ve pazar kendi eşikleriyle', () => {
    const takviye = Array.from({ length: COKLU_HESAP.takviyeEsigi }, () => ({
      from: 'a',
      to: 'b',
    }));
    const pazar = Array.from({ length: COKLU_HESAP.pazarCiftEsigi }, (_, i) =>
      i % 2 ? { satici: 'c', alici: 'd' } : { satici: 'd', alici: 'c' },
    );
    const b = cokluHesapBaglari({ ...bos, takviyeler: takviye, pazar });
    expect(b.find((x) => x.besleyen === 'a')?.isaretler).toEqual(['takviye']);
    // Pazar yönsüz: iki yöndeki işlemler aynı çiftin.
    const cd = b.find((x) => [x.besleyen, x.alan].sort().join() === 'c,d');
    expect(cd?.pazar).toBe(COKLU_HESAP.pazarCiftEsigi);
    expect(cd?.isaretler).toEqual(['pazar']);

    const azTakviye = takviye.slice(1);
    expect(cokluHesapBaglari({ ...bos, takviyeler: azTakviye })).toEqual([]);
  });

  it('çok işaretli bağ önce geliyor', () => {
    const b = cokluHesapBaglari({
      sevkiyatlar: [
        { from: 'x', to: 'y', agirlik: E * 3 },
        { from: 'p', to: 'q', agirlik: E },
      ],
      takviyeler: Array.from({ length: COKLU_HESAP.takviyeEsigi }, () => ({ from: 'p', to: 'q' })),
      pazar: [],
    });
    expect(b.map((x) => x.besleyen)).toEqual(['p', 'x']);
  });

  it('kendine akış sayılmıyor', () => {
    expect(
      cokluHesapBaglari({
        sevkiyatlar: [{ from: 'a', to: 'a', agirlik: E * 5 }],
        takviyeler: [{ from: 'a', to: 'a' }],
        pazar: [{ satici: 'a', alici: 'a' }],
      }),
    ).toEqual([]);
  });
});
