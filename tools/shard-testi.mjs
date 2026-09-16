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
import { benzersizAd } from './lib/kayit.mjs';
// Bölge sayısı KANONİK DOSYADAN: elle yazılan sayı, harita her
// büyüdüğünde tasarımda hiçbir şey bozulmadan testi kırıyordu.
import { BOLGE_SAYISI } from './lib/harita.mjs';

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

// tools/lib/kayit.mjs kullanılmıyor: o yardımcı başarısız kaydı hata sayıp
// patlıyor. Bu test "dünya dolu" reddini bekliyor, cevabın kendisine bakıyor.
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

/*
 * Açık dünyaları yapay olarak doldur.
 *
 * Kapasite AKTİF lord sayısına iniyor, kayıtlıya değil: doluluk ölçütü
 * aktife bakıyor (services/world.ts → diyarDoluMu). Kayıtlıya göre
 * ayarlayan ilk hâl, lordları uyuyan bir dünyayı "dolu" yapamıyordu ve
 * test kendi kurduğu durumu ölçemez hâle gelmişti.
 *
 * Eski kapasiteler SAKLANIP geri konuyor. `playerCap = 120` diye toptan
 * yazan hâl, dokunmadığı dünyaların kapasitesini de değiştiriyor ve
 * üstelik tasarımdaki değeri (240) elle yazılmış eski bir sayıyla
 * eziyordu.
 */
const eskiKapasiteler = sql(
  `SELECT id || '=' || "playerCap" FROM "World" WHERE status <> 'closed';`,
)
  .split('\n')
  .filter(Boolean);
/*
 * `open` OLANLAR DEĞİL, kapanmamış HEPSİ dolduruluyor.
 *
 * `full` damgası iki yönlü: dolmuş bir diyar oyuncu kaybedince yeniden
 * açılıyor. Yalnız `status = 'open'` olanları dolduran hâl, yer açılmış
 * bir `full` diyarı gözden kaçırıyordu ve yeni oyuncu oraya düşüyordu —
 * test "yeni dünya açılmadı" diye kalıyordu, oysa açılmasına gerek
 * yoktu. Testin kurmak istediği durum "hiçbir diyarda yer yok".
 */
sql(
  `UPDATE "World" w SET "playerCap" = GREATEST(1, (SELECT count(*) FROM "Lord" l WHERE l."worldId" = w.id AND l."lastSeenAt" > now() - interval '7 days')) WHERE w.status <> 'closed';`,
);
console.log('  Açık dünyalar yapay olarak dolduruldu.');

// Ad, süzgece takılmayacak biçimde üretiliyor: ham `Date.now()` beş aynı
// rakamı arka arkaya içerebiliyor ve kayıt "dünya dolu" yüzünden değil AD
// yüzünden reddediliyordu — testi ölçtüğü şeyden bağımsız bir sebeple
// kaldırıyordu.
const ad = benzersizAd('Tasan');
const sonuc = await kayit(ad);
kontrol('Dünya doluyken kayıt BAŞARILI olmalı', sonuc.ok, `HTTP ${sonuc.status}`);
if (!sonuc.ok) console.log('    yanıt:', JSON.stringify(sonuc.body));

const sonrakiDunya = Number(sql('SELECT count(*) FROM "World";'));
kontrol('Yeni dünya açıldı', sonrakiDunya === oncekiDunya + 1, `${oncekiDunya} -> ${sonrakiDunya}`);

const yeniDunyaBolge = sql(
  `SELECT count(*) FROM "Region" r JOIN "World" w ON w.id = r."worldId" WHERE w.status = 'open' AND w."openedAt" = (SELECT max("openedAt") FROM "World");`,
);
kontrol(
  `Yeni dünyanın ${BOLGE_SAYISI} bölgesi var`,
  Number(yeniDunyaBolge) === BOLGE_SAYISI,
  `${yeniDunyaBolge} bölge`,
);

const eskiDolu = sql(`SELECT count(*) FROM "World" WHERE status = 'full';`);
kontrol('Dolan dünya "full" işaretlendi', Number(eskiDolu) >= 1, `${eskiDolu} dolu dünya`);

// Yeni oyuncu yeni dünyada ve haritası çalışıyor mu
if (sonuc.ok) {
  const h = { Authorization: `Bearer ${sonuc.body.token}` };
  const harita = await (await fetch(`${API}/api/map`, { headers: h })).json();
  kontrol(`Yeni oyuncunun haritası ${BOLGE_SAYISI} bölge`, harita.regions?.length === BOLGE_SAYISI);
  kontrol(
    'Yeni dünyada hiçbir bölge sahipli değil',
    harita.regions?.every((r) => !r.owner),
    'temiz başlangıç',
  );
}

// Dokunulan dünyaların kapasitesi geri konuyor — yalnız onlarınki.
for (const satir of eskiKapasiteler) {
  const [id, kapasite] = satir.split('=');
  sql(`UPDATE "World" SET "playerCap" = ${kapasite} WHERE id = '${id}';`);
}
console.log(`\n  ${eskiKapasiteler.length} dünyanın kapasitesi geri alındı.`);

console.log(
  hata === 0 ? '\nSONUÇ: shard açılımı çalışıyor.' : `\nSONUÇ: ${hata} kontrol başarısız.`,
);
process.exit(hata === 0 ? 0 : 1);
