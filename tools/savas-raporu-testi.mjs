/**
 * Savaş raporu modalını uçtan uca dolaşır.
 *
 * Rapor iki yerden açılır (docs/01 §9): Malikâne'nin olay akışından ve
 * Harita'nın bölge alt sayfasından. İkisi de ayrı ayrı denenir — biri
 * çalışırken diğerinin kopması sessiz kalırdı.
 *
 * API ve arayüz ayakta olmalı. node tools/savas-raporu-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
const CIKTI = process.env.SMOKE_OUT ?? '.';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — savaş raporu testi (iPhone 13)\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();

const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});
page.on('pageerror', (e) => konsol.push(String(e)));

await page.goto(WEB, { waitUntil: 'networkidle' });
const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Rapor ${damga.toString(36).slice(-4)}`);
await page.fill('input[type=email]', `rapor${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 15000 });
// Öğretici tam ekran açılıyor ve arkasını tıklatmıyor: gerçek oyuncu
// gibi geçiyoruz (bkz. tools/lib/ogretici.mjs).
await ogreticiyiGec(page);

const token = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) });

await post('/test/bolgeleri-sifirla');
await post('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
await post('/test/xp-ver', { miktar: 80000 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Kışla")', { timeout: 15000 });

// --- Ordu kur ---
await page.locator('nav button:has-text("Kışla")').click();
await page.waitForSelector('text=Asker Eğitimi', { timeout: 8000 });
for (const birim of ['Mızrakçı', 'Okçu', 'Süvari']) {
  await page.locator(`button:has-text("${birim} eğit")`).first().click();
  await page.waitForTimeout(700);
}
await post('/test/kuyruklari-bitir');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Harita")', { timeout: 15000 });

// --- Saldır ---
await page.locator('nav button:has-text("Harita")').click();
await page.waitForSelector('svg[aria-label*="Dünya haritası"]', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.locator('g:has(title:text-matches("— tarla,"))').first().click();
// DOM metni "Saldırı Ordusu"; ekranda büyük harf görünmesi .baslik'ten geliyor.
await page.waitForSelector('text=Saldırı Ordusu', { timeout: 8000 });
await page.locator('button:has-text("Hepsi")').first().click();
await page.waitForTimeout(500);
await page.locator('button:has-text("Saldır")').first().click();
await page.waitForTimeout(1500);
await post('/test/yuruyusleri-bitir');
kontrol('Saldırı yapıldı ve yürüyüş çözüldü', true);

// --- 1. giriş: Malikâne olay akışı ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 15000 });
await page.locator('nav button:has-text("Malikâne")').click();
await page.waitForTimeout(1500);

const bag = page.locator('button[aria-label="Savaş raporunu aç"]');
kontrol('Olay akışında rapor bağı var', (await bag.count()) > 0, `${await bag.count()} bağ`);
await bag.first().click();
await page.waitForSelector('text=Tur Tur Güç', { timeout: 8000 });
await page.waitForTimeout(600);

const turSayisi = await page.locator('text=/^TUR \\d+$/i').count();
kontrol('Tur çubukları çizildi', turSayisi > 0, `${turSayisi} tur`);
kontrol(
  'Sonuç rozeti var',
  (await page.locator('text=ZAFER').count()) + (await page.locator('text=YENİLGİ').count()) > 0,
);
kontrol('Saldıran ve savunan dökümü var', (await page.locator('text=KALAN').count()) >= 2);
await page.screenshot({ path: `${CIKTI}/rapor-malikane.png` });

// --- 2. giriş: Harita bölge alt sayfası ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Harita")', { timeout: 15000 });
await page.locator('nav button:has-text("Harita")').click();
await page.waitForSelector('svg[aria-label*="Dünya haritası"]', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.locator('g:has(title:text-matches("— tarla,"))').first().click();
await page.waitForSelector('text=Bu Bölgedeki Savaşların', { timeout: 8000 });
kontrol('Bölge alt sayfasında savaş listesi var', true);

await page.locator('text=Bu Bölgedeki Savaşların').locator('..').locator('button').first().click();
await page.waitForSelector('text=Tur Tur Güç', { timeout: 8000 });
await page.waitForTimeout(600);
kontrol('Haritadan da rapor açılıyor', true);
await page.screenshot({ path: `${CIKTI}/rapor-harita.png` });

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));

await browser.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
