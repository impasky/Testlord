/**
 * Profil resmi — seçme, yükleme ve denetim, uçtan uca.
 *
 * Oyuncunun isteği: "Profil resmi seçme ve yükleme olsun; bu resimler bir
 * denetimden geçmeli, +18 veya benzeri içerikler engellenmeli."
 *
 * Ne sınanıyor:
 *   - hazır portreler seçiliyor ve her birinin görseli gerçekten var,
 *   - yüklenen resim GERÇEK sınıflandırıcıdan geçiyor (oyunun kendi
 *     görseli temiz çıkmalı ve hemen görünmeli),
 *   - yüklenen resmin üstverisi (konum dahil) siliniyor,
 *   - açık içerik reddediliyor ve BAYTLARI saklanmıyor,
 *   - kararsız resim yönetici onayına düşüyor, o zamana kadar kimse
 *     görmüyor; onaylanınca görünüyor, kaldırılınca siliniyor,
 *   - şikâyet eşiği aşılınca resim kalkıyor, yönetici karar veriyor,
 *   - resim olmayan dosya, günlük sınır, doğrulanmamış hesap reddediliyor,
 *   - arayüzde seçici çalışıyor ve üst çubuktaki resim değişiyor.
 *
 * Reddin yolu sınıflandırıcının CEVABI taklit edilerek sınanıyor
 * (`/test/resim-tahmini`, yalnız geliştirmede): depoya uygunsuz bir resim
 * koyamayız.
 *
 * SADECE GELİŞTİRME. node tools/profil-resmi-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const B = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url), 'utf8'));
// sharp API paketinin bağımlılığı; kök node_modules'ta yok.
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
const tuz = Math.random().toString(36).slice(2, 5);
async function lordKur(etiket, dogrula = true) {
  const { token } = await kayitOl(API, {
    email: `pr${damga}_${tuz}_${etiket}@lordlar.dev`,
    lordName: `Pr${damga.toString(36).slice(-3)}${tuz}${etiket}`,
    dogrula,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const cagir = async (yol, yontem, govde) => {
    const c = await fetch(`${API}/api${yol}`, {
      method: yontem,
      headers: h,
      ...(yontem !== 'GET' ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
    return { kod: c.status, govde: await c.json().catch(() => null) };
  };
  const me = await (await fetch(`${API}/api/me`, { headers: h })).json();
  return {
    token,
    id: me.lord.id,
    ad: me.lord.name,
    post: (yol, govde) => cagir(yol, 'POST', govde).then((r) => r.govde),
    postHam: (yol, govde) => cagir(yol, 'POST', govde),
    put: (yol, govde) => cagir(yol, 'PUT', govde),
    get: (yol) => cagir(yol, 'GET').then((r) => r.govde),
    getHam: (yol) => cagir(yol, 'GET'),
    me: async () => (await (await fetch(`${API}/api/me`, { headers: h })).json()).lord,
  };
}

const b64 = (buf) => Buffer.from(buf).toString('base64');
const oyunGorseli = (yol) =>
  b64(readFileSync(new URL(`../apps/web/public/gorseller/${yol}`, import.meta.url)));
const TEMIZ_TAHMIN = { Porn: 0, Hentai: 0, Sexy: 0, Neutral: 0.97, Drawing: 0.03 };

console.log('Profil resmi — hazır portreler');
const [a, b, c, d, yonetici] = await Promise.all(['a', 'b', 'c', 'd', 'y'].map((x) => lordKur(x)));
await yonetici.post('/test/yonetici-yap');

kontrol('Yeni lordun resmi arma', (await a.me()).resim?.tur === 'arma');
const sec = await a.put('/profil/resim', { tur: 'hazir', key: 'casus_leyla' });
kontrol('Hazır portre seçiliyor', sec.kod === 200, String(sec.kod));
kontrol("Seçim /me'de görünüyor", (await a.me()).resim?.key === 'casus_leyla');
kontrol(
  'Başkası da görüyor (profil kartı)',
  (await b.get(`/lord/${a.id}/profil`))?.resim?.key === 'casus_leyla',
);
kontrol(
  'Olmayan portre reddediliyor',
  (await a.put('/profil/resim', { tur: 'hazir', key: 'yok' })).kod === 400,
);

// Her hazır portrenin görseli gerçekten var (paylaşılan listeden).
const PORTRELER = [
  'lord_1',
  'lord_2',
  'lord_3',
  'lord_4',
  'lord_5',
  'kumandan_alparslan',
  'sovalye_doruk',
  'kale_bekcisi_sarya',
  'okcubasi_elif',
  'casus_leyla',
  'suvari_bora',
  'mizrakci_kadir',
  'kusatmaci_tarik',
  'demirci_yusuf',
  'erzakci_meryem',
  'kahya_sinan',
  'vaiz_bertan',
  'barbar_sef',
  'eskiya_sef',
  'haydut_sef',
  'kultist_sef',
  'lejyoner_sef',
];
const eksik = [];
for (const k of PORTRELER) {
  const r = await fetch(`${WEB}/gorseller/portre/${k}.webp`);
  if (r.status !== 200 || !(r.headers.get('content-type') ?? '').includes('image')) eksik.push(k);
}
kontrol('Her hazır portrenin görseli sunuluyor', eksik.length === 0, eksik.join(', '));

console.log('\nProfil resmi — yükleme ve gerçek sınıflandırıcı');
// Konum bilgisi taşıyan bir JPEG: silinmeli.
const exifli = await sharp(
  readFileSync(new URL('../apps/web/public/gorseller/binalar/kisla_3.webp', import.meta.url)),
)
  .flatten({ background: '#445566' })
  .jpeg()
  .withExif({ IFD0: { Make: 'GizliTelefon', Copyright: 'konum-bilgisi' } })
  .toBuffer();
kontrol('Deneme resminde üstveri var', Boolean((await sharp(exifli).metadata()).exif));
const t0 = Date.now();
const y1 = await a.post('/profil/resim/yukle', { veri: `data:image/jpeg;base64,${b64(exifli)}` });
const sure = Date.now() - t0;
kontrol(
  'Oyunun kendi görseli sınıflandırıcıdan temiz geçiyor',
  y1?.durum === 'onay',
  `${JSON.stringify(y1)} ${sure} ms`,
);
kontrol('Onaylanan resim hemen profilde', (await a.me()).resim?.id === y1?.id);
const sunulan = await fetch(`${API}/api/profil-resmi/${y1?.id}`);
const sunulanBuf = Buffer.from(await sunulan.arrayBuffer());
kontrol(
  'Resim herkese açık adresten webp olarak sunuluyor',
  sunulan.status === 200 && sunulan.headers.get('content-type') === 'image/webp',
);
const meta = await sharp(sunulanBuf).metadata();
kontrol(
  'Üstveri (EXIF) silinmiş',
  !meta.exif && !meta.xmp && !meta.icc,
  JSON.stringify({ exif: !!meta.exif }),
);
kontrol(
  'Resim 256 piksele küçültülmüş',
  meta.width === B.profil_resmi.boyut_px && meta.height === B.profil_resmi.boyut_px,
);
kontrol(
  'Metinde konum bilgisi kalmamış',
  !sunulanBuf.includes('konum-bilgisi') && !sunulanBuf.includes('GizliTelefon'),
);

console.log('\nProfil resmi — ret ve inceleme');
// Açık içerik: sınıflandırıcının cevabı taklit ediliyor.
await a.post('/test/resim-tahmini', {
  Porn: 0.93,
  Hentai: 0.02,
  Sexy: 0.03,
  Neutral: 0.01,
  Drawing: 0.01,
});
const red = await a.post('/profil/resim/yukle', { veri: oyunGorseli('binalar/demirhane_3.webp') });
kontrol('Açık içerik reddediliyor', red?.durum === 'red', JSON.stringify(red));
kontrol('Reddedilen resme kimlik verilmiyor', red?.id === null);
kontrol('Reddedilince profil değişmiyor', (await a.me()).resim?.id === y1?.id);
const benimkiler = await a.get('/profil/resim');
kontrol(
  'Reddedilen resim hiçbir listede yok (baytları saklanmadı)',
  benimkiler.yuklemeler.length === 1,
  `${benimkiler.yuklemeler.length}`,
);

await a.post('/test/resim-tahmini', {
  Porn: 0.05,
  Hentai: 0.4,
  Sexy: 0.1,
  Neutral: 0.2,
  Drawing: 0.25,
});
const gri = await a.post('/profil/resim/yukle', { veri: oyunGorseli('binalar/pazar_3.webp') });
kontrol('Kararsız resim yöneticiye gidiyor', gri?.durum === 'inceleme', JSON.stringify(gri));
kontrol('İncelemedeki resim profile konmuyor', (await a.me()).resim?.id === y1?.id);
kontrol(
  'İncelemedeki resim herkese açık adreste YOK',
  (await fetch(`${API}/api/profil-resmi/${gri?.id}`)).status === 404,
);
kontrol(
  'İncelemedeki resim seçilemiyor',
  (await a.put('/profil/resim', { tur: 'yuklenen', id: gri?.id })).kod === 400,
);
kontrol(
  'Başkasının resmi seçilemiyor',
  (await b.put('/profil/resim', { tur: 'yuklenen', id: y1?.id })).kod === 404,
);
const sahibi = await a.get('/profil/resim');
kontrol(
  'Sahibi incelemedeki resmi önizlemede görüyor',
  sahibi.yuklemeler.some(
    (y) => y.id === gri?.id && y.durum === 'inceleme' && y.adres.startsWith('data:image/webp'),
  ),
);

const liste = await yonetici.get('/moderasyon/resimler');
const bekleyen = liste?.resimler?.find((r) => r.id === gri?.id);
kontrol(
  'Yönetici onay bekleyenlerde görüyor, resmiyle ve tahminiyle',
  Boolean(bekleyen?.adres && bekleyen?.tahmin),
  JSON.stringify(bekleyen?.tahmin),
);
kontrol(
  'Yönetici olmayan listeyi göremiyor (uç yok gibi)',
  (await a.getHam('/moderasyon/resimler')).kod === 404,
);
const durumY = await yonetici.get('/moderasyon/durum');
kontrol('Bekleyen sayısı resimleri de sayıyor', durumY?.bekleyen >= 1, String(durumY?.bekleyen));
await yonetici.post(`/moderasyon/resim/${gri?.id}`, { karar: 'onayla' });
kontrol(
  'Onaylanan resim artık herkese açık',
  (await fetch(`${API}/api/profil-resmi/${gri?.id}`)).status === 200,
);
kontrol('Onaylanan (en son) resim profile konuyor', (await a.me()).resim?.id === gri?.id);
const olaylar = await a.get('/me');
kontrol('Oyuncuya haber veriliyor', JSON.stringify(olaylar).includes('Profil resmin onaylandı'));
kontrol(
  'Aynı resim iki kez karara bağlanamıyor',
  (await yonetici.postHam(`/moderasyon/resim/${gri?.id}`, { karar: 'kaldir' })).kod === 400,
);

await a.post('/test/yuklemeleri-eskit');
await a.post('/test/resim-tahmini', {
  Porn: 0.1,
  Hentai: 0.2,
  Sexy: 0.3,
  Neutral: 0.2,
  Drawing: 0.2,
});
const gri2 = await a.post('/profil/resim/yukle', { veri: oyunGorseli('binalar/kutuphane_3.webp') });
await yonetici.post(`/moderasyon/resim/${gri2?.id}`, { karar: 'kaldir' });
kontrol(
  'Kaldırılan resim erişilemiyor',
  (await fetch(`${API}/api/profil-resmi/${gri2?.id}`)).status === 404,
);
kontrol(
  'Kaldırılan resim sahibinin listesinden de gidiyor (baytları silindi)',
  !(await a.get('/profil/resim')).yuklemeler.some((y) => y.id === gri2?.id),
);

console.log('\nProfil resmi — şikâyet');
const kendi = await a.postHam(`/rapor/resim/${a.id}`, { sebep: 'diger', aciklama: 'kendi resmim' });
kontrol('Kendi resmini şikâyet edemiyor', kendi.kod === 400);
await b.put('/profil/resim', { tur: 'hazir', key: 'lord_2' });
kontrol(
  'Hazır portre şikâyet edilemiyor (onları biz çizdik)',
  (await a.postHam(`/rapor/resim/${b.id}`, { sebep: 'diger', aciklama: 'hazır portre' })).kod ===
    400,
);
const s1 = await b.post(`/rapor/resim/${a.id}`, { sebep: 'diger', aciklama: 'uygunsuz resim' });
kontrol('Resim şikâyet edildi', s1?.alindi === true && s1?.gizlendi === false);
await c.post(`/rapor/resim/${a.id}`, { sebep: 'diger', aciklama: 'uygunsuz resim' });
const s3 = await d.post(`/rapor/resim/${a.id}`, { sebep: 'diger', aciklama: 'uygunsuz resim' });
kontrol('Eşikte resim yönetici bakana kadar kalkıyor', s3?.gizlendi === true);
kontrol('Kalkan resmin yerinde arma', (await b.get(`/lord/${a.id}/profil`))?.resim?.tur === 'arma');
const kuyruk = await yonetici.get('/moderasyon/kuyruk?durum=acik');
const satir = kuyruk.satirlar.find((s) => s.tur === 'resim' && s.resim?.id === gri?.id);
kontrol('Resim şikâyeti kuyrukta, resmin kendisiyle', Boolean(satir?.resim?.adres));
const k = await yonetici.post('/moderasyon/karar', { raporId: satir?.id, karar: 'resim_kaldir' });
kontrol('Yönetici resmi kaldırıyor', k?.tamam === true, JSON.stringify(k));
kontrol(
  'Kaldırılan resim artık yok',
  (await fetch(`${API}/api/profil-resmi/${gri?.id}`)).status === 404,
);
const yanlis = await yonetici.postHam('/moderasyon/karar', {
  raporId: satir?.id,
  karar: 'mesaj_sil',
});
kontrol('Karara bağlanmış şikâyet yeniden açılmıyor', yanlis.kod === 400);

console.log('\nProfil resmi — geçersiz yüklemeler');
await c.post('/test/yuklemeleri-eskit');
const metin = await c.postHam('/profil/resim/yukle', {
  veri: b64(Buffer.from('bu bir resim değil, düz metin')),
});
kontrol(
  'Resim olmayan dosya reddediliyor',
  metin.kod === 400 && metin.govde?.code === 'RESIM_GECERSIZ',
  metin.govde?.code,
);
const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } })
  .gif()
  .toBuffer();
const gifY = await c.postHam('/profil/resim/yukle', { veri: b64(gif) });
kontrol(
  'GIF reddediliyor (yalnız JPEG, PNG, WebP)',
  gifY.kod === 400 && gifY.govde?.code === 'RESIM_GECERSIZ',
  gifY.govde?.error,
);
const dogrulanmamis = await lordKur('u', false);
const dg = await dogrulanmamis.postHam('/profil/resim/yukle', {
  veri: oyunGorseli('binalar/kisla_1.webp'),
});
kontrol(
  'Doğrulanmamış hesap yükleyemiyor',
  dg.kod === 403 && dg.govde?.code === 'DOGRULANMADI',
  String(dg.kod),
);

let sinir = null;
for (let i = 0; i <= B.profil_resmi.gunluk_yukleme; i++) {
  await c.post('/test/resim-tahmini', TEMIZ_TAHMIN);
  const r = await c.postHam('/profil/resim/yukle', { veri: oyunGorseli('binalar/kisla_1.webp') });
  if (r.kod !== 200) {
    sinir = { i, r };
    break;
  }
}
kontrol(
  `Günlük yükleme sınırı (${B.profil_resmi.gunluk_yukleme})`,
  sinir?.i === B.profil_resmi.gunluk_yukleme && sinir?.r.govde?.code === 'YUKLEME_SINIRI',
  JSON.stringify(sinir && { i: sinir.i, code: sinir.r.govde?.code }),
);

/* ------------------------------------------------------------------ */
/* Tarayıcı                                                            */
/* ------------------------------------------------------------------ */
console.log('\nProfil resmi — tarayıcı');
const tarayici = await tarayiciAc();
const ctx = await tarayici.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('pageerror', (x) => konsol.push(String(x)));
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));
await page.goto(WEB);
await page.evaluate((t) => {
  localStorage.setItem('lordlar_token', t);
  localStorage.setItem('lordlar_dil', 'tr');
}, d.token);
await page.goto(WEB);
await page.waitForSelector('nav button');
await ogreticiyiGec(page);
await rehberiSustur(page, API);
await page.waitForSelector('nav button');
await page.locator('nav').getByRole('button', { name: 'Lord' }).click();
await page.click('[data-profil-resmi-degistir]');
const secici = page.getByRole('dialog', { name: 'Profil resmi' });
await secici.waitFor();
kontrol('Lord ekranından profil resmi seçici açılıyor', true);
const hazirSayisi = await secici.getByRole('button', { pressed: false }).count();
kontrol('Seçicide hazır portreler var', hazirSayisi >= 20, String(hazirSayisi));
await secici.getByRole('button', { name: 'Şövalye Doruk' }).click();
await page.waitForFunction(() =>
  [...document.querySelectorAll('header img')].some((i) =>
    i.getAttribute('src')?.includes('portre/sovalye_doruk'),
  ),
);
kontrol('Hazır portre seçilince üst çubuktaki resim değişiyor', true);
kontrol(
  'Seçili portre işaretli',
  (await secici.getByRole('button', { name: 'Şövalye Doruk' }).getAttribute('aria-pressed')) ===
    'true',
);

// Dosya yükle: tarayıcıda küçültülüp gönderiliyor, gerçek sınıflandırıcı.
await secici
  .locator('[data-resim-dosyasi]')
  .setInputFiles(
    new URL('../apps/web/public/gorseller/binalar/surlar_3.webp', import.meta.url).pathname,
  );
await secici.getByRole('img', { name: 'Yüklenecek resim' }).waitFor();
kontrol('Seçilen dosyanın önizlemesi çıkıyor', true);
await secici.getByRole('button', { name: 'Yükle', exact: true }).click();
const sonuc = secici.locator('[data-yukleme-sonucu]');
await sonuc.waitFor({ timeout: 60000 });
const sonucDurum = await sonuc.getAttribute('data-yukleme-sonucu');
kontrol(
  'Yükleme sonucu oyuncuya söyleniyor',
  ['onay', 'inceleme'].includes(sonucDurum ?? ''),
  `${sonucDurum}: ${await sonuc.textContent()}`,
);
if (sonucDurum === 'onay') {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('header img')].some((i) =>
      i.getAttribute('src')?.includes('/api/profil-resmi/'),
    ),
  );
  kontrol('Onaylanan resim üst çubukta', true);
}
kontrol('Konsolda hata yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));
await tarayici.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
