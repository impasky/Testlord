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
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.KORUMA_PORT ?? 3210);
const KOK = new URL('..', import.meta.url).pathname;
let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

/** dev.ts içindeki bütün rota yolları — elle liste tutmuyoruz. */
function devUclari() {
  const kaynak = readFileSync(`${KOK}apps/api/src/routes/dev.ts`, 'utf8');
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

const { surec, oku } = sunucuBaslat({
  NODE_ENV: 'production',
  PORT: String(PORT),
  SERVE_WEB: 'false',
  RUN_WORKER: 'false',
  AUTO_MIGRATE: 'false',
  SEED_DEMO_LORDS: 'false',
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${ad}@lordlar.dev`,
        password: 'parola1234',
        lordName: `Krm${Date.now().toString(36).slice(-4)}`,
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
    }
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

console.log(hata === 0 ? '\nÜRETİM KORUMALARI TEMİZ\n' : `\n${hata} KORUMA KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
