import { beforeAll, describe, expect, it } from 'vitest';

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
