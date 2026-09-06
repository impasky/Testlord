/**
 * Savaş öncesi düzenin API tarafını uçtan uca sınar.
 *
 * Buradaki asıl soru "kod çalışıyor mu" değil, "karar SONUCU DEĞİŞTİRİYOR
 * mu": dizilim ekranı oyuncuya bir şey vaat ediyor ve o vaat sunucuda
 * karşılanmazsa özellik yalan söylüyor demektir. O yüzden her kontrol
 * aynı orduyu iki farklı düzenle gönderip FARKI ölçüyor.
 *
 * API ayakta olmalı. node tools/duzen-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — savaş düzeni testi\n');

const damga = Date.now();
const kayit = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `duzen${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Duzen ${damga.toString(36).slice(-4)}`,
  }),
}).then((r) => r.json());
const jeton = kayit.token;
const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
const gonder = (y, g = {}, yontem = 'POST') =>
  fetch(`${API}/api${y}`, { method: yontem, headers: bas, body: JSON.stringify(g) }).then(
    async (r) => ({ durum: r.status, govde: await r.json().catch(() => ({})) }),
  );

/** 16 karelik dizilim kur: { kareNo: birim } (kare no 1 tabanlı). */
function diz(kareler) {
  const d = Array(16).fill(null);
  for (const [no, t] of Object.entries(kareler)) d[Number(no) - 1] = t;
  return d;
}

/* --- Ordu hazırla --- */
await gonder('/test/kaynak-ver', { altin: 400000, demir: 200000, erzak: 200000 });
await gonder('/army/train', { unitType: 'mizrakci', count: 60 });
await gonder('/army/train', { unitType: 'okcu', count: 40 });
await gonder('/army/train', { unitType: 'kusatma', count: 6 });
await gonder('/test/kuyruklari-bitir');
const ordu = (await al('/army')).home ?? {};
kontrol('ordu kuruldu', (ordu.mizrakci ?? 0) > 0 && (ordu.kusatma ?? 0) > 0, JSON.stringify(ordu));

const oneri = (await al('/map')).oneri;
kontrol('saldırılacak hedef var', Boolean(oneri?.regionId), oneri?.name ?? '');

/* --- 1. Dizilim önizlemeyi değiştiriyor mu --- */
const iyi = diz({ 1: 'mizrakci', 2: 'mizrakci', 9: 'okcu', 10: 'okcu', 14: 'kusatma' });
const kotu = diz({ 1: 'kusatma', 2: 'okcu', 13: 'mizrakci' });

async function onizle(duzen) {
  const y = await gonder('/battle/preview', {
    toRegionId: oneri.regionId,
    army: ordu,
    generalIds: [],
    duzen,
  });
  return y.govde;
}

const oIyi = await onizle({ dizilim: iyi, taktik: null });
const oKotu = await onizle({ dizilim: kotu, taktik: null });
// Önizleme dokuz savaş çalıştırıp dağılım veriyor; karşılaştırılacak
// sayı kazanma oranı. Kayıp da bakılıyor: oran tavana dayandığında
// (ikisi de %100 kazanıyor) dizilim farkı kayıpta görünüyor.
const oranIyi = oIyi?.tahmin?.kazanmaOrani ?? 0;
const oranKotu = oKotu?.tahmin?.kazanmaOrani ?? 0;
const topla = (o) => Object.values(o ?? {}).reduce((s, n) => s + (n ?? 0), 0);
const kayipIyi = topla(oIyi?.tahmin?.saldiranKayip);
const kayipKotu = topla(oKotu?.tahmin?.saldiranKayip);
kontrol(
  'iyi dizilim önizlemede kötüden iyi',
  oranIyi > oranKotu || (oranIyi === oranKotu && kayipIyi < kayipKotu),
  `oran ${oranIyi} vs ${oranKotu} · kayıp ${kayipIyi} vs ${kayipKotu}`,
);

/* --- 2. Geçersiz dizilim reddediliyor mu --- */
const kisa = await gonder('/battle/preview', {
  toRegionId: oneri.regionId,
  army: ordu,
  generalIds: [],
  duzen: { dizilim: Array(9).fill(null), taktik: null },
});
kontrol('16 kare olmayan dizilim reddedildi', kisa.durum >= 400, `HTTP ${kisa.durum}`);

/* --- 3. Savunma düzeni kaydedilip okunuyor mu --- */
const once = await al('/me/savunma-duzeni');
kontrol(
  'savunma düzeni varsayılanla geliyor',
  once.kayitli === false && Array.isArray(once.dizilim),
);
kontrol(
  'taktik listesi uygunluk bilgisiyle geliyor',
  Array.isArray(once.taktikler) && once.taktikler.length > 0,
);
const temkinli = (once.taktikler ?? []).find((t) => t.key === 'temkinli_ilerleyis');
kontrol('koşulsuz taktik her zaman uygun', temkinli?.uygun === true);
const kilitli = (once.taktikler ?? []).find((t) => t.uygun === false);
kontrol(
  'kilitli taktik sebebini yazıyor',
  !kilitli || (kilitli.engel ?? '').length > 10,
  kilitli?.engel ?? 'kilitli taktik yok',
);

const kaydet = await gonder('/me/savunma-duzeni', { dizilim: iyi, taktik: 'kalkan_duvari' }, 'PUT');
kontrol('savunma düzeni kaydedildi', kaydet.durum === 200);
const sonra = await al('/me/savunma-duzeni');
kontrol('kayıt geri okunuyor', sonra.kayitli === true && sonra.taktik === 'kalkan_duvari');
kontrol('kaydedilen dizilim aynen dönüyor', JSON.stringify(sonra.dizilim) === JSON.stringify(iyi));

/* --- 4. Saldırı düzeni yürüyüşte donuyor ve rapora yansıyor --- */
const saldiri = await gonder('/march', {
  toRegionId: oneri.regionId,
  army: ordu,
  generalIds: [],
  duzen: { dizilim: kotu, taktik: null },
});
kontrol('düzenli saldırı kabul edildi', saldiri.durum === 200, `HTTP ${saldiri.durum}`);
await gonder('/test/yuruyusleri-bitir');

const savaslar = await al('/battles');
kontrol(
  'savaş kaydı oluştu',
  Array.isArray(savaslar) && savaslar.length > 0,
  `${savaslar?.length ?? 0} kayıt`,
);

const son = Array.isArray(savaslar) ? savaslar[0] : null;
const satirlar = son?.log?.duzenRaporu?.saldiran ?? son?.duzenRaporu?.saldiran ?? [];
kontrol('rapor düzen satırları taşıyor', satirlar.length > 0, satirlar[0] ?? 'boş');
kontrol(
  'ön hattaki mancınığın cezası raporda yazılı',
  satirlar.some((s) => s.includes('Mancınık')),
  satirlar.join(' | ').slice(0, 140),
);

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
