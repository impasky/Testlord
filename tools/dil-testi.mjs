/**
 * Dil testi.
 *
 * Çekirdek soru: OYUN GERÇEKTEN İNGİLİZCE AÇILIYOR MU. Sözlükte 1597
 * satır olması bir şey ifade etmiyor; ölçülmesi gereken, o satırların
 * EKRANA çıkıp çıkmadığı.
 *
 * Testin asıl değeri üç kırılgan yerde:
 *
 *   1. MODÜL DÜZEYİ SABİTLER. `const KADEME_OZETI = { kamp: t('…') }`
 *      uygulama çizilmeden değerini alıyor. Sözlük eşzamanlı
 *      kurulmasaydı bu sabitler sonsuza kadar Türkçe kalırdı — ve
 *      gerçekten kaldılar, bu test o hatayı yakaladı.
 *   2. SUNUCU METNİ. API Türkçe döndürüyor ve hiç değişmedi; çeviri
 *      istemcide oluyor.
 *   3. GERİ DÜŞME. Çevrilmemiş satır Türkçe kalmalı, boş değil.
 *
 * SADECE GELİŞTİRME. API ve web ayakta olmalı.
 * node tools/dil-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { devices } from 'playwright';
import { tarayiciAc } from './lib/tarayici.mjs';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const sozluk = JSON.parse(
  readFileSync(new URL('../ceviri/metinler.json', import.meta.url), 'utf8'),
);
const cevrilen = Object.values(sozluk).filter((v) => v.en).length;

const ad = benzersizAd('Dil');
const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });

const b = await tarayiciAc();
const konsol = [];

async function ekran(dil) {
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  /*
   * 401, bu testin KENDİ yanlış giriş denemesinden geliyor: sunucu
   * mesajını Türkçe alıp istemcide çevirebildiğimizi ölçmek için
   * bilerek hatalı parola gönderiyoruz. Tarayıcı her başarısız isteği
   * konsola yazıyor; onu gerçek bir hata saymak, testin kendi
   * gürültüsünü hata diye raporlamak olurdu.
   */
  p.on(
    'console',
    (m) =>
      m.type() === 'error' && !/status of 401/.test(m.text()) && konsol.push(`${dil}: ${m.text()}`),
  );
  p.on('pageerror', (e) => konsol.push(`${dil}: PAGEERROR ${e.message}`));
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.evaluate(
    ([t, d]) => {
      localStorage.setItem('lordlar_token', t);
      localStorage.setItem('lordlar_dil', d);
    },
    [token, dil],
  );
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('nav button', { timeout: 30000 });
  await ogreticiyiGec(p);
  await rehberiSustur(p);
  await p.waitForSelector('nav button', { timeout: 30000 });
  // İlk İngilizce açılışta paket indirilip sayfa bir kez yenileniyor.
  await p.waitForTimeout(2500);
  return p;
}

kontrol('Sözlükte çeviri var', cevrilen > 1000, `${cevrilen} satır`);

/*
 * ÇOĞUL BİÇİMLERİ PAKETE GİRİYOR MU.
 *
 * Seçimin kendisi birim testte ölçülüyor (`dil.test.ts`); burada
 * ölçülen, iki biçimin ARAYÜZE GİDEN pakette durup durmadığı. Sözlükte
 * olup pakette olmaması sessiz bir kayıp olurdu: oyun tek biçim görür
 * ve "1 battles" yazardı.
 */
const paket = JSON.parse(
  readFileSync(new URL('../apps/web/src/ceviri/en.json', import.meta.url), 'utf8'),
);
const cogullu = Object.values(paket).filter((v) => v.includes('|'));
kontrol('Çoğul biçimleri pakette', cogullu.length >= 20, `${cogullu.length} kayıt`);
const bolgeAnahtari = Object.entries(sozluk).find(([, v]) => v.tr === '{0} bölge')?.[0];
kontrol(
  'Tekil ve çoğul biçim ayrı',
  paket[bolgeAnahtari] === '{0} region|{0} regions',
  paket[bolgeAnahtari],
);

// --- Türkçe (varsayılan)
const tr = await ekran('tr');
const trNav = (await tr.locator('nav').innerText()).replace(/\s+/g, ' ').trim();
kontrol('Türkçe gezinme çubuğu', /ŞEHİR/i.test(trNav), trNav);
kontrol('Türkçede html lang=tr', (await tr.evaluate(() => document.documentElement.lang)) === 'tr');
const trGovde = (await tr.locator('main').innerText()).replace(/\s+/g, ' ');

// --- İngilizce
const en = await ekran('en');
const enNav = (await en.locator('nav').innerText()).replace(/\s+/g, ' ').trim();
kontrol('İngilizce gezinme çubuğu', /CITY/i.test(enNav) && !/ŞEHİR/i.test(enNav), enNav);
kontrol(
  'İngilizcede html lang=en',
  (await en.evaluate(() => document.documentElement.lang)) === 'en',
);

const enGovde = (await en.locator('main').innerText()).replace(/\s+/g, ' ');
kontrol('Ana ekran metni değişti', enGovde !== trGovde);

/*
 * MODÜL DÜZEYİ SABİT. `KADEME_OZETI` motorda, uygulama çizilmeden
 * değerini alıyor. Bu satır bir kez Türkçe kalmıştı.
 */
kontrol(
  'Modül düzeyindeki sabit de çevrildi',
  /A fire, a few tents/.test(enGovde) && !/Bir ateş, birkaç çadır/.test(enGovde),
  enGovde.includes('A fire') ? 'yerleşim özeti İngilizce' : 'HÂLÂ TÜRKÇE',
);

kontrol('Yerleşim adı çevrildi', /CAMP/i.test(enGovde) && !/KAMP/.test(enGovde));

// --- Sunucu mesajı: API Türkçe döndürüyor, istemci çeviriyor
const sunucuYaniti = await en.evaluate(async (adres) => {
  const r = await fetch(`${adres}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'yok@yok.test', password: 'yanlisparola' }),
  });
  return (await r.json()).error;
}, API);
kontrol(
  'API hâlâ TÜRKÇE döndürüyor (sunucuya dokunulmadı)',
  /[çğıöşü]/i.test(sunucuYaniti ?? ''),
  sunucuYaniti ?? '(boş)',
);

/*
 * Aynı mesaj İSTEMCİDEN geçince İngilizce olmalı. Ölçülen şey tam
 * olarak `client.ts`teki tarama: sunucu Türkçe verdi, arayüz çevirdi.
 */
const istemciden = await en.evaluate(async (adres) => {
  const r = await fetch(`${adres}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'yok@yok.test', password: 'yanlisparola' }),
  });
  const govde = await r.json();
  // client.ts'in kullandığı çeviriciyi doğrudan çağır.
  const mod = await import('/src/lib/dil.tsx');
  return mod.ts(govde.error);
}, API);
kontrol(
  'Sunucu mesajı istemcide İngilizceye dönüyor',
  istemciden !== sunucuYaniti && !/[çğıöşü]/i.test(istemciden ?? ''),
  `${sunucuYaniti} -> ${istemciden}`,
);

await en.locator('nav button').nth(4).click();
await en.waitForTimeout(800);
kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));

// --- Geri düşme: çevrilmemiş satır TÜRKÇE kalıyor, boş değil
const bosMetin = await en.evaluate(() => {
  const gez = (d) => [...d.querySelectorAll('*')].some((e) => e.textContent === 'undefined');
  return gez(document);
});
kontrol('Hiçbir yerde "undefined" yazmıyor', !bosMetin);

await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
