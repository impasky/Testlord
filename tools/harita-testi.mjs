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
import { bolgeyeDokun, rehberiSustur } from './lib/gezin.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { kayitOl } from './lib/kayit.mjs';
import { readFileSync } from 'node:fs';

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
  lordName: `Har ${damga.toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)}`,
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
      `${kendi?.distance} adım`,
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
const tarayici = await tarayiciAc();
const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
const konsol = [];
sayfa.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
await sayfa.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await sayfa.reload({ waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await ogreticiyiGec(sayfa);
await rehberiSustur(sayfa);
await sayfa.click('nav button:has-text("Dünya")');
await sayfa.waitForTimeout(2000);

/*
 * Harita bir TOPRAK haritası (docs/23): resimli zemin, üstünde her
 * bölgenin karaya kırpılmış toprağı (SVG yolu, `data-bolge`) ve ters
 * ölçekli etiketler.
 */
const tuval = sayfa.locator('[data-harita-tuval]');
const bolgeSayisi = await sayfa.locator('[data-bolge]').count();
const govdeMetni = () => sayfa.locator('[data-harita-tuval]').innerText();
const adSayisi = () => sayfa.locator('[data-bolge-ad]').count();

/*
 * HARİTA YAKIN AÇILIYOR (docs/12 §11.6). Dünya 121 bölge; hepsini tek
 * karede göstermek onu bir rozet kalabalığına çeviriyordu. Açılış artık
 * oyuncunun toprağının üstünde ve gerisi kaydırarak bulunuyor.
 */
const acilisDonusumu = await tuval.evaluate((el) => el.style.transform);
const acilisOlcegi = Number(/scale\(([\d.]+)\)/.exec(acilisDonusumu)?.[1] ?? '1');
kontrol('Harita yakınlaşmış açılıyor', acilisOlcegi > 1.5, acilisDonusumu);

await sayfa.screenshot({ path: `${CIKTI}/harita-0-acilis.png` });

// Kademe ölçümleri UZAK ölçekte yapılıyor: "sığdır" bütün dünyayı getiriyor.
await sayfa.getByRole('button', { name: 'Haritayı sığdır' }).click();
await sayfa.waitForTimeout(600);

// Uzakta büyük alan adları: medeniyetler (docs/23 §8 — vilayet artık
// bölge kartında, ayrı mercek yok).
const uzakMetin = await govdeMetni();
const medeniyetAdlari = [
  ...new Set((await G('/map')).regions.filter((r) => r.medeniyet).map((r) => r.medeniyet.ad)),
].map((a) => a.toLocaleUpperCase('tr'));
kontrol(
  'Uzakta medeniyet adları haritada yazıyor',
  medeniyetAdlari.some((a) => uzakMetin.includes(a)),
  medeniyetAdlari.filter((a) => uzakMetin.includes(a)).join(' / ') || 'yok',
);
await sayfa.screenshot({ path: `${CIKTI}/harita-1-genel.png` });

/*
 * TOPRAK HARİTASI (docs/23): her bölgenin bir toprağı var ve kendi
 * noktasına basan parmak KENDİ bölgesini seçiyor — komşusunu değil.
 * Eski madalyon haritasında 121 işaretçi üst üste biniyor ve "yanlış
 * bölge açıldı" oluyordu.
 */
{
  const d = await sayfa.evaluate(() => {
    const svg = document.querySelector('[data-toprak-katmani]').getBoundingClientRect();
    let dogru = 0;
    let ortulu = 0;
    const yanlis = [];
    for (const p of document.querySelectorAll('path[data-bolge]')) {
      const x = svg.left + (Number(p.dataset.x) / 100) * svg.width;
      const y = svg.top + (Number(p.dataset.y) / 100) * svg.height;
      const ust = document.elementFromPoint(x, y);
      if (ust === p) dogru++;
      else if (ust?.matches?.('path[data-bolge]'))
        yanlis.push(`${p.dataset.bolge}→${ust.dataset.bolge}`);
      else ortulu++; // üstünde düğme ya da çekmece: kaydırınca açılıyor
    }
    const bos = [...document.querySelectorAll('path[data-bolge]')].filter(
      (p) => !p.getAttribute('d'),
    ).length;
    return { dogru, ortulu, yanlis, bos };
  });
  kontrol('Her bölgenin toprağı çiziliyor', d.bos === 0, `${d.bos} boş`);
  kontrol(
    'Bölgenin noktasına basmak KENDİ toprağını seçiyor, komşusunu değil',
    d.yanlis.length === 0 && d.dogru > 60,
    `${d.dogru} doğru, ${d.ortulu} düğme altında, yanlış: ${d.yanlis.slice(0, 3).join(', ') || 'yok'}`,
  );
}

/*
 * İKİ GÖRÜNÜM (docs/23 §8): "kim nerede" ve tek düğmeyle "Hedefler".
 * Düğme basılı durumunu söylüyor, boyama gerçekten değişiyor.
 */
{
  const benimId = (await G('/map')).regions.find((r) => r.isMine)?.id;
  const dolgu = () =>
    sayfa.evaluate((id) => {
      const p = document.querySelector(`path[data-bolge="${id}"]`);
      return `${p?.getAttribute('fill')}@${p?.getAttribute('fill-opacity')}`;
    }, benimId);
  const hedefDugmesi = sayfa.locator('[data-mercek="hedef"]');
  kontrol(
    'Varsayılan görünüm Kim nerede: Hedefler kapalı',
    (await hedefDugmesi.getAttribute('aria-pressed')) === 'false',
  );
  const siyasi = await dolgu();
  kontrol('Kim nerede: benim toprağım ALTIN', siyasi.startsWith('#f5b731'), siyasi);

  /*
   * HEDEFLER sunucunun kurallarıyla aynı: çekirdek, kendi medeniyetinin
   * lordu, kalkanlı bölge karanlık; benim toprağım altın.
   */
  await hedefDugmesi.click();
  await sayfa.waitForTimeout(300);
  kontrol(
    'Hedefler düğmesi basılı durumunu söylüyor',
    (await hedefDugmesi.getAttribute('aria-pressed')) === 'true',
  );
  const harita = await G('/map');
  const benMed = (await G('/me')).lord.medeniyet?.id ?? null;
  const yasakOlmali = harita.regions.filter(
    (r) =>
      !r.isMine &&
      (r.cekirdek ||
        r.shielded ||
        (r.owner && r.muttefik) ||
        (r.owner && r.paktli) ||
        (r.owner && r.medeniyet && r.medeniyet.id === benMed)),
  );
  const karanliklar = await sayfa.evaluate(
    (idler) => {
      return idler.filter(
        (id) =>
          document.querySelector(`path[data-bolge="${id}"]`)?.getAttribute('fill') === '#0b0806',
      ).length;
    },
    yasakOlmali.map((r) => r.id),
  );
  kontrol(
    'Hedefler: saldırılamayan her bölge karanlık',
    karanliklar === yasakOlmali.length && yasakOlmali.length > 0,
    `${karanliklar} / ${yasakOlmali.length}`,
  );
  await hedefDugmesi.click();
  await sayfa.waitForTimeout(300);
  kontrol('Hedefler kapanınca boyama geri geliyor', (await dolgu()) === siyasi, await dolgu());
}

/*
 * ETİKET KADEMESİ. Uzak ölçekte adların hepsi yazılamaz — telefon
 * genişliğinde yer yok ve ilk denemede hepsi üst üste biniyordu. Uzakta
 * yalnız oyuncuyu ilgilendiren yerler adlanıyor; yakınlaşınca hepsi
 * açılıyor. Ölçüm bu sözleşmeyi tutuyor.
 */
const uzakAd = await adSayisi();
kontrol(
  'Uzak ölçekte adlar seçili: hepsi yazılmıyor',
  uzakAd < bolgeSayisi,
  `${uzakAd} / ${bolgeSayisi} ad`,
);

// Üç adım: ×1 → 1,5 → 2,25 → 3,375. "Orta" 1,5'ten, "yakın" 2,6'dan.
// Simge boyu ORTADA ölçülüyor: uzakta simge yok, yalnız toprak.
const simgeBoyu = async () =>
  (await sayfa.locator('[data-bolge-simge]').first().boundingBox())?.width ?? 0;
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.waitForTimeout(500);
const ortaSimge = await simgeBoyu();
/*
 * ORTADA SİMGE AZ (docs/23 §8). Her bölgeye simge koymak ekranı ~65
 * daireyle dolduruyordu; ortada yalnız oyuncunun toprakları ve kampı.
 */
const ortaSimgeSayisi = await sayfa.locator('[data-bolge-simge]').count();
kontrol(
  'Orta ölçekte simge yalnız senin topraklarında',
  ortaSimgeSayisi > 0 && ortaSimgeSayisi <= 6,
  `${ortaSimgeSayisi} simge`,
);
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.waitForTimeout(600);
const donusum = await tuval.evaluate((el) => el.style.transform);
kontrol('Yakınlaştırma çalışıyor', /scale\((?!1\))/.test(donusum), donusum);

const yakinAd = await adSayisi();
kontrol(
  'Yakınlaşınca bütün adlar açılıyor',
  yakinAd > uzakAd,
  `${uzakAd} -> ${yakinAd} ad (toplam ${bolgeSayisi})`,
);
const yakinMetin = await govdeMetni();
kontrol(
  'Yakınlaşınca bölge adları kısaltılmıyor',
  !yakinMetin.includes('…'),
  `${(yakinMetin.match(/…/g) ?? []).length} kısaltma`,
);

/*
 * SİMGE SABİT BOYUTTA KALIYOR. Harita pinlerinin kuralı: toprak büyür,
 * simge ve yazı büyümez. İlk madalyon haritasında büyüyordu ve
 * yakınlaştırmak haritayı okunur değil OKUNMAZ yapıyordu.
 */
const yakinSimge = await simgeBoyu();
kontrol(
  'Yakınlaşınca simge büyümüyor',
  ortaSimge > 0 && Math.abs(yakinSimge - ortaSimge) < 4,
  `${ortaSimge.toFixed(0)}px -> ${yakinSimge.toFixed(0)}px`,
);
await sayfa.getByRole('button', { name: 'Haritayı sığdır' }).click();
await sayfa.waitForTimeout(500);

const geri = await tuval.evaluate((el) => el.style.transform);
kontrol('Sığdır düğmesi haritayı geri alıyor', /scale\(1\)/.test(geri), geri);

// Bölge seçmek hâlâ çalışıyor: yakınlaştırma dokunmayı bozmamalı.
await bolgeyeDokun(sayfa, '[data-bolge]');
await sayfa.waitForTimeout(900);
const govde = await sayfa.locator('body').innerText();
kontrol('Haritadan bölge seçilebiliyor', /garnizon|Garnizon|SALDIR|Seviye|GELİR/i.test(govde));

/*
 * VİLAYET BİRLİĞİ EKRANDA YAZIYOR MU (docs/11 §1.2 H2).
 *
 * Bonus motorda vardı, arayüzde YOKTU: aynı vilayetteki her bölge
 * diğerlerinin gelirini artırıyor ama bunu hiçbir ekran söylemiyordu —
 * oyuncu ödüllendirildiğini bilmeden ödüllendiriliyordu. Daha kötüsü
 * geliştirme kartı geliri çarpansız hesaplıyor ve oyuncuya ALDIĞINDAN
 * AZINI yazıyordu.
 *
 * Beklenen çarpan burada `data/balance.json`dan yeniden kuruluyor:
 * araçlar `@lordlar/shared`i import edemiyor ve ekranın yazdığı sayıyı
 * ekranın kendi formülüyle doğrulamak hiçbir şey ölçmez.
 */
{
  const { vilayet_birligi: vb } = JSON.parse(
    readFileSync(new URL('../data/balance.json', import.meta.url), 'utf8'),
  ).bolgeler;
  const beklenen = (adet) => (adet <= 1 ? 1 : 1 + Math.min(vb.azami, (adet - 1) * vb.bolge_basina));

  /*
   * Sayılan küme GELİR ALDIĞIM bölgeler, sahip olduklarım değil.
   *
   * Gelir sahiplikten garnizona geçti (docs/16 §6) ve birlik çarpanını
   * motor da bu küme üzerinden sayıyor. Sınama sahipliğe bakmaya devam
   * edince ekranın yazdığı ×1,08'i "yanlış" sanıyordu — yanlış olan
   * sınamanın saydığı kümeydi.
   */
  /*
   * SAYFA TAZELENİYOR: tarayıcı ile API aynı durumu görmeli.
   *
   * Bölgeler sayfa açıldıktan SONRA, doğrudan uçlarla fethedildi;
   * tarayıcının önbelleğindeki harita o fetihleri bilmiyor. Eskiden bu
   * fark görünmüyordu çünkü ölçülen şey de aynı eski veriden geliyordu.
   * Garnizon payı gelince ekran yeni bir alana (`pay`) bakmaya başladı
   * ve iki taraf ayrıştı: sınama 2 bölge sayarken kart "tek bölgen"
   * diyordu.
   */
  await sayfa.reload({ waitUntil: 'domcontentloaded' });
  await sayfa.click('nav button:has-text("Dünya")');
  await sayfa.waitForSelector('[data-bolge]', { timeout: 30000 });
  await sayfa.waitForTimeout(900);

  const benimler = (await G('/map')).regions.filter((r) => r.pay);
  const sayac = {};
  for (const r of benimler) sayac[r.province] = (sayac[r.province] ?? 0) + 1;

  // Taht Vilayeti'nde tek bölge var; birlik oradan ölçülemez.
  const hedef = benimler.find((r) => r.province !== 'taht');
  if (!hedef) {
    kontrol('Vilayet birliği rozeti ölçülebildi', false, 'taht dışı bölgesi olmayan lord');
  } else {
    /*
     * Önceki bölge kartı açıksa perdesi tıklamayı yutuyor; kartın kendi
     * kapatma düğmesine basılıyor (perde düğmesi kartın ARKASINDA:
     * oyuncu için "dışarı dokun, kapansın").
     *
     * KOŞULLU: yukarıdaki tazeleme sayfayı sıfırladığı için kart açık
     * olmayabiliyor. Koşulsuz beklemek, hiç açılmayacak bir düğme için
     * 30 saniye bekleyip sınamayı düşürüyordu.
     */
    const kapat = sayfa.getByRole('button', { name: 'Kapat' });
    if ((await kapat.count()) > 0) {
      await kapat.last().click();
      await sayfa.waitForTimeout(600);
    }
    /*
     * Tıklama DOM üzerinden gönderiliyor, fare ile değil.
     *
     * 121 bölgelik haritada işaretçiler yer yer üst üste biniyor ve
     * Playwright'ın erişilebilirlik denetimi "hedefin üstünde başka bir
     * işaretçi var" diyerek reddediyor. Gerçek oyuncu bunu kaydırarak
     * çözüyor; buradaki ölçüm ise KARTIN İÇERİĞİ, işaretçiye
     * dokunulabilirliği değil — o zaten yukarıda ("Haritadan bölge
     * seçilebiliyor") ölçüldü. `force` de çare değil: örtüşmede tıklamayı
     * üstteki işaretçi yer ve YANLIŞ bölge açılır.
     */
    await sayfa.locator(`[data-bolge="${hedef.id}"]`).dispatchEvent('click');
    /*
     * Kartın AÇILMASI bekleniyor, sabit bir süre değil.
     *
     * Sabit 900 ms, sayfa tazelendikten sonra yetmiyordu: harita verisi
     * yeniden çekiliyor ve kart geç açılıyor. Kart hiç açılmayınca
     * `body` metninde haritanın kendi listesi kalıyor ve sınama orada
     * geçen "tek bölgen" ifadesini kartın cevabı sanıyordu — ölçtüğü
     * şeyi hiç görmeden.
     */
    await sayfa.getByRole('button', { name: 'Kapat' }).first().waitFor({ timeout: 15000 });
    await sayfa.waitForTimeout(300);
    const kart = await sayfa.locator('body').innerText();
    const carpan = beklenen(sayac[hedef.province]);
    const yazi = `×${carpan.toFixed(2).replace('.', ',')}`;

    kontrol(
      'Bölge kartı vilayeti söylüyor',
      new RegExp(hedef.province === 'aksu' ? 'Aksu' : '[A-ZÇĞİÖŞÜ]', 'i').test(kart) &&
        /birlik|tek bölgen/i.test(kart),
      kart.match(/(birlik ×[\d,]+|tek bölgen)/i)?.[0] ?? 'rozet yok',
    );
    kontrol(
      'Birlik çarpanı motorun verdiği sayı',
      carpan > 1 ? kart.includes(yazi) : /tek bölgen/i.test(kart),
      carpan > 1 ? `${sayac[hedef.province]} bölge -> ${yazi}` : 'tek bölge, bonus yok',
    );
  }

  /*
   * SALDIRI ÖNİZLEMESİNDEKİ "saatte +X" de birliği saymalı.
   *
   * Oyuncu saldırı kararını bu sayıya bakarak veriyor. Tarama onu
   * çarpansız hesaplıyordu: kendi vilayetindeki bir hedef için ekranda
   * yazan gelir, fetihten sonra gerçekten alacağının altındaydı — üstelik
   * öneri motoru da aynı sayıyla sıralama yaptığı için "nerede" sorusunu
   * hiç sormuyordu.
   *
   * Ölçü, motorun formülünü tekrar yazmadan kuruluyor: `regionIncome`
   * altın/demir/erzak için `incomeMult` ile DOĞRUSAL. O hâlde aynı tür ve
   * seviyedeki iki bölgede `gelir / (incomeMult × birlikÇarpanı)` aynı
   * sayı olmalı — biri kendi vilayetinde, öteki hiç bölgen olmayan bir
   * vilayette olsa bile.
   */
  /*
   * Önizleme için EVDE asker gerekiyor. Fetihten sağ çıkan ordu artık
   * bölgede kalıyor (docs/16 §6), yani bu noktada ev boş olabiliyor ve
   * sınama "ordu 0" diye ölçemeden kalıyordu.
   */
  await P('/army/train', { unitType: 'mizrakci', count: 30 });
  await P('/test/kuyruklari-bitir');
  const ordu = await G('/army');
  const evOrdusu = Object.fromEntries(
    Object.entries(ordu.home ?? {}).filter(([, n]) => (n ?? 0) > 0),
  );
  const oncelik = (await G('/map')).regions.filter((r) => !r.isMine && r.type !== 'taht');
  const benimVilayet = Object.keys(sayac).find((v) => v !== 'taht' && sayac[v] >= 1);
  const esle = (r) => `${r.type}|${r.level}`;
  const icerde = oncelik.filter((r) => r.province === benimVilayet);
  const disarda = oncelik.filter((r) => !sayac[r.province]);
  const ic = icerde.find((a) => disarda.some((b) => esle(a) === esle(b)));
  const dis = ic ? disarda.find((b) => esle(b) === esle(ic)) : null;

  if (!ic || !dis || Object.keys(evOrdusu).length === 0) {
    kontrol(
      'Önizleme geliri ölçülebildi',
      false,
      `eşleşen çift yok (içerde ${icerde.length}, dışarda ${disarda.length}, ordu ${Object.keys(evOrdusu).length})`,
    );
  } else {
    const onizle = (id) => P('/battle/preview', { toRegionId: id, army: evOrdusu, generalIds: [] });
    const [a, b] = [await onizle(ic.id), await onizle(dis.id)];
    const carpanIc = beklenen(sayac[benimVilayet] + 1);
    // Üç kaynağın TOPLAMI: tarla altın üretmiyor, maden erzak üretmiyor —
    // tek bir kaynağa bakmak türe göre sıfır bölme demekti. Üçü de
    // `incomeMult` ile doğrusal, şöhret değil (o yüzden toplama girmiyor).
    const birim = (o, r, c) => {
      const g = o.odul.saatlikGelir;
      return (g.altin + g.demir + g.erzak) / (r.incomeMult * c);
    };
    const x = birim(a, ic, carpanIc);
    const y = birim(b, dis, 1);
    kontrol(
      'Önizlemedeki saatlik gelir vilayet birliğini sayıyor',
      y > 0 && Math.abs(x - y) / y < 0.02,
      `${ic.name} (${ic.type} sv${ic.level}, ×${carpanIc.toFixed(2)}) ${x.toFixed(2)} ` +
        `vs ${dis.name} ${y.toFixed(2)}`,
    );
  }

  /*
   * BÖLGE BIRAKMA İKİ DOKUNUŞ İSTİYOR.
   *
   * Tek dokunuşta çalışıyordu: düğmeleri deneyen bot başkenti bir
   * dokunuşla bıraktı ve şehir kademesi düştü. Geri dönüşü olmayan her
   * karar gibi (hesap silme, taraf değiştirme) ilk dokunuş SORMALI.
   */
  if (hedef) {
    const kapatB = sayfa.getByRole('button', { name: 'Kapat' });
    if ((await kapatB.count()) > 0) {
      await kapatB.last().click();
      await sayfa.waitForTimeout(600);
    }
    await sayfa.locator(`[data-bolge="${hedef.id}"]`).dispatchEvent('click');
    const birakDugmesi = sayfa.getByRole('button', { name: 'Bu bölgeyi bırak' });
    await birakDugmesi.waitFor({ timeout: 15000 });
    await birakDugmesi.click();
    const evet = sayfa.getByRole('button', { name: 'Evet, bırak' });
    await evet.waitFor({ timeout: 5000 });
    const hala = (await G('/map')).regions.find((r) => r.id === hedef.id);
    kontrol(
      'İlk dokunuş bırakmıyor, soruyor',
      hala?.isMine === true && (await sayfa.getByRole('button', { name: 'Vazgeç' }).count()) > 0,
      hedef.name,
    );
    await sayfa.getByRole('button', { name: 'Vazgeç' }).click();
    kontrol(
      'Vazgeç onayı kapatıyor',
      (await evet.count()) === 0 && (await birakDugmesi.count()) === 1,
    );
    await birakDugmesi.click();
    await evet.click();
    await sayfa.waitForTimeout(1500);
    const sonra = (await G('/map')).regions.find((r) => r.id === hedef.id);
    kontrol('"Evet, bırak" bölgeyi bırakıyor', sonra?.isMine === false, hedef.name);
  }
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol[0] ?? '');

await tarayici.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
