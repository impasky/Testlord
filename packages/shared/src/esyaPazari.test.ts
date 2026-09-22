import { describe, expect, it } from 'vitest';
import { B } from './balance.js';
import { sellValue } from './equipment.js';
import {
  bantHesapla,
  bantta,
  basamakAltta,
  basamakFiyati,
  basamakUstte,
  baskiAdimi,
  capaAdimi,
  defterSatirlari,
  fiyatSinirlari,
  formulDegeri,
  ilanEngeli,
  ilanaSiparisSec,
  kayitKuyruguGerekir,
  kenarAdimi,
  kuyrukKurasi,
  odemeEngeli,
  sipariseIlanSec,
  siparisEngeli,
  tabanUygula,
  urunAdi,
  urunGecerli,
  vergiHesapla,
  type Bant,
  type DefterEmri,
} from './esyaPazari.js';
import { RARITIES } from './types.js';

const P = B.esya_pazari;
const SAAT = 3_600_000;

/** Ortada durulan, sert sınıra değmeyen bir bant. */
const bant: Bant = { taban: 700, alt: 693, ust: 707 };

function emir(id: string, basamak: number, sira: number, lordId = `L-${id}`): DefterEmri {
  return { id, lordId, basamak, sira };
}

describe('basamaklar', () => {
  it('basamak altın fiyatına ve geri doğru çevriliyor', () => {
    for (let k = 460; k <= 1600; k += 7) {
      const f = basamakFiyati(k);
      expect(Math.pow(1.01, basamakAltta(f))).toBeLessThanOrEqual(f + 1e-6);
      expect(Math.pow(1.01, basamakUstte(f))).toBeGreaterThanOrEqual(f - 1e-6);
    }
  });

  it('100 altından yukarıda komşu iki basamak hiçbir zaman aynı fiyat değil', () => {
    for (let k = basamakUstte(100); k < basamakUstte(100) + 400; k++) {
      expect(basamakFiyati(k + 1)).toBeGreaterThan(basamakFiyati(k));
    }
  });
});

describe('formül değeri ve sert sınırlar', () => {
  it('T1 sıradan +0: üretim bedeli kademenin ortalama gücüne göre dağıtılıyor', () => {
    // 400 altın + 200 demir × 2 = 800; ortalama çarpan 1,14 → 702.
    expect(formulDegeri({ tier: 1, rarity: 'siradan', upgradeLevel: 0 })).toBe(702);
  });

  it('nadirlik, kademe ve yükseltme değeri hep büyütüyor', () => {
    for (let t = 1; t <= 5; t++) {
      for (let i = 1; i < RARITIES.length; i++) {
        const once = formulDegeri({ tier: t, rarity: RARITIES[i - 1]!, upgradeLevel: 0 });
        expect(formulDegeri({ tier: t, rarity: RARITIES[i]!, upgradeLevel: 0 })).toBeGreaterThan(
          once,
        );
      }
      for (let n = 1; n <= B.ekipman.max_yukseltme; n++) {
        const once = formulDegeri({ tier: t, rarity: 'nadir', upgradeLevel: n - 1 });
        expect(formulDegeri({ tier: t, rarity: 'nadir', upgradeLevel: n })).toBeGreaterThan(once);
      }
    }
    for (let t = 2; t <= 5; t++) {
      const once = formulDegeri({ tier: t - 1, rarity: 'siradan', upgradeLevel: 0 });
      expect(formulDegeri({ tier: t, rarity: 'siradan', upgradeLevel: 0 })).toBeGreaterThan(once);
    }
  });

  it('değer güce bağlı, kıtlığa değil: T1 efsanevi T3 sıradandan ucuz', () => {
    expect(formulDegeri({ tier: 1, rarity: 'efsanevi', upgradeLevel: 0 })).toBeLessThan(
      formulDegeri({ tier: 3, rarity: 'siradan', upgradeLevel: 0 }),
    );
  });

  it('alt sınır NPC değerinin ve 100 altının altında değil; formül sınırların içinde', () => {
    for (let t = 1; t <= 5; t++) {
      for (const r of RARITIES) {
        for (const n of [0, 5, 10]) {
          const g = { tier: t, rarity: r, upgradeLevel: n };
          const s = fiyatSinirlari(g);
          const npc = sellValue({ slot: 'silah', ...g });
          expect(basamakFiyati(s.altBasamak)).toBeGreaterThanOrEqual(Math.max(npc, 100));
          expect(basamakFiyati(s.ustBasamak)).toBeLessThanOrEqual(
            Math.ceil(s.formul * P.ust_sinir_carpani),
          );
          expect(s.formulBasamak).toBeGreaterThanOrEqual(s.altBasamak);
          expect(s.formulBasamak).toBeLessThanOrEqual(s.ustBasamak);
        }
      }
    }
  });

  it('bant sert sınırda kırpılıyor, taban sınırı aşamıyor', () => {
    const s = fiyatSinirlari({ tier: 2, rarity: 'nadir', upgradeLevel: 0 });
    const tavanda = bantHesapla(s.ustBasamak, s);
    expect(tavanda.ust).toBe(s.ustBasamak);
    expect(tavanda.alt).toBe(s.ustBasamak - P.bant_adimi);
    expect(tabanUygula(s.ustBasamak, 1, s)).toBe(s.ustBasamak);
    expect(tabanUygula(s.altBasamak, -1, s)).toBe(s.altBasamak);
    const ortada = bantHesapla(s.formulBasamak, s);
    expect(ortada.ust - ortada.alt).toBe(2 * P.bant_adimi);
  });
});

describe('eşleşme', () => {
  it('ilan en yüksek siparişe gidiyor ve işlem siparişin fiyatından', () => {
    const s = [emir('a', 701, 1), emir('b', 704, 5), emir('c', 702, 0)];
    expect(ilanaSiparisSec(s, 700, bant, () => 0, 'satici')?.id).toBe('b');
  });

  it('eşit fiyatta ilk gelen kazanıyor', () => {
    const s = [emir('gec', 703, 20), emir('erken', 703, 10)];
    expect(ilanaSiparisSec(s, 700, bant, () => 0.99, 'satici')?.id).toBe('erken');
  });

  it('bandın tavanında sıra değil kura', () => {
    const s = [emir('erken', 707, 1), emir('gec', 707, 99)];
    expect(ilanaSiparisSec(s, 700, bant, () => 0.99, 'satici')?.id).toBe('gec');
    expect(ilanaSiparisSec(s, 700, bant, () => 0, 'satici')?.id).toBe('erken');
  });

  it('ilandan ucuz sipariş, bant dışı sipariş ve kendi siparişi eşleşmiyor', () => {
    const s = [emir('ucuz', 699, 1), emir('disarida', 710, 1), emir('kendi', 705, 1, 'satici')];
    expect(ilanaSiparisSec(s, 700, bant, () => 0, 'satici')).toBeNull();
  });

  it('sipariş en ucuz ilana gidiyor, eşitse ilk gelen; bant dışı ilan yok sayılıyor', () => {
    const i = [emir('pahali', 705, 0), emir('ucuz-gec', 698, 9), emir('ucuz-erken', 698, 3)];
    expect(sipariseIlanSec(i, 706, bant, 'alici')?.id).toBe('ucuz-erken');
    expect(sipariseIlanSec([emir('disarida', 690, 0)], 706, bant, 'alici')).toBeNull();
    expect(sipariseIlanSec(i, 697, bant, 'alici')).toBeNull();
  });

  it('kuyruk kurası en yüksek fiyatlılar arasından seçiyor, sırayı saymıyor', () => {
    const s = [emir('a', 703, 1), emir('b', 703, 2), emir('c', 701, 0)];
    expect(kuyrukKurasi(s, 700, bant, () => 0.99, 'satici')?.id).toBe('b');
    expect(kuyrukKurasi(s, 700, bant, () => 0, 'satici')?.id).toBe('a');
    expect(kuyrukKurasi(s, 704, bant, () => 0, 'satici')).toBeNull();
  });

  it('efsanevi ve kadim her kademede, pahalı eşya eşikten sonra kuyruğa giriyor', () => {
    expect(kayitKuyruguGerekir({ tier: 1, rarity: 'efsanevi', upgradeLevel: 0 })).toBe(true);
    expect(kayitKuyruguGerekir({ tier: 1, rarity: 'kadim', upgradeLevel: 0 })).toBe(true);
    expect(kayitKuyruguGerekir({ tier: 1, rarity: 'siradan', upgradeLevel: 0 })).toBe(false);
    expect(kayitKuyruguGerekir({ tier: 5, rarity: 'siradan', upgradeLevel: 10 })).toBe(true);
  });
});

describe('tabanın hareketi', () => {
  it('kenarda gerçekleşen işlem bir basamak itiyor, ortadaki itmiyor', () => {
    expect(kenarAdimi(707, bant)).toBe(1);
    expect(kenarAdimi(693, bant)).toBe(-1);
    expect(kenarAdimi(700, bant)).toBe(0);
    expect(kenarAdimi(706, bant)).toBe(0);
  });

  it('ilan yokken tabanın üstünde bir saattir bekleyen sipariş tabanı yükseltiyor', () => {
    const simdi = 10 * SAAT;
    const siparis = [{ basamak: 702, sira: simdi - SAAT }];
    expect(baskiAdimi({ ilanlar: [], siparisler: siparis, bant, simdi })).toBe(1);
  });

  it('bir saati doldurmamış ya da tabanın altındaki sipariş baskı yapmıyor', () => {
    const simdi = 10 * SAAT;
    expect(
      baskiAdimi({ ilanlar: [], siparisler: [{ basamak: 702, sira: simdi - 1000 }], bant, simdi }),
    ).toBe(0);
    expect(baskiAdimi({ ilanlar: [], siparisler: [{ basamak: 698, sira: 0 }], bant, simdi })).toBe(
      0,
    );
  });

  it('sipariş yokken tabanın altında bekleyen ilan tabanı düşürüyor', () => {
    const simdi = 10 * SAAT;
    expect(baskiAdimi({ ilanlar: [{ basamak: 695, sira: 0 }], siparisler: [], bant, simdi })).toBe(
      -1,
    );
  });

  it('iki taraf da doluysa (makas) baskı yok; bant dışı emir sayılmıyor', () => {
    const simdi = 10 * SAAT;
    expect(
      baskiAdimi({
        ilanlar: [{ basamak: 705, sira: 0 }],
        siparisler: [{ basamak: 702, sira: 0 }],
        bant,
        simdi,
      }),
    ).toBe(0);
    // Bant dışındaki ilan "ilan var" sayılmıyor: sipariş yine iter.
    expect(
      baskiAdimi({
        ilanlar: [{ basamak: 720, sira: 0 }],
        siparisler: [{ basamak: 702, sira: 0 }],
        bant,
        simdi,
      }),
    ).toBe(1);
  });

  it('çapa: üç gün işlemsiz kalan ürün günde bir basamak formüle dönüyor', () => {
    const gun = 86_400_000;
    const simdi = 100 * gun;
    const temel = { taban: 710, formulBasamak: 700, sonCapa: null, simdi };
    expect(capaAdimi({ ...temel, sonIslem: simdi - 2 * gun })).toBe(0);
    expect(capaAdimi({ ...temel, sonIslem: simdi - 3 * gun })).toBe(-1);
    expect(capaAdimi({ ...temel, taban: 690, sonIslem: 0 })).toBe(1);
    expect(capaAdimi({ ...temel, taban: 700, sonIslem: 0 })).toBe(0);
    expect(capaAdimi({ ...temel, sonIslem: 0, sonCapa: simdi - 23 * SAAT })).toBe(0);
    expect(capaAdimi({ ...temel, sonIslem: 0, sonCapa: simdi - 24 * SAAT })).toBe(-1);
  });
});

describe('vergi', () => {
  it('satıcıdan kesiliyor, net aşağı yuvarlanıyor, toplam fiyatı veriyor', () => {
    for (const f of [100, 101, 999, 1234, 987654]) {
      const { vergi, net } = vergiHesapla(f);
      expect(vergi + net).toBe(f);
      expect(net).toBe(Math.floor(f * (1 - P.vergi) + 1e-9));
      expect(vergi).toBeGreaterThan(0);
    }
  });
});

describe('engeller', () => {
  const esya = { equipped: false, pazarda: false, yukseltiliyor: false };
  const ilan = (ek: Partial<Parameters<typeof ilanEngeli>[0]> = {}) =>
    ilanEngeli({
      esya,
      basamak: 700,
      bant,
      acikIlan: 0,
      bugunYeniEmir: 0,
      ayniUrundeIlan: false,
      ayniUrundeSiparis: false,
      ...ek,
    });

  it('temiz ilan geçiyor', () => {
    expect(ilan()).toBeNull();
  });

  it('kuşanık, yükseltilen ve zaten pazarda olan eşya satılamıyor', () => {
    expect(ilan({ esya: { ...esya, equipped: true } })?.kod).toBe('KUSANIK');
    expect(ilan({ esya: { ...esya, yukseltiliyor: true } })?.kod).toBe('YUKSELTILIYOR');
    expect(ilan({ esya: { ...esya, pazarda: true } })?.kod).toBe('ZATEN_PAZARDA');
  });

  it('bant dışı fiyat, ondalık basamak ve tavanlar reddediliyor', () => {
    expect(ilan({ basamak: 708 })?.kod).toBe('BANT_DISI');
    expect(ilan({ basamak: 700.5 })?.kod).toBe('BANT_DISI');
    expect(ilan({ basamak: 708 })?.mesaj).toContain('altın arasında olmalı');
    expect(ilan({ acikIlan: P.azami_ilan })?.kod).toBe('ILAN_TAVANI');
    expect(ilan({ bugunYeniEmir: P.gunluk_yeni_emir })?.kod).toBe('GUNLUK_EMIR');
    expect(ilan({ ayniUrundeIlan: true })?.kod).toBe('AYNI_URUN');
    expect(ilan({ ayniUrundeSiparis: true })?.kod).toBe('IKI_YON');
  });

  const siparis = (ek: Partial<Parameters<typeof siparisEngeli>[0]> = {}) =>
    siparisEngeli({
      urun: { slot: 'kalkan', tier: 1, rarity: 'nadir', upgradeLevel: 0 },
      lordSeviyesi: 5,
      basamak: 700,
      bant,
      acikSiparis: 0,
      bugunYeniEmir: 0,
      ayniUrundeIlan: false,
      ayniUrundeSiparis: false,
      odenecek: 1000,
      bekleyecek: true,
      eldeki: 5000,
      emanette: 0,
      depoTavani: 20000,
      ...ek,
    });

  it('temiz sipariş geçiyor', () => {
    expect(siparis()).toBeNull();
  });

  it('seviyenin açmadığı kademe alınamıyor', () => {
    const e = siparis({
      urun: { slot: 'kalkan', tier: 4, rarity: 'nadir', upgradeLevel: 0 },
      lordSeviyesi: 35,
    });
    expect(e?.kod).toBe('KADEME_KILITLI');
    expect(e?.mesaj).toBe('T4 eşya almak için 36. seviye gerekiyor.');
  });

  it('altın yetmiyorsa ve emanet depo tavanını aşıyorsa reddediliyor', () => {
    expect(siparis({ eldeki: 999 })?.kod).toBe('ALTIN_YETERSIZ');
    expect(siparis({ emanette: 19500 })?.kod).toBe('EMANET_TAVANI');
    // Hemen eşleşen alım deftere girmiyor: emanet tavanına sayılmaz.
    expect(siparis({ emanette: 19500, bekleyecek: false })).toBeNull();
  });

  it('ödeme engeli kalan emanet payını söylüyor', () => {
    const e = odemeEngeli({
      odenecek: 1000,
      bekleyecek: true,
      eldeki: 5000,
      emanette: 19500,
      depoTavani: 20000,
    });
    expect(e?.mesaj).toContain('En fazla 500 altın');
  });

  it('aynı ürüne ikinci sipariş ve iki yönlü emir yok', () => {
    expect(siparis({ ayniUrundeSiparis: true })?.kod).toBe('AYNI_URUN');
    expect(siparis({ ayniUrundeIlan: true })?.kod).toBe('IKI_YON');
    expect(siparis({ acikSiparis: P.azami_siparis })?.kod).toBe('SIPARIS_TAVANI');
  });
});

describe('ürün ve defter', () => {
  it('ürün adı ekrandaki gibi', () => {
    expect(urunAdi({ slot: 'kalkan', tier: 3, rarity: 'nadir', upgradeLevel: 2 })).toBe(
      'T3 Nadir Kalkan +2',
    );
    expect(urunAdi({ slot: 'at', tier: 1, rarity: 'usta', upgradeLevel: 0 })).toBe(
      'T1 Usta işi At',
    );
  });

  it('geçersiz ürün tanınıyor', () => {
    expect(urunGecerli({ slot: 'silah', tier: 3, rarity: 'nadir', upgradeLevel: 0 })).toBe(true);
    expect(urunGecerli({ slot: 'balta', tier: 3, rarity: 'nadir', upgradeLevel: 0 })).toBe(false);
    expect(urunGecerli({ slot: 'silah', tier: 6, rarity: 'nadir', upgradeLevel: 0 })).toBe(false);
    expect(urunGecerli({ slot: 'silah', tier: 3, rarity: 'nadir', upgradeLevel: 11 })).toBe(false);
    expect(urunGecerli({ slot: 'silah', tier: 2.5, rarity: 'nadir', upgradeLevel: 0 })).toBe(false);
  });

  it('defter bantın her basamağını pahalıdan ucuza sayıyor', () => {
    const satirlar = defterSatirlari(
      bant,
      [{ basamak: 705 }, { basamak: 705 }, { basamak: 720 }],
      [{ basamak: 701 }],
    );
    expect(satirlar).toHaveLength(15);
    expect(satirlar[0]!.basamak).toBe(707);
    expect(satirlar.find((s) => s.basamak === 705)!.satici).toBe(2);
    expect(satirlar.find((s) => s.basamak === 701)!.alici).toBe(1);
    expect(satirlar.filter((s) => s.taban)).toHaveLength(1);
    expect(satirlar.every((s) => bantta(s.basamak, bant))).toBe(true);
  });
});
