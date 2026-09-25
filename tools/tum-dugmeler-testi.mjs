/**
 * BÜTÜN DÜĞMELER — her sekmede, her panelde, her alt sekmede görünen her
 * düğmeye tek tek basan tarayıcı botu.
 *
 * Oyuncunun isteği: "oyunu tam anlamıyla baştan sona test et, hiçbir
 * butonun işlevini es geçme, hepsini dene, kontrol et."
 *
 * Öteki uçtan uca testler bir AKIŞI sınıyor (akına çık, hastaneden
 * taburcu et, turu bitir). Bu bot akış bilmiyor: bir yere gidiyor, orada
 * basılabilir ne varsa basıyor, basınca yeni açılanlara da basıyor. Aradığı
 * şey bir akışın unuttuğu düğme:
 *
 *   - basınca konsola hata düşen, sayfayı çökerten (HataSiniri) düğme,
 *   - sunucuda 5xx ya da olmayan bir uca (404) giden düğme,
 *   - görünür ve etkin olduğu hâlde üstü örtülü, basılamayan düğme,
 *   - basılınca HİÇBİR ŞEY olmayan düğme (ekran değişmiyor, istek yok).
 *
 * Sonuncusu uyarı, hata değil: bazı düğmeler bilerek sessiz (zaten seçili
 * sekme). Uyarılar listeleniyor ki gözle bakılsın.
 *
 * NASIL GEZİYOR. Her yer (beş sekme, bütün kapılar, yönetici panelleri)
 * için: oraya git, EN ÜSTTEKİ katmanda (açık alt sayfa > açık panel >
 * sayfa) görünen düğmeleri topla, basılmamış ilkine bas, sonucu ölç.
 * Basış yeri değiştirdiyse (panel kapandı, sekme değişti) yere geri dön.
 * Aynı AİLEDEN (aynı `data-*` imzası ya da aynı yazı) en çok üç düğmeye
 * basılıyor: 121 bölgenin hepsine basmak bir şey öğretmez, üçüne basmak
 * düğmenin çalıştığını gösterir.
 *
 * Geri dönüşü olmayan düğmeler (ayrıl, sil, çıkar, terhis, iptal) her
 * yerin EN SONUNA bırakılıyor: ittifaktan erken ayrılan bot ittifakın
 * geri kalan düğmelerini hiç göremezdi. Çıkış ve hesap silme bu botun
 * işi değil (hesap-testi ve kimlik-testi sınıyor).
 *
 * SADECE GELİŞTİRME. `pnpm dugmeler` (node tools/tum-dugmeler-testi.mjs)
 */
import { devices } from 'playwright';
import { tarayiciAc } from './lib/tarayici.mjs';
import { kayitOl, benzersizAd } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { CUBUK, ekrana, kapiyiKapat, rehberiSustur } from './lib/gezin.mjs';
import { bolgeKazandir, sehriKur } from './lib/ilerlet.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const YER_BASINA_AZAMI = Number(process.env.YER_BASINA_AZAMI ?? 70);
const AILE_BASINA = 3;

console.log('Lordlar Çağı — bütün düğmeler (iPhone 13)\n');

/* ------------------------------------------------------------------ */
/* Kurulum: YERLEŞMİŞ bir lord — ekranların dolu hâli                  */
/* ------------------------------------------------------------------ */

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `td${damga}@lordlar.dev`,
  lordName: benzersizAd('Dugme'),
});
const bas = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g, b = bas, yontem = 'POST') =>
  fetch(`${API}/api${y}`, { method: yontem, headers: b, body: JSON.stringify(g ?? {}) })
    .then((r) => r.json())
    .catch(() => ({}));
const get = (y, b = bas) =>
  fetch(`${API}/api${y}`, { headers: b })
    .then((r) => r.json())
    .catch(() => ({}));

await bolgeKazandir(API, token);
await sehriKur(API, token);
await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000, elmas: 300 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord?.statPoints ?? 0;
if (puan > 0) {
  await post('/me/stats', { liderlik: Math.floor(puan / 2), guc: puan - Math.floor(puan / 2) });
}
await post('/army/train', { unitType: 'mizrakci', count: 120 });
await post('/army/train', { unitType: 'okcu', count: 80 });
await post('/items/craft', { tier: 2, slot: 'silah' });
await post('/items/craft', { tier: 1, slot: 'kalkan' });
await post('/test/kuyruklari-bitir');
const esya = (await get('/items')).items?.[0];
if (esya) await post(`/items/${esya.id}/equip`);
const kadro = (await get('/generals')).kadro ?? [];
const g0 = kadro.filter((g) => !g.sahipMi).sort((a, b) => a.maliyet_altin - b.maliyet_altin)[0];
if (g0) {
  await post(`/generals/${g0.key}/hire`);
  await post(`/generals/${g0.key}/assign`, { slotIndex: 0 });
}
await post('/ittifak/kur', { ad: `Dugme ${damga % 10000}`, etiket: `T${damga % 100}` });
// Yönetici: şikâyet kuyruğu ve yönetici paneli de gezilsin.
await post('/test/yonetici-yap');
// Hastane ve sahadaki akın DOLU olsun: bir akın çözülsün (yaralı
// hastaneye), bir akın sahada kalsın (süre çubuğu).
await post('/akin', { haritaKey: 'kirik_sahil', grupNo: 1, army: { mizrakci: 30 } });
await post('/test/akinlari-bitir');
await post('/akin', { haritaKey: 'kirik_sahil', grupNo: 2, army: { mizrakci: 30 } });

// İkinci bir lord ittifaka katılıp sohbete yazsın: "şikâyet et" ve
// "engelle" yalnız BAŞKASININ mesajında çıkıyor.
const ittifakId = (await get('/ittifak')).ittifakim?.id ?? null;
let ikinciAd = null;
if (ittifakId) {
  const ikinci = await kayitOl(API, {
    email: `td2${damga}@lordlar.dev`,
    lordName: (ikinciAd = benzersizAd('Yoldas')),
  });
  const b2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${ikinci.token}` };
  // Kuruluştaki katılım ayarı yok sayılıyor; kapıyı ayrı uçtan aç.
  await post('/ittifak/ayarlar', { katilim: 'acik' });
  await post('/test/dogrulanmis-yap', {}, b2);
  await post(`/ittifak/${ittifakId}/katil`, {}, b2);
  await post('/ittifak/sohbet', { metin: 'Selam lordum, kuzeyden akın geliyor.' }, b2);
  // Genel sohbette de bir yabancı söz: profil kartı, şikâyet ve engel
  // yalnız başkasının mesajında çıkıyor.
  await post('/profil/resim', { tur: 'hazir', key: 'casus_leyla' }, b2, 'PUT');
  await post('/sohbet/genel', { metin: 'Diyarın bütün lordlarına selam!' }, b2);
}

/* ------------------------------------------------------------------ */
/* Tarayıcı                                                            */
/* ------------------------------------------------------------------ */

const tarayici = await tarayiciAc();
const ctx = await tarayici.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

const olaylar = { konsol: [], sayfa: [], istek: [], yanit: [] };
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // Tarayıcının kendi "kaynak yüklenemedi" satırı: asıl bilgi yanıt
  // dinleyicisinde, burada ikinci kez sayılmasın.
  if (/Failed to load resource/.test(t)) return;
  olaylar.konsol.push(t);
});
page.on('pageerror', (e) => olaylar.sayfa.push(String(e?.message ?? e)));
page.on('request', (r) => {
  if (r.url().includes('/api/')) olaylar.istek.push(`${r.method()} ${r.url()}`);
});
page.on('response', (r) => {
  const u = r.url();
  if (!u.includes('/api/')) return;
  olaylar.yanit.push({ durum: r.status(), yol: `${r.request().method()} ${u.replace(API, '')}` });
});
// Onay kutuları KABUL ediliyor: düğmenin işini görmek istiyoruz.
page.on('dialog', (d) => d.accept().catch(() => {}));
// Yeni sekme açan bağlantı: kapat, sayfada kal.
ctx.on('page', (p) => p.close().catch(() => {}));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button', { timeout: 30000 });
await ogreticiyiGec(page);
await rehberiSustur(page);
await page.waitForSelector('nav button', { timeout: 30000 });
await page.waitForTimeout(1500);

/* ------------------------------------------------------------------ */
/* Yerler                                                              */
/* ------------------------------------------------------------------ */

/** Açık alt sayfaları (bölge kartı, şikâyet sayfası) ve panelleri kapatır. */
async function temizle() {
  for (let i = 0; i < 3; i++) {
    const perde = page.locator('button.fixed[aria-label="Kapat"]');
    if (await perde.count()) {
      await perde
        .last()
        .click({ timeout: 1500 })
        .catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  await kapiyiKapat(page).catch(() => {});
}

/*
 * Açık panelin ADI: kapıya gidince okunuyor. "Buradayız" demek için
 * herhangi bir panelin açık olması yetmiyor — Hesap'tan Şikâyet kuyruğu
 * açılınca bot kendini hâlâ Hesap'ta sanıyor ve Hesap'ın kalan
 * düğmelerini hiç görmüyordu. İç içe alt sayfa (araştırma düğümü)
 * panelin ÜSTÜNDE açılıyor; o yüzden "en üstteki" değil "bu ad açık mı".
 */
let panelAdi = null;
async function panelAdiniOku() {
  panelAdi = await page
    .locator('[role="dialog"][aria-modal="true"]')
    .last()
    .getAttribute('aria-label', { timeout: 3000 })
    .catch(() => null);
}
async function panelAcikMi() {
  if (!panelAdi) return false;
  if (/^#\/(gizlilik|kosullar)/.test(await page.evaluate(() => location.hash))) return false;
  return (await page.locator(`[role="dialog"][aria-label="${panelAdi}"]`).count()) > 0;
}

const YERLER = [
  ...CUBUK.map(([k, ad]) => ({
    ad: `sekme:${k}`,
    git: async () => {
      await kurtar();
      await page.click(`nav button:has-text("${ad}")`);
      await page.waitForTimeout(900);
    },
    // Sekmede kalıyor muyuz: çubuktaki etkin düğme ve açık panel yok.
    burada: async () =>
      (await page.locator('[role="dialog"]').count()) === 0 &&
      (await page.locator(`nav button[aria-current="page"]:has-text("${ad}")`).count()) > 0,
  })),
  ...[
    'malikane',
    'gorevler',
    'generaller',
    'demirhane',
    'arastirma',
    'ittifak',
    'olaylar',
    'siralama',
    'hesap',
    'pazar',
  ].map((k) => ({
    ad: `kapi:${k}`,
    git: async () => {
      await kurtar();
      await ekrana(page, k, 900);
    },
    burada: panelAcikMi,
  })),
  {
    ad: 'kapi:medeniyet',
    git: async () => {
      await kurtar();
      await page.click('nav button:has-text("Dünya")');
      await page.waitForTimeout(900);
      await page.locator('[data-rehber="medeniyet-serit"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(900);
    },
    burada: panelAcikMi,
  },
  {
    // Genel sohbet: girişi üst çubukta, her ekranda.
    ad: 'kapi:sohbet',
    git: async () => {
      await kurtar();
      await page.click('[data-ust-sohbet]');
      await page.waitForTimeout(900);
    },
    burada: panelAcikMi,
  },
  {
    // Uygulama kasası: alt çubuğun tutamağından (çekme hareketini
    // genel-sohbet-testi sınıyor). Her karo bir yere götürüyor; bot
    // her birinden sonra kasayı yeniden açıyor.
    ad: 'kasa',
    git: async () => {
      await kurtar();
      await page.click('[data-kasa-tutamak]');
      await page.waitForTimeout(600);
    },
    burada: async () =>
      (await page.locator('[role="dialog"][aria-label="Tüm sayfalar"]').count()) > 0,
  },
  ...['Şikâyet kuyruğu', 'Yönetici paneli'].map((yazi) => ({
    ad: `kapi:${yazi}`,
    git: async () => {
      await kurtar();
      await ekrana(page, 'hesap', 700);
      await page.locator('[role="dialog"]').getByRole('button', { name: yazi }).click();
      await page.waitForTimeout(900);
    },
    burada: panelAcikMi,
  })),
];

/* ------------------------------------------------------------------ */
/* Düğme seçimi (tarayıcıda)                                           */
/* ------------------------------------------------------------------ */

/**
 * En üstteki katmanda basılmamış ilk düğmeyi bulur ve `data-tt-hedef` ile
 * işaretler. Kalanların sayısını ve etkisiz (disabled) olanları da döner.
 */
function dugmeSec({ gezilen, aileSayim, tehlikeliSona, azamiAile, onceki }) {
  document.querySelectorAll('[data-tt-hedef]').forEach((e) => e.removeAttribute('data-tt-hedef'));
  const gorunur = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  /*
   * KATMAN: açık bir alt sayfa (sabit, z-50) varsa yalnız onun içi; yoksa
   * en üstteki panel; yoksa bütün sayfa. Arkadaki düğmeler görünür ama
   * örtülü — onlara basmak oyuncunun yapamayacağı bir şeyi sınamak olurdu.
   */
  const altSayfalar = [...document.querySelectorAll('div.fixed')].filter(
    (e) => /\bz-50\b/.test(e.className) && gorunur(e),
  );
  const paneller = [...document.querySelectorAll('[role="dialog"]')].filter(gorunur);
  const kok = altSayfalar.at(-1) ?? paneller.at(-1) ?? document.body;

  const adaylar = [
    ...kok.querySelectorAll('button, a[href], [role="button"], [role="tab"], summary'),
  ].filter((e) => {
    if (!gorunur(e)) return false;
    /*
     * Haritadaki bölge işaretçileri sığdırılmış hâlde birbirinin üstüne
     * biniyor (121 bölge telefon genişliğinde; gezin.mjs → bolgeyeDokun).
     * Örtülü olanı oyuncu yakınlaştırarak açıyor — hata değil. Yalnız
     * GERÇEKTEN dokunulabilen işaretçiler sayılıyor.
     */
    if (e.hasAttribute('data-bolge')) {
      const r = e.getBoundingClientRect();
      const ust = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!ust || !(ust === e || e.contains(ust))) return false;
    }
    if (e.closest('nav')) return false; // alt çubuk: yerler zaten onu geziyor
    const y = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (/^Çıkış$/i.test(y)) return false; // oturumu kapatır — hesap testinin işi
    // Bölgeyi GERÇEKTEN bırakır: bot başkenti bırakınca şehir kademesi
    // düşüyor, sonraki yerlerin kapıları kilitleniyordu. İlk dokunuş (onay
    // kartını açan) ve Vazgeç deneniyor; bırakmanın kendisi denetim-testi'nde.
    if (/^Evet, bırak$/i.test(y)) return false;
    if (e.matches('button.fixed[aria-label="Kapat"]')) return false; // perde
    return true;
  });

  const anahtar = (e) => {
    const y = (e.textContent ?? '').replace(/\s+/g, ' ').replace(/\d+/g, '#').trim().slice(0, 48);
    const d = [...e.attributes]
      .filter((a) => a.name.startsWith('data-') && a.name !== 'data-tt-hedef')
      .map((a) => `${a.name}=${a.value}`)
      .join(',');
    return `${e.tagName}|${e.getAttribute('aria-label') ?? ''}|${y}|${d}`;
  };
  /*
   * AİLE: aynı işi yapan düğmeler. `data-bina-kapi="demirhane"` ile
   * `="ittifak"` ayrı yerlere götürüyor, ayrı aile. `data-bolge="12"` ile
   * `="13"` aynı işi yapıyor (bölge kartı), tek aile — değerinde rakam ya
   * da kimlik olan imzalar adıyla gruplanıyor.
   */
  const aile = (e) => {
    const d = [...e.attributes].find(
      (a) => a.name.startsWith('data-') && a.name !== 'data-tt-hedef',
    );
    if (d) return /\d|^c[a-z0-9]{20,}$/.test(d.value) ? d.name : `${d.name}=${d.value}`;
    return `yazi:${(e.textContent ?? '').replace(/\s+/g, ' ').replace(/\d+/g, '#').trim().slice(0, 24)}`;
  };
  const TEHLIKELI =
    /(ayrıl|dağıt|sil\b|silmek|çıkar|terhis|iptal|geri çek|kaldır|reddet|fesih|feshet|sat\b|sustur|yasakla)/i;

  let kapali = 0;
  const sira = [];
  const gorulen = new Map();
  for (const e of adaylar) {
    const k0 = anahtar(e);
    const n = (gorulen.get(k0) ?? 0) + 1;
    gorulen.set(k0, n);
    const k = `${k0}#${n}`;
    if (gezilen.includes(k)) continue;
    const devreDisi = e.disabled || e.getAttribute('aria-disabled') === 'true';
    if (devreDisi) {
      kapali++;
      continue;
    }
    const a = aile(e);
    if ((aileSayim[a] ?? 0) >= azamiAile) continue;
    const yazi = (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim();
    const secili =
      e.getAttribute('aria-selected') === 'true' ||
      e.getAttribute('aria-pressed') === 'true' ||
      e.getAttribute('aria-checked') === 'true' ||
      e.getAttribute('aria-current') === 'page';
    // Panelin kendi "Kapat"ı da sona: basınca yerden çıkılıyor.
    const cikis = e.getAttribute('data-rehber') === 'kapi-kapat';
    sira.push({
      e,
      k,
      a,
      yazi: yazi.slice(0, 60),
      tehlikeli: TEHLIKELI.test(yazi) || cikis,
      secili,
      yeni: !onceki.includes(k),
    });
  }
  /*
   * Sıra: önce SON BASIŞIN AÇTIKLARI (derinlemesine — sekmeye basınca
   * sekmenin içi, öteki sekmeye geçmeden), sonra geri kalan güvenliler,
   * en son geri dönüşsüzler.
   */
  const secilen = tehlikeliSona
    ? (sira.find((s) => s.yeni && !s.tehlikeli) ??
      sira.find((s) => !s.tehlikeli) ??
      sira.find((s) => s.tehlikeli))
    : sira[0];
  const tumAnahtarlar = sira.map((s) => s.k);
  if (!secilen) return { secilen: null, kalan: 0, kapali, tumAnahtarlar };
  secilen.e.setAttribute('data-tt-hedef', '1');
  return {
    secilen: {
      k: secilen.k,
      a: secilen.a,
      yazi: secilen.yazi,
      tehlikeli: secilen.tehlikeli,
      secili: secilen.secili,
      etiket: secilen.e.tagName,
      href: secilen.e.getAttribute('href'),
    },
    kalan: sira.length,
    kapali,
    tumAnahtarlar,
  };
}

/** Ekranın imzası: sayılar atılmış DOM özeti (geri sayımlar gürültü yapmasın). */
function imza() {
  const h = document.body.innerHTML.replace(/\d+/g, '');
  let x = 0;
  for (let i = 0; i < h.length; i += 7) x = (x * 31 + h.charCodeAt(i)) | 0;
  return `${location.hash}|${document.querySelectorAll('[role="dialog"]').length}|${h.length}|${x}`;
}

/** Boş metin kutularını makul bir değerle doldurur — parola hariç. */
async function kutulariDoldur() {
  await page.evaluate(() => {
    const ayarla = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.disabled || el.readOnly || el.value) continue;
      const t = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (['password', 'hidden', 'checkbox', 'radio', 'file', 'email'].includes(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      if (t === 'number' || t === 'range') ayarla(el, '1');
      else ayarla(el, 'Deneme');
    }
  });
}

/**
 * Çöken ya da takılan sayfayı baştan açar (hash atılır).
 *
 * Dil de Türkçeye dönüyor: Hesap'taki "English"e basılınca arayüz
 * İngilizceye geçiyor ve bot sekmeleri Türkçe adlarıyla bulamıyordu.
 * Dil değiştirmenin kendisi `dil-testi`nin işi.
 *
 * Öğretici ve kâhya turu da kapatılıyor: Hesap'taki "Öğreticiyi tekrar
 * oku" ikisini sunucuda baştan açıyor (bilerek — oyuncu onboarding'in
 * tamamını istiyor). Öğretici her yüklemede ekranı örtüyor, tur da ışıklı
 * düğme dışındaki her şeyi karartıyor; sonraki yerlerin hepsi "gidilemedi"
 * çıkıyordu. İkisinin düğmeleri `ogretici-testi` ve `rehber-tur-testi`nin işi.
 */
async function kurtar() {
  await page.evaluate(() => localStorage.setItem('lordlar_dil', 'tr')).catch(() => {});
  await page.goto(WEB, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('nav button', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const ogretici = page.locator('[role=dialog][aria-label="Öğretici"]');
  if (await ogretici.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Öğreticiyi geç' }).click();
    await ogretici.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    await rehberiSustur(page, API);
    await page.waitForSelector('nav button', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

/* ------------------------------------------------------------------ */
/* Gezinti                                                             */
/* ------------------------------------------------------------------ */

/** `SADECE=kapi:hesap,sekme:akin` ile yalnız o yerler; `DETAY=1` ile her basış yazılır. */
const SADECE = (process.env.SADECE ?? '').split(',').filter(Boolean);
const DETAY = process.env.DETAY === '1';

const hatalar = [];
const uyarilar = [];
/** Hata anında yazılıyor: bot yarıda kalsa da bulunan kaybolmasın. */
const hataEkle = (m) => {
  hatalar.push(m);
  console.log(`  ✗ ${m}`);
};
const ozet = [];
let toplamBasis = 0;

const HATA_SINIRI = 'Bir şeyler ters gitti';

for (const yer of YERLER) {
  if (SADECE.length && !SADECE.includes(yer.ad)) continue;
  const gezilen = [];
  const aileSayim = {};
  let onceki = [];
  let basis = 0;
  let kapaliEnCok = 0;
  let yerHata = 0;

  console.log(`→ ${yer.ad}`);
  panelAdi = null;
  try {
    await yer.git();
    if (yer.ad.startsWith('kapi:')) await panelAdiniOku();
  } catch (e) {
    hataEkle(`${yer.ad}: yere gidilemedi — ${String(e.message ?? e).split('\n')[0]}`);
    ozet.push(`${yer.ad.padEnd(26)} GİDİLEMEDİ`);
    continue;
  }

  for (let adim = 0; adim < YER_BASINA_AZAMI; adim++) {
    if (
      !(await page
        .locator('nav button')
        .count()
        .catch(() => 0))
    )
      await kurtar();
    if (!(await yer.burada().catch(() => false))) {
      try {
        await yer.git();
      } catch {
        break;
      }
      if (!(await yer.burada().catch(() => false))) break;
    }
    await kutulariDoldur();
    const s = await page.evaluate(dugmeSec, {
      gezilen,
      aileSayim,
      tehlikeliSona: true,
      azamiAile: AILE_BASINA,
      onceki,
    });
    // İlk turda "yeni" diye bir şey yok: her şey yeni.
    onceki = adim === 0 ? (s.tumAnahtarlar ?? []) : [...onceki, ...(s.tumAnahtarlar ?? [])];
    kapaliEnCok = Math.max(kapaliEnCok, s.kapali);
    if (!s.secilen) break;
    const { k, a, yazi, href, secili } = s.secilen;
    gezilen.push(k);
    aileSayim[a] = (aileSayim[a] ?? 0) + 1;

    // Dış bağlantı: basmıyoruz, hedefi geçerli mi diye bakıyoruz.
    if (href && /^https?:/.test(href) && !href.startsWith(WEB)) {
      const r = await fetch(href, { method: 'HEAD' }).catch(() => null);
      if (!r || r.status >= 400) hataEkle(`${yer.ad}: kırık dış bağlantı "${yazi}" → ${href}`);
      continue;
    }

    const once = await page.evaluate(imza);
    const n = {
      konsol: olaylar.konsol.length,
      sayfa: olaylar.sayfa.length,
      istek: olaylar.istek.length,
      yanit: olaylar.yanit.length,
    };
    const hedef = page.locator('[data-tt-hedef]').first();
    let basildi = true;
    try {
      await hedef.click({ timeout: 3000 });
    } catch (e) {
      basildi = false;
      const neden = String(e.message ?? e);
      if (/intercepts pointer events|not visible|outside of the viewport/.test(neden)) {
        hataEkle(`${yer.ad}: "${yazi}" görünüyor ama basılamıyor (üstü örtülü)`);
        yerHata++;
      }
    }
    if (!basildi) continue;
    basis++;
    toplamBasis++;
    if (DETAY)
      console.log(`    · ${yazi || '(adsız)'}${s.secilen.tehlikeli ? '  [geri dönüşsüz]' : ''}`);
    await page.waitForTimeout(700);

    const yeniKonsol = olaylar.konsol.slice(n.konsol);
    const yeniSayfa = olaylar.sayfa.slice(n.sayfa);
    const yeniYanit = olaylar.yanit.slice(n.yanit);
    for (const t of yeniSayfa) {
      hataEkle(`${yer.ad}: "${yazi}" → sayfa hatası: ${t.slice(0, 160)}`);
      yerHata++;
    }
    for (const t of yeniKonsol) {
      if (process.env.HATA_TAM === '1') console.log(`      [tam] ${t.slice(0, 3000)}`);
      hataEkle(`${yer.ad}: "${yazi}" → konsol: ${t.slice(0, 160)}`);
      yerHata++;
    }
    for (const r of yeniYanit) {
      if (r.durum >= 500 || r.durum === 404 || r.durum === 405) {
        hataEkle(`${yer.ad}: "${yazi}" → ${r.durum} ${r.yol}`);
        yerHata++;
      }
    }
    if (await page.getByText(HATA_SINIRI).count()) {
      hataEkle(`${yer.ad}: "${yazi}" → ekran ÇÖKTÜ (${HATA_SINIRI})`);
      yerHata++;
      await kurtar();
      continue;
    }
    const sonra = await page.evaluate(imza).catch(() => once);
    // Zaten seçili sekmeye/çipe basmak bilerek sessiz.
    if (!secili && sonra === once && olaylar.istek.length === n.istek) {
      uyarilar.push(`${yer.ad}: "${yazi}" basınca hiçbir şey değişmedi`);
    }
  }

  ozet.push(
    `${yer.ad.padEnd(26)} ${String(basis).padStart(3)} basış · ${String(kapaliEnCok).padStart(2)} kapalı düğme${yerHata ? ` · ${yerHata} HATA` : ''}`,
  );
}

/* ------------------------------------------------------------------ */
/* Rapor                                                               */
/* ------------------------------------------------------------------ */

console.log(ozet.join('\n'));
console.log(`\nToplam ${toplamBasis} basış, ${YERLER.length} yer.`);
const tekil = (l) => [...new Set(l)];
if (uyarilar.length) {
  console.log(`\nUYARI — basınca bir şey değişmeyen ${tekil(uyarilar).length} düğme (gözle bak):`);
  for (const u of tekil(uyarilar)) console.log(`  · ${u}`);
}
const dortYuz = olaylar.yanit.filter((r) => r.durum >= 400 && r.durum < 500 && r.durum !== 404);
if (dortYuz.length) {
  const say = {};
  for (const r of dortYuz)
    say[`${r.durum} ${r.yol.split('?')[0]}`] = (say[`${r.durum} ${r.yol.split('?')[0]}`] ?? 0) + 1;
  console.log('\nBilgi — oyun kuralının reddettiği istekler (4xx):');
  for (const [k, v] of Object.entries(say)) console.log(`  · ${k} ×${v}`);
}
if (hatalar.length) {
  console.log(`\n${tekil(hatalar).length} HATA:`);
  for (const h of tekil(hatalar)) console.log(`  ✗ ${h}`);
}
if (ikinciAd === null)
  console.log('\n(Not: ikinci lord ittifaka katılamadı; sohbet düğmeleri eksik gezildi.)');

await tarayici.close();
console.log(hatalar.length ? `\n${tekil(hatalar).length} HATA` : '\nTÜM DÜĞMELER TEMİZ');
process.exit(hatalar.length ? 1 : 0);
