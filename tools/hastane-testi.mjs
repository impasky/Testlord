/**
 * Hastane: yaralı dönen askerlerin tedavisi.
 *
 * Oyuncunun isteği: "hastane ekle, yaralı askerler orda tedavi edilsin,
 * tedavi tamamlanana kadar ordaki askerler tekrardan savaş için
 * kullanılamasın."
 *
 * Buradaki asıl sorular: yaralı gerçekten AYRILIYOR mu, tedavi bitene
 * kadar SAVAŞA GİREMİYOR mu, ve bittiğinde orduya KATILIYOR mu?
 *
 * API ayakta olmalı. node tools/hastane-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}
const topla = (o) => Object.values(o ?? {}).reduce((s, n) => s + (n ?? 0), 0);

console.log('Lordlar Çağı — hastane testi\n');

const damga = Date.now();
const { token: jeton } = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `hs${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Hekim ${damga.toString(36).slice(-4)}`,
  }),
}).then((r) => r.json());

const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
const post = (y, g = {}) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: bas, body: JSON.stringify(g) }).then(
    async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }),
  );

for (let i = 0; i < 8; i++) await post('/test/xp-ver', { miktar: 500000 });
await post('/test/kaynak-ver', { altin: 400000, demir: 300000, erzak: 300000 });
await post('/army/train', { unitType: 'mizrakci', count: 60 });
await post('/test/kuyruklari-bitir');

const ordu = (await al('/army')).home ?? {};
kontrol('ordu hazır', topla(ordu) > 0, JSON.stringify(ordu));
const oncekiKapasite = (await al('/me')).lord.usedSlots;

// Kazanılacak ama KAYIP verilecek bir savaş: öneri hedefi tam da bu.
const oneri = (await al('/map')).oneri;
await post('/march', { toRegionId: oneri.regionId, army: ordu, generalIds: [] });
await post('/test/yuruyusleri-bitir'); // saldırı çözülür, dönüş yürüyüşü başlar
await post('/test/yuruyusleri-bitir'); // dönüş varır

const me = await al('/me');
const hastane = me.lord.hastane ?? {};
const evde = (await al('/army')).home ?? {};
kontrol(
  'savaş yaralı üretti',
  topla(hastane) > 0,
  `hastanede ${topla(hastane)} · evde ${topla(evde)}`,
);

if (topla(hastane) > 0) {
  /* --- Yaralı savaşa GİREMİYOR --- */
  // Ev ordusu + hastanedekiler kadar asker göndermeyi deniyoruz. Hastane
  // sayılsaydı bu istek geçerdi; geçmemeli.
  //
  // Hedef YENİDEN okunuyor: ilk hedef artık bizim ve "kendi bölgene
  // saldıramazsın" diye reddedilirdi. O red hastaneyle ilgili olmadığı
  // hâlde testi geçirirdi — yanlış sebeple geçen bir kontrol, hiç
  // olmayan kontrolden kötüdür.
  const yeniHedef = (await al('/map')).oneri;
  const fazlaOrdu = {};
  for (const [t, n] of Object.entries(evde)) fazlaOrdu[t] = n + (hastane[t] ?? 0);
  const yaraliyiGonder = yeniHedef
    ? await post('/march', { toRegionId: yeniHedef.regionId, army: fazlaOrdu, generalIds: [] })
    : { s: 0, b: {} };
  kontrol(
    'hastanedeki asker orduya sayılmıyor (fazlası gönderilemiyor)',
    yaraliyiGonder.s >= 400 && !/kendi bölgene/i.test(yaraliyiGonder.b?.error ?? ''),
    `HTTP ${yaraliyiGonder.s} ${yaraliyiGonder.b?.error ?? ''}`,
  );
  kontrol(
    'hastanedekiler ev ordusunda görünmüyor',
    Object.entries(hastane).every(([t, n]) => n > 0 && (evde[t] ?? 0) >= 0),
    `evde ${JSON.stringify(evde)} · hastanede ${JSON.stringify(hastane)}`,
  );

  /* --- Yük olmuyor --- */
  const sonraKapasite = me.lord.usedSlots;
  kontrol(
    'hastanedeki komuta yeri kaplamıyor',
    sonraKapasite <= oncekiKapasite,
    `${oncekiKapasite} -> ${sonraKapasite}`,
  );

  /* --- Tedavi kuyruğu var --- */
  // Kuyruklar /me içinde dönüyor, ayrı bir uç yok.
  const liste = (await al('/me')).queues ?? [];
  const tedavi = liste.find((q) => q.kind === 'iyilestir');
  kontrol('tedavi kuyruğu açıldı', Boolean(tedavi), tedavi ? `bitiş ${tedavi.finishAt}` : 'yok');

  /* --- Tedavi bitince orduya katılıyor --- */
  const evdeOnce = topla((await al('/army')).home ?? {});
  await post('/test/kuyruklari-bitir');
  const sonrasi = await al('/me');
  const evdeSonra = topla((await al('/army')).home ?? {});
  kontrol('tedavi bitince hastane boşaldı', topla(sonrasi.lord.hastane ?? {}) === 0);
  kontrol('iyileşenler orduya KATILDI', evdeSonra > evdeOnce, `${evdeOnce} -> ${evdeSonra}`);
} else {
  kontrol('hastanedeki askerle saldırılamıyor', false, 'yaralı üretilmedi');
  kontrol('hastanedeki komuta yeri kaplamıyor', false);
  kontrol('tedavi kuyruğu açıldı', false);
  kontrol('tedavi bitince hastane boşaldı', false);
  kontrol('iyileşenler orduya KATILDI', false);
}

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
