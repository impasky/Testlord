/**
 * ERİŞİM DENETİMİ — ekran okuyucuyla ve klavyeyle oynanabilirlik.
 *
 * `okunurluk-denetim.mjs` GÖZLE okunabilirliği ölçüyor (kontrast, yazı
 * boyutu). Bu araç onun ölçmediği yarıyı ölçüyor: oyunu göremeyen ya da
 * dokunamayan biri için ne kadarının anlaşılabilir olduğunu.
 *
 * docs/07 M13'ün "erişim" yarısı. Dil desteğinden ayrı tutuldu, çünkü
 * ikisi ayrı işler: oyunun hedef kitlesi Türkçe konuşuyor ama görme
 * güçlüğü çeken oyuncu da Türkçe konuşuyor.
 *
 * ── Ne ölçülüyor ve neden ────────────────────────────────────────────
 *
 *  lang          Sayfanın dili yazılı mı. Yazılmazsa ekran okuyucu
 *                Türkçe metni İngilizce telaffuzuyla okur ve hiçbir şey
 *                anlaşılmaz. Tek satırlık düzeltme, en büyük etki.
 *  ad            Her düğmenin, bağlantının ve alanın OKUNABİLİR bir adı
 *                var mı. Yalnızca simge taşıyan bir düğme ekran
 *                okuyucuda "düğme" diye okunur — hangi düğme olduğu
 *                söylenmez, yani basılamaz.
 *  görsel        Her `img` ya anlatılıyor (alt) ya da süs olduğu
 *                söyleniyor (alt="" / aria-hidden). Arada kalan görsel,
 *                dosya adının harf harf okunması demek.
 *  başlık        Sayfada h1 var mı ve seviyeler atlanmış mı. Ekran
 *                okuyucu kullanıcısının sayfada gezinme yolu başlıklar.
 *  odak          Klavyeyle gezerken odağın nerede olduğu GÖRÜNÜYOR mu.
 *                `outline: none` yazıp yerine bir şey koymamak, klavye
 *                kullanıcısını kör bırakmak demek.
 *  dokunma       Dokunulabilir her şey en az 44x44 mü (WCAG 2.5.5).
 *
 * SADECE GELİŞTİRME. node tools/erisim-denetim.mjs
 */
import { devices } from 'playwright';
import { tarayiciAc } from './lib/tarayici.mjs';
import { kayitOl } from './lib/kayit.mjs';
import { bolgeKazandir, sehriKur } from './lib/ilerlet.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { EKRANLAR, ekrana, rehberiSustur } from './lib/gezin.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
/*
 * İKİ EŞİK, çünkü iki ayrı standart var ve ikisini tek sayıya indirmek
 * ya yalan alarm ya da sessiz kusur üretiyor.
 *
 *   24px  WCAG 2.2 · 2.5.8 (AA) — GEÇMESİ ZORUNLU olan. Bunun altındaki
 *         bir hedefe başparmakla nişan alınamıyor.
 *   44px  WCAG 2.1 · 2.5.5 (AAA) ve Apple'ın kılavuzu — rahat hedef.
 *         Altında kalmak kusur değil, ama sayısı bilinmeli.
 *
 * Ölçü KÜÇÜK kenar: 338x17'lik bir satır geniş ama ince ve ıskalanıyor;
 * 85x42'lik bir düğme ise pratikte gayet rahat. Tek eşikle bakınca
 * ikisi aynı kefeye düşüyordu ve rapor 138 satır uzunluğunda,
 * dolayısıyla okunmaz oluyordu.
 */
const ZORUNLU_DOKUNMA = 24;
const RAHAT_DOKUNMA = 44;

let sorun = 0;
const kotu = (ne, detay = '') => {
  console.log(`  [SORUN] ${ne}${detay ? ` — ${detay}` : ''}`);
  sorun++;
};
const iyi = (ne, detay = '') => console.log(`  [TEMİZ] ${ne}${detay ? ` — ${detay}` : ''}`);

/**
 * Sayfadaki erişim ölçümü — tarayıcının içinde çalışıyor.
 *
 * Erişilebilir AD hesabı basitleştirilmiş: aria-label, aria-labelledby,
 * title, görünür metin, alt metni ve alan etiketi. Tam ACCNAME
 * algoritması değil ama "hiç adı yok" hâlini kaçırmıyor — aradığımız da
 * o.
 */
const OLCUM = ([zorunlu, rahat]) => {
  const gorunur = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const metin = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

  const erisilebilirAd = (el) => {
    const etiketli = el.getAttribute('aria-labelledby');
    if (etiketli) {
      const parcalar = etiketli
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map(metin)
        .join(' ');
      if (parcalar) return parcalar;
    }
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();

    // Alan etiketi: <label for> ya da saran <label>.
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && metin(l)) return metin(l);
    }
    const saran = el.closest('label');
    if (saran && metin(saran)) return metin(saran);

    // Görünür metin; süs olarak işaretlenmiş çocuklar sayılmıyor.
    const kopya = el.cloneNode(true);
    for (const gizli of kopya.querySelectorAll('[aria-hidden="true"]')) gizli.remove();
    const ic = (kopya.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (ic) return ic;

    // Düğmenin içinde yalnız bir görsel varsa onun alt metni ad olur.
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();

    if (el.tagName === 'INPUT' && el.placeholder && el.placeholder.trim()) {
      return el.placeholder.trim();
    }
    return '';
  };

  const yol = (el) => {
    const parcalar = [];
    let n = el;
    for (let i = 0; n && i < 3; i++) {
      parcalar.unshift(
        n.tagName.toLowerCase() + (n.className ? `.${String(n.className).split(/\s+/)[0]}` : ''),
      );
      n = n.parentElement;
    }
    return parcalar.join('>');
  };

  const adsiz = [];
  const etkilesimli = document.querySelectorAll(
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
  );
  for (const el of etkilesimli) {
    if (!gorunur(el)) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (!erisilebilirAd(el)) {
      adsiz.push({
        etiket: el.tagName.toLowerCase(),
        yol: yol(el),
        sinif: String(el.className).slice(0, 60),
      });
    }
  }

  const adsizGorsel = [];
  for (const img of document.querySelectorAll('img')) {
    if (!gorunur(img)) continue;
    const alt = img.getAttribute('alt');
    const sus =
      img.getAttribute('aria-hidden') === 'true' || img.getAttribute('role') === 'presentation';
    // alt="" süs demek ve geçerli; alt'ın HİÇ olmaması sorun.
    if (alt === null && !sus)
      adsizGorsel.push({ src: (img.currentSrc || img.src || '').slice(-60) });
  }

  const kucukDokunma = [];
  for (const el of document.querySelectorAll(
    'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"]',
  )) {
    if (!gorunur(el)) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const r = el.getBoundingClientRect();
    const kucukKenar = Math.min(r.width, r.height);
    if (kucukKenar >= rahat) continue;

    /*
     * CÜMLE İÇİ BAĞLANTI MUAFİYETİ — WCAG 2.5.8'in kendi istisnası:
     * "hedef bir cümlenin içindeyse ya da boyutu çevresindeki metnin
     * satır yüksekliğiyle sınırlıysa" ölçüt aranmıyor.
     *
     * Gerekçesi sağlam: "Ekipman Demirhane'de dövülür" cümlesindeki
     * bağlantıyı 24px yapmak için satırı şişirmek gerekir ve o zaman
     * cümle okunmaz olur. Kural, metni bozmamayı hedefin büyüklüğüne
     * tercih ediyor.
     *
     * Ölçüt: kardeşleri arasında boşluktan ibaret olmayan METİN var mı.
     * Yani gerçekten bir cümlenin içinde mi duruyor.
     */
    const ebeveyn = el.parentElement;
    const cumleIci =
      ebeveyn !== null &&
      [...ebeveyn.childNodes].some(
        (d) => d.nodeType === Node.TEXT_NODE && (d.textContent ?? '').trim().length > 0,
      );
    if (cumleIci) continue;

    kucukDokunma.push({
      ad: erisilebilirAd(el).slice(0, 30),
      en: Math.round(r.width),
      boy: Math.round(r.height),
      zorunluAlti: kucukKenar < zorunlu,
    });
  }

  const basliklar = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(gorunur)
    .map((h) => ({ seviye: Number(h.tagName[1]), metin: metin(h).slice(0, 40) }));

  return {
    adsiz,
    adsizGorsel,
    kucukDokunma,
    basliklar,
    dil: document.documentElement.getAttribute('lang') ?? '',
    /** Ana içerik bir landmark içinde mi — ekran okuyucu "ana içeriğe atla" için kullanıyor. */
    mainVar: Boolean(document.querySelector('main, [role="main"]')),
  };
};

console.log('\nLordlar Çağı — erişim denetimi (iPhone 13)\n');

const tarayici = await tarayiciAc();
const baglam = await tarayici.newContext({ ...devices['iPhone 13'] });
const page = await baglam.newPage();

const ad = `Eris${Date.now().toString(36).slice(-4)}`;
const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });
await sehriKur(API, token);
await bolgeKazandir(API, token);

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await ogreticiyiGec(page);
await rehberiSustur(page);

const hepsi = [];
for (const [ekran] of EKRANLAR) {
  await ekrana(page, ekran, 0);
  await page.waitForTimeout(900);
  const o = await page.evaluate(OLCUM, [ZORUNLU_DOKUNMA, RAHAT_DOKUNMA]);
  hepsi.push({ ekran, ...o });
  console.log(
    `  ${ekran.padEnd(12)} adsız ${String(o.adsiz.length).padStart(2)} · ` +
      `alt'sız görsel ${String(o.adsizGorsel.length).padStart(2)} · ` +
      `küçük dokunma ${String(o.kucukDokunma.length).padStart(2)} · ` +
      `başlık ${o.basliklar.length}`,
  );
}

console.log('');

// ── 1. Dil ───────────────────────────────────────────────────────────
const dil = hepsi[0]?.dil ?? '';
if (dil.toLowerCase().startsWith('tr')) iyi(`Sayfanın dili bildirilmiş — lang="${dil}"`);
else kotu('Sayfanın dili bildirilmemiş', `lang="${dil}" — ekran okuyucu Türkçeyi yanlış okur`);

// ── 2. Adsız etkileşimli öğeler ──────────────────────────────────────
const adsizlar = hepsi.flatMap((h) => h.adsiz.map((a) => ({ ...a, ekran: h.ekran })));
if (adsizlar.length === 0) iyi('Her düğme ve alanın okunabilir bir adı var');
else {
  kotu(
    `${adsizlar.length} etkileşimli öğenin adı yok`,
    'ekran okuyucuda yalnız "düğme" diye okunur',
  );
  const benzersiz = new Map();
  for (const a of adsizlar) if (!benzersiz.has(a.yol)) benzersiz.set(a.yol, a);
  for (const a of [...benzersiz.values()].slice(0, 8)) {
    console.log(`      ${a.ekran.padEnd(12)} ${a.yol}  ${a.sinif}`);
  }
}

// ── 3. alt'sız görseller ─────────────────────────────────────────────
const gorseller = hepsi.flatMap((h) => h.adsizGorsel.map((g) => ({ ...g, ekran: h.ekran })));
if (gorseller.length === 0) iyi('Her görsel ya anlatılmış ya da süs olarak işaretlenmiş');
else {
  kotu(`${gorseller.length} görselde alt metni yok`, 'ekran okuyucu dosya adını harf harf okur');
  const benzersiz = new Map();
  for (const g of gorseller) if (!benzersiz.has(g.src)) benzersiz.set(g.src, g);
  for (const g of [...benzersiz.values()].slice(0, 8)) {
    console.log(`      ${g.ekran.padEnd(12)} …${g.src}`);
  }
}

// ── 4. Dokunma hedefleri ─────────────────────────────────────────────
const kucukler = hepsi.flatMap((h) => h.kucukDokunma.map((k) => ({ ...k, ekran: h.ekran })));
const zorunluAlti = kucukler.filter((k) => k.zorunluAlti);
const benzersizle = (liste) => {
  const m = new Map();
  for (const k of liste) if (!m.has(k.ad + k.en + k.boy)) m.set(k.ad + k.en + k.boy, k);
  return [...m.values()];
};

if (zorunluAlti.length === 0) {
  iyi(`Dokunulabilir her şey en az ${ZORUNLU_DOKUNMA}px (WCAG 2.5.8 AA)`);
} else {
  kotu(`${zorunluAlti.length} dokunma hedefi ${ZORUNLU_DOKUNMA}px altında`, 'WCAG 2.5.8 AA');
  for (const k of benzersizle(zorunluAlti).slice(0, 10)) {
    console.log(`      ${k.ekran.padEnd(12)} "${k.ad}" ${k.en}x${k.boy}`);
  }
}

// AAA eşiği bir SORUN değil, bir ölçü: sayısı bilinsin ki bir gün
// rahatlatmaya karar verilirse nereden başlanacağı belli olsun.
const rahatAlti = benzersizle(kucukler.filter((k) => !k.zorunluAlti));
if (rahatAlti.length > 0) {
  console.log(
    `  [ÖLÇÜ]  ${rahatAlti.length} hedef ${RAHAT_DOKUNMA}px rahat eşiğinin altında ` +
      `(WCAG 2.5.5 AAA — sorun değil, ölçü)`,
  );
}

// ── 5. Başlık yapısı ─────────────────────────────────────────────────
const basliksiz = hepsi.filter((h) => !h.basliklar.some((b) => b.seviye === 1));
if (basliksiz.length === 0) iyi('Her ekranda bir h1 var');
else {
  kotu(
    `${basliksiz.length} ekranda h1 yok`,
    basliksiz
      .map((h) => h.ekran)
      .slice(0, 8)
      .join(', '),
  );
}

const atlayan = hepsi.filter((h) => {
  for (let i = 1; i < h.basliklar.length; i++) {
    if (h.basliklar[i].seviye - h.basliklar[i - 1].seviye > 1) return true;
  }
  return false;
});
if (atlayan.length === 0) iyi('Başlık seviyeleri atlanmıyor');
else
  kotu(
    `${atlayan.length} ekranda başlık seviyesi atlanıyor`,
    atlayan.map((h) => h.ekran).join(', '),
  );

// ── 6. Ana içerik landmark'ı ─────────────────────────────────────────
if (hepsi.every((h) => h.mainVar)) iyi('Ana içerik bir <main> içinde');
else kotu('Ana içerik <main> içinde değil', 'ekran okuyucuda "ana içeriğe atla" çalışmaz');

// ── 7. Odak görünürlüğü ──────────────────────────────────────────────
//
// Klavyeyle geziliyor gibi sekme atıp odaklanan öğenin GERÇEKTEN
// göründüğünü ölçüyoruz: outline ya da belirgin bir gölge olmalı.
await ekrana(page, 'sehir', 0);
await page.waitForTimeout(600);

/*
 * TAB'A GERÇEKTEN BASILIYOR.
 *
 * İlk hâli `el.focus()` çağırıyordu ve "odak görünmüyor" dedi — yanlış
 * alarmdı. `:focus-visible` yalnız KLAVYEYLE gelen odakta açılıyor;
 * betikten odaklamak `:focus` veriyor ama `:focus-visible` vermiyor.
 * Yani ölçüm, ölçtüğünü sandığı şeyi hiç uyandırmıyordu.
 */
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
const odak = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const kalinlik = parseFloat(s.outlineWidth) || 0;
  const outlineVar = kalinlik > 0 && s.outlineStyle !== 'none';
  const golgeVar = s.boxShadow !== 'none' && s.boxShadow !== '';
  return {
    outlineVar,
    golgeVar,
    outline: s.outline,
    golge: s.boxShadow.slice(0, 60),
    oge: el.tagName.toLowerCase(),
  };
});
if (odak === null) {
  kotu('Tab tuşu hiçbir şeye odaklanmadı', 'klavyeyle oyun gezilemiyor');
} else if (odak.outlineVar || odak.golgeVar) {
  iyi(`Odak görünür (<${odak.oge}>)`, odak.outlineVar ? odak.outline : odak.golge);
} else {
  kotu('Odaklanan öğe görünmüyor', 'klavyeyle gezen oyuncu nerede olduğunu göremez');
}

await tarayici.close();

console.log(sorun === 0 ? '\nERİŞİM DENETİMİ TEMİZ\n' : `\n${sorun} erişim sorunu bulundu.\n`);
process.exit(sorun === 0 ? 0 : 1);
