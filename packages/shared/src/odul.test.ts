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
