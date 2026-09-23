/**
 * ÖLÇÜMÜN KENDİSİNİ ÖLÇER (docs/16 §15).
 *
 * `/api/olcum` bu projede karar veren uçtur: §14 mimariyi onun sayılarına
 * bakarak parkladı, §15 yine ona bakarak parktan çıkardı. Yanlış sayı
 * döndüren bir ölçüm, ölçümsüzlükten kötüdür — çünkü kararı yine
 * verirsin, sadece yanlış verirsin.
 *
 * Buradaki asıl kontrol üçüncüsü: `paylasilanBolge`. Sistemin tek
 * cümlesi "bölge bölünemez, bölgedeki PAY bölünür" ve bu sayı o cümlenin
 * gerçekten yaşandığını gösteren tek yer. Sınama sayıyı okumakla
 * yetinmiyor: iki lordu aynı bölgeye koyup sayının ARTTIĞINI görüyor.
 * Sabit sıfır dönen bir alan da "geçer" görünürdü.
 *
 * Anahtar `OLCUM_ANAHTARI` ortam değişkeninden, yoksa `apps/api/.env`
 * içinden okunuyor; hiçbiri yoksa sınama atlanıyor (uç kapalı demektir).
 * Anahtar hiçbir yere yazılmıyor.
 *
 * SADECE GELİŞTİRME. node tools/olcum-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

function anahtariOku() {
  if (process.env.OLCUM_ANAHTARI) return process.env.OLCUM_ANAHTARI;
  try {
    const satir = readFileSync('apps/api/.env', 'utf8')
      .split('\n')
      .find((x) => x.startsWith('OLCUM_ANAHTARI='));
    return satir ? satir.slice('OLCUM_ANAHTARI='.length).trim().replace(/^"|"$/g, '') : null;
  } catch {
    return null;
  }
}

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

console.log('Lordlar Çağı — ölçüm testi\n');

const ANAHTAR = anahtariOku();
if (!ANAHTAR) {
  console.log('  OLCUM_ANAHTARI yok — uç kapalı, sınama atlandı.\n');
  process.exit(0);
}

/* --- 1. Uç korunuyor mu --- */
{
  const yanlis = await fetch(`${API}/api/olcum?anahtar=yanlis-anahtar`);
  k('Yanlış anahtar reddediliyor', yanlis.status === 403, `HTTP ${yanlis.status}`);
  const anahtarsiz = await fetch(`${API}/api/olcum`);
  k('Anahtarsız istek reddediliyor', anahtarsiz.status === 403, `HTTP ${anahtarsiz.status}`);
}

const olcumAl = async () => {
  const r = await fetch(`${API}/api/olcum?anahtar=${encodeURIComponent(ANAHTAR)}`);
  if (!r.ok) throw new Error(`ölçüm alınamadı: HTTP ${r.status}`);
  return r.json();
};

/* --- 2. Medeniyet bölümü tutarlı mı --- */
const once = await olcumAl();
k('Ölçüm medeniyet bölümünü taşıyor', Boolean(once.medeniyet));
// Eşya pazarı (docs/19 §13): kasadaki altın ve en sık çiftin payı — pazar
// bir bankaya ya da altın taşıma yoluna dönüşürse ilk burada görünür.
k(
  'Ölçüm eşya pazarı bölümünü taşıyor',
  typeof once.esyaPazari?.kasadakiAltin === 'number' &&
    typeof once.esyaPazari?.islemSon7Gun === 'number',
  JSON.stringify(once.esyaPazari ?? null).slice(0, 120),
);
if (!once.medeniyet) {
  console.log('\n1 KONTROL KALDI\n');
  process.exit(1);
}
{
  const m = once.medeniyet;
  const oran = (x) => x === null || (typeof x === 'number' && x >= 0 && x <= 1);

  k('Dört taraf sayılıyor', m.taraflar.length === 4, `${m.taraflar.length} taraf`);
  k(
    'Aktif lord toplam lordu aşmıyor',
    m.taraflar.every((t) => t.aktifLord <= t.lord),
    m.taraflar.map((t) => `${t.key} ${t.aktifLord}/${t.lord}`).join(' · '),
  );
  k(
    'Tutulan bölge toplam bölgeyi aşmıyor',
    m.kartopu.tutulanBolge <= m.kartopu.toplamBolge,
    `${m.kartopu.tutulanBolge}/${m.kartopu.toplamBolge}`,
  );
  k(
    'Taraf bölgelerinin toplamı tutulan bölgeye eşit',
    m.taraflar.reduce((t, x) => t + x.bolge, 0) === m.kartopu.tutulanBolge,
  );
  k(
    'Bütün oranlar 0-1 aralığında',
    [
      m.nufusDengesizligi.enKalabalikAktifPay,
      m.kartopu.enGenisToprakPayi,
      m.bedavacilik.puanliLordOrani,
      m.bedavacilik.ustOndalikPayi,
      m.garnizonKatilimi.garnizonTutanLordOrani,
      m.garnizonKatilimi.paylasilanBolgeOrani,
    ].every(oran),
  );
  // Dört taraftan en kalabalığının payı matematiksel olarak 1/4'ün
  // altına düşemez; düşüyorsa toplama yanlıştır.
  k(
    'En kalabalık payı dörtte birden küçük değil',
    m.nufusDengesizligi.enKalabalikAktifPay === null ||
      m.nufusDengesizligi.enKalabalikAktifPay >= 0.25 - 1e-9,
    String(m.nufusDengesizligi.enKalabalikAktifPay),
  );
  k(
    'Paylaşılan bölge, garnizonlu bölgeyi aşmıyor',
    m.garnizonKatilimi.paylasilanBolge <= m.garnizonKatilimi.garnizonluBolge,
    `${m.garnizonKatilimi.paylasilanBolge}/${m.garnizonKatilimi.garnizonluBolge}`,
  );
}

/* --- 3. Sayı GERÇEKTEN sayıyor mu: iki lord, tek bölge --- */
const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `olc${damga}_${etiket}@lordlar.dev`,
    lordName: `Olc${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json())
        .catch(() => ({})),
    get: (yol) =>
      fetch(`${API}/api${yol}`, { headers: h })
        .then((x) => x.json())
        .catch(() => ({})),
  };
}

// Pay yalnız bölgeyi TUTAN medeniyetin üyeleri arasında bölünüyor, o
// yüzden iki lord aynı medeniyetten olmalı (gelir-payi-testi'ndeki
// gerekçenin aynısı).
const havuz = [];
let sahip = null;
let dost = null;
for (let i = 0; i < 8 && !dost; i++) {
  const l = await lordKur(`l${i}`);
  const med = (await l.get('/me')).lord?.medeniyet?.id ?? null;
  const es = havuz.find((x) => x.med === med && med !== null);
  if (es) {
    sahip = es.l;
    dost = l;
  } else havuz.push({ l, med });
}
k('Aynı medeniyetten iki lord bulundu', Boolean(sahip && dost));
if (!sahip || !dost) {
  console.log(`\n${hata} KONTROL KALDI\n`);
  process.exit(1);
}

for (const l of [sahip, dost]) {
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
  await l.post('/test/xp-ver', { miktar: 200000 });
  const p = (await l.get('/me')).lord.statPoints;
  if (p > 0) await l.post('/me/stats', { liderlik: p });
}
const itt = await sahip.post('/ittifak/kur', {
  ad: `Olcum ${damga % 10000}`,
  etiket: `O${damga % 100}`,
});
await sahip.post('/ittifak/ayarlar', { katilim: 'acik' });
await dost.post(`/ittifak/${itt.id}/katil`);

/** Oyunun kendi önerisiyle bir bölge alır. */
let bolge = null;
for (let i = 0; i < 8 && !bolge; i++) {
  const oneri = (await sahip.get('/map')).oneri;
  if (!oneri) break;
  if (oneri.eksik?.adet > 0) {
    await sahip.post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
    await sahip.post('/test/kuyruklari-bitir');
  }
  const ordu = (await sahip.get('/army')).home;
  if (Object.keys(ordu).length === 0) break;
  await sahip.post('/march', { toRegionId: oneri.regionId, army: ordu });
  await sahip.post('/test/yuruyusleri-bitir');
  await sahip.post('/test/yuruyusleri-bitir');
  bolge = (await sahip.get('/map')).regions.find((r) => r.isMine && r.type !== 'taht') ?? null;
}
k('Bir bölge fethedildi', Boolean(bolge), bolge?.name ?? 'alınamadı');
if (!bolge) {
  console.log(`\n${hata} KONTROL KALDI\n`);
  process.exit(1);
}

// TEK garnizonluyken ölç: paylaşılan bölge sayısı bundan sonra artmalı.
const tekBasina = await olcumAl();
await dost.post('/army/train', { unitType: 'mizrakci', count: 50 });
await dost.post('/test/kuyruklari-bitir');
await dost.post(`/map/${bolge.id}/takviye`, { army: { mizrakci: 50 } });
await dost.post('/test/yuruyusleri-bitir');
const ikiKisi = await olcumAl();

k(
  'Paylaşılan bölge sayısı takviyeyle arttı',
  ikiKisi.medeniyet.garnizonKatilimi.paylasilanBolge >
    tekBasina.medeniyet.garnizonKatilimi.paylasilanBolge,
  `${tekBasina.medeniyet.garnizonKatilimi.paylasilanBolge} -> ${ikiKisi.medeniyet.garnizonKatilimi.paylasilanBolge}`,
);
k(
  'Garnizon tutan lord sayısı arttı',
  ikiKisi.medeniyet.garnizonKatilimi.garnizonTutanLord >
    tekBasina.medeniyet.garnizonKatilimi.garnizonTutanLord,
  `${tekBasina.medeniyet.garnizonKatilimi.garnizonTutanLord} -> ${ikiKisi.medeniyet.garnizonKatilimi.garnizonTutanLord}`,
);
// Fetih fayda puanı kazandırıyor (docs/16 §9): puanlı lord sayısı da
// artmış olmalı, yoksa bedavacılık ölçüsü ölü bir alandır.
k(
  'Fayda puanı kazanan lord sayısı arttı',
  ikiKisi.medeniyet.bedavacilik.puanliLord > once.medeniyet.bedavacilik.puanliLord,
  `${once.medeniyet.bedavacilik.puanliLord} -> ${ikiKisi.medeniyet.bedavacilik.puanliLord}`,
);

/*
 * --- 4. Araştırma seçimi sayılıyor mu (docs/20 §8) ---
 * Bir öğreti seçen lord o yolun sayısını, yolu bırakan lord "son 7 günde
 * değiştiren" sayısını bir ARTIRMALI. Hep sıfır dönen bir alan da
 * aralık kontrolünden geçerdi.
 */
{
  const dk = (o) => o.arastirma?.gruplar?.doktrin;
  k(
    'Ölçüm araştırma bölümünü taşıyor',
    Boolean(dk(once)) && Object.keys(dk(once).yollar).length === 3,
    JSON.stringify(once.arastirma ?? null).slice(0, 120),
  );
  const ar = await lordKur('ar');
  // Öğretinin ilk düğümü 10. seviye kapılı; 5. seviye erken penceresinin
  // alt ucu. Tam o seviyeye çık: fazlası testi hızlandırmaz.
  for (let i = 0; i < 20; i++) {
    const l = (await ar.get('/me')).lord;
    if (l.level >= 5) break;
    await ar.post('/test/xp-ver', { miktar: l.xpForNext - l.xp });
  }
  await ar.post('/test/kaynak-ver', { altin: 200000, demir: 100000, erzak: 100000 });
  for (const key of ['savas_sanati', 'kale_ogretisi']) {
    await ar.post('/arastirma', { key });
    await ar.post('/test/kuyruklari-bitir');
  }
  const secti = await olcumAl();
  k(
    'Öğreti seçen lord o yolun sayısını artırdı',
    dk(secti).yollar.kale === dk(once).yollar.kale + 1,
    `${dk(once).yollar.kale} -> ${dk(secti).yollar.kale}`,
  );
  k(
    'En çok seçilen yolun payı 1/3 ile 1 arasında',
    dk(secti).enCokSecilenPayi >= 1 / 3 - 1e-9 && dk(secti).enCokSecilenPayi <= 1,
    String(dk(secti).enCokSecilenPayi),
  );
  await ar.post('/arastirma/yol-birak', { grup: 'doktrin' });
  const birakti = await olcumAl();
  k(
    'Yolu bırakan lord "son 7 günde değiştiren" sayısını artırdı',
    dk(birakti).son7GunDegistiren === dk(secti).son7GunDegistiren + 1 &&
      dk(birakti).yollar.kale === dk(secti).yollar.kale - 1,
    `${dk(secti).son7GunDegistiren} -> ${dk(birakti).son7GunDegistiren}`,
  );
}

console.log(hata === 0 ? '\nÖLÇÜM TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
