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
      // Perdenin ÜSTÜNDEKİ kâhya kartı: "neden bu düğme" burada yazıyor.
      ipucu:
        [...document.querySelectorAll('[role="status"]')]
          .map((e) => e.textContent?.trim() ?? '')
          .find((t) => t.includes('şimdi buna bas')) ?? null,
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

/** Hangi düğmede hangi sebep göründü — sebepler birbirini tekrar etmemeli. */
const gorulenSebep = {};

// --- 1. Malikâne: ışık omurga düğmesini açıkta bırakıyor mu ---
await page.waitForTimeout(2500);
{
  const d = await isikDurumu();
  kontrol('İlk oturumda ışık yanıyor', d.yaniyor === true);
  kontrol('Perde dört parça (delik gerçek, clip-path değil)', d.parca === 4, `${d.parca} parça`);
  kontrol('Delik omurga düğmesinin üstünde', d.isaret === 'omurga-dugme', d.isaret ?? 'yok');
  /**
   * Oyuncunun ikinci geri dönüşü: "şuraya bas diyoruz ama neden bastığını
   * söylemiyoruz." Sebep kâhyanın kartında yazıyordu ama kart PERDENİN
   * ALTINDA kalıyordu. Artık kâhya perdenin üstünde.
   */
  kontrol('Perdenin üstünde kâhya var', (d.ipucu ?? '').includes('Kâhya Sinan'), d.ipucu ?? 'yok');
  kontrol('Sebep de yazıyor (yalnız "buna bas" değil)',
    (d.ipucu ?? '').replace(/Kâhya Sinan|şimdi buna bas|↓/g, '').trim().length > 25,
    (d.ipucu ?? '').slice(0, 70));
  gorulenSebep.malikane = d.ipucu ?? '';
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

  // Sebep DÜĞMEYE özel olmalı: adımın cümlesi her düğmede aynı kalsaydı
  // "neden buna basıyorum" sorusu ara düğmelerde cevapsız kalırdı.
  kontrol('Kışladaki sebep, Malikâne\'dekinden FARKLI',
    (d.ipucu ?? '') !== (gorulenSebep.malikane ?? ''),
    (d.ipucu ?? '').slice(0, 60));
  gorulenSebep.kisla = d.ipucu ?? '';
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
      kontrol('"Saldır"ın sebebi de kendine ait',
        (d2.ipucu ?? '') !== (gorulenSebep.kisla ?? '') && (d2.ipucu ?? '').length > 30,
        (d2.ipucu ?? '').slice(0, 60));

      const ulas = await ulasilirMi(page.locator('[data-rehber="harita-saldir"]'));
      kontrol('"Saldır" düğmesi ULAŞILIR', ulas === 'ulasilir', ulas);

      await page.locator('[data-rehber="harita-saldir"]').click();
      await page.waitForTimeout(3000);
      kontrol('Saldırı başlayınca ışık SÖNÜYOR (ordu yolda, yapacak şey yok)',
        (await isikDurumu()).yaniyor === false);
    }
  }
}

// --- 6. ZORUNLU: kaçış düğmesi yok, kapatma yolu yok ---
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

  /**
   * Oyuncu ayrımı net koydu: "öğretici ile zorunlu yaptırmayı ayır,
   * oyuncu okusa da okumasa da yaptırmalı." Sekiz sayfalık tanıtımın
   * "GEÇ"i duruyor; buranın kaçış düğmesi kaldırıldı. Bu kontroller
   * geri konmasını engelliyor.
   */
  kontrol('Işıkta kaçış düğmesi YOK',
    (await page.locator('button[aria-label="Rehberi kapat"]').count()) === 0);
  kontrol('Kâhya kartında da kapatma YOK',
    (await page.locator('button:has-text("yeter, anladım")').count()) === 0);

  // Perdenin her köşesine bas: hiçbiri ışığı söndürmemeli.
  const boy = page.viewportSize();
  for (const [x, y] of [[10, 10], [boy.width - 10, 10], [10, boy.height - 10], [boy.width - 10, boy.height - 10]]) {
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(800);
  kontrol('Perdenin dört köşesine basmak ışığı söndürmüyor',
    (await isikDurumu()).yaniyor === true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2500);
  kontrol('Yenileme de kaçış yolu değil', (await isikDurumu()).yaniyor === true);
}

// --- 6b. Tur BİTİNCE sönüyor ve damga vuruluyor ---
{
  /**
   * Zorunluluğun sonu OYUNUN kendi olayı: ilk bölge alınınca rehber
   * biter. Damga da orada vuruluyor (`Lord.rehberBittiAt`) — damgasız
   * ölçüt tek başına "bölgesi yok" olurdu ve bölgelerini savaşta
   * kaybetmiş kıdemli bir lord kendini kaçışı olmayan turun içinde
   * bulurdu.
   *
   * Bölge gerçek yoldan alınıyor: baştaki lord zaten saldırıya çıkmıştı
   * (5b), yürüyüşü bitiriyoruz.
   */
  const bas = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  await fetch(`${API}/api/test/yuruyusleri-bitir`, { method: 'POST', headers: bas, body: '{}' });
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(3500);

  const me = await (
    await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  kontrol('Saldırı sonuçlandı, bölge alındı', (me.lord?.regionCount ?? 0) > 0,
    `${me.lord?.regionCount} bölge`);
  kontrol('Tur bitince ışık SÖNÜK', (await isikDurumu()).yaniyor === false);
  kontrol('Tur bitince kâhya kartı da susuyor',
    (await page.evaluate(() =>
      (document.querySelector('main')?.textContent ?? '').includes('Kâhya Sinan'),
    )) === false);

  // Damgayı sunucuya sor: arayüz "sustu" derken sunucu "hâlâ yeni oyuncu"
  // diyorsa, ordusunu kaybeden lord turun içine geri düşerdi.
  await page.waitForTimeout(1500);
  const me2 = await (
    await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  kontrol('Tur bitince sunucuya damga vuruluyor', me2.lord?.rehberGorundu === true,
    String(me2.lord?.rehberGorundu));
}

// --- 6c. Aynı tarayıcıda yeni hesap ---
{
  /**
   * AYNI TARAYICIDA YENİ HESAP: rehber GERİ GELMELİ.
   *
   * Oyuncunun bildirdiği hata tam olarak buydu — "yaptıran öğretici
   * çalışmıyor, yeni hesap açıp denedim". Kapatma kararı `localStorage`da
   * tutuluyordu, yani TARAYICIYA bağlıydı: bir kez "yeter, anladım" diyen
   * oyuncunun aynı tarayıcıda açtığı her yeni hesap sessizce rehbersiz
   * açılıyordu. Sunucu "yepyeni lord" derken tarayıcı "zaten kapattım"
   * diyordu ve kimse ikisini karşılaştırmıyordu.
   *
   * Karar artık lorda ait (`Lord.rehberBittiAt`). Bu kontrol o hatanın
   * geri gelmesini imkânsız kılıyor: depo TEMİZLENMEDEN yeni bir jeton
   * konuyor, çünkü gerçek oyuncu da tarayıcısını temizlemiyor.
   */
  const d4 = Date.now();
  const { token: t4 } = await kayitOl(API, {
    email: `isik${d4}_y@lordlar.dev`,
    lordName: `Isiky ${d4.toString(36).slice(-4)}`,
  });
  await fetch(`${API}/api/me/ogretici-bitti`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t4}`, 'content-type': 'application/json' },
    body: '{}',
  });
  // localStorage'a DOKUNULMUYOR: eski hesabın izi dursun, hata orada saklıydı.
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), t4);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const yeni = await isikDurumu();
  kontrol('AYNI TARAYICIDA yeni hesapta ışık GERİ GELİYOR', yeni.yaniyor === true,
    yeni.isaret ?? 'sönük');
  kontrol('Yeni hesapta kâhya kartı da geri geliyor',
    await page.evaluate(() =>
      (document.querySelector('main')?.textContent ?? '').includes('Kâhya Sinan'),
    ));
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

/**
 * --- 8. GERÇEK İLK OTURUM: arayüzden kayıt → sekiz sayfa → ışık ---
 *
 * Yukarıdaki bölümler sekiz sayfalık öğreticiyi API'den kapatıp işi
 * kısaltıyor. Oyuncu bunu yapmıyor: kaydoluyor, sayfaları çeviriyor,
 * "Diyarıma dön"e basıyor. Işığın YANDIĞI AN tam olarak orası ve o an
 * hiçbir testte yürünmemişti — bildirilen hata da zaten oradaydı.
 *
 * Bu yüzden burada hiçbir kısayol yok: tertemiz bir tarayıcı bağlamı,
 * arayüzden kayıt, sekiz sayfa tek tek.
 */
{
  const ctx2 = await b.newContext({ ...devices['iPhone 13'] });
  const s2 = await ctx2.newPage();
  const d5 = Date.now().toString(36).slice(-5);
  await s2.goto(WEB, { waitUntil: 'domcontentloaded' });
  await s2.waitForSelector('input[type=email]', { timeout: 20000 });
  await s2.locator('input').nth(0).fill(`Ilk ${d5}`);
  await s2.locator('input[type=email]').fill(`isikilk${d5}@lordlar.dev`);
  await s2.locator('input[type=password]').fill('parola12345');
  await s2.locator('form button[type="submit"]').last().click();

  await s2.waitForSelector('[role="dialog"][aria-label="Öğretici"]', { timeout: 25000 });
  kontrol('Gerçek kayıtta önce sekiz sayfalık öğretici açılıyor', true);

  for (let n = 1; n < 8; n++) {
    await s2.locator('[role="dialog"] button:has-text("Devam")').click();
    await s2.waitForTimeout(300);
  }
  await s2.locator('[role="dialog"] button:has-text("Diyarıma dön")').click();
  await s2.waitForTimeout(3000);

  const son = await s2.evaluate(() => {
    const perde = [...document.querySelectorAll('div')].filter(
      (d) => typeof d.className === 'string' && d.className.includes('z-[55]'),
    );
    const hedef = [...document.querySelectorAll('[data-rehber]')].find((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const u = document.elementFromPoint(
        Math.round(r.left + r.width / 2),
        Math.round(r.top + r.height / 2),
      );
      return Boolean(u && (e === u || e.contains(u)));
    });
    return { parca: perde.length, isaret: hedef?.getAttribute('data-rehber') ?? null };
  });
  kontrol('Öğretici bitince ışık KENDİLİĞİNDEN yanıyor', son.parca === 4, `${son.parca} parça`);
  kontrol('Delik doğrudan omurga düğmesinde', son.isaret === 'omurga-dugme', son.isaret ?? 'yok');
  await ctx2.close();
}

/**
 * --- 9. OKUMAYAN oyuncu da yapıyor ---
 *
 * Ayrımın kendisi: "öğretici ile zorunlu yaptırmayı ayır, oyuncu okusa da
 * okumasa da yaptırmalı." Yukarıdaki bölüm okuyan oyuncuyu yürüdü; bu
 * bölüm ilk saniyede "GEÇ"e basanı. İkisi de aynı yere varmalı.
 */
{
  const ctx3 = await b.newContext({ ...devices['iPhone 13'] });
  const s3 = await ctx3.newPage();
  const d6 = Date.now().toString(36).slice(-5);
  await s3.goto(WEB, { waitUntil: 'domcontentloaded' });
  await s3.waitForSelector('input[type=email]', { timeout: 20000 });
  await s3.locator('input').nth(0).fill(`Gec ${d6}`);
  await s3.locator('input[type=email]').fill(`isikgec${d6}@lordlar.dev`);
  await s3.locator('input[type=password]').fill('parola12345');
  await s3.locator('form button[type="submit"]').last().click();

  await s3.waitForSelector('[role="dialog"][aria-label="Öğretici"]', { timeout: 25000 });
  // Tek sayfa bile okumadan geç.
  await s3.locator('[role="dialog"] button[aria-label="Öğreticiyi geç"]').click();
  await s3.waitForTimeout(3500);

  const gecen = await s3.evaluate(() => {
    const perde = [...document.querySelectorAll('div')].filter(
      (d) => typeof d.className === 'string' && d.className.includes('z-[55]'),
    );
    const hedef = [...document.querySelectorAll('[data-rehber]')].find((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const u = document.elementFromPoint(
        Math.round(r.left + r.width / 2),
        Math.round(r.top + r.height / 2),
      );
      return Boolean(u && (e === u || e.contains(u)));
    });
    return {
      parca: perde.length,
      isaret: hedef?.getAttribute('data-rehber') ?? null,
      kacis: document.querySelectorAll('button[aria-label="Rehberi kapat"]').length,
    };
  });
  kontrol('Tanıtımı GEÇEN oyuncuya da ışık yanıyor', gecen.parca === 4, `${gecen.parca} parça`);
  kontrol('Geçene de aynı düğme gösteriliyor', gecen.isaret === 'omurga-dugme',
    gecen.isaret ?? 'yok');
  kontrol('Geçen oyuncu için de kaçış yolu yok', gecen.kacis === 0);
  await ctx3.close();
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));
await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
