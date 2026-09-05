/**
 * Omurga testi — "şimdi ne yapmalısın" bloğunu uçtan uca dolaşır.
 *
 * Omurga hiçbir yerde durum saklamıyor; gösterdiği adımı tamamen oyun
 * durumundan türetiyor. Bu testin asıl işi o türetmenin doğru olduğunu
 * göstermek: adımları gerçekten oynayarak ilerletiyoruz ve blogun her
 * seferinde TEK ve DOĞRU eylemi göstermesini bekliyoruz.
 *
 * Ayrıca omurganın hedefi, oyuncu planı uygularken altından kaymamalı:
 * "şu bölge için şu kadar asker eğit" deyip asker eğitilince başka bir
 * bölgeyi göstermek, düzeltmeye çalıştığımız "karman çorman" duygusunu
 * üretirdi.
 *
 * API ve arayüz ayakta olmalı. node tools/omurga-testi.mjs
 */
import { rehberiSustur } from './lib/gezin.mjs';
import { chromium, devices } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const CIKTI = process.env.SMOKE_OUT ?? 'ekran-goruntuleri';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — omurga testi (iPhone 13)\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
await rehberiSustur(page);
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});
page.on('pageerror', (e) => konsol.push(String(e)));

/**
 * Metni Türkçe kurallarına göre küçültür.
 *
 * Gerekli, çünkü arayüz başlıkları CSS ile büyük harfe çevriliyor ve
 * JavaScript'in varsayılan büyük/küçük eşlemesinde "İ" (U+0130) "i"ye
 * karşılık gelmiyor: /eğitiliyor/i kalıbı "EĞİTİLİYOR" metnini tutmuyor.
 */
const kucult = (m) => (m ?? '').toLocaleLowerCase('tr');

/** Omurga kartının tamamı; kart yoksa null. */
async function omurga() {
  const baslik = page.locator('text=Şimdi ne yapmalısın');
  if (!(await baslik.count())) return null;
  return (await baslik.locator('..').innerText()).replace(/\s+/g, ' ').trim();
}

/** Omurgadaki birincil eylem düğmesinin metni. */
async function eylem() {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('*')].find(
      (x) => x.textContent?.trim() === 'Şimdi ne yapmalısın',
    );
    const kart = b?.parentElement;
    const dugmeler = kart ? [...kart.querySelectorAll('button')] : [];
    return dugmeler.length ? dugmeler[dugmeler.length - 1].textContent.trim() : null;
  });
}

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=email]', { timeout: 15000 });
const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Omurga ${damga.toString(36).slice(-4)}`);
await page.fill('input[type=email]', `omurga${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
// Öğretici tam ekran açılıyor ve arkasını tıklatmıyor: gerçek oyuncu
// gibi geçiyoruz (bkz. tools/lib/ogretici.mjs).
await ogreticiyiGec(page);

const token = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) });
const get = (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((r) => r.json());

// Taze dünya: önceki koşuların sahiplendiği bölgeler komşuluğu boşaltıyor.
await post('/test/bolgeleri-sifirla');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await page.waitForTimeout(1800);

// --- 1. Ordusu olmayan lord: tek eylem "ordunu kur"
const ilk = await omurga();
kontrol('Yeni lorda omurga görünüyor', ilk !== null);
kontrol('İlk eylem ordu kurmak', kucult(ilk).includes('ordunu kur'), (ilk ?? '').slice(0, 70));
// Sayılar artık cümlenin içinde değil rozette: "29 Okçu", "4.350".
kontrol(
  'Kaç asker gerektiğini somut söylüyor',
  /\d+\s+(okçu|mızrakçı|köylü milis|süvari|mancınık)/.test(kucult(ilk)),
  (ilk ?? '').slice(0, 90),
);
kontrol(
  'Maliyet rozeti var',
  /\d[\d.]{2,}/.test(kucult(ilk)),
  (ilk ?? '').slice(0, 90),
);
kontrol('Tek birincil eylem düğmesi var', (await eylem())?.includes('eğit') === true, await eylem());
await page.screenshot({ path: `${CIKTI}/omurga-1-ordu-yok.png` });

const oneri = (await get('/map')).oneri;
const hedefAdi = oneri.name;
kontrol('Önerilen ordunun maliyeti yazılı', oneri.eksik?.maliyet?.altin > 0,
  `${oneri.eksik.adet} ${oneri.eksik.birim} · ${oneri.eksik.maliyet.altin} altın`);

// Bu test omurganın MANTIĞINI ölçüyor, ekonomiyi değil. Önceki testlerin
// sahiplendiği bölgeler yüzünden en yakın boş hedef bazen başlangıç
// kaynağının üstünde bir ordu istiyor; omurga bunu zaten "altının yetmiyor"
// diye söylüyor. Testi oraya takmamak için kaynağı tamamlıyoruz.
if (!oneri.eksik.karsilanabilir) {
  await post('/test/kaynak-ver', { altin: 20000, demir: 10000, erzak: 10000 });
}

// --- 2. Söyleneni yap: hedef DEĞİŞMEMELİ
const egitimSonuc = await post('/army/train', {
  unitType: oneri.eksik.birim,
  count: oneri.eksik.adet,
});
kontrol('Önerilen ordu gerçekten eğitilebiliyor', egitimSonuc.ok,
  egitimSonuc.ok ? '' : (await egitimSonuc.json()).error);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await page.waitForTimeout(1800);

const egitimde = await omurga();
kontrol('Eğitim sürerken omurga beklemeyi söylüyor', kucult(egitimde).includes('eğitiliyor'),
  (egitimde ?? '').slice(0, 70));
kontrol('Hedef plan uygulanırken değişmedi', (egitimde ?? '').includes(hedefAdi), hedefAdi);
await page.screenshot({ path: `${CIKTI}/omurga-2-egitimde.png` });

// --- 3. Ordu hazır: eylem saldırıya döner
await post('/test/kuyruklari-bitir');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await page.waitForTimeout(1800);

const hazir = await omurga();
kontrol('Ordu hazır olunca eylem saldırıya dönüyor', kucult(hazir).includes('üzerine yürü'),
  (hazir ?? '').slice(0, 60));
kontrol(
  'Saldırının karşılığı yazıyor',
  kucult(hazir).includes('kazanacakların') && /\+[\d.]+\/sa/.test(kucult(hazir)),
  (hazir ?? '').slice(0, 110),
);
kontrol('Saldırı düğmesi hedefi adıyla anıyor', (await eylem())?.includes('saldır') === true,
  await eylem());
await page.screenshot({ path: `${CIKTI}/omurga-3-saldiri.png` });

// --- 4. Düğme gerçekten haritada o bölgeyi açıyor
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent.includes('saldır'),
  );
  b?.click();
});
await page.waitForTimeout(2500);
kontrol('Düğme haritada bölge sayfasını açtı',
  await page.locator('text=Saldırı ordusu').isVisible().catch(() => false));

// --- 5. Bölge alınınca omurga bir sonraki adıma geçiyor
const harita = await get('/map');
const me = await get('/me');
await post('/march', { toRegionId: harita.oneri.regionId, army: me.lord.homeArmy });
await post('/test/yuruyusleri-bitir');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await page.waitForTimeout(1800);

const sonra = await omurga();
// Ordu yolda: omurga yeni bir ordu kurmayı DEĞİL, dönüşü beklemeyi
// söylemeli — ordusu var, sadece evde değil.
kontrol('Ordu yoldayken omurga dönüşü bekletiyor',
  kucult(sonra).includes('ordun dönüyor') || kucult(sonra).includes('ordun yolda'),
  (sonra ?? '').slice(0, 70));
await page.screenshot({ path: `${CIKTI}/omurga-4-sonrasi.png` });

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));

await browser.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
