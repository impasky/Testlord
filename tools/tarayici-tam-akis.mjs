/**
 * Yedi ekranın tamamını gerçek tarayıcıda dolaşan akış testi.
 * API ve arayüz ayakta olmalı. node tools/tarayici-tam-akis.mjs
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://localhost:3000';
const CIKTI = process.env.SMOKE_OUT ?? '.';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;

/** Bir tıklamayı, tetiklediği API yanıtı gelene kadar bekler. Sabit timeout yerine
 *  gerçek yanıta bağlanmak testi hem hızlandırır hem yarış durumunu ortadan kaldırır. */
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

function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const konsolHatalari = [];
page.on('console', (m) => { if (m.type() === 'error') konsolHatalari.push(m.text()); });
page.on('pageerror', (e) => konsolHatalari.push(String(e)));
if (process.env.AYRINTILI) {
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/')) console.log('    -> POST', r.url());
  });
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/api/'))
      console.log('    <-', r.status(), r.url());
  });
}

console.log('Lordlar Çağı — yedi ekran akış testi\n');

await page.goto(WEB, { waitUntil: 'networkidle' });
const damga = Date.now();
await page.fill('input[placeholder="Kara Yusuf"]', `Akis ${damga}`);
await page.fill('input[type=email]', `akis${damga}@lordlar.dev`);
await page.fill('input[type=password]', 'parola1234');
await page.click('button[type=submit]');
await page.waitForSelector('text=Malikâne', { timeout: 15000 });
kontrol('Kayıt ve Malikâne', true);

// Oyuncuyu ilerlet: kaynak + XP (geliştirme uçları)
const token = await page.evaluate(() => localStorage.getItem('lordlar_token'));
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
await fetch(`${API}/api/test/bolgeleri-sifirla`, { method: 'POST', headers: h, body: '{}' });
await fetch(`${API}/api/test/kaynak-ver`, { method: 'POST', headers: h,
  body: JSON.stringify({ altin: 300000, demir: 150000, erzak: 150000 }) });
await fetch(`${API}/api/test/xp-ver`, { method: 'POST', headers: h,
  body: JSON.stringify({ miktar: 60000 }) });
await page.reload({ waitUntil: 'networkidle' });

// Lord: stat dağıtımı
await page.click('button:has-text("Lord")');
await page.waitForSelector('text=Statlar');
const artiButonlari = page.locator('button:has-text("+")');
for (let i = 0; i < 12; i++) await artiButonlari.nth(2).click(); // Liderlik
await tiklaVeBekle(page, 'button:has-text("puanı dağıt")', '/me/stats');
await page.waitForTimeout(400);
await page.screenshot({ path: `${CIKTI}/10-lord.png` });
kontrol('Stat dağıtımı kaydedildi', !(await page.locator('button:has-text("puanı dağıt")').isVisible()));

// Kışla: asker eğit
await page.click('button:has-text("Kışla")');
await page.waitForSelector('text=Asker Eğitimi');
const sayiKutulari = page.locator('input[type=number]');
await sayiKutulari.nth(1).fill('60');
{
  const yanit = page.waitForResponse((r) => r.url().includes('/army/train'), { timeout: 15000 });
  await page.locator('button:has-text("Eğit")').nth(1).click();
  const r = await yanit;
  kontrol('Asker eğitimi kuyruğa girdi', r.ok(), `HTTP ${r.status()}`);
}
await page.screenshot({ path: `${CIKTI}/11-kisla.png` });
kontrol('Kışla ekranı çalışıyor', await page.locator('text=Komuta Kapasitesi').isVisible());

await fetch(`${API}/api/test/kuyruklari-bitir`, { method: 'POST', headers: h, body: '{}' });

// Demirhane: ekipman üret
await page.click('button:has-text("Demirhane")');
await page.waitForSelector('text=Ekipman Üretimi');
await tiklaVeBekle(page, 'button:has-text("üret")', '/items/craft');
await fetch(`${API}/api/test/kuyruklari-bitir`, { method: 'POST', headers: h, body: '{}' });
await page.reload({ waitUntil: 'networkidle' });
await page.click('button:has-text("Demirhane")');
await page.waitForSelector('button:has-text("Kuşan")', { timeout: 10000 }).catch(() => {});
await page.screenshot({ path: `${CIKTI}/12-demirhane.png` });
const kusanVar = (await page.locator('button:has-text("Kuşan")').count()) > 0;
if (!kusanVar) {
  const g = await page.locator('body').innerText();
  console.log('    TANI — envanter satırı:', g.split('\n').find((l) => /envanter/i.test(l)));
  console.log('    TANI — butonlar:', JSON.stringify(await page.locator('button').allInnerTexts()));
  const apiItems = await (await fetch(`${API}/api/items`, { headers: h })).json();
  console.log('    TANI — API envanteri:', apiItems.items?.length);
}
kontrol('Ekipman envanterde göründü', kusanVar);
await tiklaVeBekle(page, 'button:has-text("Kuşan")', '/equip');

// Generaller: kirala ve slota koy
await page.click('button:has-text("Generaller")');
await page.waitForSelector('text=Sahadaki Generaller');
// Bronz generallerden birini kirala (5.000 altın). İlk "Kirala" butonu Altın
// generalinindir ve 100.000 altın ister; oyuncunun bütçesi ona yetmez.
const bronzPanel = page.locator('section:has(h2:text("Bronz Generaller"))');
await tiklaVeBekle(page, bronzPanel.locator('button:has-text("Kirala")').first(), '/hire');
await page.waitForSelector('button:has-text("Slot 1")', { timeout: 10000 });
await tiklaVeBekle(page, page.locator('button:has-text("Slot 1")').first(), '/assign');
await page.waitForTimeout(400);
await page.screenshot({ path: `${CIKTI}/13-generaller.png` });
kontrol('General kiralandı ve sahaya sürüldü',
  (await page.locator('text=Sahadaki Generaller (1/').count()) > 0 ||
  (await page.locator('text=Sahadaki Generaller (2/').count()) > 0);

// Harita: bölge seç, önizle, saldır
await page.click('button:has-text("Harita")');
await page.waitForSelector('text=Dünya Haritası');
await page.screenshot({ path: `${CIKTI}/14-harita.png` });

const harita = await (await fetch(`${API}/api/map`, { headers: h })).json();
const hedef = harita.regions
  .filter((r) => r.ring === 4 && !r.owner && r.type !== 'kale')
  .sort((a, b) => a.distance - b.distance)[0];
await page.locator(`svg g:has(title:text-is("${hedef.name} — ${hedef.type}, seviye ${hedef.level}, sahipsiz, ${hedef.distance} hex uzakta"))`).first().click().catch(async () => {
  await page.locator('svg g').nth(harita.regions.findIndex((r) => r.id === hedef.id)).click();
});
await page.waitForTimeout(600);
kontrol('Bölge paneli açıldı', await page.locator('text=Saldırı ordusu').isVisible().catch(() => false));

const orduKutulari = page.locator('input[type=number]');
const kutuSayisi = await orduKutulari.count();
if (kutuSayisi > 0) await orduKutulari.nth(0).fill('60');
await tiklaVeBekle(page, 'button:has-text("Önizle")', '/battle/preview');
await page.waitForTimeout(300);
await page.screenshot({ path: `${CIKTI}/15-harita-onizleme.png` });
kontrol('Savaş önizlemesi geldi', await page.locator('text=Tahmin:').isVisible().catch(() => false));

await tiklaVeBekle(page, 'button:has-text("Saldır")', '/march');
await page.waitForTimeout(300);
kontrol('Saldırı emri verildi',
  await page.locator('text=Ordu yola çıktı').isVisible().catch(() => false));

await fetch(`${API}/api/test/yuruyusleri-bitir`, { method: 'POST', headers: h, body: '{}' });

// Sıralama
await page.click('button:has-text("Sıralama")');
await page.waitForSelector('text=Şöhret Sıralaması');
await page.screenshot({ path: `${CIKTI}/16-siralama.png` });
kontrol('Şöhret sıralaması yüklendi', await page.locator('table').isVisible());
await page.click('button:has-text("Fetih")');
await page.waitForTimeout(700);
kontrol('Fetih sıralaması yüklendi', await page.locator('text=Fetih Sıralaması').isVisible());
await page.click('button:has-text("Kılıç")');
await page.waitForTimeout(700);
kontrol('Kılıç sıralaması yüklendi', await page.locator('text=Kılıç Sıralaması').isVisible());

// Malikâne: olay akışı doldu mu
await page.click('button:has-text("Malikâne")');
await page.waitForTimeout(900);
await page.screenshot({ path: `${CIKTI}/17-malikane-dolu.png` });
kontrol('Olay akışında kayıt var',
  !(await page.locator('text=Henüz bir şey olmadı').isVisible().catch(() => false)));

kontrol('Konsolda hata yok', konsolHatalari.length === 0);
if (konsolHatalari.length) for (const k of konsolHatalari.slice(0, 5)) console.log('    -', k);

await browser.close();
console.log(hata === 0 ? '\nSONUÇ: yedi ekran da çalışıyor.' : `\nSONUÇ: ${hata} kontrol başarısız.`);
process.exit(hata === 0 ? 0 : 1);
