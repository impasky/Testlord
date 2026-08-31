/**
 * Shard testi: dünya dolduğunda kaydın kırılmadığını, yeni dünyanın
 * kendiliğinden açıldığını doğrular.
 *
 * Bu senaryo elle test edilemez (120 oyuncu gerekir), bu yüzden kapasitesi
 * küçültülmüş geçici bir dünya üzerinden çalışır.
 *
 * API ayakta olmalı. node tools/shard-testi.mjs
 */
import { execSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:3000';
const DB = process.env.DATABASE_URL ?? 'postgresql://lordlar@127.0.0.1:5432/lordlar_cagi';
let hata = 0;

function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}
// Sorguyu stdin ile veriyoruz: içindeki çift tırnaklar ("World" gibi) kabuk
// tarafından yenmesin diye.
const sql = (q) => execSync(`psql "${DB}" -tAf -`, { input: q }).toString().trim();

async function kayit(ad) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${ad}@lordlar.dev`, password: 'parola1234', lordName: ad }),
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
}

console.log('Lordlar Çağı — shard testi\n');

const oncekiDunya = Number(sql('SELECT count(*) FROM "World";'));

// Açık dünyaların kapasitesini mevcut lord sayısına indir: "dolu" durumu yarat
sql(`UPDATE "World" w SET "playerCap" = GREATEST(1, (SELECT count(*) FROM "Lord" l WHERE l."worldId" = w.id)) WHERE w.status = 'open';`);
console.log('  Açık dünyalar yapay olarak dolduruldu.');

const damga = Date.now();
const sonuc = await kayit(`Tasan${damga}`);
kontrol('Dünya doluyken kayıt BAŞARILI olmalı', sonuc.ok, `HTTP ${sonuc.status}`);
if (!sonuc.ok) console.log('    yanıt:', JSON.stringify(sonuc.body));

const sonrakiDunya = Number(sql('SELECT count(*) FROM "World";'));
kontrol('Yeni dünya açıldı', sonrakiDunya === oncekiDunya + 1,
  `${oncekiDunya} -> ${sonrakiDunya}`);

const yeniDunyaBolge = sql(`SELECT count(*) FROM "Region" r JOIN "World" w ON w.id = r."worldId" WHERE w.status = 'open' AND w."openedAt" = (SELECT max("openedAt") FROM "World");`);
kontrol('Yeni dünyanın 61 bölgesi var', Number(yeniDunyaBolge) === 61, `${yeniDunyaBolge} bölge`);

const eskiDolu = sql(`SELECT count(*) FROM "World" WHERE status = 'full';`);
kontrol('Dolan dünya "full" işaretlendi', Number(eskiDolu) >= 1, `${eskiDolu} dolu dünya`);

// Yeni oyuncu yeni dünyada ve haritası çalışıyor mu
if (sonuc.ok) {
  const h = { Authorization: `Bearer ${sonuc.body.token}` };
  const harita = await (await fetch(`${API}/api/map`, { headers: h })).json();
  kontrol('Yeni oyuncunun haritası 61 bölge', harita.regions?.length === 61);
  kontrol('Yeni dünyada hiçbir bölge sahipli değil',
    harita.regions?.every((r) => !r.owner), 'temiz başlangıç');
}

// Kapasiteyi tasarımdaki değere geri al
sql(`UPDATE "World" SET "playerCap" = 120;`);
console.log('\n  Kapasiteler 120\'ye geri alındı.');

console.log(hata === 0 ? '\nSONUÇ: shard açılımı çalışıyor.' : `\nSONUÇ: ${hata} kontrol başarısız.`);
process.exit(hata === 0 ? 0 : 1);
