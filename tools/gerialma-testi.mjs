/**
 * Gövdesiz istekler: geri çağırma ve araştırma iptali.
 *
 * Oyuncunun raporu: "geri çağır diyorum, saldırıyor olarak görünüyor."
 * Sebep uçta değil TAŞIYICIDAydı — istemci her isteğe koşulsuz
 * `Content-Type: application/json` koyuyordu ve Fastify başlığı görüp
 * gövde bulamayınca 400 dönüyordu. Gövdesiz her DELETE sessizce
 * çalışmıyordu.
 *
 * Bu test tarayıcı istemcisinin YAPTIĞI şeyi taklit ediyor: gövde varsa
 * başlık var, yoksa yok. Aynı tuzağa bir daha düşülürse burada kalır.
 *
 * API ayakta olmalı. node tools/gerialma-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!hata && !kosul) hata++;
  else if (!kosul) hata++;
}

console.log('Lordlar Çağı — gövdesiz istek (geri alma) testi\n');

const damga = Date.now();
const { token: jeton } = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `ga${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Geri ${damga.toString(36).slice(-4)}`,
  }),
}).then((r) => r.json());

const yetki = { authorization: `Bearer ${jeton}` };
const al = (y) => fetch(`${API}/api${y}`, { headers: yetki }).then((r) => r.json());
const post = (y, g = {}) =>
  fetch(`${API}/api${y}`, {
    method: 'POST',
    headers: { ...yetki, 'content-type': 'application/json' },
    body: JSON.stringify(g),
  }).then(async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }));
/** İstemcinin düzeltilmiş hâli: gövde yok -> content-type da yok. */
const sil = (y) =>
  fetch(`${API}/api${y}`, { method: 'DELETE', headers: yetki }).then(async (r) => ({
    s: r.status,
    b: await r.json().catch(() => ({})),
  }));

for (let i = 0; i < 8; i++) await post('/test/xp-ver', { miktar: 500000 });
await post('/test/kaynak-ver', { altin: 400000, demir: 300000, erzak: 300000 });
await post('/army/train', { unitType: 'mizrakci', count: 30 });
await post('/test/kuyruklari-bitir');

const ordu = (await al('/army')).home ?? {};
const oneri = (await al('/map')).oneri;
kontrol('saldıracak ordu ve hedef hazır', (ordu.mizrakci ?? 0) > 0 && Boolean(oneri?.regionId));

/* --- Yürüyüşü geri çağır --- */
const m = await post('/march', { toRegionId: oneri.regionId, army: ordu, generalIds: [] });
kontrol('saldırı başladı', m.s === 200, `HTTP ${m.s}`);

const yolda = await al('/marches');
kontrol('yürüyüş listede', yolda.length === 1, `${yolda.length} yürüyüş`);
kontrol('ordu evden çıktı', Object.keys((await al('/army')).home ?? {}).length === 0);

const gc = await sil(`/march/${yolda[0].id}`);
kontrol(
  'geri çağırma KABUL edildi',
  gc.s === 200,
  `HTTP ${gc.s} ${JSON.stringify(gc.b).slice(0, 90)}`,
);
kontrol('yürüyüş listeden düştü', (await al('/marches')).length === 0);
const evde = (await al('/army')).home ?? {};
kontrol('ordu eve döndü', (evde.mizrakci ?? 0) === (ordu.mizrakci ?? 0), JSON.stringify(evde));

/* --- Araştırmayı iptal et (aynı taşıyıcı yolu) --- */
const basla = await post('/arastirma', { key: 'ambarlar' });
kontrol('araştırma başladı', basla.s === 200, `HTTP ${basla.s}`);
if (basla.s === 200) {
  const iptal = await sil(`/arastirma/${basla.b.id}`);
  kontrol('araştırma iptali KABUL edildi', iptal.s === 200, `HTTP ${iptal.s}`);
  kontrol('süren araştırma kalmadı', (await al('/arastirma')).suren === null);
}

/* --- Gövdeli DELETE hâlâ çalışıyor mu (hesap silme yolu) --- */
const yanlis = await fetch(`${API}/api/march/yok-boyle-bir-id`, {
  method: 'DELETE',
  headers: yetki,
}).then((r) => r.status);
kontrol('olmayan yürüyüş 404 veriyor, 400 değil', yanlis === 404, `HTTP ${yanlis}`);

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
