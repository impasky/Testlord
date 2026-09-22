/**
 * Üretim modu testi: tek servisli dağıtımın telefonda çalıştığını doğrular.
 *
 * Bu test API adresi hatasını yakaladı: üretimde arayüz API'yi ayrı bir
 * portta arıyordu, oysa tek serviste aynı origin'de.
 *
 * CI'da her itişte koşuyor (denetim.yml → `uretim` işi, boş veritabanında).
 * Önceden yalnız elle koşuyordu ve etrafındaki değişikliklerle üç yerden
 * sessizce eskimişti; kimse koşturmadığı için kimse görmemişti. Yerelde
 * aynısı:
 *
 *   pnpm build
 *   DATABASE_URL=... JWT_SECRET=... NODE_ENV=production PORT=3200 \
 *     AUTO_MIGRATE=true SERVE_WEB=true RUN_WORKER=true SEED_DEMO_LORDS=true \
 *     node apps/api/dist/index.js
 *   node tools/uretim-testi.mjs
 */
import { ekrana, kapiyiKapat, rehberiSustur } from './lib/gezin.mjs';
import { devices } from 'playwright';
import { tarayiciAc } from './lib/tarayici.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
const URL = process.env.URETIM_URL ?? 'http://localhost:3200';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const SP = process.env.SMOKE_OUT ?? 'ekran-goruntuleri';
let hata = 0;
const k = (a, c, d = '') => {
  console.log(`  ${c ? '[GEÇTİ]' : '[KALDI]'} ${a}${d ? ` — ${d}` : ''}`);
  if (!c) hata++;
};

const b = await tarayiciAc();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const hatalar = [];
page.on('console', (m) => {
  if (m.type() === 'error') hatalar.push(m.text());
});
page.on('requestfailed', (r) => hatalar.push('düştü: ' + r.url()));

console.log(`Üretim modu — telefon boyutunda, tek adres (${URL})\n`);
// Bu test, dev sunucusunu değil ÜRETİM derlemesini ölçüyor; ayakta değilse
// Playwright'ın yığın izi yerine ne yapılacağını söyleyelim (yukarıdaki
// başlıkta komutlar var). Kırık test ile koşmayan test aynı şey değil.
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
} catch {
  console.log(`  Üretim sunucusu ${URL} adresinde ayakta değil.`);
  console.log('  Bu dosyanın başındaki komutlarla başlat, sonra tekrar koştur.');
  await b.close();
  process.exit(2);
}
k('Sayfa açıldı', (await page.title()) === 'Lordlar Çağı');
await page.screenshot({ path: `${SP}/tel-1-giris.png`, fullPage: true });

const d = Date.now();
const lordAdi = `Gezgin ${d.toString(36).slice(-4)}`;
await page.fill('input[placeholder="Kara Yusuf"]', lordAdi);
await page.fill('input[type=email]', `tel${d}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
let girdi = true;
try {
  await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 15000 });
} catch {
  girdi = false;
  console.log('   sayfa:', (await page.locator('body').innerText()).slice(0, 200));
}
k('Telefondan kayıt olup oyuna girildi', girdi);
// Öğretici tam ekran açılıyor: gerçek oyuncu gibi geçiyoruz.
await ogreticiyiGec(page);
// Adres AÇIKÇA veriliyor: yardımcının varsayılanı geliştirme API'si
// (:3000). Üretim sunucusunun jetonu orada geçersiz, 401 dönüyordu —
// test oyuna girdikten hemen sonra, oyunla ilgisiz bir yerde düşüyordu.
await rehberiSustur(page, URL);
if (!girdi) {
  for (const h of hatalar.slice(0, 4)) console.log('    -', h);
  await b.close();
  process.exit(1);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SP}/tel-2-malikane.png`, fullPage: true });

const tasma = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
k(
  'Yatay taşma yok',
  !tasma,
  await page.evaluate(
    () => `${document.documentElement.scrollWidth}px içerik / ${window.innerWidth}px ekran`,
  ),
);

// Alt gezinme sekmeleri
for (const [s, f] of [
  ['Ordu', 'tel-3-kisla.png'],
  ['Dünya', 'tel-4-harita.png'],
]) {
  await page.locator(`nav button:has-text("${s}")`).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SP}/${f}`, fullPage: true });
}
// Sıralama menü sayfasında
// Sıralama artık Lord sekmesinin içinde bir KAPI (panel).
await ekrana(page, 'siralama', 1600);
await page.screenshot({ path: `${SP}/tel-5-siralama.png`, fullPage: true });
// Sıralama artık tablo değil kart listesi (mobil düzen)
const satir = await page.locator('text=/Sv \\d+ · \\d+ bölge/').count();
k('Sıralamada rakip lordlar var', satir >= 5, `${satir} lord`);

// Sıralama paneli açıkken alt çubuk panelin ALTINDA kalıyor — tasarım
// gereği (KapiPaneli.tsx, "Katman sırası"). Oyuncu gibi önce kapatıyoruz;
// kapatmayan hâl, panel mimarisinden önce yazılmıştı ve tıklama 30 sn
// bekleyip düşüyordu.
await kapiyiKapat(page);
await page.locator('nav button:has-text("Dünya")').click();
await page.waitForTimeout(1500);
// Düşman bölgesi bölgenin erişilebilir adından okunuyor ("…, sahibi X,
// …"; DunyaHaritasi.tsx). Eski `svg path[fill="url(#dusman)"]` seçicisi
// hex haritasından kalmaydı; resimli haritada o desen yok ve kontrol
// rakip lordlar varken bile 0 sayıyordu.
await page.waitForSelector('[data-bolge]', { timeout: 15000 });
const dusman = await page.locator('[data-bolge]').evaluateAll(
  (ogeler, ben) =>
    ogeler.filter((o) => {
      const m = /sahibi ([^,]+)/.exec(o.getAttribute('aria-label') ?? '');
      return m && m[1] !== ben;
    }).length,
  lordAdi,
);
k('Haritada düşman bölgesi var', dusman > 0, `${dusman} bölge`);

k('Konsolda hata yok', hatalar.length === 0, hatalar[0] ?? '');
await b.close();
console.log(
  hata === 0 ? '\nSONUÇ: telefondan üretim modunda oynanabiliyor.' : `\nSONUÇ: ${hata} sorun.`,
);
process.exit(hata === 0 ? 0 : 1);
