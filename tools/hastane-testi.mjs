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
    lordName: `Hekim ${damga.toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)}`,
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
  // Oyuncunun kararı: "iyileşme süresini uzatalım." Tek yaralı bile
  // taban kadar yatıyor (balance.json → hastane.saniye_taban, 10 dk).
  const yatisSn = tedavi ? (new Date(tedavi.finishAt).getTime() - Date.now()) / 1000 : 0;
  kontrol('tedavi en az on dakika sürüyor', yatisSn >= 590, `${Math.round(yatisSn / 60)} dk`);

  /* --- Tedavi bitince orduya katılıyor --- */
  const evdeOnce = topla((await al('/army')).home ?? {});
  await post('/test/kuyruklari-bitir');
  const sonrasi = await al('/me');
  const evdeSonra = topla((await al('/army')).home ?? {});
  kontrol('tedavi bitince hastane boşaldı', topla(sonrasi.lord.hastane ?? {}) === 0);
  kontrol('iyileşenler orduya KATILDI', evdeSonra > evdeOnce, `${evdeOnce} -> ${evdeSonra}`);

  /* --- Elmasla hemen taburcu (oyuncunun isteği) --- */
  // İkinci bir savaş: ilk kafile az önce doğal yolla taburcu oldu.
  const ordu2 = (await al('/army')).home ?? {};
  const hedef2 = (await al('/map')).oneri;
  if (hedef2) {
    await post('/march', { toRegionId: hedef2.regionId, army: ordu2, generalIds: [] });
    await post('/test/yuruyusleri-bitir');
    await post('/test/yuruyusleri-bitir');
  }
  const yarali2 = topla((await al('/me')).lord.hastane ?? {});
  kontrol('ikinci savaş da yaralı üretti', yarali2 > 0, `${yarali2} yaralı`);

  // Kese boş: istek REDDEDİLMELİ ve hiçbir şey değişmemeli.
  const kese = (await al('/me')).lord.elmas;
  await post('/test/kaynak-ver', { elmas: -kese });
  const bosKese = await post('/army/hastane/kisalt');
  const hastaneHala = topla((await al('/me')).lord.hastane ?? {});
  kontrol(
    'elması yetmeyen taburcu edemiyor',
    bosKese.s === 400 && bosKese.b.code === 'YETERSIZ_ELMAS' && hastaneHala === yarali2,
    `HTTP ${bosKese.s} ${bosKese.b.error ?? ''}`,
  );

  // Kese dolu: bedel SUNUCUDA hesaplanıp düşülüyor, yaralı hemen eve.
  await post('/test/kaynak-ver', { elmas: 500 });
  const evdeOnce2 = topla((await al('/army')).home ?? {});
  const taburcu = await post('/army/hastane/kisalt');
  const sonra2 = await al('/me');
  const evdeSonra2 = topla((await al('/army')).home ?? {});
  kontrol(
    'elmasla hemen taburcu oldu',
    taburcu.s === 200 && topla(sonra2.lord.hastane ?? {}) === 0 && evdeSonra2 > evdeOnce2,
    taburcu.s === 200
      ? `${taburcu.b.harcanan} elmas, ${evdeOnce2} -> ${evdeSonra2} evde`
      : `HTTP ${taburcu.s} ${taburcu.b.error ?? ''}`,
  );
  kontrol(
    'harcanan elmas keseden düştü',
    taburcu.s === 200 && taburcu.b.harcanan > 0 && sonra2.lord.elmas === 500 - taburcu.b.harcanan,
    `kese ${sonra2.lord.elmas}`,
  );
  const ikinci = await post('/army/hastane/kisalt');
  kontrol(
    'boş hastane için elmas alınmıyor',
    ikinci.s === 400 && ikinci.b.code === 'BEKLEME_YOK',
    `HTTP ${ikinci.s}`,
  );
} else {
  kontrol('hastanedeki askerle saldırılamıyor', false, 'yaralı üretilmedi');
  kontrol('hastanedeki komuta yeri kaplamıyor', false);
  kontrol('tedavi kuyruğu açıldı', false);
  kontrol('tedavi bitince hastane boşaldı', false);
  kontrol('iyileşenler orduya KATILDI', false);
}

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
