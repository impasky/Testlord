/**
 * Çoklu hesap şüphesi: hangi bağ listeye girer, hangisi girmez.
 *
 * İki yönlü yanılgı da pahalı: meşru yardımı listeye dökmek yöneticinin
 * gözünü kör eder, beslemeyi kaçırmak listeyi anlamsız kılar.
 */
import { describe, expect, it } from 'vitest';
import { COKLU_HESAP, cokluHesapBaglari, ortakAgGunleri } from './cokluHesap.js';

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

  /* --- Ağ izi --------------------------------------------------- */

  const gunlerde = (lordlar: string[], ozet: string, gunler: number[]) =>
    lordlar.flatMap((lordId) => gunler.map((gun) => ({ lordId, ozet, gun })));

  it('ağ tek başına listeye sokmuyor: aynı evde iki kardeş olağan', () => {
    const b = cokluHesapBaglari({ ...bos, agIzleri: gunlerde(['a', 'b'], 'ev', [1, 2, 3]) });
    expect(b).toEqual([]);
  });

  it('aralarında akış olan çifte ağ işareti ekleniyor ve öne çıkıyor', () => {
    const kucuk = { from: 'alt', to: 'ana', agirlik: E / 10 }; // eşiğin altında
    const b = cokluHesapBaglari({
      ...bos,
      sevkiyatlar: [kucuk, { from: 'x', to: 'y', agirlik: E }],
      agIzleri: gunlerde(['alt', 'ana'], 'ev', [1, 2]),
    });
    expect(b.map((x) => [x.besleyen, x.isaretler])).toEqual([
      ['x', ['sevkiyat']],
      ['alt', ['ag']],
    ]);
    expect(b[1]!.agGun).toBe(2);
    // İki işaretli, tek işaretliden önce.
    const iki = cokluHesapBaglari({
      ...bos,
      sevkiyatlar: [
        { from: 'alt', to: 'ana', agirlik: E },
        { from: 'x', to: 'y', agirlik: E * 3 },
      ],
      agIzleri: gunlerde(['alt', 'ana'], 'ev', [1, 2]),
    });
    expect(iki[0]!.isaretler).toEqual(['sevkiyat', 'ag']);
  });

  it('ortak gün AYNI gün sayılıyor; tek gün eşiğin altında', () => {
    const farkliGun = [
      { lordId: 'a', ozet: 'ev', gun: 1 },
      { lordId: 'b', ozet: 'ev', gun: 2 },
    ];
    expect(ortakAgGunleri(farkliGun).size).toBe(0);
    const b = cokluHesapBaglari({
      ...bos,
      sevkiyatlar: [{ from: 'a', to: 'b', agirlik: 1 }],
      agIzleri: gunlerde(['a', 'b'], 'ev', [1]),
    });
    expect(b).toEqual([]);
  });

  it('kalabalık ağ (mobil operatör, yurt) yok sayılıyor', () => {
    const cok = Array.from({ length: COKLU_HESAP.kalabalikAgLord + 1 }, (_, i) => `l${i}`);
    expect(ortakAgGunleri(gunlerde(cok, 'cgnat', [1, 2])).size).toBe(0);
    const sinirda = cok.slice(0, COKLU_HESAP.kalabalikAgLord);
    expect(ortakAgGunleri(gunlerde(sinirda, 'ev', [1, 2])).get('l0|l1')).toBe(2);
  });
});
