/**
 * Görsel denetim: kayma, taşma ve örtüşme avı.
 *
 * Ekran görüntüsüne bakarak "bir şey kaymış" demek kolay, NEREDE kaydığını
 * söylemek zor. Bu araç ölçüyor:
 *
 *  - YATAY TAŞMA: gövde yatay kayıyor mu (mobilde en görünür kusur).
 *  - ÖRTÜŞME: sabit üst bar ile içeriğin ilk satırı çakışıyor mu.
 *  - TAŞAN ÖGE: kendi kabından genişe çıkan bir öge var mı.
 *  - KESİLEN METİN: kabına sığmayıp gizlenen yazı.
 *  - DOKUNMA HEDEFİ: 40 pikselden küçük düğme (parmak için küçük).
 *
 * SADECE GELİŞTİRME. node tools/gorsel-denetim.mjs
 */
import { tarayiciAc } from './lib/tarayici.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { EKRANLAR, ekrana, kapiyiKapat, rehberiSustur } from './lib/gezin.mjs';

import { kayitOl } from './lib/kayit.mjs';
import { bolgeKazandir, sehriKur } from './lib/ilerlet.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const CIKTI = process.env.CIKTI ?? 'ekran-goruntuleri';

let bulgu = 0;
function sorun(ekran, ne, detay) {
  console.log(`  [SORUN] ${ekran}: ${ne}${detay ? ` — ${detay}` : ''}`);
  bulgu++;
}
function iyi(ekran, ne) {
  console.log(`  [TEMİZ] ${ekran}: ${ne}`);
}

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `gd${damga}@lordlar.dev`,
  lordName: `Gd${damga.toString(36).slice(-5)}`,
});
// Denetim oyunun YERLEŞMİŞ hâlini ölçüyor: ilk döngüde arayüz bilerek
// sade ve ekranların yarısı (olay akışı, diyarın kapıları) hiç görünmüyor.
// Bu lorda gerçek yoldan bir bölge kazandırıp döngüyü kapatıyoruz.
const bolgeSayisi = await bolgeKazandir(API, token);
// Bütün kapıları geziyoruz ve şehirdeki kapılar yerleşim kademesine bağlı
// açılıyor: köydeki lordun karargâhı yok (docs/12 §3.3). Denetim oyunun
// YERLEŞMİŞ hâlini ölçmeli, ilk döngüsünü değil.
await sehriKur(API, token);
// Bütün kapıları geziyoruz ve şehirdeki kapılar yerleşim kademesine bağlı
// açılıyor: köydeki lordun karargâhı yok. Denetim oyunun YERLEŞMİŞ hâlini
// ölçmeli, ilk döngüsünü değil.
await sehriKur(API, token);
if (bolgeSayisi === 0) {
  // Sessizce devam etmek, ekranların yarısını hiç ölçmeden "temiz" demek
  // olurdu — kapılar ilk döngüde bilerek gizli.
  console.error('Denetim lorduna bölge kazandırılamadı; ilk döngü kapanmadan ölçüm eksik olur.');
  process.exit(1);
}

const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

// Ekranların DOLU hâlini denetliyoruz: boş ekranda kayma görünmez.
await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord.statPoints;
if (puan > 0)
  await post('/me/stats', { liderlik: Math.floor(puan / 2), guc: puan - Math.floor(puan / 2) });
await post('/army/train', { unitType: 'mizrakci', count: 120 });
await post('/army/train', { unitType: 'okcu', count: 80 });
await post('/items/craft', { tier: 2, slot: 'silah' });
await post('/test/kuyruklari-bitir');
const esya = (await get('/items')).items[0];
if (esya) await post(`/items/${esya.id}/equip`);
const kadro = (await get('/generals')).kadro;
const g0 = kadro.filter((g) => !g.sahipMi).sort((a, b) => a.maliyet_altin - b.maliyet_altin)[0];
if (g0) {
  await post(`/generals/${g0.key}/hire`);
  await post(`/generals/${g0.key}/assign`, { slotIndex: 0 });
}
await post('/ittifak/kur', { ad: `Denetim ${damga % 10000}`, etiket: `D${damga % 100}` });

console.log('Lordlar Çağı — görsel denetim (iPhone 13)\n');

const browser = await tarayiciAc();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);

/**
 * Kayma gözcüsü SAYFA YÜKLENMEDEN kuruluyor.
 *
 * Asıl kayma burada oluyor — oyuncunun her açılışta yaşadığı şey.
 * Sekmeler arası geçiş kayma üretmiyor (React bütün alt ağacı birden
 * değiştiriyor, tarayıcı bunu "kayma" saymıyor), o yüzden yalnız sekme
 * geçişini ölçen bir denetim hep 0 görür ve hiçbir şey yakalamaz.
 */
await page.addInitScript(() => {
  const w = window;
  w.__ilkKayma = 0;
  w.__ilkKaynak = [];
  new PerformanceObserver((liste) => {
    for (const g of liste.getEntries()) {
      if (g.hadRecentInput) continue;
      w.__ilkKayma += g.value;
      for (const k of g.sources ?? []) {
        const el = k.node;
        if (!el || !el.tagName || w.__ilkKaynak.length >= 4) continue;
        const sinif =
          typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
        w.__ilkKaynak.push(`${el.tagName.toLowerCase()}${sinif ? '.' + sinif : ''}`);
      }
    }
  }).observe({ type: 'layout-shift' });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
// Öğretici tam ekran açılıyor ve altındaki ekranı ölçmemizi engelliyor.
// Denetim öğreticiyi DEĞİL, arkasındaki ekranları ölçüyor.
await ogreticiyiGec(page);
await rehberiSustur(page);

/**
 * Sayfa yerleşirken KAÇ PİKSEL zıpladı?
 *
 * Denetimin şimdiye kadar ölçmediği şey buydu ve oyuncunun "görsel
 * kaymalar var" derken kastettiği şeyin büyük ihtimalle ta kendisi:
 * ekran açılıyor, bir kart geç geliyor, altındaki her şey aşağı kayıyor
 * ve parmağın bastığı yerde artık başka bir düğme oluyor.
 *
 * Tarayıcının kendi ölçüsünü kullanıyoruz (layout-shift performans
 * girişi) — göz kararı değil, Chrome'un CLS hesabıyla aynı sayı.
 * Ölçüm sekme DEĞİŞTİĞİ anda sıfırlanıyor, yani her ekran kendi
 * kaymasından sorumlu.
 */
async function kaymaOlcumuBaslat() {
  await page.evaluate(() => {
    const w = window;
    w.__kayma = 0;
    w.__kaymaKaynak = [];
    // Gözcü BİR KEZ kuruluyor ve `buffered` KULLANMIYOR. İlk hâlinde her
    // ekranda yeni bir gözcü kurup buffered:true veriyordum: gözcü sayfanın
    // BÜTÜN geçmişini yeniden oynatıyordu ve on bir ekranın hepsi aynı
    // sayıyı (0.504) veriyordu. Ölçüm ekranı ayırt etmiyorsa ölçüm değil.
    if (!w.__kaymaGozcu) {
      w.__kaymaGozcu = new PerformanceObserver((liste) => {
        for (const g of liste.getEntries()) {
          // hadRecentInput: oyuncunun kendi dokunuşuyla oluşan kayma
          // (menü açılması gibi) kayma sayılmaz.
          if (g.hadRecentInput) continue;
          w.__kayma += g.value;
          for (const k of g.sources ?? []) {
            const el = k.node;
            if (!el || !el.tagName || w.__kaymaKaynak.length >= 4) continue;
            const sinif =
              typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
            w.__kaymaKaynak.push(`${el.tagName.toLowerCase()}${sinif ? '.' + sinif : ''}`);
          }
        }
      });
      w.__kaymaGozcu.observe({ type: 'layout-shift' });
    }
  });
}

/** Bir ekranı ölç. */
async function denetle(ad) {
  await page.waitForTimeout(1200);
  const kayma = await page.evaluate(() => ({
    puan: window.__kayma ?? 0,
    kaynak: [...new Set(window.__kaymaKaynak ?? [])],
  }));

  const olcum = await page.evaluate(() => {
    const sonuc = {
      yatayTasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tasanlar: [],
      kesilenler: [],
      kucukDokunma: [],
      ortusme: null,
    };

    // Sabit üst bar ile içeriğin çakışması: barın hemen altındaki noktada
    // hangi öge var? İçerik barın ALTINDA başlamalı.
    const bar = document.querySelector('header');
    if (bar) {
      const b = bar.getBoundingClientRect();
      const altta = document.elementFromPoint(window.innerWidth / 2, b.bottom + 4);
      if (altta && bar.contains(altta)) sonuc.ortusme = 'içerik barın altında başlamıyor';
    }

    const govde = document.body.getBoundingClientRect();
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
      const k = el.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) continue;

      // Görünür alandan taşan öge (yatayda).
      //
      // Kırpılan taşma sorun DEĞİL: sahne gibi kenardan kenara uzanan
      // ögeler bilerek kabından taşıyor ve bir üst kap onları
      // overflow:hidden ile kesiyor. Bunları bildirmek aracı yalancı
      // yapıyordu — düzeltilecek bir şey yokken her koşuda "sorun" diyordu.
      let kirpiliyor = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (as.overflowX === 'hidden' || as.overflowX === 'clip' || as.overflowX === 'auto') {
          kirpiliyor = true;
          break;
        }
      }
      if (!kirpiliyor && (k.right > govde.right + 1 || k.left < govde.left - 1)) {
        const etiket = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`;
        if (sonuc.tasanlar.length < 6) {
          sonuc.tasanlar.push(`${etiket} (${Math.round(k.left)}..${Math.round(k.right)})`);
        }
      }

      // Kabına sığmayan metin: taşan içerik gizleniyor
      const metinli = el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
      if (metinli && el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible') {
        const yazi = (el.textContent ?? '').trim().slice(0, 40);
        // Bilerek kırpılan yazılar (truncate) hata değil; yalnız
        // ellipsis OLMAYANLARI bildiriyoruz.
        if (s.textOverflow !== 'ellipsis' && sonuc.kesilenler.length < 6) {
          sonuc.kesilenler.push(`"${yazi}" (${el.scrollWidth}>${el.clientWidth})`);
        }
      }

      // Dokunma hedefi
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.offsetParent !== null) {
        if (k.height > 0 && k.height < 40 && k.width < 40 && sonuc.kucukDokunma.length < 6) {
          const yazi = (el.textContent ?? '').trim().slice(0, 20);
          sonuc.kucukDokunma.push(`"${yazi}" ${Math.round(k.width)}x${Math.round(k.height)}`);
        }
      }
    }
    return sonuc;
  });

  if (olcum.yatayTasma > 1) sorun(ad, 'sayfa YATAY kayıyor', `${olcum.yatayTasma}px`);
  else iyi(ad, 'yatay kayma yok');

  // 0,1 Chrome'un "iyi CLS" eşiği. Bunun üstü, ekran yerleşirken
  // içeriğin gözle görülür biçimde zıpladığı anlamına geliyor.
  if (kayma.puan > 0.1) {
    sorun(
      ad,
      'AÇILIRKEN İÇERİK ZIPLIYOR',
      `CLS ${kayma.puan.toFixed(3)} — ${kayma.kaynak.join(', ')}`,
    );
  } else {
    iyi(ad, `açılışta zıplama yok (CLS ${kayma.puan.toFixed(3)})`);
  }

  if (olcum.ortusme) sorun(ad, 'üst bar içeriği örtüyor', olcum.ortusme);
  if (olcum.tasanlar.length) sorun(ad, 'ekrandan taşan öge', olcum.tasanlar.join(' | '));
  if (olcum.kesilenler.length) sorun(ad, 'kesilen metin', olcum.kesilenler.join(' | '));
  if (olcum.kucukDokunma.length) sorun(ad, 'küçük dokunma hedefi', olcum.kucukDokunma.join(' | '));

  await page.screenshot({ path: `${CIKTI}/gd-${ad}.png` });
}

// İlk yükleme kayması: ekranlar gezilmeden ÖNCE okunuyor.
{
  const ilk = await page.evaluate(() => ({
    puan: window.__ilkKayma ?? 0,
    kaynak: [...new Set(window.__ilkKaynak ?? [])],
  }));
  // 0,1 Chrome'un "iyi CLS" eşiği.
  if (ilk.puan > 0.1) {
    sorun(
      'acilis',
      'AÇILIRKEN İÇERİK ZIPLIYOR',
      `CLS ${ilk.puan.toFixed(3)} — ${ilk.kaynak.join(', ')}`,
    );
  } else {
    iyi('acilis', `açılışta zıplama yok (CLS ${ilk.puan.toFixed(3)})`);
  }
}

// Hangi ekranın sekme hangisinin kapı olduğunu `lib/gezin.mjs` biliyor.
for (const [ad] of EKRANLAR) {
  await ekrana(page, ad, 0);
  await kaymaOlcumuBaslat();
  await denetle(ad);
}
// Döngü bir KAPI ile bitiyor ve panel açık kalıyor: kapatmadan çubuğa
// basmak paneli tıklamak olurdu.
await kapiyiKapat(page);

// Bölge detayı: alt sayfa açıkken en çok kayma buradaydı
await page.click('nav button:has-text("Dünya")');
await page.waitForTimeout(1800);
const hedef = (await get('/map')).regions.filter((x) => !x.isMine && x.type !== 'taht')[0];
// Bölgeler artık gerçek <button>; kimliğiyle bulunuyor. Ada göre
// aramıyoruz: görünür etiket yakınlık kademesine göre gizlenebiliyor.
// Harita yakınlaşmış açılıyor; uzaktaki bölge ekranın dışında kalabilir.
// "Sığdır" bütün dünyayı getiriyor (docs/12 §11.6).
{
  const sigdir = page.getByRole('button', { name: 'Haritayı sığdır' });
  if (await sigdir.count()) {
    await sigdir.click();
    await page.waitForTimeout(500);
  }
}
await page.locator(`[data-bolge="${hedef.id}"]`).click({ timeout: 10000, force: true });
await denetle('bolge-detay');

/**
 * YEPYENİ lordun malikânesi.
 *
 * Şimdiye kadar yalnız DOLU ekranları denetliyorduk; oysa oyuncunun ilk
 * gördüğü şey boş ekran ve "burada iş var mı" sorusunun cevabı orada
 * veriliyor (docs/11 §2.3 G4). Boş kuyruk ve boş olay akışı artık sakin
 * kartla çiziliyor; bunun gerçekten öyle çizildiğini de ölçüyoruz.
 */
const yeniDamga = Date.now();
const { token: yeniToken } = await kayitOl(API, {
  email: `gdbos${yeniDamga}@lordlar.dev`,
  lordName: `Bos${yeniDamga.toString(36).slice(-5)}`,
});
if (yeniToken) {
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), yeniToken);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
  await ogreticiyiGec(page);
  // İkinci lord da yepyeni: rehber ışığı onun ekranını da karartırdı.
  // Karar artık HESABA bağlı olduğu için bu lord için ayrıca kapatılıyor —
  // ilk lordunki onun adına geçmiyor. (Tarayıcı deposunda tutulduğunda
  // geçiyordu; ürün hatasının kendisi buydu.)
  await rehberiSustur(page);
  await denetle('yeni-lord-malikane');

  const sakin = await page.evaluate(() => ({
    kart: document.querySelectorAll('.kart-sakin').length,
    plaka: document.querySelectorAll('.plaka-sakin').length,
  }));
  if (sakin.kart > 0 && sakin.plaka > 0) {
    iyi(
      'yeni-lord-malikane',
      `boş bölümler sakin çiziliyor (${sakin.kart} kart, ${sakin.plaka} başlık)`,
    );
  } else {
    sorun(
      'yeni-lord-malikane',
      'boş bölüm dolu bölümle aynı ağırlıkta',
      `${sakin.kart} sakin kart, ${sakin.plaka} sakin başlık`,
    );
  }
}

/**
 * Zemin listesi ile klasör birbirini tutuyor mu?
 *
 * Zemin.tsx hangi ekranın görseli olduğunu ELLE tutuyor; çalışma anında
 * "yükle, olmazsa küçült" yapmak sayfayı zıplatıyordu. Elle tutulan liste
 * kaçınılmaz olarak klasörden sapar — bu kontrol o sapmayı yakalıyor:
 * dosya konur da liste güncellenmezse ekran görselsiz kalır ve kimse fark
 * etmez; listede olup dosyası olmayan ekran ise boş bir bant gösterir.
 */
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const klasor = new Set(
    readdirSync('apps/web/public/gorseller/zeminler')
      .filter((f) => f.endsWith('.webp'))
      .map((f) => f.replace(/\.webp$/, '')),
  );
  const kaynak = readFileSync('apps/web/src/components/Zemin.tsx', 'utf8');
  const blok = kaynak.match(/const ZEMINI_OLAN = new Set\(\[([^\]]*)\]/s)?.[1] ?? '';
  const liste = new Set([...blok.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  // 'giris' tam ekran zemin (TamZemin) ve şerit listesinde olmamalı.
  klasor.delete('giris');

  const eksik = [...klasor].filter((k) => !liste.has(k));
  const fazla = [...liste].filter((k) => !klasor.has(k));
  if (eksik.length || fazla.length) {
    sorun(
      'zeminler',
      'Zemin listesi klasörle uyuşmuyor',
      [
        eksik.length ? `dosyası var listede yok: ${eksik.join(', ')}` : '',
        fazla.length ? `listede var dosyası yok: ${fazla.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  } else {
    iyi('zeminler', `liste klasörle uyuşuyor (${liste.size} zemin)`);
  }
}

/**
 * --- Bina sprite listesi ile klasör uyuşuyor mu ---
 *
 * Zemin listesiyle aynı gerekçe (`Sehir.tsx`, `SPRITE_OLAN`): elle
 * tutulan liste kaçınılmaz olarak klasörden sapar. Dosya konur da liste
 * güncellenmezse şehir hâlâ çizgi ikon gösterir ve kimse fark etmez;
 * listede olup dosyası olmayan bina ise üretimde 404 verir.
 *
 * Klasör henüz YOK olabilir: sprite'ların istemleri yazıldı ama görsel
 * üretilmedi. O durumda liste de boş olmalı.
 */
{
  const { readdirSync, readFileSync, existsSync } = await import('node:fs');
  const yol = 'apps/web/public/gorseller/binalar';
  const klasor = new Set(
    existsSync(yol)
      ? readdirSync(yol)
          .filter((f) => f.endsWith('.webp'))
          .map((f) => f.replace(/\.webp$/, ''))
      : [],
  );
  const kaynak = readFileSync('apps/web/src/screens/Sehir.tsx', 'utf8');
  const blok = kaynak.match(/const SPRITE_OLAN = new Set<string>\(\[([^\]]*)\]/s)?.[1] ?? '';
  const liste = new Set([...blok.matchAll(/'([^']+)'/g)].map((m) => m[1]));

  const eksik = [...klasor].filter((k) => !liste.has(k));
  const fazla = [...liste].filter((k) => !klasor.has(k));
  if (eksik.length || fazla.length) {
    sorun(
      'bina-sprite',
      'Bina sprite listesi klasörle uyuşmuyor',
      [
        eksik.length ? `dosyası var listede yok: ${eksik.join(', ')}` : '',
        fazla.length ? `listede var dosyası yok: ${fazla.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  } else {
    iyi(
      'bina-sprite',
      liste.size === 0
        ? 'sprite üretilmemiş, liste de boş — çizgi ikonlar kullanılıyor'
        : `liste klasörle uyuşuyor (${liste.size} sprite)`,
    );
  }
}

/**
 * --- Akın diyarlarının kapağı var mı ---
 *
 * Burada elle tutulan bir liste YOK ve olmamalı: diyarlar zaten
 * `data/akinlar.json` içinde sayılı. `Akin.tsx` kapağı koşulsuz çiziyor
 * (`/gorseller/akin/<key>.webp`), çünkü beşinin de dosyası var. Ölçüt bu
 * yüzden "liste klasörle uyuşuyor mu" değil, "her diyarın dosyası var
 * mı": eksik dosya, kartın tepesinde kırık bir görsel demek.
 */
{
  const { existsSync, readFileSync } = await import('node:fs');
  const akinlar = JSON.parse(readFileSync('data/akinlar.json', 'utf8'));
  const eksik = akinlar.haritalar
    .map((h) => h.key)
    .filter((k) => !existsSync(`apps/web/public/gorseller/akin/${k}.webp`));
  if (eksik.length) {
    sorun('akin-kapak', 'Akın diyarının kapak görseli yok', eksik.join(', '));
  } else {
    iyi('akin-kapak', `${akinlar.haritalar.length} diyarın da kapağı yerinde`);
  }

  /*
   * Diyar haritası ve on kampın figürü.
   *
   * Kapakla aynı gerekçe: elle tutulan bir liste yok, diyarlar zaten
   * veride sayılı. Ölçüt "her diyarın haritası ve her düşmanın iki hâli
   * (asker + şef) yerinde mi". Eksik dosya, haritanın ortasında kırık
   * bir görsel demek — üstelik oyuncu oraya DOKUNARAK akına çıkıyor.
   */
  const eksikHarita = akinlar.haritalar
    .map((h) => h.key)
    .filter((k) => !existsSync(`apps/web/public/gorseller/akin_harita/${k}.webp`));
  const eksikDusman = akinlar.haritalar
    .flatMap((h) => [h.dusman_key, `${h.dusman_key}_sef`])
    .filter((k) => !existsSync(`apps/web/public/gorseller/dusmanlar/${k}.webp`));
  if (eksikHarita.length || eksikDusman.length) {
    sorun(
      'akin-diyar',
      'Diyar haritası ya da düşman figürü eksik',
      [
        eksikHarita.length ? `harita: ${eksikHarita.join(', ')}` : '',
        eksikDusman.length ? `düşman: ${eksikDusman.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  } else {
    iyi(
      'akin-diyar',
      `${akinlar.haritalar.length} diyar haritası ve ${akinlar.haritalar.length * 2} düşman figürü yerinde`,
    );
  }

  /*
   * Dünya haritasında ETİKETLER ÜST ÜSTE BİNMEMELİ.
   *
   * Kademe kuralı ("uzak ölçekte yalnız seni ilgilendirenler") tek başına
   * yetmiyordu: dolu bir diyarda 61 bölgenin neredeyse hepsinin sahibi
   * var, yani kural pratikte "hepsini göster"e dönüşüyor. Oynarken
   * ölçüldü — 19 etiketten 8 ÇİFTİ birbirinin üstündeydi ve hiçbiri
   * okunmuyordu. Seyreltme (`DunyaHaritasi.tsx`) bunu çözüyor; bu ölçüm
   * çözümün yerinde durduğunu söylüyor.
   *
   * Gizlenen etiket de ÖLÇÜLMÜYOR: `visibility:hidden` kutusunu koruyor,
   * yani hepsini saymak seyreltmeyi hiç yapılmamış gibi gösterirdi.
   */
  await ekrana(page, 'harita', 900);
  const etiketOlcum = await page.evaluate(() => {
    const e = [...document.querySelectorAll('[data-bolge-ad]')]
      .filter((x) => getComputedStyle(x).visibility !== 'hidden')
      .map((x) => x.getBoundingClientRect());
    let cakisan = 0;
    for (let i = 0; i < e.length; i++)
      for (let j = i + 1; j < e.length; j++) {
        const a = e[i];
        const b = e[j];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) cakisan++;
      }
    return { adet: e.length, cakisan };
  });
  if (etiketOlcum.cakisan > 0) {
    sorun(
      'harita-etiket',
      'Bölge adları üst üste biniyor',
      `${etiketOlcum.adet} etiketten ${etiketOlcum.cakisan} çifti çakışıyor`,
    );
  } else {
    iyi('harita-etiket', `${etiketOlcum.adet} bölge adı, çakışma yok`);
  }

  /*
   * Yol ile grup sayısı TUTMALI. On kamp on noktaya konuyor; yol kısa
   * kalırsa son kamplar (şef dahil) haritanın ortasına yığılır.
   */
  const grupSayisi = akinlar.haritalar[0]?.gruplar.length ?? 0;
  if (akinlar.yol?.length !== grupSayisi) {
    sorun(
      'akin-yol',
      'Yol noktası sayısı grup sayısıyla uyuşmuyor',
      `${akinlar.yol?.length ?? 0} nokta / ${grupSayisi} grup`,
    );
  } else {
    iyi('akin-yol', `${grupSayisi} kamp, ${grupSayisi} yol noktası`);
  }
}

console.log(`\n${bulgu === 0 ? 'GÖRSEL DENETİM TEMİZ' : `${bulgu} GÖRSEL SORUN`}`);
console.log(
  `konsol hatası: ${konsol.length}${konsol.length ? ' — ' + konsol.slice(0, 3).join(' | ') : ''}`,
);
await browser.close();
process.exit(0);
