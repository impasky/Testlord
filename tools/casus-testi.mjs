/**
 * Casusluk testi (docs/09 B5).
 *
 * docs/01 §1 Kurnazlık statını "yağma miktarı, **casusluk**" diye tarif
 * ediyordu; yağma vardı, casusluk yoktu. Bu test o sözün tutulduğunu
 * ölçüyor: casus gidiyor, rapor geliyor, düşman garnizonu görünür oluyor.
 *
 * Yakalanma rastgele (Kurnazlık'a bağlı taban ~%25). Testin takılmaması
 * için keşif, gelene kadar tekrarlanıyor — ölçülen şey "her seferinde
 * başarılı" değil, "başarılı olduğunda rapor DOĞRU geliyor".
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/casus-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `casus${damga}_${etiket}@lordlar.dev`,
    lordName: `Cs${damga.toString(36).slice(-3)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

async function orduKur(l, ordu) {
  await l.post('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
  await l.post('/test/xp-ver', { miktar: 120000 });
  const p = (await l.get('/me')).lord.statPoints;
  if (p > 0) await l.post('/me/stats', { liderlik: p });
  for (const [t, n] of Object.entries(ordu)) await l.post('/army/train', { unitType: t, count: n });
  await l.post('/test/kuyruklari-bitir');
}

console.log('Lordlar Çağı — casusluk testi\n');

const savunan = await lordKur('def');
const casus = await lordKur('atk');
await savunan.post('/test/bolgeleri-sifirla');

// Savunan bir bölge alıp garnizon kuruyor: keşfin göreceği şey bu.
await orduKur(savunan, { mizrakci: 300, okcu: 200 });
const harita = await savunan.get('/map');
let bolge = null;
for (const aday of harita.regions
  .filter((r) => r.ring === 4 && !r.owner && r.type !== 'taht')
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 10)) {
  const ordu = (await savunan.get('/army')).home;
  const o = await savunan.post('/battle/preview', { toRegionId: aday.id, army: ordu });
  if (o?.tahmin?.eleGecirir !== true) continue;
  await savunan.post('/march', { toRegionId: aday.id, army: ordu });
  await savunan.post('/test/yuruyusleri-bitir');
  await savunan.post('/test/yuruyusleri-bitir');
  if ((await savunan.get('/me')).lord.regionCount > 0) {
    bolge = aday;
    break;
  }
}
kontrol('Savunan bir bölge aldı', Boolean(bolge), bolge?.name ?? 'alınamadı');
const savunanOrdu = (await savunan.get('/army')).home;
await savunan.post(`/map/${bolge.id}/garrison`, { army: savunanOrdu });
const gercekGarnizon = (await savunan.get(`/map/${bolge.id}`)).garrison;
const gercekAdet = Object.values(gercekGarnizon ?? {}).reduce((t, n) => t + Number(n || 0), 0);
kontrol('Savunan garnizon kurdu', gercekAdet > 0, `${gercekAdet} birim`);

// --- Keşiften ÖNCE: düşman garnizonu görünmemeli
await casus.post('/test/kaynak-ver', { altin: 100000, demir: 0, erzak: 0 });
const once = await casus.get(`/map/${bolge.id}`);
kontrol('Keşiften önce garnizon görünmüyor', once.garrisonVisible === false, `${once.garrisonVisible}`);
kontrol('Keşif maliyeti ve süresi söyleniyor', once.kesifMaliyeti > 0 && once.kesifSuresiSn > 0,
  `${once.kesifMaliyeti} altın · ${once.kesifSuresiSn} sn`);
kontrol('Henüz rapor yok', once.kesif === null);

// --- Sabit sayıda keşif gönder ve DAĞILIMA bak.
//
// Yakalanma rastgele (Kurnazlık 5'te ~%25). "Her keşif başarılı" diye bir
// kontrol yazmak testi kuraya bağlardı; "en az biri yakalansın" da öyle.
// O yüzden assert edilen tek şey: birileri rapor getiriyor. Yakalanma
// oranı ÖLÇÜM olarak yazılıyor, yakalanma olduğunda ise savunanın haber
// alması assert ediliyor — asıl önemli olan o dal.
const DENEME = 10;
let rapor = null;
let yakalanma = 0;
for (let i = 0; i < DENEME; i++) {
  const g = await casus.post(`/map/${bolge.id}/kesif`);
  if (!g?.queued) {
    kontrol('Keşif kuyruğa girdi', false, g?.code ?? JSON.stringify(g).slice(0, 100));
    break;
  }
  const oncekiSayi = (await casus.get('/me')).events.filter(
    (e) => e.kind === 'kesif_raporu',
  ).length;
  await casus.post('/test/kuyruklari-bitir');
  const sonrakiSayi = (await casus.get('/me')).events.filter(
    (e) => e.kind === 'kesif_raporu',
  ).length;
  if (sonrakiSayi > oncekiSayi) rapor = await casus.get(`/map/${bolge.id}`);
  else yakalanma++;
}
kontrol('Casus rapor getirebiliyor', Boolean(rapor), `${DENEME} denemede ${yakalanma} yakalanma`);
console.log(`  (ölçüm) yakalanma oranı: ${yakalanma}/${DENEME}`);

kontrol('Keşif sonrası garnizon görünüyor', rapor.garrisonVisible === true);
const gorulen = Object.values(rapor.garrison ?? {}).reduce((t, n) => t + Number(n || 0), 0);
kontrol('Görülen garnizon GERÇEK garnizonla aynı', gorulen === gercekAdet,
  `${gorulen} vs ${gercekAdet}`);
kontrol('Rapor taze', rapor.kesif.eski === false, `${rapor.kesif.yasSn} sn`);
kontrol('Rapor depoyu da söylüyor', rapor.kesif.store !== null,
  JSON.stringify(rapor.kesif.store));
kontrol('Rapor tahkimatı söylüyor', typeof rapor.kesif.tahkimatBonusu === 'number',
  `%${Math.round((rapor.kesif.tahkimatBonusu ?? 0) * 100)}`);
kontrol('Taze raporda tavsiye açık', rapor.garrisonTaze === true);

// --- Olay akışları
const casusOlaylar = (await casus.get('/me')).events;
kontrol(
  'Casusun olay akışında keşif var',
  casusOlaylar.some((e) => e.kind === 'kesif_raporu'),
  casusOlaylar[0]?.kind ?? 'olay yok',
);
if (yakalanma > 0) {
  const savunanOlaylar = (await savunan.get('/me')).events;
  kontrol(
    'Yakalanan casusu SAVUNAN haber alıyor',
    savunanOlaylar.some((e) => e.kind === 'casus_yakaladin'),
    savunanOlaylar.find((e) => e.kind === 'casus_yakaladin')?.payload?.mesaj ?? 'haber yok',
  );
}

// --- Sahipsiz bölgeye casus göndermek anlamsız: garnizonu zaten açık
const sahipsiz = (await casus.get('/map')).regions.find(
  (r) => !r.owner && r.type !== 'taht',
);
const bos = await casus.post(`/map/${sahipsiz.id}/kesif`);
kontrol('Sahipsiz bölgeye casus gönderilemiyor', bos?.code === 'SAHIPSIZ_BOLGE', bos?.code ?? '-');

// --- Kendi bölgeni keşfetmek anlamsız
const kendi = (await savunan.get('/map')).regions.find((r) => r.isMine);
const ret = await savunan.post(`/map/${kendi.id}/kesif`);
kontrol('Kendi bölgene casus gönderilemiyor', ret?.code === 'KENDI_BOLGEN', ret?.code ?? '-');

// --- Eş zamanlı keşif limiti
const limit = [];
for (let i = 0; i < 4; i++) limit.push(await casus.post(`/map/${bolge.id}/kesif`));
kontrol(
  'Eş zamanlı keşif limiti uygulanıyor',
  limit.some((x) => x?.code === 'LIMIT_ASILDI'),
  limit.map((x) => (x?.queued ? 'kuyruk' : (x?.code ?? '?'))).join(', '),
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
