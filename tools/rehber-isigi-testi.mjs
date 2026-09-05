/**
 * Rehber ışığı — "zorunlu tek düğme" testi.
 *
 * Oyuncunun istediği buydu:
 *
 *   "oyuncu girdiğinde zorunlu olarak tıklamasını istemeliyiz, sadece o
 *    buton aktif olmalı, diğer tüm ekran üzerinde transparan siyah bir
 *    panel olmalı — bunu yapmadan başka bir şeye tıklayamazsın der gibi."
 *
 * Bu araç iddianın İKİ yarısını da ölçüyor:
 *   - delik gerçekten AÇIK mı (o düğmeye parmak ulaşıyor mu),
 *   - perde gerçekten KAPALI mı (başka hiçbir şeye ulaşmıyor mu).
 *
 * Ölçüm `elementFromPoint` ile: sınıf adına ya da görüntüye değil,
 * tarayıcının "bu noktaya basılırsa hangi öğe tıklanır" cevabına bakıyor.
 * Perdeyi `pointer-events:none` ile şeffaflaştıran bir hata da, deliği
 * kapatan bir hata da buradan kaçamaz.
 *
 * SADECE GELİŞTİRME. node tools/rehber-isigi-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — rehber ışığı testi (iPhone 13)\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `isik${damga}@lordlar.dev`,
  lordName: `Isik ${damga.toString(36).slice(-4)}`,
});

// Sekiz sayfalık öğreticiyi kapat: ışık onun ÜSTÜNE binmemeli ve zaten
// ölçmek istediğimiz şey sonrasında olan.
await fetch(`${API}/api/me/ogretici-bitti`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: '{}',
});

const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });

/** Işığın o an aydınlattığı işaret ve deliğin gerçekten açık olup olmadığı. */
const isikDurumu = () =>
  page.evaluate(() => {
    // Perde parçaları: z-[55] sınıfı taşıyan sabit dikdörtgenler.
    const perdeler = [...document.querySelectorAll('div')].filter((d) =>
      d.className && typeof d.className === 'string' && d.className.includes('z-[55]'),
    );
    const tumIsaretler = [...document.querySelectorAll('[data-rehber]')].map((e) =>
      e.getAttribute('data-rehber'),
    );
    if (perdeler.length === 0) return { yaniyor: false, tumIsaretler };

    const hedef = [...document.querySelectorAll('[data-rehber]')].find((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const ust = document.elementFromPoint(x, y);
      return Boolean(ust && (e === ust || e.contains(ust)));
    });

    return {
      yaniyor: true,
      parca: perdeler.length,
      isaret: hedef?.getAttribute('data-rehber') ?? null,
      metin: hedef?.textContent?.trim().slice(0, 40) ?? '',
      // Sayfadaki bütün işaretler: aynı ad iki kez varsa ışık hangisini
      // seçeceğini bilemez.
      tumIsaretler,
      ipucu: [...document.querySelectorAll('[role="status"]')]
        .map((e) => e.textContent?.trim() ?? '')
        .find((t) => t.includes('bas')) ?? null,
    };
  });

/**
 * Bir öğenin merkezine basılırsa gerçekten O öğe mi tıklanır?
 *
 * Locator alıyor çünkü `:has-text()` Playwright'ın seçicisi, tarayıcının
 * değil: `document.querySelector` onu tanımıyor.
 */
const ulasilirMi = async (loc) => {
  if ((await loc.count()) === 0) return 'yok';
  return loc.first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    const ust = document.elementFromPoint(
      Math.round(r.left + r.width / 2),
      Math.round(r.top + r.height / 2),
    );
    if (!ust) return 'bos';
    if (e === ust || e.contains(ust)) return 'ulasilir';
    return 'ortulu';
  });
};

// --- 1. Malikâne: ışık omurga düğmesini açıkta bırakıyor mu ---
await page.waitForTimeout(2500);
{
  const d = await isikDurumu();
  kontrol('İlk oturumda ışık yanıyor', d.yaniyor === true);
  kontrol('Perde dört parça (delik gerçek, clip-path değil)', d.parca === 4, `${d.parca} parça`);
  kontrol('Delik omurga düğmesinin üstünde', d.isaret === 'omurga-dugme', d.isaret ?? 'yok');
  kontrol('Tek satır ipucu var', Boolean(d.ipucu), d.ipucu ?? '');
  kontrol(
    'Sayfada her işaret bir kez',
    new Set(d.tumIsaretler).size === d.tumIsaretler.length,
    d.tumIsaretler.join(','),
  );
}

// --- 2. Perde gerçekten kapatıyor mu ---
{
  const kisla = await ulasilirMi(page.locator('nav button:has-text("Kışla")'));
  kontrol('Alt çubuktaki başka sekme ÖRTÜLÜ', kisla === 'ortulu', kisla);

  // Örtülü olduğunu iddia etmek yetmez: bas ve ekranın değişmediğini gör.
  const oncekiSekme = await page.evaluate(
    () => document.querySelector('nav button[aria-current="page"]')?.textContent?.trim() ?? '',
  );
  const kutu = await page.locator('nav button:has-text("Kışla")').boundingBox();
  await page.mouse.click(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
  await page.waitForTimeout(700);
  const sonrakiSekme = await page.evaluate(
    () => document.querySelector('nav button[aria-current="page"]')?.textContent?.trim() ?? '',
  );
  kontrol('Perdeye basınca ekran DEĞİŞMİYOR', oncekiSekme === sonrakiSekme,
    `${oncekiSekme} → ${sonrakiSekme}`);
  kontrol('Basınca ışık hâlâ yanıyor', (await isikDurumu()).yaniyor === true);
}

// --- 3. Açık düğme gerçekten basılabiliyor mu ---
{
  const ulas = await ulasilirMi(page.locator('[data-rehber="omurga-dugme"]'));
  kontrol('Aydınlatılan düğme ULAŞILIR', ulas === 'ulasilir', ulas);

  await page.locator('[data-rehber="omurga-dugme"]').click();
  await page.waitForTimeout(2000);
  const sekme = await page.evaluate(
    () => document.querySelector('nav button[aria-current="page"]')?.textContent?.trim() ?? '',
  );
  // Türkçe I tuzağı: /KIŞLA/i.test('Kışla') YANLIŞ döner, çünkü 'I'
  // küçük harfe 'i' olarak iner, 'ı' olarak değil. Doğrudan karşılaştır.
  kontrol('Düğmeye basınca Kışla açıldı', sekme === 'Kışla', sekme);
}

// --- 4. Kışla: ışık doğru birimin eğitim düğmesine geçiyor mu ---
await page.waitForTimeout(2500);
{
  const d = await isikDurumu();
  kontrol('Kışlada ışık hâlâ yanıyor', d.yaniyor === true);
  kontrol('Delik eğitim düğmesine geçti', d.isaret === 'kisla-egit', d.isaret ?? 'yok');
  kontrol('Aydınlatılan düğme gerçekten "eğit" düğmesi', /eğit/i.test(d.metin), d.metin);
  // Beş birim kartı var; imza YALNIZ omurganın istediğinde olmalı.
  const kacTane = d.tumIsaretler.filter((x) => x === 'kisla-egit').length;
  kontrol('Beş birimden yalnız BİRİ imzalı', kacTane === 1, `${kacTane} tane`);

  const ulas = await ulasilirMi(page.locator('[data-rehber="kisla-egit"]'));
  kontrol('Eğitim düğmesi ULAŞILIR', ulas === 'ulasilir', ulas);
}

// --- 5. Eylem yapılınca ışık kendiliğinden sönüyor mu ---
{
  await page.locator('[data-rehber="kisla-egit"]').click();
  await page.waitForTimeout(3000);
  const d = await isikDurumu();
  kontrol('Eğitim başlayınca ışık SÖNÜYOR (bekleme adımında hapis yok)', d.yaniyor === false);

  const kisla = await ulasilirMi(page.locator('nav button:has-text("Harita")'));
  kontrol('Işık sönünce alt çubuk yeniden ulaşılır', kisla === 'ulasilir', kisla);
}

/**
 * --- 5b. Zincirin ikinci yarısı: ordu hazır → saldırı ---
 *
 * Oyuncunun anlattığı şey tam olarak buydu: "sonra hemen haritada npc vs
 * olur, oraya götürür, şimdi npc'ye tıkla der." Işık eğitim bitince
 * kendiliğinden yeniden yanmalı ve bu kez saldırıya kadar götürmeli.
 *
 * İlk eğitim `balance.json`'daki kısayolla saniyeler sürüyor; kuyruk
 * çözülene kadar yenileyerek bekliyoruz.
 */
{
  let adimGeldi = false;
  for (let i = 0; i < 12 && !adimGeldi; i++) {
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
    await page.waitForTimeout(1800);
    adimGeldi = (await isikDurumu()).isaret === 'omurga-dugme';
  }
  kontrol('Eğitim bitince ışık kendiliğinden YENİDEN yanıyor', adimGeldi);

  if (adimGeldi) {
    const metin = await page
      .locator('[data-rehber="omurga-dugme"]')
      .textContent()
      .catch(() => '');
    kontrol('Yeni düğme saldırıya çağırıyor', /saldır/i.test(metin ?? ''), metin ?? '');

    await page.locator('[data-rehber="omurga-dugme"]').click();
    await page.waitForTimeout(3000);
    const d = await isikDurumu();
    // Saldırı ordusu boşken "Saldır" kapalı olur; ışık kapalı düğmeyi
    // atlayıp önce "Hepsi"yi göstermeli — zincirin can alıcı yeri burası.
    kontrol('Haritada delik önce "Hepsi" seçicisinde', d.isaret === 'harita-hepsi', d.isaret ?? 'yok');

    if (d.isaret === 'harita-hepsi') {
      await page.locator('[data-rehber="harita-hepsi"]').click();
      await page.waitForTimeout(2500);
      const d2 = await isikDurumu();
      kontrol('Ordu seçilince delik "Saldır" düğmesine geçti',
        d2.isaret === 'harita-saldir', d2.isaret ?? 'yok');

      const ulas = await ulasilirMi(page.locator('[data-rehber="harita-saldir"]'));
      kontrol('"Saldır" düğmesi ULAŞILIR', ulas === 'ulasilir', ulas);

      await page.locator('[data-rehber="harita-saldir"]').click();
      await page.waitForTimeout(3000);
      kontrol('Saldırı başlayınca ışık SÖNÜYOR (ordu yolda, yapacak şey yok)',
        (await isikDurumu()).yaniyor === false);
    }
  }
}

// --- 6. Kaçış kapısı: "yeter, anladım" iki yeri birden susturuyor mu ---
{
  const d2 = Date.now();
  const { token: t2 } = await kayitOl(API, {
    email: `isik${d2}_k@lordlar.dev`,
    lordName: `Isikk ${d2.toString(36).slice(-4)}`,
  });
  await fetch(`${API}/api/me/ogretici-bitti`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t2}`, 'content-type': 'application/json' },
    body: '{}',
  });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('lordlar_token', t);
  }, t2);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2500);
  kontrol('Yeni lordda ışık yanıyor', (await isikDurumu()).yaniyor === true);

  // Işığın kaçış kapısı sağ üstteki "GEÇ" — kâhya kartındaki "yeter,
  // anladım" perdenin ALTINDA kalıyor ve zaten tıklanamaz.
  await page.locator('button[aria-label="Rehberi kapat"]').click();
  await page.waitForTimeout(800);
  kontrol('Işığın "GEÇ" düğmesi ışığı söndürdü', (await isikDurumu()).yaniyor === false);

  // Aynı karar kâhya kartını da susturmalı: biri kapanıp öbürü kalsaydı
  // oyuncu yarım kapanmış bir öğreticiyle baş başa kalırdı.
  const kartVar = await page.evaluate(() =>
    (document.querySelector('main')?.textContent ?? '').includes('Kâhya Sinan'),
  );
  kontrol('Aynı karar kâhya kartını da kapattı', kartVar === false);
  kontrol('Ekranda tek kapatma düğmesi kaldı — belirsizlik yok',
    (await page.locator('button:has-text("yeter, anladım")').count()) === 0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2500);
  kontrol('Yenilemede geri gelmiyor', (await isikDurumu()).yaniyor === false);
}

// --- 7. Sekiz sayfalık öğretici açıkken ışık yanmamalı ---
{
  const d3 = Date.now();
  const { token: t3 } = await kayitOl(API, {
    email: `isik${d3}_o@lordlar.dev`,
    lordName: `Isiko ${d3.toString(36).slice(-4)}`,
  });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('lordlar_token', t);
  }, t3);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="dialog"][aria-label="Öğretici"]', { timeout: 20000 });
  await page.waitForTimeout(2500);
  kontrol('Öğretici açıkken ışık SÖNÜK (iki perde üst üste binmiyor)',
    (await isikDurumu()).yaniyor === false);
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));
await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
