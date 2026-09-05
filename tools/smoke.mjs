/**
 * Uçtan uca duman testi: gerçek tarayıcıda kayıt -> Malikâne -> Lord akışı.
 *
 * Önce API (pnpm --filter @lordlar/api dev) ve arayüz (pnpm --filter @lordlar/web dev)
 * ayakta olmalı. Sonra: node tools/smoke.mjs
 *
 * Çıkış kodu 0 = akış çalışıyor ve konsolda hata yok.
 */
import { rehberiSustur } from './lib/gezin.mjs';
import { chromium } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const CIKTI = process.env.SMOKE_OUT ?? 'ekran-goruntuleri';
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await rehberiSustur(page);

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
  // Öğretici tam ekran açılıyor: gerçek oyuncu gibi geçiyoruz.
  await ogreticiyiGec(page);
} catch {
  kontrol('Kayıt olup Malikâne ekranına girildi', false);
  console.log('  Sayfa:', (await page.locator('body').innerText()).slice(0, 300));
  await page.screenshot({ path: `${CIKTI}/hata.png` });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: `${CIKTI}/02-malikane.png` });

/**
 * Kaynak sütunu artık "Altın" yazısını değil ikonu gösteriyor; sayı ve
 * saatlik gelir `title` içinde ("Altın: 5000 (+128/sa)"). Bu test eskiden
 * görünür metni okuyordu ve arayüz değişince sessizce kaldı — çünkü zincire
 * bağlı değildi. Şimdi hem kontrol düzeltildi hem test `pnpm e2e` içine
 * alındı.
 */
const altin = await page.locator('[title^="Altın:"]').first().getAttribute('title');
kontrol('Kaynak çubuğu saatlik geliri gösteriyor', /\+\d+\/sa/.test(altin ?? ''), altin ?? 'yok');

// Lord alt çubuktan menüye taşındı (sayfa ayrımı): Menü -> Lord.
await page.locator('nav button:has-text("Menü")').click();
await page.waitForTimeout(400);
await page.locator('button:has-text("Lord")').last().click();
await page.waitForSelector('text=Nitelikler', { timeout: 8000 });
await page.screenshot({ path: `${CIKTI}/03-lord.png` });
kontrol('Lord ekranı açıldı', await page.locator('text=Liderlik').first().isVisible());

kontrol('Konsolda hata yok', hatalar.length === 0);
if (hatalar.length) for (const h of hatalar) console.log('    -', h);

await browser.close();
console.log(process.exitCode ? '\nSONUÇ: duman testi başarısız.' : '\nSONUÇ: akış çalışıyor.');
