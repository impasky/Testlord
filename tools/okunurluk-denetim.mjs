/**
 * Okunurluk denetimi: kontrast ve yazı boyutu.
 *
 * Bir oyuncu testinden çıktı: "oyun genel olarak çok karanlık, oyunu açınca
 * parlaklığımı yükseltmek zorunda kaldım, öbür türlü anlaşılmıyor" ve "her
 * yerde bir şeyler yazıyor, neler önemli neler önemsiz anlayamadım".
 *
 * İkisi de FİKİR gibi duruyor ama ikisi de ölçülebilir. Bu araç tahmin
 * yerine sayı koyuyor:
 *
 *  1. KONTRAST — ekranda gerçekten çizilen her metnin rengi, arkasındaki
 *     gerçek zeminle karşılaştırılıyor (WCAG 2.1 kontrast oranı). Paleti
 *     hesaplamak yetmez: arayüz `text-solgun/70` gibi saydamlık çarpanları
 *     kullanıyor ve gerçek oran ancak boyanmış pikselden çıkıyor.
 *  2. BOYUT — 11 pikselin altındaki metin telefonda okunmuyor. Kaç tane
 *     olduğunu ve nerede olduklarını sayıyoruz.
 *
 * Eşikler WCAG AA: gövde metni 4.5, iri metin (>=18.66px ya da >=14px kalın)
 * 3.0. Bunlar "güzel görünsün" kuralları değil, görme keskinliği düşük bir
 * gözün metni seçebilmesi için gereken en düşük değerler.
 *
 * SADECE GELİŞTİRME. node tools/okunurluk-denetim.mjs
 */
import { chromium, devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { EKRANLAR, ekrana, rehberiSustur } from './lib/gezin.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** En küçük kabul edilen yazı boyutu. */
const EN_KUCUK_PX = 11;

let sorun = 0;
function kotu(ne, detay = '') {
  console.log(`  [SORUN] ${ne}${detay ? ` — ${detay}` : ''}`);
  sorun++;
}
function iyi(ne, detay = '') {
  console.log(`  [TEMİZ] ${ne}${detay ? ` — ${detay}` : ''}`);
}

/**
 * Sayfadaki her metin düğümünün kontrastını ölçer.
 *
 * Zemin bulmak için ata zinciri yukarı taranıyor: ilk saydam OLMAYAN
 * arka plan gerçek zemindir. Saydam metin rengi (rgba) o zeminin üstüne
 * karıştırılıyor — `text-solgun/70` gerçekte solgun değil, solgunun
 * zeminle %70 karışımı.
 */
const OLCUM = () => {
  const ayristir = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const karistir = (on, arka) => ({
    r: on.r * on.a + arka.r * (1 - on.a),
    g: on.g * on.a + arka.g * (1 - on.a),
    b: on.b * on.a + arka.b * (1 - on.a),
    a: 1,
  });
  const parlaklik = (c) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const oran = (a, b) => {
    const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  /**
   * Ata zincirinde ilk saydam olmayan zemini bulur.
   *
   * GRADYAN bir zemine rastlarsa null döner ve o metin ÖLÇÜLMEZ. İlk
   * halinde gradyanı görmezden geliyordum: `backgroundColor` gradyanda
   * saydam hesaplanıyor, tarayıcı üste çıkıp koyu paneli buluyordu ve
   * altın düğmenin üstündeki koyu yazı "1.00 kontrast" diye raporlanıyordu.
   * Gerçekte altın zeminde koyu yazı, arayüzün en okunur yeri. Yanlış
   * ölçen bir araç, ölçmeyen araçtan kötüdür: ölçemediğini söylesin.
   */
  const zeminBul = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = ayristir(s.backgroundColor);
      if (c && c.a >= 0.999) return c;
      n = n.parentElement;
    }
    return { r: 23, g: 16, b: 12, a: 1 }; // --color-gece
  };

  const cikti = [];
  const yur = (kok) => {
    const gezgin = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
    let d;
    while ((d = gezgin.nextNode())) {
      const yazi = d.textContent.trim();
      if (!yazi) continue;
      const el = d.parentElement;
      if (!el) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      const kutu = el.getBoundingClientRect();
      if (kutu.width < 1 || kutu.height < 1) continue;
      // Ekran okuyucuya özel metin göze görünmüyor; ölçüme girmemeli.
      if (el.closest('.sr-only')) continue;

      const zemin = zeminBul(el);
      if (!zemin) {
        cikti.push({ yazi: yazi.slice(0, 40), olculemedi: 'gradyan zemin' });
        continue;
      }
      /**
       * SVG metninin rengi `fill`'de, `color`'da değil. İlk halinde
       * `color` okunuyordu ve haritadaki bütün bölge adları olduğundan
       * çok kötü görünüyordu. Ayrıca SVG metinlerinin `stroke` hale'si
       * var — okunurluğu artırıyor ama hesaba katılamıyor, o yüzden
       * bunlar da ölçüm dışı.
       */
      if (el.ownerSVGElement || el.tagName === 'text') {
        cikti.push({ yazi: yazi.slice(0, 40), olculemedi: 'SVG metni (fill + stroke hale)' });
        continue;
      }
      let renk = ayristir(s.color) ?? { r: 255, g: 255, b: 255, a: 1 };
      // Elemanın kendi opacity'si de metni zemine karıştırıyor.
      const saydam = Number(s.opacity);
      if (saydam < 1) renk = { ...renk, a: renk.a * saydam };
      const gercek = renk.a < 0.999 ? karistir(renk, zemin) : renk;

      const px = parseFloat(s.fontSize);
      const kalin = Number(s.fontWeight) >= 700;
      const iri = px >= 18.66 || (px >= 14 && kalin);
      cikti.push({
        yazi: yazi.slice(0, 40),
        px: Math.round(px * 10) / 10,
        kalin,
        iri,
        oran: Math.round(oran(gercek, zemin) * 100) / 100,
        esik: iri ? 3.0 : 4.5,
      });
    }
  };
  yur(document.body);
  return cikti;
};

const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
await rehberiSustur(ctx);
const page = await ctx.newPage();

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `oku${damga}@lordlar.dev`,
  lordName: `Oku ${damga.toString(36).slice(-4)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
// Dolu bir ekran ölç: boş ekranda ölçülecek metnin yarısı yok.
await post('/test/kaynak-ver', { altin: 900000, demir: 400000, erzak: 400000 });
await post('/test/xp-ver', { miktar: 60000 });

console.log('Lordlar Çağı — okunurluk denetimi (iPhone 13)\n');

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await ogreticiyiGec(page);

const hepsi = [];
async function olc(ad) {
  await page.waitForTimeout(1200);
  const tum = await page.evaluate(OLCUM);
  const satirlar = tum.filter((s) => !s.olculemedi);
  for (const s of tum) hepsi.push({ ...s, ekran: ad });
  const dusuk = satirlar.filter((s) => s.oran < s.esik);
  const ufak = satirlar.filter((s) => s.px < EN_KUCUK_PX);
  const en = satirlar.reduce((a, s) => (a === null || s.oran < a.oran ? s : a), null);
  const atlanan = tum.length - satirlar.length;
  console.log(
    `  ${ad.padEnd(12)} ${String(satirlar.length).padStart(3)} metin · ` +
      `kontrast altı ${String(dusuk.length).padStart(3)} · ${EN_KUCUK_PX}px altı ` +
      `${String(ufak.length).padStart(3)} · en düşük ${en ? en.oran.toFixed(2) : '-'}` +
      (atlanan ? ` · ölçülemedi ${atlanan}` : ''),
  );
}

for (const [ad] of EKRANLAR) {
  await ekrana(page, ad, 0);
  await olc(ad);
}

console.log('');
const olculen = hepsi.filter((s) => !s.olculemedi);
const dusuk = olculen.filter((s) => s.oran < s.esik);
const ufak = olculen.filter((s) => s.px < EN_KUCUK_PX);

// Aynı metin birçok ekranda tekrar ediyor; benzersiz suçluları say.
const grupla = (liste, anahtar) => {
  const m = new Map();
  for (const s of liste) {
    const k = anahtar(s);
    if (!m.has(k)) m.set(k, { ...s, adet: 0, ekranlar: new Set() });
    m.get(k).adet++;
    m.get(k).ekranlar.add(s.ekran);
  }
  return [...m.values()].sort((a, b) => a.oran - b.oran);
};

const atlanan = hepsi.length - olculen.length;
console.log(
  `Toplam ${olculen.length} metin ölçüldü` +
    (atlanan
      ? `; ${atlanan} metin ölçülemedi (gradyan zemin ya da SVG hale — ikisi de ` +
        'gerçekte okunur, hesaplanamıyor).'
      : '.') +
    '\n',
);

if (dusuk.length) {
  kotu(`${dusuk.length} metin WCAG AA kontrast eşiğinin ALTINDA`);
  console.log('  En kötü 12 (benzersiz):');
  for (const s of grupla(dusuk, (x) => `${x.px}|${x.oran}`).slice(0, 12)) {
    console.log(
      `    ${String(s.oran).padStart(5)} / ${s.esik}  ${String(s.px).padStart(4)}px  ` +
        `x${s.adet}  "${s.yazi}"`,
    );
  }
} else {
  iyi('Bütün metinler WCAG AA kontrast eşiğini geçiyor');
}

console.log('');
if (ufak.length) {
  kotu(`${ufak.length} metin ${EN_KUCUK_PX}px'in altında`);
  const boyutlar = new Map();
  for (const s of ufak) boyutlar.set(s.px, (boyutlar.get(s.px) ?? 0) + 1);
  console.log(
    '  Boyut dağılımı: ' +
      [...boyutlar.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([px, n]) => `${px}px×${n}`)
        .join(' · '),
  );
} else {
  iyi(`Bütün metinler ${EN_KUCUK_PX}px ve üstünde`);
}

console.log(sorun === 0 ? '\nOKUNURLUK TEMİZ' : `\n${sorun} SORUN`);
await b.close();
process.exit(sorun === 0 ? 0 : 1);
