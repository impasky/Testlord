/**
 * Birleşme kuralları.
 *
 * Testin çekirdeği tek cümle: eşler AÇILIŞ TARİHİ YAKIN diyarlardan
 * seçiliyor. Gerisi bunun sonucu.
 */
import { describe, expect, it } from 'vitest';
import {
  BIRLESME,
  birlesmeAni,
  birlesmeEsleri,
  birlesmeyeHazirMi,
  bolgeKarari,
  diyarYasiGun,
  evSahibiSec,
} from './birlesme.js';

const SIMDI = new Date('2026-06-01T00:00:00Z');
const gunOnce = (g: number) => new Date(SIMDI.getTime() - g * 86_400_000);

function diyar(ad: string, yasGun: number, aktif = 5, ek: Record<string, unknown> = {}) {
  return {
    id: ad,
    ad,
    openedAt: gunOnce(yasGun),
    aktifLord: aktif,
    lordSayisi: Math.max(aktif, 10),
    kapasite: 240,
    durum: 'full',
    ...ek,
  };
}

describe('birleşmeye hazır mı', () => {
  it('yaşı dolmayan diyar birleşmiyor', () => {
    expect(birlesmeyeHazirMi(diyar('genç', BIRLESME.yas_gun - 1), SIMDI)).toBe(false);
    expect(birlesmeyeHazirMi(diyar('tam', BIRLESME.yas_gun), SIMDI)).toBe(true);
  });

  it('kapatılmış diyar birleşmiyor', () => {
    expect(birlesmeyeHazirMi(diyar('kapalı', 200, 5, { durum: 'closed' }), SIMDI)).toBe(false);
  });

  it('lordu olmayan diyar birleşmiyor — o temizliğin işi', () => {
    expect(birlesmeyeHazirMi(diyar('boş', 200, 0, { lordSayisi: 0 }), SIMDI)).toBe(false);
  });

  it('zaten ilan edilmiş birleşme ikinci kez planlanmıyor', () => {
    expect(birlesmeyeHazirMi(diyar('planlı', 200, 5, { planliMi: true }), SIMDI)).toBe(false);
  });

  it('yaş gün olarak sayılıyor', () => {
    expect(diyarYasiGun(gunOnce(60), SIMDI)).toBe(60);
  });
});

describe('eşleşme — açılış tarihi yakınlığı', () => {
  it('en yakın yaşıtlar eşleşiyor, uzaklar değil', () => {
    const esler = birlesmeEsleri(
      [diyar('A', 400), diyar('B', 100), diyar('C', 98), diyar('D', 395)],
      SIMDI,
    );
    const ciftler = esler.map((e) => [e.evSahibi.ad, e.konuk.ad].sort().join('+')).sort();
    expect(ciftler).toEqual(['A+D', 'B+C']);
  });

  it('yaş farkı eşiği aşarsa eş kurulmuyor', () => {
    const fark = BIRLESME.azami_yas_farki_gun + 5;
    expect(birlesmeEsleri([diyar('A', 200), diyar('B', 200 - fark)], SIMDI)).toEqual([]);
  });

  it('eşi olmayan diyar bekliyor, kötü bir eşe zorlanmıyor', () => {
    // B ile C yakın; A ikisinden de çok uzak.
    const esler = birlesmeEsleri([diyar('A', 500), diyar('B', 100), diyar('C', 95)], SIMDI);
    expect(esler).toHaveLength(1);
    expect([esler[0]!.evSahibi.ad, esler[0]!.konuk.ad].sort()).toEqual(['B', 'C']);
  });

  it('tek diyar kendi kendine birleşmiyor', () => {
    expect(birlesmeEsleri([diyar('A', 200)], SIMDI)).toEqual([]);
  });

  it('bir diyar aynı turda iki kez eşleşmiyor', () => {
    const esler = birlesmeEsleri([diyar('A', 100), diyar('B', 99), diyar('C', 98)], SIMDI);
    const gorulen = esler.flatMap((e) => [e.evSahibi.id, e.konuk.id]);
    expect(new Set(gorulen).size).toBe(gorulen.length);
    expect(esler).toHaveLength(1);
  });
});

describe('ev sahibi', () => {
  it('aktif oyuncusu çok olan ev sahibi — en az kişi taşınsın', () => {
    const [ev, konuk] = evSahibiSec(diyar('az', 100, 3), diyar('cok', 100, 20));
    expect(ev.ad).toBe('cok');
    expect(konuk.ad).toBe('az');
  });

  it('eşitlikte daha eski diyar ev sahibi', () => {
    const [ev] = evSahibiSec(diyar('yeni', 100, 5), diyar('eski', 140, 5));
    expect(ev.ad).toBe('eski');
  });
});

describe('ihbar', () => {
  it('birleşme ilandan sonra, hemen değil', () => {
    const ilan = SIMDI;
    const an = birlesmeAni(ilan);
    expect(an.getTime() - ilan.getTime()).toBe(BIRLESME.ihbar_gun * 86_400_000);
    expect(BIRLESME.ihbar_gun).toBeGreaterThan(0);
  });
});

describe('bölge kararı', () => {
  it('yer boşsa toprak taşınıyor, tazminat yok', () => {
    const k = bolgeKarari({ mapId: 5, type: 'tarla', level: 3, incomeMult: 1 }, false);
    expect(k.tasindi).toBe(true);
    expect(k.tazminat).toEqual({ altin: 0, demir: 0, erzak: 0 });
  });

  it('yer doluysa toprak gitmiyor ama bir günlük gelir veriliyor', () => {
    const k = bolgeKarari({ mapId: 5, type: 'tarla', level: 3, incomeMult: 1 }, true);
    expect(k.tasindi).toBe(false);
    // Tarla erzak veriyor; sıfır olamaz, yoksa tazminat sözde kalır.
    expect(k.tazminat.erzak).toBeGreaterThan(0);
  });

  it('tazminat bölgenin seviyesiyle büyüyor', () => {
    const bir = bolgeKarari({ mapId: 5, type: 'sehir', level: 1, incomeMult: 1 }, true);
    const bes = bolgeKarari({ mapId: 5, type: 'sehir', level: 5, incomeMult: 1 }, true);
    expect(bes.tazminat.altin).toBeGreaterThan(bir.tazminat.altin);
  });
});

describe('kapasite koruması', () => {
  it('birleşince kapasiteyi aşacak çift eşleşmiyor', () => {
    // İki diyarın aktifleri tek haritaya sığmıyorsa birleşme çözüm değil
    // sorun: 121 bölgeye kapasitenin üstünde lord yığmak, kimsenin toprak
    // tutamadığı bir diyar demek.
    const esler = birlesmeEsleri(
      [diyar('A', 100, 200, { kapasite: 240 }), diyar('B', 98, 100, { kapasite: 240 })],
      SIMDI,
    );
    expect(esler).toEqual([]);
  });

  it('sığan çift eşleşiyor', () => {
    const esler = birlesmeEsleri(
      [diyar('A', 100, 120, { kapasite: 240 }), diyar('B', 98, 100, { kapasite: 240 })],
      SIMDI,
    );
    expect(esler).toHaveLength(1);
  });

  it('sığmayan çift bir sonrakini deniyor, kilitlenmiyor', () => {
    // A ile B sığmıyor; B ile C sığıyor. A beklemeli, B+C eşleşmeli.
    const esler = birlesmeEsleri(
      [
        diyar('A', 100, 200, { kapasite: 240 }),
        diyar('B', 99, 100, { kapasite: 240 }),
        diyar('C', 98, 50, { kapasite: 240 }),
      ],
      SIMDI,
    );
    expect(esler).toHaveLength(1);
    expect([esler[0]!.evSahibi.ad, esler[0]!.konuk.ad].sort()).toEqual(['B', 'C']);
  });
});
