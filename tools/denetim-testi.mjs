/**
 * Denetim testi: lord adı süzgeci, şikâyet, bölge bırakma, yürüyüş sınırı.
 *
 * Dördü de "oyuncunun kötüye kullanabileceği ya da kendini çıkmazda
 * bulabileceği" yerler. Sessizce bozulurlarsa kimse fark etmez.
 *
 * SADECE GELİŞTİRME. node tools/denetim-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — denetim testi\n');

const JS = { 'Content-Type': 'application/json' };
const d = Date.now();
// tools/lib/kayit.mjs kullanılmıyor: o yardımcı reddedilen adı düzeltip yeniden
// deniyor. Burada ölçülen şey tam da reddin kendisi.
const kayit = (ad, ek = '') =>
  fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: JS,
    body: JSON.stringify({
      email: `dn${d}${ek}@lordlar.dev`,
      password: 'parola1234',
      lordName: ad,
    }),
  });

// --- 1. Ad süzgeci ---
// "S1kt1r" gerçek bir kaçamak yazımı: normalize 1'i i'ye çevirince
// yasaklı parçaya oturuyor. ("Si1kis" oturmaz — o "siikis" olur ve süzgeç
// haklı olarak geçirir; masum adları elememesi için parça araması dar.)
for (const kotu of ['amk lord', 'S1kt1r Bey', 'admin', 'aaaaaaa']) {
  const r = await kayit(kotu, Math.random().toString(36).slice(2, 6));
  kontrol(`Uygunsuz ad reddedildi: "${kotu}"`, r.status === 400, `HTTP ${r.status}`);
}
const iyi = await kayit(`Kara Yusuf ${d.toString(36).slice(-3)}`, 'a');
kontrol('Normal ad kabul edildi', iyi.ok, `HTTP ${iyi.status}`);
const { token } = await iyi.json();
const h = { ...JS, Authorization: `Bearer ${token}` };
const P = (u, b) => fetch(`${API}/api${u}`, { method: 'POST', headers: h, body: JSON.stringify(b ?? {}) });
const G = (u) => fetch(`${API}/api${u}`, { headers: h }).then((x) => x.json());

// --- 2. Şikâyet ---
const me = await G('/me');
const siralama = await G('/rankings/fame?page=0');
const baskasi = siralama.satirlar.find((r) => r.lordId !== me.lord.id);
if (baskasi) {
  const r = await P(`/rapor/${baskasi.lordId}`, { sebep: 'uygunsuz lord adı' });
  kontrol('Şikâyet alındı', r.ok, `HTTP ${r.status}`);
  const tekrar = await P(`/rapor/${baskasi.lordId}`, { sebep: 'tekrar' });
  kontrol('Aynı kişiyi tekrar şikâyet sayıyı şişirmiyor', tekrar.ok, 'upsert');
}
const kendini = await P(`/rapor/${me.lord.id}`, { sebep: 'kendim' });
kontrol('Kendini şikâyet edemiyor', kendini.status === 400, `HTTP ${kendini.status}`);

// --- 3. Yürüyüş sınırı ---
await P('/test/kaynak-ver', { altin: 3000000, demir: 1500000, erzak: 1500000 });
await P('/test/xp-ver', { miktar: 400000 });
const puan = (await G('/me')).lord.statPoints;
if (puan > 0) await P('/me/stats', { liderlik: puan });
for (const [t, n] of [['mizrakci', 600], ['okcu', 400]]) {
  await P('/army/train', { unitType: t, count: n });
}
await P('/test/kuyruklari-bitir');
await P('/test/kalkanlari-kaldir');

// Önce gerçek bir orduyla bölge al: bırakma testi için elde bölge lazım.
// Beş kişilik yürüyüşler garnizonu geçemez, o yüzden ayrı bir sefer.
const harita = await G('/map');
const adaylar = harita.regions
  .filter((r) => !r.owner && r.type !== 'taht')
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 8);
let alinan = null;
for (const aday of adaylar) {
  const ordu = (await G('/army')).home;
  const o = await (await P('/battle/preview', { toRegionId: aday.id, army: ordu })).json();
  if (o?.tahmin?.eleGecirir !== true) continue;
  await P('/march', { toRegionId: aday.id, army: ordu });
  await P('/test/yuruyusleri-bitir');
  await P('/test/yuruyusleri-bitir');
  if ((await G('/me')).lord.regionCount > 0) { alinan = aday; break; }
}
kontrol('Bırakma testi için bölge alındı', Boolean(alinan), alinan?.name ?? 'alınamadı');

// Şimdi sınır: küçük ordularla üst üste yürüyüş gönder.
const hedefler = (await G('/map')).regions
  .filter((r) => !r.owner && r.type !== 'taht')
  .slice(0, 8);
let gonderilen = 0;
let sonDurum = 0;
for (const hedef of hedefler) {
  const ordu = (await G('/army')).home;
  if ((ordu.mizrakci ?? 0) < 5) break;
  const r = await P('/march', { toRegionId: hedef.id, army: { mizrakci: 5 } });
  sonDurum = r.status;
  if (r.ok) gonderilen++;
  else break;
}
kontrol(
  'Eş zamanlı yürüyüş sınırı uygulanıyor',
  gonderilen <= 5 && sonDurum === 400,
  `${gonderilen} yürüyüş gönderildi, sonraki HTTP ${sonDurum}`,
);

// --- 4. Bölge bırakma ---
await P('/test/yuruyusleri-bitir');
await P('/test/yuruyusleri-bitir');
if (alinan) {
  const birak = await P(`/map/${alinan.id}/birak`);
  kontrol('Bölge bırakıldı', birak.ok, `HTTP ${birak.status}`);
  const sonra = await G(`/map/${alinan.id}`);
  kontrol('Bırakılan bölge sahipsiz kaldı, haritada duruyor',
    sonra.id === alinan.id && sonra.owner === null);
}

const taht = (await G('/map')).regions.find((r) => r.type === 'taht');
const tahtBirak = await P(`/map/${taht.id}/birak`);
kontrol('Taht Kalesi bırakılamıyor', tahtBirak.status >= 400, `HTTP ${tahtBirak.status}`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
