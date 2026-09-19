/**
 * Önizleme ile gerçekte verilen ödül aynı mı.
 *
 * `fetihKazanci` oyuncuya saldırı ÖNCESİ "bu bölgeyi alırsan şunu
 * kazanırsın" diye gösterilen vitrin. Gerçekte verilen XP ise
 * `march.ts`te `captureXp(region.incomeMult)` ile hesaplanıyor.
 *
 * İkisi bir süre aynı formülü (`Math.round(1500 * incomeMult)`) AYRI
 * AYRI yazdı. Öyle bir kopya sessizce ayrışır: kimse kırılmaz, yalnız
 * önizleme yalan söylemeye başlar ve oyuncu bunu ancak saldırdıktan
 * sonra fark eder. Bu sınama ikisini birbirine bağlıyor.
 */
import { describe, expect, it } from 'vitest';
import { fetihKazanci } from './odul.js';
import { captureXp } from './progression.js';

const temel = {
  lordLevel: 10,
  totalEquipmentPower: 100,
  army: { mizrakci: 20, okcu: 10, suvari: 5, mancinik: 0 },
  pvpWins: 0,
  fortressFameAccrued: 0,
  regions: [{ type: 'tarla', level: 1 }],
  ownsThrone: false,
  medeniyetTahti: false,
};

describe('fetihKazanci', () => {
  it('önizlemedeki XP, fetihte GERÇEKTEN verilen XP ile aynı', () => {
    // Halka çarpanı haritada bölgeden bölgeye değişiyor; birkaçını dene.
    for (const incomeMult of [0.5, 1, 1.25, 2, 3.5]) {
      const onizleme = fetihKazanci({
        ...temel,
        hedef: { type: 'koy', level: 1, incomeMult },
      });
      expect(onizleme.xp, `incomeMult ${incomeMult}`).toBe(captureXp(incomeMult));
    }
  });

  it('şöhret farkı gerçekten hesaplanıyor — bölge eklemek şöhreti artırır', () => {
    const k = fetihKazanci({ ...temel, hedef: { type: 'sehir', level: 3, incomeMult: 1 } });
    expect(k.sohretSonrasi).toBeGreaterThan(k.sohretOncesi);
    expect(k.sohretFarki).toBe(k.sohretSonrasi - k.sohretOncesi);
  });
});

/**
 * TAHT ARTIK MEDENİYETE DE YAZIYOR (docs/16 §13 soru 5).
 *
 * Önizlemenin tahtı olduğundan küçük göstermesi, oyuncuya haritanın en
 * büyük ödülünü eksik anlatmak olurdu — ve bu sessizce olurdu: sayı
 * çıkar, yalnız yanlış çıkar.
 */
describe('tahtın medeniyete yazan payı', () => {
  it('tahtı almak İKİ çarpanı birden açıyor', () => {
    const taht = fetihKazanci({ ...temel, hedef: { type: 'taht', level: 1, incomeMult: 1 } });
    const koy = fetihKazanci({ ...temel, hedef: { type: 'koy', level: 1, incomeMult: 1 } });
    // Taht, aynı seviyedeki sıradan bir bölgeden belirgin biçimde fazla
    // şöhret getirmeli: iki çarpan da orada devreye giriyor.
    expect(taht.sohretFarki).toBeGreaterThan(koy.sohretFarki);
  });

  it('medeniyetin tahtı zaten bizdeyse fetih o çarpanı İKİNCİ kez açmıyor', () => {
    const bizde = fetihKazanci({
      ...temel,
      medeniyetTahti: true,
      hedef: { type: 'koy', level: 1, incomeMult: 1 },
    });
    const degil = fetihKazanci({ ...temel, hedef: { type: 'koy', level: 1, incomeMult: 1 } });
    // Çarpan iki tarafa da işlediği için FARK oransal olarak aynı kalıyor;
    // değişen şey toplam şöhret.
    expect(bizde.sohretOncesi).toBeGreaterThan(degil.sohretOncesi);
    expect(bizde.sohretFarki / degil.sohretFarki).toBeCloseTo(
      bizde.sohretOncesi / degil.sohretOncesi,
      2,
    );
  });
});
