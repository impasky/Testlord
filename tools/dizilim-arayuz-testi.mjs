/**
 * Dizilim arayüzünü gerçek bir telefonda dolaşır.
 *
 * Asıl soru: sürükle-bırak DOKUNMATİKTE çalışıyor mu? HTML5 drag-and-drop
 * mobil tarayıcılarda ölü olduğu için ızgara Pointer Events ile elde
 * yazıldı; bu test onu gerçek dokunma olaylarıyla sınıyor. Masaüstünde
 * çalışıp telefonda çalışmayan bir sürükleme, hiç olmamasından kötüdür —
 * oyuncu özelliğin var olduğunu görür ama kullanamaz.
 *
 * API ve arayüz ayakta olmalı. node tools/dizilim-arayuz-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { ekrana, rehberiSustur } from './lib/gezin.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CIKTI = process.env.SMOKE_OUT ?? 'ekran-goruntuleri';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — dizilim arayüzü testi (iPhone 13)\n');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));
page.on('pageerror', (e) => konsol.push(String(e)));

await page.goto(WEB, { waitUntil: 'networkidle' });
const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Dizi ${damga.toString(36).slice(-4)}`);
await page.fill('input[type=email]', `dizi${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('nav button:has-text("Dünya")', { timeout: 15000 });
await ogreticiyiGec(page);
await rehberiSustur(page);

// Ordu kur: dizilim ekranı ancak asker varken anlamlı.
const jeton = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const gonder = (y, g = {}) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: bas, body: JSON.stringify(g) });
// Seviye de veriliyor: komuta kapasitesi Lv1'de küçük ve eğitim
// isteğinin bir kısmı sessizce reddediliyordu — testin ordusu yarım
// kalınca dizilim ekranı da yarım açılıyordu.
for (let i = 0; i < 6; i++) await gonder('/test/xp-ver', { miktar: 200000 });
await gonder('/test/kaynak-ver', { altin: 300000, demir: 150000, erzak: 150000 });
await gonder('/army/train', { unitType: 'mizrakci', count: 20 });
await gonder('/army/train', { unitType: 'kusatma', count: 3 });
await gonder('/test/kuyruklari-bitir');
const evOrdusu = await fetch(`${API}/api/army`, { headers: bas })
  .then((r) => r.json())
  .then((a) => a.home ?? {});
kontrol(
  'test ordusu kuruldu',
  Object.values(evOrdusu).some((n) => n > 0),
  JSON.stringify(evOrdusu),
);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* --- Haritada bir hedef aç --- */
// Hedefi ürünün KENDİ önerisinden alıyoruz: rastgele bir bölge korumalı ya
// da başkasının olabilir ve saldırı paneli hiç açılmaz.
const oneri = await fetch(`${API}/api/map`, { headers: bas }).then((r) => r.json());
const hedefAd = oneri?.oneri?.name ?? null;
kontrol('oyunun önerdiği bir hedef var', Boolean(hedefAd), hedefAd ?? 'yok');

await ekrana(page, 'harita', 2000);
// Bölgeler artık gerçek <button>; adları erişilebilir isimde duruyor.
// Görünür etiket yakınlık kademesine göre gizlenebiliyor, o yüzden
// metne değil erişilebilir isme bakıyoruz.
const bolgeDugmesi = page.getByRole('button', {
  name: new RegExp(`^${(hedefAd ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`),
});
if (await bolgeDugmesi.count()) {
  await bolgeDugmesi.first().click();
  await page.waitForTimeout(1500);
}
// "Hepsi" ile orduyu seç.
const hepsi = page.locator('[data-rehber="harita-hepsi"]');
if (await hepsi.count()) {
  await hepsi.first().click();
  await page.waitForTimeout(1500);
}

const katlanir = page.locator('[data-rehber="harita-dizilim"]');
kontrol('dizilim düğmesi saldırı panelinde var', (await katlanir.count()) > 0);

if (await katlanir.count()) {
  await katlanir.first().click();
  await page.waitForTimeout(700);

  const kareler = page.locator('[data-kare]');
  kontrol('16 kare çizildi', (await kareler.count()) === 16, `${await kareler.count()} kare`);

  const havuz = page.locator('[data-birim]');
  kontrol('havuzda birim var', (await havuz.count()) > 0, `${await havuz.count()} birim`);

  /* --- DOKUNMATİK SÜRÜKLEME --- */
  const mancinik = page.locator('[data-birim="kusatma"]').first();
  const onKare = page.locator('[data-kare="1"]'); // satır 1 (ön hat)
  if ((await mancinik.count()) && (await onKare.count())) {
    // Ölçmeden ÖNCE görünür alana getir: boundingBox sayfa koordinatı
    // veriyor, ekran dışındaki bir noktaya fare gönderince olay hiçbir
    // öğeye düşmüyor ve sürükleme sessizce çalışmıyor gibi görünüyordu.
    // HAVUZU görünür alana getir: ızgara hemen altında olduğu için
    // ikisi birden ekranda kalıyor. Hedef kareyi kaydırmak havuzu
    // yukarı taşırıp ekran dışına atıyordu ve fare basışı hiçbir öğeye
    // düşmüyordu — sürükleme çalışmıyor gibi görünüyordu.
    await mancinik.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const a = await mancinik.boundingBox();
    const b = await onKare.boundingBox();
    const ekran = page.viewportSize();
    kontrol(
      'sürükleme için havuz ve hedef aynı anda ekranda',
      a.y >= 0 && a.y + a.height <= ekran.height && b.y >= 0 && b.y + b.height <= ekran.height,
      `havuz y=${Math.round(a.y)} hedef y=${Math.round(b.y)} ekran=${ekran.height}`,
    );
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    // Basıldıktan SONRA yeniden ölç: seçim ekranda bir şeyi
    // oynatıyorsa hedefin yeri değişmiş olur ve bırakma boşa düşer.
    // (İlk hâlinde tam bu oluyordu — ipucu satırı ızgarayı itiyordu.)
    const b2 = await onKare.boundingBox();
    kontrol(
      'birim seçilince ızgara yerinden oynamıyor',
      Math.abs(b2.y - b.y) < 2,
      `önce y=${Math.round(b.y)} sonra y=${Math.round(b2.y)}`,
    );
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(600);

    const doldu = await onKare.getAttribute('aria-label');
    kontrol(
      'sürükleyerek bırakılan birim kareye yerleşti',
      /Mancınık/.test(doldu ?? ''),
      doldu ?? '',
    );

    // Ceza canlı görünüyor mu — asıl öğretici bu.
    const govde = await page.locator('body').innerText();
    kontrol(
      'ön hattaki mancınığın cezası savaştan ÖNCE ekranda',
      /Mancınık.*ideal yeri/.test(govde),
      (govde.match(/Mancınık[^\n]*/) ?? [''])[0].slice(0, 80),
    );
  } else {
    kontrol('sürükleyerek bırakılan birim kareye yerleşti', false, 'mancınık ya da kare yok');
    kontrol('ön hattaki mancınığın cezası savaştan ÖNCE ekranda', false);
  }

  /* --- DOKUN-DOKUN (sürükleyemeyen oyuncu için) --- */
  const mizrak = page.locator('[data-birim="mizrakci"]').first();
  const bosKare = page.locator('[data-kare="2"]');
  if ((await mizrak.count()) && (await bosKare.count())) {
    await bosKare.scrollIntoViewIfNeeded();
    await mizrak.click();
    await page.waitForTimeout(300);
    await bosKare.click();
    await page.waitForTimeout(500);
    const etiket = await bosKare.getAttribute('aria-label');
    kontrol('dokun-dokun ile de yerleşiyor', /Mızrakçı/.test(etiket ?? ''), etiket ?? '');
  } else {
    kontrol('dokun-dokun ile de yerleşiyor', false, 'birim ya da kare yok');
  }

  /* --- KAYDIRMA seçimi bozmamalı --- */
  // Oyuncunun raporu: "okçu vs seçip ekranı aşağı kaydırınca seçim
  // gidiyor." Kaydırma bir niyet değil; hiçbir şey yapmamalı.
  const secilecek = page.locator('[data-birim]').first();
  await secilecek.scrollIntoViewIfNeeded();
  await secilecek.click();
  await page.waitForTimeout(300);
  const secildiMi = (await page.locator('body').innerText()).includes('elinde');
  kontrol('havuzdan birim seçildi', secildiMi);

  // Parmakla sayfayı kaydır: ızgaranın ÜSTÜNDEN geçerek.
  const izgara = await page.locator('[data-kare="8"]').boundingBox();
  await page.mouse.move(izgara.x + izgara.width / 2, izgara.y + izgara.height / 2);
  await page.mouse.down();
  await page.mouse.move(izgara.x + izgara.width / 2, izgara.y - 220, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  kontrol(
    'kaydırdıktan sonra seçim DURUYOR',
    (await page.locator('body').innerText()).includes('elinde'),
  );

  /* --- Taktik kilidi sebebini yazıyor mu --- */
  const govde2 = await page.locator('body').innerText();
  kontrol('taktik listesi görünüyor', /Kalkan Duvarı|Hilal Düzeni/.test(govde2));
  kontrol(
    'kilitli taktik sebebini yazıyor',
    /Kilitli —/.test(govde2),
    (govde2.match(/Kilitli — [^\n]*/) ?? [''])[0].slice(0, 70),
  );

  /* --- Önerilen düzen düğmesi --- */
  await page.locator('button:has-text("Önerilen düzen")').first().click();
  await page.waitForTimeout(600);
  const sonra = await page.locator('[data-kare="1"]').getAttribute('aria-label');
  kontrol(
    'önerilen düzen mancınığı ön hattan kaldırdı',
    !/Mancınık/.test(sonra ?? ''),
    sonra ?? '',
  );

  // Izgarayı ekranın ortasına getirip çek: raporu okuyan insan
  // dizilimin kendisini görmeli, panelin üst yarısını değil.
  await page.locator('[data-kare="8"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${CIKTI}/dizilim.png` });
}

/* --- Savunma düzeni Malikâne'de --- */
await ekrana(page, 'malikane', 1800);
const savunma = await page.locator('body').innerText();
// Başlık CSS ile büyütülüyor ve innerText büyük hâlini veriyor. /i
// bayrağı işe yaramaz: JS'te 'İ' (U+0130) 'i'ye katlanmıyor — Türkçe
// büyük-İ tuzağı. O yüzden noktalı harfsiz bir parça aranıyor.
kontrol('Malikâne’de savunma düzeni kartı var', /SAVUNMA DÜZEN/.test(savunma));
const duzenleDugme = page.locator('[data-rehber="savunma-duzeni"]');
if (await duzenleDugme.count()) {
  await duzenleDugme.first().click();
  await page.waitForTimeout(900);
  kontrol('savunma dizilimi açılıyor', (await page.locator('[data-kare]').count()) === 16);
  const kaydetDugme = page.locator('button:has-text("Savunma düzenini kaydet")');
  kontrol('kaydet düğmesi var', (await kaydetDugme.count()) > 0);
  await page.screenshot({ path: `${CIKTI}/savunma-duzeni.png` });
} else {
  kontrol('savunma dizilimi açılıyor', false, 'düzenle düğmesi yok');
  kontrol('kaydet düğmesi var', false);
}

kontrol('konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
