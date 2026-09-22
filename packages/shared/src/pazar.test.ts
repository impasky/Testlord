import { describe, expect, it } from 'vitest';
import {
  KAYNAK_TURLERI,
  birimKuru,
  depoBosYer,
  pazarGunlukTavan,
  siganEnFazla,
  takasEngeli,
  takasHesapla,
} from './pazar.js';
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
    depoTavani: 1000000,
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

  it('ondalık miktar Türkçe bir sebeple reddediliyor', () => {
    const e = engel({ miktar: 150.5 });
    expect(e?.kod).toBe('TAM_SAYI');
    expect(e?.mesaj).toBe('Miktar tam sayı olmalı.');
  });

  it('alınan kaynak depoya sığmıyorsa reddediliyor ve sığan en büyük miktar söyleniyor', () => {
    // Ölçülen vaka: erzağı tavana 2.000 kalan oyuncu 8.000 altın verdi.
    const eldeki = { altin: 9000, demir: 0, erzak: 36000 };
    const e = engel({ veren: 'altin', alan: 'erzak', miktar: 8000, eldeki, depoTavani: 38000 });
    expect(e?.kod).toBe('DEPO_DOLU');
    const sigan = siganEnFazla('altin', 'erzak', 2000);
    expect(e?.mesaj).toContain(`${sigan} altın`);
    // Söylenen sayı GEÇMELİ, bir fazlası geçmemeli.
    expect(
      engel({ veren: 'altin', alan: 'erzak', miktar: sigan, eldeki, depoTavani: 38000 }),
    ).toBeNull();
    expect(
      engel({ veren: 'altin', alan: 'erzak', miktar: sigan + 1, eldeki, depoTavani: 38000 })?.kod,
    ).toBe('DEPO_DOLU');
  });

  it('sığan en büyük miktar her kur çiftinde tam', () => {
    for (const v of KAYNAK_TURLERI) {
      for (const a of KAYNAK_TURLERI) {
        if (v === a) continue;
        for (const bos of [0, 1, 99, 1234, 50000]) {
          const m = siganEnFazla(v, a, bos);
          expect(takasHesapla(v, a, m).alinan).toBeLessThanOrEqual(bos);
          expect(takasHesapla(v, a, m + 1).alinan).toBeGreaterThan(bos);
        }
      }
    }
  });

  it('depo doluysa en az miktar bile sığmıyor ve bunu söylüyor', () => {
    const e = engel({
      alan: 'demir',
      eldeki: { altin: 5000, demir: 38000, erzak: 0 },
      depoTavani: 38000,
    });
    expect(e?.kod).toBe('DEPO_DOLU');
    expect(e?.mesaj).toContain('yeterli yer yok');
    expect(depoBosYer('demir', { altin: 0, demir: 40000, erzak: 0 }, 38000)).toBe(0);
  });

  it('her engelin okunur bir mesajı var', () => {
    const durumlar = [
      engel({ alan: 'altin' }),
      engel({ miktar: 1 }),
      engel({ miktar: 150.5 }),
      engel({ eldeki: { altin: 0, demir: 0, erzak: 0 } }),
      engel({ bugunkuHacim: 100000, gunlukTavan: 100000 }),
      engel({ depoTavani: 0 }),
    ];
    for (const e of durumlar) expect((e?.mesaj ?? '').length).toBeGreaterThan(10);
  });
});
