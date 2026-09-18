/**
 * Elmas ve yeni oyuncu bonusu — uçtan uca.
 *
 * İki kural burada korunuyor:
 *
 *  1. ELMAS ZAMAN SATIN ALIYOR, GÜÇ DEĞİL. Kısaltma yalnız `arriveAt`i
 *     öne çekiyor; savaş aynı motorla, aynı garnizona karşı çözülüyor.
 *     Bir gün kısaltmaya ödül ya da güç eklenirse bu dosya değil, oyunun
 *     dengesi kırılır — ve o zaman burada durduğunu bilmek işe yarar.
 *  2. BEDEL SUNUCUDA hesaplanıyor. İstemcinin gönderdiği bir fiyata
 *     güvenmek, elmasları bedavaya çeviren tek satır olurdu.
 */
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';
let hata = 0;
const k = (a, c, d = '') => {
  console.log(`  ${c ? '[GEÇTİ]' : '[KALDI]'} ${a}${d ? ` — ${d}` : ''}`);
  if (!c) hata++;
};
const ad = benzersizAd('Elm');
const { token } = await kayitOl(API, { email: `${ad}@lordlar.dev`, lordName: ad });
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
    async (x) => ({ s: x.status, b: await x.json() }),
  );

console.log('Lordlar Çağı — elmas ve yeni oyuncu bonusu\n');
const me = await get('/me');
k('yeni lordun elması var', me.lord.elmas > 0, `${me.lord.elmas} elmas`);
k(
  'yeni oyuncu bonusu etkin',
  me.lord.yeniOyuncu?.etkin === true,
  `${Math.round((me.lord.yeniOyuncu?.kalanSaniye ?? 0) / 3600)} saat kaldı`,
);

// Akın için asker
await post('/test/kaynak-ver', { altin: 200000, demir: 100000, erzak: 100000 });
await post('/army/train', { unitType: 'mizrakci', count: 40 });
await post('/test/kuyruklari-bitir');

const ak = await get('/akin');
const harita = ak.haritalar[0];
const bas = await post('/akin', { haritaKey: harita.key, grupNo: 1, army: { mizrakci: 30 } });
k('akın başladı', bas.s === 200, bas.s !== 200 ? JSON.stringify(bas.b).slice(0, 120) : '');
if (bas.s === 200) {
  const sahadaki = (await get('/akin')).sahadaki[0];
  const kalanMs = new Date(sahadaki.arriveAt) - Date.now();
  k('akın yolda ve süresi var', kalanMs > 0, `${Math.round(kalanMs / 1000)} sn kaldı`);

  const oncekiElmas = (await get('/me')).lord.elmas;
  const kis = await post(`/akin/${sahadaki.id}/kisalt`);
  k(
    'elmasla kısaltma çalıştı',
    kis.s === 200,
    kis.s !== 200 ? JSON.stringify(kis.b).slice(0, 140) : `${kis.b.harcanan} elmas harcandı`,
  );
  if (kis.s === 200) {
    const sonraki = (await get('/me')).lord.elmas;
    k(
      'elmas gerçekten düştü',
      sonraki === oncekiElmas - kis.b.harcanan,
      `${oncekiElmas} -> ${sonraki}`,
    );
    const yeni = (await get('/akin')).sahadaki.find((a) => a.id === sahadaki.id);
    k(
      'varış zamanı öne çekildi',
      !yeni || new Date(yeni.arriveAt) <= new Date(),
      yeni ? `varış ${yeni.arriveAt}` : 'akın çözülmüş',
    );
  }
  // İkinci kez kısaltma: bekleme kalmadı
  const tekrar = await post(`/akin/${sahadaki.id}/kisalt`);
  k('bekleme yokken kısaltma reddediliyor', tekrar.s === 400, `${tekrar.s} ${tekrar.b.code ?? ''}`);
}
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
