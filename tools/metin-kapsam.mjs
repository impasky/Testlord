/**
 * ÇEVİRİ KAPSAMI — ekranda görünen her metin sözlükte var mı.
 *
 * `metin-cikar.mjs` kaynağı okuyor; bu araç OYUNU okuyor. İkisi ayrı
 * yönden bakıyor ve asıl soruya ancak birlikte cevap veriyorlar: "çeviri
 * dosyası tam mı?" Çıkarıcının kaçırdığı bir dizge kaynakta görünmez ama
 * ekranda görünür — ve çevrilmemiş tek bir düğme, dil ayarını yarım
 * bırakır.
 *
 * Dinamik metin (lord adı, sayı, saat) elenmiyor; eleyemeyiz de. O yüzden
 * çıktı bir HATA LİSTESİ değil, GÖZDEN GEÇİRME listesi: kalanları insan
 * okuyup "bu oyuncu adı" ya da "bu kaçmış" diye ayırıyor.
 */
import { tarayiciAc } from './lib/tarayici.mjs';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { ekrana, CUBUK, rehberiSustur } from './lib/gezin.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { bolgeKazandir } from './lib/ilerlet.mjs';
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';

const sozluk = JSON.parse(
  readFileSync(new URL('../ceviri/metinler.json', import.meta.url), 'utf8'),
);
/** Yer tutucular sökülüyor: `{0} bölge` ekranda `3 bölge` olarak çıkıyor. */
const parcalar = new Set();
for (const v of Object.values(sozluk)) {
  for (const p of v.tr.split(/\{\d+\}/)) {
    const t = p.trim();
    if (t.length >= 2) parcalar.add(t.toLocaleLowerCase('tr'));
  }
}

/** Sözlükteki bir parçanın içinde geçiyor mu. */
function biliniyorMu(s) {
  const k = s.toLocaleLowerCase('tr');
  if (parcalar.has(k)) return true;
  for (const p of parcalar) if (p.includes(k) || k.includes(p)) return true;
  return false;
}

const ad = benzersizAd('Kapsam');
const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });
const bas = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
await fetch(`${API}/api/test/kaynak-ver`, {
  method: 'POST',
  headers: bas,
  body: JSON.stringify({ altin: 900000, demir: 500000, erzak: 500000 }),
});
await fetch(`${API}/api/test/xp-ver`, {
  method: 'POST',
  headers: bas,
  body: JSON.stringify({ miktar: 200000 }),
});
await bolgeKazandir(API, token, 4);

const tarayici = await tarayiciAc();
const s = await (await tarayici.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await s.goto(WEB, { waitUntil: 'domcontentloaded' });
await s.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await s.goto(WEB, { waitUntil: 'networkidle' });
await ogreticiyiGec(s);
await rehberiSustur(s);

/** Görünen metin düğümleri — biçim etiketleri (script/style) hariç. */
const gorunen = () =>
  s.evaluate(() => {
    const cikan = [];
    const yur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = yur.nextNode(); n; n = yur.nextNode()) {
      const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const e = n.parentElement;
      if (!e || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) continue;
      if (!e.getClientRects().length) continue;
      cikan.push(t);
    }
    // aria-label ve title de oyuncuya ulaşıyor (ekran okuyucu, uzun basma).
    for (const e of document.querySelectorAll('[aria-label],[title]'))
      for (const a of ['aria-label', 'title']) {
        const v = e.getAttribute(a);
        if (v) cikan.push(v.trim());
      }
    return cikan;
  });

const hepsi = new Set();
for (const [yol] of CUBUK) {
  try {
    await ekrana(s, yol);
  } catch {
    continue;
  }
  await s.waitForTimeout(1500);
  for (const t of await gorunen()) hepsi.add(t);
}
await tarayici.close();

/* Dinamik olduğu belli olanlar: saf sayı, saat, oyuncunun kendi adı. */
const dinamikMi = (t) =>
  /^[\d.,:%×+\-/ ]+$/.test(t) ||
  /^\d+ ?(sa|dk|sn|g)\b/.test(t) ||
  t.includes(ad) ||
  t.toLowerCase().includes(ad.toLowerCase());

const kalan = [...hepsi]
  .filter((t) => t.length >= 2 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(t))
  .filter((t) => !dinamikMi(t))
  .filter((t) => !biliniyorMu(t))
  .sort((a, b) => a.localeCompare(b, 'tr'));

console.log(`\nEkranda görülen metin: ${hepsi.size}`);
console.log(`Sözlükte karşılığı bulunamayan: ${kalan.length}\n`);
for (const t of kalan) console.log('  ' + JSON.stringify(t));
console.log(
  '\nBunlar HATA DEĞİL, gözden geçirme listesi: çoğu oyuncu adı, bölge adı ya da' +
    '\nsayıyla karışan metin. Aralarında gerçek bir düğme yazısı varsa çıkarıcı onu' +
    '\nkaçırmış demektir.',
);
