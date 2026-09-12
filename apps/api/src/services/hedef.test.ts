/**
 * Tarama kısa devresi cevabı DEĞİŞTİRMEMELİ.
 *
 * `taramaSonucu` hız için örnekleri yarıda kesiyor. Bu testin tek işi o
 * kısa devrenin yalnızca ARTIK FARK ETMEYEN savaşları atladığını
 * göstermek: aynı iki taraf için `savasOrneklemesi`nin tam dokuz
 * örnekten çıkardığı "alınır mı / dar zafer mi" cevabıyla birebir aynı
 * olmalı. Süpürme kasten geniş: umutsuzdan ezici üstünlüğe kadar bütün
 * bant taranıyor, çünkü kısa devrenin kırılacağı yer tam da eşiklerin
 * dibidir.
 */
import { describe, expect, it } from 'vitest';
import {
  B,
  bosGeneralBonus,
  varsayilanDizilim,
  type Army,
  type Side,
} from '@lordlar/shared';
import { savasOrneklemesi, taramaSonucu } from './hedef.js';

function taraf(units: Army, savunan: boolean, tahkimat = 0): Side {
  return {
    units,
    duzen: { dizilim: varsayilanDizilim(units), taktik: null },
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: tahkimat,
    isDefender: savunan,
  };
}

const BAGLAM = {
  defenderStore: { altin: 0, demir: 0, erzak: 0 },
  attackerCunning: 0,
  canCapture: true,
} as const;

describe('taramaSonucu', () => {
  it('her orduda savasOrneklemesi ile aynı cevabı verir', () => {
    const savunmalar: Army[] = [
      { mizrakci: 20, okcu: 10 },
      { mizrakci: 60, okcu: 40, suvari: 20 },
      { okcu: 120, mizrakci: 80 },
    ];
    let kazanan = 0;
    let dar = 0;
    let denem = 0;

    for (const savunma of savunmalar) {
      for (const tahkimat of [0, 0.3]) {
        // Kıl payı bölgesinden geçmek şart: kısa devre orada kırılır.
        for (let n = 5; n <= 400; n += 5) {
          const saldiran = taraf({ mizrakci: n, okcu: Math.round(n * 0.6) }, false);
          const savunan = taraf(savunma, true, tahkimat);
          const tohum = `test-${n}-${tahkimat}-${JSON.stringify(savunma)}`;

          const tam = savasOrneklemesi(saldiran, savunan, tohum, BAGLAM);
          const beklenenKazanir = tam.fetihOrani >= B.oneri.guvenli_fetih_orani;
          const beklenenDar =
            !beklenenKazanir && tam.kazanmaOrani >= B.oneri.muhtemel_kazanma_orani;

          const hizli = taramaSonucu(saldiran, savunan, tohum, BAGLAM);
          expect(hizli.kazanir, `kazanir n=${n} tahkimat=${tahkimat}`).toBe(beklenenKazanir);
          expect(hizli.darZafer, `darZafer n=${n} tahkimat=${tahkimat}`).toBe(beklenenDar);
          // `kalan` yalnız kazanan hedefte anlamlı ve orada tam örnekleme koşuyor.
          if (beklenenKazanir) expect(hizli.kalan).toBeGreaterThan(0);

          denem++;
          if (beklenenKazanir) kazanan++;
          if (beklenenDar) dar++;
        }
      }
    }

    // Süpürme gerçekten üç hâli de gördü mü — görmediyse test bir şey
    // kanıtlamıyor demektir.
    expect(denem).toBeGreaterThan(400);
    expect(kazanan).toBeGreaterThan(0);
    expect(dar).toBeGreaterThan(0);
    expect(denem - kazanan - dar).toBeGreaterThan(0);
  });
});
