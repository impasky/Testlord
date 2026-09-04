/**
 * Haftalık sefer testi (docs/09 B4).
 *
 * Seferin çekirdek iddiası: hangi etkinliğin açık olduğu SAKLANMIYOR,
 * hafta numarasından türetiliyor. Bu testin işi o türetmenin uçtan uca
 * çalıştığını ve ödülün iki kez alınamadığını göstermek.
 *
 * Ölçüt haftaya göre değiştiği için test seferin ölçütünü OKUYUP ona göre
 * davranıyor: "bu hafta akın haftasıysa saldır, seferberlikse asker eğit".
 * Sabit bir senaryo yazmak, testi haftanın gününe bağlardı — pazartesi
 * geçen bir test salı kalırdı.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/sefer-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `sefer${damga}@lordlar.dev`,
  lordName: `Sfr${damga.toString(36).slice(-5)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) })
    .then((x) => x.json());
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());
const say = (k) => Math.round((k?.altin ?? 0) + (k?.demir ?? 0) + (k?.erzak ?? 0));

console.log('Lordlar Çağı — haftalık sefer testi\n');

const bas = await get('/sefer');
kontrol('Bu haftanın seferi gösteriliyor', Boolean(bas.sefer?.key), bas.sefer?.ad ?? 'sefer yok');
kontrol('Seferin hedefi ve birimi var', bas.sefer.hedef > 0 && Boolean(bas.sefer.birim),
  `${bas.sefer.hedef} ${bas.sefer.birim}`);
kontrol('Kalan gün 1 ile 7 arasında', bas.sefer.kalanGun >= 1 && bas.sefer.kalanGun <= 7,
  `${bas.sefer.kalanGun} gün`);
kontrol('Ödül baştan görünüyor', say(bas.odul?.kaynak) > 0, `${bas.odul?.kaynak?.altin} altın`);
kontrol('Yeni oyuncuda sefer henüz bitmedi', bas.odul.hakEdildi === false,
  `${bas.sefer.simdi}/${bas.sefer.hedef}`);

const erken = await post('/sefer/odul');
kontrol('Sefer bitmeden ödül alınamıyor', erken?.code === 'SEFER_EKSIK', erken?.code ?? '-');

// Sefer iki kez sorulduğunda AYNI seferi vermeli: türetme kararlı mı?
const tekrar = await get('/sefer');
kontrol('Sefer istekten isteğe değişmiyor', tekrar.sefer.key === bas.sefer.key,
  `${bas.sefer.key} / ${tekrar.sefer.key}`);

// --- Seferi ölçütüne göre tamamla
await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord.statPoints;
if (puan > 0) await post('/me/stats', { liderlik: puan });
await post('/test/kalkanlari-kaldir');

const olcut = bas.sefer.olcut;
const gereken = bas.sefer.hedef - bas.sefer.simdi;

/**
 * Sefer bitene kadar saldır.
 *
 * Sabit sayıda saldırı yetmiyordu: hedeflerin bir kısmı kalkanlı çıkıyor,
 * bir kısmı kaybediliyor ve "6 zafer" seferi 3'te kalıyordu. Sayıya değil
 * SONUCA bakmak gerekiyor — ölçtüğümüz şey zaten seferin sayacı.
 */
async function seferiSaldiriylaBitir(enFazla = 20) {
  for (let i = 0; i < enFazla; i++) {
    if ((await get('/sefer')).sefer.tamam) return;

    // Oyunun kendi önerisini kullanıyoruz: "şu kadar asker eğit, şurayı
    // alırsın". Sabit bir ordu göndermek savaşların çoğunu kaybettiriyordu
    // ve "6 zafer" seferi 4'te takılıyordu. Öneri motoru zaten kazanacak
    // orduyu hesaplıyor — testin ikinci bir sezgisel kural yazmasına gerek
    // yok.
    const oneri = (await get('/map')).oneri;
    if (!oneri) return;
    if (oneri.eksik?.adet > 0) {
      await post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
      await post('/test/kuyruklari-bitir');
    }
    const ordu = (await get('/army')).home;
    if (Object.keys(ordu).length === 0) return;
    await post('/march', { toRegionId: oneri.regionId, army: ordu });
    await post('/test/yuruyusleri-bitir');
    await post('/test/yuruyusleri-bitir');
    // Alınan bölgeler haritayı daraltıyor; sıfırlayıp taze hedef açıyoruz.
    if (i % 4 === 3) await post('/test/bolgeleri-sifirla');
  }
}

if (olcut === 'saldiri' || olcut === 'kazanilan_savas' || olcut === 'fetih') {
  await seferiSaldiriylaBitir();
} else if (olcut === 'egitilen_asker') {
  await post('/army/train', { unitType: 'milis', count: gereken });
  await post('/test/kuyruklari-bitir');
} else if (olcut === 'imar') {
  for (let i = 0; i < gereken; i++) {
    await post('/items/craft', { tier: 1, slot: 'silah' });
    await post('/test/kuyruklari-bitir');
  }
} else if (olcut === 'kesif') {
  // Keşif sahipsiz bölgeye yapılamıyor; oyuncu bölgesi lazım.
  // Bu senaryoda ikinci bir lord kurmak yerine seferin sayacı
  // doğrulanamıyorsa test bunu açıkça söylüyor.
  const harita = await get('/map');
  const oyuncuBolgesi = harita.regions.find((x) => x.owner && !x.isMine);
  if (oyuncuBolgesi) {
    for (let i = 0; i < gereken; i++) {
      await post(`/map/${oyuncuBolgesi.id}/kesif`);
      await post('/test/kuyruklari-bitir');
    }
  }
}

const sonra = await get('/sefer');
kontrol(
  'Sefer ilerlemesi mevcut kayıtlardan türüyor',
  sonra.sefer.simdi > bas.sefer.simdi || sonra.sefer.tamam,
  `${bas.sefer.simdi} -> ${sonra.sefer.simdi} (${olcut})`,
);

kontrol(
  'Sefer tamamlanabiliyor',
  sonra.odul.hakEdildi === true,
  `${sonra.sefer.simdi}/${sonra.sefer.hedef} ${sonra.sefer.birim} (${sonra.sefer.ad})`,
);

if (sonra.odul.hakEdildi) {
  const oncekiKaynak = (await get('/me')).lord.resources;
  const alindi = await post('/sefer/odul');
  kontrol('Sefer ödülü verildi', say(alindi?.verilen) > 0, `${alindi?.verilen?.altin} altın`);
  kontrol('Kaynaklar arttı', alindi.kaynaklar.altin > oncekiKaynak.altin,
    `${Math.floor(oncekiKaynak.altin)} -> ${Math.floor(alindi.kaynaklar.altin)}`);

  const ikinci = await post('/sefer/odul');
  kontrol('Sefer ödülü İKİNCİ kez alınamıyor', ikinci?.code === 'ODUL_ALINDI', ikinci?.code ?? '-');

  const esZamanli = await Promise.all([post('/sefer/odul'), post('/sefer/odul')]);
  kontrol('Eş zamanlı iki istek de reddediliyor',
    esZamanli.every((x) => x?.code === 'ODUL_ALINDI'),
    esZamanli.map((x) => x?.code ?? 'verildi').join(', '));

  kontrol('Ödül "alındı" olarak işaretlendi', (await get('/sefer')).odul.alindi === true);
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
