/**
 * HARİTA SÜRÜMLEMESİ — canlı dünya yeni haritadan etkilenmemeli.
 *
 * docs/12 §14'ün yayın engeliydi: `seed` açılışta BÜTÜN dünyaların
 * bölgelerini kanonik haritaya eşitliyordu. Oyuncunun aylardır tuttuğu
 * "Gölcük Köyü" bir gecede başka bir yer olabilirdi.
 *
 * Bu test kuralı gerçekten sınıyor, taklidini değil: kanonik haritayı
 * geçici olarak BOZUYOR (oyuncunun evinin adını ve türünü değiştiriyor),
 * seed'i o hâlde koşturuyor ve
 *
 *   - oyunculu dünyanın DOKUNULMADIĞINI,
 *   - yeni kayıtların oraya DÜŞMEDİĞİNİ
 *
 * ölçüyor. Sonunda harita eski hâline dönüyor.
 *
 * Ayrıca motorun veriyle ayrışmadığını da ölçüyor: mesafe artık dünyanın
 * KENDİ komşuluklarından hesaplanmalı, kanonik dosyadan değil. İkisi
 * ayrılırsa oyun yalan söyler — haritada çizilmeyen bir yoldan yürüyüş
 * "1 adım" sürer.
 *
 * API ayakta olmalı.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const KOK = fileURLToPath(new URL('..', import.meta.url));
const HARITA = fileURLToPath(new URL('../data/world-map.json', import.meta.url));
const BOZUK_AD = 'Sürüm Testi Ovası';

let kalan = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  [${kosul ? 'GEÇTİ' : 'KALDI'}] ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) kalan++;
}

async function harita(jeton) {
  const r = await fetch(`${API}/api/map`, { headers: { authorization: `Bearer ${jeton}` } });
  if (!r.ok) throw new Error(`/map -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function yeniOyuncu(onek) {
  const ad = benzersizAd(onek);
  const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });
  return token;
}

/** Seed'i koşturur ve çıktısını döndürür. */
function seedKos() {
  return execFileSync('npx', ['tsx', 'src/seed.ts'], {
    cwd: `${KOK}apps/api`,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

console.log('\nLordlar Çağı — harita sürümü testi\n');

const yedek = readFileSync(HARITA, 'utf8');
let bozuk = false;

try {
  // ── 1. Oyuncu bugünkü haritada bir dünyaya kaydolsun ────────────────
  const jeton = await yeniOyuncu('Surum');
  const once = await harita(jeton);
  const evim = once.regions.find((r) => r.id === once.homeBolgeId);
  kontrol('Oyuncu bir dünyaya kaydoldu', Boolean(evim), `evi: ${evim?.name} (${evim?.type})`);

  // Komşuya mesafe 1 olmalı: komşuluk listesi veritabanından geliyor,
  // mesafe de aynı grafikten hesaplanmalı.
  const komsu = once.regions.find((r) => r.id === evim.komsular[0]);
  kontrol(
    'Mesafe, dünyanın kendi komşuluğuyla tutarlı',
    komsu?.distance === 1,
    komsu ? `${komsu.name}: ${komsu.distance} adım` : 'komşu bulunamadı',
  );

  // ── 2. Kanonik haritayı boz — kurban oyuncunun EVİ ──────────────────
  // Bölge adları kanonik dosyada benzersiz; eşleşmeyi ad üzerinden
  // kuruyoruz, çünkü /map veritabanı kimliği döndürüyor, mapId değil.
  const kanonik = JSON.parse(yedek);
  const hedef = kanonik.regions.find((r) => r.name === evim.name);
  if (!hedef) throw new Error(`Kanonik haritada "${evim.name}" yok.`);
  hedef.name = BOZUK_AD;
  hedef.type = hedef.type === 'tarla' ? 'maden' : 'tarla';
  writeFileSync(HARITA, JSON.stringify(kanonik, null, 2));
  bozuk = true;

  // ── 3. Seed'i bozuk haritayla koştur ────────────────────────────────
  const cikti = seedKos();
  const satir = cikti
    .split('\n')
    .find((s) => s.includes('ESKİ HARİTADA'))
    ?.trim();
  kontrol('Seed oyunculu dünyayı ESKİ HARİTADA bırakıyor', Boolean(satir), satir ?? 'satır yok');

  // ── 4. Oyuncunun dünyası değişmemiş olmalı ──────────────────────────
  const sonra = await harita(jeton);
  const evimSonra = sonra.regions.find((r) => r.id === sonra.homeBolgeId);
  kontrol(
    'Oyuncunun evi hâlâ aynı yer',
    evimSonra?.name === evim.name && evimSonra?.type === evim.type,
    `${evim.name} (${evim.type}) -> ${evimSonra?.name} (${evimSonra?.type})`,
  );
  kontrol(
    'Bozulan ad oyuncunun haritasına sızmadı',
    !sonra.regions.some((r) => r.name === BOZUK_AD),
  );
  kontrol(
    'Komşuluk ve mesafe de yerinde',
    sonra.regions.find((r) => r.id === komsu.id)?.distance === 1,
  );

  // ── 5. Kapı kapandı mı, ve kapalı kalıyor mu ────────────────────────
  //
  // Eski haritalı dünya yeni KAYITLARA da kapanmalı, yoksa yeni oyuncular
  // artık bakımı yapılmayan bir haritaya düşerdi. Seed bunu kendi
  // raporunda söylüyor.
  //
  // Bunu canlı bir kayıtla ölçmek YANILTICI olurdu: çalışan API süreci
  // kanonik haritayı belleğinde tutuyor ve dosyayı değiştirmek onu
  // etkilemiyor. Gerçekte de öyle — harita değişikliği bir yeniden
  // dağıtımla gelir. Test ölçebildiği şeyi ölçüyor.
  kontrol('Eski haritalı dünya yeni kayıtlara kapatıldı', /kapatıldı/.test(satir ?? ''));

  // İkinci koşu aynı cevabı vermeli: tazeleme kararı duruma bakıyor,
  // bir kereye mahsus bir yan etkiye değil.
  const ikinci = seedKos();
  kontrol(
    'İkinci seed koşusu da dünyaya dokunmuyor',
    ikinci.includes('ESKİ HARİTADA'),
    'karar kalıcı',
  );

  // ── 6. Harita geri ──────────────────────────────────────────────────
  writeFileSync(HARITA, yedek);
  bozuk = false;
  seedKos();

  const geri = await harita(jeton);
  kontrol(
    'Harita geri alındıktan sonra eski oyuncu hâlâ tutarlı',
    geri.regions.find((r) => r.id === geri.homeBolgeId)?.name === evim.name,
    `${evim.name} yerinde`,
  );
} finally {
  if (bozuk) {
    writeFileSync(HARITA, yedek);
    console.log('\n  (harita geri alındı)');
    try {
      seedKos();
    } catch {
      /* geri alma en iyi çaba */
    }
  }
}

console.log(
  kalan === 0 ? '\nSONUÇ: harita sürümlemesi çalışıyor.\n' : `\nSONUÇ: ${kalan} kontrol kaldı.\n`,
);
process.exit(kalan === 0 ? 0 : 1);
