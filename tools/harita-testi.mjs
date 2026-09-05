/**
 * Harita testi (docs/11).
 *
 * İki şeyi ölçüyor:
 *
 * 1. MEKANİK — bölge almak haritayı gerçekten AÇIYOR mu? Mesafe artık en
 *    yakın toprağından ölçülüyor (H1); bunun tek gözlenebilir sonucu, bir
 *    bölge aldıktan sonra uzak bölgelerin YAKINLAŞMASI. Ölçmezsek kural
 *    sessizce geri alınabilir ve kimse fark etmez.
 * 2. GÖRSEL — vilayetler haritada okunuyor ve harita yakınlaştırılabiliyor
 *    mu (H3, H4).
 *
 * API ve web ayakta olmalı. node tools/harita-testi.mjs
 */
import { rehberiSustur } from './lib/gezin.mjs';
import { chromium } from 'playwright';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const CIKTI = process.env.CIKTI ?? 'ekran-goruntuleri';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — harita testi\n');

// --- 1. Mekanik: sunucu tarafı
const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `harita${damga}@lordlar.dev`,
  lordName: `Har ${damga.toString(36).slice(-4)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const P = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) }).then(
    (r) => r.json(),
  );
const G = (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((r) => r.json());

await P('/test/bolgeleri-sifirla');
await P('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await P('/test/xp-ver', { miktar: 200000 });
// /me'yi doğrudan ayrıştırmıyoruz: zincir hâlinde koşarken bir hız
// sınırı ya da geçici hata dönerse `.lord` undefined kalıyor ve test
// ALAKASIZ bir satırda "Cannot read properties of undefined" diye
// patlıyordu. Sebebi ilk satırda söylemek, aramaktan iyidir.
const ben = await G('/me');
if (!ben?.lord)
  throw new Error(`/me beklenen gövdeyi döndürmedi: ${JSON.stringify(ben).slice(0, 200)}`);
if (ben.lord.statPoints > 0) await P('/me/stats', { liderlik: ben.lord.statPoints });

const once = await G('/map');
const mesafelerOnce = new Map(once.regions.map((r) => [r.id, r.distance]));
kontrol(
  'Haritada vilayet bilgisi var',
  once.regions.every((r) => typeof r.province === 'string'),
  `${new Set(once.regions.map((r) => r.province)).size} vilayet`,
);

/** Öneri motorunun dediğini yaparak bir bölge alır. */
async function bolgeAl() {
  const oneri = (await G('/map')).oneri;
  if (!oneri) return false;
  if (oneri.eksik?.adet > 0) {
    await P('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
    await P('/test/kuyruklari-bitir');
  }
  const ordu = (await G('/army')).home;
  if (Object.keys(ordu).length === 0) return false;
  await P('/march', { toRegionId: oneri.regionId, army: ordu });
  await P('/test/yuruyusleri-bitir');
  await P('/test/yuruyusleri-bitir');
  return true;
}

async function benimBolgelerim() {
  return (await G('/map')).regions.filter((r) => r.isMine && r.type !== 'taht');
}

/**
 * İKİ bölge alıyoruz, bir değil.
 *
 * İlk hedef her zaman malikânenin ÜSTÜNDE durduğu altıgen oluyor (öneri
 * motoru en yakını seçiyor ve o sıfır mesafede). O bölgeyi almak hiçbir
 * yeri yaklaştırmaz — mesafesi zaten sıfırdı. Kural ancak İKİNCİ bölgede
 * gözlenebilir hâle geliyor. İlk denemede tek bölge alıp "hiçbir şey
 * yakınlaşmadı" diye kalan test, kuralın değil senaryonun kusuruydu.
 */
for (let i = 0; i < 8 && (await benimBolgelerim()).length < 1; i++) await bolgeAl();
const ilkler = await benimBolgelerim();
kontrol('Test için ilk bölge alındı', ilkler.length >= 1, ilkler[0]?.name ?? 'alınamadı');

const ara = await G('/map');
const mesafelerAra = new Map(ara.regions.map((r) => [r.id, r.distance]));

for (let i = 0; i < 8 && (await benimBolgelerim()).length < 2; i++) await bolgeAl();
const ikililer = await benimBolgelerim();
kontrol(
  'İkinci bölge de alındı',
  ikililer.length >= 2,
  ikililer.map((r) => r.name).join(', ') || 'alınamadı',
);

if (ikililer.length >= 2) {
  const sonra = await G('/map');
  const yakinlasan = sonra.regions.filter((r) => r.distance < (mesafelerAra.get(r.id) ?? 99));
  // ASIL KONTROL: bölge almak haritayı açmalı. Mesafe yalnız malikâneden
  // ölçülseydi bu sayı SIFIR olurdu (docs/11 §1.2 H1).
  kontrol(
    'Bölge almak haritayı AÇIYOR',
    yakinlasan.length > 0,
    `${yakinlasan.length} bölge yakınlaştı: ` +
      yakinlasan
        .slice(0, 3)
        .map((r) => `${r.name} ${mesafelerAra.get(r.id)}→${r.distance}`)
        .join(', '),
  );

  for (const b of ikililer) {
    const kendi = sonra.regions.find((r) => r.id === b.id);
    kontrol(
      `Kendi bölgene mesafe sıfır (${b.name})`,
      kendi?.distance === 0,
      `${kendi?.distance} hex`,
    );
  }

  // Hiçbir bölge UZAKLAŞMAMALI: min() alıyoruz.
  const uzaklasan = sonra.regions.filter((r) => r.distance > (mesafelerOnce.get(r.id) ?? 0));
  kontrol(
    'Hiçbir bölge uzaklaşmıyor',
    uzaklasan.length === 0,
    uzaklasan.map((r) => r.name).join(', ') || 'yok',
  );
}

// --- 2. Görsel: tarayıcı
const tarayici = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
await rehberiSustur(sayfa);
const konsol = [];
sayfa.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
await sayfa.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await sayfa.reload({ waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await ogreticiyiGec(sayfa);
await sayfa.click('nav button:has-text("Harita")');
await sayfa.waitForTimeout(2000);

const svgMetni = await sayfa.locator('svg[role=img]').first().innerHTML();
kontrol(
  'Vilayet adları haritada yazıyor',
  /KUZEYMARK|KARAORMAN|AKSU OVASI/.test(svgMetni),
  (svgMetni.match(/[A-ZÇĞİÖŞÜ]{4,}(?: [A-ZÇĞİÖŞÜ]+)*/g) ?? []).slice(0, 3).join(' / '),
);
await sayfa.screenshot({ path: `${CIKTI}/harita-1-genel.png` });

// Yakınlaştırma: düğmeye basınca ölçek büyümeli ve isimler AÇILMALI.
const oncekiKisaltma = (svgMetni.match(/…/g) ?? []).length;
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.waitForTimeout(500);
const donusum = await sayfa
  .locator('svg[role=img]')
  .first()
  .evaluate((el) => el.style.transform);
kontrol('Yakınlaştırma çalışıyor', /scale\((?!1\))/.test(donusum), donusum);

const yakinMetin = await sayfa.locator('svg[role=img]').first().innerHTML();
const sonrakiKisaltma = (yakinMetin.match(/…/g) ?? []).length;
kontrol(
  'Yakınlaşınca bölge adları kısaltılmıyor',
  sonrakiKisaltma < oncekiKisaltma,
  `${oncekiKisaltma} kısaltma -> ${sonrakiKisaltma}`,
);
await sayfa.screenshot({ path: `${CIKTI}/harita-2-yakin.png` });

// Sığdır düğmesi geri almalı.
await sayfa.getByRole('button', { name: 'Haritayı sığdır' }).click();
await sayfa.waitForTimeout(400);
const geri = await sayfa
  .locator('svg[role=img]')
  .first()
  .evaluate((el) => el.style.transform);
kontrol('Sığdır düğmesi haritayı geri alıyor', /scale\(1\)/.test(geri), geri);

// Bölge seçmek hâlâ çalışıyor: yakınlaştırma dokunmayı bozmamalı.
await sayfa.locator('svg[role=img] g[role=button]').nth(20).click();
await sayfa.waitForTimeout(900);
const govde = await sayfa.locator('body').innerText();
kontrol('Haritadan bölge seçilebiliyor', /garnizon|Garnizon|SALDIR|Seviye|GELİR/i.test(govde));

kontrol('Konsol hatası yok', konsol.length === 0, konsol[0] ?? '');

await tarayici.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
