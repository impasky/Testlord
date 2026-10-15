/**
 * Lord adı benzersizliği — veritabanında (docs/18).
 *
 * Benzersizlik eskiden yalnız kayıtta soruluyordu: "bu ad boş mu?" Aynı
 * anda gelen iki kayıt ikisi de "boş" cevabını alıp aynı adı alabiliyordu.
 * Artık `Lord.adAnahtari` benzersiz ve kayıt yarışı kaybedene sunucu
 * hatası değil, "Bu lord adı alınmış" diyor.
 *
 * Ölçtüğü:
 *   1. Aynı adla aynı anda sekiz kayıt (büyük/küçük harf ve boşluk
 *      farklarıyla): biri açılıyor, yedisi 409 AD_ALINMIS; 500 yok.
 *   2. Aynı adresle aynı anda beş kayıt: biri açılıyor, dördü 409
 *      EPOSTA_KAYITLI; yarım kalan hesap ya da lord yok.
 *   3. Sonradan, tek başına: "YUNUS" varken "yunus" alınamıyor.
 *
 * API ayakta olmalı. node tools/lord-adi-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

async function kayit(email, lordName) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'parola1234', lordName }),
  });
  return { kod: r.status, govde: await r.json().catch(() => null) };
}

const sayim = (sonuclar) =>
  sonuclar.reduce((a, s) => {
    const k = `${s.kod}${s.govde?.code ? ' ' + s.govde.code : ''}`;
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});

console.log('Lordlar Çağı — lord adı benzersizliği\n');

const damga = Date.now().toString(36).slice(-5);

/* 1. Aynı ad, aynı anda ------------------------------------------- */
{
  const temel = `Yarış ${damga}`;
  const bicimler = [
    temel,
    temel.toUpperCase(),
    temel.toLowerCase(),
    ` ${temel}  `.replace(' ', '  '),
    temel.replace('Y', 'y'),
    temel.toLocaleUpperCase('tr'),
    temel,
    temel,
  ];
  const sonuclar = await Promise.all(
    bicimler.map((ad, i) => kayit(`yaris${damga}${i}@lordlar.dev`, ad)),
  );
  const s = sayim(sonuclar);
  kontrol('Aynı ad yarışında tek kayıt açılıyor', s['201'] === 1, JSON.stringify(s));
  kontrol(
    'Kaybedenler "ad alınmış" alıyor, sunucu hatası yok',
    s['409 AD_ALINMIS'] === bicimler.length - 1 && !sonuclar.some((x) => x.kod >= 500),
  );
}

/* 2. Aynı adres, aynı anda ---------------------------------------- */
{
  const email = `ayniadres${damga}@lordlar.dev`;
  const sonuclar = await Promise.all(
    [0, 1, 2, 3, 4].map((i) => kayit(email, `Adres ${damga} ${i}`)),
  );
  const s = sayim(sonuclar);
  kontrol('Aynı adres yarışında tek kayıt açılıyor', s['201'] === 1, JSON.stringify(s));
  kontrol(
    'Kaybedenler "e-posta kayıtlı" alıyor, sunucu hatası yok',
    s['409 EPOSTA_KAYITLI'] === 4 && !sonuclar.some((x) => x.kod >= 500),
  );
  // Kaybedenlerin lordu yarım kalmadı: adları hâlâ boş.
  const kaybedenAd = sonuclar.findIndex((x) => x.kod !== 201);
  const yeniden = await kayit(`yeniden${damga}@lordlar.dev`, `Adres ${damga} ${kaybedenAd}`);
  kontrol(
    'Yarışı kaybedenin adı boşta kaldı (yarım lord yok)',
    yeniden.kod === 201,
    `${yeniden.kod}`,
  );
}

/* 3. Tek başına: büyük/küçük harf ---------------------------------- */
{
  const ad = `Yunus ${damga}`;
  const ilk = await kayit(`harf${damga}a@lordlar.dev`, ad.toUpperCase());
  const ikinci = await kayit(`harf${damga}b@lordlar.dev`, ad.toLowerCase());
  kontrol('Büyük harfli ad açıldı', ilk.kod === 201, `${ilk.kod}`);
  kontrol(
    'Aynı adın küçük harflisi alınamıyor',
    ikinci.kod === 409 && ikinci.govde?.code === 'AD_ALINMIS',
    `${ikinci.kod} ${ikinci.govde?.code ?? ''}`,
  );
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
