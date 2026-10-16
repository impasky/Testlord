/**
 * Yedek tatbikatı (docs/05 §4): "denenmemiş yedek yedek değildir".
 *
 * Yayın listesinin "yedek alınıyor VE bir kez geri yüklenerek denendi"
 * maddesi elle bırakılmıştı ve kimse denemiyordu. Bu araç denemenin
 * kendisi — baştan sona, dokunduğu her şeyi geri toplayarak:
 *
 *   1. YEDEK: `tools/yedekle.sh` geçici bir dizine dump alıyor.
 *   2. GERİ YÜKLE: boş, geçici bir veritabanı açılıyor ve dump
 *      `tools/geri-yukle.sh` ile oraya yükleniyor. Süre ölçülüyor — bir
 *      kazada "oyun kaç dakika kapalı kalır" sorusunun cevabı bu.
 *   3. KARŞILAŞTIR: tablo tablo satır sayıları kaynakla. Kaynak canlı
 *      (worker, oyuncular) ve dump'tan sonra değişebiliyor; küçük fark
 *      kabul, ama dolu bir tablonun BOŞ gelmesi ya da tablonun hiç
 *      gelmemesi kabul değil.
 *   4. ŞEMA: yüklenen veritabanı koddaki şemayla birebir mi
 *      (`prisma migrate diff`). Eski bir yedek yeni koda yüklenince
 *      nerede ayrıştığını burada görürsün.
 *   5. AÇILIŞ: sunucu yüklenen veritabanıyla kalkıyor ve diyar listesini
 *      okuyabiliyor mu. Satır saymak verinin geldiğini, açılış OYUNUN
 *      onunla çalıştığını gösteriyor.
 *   6. TEMİZLİK: geçici veritabanı ve dump siliniyor (TUT=1 ile kalır).
 *
 * KULLANIM
 *   pnpm yedek-tatbikati                        # DATABASE_URL ya da apps/api/.env
 *   HEDEF_URL=postgresql://.../bos tools/...    # geçici vt açılamıyorsa: BOŞ bir hedef ver
 *   TUT=1 pnpm yedek-tatbikati                  # geçici vt ve dump'ı silme
 *
 * Geçici veritabanı kaynakla aynı sunucuda açılıyor (`CREATE DATABASE`);
 * yönetilen bir Postgres buna izin vermiyorsa HEDEF_URL ile boş bir
 * hedef ver. Adresler hiçbir yere yazılmıyor, yalnız sunucu/vt adı.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const TUT = process.env.TUT === '1';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

function kaynakAdres() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = join(KOK, 'apps/api/.env');
  if (existsSync(env)) {
    const satir = readFileSync(env, 'utf8')
      .split('\n')
      .find((s) => s.startsWith('DATABASE_URL='));
    if (satir) return satir.slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
  }
  throw new Error('DATABASE_URL yok (ortamda da apps/api/.env içinde de).');
}
/** Parolayı ve kullanıcıyı göstermeden: sunucu:port/vt. */
const maskele = (adres) => {
  const u = new URL(adres);
  return `${u.host}${u.pathname}`;
};
const vtDegistir = (adres, ad) => {
  const u = new URL(adres);
  u.pathname = `/${ad}`;
  return u.toString();
};

function psql(adres, sql) {
  return execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', adres, '-c', sql], {
    encoding: 'utf8',
  }).trim();
}

/** Bütün tabloların satır sayısı, tek sorguda. */
function sayim(adres) {
  const tablolar = psql(
    adres,
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
  )
    .split('\n')
    .filter(Boolean);
  if (tablolar.length === 0) return new Map();
  const sql = tablolar
    .map((t) => `select '${t}', count(*) from "${t.replace(/"/g, '""')}"`)
    .join(' union all ');
  return new Map(
    psql(adres, sql)
      .split('\n')
      .map((s) => s.split('|'))
      .map(([t, n]) => [t, Number(n)]),
  );
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('Lordlar Çağı — yedek tatbikatı\n');
const KAYNAK = kaynakAdres();
const gecici = `lordlar_tatbikat_${Date.now().toString(36)}`;
const kendiHedefi = Boolean(process.env.HEDEF_URL);
const HEDEF = process.env.HEDEF_URL ?? vtDegistir(KAYNAK, gecici);
const dizin = mkdtempSync(join(tmpdir(), 'lordlar-yedek-'));
let sunucu = null;
let hedefAcildi = false;

try {
  console.log(`Kaynak: ${maskele(KAYNAK)}`);
  console.log(`Hedef:  ${maskele(HEDEF)}${kendiHedefi ? '' : ' (geçici)'}\n`);

  /* 1. Yedek ------------------------------------------------------- */
  const t0 = Date.now();
  execFileSync('bash', [join(KOK, 'tools/yedekle.sh')], {
    env: { ...process.env, DATABASE_URL: KAYNAK, YEDEK_DIZIN: dizin },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const dump = readdirSync(dizin).find((f) => f.endsWith('.dump'));
  const yedekSn = (Date.now() - t0) / 1000;
  const kaynakSayim = sayim(KAYNAK);
  kontrol('Yedek alındı', Boolean(dump), `${dump ?? 'yok'} · ${yedekSn.toFixed(1)} sn`);
  if (!dump) throw new Error('dump yok');

  /* 2. Geri yükle -------------------------------------------------- */
  if (!kendiHedefi) {
    psql(KAYNAK, `create database "${gecici}"`);
    hedefAcildi = true;
  }
  const t1 = Date.now();
  const cikti = execFileSync('bash', [join(KOK, 'tools/geri-yukle.sh'), join(dizin, dump)], {
    env: { ...process.env, HEDEF_URL: HEDEF },
    encoding: 'utf8',
  });
  const yuklemeSn = (Date.now() - t1) / 1000;
  kontrol(
    'Geri yüklendi ve doğrulandı',
    cikti.includes('GERİ YÜKLEME TAMAM'),
    `${yuklemeSn.toFixed(1)} sn`,
  );

  /* 3. Karşılaştır ------------------------------------------------- */
  const hedefSayim = sayim(HEDEF);
  const eksikTablo = [...kaynakSayim.keys()].filter((t) => !hedefSayim.has(t));
  kontrol(
    'Her tablo geldi',
    eksikTablo.length === 0,
    `${hedefSayim.size}/${kaynakSayim.size} tablo${eksikTablo.length ? ` · eksik: ${eksikTablo.join(', ')}` : ''}`,
  );
  // Canlı kaynak dump'tan sonra değişmiş olabilir: küçük fark kabul.
  const farklar = [];
  let bosGelen = 0;
  let toplamKaynak = 0;
  let toplamHedef = 0;
  for (const [t, n] of kaynakSayim) {
    const m = hedefSayim.get(t) ?? 0;
    toplamKaynak += n;
    toplamHedef += m;
    if (n > 0 && m === 0) bosGelen++;
    if (Math.abs(n - m) > Math.max(10, n * 0.02)) farklar.push(`${t} ${n}→${m}`);
  }
  kontrol('Dolu hiçbir tablo boş gelmedi', bosGelen === 0, `${bosGelen} tablo`);
  kontrol(
    'Satır sayıları kaynakla uyuşuyor (canlı fark payı %2)',
    farklar.length === 0,
    farklar.length ? farklar.slice(0, 5).join(', ') : `${toplamHedef}/${toplamKaynak} satır`,
  );

  /* 4. Şema -------------------------------------------------------- */
  let semaFarki = '';
  try {
    execFileSync(
      'pnpm',
      [
        '--filter',
        '@lordlar/api',
        'exec',
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        HEDEF,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { cwd: KOK, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
  } catch (e) {
    // --exit-code: 2 = fark var, başka kod = araç hatası.
    semaFarki = e.status === 2 ? 'fark var' : `araç hatası (${e.status})`;
  }
  kontrol('Şema koddakiyle birebir', semaFarki === '', semaFarki || 'fark yok');

  /* 5. Açılış ------------------------------------------------------ */
  const PORT = String(3400 + Math.floor(Math.random() * 400));
  const dist = join(KOK, 'apps/api/dist/index.js');
  const [komut, argumanlar] = existsSync(dist)
    ? ['node', [dist]]
    : ['npx', ['tsx', join(KOK, 'apps/api/src/index.ts')]];
  sunucu = spawn(komut, argumanlar, {
    cwd: join(KOK, 'apps/api'),
    // Yüklenen veritabanına YAZMASIN: worker, migration ve tohum kapalı.
    env: {
      ...process.env,
      DATABASE_URL: HEDEF,
      PORT,
      NODE_ENV: 'production',
      RUN_WORKER: 'false',
      AUTO_MIGRATE: 'false',
      SEED_DEMO_LORDS: 'false',
      SERVE_WEB: 'false',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let hataCiktisi = '';
  sunucu.stderr.on('data', (d) => (hataCiktisi += d));
  let saglik = null;
  for (let i = 0; i < 60 && !saglik; i++) {
    await bekle(1000);
    saglik = await fetch(`http://127.0.0.1:${PORT}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  kontrol('Sunucu yüklenen veritabanıyla açılıyor', Boolean(saglik?.ok), hataCiktisi.slice(-200));
  const diyarlar = saglik
    ? await fetch(`http://127.0.0.1:${PORT}/api/diyarlar`)
        .then((r) => r.json())
        .catch(() => null)
    : null;
  const kaynakDiyar = kaynakSayim.get('World') ?? 0;
  kontrol(
    'Oyun yüklenen veriyi okuyor (diyar listesi)',
    Array.isArray(diyarlar?.diyarlar) && (kaynakDiyar === 0 || diyarlar.diyarlar.length > 0),
    `${diyarlar?.diyarlar?.length ?? 0} açık diyar · kaynakta ${kaynakDiyar} diyar`,
  );

  /* 5b. Betiğin emniyetleri -------------------------------------- */
  // Yanlış bir kurtarma, kazanın kendisinden kötü: üç yanlış kullanım da
  // hedefe dokunmadan durmalı.
  const dener = (ortam, ...arg) => {
    try {
      execFileSync('bash', [join(KOK, 'tools/geri-yukle.sh'), ...arg], {
        env: { ...process.env, HEDEF_URL: '', ...ortam },
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
      return { kod: 0, cikti: '' };
    } catch (e) {
      return { kod: e.status, cikti: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };
  const hedefsiz = dener({}, join(dizin, dump));
  kontrol(
    'Emniyet: hedef verilmeden yüklemiyor (DATABASE_URL okunmuyor)',
    hedefsiz.kod !== 0 && hedefsiz.cikti.includes('HEDEF_URL'),
  );
  const dolu = dener({ HEDEF_URL: HEDEF }, join(dizin, dump));
  kontrol(
    'Emniyet: dolu hedefin üstüne bayraksız yazmıyor',
    dolu.kod !== 0 && dolu.cikti.includes('--uzerine-yaz'),
  );
  const bozukDosya = join(dizin, 'bozuk.dump');
  execFileSync('bash', ['-c', `head -c 4096 /dev/urandom > "${bozukDosya}"`]);
  const onceSatir = psql(HEDEF, 'select count(*) from "Lord"');
  const bozuk = dener({ HEDEF_URL: HEDEF }, bozukDosya, '--uzerine-yaz');
  kontrol(
    'Emniyet: bozuk dump hedefe dokunmadan reddediliyor',
    bozuk.kod !== 0 && psql(HEDEF, 'select count(*) from "Lord"') === onceSatir,
  );

  // Gerçek kurtarmanın yolu: veritabanı duruyor ama verisi bozuk. Hedefi
  // kirletip dump'ı --uzerine-yaz ile üstüne yüklüyoruz; her tablo dump
  // anına dönmeli.
  psql(HEDEF, 'delete from "Event"; update "Lord" set altin = -1');
  const ustune = dener({ HEDEF_URL: HEDEF }, join(dizin, dump), '--uzerine-yaz');
  const sonra = sayim(HEDEF);
  const ayni = [...hedefSayim].every(([t, n]) => sonra.get(t) === n);
  const kirli = Number(psql(HEDEF, 'select count(*) from "Lord" where altin = -1'));
  kontrol(
    'Üstüne yazma: bozulmuş veritabanı dump anına dönüyor',
    ustune.kod === 0 && ayni && kirli === 0,
    ustune.kod === 0 ? `${kirli} kirli satır kaldı` : ustune.cikti.slice(-200),
  );

  console.log(
    `\n  Yedek ${yedekSn.toFixed(1)} sn, geri yükleme ${yuklemeSn.toFixed(1)} sn ` +
      `(${toplamHedef} satır). Bir kazada veritabanı bu sürede geri gelir.`,
  );
} catch (e) {
  kontrol('Tatbikat tamamlandı', false, String(e?.message ?? e).slice(0, 300));
} finally {
  /* 6. Temizlik ---------------------------------------------------- */
  if (sunucu) {
    sunucu.kill('SIGTERM');
    await bekle(500);
  }
  if (TUT) {
    console.log(`\n  TUT=1: geçici vt ${hedefAcildi ? gecici : '—'} ve dump ${dizin} duruyor.`);
  } else {
    rmSync(dizin, { recursive: true, force: true });
    if (hedefAcildi) {
      try {
        psql(KAYNAK, `drop database if exists "${gecici}" with (force)`);
      } catch (e) {
        console.log(
          `  [NOT] geçici vt silinemedi (${gecici}): ${String(e?.message).slice(0, 120)}`,
        );
      }
    }
  }
}

console.log(hata === 0 ? '\nTATBİKAT GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
