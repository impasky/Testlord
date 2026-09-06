/**
 * PWA kabuğunu sınar: "ana ekrana ekle" gerçekten çalışır mı?
 *
 * Denetimde bulunan eksik: mobil-only bir oyunun manifesti yoktu, simgesi
 * satır içi bir SVG'ydi ve telefona eklendiğinde ne adı ne ikonu düzgün
 * geliyordu. Burada yalnız dosyanın varlığına değil, tarayıcının onu
 * GERÇEKTEN okuyup okumadığına bakılıyor — yanlış MIME tipi ya da 404,
 * dosya depoda dururken de sessizce olabiliyor.
 *
 * Arayüz ayakta olmalı. node tools/pwa-testi.mjs
 */
import { chromium, devices } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — PWA kabuğu testi\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
await page.goto(WEB, { waitUntil: 'networkidle' });

const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
kontrol('sayfa bir manifest bildiriyor', Boolean(manifestHref), manifestHref ?? 'yok');

const y = await page.request.get(new URL(manifestHref ?? '/manifest.webmanifest', WEB).href);
kontrol('manifest sunuluyor', y.ok(), `HTTP ${y.status()}`);

const m = y.ok() ? await y.json() : {};
kontrol('adı var ve Türkçe', m.name === 'Lordlar Çağı', m.name ?? '');
kontrol('tam ekran açılıyor', m.display === 'standalone', m.display ?? '');
kontrol('dikey kilitli', m.orientation === 'portrait', m.orientation ?? '');
kontrol('tema rengi arayüzle aynı', m.theme_color === '#17100c', m.theme_color ?? '');
kontrol(
  'en az iki simge boyutu var',
  (m.icons ?? []).length >= 2,
  `${(m.icons ?? []).length} simge`,
);

const maskeli = (m.icons ?? []).some((i) => (i.purpose ?? '').includes('maskable'));
kontrol('maskeli simge var (Android kırpması için)', maskeli);

// Simgelerin kendisi gerçekten sunuluyor mu — manifestte yazması yetmez.
for (const ikon of m.icons ?? []) {
  const r = await page.request.get(new URL(ikon.src, WEB).href);
  kontrol(
    `simge sunuluyor: ${ikon.src}`,
    r.ok() && (r.headers()['content-type'] ?? '').includes('image'),
    `HTTP ${r.status()} ${r.headers()['content-type'] ?? ''}`,
  );
}

const dokunSimge = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
kontrol('iOS için apple-touch-icon var', Boolean(dokunSimge), dokunSimge ?? 'yok');
if (dokunSimge) {
  const r = await page.request.get(new URL(dokunSimge, WEB).href);
  kontrol('apple-touch-icon sunuluyor', r.ok(), `HTTP ${r.status()}`);
}

kontrol(
  'iOS uygulama adı ayrıca bildirilmiş',
  (await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content')) ===
    'Lordlar Çağı',
);

await browser.close();
console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
