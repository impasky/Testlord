/**
 * HARİTA İKİ BİÇİMDE AYNI ŞEYİ SÖYLÜYOR — `/map` ile `/harita` (docs/27 §7).
 *
 * Harita iki uçtan gidiyor: eski `/map` (her bölge bütün alanlarıyla,
 * ~900 KB) ve web istemcisinin okuduğu `/harita` (yalnız değişenler,
 * ~28 KB) + bir kez indirilen değişmeyen liste (`/harita/bolgeler/…`).
 * İstemci ikincisini birleştirip birincinin biçimini kuruyor. Sunucu ikisini
 * aynı hesaptan yazıyor (`services/haritaDurumu.ts`) ama yazım iki ayrı yerde;
 * bir alan birinde unutulursa web haritası ile test araçları ayrı dünyalar
 * görür ve hiçbiri hata vermez. Bu test birleşimi `/map` ile BİREBİR
 * karşılaştırıyor — sahipli, kalkanlı ve payı olan bölgeler dahil.
 *
 * Ayrıca değişmeyen listenin saklanma kuralı: adresteki sürüm tutuyorsa bir
 * yıl, tutmuyorsa hiç. Bozulursa tarayıcı ya her açılışta 95 KB indirir ya
 * da harita değişse de eski listeyi gösterir.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/harita-bicim-testi.mjs
 */
import assert from 'node:assert';
import { kayitOl } from './lib/kayit.mjs';
import { fethedilebilirMi } from './lib/hedef.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

const damga = Date.now();
async function lordKur(etiket, ulke) {
  const { token } = await kayitOl(API, {
    email: `hbc${damga}_${etiket}@lordlar.dev`,
    lordName: `Hbc${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
    ulke,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(govde ?? {}),
      }).then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
    ham: (yol) => fetch(`${API}/api${yol}`, { headers: h }),
  };
}

/** İstemcinin yaptığı birleşim (apps/web/src/api/client.ts → `haritaYukle`). */
function birlestir(h, liste) {
  const { bolgeler: _adres, level, sinirda, distance, fortressBonus, ozel, ...govde } = h;
  const ozelIle = new Map(ozel.map((o) => [o.i, o]));
  const regions = liste.map((b, i) => {
    const o = ozelIle.get(i);
    return {
      ...b,
      level: level[i],
      owner: o?.owner ?? null,
      isMine: o?.isMine ?? false,
      pay: o?.pay ?? null,
      sinirda: sinirda[i] === '1',
      shielded: o?.shielded ?? false,
      distance: distance[i],
      paktli: o?.paktli ?? false,
      muttefik: o?.muttefik ?? false,
      fortressBonus: fortressBonus[i],
    };
  });
  return { ...govde, regions };
}

async function karsilastir(ad, l) {
  const [eski, h] = await Promise.all([l.get('/map'), l.get('/harita')]);
  const liste = await fetch(`${API}/api${h.bolgeler}`).then((r) => r.json());
  let fark = '';
  try {
    assert.deepStrictEqual(birlestir(h, liste), eski);
  } catch (e) {
    fark = String(e.message).split('\n').slice(0, 12).join(' ').slice(0, 300);
  }
  k(`${ad}: /harita + liste = /map`, fark === '', fark || `${eski.regions.length} bölge`);
  return { eski, h };
}

console.log('Lordlar Çağı — harita iki biçimde\n');

// a fethediyor (sahip + fetih kalkanı), b aynı ülkede onu görüyor.
const a = await lordKur('a', 'TUR');
const b = await lordKur('b', 'TUR');
await a.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
// Yeni lordun komuta yeri 120 mızrakçıya yetmiyor: önce liderlik.
await a.post('/test/xp-ver', { miktar: 200000 });
const puan = (await a.get('/me')).lord.statPoints;
if (puan > 0) await a.post('/me/stats', { liderlik: puan });
await a.post('/army/train', { unitType: 'mizrakci', count: 120 });
await a.post('/test/kuyruklari-bitir');
const hedef = (await a.get('/map')).regions
  .filter((r) => r.province === 'TUR' && fethedilebilirMi(r) && r.type !== 'sehir')
  .sort((x, y) => x.distance - y.distance)[0];
await a.post('/march', { toRegionId: hedef.id, army: (await a.get('/army')).home });
await a.post('/test/yuruyusleri-bitir');
await a.post('/test/yuruyusleri-bitir');

const { eski: aHarita } = await karsilastir('fetheden', a);
const alinan = aHarita.regions.find((r) => r.id === hedef.id);
k('Fetih haritada', alinan?.isMine === true, `${hedef.name}: ${alinan?.owner?.name ?? 'sahipsiz'}`);

const { eski: bHarita, h: bDurum } = await karsilastir('komşu', b);
const bGoren = bHarita.regions.find((r) => r.id === hedef.id);
k(
  'Öbür lord sahibini ve kalkanı görüyor',
  bGoren?.owner !== null && !bGoren?.isMine,
  `sahip ${bGoren?.owner?.name} · kalkan ${bGoren?.shielded}`,
);

// Boyut: kısa biçimin varlık sebebi.
const kisa = (await b.ham('/harita').then((r) => r.text())).length;
const uzun = (await b.ham('/map').then((r) => r.text())).length;
k('Kısa biçim tam biçimin onda birinden küçük', kisa * 10 < uzun, `${kisa} / ${uzun} bayt`);

// Değişmeyen liste: sürüm tutuyorsa bir yıl, tutmuyorsa hiç saklanmıyor.
const dogru = await fetch(`${API}/api${bDurum.bolgeler}`, { headers: { 'accept-encoding': 'br' } });
await dogru.arrayBuffer();
k(
  'Liste sürümüyle istenince bir yıl saklanıyor',
  /immutable/.test(dogru.headers.get('cache-control') ?? ''),
  dogru.headers.get('cache-control') ?? 'başlık yok',
);
k(
  'Liste hazır sıkıştırılmış gidiyor',
  dogru.headers.get('content-encoding') === 'br',
  dogru.headers.get('content-encoding') ?? 'sıkıştırılmamış',
);
const eskiSurum = await fetch(`${API}/api${bDurum.bolgeler.replace(/s=[^&]+/, 's=eski')}`);
await eskiSurum.arrayBuffer();
k(
  'Başka sürümle istenince saklanmıyor',
  eskiSurum.headers.get('cache-control') === 'no-cache',
  eskiSurum.headers.get('cache-control') ?? 'başlık yok',
);
const yok = await fetch(`${API}/api/harita/bolgeler/boyle-bir-diyar-yok`);
k('Olmayan diyar 404', yok.status === 404, `HTTP ${yok.status}`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
