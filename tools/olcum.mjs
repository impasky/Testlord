/**
 * İlk oturum ve ülke ölçümünü okunur biçimde yazdırır.
 *
 * Bugüne kadarki bütün analizler tahmindi ve ilk gerçek oyuncu testi
 * hepsini yanlışladı. Bu dört sayı olmadan bir sonraki iyileştirme de
 * tahmin olur. (docs/08 İ7)
 *
 *   API_URL=https://... OLCUM_ANAHTARI=... node tools/olcum.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const ANAHTAR = process.env.OLCUM_ANAHTARI;

if (!ANAHTAR) {
  console.error('OLCUM_ANAHTARI gerekli. Sunucudaki değerle aynı olmalı.');
  process.exit(1);
}

const res = await fetch(`${API}/api/olcum?anahtar=${encodeURIComponent(ANAHTAR)}`);
if (!res.ok) {
  console.error(`Ölçüm alınamadı: HTTP ${res.status}`);
  if (res.status === 404) console.error('Sunucuda OLCUM_ANAHTARI tanımlı mı?');
  process.exit(1);
}
const o = await res.json();

const yuzde = (x) => (x === null || x === undefined ? '—' : `%${Math.round(x * 100)}`);
const sure = (sn) => {
  if (sn === null || sn === undefined) return '—';
  if (sn < 60) return `${sn} sn`;
  return `${Math.floor(sn / 60)} dk ${sn % 60} sn`;
};
const satir = (ad, deger, not = '') =>
  console.log(`  ${ad.padEnd(34)} ${String(deger).padStart(10)}${not ? `   ${not}` : ''}`);

console.log(`\nLordlar Çağı — ilk oturum ölçümü (${o.lordSayisi} lord)\n`);

console.log('İLK SAVAŞA KADAR');
satir('ortanca süre', sure(o.ilkSavasaKadar.ortancaSaniye), 'hedef: 6 dk altı');
satir('6 dakikanın altında kalan', yuzde(o.ilkSavasaKadar.altiDakikaAltiOran));
satir(
  `ilk ${o.ilkOturumPenceresiDk} dk içinde savaşan`,
  yuzde(o.ilkSavasaKadar.ilkOturumdaSavasanOran),
  'asıl ölçüt',
);
satir('hiç savaşmamış', o.ilkSavasaKadar.hicSavasmayan, 'kayıt olup çıkanlar');

console.log('\nİLK OTURUMDAKİ EYLEM');
satir('ortanca eylem sayısı', o.ilkOturumEylemi.ortanca ?? '—');
satir('hiç eylem yapmayan', o.ilkOturumEylemi.hicEylemYapmayan);

console.log('\nOYUNUN BIRAKILDIĞI EKRAN');
const toplam = Object.values(o.birakilanEkran).reduce((a, b) => a + b, 0) || 1;
for (const [ekran, adet] of Object.entries(o.birakilanEkran)) {
  satir(ekran, adet, yuzde(adet / toplam));
}

console.log('\nTUTUNDURMA');
/*
 * İKİ EŞİK. Ertesi gün İLK OTURUMUN sınavı; yedinci gün OYUNUN.
 * docs/07 ikincisini başarı kriterlerinin en önemlisi diye işaretlemişti
 * ve uzun süre yalnız birincisi ölçülüyordu.
 */
for (const [ad, d] of [
  ['ertesi gün dönen', o.ertesiGunDonus],
  ['7. gün dönen', o.yedinciGunDonus],
]) {
  if (!d || d.olgunLordSayisi === 0) {
    satir(ad, '—', 'yeterince olgun hesap yok');
  } else {
    satir(ad, `${d.donen}/${d.olgunLordSayisi}`, yuzde(d.oran));
  }
}

/*
 * ÜLKELER (docs/27).
 *
 * Herkes kendi adına oynuyor; ülke bir başlangıç yeri. Burada izlenen
 * iki şey var: oyuncular birkaç ülkeye mi yığılıyor, ve garnizon payı
 * gerçekten bölünüyor mu.
 */
if (o.ulke) {
  const u = o.ulke;

  console.log('\nÜLKELER — EN KALABALIK ON');
  for (const t of u.ulkeler) satir(t.kod, `${t.aktifLord} aktif`, `${t.lord} lord`);
  satir('ülkesi olan', `${u.ulkeSayisi} ülke`, `${u.ulkesizLord} lord henüz seçmedi`);
  satir('en kalabalık ülkenin aktif payı', yuzde(u.enKalabalikAktifPay));
  satir(
    'tutulan toprak',
    yuzde(u.toprak.tutulanPay),
    `${u.toprak.tutulanBolge}/${u.toprak.toplamBolge} bölge`,
  );
  satir(
    'garnizon tutan lord',
    yuzde(u.garnizonKatilimi.garnizonTutanLordOrani),
    `ortanca ${u.garnizonKatilimi.ortancaBolge ?? 0} bölge`,
  );

  /*
   * Sistemin kendi yanlışlanma ölçütü. "Bölge bölünemez, bölgedeki PAY
   * bölünür" cümlesi ancak paylaşılan bölge varsa doğru; sıfırsa
   * garnizon payı hiç çalışmıyor demektir ve bunu başka hiçbir sayı
   * söylemiyor.
   */
  console.log('\nPAY GERÇEKTEN BÖLÜNÜYOR MU');
  satir('garnizonlu bölge', u.garnizonKatilimi.garnizonluBolge);
  satir(
    'iki ve daha çok lordun durduğu',
    u.garnizonKatilimi.paylasilanBolge,
    yuzde(u.garnizonKatilimi.paylasilanBolgeOrani),
  );
  if (u.garnizonKatilimi.paylasilanBolge === 0) {
    console.log('  UYARI: hiçbir bölgede iki lord birden durmuyor — pay bölünmüyor.');
  }
}
console.log();
