/**
 * İlk Adımlar rehberini uçtan uca dolaşır.
 *
 * Rehber hiçbir yerde durum saklamıyor, dört adımı da oyun durumundan
 * türetiyor. Bu testin asıl işi o türetmenin doğru olduğunu göstermek:
 * adımları gerçekten oynayarak kapatıyoruz ve sayacın ilerlemesini
 * bekliyoruz. Kart dördü de bitince tamamen kaybolmalı.
 *
 * API ve arayüz ayakta olmalı. node tools/onboarding-testi.mjs
 */
import { chromium, devices } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
const CIKTI = process.env.SMOKE_OUT ?? '.';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — İlk Adımlar testi (iPhone 13)\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});
page.on('pageerror', (e) => konsol.push(String(e)));

/** Rehber kartındaki sayacı okur; kart yoksa null döner. */
async function sayac() {
  const kart = page.locator('text=İlk Adımlar');
  if (!(await kart.count())) return null;
  const metin = await kart.locator('..').locator('text=/^\\d\\/4$/').first().innerText();
  return metin.trim();
}

await page.goto(WEB, { waitUntil: 'networkidle' });
const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Adim ${damga.toString(36).slice(-4)}`);
await page.fill('input[type=email]', `adim${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 15000 });
await page.waitForTimeout(1200);

kontrol('Yeni lorda rehber görünüyor', (await sayac()) === '0/4', `sayaç ${await sayac()}`);
await page.screenshot({ path: `${CIKTI}/onboarding-0.png` });

const token = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) });
const get = (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((r) => r.json());

await post('/test/bolgeleri-sifirla');
await post('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
await post('/test/xp-ver', { miktar: 80000 });

// --- 1. adım: asker eğit (arayüzden, oyuncunun yapacağı gibi) ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Kışla")', { timeout: 15000 });
await page.locator('nav button:has-text("Kışla")').click();
await page.waitForSelector('text=Asker Eğitimi', { timeout: 8000 });
for (const birim of ['Mızrakçı', 'Okçu', 'Süvari']) {
  await page.locator(`button:has-text("${birim} eğit")`).first().click();
  await page.waitForTimeout(600);
}
await page.locator('nav button:has-text("Malikâne")').click();
await page.waitForTimeout(1000);
kontrol('Asker eğitince 1. adım kapandı', (await sayac()) === '1/4', `sayaç ${await sayac()}`);
await post('/test/kuyruklari-bitir');

// --- 2. adım: ekipman üret ve kuşan ---
await post('/items/craft', { tier: 1, slot: 'silah' });
await post('/test/kuyruklari-bitir');
const esyalar = await get('/items');
const esya = esyalar.items?.[0];
if (esya) await post(`/items/${esya.id}/equip`);
const kusanan = (await get('/me')).lord.equippedItems.length;
kontrol('Ekipman üretildi ve kuşanıldı', kusanan > 0, `${kusanan} parça kuşanık`);

// --- 3. adım: bölge ele geçir ---
// Arayüzden eğitilen üç birimlik kadro garnizonu aşmıyor; oyuncunun yapacağı
// şeyi yapıyoruz: stat puanlarını liderliğe verip komuta kapasitesini açıyor,
// sonra kapasiteyi dolduran bir ordu kuruyoruz. Hedef de en zayıf garnizon,
// yeni oyuncunun seçeceği bölge.
const puan = (await get('/me')).lord.statPoints;
if (puan > 0) await post('/me/stats', { liderlik: puan });
for (const [tip, adet] of [['mizrakci', 400], ['okcu', 300], ['suvari', 150]]) {
  await post('/army/train', { unitType: tip, count: adet });
}
await post('/test/kuyruklari-bitir');

const harita = await get('/map');
const gucu = (g) => Object.values(g ?? {}).reduce((t, n) => t + Number(n || 0), 0);
const hedef = harita.regions
  .filter((r) => !r.owner && r.type !== 'taht')
  .sort((a, b) => gucu(a.garrison) - gucu(b.garrison) || a.distance - b.distance)[0];
const ordu = (await get('/army')).home;
await post('/march', { toRegionId: hedef.id, army: ordu, generalIds: [] });
await post('/test/yuruyusleri-bitir');
const sonrasi = await get('/me');
kontrol(
  'Bölge ele geçirildi',
  sonrasi.lord.regionCount > 0,
  `${sonrasi.lord.regionCount} bölge · hedef ${hedef.name}`,
);

// --- 4. adım: general kirala ---
const kadro = (await get('/generals')).kadro;
const ucuz = kadro.filter((g) => !g.sahipMi).sort((a, b) => a.maliyet_altin - b.maliyet_altin)[0];
await post(`/generals/${ucuz.key}/hire`);
const sahip = (await get('/generals')).kadro.filter((g) => g.sahipMi).length;
kontrol('General kiralandı', sahip > 0, `${ucuz.ad} · ${sahip} general`);

// --- Dördü bitince kart kaybolmalı ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 15000 });
await page.waitForTimeout(1500);
kontrol('Dört adım bitince rehber kayboldu', (await sayac()) === null, `sayaç ${await sayac()}`);
await page.screenshot({ path: `${CIKTI}/onboarding-bitti.png` });

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));

await browser.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
