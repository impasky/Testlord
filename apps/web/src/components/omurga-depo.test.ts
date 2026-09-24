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
    // Varsayılan: akınını çoktan yapmış lord. Akın adımı ilk döngüye
    // ait; öteki senaryolar onun ötesindeki adımları ölçüyor ve her
    // birinde ayrıca yazmak gürültü olurdu.
    akinYapti: true,
    usedSlots: 20,
    // Varsayılan: zorunlu turu bitirmiş lord. Tur sürerken omurganın
    // sırası değişiyor (aşağıda "tur sürerken"); öteki senaryolar
    // yerleşmiş oyuncunun sırasını ölçüyor.
    rehberGorundu: true,
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
    /*
     * Ordu var ama akın yapılmamış: ilk savaş kampta öğreniliyor
     * (docs/12 §8). `usedSlots` sıfırdan büyük olmalı — omurga
     * "ordun ayakta mı" sorusunu oradan cevaplıyor.
     */
    akin: {
      lord: lord({ regionCount: 0, equippedItems: [], akinYapti: false, usedSlots: 20 }),
      oneri: alinabilirHedef,
    },
    // Bölge var, hedef yok, ekipman yok.
    ekipman: { lord: lord({ equippedItems: [] }) },
    general: { generalVar: false },
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

/*
 * Zorunlu tur sürerken sıra: oyuncunun bildirdiği "zorunlu eğitimde
 * takılıp kalıyoruz" hatasının üç kökü (tools/rehber-tur-testi.mjs ile
 * tarayıcıda da ölçülüyor).
 */
describe('omurga — tur sürerken', () => {
  const hedef = {
    regionId: 1,
    name: 'Demirkapı',
    kazanir: true,
    eleGecirir: true,
    orduVar: true,
    saatlikGelir: { altin: 10, demir: 5, erzak: 5 },
    sohretFarki: 3,
    marchSec: 600,
  };
  const yetmeyen = {
    ...hedef,
    kazanir: false,
    eksik: {
      birim: 'milis',
      adet: 4,
      maliyet: { altin: 100, demir: 0, erzak: 50 },
      karsilanabilir: true,
    },
  };
  const turda = (ek: Record<string, unknown> = {}) =>
    lord({ rehberGorundu: false, equippedItems: [], ...ek });

  it('ilk akından sonra tur sırası: ekipman → araştırma → general', () => {
    // Önce: hedef hep bir sonrakiydi, ekipman adımı hiç gelmiyordu.
    expect(siradakiAdim(girdi({ lord: turda(), oneri: hedef, generalVar: false }))?.anahtar).toBe(
      'ekipman',
    );
    const kusanmis = turda({ equippedItems: [{ slot: 'silah' }] });
    expect(
      siradakiAdim(girdi({ lord: kusanmis, oneri: yetmeyen, generalVar: false }))?.anahtar,
    ).toBe('arastirma');
    expect(
      siradakiAdim(
        girdi({
          lord: kusanmis,
          oneri: hedef,
          generalVar: false,
          arastirmaBasladi: true,
          generalEksikAltin: 0,
        }),
      )?.anahtar,
    ).toBe('general');
  });

  it('tur sürerken dünya haritasına GÖTÜRMÜYOR: bölge alınabilir olsa da', () => {
    // Oyuncunun kararı: zorunlu turda bölge alınmıyor, akın yapılıyor.
    const lordu = turda({ equippedItems: [{ slot: 'silah' }], regionCount: 0 });
    for (const oneri of [hedef, yetmeyen]) {
      const adim = siradakiAdim(
        girdi({
          lord: lordu,
          oneri,
          generalVar: false,
          arastirmaBasladi: true,
          generalEksikAltin: 2000,
        }),
      );
      expect(adim?.anahtar).toBe('akin-devam');
      expect(adim?.hedefSekme).toBe('akin');
    }
  });

  it('generale para yetmiyorsa ve ordu yoksa: önce asker, sonra akın', () => {
    const adim = siradakiAdim(
      girdi({
        lord: turda({ equippedItems: [{ slot: 'silah' }], usedSlots: 0 }),
        oneri: yetmeyen,
        generalVar: false,
        arastirmaBasladi: true,
        generalEksikAltin: 2000,
      }),
    );
    expect(adim?.anahtar).toBe('akin-devam');
    expect(adim?.hedefSekme).toBe('kisla');
  });

  it('tur bitince sıra eskisine dönüyor: hedef varken saldır', () => {
    expect(siradakiAdim(girdi({ lord: lord({ equippedItems: [] }), oneri: hedef }))?.anahtar).toBe(
      'saldir',
    );
  });

  it('ilk akından ÖNCE akına yolluyor, bölgeye değil', () => {
    expect(
      siradakiAdim(girdi({ lord: turda({ regionCount: 0, akinYapti: false }), oneri: hedef }))
        ?.anahtar,
    ).toBe('akin');
  });

  it('eğitim sürerken ordusu yetmeyen BEKLİYOR — "eğit"e ikinci kez bastırılmıyor', () => {
    const egitim = [
      { id: 'q', kind: 'train', finishAt: new Date(Date.now() + 60_000).toISOString() },
    ];
    expect(siradakiAdim(girdi({ lord: lord(), oneri: yetmeyen, egitimde: egitim }))?.anahtar).toBe(
      'egitim-bekle',
    );
  });

  it('geliştirme sürerken geliştirme adımı tekrar gelmiyor', () => {
    // Olağan sıra (tur bitmiş lord): bölge geliştirme turun aşaması değil.
    const ortak = {
      lord: lord(),
      gelistirilebilirBolge: 7,
      gelismisBolgeVar: false,
      arastirmaBasladi: false,
    };
    expect(siradakiAdim(girdi(ortak))?.anahtar).toBe('bolge-gelistir');
    expect(siradakiAdim(girdi({ ...ortak, gelistirmeSuruyor: true }))?.anahtar).toBe('arastirma');
  });
});
