/**
 * Medeniyet katmanının SAYILARI — kod yazılmadan önce burada doğrulanır.
 *
 * `docs/16` §12'nin ilk adımı bilerek bu: şema ve uçlar yazılmadan önce
 * bölüşüm ve maliyet eğrisi sınanabilir olmalı. Bir fraksiyon sisteminin
 * yanlış kalibre edilmiş olduğu, ancak yüzlerce oyuncu oynadıktan sonra
 * anlaşılır — o yüzden buradaki her sınama bir tasarım iddiasını
 * ölçüyor, yalnız "fonksiyon çalışıyor mu"yu değil.
 */
import { describe, expect, it } from 'vitest';
import { WORLD_MAP } from './balance.js';
import {
  CEKIRDEK_AZAMI_SEVIYE,
  KARTOPU_FRENI,
  kartopuLideri,
  kartopuPayi,
  kartopuYagmaBonusu,
  acikMedeniyetler,
  atanacakMedeniyet,
  baskentCekirdegi,
  cekirdekBonusu,
  MEDENIYETLER,
  baslangicSahibi,
  cekirdekMaliyeti,
  cekirdekMi,
  cekirdekSahibi,
  medeniyetBonusu,
  BOS_MEDENIYET_BONUSU,
  cekismeliMi,
  garnizonPaylari,
  medeniyet,
  orduYeri,
  payMiktari,
  tahtMi,
  yurtBolgeleri,
} from './medeniyet.js';

describe('medeniyetler', () => {
  it('dört medeniyet var ve hepsinin yurdu haritada gerçekten duruyor', () => {
    expect(MEDENIYETLER).toHaveLength(4);
    const vilayetler = new Set(WORLD_MAP.regions.map((r) => r.province));
    for (const m of MEDENIYETLER) expect(vilayetler.has(m.yurt), m.yurt).toBe(true);
  });

  it('kimlikler benzersiz', () => {
    expect(new Set(MEDENIYETLER.map((m) => m.id)).size).toBe(4);
    expect(new Set(MEDENIYETLER.map((m) => m.yurt)).size).toBe(4);
    expect(new Set(MEDENIYETLER.map((m) => m.renk)).size).toBe(4);
  });

  it('her çekirdek bölgesi GERÇEKTEN kendi yurdunda', () => {
    // Elle yazılmış bir liste, harita değiştiğinde sessizce başka bir
    // vilayete kayabilir — çekirdek o zaman düşman toprağında olurdu.
    for (const m of MEDENIYETLER) {
      expect(m.cekirdekBolgeler).toHaveLength(5);
      for (const id of m.cekirdekBolgeler) {
        const b = WORLD_MAP.regions.find((r) => r.id === id);
        expect(b, `${m.id} çekirdek ${id}`).toBeDefined();
        expect(b!.province, `${m.ad} → ${b!.name}`).toBe(m.yurt);
      }
    }
  });

  it('hiçbir bölge iki medeniyetin çekirdeği değil', () => {
    const hepsi = MEDENIYETLER.flatMap((m) => m.cekirdekBolgeler);
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });
});

describe('çekirdek / çekişmeli ayrımı', () => {
  it('20 çekirdek, 1 taht, kalanı çekişmeli', () => {
    const t = WORLD_MAP.regions.length;
    const cekirdek = WORLD_MAP.regions.filter((r) => cekirdekMi(r.id)).length;
    const taht = WORLD_MAP.regions.filter((r) => tahtMi(r.id)).length;
    const cekismeli = WORLD_MAP.regions.filter((r) => cekismeliMi(r.id)).length;
    expect(cekirdek).toBe(20);
    expect(taht).toBe(1);
    expect(cekirdek + taht + cekismeli).toBe(t);
    // Çekirdek BİLEREK küçük: harita doğduğu gün karara bağlanmasın.
    expect(cekirdek / t).toBeLessThan(0.2);
  });

  it('taht kimsenin çekirdeği değil', () => {
    const taht = WORLD_MAP.regions.find((r) => tahtMi(r.id))!;
    expect(cekirdekSahibi(taht.id)).toBeNull();
  });

  it('çekirdek her zaman kendi sahibini söylüyor', () => {
    for (const m of MEDENIYETLER) {
      for (const id of m.cekirdekBolgeler) expect(cekirdekSahibi(id)).toBe(m.id);
    }
  });
});

describe('açılış sahipliği', () => {
  it('yurt bölgeleri sahibiyle, çekişmeli vilayetler sahipsiz doğuyor', () => {
    for (const m of MEDENIYETLER) {
      const yurtBolgeleri = WORLD_MAP.regions.filter((r) => r.province === m.yurt);
      expect(yurtBolgeleri.length).toBeGreaterThan(0);
      for (const b of yurtBolgeleri) expect(baslangicSahibi(b.id)).toBe(m.id);
    }
    // Kavga ORTADA başlıyor: gunbati ve aksu ilk gün sahipsiz.
    const ortadakiler = WORLD_MAP.regions.filter(
      (r) => !MEDENIYETLER.some((m) => m.yurt === r.province),
    );
    expect(ortadakiler.length).toBeGreaterThan(0);
    for (const b of ortadakiler) expect(baslangicSahibi(b.id)).toBeNull();
  });

  it('dört yurt haritanın yarısından azını tutuyor', () => {
    // Yoksa ilk gün harita paylaşılmış olurdu ve fethedilecek yer kalmazdı.
    const yurtta = WORLD_MAP.regions.filter((r) => baslangicSahibi(r.id) !== null).length;
    expect(yurtta / WORLD_MAP.regions.length).toBeLessThan(0.7);
  });
});

describe('garnizon payı', () => {
  const mizrakci = (n: number) => ({ mizrakci: n });

  it('tek garnizon gelirin tamamını alıyor', () => {
    const p = garnizonPaylari([{ lordId: 'a', ordu: mizrakci(20) }]);
    expect(p).toHaveLength(1);
    expect(p[0]!.oran).toBeCloseTo(1);
    expect(payMiktari(200, p[0]!.oran)).toBe(200);
  });

  it('eşit garnizonlar eşit bölüşüyor — docs/16 §6 örneği', () => {
    const p = garnizonPaylari(
      Array.from({ length: 10 }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(20) })),
    );
    expect(p).toHaveLength(10);
    for (const x of p) expect(payMiktari(200, x.oran)).toBe(20);
  });

  it('BALİNA tek bölgede baskın olamıyor — yer başına verimi düşüyor', () => {
    // docs/16 §6: 1 lord 100 yer + 9 lord × 20 yer -> balina 71, diğerleri 14
    const p = garnizonPaylari([
      { lordId: 'balina', ordu: mizrakci(100) },
      ...Array.from({ length: 9 }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(20) })),
    ]);
    const balina = p.find((x) => x.lordId === 'balina')!;
    const kucuk = p.find((x) => x.lordId === 'l0')!;
    expect(payMiktari(200, balina.oran)).toBe(71);
    expect(payMiktari(200, kucuk.oran)).toBe(14);
    // Asıl iddia: balina 5 kat asker koydu ama 5 kat gelir ALMIYOR.
    const balinaVerim = (200 * balina.oran) / balina.yer;
    const kucukVerim = (200 * kucuk.oran) / kucuk.yer;
    expect(balinaVerim).toBeCloseTo(kucukVerim, 5);
  });

  it('paylar toplamı bölgenin ürettiğini AŞMIYOR', () => {
    // Yukarı yuvarlansaydı on kişilik bir bölge her saat yoktan altın üretirdi.
    for (const n of [3, 7, 10, 23]) {
      const p = garnizonPaylari(
        Array.from({ length: n }, (_, i) => ({ lordId: `l${i}`, ordu: mizrakci(7) })),
      );
      const dagitilan = p.reduce((s, x) => s + payMiktari(199, x.oran), 0);
      expect(dagitilan, `${n} garnizon`).toBeLessThanOrEqual(199);
    }
  });

  it('boş garnizon pay almıyor', () => {
    expect(garnizonPaylari([{ lordId: 'a', ordu: {} }])).toHaveLength(0);
    const p = garnizonPaylari([
      { lordId: 'dolu', ordu: mizrakci(5) },
      { lordId: 'bos', ordu: {} },
    ]);
    expect(p.map((x) => x.lordId)).toEqual(['dolu']);
  });

  it('yer birim TÜRÜNE göre sayılıyor, adede göre değil', () => {
    // Süvari mızrakçıdan çok yer kaplıyor; pay da ona göre olmalı.
    expect(orduYeri({ mizrakci: 10 })).toBeLessThan(orduYeri({ suvari: 10 }));
  });
});

describe('çekirdek yatırım maliyeti', () => {
  it('her seviyede iki katına çıkıyor', () => {
    const a = cekirdekMaliyeti(0, 1)!;
    const b = cekirdekMaliyeti(1, 1)!;
    expect(b.altin).toBe(a.altin * 2);
  });

  it('ÜYE SAYISIYLA ölçekleniyor — kartopu freni', () => {
    // Bu, önerinin en önemli tek satırı: sabit maliyet kalabalık
    // medeniyete kalıcı bir hız avantajı verirdi.
    const tek = cekirdekMaliyeti(0, 1)!;
    const yuz = cekirdekMaliyeti(0, 100)!;
    expect(yuz.altin).toBe(tek.altin * 100);
    // Yani ÜYE BAŞINA yük aynı: küçük medeniyet kendi hızında ilerliyor.
    expect(yuz.altin / 100).toBe(tek.altin);
  });

  it('azami seviyede artık yükseltilemiyor', () => {
    expect(cekirdekMaliyeti(CEKIRDEK_AZAMI_SEVIYE, 10)).toBeNull();
    expect(cekirdekMaliyeti(CEKIRDEK_AZAMI_SEVIYE - 1, 10)).not.toBeNull();
  });

  it('üye sayısı 0 olsa bile maliyet sıfırlanmıyor', () => {
    // Boşalan bir medeniyetin çekirdeği bedavaya yükselmemeli.
    expect(cekirdekMaliyeti(0, 0)!.altin).toBeGreaterThan(0);
  });
});

describe('medeniyet(id)', () => {
  it('bilinen kimliği buluyor, bilinmeyene undefined', () => {
    expect(medeniyet(MEDENIYETLER[0]!.id)?.ad).toBe(MEDENIYETLER[0]!.ad);
    expect(medeniyet('yok-boyle-bir-sey')).toBeUndefined();
  });
});

describe('çekirdek bonusları', () => {
  it('her medeniyette dört bonus çekirdeği ve bir başkent var', () => {
    for (const m of MEDENIYETLER) {
      const bonuslu = m.cekirdekBolgeler.filter((id) => cekirdekBonusu(id) !== null);
      expect(bonuslu, m.ad).toHaveLength(4);
      // Beşincisi başkent: bonus taşımıyor ama YOK değil.
      expect(baskentCekirdegi(m.id), m.ad).toBe(m.cekirdekBolgeler[4]);
      expect(cekirdekBonusu(baskentCekirdegi(m.id)!)).toBeNull();
    }
  });

  it('dört bonusun dördü de her medeniyette bir kez geçiyor', () => {
    // Bir medeniyette iki "ambar" olsaydı, ötekinin hiç eğitim hızı
    // bonusu olmazdı ve dört taraf eşit başlamazdı.
    for (const m of MEDENIYETLER) {
      const bonuslar = m.cekirdekBolgeler.map(cekirdekBonusu).filter((b) => b !== null);
      expect(new Set(bonuslar).size, m.ad).toBe(4);
    }
  });

  it('çekirdek olmayan bölge bonus taşımıyor', () => {
    const cekismeli = WORLD_MAP.regions.find((r) => cekismeliMi(r.id))!;
    expect(cekirdekBonusu(cekismeli.id)).toBeNull();
  });
});

describe('nüfus dengesi', () => {
  const bos = () => Object.fromEntries(MEDENIYETLER.map((m) => [m.id, 0]));

  it('ilk gün hepsi açık — hiçbiri ortalamanın üstünde değil', () => {
    expect(acikMedeniyetler(bos())).toHaveLength(MEDENIYETLER.length);
  });

  it('öne geçen medeniyet kayda kapanıyor', () => {
    const n = { ...bos(), [MEDENIYETLER[0]!.id]: 500 };
    const acik = acikMedeniyetler(n);
    expect(acik).not.toContain(MEDENIYETLER[0]!.id);
    expect(acik).toHaveLength(MEDENIYETLER.length - 1);
  });

  it('liste hiçbir dağılımda boş kalmıyor', () => {
    // Rastgele yüz dağılım: en az bir sayı her zaman ortalamanın altında
    // ya da ona eşit olmak zorunda. Boş liste dönseydi kayıt kapanırdı.
    for (let i = 0; i < 100; i++) {
      const n = Object.fromEntries(
        MEDENIYETLER.map((m) => [m.id, Math.floor(Math.random() * 1000)]),
      );
      expect(acikMedeniyetler(n).length).toBeGreaterThan(0);
    }
  });

  it('atama en az nüfusluya gidiyor', () => {
    const n = bos();
    n[MEDENIYETLER[0]!.id] = 90;
    n[MEDENIYETLER[1]!.id] = 80;
    n[MEDENIYETLER[2]!.id] = 70;
    n[MEDENIYETLER[3]!.id] = 60;
    expect(atanacakMedeniyet(n)).toBe(MEDENIYETLER[3]!.id);
  });

  it('eşitlikte deterministik: aynı girdi aynı sonuç', () => {
    expect(atanacakMedeniyet(bos())).toBe(MEDENIYETLER[0]!.id);
    expect(atanacakMedeniyet(bos())).toBe(atanacakMedeniyet(bos()));
  });

  /*
   * ASIL İDDİA: `docs/16` §10'un birinci riski — "herkes kazanan tarafa
   * yazılır" — kendini düzeltiyor mu? Sınama bunu davranışla ölçüyor,
   * "fonksiyon bir şey döndürdü" ile değil.
   *
   * Öndeki medeniyetin mevcut üyeleri GERİ ALINAMAZ; düzelme ancak
   * seyreltmeyle olur. İlk yazdığımda 400 yeni oyuncudan sonra farkın
   * kapanmasını bekliyordum ve sınama kaldı — haklı olarak: 200 kişilik
   * baş, 400 kişiyle kapanmaz. Yanlış olan kod değil iddiaydı. Doğrusu
   * iki cümle: önde olan yeni oyuncu ALMAZ, ve yeterince oyuncu
   * geldiğinde fark SIFIRLANIR.
   */
  it('önde olan medeniyet yeni oyuncu almıyor', () => {
    const n = bos();
    const onde = MEDENIYETLER[0]!.id;
    n[onde] = 200;
    for (let i = 0; i < 400; i++) n[atanacakMedeniyet(n)]!++;
    expect(n[onde]).toBe(200);
    const kalanlar = MEDENIYETLER.slice(1).map((m) => n[m.id]!);
    expect(Math.max(...kalanlar) - Math.min(...kalanlar)).toBeLessThanOrEqual(1);
  });

  it('yeterince oyuncu gelince baş tamamen erir', () => {
    const n = bos();
    n[MEDENIYETLER[0]!.id] = 200;
    for (let i = 0; i < 4000; i++) n[atanacakMedeniyet(n)]!++;
    const sayilar = MEDENIYETLER.map((m) => n[m.id]!);
    expect(Math.max(...sayilar) - Math.min(...sayilar)).toBeLessThanOrEqual(1);
  });
});

describe('yurt bölgeleri', () => {
  it('her medeniyetin yurdu dolu ve çekirdeklerini kapsıyor', () => {
    for (const m of MEDENIYETLER) {
      const yurt = yurtBolgeleri(m.id);
      expect(yurt.length).toBeGreaterThan(0);
      for (const c of m.cekirdekBolgeler) expect(yurt).toContain(c);
    }
  });

  it('yurtlar çakışmıyor — bir bölge iki medeniyetin olamaz', () => {
    const gorulen = new Set<number>();
    for (const m of MEDENIYETLER) {
      for (const id of yurtBolgeleri(m.id)) {
        expect(gorulen.has(id)).toBe(false);
        gorulen.add(id);
      }
    }
  });

  /*
   * KAMP BİR KÖYÜN YANINA KURULUYOR (`pickHomeAnchor`) ve artık oyuncunun
   * KENDİ yurdunda kurulmak zorunda (docs/16 §8). Yurdunda hiç köy
   * olmayan bir medeniyet o kuralı sessizce bozar: kayıt ya çöker ya da
   * oyuncuyu başka birinin toprağına doğurur. Harita değişince bu sınama
   * onu haber verir.
   */
  it('her yurtta en az bir köy var — kamp oraya kurulacak', () => {
    for (const m of MEDENIYETLER) {
      const koyler = WORLD_MAP.regions.filter((r) => r.province === m.yurt && r.type === 'koy');
      expect(koyler.length, `${m.ad} yurdunda köy yok`).toBeGreaterThan(0);
    }
  });
});

describe('çekirdek bonusları — yatırımın karşılığı', () => {
  const m = MEDENIYETLER[0]!;

  it('yatırım yoksa bonus yok', () => {
    expect(medeniyetBonusu({})).toEqual(BOS_MEDENIYET_BONUSU);
  });

  it('her çekirdek yalnız KENDİ bonusunu büyütüyor', () => {
    // İlk çekirdek 'ambar' taşıyor (bkz. cekirdekBonusu).
    const b = medeniyetBonusu({ [m.cekirdekBolgeler[0]!]: 4 });
    expect(b.ambar).toBeGreaterThan(0);
    expect(b.talimgah).toBe(0);
    expect(b.sur).toBe(0);
    expect(b.ocak).toBe(0);
  });

  it('bonus seviyeyle DOĞRUSAL büyüyor', () => {
    const bir = medeniyetBonusu({ [m.cekirdekBolgeler[0]!]: 1 }).ambar;
    const uc = medeniyetBonusu({ [m.cekirdekBolgeler[0]!]: 3 }).ambar;
    expect(uc).toBeCloseTo(bir * 3, 10);
  });

  it('azami seviyenin üstü sayılmıyor', () => {
    const tavan = medeniyetBonusu({ [m.cekirdekBolgeler[0]!]: CEKIRDEK_AZAMI_SEVIYE });
    const asiri = medeniyetBonusu({ [m.cekirdekBolgeler[0]!]: CEKIRDEK_AZAMI_SEVIYE + 50 });
    expect(asiri).toEqual(tavan);
  });

  /*
   * BAŞKENT ÇEKİRDEĞİ BONUS TAŞIMIYOR (docs/16 §7-8) ve bu sessizce
   * kaybolabilecek bir kural: beşinci çekirdeğe yatırım yapan oyuncu
   * hiçbir oran görmeyecek. Yanlışlıkla bonus taşımaya başlarsa bir
   * medeniyet diğerlerinden fazla bonus biriktirebilirdi.
   */
  it('başkent çekirdeğine yatırım hiçbir oranı büyütmüyor', () => {
    const baskent = baskentCekirdegi(m.id)!;
    expect(medeniyetBonusu({ [baskent]: CEKIRDEK_AZAMI_SEVIYE })).toEqual(BOS_MEDENIYET_BONUSU);
  });

  it('tam geliştirilmiş dört çekirdek dört oranı da tavana çıkarıyor', () => {
    const hepsi: Record<number, number> = {};
    for (const id of m.cekirdekBolgeler) hepsi[id] = CEKIRDEK_AZAMI_SEVIYE;
    const b = medeniyetBonusu(hepsi);
    for (const oran of [b.ambar, b.talimgah, b.sur, b.ocak]) {
      expect(oran).toBeGreaterThan(0);
    }
  });
});

/**
 * KARTOPU FRENİ (docs/16 §10, dördüncü risk).
 *
 * Buradaki sınamalar tasarım iddialarını ölçüyor, işlevin çalışıp
 * çalışmadığını değil: fren ilk gün kapalı mı, beraberlikte susuyor mu,
 * çekişmeli toprak bonus vermiyor mu. Üçü de sessizce bozulabilir —
 * hiçbiri hata vermez, yalnız oyunun dengesi kayar.
 */
describe('kartopu freni', () => {
  /** Haritanın açılış dağılımı: her medeniyet kendi yurdunu tutuyor. */
  const acilis = () => {
    const sayilar: Record<string, number> = {};
    for (const m of MEDENIYETLER) {
      sayilar[m.id] = WORLD_MAP.regions.filter((r) => r.province === m.yurt).length;
    }
    return sayilar;
  };

  it('harita doğduğu gün fren KAPALI', () => {
    // Asıl iddia bu: yurtlar eşit büyüklükte değil (17-18-21-21) ve
    // eşik onların üstünde seçildi. Fren ilk gün açık olsaydı, hiçbir
    // şey yapmamış bir medeniyet doğuştan hedef olurdu.
    expect(kartopuLideri(acilis())).toBeNull();
  });

  it('eşiği geçen medeniyet hedef oluyor', () => {
    const sayilar = acilis();
    const kurban = MEDENIYETLER[0]!.id;
    // Payı eşiğin üstüne çıkar: toplamın yarısını tek tarafa ver.
    const digerleri = Object.entries(sayilar).reduce(
      (t, [id, n]) => (id === kurban ? t : t + n),
      0,
    );
    sayilar[kurban] = digerleri;
    expect(kartopuLideri(sayilar)).toBe(kurban);
    expect(kartopuPayi(sayilar)).toBeGreaterThan(KARTOPU_FRENI.esik);
  });

  it('beraberlikte fren açılmıyor', () => {
    // İki taraf eşit öndeyse ortada kartopu değil denge var. İkisini
    // birden avlanacak ilan etmek "önde gideni avla" cümlesini
    // anlamsızlaştırırdı.
    const esit = { a: 40, b: 40, c: 10, d: 10 };
    expect(kartopuLideri(esit)).toBeNull();
  });

  it('neredeyse boş haritada "önde giden" yok', () => {
    const azicik = { a: KARTOPU_FRENI.enAzTutulan - 1, b: 0, c: 0, d: 0 };
    expect(kartopuLideri(azicik)).toBeNull();
  });

  it('bonus yalnız önde gidenin toprağında geçerli', () => {
    const sayilar = { a: 60, b: 20, c: 10, d: 10 };
    expect(kartopuLideri(sayilar)).toBe('a');
    expect(kartopuYagmaBonusu(sayilar, 'a')).toBe(KARTOPU_FRENI.yagmaBonusu);
    expect(kartopuYagmaBonusu(sayilar, 'b')).toBe(0);
  });

  it('sahipsiz (çekişmeli) bölge bonus vermiyor', () => {
    // Orada yutulan bir şey yok; kavganın zaten olduğu yer orası.
    expect(kartopuYagmaBonusu({ a: 60, b: 20, c: 10, d: 10 }, null)).toBe(0);
  });

  it('fren kapalıyken hiçbir toprak bonus vermiyor', () => {
    const sayilar = acilis();
    for (const m of MEDENIYETLER) expect(kartopuYagmaBonusu(sayilar, m.id)).toBe(0);
  });
});
