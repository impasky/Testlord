/**
 * Bina motoru: kademe tavanı, bedel, ve Y4'ün getirdiği ETKİLER.
 *
 * Buradaki asıl sözleşme tek cümle: **seviye 0 = Y4 öncesi davranış.**
 * Bina sistemi kimsenin elinden bir şey almıyor. Bir gün biri tabloyu
 * "denge" diye aşağı çekerse var olan lordların deposu, kuyruğu ve
 * general slotu bir gecede küçülür — testler o gün patlasın diye burada.
 */
import { describe, expect, it } from 'vitest';
import { B, BINALAR } from './balance.js';
import {
  KADEMELER,
  arastirmaKuyrugu,
  azamiTedaviSn,
  azamiTier,
  binaDurumlari,
  binaMaliyeti,
  binaSeviyesi,
  depoEki,
  egitimKuyrugu,
  esZamanliLimit,
  etkiBirimi,
  etkiDegeri,
  generalSlotuEki,
  gerekenDemirhaneSeviyesi,
  kademeTavani,
  sevkiyatTavaniEki,
  takasTavaniEki,
  takviyeSlotu,
  tahkimatEki,
  yerlesimKademesi,
} from './bina.js';
import { canCraftTier } from './equipment.js';
import { storageCapacity } from './economy.js';
import { generalSlots } from './progression.js';
import { pazarGunlukTavan } from './pazar.js';
import { gunlukTavan } from './ticaret.js';
import { tedaviSuresiSn } from './hastane.js';

const BOS: Record<string, number> = {};

describe('yerleşim kademesi', () => {
  it('başkentsiz lord kamptadır', () => {
    expect(yerlesimKademesi(null, 1)).toBe('kamp');
  });

  it('şehir seviyesi kademeyi yükseltiyor', () => {
    expect(yerlesimKademesi('sehir', 1)).toBe('kasaba');
    expect(yerlesimKademesi('sehir', 3)).toBe('sehir');
  });

  it('taht metropoldür', () => {
    expect(yerlesimKademesi('taht', 1)).toBe('metropol');
  });
});

describe('kademe tavanı', () => {
  it('kamptan metropole hep artıyor', () => {
    const tavanlar = KADEMELER.map((k) => kademeTavani(k));
    for (let i = 1; i < tavanlar.length; i++) {
      expect(tavanlar[i]!).toBeGreaterThanOrEqual(tavanlar[i - 1]!);
    }
  });

  it('kale-şehirde yalnız SURLAR bir fazlasına çıkıyor', () => {
    expect(kademeTavani('kale', 'surlar')).toBe(kademeTavani('kale') + 1);
    expect(kademeTavani('kale', 'malikane')).toBe(kademeTavani('kale'));
  });
});

describe('bina bedeli', () => {
  it('her seviye bir öncekinden pahalı', () => {
    let once = 0;
    for (let sv = 1; sv <= B.binalar.azami_seviye; sv++) {
      const m = binaMaliyeti('malikane', sv);
      expect(m.altin).toBeGreaterThan(once);
      once = m.altin;
    }
  });

  it('bina çarpanı bedeli ayırıyor', () => {
    // Kütüphane (1.25) demirhaneden (1.1) pahalı olmalı — tablodan geliyor.
    expect(binaMaliyeti('kutuphane', 1).altin).toBeGreaterThan(binaMaliyeti('demirhane', 1).altin);
  });
});

describe('bina seviyesi okuma', () => {
  it('bilinmeyen ve bozuk değer 0', () => {
    expect(binaSeviyesi({}, 'malikane')).toBe(0);
    expect(binaSeviyesi({ malikane: -3 }, 'malikane')).toBe(0);
    expect(binaSeviyesi({ malikane: 2 }, 'malikane')).toBe(2);
  });
});

describe('SEVİYE 0 = Y4 öncesi davranış', () => {
  it('malikânesiz lordun deposu eskisiyle aynı', () => {
    expect(depoEki(BOS)).toBe(0);
    expect(storageCapacity(10, undefined, BOS)).toBe(
      B.kaynaklar.depo_kapasitesi.taban + B.kaynaklar.depo_kapasitesi.lord_seviye_basina * 10,
    );
  });

  it('kışlasız lordun eğitim kuyruğu eskisiyle aynı', () => {
    expect(egitimKuyrugu(BOS)).toBe(B.kuyruklar.es_zamanli.train);
  });

  it('kütüphanesiz lordun araştırma kuyruğu eskisiyle aynı', () => {
    expect(arastirmaKuyrugu(BOS)).toBe(B.kuyruklar.es_zamanli.research);
  });

  it('karargâhsız lordun general slotu eskisiyle aynı', () => {
    expect(generalSlotuEki(BOS)).toBe(0);
    expect(generalSlots(90, BOS)).toBe(generalSlots(90));
  });

  it('pazarsız ve limansız lordun tavanları eskisiyle aynı', () => {
    expect(takasTavaniEki(BOS)).toBe(0);
    expect(sevkiyatTavaniEki(BOS)).toBe(0);
    expect(pazarGunlukTavan(20, BOS)).toBe(pazarGunlukTavan(20));
    expect(gunlukTavan(undefined, BOS)).toBe(B.ticaret.gunluk_gonderim_tavani);
  });

  it('hastanesiz lordun tedavi tavanı eskisiyle aynı', () => {
    expect(azamiTedaviSn(BOS)).toBe(B.hastane.azami_saniye);
  });

  it('sursuz lordun tahkimatı değişmiyor', () => {
    expect(tahkimatEki(BOS)).toBe(0);
  });
});

describe('her seviye bir KAZANÇ', () => {
  const artan: [string, (b: Record<string, number>) => number][] = [
    ['malikane', depoEki],
    ['kisla', egitimKuyrugu],
    ['demirhane', azamiTier],
    ['karargah', generalSlotuEki],
    ['kutuphane', arastirmaKuyrugu],
    ['pazar', takasTavaniEki],
    ['liman', sevkiyatTavaniEki],
    ['elcilik', takviyeSlotu],
    ['surlar', tahkimatEki],
  ];

  it.each(artan)('%s seviyesi hiçbir zaman değeri DÜŞÜRMÜYOR', (key, oku) => {
    for (let sv = 1; sv <= B.binalar.azami_seviye; sv++) {
      expect(oku({ [key]: sv })).toBeGreaterThanOrEqual(oku({ [key]: sv - 1 }));
    }
    // Ve en az bir yerde gerçekten artıyor: tablo düz olsaydı bina
    // hiçbir şey yapmıyor demekti.
    expect(oku({ [key]: B.binalar.azami_seviye })).toBeGreaterThan(oku({ [key]: 0 }));
  });

  it('hastane tavanı ters yönde: yükseldikçe KISALIYOR', () => {
    for (let sv = 1; sv <= B.binalar.azami_seviye; sv++) {
      expect(azamiTedaviSn({ hastane: sv })).toBeLessThanOrEqual(
        azamiTedaviSn({ hastane: sv - 1 }),
      );
    }
    expect(azamiTedaviSn({ hastane: 5 })).toBeLessThan(azamiTedaviSn({}));
  });
});

describe('demirhane ekipman kapısı', () => {
  it('demirhanesiz lord T1 dövebiliyor — öğretici kampta çıkmaza girmesin', () => {
    expect(canCraftTier(1, 1, BOS)).toBe(true);
  });

  it('seviyesi yeten ama demirhanesi küçük lord dövemiyor', () => {
    // T5 için lord seviyesi yetiyor; demirhane 1 yetmiyor.
    expect(canCraftTier(99, 5, { demirhane: 1 })).toBe(false);
    expect(canCraftTier(99, 5, { demirhane: 4 })).toBe(true);
  });

  it('demirhanesi yeten ama seviyesi düşük lord da dövemiyor — iki kapı', () => {
    expect(canCraftTier(1, 5, { demirhane: 5 })).toBe(false);
  });

  it('T5 için GERÇEK BİR ŞEHİR gerekiyor', () => {
    const gereken = gerekenDemirhaneSeviyesi(5);
    expect(kademeTavani('koy')).toBeLessThan(gereken);
    expect(kademeTavani('kasaba')).toBeLessThan(gereken);
    expect(kademeTavani('sehir')).toBeGreaterThanOrEqual(gereken);
  });

  it('gerekenDemirhaneSeviyesi tabloyla tutarlı', () => {
    for (let tier = 1; tier <= 5; tier++) {
      const sv = gerekenDemirhaneSeviyesi(tier);
      expect(azamiTier({ demirhane: sv })).toBeGreaterThanOrEqual(tier);
      if (sv > 0) expect(azamiTier({ demirhane: sv - 1 })).toBeLessThan(tier);
    }
  });
});

describe('eş zamanlı kuyruk sınırı', () => {
  it('kışla ve kütüphane kendi kuyruklarını büyütüyor', () => {
    expect(esZamanliLimit('train', { kisla: 5 })).toBeGreaterThan(esZamanliLimit('train', BOS));
    expect(esZamanliLimit('research', { kutuphane: 5 })).toBeGreaterThan(
      esZamanliLimit('research', BOS),
    );
  });

  it('binası olmayan kuyruk türü balance sabitinde kalıyor', () => {
    expect(esZamanliLimit('craft', { kisla: 5 })).toBe(B.kuyruklar.es_zamanli.craft);
    expect(esZamanliLimit('bina', BOS)).toBe(B.kuyruklar.es_zamanli.bina);
  });
});

describe('hastane tedavi tavanı', () => {
  it('büyük kafilede süre hastaneyle kısalıyor', () => {
    // Tavana çarpacak kadar büyük bir yığın.
    const buyuk = 5000;
    const hastanesiz = tedaviSuresiSn('kusatma', buyuk, BOS);
    const hastaneli = tedaviSuresiSn('kusatma', buyuk, { hastane: 5 });
    expect(hastaneli).toBeLessThan(hastanesiz);
  });

  it('küçük kafile tavana çarpmadığı için değişmiyor', () => {
    expect(tedaviSuresiSn('milis', 3, { hastane: 5 })).toBe(tedaviSuresiSn('milis', 3, BOS));
  });
});

describe('bina durumları', () => {
  it('seviyesiz yapılar hep dikili ve yükseltilemez', () => {
    const durum = binaDurumlari({}, 'metropol', { altin: 1e9, demir: 1e9, erzak: 1e9 });
    for (const b of durum.filter((x) => !x.seviyeli)) {
      expect(b.seviye).toBe(1);
      expect(b.yukseltilebilir).toBe(false);
      expect(b.maliyet).toBeNull();
    }
  });

  it('kampta yalnız kamp kademesindekiler görünüyor', () => {
    const kampta = binaDurumlari({}, 'kamp', { altin: 0, demir: 0, erzak: 0 });
    const beklenen = BINALAR.filter((b) => b.acilis_kademesi === 'kamp');
    expect(kampta).toHaveLength(beklenen.length);
  });

  it('kademe tavanına dayanan bina SEBEBİNİ söylüyor', () => {
    const bol = { altin: 1e9, demir: 1e9, erzak: 1e9 };
    const koyde = binaDurumlari({ demirhane: 2 }, 'koy', bol);
    const demirhane = koyde.find((b) => b.key === 'demirhane');
    expect(demirhane?.yukseltilebilir).toBe(false);
    expect(demirhane?.engel).toMatch(/yerleşim/i);
  });

  it('kart ETKİYİ gösteriyor, seviyeyi değil', () => {
    const bol = { altin: 1e9, demir: 1e9, erzak: 1e9 };
    const durum = binaDurumlari({ malikane: 1 }, 'sehir', bol);
    const malikane = durum.find((b) => b.key === 'malikane');
    expect(malikane?.etkiSimdi).toBe(etkiDegeri('malikane', 1));
    expect(malikane?.etkiSonra).toBe(etkiDegeri('malikane', 2));
    // Etki değeri seviyeden BÜYÜK: eskiden burada 1 → 2 yazıyordu.
    expect(malikane?.etkiSimdi ?? 0).toBeGreaterThan(malikane?.seviye ?? 0);
  });

  it('tavandaki binanın "sonra"sı yok', () => {
    const bol = { altin: 1e9, demir: 1e9, erzak: 1e9 };
    const durum = binaDurumlari({ malikane: 1 }, 'kamp', bol);
    expect(durum.find((b) => b.key === 'malikane')?.etkiSonra).toBeNull();
  });

  it('etki birimi doğru sınıflanıyor', () => {
    expect(etkiBirimi('hastane')).toBe('saniye');
    expect(etkiBirimi('surlar')).toBe('oran');
    expect(etkiBirimi('kisla')).toBe('sayi');
    expect(etkiBirimi('gorev_panosu')).toBeNull();
  });
});

describe('etki tabloları eksiksiz', () => {
  it('etkisi olan her bina için tablo var', () => {
    for (const b of BINALAR) {
      if (!b.seviyeli || !b.etki) continue;
      expect(etkiDegeri(b.key, 1), `${b.key} için etki tablosu yok`).not.toBeNull();
    }
  });

  it('her tablo azami_seviye + 1 uzunluğunda', () => {
    const tablolar = B.binalar.etkiler as unknown as Record<string, unknown>;
    for (const [ad, tablo] of Object.entries(tablolar)) {
      if (ad.startsWith('_')) continue;
      expect(Array.isArray(tablo), `${ad} dizi değil`).toBe(true);
      expect((tablo as number[]).length, `${ad} uzunluğu`).toBe(B.binalar.azami_seviye + 1);
    }
  });
});
