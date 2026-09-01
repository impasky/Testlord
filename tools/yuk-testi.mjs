/**
 * 120 sanal oyuncuyla yük testi.
 *
 * docs/00'daki yedinci başarı kriteri: "120 oyuncu aynı dünyada, kimse
 * çökmeden oynayabiliyor." Dünya kapasitesi de 120 (data/balance.json ->
 * dunya.oyuncu_kapasitesi), yani bu sayı keyfi değil: bir shard'ın dolu
 * hâlidir.
 *
 * Ne ölçüyor: gerçek oyun döngüsünün karışımı. Okuma ağır basıyor çünkü
 * oyuncular çoğunlukla bakıyor; yazma da var çünkü asıl yük orada.
 *
 * Neden p95: ortalama gecikme yalan söyler. Bir istek 40 ms, biri 4 saniye
 * sürerse ortalama iyi görünür ama oyuncunun yarısı kötü deneyim yaşar.
 *
 * KULLANIM:
 *   node tools/yuk-testi.mjs                # 120 oyuncu, 5 tur
 *   OYUNCU=40 TUR=3 node tools/yuk-testi.mjs
 *
 * KAYIT SINIRI: kayıt/giriş IP başına dakikada AUTH_RATE_LIMIT_MAX (varsayılan
 * 60) istekle sınırlı. Yük testi tek IP'den geldiği için 429 alınca bekleyip
 * tekrar dener. Testi hızlandırmak istersen sunucuyu AUTH_RATE_LIMIT_MAX=1000
 * ile başlat.
 *
 * API ayakta olmalı. Test veritabanına yazar — üretimde çalıştırma.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const OYUNCU = Number(process.env.OYUNCU ?? 120);
const TUR = Number(process.env.TUR ?? 5);
// Aynı anda kaç istek uçsun: hepsini birden salmak istemci tarafını da
// ölçmeye başlar, ölçtüğümüz şey sunucu olsun.
const ESZAMAN = Number(process.env.ESZAMAN ?? 30);

const olcum = new Map(); // uc -> { sureler: [], hata: 0 }
let toplamHata = 0;
let toplamKisitlama = 0;   // 429: sunucu hatası değil, kasten konmuş sınır
const hataOrnekleri = [];

function kaydet(uc, ms, hataMi, detay) {
  let o = olcum.get(uc);
  if (!o) olcum.set(uc, (o = { sureler: [], hata: 0 }));
  o.sureler.push(ms);
  if (hataMi) {
    o.hata++;
    toplamHata++;
    if (hataOrnekleri.length < 5) hataOrnekleri.push(`${uc}: ${detay}`);
  }
}

async function istek(uc, yol, secenek = {}) {
  const t = performance.now();
  try {
    const r = await fetch(`${API}/api${yol}`, secenek);
    const ms = performance.now() - t;
    // 4xx beklenen olabilir (kaynak yetmedi, kalkan var). 5xx asla.
    const kotu = r.status >= 500;
    if (r.status === 429) toplamKisitlama++;
    kaydet(uc, ms, kotu, kotu ? `HTTP ${r.status} ${(await r.text()).slice(0, 80)}` : '');
    if (r.ok) return await r.json().catch(() => null);
    return { _durum: r.status };
  } catch (e) {
    kaydet(uc, performance.now() - t, true, String(e).slice(0, 80));
    return null;
  }
}

/** Listeyi ESZAMAN genişliğinde parçalara bölerek işler. */
async function havuz(liste, isle) {
  const sonuc = [];
  for (let i = 0; i < liste.length; i += ESZAMAN) {
    sonuc.push(...(await Promise.all(liste.slice(i, i + ESZAMAN).map(isle))));
  }
  return sonuc;
}

function yuzdelik(dizi, p) {
  if (!dizi.length) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

console.log(`Lordlar Çağı — yük testi: ${OYUNCU} oyuncu, ${TUR} tur, ${ESZAMAN} eşzamanlı\n`);

// --- Kayıt ---
const damga = Date.now();
console.log('Oyuncular kaydediliyor...');
const baslangic = performance.now();
async function kaydol(i) {
  // 429 sunucunun hatası değil, kasten konmuş bir sınır. Beklenip yeniden
  // denenir; beş denemede olmuyorsa gerçekten bir sorun var.
  for (let deneme = 0; deneme < 5; deneme++) {
    const v = await istek('POST /auth/register', '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `yuk${damga}_${i}@lordlar.dev`,
        password: 'parola1234',
        lordName: `Yuk${damga.toString(36).slice(-3)}${i}`,
      }),
    });
    if (v?.token) {
      return { i, h: { 'Content-Type': 'application/json', Authorization: `Bearer ${v.token}` } };
    }
    if (v?._durum !== 429) return null;
    // Pencere bir dakika: daha kısa beklemek aynı duvara toslamak demek.
    await new Promise((r) => setTimeout(r, 61000));
  }
  return null;
}

const oyuncular = (await havuz([...Array(OYUNCU).keys()], kaydol)).filter(Boolean);

console.log(
  `  ${oyuncular.length}/${OYUNCU} kayıt oldu — ${((performance.now() - baslangic) / 1000).toFixed(1)} sn\n`,
);

// --- Oyun döngüsü ---
for (let tur = 1; tur <= TUR; tur++) {
  const t = performance.now();
  await havuz(oyuncular, async (o) => {
    const g = (yol) => istek(`GET ${yol}`, yol, { headers: o.h });
    const y = (uc, yol, govde) =>
      istek(`POST ${uc}`, yol, { method: 'POST', headers: o.h, body: JSON.stringify(govde ?? {}) });

    // Okuma ağırlıklı karışım: oyuncu çoğunlukla bakar.
    await g('/me');
    await g('/map');
    await g('/army');
    if (tur % 2 === 0) await g('/rankings/fame?page=0');
    if (tur % 3 === 0) await g('/generals');

    // Yazma: asıl yük burada.
    await y('/army/train', '/army/train', { unitType: 'mizrakci', count: 5 });
    if (tur % 2 === 1) await y('/items/craft', '/items/craft', { tier: 1, slot: 'silah' });
  });
  console.log(`  Tur ${tur} bitti — ${((performance.now() - t) / 1000).toFixed(1)} sn`);
}

// --- Dünya ataması yük altında da doğru mu ---
// "Hepsi tek dünyada" diye bir iddia bu testte kanıtlanamaz: geliştirme
// veritabanında önceki koşulardan kalan lordlar var ve dünya çoktan dolmuş
// olabilir. Shard'ın dolunca yenisini açması zaten tools/shard-testi.mjs'in
// işi. Burada ölçülebilecek olan şu: yük altında her oyuncu bir dünyaya
// atanmış ve kendi dünyasının sıralamasında kendini görebiliyor.
let siralamadaGorunen = 0;
const dunyaBoylari = new Set();
await havuz(oyuncular.slice(0, 30), async (o) => {
  const s = await istek('GET /rankings/fame', '/rankings/fame?page=0', { headers: o.h });
  if (s?.benim) siralamadaGorunen++;
  if (s?.toplam) dunyaBoylari.add(s.toplam);
});

// --- Rapor ---
console.log('\n' + '='.repeat(74));
console.log('UÇ BAŞINA GECİKME (ms)');
console.log('='.repeat(74));
console.log('  uç'.padEnd(34) + 'istek'.padStart(7) + 'p50'.padStart(8) + 'p95'.padStart(8) + 'p99'.padStart(8) + 'max'.padStart(9));
let enKotuP95 = 0;
for (const [uc, o] of [...olcum].sort((a, b) => yuzdelik(b[1].sureler, 95) - yuzdelik(a[1].sureler, 95))) {
  const p95 = yuzdelik(o.sureler, 95);
  enKotuP95 = Math.max(enKotuP95, p95);
  console.log(
    `  ${uc}`.padEnd(34) +
      String(o.sureler.length).padStart(7) +
      yuzdelik(o.sureler, 50).toFixed(0).padStart(8) +
      p95.toFixed(0).padStart(8) +
      yuzdelik(o.sureler, 99).toFixed(0).padStart(8) +
      Math.max(...o.sureler).toFixed(0).padStart(9),
  );
}

console.log('\n' + '='.repeat(74));
let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}
kontrol('Tüm oyuncular kayıt oldu', oyuncular.length === OYUNCU, `${oyuncular.length}/${OYUNCU}`);
kontrol('Sunucu hatası (5xx) yok', toplamHata === 0, hataOrnekleri.join(' | '));
if (toplamKisitlama > 0) {
  console.log(
    `  [NOT]   ${toplamKisitlama} istek hız sınırına takıldı, beklenip tekrarlandı.` +
      ' AUTH_RATE_LIMIT_MAX=1000 ile başlatırsan test hızlanır.',
  );
}
kontrol(
  'Her oyuncu kendi dünyasının sıralamasında görünüyor',
  siralamadaGorunen === 30,
  `30 örnekten ${siralamadaGorunen}'i · dünya boyu ${[...dunyaBoylari].join('/')}`,
);
// 1 sn: oyuncunun "takıldı" demeye başladığı eşik. Bu bir mobil oyun, anlık
// tepki beklentisi yok, ama saniyeyi aşan p95 kabul edilemez.
kontrol('En yavaş ucun p95 değeri 1 sn altında', enKotuP95 < 1000, `${enKotuP95.toFixed(0)} ms`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
