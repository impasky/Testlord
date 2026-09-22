/**
 * Güvenlik denetiminin kapattığı açıklar — geri gelmesinler diye.
 *
 * Çift harcama ayrı dosyada (yaris-testi.mjs): orada eşzamanlılık
 * ölçülüyor. Burada kimlik ve sınır tarafı var:
 *
 *   1. Parola sıfırlanınca ÖTEKİ oturumlar ölüyor. Önceden jeton yedi gün
 *      geçerliydi ve sıfırlama saldırganı dışarı atmıyordu.
 *   2. Sıfırlama postası adres başına frenli. Frensizken herhangi birinin
 *      adresine dakikada onlarca posta yağdırılabiliyordu.
 *   3. Giriş adres başına frenli: on hatalı denemeden sonra adres kilitli.
 *   4. Güvenlik başlıkları var (CSP, nosniff, çerçeve yasağı).
 *   5. Başka diyarın bölgesi okunamıyor.
 *   6. Push aboneliği iç ağ adresi kabul etmiyor (SSRF) — yalnız sunucuda
 *      VAPID açıksa ölçülebiliyor; kural ayrıca birim testinde.
 *
 * API ayakta olmalı. node tools/guvenlik-testi.mjs
 */
import { execSync } from 'node:child_process';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const DB = process.env.DATABASE_URL ?? 'postgresql://lordlar@127.0.0.1:5432/lordlar_cagi';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const JS = { 'Content-Type': 'application/json' };
const POST = (yol, govde, baslik = JS) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: baslik, body: JSON.stringify(govde ?? {}) });
const yetki = (jeton) => ({ ...JS, Authorization: `Bearer ${jeton}` });

async function yeniHesap(onek) {
  const ad = benzersizAd(onek);
  const eposta = `${ad.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@lordlar.dev`;
  const { token } = await kayitOl(API, { email: eposta, lordName: ad });
  return { eposta, token };
}

console.log('Lordlar Çağı — güvenlik testi\n');

// ── 1. Parola sıfırlanınca öteki oturumlar ölüyor ────────────────────
{
  const { eposta, token: saldirgan } = await yeniHesap('Guv');
  kontrol(
    'Sıfırlamadan önce jeton çalışıyor',
    (await fetch(`${API}/api/me`, { headers: yetki(saldirgan) })).ok,
  );

  const istek = await (await POST('/auth/sifirlama-iste', { email: eposta })).json();
  await POST('/auth/sifirlama-yap', { token: istek.jeton, password: 'sifirlandi77' });

  const r = await fetch(`${API}/api/me`, { headers: yetki(saldirgan) });
  const g = await r.json().catch(() => ({}));
  kontrol(
    'Sıfırlamadan sonra eski jeton geçersiz',
    r.status === 401 && g.code === 'OTURUM_BITTI',
    `HTTP ${r.status} ${g.code ?? ''}`,
  );
  const giris = await (
    await POST('/auth/login', { email: eposta, password: 'sifirlandi77' })
  ).json();
  kontrol(
    'Yeni parolayla açılan oturum çalışıyor',
    (await fetch(`${API}/api/me`, { headers: yetki(giris.token) })).ok,
  );
}

// ── 2. Sıfırlama freni ───────────────────────────────────────────────
//
// Geliştirmede cevap jetonu taşıyor; frene takılan istekte jeton yok ama
// cevabın GERİ KALANI aynı — "çok hızlı" demek adresin kayıtlı olduğunu
// söylemek olurdu. Taze hesap: yukarıdakinin sıfırlaması hâlâ frende.
{
  const { eposta } = await yeniHesap('Guv');
  const ilk = await (await POST('/auth/sifirlama-iste', { email: eposta })).json();
  const hemen = await (await POST('/auth/sifirlama-iste', { email: eposta })).json();
  kontrol(
    'Sıfırlama postası arka arkaya gönderilmiyor',
    typeof ilk.jeton === 'string' && hemen.gonderildi === true && hemen.jeton === undefined,
    `ilk jeton: ${typeof ilk.jeton}, ikinci jeton: ${typeof hemen.jeton}`,
  );
}

// ── 3. Giriş freni ───────────────────────────────────────────────────
{
  const { eposta } = await yeniHesap('Guv');
  const durumlar = [];
  for (let i = 0; i < 10; i++) {
    durumlar.push((await POST('/auth/login', { email: eposta, password: 'yanlis-parola' })).status);
  }
  const dogru = await POST('/auth/login', { email: eposta, password: 'parola1234' });
  const g = await dogru.json().catch(() => ({}));
  kontrol(
    'On hatalı denemeden sonra adres kilitli (doğru parolayla bile)',
    durumlar.every((s) => s === 401) && dogru.status === 429 && g.code === 'GIRIS_KILITLI',
    `son: HTTP ${dogru.status} ${g.code ?? ''}`,
  );
  const baska = await yeniHesap('Guv');
  kontrol(
    'Kilit başka adresi etkilemiyor',
    (await POST('/auth/login', { email: baska.eposta, password: 'parola1234' })).ok,
  );
}

// ── 4. Güvenlik başlıkları ───────────────────────────────────────────
{
  const r = await fetch(`${API}/health`);
  const csp = r.headers.get('content-security-policy') ?? '';
  kontrol(
    'CSP yalnız kendi adresinden betik çalıştırıyor',
    /script-src 'self'(;|$)/.test(csp) && csp.includes("frame-ancestors 'none'"),
    csp.slice(0, 60),
  );
  kontrol('nosniff var', r.headers.get('x-content-type-options') === 'nosniff');
  kontrol('Çerçeveye gömülemiyor', r.headers.get('x-frame-options') === 'DENY');
}

// ── 5. Başka diyarın bölgesi okunamıyor ──────────────────────────────
{
  const { token } = await yeniHesap('Guv');
  const harita = await (await fetch(`${API}/api/map`, { headers: yetki(token) })).json();
  const benimkiler = new Set((harita.regions ?? []).map((r) => r.id));
  let yabanci = '';
  try {
    const liste = execSync(`psql "${DB}" -tAf -`, {
      input: 'SELECT r.id FROM "Region" r ORDER BY r.id DESC LIMIT 400;',
    })
      .toString()
      .trim()
      .split('\n')
      .map(Number);
    yabanci = String(liste.find((id) => !benimkiler.has(id)) ?? '');
  } catch {
    /* psql yoksa bu kontrol atlanır */
  }
  if (yabanci) {
    const r = await fetch(`${API}/api/map/${yabanci}`, { headers: yetki(token) });
    kontrol('Başka diyarın bölgesi 404', r.status === 404, `bölge ${yabanci}: HTTP ${r.status}`);
    const o = await POST(
      '/battle/preview',
      { toRegionId: Number(yabanci), army: { mizrakci: 1 } },
      yetki(token),
    );
    kontrol('Başka diyara savaş önizlemesi 404', o.status === 404, `HTTP ${o.status}`);
  } else {
    console.log('  (tek diyar var ya da psql yok: diyar denetimi atlandı)');
  }
}

// ── 6. Push aboneliği iç ağa açılmıyor ───────────────────────────────
{
  const { token } = await yeniHesap('Guv');
  const anahtar = await (await fetch(`${API}/api/push/anahtar`, { headers: yetki(token) })).json();
  if (anahtar.acik) {
    const r = await POST(
      '/push/abone',
      {
        endpoint: 'http://169.254.169.254/latest/meta-data/',
        keys: { p256dh: 'x', auth: 'y' },
      },
      yetki(token),
    );
    const g = await r.json().catch(() => ({}));
    kontrol(
      'İç ağ adresi push aboneliği olarak reddediliyor',
      r.status === 400 && g.code === 'PUSH_ADRES',
      `HTTP ${r.status} ${g.code ?? ''}`,
    );
  } else {
    console.log('  (push kapalı: SSRF kuralı yalnız birim testinde — pushPolitika.test.ts)');
  }
}

console.log(hata === 0 ? '\nSONUÇ: kapatılan açıklar kapalı.' : `\nSONUÇ: ${hata} kontrol kaldı.`);
process.exit(hata === 0 ? 0 : 1);
