/**
 * Saldırmazlık paktı testi (docs/09 B1d).
 *
 * Testin çekirdeği tek cümle: pakt GERÇEKTEN saldırıyı engelliyor mu, ve
 * fesih ANINDA geçerli olmuyor mu.
 *
 * İkincisi daha ince ve daha önemli: fesih anında geçseydi pakt bir
 * kalkana dönerdi — zayıfken paktla, saldıracağın gün feshet, aynı saat
 * saldır. İhbar süresi boyunca paktın HÂLÂ koruduğunu burada kilitliyoruz.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/pakt-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `pakt${damga}_${etiket}@lordlar.dev`,
    lordName: `Pkt${damga.toString(36).slice(-3)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    etiket,
    post: (y, g) =>
      fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
        (x) => x.json(),
      ),
    get: (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json()),
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
    const o = (await l.get('/map')).oneri;
    if (!o) return null;
    if (o.eksik?.adet > 0) {
      await l.post('/army/train', { unitType: o.eksik.birim, count: o.eksik.adet });
      await l.post('/test/kuyruklari-bitir');
    }
    const ordu = (await l.get('/army')).home;
    if (Object.keys(ordu).length === 0) return null;
    await l.post('/march', { toRegionId: o.regionId, army: ordu });
    await l.post('/test/yuruyusleri-bitir');
    await l.post('/test/yuruyusleri-bitir');
    const benim = (await l.get('/map')).regions.find((r) => r.isMine && r.type !== 'taht');
    if (benim) return benim;
  }
  return null;
}

console.log('Lordlar Çağı — pakt testi\n');

// a: A ittifakının lideri, b: A üyesi, c: B ittifakının lideri
const a = await lordKur('a');
const b = await lordKur('b');
const c = await lordKur('c');
await a.post('/test/bolgeleri-sifirla');

for (const l of [a, b, c]) await l.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
const A = await a.post('/ittifak/kur', {
  ad: `Pakt A ${damga % 10000}`,
  etiket: `PA${damga % 100}`,
});
const Bi = await c.post('/ittifak/kur', {
  ad: `Pakt B ${damga % 10000}`,
  etiket: `PB${damga % 100}`,
});
// Kapıyı aç: ittifak varsayılan olarak BAŞVURUYLA üye alıyor (docs/09
// §2.1). Bu testin ölçtüğü şey başvuru değil; lider gibi davranıp
// kapıyı açıyoruz. Başvurunun kendisi ittifak-basvuru-testi'nde.
await a.post('/ittifak/ayarlar', { katilim: 'acik' });

await b.post(`/ittifak/${A.id}/katil`);
kontrol('İki ittifak kuruldu', Boolean(A?.id && Bi?.id), `${A?.ad} / ${Bi?.ad}`);

// --- Yetki: üye pakt teklif edemez
const uyeTeklifi = await b.post('/ittifak/pakt', { ittifakId: Bi.id });
kontrol(
  'Üye pakt teklif edemiyor',
  uyeTeklifi?.code === 'YETKISIZ',
  uyeTeklifi?.code ?? 'teklif etti',
);

// --- Kendi ittifakınla pakt
const kendine = await a.post('/ittifak/pakt', { ittifakId: A.id });
kontrol(
  'Kendi ittifakınla pakt yapılamıyor',
  kendine?.code === 'KENDI_ITTIFAKIN',
  kendine?.code ?? 'kuruldu',
);

// --- Teklif
const teklif = await a.post('/ittifak/pakt', { ittifakId: Bi.id });
kontrol('Lider pakt teklif edebiliyor', teklif?.durum === 'teklif', teklif?.code ?? teklif?.durum);

const aDurum = await a.get('/ittifak/paktlar');
kontrol(
  'Teklif gönderenin listesinde',
  aDurum?.giden?.length === 1,
  `${aDurum?.giden?.length} giden`,
);
const cDurum = await c.get('/ittifak/paktlar');
kontrol(
  'Teklif alıcının listesinde',
  cDurum?.gelen?.length === 1,
  `${cDurum?.gelen?.length} gelen`,
);
kontrol(
  'Karşı taraf teklifi olayında görüyor',
  (await c.get('/me')).events.some((e) => e.kind === 'pakt_teklifi'),
);

// --- ASIL KURAL 1: teklif tek başına KORUMUYOR
await orduKur(a);
await orduKur(c);
const cBolge = await bolgeAl(c);
kontrol('Karşı ittifak bir bölge aldı', Boolean(cBolge), cBolge?.name ?? 'alamadı');

// Fetih kalkanı kaldırılıyor: yoksa saldırı denemeleri PAKT_VAR yerine
// BOLGE_KORUMALI ile dönüyor ve testin ölçtüğü şey paktın kendisi
// olmaktan çıkıyor. İlk hâlinde bu iki kontrol "pakt engellemiyor"u
// kanıtlıyordu ama "saldırı GERÇEKTEN açık"ı kanıtlamıyordu.
await a.post('/test/kalkanlari-kaldir');
const teklifkenSaldiri = await a.post('/march', {
  toRegionId: cBolge.id,
  army: { mizrakci: 10 },
});
kontrol(
  'SADECE TEKLİF saldırıyı engellemiyor',
  Boolean(teklifkenSaldiri?.marchId),
  teklifkenSaldiri?.code ?? 'yürüyüş kabul edildi',
);
// Yürüyüşü ÇÖZMÜYORUZ. İlk hâlinde çözüyordum ve saldırı gerçekten geçtiği
// için bölge a'ya geçiyordu; sonraki bütün pakt kontrolleri "KENDI_BOLGEN"
// ile kalıyordu. Ölçmek istediğimiz şey yürüyüşün KABUL EDİLMESİ; savaşın
// sonucu bu testin konusu değil.

// --- Kendi teklifini kabul edemez
const kendiKabul = await a.post(`/ittifak/pakt/${teklif.id}/kabul`);
kontrol(
  'Kendi teklifini kabul edemiyor',
  kendiKabul?.code === 'KENDI_TEKLIFIN',
  kendiKabul?.code ?? 'kabul etti',
);

// --- Kabul
const kabul = await c.post(`/ittifak/pakt/${teklif.id}/kabul`);
kontrol(
  'Karşı lider paktı kabul edebiliyor',
  kabul?.durum === 'yururlukte',
  kabul?.code ?? kabul?.durum,
);
kontrol(
  'İki taraf da paktı olayında görüyor',
  (await a.get('/me')).events.some((e) => e.kind === 'pakt_kuruldu'),
);

// --- ASIL KURAL 2: pakt saldırıyı ENGELLİYOR
const paktliSaldiri = await a.post('/march', { toRegionId: cBolge.id, army: { mizrakci: 10 } });
kontrol(
  'PAKTLI İTTİFAKA SALDIRILAMIYOR',
  paktliSaldiri?.code === 'PAKT_VAR',
  paktliSaldiri?.code ?? 'saldırı geçti',
);

const harita = await a.get('/map');
const isaretli = harita.regions.find((r) => r.id === cBolge.id);
kontrol(
  'Harita paktlı bölgeyi işaretliyor',
  isaretli?.paktli === true,
  `paktli=${isaretli?.paktli}`,
);
const detay = await a.get(`/map/${cBolge.id}`);
kontrol('Bölge detayı paktı söylüyor', detay?.paktli === true, `paktli=${detay?.paktli}`);
kontrol('Paktlı MÜTTEFİK değil', detay?.muttefik === false, `muttefik=${detay?.muttefik}`);

// --- Pakt varken takviye gönderilemiyor: pakt ittifak değil
const takviye = await a.post(`/map/${cBolge.id}/takviye`, { army: { mizrakci: 10 } });
kontrol(
  'Paktlıya takviye gönderilemiyor',
  takviye?.code === 'ITTIFAK_DEGIL',
  takviye?.code ?? 'gönderildi',
);

// --- Aynı pakt ikinci kez kurulamaz
const ikinci = await a.post('/ittifak/pakt', { ittifakId: Bi.id });
kontrol(
  'Aynı ittifakla ikinci pakt açılamıyor',
  ikinci?.code === 'PAKT_VAR',
  ikinci?.code ?? 'açıldı',
);

// --- ASIL KURAL 3: fesih ANINDA geçerli DEĞİL
const fesih = await a.post(`/ittifak/pakt/${teklif.id}/fesih`);
kontrol('Pakt feshedilebiliyor', fesih?.feshediliyor === true, fesih?.code ?? 'feshedildi');
kontrol('Fesih ihbar süresi söyleniyor', fesih?.ihbarSaat > 0, `${fesih?.ihbarSaat} saat`);

const fesihSonrasi = await a.post('/march', { toRegionId: cBolge.id, army: { mizrakci: 10 } });
kontrol(
  'FESİHTEN HEMEN SONRA HÂLÂ SALDIRILAMIYOR',
  fesihSonrasi?.code === 'PAKT_VAR',
  fesihSonrasi?.code ?? 'saldırı geçti — pakt kalkana dönmüş',
);

const feshedilen = await a.get('/ittifak/paktlar');
const satir = feshedilen.yururlukte[0];
kontrol(
  'Feshedilen pakt hâlâ yürürlükte listesinde',
  satir?.durum === 'feshediliyor',
  satir?.durum ?? 'listede yok',
);
kontrol('Kalan süre arayüze söyleniyor', satir?.kalanSn > 0, `${satir?.kalanSn} sn`);
kontrol('Feshedenin kim olduğu söyleniyor', satir?.benMiFeshettim === true);
kontrol(
  'Karşı taraf feshi olayında görüyor',
  (await c.get('/me')).events.some((e) => e.kind === 'pakt_feshi'),
);

// --- İhbar süresi dolunca pakt bitiyor
await a.post('/test/paktlari-bitir');
await a.post('/test/kalkanlari-kaldir');
const bitmisSaldiri = await a.post('/march', { toRegionId: cBolge.id, army: { mizrakci: 10 } });
kontrol(
  'İHBAR SÜRESİ DOLUNCA SALDIRI AÇILIYOR',
  Boolean(bitmisSaldiri?.marchId),
  bitmisSaldiri?.code ?? 'yürüyüş kabul edildi',
);

const sonDurum = await a.get('/ittifak/paktlar');
kontrol(
  'Biten pakt yürürlükte listesinden düşüyor',
  sonDurum?.yururlukte?.length === 0,
  `${sonDurum?.yururlukte?.length} pakt`,
);

// --- Biten paktın yerine yenisi teklif edilebiliyor (benzersizlik kısıtı
// aynı satırı yeniden kullanmalı, ikinci satır açmaya kalkışmamalı)
const yeniden = await a.post('/ittifak/pakt', { ittifakId: Bi.id });
kontrol(
  'Biten paktın yerine yenisi teklif edilebiliyor',
  yeniden?.durum === 'teklif',
  yeniden?.code ?? yeniden?.durum,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
