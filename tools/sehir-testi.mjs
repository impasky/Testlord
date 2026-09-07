/**
 * Şehir sayfası testi — yerleşim kademesi, boş arsa, inşa.
 *
 * Ölçtüğü asıl şey: KADEME BİR TAVAN. Kamptaki lord binalarını
 * yükseltemiyor; bir köy fethedince tavan açılıyor ve aynı bina
 * dikilebilir hâle geliyor. Fetihin karşılığı bu ve dokümanda yazılı
 * olması yetmez, çalışıyor olması gerekir (docs/12 §3.3).
 *
 * SADECE GELİŞTİRME. node tools/sehir-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';
import { merkezUzakliklari } from './lib/harita.mjs';
import { yerlesimAl } from './lib/koy.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — şehir testi (iPhone 13)\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `sehir${damga}@lordlar.dev`,
  lordName: `Sehir ${damga.toString(36).slice(-4)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

// --- 1. Kamp: az bina, tavan 1 ---
let sehir = await get('/sehir');
kontrol('Yeni lord KAMPTA', sehir.yerlesim.kademe === 'kamp', sehir.yerlesim.ad);
kontrol('Kampta bina tavanı 1', sehir.yerlesim.binaTavani === 1);
// Kampta yalnız KAMP kademesindekiler: iki bina (malikâne, kışla) ve üç
// seviyesiz bilgi yapısı. Üretim, savunma ve kapasite binaları köyü ve
// kasabayı bekliyor — bu sayı o kuralı ölçüyor, bir estetik tercih değil.
kontrol(
  'Kampta yalnız kamp kademesi görünüyor',
  sehir.binalar.length === 5,
  `${sehir.binalar.length} yapı: ${sehir.binalar.map((b) => b.ad).join(', ')}`,
);
kontrol(
  'Başlangıçta malikâne ve kışla dikili',
  sehir.binalar.find((b) => b.key === 'malikane')?.seviye === 1 &&
    sehir.binalar.find((b) => b.key === 'kisla')?.seviye === 1,
);

// Kademe TAVAN: kampta yükseltme reddedilmeli.
const redKamp = await post('/sehir/bina', { key: 'kisla' });
kontrol(
  'Kampta yükseltme REDDEDİLİYOR — kademe bir tavan',
  redKamp.code === 'KADEME_TAVANI',
  redKamp.error ?? JSON.stringify(redKamp).slice(0, 60),
);

// Seviyesiz yapı inşa gerektirmiyor: ilan tahtası dikilmez.
const pano = sehir.binalar.find((b) => b.key === 'gorev_panosu');
kontrol('Seviyesiz yapı hep orada', pano?.seviye === 1 && pano?.yukseltilebilir === false);

// --- 2. Bir köy al: kademe açılsın ---
await post('/test/bolgeleri-sifirla');
await post('/test/kaynak-ver', { altin: 200000, demir: 100000, erzak: 100000 });
const harita = await get('/map');
const kenar = new Set(
  [...merkezUzakliklari(harita.regions)].filter(([, d]) => d >= 4).map(([id]) => id),
);
const koy = harita.regions.find((r) => r.type === 'koy' && !r.owner && kenar.has(r.id));
kontrol('Haritada alınabilir bir köy var', Boolean(koy), koy?.name ?? 'yok');

const oneri = harita.oneri;
if (oneri?.eksik?.karsilanabilir) {
  await post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
  await post('/test/kuyruklari-bitir');
}
const ordu = (await get('/army')).home;
await post('/march', { toRegionId: koy.id, army: ordu });
await post('/test/yuruyusleri-bitir');
const me = await get('/me');
kontrol('Köy alındı', me.lord.regionCount >= 1, `${me.lord.regionCount} bölge`);

// --- 3. Başkent taşındı mı: kademe köy oldu mu ---
sehir = await get('/sehir');
kontrol(
  'Köy alınınca yerleşim KÖY oluyor',
  sehir.yerlesim.kademe === 'koy',
  `${sehir.yerlesim.ad}${sehir.yerlesim.baskent ? ` (${sehir.yerlesim.baskent.ad})` : ''}`,
);
kontrol('Köyde bina tavanı 2', sehir.yerlesim.binaTavani === 2);
kontrol('Köyde daha çok yapı görünüyor', sehir.binalar.length > 4, `${sehir.binalar.length} yapı`);

// --- 4. İnşaat: dikilmemiş bir binayı dik ---
const arsa = sehir.binalar.find((b) => b.seviye === 0 && b.seviyeli && b.yukseltilebilir);
kontrol('Dikilmeyi bekleyen bir arsa var', Boolean(arsa), arsa?.ad ?? 'yok');
const yap = await post('/sehir/bina', { key: arsa.key });
kontrol('İnşaat kuyruğa girdi', yap.queued === true, yap.error ?? '');
await post('/test/kuyruklari-bitir');
sehir = await get('/sehir');
kontrol(
  'İnşaat bitince bina dikildi',
  sehir.binalar.find((b) => b.key === arsa.key)?.seviye === 1,
  arsa.ad,
);

// Aynı bina ikinci seviyeye: köyde tavan 2, izin verilmeli.
const ikinci = await post('/sehir/bina', { key: arsa.key });
kontrol('Köyde ikinci seviye AÇIK', ikinci.queued === true, ikinci.error ?? '');
await post('/test/kuyruklari-bitir');
sehir = await get('/sehir');
const sonSeviye = sehir.binalar.find((b) => b.key === arsa.key)?.seviye;
kontrol('Bina seviye 2 oldu', sonSeviye === 2, `seviye ${sonSeviye}`);
const ucuncu = await post('/sehir/bina', { key: arsa.key });
kontrol(
  'Köyde üçüncü seviye KAPALI — tavan çalışıyor',
  ucuncu.code === 'KADEME_TAVANI',
  ucuncu.error ?? '',
);

// --- 4b. Başkenti taşı: fetih bir KAZANÇ olsun ---
//
// Daha büyük bir yerleşim fethetmek ancak taşınabilirsen bir şey ifade
// ediyor; taşınmak da ancak binalar seninle gelirse bir kayıp olmuyor.
// İkisini birden ölçüyoruz (docs/12 §2.4).
const oncekiBinalar = Object.fromEntries(
  sehir.binalar.filter((x) => x.seviye > 0).map((x) => [x.key, x.seviye]),
);
await yerlesimAl(API, token, 'sehir');
sehir = await get('/sehir');
kontrol(
  'Şehir fethedilince "taşınabilirsin" çıkıyor',
  sehir.tasinabilir.length > 0,
  sehir.tasinabilir.map((t) => `${t.ad} (${t.kademeAdi})`).join(', ') || 'liste boş',
);
// Sıra `packages/shared/src/bina.ts` KADEMELER ile aynı; liste yalnız
// yukarı doğru olmalı — aynısına ya da küçüğüne "taşın" demek bir hata.
const KADEME_SIRA = ['kamp', 'koy', 'kasaba', 'sehir', 'kale', 'metropol'];
kontrol(
  'Taşınma listesi yalnız DAHA İYİSİNİ gösteriyor',
  sehir.tasinabilir.every(
    (t) => KADEME_SIRA.indexOf(t.kademe) > KADEME_SIRA.indexOf(sehir.yerlesim.kademe),
  ),
  sehir.tasinabilir.map((t) => t.kademe).join(', '),
);

const hedefBolge = sehir.tasinabilir[0];
const tasindi = await post('/sehir/baskent', { bolgeId: hedefBolge.bolgeId });
kontrol('Başkent taşındı', tasindi.tasindi === true, tasindi.error ?? '');

sehir = await get('/sehir');
kontrol(
  'Taşınınca kademe yükseldi',
  sehir.yerlesim.kademe === hedefBolge.kademe,
  `${sehir.yerlesim.ad} — tavan ${sehir.yerlesim.binaTavani}`,
);
kontrol(
  'Binalar lordla birlikte taşındı — hiçbir seviye kaybolmadı',
  Object.entries(oncekiBinalar).every(
    ([k, sv]) => (sehir.binalar.find((x) => x.key === k)?.seviye ?? 0) >= sv,
  ),
  Object.keys(oncekiBinalar).join(', '),
);
kontrol(
  'Yeni kademede kasaba yapıları açıldı',
  sehir.binalar.some((x) => x.key === 'karargah'),
  sehir.binalar.map((x) => x.key).join(', '),
);
kontrol('Taşındıktan sonra liste boşaldı', sehir.tasinabilir.length === 0);
const tekrar = await post('/sehir/baskent', { bolgeId: hedefBolge.bolgeId });
kontrol('Aynı yere yeniden taşınmak reddediliyor', Boolean(tekrar.error), tekrar.error ?? '');

// --- 4c. Bina seviyesi bir işe YARIYOR mu (Y4) ---
//
// Bir binanın seviyesi ekranda görünüp hiçbir sayıya dokunmuyorsa o bina
// dekordur. Burada ölçülen şey tam olarak bu: malikâne depoyu, demirhane
// ekipman kademesini gerçekten değiştiriyor mu (docs/12 §4).
const meOnce = await get('/me');
kontrol(
  'Lord durumu bina seviyelerini taşıyor',
  meOnce.lord.binalar && typeof meOnce.lord.binalar === 'object',
  JSON.stringify(meOnce.lord.binalar ?? null),
);

const depoOnce = meOnce.lord.storageCapacity;
const malikaneOnce = sehir.binalar.find((x) => x.key === 'malikane')?.seviye ?? 0;
await post('/sehir/bina', { key: 'malikane' });
await post('/test/kuyruklari-bitir');
const meSonra = await get('/me');
kontrol(
  'Malikâne yükselince DEPO büyüyor',
  meSonra.lord.storageCapacity > depoOnce,
  `${depoOnce} -> ${meSonra.lord.storageCapacity} (malikâne ${malikaneOnce} -> ${
    meSonra.lord.binalar.malikane
  })`,
);

// Şehir kartı seviye değil ETKİ yazmalı: "Depo tabanı 15.000 → 35.000".
sehir = await get('/sehir');
const malikaneKart = sehir.binalar.find((x) => x.key === 'malikane');
kontrol(
  'Kart etkinin SAYISINI veriyor, seviyeyi değil',
  malikaneKart.etkiSimdi > malikaneKart.seviye,
  `etkiSimdi=${malikaneKart.etkiSimdi} seviye=${malikaneKart.seviye}`,
);
kontrol(
  'Kart bir sonraki seviyenin etkisini de veriyor',
  malikaneKart.etkiSonra > malikaneKart.etkiSimdi,
  `${malikaneKart.etkiSimdi} -> ${malikaneKart.etkiSonra}`,
);

// Demirhane ekipman kademesine kapı: kilidin SEBEBİ ayrı ayrı geliyor.
await post('/test/xp-ver', { miktar: 4000000 });
const esyalar = await get('/items');
const t5 = esyalar.tiers.find((t) => t.tier === 5);
kontrol('T5 için lord seviyesi yetiyor', t5.seviyeYetiyor === true, `Sv${t5.unlockLevel}`);
kontrol(
  'T5 DEMİRHANE yüzünden kilitli — kilidin sebebi ayrı',
  t5.demirhaneYetiyor === false && t5.unlocked === false,
  `gereken demirhane ${t5.gerekenDemirhane}`,
);
const t5Red = await post('/items/craft', { tier: 5, slot: 'silah' });
kontrol(
  'Sunucu da demirhane yüzünden reddediyor',
  t5Red.code === 'DEMIRHANE_YETERSIZ',
  t5Red.error ?? '',
);
const t1 = esyalar.tiers.find((t) => t.tier === 1);
kontrol('T1 her zaman açık — öğretici çıkmaza girmesin', t1.unlocked === true);

// --- 5. Arayüz ---
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await ogreticiyiGec(page);
await rehberiSustur(page);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await page.waitForTimeout(1500);

kontrol(
  'Şehir ANA SAYFA: açılışta orada',
  (await page.locator('nav button[aria-current=page]').innerText()).includes('ŞEHİR'),
);
const yapiSayisi = await page.locator('[data-bina]').count();
kontrol('Yerleşim haritasında yapılar çizili', yapiSayisi > 4, `${yapiSayisi} yapı`);
kontrol(
  'Kâhya ve omurga ana sayfada',
  (await page.locator('main').innerText()).includes('ŞİMDİ NE YAPMALISIN'),
);

// Bir yapıya dokun: kartı açılmalı.
await page.locator('[data-bina]').first().click();
await page.waitForTimeout(600);
const govde = await page.locator('main').innerText();
kontrol('Yapıya dokununca kartı açılıyor', /Seviye|boş arsa|yapı/i.test(govde));

await page.screenshot({ path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/sehir.png` });
kontrol('Konsol hatası yok', konsol.length === 0, konsol[0] ?? '');

await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
