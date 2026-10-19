/**
 * ÜRETİM KORUMALARI: yayına çıkarken delik kalmasın.
 *
 * `docs/05` §6 kontrol listesinin iki maddesi kodla korunuyor:
 *
 *   - `NODE_ENV=production` ise `/api/test/*` uçları HİÇ yüklenmez
 *     (index.ts). O uçlar saati ileri alıyor, kaynak veriyor, yönetici
 *     atıyor — üretimde açık kalırsa oyun kimliksiz bir kişi tarafından
 *     baştan sona bozulabilir.
 *   - `JWT_SECRET` 32 karakterden kısaysa sunucu HİÇ açılmaz (env.ts).
 *
 * İkisi de vardı ve ikisi de çalışıyordu — ama HİÇBİR TESTİ YOKTU.
 * `tools/uretim-testi.mjs` vardı ama o sırada ne `pnpm e2e` zincirinde ne
 * CI'daydı (artık CI'da ayrı bir iş) — üstelik o da `/api/test/*`
 * uçlarına hiç bakmıyor, oyunu oynuyor. Yani biri `if (env.NODE_ENV !== 'production')` satırını
 * silseydi 551 birim testi ve 1060 e2e kontrolü yeşil kalır, delik
 * yayına çıkardı. Bu dosya o sessizliği kapatıyor.
 *
 * Uçlar ELLE SAYILMIYOR: `dev.ts` okunup içindeki bütün rotalar
 * çıkarılıyor. Yarın oraya yeni bir uç eklenirse bu test onu da
 * kendiliğinden kapsar — elle yazılmış bir liste ise eklenen ucu hiç
 * görmezdi ve tam da korumaya çalıştığımız şey kaçardı.
 *
 * Sunucuyu `tsx src/index.ts` ile kaldırıyor, `dist` ile değil: CI'nın
 * uçtan uca işi derleme yapmıyor ve koruma zaten kaynakta.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const PORT = Number(process.env.KORUMA_PORT ?? 3210);
const KOK = new URL('..', import.meta.url).pathname;
let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

/**
 * Geliştirme rotalarının yolları — elle liste tutmuyoruz. `routes/dev*.ts`:
 * dev.ts ve oradan yüklenen taklitler (devMagaza.ts).
 */
function devUclari() {
  const dizin = `${KOK}apps/api/src/routes/`;
  const kaynak = readdirSync(dizin)
    .filter((f) => /^dev.*\.ts$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(dizin + f, 'utf8'))
    .join('\n');
  const yollar = [...kaynak.matchAll(/app\.(?:post|get|put|delete)\(\s*'([^']+)'/g)].map(
    (m) => m[1],
  );
  return [...new Set(yollar)];
}

/** Sunucuyu verilen ortamla kaldırır; {surec, cikti} döner. */
function sunucuBaslat(ek) {
  const surec = spawn('pnpm', ['--filter', '@lordlar/api', 'exec', 'tsx', 'src/index.ts'], {
    cwd: KOK,
    env: { ...process.env, ...ek },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let cikti = '';
  surec.stdout.on('data', (d) => (cikti += d));
  surec.stderr.on('data', (d) => (cikti += d));
  return { surec, oku: () => cikti };
}

async function ayagaKalkmasiniBekle(url, saniye = 60) {
  for (let i = 0; i < saniye * 2; i++) {
    try {
      const y = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (y.ok) return true;
    } catch {
      /* henüz açılmadı */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

console.log('Lordlar Çağı — üretim korumaları\n');

/* ---------------------------------------------------------------- */
/* 1. NODE_ENV=production -> /api/test/* kapalı                      */
/* ---------------------------------------------------------------- */
const uclar = devUclari();
k('dev.ts uçları okunabildi', uclar.length > 0, `${uclar.length} uç`);

// Testin bildiği bir imza: günlükte geçmediği aranabilsin (sunucu .env'den
// okuduğunda değer bu süreçte yok).
const IMZA = randomBytes(32).toString('hex');
const { surec, oku } = sunucuBaslat({
  JWT_SECRET: IMZA,
  NODE_ENV: 'production',
  PORT: String(PORT),
  SERVE_WEB: 'false',
  RUN_WORKER: 'false',
  AUTO_MIGRATE: 'false',
  SEED_DEMO_LORDS: 'false',
  // İstemci adresi vekilin başlığından (Render'daki ayar); tavan küçük ki
  // kova ayrımı birkaç istekle ölçülebilsin.
  ISTEMCI_IP_BASLIGI: 'cf-connecting-ip',
  AUTH_RATE_LIMIT_MAX: '3',
});

try {
  const kalkti = await ayagaKalkmasiniBekle(`http://127.0.0.1:${PORT}/health`);
  k('üretim modunda sunucu açıldı', kalkti, kalkti ? `port ${PORT}` : oku().slice(-300));

  if (kalkti) {
    let acikKalan = [];
    for (const yol of uclar) {
      const y = await fetch(`http://127.0.0.1:${PORT}/api${yol}`, { method: 'POST' });
      // 404 = rota hiç yüklenmemiş (istediğimiz). Başka her şey — 401, 400,
      // 500 — rotanın VAR olduğu anlamına gelir.
      if (y.status !== 404) acikKalan.push(`${yol} -> ${y.status}`);
    }
    k(
      `üretimde ${uclar.length} test ucunun hepsi kapalı`,
      acikKalan.length === 0,
      acikKalan.length ? `AÇIK KALAN: ${acikKalan.join(', ')}` : 'hepsi 404',
    );

    // Uyarı yalnız geliştirmede basılmalı; üretim log'unda görünmesi
    // uçların yüklendiğinin ikinci bir işareti olurdu.
    k('üretim log’unda "test uçları açık" uyarısı yok', !/test uçları açık/i.test(oku()));

    const saglik = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
    k('/health izleme durumunu bildiriyor', typeof saglik.izleme === 'string', `${saglik.izleme}`);

    // Yayın kontrolü (docs/05 §6): kurulmuş sunucu eksikleri açılışta
    // yazıyor — ve hiçbir ayarın değerini yazmıyor.
    {
      const bitis = Date.now() + 10_000;
      while (!/Yayın kontrolü:/.test(oku()) && Date.now() < bitis) {
        await new Promise((r) => setTimeout(r, 200));
      }
      const log = oku();
      const satir = /Yayın kontrolü: \d+ eksik, \d+ uyarı/.exec(log)?.[0];
      k('açılış günlüğü yayın kontrolünü yazıyor', !!satir, satir ?? log.slice(-300));
      const gizliler = [IMZA, process.env.DATABASE_URL].filter(Boolean);
      k(
        'yayın kontrolü imzayı ve veritabanı adresini yazmıyor',
        gizliler.length > 0 && gizliler.every((g) => !log.includes(g)),
        `${gizliler.length} değer arandı`,
      );
    }

    /*
     * SIKIŞTIRMA — sessizce kaybolursa kimse fark etmez.
     *
     * Uzun süre kapalıydı ve hiçbir test bakmıyordu: ana paket 409.610
     * baytın tamamıyla gidiyordu, oysa sıkıştırılmış hâli 135.064.
     * Yavaş bir bağlantıda oyuncunun boş ekrana bakma süresi 8,8
     * saniyeden 3,1 saniyeye ancak sıkıştırma açılınca indi.
     *
     * Bu tür bir gerileme görünmez: uygulama çalışmaya devam eder,
     * yalnız yavaşlar. O yüzden burada nöbetçi duruyor.
     */
    /*
     * BÜYÜK bir yanıt üzerinden sınanıyor, `/health` üzerinden değil.
     *
     * `@fastify/compress` bir eşiğin (1 kB) altındaki yanıtları bilerek
     * sıkıştırmıyor — 60 baytlık bir JSON'u sıkıştırmak onu büyütür.
     * İlk yazdığımda `/health`e bakıyordum ve test "sıkıştırma kapalı"
     * diyordu; kapalı olan sıkıştırma değil, benim ölçütümdü.
     *
     * Harita ucu 121 bölge döndürüyor, yani eşiğin çok üstünde.
     */
    const ad = `koruma${Date.now().toString(36)}`;
    const kayit = await fetch(`http://127.0.0.1:${PORT}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.50' },
      body: JSON.stringify({
        email: `${ad}@lordlar.dev`,
        password: 'parola1234',
        lordName: `Krm${Date.now().toString(36).slice(-4)}`,
        // Ülkesi olmayan lord saldıramıyor (docs/27).
        ulke: 'TUR',
      }),
    }).then((r) => r.json());

    if (!kayit?.token) {
      k('sıkıştırma sınanabildi (kayıt gerekiyor)', false, JSON.stringify(kayit).slice(0, 120));
    } else {
      const harita = await fetch(`http://127.0.0.1:${PORT}/api/map`, {
        headers: { Authorization: `Bearer ${kayit.token}`, 'Accept-Encoding': 'gzip' },
      });
      const kodlama = harita.headers.get('content-encoding');
      const boyut = (await harita.arrayBuffer()).byteLength;
      k(
        'sunucu büyük yanıtları sıkıştırıyor',
        kodlama !== null && /br|gzip|deflate/.test(kodlama),
        kodlama ? `${kodlama} · ${boyut} bayt` : 'Content-Encoding YOK — sıkıştırma kapalı',
      );

      // Diyar seferinin test saati başlığı (`x-test-an`, docs/09 §2.6)
      // üretimde yok sayılmalı: yoksa oyuncu başlıkla hafta sonunu açar,
      // ödülü hafta içinde alırdı.
      const etkinlik = (ek) =>
        fetch(`http://127.0.0.1:${PORT}/api/diyar-etkinligi`, {
          headers: { Authorization: `Bearer ${kayit.token}`, ...ek },
        }).then((r) => r.json());
      const gercek = await etkinlik({});
      const kaydirilmis = await etkinlik({ 'x-test-an': '2030-01-05T12:00:00Z' });
      k(
        'üretimde test saati başlığı yok sayılıyor',
        !!gercek?.etkinlik?.bas && kaydirilmis?.etkinlik?.bas === gercek.etkinlik.bas,
        `${gercek?.etkinlik?.bas} / ${kaydirilmis?.etkinlik?.bas}`,
      );
    }

    /*
     * İSTEMCİ ADRESİ (istemciIp.ts). Giriş sınırı vekilin yazdığı başlığa
     * göre kova ayırmalı; istemcinin uydurabileceği iki başlık — test
     * başlığı ve X-Forwarded-For'un başı — kovayı değiştirmemeli.
     */
    {
      const giris = (basliklar) =>
        fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...basliklar },
          body: JSON.stringify({
            email: `yok${Math.random().toString(36).slice(2)}@lordlar.dev`,
            password: 'yanlisparola',
          }),
        }).then((r) => r.status);
      const A = { 'cf-connecting-ip': '203.0.113.10' };
      const ilkUc = [await giris(A), await giris(A), await giris(A)];
      const dorduncu = await giris(A);
      k(
        'giriş sınırı vekilin başlığına göre: tavanda 429',
        ilkUc.every((d) => d !== 429) && dorduncu === 429,
        `${ilkUc.join(',')} → ${dorduncu}`,
      );
      const baskasi = await giris({ 'cf-connecting-ip': '203.0.113.11' });
      k('başka adres ayrı kova', baskasi !== 429, `${baskasi}`);
      const uydurma = await giris({
        ...A,
        'x-test-ip': '203.0.113.12',
        'x-forwarded-for': '203.0.113.13',
      });
      k(
        'üretimde test başlığı ve X-Forwarded-For kovayı değiştirmiyor',
        uydurma === 429,
        `${uydurma}`,
      );
      // Başlık eksik + vekil izi: ayar hatası, günlüğe bir kez.
      await giris({ 'x-forwarded-for': '203.0.113.14' });
      await giris({ 'x-forwarded-for': '203.0.113.15' });
      const uyari = (
        oku().match(/ISTEMCI_IP_BASLIGI=cf-connecting-ip ayarlı ama istekte yok/g) ?? []
      ).length;
      k(
        'başlık eksikse günlüğe bir kez yazılıyor (sağlık denetimi susuyor)',
        uyari === 1,
        `${uyari}`,
      );
    }

    // Günlük IP taşımıyor: gizlilik metni "yalnız istek anında" diyor.
    k(
      'üretim günlüğünde istemci adresi yok',
      !/remoteAddress|203\.0\.113\.|198\.51\.100\./.test(oku()),
      /incoming request/.test(oku()) ? 'istek satırları var, adres yok' : 'istek satırı yok',
    );
  }
} finally {
  surec.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1200));
  if (!surec.killed) surec.kill('SIGKILL');
}

/* ---------------------------------------------------------------- */
/* 2. Kısa JWT_SECRET -> sunucu hiç açılmaz                          */
/* ---------------------------------------------------------------- */
const kisa = sunucuBaslat({
  NODE_ENV: 'production',
  PORT: String(PORT + 1),
  JWT_SECRET: 'kisa',
  SERVE_WEB: 'false',
  RUN_WORKER: 'false',
  AUTO_MIGRATE: 'false',
});
const cikisKodu = await new Promise((r) => {
  const zamanasimi = setTimeout(() => {
    kisa.surec.kill('SIGKILL');
    r('açık kaldı');
  }, 45_000);
  kisa.surec.on('exit', (c) => {
    clearTimeout(zamanasimi);
    r(c);
  });
});
k(
  'kısa JWT_SECRET ile sunucu açılmıyor',
  cikisKodu !== 0 && cikisKodu !== 'açık kaldı',
  `çıkış ${cikisKodu}`,
);
k(
  'sebebi söylüyor (sessizce ölmüyor)',
  /JWT_SECRET/.test(kisa.oku()),
  kisa
    .oku()
    .split('\n')
    .find((l) => /JWT_SECRET/.test(l))
    ?.trim() ?? 'JWT_SECRET geçmiyor',
);

/* ---------------------------------------------------------------- */
/* 3. Migration güncelken açılış Prisma CLI'yı hiç başlatmıyor        */
/* ---------------------------------------------------------------- */
/*
 * Ücretsiz sunucu (0,1 CPU) her uyanışta `prisma migrate deploy` için
 * 17-22 sn harcıyordu, bekleyen migration yokken bile. Artık açılış
 * `_prisma_migrations`a kendisi bakıyor (apps/api migrationDurumu.ts).
 * Buradaki veritabanı geliştirme sunucusununki: migration'ları güncel.
 */
const uyanis = sunucuBaslat({
  NODE_ENV: 'production',
  PORT: String(PORT + 2),
  JWT_SECRET: randomBytes(32).toString('hex'),
  SERVE_WEB: 'false',
  RUN_WORKER: 'false',
  AUTO_MIGRATE: 'true',
  SEED_DEMO_LORDS: 'false',
});
try {
  const kalkti = await ayagaKalkmasiniBekle(`http://127.0.0.1:${PORT + 2}/health`);
  k('AUTO_MIGRATE açıkken sunucu açıldı', kalkti, kalkti ? '' : uyanis.oku().slice(-300));
  k(
    'bekleyen migration yokken Prisma CLI başlamıyor',
    /Migration: bekleyen yok\./.test(uyanis.oku()) && !/Prisma schema loaded/.test(uyanis.oku()),
    uyanis
      .oku()
      .split('\n')
      .find((l) => /Migration/.test(l))
      ?.trim() ?? 'Migration satırı yok',
  );
} finally {
  uyanis.surec.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1200));
  if (!uyanis.surec.killed) uyanis.surec.kill('SIGKILL');
}

console.log(hata === 0 ? '\nÜRETİM KORUMALARI TEMİZ\n' : `\n${hata} KORUMA KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
