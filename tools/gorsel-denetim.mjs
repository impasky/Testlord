/**
 * Görsel denetim: kayma, taşma ve örtüşme avı.
 *
 * Ekran görüntüsüne bakarak "bir şey kaymış" demek kolay, NEREDE kaydığını
 * söylemek zor. Bu araç ölçüyor:
 *
 *  - YATAY TAŞMA: gövde yatay kayıyor mu (mobilde en görünür kusur).
 *  - ÖRTÜŞME: sabit üst bar ile içeriğin ilk satırı çakışıyor mu.
 *  - TAŞAN ÖGE: kendi kabından genişe çıkan bir öge var mı.
 *  - KESİLEN METİN: kabına sığmayıp gizlenen yazı.
 *  - DOKUNMA HEDEFİ: 40 pikselden küçük düğme (parmak için küçük).
 *
 * SADECE GELİŞTİRME. node tools/gorsel-denetim.mjs
 */
import { chromium } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CIKTI = process.env.CIKTI ?? '.';

let bulgu = 0;
function sorun(ekran, ne, detay) {
  console.log(`  [SORUN] ${ekran}: ${ne}${detay ? ` — ${detay}` : ''}`);
  bulgu++;
}
function iyi(ekran, ne) {
  console.log(`  [TEMİZ] ${ekran}: ${ne}`);
}

const damga = Date.now();
const r = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `gd${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Gd${damga.toString(36).slice(-5)}`,
  }),
});
const { token } = await r.json();
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

// Ekranların DOLU hâlini denetliyoruz: boş ekranda kayma görünmez.
await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord.statPoints;
if (puan > 0)
  await post('/me/stats', { liderlik: Math.floor(puan / 2), guc: puan - Math.floor(puan / 2) });
await post('/army/train', { unitType: 'mizrakci', count: 120 });
await post('/army/train', { unitType: 'okcu', count: 80 });
await post('/items/craft', { tier: 2, slot: 'silah' });
await post('/test/kuyruklari-bitir');
const esya = (await get('/items')).items[0];
if (esya) await post(`/items/${esya.id}/equip`);
const kadro = (await get('/generals')).kadro;
const g0 = kadro.filter((g) => !g.sahipMi).sort((a, b) => a.maliyet_altin - b.maliyet_altin)[0];
if (g0) {
  await post(`/generals/${g0.key}/hire`);
  await post(`/generals/${g0.key}/assign`, { slotIndex: 0 });
}
await post('/ittifak/kur', { ad: `Denetim ${damga % 10000}`, etiket: `D${damga % 100}` });

console.log('Lordlar Çağı — görsel denetim (iPhone 13)\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
// Öğretici tam ekran açılıyor ve altındaki ekranı ölçmemizi engelliyor.
// Denetim öğreticiyi DEĞİL, arkasındaki ekranları ölçüyor.
await ogreticiyiGec(page);

/** Bir ekranı ölç. */
async function denetle(ad) {
  await page.waitForTimeout(1200);

  const olcum = await page.evaluate(() => {
    const sonuc = {
      yatayTasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tasanlar: [],
      kesilenler: [],
      kucukDokunma: [],
      ortusme: null,
    };

    // Sabit üst bar ile içeriğin çakışması: barın hemen altındaki noktada
    // hangi öge var? İçerik barın ALTINDA başlamalı.
    const bar = document.querySelector('header');
    if (bar) {
      const b = bar.getBoundingClientRect();
      const altta = document.elementFromPoint(window.innerWidth / 2, b.bottom + 4);
      if (altta && bar.contains(altta)) sonuc.ortusme = 'içerik barın altında başlamıyor';
    }

    const govde = document.body.getBoundingClientRect();
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
      const k = el.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) continue;

      // Görünür alandan taşan öge (yatayda).
      //
      // Kırpılan taşma sorun DEĞİL: sahne gibi kenardan kenara uzanan
      // ögeler bilerek kabından taşıyor ve bir üst kap onları
      // overflow:hidden ile kesiyor. Bunları bildirmek aracı yalancı
      // yapıyordu — düzeltilecek bir şey yokken her koşuda "sorun" diyordu.
      let kirpiliyor = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (as.overflowX === 'hidden' || as.overflowX === 'clip' || as.overflowX === 'auto') {
          kirpiliyor = true;
          break;
        }
      }
      if (!kirpiliyor && (k.right > govde.right + 1 || k.left < govde.left - 1)) {
        const etiket = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`;
        if (sonuc.tasanlar.length < 6) {
          sonuc.tasanlar.push(`${etiket} (${Math.round(k.left)}..${Math.round(k.right)})`);
        }
      }

      // Kabına sığmayan metin: taşan içerik gizleniyor
      const metinli = el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
      if (metinli && el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible') {
        const yazi = (el.textContent ?? '').trim().slice(0, 40);
        // Bilerek kırpılan yazılar (truncate) hata değil; yalnız
        // ellipsis OLMAYANLARI bildiriyoruz.
        if (s.textOverflow !== 'ellipsis' && sonuc.kesilenler.length < 6) {
          sonuc.kesilenler.push(`"${yazi}" (${el.scrollWidth}>${el.clientWidth})`);
        }
      }

      // Dokunma hedefi
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.offsetParent !== null) {
        if (k.height > 0 && k.height < 40 && k.width < 40 && sonuc.kucukDokunma.length < 6) {
          const yazi = (el.textContent ?? '').trim().slice(0, 20);
          sonuc.kucukDokunma.push(`"${yazi}" ${Math.round(k.width)}x${Math.round(k.height)}`);
        }
      }
    }
    return sonuc;
  });

  if (olcum.yatayTasma > 1) sorun(ad, 'sayfa YATAY kayıyor', `${olcum.yatayTasma}px`);
  else iyi(ad, 'yatay kayma yok');

  if (olcum.ortusme) sorun(ad, 'üst bar içeriği örtüyor', olcum.ortusme);
  if (olcum.tasanlar.length) sorun(ad, 'ekrandan taşan öge', olcum.tasanlar.join(' | '));
  if (olcum.kesilenler.length) sorun(ad, 'kesilen metin', olcum.kesilenler.join(' | '));
  if (olcum.kucukDokunma.length) sorun(ad, 'küçük dokunma hedefi', olcum.kucukDokunma.join(' | '));

  await page.screenshot({ path: `${CIKTI}/gd-${ad}.png` });
}

const sekmeler = [
  ['malikane', 'Malikâne'],
  ['kisla', 'Kışla'],
  ['harita', 'Harita'],
  ['demirhane', 'Demirhane'],
];
for (const [ad, etiket] of sekmeler) {
  await page.click(`nav button:has-text("${etiket}")`);
  await denetle(ad);
}

// Menü altındaki ekranlar
for (const [ad, etiket] of [
  ['lord', 'Lord'],
  ['generaller', 'Generaller'],
  ['siralama', 'Sıralama'],
  ['ittifak', 'İttifak'],
]) {
  await page.click('nav button:has-text("Menü")');
  await page.waitForTimeout(500);
  await page.click(`text=${etiket}`);
  await denetle(ad);
}

// Bölge detayı: alt sayfa açıkken en çok kayma buradaydı
await page.click('nav button:has-text("Harita")');
await page.waitForTimeout(1800);
const hedef = (await get('/map')).regions.filter((x) => !x.isMine && x.type !== 'taht')[0];
await page
  .locator(`svg text:has-text("${hedef.name.slice(0, 6)}")`)
  .last()
  .click({ timeout: 10000, force: true });
await denetle('bolge-detay');

/**
 * YEPYENİ lordun malikânesi.
 *
 * Şimdiye kadar yalnız DOLU ekranları denetliyorduk; oysa oyuncunun ilk
 * gördüğü şey boş ekran ve "burada iş var mı" sorusunun cevabı orada
 * veriliyor (docs/11 §2.3 G4). Boş kuyruk ve boş olay akışı artık sakin
 * kartla çiziliyor; bunun gerçekten öyle çizildiğini de ölçüyoruz.
 */
const yeniDamga = Date.now();
const yr = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `gdbos${yeniDamga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Bos${yeniDamga.toString(36).slice(-5)}`,
  }),
});
const yeniToken = (await yr.json()).token;
if (yeniToken) {
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), yeniToken);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await ogreticiyiGec(page);
  await denetle('yeni-lord-malikane');

  const sakin = await page.evaluate(() => ({
    kart: document.querySelectorAll('.kart-sakin').length,
    plaka: document.querySelectorAll('.plaka-sakin').length,
  }));
  if (sakin.kart > 0 && sakin.plaka > 0) {
    iyi(
      'yeni-lord-malikane',
      `boş bölümler sakin çiziliyor (${sakin.kart} kart, ${sakin.plaka} başlık)`,
    );
  } else {
    sorun(
      'yeni-lord-malikane',
      'boş bölüm dolu bölümle aynı ağırlıkta',
      `${sakin.kart} sakin kart, ${sakin.plaka} sakin başlık`,
    );
  }
}

console.log(`\n${bulgu === 0 ? 'GÖRSEL DENETİM TEMİZ' : `${bulgu} GÖRSEL SORUN`}`);
console.log(
  `konsol hatası: ${konsol.length}${konsol.length ? ' — ' + konsol.slice(0, 3).join(' | ') : ''}`,
);
await browser.close();
process.exit(0);
