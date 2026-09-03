/**
 * Kalkan testi: yağma akınından sonra bölgeye kalkan konuyor mu (docs/09 K6)?
 *
 * Kapatılan boşluk şu: aynı saldırgan aynı bölgeye 12 saat tekrar
 * gelemiyordu ama FARKLI saldırganlar sınırsız zincirleyebiliyordu, fetih
 * kalkanı da yalnız bölge el değiştirince kuruluyordu. Arada kalan hâl —
 * garnizonu kırılan ama bölgesi elinde kalan oyuncu — korumasızdı ve sabaha
 * ordusu silinmiş halde kalkıyordu.
 *
 * Testin çekirdeği son kontrol: İKİNCİ, BAŞKA bir saldırgan zinciri
 * sürdürebiliyor mu? Sürdürememeli. Diğer kontroller o kontrolün doğru
 * durumdan başladığını gösteriyor (saldıran kazandı, bölge el değiştirmedi).
 *
 * "Kazanan ama ele geçirmeyen" ordu aranarak bulunuyor: dar zafer
 * sabit bir orandan doğmuyor, tahkimata ve garnizona bağlı. Önizleme
 * ikisini de söylüyor, o yüzden arama ucuz.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/kalkan-testi.mjs
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
      email: `kalkan${damga}_${etiket}@lordlar.dev`,
      password: 'parola1234',
      lordName: `Klk${damga.toString(36).slice(-3)}${etiket}`,
    }),
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

async function orduKur(l, ordu) {
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
  await l.post('/test/xp-ver', { miktar: 200000 });
  const puan = (await l.get('/me')).lord.statPoints;
  if (puan > 0) await l.post('/me/stats', { liderlik: puan });
  for (const [tip, adet] of Object.entries(ordu)) {
    await l.post('/army/train', { unitType: tip, count: adet });
  }
  await l.post('/test/kuyruklari-bitir');
}

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
    // İkinci kez: fetihten sağ çıkanlar dönüş yürüyüşünde.
    await l.post('/test/yuruyusleri-bitir');
    if ((await l.get('/me')).lord.regionCount > 0) return aday;
  }
  return null;
}

console.log('Lordlar Çağı — kalkan testi\n');

const savunan = await lordKur('def');
const birinci = await lordKur('a1');
const ikinci = await lordKur('a2');

const [hd, hs] = [await savunan.get('/map'), await birinci.get('/map')];
kontrol(
  'Lordlar aynı dünyada',
  hd.regions[0]?.id === hs.regions[0]?.id,
  'farklıysa dünya sınırına denk gelinmiştir, testi tekrar çalıştır',
);

await orduKur(savunan, { mizrakci: 400, okcu: 250 });
const bolge = await bolgeAl(savunan);
kontrol('Savunan bir bölge ele geçirdi', Boolean(bolge), bolge?.name ?? 'bölge alınamadı');

const savunanOrdu = (await savunan.get('/army')).home;
await savunan.post(`/map/${bolge.id}/garrison`, { army: savunanOrdu });
const garnizon = (await savunan.get(`/map/${bolge.id}`)).garrison;
const garnizonAdedi = Object.values(garnizon ?? {}).reduce((t, n) => t + Number(n || 0), 0);
kontrol('Savunan garnizon kurdu', garnizonAdedi > 0, `${garnizonAdedi} birim`);

await orduKur(birinci, { mizrakci: 900, okcu: 600, suvari: 300 });
await orduKur(ikinci, { mizrakci: 900, okcu: 600, suvari: 300 });

// DİKKAT: /test/kalkanlari-kaldir DÜNYADAKİ TÜM bölge kalkanlarını siler.
// İkisi de savaştan ÖNCE çağrılıyor; sonra çağrılsa testin ölçtüğü kalkanı
// silip testi sessizce yanlış sonuca götürürdü.
await birinci.post('/test/kalkanlari-kaldir');
await ikinci.post('/test/kalkanlari-kaldir');

// Kazanan ama ELE GEÇİRMEYEN ordu: önizleme ikisini de söylüyor.
const tamOrdu = (await birinci.get('/army')).home;
let akin = null;
for (const oran of [0.16, 0.2, 0.25, 0.3, 0.36, 0.42, 0.5, 0.6, 0.7]) {
  const ordu = Object.fromEntries(
    Object.entries(tamOrdu).map(([t, n]) => [t, Math.max(1, Math.floor(n * oran))]),
  );
  const t = (await birinci.post('/battle/preview', { toRegionId: bolge.id, army: ordu }))?.tahmin;
  if (t?.kazanan === 'attacker' && t?.eleGecirir === false) {
    akin = { ordu, oran };
    break;
  }
}
kontrol(
  'Dar zafer (kazanır, ele geçirmez) ordusu bulundu',
  Boolean(akin),
  akin ? `ordunun %${Math.round(akin.oran * 100)}'i` : 'bulunamadı — önizleme bandı kaymış olabilir',
);
if (!akin) {
  console.log('\n1 KONTROL BAŞARISIZ');
  process.exit(1);
}

kontrol(
  'Savaş öncesi bölge kalkansız',
  (await birinci.get(`/map/${bolge.id}`)).shielded === false,
  'başlangıç durumu',
);

await birinci.post('/march', { toRegionId: bolge.id, army: akin.ordu });
await birinci.post('/test/yuruyusleri-bitir');

const savas = (await birinci.get('/battles')).find((b) => b.regionId === bolge.id);
kontrol('Saldıran kazandı', savas?.result === 'attacker_win', savas?.result ?? 'savaş yok');
kontrol('Bölge EL DEĞİŞTİRMEDİ', savas?.captured === false, `captured=${savas?.captured}`);

const detay = await birinci.get(`/map/${bolge.id}`);
kontrol('Yağma sonrası kalkan konuldu', detay?.shielded === true, `shielded=${detay?.shielded}`);
kontrol('Bölge hâlâ savunanın', Boolean(detay?.owner), detay?.owner?.name ?? 'sahipsiz');

// Testin çekirdeği: zincir kesiliyor mu?
const ikinciOrdu = (await ikinci.get('/army')).home;
const deneme = await ikinci.post('/march', { toRegionId: bolge.id, army: ikinciOrdu });
kontrol(
  'FARKLI saldırganın zinciri kesildi',
  deneme?.code === 'BOLGE_KORUMALI',
  deneme?.code ?? `yürüyüş kabul edildi (${deneme?.marchId ?? '?'})`,
);

// Koruma görünmezse rahatlatmıyor: savunan kalkanı mesajından öğrenmeli.
const olay = (await savunan.get('/me')).events.find((e) => e.payload?.battleId === savas.id);
kontrol(
  'Savunanın mesajı kalkanı söylüyor',
  /koruma altında/.test(olay?.payload?.mesaj ?? ''),
  olay?.payload?.mesaj ?? 'battleId taşıyan olay yok',
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
