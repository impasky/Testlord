/**
 * Diyar birleşmesi testi.
 *
 * Testin çekirdeği üç cümle:
 *   1. Eşler AÇILIŞ TARİHİ YAKIN diyarlardan seçiliyor.
 *   2. Lord her şeyiyle taşınıyor; toprağı ancak yeri boşsa geliyor,
 *      gelmiyorsa tazminat alıyor.
 *   3. Taht sahipsiz kalıyor — kimsenin unvanı sessizce el değiştirmiyor.
 *
 * Kurulum SQL ile: altmış günlük bir diyar beklemek mümkün değil, açılış
 * tarihini geriye almak mümkün.
 *
 * SADECE GELİŞTİRME. node tools/birlesme-testi.mjs
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

console.log('Lordlar Çağı — diyar birleşmesi testi\n');

/* ---------------------------------------------------------------- */
/* Kurulum: iki yaşıt diyar, ikisinde de birer lord                  */
/* ---------------------------------------------------------------- */

// Var olan diyarları planlamanın dışında tut: bu test kendi eşini kurmalı,
// veritabanındaki başka diyarlarla eşleşirse ölçtüğü şey kayar.
const oncekiDurumlar = sql(`SELECT id || '=' || status FROM "World" WHERE status <> 'closed';`)
  .split('\n')
  .filter(Boolean);
sql(`UPDATE "World" SET status = 'closed' WHERE status <> 'closed';`);

/*
 * AÇILIŞ TARİHİ de geri alınıyor.
 *
 * İlk hâl yalnız durumu geri alıyordu ve diyarlar yetmiş günlük kalıyordu.
 * Worker birleşmeye saatte bir baktığı için onları kendiliğinden
 * birleştirmeye devam ediyordu: sonraki testlerin lordları oyunun
 * ortasında başka bir diyara taşınıyor, yürüyüşleri iptal oluyor ve o
 * testler ölçtükleri şeyle hiç ilgisi olmayan bir sebeple kalıyordu.
 * Bir test, kendisinden sonrakilerin dünyasını değiştiremez.
 */
const acilislar = new Map();
function acilisSakla(id) {
  if (!acilislar.has(id)) {
    acilislar.set(id, sql(`SELECT "openedAt"::text FROM "World" WHERE id = '${id}';`));
  }
}

function geriAl() {
  for (const satir of oncekiDurumlar) {
    const [id, durum] = satir.split('=');
    sql(`UPDATE "World" SET status = '${durum}' WHERE id = '${id}';`);
  }
  for (const [id, acilis] of acilislar) {
    sql(`UPDATE "World" SET "openedAt" = '${acilis}' WHERE id = '${id}';`);
  }
}

const damga = Date.now().toString(36).slice(-4);
let evId;
let konukId;
try {
  // İki diyar aç: kayıt kapısı hep en eski AÇIK diyara gidiyor, o yüzden
  // birer birer açıp kaydediyoruz.
  const adA = benzersizAd(`Eva${damga}`);
  const a = await kayitOl(API, { email: `${adA}@lordlar.dev`, lordName: adA });
  evId = sql(`SELECT "worldId" FROM "Lord" WHERE name = '${adA}';`);

  // Ev sahibi dolsun ki ikinci kayıt YENİ bir diyar açsın.
  sql(
    `UPDATE "World" SET "playerCap" = (SELECT count(*) FROM "Lord" WHERE "worldId" = '${evId}') WHERE id = '${evId}';`,
  );
  const adB = benzersizAd(`Kon${damga}`);
  const b = await kayitOl(API, { email: `${adB}@lordlar.dev`, lordName: adB });
  konukId = sql(`SELECT "worldId" FROM "Lord" WHERE name = '${adB}';`);
  sql(`UPDATE "World" SET "playerCap" = 240 WHERE id = '${evId}';`);

  kontrol('İki ayrı diyar kuruldu', evId !== konukId, `${evId.slice(-6)} / ${konukId.slice(-6)}`);

  // Yaşları geriye al: ev sahibi 70 günlük, konuk 66 günlük (fark 4 gün).
  acilisSakla(evId);
  acilisSakla(konukId);
  sql(
    `UPDATE "World" SET "openedAt" = now() - interval '70 days', status = 'open' WHERE id = '${evId}';`,
  );
  sql(
    `UPDATE "World" SET "openedAt" = now() - interval '66 days', status = 'open' WHERE id = '${konukId}';`,
  );

  // Ev sahibinde lord daha aktif olsun (ev sahibi seçimi buna bakıyor).
  sql(`UPDATE "Lord" SET "lastSeenAt" = now() WHERE "worldId" = '${evId}';`);
  sql(
    `UPDATE "Lord" SET "lastSeenAt" = now() - interval '30 days' WHERE "worldId" = '${konukId}' AND name = '${adB}';`,
  );

  const evLordId = sql(`SELECT id FROM "Lord" WHERE name = '${adA}';`);
  const konukLordId = sql(`SELECT id FROM "Lord" WHERE name = '${adB}';`);

  /* -------------------------------------------------------------- */
  /* Toprak: biri çakışsın, biri boş kalsın                          */
  /* -------------------------------------------------------------- */

  // Konuk lord iki bölge tutuyor: mapId 5 ve 7.
  sql(
    `UPDATE "Region" SET "ownerLordId" = '${konukLordId}', level = 3, "storeAltin" = 500 WHERE "worldId" = '${konukId}' AND "mapId" IN (5, 7);`,
  );
  // Ev sahibinde mapId 5 DOLU (çakışma), 7 boş (taşınabilir).
  sql(
    `UPDATE "Region" SET "ownerLordId" = '${evLordId}' WHERE "worldId" = '${evId}' AND "mapId" = 5;`,
  );
  // Ev sahibinin lordu tahtı tutuyor: birleşmede sahipsiz kalmalı.
  sql(
    `UPDATE "Region" SET "ownerLordId" = '${evLordId}' WHERE "worldId" = '${evId}' AND type = 'taht';`,
  );

  // ÜÇ kaynağa birden bakılıyor: tazminat bölgenin gelirinden geliyor ve
  // her bölge altın vermiyor. İlk hâl yalnız altına bakıyordu ve test,
  // maden bölgesinin demirle ödendiği yerde kaldı — kod doğruydu, ölçüt
  // eksikti.
  const kasaOku = () =>
    sql(`SELECT altin || ',' || demir || ',' || erzak FROM "Lord" WHERE id = '${konukLordId}';`)
      .split(',')
      .map(Number);
  const kasaOnce = kasaOku();

  /* -------------------------------------------------------------- */
  /* Planlama                                                        */
  /* -------------------------------------------------------------- */

  const plan = execSync('pnpm --filter @lordlar/api diyar-birlestir --planla', {
    cwd: new URL('..', import.meta.url).pathname,
  }).toString();
  const ilanSayisi = Number(
    sql(
      `SELECT count(*) FROM "WorldMerge" WHERE "uygulandiAt" IS NULL AND "hostId" = '${evId}' AND "guestId" = '${konukId}';`,
    ),
  );
  kontrol(
    'Yaşıt diyarlar eşleşti ve birleşme ilan edildi',
    ilanSayisi === 1,
    plan.match(/yaş farkı \d+ gün/)?.[0] ?? '',
  );

  kontrol(
    'Ev sahibi AKTİF oyuncusu çok olan diyar',
    sql(`SELECT "hostId" FROM "WorldMerge" WHERE "guestId" = '${konukId}';`) === evId,
  );

  const olay = sql(
    `SELECT count(*) FROM "Event" WHERE "lordId" IN ('${evLordId}','${konukLordId}') AND kind = 'diyar_birlesiyor';`,
  );
  kontrol('İki diyara da ilan edildi', Number(olay) === 2, `${olay} olay`);

  kontrol(
    'İhbar süresi var — birleşme HEMEN olmuyor',
    Number(
      sql(
        `SELECT count(*) FROM "WorldMerge" WHERE "guestId" = '${konukId}' AND "birlesmeAt" > now();`,
      ),
    ) === 1,
  );

  /* -------------------------------------------------------------- */
  /* İlan oyuncuya GÖRÜNÜYOR mu                                      */
  /* -------------------------------------------------------------- */

  // Kod içinde duran bir ilan, ilan değil. Oyuncunun dünya ekranında
  // okuduğu şey bu.
  for (const [etiket, jeton, bekleniyor] of [
    ['konuk', b.token, true],
    ['ev sahibi', a.token, false],
  ]) {
    const d = await (
      await fetch(`${API}/api/dunya`, { headers: { Authorization: `Bearer ${jeton}` } })
    ).json();
    kontrol(
      `İlan ${etiket} ekranında görünüyor`,
      d.birlesme !== null && d.birlesme?.konukMuyum === bekleniyor,
      JSON.stringify(d.birlesme),
    );
  }

  /* -------------------------------------------------------------- */
  /* Uygulama                                                        */
  /* -------------------------------------------------------------- */

  // Vakti geldi say.
  sql(
    `UPDATE "WorldMerge" SET "birlesmeAt" = now() - interval '1 minute' WHERE "guestId" = '${konukId}';`,
  );
  execSync('pnpm --filter @lordlar/api diyar-birlestir --uygula', {
    cwd: new URL('..', import.meta.url).pathname,
  });

  kontrol(
    'Konuk lord ev sahibi diyara taşındı',
    sql(`SELECT "worldId" FROM "Lord" WHERE id = '${konukLordId}';`) === evId,
  );
  kontrol(
    'Konuk diyar kapandı',
    sql(`SELECT status FROM "World" WHERE id = '${konukId}';`) === 'closed',
  );
  kontrol(
    'Yeri BOŞ olan bölge taşındı (mapId 7)',
    sql(`SELECT "ownerLordId" FROM "Region" WHERE "worldId" = '${evId}' AND "mapId" = 7;`) ===
      konukLordId,
  );
  kontrol(
    'Taşınan bölge seviyesini koruyor',
    sql(`SELECT level FROM "Region" WHERE "worldId" = '${evId}' AND "mapId" = 7;`) === '3',
  );
  kontrol(
    'Yeri DOLU olan bölge el değiştirmedi (mapId 5)',
    sql(`SELECT "ownerLordId" FROM "Region" WHERE "worldId" = '${evId}' AND "mapId" = 5;`) ===
      evLordId,
  );
  const kasaSonra = kasaOku();
  kontrol(
    'Kaybedilen bölge için tazminat ödendi',
    kasaSonra.some((n, i) => n > kasaOnce[i]),
    `${kasaOnce.join('/')} -> ${kasaSonra.join('/')} (altın/demir/erzak)`,
  );
  kontrol(
    'TAHT SAHİPSİZ — kimsenin unvanı sessizce el değiştirmedi',
    sql(
      `SELECT coalesce("ownerLordId", 'YOK') FROM "Region" WHERE "worldId" = '${evId}' AND type = 'taht';`,
    ) === 'YOK',
  );
  kontrol(
    'Göçen lord geliş kalkanı altında',
    Number(
      sql(`SELECT count(*) FROM "Lord" WHERE id = '${konukLordId}' AND "protectionUntil" > now();`),
    ) === 1,
  );
  kontrol(
    'Konuk haritada sahipli bölge kalmadı',
    sql(
      `SELECT count(*) FROM "Region" WHERE "worldId" = '${konukId}' AND "ownerLordId" IS NOT NULL;`,
    ) === '0',
  );
  kontrol(
    'Birleşme uygulandı olarak işaretlendi',
    Number(
      sql(
        `SELECT count(*) FROM "WorldMerge" WHERE "guestId" = '${konukId}' AND "uygulandiAt" IS NOT NULL;`,
      ),
    ) === 1,
  );
  const ozet = sql(`SELECT ozet FROM "WorldMerge" WHERE "guestId" = '${konukId}';`);
  kontrol('Özet yazıldı', ozet.includes('gocenLord'), ozet.slice(0, 80));
} finally {
  geriAl();
  if (konukId) sql(`UPDATE "World" SET status = 'closed' WHERE id = '${konukId}';`);
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
