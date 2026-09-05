/**
 * Öğreticinin BAŞTAN SONA testi.
 *
 * `ogretici-testi.mjs` açılıp geçilebildiğini ölçüyor; bu araç sekiz
 * sayfanın HEPSİNİ tek tek geziyor ve her sayfada şunları arıyor:
 *
 *  - sayfa gerçekten değişti mi (ilerleme çubuğu ve sayaç),
 *  - başlık, özet ve maddeler dolu mu (boş bir sayfa sessizce geçilebilir),
 *  - metin taşıyor mu, okunuyor mu,
 *  - "Geri" gerçekten geri gidiyor mu,
 *  - "oraya bak" düğmesi doğru sekmeye götürüyor mu,
 *  - son sayfada "Diyarıma dön" kapatıyor mu ve BİR DAHA AÇILMIYOR mu.
 *
 * Sekiz sayfa elle tıklanarak test edilmemişti; oyuncu "hata var gibi"
 * dedi ve haklıydı (aşağıdaki bulgular commit mesajında).
 *
 * SADECE GELİŞTİRME. node tools/ogretici-tam-testi.mjs
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

console.log('Lordlar Çağı — öğretici tam testi (iPhone 13)\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `ogt${damga}@lordlar.dev`,
  lordName: `Ogt ${damga.toString(36).slice(-4)}`,
});

const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});
page.on('requestfailed', (r) => konsol.push(`düştü: ${r.url()}`));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });

const perde = page.locator('[role="dialog"][aria-label="Öğretici"]');
await perde.waitFor({ timeout: 20000 });
kontrol('Öğretici ilk girişte kendiliğinden açılıyor', await perde.isVisible());

/** O anki sayfanın ölçülebilir hâli. */
const sayfaDurumu = () =>
  page.evaluate(() => {
    const kok = document.querySelector('[role="dialog"][aria-label="Öğretici"]');
    if (!kok) return null;
    const sayac = [...kok.querySelectorAll('p')]
      .map((p) => p.textContent?.trim() ?? '')
      .find((t) => /^\d+ \/ \d+$/.test(t));
    const h2 = kok.querySelector('h2');
    const maddeler = [...kok.querySelectorAll('ul > li')].map((li) => ({
      vurgu: li.querySelector('p')?.textContent?.trim() ?? '',
      metin: li.querySelectorAll('p')[1]?.textContent?.trim() ?? '',
    }));
    // İlerleme çubuğunda kaç çubuk altın?
    const cubuklar = [...kok.querySelectorAll('span.h-1')];
    const dolu = cubuklar.filter((s) =>
      getComputedStyle(s).backgroundColor.includes('245, 183, 49'),
    ).length;
    const govde = kok.scrollWidth > kok.clientWidth;
    return {
      sayac,
      baslik: h2?.textContent?.trim() ?? '',
      ozet: kok.querySelector('h2')?.closest('div')?.parentElement?.nextElementSibling?.textContent?.trim() ?? '',
      madde: maddeler.length,
      bosMadde: maddeler.filter((m) => !m.vurgu || !m.metin).length,
      cubuk: cubuklar.length,
      dolu,
      oraya: Boolean([...kok.querySelectorAll('button')].find((x) => /ORAYA BAK/i.test(x.textContent ?? ''))),
      sonMu: Boolean([...kok.querySelectorAll('button')].find((x) => /Diyarıma dön/i.test(x.textContent ?? ''))),
      geriKapali: [...kok.querySelectorAll('button')].find((x) => /^Geri$/i.test(x.textContent ?? ''))?.disabled,
      yatayTasma: govde,
    };
  });

const ilk = await sayfaDurumu();
const toplam = ilk.cubuk;
kontrol('Sekiz sayfa var', toplam === 8, `${toplam} sayfa`);
kontrol('İlk sayfada "Geri" kapalı', ilk.geriKapali === true);

const gorulen = [];
for (let n = 1; n <= toplam; n++) {
  const d = await sayfaDurumu();
  gorulen.push(d);

  kontrol(`Sayfa ${n}: sayaç doğru`, d.sayac === `${n} / ${toplam}`, d.sayac ?? 'yok');
  kontrol(`Sayfa ${n}: başlık dolu`, d.baslik.length > 3, d.baslik.slice(0, 40));
  kontrol(`Sayfa ${n}: maddeler dolu`, d.madde > 0 && d.bosMadde === 0,
    `${d.madde} madde, ${d.bosMadde} boş`);
  kontrol(`Sayfa ${n}: ilerleme çubuğu ${n} dolu`, d.dolu === n, `${d.dolu}/${toplam}`);
  kontrol(`Sayfa ${n}: yatay taşma yok`, d.yatayTasma === false);

  if (n < toplam) {
    kontrol(`Sayfa ${n}: son sayfa DEĞİL`, d.sonMu === false);

    /**
     * DİBE KAYDIRIP ilerle. Sayfaların altısı ekrana sığmıyor ve gerçek
     * oyuncu okumak için kaydırıyor; testin ilk hâli hep tepede durup
     * "Devam"a bastığı için gerçek hatayı ıskalamıştı: React sekiz sayfa
     * için aynı kabı kullanıyor ve kaydırma konumu SONRAKİ sayfaya
     * devrediyordu — beşinci sayfa 62px kaydırılmış açılıyor, başlık
     * ekranın dışında kalıyordu.
     */
    await page.evaluate(() => {
      const k = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (k) k.scrollTop = k.scrollHeight;
    });
    await page.waitForTimeout(200);
    await page.locator('[role="dialog"] button:has-text("Devam")').click();
    await page.waitForTimeout(450);

    const kaydirma = await page.evaluate(() => {
      const k = document.querySelector('[role="dialog"] .overflow-y-auto');
      return k ? Math.round(k.scrollTop) : -1;
    });
    kontrol(`Sayfa ${n + 1}: TEPEDEN açılıyor`, kaydirma === 0, `scrollTop=${kaydirma}px`);
  }
}

// Başlıklar benzersiz mi: aynı sayfa iki kez gösterilirse sayaç ilerler
// ama oyuncu aynı şeyi okur.
const basliklar = gorulen.map((g) => g.baslik);
kontrol('Sekiz sayfanın başlığı da farklı', new Set(basliklar).size === toplam,
  `${new Set(basliklar).size} benzersiz`);

// --- Son sayfa ---
{
  const d = await sayfaDurumu();
  kontrol('Son sayfada "Diyarıma dön" var', d.sonMu === true);
  kontrol('Son sayfada "Devam" YOK', !(await page.locator('[role="dialog"] button:has-text("Devam")').count()));
}

// --- Geri gerçekten geri gidiyor mu ---
{
  await page.locator('[role="dialog"] button:has-text("Geri")').click();
  await page.waitForTimeout(400);
  const d = await sayfaDurumu();
  kontrol('Geri bir önceki sayfaya döndü', d.sayac === `${toplam - 1} / ${toplam}`, d.sayac ?? '');
  kontrol('Geri dönünce başlık da eski sayfanın', d.baslik === basliklar[toplam - 2],
    `${d.baslik.slice(0, 30)} vs ${basliklar[toplam - 2]?.slice(0, 30)}`);
  await page.locator('[role="dialog"] button:has-text("Devam")').click();
  await page.waitForTimeout(400);
}

// --- Kapanış ve BİR DAHA AÇILMAMA ---
{
  await page.locator('[role="dialog"] button:has-text("Diyarıma dön")').click();
  await page.waitForTimeout(1200);
  kontrol('Öğretici kapandı', (await perde.count()) === 0);
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2000);
  kontrol('Yenilemede TEKRAR AÇILMIYOR', (await perde.count()) === 0);

  // Sunucuya gerçekten yazıldı mı? Depoyu silip yeniden yükle: öğretici
  // yalnız tarayıcıda işaretlenmiş olsaydı burada geri gelirdi.
  await page.evaluate(() => {
    const t = localStorage.getItem('lordlar_token');
    localStorage.clear();
    localStorage.setItem('lordlar_token', t);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2000);
  kontrol('Tarayıcı deposu silinse de açılmıyor (sunucuda kayıtlı)', (await perde.count()) === 0);
}

// --- "Şimdi oraya bak" doğru sekmeye götürüyor mu ---
{
  const d3 = Date.now();
  const { token: t3 } = await kayitOl(API, {
    email: `ogt${d3}_o@lordlar.dev`,
    lordName: `Ogto ${d3.toString(36).slice(-4)}`,
  });
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), t3);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await perde.waitFor({ timeout: 20000 });

  // "oraya bak" düğmesi olan ilk sayfaya kadar ilerle.
  let bulundu = false;
  for (let n = 1; n <= toplam; n++) {
    if ((await sayfaDurumu()).oraya) {
      bulundu = true;
      break;
    }
    await page.locator('[role="dialog"] button:has-text("Devam")').click();
    await page.waitForTimeout(400);
  }
  kontrol('En az bir sayfada "oraya bak" düğmesi var', bulundu);

  if (bulundu) {
    await page.locator('[role="dialog"] button:has-text("ORAYA BAK")').click();
    await page.waitForTimeout(1500);
    kontrol('"Oraya bak" öğreticiyi kapattı', (await perde.count()) === 0);
    const etkin = await page.evaluate(() => {
      const b = document.querySelector('nav button[aria-current="page"]');
      return b?.textContent?.trim() ?? '';
    });
    kontrol('"Oraya bak" bir sekmeye götürdü', etkin.length > 0, etkin);
  }
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));
await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
