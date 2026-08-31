/**
 * Uçtan uca duman testi: gerçek tarayıcıda kayıt -> Malikâne -> Lord akışı.
 *
 * Önce API (pnpm --filter @lordlar/api dev) ve arayüz (pnpm --filter @lordlar/web dev)
 * ayakta olmalı. Sonra: node tools/smoke.mjs
 *
 * Çıkış kodu 0 = akış çalışıyor ve konsolda hata yok.
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CIKTI = process.env.SMOKE_OUT ?? '.';
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const hatalar = [];
page.on('console', (m) => {
  if (m.type() === 'error') hatalar.push(m.text());
});
page.on('pageerror', (e) => hatalar.push(String(e)));
page.on('requestfailed', (r) => hatalar.push(`istek düştü: ${r.url()}`));
page.on('response', (r) => {
  if (r.status() === 404) hatalar.push(`404: ${r.url()}`);
});

function kontrol(ad, kosul) {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}`);
  if (!kosul) process.exitCode = 1;
}

console.log('Lordlar Çağı — uçtan uca duman testi\n');

await page.goto(WEB, { waitUntil: 'networkidle' });
kontrol('Sayfa açıldı', (await page.title()) === 'Lordlar Çağı');
await page.screenshot({ path: `${CIKTI}/01-giris.png` });

const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Lord ${damga}`);
await page.fill('input[type=email]', `duman${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');

try {
  await page.waitForSelector('text=Malikâne', { timeout: 15000 });
  kontrol('Kayıt olup Malikâne ekranına girildi', true);
} catch {
  kontrol('Kayıt olup Malikâne ekranına girildi', false);
  console.log('  Sayfa:', (await page.locator('body').innerText()).slice(0, 300));
  await page.screenshot({ path: `${CIKTI}/hata.png` });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: `${CIKTI}/02-malikane.png` });

const altin = await page.locator('text=Altın').first().locator('..').innerText();
kontrol('Kaynak çubuğu saatlik geliri gösteriyor', /\+\d+\/sa/.test(altin));

await page.click('button:has-text("Lord")');
await page.waitForSelector('text=Statlar', { timeout: 8000 });
await page.screenshot({ path: `${CIKTI}/03-lord.png` });
kontrol('Lord ekranı açıldı', await page.locator('text=Liderlik').first().isVisible());

kontrol('Konsolda hata yok', hatalar.length === 0);
if (hatalar.length) for (const h of hatalar) console.log('    -', h);

await browser.close();
console.log(process.exitCode ? '\nSONUÇ: duman testi başarısız.' : '\nSONUÇ: akış çalışıyor.');
