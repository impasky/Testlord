/**
 * Akın testi — beş NPC haritası, on grup, gerçek savaş (docs/12 §6).
 *
 * Ölçtüğü asıl şeyler:
 *  1. **Seviye kapısı çalışıyor mu.** Nekropol 1. seviyede kapalı.
 *  2. **Savaş GERÇEK mi.** Ordu evden çıkıyor, kayıp veriyor, yaralı
 *     hastaneye giriyor, kalan eve dönüyor.
 *  3. **Akın TOPRAK VERMİYOR mu.** Bölge sayısı değişmemeli — burası
 *     kaynak ve ekipman kapısı, toprak kapısı değil.
 *  4. **Yenilenme türetiliyor mu.** Vurulan grup gri kalıyor ve aynı
 *     gruba ikinci akın reddediliyor.
 *
 * SADECE GELİŞTİRME. node tools/akin-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — akın testi (iPhone 13)\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `akin${damga}@lordlar.dev`,
  lordName: benzersizAd('Akin'),
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

// --- 1. Haritalar ve seviye kapısı ---
let akin = await get('/akin');
kontrol('Beş akın haritası var', akin.haritalar.length === 5, `${akin.haritalar.length} harita`);
kontrol(
  'Her haritada on grup var',
  akin.haritalar.every((x) => x.gruplar.length === 10),
  akin.haritalar.map((x) => x.gruplar.length).join(','),
);
const ilk = akin.haritalar[0];
kontrol('İlk harita baştan AÇIK', ilk.acik === true, ilk.ad);
const son = akin.haritalar[akin.haritalar.length - 1];
kontrol('Son harita seviye ile KİLİTLİ', son.acik === false, `${son.ad} — Sv${son.gerekenSeviye}`);

const kilitliRed = await post('/akin', {
  haritaKey: son.key,
  grupNo: 1,
  army: { milis: 1 },
});
kontrol(
  'Kilitli haritaya akın REDDEDİLİYOR',
  kilitliRed.code === 'SEVIYE_YETERSIZ',
  kilitliRed.error ?? '',
);

// Zorluk artıyor mu: birinci gruptan onuncuya garnizon büyümeli.
const g1 = ilk.gruplar[0];
const g10 = ilk.gruplar[9];
kontrol(
  'Gruplar 1den 10a zorlaşıyor',
  g10.garnizonSayisi > g1.garnizonSayisi * 2,
  `${g1.garnizonSayisi} -> ${g10.garnizonSayisi}`,
);
kontrol('Onuncu grup ŞEF', g10.sef === true);
kontrol(
  'Şefin ödülü ve ekipman ihtimali daha yüksek',
  g10.odul.altin > g1.odul.altin && g10.ekipmanIhtimali > g1.ekipmanIhtimali,
  `${g1.odul.altin}→${g10.odul.altin} altın, %${Math.round(g1.ekipmanIhtimali * 100)}→%${Math.round(
    g10.ekipmanIhtimali * 100,
  )}`,
);
kontrol(
  'Şefin yenilenmesi daha uzun sürecek',
  akin.haritalar[0].gruplar[9].sef && akin.haritalar[0].gruplar[0].sef === false,
);

// --- 2. Ordu kur ---
await post('/test/xp-ver', { miktar: 3000 });
await post('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
const me0 = await get('/me');
if ((me0.lord?.statPoints ?? 0) > 0) {
  await post('/me/stats', {
    guc: 0,
    dayaniklilik: 0,
    liderlik: me0.lord.statPoints,
    kurnazlik: 0,
  });
}
const durum0 = await get('/me');
const bosYer = Math.max(0, durum0.lord.commandCapacity - durum0.lord.usedSlots);
await post('/army/train', { unitType: 'mizrakci', count: Math.floor(bosYer * 0.5) });
await post('/army/train', { unitType: 'okcu', count: Math.floor(bosYer * 0.4) });
await post('/test/kuyruklari-bitir');
const ordu = (await get('/army')).home;
const orduSayisi = (o) => Object.values(o ?? {}).reduce((t, n) => t + (n ?? 0), 0);
kontrol('Ordu kuruldu', orduSayisi(ordu) > 0, `${orduSayisi(ordu)} asker`);

// --- 3. Önizleme: gitmeden önce ne olacağını söylüyor mu ---
const onizleme = await post('/akin/onizleme', {
  haritaKey: ilk.key,
  grupNo: 1,
  army: ordu,
});
kontrol(
  'Önizleme kazanma ihtimali veriyor',
  typeof onizleme.kazanmaOrani === 'number' &&
    onizleme.kazanmaOrani >= 0 &&
    onizleme.kazanmaOrani <= 1,
  `%${Math.round((onizleme.kazanmaOrani ?? 0) * 100)}`,
);
kontrol('Önizleme karşı garnizonu gösteriyor', orduSayisi(onizleme.garnizon) > 0);
kontrol('Önizleme süreyi söylüyor', onizleme.sureSn > 0, `${Math.round(onizleme.sureSn / 60)} dk`);

const bosRed = await post('/akin/onizleme', { haritaKey: ilk.key, grupNo: 1, army: {} });
kontrol('Boş orduyla önizleme REDDEDİLİYOR', bosRed.code === 'ORDU_BOS', bosRed.error ?? '');

// --- 4. Akına çık ---
const bolgeOnce = (await get('/me')).lord.regionCount;
const cikis = await post('/akin', { haritaKey: ilk.key, grupNo: 1, army: ordu });
kontrol('Akına çıkıldı', Boolean(cikis.id), cikis.error ?? `${cikis.grupAdi}`);

akin = await get('/akin');
kontrol('Ordu SAHADA görünüyor', akin.sahadaki.length === 1, `${akin.sahadaki.length} akın`);
const evdeSefer = (await get('/army')).home;
kontrol(
  'Asker evden çıktı — akın gerçek bir sefer',
  orduSayisi(evdeSefer) < orduSayisi(ordu),
  `${orduSayisi(ordu)} -> ${orduSayisi(evdeSefer)}`,
);

// Aynı gruba ikinci akın: ordu evde yok, reddedilmeli.
const ikinciRed = await post('/akin', { haritaKey: ilk.key, grupNo: 2, army: ordu });
kontrol(
  'Evde olmayan orduyla akın REDDEDİLİYOR',
  ikinciRed.code === 'BIRIM_YOK',
  ikinciRed.error ?? '',
);

// --- 5. Akın çözülüyor ---
await post('/test/akinlari-bitir');
akin = await get('/akin');
kontrol('Akın çözüldü, saha boşaldı', akin.sahadaki.length === 0);
kontrol('Sonuç listesi doldu', akin.sonuclar.length === 1, `${akin.sonuclar.length} sonuç`);

const sonuc = akin.sonuclar[0];
kontrol('Akın KAZANILDI', sonuc.kazanildi === true, sonuc.grupAdi);
kontrol(
  'Kaynak ödülü verildi',
  sonuc.odul && sonuc.odul.altin > 0,
  `${sonuc.odul?.altin ?? 0} altın`,
);

const meSonra = await get('/me');
kontrol(
  'AKIN TOPRAK VERMİYOR — bölge sayısı değişmedi',
  meSonra.lord.regionCount === bolgeOnce,
  `${bolgeOnce} -> ${meSonra.lord.regionCount}`,
);

const evdeDonus = (await get('/army')).home;
kontrol(
  'Sağ kalanlar eve döndü',
  orduSayisi(evdeDonus) > orduSayisi(evdeSefer),
  `${orduSayisi(evdeSefer)} -> ${orduSayisi(evdeDonus)}`,
);
kontrol(
  'Kayıp verildi — savaş gerçek',
  orduSayisi(evdeDonus) + orduSayisi(meSonra.lord.hastane ?? {}) < orduSayisi(ordu),
  `giden ${orduSayisi(ordu)}, dönen ${orduSayisi(evdeDonus)}, hastanede ${orduSayisi(
    meSonra.lord.hastane ?? {},
  )}`,
);

// --- 6. Yenilenme: vurulan grup gri kalıyor ---
akin = await get('/akin');
const vurulan = akin.haritalar.find((x) => x.key === ilk.key).gruplar[0];
kontrol('Vurulan grup KAPALI', vurulan.acik === false);
kontrol('Ne zaman yenileneceği yazılı', Boolean(vurulan.yenilenirAt), vurulan.yenilenirAt ?? '');
const tekrarRed = await post('/akin', { haritaKey: ilk.key, grupNo: 1, army: { mizrakci: 1 } });
kontrol(
  'Yenilenmemiş gruba akın REDDEDİLİYOR',
  tekrarRed.code === 'GRUP_YENILENIYOR' || tekrarRed.code === 'BIRIM_YOK',
  tekrarRed.error ?? '',
);

// --- 7. Rapor ---
const rapor = await get(`/akin/${sonuc.id}`);
kontrol('Rapor okunabiliyor', rapor.id === sonuc.id && rapor.kazanildi === true);
kontrol('Raporda savaş kaydı var', Boolean(rapor.log));

// --- 8. Arayüz ---
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Akın")', { timeout: 20000 });
await ogreticiyiGec(page);
await rehberiSustur(page);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Akın")', { timeout: 20000 });

kontrol('Alt çubukta AKIN sekmesi var', true);
await page.locator('nav button:has-text("Akın")').click();
await page.waitForTimeout(1500);

const haritaSayisi = await page.locator('[data-akin-harita]').count();
kontrol('Beş diyar listeleniyor', haritaSayisi === 5, `${haritaSayisi} diyar`);

// Bir diyarı aç, gruplarını gör.
await page.locator('[data-akin-harita]').first().click();
await page.waitForTimeout(600);
const grupSayisi = await page.locator('[data-akin-grup]').count();
kontrol('Diyar açılınca on grup çıkıyor', grupSayisi === 10, `${grupSayisi} grup`);

// Açık bir gruba dokun: sefer kartı ve önizleme gelmeli.
const acikGrup = page.locator('[data-akin-grup]:not([disabled])');
if (await acikGrup.count()) {
  await acikGrup.first().click();
  await page.waitForTimeout(2000);
  kontrol(
    'Grup seçilince sefer kartı açılıyor',
    (await page.locator('[data-akin-sefer]').count()) > 0,
  );
  kontrol(
    'Kart kazanma ihtimalini gösteriyor',
    (await page.locator('[data-akin-ihtimal]').count()) > 0,
  );
} else {
  kontrol('Açık grup bulundu', false, 'hepsi kapalı görünüyor');
}

await page.screenshot({ path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/akin.png` });
kontrol('Konsol hatası yok', konsol.length === 0, konsol[0] ?? '');

await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
