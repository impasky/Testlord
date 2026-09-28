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
import { EKRANLAR, bolgeyiSec, ekrana, kapiyiKapat, rehberiSustur } from './lib/gezin.mjs';

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

/**
 * Kaynaktaki bir `new Set([...])` listesinin tırnaklı öğeleri. Yorumlar
 * önce ayıklanıyor: listedeki bir notun kesme işareti ("Pazar'ın")
 * tırnak sayılıyor ve sahte öğeler üretiyordu.
 */
function listeOgeleri(blok) {
  const yorumsuz = blok.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  return new Set([...yorumsuz.matchAll(/'([^']+)'/g)].map((m) => m[1]));
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

      /*
       * Kabına sığmayan metin: taşan içerik gizleniyor.
       *
       * EKRAN OKUYUCU METNİ HARİÇ. `sr-only` deseni öğeyi 1x1 piksele
       * kırpıyor — gözle hiçbir şey görünmesin, ekran okuyucu okusun
       * diye. O kutuda "kesilen metin" aramak tanım gereği anlamsız:
       * zaten hiçbir şey gösterilmiyor. Sayfa başlıkları bu desenle
       * eklenince (docs/12 §18) denetim on dört ekranda birden yalan
       * alarm verdi.
       */
      const gizliOkuma = el.clientWidth <= 1 || el.clientHeight <= 1;
      const metinli = el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
      if (
        !gizliOkuma &&
        metinli &&
        el.scrollWidth > el.clientWidth + 2 &&
        s.overflow !== 'visible'
      ) {
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

/**
 * --- GPU çizimi gerçekten geliyor mu (docs/24) ---
 *
 * Donanım hızlandırmalı WebGL2 varken sahneler (afiş, birlik, portre) ve
 * dünya zemini GPU'dan gelmeli. Gelmiyorsa çizici sessizce SVG'ye düşmüş
 * demektir: ekran yine dolu görünür, yalnız pürüzsüz değil — gözle
 * yakalanması en zor gerileme.
 *
 * Başsız tarayıcıda WebGL yazılımla öykünülüyor ve uygulama orada BİLEREK
 * SVG çiziyor (yazılım sürücüsünde GPU yolu sayfayı donduruyordu). Önce
 * bu ölçülüyor, sonra GPU yolu zorlama bayrağıyla (`gl-yazilim`) açılıp
 * onun da çalıştığı ölçülüyor. WebGL2 hiç yoksa ölçüm atlanıyor.
 */
{
  const surucu = await page.evaluate(() => {
    try {
      const gl = new OffscreenCanvas(1, 1).getContext('webgl2');
      if (!gl) return null;
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    } catch {
      return null;
    }
  });
  const yenidenAc = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
  };
  if (!surucu) iyi('gpu', 'WebGL2 yok — SVG yedeği çiziyor (ölçüm atlandı)');
  else {
    const yazilim = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(surucu);
    if (yazilim) {
      await ekrana(page, 'kisla', 0);
      await page.waitForTimeout(2500);
      const adet = await page.evaluate(() => document.querySelectorAll('svg[data-gl]').length);
      if (adet === 0) iyi('gpu', 'yazılım sürücüsünde SVG çiziliyor (GPU yolu kapalı)');
      else sorun('gpu', 'Yazılım sürücüsünde GPU yolu açık', `${adet} çizim GPU'dan`);
      await page.evaluate(() => localStorage.setItem('gl-yazilim', '1'));
      await yenidenAc();
    }
    await ekrana(page, 'kisla', 0);
    const sahne = await page
      .waitForSelector('svg[data-gl]', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const adet = await page.evaluate(() => document.querySelectorAll('svg[data-gl]').length);
    if (sahne) iyi('gpu', `Ordu ekranında ${adet} çizim GPU'dan`);
    else sorun('gpu', "Sahneler GPU'dan gelmedi", 'svg[data-gl] yok');
    await page.click('nav button:has-text("Dünya")');
    const zemin = await page
      .waitForSelector('canvas[data-dunya-zemini][data-gl]', { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (zemin) iyi('gpu', "dünya zemini GPU'dan");
    else sorun('gpu', "Dünya zemini GPU'dan gelmedi", 'canvas[data-gl] yok');
    if (yazilim) {
      await page.evaluate(() => localStorage.removeItem('gl-yazilim'));
      await yenidenAc();
    }
  }
}

// Bölge detayı: alt sayfa açıkken en çok kayma buradaydı
await page.click('nav button:has-text("Dünya")');
await page.waitForTimeout(1800);
const hedef = (await get('/map')).regions.filter((x) => !x.isMine && x.type !== 'taht')[0];
// Toprağına dokunuluyor; kenarda bir düğmenin altındaysa klavyeyle
// seçiliyor (bkz. `bolgeyiSec`). Zorla tıklama toprağın kutusunun
// ortasına basıyordu — orası araç sütunu ya da komşu toprak olabiliyor.
await bolgeyiSec(page, hedef.id);
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
 * --- Ekranlarda kullanılan her zeminin çizimi var mı (docs/24) ---
 *
 * Zeminler koddan çiziliyor (cizim/zeminler.ts, ZEMIN_ADLARI). Bir ekran
 * `<Zemin ad="…">` ile çizimi olmayan bir ad isterse şerit sessizce sade
 * başlığa düşüyor; burada ekranların istediği adlar listeyle
 * karşılaştırılıyor.
 */
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const kaynak = readFileSync('apps/web/src/cizim/zeminler.ts', 'utf8');
  const blok = kaynak.match(/export const ZEMIN_ADLARI = \[([^\]]*)\]/s)?.[1] ?? '';
  const liste = listeOgeleri(blok);
  const istenen = new Set();
  for (const f of readdirSync('apps/web/src/screens'))
    for (const m of readFileSync(`apps/web/src/screens/${f}`, 'utf8').matchAll(
      /<Zemin\s+ad="(\w+)"/g,
    ))
      istenen.add(m[1]);
  const eksik = [...istenen].filter((k) => !liste.has(k));
  if (eksik.length) sorun('zeminler', 'Bazı ekran zeminlerinin çizimi yok', eksik.join(', '));
  else iyi('zeminler', `${istenen.size} ekranın zemini çiziliyor`);
}

/**
 * --- Haritadaki her bölge türünün afiş çizimi var mı (docs/24) ---
 *
 * Afiş koddan çiziliyor (`cizim/bolgeler.ts`, `BOLGE_TIPLERI`). Haritaya
 * yeni bir tür eklenir de çizimi yazılmazsa `BolgeAfisi` o türde hiçbir
 * şey göstermiyor — sessiz bir boşluk. Burada ikisi karşılaştırılıyor.
 */
{
  const { readFileSync } = await import('node:fs');
  const harita = JSON.parse(readFileSync('data/world-map.json', 'utf8'));
  const turler = new Set(harita.regions.map((b) => b.type));
  const kaynak = readFileSync('apps/web/src/cizim/bolgeler.ts', 'utf8');
  const blok = kaynak.match(/BOLGE_TIPLERI: BolgeTipi\[\] = \[([^\]]*)\]/s)?.[1] ?? '';
  const cizilen = listeOgeleri(blok);
  const eksik = [...turler].filter((k) => !cizilen.has(k));
  if (eksik.length) sorun('bolge-afis', 'Bazı bölge türlerinin afiş çizimi yok', eksik.join(', '));
  else iyi('bolge-afis', `${turler.size} bölge türünün hepsi çiziliyor (× 3 aşama)`);
}

/**
 * --- Her yapının her aşamasının çizimi var mı (docs/24) ---
 *
 * Bina görselleri artık koddan çiziliyor (`cizim/binalar.ts`). Veriye
 * yeni bir yapı eklenir de tarifi yazılmazsa şehir o yapıyı boş arsa
 * olarak çizer ve kimse fark etmez. Beklenen liste veriden türüyor:
 * aşamalı yapılar `_1/_3/_5`, aşamasızlar kendi adıyla, artı `arsa`.
 */
{
  const { readFileSync } = await import('node:fs');
  const kaynak = readFileSync('apps/web/src/cizim/binalar.ts', 'utf8');
  const cizilen = new Set([...kaynak.matchAll(/^ {2}(\w+): \(r\)/gm)].map((m) => m[1]));
  const binalar = JSON.parse(readFileSync('data/binalar.json', 'utf8')).binalar;
  const beklenen = [
    'arsa',
    ...binalar.flatMap((b) => (b.seviyeli ? [1, 3, 5].map((a) => `${b.key}_${a}`) : [b.key])),
  ];
  const eksik = beklenen.filter((k) => !cizilen.has(k));
  if (eksik.length) sorun('bina-cizim', 'Bazı yapı aşamalarının çizimi yok', eksik.join(', '));
  else iyi('bina-cizim', `${beklenen.length} yapı aşamasının hepsi çiziliyor`);
}

/**
 * --- Akın diyarlarının kapağı var mı ---
 *
 * Burada elle tutulan bir liste YOK ve olmamalı: diyarlar zaten
 * `data/akinlar.json` içinde sayılı. `Akin.tsx` kapağı koşulsuz çiziyor
 * (`DiyarCizimi`). Ölçüt bu yüzden "her diyarın `cizim/diyarlar.ts`te
 * teması var mı": teması olmayan diyar, kartın tepesinde boş bir kutu
 * demek.
 */
{
  const { readFileSync } = await import('node:fs');
  const akinlar = JSON.parse(readFileSync('data/akinlar.json', 'utf8'));
  // Kapak ve harita koddan çiziliyor (cizim/diyarlar.ts, DIYAR_ADLARI).
  const diyarKaynak = readFileSync('apps/web/src/cizim/diyarlar.ts', 'utf8');
  const temali = (k) => new RegExp(`^  ${k}: \\{`, 'm').test(diyarKaynak);
  const eksik = akinlar.haritalar.map((h) => h.key).filter((k) => !temali(k));
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
  const eksikHarita = akinlar.haritalar.map((h) => h.key).filter((k) => !temali(k));
  // Düşman figürleri koddan çiziliyor (cizim/birlikler.ts, DUSMAN tarifleri).
  const birlikKaynak = readFileSync('apps/web/src/cizim/birlikler.ts', 'utf8');
  const eksikDusman = akinlar.haritalar
    .flatMap((h) => [h.dusman_key, `${h.dusman_key}_sef`])
    .filter((k) => !new RegExp(`^  ${k}: \\(\\) =>`, 'm').test(birlikKaynak));
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
   *
   * Toprak haritasında (docs/23) bölge adları yalnız YAKIN kademede
   * çıkıyor; açılış ölçeğinde ölçmek "0 ad, çakışma yok" diyip hiçbir
   * şeyi sınamıyordu. Önce yakın kademeye iniliyor ve en az bir ad
   * görünmesi şart koşuluyor.
   */
  await ekrana(page, 'harita', 900);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Yakınlaştır' }).click();
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(400);
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
  if (etiketOlcum.adet === 0) {
    sorun('harita-etiket', 'Yakın kademede hiç bölge adı yok', 'ölçülecek etiket bulunamadı');
  } else if (etiketOlcum.cakisan > 0) {
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

/*
 * BULGU VARSA DÜŞ.
 *
 * Burası `process.exit(0)` yazıyordu: denetim sorunları buluyor,
 * ekrana yazıyor ve sonra "başardım" diyerek çıkıyordu. `pnpm e2e`
 * zinciri de bu yüzden hiç kırılmıyordu — yani araç aylardır bir
 * denetim değil bir rapordu. Alarm vermeyen bir alarm, olmayan alarmdan
 * kötüdür: olduğunu sanıp güvenirsin.
 */
process.exit(bulgu === 0 ? 0 : 1);
