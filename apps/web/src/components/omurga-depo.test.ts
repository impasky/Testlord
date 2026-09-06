import { beforeAll, describe, expect, it } from 'vitest';
import { REHBER_ASAMALARI } from '@lordlar/shared';

/**
 * Omurga, api/client'ı çekiyor; o da modül yüklenirken `window`a bakıyor.
 * Test ortamı node (vitest.config.ts) ve jsdom eklemek yalnız bu dosya
 * için ağır bir bağımlılık olurdu — modül yüklenmeden önce en küçük
 * `window` konuyor ve import dinamik yapılıyor.
 */
type Siradaki = typeof import('./Omurga').siradakiAdim;
let siradakiAdim: Siradaki;

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = {
    location: { protocol: 'http:', hostname: 'localhost' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  siradakiAdim = (await import('./Omurga')).siradakiAdim;
});

/**
 * Depo adımının sırası.
 *
 * Bu adım omurganın SONLARINDA duruyor ve gerçek bir oturumda gözlemlemek
 * zor: ordusu olan bir lordun önünde neredeyse her zaman daha acil bir
 * iş (saldır, ordunu kur, ordun dönüyor) çıkıyor. Tarayıcıda kovalamak
 * yerine burada doğrudan sınanıyor — sıranın kendisi de testin konusu,
 * çünkü asıl soru "adım var mı" değil "doğru yerde mi".
 */

/** Omurganın istediği en sade lord; testler yalnız ilgili alanı değiştiriyor. */
function lord(ek: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    name: 'Deneme',
    level: 20,
    resources: { altin: 50, demir: 50, erzak: 50 },
    storageCapacity: 1000,
    starving: false,
    woundedUntil: null,
    regionCount: 1,
    equippedItems: [{ slot: 'silah' }],
    dailyAttacks: 0,
    ...ek,
  } as never;
}

function girdi(ek: Record<string, unknown> = {}) {
  return {
    lord: lord(),
    depoDolu: false,
    oneriBekliyor: false,
    oneri: null,
    egitimde: [],
    uretimde: [],
    generalVar: true,
    yarali: false,
    yoldaki: [],
    onGit: () => {},
    onKapiAc: () => {},
    onHedefeGit: () => {},
    ...ek,
  } as never;
}

describe('omurga — depo adımı', () => {
  it('depo doluyken araştırmaya yolluyor', () => {
    const adim = siradakiAdim(girdi({ depoDolu: true }));
    expect(adim?.anahtar).toBe('depo');
    expect(adim?.hedefKapi).toBe('arastirma');
    expect(adim?.cumle).toContain('boşa gidiyor');
  });

  it('depo dolu değilken çıkmıyor', () => {
    expect(siradakiAdim(girdi({ depoDolu: false }))?.anahtar).not.toBe('depo');
  });

  it('generalden ÖNCE geliyor: israf beklemez, general bekler', () => {
    const adim = siradakiAdim(girdi({ depoDolu: true, generalVar: false }));
    expect(adim?.anahtar).toBe('depo');
  });

  it('aç orduya karışmıyor: asker eriyorsa depo ikinci plandadır', () => {
    const adim = siradakiAdim(girdi({ depoDolu: true, lord: lord({ starving: true }) }));
    expect(adim?.anahtar).toBe('aclik');
  });

  it('saldırılacak hedef varken karışmıyor: saldırmak zaten kaynak harcar', () => {
    const adim = siradakiAdim(
      girdi({
        depoDolu: true,
        // Saldırı adımı rozet çiziyor: eksik alan bırakırsak test
        // ürünün hatasını değil kendi kurgusunun eksiğini yakalar.
        oneri: {
          regionId: 1,
          name: 'Deneme',
          kazanir: true,
          eleGecirir: true,
          orduVar: true,
          saatlikGelir: { altin: 10, demir: 5, erzak: 5 },
          sohretFarki: 3,
          marchSec: 600,
        },
      }),
    );
    expect(adim?.anahtar).not.toBe('depo');
  });
});

/**
 * Zorunlu turun her aşaması omurgada GERÇEKTEN ulaşılabilir mi.
 *
 * Rehber omurganın üstüne biniyor: bir aşamayı kapatacak adıma omurga hiç
 * uğramıyorsa, oyuncu oraya hiç yönlendirilmez ve tur o satırda sonsuza
 * kadar açık kalır. Aşama ile adım arasındaki bağ `REHBER_ASAMALARI` içinde
 * yazılı (`adim` alanı); burada o bağın karşılığı olduğu sınanıyor.
 *
 * Her senaryo, o adımdan ÖNCEKİ bütün adımların koşullarını kapatıyor —
 * yani hem adımın varlığını hem de sırasını doğruluyor.
 */
describe('omurga — zorunlu turun her aşamasına uğruyor', () => {
  const alinabilirHedef = {
    regionId: 1,
    name: 'Demirkapı',
    kazanir: true,
    eleGecirir: true,
    orduVar: true,
    saatlikGelir: { altin: 10, demir: 5, erzak: 5 },
    sohretFarki: 3,
    marchSec: 600,
  };

  /** Aşama anahtarı → o adımı doğuran omurga girdisi. */
  const senaryolar: Record<string, Record<string, unknown>> = {
    // Ordu yetmiyor: kışlaya yolluyor.
    ordu: {
      lord: lord({ regionCount: 0, equippedItems: [] }),
      oneri: {
        ...alinabilirHedef,
        kazanir: false,
        eksik: {
          birim: 'okcu',
          adet: 12,
          maliyet: { altin: 600, demir: 200, erzak: 0 },
          karsilanabilir: true,
        },
      },
    },
    // Ordu yetiyor: saldırı adımı.
    bolge: { lord: lord({ regionCount: 0, equippedItems: [] }), oneri: alinabilirHedef },
    // Bölge var, hedef yok, ekipman yok.
    ekipman: { lord: lord({ equippedItems: [] }) },
    general: { generalVar: false },
    gelistir: { gelistirilebilirBolge: 7, gelismisBolgeVar: false, arastirmaBasladi: false },
    arastirma: { gelismisBolgeVar: true, arastirmaBasladi: false },
  };

  for (const asama of REHBER_ASAMALARI) {
    it(`${asama.key} aşaması "${asama.adim}" adımına ulaşıyor`, () => {
      const ek = senaryolar[asama.key];
      expect(ek, `${asama.key} için senaryo yazılmamış`).toBeDefined();
      expect(siradakiAdim(girdi(ek))?.anahtar).toBe(asama.adim);
    });
  }
});
