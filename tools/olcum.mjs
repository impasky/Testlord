/**
 * İlk oturum ve medeniyet ölçümünü okunur biçimde yazdırır.
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
 * MEDENİYET KATMANI (docs/16 §10 + §15).
 *
 * Her sayının yanında HEDEFİ yazıyor: ölçüm okuyana "bu iyi mi kötü mü"
 * diye sordurmamalı. Dört eşit taraf %25 eder; ideal sayı tabloda
 * duruyor ki sapma bir bakışta görünsün.
 */
if (o.medeniyet) {
  const m = o.medeniyet;
  const esitPay = m.taraflar.length > 0 ? 1 / m.taraflar.length : null;

  console.log('\nMEDENİYET — TARAFLAR');
  for (const t of m.taraflar) {
    satir(
      t.key,
      `${t.aktifLord} lord`,
      `${t.bolge} bölge · çekirdek toplamı ${t.cekirdekSeviyesi}`,
    );
  }

  console.log('\nMEDENİYET — DÖRT RİSK');
  satir(
    'en kalabalık tarafın payı',
    yuzde(m.nufusDengesizligi.enKalabalikAktifPay),
    `${m.nufusDengesizligi.enKalabalik} · denge ${yuzde(esitPay)}`,
  );
  satir(
    'en geniş tarafın toprak payı',
    yuzde(m.kartopu.enGenisToprakPayi),
    `${m.kartopu.tutulanBolge}/${m.kartopu.toplamBolge} bölge tutuluyor · denge ${yuzde(esitPay)}`,
  );
  // Kartopu freni (docs/16 §10): eşiği geçen medeniyetin toprağından
  // yağma artıyor. Sayının yanında eşiği de yazıyoruz — "bu iyi mi kötü
  // mü" diye sordurmayan ölçüm, okunan ölçümdür.
  satir(
    'kartopu freni',
    m.kartopu.frenAcikMi ? 'AÇIK' : 'kapalı',
    `eşik ${yuzde(m.kartopu.frenEsigi)} · açıkken +${yuzde(m.kartopu.frenYagmaBonusu)} yağma`,
  );
  satir(
    'fayda puanı kazanmış lord',
    yuzde(m.bedavacilik.puanliLordOrani),
    `üst ondalık puanın ${yuzde(m.bedavacilik.ustOndalikPayi)}'ini tutuyor`,
  );
  satir(
    'garnizon tutan lord',
    yuzde(m.garnizonKatilimi.garnizonTutanLordOrani),
    `ortanca ${m.garnizonKatilimi.ortancaBolge ?? 0} bölge`,
  );

  /*
   * Sistemin kendi yanlışlanma ölçütü. "Bölge bölünemez, bölgedeki PAY
   * bölünür" cümlesi ancak paylaşılan bölge varsa doğru; sıfırsa
   * garnizon payı hiç çalışmıyor demektir ve bunu başka hiçbir sayı
   * söylemiyor.
   */
  console.log('\nMEDENİYET — PAY GERÇEKTEN BÖLÜNÜYOR MU');
  satir('garnizonlu bölge', m.garnizonKatilimi.garnizonluBolge);
  satir(
    'iki ve daha çok lordun durduğu',
    m.garnizonKatilimi.paylasilanBolge,
    yuzde(m.garnizonKatilimi.paylasilanBolgeOrani),
  );
  if (m.garnizonKatilimi.paylasilanBolge === 0) {
    console.log('  UYARI: hiçbir bölgede iki lord birden durmuyor — pay bölünmüyor.');
  }
}
console.log();
