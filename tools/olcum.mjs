/**
 * İlk oturum ölçümünü okunur biçimde yazdırır.
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

console.log('\nERTESİ GÜN GERİ DÖNÜŞ');
if (o.ertesiGunDonus.olgunLordSayisi === 0) {
  console.log('  Henüz 24 saati dolmuş oyuncu yok.');
} else {
  satir(
    'geri dönen',
    `${o.ertesiGunDonus.donen}/${o.ertesiGunDonus.olgunLordSayisi}`,
    yuzde(o.ertesiGunDonus.oran),
  );
}
console.log();
