/**
 * Günlük görev ve ödül testi (docs/09 K4, K4b).
 *
 * Görevler ödül vermediği sürece "yarın gel" demenin bir karşılığı yoktu.
 * Bu test ödülün gerçekten verildiğini ve İKİ KEZ verilmediğini ölçüyor —
 * ikincisi kritik: ödül tek bir gün damgasıyla korunuyor ve çift tıklama
 * ya da iki sekme, koşullu yazma olmasa kaynak dağıtırdı.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/gunluk-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
const r = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `gunluk${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Gun${damga.toString(36).slice(-5)}`,
  }),
});
const { token } = await r.json();
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
    .then((x) => x.json());
const get = (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json());
const say = (k) => Math.round((k?.altin ?? 0) + (k?.demir ?? 0) + (k?.erzak ?? 0));

console.log('Lordlar Çağı — günlük görev ve ödül testi\n');

const bas = await get('/gunluk');
kontrol('Üç görev gösteriliyor', bas.gorevler?.length === 3, `${bas.gorevler?.length} görev`);
kontrol(
  'Ödül görevler bitmeden de görünüyor',
  say(bas.odul?.kaynak) > 0,
  `${bas.odul?.kaynak?.altin} altın`,
);
kontrol('Yeni oyuncuda ödül henüz hak edilmedi', bas.odul?.hakEdildi === false);
kontrol('Yeni oyuncunun serisi 1', bas.seri === 1, `seri ${bas.seri}`);

const erken = await post('/gunluk/odul');
kontrol('Görevler bitmeden ödül alınamıyor', erken?.code === 'GOREV_EKSIK', erken?.code ?? '-');

// --- Üç görevi de yap
await post('/test/kaynak-ver', { altin: 60000, demir: 40000, erzak: 40000 });
await post('/army/train', { unitType: 'milis', count: 20 });
await post('/items/craft', { tier: 1, slot: 'silah' });
await post('/test/kuyruklari-bitir');
await post('/test/kalkanlari-kaldir');

const harita = await get('/map');
const aday = harita.regions
  .filter((x) => !x.owner && x.type !== 'taht')
  .sort((a, b) => a.distance - b.distance)[0];
const ordu = (await get('/army')).home;
await post('/march', { toRegionId: aday.id, army: ordu });
await post('/test/yuruyusleri-bitir');

const dolu = await get('/gunluk');
kontrol(
  'Üç görev de tamamlandı',
  dolu.gorevler.every((g) => g.tamam),
  dolu.gorevler.map((g) => `${g.key}:${g.tamam ? '✓' : '✗'}`).join(' '),
);
kontrol('Ödül hak edildi', dolu.odul.hakEdildi === true);
kontrol('Ödül henüz alınmadı', dolu.odul.alindi === false);

// --- Ödülü al
const oncekiKaynak = (await get('/me')).lord.resources;
const alindi = await post('/gunluk/odul');
kontrol('Ödül verildi', say(alindi?.verilen) > 0, `${alindi?.verilen?.altin} altın`);
kontrol(
  'Kaynaklar gerçekten arttı',
  alindi.kaynaklar.altin > oncekiKaynak.altin,
  `${Math.floor(oncekiKaynak.altin)} -> ${Math.floor(alindi.kaynaklar.altin)}`,
);

// Testin çekirdeği: ikinci kez alınamamalı.
const ikinci = await post('/gunluk/odul');
kontrol('Ödül İKİNCİ kez alınamıyor', ikinci?.code === 'ODUL_ALINDI', ikinci?.code ?? '-');

const sonrasi = await get('/gunluk');
kontrol('Ödül "alındı" olarak işaretlendi', sonrasi.odul.alindi === true);

// Aynı anda gelen iki istek de tek ödül vermeli (koşullu yazma sınavı).
const esZamanli = await Promise.all([post('/gunluk/odul'), post('/gunluk/odul')]);
kontrol(
  'Eş zamanlı iki istek de reddediliyor',
  esZamanli.every((x) => x?.code === 'ODUL_ALINDI'),
  esZamanli.map((x) => x?.code ?? 'verildi').join(', '),
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
