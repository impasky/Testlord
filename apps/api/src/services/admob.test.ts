/**
 * SSV imza doğrulaması — sessizce yanlış olabilecek tek yer.
 *
 * Yanlış içerik ya da yanlış kodlama imzayı ya HER ZAMAN reddeder (hiçbir
 * oyuncu ödül alamaz) ya da hiç denetlemez (herkes istediği kadar alır).
 * İkisi de hata vermez. Burada imzalı bir sorgu üretilip gerçek
 * doğrulama yolundan geçiriliyor; tek harfi değişen sorgu reddediliyor.
 */
import { beforeAll, describe, expect, it } from 'vitest';

// admob.ts env.ts'yi okuyor; env.ts zorunlu ayar yoksa süreci kapatıyor.
// Modül, ortam kurulduktan SONRA yükleniyor (import yukarı taşınırdı).
let m: typeof import('./admob.js');
beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://test@localhost/test';
  process.env.JWT_SECRET ??= 'birim-testi-icin-uzun-ve-rastgele-gorunen-imza-0123456789';
  m = await import('./admob.js');
});
const gelistirmeSsvSorgusu = (a: Record<string, string>) => m.gelistirmeSsvSorgusu(a);
const ssvDogrula = (q: string) => m.ssvDogrula(q);
const ssvParcala = (q: string) => m.ssvParcala(q);

const ALANLAR = {
  ad_network: '5450213213286189855',
  ad_unit: '5224354917',
  custom_data: 'oturum:abc 1&2',
  reward_amount: '15',
  reward_item: 'dakika',
  timestamp: '1760000000000',
  transaction_id: '123456789abcdef',
  user_id: 'etiket',
};

describe('AdMob SSV', () => {
  it('imzalı sorgu doğrulanıyor, alanlar çözülüyor', async () => {
    const q = gelistirmeSsvSorgusu(ALANLAR);
    const a = await ssvDogrula(q);
    expect(a).toMatchObject({
      adUnit: '5224354917',
      customData: 'oturum:abc 1&2',
      rewardAmount: 15,
      transactionId: '123456789abcdef',
      userId: 'etiket',
    });
  });

  it('içerik değişince imza tutmuyor', async () => {
    const q = gelistirmeSsvSorgusu(ALANLAR).replace('reward_amount=15', 'reward_amount=99');
    expect(await ssvDogrula(q)).toBeNull();
  });

  it('imza ya da anahtar eksikse reddediliyor', async () => {
    const q = gelistirmeSsvSorgusu(ALANLAR);
    expect(await ssvDogrula(q.replace(/&signature=[^&]+/, ''))).toBeNull();
    expect(ssvParcala('a=1&b=2')).toBeNull();
    // Bilinmeyen anahtar: Google'dan yeniden çekiliyor; ağ yoksa hata
    // (uç 5xx döner, Google yeniden dener). Her iki durumda da ödül yok.
    const bilinmeyen = await ssvDogrula(q.replace(/key_id=[^&]+$/, 'key_id=yok')).catch(() => null);
    expect(bilinmeyen).toBeNull();
  });

  it('imzalanan içerik signature’dan önceki kısım, kodlaması çözülmüş', () => {
    const q = gelistirmeSsvSorgusu(ALANLAR);
    const p = ssvParcala(q)!;
    expect(p.icerik).toContain('custom_data=oturum:abc 1&2');
    expect(p.icerik).not.toContain('signature');
    expect(p.keyId).toBe('gelistirme');
  });
});
