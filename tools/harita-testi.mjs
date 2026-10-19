/**
 * Harita testi (docs/11).
 *
 * İki şeyi ölçüyor:
 *
 * 1. MEKANİK — bölge almak haritayı gerçekten AÇIYOR mu? Mesafe artık en
 *    yakın toprağından ölçülüyor (H1); bunun tek gözlenebilir sonucu, bir
 *    bölge aldıktan sonra uzak bölgelerin YAKINLAŞMASI. Ölçmezsek kural
 *    sessizce geri alınabilir ve kimse fark etmez.
 * 2. GÖRSEL — gerçek dünya haritası (docs/27, tuval) okunuyor, dokunulan
 *    şehir gerçekten o şehir, harita yakınlaştırılabiliyor ve görünüm
 *    hatırlanıyor.
 *
 * API ve web ayakta olmalı. node tools/harita-testi.mjs
 */
import { bolgeyeDokun, bolgeyiSec, rehberiSustur } from './lib/gezin.mjs';
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
  'Haritada ülke bilgisi var',
  once.regions.every((r) => typeof r.province === 'string'),
  `${new Set(once.regions.map((r) => r.province)).size} ülke`,
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
 * Harita bir TUVAL (docs/27): ülkeler, şehir toprakları ve adlar tek bir
 * <canvas>'ta çiziliyor. Bölge başına DOM düğümü yok; ölçümler haritanın
 * test kancasından (`window.__dunyaHaritasi`) okunuyor: görünüm, ekrana
 * yazılan adlar, bir bölgenin boyası ve ekrandaki noktası.
 */
await sayfa.waitForSelector('[data-harita-hazir]', { timeout: 30000 });
const kanca = (ad, ...arg) =>
  sayfa.evaluate(([ad, arg]) => window.__dunyaHaritasi[ad](...arg), [ad, arg]);
const gorunum = () => kanca('gorunum');
const etiketler = () => kanca('etiketler');
const bolgeSayisi = (await G('/map')).regions.length;
const OZET = JSON.parse(readFileSync(new URL('../data/dunya-ozet.json', import.meta.url), 'utf8'));
const ulkeAdlari = new Set(OZET.provinces.map((p) => p.name));

/*
 * HARİTA YAKIN AÇILIYOR (docs/12 §11.6). Dünyanın tamamı bir telefon
 * ekranında 3.000 şehirlik bir nokta bulutu; açılış oyuncunun kampının
 * üstünde ve gerisi kaydırarak bulunuyor.
 */
const acilis = await gorunum();
kontrol(
  'Harita yakınlaşmış açılıyor',
  acilis.k > acilis.enAz * 3,
  `k ${acilis.k.toFixed(2)} (dünya ${acilis.enAz.toFixed(2)})`,
);
await sayfa.screenshot({ path: `${CIKTI}/harita-0-acilis.png` });

// "Dünyayı göster" bütün dünyayı getiriyor; uzakta ülke adları yazıyor.
await sayfa.getByRole('button', { name: 'Dünyayı göster' }).click();
await sayfa.waitForTimeout(600);
const uzak = await gorunum();
kontrol(
  'Dünyayı göster bütün dünyayı sığdırıyor',
  Math.abs(uzak.k - uzak.enAz) < 1e-6,
  `k ${uzak.k}`,
);
const uzakAdlar = await etiketler();
const uzakUlke = uzakAdlar.filter((a) => ulkeAdlari.has(a));
kontrol(
  'Uzakta ülke adları haritada yazıyor',
  uzakUlke.length >= 5,
  uzakUlke.slice(0, 6).join(' / '),
);
/*
 * ETİKET KADEMESİ. Uzak ölçekte şehir adlarının hepsi yazılamaz; uzakta
 * yalnız oyuncunun kendi yeri adlanıyor, yakınlaşınca şehirler açılıyor.
 */
const uzakSehir = uzakAdlar.filter((a) => !ulkeAdlari.has(a)).length;
kontrol('Uzakta şehir adı yalnız oyuncunun yeri', uzakSehir <= 3, `${uzakSehir} şehir adı`);
await sayfa.screenshot({ path: `${CIKTI}/harita-1-genel.png` });

/*
 * DOKUNULAN ŞEHİR O ŞEHİR. Bir şehrin noktasına basan parmak KENDİ
 * şehrini seçmeli, komşusunu değil. Kampın çevresinden birkaç şehir
 * deneniyor; seçilen şehir alt çekmecenin başlığında yazıyor.
 */
{
  const harita = await G('/map');
  const ev = harita.regions.find((r) => r.id === harita.homeBolgeId);
  const yakinlar = harita.regions
    .filter((r) => r.komsular.includes(ev.id) || r.id === ev.id)
    .slice(0, 5);
  let dogru = 0;
  const yanlis = [];
  for (const r of yakinlar) {
    const dokunulan = await bolgeyeDokun(sayfa, `[data-bolge="${r.id}"]`);
    if (!dokunulan) continue;
    await sayfa.waitForTimeout(500);
    const baslik =
      (await sayfa
        .locator('[data-bolge-baslik]')
        .first()
        .textContent()
        .catch(() => '')) ?? '';
    if (baslik.toLocaleLowerCase('tr').includes(r.name.toLocaleLowerCase('tr'))) dogru++;
    else yanlis.push(`${r.name}→${baslik.trim().slice(0, 20)}`);
  }
  kontrol(
    'Şehrin noktasına basmak KENDİ şehrini seçiyor, komşusunu değil',
    yanlis.length === 0 && dogru >= Math.min(3, yakinlar.length),
    `${dogru} doğru, yanlış: ${yanlis.join(', ') || 'yok'}`,
  );
  const kapat = sayfa.getByRole('button', { name: 'Kapat' });
  if ((await kapat.count()) > 0) {
    await kapat.last().click();
    await sayfa.waitForTimeout(500);
  }
}

/*
 * İKİ GÖRÜNÜM (docs/23 §8): "kim nerede" ve tek düğmeyle "Hedefler".
 * Düğme basılı durumunu söylüyor, boyama gerçekten değişiyor.
 */
{
  const benimId = (await G('/map')).regions.find((r) => r.isMine)?.id;
  const dolgu = async () => JSON.stringify(await kanca('boya', benimId));
  const hedefDugmesi = sayfa.locator('[data-mercek="hedef"]');
  kontrol(
    'Varsayılan görünüm Kim nerede: Hedefler kapalı',
    (await hedefDugmesi.getAttribute('aria-pressed')) === 'false',
  );
  const siyasi = await dolgu();
  kontrol('Kim nerede: benim toprağım ALTIN', siyasi.includes('#f5b731'), siyasi);

  /*
   * HEDEFLER sunucunun kurallarıyla aynı: sınır dışı, ittifak arkadaşı,
   * paktlı ve kalkanlı toprak karanlık; benim toprağım altın.
   */
  await hedefDugmesi.click();
  await sayfa.waitForTimeout(300);
  kontrol(
    'Hedefler düğmesi basılı durumunu söylüyor',
    (await hedefDugmesi.getAttribute('aria-pressed')) === 'true',
  );
  const harita = await G('/map');
  const yasakOlmali = harita.regions.filter(
    (r) =>
      !r.isMine && (!r.sinirda || r.shielded || (r.owner && r.muttefik) || (r.owner && r.paktli)),
  );
  const boyalar = await sayfa.evaluate(
    (idler) => idler.map((id) => window.__dunyaHaritasi.boya(id)?.renk),
    yasakOlmali.map((r) => r.id),
  );
  const karanlik = boyalar.filter((b) => b === '#0b0806').length;
  kontrol(
    'Hedefler: saldırılamayan her bölge karanlık',
    karanlik === yasakOlmali.length && yasakOlmali.length > 0,
    `${karanlik} / ${yasakOlmali.length}`,
  );
  await hedefDugmesi.click();
  await sayfa.waitForTimeout(300);
  kontrol('Hedefler kapanınca boyama geri geliyor', (await dolgu()) === siyasi, await dolgu());
}

// Yakınlaştır düğmesi: her basış 1,6 kat.
await sayfa.getByRole('button', { name: 'Kampıma git' }).click();
await sayfa.waitForTimeout(400);
const k0 = (await gorunum()).k;
await sayfa.getByRole('button', { name: 'Yakınlaştır' }).click();
await sayfa.waitForTimeout(500);
const k1 = (await gorunum()).k;
kontrol('Yakınlaştırma çalışıyor', k1 > k0 * 1.4, `${k0.toFixed(2)} → ${k1.toFixed(2)}`);
const yakinAdlar = await etiketler();
kontrol(
  'Yakınlaşınca şehir adları açılıyor',
  yakinAdlar.filter((a) => !ulkeAdlari.has(a)).length > uzakSehir + 3,
  `${uzakSehir} → ${yakinAdlar.length} ad`,
);

/*
 * GÖRÜNÜM HATIRLANIYOR. Oyuncu: "haritanın yakınlığını ve konumunu da
 * hatırlasın." Başka sekmeye gidip dönen de, uygulamayı yeniden açan da
 * haritayı bıraktığı yerde ve yakınlıkta buluyor (ilk açılış yukarıda:
 * toprağın üstünde).
 */
{
  const ayni = (a, b) =>
    Math.abs(a.k - b.k) / b.k < 0.01 && Math.abs(a.tx - b.tx) < 2 && Math.abs(a.ty - b.ty) < 2;
  const yakin = await gorunum();
  await sayfa.waitForTimeout(500); // hareket durunca saklanıyor
  await sayfa.click('nav button:has-text("Şehir")');
  await sayfa.waitForTimeout(800);
  await sayfa.click('nav button:has-text("Dünya")');
  await sayfa.waitForSelector('[data-harita-hazir]', { timeout: 30000 });
  await sayfa.waitForTimeout(900);
  const donunce = await gorunum();
  kontrol(
    "Dünya'ya dönünce yakınlık ve konum korunuyor",
    ayni(donunce, yakin),
    `k ${yakin.k.toFixed(2)} → ${donunce.k.toFixed(2)}`,
  );
  await sayfa.reload({ waitUntil: 'domcontentloaded' });
  await sayfa.click('nav button:has-text("Dünya")');
  await sayfa.waitForSelector('[data-harita-hazir]', { timeout: 30000 });
  await sayfa.waitForTimeout(900);
  const yeniden = await gorunum();
  kontrol(
    'Uygulama yeniden açılınca da korunuyor',
    ayni(yeniden, yakin),
    `k ${yakin.k.toFixed(2)} → ${yeniden.k.toFixed(2)}`,
  );
}

// Bölge seçmek hâlâ çalışıyor: yakınlaştırma dokunmayı bozmamalı.
{
  const harita = await G('/map');
  const aday = harita.regions
    .filter((r) => !r.isMine && r.sinirda)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((r) => `[data-bolge="${r.id}"]`)
    .join(',');
  await bolgeyeDokun(sayfa, aday);
  await sayfa.waitForTimeout(900);
  const govde = await sayfa.locator('body').innerText();
  kontrol('Haritadan bölge seçilebiliyor', /garnizon|Garnizon|SALDIR|Seviye|GELİR/i.test(govde));
}

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
  await sayfa.waitForSelector('[data-harita-hazir]', { timeout: 30000 });
  await sayfa.waitForTimeout(900);

  const benimler = (await G('/map')).regions.filter((r) => r.pay);
  const sayac = {};
  for (const r of benimler) sayac[r.province] = (sayac[r.province] ?? 0) + 1;

  // Taht birliğe sayılmıyor; birlik taht dışı bir topraktan ölçülüyor.
  const hedef = benimler.find((r) => r.type !== 'taht');
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
    await bolgeyiSec(sayfa, hedef.id);
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
  // Önizleme sınır kuralına bakmıyor (saldırı bakıyor): karşılaştırma için
  // başka bir ülkenin sınır dışı şehri de olur.
  const oncelik = (await G('/map')).regions.filter((r) => !r.isMine && r.type !== 'taht');
  const benimVilayet = Object.keys(sayac).find((v) => sayac[v] >= 1);
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
    await bolgeyiSec(sayfa, hedef.id);
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

/*
 * LİSTE GÖRÜNÜMÜ (docs/23 Faz 3).
 *
 * "En yakın saldırılabilir toprak hangisi" sorusu haritada tek tek
 * dokunarak aranıyordu. Liste aynı veriyi sıralı veriyor; burada üç şey
 * ölçülüyor: Hepsi her bölgeyi gösteriyor, Hedefler'deki her satır
 * sunucunun saldırı izni verdiği bir toprak ve yakından uzağa sıralı,
 * satıra dokunmak o bölgenin kartını açıyor.
 */
{
  const kapatB = sayfa.getByRole('button', { name: 'Kapat' });
  if ((await kapatB.count()) > 0) {
    await kapatB.last().click();
    await sayfa.waitForTimeout(600);
  }
  const harita = await G('/map');
  await sayfa.locator('[data-harita-liste]').click();
  const pano = sayfa.locator('[data-bolge-listesi]');
  await pano.waitFor({ timeout: 5000 });

  /*
   * Hepsi EN YAKIN 250 şehri gösteriyor: 3.000 satırlık bir liste
   * telefonda kaydırılmaz, aranan şehir haritada bulunuyor.
   */
  await pano.getByRole('button', { name: /^Hepsi/ }).click();
  const hepsi = await pano.locator('[data-liste-bolge]').count();
  kontrol(
    'Liste: Hepsi en yakın şehirleri gösteriyor',
    hepsi === Math.min(250, harita.regions.length),
    `${hepsi}`,
  );

  await pano.getByRole('button', { name: /^Hedefler/ }).click();
  const idler = await pano
    .locator('[data-liste-bolge]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-liste-bolge'))));
  const bolgeler = idler.map((id) => harita.regions.find((r) => r.id === id));
  const saldirilabilir = (r) =>
    r && !r.isMine && r.sinirda && !r.shielded && !(r.owner && (r.paktli || r.muttefik));
  kontrol(
    'Liste: Hedefler yalnız saldırılabilir topraklar',
    idler.length > 0 && bolgeler.every(saldirilabilir),
    `${idler.length} satır`,
  );
  kontrol(
    'Liste: Hedefler yakından uzağa sıralı',
    bolgeler.every((r, i) => i === 0 || bolgeler[i - 1].distance <= r.distance),
    bolgeler.map((r) => r?.distance).join(','),
  );

  const ilk = bolgeler[0];
  await pano.locator(`[data-liste-bolge="${ilk?.id}"]`).click();
  await sayfa.waitForTimeout(900);
  const kapandi = (await pano.count()) === 0;
  // Kart başlığı büyük harfle yazılıyor (CSS); hangi bölgenin kartı
  // açıldığı başlığın imzasından okunuyor, metinden değil.
  const kartAcik = (await sayfa.locator(`[data-bolge-baslik="${ilk?.id}"]`).count()) > 0;
  kontrol(
    'Liste: satıra dokunmak bölgenin kartını açıyor',
    kapandi && Boolean(ilk) && kartAcik,
    `${ilk?.name ?? ''} · liste ${kapandi ? 'kapandı' : 'açık'} · kart ${kartAcik ? 'açık' : 'yok'}`,
  );
}

kontrol('Konsol hatası yok', konsol.length === 0, konsol[0] ?? '');

await tarayici.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
