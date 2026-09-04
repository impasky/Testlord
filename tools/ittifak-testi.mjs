/**
 * İttifak testi (docs/09 B1).
 *
 * İttifakın tek zorunlu kuralı "birbirine saldıramamak" ve tek başına
 * değerli olan şey o: sırtını dönebileceğin bir sınır. Testin çekirdeği
 * bu — kurulan ittifak GERÇEKTEN saldırıyı engelliyor mu.
 *
 * İkinci çekirdek: ittifaktan çıkıp hemen başkasına girmek yasak. Olmasaydı
 * saldırı kilidi kalkan gibi kullanılırdı — saldırıya uğrayan oyuncu
 * saldırganın ittifakına girip korunur, tehlike geçince çıkardı.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/ittifak-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `itt${damga}_${etiket}@lordlar.dev`,
      password: 'parola1234',
      lordName: `Itt${damga.toString(36).slice(-3)}${etiket}`,
    }),
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    etiket,
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

async function orduKur(l) {
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
  await l.post('/test/xp-ver', { miktar: 200000 });
  const p = (await l.get('/me')).lord.statPoints;
  if (p > 0) await l.post('/me/stats', { liderlik: p });
  await l.post('/army/train', { unitType: 'mizrakci', count: 300 });
  await l.post('/army/train', { unitType: 'okcu', count: 200 });
  await l.post('/test/kuyruklari-bitir');
}

/** Öneri motorunun dediğini yaparak bir bölge alır. */
async function bolgeAl(l) {
  for (let i = 0; i < 8; i++) {
    const oneri = (await l.get('/map')).oneri;
    if (!oneri) return null;
    if (oneri.eksik?.adet > 0) {
      await l.post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
      await l.post('/test/kuyruklari-bitir');
    }
    const ordu = (await l.get('/army')).home;
    if (Object.keys(ordu).length === 0) return null;
    await l.post('/march', { toRegionId: oneri.regionId, army: ordu });
    await l.post('/test/yuruyusleri-bitir');
    await l.post('/test/yuruyusleri-bitir');
    const benim = (await l.get('/map')).regions.find((r) => r.isMine && r.type !== 'taht');
    if (benim) return benim;
  }
  return null;
}

console.log('Lordlar Çağı — ittifak testi\n');

const a = await lordKur('a');
const b = await lordKur('b');
const c = await lordKur('c');
await a.post('/test/bolgeleri-sifirla');

const bosluk = await a.get('/ittifak');
kontrol('Başlangıçta ittifak yok', bosluk.ittifakim === null);
kontrol('Kurma maliyeti söyleniyor', bosluk.kurmaMaliyeti > 0, `${bosluk.kurmaMaliyeti} altın`);

const fakir = await a.post('/ittifak/kur', { ad: 'Kartal Sancağı', etiket: 'KRT' });
kontrol('Altın yetmezse ittifak kurulamıyor', fakir?.code === 'YETERSIZ_KAYNAK',
  fakir?.code ?? 'kuruldu');

await a.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
const kisa = await a.post('/ittifak/kur', { ad: 'ab', etiket: 'KRT' });
kontrol('Çok kısa ad reddediliyor', kisa?.code === 'AD_UYGUNSUZ', kisa?.code ?? 'kuruldu');

const kotuEtiket = await a.post('/ittifak/kur', { ad: 'Kartal Sancağı', etiket: 'K R' });
kontrol('Boşluklu etiket reddediliyor', kotuEtiket?.code === 'AD_UYGUNSUZ',
  kotuEtiket?.code ?? 'kuruldu');

const kuruldu = await a.post('/ittifak/kur', { ad: `Kartal ${damga % 1000}`, etiket: `K${damga % 100}` });
kontrol('İttifak kuruldu', Boolean(kuruldu?.id), kuruldu?.ad ?? kuruldu?.code);

const durum = await a.get('/ittifak');
kontrol('Kurucu kendi ittifakının üyesi', durum.ittifakim?.uyeler?.length === 1,
  `${durum.ittifakim?.uyeler?.length} üye`);
kontrol('Kurucu lider', durum.ittifakim?.liderId === durum.ittifakim?.uyeler?.[0]?.id);

const ikinciKurma = await a.post('/ittifak/kur', { ad: `Baska ${damga % 1000}`, etiket: `B${damga % 100}` });
kontrol('İki ittifakta birden olunamıyor', ikinciKurma?.code === 'ZATEN_ITTIFAKTA',
  ikinciKurma?.code ?? 'kuruldu');

// b'nin altını olmadan denemek YETERSIZ_KAYNAK ile dönerdi ve asıl
// kuralı (ad çakışması) hiç sınamazdı.
await b.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
const ayniAd = await b.post('/ittifak/kur', {
  ad: `Kartal ${damga % 1000}`,
  etiket: `X${damga % 100}`,
});
kontrol('Aynı ad ikinci kez alınamıyor', ayniAd?.code === 'AD_ALINMIS', ayniAd?.code ?? 'kuruldu');

const ayniEtiket = await b.post('/ittifak/kur', {
  ad: `Baska ${damga % 1000}`,
  etiket: `K${damga % 100}`,
});
kontrol('Aynı etiket ikinci kez alınamıyor', ayniEtiket?.code === 'AD_ALINMIS',
  ayniEtiket?.code ?? 'kuruldu');

// --- b katılıyor
const katildi = await b.post(`/ittifak/${kuruldu.id}/katil`);
kontrol('İkinci lord ittifaka katıldı', Boolean(katildi?.katildi), katildi?.ad ?? katildi?.code);
const ikiKisi = await a.get('/ittifak');
kontrol('Üye listesi ikiye çıktı', ikiKisi.ittifakim?.uyeler?.length === 2,
  `${ikiKisi.ittifakim?.uyeler?.length} üye`);
const liderOlaylari = (await a.get('/me')).events;
kontrol('Lider katılımdan haberdar',
  liderOlaylari.some((e) => e.kind === 'ittifak_katilim'),
  liderOlaylari[0]?.payload?.mesaj ?? 'olay yok');

// --- Sohbet (docs/09 B3)
const bosSohbet = await a.get('/ittifak/sohbet');
kontrol('Sohbet açılıyor', Array.isArray(bosSohbet?.mesajlar), `${bosSohbet?.mesajlar?.length} mesaj`);

const yazildi = await a.post('/ittifak/sohbet', { metin: 'Kaleye birlikte gidelim' });
kontrol('Mesaj yazılabiliyor', Boolean(yazildi?.id), yazildi?.code ?? 'yazıldı');

const okundu = await b.get('/ittifak/sohbet');
kontrol(
  'Diğer üye mesajı görüyor',
  okundu?.mesajlar?.some((m) => m.metin === 'Kaleye birlikte gidelim'),
  `${okundu?.mesajlar?.length} mesaj`,
);

// Kapali grup: uye olmayan okuyamamali. Sohbetin butun tasarim gerekcesi
// bu -- kapali bir gruba yazmak herkese acik bir kanala yazmaktan baska
// bir sorumluluk.
const disaridanOkuma = await c.get('/ittifak/sohbet');
kontrol('Üye olmayan sohbeti okuyamıyor', disaridanOkuma?.code === 'ITTIFAK_YOK',
  disaridanOkuma?.code ?? `${disaridanOkuma?.mesajlar?.length} mesaj okundu`);
const disaridanYazma = await c.post('/ittifak/sohbet', { metin: 'merhaba' });
kontrol('Üye olmayan sohbete yazamıyor', disaridanYazma?.code === 'ITTIFAK_YOK',
  disaridanYazma?.code ?? 'yazdı');

const hizli = await a.post('/ittifak/sohbet', { metin: 'ikinci mesaj' });
kontrol('Spam freni çalışıyor', hizli?.code === 'COK_HIZLI', hizli?.code ?? 'yazıldı');

const kufur = await b.post('/ittifak/sohbet', { metin: 'siktir git' });
kontrol('Uygunsuz mesaj reddediliyor', kufur?.code === 'MESAJ_UYGUNSUZ', kufur?.code ?? 'yazıldı');

// Suzgec MASUM kelimeyi elememeli: "sikisik" normalize edilince yasakli
// bir parca iceriyor ama kelime olarak yasakli degil. Ad denetiminin
// parca aramasini bir cumleye uygulamak tam da bunu bozardi.
const masum = await b.post('/ittifak/sohbet', { metin: 'burasi cok sikisik, yer yok' });
kontrol('Masum kelime elenmiyor', Boolean(masum?.id), masum?.code ?? 'yazıldı');

// --- ÇEKİRDEK: ittifak üyesine saldırılamaz
await orduKur(b);
const bolge = await bolgeAl(b);
kontrol('İttifak üyesi bir bölge aldı', Boolean(bolge), bolge?.name ?? 'alınamadı');

await orduKur(a);
await a.post('/test/kalkanlari-kaldir');
const orduA = (await a.get('/army')).home;
const engel = await a.post('/march', { toRegionId: bolge.id, army: orduA });
kontrol('İTTİFAK ÜYESİNE SALDIRILAMIYOR', engel?.code === 'ITTIFAK_UYESI',
  engel?.code ?? `yürüyüş kabul edildi (${engel?.marchId ?? '?'})`);

// --- Üçüncü lord ittifakta değil: ona saldırı serbest olmalı
const disaridan = await c.post('/test/kaynak-ver', { altin: 1000, demir: 0, erzak: 0 });
void disaridan;
await c.post('/test/kalkanlari-kaldir');
const cDurum = await c.get('/ittifak');
kontrol('Üçüncü lord ittifaksız', cDurum.ittifakim === null);

// --- Ortak hedef (docs/09 B1b)
const hedefsiz = (await a.get('/ittifak')).ittifakim?.hedef;
kontrol('Başlangıçta ortak hedef yok', hedefsiz === null, JSON.stringify(hedefsiz));

const sahipsizBolge = (await a.get('/map')).regions.find((r) => !r.owner && r.type !== 'taht');
const isaret = await a.post('/ittifak/hedef', { regionId: sahipsizBolge.id, not: 'cuma akşamı' });
kontrol('Lider ortak hedef işaretleyebiliyor', Boolean(isaret?.hedef?.regionId),
  isaret?.hedef?.ad ?? isaret?.code);

const hedefli = (await a.get('/ittifak')).ittifakim?.hedef;
kontrol('Hedef ittifak özetinde görünüyor', hedefli?.regionId === sahipsizBolge.id,
  `${hedefli?.ad} — ${hedefli?.not}`);

// Cekirdek: hedef HARITADA gorunmeli. Ittifak ekraninda duran bir hedef,
// oyuncunun saldiriya karar verdigi yerde yok demektir.
const uyeHaritasi = await b.get('/map');
kontrol('Hedef ÜYENİN haritasında işaretli',
  uyeHaritasi.ittifakHedefi?.regionId === sahipsizBolge.id,
  JSON.stringify(uyeHaritasi.ittifakHedefi));
kontrol('Haritadaki hedef notu taşıyor', uyeHaritasi.ittifakHedefi?.not === 'cuma akşamı',
  uyeHaritasi.ittifakHedefi?.not ?? '-');

const uyeOlaylari = (await b.get('/me')).events;
kontrol('Üyeler hedeften haberdar ediliyor',
  uyeOlaylari.some((e) => e.kind === 'ittifak_hedef'),
  uyeOlaylari.find((e) => e.kind === 'ittifak_hedef')?.payload?.mesaj ?? 'olay yok');

const uyeIsaret = await b.post('/ittifak/hedef', { regionId: sahipsizBolge.id });
kontrol('Üye hedef işaretleyemiyor', uyeIsaret?.code === 'YETKISIZ', uyeIsaret?.code ?? 'işaretledi');

const disHarita = await c.get('/map');
kontrol('İttifaksız oyuncu hedefi görmüyor', disHarita.ittifakHedefi === null,
  JSON.stringify(disHarita.ittifakHedefi));

// --- Ayrılınca saldırı açılıyor ama bekleme başlıyor
const ayrildi = await b.post('/ittifak/ayril');
kontrol('İttifaktan ayrılınabiliyor', ayrildi?.ayrildi === true, JSON.stringify(ayrildi));

const sonrakiEngel = await a.post('/march', { toRegionId: bolge.id, army: orduA });
kontrol('Ayrıldıktan sonra saldırı açılıyor',
  sonrakiEngel?.code !== 'ITTIFAK_UYESI',
  sonrakiEngel?.code ?? 'yürüyüş kabul edildi');

const hemenKatil = await b.post(`/ittifak/${kuruldu.id}/katil`);
kontrol('Ayrıldıktan HEMEN sonra yeni ittifaka girilemiyor',
  hemenKatil?.code === 'ITTIFAK_BEKLEME', hemenKatil?.code ?? 'katıldı');

const bekleyen = await b.get('/ittifak');
kontrol('Bekleme süresi arayüze söyleniyor', bekleyen.bekleme?.kalanSn > 0,
  `${bekleyen.bekleme?.kalanSn} sn`);

// --- Lider ayrılınca ittifak dağılmıyor, liderlik devrediliyor
const d = await lordKur('d');
await d.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
await d.post(`/ittifak/${kuruldu.id}/katil`);
const aAyrildi = await a.post('/ittifak/ayril');
kontrol('Lider ayrılınca ittifak dağılmıyor', aAyrildi?.dagildi === false, JSON.stringify(aAyrildi));
const yeniDurum = await d.get('/ittifak');
const yeniLider = yeniDurum.ittifakim?.uyeler?.find((u) => u.lider);
kontrol('Liderlik kalan üyeye geçti', yeniLider?.id === yeniDurum.ittifakim?.liderId,
  yeniDurum.ittifakim?.uyeler?.map((u) => `${u.ad}${u.lider ? '*' : ''}`).join(', '));
kontrol('Lider listenin başında', yeniDurum.ittifakim?.uyeler?.[0]?.lider === true,
  yeniDurum.ittifakim?.uyeler?.[0]?.ad ?? '-');

// --- Tek üye ayrılınca ittifak siliniyor
const sonAyrilma = await d.post('/ittifak/ayril');
kontrol('Son üye ayrılınca ittifak dağılıyor', sonAyrilma?.dagildi === true,
  JSON.stringify(sonAyrilma));
const kalanListe = await c.get('/ittifak');
kontrol('Dağılan ittifak listede yok',
  !kalanListe.liste.some((x) => x.id === kuruldu.id),
  `${kalanListe.liste.length} ittifak`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
