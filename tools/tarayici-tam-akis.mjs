/**
 * Yedi ekranın tamamını gerçek tarayıcıda, TELEFON boyutunda dolaşır.
 *
 * Uygulama mobil-öncelikli: 4 ana sekme alt gezinmede, kalan üçü menü
 * sayfasında. Test bu yapıya göre gezinir.
 *
 * API ve arayüz ayakta olmalı. node tools/tarayici-tam-akis.mjs
 */
import { chromium, devices } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { ekrana, kapida, rehberiSustur } from './lib/gezin.mjs';
import { merkezUzakliklari } from './lib/harita.mjs';
import { binalariDik, yerlesimAl } from './lib/koy.mjs';

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

/** Tıklamayı, tetiklediği API yanıtı gelene kadar bekler. */
async function tiklaVeBekle(page, secici, yolParcasi) {
  const yanit = page.waitForResponse(
    (r) => r.url().includes(yolParcasi) && r.request().method() === 'POST',
    { timeout: 15000 },
  );
  const hedef = typeof secici === 'string' ? page.locator(secici).first() : secici;
  await hedef.click();
  const r = await yanit;
  if (!r.ok()) throw new Error(`${yolParcasi} -> ${r.status()}: ${await r.text()}`);
  return r;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

const konsolHatalari = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsolHatalari.push(m.text());
});
page.on('pageerror', (e) => konsolHatalari.push(String(e)));
page.on('response', (r) => {
  if (r.status() === 404) konsolHatalari.push(`404: ${r.url()}`);
});

/**
 * Bir ekrana geçer. Çubukta mı menüde mi olduğunu `lib/gezin.mjs` biliyor;
 * Demirhane menüye taşındığında bu araç değişmedi.
 */
const EKRAN_ANAHTARI = {
  Malikâne: 'malikane',
  Görevler: 'gorevler',
  Kışla: 'kisla',
  Ordu: 'kisla',
  Harita: 'harita',
  Dünya: 'harita',
  Akın: 'akin',
  Demirhane: 'demirhane',
  Olaylar: 'olaylar',
  Generaller: 'generaller',
  İttifak: 'ittifak',
  Lord: 'lord',
  Sıralama: 'siralama',
};
async function sekme(ad) {
  await ekrana(page, EKRAN_ANAHTARI[ad] ?? ad, 900);
}

console.log('Lordlar Çağı — mobil akış testi (iPhone 13)\n');

await page.goto(WEB, { waitUntil: 'networkidle' });
kontrol('Giriş ekranı açıldı', (await page.title()) === 'Lordlar Çağı');

const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Akis ${damga.toString(36).slice(-4)}`);
await page.fill('input[type=email]', `akis${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 15000 });
// Öğretici tam ekran açılıyor ve arkasını tıklatmıyor: gerçek oyuncu
// gibi geçiyoruz (bkz. tools/lib/ogretici.mjs).
await ogreticiyiGec(page);
await rehberiSustur(page);
kontrol('Kayıt olup oyuna girildi', true);

const token = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) });

await post('/test/bolgeleri-sifirla');
await post('/test/kaynak-ver', { altin: 300000, demir: 150000, erzak: 150000 });
await post('/test/xp-ver', { miktar: 60000 });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 15000 });

// Sabit çubuklar içeriği kesmemeli
const tasma = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
kontrol('Yatay taşma yok', !tasma);
await page.screenshot({ path: `${CIKTI}/mob-1-malikane.png` });

// --- Lord: stat dağıtımı (menüden) ---
await sekme('Lord');
await page.waitForSelector('text=Nitelikler', { timeout: 8000 });
const artilar = page.locator('button:has-text("+")');
for (let i = 0; i < 10; i++) await artilar.nth(2).click();
await tiklaVeBekle(page, 'button:has-text("puanı dağıt")', '/me/stats');
await page.waitForTimeout(600);
kontrol(
  'Stat dağıtımı kaydedildi',
  !(await page.locator('button:has-text("puanı dağıt")').isVisible()),
);
await page.screenshot({ path: `${CIKTI}/mob-2-lord.png` });

/*
 * Şehri BURADA kuruyoruz, stat testinden SONRA.
 *
 * Şehirdeki kapılar yerleşim kademesine bağlı açılıyor (docs/12 §3.3):
 * kamptaki lordun demirhanesi yok ve bu ürünün doğru davranışı. Ama
 * bütün kapıları gezen bir araç "oyunu oynayan" lordu canlandırmalı.
 *
 * Sıra önemli: yardımcı stat puanlarını Liderliğe yatırıyor (büyük ordu
 * için kapasite lazım) ve önce çağrılsaydı yukarıdaki "puanı dağıt"
 * ölçümü dağıtacak puan bulamazdı. İlk denemede tam bu oldu.
 */
await yerlesimAl(API, token, 'sehir');
await binalariDik(API, token);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 15000 });

// --- Kışla: asker eğit ---
await sekme('Kışla');
await page.waitForSelector('text=Asker Eğitimi', { timeout: 8000 });
{
  const yanit = page.waitForResponse((r) => r.url().includes('/army/train'), { timeout: 15000 });
  await page.locator('button:has-text("Mızrakçı eğit")').first().click();
  const r = await yanit;
  kontrol('Asker eğitimi kuyruğa girdi', r.ok(), `HTTP ${r.status()}`);
}
await page.screenshot({ path: `${CIKTI}/mob-3-kisla.png` });
await post('/test/kuyruklari-bitir');

// --- Demirhane: üret ve kuşan ---
await sekme('Demirhane');
/*
 * Seçiciler PANEL İÇİNE daraltıldı.
 *
 * Kapı mimarisinin tuzağı: panel açıkken ev ekranı (Lord) arkada duruyor
 * ve DOM'da hâlâ var. `button:has-text("Kuşan")` hem Demirhane
 * panelindeki düğmeyi hem Lord ekranındaki ekipman yuvasını buluyordu;
 * `.first()` arkadakini seçiyor ve perdeye çarpıyordu.
 *
 * Ayrıca üretim düğmesi DAR seçilmeli: alt sekme şeridinde "ÜRETİM"
 * düğmesi de var ve has-text("üret") önce onu buluyor.
 */
const uretDugmesi = kapida(page, 'button').filter({ hasText: /ÜRET$/i });
await uretDugmesi.first().waitFor({ timeout: 8000 });
await tiklaVeBekle(page, uretDugmesi.first(), '/items/craft');
await post('/test/kuyruklari-bitir');
await page.reload({ waitUntil: 'networkidle' });
await sekme('Demirhane');
await kapida(page, 'button:has-text("Envanter")').first().click();
await kapida(page, 'button:has-text("Kuşan")')
  .first()
  .waitFor({ timeout: 10000 })
  .catch(() => {});
kontrol('Ekipman envanterde göründü', (await kapida(page, 'button:has-text("Kuşan")').count()) > 0);
await tiklaVeBekle(page, kapida(page, 'button:has-text("Kuşan")').first(), '/equip');
await page.screenshot({ path: `${CIKTI}/mob-4-demirhane.png` });

// --- Generaller ---
await sekme('Generaller');
await kapida(page, 'text=Sahadaki Generaller').first().waitFor({ timeout: 8000 });
// Üç nadirlik rafı alt sekmelere bölündü; bronz artık kendi sekmesinde.
await kapida(page, 'button:has-text("Bronz")').first().click();
await page.waitForTimeout(400);
await tiklaVeBekle(page, kapida(page, 'button:has-text("Kirala")').first(), '/hire');
await kapida(page, 'button:has-text("Slot 1")').first().waitFor({ timeout: 10000 });
await tiklaVeBekle(page, kapida(page, 'button:has-text("Slot 1")').first(), '/assign');
kontrol('General kiralandı ve sahaya sürüldü', true);
await page.screenshot({ path: `${CIKTI}/mob-5-generaller.png` });

// --- Harita: bölge seç, önizle, saldır ---
await sekme('Harita');
await page.waitForSelector('text=/lorddan/', { timeout: 8000 });
await page.screenshot({ path: `${CIKTI}/mob-6-harita.png` });

// Harita "yaşayan bir yer" gibi görünmeli: kaç lord olduğu, tahtın kimde
// olduğu ve diyarda neler olduğu yazılı olmalı. (docs/08 İ5)
kontrol(
  'Harita başlığı dünyanın kaç kişilik olduğunu söylüyor',
  await page
    .locator('text=/lorddan/')
    .first()
    .isVisible()
    .catch(() => false),
);
kontrol(
  'Taht sahibi başlıkta yazıyor',
  (await page.locator('text=/taht sahipsiz/').count()) > 0 ||
    (await page.locator('svg text').count()) > 0,
);

const harita = await (await fetch(`${API}/api/map`, { headers: h })).json();
// Eski `ring === 4` ölçütünün karşılığı: Taht Kalesi'nden en az 4 adım
// uzaktaki bölgeler. Altıgen ızgara kalktı, ölçü komşuluk grafiğinden
// türüyor (docs/12 §1).
const kenar = new Set(
  [...merkezUzakliklari(harita.regions)].filter(([, d]) => d >= 4).map(([id]) => id),
);
const hedef = harita.regions
  .filter((r) => kenar.has(r.id) && !r.owner && r.type !== 'kale')
  .sort((a, b) => a.distance - b.distance)[0];
// Bölgeler artık SVG grubu değil gerçek <button>; kimliğiyle bulunuyor.
// Ada göre aramıyoruz çünkü görünür etiket yakınlık kademesine göre
// gizlenebiliyor — kimlik her ölçekte duruyor.
await page.locator(`[data-bolge="${hedef.id}"]`).click();
await page.waitForTimeout(900);
kontrol(
  'Bölge alt sayfası açıldı',
  await page
    .locator('text=Saldırı ordusu')
    .isVisible()
    .catch(() => false),
);

// Önizleme artık ayrı bir düğme değil: ordu seçilince kendiliğinden gelir.
const onizlemeSozu = page.waitForResponse((r) => r.url().includes('/battle/preview'), {
  timeout: 15000,
});
await page.locator('button:has-text("Hepsi")').first().click();
await onizlemeSozu;
await page.waitForTimeout(600);
kontrol(
  'Savaş önizlemesi geldi',
  await page
    .locator('text=Tahmin:')
    .isVisible()
    .catch(() => false),
);
kontrol(
  'Önizleme kazanç ve bedeli söylüyor',
  (await page
    .locator('text=Kazanırsan')
    .isVisible()
    .catch(() => false)) ||
    (await page
      .locator('text=Kazansan bile')
      .isVisible()
      .catch(() => false)),
);
await page.screenshot({ path: `${CIKTI}/mob-7-saldiri.png` });

await tiklaVeBekle(page, 'button:has-text("Saldır")', '/march');
await page.waitForTimeout(600);
kontrol(
  'Saldırı emri verildi',
  await page
    .locator('text=Ordu yola çıktı')
    .isVisible()
    .catch(() => false),
);
await post('/test/yuruyusleri-bitir');

// --- Sıralama ---
await sekme('Sıralama');
await kapida(page, 'text=Şöhret Sıralaması').first().waitFor({ timeout: 8000 });
kontrol('Şöhret sıralaması yüklendi', true);
for (const t of ['Fetih', 'Kılıç']) {
  await kapida(page, `button:has-text("${t}")`).first().click();
  await page.waitForTimeout(700);
  kontrol(
    `${t} sıralaması yüklendi`,
    await kapida(page, `text=${t} Sıralaması`).first().isVisible(),
  );
}
await page.screenshot({ path: `${CIKTI}/mob-8-siralama.png` });

// --- Malikâne: olay akışı doldu mu ---
await sekme('Malikâne');
await page.waitForTimeout(900);
kontrol(
  'Olay akışında kayıt var',
  !(await page
    .locator('text=Henüz bir şey olmadı')
    .isVisible()
    .catch(() => false)),
);

kontrol('Konsolda hata yok', konsolHatalari.length === 0, konsolHatalari[0] ?? '');
if (konsolHatalari.length) for (const k of konsolHatalari.slice(0, 5)) console.log('    -', k);

await browser.close();
console.log(
  hata === 0 ? '\nSONUÇ: yedi ekran da mobilde çalışıyor.' : `\nSONUÇ: ${hata} kontrol başarısız.`,
);
process.exit(hata === 0 ? 0 : 1);
