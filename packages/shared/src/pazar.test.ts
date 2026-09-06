import { describe, expect, it } from 'vitest';
import { KAYNAK_TURLERI, birimKuru, pazarGunlukTavan, takasEngeli, takasHesapla } from './pazar.js';
import { B } from './balance.js';
import type { Resources } from './types.js';

const bol: Resources = { altin: 100000, demir: 100000, erzak: 100000 };

function engel(ek: Partial<Parameters<typeof takasEngeli>[0]> = {}) {
  return takasEngeli({
    veren: 'altin',
    alan: 'demir',
    miktar: 1000,
    eldeki: bol,
    bugunkuHacim: 0,
    gunlukTavan: 100000,
    ...ek,
  });
}

describe('takas matematiği', () => {
  it('komisyon oyuncudan alınıyor: aldığın verdiğinden az değerli', () => {
    const s = takasHesapla('altin', 'demir', 1000);
    const verilenDeger = 1000 * birimKuru('altin');
    const alinanDeger = s.alinan * birimKuru('demir');
    expect(alinanDeger).toBeLessThan(verilenDeger);
    expect(s.kayip).toBeGreaterThan(0);
  });

  it('gidiş-dönüş takas HER ZAMAN zarar: sonsuz döngü yok', () => {
    // Komisyonsuz bir pazar üç kaynağı tek kaynağa indirger; daha
    // kötüsü, ileri-geri çevirerek kaynak üretmek mümkün olurdu.
    for (const a of KAYNAK_TURLERI) {
      for (const b of KAYNAK_TURLERI) {
        if (a === b) continue;
        const ileri = takasHesapla(a, b, 10000);
        const geri = takasHesapla(b, a, ileri.alinan);
        expect(geri.alinan).toBeLessThan(10000);
      }
    }
  });

  it('kur balance.json’dan geliyor', () => {
    for (const k of KAYNAK_TURLERI) {
      expect(birimKuru(k)).toBe(
        (B.kaynaklar.altin_karsiligi as unknown as Record<string, number>)[k],
      );
    }
  });

  it('aşağı yuvarlanıyor: yoktan kaynak çıkmıyor', () => {
    const s = takasHesapla('erzak', 'demir', 101);
    expect(Number.isInteger(s.alinan)).toBe(true);
    expect(s.alinan * birimKuru('demir')).toBeLessThanOrEqual(101 * birimKuru('erzak'));
  });

  it('günlük tavan seviyeyle büyüyor', () => {
    expect(pazarGunlukTavan(20)).toBeGreaterThan(pazarGunlukTavan(1));
  });
});

describe('takas engelleri sebebini söylüyor', () => {
  it('geçerli takasta engel yok', () => {
    expect(engel()).toBeNull();
  });

  it('aynı kaynağı kendisiyle takas edilemiyor', () => {
    expect(engel({ alan: 'altin' })?.kod).toBe('AYNI_KAYNAK');
  });

  it('en az miktarın altı reddediliyor', () => {
    expect(engel({ miktar: B.pazar.en_az_miktar - 1 })?.kod).toBe('AZ_MIKTAR');
  });

  it('elde olmayan kaynak takas edilemiyor', () => {
    expect(engel({ eldeki: { altin: 10, demir: 0, erzak: 0 } })?.kod).toBe('KAYNAK_YETERSIZ');
  });

  it('günlük tavan aşılamıyor ve kalan miktar söyleniyor', () => {
    const e = engel({ bugunkuHacim: 99000, gunlukTavan: 100000, miktar: 50000 });
    expect(e?.kod).toBe('GUNLUK_TAVAN');
    expect(e?.mesaj).toMatch(/\d/);
  });

  it('tavan tamamen dolduysa yarını söylüyor', () => {
    const e = engel({ bugunkuHacim: 100000, gunlukTavan: 100000 });
    expect(e?.mesaj).toContain('Yarın');
  });

  it('uydurma kaynak reddediliyor', () => {
    expect(engel({ veren: 'ejderha' })?.kod).toBe('KAYNAK_YOK');
  });

  it('her engelin okunur bir mesajı var', () => {
    const durumlar = [
      engel({ alan: 'altin' }),
      engel({ miktar: 1 }),
      engel({ eldeki: { altin: 0, demir: 0, erzak: 0 } }),
      engel({ bugunkuHacim: 100000, gunlukTavan: 100000 }),
    ];
    for (const e of durumlar) expect((e?.mesaj ?? '').length).toBeGreaterThan(10);
  });
});
