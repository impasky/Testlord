/**
 * Pazar: kaynak takası.
 *
 * Oyuncunun ölçülmüş şikâyeti: "kazançlar orantısız, altın deposu dolu
 * ama demir ve erzak yok." Bölgeler tek kaynak üretiyor ve Lv15'e kadar
 * tek bölge tutulabiliyor; şehir alan oyuncunun demiri saatlerce
 * darboğaz kalırken altını taşıyor.
 *
 * Buradaki asıl sorular: takas gerçekten kaynak DEĞİŞTİRİYOR mu, ve
 * pazar bir kaynak ÜRETME makinesine dönüşüyor mu?
 *
 * API ayakta olmalı. node tools/pazar-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — pazar testi\n');

const damga = Date.now();
const { token: jeton } = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `pz${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Tuccar ${damga.toString(36).slice(-4)}`,
  }),
}).then((r) => r.json());

const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
const post = (y, g = {}) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: bas, body: JSON.stringify(g) }).then(
    async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }),
  );

// kaynak-ver EKLİYOR, atamıyor: yeni lord zaten 2000 demirle başlıyor.
await post('/test/kaynak-ver', { altin: 50000, demir: 0, erzak: 0 });

const pazar = await al('/pazar');
kontrol(
  'pazar durumu geliyor',
  typeof pazar.komisyon === 'number',
  `komisyon %${(pazar.komisyon ?? 0) * 100}`,
);
kontrol('günlük tavan var', (pazar.gunluk?.tavan ?? 0) > 0, `tavan ${pazar.gunluk?.tavan}`);
kontrol('kurlar bildiriliyor', Object.keys(pazar.kurlar ?? {}).length === 3);

const once = (await al('/me')).lord.resources;
kontrol('başlangıçta altın demirden çok fazla', once.altin > once.demir * 5, JSON.stringify(once));

const t = await post('/pazar/takas', { veren: 'altin', alan: 'demir', miktar: 2000 });
kontrol('takas kabul edildi', t.s === 200, `HTTP ${t.s} ${JSON.stringify(t.b).slice(0, 90)}`);

const sonra = (await al('/me')).lord.resources;
kontrol('altın azaldı', sonra.altin < once.altin, `${once.altin} -> ${sonra.altin}`);
kontrol('demir GELDİ', sonra.demir > 0, `${once.demir} -> ${sonra.demir}`);

/* --- Pazar kaynak üretmiyor: ileri-geri çevirmek zarar --- */
// Tavan dar; gidiş-dönüş için hakkı tazeleyip küçük miktarla çalışıyoruz.
const dOnce = (await al('/me')).lord.resources.demir;
const ileri = await post('/pazar/takas', {
  veren: 'demir',
  alan: 'altin',
  miktar: Math.min(dOnce, 300),
});
if (ileri.s === 200) {
  const aArasi = (await al('/me')).lord.resources.altin;
  const geri = await post('/pazar/takas', { veren: 'altin', alan: 'demir', miktar: 300 });
  kontrol('ileri-geri çevirmek mümkün', geri.s === 200, `HTTP ${geri.s}`);
  const dSonra = (await al('/me')).lord.resources.demir;
  kontrol(
    'gidiş-dönüş ZARAR ettiriyor (sonsuz kaynak yok)',
    dSonra < dOnce,
    `${dOnce} -> ${dSonra}`,
  );
} else {
  kontrol('ileri-geri çevirmek mümkün', false, `HTTP ${ileri.s}`);
  kontrol('gidiş-dönüş ZARAR ettiriyor (sonsuz kaynak yok)', false);
}

/* --- Kurallar --- */
const ayni = await post('/pazar/takas', { veren: 'altin', alan: 'altin', miktar: 500 });
kontrol('aynı kaynak takası reddedildi', ayni.s === 400, `HTTP ${ayni.s}`);
const az = await post('/pazar/takas', { veren: 'altin', alan: 'demir', miktar: 1 });
kontrol('çok küçük takas reddedildi', az.s === 400, az.b?.error ?? '');
const yok = await post('/pazar/takas', { veren: 'erzak', alan: 'altin', miktar: 999999 });
kontrol('elde olmayan kaynak reddedildi', yok.s === 400, yok.b?.error ?? '');

/* --- Günlük tavan --- */
await post('/test/kaynak-ver', { altin: 5000000, demir: 0, erzak: 0 });
const d = await al('/pazar');
const kalan = d.gunluk.kalan;
const asiri = await post('/pazar/takas', {
  veren: 'altin',
  alan: 'demir',
  miktar: Math.ceil(kalan) + 10000,
});
kontrol('günlük tavanı aşan takas reddedildi', asiri.s === 400, asiri.b?.error ?? '');
kontrol('reddin sebebi yazılı', (asiri.b?.error ?? '').length > 10, asiri.b?.error ?? '');

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
