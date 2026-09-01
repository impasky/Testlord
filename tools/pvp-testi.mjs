/**
 * PvP testi: bir oyuncunun BAŞKA BİR OYUNCUNUN bölgesine saldırması.
 *
 * docs/00'ın üçüncü başarı kriteri: "Başka bir oyuncuya saldırıp savaş logunu
 * okuyabiliyor." Diğer testler NPC garnizonuna saldırıyor; PvP yolu farklı
 * kod geçiyor — savunanın kaydı, ELO, kalkan, savunan tarafın olay akışı.
 *
 * İki lord kurar: savunan bir NPC bölgesi alır, saldıran onu ondan alır.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/pvp-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `pvp${damga}_${etiket}@lordlar.dev`,
      password: 'parola1234',
      lordName: `Pvp${damga.toString(36).slice(-3)}${etiket}`,
    }),
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    etiket,
    h,
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

/** Komuta kapasitesini açıp kapasiteyi dolduran bir ordu kurar. */
async function orduKur(l, ordu) {
  await l.post('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
  await l.post('/test/xp-ver', { miktar: 120000 });
  const puan = (await l.get('/me')).lord.statPoints;
  if (puan > 0) await l.post('/me/stats', { liderlik: puan });
  for (const [tip, adet] of Object.entries(ordu)) {
    await l.post('/army/train', { unitType: tip, count: adet });
  }
  await l.post('/test/kuyruklari-bitir');
}

/** Önizleyerek alınabilir bir NPC bölgesi bulur ve ele geçirir. */
async function bolgeAl(l) {
  const harita = await l.get('/map');
  const adaylar = harita.regions
    .filter((r) => r.ring === 4 && !r.owner && r.type !== 'taht')
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);
  for (const aday of adaylar) {
    const ordu = (await l.get('/army')).home;
    const o = await l.post('/battle/preview', { toRegionId: aday.id, army: ordu });
    if (o?.tahmin?.eleGecirir !== true) continue;
    await l.post('/march', { toRegionId: aday.id, army: ordu });
    await l.post('/test/yuruyusleri-bitir');
    // İkinci kez: fetihten sağ çıkanlar dönüş yürüyüşünde. Bu çözülmeden
    // evdeki ordu boş görünür ve garnizon kurulamaz.
    await l.post('/test/yuruyusleri-bitir');
    const me = await l.get('/me');
    if (me.lord.regionCount > 0) return aday;
  }
  return null;
}

console.log('Lordlar Çağı — PvP testi\n');

const savunan = await lordKur('def');
const saldiran = await lordKur('atk');

// Aynı dünyada olmaları şart: dünya dolmak üzereyken ikisi ayrı shard'a
// düşebilir ve o zaman birbirlerini haritada göremezler.
const [hd, hs] = [await savunan.get('/map'), await saldiran.get('/map')];
kontrol(
  'İki lord da aynı dünyada',
  hd.regions[0]?.id === hs.regions[0]?.id,
  'farklıysa dünya sınırına denk gelinmiştir, testi tekrar çalıştır',
);

await orduKur(savunan, { mizrakci: 300, okcu: 200 });
const bolge = await bolgeAl(savunan);
kontrol('Savunan bir bölge ele geçirdi', Boolean(bolge), bolge?.name ?? 'bölge alınamadı');

// Savunan bölgeye garnizon koyar: boş bölgeyi almak PvP'yi sınamaz.
const savunanOrdu = (await savunan.get('/army')).home;
await savunan.post(`/map/${bolge.id}/garrison`, { army: savunanOrdu });
const garnizon = (await savunan.get(`/map/${bolge.id}`)).garrison;
const garnizonAdedi = Object.values(garnizon ?? {}).reduce((t, n) => t + Number(n || 0), 0);
kontrol('Savunan bölgeye garnizon yerleştirdi', garnizonAdedi > 0, `${garnizonAdedi} birim`);

await orduKur(saldiran, { mizrakci: 500, okcu: 350, suvari: 200 });
// Yeni lord kalkanı saldırıyı engeller; test için kaldırılır.
await saldiran.post('/test/kalkanlari-kaldir');

// Saldıran bir general kiralayıp sahaya sürer: generalin savaşa GERÇEKTEN
// girdiğini XP kazanmasından anlayacağız. Sadece kiralamayı denemek,
// generalin savaş hesabına katıldığını göstermez.
const kadro = (await saldiran.get('/generals')).kadro;
const general = kadro.filter((g) => !g.sahipMi).sort((a, b) => a.maliyet_altin - b.maliyet_altin)[0];
await saldiran.post(`/generals/${general.key}/hire`);
await saldiran.post(`/generals/${general.key}/assign`, { slotIndex: 0 });
const generalOnce = (await saldiran.get('/generals')).kadro.find((g) => g.key === general.key);
kontrol('General kiralandı ve sahaya sürüldü', generalOnce?.slotIndex === 0, general.ad);

const eloOnce = (await saldiran.get('/me')).lord.elo;
const ordu = (await saldiran.get('/army')).home;
const onizleme = await saldiran.post('/battle/preview', {
  toRegionId: bolge.id, army: ordu, generalIds: [general.key],
});
kontrol(
  'Oyuncu bölgesi için önizleme alınabiliyor',
  onizleme?.tahmin?.kazanan !== undefined,
  `kazanan ${onizleme?.tahmin?.kazanan}`,
);

await saldiran.post('/march', {
  toRegionId: bolge.id, army: ordu, generalIds: [general.key],
});
await saldiran.post('/test/yuruyusleri-bitir');

// --- Savaş kaydı ---
const savaslar = await saldiran.get('/battles');
const savas = savaslar.find((b) => b.regionId === bolge.id);
kontrol('Savaş kaydı oluştu', Boolean(savas), savas?.result ?? 'kayıt yok');
kontrol(
  'Savaşın savunanı bir OYUNCU (NPC değil)',
  Boolean(savas?.defenderLordId) && savas.defender?.name?.startsWith('Pvp'),
  savas?.defender?.name ?? 'savunan yok',
);

const rapor = await saldiran.get(`/battles/${savas.id}`);
kontrol(
  'Saldıran savaş logunu okuyabiliyor',
  Array.isArray(rapor?.log?.rounds) && rapor.log.rounds.length > 0,
  `${rapor?.log?.rounds?.length} tur`,
);

// --- Savunan tarafı ---
const savunanSavaslar = await savunan.get('/battles');
kontrol(
  'Savunan da aynı savaşı görebiliyor',
  savunanSavaslar.some((b) => b.id === savas.id),
  `${savunanSavaslar.length} savaş`,
);
const savunanOlaylar = (await savunan.get('/me')).events;
const olay = savunanOlaylar.find((e) => e.payload?.battleId === savas.id);
kontrol(
  'Savunanın olay akışında rapor bağı var',
  Boolean(olay),
  olay?.kind ?? 'battleId taşıyan olay yok',
);

// --- General savaşa katıldı mı ---
const generalSonra = (await saldiran.get('/generals')).kadro.find((g) => g.key === general.key);
kontrol('General savaşa girdi ve XP kazandı',
  generalSonra.xp > generalOnce.xp || generalSonra.level > generalOnce.level,
  `xp ${generalOnce.xp} -> ${generalSonra.xp}`);

// --- ELO ---
const eloSonra = (await saldiran.get('/me')).lord.elo;
kontrol('PvP savaşı ELO değiştirdi', eloSonra !== eloOnce, `${eloOnce} -> ${eloSonra}`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
