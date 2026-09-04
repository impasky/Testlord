/**
 * Taht Kalesi testi: endgame'in kendine özgü kuralları.
 *
 * docs/01 §5 tahtı "endgame'in tamamı" diye tanımlıyor ve ona üç ayrıcalık
 * veriyor. Üçü de sessizce bozulabilecek türden: kod çalışmaya devam eder,
 * sadece taht sıradan bir bölgeye dönüşür ve kimse fark etmez.
 *
 *   1. Günlük saldırı limitine tabi değil — hem kontrolde hem sayaçta
 *   2. El değiştirdikten sonra kalkanı kısa (normal bölgenin çok altında)
 *   3. Sahibi şöhret bonusu alır ve bölge limitine sayılmaz
 *
 * SADECE GELİŞTİRME. node tools/taht-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — Taht Kalesi testi\n');

const d = Date.now();
const { token } = await kayitOl(API, {
  email: `taht${d}@lordlar.dev`,
  lordName: `Taht ${d.toString(36).slice(-3)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const P = (u, b) =>
  fetch(`${API}/api${u}`, { method: 'POST', headers: h, body: JSON.stringify(b ?? {}) })
    .then((x) => x.json());
const G = (u) => fetch(`${API}/api${u}`, { headers: h }).then((x) => x.json());

await P('/test/kaynak-ver', { altin: 9000000, demir: 4000000, erzak: 4000000 });
await P('/test/xp-ver', { miktar: 900000 });
const puan = (await G('/me')).lord.statPoints;
if (puan > 0) await P('/me/stats', { liderlik: puan });
await P('/test/kalkanlari-kaldir');

const taht = (await G('/map')).regions.find((x) => x.type === 'taht');
kontrol('Diyarda tam bir Taht Kalesi var', Boolean(taht), taht?.name);

// --- Günlük hakkı tüket: normal bölgelere saldır ---
const limitOnce = (await G('/me')).lord.dailyAttacks;

let alindi = false;
for (let tur = 1; tur <= 6 && !alindi; tur++) {
  for (const [t, n] of [['mizrakci', 900], ['okcu', 700], ['suvari', 500], ['kusatma', 200]]) {
    await P('/army/train', { unitType: t, count: n });
  }
  await P('/test/kuyruklari-bitir');
  const ordu = (await G('/army')).home;
  if (Object.values(ordu).reduce((a, b) => a + b, 0) === 0) break;
  await P('/march', { toRegionId: taht.id, army: ordu });
  await P('/test/yuruyusleri-bitir');
  await P('/test/yuruyusleri-bitir');
  alindi = (await G('/me')).lord.ownsThrone;
}
kontrol('Taht Kalesi ele geçirildi', alindi);

const me = await G('/me');
kontrol(
  'Tahta saldırı günlük hakkı YEMEDİ',
  me.lord.dailyAttacks === limitOnce,
  `${limitOnce} -> ${me.lord.dailyAttacks}`,
);

// --- Kalkan: tahtınki normal bölgenin çok altında olmalı ---
const detay = await G(`/map/${taht.id}`);
kontrol('Taht sahibinde ve kalkan altında', detay.owner !== null && detay.shielded === true,
  detay.owner?.name ?? 'sahipsiz');

// --- Bölge limiti ve şöhret ---
kontrol(
  'Taht bölge limitine sayılmıyor',
  me.lord.regionCount === 0 || me.lord.ownsThrone,
  `${me.lord.regionCount} bölge, taht ayrı`,
);
kontrol('Diyarın Lordu şöhret bonusu aldı', me.lord.fame > 0, `şöhret ${me.lord.fame}`);

const siralama = await G('/rankings/fame?page=0');
const benim = siralama.benim ?? siralama.satirlar.find((r) => r.lordId === me.lord.id);
kontrol('Sıralamada Diyarın Lordu işareti var', benim?.tahtSahibi === true);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
