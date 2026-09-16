/**
 * Diyar (sunucu) seçimi testi.
 *
 * Özelliğin tek gerçek sözü şu: SEÇTİĞİN diyara girersin. Arkadaşıyla
 * birlikte oynamak isteyen iki kişi bunun için buraya bakıyor ve söz
 * tutulmazsa özellik olmamasından kötü — oyuncu birlikte oynadığını sanıp
 * başka bir haritada yalnız kalıyor.
 *
 * Test onu kilitliyor: listedeki EN SON diyar seçiliyor (önerilen hep ilki,
 * yani seçim gerçekten okunmazsa oyuncu yanlış yere düşer ve bu fark
 * edilir), sonra iki lord aynı diyarı seçip birbirlerini haritada görüyor.
 *
 * API ayakta olmalı. node tools/diyar-secimi-testi.mjs
 */
import { execSync } from 'node:child_process';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const DB = process.env.DATABASE_URL ?? 'postgresql://lordlar@127.0.0.1:5432/lordlar_cagi';
const sql = (q) => execSync(`psql "${DB}" -tAf -`, { input: q }).toString().trim();

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — diyar seçimi testi\n');

/* ---------------------------------------------------------------- */
/* 1. Liste kimlik istemiyor                                         */
/* ---------------------------------------------------------------- */

const r = await fetch(`${API}/api/diyarlar`);
kontrol('Liste jetonsuz okunuyor', r.ok, `HTTP ${r.status}`);
const liste = await r.json();
kontrol('Listede en az bir diyar var', (liste.diyarlar?.length ?? 0) >= 1);
kontrol('Önerilen diyar listenin ilki', liste.onerilen === liste.diyarlar?.[0]?.id);
/*
 * Adların BENZERSİZ olması özelliğin ön şartı: oyuncu arkadaşının
 * diyarını adından buluyor. İki satır aynı adı taşıyorsa seçim ekranı
 * çalışmıyor demektir — geliştirme veritabanında 23 tane "168. Diyar"
 * vardı ve kimse fark etmemişti, çünkü adlar hiç yan yana gelmiyordu.
 */
{
  const adlar = liste.diyarlar.map((d) => d.ad);
  const tekrar = adlar.filter((a, i) => adlar.indexOf(a) !== i);
  kontrol(
    'Diyar adları benzersiz',
    tekrar.length === 0,
    tekrar.slice(0, 3).join(', ') || 'tekrar yok',
  );
}
kontrol(
  'Her satırda ad, kayıtlı ve aktif lord sayısı var',
  liste.diyarlar.every(
    (d) =>
      typeof d.ad === 'string' &&
      d.ad.length > 0 &&
      Number.isFinite(d.lordSayisi) &&
      Number.isFinite(d.aktifLord) &&
      d.lordSayisi < d.kapasite,
  ),
);

/* ---------------------------------------------------------------- */
/* 2. Seçim gerçekten uygulanıyor                                    */
/* ---------------------------------------------------------------- */

/**
 * Bir diyarı geçici olarak doldurur, işi yapar, eski hâline döndürür.
 *
 * Kapasiteyi ve durumu SAKLAYIP geri koyuyor. İlk hâli `playerCap = 240,
 * status = 'open'` diye toptan yazıyordu ve bu, testten sonra bütün
 * diyarların kapasitesini değiştiriyordu (bu veritabanında gerçek değer
 * 120) — sonraki testler bambaşka bir diyarda koşup, oradaki kalabalık
 * yüzünden alâkasız yerlerde kalıyordu. Bir test kendisinden
 * sonrakilerin dünyasını değiştiremez.
 */
async function doluykenYap(worldId, is) {
  const kapasite = sql(`SELECT "playerCap" FROM "World" WHERE id = '${worldId}';`);
  const durum = sql(`SELECT status FROM "World" WHERE id = '${worldId}';`);
  sql(
    `UPDATE "World" SET "playerCap" = (SELECT count(*) FROM "Lord" l WHERE l."worldId" = '${worldId}') WHERE id = '${worldId}';`,
  );
  try {
    return await is();
  } finally {
    sql(
      `UPDATE "World" SET "playerCap" = ${kapasite}, status = '${durum}' WHERE id = '${worldId}';`,
    );
  }
}

// İkinci bir diyar yoksa üret: testin ölçtüğü şey "birden çok diyar
// arasından seçmek" ve tek diyarlı bir veritabanında hiçbir şey ölçülmez.
if (liste.diyarlar.length < 2) {
  await doluykenYap(liste.diyarlar[0].id, async () => {
    const ad = benzersizAd('Tasir');
    await kayitOl(API, { email: `${ad}@lordlar.dev`, lordName: ad });
  });
}

const liste2 = await (await fetch(`${API}/api/diyarlar`)).json();
kontrol(
  'Artık birden çok diyar var',
  liste2.diyarlar.length >= 2,
  `${liste2.diyarlar.length} diyar`,
);

// ÖNERİLEN DEĞİL, sonuncu: seçim okunmazsa lord önerilene düşer ve
// aşağıdaki karşılaştırma bunu yakalar.
const hedef = liste2.diyarlar[liste2.diyarlar.length - 1];
kontrol('Seçilen diyar önerilenden farklı', hedef.id !== liste2.onerilen, hedef.ad);

const adA = benzersizAd('Secim');
const a = await kayitOl(API, { email: `${adA}@lordlar.dev`, lordName: adA, worldId: hedef.id });
const dunyaA = await (
  await fetch(`${API}/api/dunya`, { headers: { Authorization: `Bearer ${a.token}` } })
).json();
kontrol('Lord SEÇTİĞİ diyarda', dunyaA.ad === hedef.ad, `${dunyaA.ad} (istenen: ${hedef.ad})`);

/* ---------------------------------------------------------------- */
/* 3. İki arkadaş aynı diyarda                                       */
/* ---------------------------------------------------------------- */

const adB = benzersizAd('Dostu');
const b = await kayitOl(API, { email: `${adB}@lordlar.dev`, lordName: adB, worldId: hedef.id });
// Sıralama DİYARA ÖZEL (`basitSiralama(me.worldId, ...)`): A'nın adı
// B'nin sıralamasında görünüyorsa ikisi gerçekten aynı haritada.
const siralama = await (
  await fetch(`${API}/api/rankings/fame`, { headers: { Authorization: `Bearer ${b.token}` } })
).json();
const adlar = (siralama.satirlar ?? []).map((x) => x.ad ?? x.name);
kontrol(
  'İki lord da aynı diyarın sıralamasında',
  adlar.includes(adA) && adlar.includes(adB),
  `${siralama.toplam} lord: ${adlar.join(', ')}`,
);

/* ---------------------------------------------------------------- */
/* 4. Reddetmeler                                                    */
/* ---------------------------------------------------------------- */

const adC = benzersizAd('Yokdi');
const yok = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `${adC}@lordlar.dev`,
    password: 'parola1234',
    lordName: adC,
    worldId: 'boyle-bir-diyar-yok',
  }),
});
const yokGovde = await yok.json().catch(() => ({}));
kontrol(
  'Olmayan diyar reddediliyor',
  yok.status === 404,
  `HTTP ${yok.status} ${yokGovde.code ?? ''}`,
);
kontrol(
  'Reddedilen kayıt lord YARATMIYOR',
  sql(`SELECT count(*) FROM "Lord" WHERE name = '${adC}';`) === '0',
);

// Dolu diyar: hedefi yapay olarak doldur, aynı diyarı seçen kayıt 409 alsın.
// Kapasite `doluykenYap` içinde geri konuyor — test bittiğinde diyar
// bulduğu gibi kalıyor.
const liste3 = await doluykenYap(hedef.id, async () => {
  const adD = benzersizAd('Doldu');
  const dolu = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${adD}@lordlar.dev`,
      password: 'parola1234',
      lordName: adD,
      worldId: hedef.id,
    }),
  });
  const doluGovde = await dolu.json().catch(() => ({}));
  kontrol(
    'Dolu diyar reddediliyor',
    dolu.status === 409,
    `HTTP ${dolu.status} ${doluGovde.code ?? ''}`,
  );
  kontrol(
    'Dolu diyar SESSİZCE başka yere yönlendirmiyor',
    sql(`SELECT count(*) FROM "Lord" WHERE name = '${adD}';`) === '0',
  );

  // Dolan diyar listeden de düşüyor mu
  const l = await (await fetch(`${API}/api/diyarlar`)).json();
  kontrol(
    'Dolan diyar listede görünmüyor',
    !l.diyarlar.some((d) => d.id === hedef.id),
    `${l.diyarlar.length} diyar kaldı`,
  );
  return l;
});

/* ---------------------------------------------------------------- */
/* 5. Seçim yapmayan oyuncu için hiçbir şey değişmiyor               */
/* ---------------------------------------------------------------- */

const adE = benzersizAd('Sessi');
const e = await kayitOl(API, { email: `${adE}@lordlar.dev`, lordName: adE });
const dunyaE = await (
  await fetch(`${API}/api/dunya`, { headers: { Authorization: `Bearer ${e.token}` } })
).json();
const onerilenAd = liste3.diyarlar.find((d) => d.id === liste3.onerilen)?.ad;
kontrol('Seçim yapılmazsa önerilen diyara giriliyor', dunyaE.ad === onerilenAd, dunyaE.ad);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
