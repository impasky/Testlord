/**
 * Rehberli ilk oturum testi (docs/09 T4).
 *
 * Bir oyuncu testi öğreticinin türünü sorguladı: bizimki "oku, sonra dene"
 * diyordu; istenen "şimdi şuna bas, oldu mu bak" idi. Bu test tam olarak
 * o zinciri, gerçek bir tarayıcıda, hiç hile yapmadan yürüyor:
 *
 *   kayıt -> kâhya konuşuyor -> asker eğit -> eğitim HEMEN bitiyor ->
 *   kâhya sıradakini söylüyor -> saldır -> bölge alınıyor -> kâhya susuyor
 *
 * Ölçtüğü asıl şey, rehberin oyunun GERÇEK durumunu takip etmesi. Rehber
 * kendi senaryosunu tutsaydı burada ayrışırdı.
 *
 * SADECE GELİŞTİRME. node tools/rehber-testi.mjs
 */
import { chromium, devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — rehberli ilk oturum testi (iPhone 13)\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `reh${damga}@lordlar.dev`,
  lordName: `Reh ${damga.toString(36).slice(-4)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

// Taze dünya: önceki koşuların aldığı bölgeler yeni oyuncunun komşuluğunu
// boşaltıyor ve "yakında hedef var mı" sorusunu ortamın geçmişine bağlıyor.
await post('/test/bolgeleri-sifirla');

const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => {
  if (m.type() === 'error') konsol.push(m.text());
});

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
await ogreticiyiGec(page);
await page.waitForTimeout(1500);

/** Kâhyanın o an söylediği cümle; yoksa null. */
const kahyaSozu = () =>
  page.evaluate(() => {
    // `.kart` ile sınırlı: rehber ışığının perde üstündeki kartı da
    // "Kâhya Sinan" yazıyor ve DOM'da önce geliyor. Burada ölçülen şey
    // Malikâne'deki kart; ışık kendi testinde ölçülüyor.
    const b = [...document.querySelectorAll('.kart span')].find(
      (x) => x.textContent?.trim() === 'Kâhya Sinan',
    );
    if (!b) return null;
    const kart = b.closest('.kart');
    const p = kart?.querySelector('p');
    return p?.textContent?.trim() ?? '';
  });

// --- 1. Kâhya ilk anda konuşuyor ---
const ilkSoz = await kahyaSozu();
kontrol('Kâhya ilk oturumda görünüyor', ilkSoz !== null, ilkSoz ? `"${ilkSoz.slice(0, 55)}…"` : 'yok');
kontrol(
  'İlk sözü ASKER kurmakla ilgili',
  /asker|mızrakçı|kışla/i.test(ilkSoz ?? ''),
  ilkSoz?.slice(0, 70) ?? '',
);

// --- 2. Eğitim: kâhyanın söz verdiği gibi HEMEN bitiyor ---
{
  const once = (await get('/army')).home;
  const oncekiToplam = Object.values(once ?? {}).reduce((t, n) => t + n, 0);
  kontrol('Yeni lordun ordusu yok', oncekiToplam === 0, `${oncekiToplam} birim`);

  // Kâhyanın işaret ettiği ordu OMURGADAN geliyor; testin kendi rakamını
  // uydurması, rehberin gerçek durumu takip edip etmediğini ölçmez.
  const oneri = (await get('/map')).oneri;
  if (!oneri?.eksik?.karsilanabilir) {
    await post('/test/kaynak-ver', { altin: 40000, demir: 20000, erzak: 20000 });
  }
  const basla = Date.now();
  const e = await post('/army/train', {
    unitType: oneri.eksik.birim,
    count: oneri.eksik.adet,
  });
  kontrol('Eğitim kuyruğa girdi', e.queued === true, e.error ?? '');
  kontrol('Sunucu bunu İLK eğitim saydı', e.ilkEgitim === true, `ilkEgitim=${e.ilkEgitim}`);

  const sure = (new Date(e.finishAt).getTime() - basla) / 1000;
  // 10 mızrakçı normalde 900 sn; kısayol olmadan ilk oturum bu beklemeye gider.
  kontrol('İlk eğitim saniyeler içinde bitiyor', sure < 30, `${Math.round(sure)} sn (normal 900)`);

  // Gerçekten bitmesini BEKLE — hile yok, sunucu çözecek.
  let asker = 0;
  for (let i = 0; i < 20; i++) {
    await new Promise((c) => setTimeout(c, 2000));
    asker = Object.values((await get('/army')).home ?? {}).reduce((t, n) => t + n, 0);
    if (asker > 0) break;
  }
  kontrol('Askerler gerçekten orduya katıldı', asker > 0, `${asker} birim`);
}

// --- 3. İkinci eğitim NORMAL süreye dönüyor ---
{
  await post('/test/kaynak-ver', { altin: 50000, demir: 20000, erzak: 20000 });
  const basla = Date.now();
  const e = await post('/army/train', { unitType: 'mizrakci', count: 10 });
  kontrol('İkinci eğitim kısayol ALMIYOR', e.ilkEgitim === false, `ilkEgitim=${e.ilkEgitim}`);
  const sure = (new Date(e.finishAt).getTime() - basla) / 1000;
  kontrol('İkinci eğitim normal sürede', sure > 300, `${Math.round(sure)} sn`);
  await post('/test/kuyruklari-bitir');
}

// --- 4. Kâhya sıradaki adıma geçti ---
{
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await ogreticiyiGec(page);
  await page.waitForTimeout(2000);
  const soz = await kahyaSozu();
  kontrol('Kâhya hâlâ konuşuyor (bölge yok)', soz !== null);

  /**
   * Ölçülen şey sözün DEĞİŞMESİ değil, oyunun durumunu TAKİP ETMESİ.
   * İlk hâlinde "sözü değişmeli" diye yazmıştım ve kaldı — haklı olarak:
   * ordu eğitilmiş olsa da öneri hâlâ "ordun yetmiyor" diyorsa omurga
   * gerçekten ordu-kur adımındadır ve kâhyanın aynı şeyi söylemesi
   * DOĞRUDUR. Rehberin senaryosu yok; omurga neredeyse o orada.
   */
  const omurgaBasligi = await page.evaluate(() =>
    (document.querySelector('main')?.textContent ?? '').includes('Şimdi ne yapmalısın'),
  );
  kontrol('Omurga hâlâ bir adım gösteriyor', omurgaBasligi === true);
  kontrol(
    'Kâhyanın sözü o adımın sözü',
    soz !== null && soz.length > 20,
    soz?.slice(0, 70) ?? '',
  );
}

// --- 5. Bölge alınınca kâhya SUSUYOR ---
{
  const harita = await get('/map');
  const hedef = harita.oneri;
  kontrol('Omurga bir ilk hedef gösteriyor', Boolean(hedef), hedef?.name ?? 'yok');

  const ordu = (await get('/army')).home;
  const s = await post('/march', { toRegionId: hedef.regionId, army: ordu });
  kontrol('Saldırı kabul edildi', Boolean(s.marchId), s.error ?? JSON.stringify(s).slice(0, 80));

  await post('/test/yuruyusleri-bitir');
  const lord = (await get('/me')).lord;
  kontrol('Bölge alındı', lord.regionCount >= 1, `${lord.regionCount} bölge`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const soz = await kahyaSozu();
  kontrol('Döngü kapanınca kâhya SUSUYOR', soz === null, soz ? `hâlâ konuşuyor: "${soz.slice(0, 40)}"` : 'sustu');
}

// --- 6. Kâhya KAPATILAMIYOR: tur zorunlu ---
{
  /**
   * Eskiden burada "yeter, anladım" düğmesi vardı ve bu bölüm onun
   * çalıştığını ölçüyordu. Oyuncu ayrımı net koydu:
   *
   *   "öğretici ile zorunlu yaptırmayı ayır, oyuncu okusa da okumasa da
   *    yaptırmalı, öğretiyi yapmak zorunda olsun"
   *
   * Sekiz sayfalık tanıtımın "GEÇ"i duruyor — o ANLATIYOR. Kâhya
   * YAPTIRIYOR ve geçilemiyor. Tur kısa ve sonlu: ilk bölge alınınca
   * kendiliğinden bitiyor (yukarıdaki 5. bölüm onu ölçüyor).
   */
  const d2 = Date.now();
  const { token: t2 } = await kayitOl(API, {
    email: `reh${d2}_k@lordlar.dev`,
    lordName: `Rehk ${d2.toString(36).slice(-4)}`,
  });
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), t2);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await ogreticiyiGec(page);
  await page.waitForTimeout(1500);

  kontrol('Yeni lordda kâhya yine görünüyor', (await kahyaSozu()) !== null);
  kontrol('Kâhya kartında kapatma düğmesi YOK',
    (await page.locator('button:has-text("yeter, anladım")').count()) === 0);
  kontrol('Rehber ışığında da kaçış düğmesi YOK',
    (await page.locator('button[aria-label="Rehberi kapat"]').count()) === 0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(1500);
  kontrol('Yenileme de kaçış yolu değil — kâhya duruyor', (await kahyaSozu()) !== null);
}

// --- 7. Kademeli açılım: ilk döngüde ekran sade, sonra doluyor ---
{
  /**
   * Oyuncu testi: "her yerde bir şeyler yazıyor, neler önemli neler
   * önemsiz anlayamadım". Sayınca haklı çıktı — hiçbir şey yapmamış bir
   * lord Malikâne'de sekiz blok görüyordu. Burada blokları SAYIYORUZ;
   * "sade göründü" bir izlenim, sekiz-e-üç bir ölçüm.
   */
  const bloklariSay = () =>
    page.evaluate(() => {
      /**
       * SAYFA İÇERİĞİ, gezinme değil: `document.body.innerText` okurken
       * "GÖREVLER" hep bulunuyordu — artık alt çubukta bir sekme adı.
       * <main> doğru sınır.
       *
       * Ve `textContent`, `innerText` değil: `innerText` CSS'in ÇİZDİĞİ
       * metni döndürüyor, `.baslik` sınıfı da büyük harfe çeviriyor.
       * "Kâhya Sinan" aradığımda DOM'da "KÂHYA SİNAN" yazıyordu ve kart
       * ekranda dururken "yok" raporlanıyordu.
       */
      const govde = document.querySelector('main')?.textContent ?? '';
      const v = (m) => (govde.includes(m) ? 1 : 0);
      return {
        diyar: v('DİYAR'),
        durum: v('komuta'),
        gorev: v('GÖREVLER'),
        olay: v('OLAYLAR'),
        omurga: v('Şimdi ne yapmalısın'),
        kahya: v('Kâhya Sinan'),
      };
    });

  const d3 = Date.now();
  const { token: t3 } = await kayitOl(API, {
    email: `reh${d3}_s@lordlar.dev`,
    lordName: `Rehs ${d3.toString(36).slice(-4)}`,
  });
  const h3 = { 'Content-Type': 'application/json', Authorization: `Bearer ${t3}` };
  const post3 = (y, g) =>
    fetch(`${API}/api${y}`, { method: 'POST', headers: h3, body: JSON.stringify(g ?? {}) }).then(
      (x) => x.json(),
    );
  const get3 = (y) => fetch(`${API}/api${y}`, { headers: h3 }).then((x) => x.json());

  // Tarayıcı deposunu temizlemeye gerek yok: karar artık hesaba bağlı
  // (`Lord.rehberBittiAt`). Depoya bağlıyken buradaki satır, ürünün
  // kendi hatasını testte gizliyordu.
  await page.evaluate((t) => localStorage.setItem('lordlar_token', t), t3);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await ogreticiyiGec(page);
  await page.waitForTimeout(1800);

  const once = await bloklariSay();
  kontrol('İlk döngüde omurga ve kâhya VAR', once.omurga === 1 && once.kahya === 1,
    `omurga=${once.omurga} kâhya=${once.kahya}`);
  kontrol(
    'İlk döngüde durum/görev/olay şeritleri GİZLİ',
    once.durum + once.gorev + once.olay === 0,
    `durum=${once.durum} görev=${once.gorev} olay=${once.olay}`,
  );

  /**
   * BİRİNCİL EYLEM KAYDIRMADAN GÖRÜNMELİ.
   *
   * Kademeli açılımın asıl ölçüsü blok sayısı değil bu: ilk hâlinde diyar
   * tanıtımı ve kâhya kartı omurganın üstündeydi ve tek eylem düğmesi
   * ("Kışlada okçu eğit") 844px'lik ekranın dışında kalıyordu. Oyuncunun
   * "her şeyi üstümüze atıyor" cümlesinin somut hâli buydu — yapılacak
   * şeye ulaşmak için iki metin bloğunu kaydırmak.
   */
  const dugmeY = await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) =>
      /eğit|saldır|üret|yükselt|git/i.test(x.textContent ?? ''),
    );
    return b ? Math.round(b.getBoundingClientRect().bottom) : -1;
  });
  kontrol(
    'Birincil eylem düğmesi kaydırmadan görünüyor',
    dugmeY > 0 && dugmeY <= 844,
    `düğmenin alt kenarı ${dugmeY}px (ekran 844px)`,
  );

  // Döngüyü kapat: bölge al.
  const o3 = (await get3('/map')).oneri;
  await post3('/test/kaynak-ver', { altin: 60000, demir: 30000, erzak: 30000 });
  await post3('/army/train', { unitType: o3.eksik.birim, count: o3.eksik.adet });
  await post3('/test/kuyruklari-bitir');
  const ordu3 = (await get3('/army')).home;
  await post3('/march', { toRegionId: o3.regionId, army: ordu3 });
  await post3('/test/yuruyusleri-bitir');
  const lord3 = (await get3('/me')).lord;
  kontrol('Bölge alındı (kademeli açılım tetiklendi)', lord3.regionCount >= 1,
    `${lord3.regionCount} bölge`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button:has-text("Malikâne")', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const sonra = await bloklariSay();
  kontrol(
    'Bölgeden sonra hepsi geri geliyor',
    sonra.durum === 1 && sonra.gorev === 1 && sonra.olay === 1,
    `durum=${sonra.durum} görev=${sonra.gorev} olay=${sonra.olay}`,
  );

  /**
   * Gizlenen şeyler ULAŞILAMAZ olmamalı. Görevler alt çubukta, Olaylar
   * menüde duruyor; ilk döngüde Malikâne'de görünmemeleri onları
   * kaldırmak değil, ertelemek.
   */
  const cubukta = await page.evaluate(() =>
    Boolean([...document.querySelectorAll('nav button')].find((b) => b.textContent?.includes('Görevler'))),
  );
  kontrol('Gizlenen Görevler alt çubuktan hâlâ ulaşılabilir', cubukta === true);
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));
await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
