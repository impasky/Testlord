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
  MEDENIYETLER,
  baslangicSahibi,
  cekirdekMaliyeti,
  cekirdekMi,
  cekirdekSahibi,
  cekismeliMi,
  garnizonPaylari,
  medeniyet,
  orduYeri,
  payMiktari,
  tahtMi,
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
