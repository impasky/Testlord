/**
 * HARİTA DOKUNMA JESTLERİ — "donuyor" şikâyetinin nöbetçisi.
 *
 * Oyuncu: "haritada sağa sola çekerek kaydırmada çok donuyor, haritayı
 * sığdır dedikten sonra oluyor, telefonda Chrome."
 *
 * Donma yoktu; ÖLÜ JEST vardı. Sığdır görünümü ölçeği 1'e döndürüyor ve
 * orada iki şey birden yatay parmağı yutuyordu: kabın
 * `touch-action: pan-y` değeri (tarayıcı yalnız dikey kaydırır) ve
 * `olcek > 1` kapısı (uygulama da kullanmaz). Sonuç: parmak gidiyor,
 * ekranda hiçbir şey olmuyor — ve hareketsiz bir ekran donmuş bir
 * ekrandan ayırt edilemez.
 *
 * BU TEST FARE İLE YAZILAMAZ. `touch-action` fare girdisine
 * uygulanmıyor; masaüstü ölçümlerinin hepsi "60 kare, sorun yok"
 * diyordu çünkü ölçülen şey hiç olmuyordu. CDP
 * `Input.dispatchTouchEvent` gerçek parmak gönderiyor.
 *
 * Üç şeyi birden koruyor:
 *   1. Yatay parmak haritayı oynatıyor (yakınlaştırarak).
 *   2. Dikey parmak hâlâ SAYFAYI kaydırıyor — haritaya hapsolmuyoruz.
 *   3. Eşiğin altındaki kısa dokunuş kazara yakınlaştırmıyor.
 */
import { tarayiciAc } from './lib/tarayici.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { bolgeKazandir, sehriKur } from './lib/ilerlet.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const ad = benzersizAd('Dk');
const { token } = await kayitOl(API, { email: `${ad}@lordlar.dev`, lordName: ad });
await bolgeKazandir(API, token);
await sehriKur(API, token);
const b = await tarayiciAc();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const s = await ctx.newPage();
const cdp = await ctx.newCDPSession(s);
await s.goto(WEB);
await s.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await s.goto(WEB, { waitUntil: 'networkidle' });
await ogreticiyiGec(s);
await rehberiSustur(s).catch(() => {});
await s.click('nav button:has-text("Dünya")', { force: true });
await s.waitForTimeout(2500);

const durum = () =>
  s.evaluate(() => {
    const t = document.querySelector('[data-harita-tuval]');
    return {
      stil: t?.getAttribute('style') ?? 'YOK',
      touchAction: t?.parentElement ? getComputedStyle(t.parentElement).touchAction : '?',
      sayfaY: window.scrollY,
    };
  });

async function parmakSurukle(dx, dy, etiket) {
  const kutu = await s.locator('[data-harita-tuval]').boundingBox();
  const x0 = kutu.x + kutu.width * 0.75,
    y0 = kutu.y + kutu.height * 0.5;
  const once = await durum();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x0, y: y0 }],
  });
  for (let i = 1; i <= 18; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / 18, y: y0 + (dy * i) / 18 }],
    });
    await s.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.waitForTimeout(500);
  const sonra = await durum();
  const haritaOynadi = once.stil !== sonra.stil;
  const sayfaKaydi = once.sayfaY !== sonra.sayfaY;
  console.log(
    `  ${etiket.padEnd(34)} harita:${haritaOynadi ? 'OYNADI' : 'ölü  '} sayfa:${sayfaKaydi ? 'kaydı' : 'ölü  '}`,
  );
  return { haritaOynadi, sayfaKaydi };
}

console.log('=== "Haritayı sığdır" SONRASI (ölçek 1) ===');
const sigdir = s.locator('button:has-text("sığdır"), button[title*="sığdır"]').first();
if (await sigdir.count()) {
  await sigdir.click({ force: true });
  await s.waitForTimeout(800);
  console.log('  (sığdır basıldı)');
}
async function sigdirBas() {
  const d = s.locator('button:has-text("sığdır"), button[title*="sığdır"]').first();
  if (await d.count()) {
    await d.click({ force: true });
    await s.waitForTimeout(700);
  }
}
let hata = 0;
const k = (ad, kosul) => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}`);
  if (!kosul) hata++;
};

await sigdirBas();
const yatay = await parmakSurukle(-170, 0, 'YATAY parmak (sığdır sonrası)');
k('yatay parmak haritayı oynatıyor — ölü jest yok', yatay.haritaOynadi);

await sigdirBas();
const dikey = await parmakSurukle(0, -140, 'DİKEY parmak (sığdır sonrası)');
k('dikey parmak hâlâ SAYFAYI kaydırıyor', dikey.sayfaKaydi);
k('dikey parmak haritayı ele geçirmiyor', !dikey.haritaOynadi);

await sigdirBas();
const kisa = await parmakSurukle(-12, 0, 'ÇOK KISA yatay (eşik altı)');
k('eşik altı dokunuş kazara yakınlaştırmıyor', !kisa.haritaOynadi);

console.log(hata === 0 ? '\nHARİTA JESTLERİ TEMİZ\n' : `\n${hata} JEST KALDI\n`);
await b.close();
process.exit(hata === 0 ? 0 : 1);
