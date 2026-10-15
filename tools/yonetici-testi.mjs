/**
 * Yönetici paneli testi.
 *
 * Panelin kuyruktan farkı ARAMA: bot hesabını, hile yapanı kimse şikâyet
 * etmiyor ve kuyrukta hiç görünmüyorlar. Bu yüzden testin çekirdeği şu
 * zincir: ARA → BUL → YASAKLA → oyuncu GERÇEKTEN giremiyor → kaldır →
 * yeniden girebiliyor.
 *
 * "Gerçekten" kelimesi burada iş yapıyor: yasak yalnız veritabanında bir
 * sütunsa hiçbir şeydir. Ölçülen, yasaklı hesabın hem GİRİŞ yapamaması
 * hem de elindeki ESKİ JETONUN çalışmaması — jeton yedi gün geçerli ve
 * yasak ancak o jeton ölünce başlasaydı, yasak değil bir temenni olurdu.
 *
 * İkinci çekirdek yetki sınırı: yönetici olmayan için panel YOK (404).
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/yonetici-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now().toString(36).slice(-4);
const tuz = Math.random().toString(36).slice(2, 5);

async function lordKur(etiket) {
  const eposta = `yon${damga}${tuz}${etiket}@lordlar.dev`;
  const parola = 'Yonetici123!';
  const { token } = await kayitOl(API, {
    email: eposta,
    password: parola,
    lordName: `Yon${damga}${tuz}${etiket}`,
  });
  const cagir = async (yol, yontem, govde, jeton = token) => {
    const c = await fetch(`${API}/api${yol}`, {
      method: yontem,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      ...(yontem === 'POST' ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
    return { kod: c.status, govde: await c.json().catch(() => null) };
  };
  return {
    eposta,
    parola,
    token,
    ad: `Yon${damga}${tuz}${etiket}`,
    post: (yol, govde) => cagir(yol, 'POST', govde).then((r) => r.govde),
    postHam: (yol, govde) => cagir(yol, 'POST', govde),
    get: (yol) => cagir(yol, 'GET').then((r) => r.govde),
    getHam: (yol) => cagir(yol, 'GET'),
  };
}

async function giris(eposta, parola) {
  const c = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: eposta, password: parola }),
  });
  return { kod: c.status, govde: await c.json().catch(() => null) };
}

console.log('Lordlar Çağı — yönetici paneli\n');

const yonetici = await lordKur('a');
const hedef = await lordKur('b');

/* 1. Yetki sınırı: panel yetkisiz için YOK                            */
const yetkisiz = await hedef.getHam(`/yonetici/ara?q=${encodeURIComponent(hedef.ad)}`);
kontrol('Yetkisiz için panel yok (404)', yetkisiz.kod === 404, `kod ${yetkisiz.kod}`);

const yayinYetkisiz = await hedef.getHam('/yonetici/yayin-kontrolu');
kontrol('Yetkisiz için yayın kontrolü yok (404)', yayinYetkisiz.kod === 404);

await yonetici.post('/test/yonetici-yap');

/* 1b. Yayın kontrolü: ad, durum, sebep — hiçbir ayarın değeri yok     */
{
  const y = await yonetici.get('/yonetici/yayin-kontrolu');
  const bulgular = y?.bulgular ?? [];
  kontrol(
    'Yayın kontrolü bulguları dönüyor',
    bulgular.length >= 10 && typeof y.eksik === 'number' && typeof y.uyari === 'number',
    `${bulgular.length} bulgu, ${y?.eksik} eksik`,
  );
  kontrol(
    'Bulgularda yalnız ad, durum ve sebep var',
    bulgular.every((b) => Object.keys(b).sort().join() === 'ad,durum,neden'),
  );
  const ham = JSON.stringify(y);
  kontrol(
    'Yanıtta adres ya da anahtar yok',
    !/:\/\/|postgres|mailto:|@localhost/i.test(ham),
    ham.length > 200 ? `${ham.length} karakter` : ham,
  );
  kontrol(
    'Yönetici atanınca "yönetici" tamam',
    bulgular.find((b) => b.ad === 'yönetici')?.durum === 'tamam',
  );
}

/*
 * 1c. Ölçüm panosu (docs/05 §7): günlük aktif ve tutundurma.
 *
 * Sayıların doğruluğu birim testinde (olcumHesabi.test.ts); burada
 * zincir ölçülüyor: kayıt aktif günü yazıyor, `/me` günün ilk
 * açılışını yazıyor, pano ikisini de görüyor. Başka testler aynı anda
 * lord açabilir — o yüzden eşitlik değil, ARTIŞ aranıyor.
 */
{
  const yetkisizOlcum = await hedef.getHam('/yonetici/olcum');
  kontrol('Yetkisiz için ölçüm panosu yok (404)', yetkisizOlcum.kod === 404);

  const once = await yonetici.get('/yonetici/olcum');
  const bugun = once?.gunluk?.at(-1);
  kontrol(
    'Pano 30 günlük seri veriyor, bugün sonda',
    once?.gunluk?.length === 30 && bugun?.gun === once?.bugun,
    `${once?.gunluk?.length} gün`,
  );
  kontrol(
    'Kayıt bugünün aktifine ve yenisine giriyor',
    (bugun?.yeni ?? 0) >= 2 && (once?.ozet?.bugunAktif ?? 0) >= 2,
    `yeni ${bugun?.yeni}, aktif ${once?.ozet?.bugunAktif}`,
  );

  // İki gün önce kaydolmuş bir lord: kohortu iki gün önceye düşüyor ve
  // bugün oyunu açınca bugünün aktifine giriyor.
  const eski = await lordKur('c');
  await eski.post('/test/lordu-eskit', { gun: 2 });
  const arada = await yonetici.get('/yonetici/olcum');
  const kohort = (p) => p?.kohortlar?.find((k) => k.gun === p.bugun - 2);
  await eski.get('/me');
  const sonra = await yonetici.get('/yonetici/olcum');
  kontrol(
    'Eskitilmiş lord iki gün önceki kohortta',
    (kohort(arada)?.kayit ?? 0) >= 1 && kohort(arada)?.d1 !== null,
    JSON.stringify(kohort(arada)),
  );
  kontrol(
    '/me günün ilk açılışını yazıyor',
    (sonra?.ozet?.bugunAktif ?? 0) > (arada?.ozet?.bugunAktif ?? 0),
    `${arada?.ozet?.bugunAktif} -> ${sonra?.ozet?.bugunAktif}`,
  );
  const ham = JSON.stringify(sonra);
  kontrol('Panoda oyuncu adı yok', !ham.includes(eski.ad) && !ham.includes(hedef.ad));
}

/* 2. Arama: şikâyet beklemeden oyuncuyu bul                           */
const arama = await yonetici.get(`/yonetici/ara?q=${encodeURIComponent(hedef.ad)}`);
const bulunan = arama?.sonuclar?.find((s) => s.ad === hedef.ad);
kontrol('Arama oyuncuyu buluyor', !!bulunan, `${arama?.sonuclar?.length ?? 0} sonuç`);

const kisaArama = await yonetici.getHam('/yonetici/ara?q=a');
kontrol('Tek harflik arama reddediliyor', kisaArama.kod >= 400, `kod ${kisaArama.kod}`);

/* 3. Dosya: karar için gereken her şey tek yanıtta                    */
const dosya = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol('Dosya lordu ve hesabı taşıyor', dosya?.ad === hedef.ad && !!dosya?.hesap?.id);
kontrol(
  'E-posta MASKELİ dönüyor',
  typeof dosya?.hesap?.eposta === 'string' &&
    dosya.hesap.eposta.includes('***') &&
    dosya.hesap.eposta !== hedef.eposta,
  dosya?.hesap?.eposta,
);
kontrol('Yasak ve susturma başlangıçta kapalı', !dosya?.yasak?.aktif && !dosya?.susturma?.aktif);

/* 4. Susturma: panelden, şikâyetsiz                                   */
const ayarlar = await yonetici.get('/yonetici/ayarlar');
const susturmaSaat = ayarlar?.susturmaSureleri?.[0]?.saat;
await yonetici.post(`/yonetici/oyuncu/${bulunan.lordId}/sustur`, {
  saat: susturmaSaat,
  sebep: 'test susturma',
});
const susturulmus = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol('Susturma işledi', susturulmus?.susturma?.aktif === true);
kontrol(
  'Susturma kayda geçti',
  (susturulmus?.gecmis ?? []).some((g) => g.ozet.includes('susturuldu')),
  JSON.stringify(susturulmus?.gecmis?.[0] ?? null),
);

await yonetici.post(`/yonetici/oyuncu/${bulunan.lordId}/susturma-kaldir`, {});
const acildi = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol('Susturma kaldırıldı', acildi?.susturma?.aktif === false);

/* 5. Yasak: sebepsiz olmuyor                                          */
const sebepsiz = await yonetici.postHam(`/yonetici/oyuncu/${bulunan.lordId}/yasakla`, {
  saat: ayarlar?.yasakSureleri?.[0]?.saat,
  sebep: '',
});
kontrol('Sebepsiz yasak reddediliyor', sebepsiz.kod >= 400, `kod ${sebepsiz.kod}`);

const gecersizSure = await yonetici.postHam(`/yonetici/oyuncu/${bulunan.lordId}/yasakla`, {
  saat: 7,
  sebep: 'uydurma süre',
});
kontrol('Dengede olmayan süre reddediliyor', gecersizSure.kod >= 400, `kod ${gecersizSure.kod}`);

const kendiArama = await yonetici.get(`/yonetici/ara?q=${encodeURIComponent(yonetici.ad)}`);
const kendiLord = kendiArama?.sonuclar?.find((s) => s.ad === yonetici.ad)?.lordId;
const kendini = await yonetici.postHam(`/yonetici/oyuncu/${kendiLord}/yasakla`, {
  saat: ayarlar?.yasakSureleri?.[0]?.saat,
  sebep: 'kendini yasakla',
});
kontrol(
  'Yönetici kendini yasaklayamıyor',
  kendini.kod === 400 && String(kendini.govde?.error ?? '').includes('Kendi'),
  `kod ${kendini.kod} — ${JSON.stringify(kendini.govde).slice(0, 60)}`,
);

/* 6. Yasak GERÇEKTEN engelliyor mu                                    */
await yonetici.post(`/yonetici/oyuncu/${bulunan.lordId}/yasakla`, {
  saat: ayarlar?.yasakSureleri?.[0]?.saat,
  sebep: 'bot hesabı',
});
const yasakli = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol('Yasak dosyada görünüyor', yasakli?.yasak?.aktif === true, yasakli?.yasak?.sebep ?? '');

const eskiJeton = await hedef.getHam('/me');
kontrol('ESKİ JETON da çalışmıyor (403)', eskiJeton.kod === 403, `kod ${eskiJeton.kod}`);
kontrol(
  'Sebep oyuncuya söyleniyor',
  typeof eskiJeton.govde?.error === 'string' && eskiJeton.govde.error.includes('bot hesabı'),
  JSON.stringify(eskiJeton.govde).slice(0, 90),
);

const girisDeneme = await giris(hedef.eposta, hedef.parola);
kontrol('Yasaklı hesap GİRİŞ yapamıyor', girisDeneme.kod === 403, `kod ${girisDeneme.kod}`);

/* 7. Geri alınabiliyor                                                */
await yonetici.post(`/yonetici/oyuncu/${bulunan.lordId}/yasak-kaldir`, {});
const geriDondu = await giris(hedef.eposta, hedef.parola);
kontrol('Yasak kalkınca yeniden girebiliyor', geriDondu.kod === 200, `kod ${geriDondu.kod}`);

const sonDosya = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol(
  'Geçmiş SİLİNMİYOR — yasak da kaldırma da duruyor',
  (sonDosya?.gecmis ?? []).some((g) => g.ozet.includes('yasaklandı')) &&
    (sonDosya?.gecmis ?? []).some((g) => g.ozet.includes('Yasak kaldırıldı')),
  `${sonDosya?.gecmis?.length ?? 0} kayıt`,
);
kontrol('Yasak kalktı', sonDosya?.yasak?.aktif === false);

/* ------------------------------------------------------------------ */
/* Arayüz — panel GERÇEKTEN çiziliyor ve düğmeler işliyor mu           */
/* ------------------------------------------------------------------ */

/**
 * Uçların çalışması yetmez: panel bir ekranda açılmıyorsa yönetici
 * elindeki yetkiyi kullanamaz. Bu bölüm zinciri arayüzden geçiriyor —
 * Hesap'tan panel açılıyor mu, arama sonuç çiziyor mu, yasak düğmesi
 * sunucuya gerçekten işliyor mu.
 */
const { tarayiciAc } = await import('./lib/tarayici.mjs');
const { ogreticiyiGec } = await import('./lib/ogretici.mjs');
const { rehberiSustur } = await import('./lib/gezin.mjs');
const { devices } = await import('playwright');
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';

const b = await tarayiciAc();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), yonetici.token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Lord")', { timeout: 20000 });
await ogreticiyiGec(page);
// Rehber ışığının perdesi tıklamaları yutuyor.
await rehberiSustur(page);
await page.waitForSelector('nav button:has-text("Lord")', { timeout: 20000 });

await page.locator('nav button:has-text("Lord")').click();
await page.waitForTimeout(600);
await page.locator('[data-kapi="hesap"]').click();
await page.waitForTimeout(900);

const panelDugmesi = page.locator('button:has-text("Yönetici paneli")');
kontrol('Yöneticiye panel düğmesi çiziliyor', (await panelDugmesi.count()) === 1);
await panelDugmesi.click();
await page.waitForTimeout(1000);

{
  // Yayın kontrolü katlı açılıyor; başlık eksik sayısını açmadan söylüyor.
  const baslik = page.locator('button:has-text("Yayın kontrolü")').first();
  // textContent: başlık CSS'le büyük harf ve "EKSİK"in İ'si /i ile eşleşmiyor.
  const metin = (await baslik.count()) ? ((await baslik.textContent()) ?? '') : '';
  kontrol('Yayın kontrolü başlığı eksik sayısını söylüyor', /\d+ eksik/.test(metin), metin);
  if (metin) await baslik.click();
  await page.waitForTimeout(400);
  kontrol(
    'Açılınca ayar kartları ve elle denenecekler görünüyor',
    (await page.locator('text=NODE_ENV').count()) > 0 &&
      (await page.locator('text=Sunucunun bilemediği').count()) > 0,
  );
}

{
  // Ölçüm panosu da katlı; başlık bugünkü aktifi taşıyor.
  const baslik = page.locator('button:has-text("Ölçüm")').first();
  const metin = (await baslik.count()) ? ((await baslik.textContent()) ?? '') : '';
  kontrol('Ölçüm başlığı bugünkü aktifi söylüyor', /bugün \d+ aktif/i.test(metin), metin);
  if (metin) await baslik.click();
  await page.waitForTimeout(400);
  const pano = page.locator('[data-olcum-panosu]');
  const panoMetni = (await pano.count()) ? await pano.innerText() : '';
  kontrol(
    'Açılınca tutundurma ve 30 günlük sütunlar görünüyor',
    /1\. gün tutundurma/i.test(panoMetni) &&
      (await pano.locator('[role="img"] > div').count()) === 30,
    panoMetni.slice(0, 80).replace(/\n/g, ' '),
  );
  await page.screenshot({ path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/yonetici-olcum.png` });
}

await page.locator('input[aria-label="Lord adı"]').fill(hedef.ad);
// Tam ad: "Ara" metni bölge adlarının içinde de geçiyor ("Çınaraltı")
// ve omurga şeridi o adı taşıdığında seçici iki düğme buluyordu.
await page.getByRole('button', { name: 'Ara', exact: true }).click();
await page.waitForTimeout(1200);
kontrol('Arama sonucu ekranda', (await page.locator(`text=${hedef.ad}`).count()) > 0, hedef.ad);

await page.locator(`button:has-text("${hedef.ad}")`).first().click();
await page.waitForTimeout(1200);
kontrol('Oyuncu dosyası açıldı', (await page.locator('text=Moderasyon geçmişi').count()) > 0);

await page.locator('input[aria-label="Sebep"]').fill('arayüzden yasak');
// Etikete göre: "1 gün" yazan iki düğme var (sustur / yasakla) ve
// metne bakan bir seçici yanlışlıkla susturmaya basıyordu.
const yasakDugmesi = page.locator('button[aria-label="Hesabı yasakla — 1 gün"]');
await yasakDugmesi.click();
await page.waitForTimeout(1500);
const sonDurum = await yonetici.get(`/yonetici/oyuncu/${bulunan.lordId}`);
kontrol(
  'Arayüzden verilen yasak sunucuya işliyor',
  sonDurum?.yasak?.aktif === true && sonDurum?.yasak?.sebep === 'arayüzden yasak',
  JSON.stringify(sonDurum?.yasak ?? null).slice(0, 80),
);

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));
await b.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
